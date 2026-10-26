import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

export const root = path.resolve(import.meta.dirname, '..');
export const matrix = ['order', 'focus'].flatMap(layout => ['plain', 'notebook'].flatMap(look =>
  [[1280,720,100], [820,1180,100], [1180,820,100], [390,844,100], [1920,1080,120]]
    .map(([width,height,interfaceScale]) => ({ layout,look,width,height,interfaceScale }))));
export function fingerprints() {
  return Object.fromEntries(['app/globals.css','features/lesson/ExerciseCard.tsx',
    'features/lesson/ExerciseFeedback.tsx','features/lesson/ExerciseActions.tsx',
    'features/portal/AppPortal.tsx'].map(file => [file, createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
}
export async function harness(name, fixture) {
  const phase = process.env.QA_PHASE || 'final';
  if (phase === 'final' && !process.env.QA_READY && !['TASK-CARD-HANDOFF.md','HOME-ACTIONS-HANDOFF.md']
    .every(file => fs.existsSync(path.join(root,'docs',file))))
    throw Error('Final QA requires both handoffs or coordinator readiness (QA_READY=1).');
  const output = path.join(root,'.local/task-card-review',phase,name);
  fs.mkdirSync(output,{recursive:true});
  const server = await createServer({configFile:path.join(root,'vite.pages.config.ts'),
    server:{host:'127.0.0.1',port:0,hmr:false,forwardConsole:false,fs:{allow:[root]}},logLevel:'error'});
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const { chromium } = process.env.PLAYWRIGHT_PACKAGE
    ? await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE,'index.mjs')))
    : createRequire(import.meta.url)('playwright');
  const browser = await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'msedge'});
  const report = {phase, started:new Date().toISOString(),sourceBefore:fingerprints(),cases:[],errors:[],limits:[
    'Microphone states are UI mocks; no child speech or ASR accuracy is tested.',
    'Separate ephemeral Vite dev server; preview 5184 and dist-pages are untouched.',
  ]};
  let html;
  if (fixture) html = await server.transformIndexHtml('/__qa.html',`<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@fs/${path.join(root,fixture).replaceAll('\\','/')}"></script></body></html>`);
  return { output,report,browser, async page(config) {
    const p = await browser.newPage({viewport:{width:config.width,height:config.height},reducedMotion:'reduce'});
    p.setDefaultTimeout(10000);
    p.on('pageerror',e=>report.errors.push(e.message));
    await p.addInitScript(settings => {
      localStorage.setItem('reading-profile-v1',JSON.stringify({name:'Проверка',age:'8',start:'syllables'}));
      localStorage.setItem('reading-steps-v3',JSON.stringify({settings:{styleChosen:true,unit:12,curriculumVersion:2,
        sound:false,autoSpeech:false,motion:false,breakEvery:0,breakMinutes:0,length:3,autoAdvance:false,...settings},stars:0,history:[],recentWords:{}}));
    },config);
    if (html) await p.route('**/__qa.html',r=>r.fulfill({contentType:'text/html',body:html}));
    await p.goto(base + (html ? '/__qa.html' : '/'));
    await p.getByRole('heading',{name:'Привет, Проверка!'}).waitFor();
    await p.evaluate(()=>document.fonts.ready);
    return p;
  }, async close() {
    report.sourceAfter=fingerprints();
    report.sourcesChanged=JSON.stringify(report.sourceBefore)!==JSON.stringify(report.sourceAfter);
    report.finished=new Date().toISOString();
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
    await browser.close(); await server.close();
    console.log(JSON.stringify({phase,cases:report.cases.length,failed:report.cases.filter(c=>c.failures.length).length,errors:report.errors,sourcesChanged:report.sourcesChanged,report:path.join(output,'report.json')},null,2));
    if (report.errors.length || report.cases.some(c=>c.failures.length) || report.sourcesChanged) process.exitCode=1;
  }};
}
export async function settle(page) {
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
export async function metrics(page) {
  await settle(page);
  return page.evaluate(()=>{
    const rect = e => {if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const frame=document.querySelector('.task-card') || document.querySelector('.exercise');
    const button=[...document.querySelectorAll('.task-card-dock .primary, .lesson-dock .primary, .task-card .task-card-primary, .task-card .primary, .task-card button[type="submit"]')]
      .find(e=>e.getBoundingClientRect().width>0);
    const r=button?.getBoundingClientRect();
    // Probe edge midpoints, not rounded-off corners outside the actual button shape.
    const hit=r ? [[(r.left+r.right)/2,r.top+3],[r.right-3,(r.top+r.bottom)/2],[(r.left+r.right)/2,r.bottom-3],[r.left+3,(r.top+r.bottom)/2],[(r.left+r.right)/2,(r.top+r.bottom)/2]]
      .map(([x,y])=>{const top=document.elementFromPoint(x,y);return !!top && (top===button || button.contains(top));}) : [];
    const clippedBy=[];
    for(let e=button?.parentElement;e && r;e=e.parentElement){const css=getComputedStyle(e),a=e.getBoundingClientRect();
      if((/hidden|clip|auto|scroll/.test(css.overflowX) && (r.left<a.left-1 || r.right>a.right+1)) ||
        (/hidden|clip|auto|scroll/.test(css.overflowY) && (r.top<a.top-1 || r.bottom>a.bottom+1)))clippedBy.push(e.className);}
    const hiddenHint=document.querySelector('.hint-space[aria-hidden="true"]');
    const clip = [...document.querySelectorAll('.reading, .word-bridge, .task-card-body, .exercise-content')].map(el=>({
      className:el.className,rect:rect(el),height:el.clientHeight,scrollHeight:el.scrollHeight,overflowY:getComputedStyle(el).overflowY}));
    return {frame:rect(frame),button:rect(button),buttonText:button?.textContent,buttonDisabled:button?.disabled,
      buttonHit:hit,potentialClipAncestors:clippedBy,viewport:{width:innerWidth,height:innerHeight},scroll:{x:scrollX,y:scrollY,width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},
      hintReservedHeight:hiddenHint?.getBoundingClientRect().height || 0,clip};
  });
}
const id = c=>`${c.layout}-${c.look}-${c.width}x${c.height}-${c.interfaceScale}`;
const selected=()=>matrix.filter(c=>!process.env.QA_CASE || id(c).includes(process.env.QA_CASE));
async function readPlatform(page) {
  return page.evaluate(()=>new Promise((resolve,reject)=>{
    const open=indexedDB.open('reading-platform-v1');open.onerror=()=>reject(open.error);
    open.onsuccess=()=>{const db=open.result,q=db.transaction('state').objectStore('state').get('local');
      q.onsuccess=()=>{resolve(q.result);db.close();};q.onerror=()=>{reject(q.error);db.close();};};
  }));
}
async function extraCases(h) {
  const bank=JSON.parse(fs.readFileSync(path.join(root,'content/curriculum/curriculum.json'),'utf8'));
  for(const config of selected()) for(const area of ['composition','text']) {
    const c={name:`${id(config)}-${area}`,config,states:[],failures:[]};h.report.cases.push(c);
    const p=await h.page(config);
    const check=(ok,text)=>{if(!ok)c.failures.push(text);};
    async function capture(name,reference) {
      const m=await metrics(p);c.states.push({name,...m});
      check(m.scroll.width<=config.width+1,`${name}: horizontal overflow`);
      check(m.frame && m.frame.y>=-1 && m.frame.bottom<=config.height+1,`${name}: frame outside viewport`);
      check(m.button && m.button.y>=-1 && m.button.bottom<=config.height+1,`${name}: primary outside viewport`);
      check(m.buttonHit.length===5 && m.buttonHit.every(Boolean),`${name}: primary clipped or covered`);
      if(reference)for(const key of ['frame','button'])for(const axis of ['x','y','width','height']) {
        const delta=(m[key]?.[axis]??NaN)-(reference[key]?.[axis]??NaN);
        check(Math.abs(delta)<=2,`${name}: ${key}.${axis} moved ${delta.toFixed(2)}px`);
      }
      if(config.look==='plain' && ['initial','hint','scrolled'].includes(name))await p.screenshot({path:path.join(h.output,`${c.name}-${name}.png`)});
      return m;
    }
    try {
      await p.locator('.portal-grid').getByRole('button',{name:area==='composition'?/ШАГ 2 Слоги/:/ШАГ 6 Тексты/}).click();
      await p.locator('.portal-grid').getByRole('button',{name:area==='composition'?'Состав слога':'Рассказы',exact:true}).click();
      await p.locator(area==='composition'?'.syllable-parts-exercise':'.text-exercise').waitFor();
      await p.waitForFunction(()=>!document.querySelector('.free-material.is-pending, .syllable-parts-exercise[aria-busy="true"]'));
      if(area==='composition') {
        const initial=await capture('initial');
        const body=initial.clip.find(x=>String(x.className).includes('task-card-body'));
        check(!body || body.scrollHeight<=body.height+2,'ordinary composition requires inner scrolling');
        const saved=await readPlatform(p),task=bank.items[saved.profile.activeInstance.itemId];
        const parts=task.partTokens;
        await p.locator('.curriculum-token-bank button:enabled').filter({hasText:new RegExp('^'+parts[0].text+'$')}).first().click();
        const typed=await p.locator('.curriculum-composition').innerText();
        await p.getByRole('button',{name:'Подсказка',exact:true}).click();
        await p.locator('.hint-box').waitFor();await capture('hint',initial);
        await p.getByRole('button',{name:'Скрыть подсказку',exact:true}).click();
        check(await p.locator('.curriculum-composition').innerText()===typed,'composition lost selected token on closing hint');
        for(const part of parts.slice(1))await p.locator('.curriculum-token-bank button:enabled').filter({hasText:new RegExp('^'+part.text+'$')}).first().click();
        await p.locator('.syllable-parts-exercise button[type="submit"]').click();
        await p.locator('.feedback.success').waitFor();await capture('success',initial);
        await p.getByRole('button',{name:'Повторить задание',exact:true}).click();
        await p.locator('.curriculum-token-bank').waitFor();await capture('repeat',initial);
        await p.getByRole('tab',{name:'Находим часть',exact:true}).click();
        await p.locator('.syllable-parts-exercise').waitFor();await capture('find-part');
      }else{
        await p.getByRole('button',{name:'Пишу',exact:true}).click();
        await p.getByLabel('Твоя строка',{exact:true}).waitFor();
        const initial=await capture('initial');
        c.text=await p.locator('.text-exercise h2').innerText();
        c.longTextInternalScroll=initial.clip.filter(x=>String(x.className).includes('task-card-body') && x.scrollHeight>x.height+2);
        await p.locator('.task-card-body').evaluate(el=>{el.scrollTop=el.scrollHeight;});
        await capture('scrolled',initial);
        await p.getByLabel('Твоя строка',{exact:true}).fill('ЖЖЖЖЖЖ');
        await p.getByRole('button',{name:/^Проверить/}).click();await capture('wrong',initial);
      }
    }catch(e){c.failures.push(`scenario aborted: ${e.message}`);await p.screenshot({path:path.join(h.output,`${c.name}-aborted.png`)});}
    finally{await p.close();fs.writeFileSync(path.join(h.output,'in-progress.json'),JSON.stringify(h.report,null,2));}
  }
}
async function run() {
  const h=await harness('task-card','tests/fixtures/task-card-layout.tsx');
  try {
    for(const config of selected()) {
      const c={name:id(config),config,states:[],failures:[]}; h.report.cases.push(c);
      const p=await h.page(config);
      const check=(ok,message)=>{if(!ok)c.failures.push(message);};
      async function capture(name,reference,{pending=false,shot=false}={}) {
        const m=await metrics(p); c.states.push({name,...m});
        check(m.scroll.width<=config.width+1,`${name}: horizontal overflow ${m.scroll.width}`);
        check(m.hintReservedHeight<140,`${name}: hidden hint reserves ${m.hintReservedHeight}px`);
        if(!pending) {
          check(m.button && m.button.y>=0 && m.button.bottom<=config.height+1,`${name}: primary outside viewport`);
          check(m.buttonHit.length===5 && m.buttonHit.every(Boolean),`${name}: primary clipped or covered`);
          check(m.frame && m.frame.y>=0 && m.frame.bottom<=config.height+1,`${name}: ordinary card outside viewport`);
        }
        if(reference) for(const key of ['frame','button']) for(const axis of ['x','y','width','height']) {
          const delta=(m[key]?.[axis]??NaN)-(reference[key]?.[axis]??NaN);
          check(Math.abs(delta)<=2,`${name}: ${key}.${axis} moved ${delta.toFixed(2)}px`);
        }
        if(shot) await p.screenshot({path:path.join(h.output,`${c.name}-${name}.png`)});
        return m;
      }
      async function ready(){await p.waitForFunction(()=>!document.querySelector('.free-material.is-pending'));await settle(p);}
      try {
        await p.getByRole('button',{name:'Начать занятие →',exact:true}).click(); await ready();
        const read=await capture('read',null,{shot:config.look==='plain'});
        const readBody=read.clip.find(x=>String(x.className).includes('task-card-body'));
        check(!readBody || readBody.scrollHeight<=readBody.height+2,'ordinary syllable requires inner scrolling');
        for(const state of ['loading','listening','waiting','error','off']) {
          await p.evaluate(s=>window.qaMic(s),state); await capture(`mic-${state}`,read);
        }
        await p.getByRole('button',{name:'Подсказка',exact:true}).click(); await ready();
        await capture('read-hint',read,{shot:config.width===1280 && config.look==='plain'});
        await p.getByRole('button',{name:'Скрыть подсказку',exact:true}).click();await ready();
        await p.evaluate(()=>window.qaLesson.navigate('syllables','type')); await ready();
        const type=await capture('type');
        const input=p.getByRole('textbox',{name:'Твой ответ'});
        await input.fill('А');
        await p.getByRole('button',{name:'Подсказка',exact:true}).click();await ready();
        await capture('type-hint',type);
        await p.getByRole('button',{name:'Скрыть подсказку',exact:true}).click();await ready();
        check(await input.inputValue()==='А','hint close lost typed answer');
        await input.fill('ЖЖЖ');await input.press('Enter');await ready();
        check(await p.evaluate(()=>window.qaLesson.feedback.kind)!=='success','wrong answer was accepted');
        await capture('wrong',type);
        await p.getByRole('button',{name:'Повторить задание',exact:true}).click();await ready();
        await capture('repeat',type);
        const before=await p.evaluate(()=>({stars:window.qaLesson.stars,count:window.qaLesson.count,history:window.qaLesson.history.length}));
        await input.fill(await p.evaluate(()=>window.qaLesson.target));
        await p.evaluate(()=>{window.qaExposure.hold=true;window.qaLesson.setHint(true);});
        await p.waitForFunction(()=>window.qaExposure.pending>0);
        await capture('pending',type,{pending:true});
        check(await p.locator('.free-material-content').first().evaluate(e=>e.inert && getComputedStyle(e).visibility==='hidden'), 'pending material is not hidden and inert');
        // The pending subtree is invisible, so boundingBox() would return null.
        // Click the previously measured primary location to test the actual pointer path.
        const b=type.button;
        if(b) await p.mouse.click(b.x+b.width/2,b.y+b.height/2);
        await p.keyboard.press('Enter');await settle(p);
        check(JSON.stringify(before)===JSON.stringify(await p.evaluate(()=>({stars:window.qaLesson.stars,count:window.qaLesson.count,history:window.qaLesson.history.length}))), 'pending click/Enter changed rewards or count');
        await p.evaluate(()=>window.qaExposure.commit());await ready();
        await p.getByRole('button',{name:'Скрыть подсказку',exact:true}).click();await ready();
        await input.press('Enter');await ready();
        check(await p.evaluate(()=>window.qaLesson.feedback.kind)==='success','correct answer not accepted');
        await capture('success',type);
        await p.getByRole('button',{name:/Дальше.*Enter/}).click();await ready();
        await input.fill(await p.evaluate(()=>window.qaLesson.target));await input.press('Enter');await ready();
        const bridge=p.getByRole('region',{name:'Из слогов в слово'});await bridge.waitFor();
        const bridgeState=await capture('word-bridge',type,{shot:config.look==='plain'});
        const bridgeBody=bridgeState.clip.find(x=>String(x.className).includes('task-card-body'));
        check(!bridgeBody || bridgeBody.scrollHeight<=bridgeBody.height+2,'WordBridge requires inner scrolling');
        const parts=(await bridge.locator('.task-instruction b').textContent()).split(' · ');
        for(const part of parts) await bridge.getByRole('button',{name:part,exact:true}).and(p.locator('button:enabled')).first().click();
        await ready();await p.keyboard.press('Enter');await ready();
        await input.fill(await p.evaluate(()=>window.qaLesson.target));await input.press('Enter');await ready();
        await p.getByRole('button',{name:/Дальше.*Enter/}).click();await ready();
        check(await p.evaluate(()=>window.qaLesson.done),'lesson did not reach completion');
        await capture('completion',type);
        await p.evaluate(()=>window.qaLesson.navigate('words','read'));await ready();
        for(const focus of ['line','word','syllable']) {
          await p.evaluate(value=>window.qaLesson.update('readingFocus',value),focus);await ready();
          await capture(`reading-${focus}`);
        }
        await p.evaluate(()=>window.qaLesson.setPartsHelp(true));await ready();await capture('word-parts');
        for(const vision of ['protan','deutan','tritan','mono']) {
          await p.evaluate(value=>window.qaLesson.update('colorVision',value),vision);await ready();
          await capture(`vision-${vision}`);
        }
      }catch(error){c.failures.push(`scenario aborted: ${error.message}`);await p.screenshot({path:path.join(h.output,`${c.name}-aborted.png`)});}
      finally{await p.close();fs.writeFileSync(path.join(h.output,'in-progress.json'),JSON.stringify(h.report,null,2));}
    }
    await extraCases(h);
  } finally{await h.close();}
}
if (process.argv[1] && path.resolve(process.argv[1])===path.resolve(import.meta.filename)) await run();
