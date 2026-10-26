import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const { chromium } = process.env.PLAYWRIGHT_PACKAGE
  ? await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE, 'index.mjs')))
  : createRequire(import.meta.url)('playwright');
const server = await createServer({
  configFile: path.resolve('vite.pages.config.ts'),
  server: { host: '127.0.0.1', port: 0, hmr: false, forwardConsole: false },
  logLevel: 'error',
});
await server.listen();
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
const output = path.resolve('.local/task-card-text');
fs.mkdirSync(output, { recursive: true });
const report = [];
try {
  for (const [width, height] of [
    [1280, 800],
    [820, 1180],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.addInitScript(() => {
      localStorage.setItem(
        'reading-profile-v1',
        JSON.stringify({ name: 'Текст', age: '8', start: 'words' }),
      );
      localStorage.setItem(
        'reading-steps-v3',
        JSON.stringify({
          settings: {
            styleChosen: true,
            layout: 'order',
            sound: false,
            autoSpeech: false,
            autoAdvance: false,
            breakEvery: 0,
            breakMinutes: 0,
            unit: 12,
            curriculumVersion: 2,
          },
          stars: 0,
          history: [],
        }),
      );
    });
    await page.goto('http://127.0.0.1:' + server.httpServer.address().port);
    await page
      .getByRole('heading', { name: 'Все тренажёры', exact: true })
      .waitFor();
    const group = page
      .locator('.app-nav-group')
      .filter({ has: page.locator('.app-nav-item', { hasText: 'Тексты' }) });
    await group.locator('.app-nav-item').click();
    await group.getByRole('button', { name: 'Рассказы', exact: true }).click();
    await page.locator('.text-exercise .task-card-body').waitFor();
    const geometry = () =>
      page.locator('.text-exercise').evaluate((card) => {
        const rect = (e) => {
          const r = e.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            bottom: r.bottom,
          };
        };
        const primary = card.querySelector('.task-card-primary');
        const b = primary.getBoundingClientRect();
        return {
          card: rect(card),
          primary: rect(primary),
          visible:
            b.bottom <= innerHeight &&
            primary.contains(
              document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2),
            ),
        };
      });
    const read = await geometry();
    assert(read.visible);
    await page.getByRole('button', { name: 'Пишу', exact: true }).click();
    const before = await geometry();
    assert(before.visible);
    assert.deepEqual(before.card, read.card);
    await page.getByLabel('Твоя строка', { exact: true }).fill('абвгдежз');
    await page.getByRole('button', { name: /^Проверить/ }).click();
    const error = await geometry();
    assert(error.visible);
    assert.deepEqual(error.card, before.card);
    assert.deepEqual(error.primary, before.primary);
    // Scrolling long material must never move or cover the check button.
    await page.locator('.task-card-body').evaluate((e) => {
      e.scrollTop = e.scrollHeight;
    });
    assert.deepEqual((await geometry()).primary, before.primary);
    assert((await geometry()).visible);
    await page.screenshot({
      path: path.join(output, width + '-long-text.png'),
    });
    let lines = 0;
    while (!(await page.locator('.text-success').count()) && lines < 30) {
      const text = await page.locator('.active-line > span').textContent();
      await page
        .getByLabel('Твоя строка', { exact: true })
        .fill(text, { timeout: 3000 })
        .catch(async (e) => {
          await page.screenshot({ path: path.join(output, 'failure.png') });
          console.log(await page.locator('.text-exercise').innerText());
          console.log(
            await page
              .locator('textarea')
              .evaluateAll((es) =>
                es.map((e) => ({
                  disabled: e.disabled,
                  hidden: !e.checkVisibility(),
                  label: e.labels?.[0]?.textContent,
                })),
              ),
          );
          throw e;
        });
      await page.getByLabel('Твоя строка', { exact: true }).press('Enter');
      const next = page.getByRole('button', {
        name: /Следующая строка|Завершить/,
      });
      await next.waitFor();
      assert((await geometry()).visible);
      assert.deepEqual((await geometry()).primary, before.primary);
      await next.click();
      lines++;
      await page.waitForFunction(
        () =>
          document.querySelector('.text-success') ||
          document.querySelector('textarea')?.disabled === false,
      );
    }
    await page.locator('.text-success').waitFor();
    const done = await geometry();
    assert(done.visible);
    assert.deepEqual(done.card, before.card);
    assert.deepEqual(done.primary, before.primary);
    await page.screenshot({ path: path.join(output, width + '-done.png') });
    report.push({
      width,
      height,
      lines,
      passed: [
        'read',
        'write error',
        'scroll with fixed action',
        'Enter',
        'next line',
        'summary',
      ],
    });
    await page.close();
  }
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  await server.close();
}
console.log(JSON.stringify(report, null, 2));
