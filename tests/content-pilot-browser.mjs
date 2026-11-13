/** Run only after owner/root freeze: --freeze. --list never starts a browser.
 * Focused pilot acceptance; does not rerun the old text/layout matrix. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import { auditContent, familySpec, textSpec } from './content-pilot.mjs';
const root=path.resolve(import.meta.dirname,'..');
const viewports=[{width:1280,height:720},{width:820,height:1180},{width:390,height:844}];
const plan={familySpec,textSpec,viewports,states:['idle','listening','result'],
  checks:['exact composition and no unrelated fallback','real IndexedDB exposure before material becomes visible','no curriculum mastery from free composition',
    'three real stories: read/write/questions','mic, adult and action visibility','persistent card during held line transition','topic switch stops media'],
  pendingContractChecks:[],
  limitation:'Media transport mocked; no claim about child speech recognition.'};
if(process.argv.includes('--list'))console.log(JSON.stringify(plan,null,2));
else if(!process.argv.includes('--freeze'))throw new Error('Owner/root freeze required; use --list for preparation.');
else await run();
async function run(){
 const output=path.join(root,'.local/content-pilot-20261104/qa-browser');fs.mkdirSync(output,{recursive:true});
 const files=['content/word-families.ts','content/word-bridges.ts','content/pilot-texts.ts','content/topic-texts.ts','lib/learning.ts','lib/topic-texts.ts','features/lesson/use-lesson.ts','features/lesson/FamilySelector.tsx','features/lesson/WordBridge.tsx','features/lesson/ExerciseCard.tsx','features/lesson/ExerciseActions.tsx','features/library/TextLibrary.tsx','features/library/TextExercise.tsx','app/globals.css'];
 const snapshot=()=>Object.fromEntries(files.map(f=>[f,createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
 const report={started:new Date().toISOString(),plan,sourceBefore:snapshot(),cases:[],errors:[]};
 const server=await createServer({configFile:path.join(root,'vite.pages.config.ts'),server:{host:'127.0.0.1',port:0,hmr:false,forwardConsole:false},logLevel:'error'});
 let browser;
 try{
  const content=await auditContent(server);report.content=content;
  await server.listen();const base='http://127.0.0.1:'+server.httpServer.address().port;
  const {chromium}=process.env.PLAYWRIGHT_PACKAGE?await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE,'index.mjs'))):createRequire(import.meta.url)('playwright');
  browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
  const html=await server.transformIndexHtml('/__pilot.html',`<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@fs/${path.join(root,'tests/fixtures/content-pilot.tsx').replaceAll('\\','/')}"></script></body></html>`);
  async function pageFor(unit,viewport,mode='app'){
   const p=await browser.newPage({viewport,reducedMotion:'reduce'});p.setDefaultTimeout(8000);
   p.on('pageerror',e=>report.errors.push(e.message));
   await p.addInitScript(unit=>{
    localStorage.setItem('reading-profile-v1',JSON.stringify({name:'Проверка',age:'8',start:'syllables'}));
    localStorage.setItem('reading-steps-v3',JSON.stringify({settings:{styleChosen:true,unit,curriculumVersion:2,sound:true,autoSpeech:false,motion:false,autoAdvance:false,textFlow:'manual',showFullText:true,micConsent:true,breakEvery:0,breakMinutes:0,textFontSize:28,interfaceScale:100,layout:'order',look:'plain',textPresentation:'scroll'},stars:7,history:[],recentWords:{}}));
   },unit);
   await p.route('**/__pilot.html*',r=>r.fulfill({contentType:'text/html',body:html}));
   await p.route(/\/features\/free-practice\/service\.(?:js|ts)(?:\?.*)?$/,async r=>{
    if(r.request().url().includes('qa-real=1'))return r.continue();
    await r.fulfill({contentType:'text/javascript',body:`
      import {recordFreeExposure as realRecord,waitForFreeExposure as realWait} from '/@fs/${path.join(root,'features/free-practice/service.ts').replaceAll('\\','/')}?qa-real=1';
      export async function recordFreeExposure(input){const q=window.qaPilot;q.requested.push(input);if(q.hold)await new Promise(resolve=>q.waiters.push(resolve));await realRecord(input);q.committed.push(input);}
      export async function waitForFreeExposure(){await realWait();}`});
   });
   await p.route(/\/lib\/local-speech\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:`
    const sessions=[];window.qaSpeech={active:()=>sessions.some(s=>s.active),emit(text){const s=sessions.findLast(s=>s.active);s?.callbacks.onResult({text,result:text.split(/\\s+/).map(word=>({word,conf:1}))});}};
    export function startLocalSpeech(callbacks){const s={callbacks,active:true};sessions.push(s);queueMicrotask(()=>{if(s.active){callbacks.onReady?.();callbacks.onLevel?.(.35);}});return {abort(){s.active=false;},setEnabled(v){s.active=v;}};}` }));
   await p.goto(base+'/__pilot.html?mode='+mode);await p.waitForFunction(()=>window.qaPilot?.model?.ready);await ready(p);return p;
  }
  const bridgePage=await pageFor(12,viewports[0],'lesson');
  try{
   for(const family of content.families){
    const c={name:'bridge-'+family.word,failures:[]};report.cases.push(c);
    try{
     await bridgePage.evaluate(f=>{window.qaPilot.model.update('unit',f.unit);window.qaPilot.model.navigate('syllables','read');},family);await ready(bridgePage);
     await bridgePage.getByLabel('Семейство слов',{exact:true}).selectOption(family.id);await ready(bridgePage);
     const before=await durable(bridgePage);
     for(let index=0;index<family.parts.length;index++){
      assert.equal(await bridgePage.evaluate(()=>window.qaPilot.model.target),family.parts[index],'real lesson trains intended part');
      await bridgePage.locator('summary[aria-label="Проверить вместе со взрослым"]').click();
      await bridgePage.getByRole('button',{name:'Получилось',exact:true}).click();await ready(bridgePage);
      assert(await bridgePage.getByLabel('Семейство слов',{exact:true}).isVisible(),'family selector survives feedback');
      if(index<family.parts.length-1){await bridgePage.keyboard.press('Enter');await ready(bridgePage);}
     }
     const starsBeforeAssembly=await bridgePage.evaluate(()=>window.qaPilot.model.stars);
     const region=bridgePage.getByRole('region',{name:'Из слогов в слово'});await region.waitFor();
     const readWhole=bridgePage.getByRole('button',{name:/^Читать слово целиком/});
     assert.equal(await readWhole.count(),1,'one whole-word primary only');
     assert(await readWhole.evaluate(el=>!!el.closest('.task-card-actions')),'whole-word primary belongs to footer');
     assert(await readWhole.isDisabled(),'whole-word reading unavailable before assembly');
     assert.equal(await region.getByRole('button',{name:/^Читать слово целиком/}).count(),0,'no duplicate primary inside WordBridge');
     for(let i=0;i<family.parts.length;i++){
      if(i===family.parts.length-1)await bridgePage.evaluate(()=>window.qaPilot.hold=true);
      await region.getByRole('button',{name:family.parts[i],exact:true}).and(bridgePage.locator('button:enabled')).first().click();
      if(i<family.parts.length-1)await ready(bridgePage);
     }
     await bridgePage.waitForFunction(()=>window.qaPilot.waiters.length>0);
     assert.equal(await region.locator('.bridge-word').isVisible(),false,'assembled word must wait for commit');
     assert(await readWhole.isDisabled(),'whole-word reading unavailable while assembly exposure saves');
     await bridgePage.evaluate(()=>window.qaPilot.release());await ready(bridgePage);
     assert.equal((await region.locator('.bridge-word').textContent()).trim(),family.word);
     assert(await readWhole.isEnabled(),'whole-word reading available after committed assembly');
     await assertButtonBounds(readWhole);
     assert.equal(await bridgePage.evaluate(()=>window.qaPilot.model.stars),starsBeforeAssembly,'assembly grants no extra reward');
     await bridgePage.screenshot({path:path.join(output,'family-'+family.id+'-complete-desktop.png')});
     if(family.id==='krupa'){await bridgePage.setViewportSize(viewports[2]);await ready(bridgePage);await assertButtonBounds(readWhole);await bridgePage.screenshot({path:path.join(output,'family-krupa-complete-phone.png')});await bridgePage.setViewportSize(viewports[0]);}
     const after=await durable(bridgePage);assert.deepEqual(evidence(after),evidence(before),'assembly must not create author-program mastery');
     assert(after.profile.exposures.words.includes(family.word),'assembled word persisted in exposure ledger');
     await readWhole.click();await ready(bridgePage);
     assert.deepEqual(await bridgePage.evaluate(()=>({stage:window.qaPilot.model.stage,mode:window.qaPilot.model.mode,target:window.qaPilot.model.target})),{stage:'words',mode:'read',target:family.word});
     assert.equal(await bridgePage.evaluate(()=>window.qaPilot.model.stars),starsBeforeAssembly,'entering word reading grants no reward');
     await bridgePage.evaluate(()=>window.qaPilot.model.repeatExercise());await ready(bridgePage);
     assert.equal(await bridgePage.evaluate(()=>window.qaPilot.model.target),family.word,'repeat stays in selected word');
     await bridgePage.evaluate(()=>window.qaPilot.model.navigate('syllables','read'));await ready(bridgePage);
     assert.equal(await bridgePage.evaluate(()=>!!window.qaPilot.model.family),false,'navigation clears family');
     await bridgePage.getByLabel('Семейство слов',{exact:true}).selectOption(family.id);await ready(bridgePage);
     await bridgePage.evaluate(()=>window.qaPilot.model.next(true));await ready(bridgePage);
     assert.equal(await bridgePage.evaluate(()=>!!window.qaPilot.model.family),false,'skip unconfirmed part clears family');
     c.exposureSaved=true;
    }catch(e){c.failures.push(e.message);}
   }
   await bridgePage.evaluate(()=>{window.qaPilot.model.update('unit',0);window.qaPilot.model.navigate('syllables','read');});await ready(bridgePage);
   assert.equal(await bridgePage.evaluate(()=>!!window.qaPilot.model.family),false,'topic switch clears stale family');
  }finally{await bridgePage.close();}
  for(const viewport of viewports)for(const spec of content.texts){
   const c={name:`text-${spec.item.id}-${viewport.width}`,states:[],failures:[]};report.cases.push(c);
   const p=await pageFor(spec.unit,viewport);
   try{
    await p.locator('.portal-grid').getByRole('button',{name:/ШАГ 6 Тексты/}).click();
    await p.locator('.portal-grid').getByRole('button',{name:'Рассказы',exact:true}).click();await ready(p);
    // Use real library picker, never replace textsForTopic or the story data.
    await selectStory(p,spec.item.title);await ready(p);
    const before=await durable(p);
    await capture(p,c,'idle',output);
    await p.getByRole('button',{name:'Начать чтение с микрофоном',exact:true}).click();await ready(p);
    await p.waitForFunction(()=>window.qaSpeech?.active());await capture(p,c,'listening',output);
    const cardBefore=await p.locator('.text-exercise').boundingBox();
    await p.evaluate(()=>window.qaPilot.hold=true);
    await setDetailsState(p,p.locator('[data-text-preparation] > summary'),true);
    await p.waitForFunction(()=>window.qaPilot.waiters.length>0);
    assert.equal(await p.locator('[data-text-preparation] li').count(),0,'preparation waits for exposure commit');
    assert.equal(await p.evaluate(()=>window.qaSpeech.active()),false,'opening preparation stops microphone');
    await p.evaluate(()=>window.qaPilot.release());await ready(p);
    const cardAfter=await p.locator('.text-exercise').boundingBox();
    assert(Math.abs(cardBefore.y-cardAfter.y)<=1&&Math.abs(cardBefore.height-cardAfter.height)<=1,'preparation must not move/resize card');
    for(const word of spec.item.preparation.words)assert((await p.locator('[data-text-preparation]').textContent()).includes(word.word),`preparation shows ${word.word}`);
    await setDetailsState(p,p.locator('[data-text-preparation] > summary'),false);await ready(p);
    assert.equal(await p.evaluate(()=>window.qaSpeech.active()),false,'closing preparation does not restart microphone');
    for(let i=0;i<spec.item.lines.length;i++){
     const adult=p.locator('.text-exercise summary').filter({hasText:'Проверить вместе со взрослым'});
     await setDetailsState(p,adult,true);await ready(p);
     await p.getByRole('button',{name:'Строка прочитана верно',exact:true}).click();await ready(p);
     if(i===0)await capture(p,c,'result',output);
     const next=p.getByRole('button',{name:/^(Следующая строка|Ответить на вопрос|Завершить)/});
     if(i===0){
      await p.evaluate(()=>window.qaPilot.hold=true);await next.click();
      await p.waitForFunction(()=>window.qaPilot.waiters.length>0);
      assert(await p.locator('.text-exercise').isVisible(),'card retained during save');
      assert(await p.locator('.full-reading-text').isVisible(),'old story retained during save');
      await p.evaluate(()=>window.qaPilot.release());await ready(p);
     }else {await next.click();await ready(p);}
    }
    if(await p.locator('.text-options').isVisible()){
     await p.locator('.text-options').getByRole('button',{name:spec.item.answer,exact:true}).click();await ready(p);
     const finish=p.getByRole('button',{name:/^Завершить/});if(await finish.count()){await finish.click();await ready(p);}
    }
    assert(await p.locator('.text-success').isVisible(),'read story completed');
    // Full write/question behaviour once per story; remaining widths check new content geometry.
    if(viewport.width===1280){
     await p.getByRole('button',{name:'Пишу',exact:true}).click();await ready(p);
     for(const line of spec.item.lines){
      await p.locator('.text-exercise textarea').fill(line);await p.getByRole('button',{name:'Проверить · Enter',exact:true}).click();await ready(p);
      await p.getByRole('button',{name:/^(Следующая строка|Завершить)/}).click();await ready(p);
     }
     assert(await p.locator('.text-success').isVisible(),'write story completed');
     await p.getByRole('button',{name:'Отвечаю',exact:true}).click();await ready(p);
     const wrong=spec.item.options.find(x=>x!==spec.item.answer);
     await p.locator('.text-options').getByRole('button',{name:wrong,exact:true}).click();await ready(p);
     assert.equal(await p.locator('.text-success').isVisible(),false,'wrong answer must not finish');
     await p.locator('.text-options').getByRole('button',{name:spec.item.answer,exact:true}).click();await ready(p);
    }
    const after=await durable(p);assert.deepEqual(evidence(after),evidence(before),'free text must not confer curriculum skills');
    await p.getByRole('button',{name:'Читаю',exact:true}).click();await ready(p);
    // Clicking the already active mode intentionally leaves a completed task done.
    // Reset through the real repeat action before testing a new listening session.
    if(await p.locator('.text-success').isVisible()){
     await p.getByRole('button',{name:'Повторить задание',exact:true}).click();await ready(p);
     assert.equal(await p.locator('.text-success').isVisible(),false,'repeat resets completed reading');
    }
    await p.getByRole('button',{name:'Начать чтение с микрофоном',exact:true}).click();await p.waitForFunction(()=>window.qaSpeech.active());
    // Exercise the actual TopicBar -> TextLibrary callback, including any local
    // microphone cleanup. Direct model.update would bypass that contract.
    const topicNavigation=p.getByRole('navigation',{name:'Темы занятия',exact:true});
    await topicNavigation.getByRole('button',{name:'Выбрать другую тему',exact:true}).click();
    await topicNavigation.locator('.topic-options').waitFor({state:'visible'});
    await topicNavigation.getByRole('button',{name:/^1\. А, У и М/}).click();
    await p.waitForFunction(()=>window.qaPilot.model.settings.unit===0);await ready(p);
    c.topicSwitch='TopicBar: Выбрать другую тему -> 1. А, У и М';
    assert.equal(await p.evaluate(()=>window.qaSpeech.active()),false,'theme switch stops media');
   }catch(e){c.failures.push(e.message);await p.screenshot({path:path.join(output,c.name+'-failure.png')}).catch(()=>{});}
   finally{await p.close();}
  }
 }catch(e){report.errors.push(e.stack||e.message);}
 finally{report.sourceAfter=snapshot();report.sourcesChanged=JSON.stringify(report.sourceBefore)!==JSON.stringify(report.sourceAfter);report.finished=new Date().toISOString();
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser?.close();await server.close();
  console.log(JSON.stringify({report:path.join(output,'report.json'),cases:report.cases.length,failed:report.cases.filter(c=>c.failures.length).length,errors:report.errors,sourcesChanged:report.sourcesChanged,pendingContractChecks:plan.pendingContractChecks},null,2));
  if(report.errors.length||report.sourcesChanged||report.cases.some(c=>c.failures.length))process.exitCode=1;
 }
}
async function ready(p){await p.evaluate(()=>document.fonts.ready);await p.waitForFunction(()=>![...document.querySelectorAll('.free-material.is-pending,.retained-text-frame[aria-busy="true"]')].some(el=>el.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}))&&window.qaPilot.waiters.length===0);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function durable(p){return p.evaluate(()=>window.qaPilot.durable());}
function evidence(s){return {knownLetters:s.profile.knownLetters,availableCapabilities:s.profile.availableCapabilities,confirmedSkills:s.profile.confirmedSkills,skillBasis:s.profile.skillBasis,programs:s.profile.programs};}
async function selectStory(p,title){
 const heading=p.locator('.text-exercise h2.spoken-heading');
 // The heading's accessible name also contains the audio button's aria-label.
 // Its rendered textContent is just the actual story title.
 if(await heading.count()&&(await heading.textContent())?.trim()===title){
  await heading.waitFor({state:'visible'});return;
 }
 const button=p.locator('summary').filter({hasText:'Выбрать текст'});
 await setDetailsState(p,button,true);await ready(p);
 await p.getByRole('button',{name:title,exact:true}).click();
 await ready(p);
 await setDetailsState(p,button,false);await ready(p);
 await p.waitForFunction(title=>document.querySelector('.text-exercise h2.spoken-heading')?.textContent?.trim()===title,title);
 await heading.waitFor({state:'visible'});
}
async function setDetailsState(p,summary,open){
 const details=summary.locator('..');
 assert.equal(await details.evaluate(el=>el.tagName),'DETAILS','expected native details owner');
 if(await details.evaluate(el=>el.open)!==open)await summary.click();
 // Native toggle is asynchronous and React then synchronizes its controlled
 // open state. Never force-click or set the DOM property to bypass bad geometry.
 const element=await details.elementHandle();
 try{await p.waitForFunction(({element,open})=>element.open===open,{element,open});
  await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  assert.equal(await details.evaluate(el=>el.open),open,'requested details must stay in target state');
 }finally{await element?.dispose();}
}
async function assertButtonBounds(button){
 const geometry=await button.evaluate(el=>{
  const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
  const clipped=[];
  for(let parent=el.parentElement;parent;parent=parent.parentElement){
   const style=getComputedStyle(parent),p=parent.getBoundingClientRect();
   if((/auto|scroll|hidden|clip/.test(style.overflowY)&&(r.top<p.top-1||r.bottom>p.bottom+1))||
      (/auto|scroll|hidden|clip/.test(style.overflowX)&&(r.left<p.left-1||r.right>p.right+1)))clipped.push(parent.className);
  }
  return {visible:el.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}),inside:r.top>=-1&&r.left>=-1&&r.bottom<=innerHeight+1&&r.right<=innerWidth+1,hit:!!hit&&(el===hit||el.contains(hit)),clipped};
 });
 assert(geometry.visible&&geometry.inside&&geometry.hit&&!geometry.clipped.length,'whole-word footer primary visible and not clipped: '+JSON.stringify(geometry));
}
async function capture(p,c,state,output){
 const data=await p.locator('.text-exercise').evaluate(card=>{
  const controls=[...card.querySelectorAll('.text-task-controls button,.text-task-controls summary,.text-task-controls [role="status"]')].filter(e=>e.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}));
  const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  return {card:rect(card),controls:controls.map(el=>{const r=rect(el),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {text:el.textContent.trim(),rect:r,hit:!!hit&&(el===hit||el.contains(hit))};}),viewport:{width:innerWidth,height:innerHeight}};
 });
 c.states.push({state,...data});
 assert(data.controls.length>0,'control measurement cannot be empty');
 assert(data.card.y>=-1&&data.card.bottom<=data.viewport.height+1,'card inside viewport');
 for(const control of data.controls)assert(control.rect.y>=-1&&control.rect.bottom<=data.viewport.height+1&&control.hit,`visible control: ${control.text}`);
 await p.screenshot({path:path.join(output,`${c.name}-${state}.png`)});
}
