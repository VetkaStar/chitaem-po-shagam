import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const root = path.resolve(import.meta.dirname, '..');
const { chromium } = process.env.PLAYWRIGHT_PACKAGE
  ? await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE, 'index.mjs')))
  : createRequire(import.meta.url)('playwright');
const output = path.join(root, '.local/task-card-implementation');
fs.mkdirSync(output, { recursive: true });
const server = await createServer({
  configFile: path.join(root, 'vite.pages.config.ts'),
  server: { host: '127.0.0.1', port: 0, hmr: false, forwardConsole: false },
  logLevel: 'error',
});
await server.listen();
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
const reports = [];
try {
  for (const [width, height, layout, look, scale] of [
    [1280, 800, 'order', 'plain', 100],
    [1366, 768, 'order', 'plain', 100],
    [820, 1180, 'order', 'plain', 100],
    [1024, 768, 'order', 'plain', 100],
    [1180, 820, 'order', 'notebook', 100],
    [1280, 800, 'focus', 'notebook', 100],
    [1920, 1080, 'order', 'plain', 120],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(
      ({ layout, look, scale }) => {
        localStorage.setItem(
          'reading-profile-v1',
          JSON.stringify({ name: 'Карточка', age: '8', start: 'syllables' }),
        );
        localStorage.setItem(
          'reading-steps-v3',
          JSON.stringify({
            settings: {
              styleChosen: true,
              layout,
              look,
              interfaceScale: scale,
              sound: false,
              autoSpeech: false,
              autoAdvance: false,
              unit: 12,
              curriculumVersion: 2,
              length: 3,
              breakEvery: 0,
              breakMinutes: 0,
            },
            stars: 0,
            history: [],
          }),
        );
      },
      { layout, look, scale },
    );
    await page.goto('http://127.0.0.1:' + server.httpServer.address().port);
    await page
      .getByRole('heading', { name: 'Все тренажёры', exact: true })
      .waitFor();
    async function navigate(title) {
      if (layout === 'focus') {
        await page
          .locator('.portal-card')
          .filter({ has: page.locator('b', { hasText: /^Слоги$/ }) })
          .click();
        await page.getByRole('button', { name: title, exact: true }).click();
        await page.locator('.task-card-body').waitFor();
        return;
      }
      const menu = page.getByRole('button', {
        name: 'Открыть меню',
        exact: true,
      });
      if (
        (await menu.isVisible()) &&
        (await page.locator('.app-nav').getAttribute('data-open')) === null
      )
        await menu.click();
      const group = page
        .locator('.app-nav-group')
        .filter({ has: page.locator('.app-nav-item', { hasText: 'Слоги' }) });
      if (
        (await group.locator('.app-nav-item').getAttribute('aria-expanded')) !==
        'true'
      )
        await group.locator('.app-nav-item').click();
      await group.getByRole('button', { name: title, exact: true }).click();
      await page.locator('.task-card').waitFor();
      await page.waitForFunction(
        () => !document.querySelector('.task-card')?.closest('[inert]'),
      );
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    async function measure(name) {
      await page.locator('.task-card-body').waitFor();
      await page.evaluate(() => document.fonts.ready);
      const value = await page.locator('.task-card').evaluate((card) => {
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
        const body = card.querySelector('.task-card-body');
        const buttons = [
          ...card.querySelectorAll(
            '.task-card-actions button, .task-card-primary, .next-exercise-button, .curriculum-answer-form > button[type=submit]',
          ),
        ].filter((e) => e.checkVisibility());
        return {
          card: rect(card),
          body: body && {
            ...rect(body),
            scroll: body.scrollHeight - body.clientHeight,
          },
          buttons: buttons.map((e) => ({
            text: e.textContent,
            ...rect(e),
            hit: (() => {
              const r = e.getBoundingClientRect();
              return e.contains(
                document.elementFromPoint(
                  r.x + r.width / 2,
                  r.y + r.height / 2,
                ),
              );
            })(),
          })),
          horizontal: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      reports.push({ width, height, layout, look, scale, name, ...value });
      await page.screenshot({
        path: path.join(
          output,
          `${width}-${height}-${layout}-${look}-${name}.png`,
        ),
      });
      assert.equal(value.horizontal, false, 'horizontal overflow');
      for (const button of value.buttons)
        assert(
          button.y >= 0 && button.bottom <= height && button.hit,
          `${name}: action not visible ${JSON.stringify(button)}`,
        );
      return value;
    }
    await navigate('Слог');
    const baseline = await measure('read');
    await page.locator('.adult-check summary').click();
    const adult = await measure('adult');
    assert.deepEqual(adult.card, baseline.card, 'adult panel changes frame');
    await page.locator('.adult-check summary').click();
    await page.getByRole('button', { name: 'Подсказка', exact: true }).click();
    const hint = await measure('hint');
    assert.deepEqual(hint.card, baseline.card, 'hint changes frame');
    await page
      .getByRole('button', { name: 'Скрыть подсказку', exact: true })
      .click();
    await page.getByRole('tab', { name: 'Пишу', exact: true }).click();
    await page.getByRole('textbox', { name: 'Твой ответ' }).fill('МО');
    await page.getByRole('button', { name: 'Подсказка', exact: true }).click();
    await page
      .getByRole('button', { name: 'Скрыть подсказку', exact: true })
      .click();
    assert.equal(
      await page.getByRole('textbox', { name: 'Твой ответ' }).inputValue(),
      'МО',
      'hint lost input',
    );
    // Return through home in focus mode, whose global navigation is hidden during an activity.
    if (layout === 'focus') {
      await page
        .getByRole('button', { name: 'Все разделы', exact: true })
        .click();
    }
    await navigate('Состав слога');
    const compose = await measure('compose');
    assert(
      compose.body.scroll <= 2,
      'ordinary composition requires scrolling: ' +
        JSON.stringify(compose.body),
    );
    assert.deepEqual(errors, []);
    await page.close();
  }
  const fixture = path
    .join(root, 'tests/fixtures/task-card-state.tsx')
    .replaceAll('\\', '/');
  const html = await server.transformIndexHtml(
    '/__card.html',
    `<!doctype html><html lang="ru" data-layout="order"><meta charset="UTF-8"><body><div id="root"></div><script type="module" src="/@fs/${fixture}"></script></body></html>`,
  );
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      'reading-steps-v3',
      JSON.stringify({
        settings: {
          unit: 12,
          curriculumVersion: 2,
          sound: false,
          autoSpeech: false,
          autoAdvance: false,
          length: 3,
          breakEvery: 0,
          breakMinutes: 0,
        },
        stars: 0,
        history: [],
      }),
    ),
  );
  await page.route('**/__card.html', (r) =>
    r.fulfill({ contentType: 'text/html', body: html }),
  );
  await page.goto(
    'http://127.0.0.1:' + server.httpServer.address().port + '/__card.html',
  );
  await page.waitForFunction(() => window.cardLesson?.ready);
  await page.evaluate(() => window.cardLesson.navigate('syllables', 'read'));
  const frame = () => page.locator('.task-card').boundingBox();
  const primary = () =>
    page.locator('.task-card-actions .primary').boundingBox();
  const startFrame = await frame(),
    startPrimary = await primary();
  await page.getByRole('button', { name: 'Начать урок с микрофоном' }).click();
  await page.getByText('Я слушаю', { exact: true }).waitFor();
  assert.deepEqual(await frame(), startFrame);
  assert.deepEqual(await primary(), startPrimary);
  await page.evaluate(() =>
    window.cardLesson.setFeedback({
      kind: 'error',
      text: 'Попробуем ещё раз.',
    }),
  );
  await page.getByText('Попробуем ещё раз.', { exact: true }).waitFor();
  assert.deepEqual(await frame(), startFrame);
  assert.deepEqual(await primary(), startPrimary);
  await page.evaluate(() => window.cardLesson.navigate('syllables', 'type'));
  async function answer() {
    await page.waitForFunction(
      () => !document.querySelector('input[aria-label="Твой ответ"]')?.disabled,
    );
    await page
      .getByRole('textbox', { name: 'Твой ответ' })
      .fill(await page.evaluate(() => window.cardLesson.target));
    await page.getByRole('textbox', { name: 'Твой ответ' }).press('Enter');
    await page.getByRole('button', { name: /Дальше.*Enter/ }).waitFor();
    assert.deepEqual(await frame(), startFrame);
    assert.deepEqual(await primary(), startPrimary);
  }
  await answer();
  await page.getByRole('button', { name: /Дальше.*Enter/ }).click();
  await answer();
  const bridge = page.getByRole('region', { name: 'Из слогов в слово' });
  await bridge.waitFor();
  assert.equal(await page.locator('.task-card-material').isVisible(), false);
  assert(
    await bridge.evaluate((e) => {
      const a = e.getBoundingClientRect(),
        b = e.closest('.task-card-body').getBoundingClientRect();
      return a.top >= b.top && a.bottom <= b.bottom;
    }),
    'bridge must fit central area',
  );
  await page.screenshot({ path: path.join(output, 'bridge.png') });
  const parts = (
    await bridge.locator('.task-instruction b').textContent()
  ).split(' · ');
  for (const part of parts.slice(0, -1))
    await bridge
      .getByRole('button', { name: part, exact: true })
      .and(page.locator(':enabled'))
      .first()
      .click();
  await page.evaluate(() => (window.cardGate.hold = true));
  await bridge
    .getByRole('button', { name: parts.at(-1), exact: true })
    .and(page.locator(':enabled'))
    .first()
    .click();
  await page.waitForFunction(() => window.cardGate.pending);
  assert.deepEqual(await frame(), startFrame);
  assert(
    await page.locator('.word-bridge').evaluate((e) => !!e.closest('[inert]')),
    'bridge pending actions stay inert',
  );
  await page.evaluate(() => window.cardGate.commit());
  await page.waitForFunction(() =>
    document.activeElement?.textContent?.includes('Дальше'),
  );
  await page.keyboard.press('Enter');
  await answer();
  await page.getByRole('button', { name: /Дальше.*Enter/ }).click();
  await page
    .getByRole('heading', { name: 'Ты позанимался. Здорово!' })
    .waitFor();
  assert.deepEqual(await frame(), startFrame);
  assert.deepEqual(await primary(), startPrimary);
  await page.screenshot({ path: path.join(output, 'completion.png') });
  reports.push({
    name: 'state-transitions',
    passed: [
      'microphone presentation',
      'error',
      'success',
      'bridge replaces material',
      'bridge durable gate',
      'completion',
      'constant primary size',
    ],
  });
  await page.close();
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(reports, null, 2),
  );
  await browser.close();
  await server.close();
}
console.log(
  'PASS permanent card geometry, visible actions, hint input preservation and ordinary composition',
);
