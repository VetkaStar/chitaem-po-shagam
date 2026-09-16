import assert from 'node:assert/strict';
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
  server: { host: '127.0.0.1', port: 0, hmr: false, forwardConsole: false },
  logLevel: 'error',
});
await server.listen();
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL || 'msedge',
});
try {
  for (const [width, height] of [
    [390, 844],
    [1920, 1080],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem(
        'reading-profile-v1',
        JSON.stringify({ name: 'Проверка', age: '8', start: 'words' }),
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
    });
    await page.goto('http://127.0.0.1:' + server.httpServer.address().port);
    await page
      .getByRole('heading', { name: 'Все тренажёры', exact: true })
      .waitFor();
    const openMenu = page.getByRole('button', {
      name: 'Открыть меню',
      exact: true,
    });
    if (await openMenu.isVisible()) await openMenu.click();
    const section = page
      .locator('.app-nav-group')
      .filter({
        has: page.locator('.app-nav-item', { hasText: 'Предложения' }),
      });
    await section.locator('.app-nav-item').click();
    await section
      .getByRole('button', { name: 'Предложение', exact: true })
      .click();
    await page.getByRole('button', { name: 'Отвечаю', exact: true }).click();
    await page
      .getByRole('button', { name: 'Дополнительные вопросы', exact: true })
      .waitFor();
    const title = await page.locator('.text-exercise h2').textContent();
    const options = await page
      .locator('.text-exercise .text-options button')
      .allTextContents();
    assert.ok(
      options.length >= 2,
      'Legacy comprehension choices remain available',
    );
    await page
      .getByRole('button', { name: 'Дополнительные вопросы', exact: true })
      .click();
    await page.locator('.answer-exercise').waitFor();
    assert.equal(await page.locator('.text-exercise').count(), 0);
    assert.equal(
      await page.getByRole('group', { name: 'Режим работы с текстом' }).count(),
      1,
    );
    await page
      .getByRole('button', { name: 'Вопросы к тексту', exact: true })
      .click();
    await page.locator('.text-exercise').waitFor();
    assert.equal(await page.locator('.text-exercise h2').textContent(), title);
    assert.deepEqual(
      await page
        .locator('.text-exercise .text-options button')
        .allTextContents(),
      options,
    );
    for (const option of options) {
      if (
        await page
          .getByRole('button', { name: 'Следующий текст', exact: false })
          .isVisible()
      )
        break;
      await page
        .locator('.text-exercise .text-options')
        .getByRole('button', { name: option, exact: true })
        .click();
      await page.waitForTimeout(150);
    }
    await page
      .getByRole('button', { name: 'Следующий текст', exact: false })
      .waitFor();
    await page
      .getByRole('button', { name: 'Дополнительные вопросы', exact: true })
      .click();
    await page.locator('.answer-exercise').waitFor();
    await page
      .getByRole('button', { name: 'Вопросы к тексту', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Следующий текст', exact: false })
      .waitFor();
    await page
      .getByRole('button', { name: 'Дополнительные вопросы', exact: true })
      .click();
    await page.locator('.answer-exercise').waitFor();
    await page.getByRole('button', { name: 'Пишу', exact: true }).click();
    await page.locator('.text-exercise textarea').waitFor();
    assert.equal(await page.locator('.answer-exercise').count(), 0);
    assert.equal(await page.locator('.text-exercise h2').textContent(), title);
    await page.getByRole('button', { name: 'Отвечаю', exact: true }).click();
    assert.equal(
      await page
        .getByRole('button', { name: 'Вопросы к тексту', exact: true })
        .getAttribute('aria-pressed'),
      'true',
    );
    assert.deepEqual(errors, []);
    await page.close();
    console.log(
      `PASS sentence questions preserve legacy source and modes ${width}x${height}`,
    );
  }
} finally {
  await browser.close();
  await server.close();
}
