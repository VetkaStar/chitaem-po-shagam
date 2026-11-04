/** Real emitted application only. Run after the production-build handoff. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { preview } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const output = path.resolve(root, process.env.TEXT_PRODUCTION_REPORT_DIR || '.local/text-reading-production');
fs.mkdirSync(output, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_PACKAGE
  ? await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE, 'index.mjs')))
  : require('playwright');
// Independent oracle: the authored story, not text read back from the rendered pages.
const story = [
  'Аня посадила семечко в горшок.',
  'Она поливала землю.',
  'Однажды появился маленький росток.',
  'Аня поставила горшок поближе к свету.',
];
const scenarios = [
  {width:1280,height:720,size:28,presentation:'scroll'},
  {width:390,height:844,size:40,presentation:'pages'},
].flatMap(config => [false,true].map(sound => ({...config,sound})));
const report = { started: new Date().toISOString(), base: '', cases: [] };
let browser, server;
async function ready(page) {
  await page.waitForFunction(() => {
    const card = document.querySelector('.text-exercise');
    return card?.querySelector('.text-reading-scroll .full-reading-text .full-text-line') &&
      !card.closest('[inert]') && !document.querySelector('.library [aria-busy="true"]');
  }, undefined, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function openStory(page) {
  await page.locator('#home-trainers .portal-card').filter({ has: page.locator('b', { hasText: /^Тексты$/ }) }).click();
  await page.getByRole('region', { name: 'Тренажёры раздела Тексты', exact: true })
    .getByRole('button', { name: 'Рассказы', exact: true }).click();
  const picker = page.locator('details.practice-menu').filter({ has: page.locator('summary', { hasText: 'Выбрать текст' }) });
  await picker.locator('summary').click();
  await picker.getByRole('button', { name: 'Росток', exact: true }).click();
  // Selecting the already-active item leaves the native picker open.
  if (await picker.getAttribute('open') !== null) await picker.locator('summary').click();
  await page.locator('.text-exercise h2.spoken-heading').filter({hasText:/^Росток$/}).waitFor();
  await ready(page);
}
async function settingsMenu(page) {
  const menu = page.locator('details.practice-menu').filter({ has: page.locator('summary', { hasText: /^Настройки$/ }) });
  await menu.locator('summary').click();
  return menu;
}
async function measure(page) {
  return page.evaluate(() => {
    const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const card = document.querySelector('.text-exercise');
    const box = card.querySelector('.text-reading-scroll'), bounds = rect(box);
    const inside = r => r.x >= bounds.x - 2 && r.right <= bounds.right + 2 && r.y >= bounds.y - 2 && r.bottom <= bounds.bottom + 2;
    const parts = [...box.querySelectorAll('.full-reading-text .full-text-line')].map(el => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const glyphs = [];
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent.trim()) continue;
        const range = document.createRange(); range.selectNodeContents(walker.currentNode);
        glyphs.push(...[...range.getClientRects()].map(r => ({ x:r.x, y:r.y, right:r.right, bottom:r.bottom })));
      }
      return { line:Number(el.dataset.sourceLine), start:Number(el.dataset.sourceStart), end:Number(el.dataset.sourceEnd),
        text:el.textContent, rect:rect(el), textStartX:glyphs[0]?.x,
        allGlyphsVisible:glyphs.length > 0 && glyphs.every(inside), font:Number.parseFloat(getComputedStyle(el).fontSize) };
    });
    const status = card.querySelector('.text-line-status');
    const adult = [...card.querySelectorAll('summary')].find(el => el.textContent.includes('Проверить вместе со взрослым'));
    const primary = card.querySelector('.text-task-controls .task-card-primary');
    const controls = card.querySelector('.text-task-controls');
    const pager = card.querySelector('.text-page-controls');
    const actions = [...card.querySelectorAll('.text-task-controls .task-card-primary, .task-card-actions button')]
      .filter(el=>el.checkVisibility()).map(el=>({label:el.textContent.trim(),rect:rect(el)}));
    return { parts, box:bounds, scroll:box.scrollHeight-box.clientHeight,
      actions, speakers:box.querySelectorAll('.full-reading-text .full-text-line > button.quiet').length,
      card:rect(card), controls:rect(controls), status:status && { text:status.textContent, ...rect(status) },
      adult:adult && rect(adult), primary:primary && rect(primary), pager:pager && rect(pager),
      progress:card.querySelector('.text-read-progress')?.value,
      activeLine:card.querySelector('.text-reading-viewport').dataset.activeLine,
      activeSource:card.querySelector('.text-reading-viewport').dataset.activeSource,
      documentWidth:document.documentElement.scrollWidth, viewport:{width:innerWidth,height:innerHeight},
      stored:JSON.parse(localStorage.getItem('reading-steps-v3')) };
  });
}
function checkGeometry(state, size) {
  assert(state.parts.length > 0, 'page has no story fragments');
  assert(state.scroll <= 2, `text clipped/scrolls inside page: ${state.scroll}px`);
  assert(state.documentWidth <= state.viewport.width + 1, 'horizontal page overflow');
  for (const [name, box] of Object.entries({status:state.status, adult:state.adult, primary:state.primary})) {
    assert(box && box.height > 0 && box.y >= 0 && box.bottom <= state.viewport.height + 1, `${name} not fully on screen`);
  }
  assert(state.actions.length>=3,'missing primary or secondary actions');
  for (let i=0;i<state.actions.length;i++) {
    const {label,rect:a}=state.actions[i];
    assert(a.width>0 && a.height>0 && a.x>=0 && a.y>=0 && a.right<=state.viewport.width+1 && a.bottom<=state.viewport.height+1,
      `action outside viewport: ${label}`);
    for(let j=i+1;j<state.actions.length;j++) {
      const {label:other,rect:b}=state.actions[j];
      const overlapX=Math.min(a.right,b.right)-Math.max(a.x,b.x);
      const overlapY=Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y);
      assert(!(overlapX>1 && overlapY>1),`actions overlap ${overlapX.toFixed(2)}x${overlapY.toFixed(2)}px: ${label} / ${other}`);
    }
  }
  for (const part of state.parts) {
    assert(part.allGlyphsVisible, `clipped text line ${part.line} offset ${part.start}`);
    assert(Math.abs(part.font - size) < 0.1, `font ${part.font}, expected ${size}`);
    assert.equal(part.text, story[part.line]?.slice(part.start, part.end), 'rendered fragment differs from source');
  }
}
async function savedSettings(page, size, presentation) {
  await page.waitForFunction(({size,presentation}) => {
    const s = JSON.parse(localStorage.getItem('reading-steps-v3') || '{}').settings;
    return s?.textFontSize === size && s.textPresentation === presentation && s.interfaceScale === 100;
  }, {size,presentation});
}
try {
  server = process.env.PRODUCTION_URL ? null : await preview({
    configFile:path.join(root,'vite.pages.config.ts'), logLevel:'error', preview:{host:'127.0.0.1',port:0},
  });
  report.base = process.env.PRODUCTION_URL || `http://127.0.0.1:${server.httpServer.address().port}/`;
  browser = await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'msedge'});
  for (const config of scenarios) {
    const item = {name:`${config.width}-${config.size}-${config.presentation}-sound-${config.sound?'on':'off'}`,config,states:[],pageErrors:[],networkErrors:[],failures:[]};
    report.cases.push(item);
    const context = await browser.newContext({viewport:{width:config.width,height:config.height},reducedMotion:'reduce'});
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => item.pageErrors.push(error.message));
    page.on('requestfailed', request => item.networkErrors.push(`${request.failure()?.errorText}: ${request.url()}`));
    page.on('response', response => { if (response.status() >= 400) item.networkErrors.push(`${response.status()}: ${response.url()}`); });
    try {
      // Seed only the profile, through a blank same-origin document; never replace application code.
      const seedUrl = new URL('__text_production_setup',report.base).href;
      await page.route(seedUrl,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Setup</title>'}));
      await page.goto(seedUrl);
      await page.evaluate(sound => {
        localStorage.setItem('reading-profile-v1',JSON.stringify({name:'Текст production',age:'8',start:'stories'}));
        localStorage.setItem('reading-steps-v3',JSON.stringify({settings:{styleChosen:true,unit:12,curriculumVersion:2,
          layout:'order',look:'plain',interfaceScale:100,sound,motion:false,autoSpeech:false,autoAdvance:false,
          textFlow:'manual',showFullText:true,textFontSize:24,textPresentation:'scroll',breakEvery:0,breakMinutes:0},stars:0,history:[]}));
      },config.sound);
      await page.goto(report.base);
      item.scripts = await page.locator('script[src]').evaluateAll(nodes=>nodes.map(n=>n.src));
      const entry = item.scripts.find(src=>/\/assets\/index-[^/]+\.js(?:\?|$)/.test(src));
      assert(entry,'missing emitted /assets/index-*.js');
      assert(!item.scripts.some(src=>src.includes('@vite/client')),'dev server is not production');
      const response = await page.request.get(entry);
      assert.equal(response.status(),200);
      item.entrySha256 = createHash('sha256').update(await response.body()).digest('hex');
      await openStory(page);
      const menu = await settingsMenu(page);
      await menu.getByLabel(/^Размер текста/).selectOption(String(config.size));
      await menu.getByLabel(/^Длинный текст/).selectOption(config.presentation);
      await menu.locator('summary').click();
      await savedSettings(page,config.size,config.presentation);
      await ready(page);
      await page.reload();
      await openStory(page);
      const restoredMenu = await settingsMenu(page);
      assert.equal(await restoredMenu.getByLabel(/^Размер текста/).inputValue(),String(config.size));
      assert.equal(await restoredMenu.getByLabel(/^Длинный текст/).inputValue(),config.presentation);
      await restoredMenu.locator('summary').click(); await ready(page);
      const first = await measure(page); item.states.push({state:'reloaded',...first}); checkGeometry(first,config.size);
      assert.equal(first.stored.settings.sound,config.sound);
      assert.equal(first.speakers,config.sound?first.parts.length:0,'unexpected line speaker visibility');
      let inactiveLine = first.parts.find(part=>part.line===1 && part.start===0);
      await page.screenshot({path:path.join(output,`${item.name}-reloaded.png`)});
      if (config.presentation === 'scroll') {
        assert.equal(first.parts.length,4,'all four lines must be visible together');
        assert.deepEqual(first.parts.map(p=>p.text),story);
      } else {
        const collected = [], forward = page.getByRole('button',{name:'Следующая страница',exact:true});
        for (let n=0; n<50; n++) {
          const state = await measure(page); checkGeometry(state,config.size);
          inactiveLine ??= state.parts.find(part=>part.line===1 && part.start===0);
          item.states.push({state:`page-${n+1}`,...state}); collected.push(...state.parts);
          assert.equal(state.status.text,first.status.text,'page navigation changed active logical line');
          assert.equal(state.activeLine,first.activeLine); assert.equal(state.activeSource,first.activeSource);
          assert.equal(state.progress,first.progress,'page navigation credited reading');
          assert.equal(state.stored.stars,first.stored.stars); assert.deepEqual(state.stored.history,first.stored.history);
          for (const name of ['controls','status','adult','primary','pager']) for (const axis of ['x','y','width','height'])
            assert(Math.abs(state[name][axis]-first[name][axis])<=2,`${name}.${axis} moved during paging`);
          await page.screenshot({path:path.join(output,`${item.name}-page-${n+1}.png`)});
          if (!await forward.isEnabled()) break;
          assert(n<49,'page traversal exceeded bound');
          const before = await page.locator('.text-page-controls span').textContent();
          await forward.click();
          await page.waitForFunction(previous=>document.querySelector('.text-page-controls span')?.textContent!==previous,before);
          await ready(page);
        }
        for (let line=0; line<story.length; line++) {
          const parts=collected.filter(p=>p.line===line); let offset=0, text='';
          for (const part of parts) { assert.equal(part.start,offset,'missing/duplicate source offsets'); offset=part.end; text+=part.text; }
          assert.equal(offset,story[line].length); assert.equal(text,story[line]);
        }
        const back=page.getByRole('button',{name:'Предыдущая страница',exact:true});
        for(let n=0;await back.isEnabled();n++) { assert(n<50);await back.click();await ready(page); }
      }
      // Actual adult confirmation and the next logical line, without microphone input.
      await page.getByText('Проверить вместе со взрослым',{exact:true}).click();
      await page.getByRole('button',{name:'Строка прочитана верно',exact:true}).click();
      await ready(page);
      await page.getByRole('button',{name:/Следующая строка/}).click();
      await page.waitForFunction(()=>document.querySelector('.text-line-status')?.textContent.includes('Строка 2 из 4'));
      await ready(page);
      const after = await measure(page); item.states.push({state:'adult-next',...after}); checkGeometry(after,config.size);
      const activeLine = after.parts.find(part=>part.line===1 && part.start===0);
      assert(inactiveLine && activeLine,'missing same source-line start before/after activation');
      const delta = activeLine.textStartX-inactiveLine.textStartX;
      item.alignment = {line:1,start:0,before:inactiveLine.textStartX,after:activeLine.textStartX,delta};
      assert(Number.isFinite(delta) && Math.abs(delta)<=2,`line 2 text start moved ${delta}px on activation (tolerance 2px)`);
      await page.screenshot({path:path.join(output,`${item.name}-adult-next.png`)});
    } catch(error) {
      item.failures.push(error.stack || String(error));
      await page.screenshot({path:path.join(output,`${item.name}-failure.png`)}).catch(()=>{});
    } finally {
      if(item.pageErrors.length || item.networkErrors.length) item.failures.push('page/network errors; see details');
      await context.close();
      fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
      console.log(item.failures.length?'FAIL':'PASS',item.name);
    }
  }
} finally {
  await browser?.close();
  if(server) await new Promise((resolve,reject)=>server.httpServer.close(error=>error?reject(error):resolve()));
  report.finished=new Date().toISOString();
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
}
assert.equal(report.cases.length,scenarios.length);
assert(report.cases.every(item=>item.failures.length===0),'production text reading failed; inspect report.json');
console.log('PASS emitted text reading: source coverage, geometry, saved controls and adult next');
