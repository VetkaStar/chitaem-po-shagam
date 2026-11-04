/** Independent TextExercise QA. --baseline runs a small diagnostic reproduction;
 * --list starts no browser. Real app/text/exposure controller, fake speech transport.
 * Final acceptance is only meaningful on a frozen source tree. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..');
const four={id:'qa-four-lines',kind:'stories',title:'Утро в саду',lines:[
  'Утром Маша вышла в сад.','На ветке сидела маленькая птица.',
  'Маша насыпала птице зёрна.','Птица спела и улетела.'],
  question:'Что Маша дала птице?',options:['Зёрна','Молоко','Мяч'],answer:'Зёрна',hint:'Прочитай третью строку.',
  lineIllustrations:Array.from({length:4},()=>({src:'illustrations/stories/story-cat-01.webp',alt:'Картинка для проверки показа после записи'}))};
const long={...four,id:'qa-long-text',title:'Длинная прогулка',lines:[
  ...four.lines,
  'У большого старого дерева ребята остановились и стали внимательно рассматривать листья, слушать птиц и рассказывать друг другу, что они заметили по дороге через весь сад. '.repeat(6).trim(),
  'За деревом начиналась узкая тропинка.','По тропинке шёл рыжий кот.',
  'Кот остановился возле скамейки.','На скамейке сидел дедушка.',
  'Дедушка показал ребятам маленький домик для птиц.','Потом все вернулись домой.','Прогулка закончилась.']};
const base=['order','focus'].flatMap(layout=>['plain','notebook'].flatMap(look=>
  [[1280,720],[820,1180],[1180,820],[390,844]].flatMap(([width,height])=>['scroll','pages'].map(textPresentation=>
    ({layout,look,width,height,textPresentation,textFontSize:28,interfaceScale:100,material:width===820||width===1180?'long':'four'})))));
const fonts=['order','focus'].flatMap(layout=>['plain','notebook'].flatMap(look=>
  [1280,390].flatMap(width=>[24,32,40].map(textFontSize=>({layout,look,width,height:width===390?844:720,
    textPresentation:textFontSize===32?'scroll':'pages',textFontSize,interfaceScale:100,material:'long'})))));
const scales=['order','focus'].flatMap(layout=>['plain','notebook'].map(look=>
  // Shared interface scale is available only at >=1800x900 (globals.css).
  ({layout,look,width:1920,height:1080,textPresentation:'scroll',textFontSize:28,interfaceScale:120,material:'long'})));
const baseline=process.argv.includes('--baseline');
const smoke=process.argv.includes('--smoke');
const pager=process.argv.includes('--pager');
const layoutOnly=process.argv.includes('--layout');
const deepConfigs=[{...base[0],material:'four'},{...base[1],material:'long'},
  {...base.find(c=>c.layout==='focus'&&c.look==='plain'&&c.width===390&&c.textPresentation==='pages'),material:'long'}];
const configs=pager?[{...base[1],material:'long'},{...base.find(c=>c.layout==='focus'&&c.look==='plain'&&c.width===390&&c.textPresentation==='pages'),material:'long'}]:baseline?[{...base[0],material:'four'}, {...base[6],material:'long'}]:smoke?
  deepConfigs:[...base,...fonts,...scales];
const id=c=>`${c.layout}-${c.look}-${c.width}x${c.height}-${c.textPresentation}-${c.textFontSize}-${c.interfaceScale}-${c.material}`;
const files=['app/globals.css','features/library/TextExercise.tsx','features/library/TextLibrary.tsx',
  'features/library/use-text-microphone.ts','features/lesson/config.ts','features/lesson/lesson-storage.ts',
  'features/lesson/ReadingGuideControls.tsx','features/free-practice/use-free-exposure.tsx',
  'features/free-practice/FreeExposureFrame.tsx','features/free-practice/service.ts',
  ...(!baseline?['features/lesson/TextDisplayControls.tsx','features/library/RetainedTextFrame.tsx',
    'features/library/TextReadingViewport.tsx','features/library/text-pages.ts'].filter(file=>fs.existsSync(path.join(root,file))):[])];
const snapshot=()=>Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
const plan={cases:configs.map(id),baseline,smoke,pager,contracts:['continuous card/text during line transitions sampled by RAF and MutationObserver',
  'only text scrolls; mic/status/adult/actions remain visible','new material hidden until real IndexedDB exposure commits',
  'pending pointer/Enter do not advance or award','pages do not award or mark unread lines read',
  'font/resize retain active line and partial progress','oversize line remains scroll-accessible',
  'real adult confirmations, write/questions and stub audio regressions'],limits:['fake speech transport is not child ASR validation']};
if(process.argv.includes('--list'))console.log(JSON.stringify({...plan,defaultDeepCases:!baseline&&!smoke&&!pager&&!layoutOnly?deepConfigs.map(id):[]},null,2));
else {
  await run();
  if(!baseline&&!smoke&&!pager&&!layoutOnly)await run('deep',deepConfigs,'-deep');
}

async function run(depth=baseline||smoke?'deep':pager?'pager':'layout',selected=configs,suffix='') {
  const phase=(process.env.QA_PHASE||(baseline?'baseline':smoke?'diagnostic':'final'))+suffix;
  const output=path.join(root,'.local/text-reading-review',phase);fs.mkdirSync(output,{recursive:true});
  const frozen=baseline?Object.fromEntries(files.map(file=>[file,execFileSync('git',['show',`abd54ab:${file}`],{cwd:root,encoding:'utf8',windowsHide:true})])):null;
  const sampled=()=>frozen?Object.fromEntries(Object.entries(frozen).map(([file,source])=>[file,createHash('sha256').update(source).digest('hex')])):snapshot();
  const reused=[];
  if(depth==='layout'){
    if(process.env.QA_CASES){const names=new Set(process.env.QA_CASES.split('|'));selected=selected.filter(c=>names.has(id(c)));if(selected.length!==names.size)throw new Error('QA_CASES contains unknown case names');}
    for(const reportPath of (process.env.QA_REUSE_REPORTS||'').split('|').filter(Boolean)){
      const previous=JSON.parse(fs.readFileSync(reportPath,'utf8').replace(/^\uFEFF/,'')),current=sampled();
      if(previous.sourcesChanged||previous.errors.length||Object.entries(current).some(([file,hash])=>previous.sourceBefore[file]!==hash))throw new Error(`Cannot reuse changed or errored sources from ${reportPath}`);
      for(const c of previous.cases.filter(c=>!c.failures.length)){reused.push({name:c.name,report:reportPath});selected=selected.filter(config=>id(config)!==c.name);}
    }
  }
  const scopedPlan={...plan,cases:selected.map(id),depth,layoutCases:depth==='layout'?selected.length:0,deepCases:depth==='deep'?selected.length:0};
  if(depth==='layout')scopedPlan.contracts=['card and controls visible without overlap','active/inactive text begins at the same audio-relative offset','selected CSS font preserves interface zoom','text-only scroll with fixed controls','font/page changes retain learning state','one real adult confirmation and next logical line'];
  const report={phase,plan:scopedPlan,reusedCases:reused,baselineRef:baseline?'abd54ab':null,started:new Date().toISOString(),sourceBefore:sampled(),liveSourceBefore:snapshot(),cases:[],errors:[]};
  const server=await createServer({configFile:path.join(root,'vite.pages.config.ts'),
    plugins:frozen?[{name:'qa-readonly-head-baseline',enforce:'pre',load(id){const key=path.relative(root,id.split('?')[0]).replaceAll('\\','/');return frozen[key]??null;}}]:[],
    server:{host:'127.0.0.1',port:0,hmr:false,forwardConsole:false},logLevel:'error'});
  await server.listen();
  const {chromium}=process.env.PLAYWRIGHT_PACKAGE?await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE,'index.mjs'))):createRequire(import.meta.url)('playwright');
  const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
  const html=await server.transformIndexHtml('/__qa-text.html',`<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@fs/${path.join(root,'tests/fixtures/text-reading-layout.tsx').replaceAll('\\','/')}"></script></body></html>`);
  try {
    for(const config of selected) {
      const c={name:id(config),config,states:[],traces:[],failures:[],networkErrors:[],consoleErrors:[],serviceRequests:[]};report.cases.push(c);
      const p=await browser.newPage({viewport:{width:config.width,height:config.height},reducedMotion:'reduce'});
      p.setDefaultTimeout(5000);p.on('pageerror',e=>report.errors.push({case:c.name,error:e.message}));
      p.on('requestfailed',r=>c.networkErrors.push({url:r.url(),error:r.failure()?.errorText}));
      p.on('console',m=>{if(m.type()==='error')c.consoleErrors.push(m.text());});
      const check=(ok,message)=>{if(!ok)c.failures.push(message);};
      const item=config.material==='long'?long:four;
      try {
        await p.addInitScript(({config,item})=>{
          window.qaText={material:item};
          localStorage.setItem('reading-profile-v1',JSON.stringify({name:'Проверка',age:'8',start:'syllables'}));
          localStorage.setItem('reading-steps-v3',JSON.stringify({settings:{styleChosen:true,unit:12,curriculumVersion:2,
            sound:true,autoSpeech:false,motion:false,autoAdvance:false,textFlow:'manual',showFullText:true,
            micConsent:true,color:config.textPresentation!=='pages',breakEvery:0,breakMinutes:0,...config},stars:0,history:[],recentWords:{}}));
        },{config,item});
        await p.route('**/__qa-text.html',r=>r.fulfill({contentType:'text/html',body:html}));
        await p.route(/\/lib\/topic-texts\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:'export function textsForTopic(kind) { return kind === "stories" ? [window.qaText.material] : []; }'}));
        await p.route(/\/features\/free-practice\/service\.(?:js|ts)(?:\?.*)?$/,async r=>{
          c.serviceRequests.push(r.request().url());
          if(r.request().url().includes('qa-real=1'))return r.continue();
          await r.fulfill({contentType:'text/javascript',body:`
            import {recordFreeExposure as realRecord,waitForFreeExposure as realWait} from '/@fs/${path.join(root,'features/free-practice/service.ts').replaceAll('\\','/')}?qa-real=1';
            export async function recordFreeExposure(input) {
              const q=window.qaText;q.requested.push(input);
              if(q.hold)await new Promise((resolve,reject)=>{q.waiters.push(resolve);q.rejects.push(reject);});
              try {await realRecord(input);q.committed.push(input);}catch(error){(q.recordErrors??=[]).push(String(error));throw error;}
            }
            export async function waitForFreeExposure(){await realWait();}
          `});
        });
        await p.route(/\/lib\/local-speech\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:`
          const sessions=[];window.qaSpeechEvents=[]; window.qaSpeech={sessions,active(){return sessions.some(s=>s.active);},emit(text){const s=sessions.findLast(s=>s.active);window.qaSpeechEvents.push({length:text.length,active:!!s,inert:document.querySelector('.text-task-controls')?.inert,source:document.querySelector('.text-reading-viewport')?.dataset.activeSource});if(s)s.callbacks.onResult({text,result:text.split(/\\s+/).map(word=>({word,conf:1}))});},
            late(text){sessions.at(-1)?.callbacks.onResult({text,result:text.split(/\\s+/).map(word=>({word,conf:1}))});},
            status(text){sessions.findLast(s=>s.active)?.callbacks.onStatus(text);}};
          export function startLocalSpeech(callbacks){const session={callbacks,active:true};sessions.push(session);
            queueMicrotask(()=>{if(session.active){callbacks.onReady?.();callbacks.onLevel?.(.35);}});
            return {abort(){session.active=false;},setEnabled(value){session.active=value;}};}
        `}));
        await p.goto(`http://127.0.0.1:${server.httpServer.address().port}/__qa-text.html`);
        await p.getByRole('heading',{name:'Привет, Проверка!'}).waitFor();
        await p.locator('.portal-grid').getByRole('button',{name:/ШАГ 6 Тексты/}).click();
        await installProbe(p);
        if(!baseline&&depth!=='layout')await p.evaluate(()=>{window.qaText.hold=true;window.qaProbe.start();});
        await p.locator('.portal-grid').getByRole('button',{name:'Рассказы',exact:true}).click();
        if(!baseline&&depth!=='layout'){
          await p.waitForFunction(()=>window.qaText.waiters.length>0);await frames(p,8);
          const first=await p.evaluate(()=>window.qaProbe.stop());c.traces.push({name:'first-item-pending',...first});
          check(![...first.frames,...first.mutations].some(s=>s.leaked.length),'first item leaks uncommitted text');
          await p.screenshot({path:path.join(output,`${c.name}-first-pending.png`)});
          await p.evaluate(()=>window.qaText.release());
        }
        await p.locator('.text-exercise').waitFor();await ready(p);
        const initial=await capture(p,c,'initial',output);
        check(initial.textCount>0,'text missing initially');
        if(depth==='layout'){await layoutCase(p,c,config,check,output,initial);continue;}
        if(pager){assertControls(initial,config,check);await extended(p,c,config,item,check,output,true);continue;}
        if(!baseline){
          const dimensions=await capture(p,c,'read-controls',output);assertControls(dimensions,config,check);
          if(config.textPresentation==='pages'&&config.material==='long')for(const mode of ['read','questions'])await pendingPage(p,c,item,check,output,mode);
          await imageGate(p,c,check,output);
        }
        const mic=p.getByRole('button',{name:'Начать чтение с микрофоном',exact:true});
        await mic.click();await ready(p);
        const beforeScroll=await capture(p,c,'microphone',output);
        const scroller=await p.evaluate(()=>{
          const text=document.querySelector('.full-reading-text');
          for(let el=text;el && !el.classList.contains('text-exercise');el=el.parentElement)
            if(/auto|scroll/.test(getComputedStyle(el).overflowY)&&el.scrollHeight>el.clientHeight+2){el.dataset.qaScroller='true';return el.className;}
          return null;
        });
        c.scroller=scroller;
        if(scroller) {
          await p.locator('[data-qa-scroller]').evaluate(el=>{el.scrollTop=el.scrollHeight;});await frames(p,3);
          const after=await capture(p,c,'scrolled',output);
          check(!String(scroller).includes('task-card-body'),'whole task-card-body scrolls instead of text');
          compareControls(beforeScroll,after,check,'text scroll');
          await p.locator('[data-qa-scroller]').evaluate(el=>{el.scrollTop=0;});await frames(p,2);
        }
        // Observe the real adult transition with a held real recorder.
        const adult=p.locator('.text-exercise summary').filter({hasText:'Проверить вместе со взрослым'});
        await adult.click();await ready(p);
        await p.evaluate(()=>{window.qaText.hold=true;window.qaProbe.start();});
        await p.getByRole('button',{name:'Строка прочитана верно',exact:true}).click();
        await frames(p,12);
        const held=await capture(p,c,'held-adult-confirmation',output);
        const trace=await p.evaluate(()=>window.qaProbe.stop());c.traces.push({name:'adult-confirmation-held',...trace});
        assertTrace(trace,check,'adult confirmation');
        check(held.frame.visible,'frame disappears while new feedback saves');
        check(held.textCount>0,'previously visible story disappears while saving');
        const pendingState=await progress(p);
        const primary=beforeScroll.controls.find(x=>/микрофон/.test(x.label));
        if(primary)await p.mouse.click(primary.rect.x+primary.rect.width/2,primary.rect.y+primary.rect.height/2);
        await p.keyboard.press('Enter');await frames(p,3);
        check(JSON.stringify(await progress(p))===JSON.stringify(pendingState),'pending click/Enter changed progress or rewards');
        await p.evaluate(()=>{window.qaProbe.start();window.qaText.fail();});await frames(p,8);
        const rejected=await p.evaluate(()=>window.qaProbe.stop());c.traces.push({name:'adult-confirmation-rejected',...rejected});
        assertTrace(rejected,check,'rejected save');await capture(p,c,'rejected-adult-confirmation',output);
        await retrySaves(p);await ready(p);
        for(let i=0;i<Math.min(item.lines.length,baseline?2:item.lines.length);i++) {
          if(i>0){await adult.click();await ready(p);await p.getByRole('button',{name:'Строка прочитана верно',exact:true}).click();await ready(p);}
          await p.evaluate(()=>window.qaProbe.start());
          await p.getByRole('button',{name:/^(Следующая строка|Завершить)/}).click();await ready(p);await frames(p,5);
          const nextTrace=await p.evaluate(()=>window.qaProbe.stop());c.traces.push({name:`advance-${i+1}`,...nextTrace});
          if(i+1<item.lines.length)assertTrace(nextTrace,check,`line ${i+1} -> ${i+2}`);
        }
        if(!baseline)await extended(p,c,config,item,check,output);
      }catch(error){c.failures.push(`scenario aborted: ${error.message}`);c.errorStack=error.stack;c.recorderDiagnostics=await p.evaluate(()=>({requested:window.qaText?.requested,committed:window.qaText?.committed,errors:window.qaText?.recordErrors,
        done:!!document.querySelector('.text-success'),busy:[...document.querySelectorAll('[aria-busy="true"]')].map(el=>({className:el.className,visible:el.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}),insideViewport:!!el.closest('.text-reading-viewport')})),
        inert:[...document.querySelectorAll('.text-exercise [inert]')].map(el=>({className:el.className,text:el.textContent.slice(0,100)})),
        activeSource:document.querySelector('.text-reading-viewport')?.dataset.activeSource}));await p.screenshot({path:path.join(output,`${c.name}-aborted.png`)}).catch(()=>{});}
      finally {c.speechEvents=await p.evaluate(()=>window.qaSpeechEvents);await p.close();fs.writeFileSync(path.join(output,'in-progress.json'),JSON.stringify(report,null,2));}
    }
  }finally {
    report.sourceAfter=sampled();report.liveSourceAfter=snapshot();report.sourcesChanged=JSON.stringify(report.sourceBefore)!==JSON.stringify(report.sourceAfter);report.finished=new Date().toISOString();
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();await server.close();
    console.log(JSON.stringify({report:path.join(output,'report.json'),cases:report.cases.length,failed:report.cases.filter(c=>c.failures.length).length,errors:report.errors,sourcesChanged:report.sourcesChanged},null,2));
    if(report.sourcesChanged||report.errors.length||report.cases.some(c=>c.failures.length))process.exitCode=1;
  }
}
async function ready(p){await p.evaluate(()=>document.fonts.ready);await frames(p,2);await p.waitForFunction(()=>![...document.querySelectorAll('.free-material.is-pending,.retained-text-frame[aria-busy="true"]')].some(el=>{
  // Completed exercises intentionally disable their hidden reading viewport.
  // Parent feedback and every visible or non-viewport save must still settle.
  return !(document.querySelector('.text-success') && el.closest('.text-reading-viewport') && !el.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}));
}) && window.qaText.waiters.length===0);await p.evaluate(()=>document.fonts.ready);await frames(p,2);}
async function frames(p,count){await p.evaluate(count=>new Promise(resolve=>{const step=()=>--count<=0?resolve():requestAnimationFrame(step);requestAnimationFrame(step);}),count);}
async function progress(p){return p.evaluate(()=>({active:document.querySelector('.active-line')?.textContent,part:document.querySelector('.text-read-progress')?.value,
  accepted:[...document.querySelectorAll('.text-exercise button')].some(el=>/^(Следующая строка|Завершить)/.test(el.textContent.trim())),
  logical:(document.querySelector('.text-line-status')?.textContent||document.querySelector('.text-exercise')?.textContent||'').match(/Строка\s+(\d+)\s+из\s+(\d+)/)?.slice(1),
  read:[...document.querySelectorAll('.reading-line-picker button')].filter(e=>e.textContent.includes('✓')).map(e=>e.textContent),
  stars:window.qaText.model.stars,history:window.qaText.model.history.length,done:!!document.querySelector('.text-success')}));}
async function layoutCase(p,c,config,check,output,initial){
  assertControls(initial,config,check);
  const assertShortFits=m=>{
    if(config.width===1280&&config.textFontSize===28&&config.interfaceScale===100&&config.material==='four'&&config.textPresentation==='scroll'){
      const text=m.body.find(x=>x.className.includes('text-reading-scroll'));
      check(!!text&&text.scrollHeight<=text.height+2,'four-line story with sound buttons needs scrolling at 1280x720 / 28px');
    }
  };
  assertShortFits(initial);
  await p.getByRole('button',{name:'Начать чтение с микрофоном',exact:true}).click();await ready(p);
  const listening=await capture(p,c,'listening',output);assertControls(listening,config,check);assertShortFits(listening);
  if(config.textPresentation==='scroll'){
    const viewport=p.locator('.text-reading-scroll');await viewport.evaluate(el=>{el.scrollTop=el.scrollHeight;});await frames(p,2);
    const scrolled=await capture(p,c,'text-scrolled',output);compareControls(listening,scrolled,check,'text scroll');
    await viewport.evaluate(el=>{el.scrollTop=0;});await frames(p,2);
  }
  const adult=p.locator('.text-exercise summary').filter({hasText:'Проверить вместе со взрослым'});
  await adult.click();await ready(p);assertControls(await capture(p,c,'adult-open',output),config,check);await adult.click();await ready(p);
  await p.waitForFunction(()=>window.qaSpeech.active()&&!document.querySelector('.text-task-controls')?.inert);
  await p.evaluate(()=>window.qaSpeech.emit(window.qaText.material.lines[0].split(/\s+/).slice(0,2).join(' ')));await ready(p);
  const partial=await progress(p);check(partial.part>0&&!partial.accepted,'layout partial reading setup failed');
  const unsettled=await activeReadingState(p);await activeReadingReady(p);
  c.partialSettling={before:unsettled,after:await activeReadingState(p)};
  const stable=await capture(p,c,'font-before',output);assertControls(stable,config,check);
  for(const size of [config.textFontSize,config.textFontSize===40?24:40,config.textFontSize]){
    await openSettings(p);await p.getByLabel(/Размер текста/).selectOption(String(size));await closeSettings(p);await ready(p);
    sameLearning(partial,await progress(p),check,`font ${size}`);
    const font=await p.locator('.full-reading-text .full-text-line').first().evaluate(el=>{let zoom=1;for(let n=el;n;n=n.parentElement)zoom*=Number(getComputedStyle(n).zoom)||1;return {css:parseFloat(getComputedStyle(el).fontSize),zoom,physicalRatio:el.getBoundingClientRect().height/el.offsetHeight};});
    check(Math.abs(font.css-size)<.1,`selected ${size}px reduced to ${font.css}px`);
    check(Math.abs(font.zoom-config.interfaceScale/100)<.01&&Math.abs(font.physicalRatio-config.interfaceScale/100)<.04,'text compensates or ignores interface zoom');
    c.states.push({name:`layout-font-${size}-measurement`,...font});
    const current=await capture(p,c,`layout-font-${size}`,output);assertControls(current,config,check);compareControls(stable,current,check,`font ${size}`);
  }
  if(config.textPresentation==='pages'){
    const next=p.getByRole('button',{name:'Следующая страница',exact:true});
    if(await next.isEnabled()){await next.click();await ready(p);sameLearning(partial,await progress(p),check,'visual page');await returnToActivePage(p);sameLearning(partial,await progress(p),check,'return to active source');}
  }
  await adult.click();await ready(p);await p.getByRole('button',{name:'Строка прочитана верно',exact:true}).click();await ready(p);
  await p.getByRole('button',{name:/^Следующая строка/}).click();await ready(p);
  check((await progress(p)).logical?.[0]==='2','real adult confirmation did not advance to logical line 2');
  assertControls(await capture(p,c,'next-logical-line',output),config,check);
}
async function activeReadingState(p){return p.evaluate(()=>({at:performance.now(),speechActive:window.qaSpeech.active(),inert:!!document.querySelector('.text-task-controls')?.closest('[inert]'),
  busy:document.querySelectorAll('.retained-text-frame[aria-busy="true"]').length,source:document.querySelector('.text-reading-viewport')?.dataset.activeSource,
  part:document.querySelector('.text-read-progress')?.value,
  fragments:[...document.querySelectorAll('.full-reading-text .full-text-line')].map(el=>({line:el.dataset.sourceLine,start:el.dataset.sourceStart,end:el.dataset.sourceEnd}))}));}
async function activeReadingReady(p){await p.evaluate(()=>{window.qaActiveReadyFrames=0;});await p.waitForFunction(()=>{
  const settled=window.qaSpeech.active()&&!document.querySelector('.text-task-controls')?.closest('[inert]')&&!document.querySelector('.retained-text-frame[aria-busy="true"]')&&window.qaText.waiters.length===0;
  window.qaActiveReadyFrames=settled?window.qaActiveReadyFrames+1:0;return window.qaActiveReadyFrames>=3;
});}
async function capture(p,c,name,output){
  const m=await p.evaluate(()=>{
    const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const visible=el=>!!el&&el.checkVisibility({checkVisibilityCSS:true,checkOpacity:true});const card=document.querySelector('.text-exercise');
    const elements=[...card.querySelectorAll('button,summary,meter,progress,[role="status"]')].filter(visible).filter(el=>!el.closest('.full-reading-text,.text-reference'));
    const controls=elements.map(el=>{
      const r=rect(el),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      return {label:el.getAttribute('aria-label')||el.textContent.trim(),rect:r,hit:!!top&&(top===el||el.contains(top))};
    });
    const overlaps=[];
    elements.forEach((a,i)=>elements.slice(i+1).forEach(b=>{if(a.contains(b)||b.contains(a))return;const x=rect(a),y=rect(b),width=Math.min(x.right,y.right)-Math.max(x.x,y.x),height=Math.min(x.bottom,y.bottom)-Math.max(x.y,y.y);
      if(width>1&&height>1)overlaps.push({a:a.getAttribute('aria-label')||a.textContent.trim(),b:b.getAttribute('aria-label')||b.textContent.trim(),width,height});}));
    const lineStarts=[...card.querySelectorAll('.full-reading-text .full-text-line')].filter(visible).map(el=>{
      const span=el.querySelector(':scope > span'),audio=el.querySelector(':scope > button');
      if(!span)return null;const walker=document.createTreeWalker(span,NodeFilter.SHOW_TEXT);let node;
      while((node=walker.nextNode())){const offset=node.textContent.search(/\S/);if(offset<0)continue;const range=document.createRange();range.setStart(node,offset);range.setEnd(node,offset+1);const first=range.getBoundingClientRect();return {line:el.dataset.sourceLine,start:el.dataset.sourceStart,active:el.classList.contains('active-line'),x:first.x,gap:first.x-(audio?rect(audio).right:rect(el).x)};}
      return null;
    }).filter(Boolean);
    return {frame:{rect:rect(card),visible:visible(card)},textCount:[...card.querySelectorAll('.full-reading-text .full-text-line')].filter(visible).length,overlaps,lineStarts,
      controls,pending:!!document.querySelector('.free-material.is-pending'),
      body:[...card.querySelectorAll('.task-card-body,.text-reading-scroll,.full-reading-text')].map(el=>({className:el.className,rect:rect(el),height:el.clientHeight,scrollHeight:el.scrollHeight,scrollTop:el.scrollTop,overflow:getComputedStyle(el).overflowY}))};
  });c.states.push({name,...m});await p.screenshot({path:path.join(output,`${c.name}-${name}.png`)});return m;
}
function compareControls(before,after,check,label){for(const a of before.controls){const b=after.controls.find(x=>x.label===a.label);
  check(!!b&&b.hit&&['x','y','width','height'].every(key=>Math.abs(b.rect[key]-a.rect[key])<=2),`${label}: control disappeared, moved, resized or covered: ${a.label}`);}}
function assertTrace(trace,check,label){check(trace.frames.length>0,`${label}: no animation frames sampled`);for(const group of ['frames','mutations']){
  check(!trace[group].some(s=>!s.frameVisible||!s.textVisible||!s.controlsVisible||s.obscured||s.textOpacity<.99||s.controlsOpacity<.99),`${label}: frame/text/controls vanished, faded or covered in ${group}`);
  check(!trace[group].some(s=>s.leaked.length),`${label}: uncommitted material visible in ${group}`);
}}
async function installProbe(p){await p.evaluate(()=>{
  let active=false,frames=[],mutations=[],timer;
  const read=()=>{
    const q=window.qaText,card=document.querySelector('.text-exercise');
    const painted=el=>{if(!el?.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}))return false;
      const r=el.getBoundingClientRect();let top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom),left=Math.max(0,r.left),right=Math.min(innerWidth,r.right);
      for(let n=el.parentElement;n;n=n.parentElement){const cs=getComputedStyle(n),b=n.getBoundingClientRect();
        if(/auto|scroll|hidden|clip/.test(cs.overflowY)){top=Math.max(top,b.top);bottom=Math.min(bottom,b.bottom);}
        if(/auto|scroll|hidden|clip/.test(cs.overflowX)){left=Math.max(left,b.left);right=Math.min(right,b.right);}}
      return bottom-top>1&&right-left>1;};
    const text=[...document.querySelectorAll('.full-reading-text .full-text-line')].filter(painted);
    const controls=card?.querySelector('.text-task-controls')||card?.querySelector('.task-card-material');
    const actions=[...(controls?.querySelectorAll('button,summary,meter,progress,[role="status"]')||[])].filter(el=>el.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}));
    const committed=new Set(q.committed.flatMap(x=>[...(x.texts||[]),...(x.promptedTexts||[])]));
    const fresh=q.requested.flatMap(x=>x.texts||[]).filter(x=>x.trim()&&!committed.has(x));
    const material=[...document.querySelectorAll('.full-reading-text .full-text-line,.text-exercise .spoken-heading span,.text-options .answer-option>button:not(.quiet),.text-reference p>span')].filter(painted);
    const visibleText=material.map(el=>el.textContent.replace(/\s+/g,' ').trim());
    const opacity=el=>{let value=1;for(let node=el;node;node=node.parentElement)value*=Number(getComputedStyle(node).opacity);return value;};
    const notices=[...document.querySelectorAll('.free-material-notice,.free-material-notice *, .retained-text-notice,.retained-text-notice *')].filter(el=>el.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}));
    const obscured=[...text,...(controls?[controls]:[])].some(el=>{
      const a=el.getBoundingClientRect();if(a.bottom<0||a.top>innerHeight)return false;
      return notices.some(n=>{const b=n.getBoundingClientRect(),cs=getComputedStyle(n),rgb=cs.backgroundColor.match(/[\d.]+/g)||[];
        const alpha=rgb.length===4?Number(rgb[3]):rgb.length===3?1:0;
        return alpha*opacity(n)>.6 && Math.min(a.right,b.right)-Math.max(a.left,b.left)>8 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>8;});
    });
    return {at:performance.now(),frameVisible:!!card?.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}),textVisible:text.length>0,
      textOpacity:text.length?Math.min(...text.map(opacity)):0,obscured,
      controlsVisible:actions.some(painted),controlsOpacity:actions.length?Math.min(...actions.map(opacity)):0,
      pending:!!document.querySelector('.free-material.is-pending'),leaked:fresh.filter(x=>visibleText.includes(x.replace(/\s+/g,' ').trim()))};
  };
  const observer=new MutationObserver(()=>{if(active&&mutations.length<3000)mutations.push(read());});
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});
  window.qaProbe={start(){active=true;frames=[];mutations=[];const tick=()=>{if(!active)return;frames.push(read());timer=requestAnimationFrame(tick);};timer=requestAnimationFrame(tick);},
    stop(){active=false;cancelAnimationFrame(timer);return {frames,mutations};}};
});}
async function extended(p,c,config,item,check,output,fresh=false){
  if(!fresh){check(await p.locator('.text-success').count()===1,'sequential adult confirmations did not complete original logical lines');
    await p.getByRole('button',{name:'Повторить задание',exact:true}).click();await ready(p);}
  const settings=await p.evaluate(()=>({size:window.qaText.model.settings.textFontSize,presentation:window.qaText.model.settings.textPresentation}));
  check(settings.size===config.textFontSize && settings.presentation===config.textPresentation,'requested font/presentation not restored');
  const targetLine=config.material==='long'?4:0;
  if(targetLine){await openSettings(p);await p.locator('.reading-line-picker button').nth(targetLine).click();await closeSettings(p);await ready(p);}
  const start=await progress(p);check(start.logical?.[0]===String(targetLine+1),'logical line selection mismatch');
  const mic=p.getByRole('button',{name:'Начать чтение с микрофоном',exact:true});
  if(await mic.count())await mic.click();await ready(p);
  const words=item.lines[targetLine].match(/\S+\s*/g);
  const prefix=words.slice(0,Math.max(1,Math.floor(words.length/3))).join('').trim();
  await p.evaluate(text=>window.qaSpeech.emit(text),prefix);await ready(p);
  const partial=await progress(p);
  check(partial.part>0 && !partial.done && partial.logical?.[0]===String(targetLine+1),'partial speech did not retain logical line/progress');
  const originalSize=config.textFontSize;
  const stableControls=await capture(p,c,'before-font-change',output);
  for(const size of new Set([40,24,originalSize])) {
    await openSettings(p);await p.getByLabel(/Размер текста/).selectOption(String(size));await closeSettings(p);await ready(p);
    const state=await progress(p);sameLearning(partial,state,check,`font ${size}`);
    const font=await p.locator('.full-reading-text .full-text-line').first().evaluate(el=>{
      let zoom=1;for(let n=el;n;n=n.parentElement)zoom*=Number(getComputedStyle(n).zoom)||1;
      return {css:parseFloat(getComputedStyle(el).fontSize),zoom,physicalRatio:el.getBoundingClientRect().height/el.offsetHeight};});
    check(Math.abs(font.css-size)<.1,`selected ${size}px reduced/changed to ${font.css}px`);
    check(Math.abs(font.zoom-config.interfaceScale/100)<.01&&Math.abs(font.physicalRatio-config.interfaceScale/100)<.04,'text compensates or ignores interface zoom');
    c.states.push({name:`font-${size}-measurement`,...font});
    const afterFont=await capture(p,c,`font-${size}-partial`,output);assertControls(afterFont,config,check);compareControls(stableControls,afterFont,check,`font ${size}`);
  }
  await p.setViewportSize({width:config.width===390?420:config.width-60,height:config.height-50});await ready(p);
  sameLearning(partial,await progress(p),check,'resize');
  await p.setViewportSize({width:config.width,height:config.height});await ready(p);
  await openSettings(p);await p.getByLabel(/Длинный текст/).selectOption('pages');await closeSettings(p);await ready(p);
  sameLearning(partial,await progress(p),check,'switch to pages');
  const nav=p.getByRole('navigation',{name:'Страницы текста'});await nav.waitFor();
  const beforePage=await progress(p),fragments=[];
  // Visit every visual page to validate the original-source ranges without awarding.
  const prev=p.getByRole('button',{name:'Предыдущая страница',exact:true});
  const next=p.getByRole('button',{name:'Следующая страница',exact:true});
  for(let n=0;n<250 && await prev.isEnabled();n++){await prev.click();await ready(p);}
  for(let n=0;n<250;n++) {
    fragments.push(...await pageFragments(p));
    sameLearning(beforePage,await progress(p),check,'manual visual page');
    if(!await next.isEnabled())break;
    await next.click();await ready(p);
    if(n===249)check(false,'pagination exceeded 250 pages');
  }
  c.fragments=fragments;
  for(let line=0;line<item.lines.length;line++) {
    const segments=fragments.filter(f=>f.line===line).sort((a,b)=>a.start-b.start);
    let cursor=0;
    for(const f of segments){check(f.start===cursor,`line ${line+1}: fragment source gap/overlap at ${cursor}`);cursor=f.end;
      check(f.text.replace(/\s+/g,' ').trim()===item.lines[line].slice(f.start,f.end).replace(/\s+/g,' ').trim(),`line ${line+1}: fragment differs from original offsets`);
      check(f.height<=f.viewportHeight+2 || f.scrollable,`line ${line+1}: oversized fragment hidden-clipped`);
    }
    check(cursor===item.lines[line].length,`line ${line+1}: source end not reachable`);
  }
  if(config.material==='long')check(fragments.filter(f=>f.line===4).length>1,'oversized logical line not split into visual pages');
  // Select the same logical line: no credit. Emit a later prefix to force follow
  // inside that line. The real hook computes coverage; the transport is synthetic.
  await openSettings(p);await p.locator('.reading-line-picker button').nth(targetLine).click();await closeSettings(p);await ready(p);
  const largerPrefix=words.slice(0,Math.max(2,Math.floor(words.length*2/3))).join('').trim();
  await p.evaluate(text=>window.qaSpeech.emit(text),largerPrefix);await ready(p);
  const advanced=await progress(p);
  check(advanced.part>partial.part && advanced.logical?.[0]===String(targetLine+1) && !advanced.done,'intra-line progress changed credit or did not advance');
  const current=await pageFragments(p);
  check(current.some(f=>f.line===targetLine),'visual page does not follow current logical line');
  if(config.material==='long')check(current.some(f=>f.line===targetLine && f.start>0),'page did not follow progress inside oversized line');
  await p.waitForFunction(()=>window.qaSpeech.active()&&!document.querySelector('.text-task-controls')?.inert);
  await p.evaluate(text=>window.qaSpeech.emit(text),item.lines[targetLine]);await ready(p);
  const preNext=await progress(p);
  await p.getByRole('button',{name:/^(Следующая строка|Завершить)/}).click();await ready(p);
  const afterNext=await progress(p);
  check(!afterNext.done && afterNext.logical?.[0]===String(targetLine?1:2),'next skipped an unread logical line');
  check(afterNext.stars===preNext.stars && afterNext.history===preNext.history,'fragment/partial flow awarded whole story');
  if(config.material==='four')await legacyModes(p,c,item,check,output);
}

async function openSettings(p){const summary=p.locator('.practice-menu > summary').filter({hasText:'Настройки'});if(!await summary.evaluate(el=>el.parentElement.open))await summary.click();}
async function closeSettings(p){const summary=p.locator('.practice-menu > summary').filter({hasText:'Настройки'});if(await summary.evaluate(el=>el.parentElement.open))await summary.click();}
function sameLearning(a,b,check,label){for(const key of ['logical','part','accepted','read','stars','history','done'])check(JSON.stringify(a[key])===JSON.stringify(b[key]),`${label}: changed ${key}`);}
async function pageFragments(p){return p.locator('.full-reading-text .full-text-line').evaluateAll(elements=>elements.filter(el=>el.checkVisibility({checkVisibilityCSS:true,checkOpacity:true})).map(el=>{
  const viewport=el.closest('.text-reading-scroll'),r=el.getBoundingClientRect();
  return {line:Number(el.dataset.sourceLine),start:Number(el.dataset.sourceStart),end:Number(el.dataset.sourceEnd),text:el.textContent,
    height:r.height,viewportHeight:viewport?.getBoundingClientRect().height||0,scrollable:!!viewport&&/auto|scroll/.test(getComputedStyle(viewport).overflowY)&&viewport.scrollHeight>viewport.clientHeight+2};
}));}
function assertControls(m,config,check){check(m.frame.visible&&m.frame.rect.bottom<=config.height+1,'card outside viewport');for(const control of m.controls)
  check(control.hit&&control.rect.y>=-1&&control.rect.bottom<=config.height+1,`control hidden, clipped or covered: ${control.label}`);
  for(const overlap of m.overlaps)check(false,`controls overlap (${overlap.width.toFixed(1)}x${overlap.height.toFixed(1)}): ${overlap.a} / ${overlap.b}`);
  const active=m.lineStarts.find(line=>line.active),inactive=m.lineStarts.filter(line=>!line.active);
  if(active)for(const line of inactive)check(Math.abs(active.gap-line.gap)<=2,`active/inactive text start shifts after audio: line ${active.line} gap ${active.gap.toFixed(1)} vs ${line.line} gap ${line.gap.toFixed(1)}`);
}
async function retrySaves(p){for(let i=0;i<8;i++){const retry=p.getByRole('button',{name:'Повторить попытку',exact:true});if(!await retry.count())break;await retry.first().click();await frames(p,3);}}
async function returnToActivePage(p){
  const target=await p.locator('.text-reading-viewport').evaluate(el=>({line:Number(el.dataset.activeLine),offset:Number(el.dataset.activeSource)}));
  const includesTarget=async()=> (await pageFragments(p)).some(f=>f.line===target.line&&f.start<=target.offset&&f.end>target.offset);
  const prev=p.getByRole('button',{name:'Предыдущая страница',exact:true}),next=p.getByRole('button',{name:'Следующая страница',exact:true});
  for(let n=0;n<250&&!await includesTarget()&&await prev.isEnabled();n++){await prev.click();await ready(p);}
  for(let n=0;n<250&&!await includesTarget()&&await next.isEnabled();n++){await next.click();await ready(p);}
  if(!await includesTarget())throw new Error(`Current logical source ${target.line}:${target.offset} is not reachable by page navigation`);
}
async function pendingPage(p,c,item,check,output,mode){
  // A fresh child page must gate both adult credit and parent answer/finish.
  await p.getByRole('button',{name:mode==='read'?'Читаю':'Отвечаю',exact:true}).click();await ready(p);
  const next=p.getByRole('button',{name:'Следующая страница',exact:true});
  check(await next.isEnabled(),'long-text page gate did not have a next page');
  const adult=p.locator('.text-exercise summary').filter({hasText:'Проверить вместе со взрослым'});
  if(mode==='read'){
    const start=p.getByRole('button',{name:'Начать чтение с микрофоном',exact:true});if(await start.count())await start.click();await ready(p);
    await p.evaluate(text=>window.qaSpeech.emit(text),item.lines[0].split(/\s+/).slice(0,2).join(' '));await ready(p);
    check((await progress(p)).part>0,'pending test has no saved partial progress');
    await adult.click();await ready(p);
  }
  const answer=mode==='read'?p.getByRole('button',{name:'Строка прочитана верно',exact:true}):p.locator('.text-options').getByRole('button',{name:item.answer,exact:true});
  const box=await answer.boundingBox(),before=await progress(p);
  await p.evaluate(()=>{window.qaText.hold=true;window.qaProbe.start();});await next.click();
  await p.waitForFunction(()=>window.qaText.waiters.length>0);await frames(p,8);
  await capture(p,c,`child-page-pending-${mode}`,output);
  if(mode==='read'){await p.evaluate(text=>{window.qaSpeech.emit(text);window.qaSpeech.late(text);},item.lines[0]);await frames(p,4);}
  if(box)await p.mouse.click(box.x+box.width/2,box.y+box.height/2);await p.keyboard.press('Enter');await frames(p,3);
  const held=await progress(p);sameLearning(before,held,check,`pending child page ${mode}`);
  await p.evaluate(()=>window.qaText.fail());await frames(p,8);
  if(mode==='read'){await p.evaluate(text=>{window.qaSpeech.emit(text);window.qaSpeech.late(text);},item.lines[0]);await frames(p,4);}
  if(box)await p.mouse.click(box.x+box.width/2,box.y+box.height/2);await frames(p,2);
  const failed=await progress(p);sameLearning(before,failed,check,`rejected child page ${mode}`);
  const trace=await p.evaluate(()=>window.qaProbe.stop());c.traces.push({name:`child-page-delay-rejection-${mode}`,...trace});assertTrace(trace,check,'child viewport save');
  await capture(p,c,`child-page-rejected-${mode}`,output);await retrySaves(p);await ready(p);
  if(mode==='read'){
    // A narrow page can contain only part of source line 0. Move until that
    // logical line is actually absent before exercising the off-page guard.
    for(let n=0;n<250&&(await pageFragments(p)).some(f=>f.line===0)&&await next.isEnabled();n++){await next.click();await ready(p);}
    const activePage=await pageFragments(p);
    check(!activePage.some(f=>f.line===0),'non-active-page guard test did not leave logical line 1');
    await p.evaluate(text=>{window.qaSpeech.emit(text);window.qaSpeech.late(text);},item.lines[0]);await frames(p,4);
    sameLearning(before,await progress(p),check,'confirmed result on non-active page');
    await returnToActivePage(p);
    sameLearning(before,await progress(p),check,'return to active page retains covered/accepted');
    if(await adult.evaluate(el=>el.closest('details').open))await adult.click();
  }
  await p.getByRole('button',{name:'Читаю',exact:true}).click();await ready(p);await returnToActivePage(p);
}
async function imageGate(p,c,check,output){
  const summary=p.getByText('Показать картинку к тексту',{exact:true});if(!await summary.count()){check(false,'test material illustration toggle absent');return;}
  // Support its actual location: beside the title in the frozen implementation,
  // inside Settings in the earlier diagnostic version.
  const inSettings=await summary.evaluate(el=>!!el.closest('.practice-menu'));
  if(inSettings)await openSettings(p);
  const before=await progress(p);
  await p.evaluate(()=>{window.qaText.hold=true;window.qaProbe.start();});await summary.click();
  await frames(p,8);
  check(await p.locator('.text-illustration img').evaluateAll(es=>!es.some(e=>e.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}))),'new illustration visible before promptedTexts saved');
  await capture(p,c,'picture-pending',output);
  await p.evaluate(()=>window.qaText.fail());await frames(p,8);
  check(await p.locator('.text-illustration img').evaluateAll(es=>!es.some(e=>e.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}))),'new illustration visible after rejected promptedTexts');
  sameLearning(before,await progress(p),check,'picture pending/rejected');
  const trace=await p.evaluate(()=>window.qaProbe.stop());c.traces.push({name:'picture-delay-rejection',...trace});
  // Opening this popover intentionally overlays the story. Check persistence of
  // the card and material authorization here; full text occlusion is checked on
  // line/page transitions with the popover closed.
  check(![...trace.frames,...trace.mutations].some(s=>!s.frameVisible||s.leaked.length),'picture save hid card or leaked uncommitted text');
  await capture(p,c,'picture-rejected',output);await retrySaves(p);await ready(p);
  check(await p.locator('.text-illustration img').evaluateAll(es=>es.some(e=>e.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}))),'illustration never appeared after durable retry');
  await summary.click();if(inSettings)await closeSettings(p);await ready(p);
}
async function legacyModes(p,c,item,check,output){
  await p.getByRole('button',{name:'Пишу',exact:true}).click();await ready(p);
  const title=p.getByRole('button',{name:'Послушать название текста',exact:true});await title.click();
  check(await p.evaluate(title=>window.qaText.spoken.includes(title),item.title),'title audio does not call speech with title');
  const input=p.getByLabel('Твоя строка',{exact:true});await input.fill('ЖЖЖ');await input.press('Enter');await ready(p);
  check(!await p.locator('.text-success').count(),'wrong written answer completed text');
  const explanation=p.getByRole('button',{name:'Послушать пояснение',exact:true});await explanation.click();
  check(await p.evaluate(()=>window.qaText.spoken.length)>1,'feedback audio missing');
  for(const text of item.lines){await input.fill(text);await input.press('Enter');await ready(p);await p.getByRole('button',{name:/^(Следующая строка|Завершить)/}).click();await ready(p);}
  check(await p.locator('.text-success').count()===1,'write flow did not finish');await capture(p,c,'write-complete',output);
  await p.getByRole('button',{name:'Отвечаю',exact:true}).click();await ready(p);
  const before=await progress(p);await p.getByRole('button',{name:`Послушать ответ: ${item.answer}`,exact:true}).click();
  check(JSON.stringify(await progress(p))===JSON.stringify(before),'answer audio submitted/awarded answer');
  await p.locator('.text-options').getByRole('button',{name:item.options.find(x=>x!==item.answer),exact:true}).click();await ready(p);
  check(!await p.locator('.text-success').count(),'wrong comprehension answer accepted');
  await p.locator('.text-options').getByRole('button',{name:item.answer,exact:true}).click();await ready(p);
  check(await p.locator('.text-success').count()===1,'correct comprehension answer not accepted');await capture(p,c,'questions-complete',output);
}
