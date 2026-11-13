import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const catfish = process.env.STORY_CATFISH === '1';
const { chromium } = await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE, 'index.mjs')));
const server = await createServer({ configFile: path.join(root, 'vite.pages.config.ts'), server: { host: '127.0.0.1', port: 0, hmr: false, forwardConsole: false }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  const base = 'http://127.0.0.1:' + server.httpServer.address().port;
  const fixture = path.join(root, 'tests/fixtures/content-pilot.tsx').replaceAll('\\', '/');
  const service = path.join(root, 'features/free-practice/service.ts').replaceAll('\\', '/');
  const html = await server.transformIndexHtml('/__echo.html', `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@fs/${fixture}"></script></body></html>`);
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const width = Number(process.env.ECHO_WIDTH || 390), height = width === 390 ? 844 : 720;
  const p = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
  p.setDefaultTimeout(10000);
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript((unit) => {
    localStorage.setItem('reading-profile-v1', JSON.stringify({ name: 'Проверка', age: '8', start: 'syllables' }));
    localStorage.setItem('reading-steps-v3', JSON.stringify({ settings: { styleChosen: true, unit, curriculumVersion: 2, sound: false, autoSpeech: false, motion: false, autoAdvance: false, textFlow: 'manual', showFullText: true, breakEvery: 0, breakMinutes: 0, interfaceScale: 100, layout: 'order', look: 'plain' }, stars: 0, history: [] }));
  }, catfish ? 12 : 0);
  await p.route('**/__echo.html', r => r.fulfill({ contentType: 'text/html', body: html }));
  await p.route(/\/features\/free-practice\/service\.(?:js|ts)(?:\?.*)?$/, r => r.request().url().includes('qa-real=1') ? r.continue() : r.fulfill({ contentType: 'text/javascript', body: `import {recordFreeExposure as record,waitForFreeExposure as wait} from '/@fs/${service}?qa-real=1'; export async function recordFreeExposure(input){const q=window.qaPilot;q.requested.push(input);if(q.hold)await new Promise(resolve=>q.waiters.push(resolve));await record(input);q.committed.push(input);} export async function waitForFreeExposure(){await wait();}` }));
  const ready = async () => { await p.waitForFunction(() => !document.querySelector('.free-material.is-pending,.retained-text-frame[aria-busy="true"]')); await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };
  await p.goto(base + '/__echo.html'); await p.waitForFunction(() => window.qaPilot?.model?.ready); await ready();
  await p.locator('.portal-grid').getByRole('button', { name: /ШАГ 6 Тексты/ }).click();
  await p.locator('.portal-grid').getByRole('button', { name: 'Рассказы', exact: true }).click(); await ready();
  await p.locator('summary').filter({ hasText: 'Выбрать текст' }).click();
  await p.locator(`[data-text-id="${catfish ? 'pilot-story-catfish-v1' : 'topic-story-echo'}"]`).click(); await ready();
  const picker = p.locator('details.practice-menu').filter({ has: p.locator('summary', { hasText: 'Выбрать текст' }) });
  if (await picker.evaluate(el => el.open)) await picker.locator('summary').click();
  const picture = p.locator('.text-illustration');
  assert.equal(await picture.locator('img').count(), 0, 'picture hidden initially');
  await p.evaluate(() => { window.qaPilot.hold = true; window.qaPilot.requested = []; window.qaPilot.committed = []; });
  await picture.locator('summary').click();
  await p.waitForFunction(() => window.qaPilot.requested.some(x => x.promptedTexts?.length));
  assert.equal(await picture.locator('img').count(), 0, 'image hidden before help exposure is saved');
  await p.evaluate(() => window.qaPilot.release()); await ready();
  const img = picture.locator('img'); await img.waitFor({ state: 'visible' });
  assert.match(await img.getAttribute('src'), catfish ? /story-catfish\.webp/ : /word-01-main\.webp/);
  assert((await p.evaluate(() => window.qaPilot.committed)).some(x => x.promptedTexts?.some(t => t.toLocaleLowerCase('ru').includes(catfish ? 'сом' : 'мама'))));
  if (!catfish) {
    await picture.getByRole('button', { name: 'Посмотреть другую картинку' }).click();
    assert.match(await img.getAttribute('src'), /word-01-alternate\.webp/);
  }
  const geometry = await img.evaluate(el => {
    const r=el.getBoundingClientRect(), style=getComputedStyle(el);
    const scale=style.objectFit==='contain' ? Math.min(r.width/el.naturalWidth,r.height/el.naturalHeight) : Math.max(r.width/el.naturalWidth,r.height/el.naturalHeight);
    const paintedWidth=el.naturalWidth*scale, paintedHeight=el.naturalHeight*scale;
    const imageTop=r.top+(r.height-paintedHeight)/2, imageLeft=r.left+(r.width-paintedWidth)/2;
    let top=Math.max(0,imageTop), bottom=Math.min(innerHeight,imageTop+paintedHeight);
    let left=Math.max(0,imageLeft), right=Math.min(innerWidth,imageLeft+paintedWidth);
    for(let parent=el.parentElement;parent;parent=parent.parentElement){
      const s=getComputedStyle(parent), box=parent.getBoundingClientRect();
      if(/auto|scroll|hidden|clip/.test(s.overflowY)){top=Math.max(top,box.top);bottom=Math.min(bottom,box.bottom);}
      if(/auto|scroll|hidden|clip/.test(s.overflowX)){left=Math.max(left,box.left);right=Math.min(right,box.right);}
    }
    return {width:r.width,height:r.height,paintedWidth,paintedHeight,visibleWidth:Math.max(0,right-left),visibleHeight:Math.max(0,bottom-top)};
  });
  fs.mkdirSync(path.join(root, '.local/echo-illustration'), { recursive: true });
  await p.screenshot({path:path.join(root, `.local/echo-illustration/${catfish ? 'catfish' : 'echo'}-${width}.png`)});
  assert(geometry.width >= 80 && geometry.height >= 80, 'illustration must retain a usable area, including square images with navigation');
  {
    const isLandscape = geometry.paintedWidth / geometry.paintedHeight > 1.3;
    const minimumHeight = width <= 390 ? (isLandscape ? 90 : 112) : 180;
    assert(geometry.paintedHeight >= minimumHeight, `image too small: ${JSON.stringify(geometry)}`);
    assert(geometry.visibleHeight >= geometry.paintedHeight - 1 && geometry.visibleWidth >= geometry.paintedWidth - 1, `image clipped: ${JSON.stringify(geometry)}`);
    const overlap = await p.evaluate(() => {
      const image = document.querySelector('.text-illustration img').getBoundingClientRect();
      const viewport = document.querySelector('.text-reading-viewport');
      const walker = document.createTreeWalker(viewport, NodeFilter.SHOW_TEXT);
      let node; const clashes=[];
      while ((node=walker.nextNode())) {
        if (!node.textContent.trim() || !node.parentElement.checkVisibility()) continue;
        const range=document.createRange(); range.selectNodeContents(node);
        for (const r of range.getClientRects()) if (r.width && r.height && r.left < image.right && r.right > image.left && r.top < image.bottom && r.bottom > image.top) clashes.push(node.textContent.trim());
      }
      return clashes;
    });
    assert.deepEqual(overlap, [], 'illustration must not overlap text glyphs');
  }
  await p.evaluate(() => window.qaPilot.durable());
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status:'PASS', width, geometry, exposure:'saved before image', variants:catfish ? 1 : 2 }));
} finally { await browser?.close(); await server.close(); }
