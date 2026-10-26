import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_PACKAGE
  ? await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE, 'index.mjs')))
  : require('playwright');
const server = await createServer({configFile:path.resolve('vite.pages.config.ts'),server:{host:'127.0.0.1',port:0,hmr:false,forwardConsole:false},logLevel:'error'});
await server.listen();
const browser = await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'msedge'});
try {
  for (const width of [390,820,1280,1920]) {
    const page = await browser.newPage({viewport:{width,height:844}});
    const errors = [];
    page.on('pageerror',error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('reading-profile-v1',JSON.stringify({name:'Игры',age:'8',start:'letters'}));
      localStorage.setItem('reading-steps-v3',JSON.stringify({settings:{styleChosen:true,sound:true,autoSpeech:false,layout:'order',motion:false},stars:0,history:[]}));
    });
    await page.goto('http://127.0.0.1:' + server.httpServer.address().port);
    await page.getByRole('heading',{name:'Все тренажёры',exact:true}).waitFor();
    const menu = page.getByRole('button',{name:'Открыть меню',exact:true});
    if (await menu.isVisible()) await menu.click();
    await page.getByRole('button',{name:'Разминка',exact:true}).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button',{name:/Размяться/}).click();
    const initial = await dialog.locator('.movement h3').textContent();
    await dialog.getByRole('button',{name:'Другое движение →',exact:true}).click();
    assert.notEqual(await dialog.locator('.movement h3').textContent(),initial);
    await dialog.getByRole('button',{name:'← Другой отдых',exact:true}).click();
    await dialog.getByRole('button',{name:/Пузырьки/}).click();
    const color = await dialog.locator('.color-swatch').getAttribute('data-color');
    await dialog.locator(`.color-bubble[data-color="${color}"]`).first().click();
    assert.equal(await dialog.locator('.bubble-popped').count(),1);
    await dialog.getByRole('button',{name:'← Другой отдых',exact:true}).click();
    await dialog.getByRole('button',{name:/Найди пару/}).click();
    await dialog.getByRole('combobox',{name:/^Игра/}).selectOption('visible');
    const name = await dialog.locator('.pair-grid button').first().getAttribute('aria-label');
    const match = dialog.getByRole('button',{name,exact:true});
    await match.nth(0).click();
    await match.nth(1).click();
    await page.waitForFunction(() => document.querySelectorAll('.pair-grid .paired').length === 2);
    await dialog.getByRole('button',{name:'← Другой отдых',exact:true}).click();
    await dialog.getByRole('button',{name:/Музыкальная полянка/}).click();
    await dialog.getByRole('button',{name:'Нота 1',exact:true}).click();
    await dialog.getByRole('button',{name:'▶ Послушать мелодию',exact:true}).click();
    await dialog.getByRole('button',{name:'■ Остановить мелодию',exact:true}).click();
    await page.waitForFunction(() => document.querySelectorAll('.note-on').length === 0);
    assert(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1),'dialog must not overflow');
    await dialog.getByRole('button',{name:'Вернуться назад →',exact:true}).click();
    await page.getByRole('heading',{name:'Все тренажёры',exact:true}).waitFor();
    await dialog.waitFor({state:'hidden'});
    assert.deepEqual(errors,[]);
    await page.close();
    console.log(`PASS four rest activities and return at ${width}px`);
  }
} finally { await browser.close(); await server.close(); }
