import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
await import('./c01-migration.mjs');
const require = createRequire(import.meta.url), root = path.resolve(import.meta.dirname,'..');
const { chromium } = process.env.PLAYWRIGHT_PACKAGE
  ? await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE,'index.mjs'))) : require('playwright');
const server = await createServer({configFile:path.join(root,'vite.pages.config.ts'),
  server:{host:'127.0.0.1',port:0,hmr:false,forwardConsole:false,fs:{allow:[root]}},logLevel:'error'});
await server.listen();
const browser = await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'msedge'});
try {
  const page = await browser.newPage();
  await page.route('**/__c01',route => route.fulfill({contentType:'text/html',body:'<!doctype html><title>C01 isolated storage migration</title>'}));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/__c01');
  const result = await page.evaluate(async ({sourceRoot,fixture}) => {
    const {loadBundledSupply} = await import(sourceRoot + '/lib/curriculum/bundled.ts');
    const {IndexedDbProgressStore} = await import(sourceRoot + '/lib/progress/indexed-db.ts');
    const {CurriculumController} = await import(sourceRoot + '/features/curriculum/controller.ts');
    const supply = await loadBundledSupply(), old = supply.previous;
    const equal = (a,b,label) => { if(JSON.stringify(a)!==JSON.stringify(b)) throw Error(label); };
    const legacyStorage = {getItem:() => null};
    const oldStore = new IndexedDbProgressStore(old,indexedDB,'c01-upgrade');
    const original = await oldStore.commit(fixture,null);
    const stale = await CurriculumController.open(old,oldStore,legacyStorage);
    const one = new IndexedDbProgressStore(supply,indexedDB,'c01-upgrade');
    const two = new IndexedDbProgressStore(supply,indexedDB,'c01-upgrade');
    const [first,second] = await Promise.all([one.read(),two.read()]);
    equal(first,second,'concurrent migration diverged');
    if(first.storageRevision!==original.storageRevision+1) throw Error('migration must commit once');
    equal(await one.readBackup(original.storageRevision),original,'backup is not original');
    equal(await one.read(),first,'migration repeated');
    let staleRejected = false;
    try { await stale.deferSetup(); } catch(error) { staleRejected = error.message.includes('REVISION_CONFLICT'); }
    if(!staleRejected) throw Error('old tab overwrote migration');
    const resumed = await CurriculumController.open(supply,two,legacyStorage);
    if(resumed.snapshot().profile.activeInstance.instanceId!=='c01-partial') throw Error('active identity lost');
    await resumed.answer({instanceId:'c01-partial',response:{answers:{q2:['o1']}}});
    if(resumed.snapshot().profile.receipts['c01-partial'].outcome!=='correct') throw Error('continuation failed');
    for (const method of ['put','add']) {
      const name='c01-quota-'+method;
      const priorStore=new IndexedDbProgressStore(old,indexedDB,name);
      const before=await priorStore.commit(fixture,null);
      const upgradedStore=new IndexedDbProgressStore(supply,indexedDB,name);
      // eslint-disable-next-line typescript/unbound-method -- Restore the saved prototype method without invoking it unbound.
      const originalMethod=IDBObjectStore.prototype[method];
      IDBObjectStore.prototype[method]=function(){throw new DOMException('test quota','QuotaExceededError');};
      let rejected=false;
      try { await upgradedStore.read(); } catch(error) { rejected=error.name==='QuotaExceededError'; }
      finally { IDBObjectStore.prototype[method]=originalMethod; }
      if(!rejected) throw Error('migration failure not surfaced: '+method);
      equal(await priorStore.read(),before,'failed migration changed state: '+method);
      if(await upgradedStore.readBackup(before.storageRevision)!==null) throw Error('partial backup survived aborted transaction');
      await upgradedStore.read();
      equal(await upgradedStore.readBackup(before.storageRevision),before,'retry failed to preserve original');
      await priorStore.close(); await upgradedStore.close();
    }
    await one.close(); await two.close(); await oldStore.close();
    return {passed:true,scenarios:['concurrent migration commits once','exact original backup','idempotent reopen','old tab cannot overwrite new content','partial reading resumes exact instance','state write failure rolls back both stores','backup write failure rolls back both stores','retry succeeds after storage recovery']};
  }, {sourceRoot:'/@fs/' + root.replaceAll('\\','/'), fixture:JSON.parse(fs.readFileSync('.local/c01/legacy-partial.json','utf8'))});
  assert.equal(result.passed,true);
  fs.writeFileSync('.local/c01/browser-report.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} finally { await browser.close(); await server.close(); }
