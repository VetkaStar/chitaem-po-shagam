/** Bounded audit of ordinary modes omitted by the main card geometry matrix. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const phase = process.env.QA_PHASE || 'final';
const output = path.join(root, '.local/task-card-modes', phase);
fs.mkdirSync(output, { recursive: true });
const sourceFiles = ['app/globals.css', 'features/lesson/ExerciseCard.tsx',
  'features/lesson/ExerciseActions.tsx', 'features/lesson/ExerciseMaterial.tsx',
  'features/lesson/ExerciseAnswerInput.tsx', 'features/lesson/TaskCardBody.tsx',
  'features/lesson/LessonWorkspace.tsx', 'features/lesson/use-lesson.ts',
  'features/answers/AnswerCard.tsx', 'features/answers/AnswerSession.tsx'];
const hashes = () => Object.fromEntries(sourceFiles.map(file => [file,
  createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
const report = { phase, started: new Date().toISOString(), sourceBefore: hashes(), cases: [],
  limits: ['Real UI, isolated local profiles, no microphone or ASR.',
    'Pictures always use type in navigate(); free answer and letter slots are the two existing UI modes.',
    'Only order/focus, plain, 1280x720/390x844, scale 100, sound/motion off.'] };
const { chromium } = process.env.PLAYWRIGHT_PACKAGE
  ? await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE, 'index.mjs')))
  : createRequire(import.meta.url)('playwright');
const server = await createServer({ configFile: path.join(root, 'vite.pages.config.ts'),
  server: { host: '127.0.0.1', port: 0, hmr: false, forwardConsole: false }, logLevel: 'error' });
await server.listen();
let browser;
const scenarios = [['letters','fly'], ['syllables','fly'], ['words','fly'],
  ['words','read'], ['words','type'], ['pictures','free'], ['pictures','letters'],
  ['letters','answer'], ['syllables','answer'], ['words','answer']];
const primary = page => page.locator('.task-card-actions .primary, .answer-exercise .curriculum-answer-form > button[type="submit"]');
async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function waitReady(page) {
  await page.waitForFunction(() => {
    const card = document.querySelector('.task-card');
    return !!card?.querySelector('.task-card-body') &&
      !card.closest('.free-material.is-pending, [inert]') &&
      card.getAttribute('aria-busy') !== 'true';
  }, undefined, {timeout:7000});
}
async function clickPrimary(page) {
  await waitReady(page);
  const button=primary(page).first();
  if (!await button.isEnabled()) throw Error('Primary still disabled');
  const r=await button.boundingBox();
  if (!r || !await button.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}))
    throw Error('Primary cannot be clicked without scrolling');
  await page.mouse.click(r.x+r.width/2,r.y+r.height/2);
}
async function inspect(page, item, state) {
  await waitReady(page);
  await settle(page);
  const data = await page.evaluate(() => {
    const rect = e => { const r = e.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right }; };
    const body = document.querySelector('.task-card-body');
    const card = document.querySelector('.task-card');
    const visibleInBody = e => { const r=rect(e),b=rect(body);
      return r.y>=b.y-1 && r.bottom<=b.bottom+1 && r.x>=b.x-1 && r.right<=b.right+1; };
    const buttons = [...document.querySelectorAll('.task-card-actions button, .answer-exercise .curriculum-answer-form > button[type="submit"]')]
      .filter(e => e.checkVisibility()).map(e => {
        const r=rect(e); const points=[[r.x+r.width/2,r.y+3],[r.x+r.width/2,r.bottom-3],[r.x+3,r.y+r.height/2],[r.right-3,r.y+r.height/2],[r.x+r.width/2,r.y+r.height/2]];
        return { text:e.getAttribute('aria-label') || e.textContent.trim(), primary:e.matches('.primary,button[type="submit"]'),
          disabled:e.disabled, rect:r, hit:points.map(([x,y])=>e.contains(document.elementFromPoint(x,y))) };
      });
    const inputs = [...document.querySelectorAll('.task-card input')].filter(e=>e.checkVisibility()).map(e=>{
      const r=rect(e);return {label:e.getAttribute('aria-label'),rect:r,
        hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),fullyVisible:visibleInBody(e)};
    });
    const choices=[...document.querySelectorAll('.task-card .curriculum-option')].filter(e=>e.checkVisibility())
      .map(e=>({text:e.textContent.trim(),rect:rect(e),fullyVisible:visibleInBody(e)}));
    const images=[...document.querySelectorAll('.task-card .reviewed-illustration')].filter(e=>e.checkVisibility())
      .map(e=>({rect:rect(e),fullyVisible:visibleInBody(e)}));
    return { card:card&&rect(card), body:body&&{...rect(body),scroll:body.scrollHeight-body.clientHeight,scrollTop:body.scrollTop},
      buttons, inputs, choices, images, scrollY, viewport:{width:innerWidth,height:innerHeight}, documentWidth:document.documentElement.scrollWidth,
      material:document.querySelector('.reading')?.getAttribute('aria-label'),
      catches:[...document.querySelectorAll('.catch-token')].map(e=>({text:e.getAttribute('data-token'),rect:rect(e),fullyVisible:visibleInBody(e)})) };
  });
  item.states.push({ state, ...data });
  if (!data.buttons.some(b=>b.primary)) item.failures.push(state+': primary missing');
  for (const button of data.buttons) {
    if (!button.hit.every(Boolean)) item.failures.push(state+': occluded/outside viewport: '+button.text);
  }
  if (data.documentWidth > data.viewport.width+1) item.failures.push(state+': horizontal page overflow');
  if (data.card?.bottom > data.viewport.height+1) item.failures.push(state+': card below viewport');
  if (data.body?.scroll > 2) item.observations.push(state+': internal content scroll '+data.body.scroll+'px');
  if (state==='initial' && data.inputs.some(input=>!input.hit || !input.fullyVisible))
    item.failures.push(state+': answer input clipped; scrolling needed for a short task');
  if(state==='initial' && data.choices.some(choice=>!choice.fullyVisible)) item.failures.push(state+': answer options clipped');
  if(state==='initial' && data.images.some(image=>!image.fullyVisible)) item.failures.push(state+': task illustration clipped');
  if(state==='initial' && data.catches.some(token=>!token.fullyVisible)) item.failures.push(state+': catching token clipped');
  await page.screenshot({path:path.join(output,item.name+'-'+state+'.png')});
}
try {
  browser = await chromium.launch({ headless:true, channel:process.env.BROWSER_CHANNEL || 'msedge' });
  for (const layout of ['order','focus']) for (const [width,height] of [[1280,720],[390,844]]) for (const [stage,mode] of scenarios) {
    const name = `${layout}-${width}-${stage}-${mode}`;
    if (process.env.QA_CASE && !name.includes(process.env.QA_CASE)) continue;
    if (process.env.QA_SKIP_FLY && mode==='fly') continue;
    const item = {name,layout,width,height,stage,mode,states:[],failures:[],observations:[],pageErrors:[]};
    report.cases.push(item);
    const context = await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
    const page = await context.newPage(); page.setDefaultTimeout(7000);
    page.on('pageerror',error=>item.pageErrors.push(error.message));
    try {
      await page.addInitScript(({stage,layout})=>{
        let seed=81; Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
        localStorage.setItem('reading-profile-v1',JSON.stringify({name:'Режимы',age:'8',start:stage}));
        localStorage.setItem('reading-steps-v3',JSON.stringify({settings:{styleChosen:true,layout,look:'plain',
          interfaceScale:100,sound:false,motion:false,autoSpeech:false,autoAdvance:false,unit:12,curriculumVersion:2,
          length:3,breakEvery:0,breakMinutes:0,wordMode:'whole',partsThenWhole:false},stars:0,history:[],recentWords:{}}));
      },{stage,layout});
      await page.goto('http://127.0.0.1:'+server.httpServer.address().port);
      await page.getByRole('button',{name:'Начать занятие →',exact:true}).click();
      if(stage==='pictures') await page.getByRole('button',{name:mode==='free'?'Свободный ответ':'Окошки для букв',exact:true}).click();
      else if(mode!=='read') await page.getByRole('tab',{name:{fly:'Ловлю',type:'Пишу',answer:'Отвечаю'}[mode],exact:true}).click();
      await page.locator(mode==='answer'?'.answer-exercise .task-card-body':`.task-card[data-mode="${stage==='pictures'?'type':mode}"] .task-card-body`).waitFor();
      await waitReady(page);
      await page.evaluate(()=>document.fonts.ready);
      await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('.task-card-body').scrollTop=0;});
      await inspect(page,item,'initial');
      if(mode==='fly') {
        const target=await page.locator('.catch-token:not(.caught)').first().getAttribute('data-token');
        await page.getByRole('textbox',{name:'Твой ответ',exact:true}).fill(target);
        await clickPrimary(page);
        await page.locator('.catch-token.caught').first().waitFor();
        item.observations.push('Pointer catch accepted: '+target);
        await inspect(page,item,'caught');
      } else if(mode==='answer') {
        const reveal=page.getByRole('button',{name:'Открыть варианты ответа',exact:true});
        if(await reveal.isVisible()) await reveal.click();
        await page.locator('.curriculum-option').first().click();
        const hint=page.getByRole('button',{name:'Подсказка',exact:true});
        await hint.click({timeout:2500});await inspect(page,item,'hint');
        await page.getByRole('button',{name:'Скрыть подсказку',exact:true}).click({timeout:2500});
        await clickPrimary(page);
        await page.locator('.task-card.answer-result').waitFor();
        await inspect(page,item,'submitted');
      } else {
        await page.getByRole('button',{name:'Подсказка',exact:true}).click({timeout:2500});
        await inspect(page,item,'hint');
        await page.getByRole('button',{name:'Скрыть подсказку',exact:true}).click({timeout:2500});
        if(mode==='read') {
          await page.getByLabel('Проверить вместе со взрослым',{exact:true}).click();
          await page.getByRole('button',{name:'Получилось',exact:false}).click({timeout:2500});
          await page.locator('.task-card.success .feedback.success').waitFor();
          await inspect(page,item,'adult-success');
        } else {
          const inputs=page.locator('.task-card input');
          if(stage==='pictures'&&mode==='letters') for(let i=0;i<await inputs.count();i++) await inputs.nth(i).fill('Ы');
          else await page.getByRole('textbox',{name:'Твой ответ',exact:true}).fill('ЫЫЫ');
          const previousFeedback=await page.locator('.task-card .feedback > span').textContent();
          await clickPrimary(page);
          await page.waitForFunction(({kind,previous})=>{
            const feedback=document.querySelector('.task-card .feedback.'+kind+' > span');
            return !!feedback?.textContent.trim() && feedback.textContent!==previous;
          },{kind:stage==='pictures'?'neutral':'error',previous:previousFeedback},{timeout:7000});
          await inspect(page,item,'wrong-answer');
        }
      }
    } catch(error) {
      item.failures.push('Interaction stopped: '+error.message.split('\n').slice(0,6).join(' '));
      await page.screenshot({path:path.join(output,name+'-stopped.png')}).catch(()=>{});
    } finally {
      if(item.pageErrors.length)item.failures.push('pageerror');
      await context.close();
      fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
      console.log(item.failures.length?'FAIL':'PASS',name,item.failures.length,item.observations.join('; '));
    }
  }
} finally {
  report.sourceAfter=hashes();
  report.sourcesChanged=JSON.stringify(report.sourceBefore)!==JSON.stringify(report.sourceAfter);
  report.finished=new Date().toISOString();
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  await browser?.close();await server.close();
  console.log(JSON.stringify({cases:report.cases.length,failed:report.cases.filter(c=>c.failures.length).length,sourcesChanged:report.sourcesChanged}));
  if(report.sourcesChanged||report.cases.some(c=>c.failures.length))process.exitCode=1;
}
