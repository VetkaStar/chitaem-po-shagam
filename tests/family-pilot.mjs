import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const { chromium } = process.env.PLAYWRIGHT_PACKAGE
  ? await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE, 'index.mjs')))
  : require('playwright');
const server = await createServer({ configFile: path.join(root, 'vite.pages.config.ts'),
  server: { host: '127.0.0.1', port: 0, hmr: false, forwardConsole: false, fs: { allow: [root] } }, logLevel: 'error' });
await server.listen();
const base = 'http://127.0.0.1:' + server.httpServer.address().port;
// Reuse the existing real hook/card harness without modifying its QA files.
const fixture = path.join(root, 'tests/fixtures/word-bridge-enter.tsx').replaceAll('\\', '/');
const html = await server.transformIndexHtml('/__family.html', `<!doctype html><html lang="ru"><head><meta charset="UTF-8"></head><body><div id="root"></div><script type="module" src="/@fs/${fixture}"></script></body></html>`);
const families = [
  ['mama', 0, ['МА', 'МА'], 'МАМА'], ['mukha', 2, ['МУ', 'ХА'], 'МУХА'],
  ['luna', 6, ['ЛУ', 'НА'], 'ЛУНА'], ['sumka', 8, ['СУМ', 'КА'], 'СУМКА'],
  ['lampa', 11, ['ЛАМ', 'ПА'], 'ЛАМПА'], ['krupa', 11, ['КРУ', 'ПА'], 'КРУПА'],
];
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('reading-steps-v3',JSON.stringify({ settings: {
    unit: 0, curriculumVersion: 2, sound: false, autoSpeech: false, autoAdvance: false,
    motion:false, breakEvery:0,breakMinutes:0,length:7,wordMode:'parts',partsThenWhole:true,
  }, stars:9, history:[], recentWords:[] })));
  await page.route('**/__family.html*', route=>route.fulfill({contentType:'text/html',body:html}));
  await page.goto(base+'/__family.html');
  await page.waitForFunction(()=>window.bridgeLesson?.ready);
  const state=()=>page.evaluate(()=>({stage:window.bridgeLesson.stage,target:window.bridgeLesson.target,
    family:window.bridgeLesson.family?.id,stars:window.bridgeLesson.stars,count:window.bridgeLesson.count,
    assembled:window.bridgeLesson.familyAssembled,showParts:window.bridgeLesson.showParts,done:window.bridgeLesson.done}));
  for (const [id,unit,parts,word] of families) {
    await page.evaluate(u=>window.bridgeLesson.changeTopic('syllables',u),unit);
    const selector=page.getByRole('combobox',{name:'Семейство слов'});
    await selector.selectOption(id);
    await page.waitForFunction(id=>window.bridgeLesson.family?.id===id,id);
    const before=(await state()).stars;
    for (let index=0;index<parts.length;index++) {
      assert.equal((await state()).target,parts[index]);
      await page.getByLabel('Проверить вместе со взрослым').click();
      // The existing explicit adult confirmation path, not an ASR simulation.
      await page.getByRole('button',{name:'Получилось',exact:true}).click();
      if (index===0) {
        assert.equal(await page.locator('.word-bridge').count(),0);
        await page.getByRole('button',{name:/Дальше.*Enter/}).click();
        await page.waitForFunction(()=>window.bridgeLesson.count===1);
      }
    }
    const bridge=page.getByRole('region',{name:'Из слогов в слово'});
    await bridge.waitFor();
    await page.evaluate(()=>window.bridgeLesson.next());
    assert.equal((await state()).stage,'syllables','cannot bypass assembly');
    for(const part of parts) await bridge.getByRole('button',{name:part,exact:true}).evaluateAll((buttons)=>{
      const button=buttons.find(b=>!b.disabled); if(!button)throw Error('No available part'); button.click();
    });
    await page.waitForFunction(()=>window.bridgeLesson.familyAssembled);
    assert.equal((await state()).stars,before+2,'assembly gives no extra reading reward');
    assert.equal(await bridge.locator('button.primary').count(),0,'no duplicated primary action in material');
    const wholeButton=page.getByRole('button',{name:/Читать слово целиком.*Enter/});
    assert.equal(await wholeButton.evaluate(button=>button.closest('.task-card-actions')!==null),true);
    await wholeButton.press('Enter');
    await page.waitForFunction(()=>window.bridgeLesson.stage==='words');
    assert.equal((await state()).target,word);
    assert.equal((await state()).showParts,false,'whole reading even with old parts preference');
    assert.equal((await state()).done,false);
    await page.getByLabel('Проверить вместе со взрослым').click();
    await page.getByRole('button',{name:'Получилось',exact:true}).click();
    assert.equal((await state()).stars,before+3);
    await page.getByRole('button',{name:/Дальше.*Enter/}).click();
    await page.waitForFunction(()=>window.bridgeLesson.done);
  }
  await page.evaluate(()=>window.bridgeLesson.changeTopic('syllables',0));
  assert.equal((await state()).family,undefined);
  assert.deepEqual(await page.locator('select[aria-label="Семейство слов"] option').evaluateAll(xs=>xs.map(x=>x.value)),['','mama']);
  await page.evaluate(()=>window.bridgeLesson.selectFamily('krupa'));
  assert.equal((await state()).family,undefined,'reject unavailable family');
  await page.getByRole('combobox',{name:'Семейство слов'}).selectOption('mama');
  await page.evaluate(()=>window.bridgeLesson.navigate('letters','read'));
  assert.equal((await state()).family,undefined,'clear on section change');
  await page.evaluate(()=>window.bridgeLesson.navigate('syllables','read'));
  await page.getByRole('combobox',{name:'Семейство слов'}).selectOption('mama');
  await page.evaluate(()=>window.bridgeLesson.setLessonActive(false));
  assert.equal((await state()).family,undefined,'clear on leaving lesson');
  await page.evaluate(()=>window.bridgeLesson.changeTopic('syllables',11));
  await page.getByRole('combobox',{name:'Семейство слов'}).selectOption('krupa');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(root,'.local/content-pilot-20261104/families-mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow');
  assert.deepEqual(errors,[]);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('reading-steps-v3')));
  assert.equal(saved.settings.curriculumVersion,2);
  assert.equal('familySelection' in saved,false);
  // Full application chrome and real exposure recorder: the isolated card alone
  // does not reproduce the constrained body height of the actual workspace.
  const fullFixture=path.join(root,'tests/fixtures/content-pilot.tsx').replaceAll('\\','/');
  const fullHtml=await server.transformIndexHtml('/__family-full.html',`<!doctype html><html lang="ru"><head><meta charset="UTF-8"></head><body><div id="root"></div><script type="module" src="/@fs/${fullFixture}"></script></body></html>`);
  for(const viewport of [{width:1280,height:720},{width:390,height:844}]) {
    const full=await browser.newPage({viewport});
    full.on('pageerror',e=>errors.push(e.message));
    await full.addInitScript(()=>{
      localStorage.setItem('reading-profile-v1',JSON.stringify({name:'Проверка',age:'8',start:'syllables'}));
      localStorage.setItem('reading-steps-v3',JSON.stringify({settings:{styleChosen:true,unit:12,curriculumVersion:2,sound:false,autoSpeech:false,autoAdvance:false,motion:false,layout:'order',look:'plain',interfaceScale:100,breakEvery:0,breakMinutes:0},stars:0,history:[]}));
    });
    await full.route('**/__family-full.html',route=>route.fulfill({contentType:'text/html',body:fullHtml}));
    await full.goto(base+'/__family-full.html');
    await full.locator('#home-trainers .portal-card').filter({has:full.locator('b',{hasText:/^Слоги$/})}).click();
    await full.getByRole('region',{name:'Тренажёры раздела Слоги',exact:true}).getByRole('button',{name:'Слог',exact:true}).click();
    await full.getByLabel('Семейство слов',{exact:true}).selectOption('krupa');
    for(let i=0;i<2;i++) {
      await full.getByLabel('Проверить вместе со взрослым').click();
      await full.getByRole('button',{name:'Получилось',exact:true}).click();
      if(i===0)await full.getByRole('button',{name:/Дальше.*Enter/}).click();
    }
    const bridge=full.getByRole('region',{name:'Из слогов в слово'});
    for(const part of ['КРУ','ПА'])await bridge.getByRole('button',{name:part,exact:true}).click();
    const read=full.getByRole('button',{name:/Читать слово целиком.*Enter/});
    await full.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));
    await read.waitFor();
    assert.equal(await read.isEnabled(),true);
    assert.equal(await full.locator('.task-card button.primary').count(),1);
    const geometry=await full.evaluate(()=>{
      const issues=[];
      for(const selector of ['select[aria-label="Семейство слов"]','.task-card-actions button.primary','.bridge-word']) {
        const el=document.querySelector(selector),r=el.getBoundingClientRect();
        if(r.top<0||r.bottom>innerHeight+1||r.left<0||r.right>innerWidth+1)issues.push(selector+' outside screen');
        for(let parent=el.parentElement;parent;parent=parent.parentElement){
          const css=getComputedStyle(parent),p=parent.getBoundingClientRect();
          if(/auto|scroll|hidden|clip/.test(css.overflowY)&&(r.top<p.top-1||r.bottom>p.bottom+1))issues.push(selector+' clipped by '+parent.className);
        }
      }
      return issues;
    });
    assert.deepEqual(geometry,[]);
    await full.screenshot({path:path.join(root,`.local/content-pilot-20261104/families-full-${viewport.width}.png`),fullPage:true});
    await read.press('Enter');
    await full.waitForFunction(()=>window.qaPilot.model.stage==='words');
    assert.equal(await full.evaluate(()=>window.qaPilot.model.target),'КРУПА');
    await full.close();
  }
  assert.deepEqual(errors,[]);
  console.log('family pilot: six complete chains, target filtering, rewards, whole reading, topic/section/exit reset and mobile overflow passed');
} finally { await browser?.close(); await server.close(); }
