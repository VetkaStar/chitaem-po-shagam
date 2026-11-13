/** Targeted geometry check using real app, lesson handlers and isolated storage. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '.local/pilot-media-20261105');
fs.mkdirSync(output, { recursive: true });
const report = { cases: [], errors: [], failures: [], scope: 'Real free-word card opening with no manual scroll; new browser contexts; preview5184 untouched.' };
const server = await createServer({ configFile: path.join(root, 'vite.pages.config.ts'), cacheDir: path.join(output, 'card-vite-cache'), server: { host: '127.0.0.1', port: 0, hmr: false, forwardConsole: false }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  const base = 'http://127.0.0.1:' + server.httpServer.address().port;
  const { chromium } = process.env.PLAYWRIGHT_PACKAGE
    ? await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE, 'index.mjs')))
    : createRequire(import.meta.url)('playwright');
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const fixture = path.join(root, 'tests/fixtures/content-pilot.tsx').replaceAll('\\', '/');
  const html = await server.transformIndexHtml('/__pilot-card.html', `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@fs/${fixture}"></script></body></html>`);
  const quickPhone = process.argv.includes('--phone-button');
  for (const viewport of quickPhone ? [{ width: 390, height: 844 }] : [{ width: 1280, height: 720 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    page.setDefaultTimeout(12000);
    page.on('pageerror', (error) => { if (!report.errors.includes(error.stack)) report.errors.push(error.stack); });
    await page.addInitScript(() => {
      localStorage.setItem('reading-profile-v1', JSON.stringify({ name: 'Медиа QA', age: '8', start: 'syllables' }));
      localStorage.setItem('reading-steps-v3', JSON.stringify({ settings: { styleChosen: true, unit: 12, curriculumVersion: 2, sound: false, autoSpeech: false, motion: false, autoAdvance: false, textFlow: 'manual', showFullText: true, breakEvery: 0, breakMinutes: 0, interfaceScale: 100, layout: 'order', look: 'plain' }, stars: 0, history: [] }));
    });
    await page.route('**/__pilot-card.html*', (route) => route.fulfill({ contentType: 'text/html', body: html }));
    const ready = async () => {
      await page.waitForFunction(() => !document.querySelector('.free-material.is-pending,[aria-busy="true"]'));
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };
    await page.goto(base + '/__pilot-card.html');
    await page.locator('#home-trainers').waitFor();
    await ready();
    await page.locator('#home-trainers .portal-card').filter({ has: page.locator('b', { hasText: /^Слоги$/ }) }).click();
    await page.getByRole('region', { name: 'Тренажёры раздела Слоги', exact: true }).getByRole('button', { name: 'Слог', exact: true }).click();
    await ready();
    for (const { id, parts } of quickPhone ? [{ id: 'lampa', parts: ['ЛАМ', 'ПА'] }] : [{ id: 'mama', parts: ['МА', 'МА'] }, { id: 'lampa', parts: ['ЛАМ', 'ПА'] }, { id: 'krupa', parts: ['КРУ', 'ПА'] }]) {
      await page.getByLabel('Семейство слов', { exact: true }).selectOption(id);
      await ready();
      for (let index = 0; index < parts.length; index++) {
        await page.locator('summary[aria-label="Проверить вместе со взрослым"]').click();
        await page.getByRole('button', { name: 'Получилось', exact: true }).click();
        await ready();
        if (index === 0) { await page.keyboard.press('Enter'); await ready(); }
      }
      const bridge = page.getByRole('region', { name: 'Из слогов в слово' });
      for (const part of parts) { await bridge.getByRole('button', { name: part, exact: true }).and(page.locator('button:enabled')).first().click(); await ready(); }
      await page.getByRole('button', { name: /^Читать слово целиком/ }).click();
      await ready();
      assert.equal(await page.evaluate(() => window.qaPilot.model.target), parts.join(''));
      await page.getByRole('button', { name: 'Показать картинку', exact: true }).click();
      await ready();
      await page.waitForFunction(() => { const img = document.querySelector('.task-card .illustration-gallery img'); return img?.complete && img.naturalWidth > 0; });
      const geometry = await page.locator('.task-card .illustration-gallery img').evaluate((img) => {
        const rect = img.getBoundingClientRect();
        let top = Math.max(0, rect.top), bottom = Math.min(innerHeight, rect.bottom);
        const parents = [];
        for (let el = img.parentElement; el; el = el.parentElement) {
          const style = getComputedStyle(el), box = el.getBoundingClientRect();
          if (/auto|scroll|hidden|clip/.test(style.overflowY)) {
            top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom);
            parents.push({ className: el.className, height: el.clientHeight, scrollHeight: el.scrollHeight, scrollTop: el.scrollTop });
          }
        }
        const actions = document.querySelector('.task-card-actions').getBoundingClientRect();
        const coveredPoints = [];
        for (const x of [0.2, 0.5, 0.8]) for (const y of [0.2, 0.5, 0.8]) {
          const el = document.elementFromPoint(rect.left + rect.width * x, rect.top + rect.height * y);
          if (el !== img) coveredPoints.push({ x, y, tag: el?.tagName, className: el?.className });
        }
        const reading = document.querySelector('.task-card-material > .reading');
        const rb = reading?.getBoundingClientRect(), rs = reading && getComputedStyle(reading);
        const body = document.querySelector('.task-card-body').getBoundingClientRect();
        return { imageHeight: rect.height, imageWidth: rect.width, visibleHeight: Math.max(0, bottom - top), left: rect.left, right: rect.right, parents, coveredPoints,
          reading: rb ? { left: rb.left, right: rb.right, top: rb.top, bottom: rb.bottom, height: rb.height, visibleHeight: Math.max(0, Math.min(rb.bottom, body.bottom) - Math.max(rb.top, body.top)), gridColumn: rs.gridColumn, gridRow: rs.gridRow, fontSize: rs.fontSize } : null,
          actions: { top: actions.top, bottom: actions.bottom }, viewport: [innerWidth, innerHeight], documentWidth: document.documentElement.scrollWidth };
      });
      report.cases.push({ viewport, id, geometry });
      if (quickPhone) {
        const button = await page.getByRole('button', { name: 'Помоги прочитать по слогам', exact: true }).evaluate((el) => {
          const box = el.getBoundingClientRect(), parent = el.closest('.material-tools').getBoundingClientRect();
          return { left: box.left, right: box.right, height: box.height, width: box.width, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, whiteSpace: getComputedStyle(el).whiteSpace, parentLeft: parent.left, parentRight: parent.right };
        });
        report.cases.at(-1).helpButton = button;
        assert(button.left >= button.parentLeft - 1 && button.right <= button.parentRight + 1, JSON.stringify(button));
        assert(button.scrollWidth <= button.clientWidth + 1, JSON.stringify(button));
        assert.equal(button.whiteSpace, 'normal');
      }
      if (geometry.visibleHeight < geometry.imageHeight - 1) report.failures.push(`${viewport.width}/${id}: visible ${geometry.visibleHeight} of ${geometry.imageHeight}`);
      if (geometry.coveredPoints.length) report.failures.push(`${viewport.width}/${id}: image covered at ${geometry.coveredPoints.length}/9 sample points`);
      if (geometry.reading && geometry.reading.visibleHeight < geometry.reading.height - 1) report.failures.push(`${viewport.width}/${id}: reading visible ${geometry.reading.visibleHeight} of ${geometry.reading.height}`);
      if (geometry.actions.bottom > viewport.height + 1 || geometry.actions.top < 0) report.failures.push(`${viewport.width}/${id}: actions outside viewport`);
      if (geometry.right > viewport.width + 1 || geometry.left < 0 || geometry.documentWidth > viewport.width) report.failures.push(`${viewport.width}/${id}: horizontal overflow`);
      await page.screenshot({ path: path.join(output, `word-card-${id}-${viewport.width}.png`) });
      await page.getByRole('button', { name: 'Скрыть картинку', exact: true }).click();
      await ready();
    }
    await page.close();
  }
  assert.equal(report.cases.length, quickPhone ? 1 : 9);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.failures, []);
} catch (error) { report.errors.push(error.stack ?? String(error)); process.exitCode = 1; }
finally {
  await browser?.close();
  await server.close();
  fs.writeFileSync(path.join(output, process.argv.includes('--phone-button') ? 'word-card-phone-button.json' : 'word-card-browser.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ cases: report.cases.length, errors: report.errors, failures: report.failures }, null, 2));
}
