/** Narrow regression for pilot menus and public topic switching; no build/preview. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'vite';
const root=path.resolve(import.meta.dirname,'..');
const output=path.join(root,'.local/content-pilot-20261104/texts-fix-browser');
fs.mkdirSync(output,{recursive:true});
const {chromium}=await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE,'index.mjs')));
const server=await createServer({configFile:path.join(root,'vite.pages.config.ts'),server:{host:'127.0.0.1',port:0,hmr:false,forwardConsole:false},logLevel:'error'});
const report={cases:[],errors:[],limitation:'Actual AppPortal/TextLibrary/TopicBar and IndexedDB; speech transport mocked; no production build.'};
let browser;
async function ready(p){
  await p.waitForFunction(()=>!document.querySelector('.free-material.is-pending,.retained-text-frame[aria-busy="true"]'));
  await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
}
try {
  await server.listen();
  const base='http://127.0.0.1:'+server.httpServer.address().port;
  const fixture=path.join(root,'tests/fixtures/content-pilot.tsx').replaceAll('\\','/');
  const html=await server.transformIndexHtml('/__textfix.html',`<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@fs/${fixture}"></script></body></html>`);
  browser=await chromium.launch({headless:true,channel:'msedge'});
  for(const [width,height,layout] of [[390,844,'order'],[390,844,'focus'],[820,1180,'order'],[1280,720,'order']]){
    const p=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
    p.setDefaultTimeout(8000);p.on('pageerror',e=>{
      if(!report.errors.includes(e.message))report.errors.push(e.message);
    });
    await p.addInitScript(layout=>{
      localStorage.setItem('reading-profile-v1',JSON.stringify({name:'Проверка',age:'8',start:'syllables'}));
      localStorage.setItem('reading-steps-v3',JSON.stringify({settings:{styleChosen:true,unit:12,curriculumVersion:2,sound:false,autoSpeech:false,motion:false,autoAdvance:false,textFlow:'manual',showFullText:true,micConsent:true,breakEvery:0,breakMinutes:0,textFontSize:28,interfaceScale:100,layout,look:'plain',textPresentation:'scroll'},stars:0,history:[]}));
    },layout);
    await p.route('**/__textfix.html',r=>r.fulfill({contentType:'text/html',body:html}));
    await p.route(/\/lib\/local-speech\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:`
      const sessions=[];window.qaSpeech={active:()=>sessions.some(s=>s.active)};
      export function startLocalSpeech(callbacks){const s={active:true};sessions.push(s);queueMicrotask(()=>{if(s.active)callbacks.onReady?.();});return {abort(){s.active=false;},setEnabled(v){s.active=v;}};}` }));
    try{
      await p.goto(base+'/__textfix.html');await p.waitForFunction(()=>window.qaPilot?.model?.ready);await ready(p);
      await p.locator('.portal-grid').getByRole('button',{name:/ШАГ 6 Тексты/}).click();
      await p.locator('.portal-grid').getByRole('button',{name:'Рассказы',exact:true}).click();await ready(p);
      for(const id of ['pilot-story-catfish-v1','pilot-story-sled-v1','pilot-story-bag-v1']){
        const select=p.locator('summary').filter({hasText:'Выбрать текст'});
        await select.click();await ready(p);
        await p.locator('[data-text-id="'+id+'"]').click();await ready(p);
        const preparation=p.locator('[data-text-preparation="'+id+'"]');
        await preparation.waitFor();
        const card=await p.locator('.text-exercise').boundingBox();
        await preparation.locator('summary').click();await ready(p);
        assert(await preparation.evaluate(el=>el.open));
        const panel=await preparation.locator('.practice-menu-panel').boundingBox();
        assert(panel.x>=-1&&panel.x+panel.width<=width+1,'preparation panel inside viewport');
        const after=await p.locator('.text-exercise').boundingBox();
        assert(Math.abs(card.y-after.y)<1&&Math.abs(card.height-after.height)<1,'card stable');
        const summaries=await p.locator('.lesson-controls > details > summary').evaluateAll(els=>els.map(el=>{
          const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};
        }));
        for(let i=0;i<summaries.length;i++)for(let j=i+1;j<summaries.length;j++){
          const a=summaries[i],b=summaries[j];assert(!(a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y),'menu summaries do not overlap');
        }
        await p.screenshot({path:path.join(output,id+'-'+width+'-'+layout+'.png')});
        // Opening the picker must reliably close preparation without a DOM-force click.
        await select.click();await ready(p);
        assert.equal(await preparation.evaluate(el=>el.open),false);
        assert.equal(await select.evaluate(el=>el.parentElement.open),true);
        await select.click();await ready(p);
        await p.getByRole('button',{name:'Начать чтение с микрофоном',exact:true}).click();
        await p.waitForFunction(()=>window.qaSpeech.active());
        // Exercise the public TopicBar button, not direct model.update.
        await p.getByRole('button',{name:'Выбрать другую тему',exact:true}).click();
        await p.locator('.topic-options').getByRole('button',{name:/^1\. А, У и М/}).click();await ready(p);
        await p.waitForFunction(()=>!window.qaSpeech.active());
        assert.equal(await p.getByRole('button',{name:'Выключить микрофон',exact:true}).count(),0);
        assert.equal(await p.evaluate(()=>window.qaPilot.model.settings.unit),0);
        await p.getByRole('button',{name:'Выбрать другую тему',exact:true}).click();
        await p.locator('.topic-options').getByRole('button',{name:/13\. Весь алфавит/}).click();await ready(p);
        report.cases.push({id,width,height,layout,status:'PASS',panel,cardStable:true,publicTopicSwitchStoppedMic:true});
      }
    }catch(e){await p.screenshot({path:path.join(output,'failure-'+width+'-'+layout+'.png')});throw e;}
    finally{await p.close();}
  }
  assert.deepEqual(report.errors,[]);
}catch(e){report.failure=e.stack;process.exitCode=1;}
finally{
  await browser?.close();await server.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({cases:report.cases.length,errors:report.errors,failure:report.failure,output},null,2));
  process.exit(process.exitCode || 0);
}
