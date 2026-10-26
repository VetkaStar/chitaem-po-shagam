import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_PACKAGE
  ? await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE, 'index.mjs')))
  : require('playwright');
const server = await createServer({configFile: path.resolve('vite.pages.config.ts'), server: {host:'127.0.0.1',port:0,hmr:false,forwardConsole:false}, logLevel:'error'});
await server.listen();
const browser = await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'msedge'});
try {
  for (const width of [390,820,1280,1920]) {
    const page = await browser.newPage({viewport:{width,height:1000}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/lib/piper-speech.ts*', route => route.fulfill({contentType:'text/javascript',body:`
      export function stopPiperSpeech() {}
      export function speakPiper(text, options) { window.spoken.push(text); queueMicrotask(() => options.onEnd()); }
    `}));
    await page.addInitScript(() => {
      window.spoken = [];
      localStorage.setItem('reading-profile-v1',JSON.stringify({name:'Тексты',age:'8',start:'words'}));
      localStorage.setItem('reading-steps-v3',JSON.stringify({settings:{styleChosen:true,sound:true,autoSpeech:false,layout:'order',unit:12,curriculumVersion:2},stars:0,history:[]}));
    });
    await page.goto('http://127.0.0.1:' + server.httpServer.address().port);
    await page.getByRole('heading',{name:'Все тренажёры',exact:true}).waitFor();
    const menu = page.getByRole('button',{name:'Открыть меню',exact:true});
    if (await menu.isVisible()) await menu.click();
    const section = page.locator('.app-nav-group').filter({has:page.locator('.app-nav-item',{hasText:'Тексты'})});
    await section.locator('.app-nav-item').click();
    await section.getByRole('button',{name:'Рассказы',exact:true}).click();
    await page.getByRole('button',{name:'Пишу',exact:true}).click();
    const title = await page.locator('.text-exercise h2 span').textContent();
    await page.getByRole('button',{name:'Послушать название текста',exact:true}).click();
    await page.waitForFunction(title => window.spoken.includes(title),title);
    assert.equal(await page.getByRole('button',{name:'Озвучить задание',exact:true}).count(),0,'no duplicate instruction audio');
    assert(await page.locator('.full-text-line').evaluateAll(lines => lines.every(line => line.firstElementChild.tagName === 'BUTTON')),'line audio precedes text in DOM');
    await page.getByLabel('Твоя строка',{exact:true}).fill('абвгдежз');
    await page.getByRole('button',{name:/^Проверить/}).click();
    const message = await page.locator('.spoken-feedback [role=status]').textContent();
    await page.getByRole('button',{name:'Послушать пояснение',exact:true}).click();
    await page.waitForFunction(message => window.spoken.includes(message),message);
    await page.getByRole('button',{name:'Отвечаю',exact:true}).click();
    assert(await page.locator('.text-reference p, .text-exercise h3, .answer-option').evaluateAll(rows => rows.every(row => row.firstElementChild.tagName === 'BUTTON')),'reference, question and option audio all precede text');
    const option = page.getByRole('button',{name:/^Послушать ответ:/}).first();
    const spokenBefore = await page.evaluate(() => window.spoken.length);
    await option.click();
    await page.waitForFunction(count => window.spoken.length > count,spokenBefore);
    assert.equal(await page.locator('.text-success').count(),0,'listening does not submit an answer');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),'no overflow');
    assert.deepEqual(errors,[]);
    await page.close();
    console.log(`PASS text audio placement, content and independent actions at ${width}px`);
  }
} finally { await browser.close(); await server.close(); }
