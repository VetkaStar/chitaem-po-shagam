import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {compileCurriculum,supplyText,root} from './curriculum-harness.mjs';
const require=createRequire(import.meta.url);
const playwrightPath=process.env.PLAYWRIGHT_PACKAGE;
const {chromium}=playwrightPath ? await import(pathToFileURL(path.join(playwrightPath,'index.mjs'))) : require('playwright');
const output=compileCurriculum(), [curriculum,registry]=supplyText();
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Curriculum IndexedDB integration</title>');return;}
  if(url.pathname==='/curriculum.json'||url.pathname==='/registry.json'){
    res.setHeader('Content-Type','application/json');res.end(url.pathname==='/curriculum.json'?curriculum:registry);return;
  }
  const file=path.resolve(output,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(output+path.sep)||!fs.existsSync(file)||!file.endsWith('.js')&&!file.endsWith('.mjs')){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type','text/javascript');fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address='http://127.0.0.1:'+server.address().port;
let browser;
try{
  browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
  const context=await browser.newContext();
  const first=await context.newPage(),second=await context.newPage();
  const initialize=async(page)=>{
    await page.goto(address);
    await page.evaluate(async()=>{
      const {loadSupply}=await import('/lib/curriculum/loader.js');
      const {IndexedDbProgressStore}=await import('/lib/progress/indexed-db.js');
      const {CurriculumController}=await import('/features/curriculum/controller.js');
      const supply=await loadSupply(await(await fetch('/curriculum.json')).text(),await(await fetch('/registry.json')).text());
      localStorage.setItem('reading-steps-v3','{"stars":29,"settings":{"look":"notebook"}}');
      const store=new IndexedDbProgressStore(supply);
      const ctl=await CurriculumController.open(supply,store,localStorage);
      window.h={supply,store,ctl};
    });
  };
  await initialize(first);await initialize(second);
  const conflicts=await Promise.allSettled([
    first.evaluate(()=>window.h.ctl.deferSetup()),
    second.evaluate(()=>window.h.ctl.resumeSetup())
  ]);
  assert.equal(conflicts.filter(x=>x.status==='fulfilled').length,1);
  assert.match(conflicts.find(x=>x.status==='rejected').reason.message,/REVISION_CONFLICT/);
  await initialize(first);
  const result=await first.evaluate(async()=>{
    const {ctl,store,supply}=window.h;
    await ctl.deferSetup();
    const exported=await ctl.export();
    const beforeImport=ctl.snapshot();
    try{await ctl.import(exported.replace('"specVersion":"onboarding-0.7.3"','"specVersion":"unknown"'));throw Error('accepted bad version');}
    catch(error){if(error.message==='accepted bad version')throw error;}
    if(JSON.stringify(ctl.snapshot())!==JSON.stringify(beforeImport))throw Error('import modified local state');
    await ctl.resumeSetup();
    const prior=ctl.snapshot();
    await ctl.import(exported);
    const backup=await store.readBackup(prior.storageRevision);
    if(JSON.stringify(backup)!==JSON.stringify(prior))throw Error('backup mismatch');
    if(localStorage.getItem('reading-steps-v3')!=='{"stars":29,"settings":{"look":"notebook"}}')throw Error('legacy key modified');
    const good=ctl.snapshot();
    const originalPut=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(){throw new DOMException('test quota','QuotaExceededError');};
    let quota=false;
    try{await ctl.import(exported);}catch(error){quota=error.name==='QuotaExceededError';}
    finally{IDBObjectStore.prototype.put=originalPut;}
    if(!quota)throw Error('quota not surfaced');
    if(JSON.stringify(await store.read())!==JSON.stringify(good))throw Error('failed transaction wrote state');
    if(await store.readBackup(good.storageRevision)!==null)throw Error('failed transaction left a backup');
    const item=Object.values(supply.curriculum.items).find(t=>t.kind==='passage'&&t.answer.questions.length>=2&&t.id!=='task.1bb67acaeb41');
    await ctl.beginVisit('real-idb-partial',3);
    await ctl.launchFree(item.id,'read','real-idb-instance');
    await ctl.recordReading('real-idb-instance',{verifier:'companion',correct:true});
    await ctl.revealOptions();
    const q=item.answer.questions[0];
    await ctl.answer({instanceId:'real-idb-instance',response:{answers:{[q.id]:q.correctOptionIds}}});
    return {saved:ctl.snapshot(),visible:ctl.visible(),legacy:localStorage.getItem('reading-steps-v3'),
      browser:navigator.userAgent,quota,backupRevision:prior.storageRevision};
  });
  await initialize(first);
  const restored=await first.evaluate(()=>({saved:window.h.ctl.snapshot(),visible:window.h.ctl.visible()}));
  assert.deepEqual(restored.saved,result.saved);assert.deepEqual(restored.visible,result.visible);
  assert.equal(restored.saved.profile.activeInstance.instanceId,'real-idb-instance');
  const log={date:new Date().toISOString(),browser:result.browser,scenarios:[
    'real IndexedDB competing tabs: exactly one commit',
    'incompatible import leaves state intact','successful import backs up previous aggregate',
    'QuotaExceededError aborts both state and backup writes','original localStorage remains intact',
    'reload restores passage partial, exact instance, reading stage and option order'
  ],passed:6};
  const report=path.join(root,'.local','curriculum-browser-report.json');fs.writeFileSync(report,JSON.stringify(log,null,2));
  console.log(JSON.stringify(log,null,2));
  await context.close();
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
