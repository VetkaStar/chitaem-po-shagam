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
            settings: {
              styleChosen: true,
              sound: false,
              layout: 'order',
              unit: 12,
            },
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
      assert.equal(
        (await page.locator('.app-content').boundingBox()).y,
        contentTop,
        'tablet submenu must not shift the content',
      );
      await page.keyboard.press('Escape');
      assert.equal(
        await words.locator('.app-nav-item').getAttribute('aria-expanded'),
        'false',
      );
      await words.locator('.app-nav-item').click();
      await page.mouse.click(5, 5);
      assert.equal(
        await words.locator('.app-nav-item').getAttribute('aria-expanded'),
        'false',
      );
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
    assert.deepEqual(await words.locator('.app-nav-child').allTextContents(), [
      'Целое слово',
      'Состав слова',
      'Читаем и понимаем',
    ]);
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
    await words
      .getByRole('button', { name: 'Целое слово', exact: true })
      .click();
    for (const title of ['Читаю', 'Ловлю', 'Пишу', 'Отвечаю']) {
      await page.getByRole('tab', { name: title, exact: true }).click();
      await openMenu();
      if (
        (await words.locator('.app-nav-item').getAttribute('aria-expanded')) !==
        'true'
      )
        await words.locator('.app-nav-item').click();
      await words
        .getByRole('button', { name: 'Целое слово', exact: true })
        .click();
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
            name: 'Целое слово',
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
    if (
      (await words.locator('.app-nav-item').getAttribute('aria-expanded')) !==
      'true'
    )
      await words.locator('.app-nav-item').click();
    await words
      .getByRole('button', { name: 'Состав слова', exact: true })
      .click();
    assert.deepEqual(
      (await page.getByRole('tab').allTextContents()).map((text) =>
        text.trim(),
      ),
      ['Собираем', 'Находим часть', 'Делим на части', 'Меняем'],
    );
    await page.locator('.trainer-exercise').waitFor();
    assert.equal(
      await page.locator('.app-nav').getAttribute('data-open'),
      null,
    );

    await page.locator('.trainer-material').waitFor();
    const material = await page.locator('.trainer-material').innerText();
    for (const mode of ['Находим часть', 'Делим на части', 'Меняем']) {
      await page.getByRole('tab', { name: mode, exact: true }).click();
      await page.locator('.trainer-exercise').waitFor();
      assert.equal(
        await page
          .getByRole('button', { name: 'Продолжить занятие', exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByRole('tab', { name: mode, exact: true })
          .getAttribute('aria-selected'),
        'true',
      );
      assert.equal(
        await words
          .getByRole('button', {
            name: 'Состав слова',
            exact: true,
            includeHidden: true,
          })
          .getAttribute('aria-current'),
        'page',
      );
    }
    await page.getByRole('tab', { name: 'Собираем', exact: true }).click();
    await page.locator('.trainer-material').waitFor();
    assert.equal(await page.locator('.trainer-material').innerText(), material);
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
    for (const [section, trainer, modes] of [
      ['Слоги', 'Состав слога', ['Собираем', 'Находим часть']],
      ['Предложения', 'Состав предложения', ['Находим часть']],
      ['Рассказы', 'Состав текста', ['Находим часть']],
    ]) {
      await openMenu();
      const group = page
        .locator('.app-nav-group')
        .filter({ has: page.locator('.app-nav-item', { hasText: section }) });
      if (
        (await group.locator('.app-nav-item').getAttribute('aria-expanded')) !==
        'true'
      )
        await group.locator('.app-nav-item').click();
      await group.getByRole('button', { name: trainer, exact: true }).click();
      await page.getByRole('heading', { name: trainer, exact: true }).waitFor();
      assert.deepEqual(
        (await page.getByRole('tab').allTextContents()).map((text) =>
          text.trim(),
        ),
        modes,
      );
      await page.locator('.trainer-exercise').waitFor();
    }
    for (const name of ['Буквы', 'Картинки', 'Стихи']) {
      await openMenu();
      const group = page
        .locator('.app-nav-group')
        .filter({ has: page.locator('.app-nav-item', { hasText: name }) });
      const link = group.locator('.app-nav-item');
      assert.equal(await link.getAttribute('aria-expanded'), null);
      assert.equal(await link.getAttribute('aria-controls'), null);
      assert.equal(
        await group.locator('.app-nav-chevron, .app-nav-submenu').count(),
        0,
      );
      await link.click();
      assert.equal(await link.getAttribute('aria-current'), 'page');
      assert.equal(
        await page.locator('.app-nav').getAttribute('data-open'),
        null,
      );
      await page.locator('.lesson h1').waitFor();
      assert.equal(await page.locator('.portal-grid').count(), 0);
    }
    assert.deepEqual(errors, []);
    completed.push(
      width +
        ': seven sections, three word trainers, core four modes, parts four modes with direct entry and resume, other groups modes, saved stars and no overflow',
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
