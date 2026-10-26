import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_PACKAGE
  ? await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE, 'index.mjs')))
  : require('playwright');
const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '.local/release-review/visual');
fs.mkdirSync(output, { recursive: true });
const server = await createServer({ configFile: path.join(root, 'vite.pages.config.ts'),
  server: { host: '127.0.0.1', port: 0, hmr: false, forwardConsole: false }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const bank = JSON.parse(fs.readFileSync(path.join(root, 'content/curriculum/curriculum.json'), 'utf8'));
const errors = [], cases = [];
let browser;
async function seed(page, settings = {}) {
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript((settings) => {
    if (localStorage.getItem('review-seeded')) return;
    localStorage.setItem('reading-profile-v1', JSON.stringify({ name: 'Ревизия', age: '8', start: 'letters' }));
    localStorage.setItem('reading-steps-v3', JSON.stringify({ settings: {
      styleChosen: true, sound: false, unit: 0, length: 3, curriculumVersion: 2, motion: false, ...settings,
    }, stars: 3, history: [] }));
    localStorage.setItem('review-seeded', 'yes');
  }, settings);
  await page.goto(base);
  await page.getByRole('heading', { name: 'Привет, Ревизия!' }).waitFor();
}
async function state(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('reading-platform-v1');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction('state').objectStore('state').get('local');
      read.onsuccess = () => { resolve(read.result); db.close(); };
      read.onerror = () => { reject(read.error); db.close(); };
    };
  }));
}
async function home(page) {
  await page.locator('.app-brand').click();
  await page.getByRole('heading', { name: 'Привет, Ревизия!' }).waitFor();
}
async function capture(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
  const metrics = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
    broken: [...document.images].filter((img) => img.complete && !img.naturalWidth).map((img) => img.src),
    panel: (() => { const el = document.querySelector('.portal-panel, .entry08-card, .curriculum-step');
      if (!el) return null; const css = getComputedStyle(el); return {background: css.backgroundColor, image: css.backgroundImage, border: css.borderColor}; })() }));
  assert(metrics.scroll <= metrics.width + 1, `${name}: horizontal overflow ${metrics.scroll}/${metrics.width}`);
  assert.deepEqual(metrics.broken, [], name);
  cases.push({ name, ...metrics });
  return metrics;
}
try {
  browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  const page = await browser.newPage({ viewport: {width: 1440, height: 1000} });
  await seed(page);
  await page.getByRole('button', {name: 'Начать занятие →', exact: true}).click();
  await page.getByRole('tab', {name: 'Пишу', exact: true}).click();
  await page.goBack();
  await page.waitForFunction(() => document.querySelector('[role=tab][aria-selected=true]')?.textContent?.includes('Читаю'));
  await page.goBack();
  await page.getByRole('heading', {name: 'Привет, Ревизия!'}).waitFor();
  await page.goForward();
  await page.locator('.exercise').waitFor();
  const y = await page.locator('.task-card-actions').evaluate((el) => el.getBoundingClientRect().y);
  await page.getByRole('button', {name: 'Подсказка', exact: true}).click();
  const nextY = await page.locator('.task-card-actions').evaluate((el) => el.getBoundingClientRect().y);
  assert(Math.abs(y - nextY) < 2, `hint moved actions by ${nextY - y}`);
  await page.getByRole('tab', {name: 'Отвечаю', exact: true}).click();
  await page.locator('.empty-topic').waitFor();
  await page.locator('.empty-topic button').first().click();
  await page.locator('.answer-exercise').waitFor();
  const before = await state(page), task = bank.items[before.profile.activeInstance.itemId];
  const wrong = task.options.find((option) => !task.answer.correctOptionIds.includes(option.id));
  await page.getByRole('button', {name: wrong.text, exact: true}).click();
  await page.getByRole('button', {name: 'Ответить', exact: true}).click();
  await page.getByRole('button', {name: 'Попробовать ещё раз · Enter', exact: true}).click();
  await page.locator('.answer-exercise').waitFor();
  assert.equal((await state(page)).profile.activeInstance.itemId, task.id);
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', {name: 'Пропустить', exact: true}).click();
    await page.locator('.answer-result button.primary').waitFor();
    if (await page.getByRole('button', {name: 'Ещё занятие', exact: true}).count()) break;
    await page.getByRole('button', {name: 'Дальше · Enter', exact: true}).click();
  }
  await page.locator('.session-results').waitFor();
  assert.match(await page.locator('.session-results').innerText(), /Выполнено: 0/);
  assert.equal(await page.getByText('Все задания пройдены', {exact: true}).count(), 0);
  cases.push({ name: 'history-back-forward, stable-hint, empty-topic, wrong-answer-retry, skipped-summary' });
  await home(page);
  await page.getByRole('button', {name: 'Учебные программы', exact: true}).click();
  await page.getByRole('heading', {name: 'Выбери свой путь'}).waitFor();
  for (const program of bank.programs) {
    await page.getByRole('button', {name: new RegExp(program.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))}).click();
    await page.getByRole('region', {name: 'Учебная программа', exact: true}).waitFor();
    assert.equal((await state(page)).profile.currentProgramId, program.id);
    const begin = page.getByRole('button', {name: 'Начать занятие', exact: true});
    if (await begin.count()) await begin.click();
    else if (await page.getByRole('button', {name:'Дальше', exact:true}).count()) await page.getByRole('button', {name:'Дальше',exact:true}).click();
    await page.locator('.curriculum-step').waitFor();
    await page.getByRole('button', {name: 'К выбору программы', exact: true}).click();
    await page.getByRole('heading', {name: 'Выбери свой путь'}).waitFor();
    cases.push({name:`program ${program.id}: selected, launched, returned`});
  }
  await page.getByRole('button',{name:'Результаты учебных программ',exact:true}).click();
  await page.getByRole('heading',{name:'Результаты учебных программ',exact:true}).waitFor();
  await page.getByRole('heading',{name:'Ближайшие цели',exact:true}).waitFor();
  await page.getByRole('button',{name:'К выбору программы',exact:true}).click();
  await page.getByRole('heading',{name:'Выбери свой путь'}).waitFor();
  cases.push({name:'authored program results reachable from catalog'});
  await page.close();
  for (const layout of ['order', 'focus']) for (const [look, paper] of [['plain','main'],['notebook','main'],['notebook','blue']]) {
    for (const [width, height, interfaceScale] of [[390,844,100],[820,1180,100],[1280,720,100],[1920,1080,100],[1920,1080,120]]) {
      const p = await browser.newPage({viewport:{width, height}, reducedMotion:'reduce'});
      await seed(p, {layout, look, paper, interfaceScale});
      const name = `${layout}-${look}-${paper}-${width}-${interfaceScale}`;
      const first = await capture(p, `${name}-home`);
      if (look === 'notebook') assert.notEqual(first.panel.image, 'none');
      if (width < 700) {
        await p.getByRole('button', {name:'Открыть меню',exact:true}).click();
        await p.locator('.app-nav-account').getByRole('button', {name:'Мой кабинет',exact:true}).click();
      } else await p.locator('.app-bar').getByRole('button', {name:'Мой кабинет',exact:true}).click();
      await p.getByRole('heading', {name:'Ревизия, это твоё место'}).waitFor();
      assert.match(await p.locator('.star-total').innerText(), /3 звезды/);
      const cabinet = await capture(p, `${name}-cabinet`);
      assert.deepEqual(cabinet.panel, first.panel);
      await home(p);
      await p.getByRole('button',{name:'Учебные программы',exact:true}).click();
      await p.getByRole('heading',{name:'Выбери свой путь'}).waitFor();
      const catalog = await capture(p, `${name}-catalog`);
      assert.deepEqual(catalog.panel, first.panel);
      if (width === 820 && layout === 'order') {
        const clipped = await p.locator('.app-nav-item, .app-nav-extra button').evaluateAll((buttons) => buttons.filter((b) => {const r=b.getBoundingClientRect();return r.left<0 || r.right>innerWidth;}).length);
        assert.equal(clipped,0,'tablet navigation must be entirely visible');
      }
      await p.close();
    }
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({cases,errors}, null, 2));
  console.log(`PASS release review: ${cases.length} scenarios; no page errors`);
} finally { await browser?.close(); await server.close(); }
