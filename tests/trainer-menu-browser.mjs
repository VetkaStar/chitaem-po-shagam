/** Real application section menus preserve navigation state at all target widths. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_PACKAGE
  ? await import(
      pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE, 'index.mjs'))
    )
  : require('playwright');
const server = await createServer({
  configFile: path.join(root, 'vite.pages.config.ts'),
  server: {
    host: '127.0.0.1',
    port: 0,
    hmr: false,
    forwardConsole: false,
    fs: { allow: [root] },
  },
  logLevel: 'error',
});
await server.listen();
const base = 'http://127.0.0.1:' + server.httpServer.address().port;
const output = path.join(root, '.local/trainer-menu-browser');
fs.mkdirSync(output, { recursive: true });
let browser;
const completed = [];
try {
  browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || 'msedge',
  });
  for (const [width, height] of [
    [390, 844],
    [820, 1180],
    [1920, 1080],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      if (!localStorage.getItem('reading-profile-v1')) {
        localStorage.setItem(
          'reading-profile-v1',
          JSON.stringify({ name: 'Меню', age: '8', start: 'words' }),
        );
        localStorage.setItem(
          'reading-steps-v3',
          JSON.stringify({
            settings: { styleChosen: true, sound: false, layout: 'order' },
            stars: 37,
            history: [],
          }),
        );
      }
    });
    await page.goto(base);
    await page
      .getByRole('heading', { name: 'Все тренажёры', exact: true })
      .waitFor();
    const openMenu = async () => {
      const button = page.getByRole('button', {
        name: 'Открыть меню',
        exact: true,
      });
      if (
        (await button.isVisible()) &&
        (await page.locator('.app-nav').getAttribute('data-open')) === null
      )
        await button.click();
    };
    const closeMenu = async () => {
      if ((await page.locator('.app-nav').getAttribute('data-open')) !== null)
        await page.locator('.app-nav-close').click();
    };
    await openMenu();
    assert.equal(await page.locator('.app-nav-item').count(), 7);
    assert.equal(
      await page.locator('.app-nav-submenu:not([hidden])').count(),
      0,
    );
    const words = page
      .locator('.app-nav-group')
      .filter({ has: page.locator('.app-nav-item', { hasText: 'Слова' }) });
    const contentTop = (await page.locator('.app-content').boundingBox()).y;
    await words.locator('.app-nav-item').click();
    if (width === 820) {
      assert.equal((await page.locator('.app-content').boundingBox()).y, contentTop,
        'tablet submenu must not shift the content');
      await page.keyboard.press('Escape');
      assert.equal(await words.locator('.app-nav-item').getAttribute('aria-expanded'), 'false');
      await words.locator('.app-nav-item').click();
      await page.mouse.click(5, 5);
      assert.equal(await words.locator('.app-nav-item').getAttribute('aria-expanded'), 'false');
      await words.locator('.app-nav-item').click();
    }
    assert.equal(
      await words.locator('.app-nav-item').getAttribute('aria-expanded'),
      'true',
    );
    assert.equal(await page.locator('.exercise').count(), 0);
    await page
      .getByRole('heading', { name: 'Все тренажёры', exact: true })
      .waitFor();
    assert.deepEqual(
      (await words.locator('.app-nav-child').allTextContents()).slice(0, 8),
      [
        'Собираем слова',
        'Находим часть',
        'Читаю',
        'Ловлю',
        'Пишу',
        'Отвечаю',
        'Делим на части',
        'Меняем слово',
      ],
    );
    await words.locator('.app-nav-item').click();
    assert.equal(
      await words.locator('.app-nav-item').getAttribute('aria-expanded'),
      'false',
    );
    await words.locator('.app-nav-item').click();
    await page.screenshot({
      path: path.join(output, width + '-menu.png'),
      fullPage: true,
    });
    for (const title of ['Читаю', 'Ловлю', 'Пишу']) {
      await openMenu();
      if (
        (await words.locator('.app-nav-item').getAttribute('aria-expanded')) !==
        'true'
      )
        await words.locator('.app-nav-item').click();
      await words.getByRole('button', { name: title, exact: true }).click();
      await page.getByRole('tab', { name: title, exact: true }).waitFor();
      assert.equal(
        await page
          .getByRole('tab', { name: title, exact: true })
          .getAttribute('aria-selected'),
        'true',
      );
      assert.equal(
        await words
          .getByRole('button', {
            name: title,
            exact: true,
            includeHidden: true,
          })
          .getAttribute('aria-current'),
        'page',
      );
      assert.equal(
        await words.locator('.app-nav-item').getAttribute('aria-current'),
        'step',
      );
      assert.equal(
        await page.locator('.app-nav').getAttribute('data-open'),
        null,
      );
    }
    await openMenu();
    await words
      .getByRole('button', { name: 'Собираем слова', exact: true })
      .click();
    await page.getByText('Доступно заданий: 63.', { exact: false }).waitFor();
    assert.equal(
      await page.locator('.app-nav').getAttribute('data-open'),
      null,
    );
    await page
      .getByRole('button', { name: 'Начать занятие', exact: true })
      .click();
    await page.locator('.curriculum-step').waitFor();
    await page
      .getByRole('button', { name: 'К разделу «Слова»', exact: true })
      .click();
    await page.getByRole('heading', { name: 'Слова', exact: true }).waitFor();
    await page
      .locator('.portal-grid')
      .getByRole('button', { name: 'Собираем слова', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Продолжить занятие', exact: true })
      .waitFor();
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('reading-steps-v3')),
    );
    assert.equal(saved.stars, 37);
    await closeMenu();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      width + ' overflow',
    );
    await page.screenshot({
      path: path.join(output, width + '-resume.png'),
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    completed.push(
      width +
        ': seven groups, toggle only, ordered children, three legacy modes, compose pool 63, resume/data/current and no overflow',
    );
    await page.close();
  }
  const report = { date: new Date().toISOString(), completed };
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  await server.close();
}
