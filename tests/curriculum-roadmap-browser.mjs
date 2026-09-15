/** Roadmap browser checks use the existing isolated IndexedDB onboarding fixture. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const { chromium } = process.env.PLAYWRIGHT_PACKAGE
  ? await import(
      pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE, 'index.mjs'))
    )
  : require('playwright');
const reportDir = path.join(root, '.local/curriculum-roadmap-browser');
fs.mkdirSync(reportDir, { recursive: true });
const server = await createServer({
  configFile: path.join(root, 'vite.pages.config.ts'),
  base: '/base/',
  server: {
    host: '127.0.0.1',
    hmr: false,
    forwardConsole: false,
    port: 0,
    strictPort: false,
    fs: { allow: [root] },
  },
  logLevel: 'error',
});
await server.listen();
const address = 'http://127.0.0.1:' + server.httpServer.address().port;
const fixture = path
  .join(root, 'tests/fixtures/onboarding-preview.tsx')
  .replaceAll('\\', '/');
const html = await server.transformIndexHtml(
  '/base/__roadmap-preview.html',
  `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Roadmap fixture</title></head><body><div id="root"></div><script type="module" src="/@fs/${fixture}"></script></body></html>`,
);
const completed = [],
  screenshots = [],
  geometry = [],
  errors = [];
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || 'msedge',
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    reducedMotion: 'reduce',
  });
  await context.route('**/__roadmap-preview.html', (route) =>
    route.fulfill({ contentType: 'text/html', body: html }),
  );
  const page = await context.newPage();
  page.on('pageerror', (error) =>
    errors.push({ message: error.message, stack: error.stack }),
  );
  page.setDefaultTimeout(15000);
  const snapshot = () =>
    page.evaluate(() => window.onboardingHarness.controller.snapshot());
  const roadmap = () =>
    page.getByRole('region', { name: 'Моя учебная дорожка', exact: true });
  async function ready() {
    await page.waitForFunction(
      () => window.onboardingFixtureError || window.onboardingHarness,
    );
    assert.equal(
      await page.evaluate(() => window.onboardingFixtureError),
      undefined,
    );
    await page.locator('.curriculum-session').first().waitFor();
  }
  async function saved() {
    await page.waitForFunction(
      () => !document.querySelector('[aria-busy="true"]'),
    );
    assert.deepEqual(
      await page.evaluate(() => window.onboardingHarness.saved()),
      await snapshot(),
    );
  }
  async function click(name) {
    await page.getByRole('button', { name, exact: true }).click();
    await saved();
  }
  async function reloadExact() {
    const before = await snapshot();
    await page.reload();
    await ready();
    await roadmap().waitFor();
    assert.deepEqual(await snapshot(), before);
  }
  await page.goto(address + '/base/__roadmap-preview.html');
  await ready();
  const programs = await page.evaluate(() =>
    window.onboardingHarness.supply.curriculum.programs.map(
      ({ id, title }) => ({ id, title }),
    ),
  );
  await page.evaluate(async () => {
    const h = window.onboardingHarness;
    await h.controller.selectProgram(h.supply.curriculum.programs[0].id);
  });
  await reloadExact();
  assert.equal(await roadmap().locator('ol > li').count(), 3);
  assert.equal(await roadmap().locator('ol button').count(), 0);
  assert.equal((await snapshot()).profile.currentVisit, null);
  completed.push(
    'saved program opens read-only roadmap on reload, with three recommendation goals and no automatic visit',
  );

  await click('Продолжить программу');
  await page
    .getByRole('region', { name: 'Учебная программа', exact: true })
    .waitFor();
  await click('Начать занятие');
  const session = await snapshot();
  assert.ok(session.profile.currentVisit);
  await click('Моя дорожка');
  await roadmap().waitFor();
  assert.deepEqual((await snapshot()).profile, session.profile);
  await reloadExact();
  const continueButton = page.getByRole('button', {
    name: /^(Продолжить программу|Продолжить задание)$/,
  });
  await continueButton.click();
  await saved();
  await page
    .getByRole('region', { name: 'Учебная программа', exact: true })
    .waitFor();
  assert.equal(
    (await snapshot()).profile.currentVisit.id,
    session.profile.currentVisit.id,
  );
  await click('Моя дорожка');
  completed.push(
    'continue, begin visit, return to roadmap and reload preserve the same visit and saved program position',
  );

  const firstPosition = structuredClone(
    (await snapshot()).profile.programs[programs[0].id],
  );
  await click(programs[1].title);
  let state = await snapshot();
  assert.equal(state.profile.currentProgramId, programs[1].id);
  assert.deepEqual(state.profile.programs[programs[0].id], firstPosition);
  assert.equal(
    await page
      .getByRole('button', { name: programs[1].title, exact: true })
      .getAttribute('aria-pressed'),
    'true',
  );
  const secondPosition = structuredClone(
    state.profile.programs[programs[1].id],
  );
  await click(programs[0].title);
  state = await snapshot();
  assert.deepEqual(state.profile.programs[programs[0].id], firstPosition);
  assert.deepEqual(state.profile.programs[programs[1].id], secondPosition);
  completed.push(
    'both program buttons switch the active method while retaining independent positions',
  );

  await page.getByText('Интересы', { exact: true }).click();
  const beforeInterests = await snapshot();
  await page.getByRole('checkbox', { name: 'Животные', exact: true }).check();
  await saved();
  state = await snapshot();
  assert.ok(state.profile.interests.includes('animals'));
  assert.deepEqual(state.profile.programs, beforeInterests.profile.programs);
  assert.deepEqual(
    state.profile.confirmedSkills,
    beforeInterests.profile.confirmedSkills,
  );
  await reloadExact();
  await page.getByText('Интересы', { exact: true }).click();
  assert.equal(
    await page
      .getByRole('checkbox', { name: 'Животные', exact: true })
      .isChecked(),
    true,
  );
  await page.getByText('Что уже подтверждено', { exact: true }).click();
  completed.push(
    'actual interest checkbox persists across reload without changing positions or confirming skills',
  );

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 820, height: 1180 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    const measured = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      header: (() => {
        const rect = document
          .querySelector('.curriculum-session-header')
          .getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      })(),
    }));
    assert.ok(
      measured.scrollWidth <= viewport.width + 1,
      `horizontal overflow at ${viewport.width}: ${measured.scrollWidth}`,
    );
    geometry.push({ viewport, ...measured });
    const filename = `roadmap-${viewport.width}.png`;
    await page.screenshot({
      path: path.join(reportDir, filename),
      fullPage: true,
    });
    screenshots.push(filename);
  }
  completed.push(
    '390x844, 820x1180 and 1920x1080 screenshots have no horizontal overflow, including expanded report and interests',
  );

  const beforeExit = await snapshot();
  await click('Все тренажёры');
  await page
    .getByRole('region', { name: 'Каталог тренажёров', exact: true })
    .waitFor();
  assert.deepEqual(await snapshot(), beforeExit);
  assert.equal(await page.evaluate(() => window.onboardingHarness.exits), 1);
  completed.push(
    'all trainers exits to the catalog without changing the saved curriculum state',
  );
  assert.deepEqual(errors, []);
  const report = {
    at: new Date().toISOString(),
    browser: await browser.version(),
    completed,
    geometry,
    screenshots,
    errors,
  };
  fs.writeFileSync(
    path.join(reportDir, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  fs.writeFileSync(
    path.join(reportDir, 'failure.json'),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        completed,
        errors,
        message: error.message,
        stack: error.stack,
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
