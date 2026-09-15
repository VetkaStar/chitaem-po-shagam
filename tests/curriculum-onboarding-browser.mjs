/** Browser-only onboarding checks: actual controls, entry planner, and isolated persisted state. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const playwrightPath = process.env.PLAYWRIGHT_PACKAGE;
const { chromium } = playwrightPath
  ? await import(pathToFileURL(path.join(playwrightPath, 'index.mjs')))
  : require('playwright');
const reportDir = path.join(root, '.local/curriculum-onboarding-browser');
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
const fixturePath = path
  .join(root, 'tests/fixtures/onboarding-preview.tsx')
  .replaceAll('\\', '/');
const html = await server.transformIndexHtml(
  '/base/__onboarding-preview.html',
  `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Onboarding fixture</title></head><body><div id="root"></div><script type="module" src="/@fs/${fixturePath}"></script></body></html>`,
);
const completed = [],
  errors = [],
  screenshots = [];
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || 'msedge',
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  await context.route('**/__onboarding-preview.html', (route) =>
    route.fulfill({ contentType: 'text/html', body: html }),
  );
  const page = await context.newPage();
  page.on('pageerror', (error) =>
    errors.push({ message: error.message, stack: error.stack }),
  );
  page.setDefaultTimeout(15000);
  const snapshot = () =>
    page.evaluate(() => window.onboardingHarness.controller.snapshot());
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
  async function select(name, value) {
    await page
      .getByRole('combobox', {
        name: new RegExp(
          '^' + name.replace(/[.*+?^${}()|[\]\\]/g, (char) => '\\' + char),
        ),
      })
      .selectOption(value);
    await saved();
  }
  async function reset() {
    await page.goto(address + '/base/__onboarding-preview.html');
    await ready();
    await page.evaluate(() => window.onboardingHarness.reset());
    await page.reload();
    await ready();
  }
  async function reloadExact() {
    await saved();
    const before = await snapshot();
    await page.reload();
    await ready();
    assert.deepEqual(await snapshot(), before);
  }
  async function capture(name) {
    const filename = name + '.png';
    await page.screenshot({
      path: path.join(reportDir, filename),
      fullPage: true,
    });
    screenshots.push(filename);
  }
  async function questionnaire(companion, budget = 5) {
    await click('Настроить программу');
    await page.getByRole('form', { name: 'Настройка дорожки' }).waitFor();
    await select('Кто отвечает?', 'together');
    await select(
      'Рядом есть помощник, который может наблюдать выполнение и подтвердить чтение?',
      String(companion),
    );
    await select('Понятен текст инструкции без помощи?', 'true');
    await select('Буквы видны и различимы?', 'true');
    await select('Удобно нажимать кнопки?', 'true');
    await select('Сколько действий попробовать за занятие?', String(budget));
    await select('Какой способ хочешь попробовать?', 'method_syllable_first');
    await click('Продолжить');
    await page
      .getByRole('region', { name: 'Настройка доступа', exact: true })
      .waitFor();
    const s = await snapshot();
    assert.deepEqual(s.profile.knownLetters, []);
    assert.deepEqual(s.profile.confirmedSkills, []);
    assert.equal(s.profile.currentVisit, null);
  }
  async function passAccess() {
    await click('Круг');
    assert.equal((await snapshot()).onboarding.entry.access.passed, true);
    await click('Продолжить');
  }

  await reset();
  const fresh = await snapshot();
  await click('Настроить позже');
  await page.getByRole('region', { name: 'Каталог тренажёров' }).waitFor();
  let s = await snapshot();
  assert.equal(s.onboarding.setupStatus, 'deferred');
  assert.equal(s.studyMode, 'free');
  assert.equal(s.profile.currentVisit, null);
  assert.deepEqual(s.profile, fresh.profile);
  assert.equal(await page.evaluate(() => window.onboardingHarness.exits), 1);
  completed.push('skip setup opens catalog without visit or reading evidence');

  await reset();
  await questionnaire(false);
  assert.equal((await snapshot()).onboarding.questionnaire.audioUsable, null);
  await click('Квадрат');
  assert.deepEqual((await snapshot()).onboarding.entry.access, {
    attempts: 1,
    passed: false,
  });
  await page.getByText('Это круг.', { exact: false }).waitFor();
  await click('Квадрат');
  assert.deepEqual((await snapshot()).onboarding.entry.access, {
    attempts: 2,
    passed: false,
  });
  assert.equal(
    await page.getByRole('button', { name: 'Круг', exact: true }).count(),
    0,
  );
  await reloadExact();
  await select('Удобно пользоваться клавиатурой?', 'true');
  assert.equal(
    (await snapshot()).onboarding.questionnaire.canUseKeyboard,
    null,
    'draft must await explicit save',
  );
  await click('Сохранить настройки и повторить');
  assert.deepEqual((await snapshot()).onboarding.entry.access, {
    attempts: 0,
    passed: false,
  });
  await passAccess();
  await page
    .getByRole('region', { name: 'Итоги настройки', exact: true })
    .waitFor();
  s = await snapshot();
  assert.equal(s.onboarding.entry.placement.kind, 'provisional_free');
  assert.deepEqual(s.profile.knownLetters, []);
  assert.deepEqual(s.profile.confirmedSkills, []);
  assert.equal(s.profile.currentVisit.actions, 0);
  await capture('without-companion-report');
  completed.push(
    'questionnaire persists; two access failures require settings and retry; circle succeeds',
  );
  const courseBefore = s.profile.programs;
  await click('Начать свободную практику');
  await click('Открыть задание');
  s = await snapshot();
  const active = s.profile.activeInstance;
  assert.ok(active);
  assert.equal(
    active.itemId,
    s.onboarding.entry.practice.plan.orderedTaskIds[0],
  );
  assert.equal(s.profile.currentVisit.actions, 1);
  await reloadExact();
  await page.locator('.curriculum-task-renderer').waitFor();
  assert.deepEqual((await snapshot()).profile.programs, courseBefore);
  assert.deepEqual((await snapshot()).profile.confirmedSkills, []);
  await capture('without-companion-first-practice');
  completed.push(
    'no companion launches real provisional first task and restores exact state after reload',
  );

  await reset();
  await questionnaire(true);
  await passAccess();
  s = await snapshot();
  assert.equal(s.onboarding.currentCheckpointGroup, 'CVC');
  const untouchedCourses = s.profile.programs;
  const targets = [];
  for (let index = 0; index < 2; index++) {
    await page
      .getByLabel('Взрослый будет наблюдать следующий ответ', { exact: true })
      .check();
    await click('Открыть следующую пробу');
    s = await snapshot();
    const instance = s.profile.activeInstance;
    const cp = s.onboarding.entry.checkpoints.find(
      (cp) => cp.id === s.onboarding.checkpointId,
    );
    assert.equal(cp.metadata[instance.instanceId].independentAccess, true);
    assert.equal(cp.metadata[instance.instanceId].companionObserved, true);
    targets.push(instance.itemId);
    await reloadExact();
    await click('Взрослый: прочитано верно');
    s = await snapshot();
    assert.equal(s.profile.activeInstance, null);
    assert.equal(
      s.onboarding.entry.checkpoints[0].observations.length,
      index + 1,
    );
    assert.deepEqual(
      s.profile.confirmedSkills,
      [],
      'observations must await explicit confirmation',
    );
  }
  assert.equal(new Set(targets).size, 2);
  await page.getByRole('heading', { name: 'Наблюдения сохранены' }).waitFor();
  await click('Взрослый подтверждает наблюдения');
  await page
    .getByRole('region', { name: 'Итоги настройки', exact: true })
    .waitFor();
  s = await snapshot();
  assert.deepEqual(
    s.profile.knownLetters,
    [],
    'CVC confirmation cannot fabricate letter knowledge',
  );
  const skillId = await page.evaluate(
    () => window.onboardingHarness.supply.registry.groups.CVC.skillId,
  );
  assert.deepEqual(s.profile.confirmedSkills, [skillId]);
  assert.equal(s.profile.skillBasis[skillId].status, 'confirmed_entry');
  assert.deepEqual(s.profile.programs, untouchedCourses);
  assert.equal(s.onboarding.entry.checkpoints[0].confirmed, true);
  await reloadExact();
  // A placement report must not prime the forthcoming authored reading target.
  const futureEpisodeTitle = await page.evaluate(() => {
    const { controller, supply } = window.onboardingHarness;
    const placement = controller.snapshot().onboarding.entry.placement;
    const source = placement.practice ?? placement;
    return supply.curriculum.episodes[source.sourceEpisodeId]?.title ?? null;
  });
  assert.ok(
    futureEpisodeTitle,
    'real placement must identify its authored source episode',
  );
  const reportText = await page
    .getByRole('region', { name: 'Итоги настройки', exact: true })
    .innerText();
  assert.equal(
    reportText.includes('ЛУНА'),
    false,
    'report must not reveal a future reading target',
  );
  assert.equal(
    reportText.includes(futureEpisodeTitle),
    false,
    'report must not reveal the target through its episode title',
  );
  await capture('companion-cvc-report');
  completed.push(
    'two real CVC probes, explicit companion confirmation, persisted report without fabricated letters or course progress',
  );

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 820, height: 1180 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await capture('report-' + viewport.width);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      'onboarding report horizontal overflow',
    );
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await click('Проверить подготовительный навык');
  assert.equal((await snapshot()).onboarding.currentCheckpointGroup, 'CV');
  const cvTargets = [];
  for (let index = 0; index < 2; index++) {
    await page
      .getByLabel('Взрослый будет наблюдать следующий ответ', { exact: true })
      .check();
    await click('Открыть следующую пробу');
    const before = await snapshot();
    cvTargets.push(before.profile.activeInstance.itemId);
    await reloadExact();
    await click('Взрослый: прочитано верно');
  }
  assert.equal(new Set(cvTargets).size, 2);
  await click('Взрослый подтверждает наблюдения');
  s = await snapshot();
  assert.equal(s.onboarding.entry.placement.kind, 'formal_route');
  assert.deepEqual(s.profile.knownLetters, []);
  const episodeId = s.onboarding.entry.placement.startEpisodeId;
  assert.ok(episodeId);
  await click('Продолжить программу');
  assert.equal((await snapshot()).studyMode, 'recommended');
  await page.getByRole('heading', {name: 'Моя учебная дорожка', exact: true}).waitFor();
  await click('Продолжить программу');
  await click('Дальше');
  const firstView = await page.evaluate(() =>
    window.onboardingHarness.controller.visible(),
  );
  assert.ok(firstView, 'the first authored course screen must be visible');
  const expected = await page.evaluate(
    (id) => window.onboardingHarness.supply.curriculum.episodes[id].steps[0],
    episodeId,
  );
  assert.equal(firstView.kind, 'info');
  assert.ok(expected.instruction);
  assert.equal(firstView.instruction, expected.instruction);
  const formalState = await snapshot();
  const savedInfo =
    formalState.profile.programs[formalState.profile.currentProgramId]
      .activeInfo;
  assert.equal(savedInfo.episodeId, episodeId);
  assert.equal(savedInfo.stepId, expected.id);
  await page.getByText(expected.instruction, { exact: true }).waitFor();
  await page.locator('.curriculum-step').waitFor();
  await reloadExact();
  assert.deepEqual(
    await page.evaluate(() => window.onboardingHarness.controller.visible()),
    firstView,
  );
  await capture('formal-program-first-screen');
  completed.push(
    'CVC -> two real CV prerequisites -> explicit confirmation -> formal program first authored screen, exact reload',
  );
  await reset();
  await questionnaire(true, 3);
  await passAccess();
  for (let i = 0; i < 2; i++) {
    await page
      .getByLabel('Взрослый будет наблюдать следующий ответ', { exact: true })
      .check();
    await click('Открыть следующую пробу');
    await click('Взрослый: прочитано верно');
  }
  await click('Взрослый подтверждает наблюдения');
  await click('Проверить подготовительный навык');
  await page
    .getByLabel('Взрослый будет наблюдать следующий ответ', { exact: true })
    .check();
  await click('Открыть следующую пробу');
  await click('Взрослый: прочитано верно');
  s = await snapshot();
  const pausedCheckpoint = s.onboarding.checkpointId,
    oldVisit = s.profile.currentVisit.id;
  assert.equal(s.profile.currentVisit.actions, 3);
  assert.equal(
    s.onboarding.entry.checkpoints.find((cp) => cp.id === pausedCheckpoint)
      .observations.length,
    1,
  );
  await click('Предварительные результаты');
  assert.equal(
    (await snapshot()).onboarding.entry.resumeCheckpointId,
    pausedCheckpoint,
  );
  await reloadExact();
  await page
    .getByRole('button', { name: /^Вернуться к отложенной проверке:/ })
    .click();
  await saved();
  assert.equal((await snapshot()).onboarding.checkpointId, pausedCheckpoint);
  await click('Закончить подход');
  await reloadExact();
  await click('Начать подход');
  assert.notEqual((await snapshot()).profile.currentVisit.id, oldVisit);
  assert.equal((await snapshot()).profile.currentVisit.actions, 0);
  await page
    .getByLabel('Взрослый будет наблюдать следующий ответ', { exact: true })
    .check();
  await click('Открыть следующую пробу');
  await click('Взрослый: прочитано верно');
  s = await snapshot();
  assert.equal(
    s.onboarding.entry.checkpoints.find((cp) => cp.id === pausedCheckpoint)
      .observations.length,
    2,
  );
  await click('Взрослый подтверждает наблюдения');
  assert.equal(
    (await snapshot()).onboarding.entry.placement.kind,
    'formal_route',
  );
  assert.deepEqual((await snapshot()).profile.knownLetters, []);
  await reloadExact();
  await capture('budget-resumed-report');
  completed.push(
    'budget3 partial CV checkpoint -> provisional report -> reload -> explicit new visit -> same checkpoint completed',
  );
  // Production entry, separate browser storage: no fixture controls or synthetic skills.
  const mainContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  await mainContext.addInitScript(() => {
    localStorage.setItem(
      'reading-profile-v1',
      JSON.stringify({ name: 'Проверка', age: '8', start: 'letters' }),
    );
    localStorage.setItem(
      'reading-steps-v3',
      JSON.stringify({
        stars: 29,
        settings: { styleChosen: true, sound: false, look: 'plain' },
      }),
    );
  });
  const mainPage = await mainContext.newPage(),
    requests = [],
    failed = [];
  mainPage.on('pageerror', (error) =>
    errors.push({ message: error.message, stack: error.stack }),
  );
  mainPage.on('request', (request) => requests.push(request.url()));
  mainPage.on('response', (response) => {
    if (response.status() >= 400)
      failed.push({ url: response.url(), status: response.status() });
  });
  await mainPage.goto(address + '/base/');
  await mainPage
    .getByRole('button', { name: 'Учебные программы', exact: true })
    .waitFor();
  const supplyRequests = () =>
    requests.filter((url) =>
      /content\/curriculum\/(curriculum|entry_registry)\.json/.test(url),
    );
  assert.deepEqual(
    supplyRequests(),
    [],
    'free trainer catalog must not request curriculum supply',
  );
  assert.deepEqual(
    await mainPage.evaluate(async () =>
      (await indexedDB.databases()).map((db) => db.name),
    ),
    [],
    'opening the free catalog must not create curriculum progress',
  );
  await mainPage
    .getByRole('button', { name: 'Учебные программы', exact: true })
    .click();
  await mainPage
    .getByRole('button', { name: 'Настроить программу', exact: true })
    .waitFor();
  assert.equal(
    supplyRequests().length,
    2,
    'curriculum and entry registry load only after explicit open',
  );
  assert.ok(
    supplyRequests().every((url) => new URL(url).pathname.startsWith('/base/')),
    'lazy content preserves nested base',
  );
  await mainPage
    .getByRole('button', { name: 'Настроить позже', exact: true })
    .click();
  await mainPage
    .getByRole('heading', { name: 'Привет, Проверка!', exact: true })
    .waitFor();
  await mainPage.getByRole('button', { name: /^ШАГ 1/ }).click();
  await mainPage.locator('.exercise').waitFor();
  assert.deepEqual(failed, [], 'main and lazy assets must resolve under base');
  const mainShot = 'main-base-old-trainer.png';
  await mainPage.screenshot({
    path: path.join(reportDir, mainShot),
    fullPage: true,
  });
  screenshots.push(mainShot);
  completed.push(
    'real AppPortal under /base/: lazy supply only on open, defer returns catalog, existing trainer works',
  );
  await mainContext.close();
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(reportDir, 'report.json'),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        browser: await browser.version(),
        completed,
        screenshots,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ completed, screenshots, errors }, null, 2));
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
