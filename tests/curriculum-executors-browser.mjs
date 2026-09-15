/** Full browser cycles use real renderers and IndexedDB; fixture is excluded from the production entry. */
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
const c = JSON.parse(
  fs.readFileSync(
    path.join(root, 'content/curriculum/curriculum.json'),
    'utf8',
  ),
);
const reportDir = path.join(root, '.local/curriculum-executors-browser');
fs.mkdirSync(reportDir, { recursive: true });
const server = await createServer({
  configFile: path.join(root, 'vite.pages.config.ts'),
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
  .join(root, 'tests/fixtures/curriculum-preview.tsx')
  .replaceAll('\\', '/');
const html = await server.transformIndexHtml(
  '/__curriculum-preview.html',
  `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Curriculum test fixture</title></head><body><div id="root"></div><script type="module" src="/@fs/${fixturePath}"></script></body></html>`,
);
let browser;
const completed = [];
const errors = [];
try {
  browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || 'msedge',
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    reducedMotion: 'reduce',
  });
  await context.route('**/__curriculum-preview.html', (route) =>
    route.fulfill({ contentType: 'text/html', body: html }),
  );
  const page = await context.newPage();
  page.on('pageerror', (error) => {
    if (!errors.some((saved) => saved.message === error.message))
      errors.push({ message: error.message, stack: error.stack });
  });
  page.setDefaultTimeout(15000);
  async function ready() {
    await page.waitForFunction(() => window.fixtureError || window.testHarness);
    const error = await page.evaluate(() => window.fixtureError);
    assert.equal(error, undefined);
    await page.locator('.curriculum-session').waitFor();
  }
  const snapshot = () =>
    page.evaluate(() => window.testHarness.controller.snapshot());
  const visible = () =>
    page.evaluate(() => window.testHarness.controller.visible());
  async function prepare(episodeId) {
    await page.goto(address + '/__curriculum-preview.html');
    await ready();
    await page.evaluate((id) => window.testHarness.prepare(id), episodeId);
    await page.reload();
    await ready();
    const state = await snapshot();
    assert.deepEqual(state.profile.confirmedSkills, []);
    assert.deepEqual(state.profile.knownLetters, []);
    assert.equal(state.profile.currentVisit, null);
  }
  async function waitSaved() {
    await page.waitForFunction(
      () =>
        !document.querySelector(
          '.curriculum-task-renderer[aria-busy="true"], .curriculum-session[aria-busy="true"]',
        ),
    );
    const current = await snapshot();
    assert.deepEqual(
      await page.evaluate(() => window.testHarness.saved()),
      current,
    );
  }
  async function reloadExact() {
    await waitSaved();
    const before = await snapshot(),
      shown = await visible();
    await page.reload();
    await ready();
    assert.deepEqual(
      await snapshot(),
      before,
      'reload must preserve the exact persisted aggregate',
    );
    assert.deepEqual(
      await visible(),
      shown,
      'reload must preserve the presentation stage',
    );
  }
  async function answerTask(itemId) {
    const item = c.items[itemId],
      shown = await visible();
    assert.equal(shown.kind, 'task');
    const instanceId = shown.instanceId;
    switch (item.kind) {
      case 'read':
        await page
          .getByRole('button', {
            name:
              item.answer.kind === 'companion_function'
                ? 'Взрослый: выполнено верно'
                : 'Взрослый: прочитано верно',
            exact: true,
          })
          .click();
        break;
      case 'compose':
        for (const token of item.partTokens) {
          const bank = page.locator('.curriculum-token-bank');
          await bank
            .getByRole('button', {
              name: new RegExp('^Часть \\d+: ' + token.text + '$'),
            })
            .first()
            .click();
        }
        await page
          .getByRole('button', { name: 'Ответить', exact: true })
          .click();
        break;
      case 'read_meaning':
        await page
          .getByRole('button', {
            name: 'Взрослый: прочитано верно',
            exact: true,
          })
          .click();
        await page.waitForFunction(
          () =>
            window.testHarness.controller.visible()?.readingStageFinished ===
            true,
        );
        await reloadExact();
      // Fall through to saved option reveal and choice submission.
      case 'choice':
        assert.deepEqual(shown.options, []);
        await page
          .getByRole('button', { name: 'Открыть варианты ответа', exact: true })
          .click();
        await page.waitForFunction(
          () =>
            window.testHarness.controller.visible()?.optionsRevealed === true,
        );
        await reloadExact();
        for (const id of item.answer.correctOptionIds)
          await page
            .getByRole('button', {
              name: item.options.find((o) => o.id === id).text,
              exact: true,
            })
            .click();
        await page
          .getByRole('button', { name: 'Ответить', exact: true })
          .click();
        break;
      case 'find_part':
        for (const segment of item.answer.segments) {
          const lines = item.lines?.length
            ? item.lines
            : item.learnerText.split('\n');
          const line = Array.from(lines[segment.line]);
          const label = (position) =>
            'Строка ' +
            (segment.line + 1) +
            ', знак ' +
            (position + 1) +
            ': ' +
            (line[position] === ' ' ? 'пробел' : line[position]);
          await page
            .getByRole('button', { name: label(segment.start), exact: true })
            .click();
          await page
            .getByRole('button', { name: label(segment.end - 1), exact: true })
            .click();
        }
        await page
          .getByRole('button', { name: 'Ответить', exact: true })
          .click();
        break;
      case 'passage':
        assert.deepEqual(shown.questions, []);
        await page
          .getByRole('button', {
            name: 'Взрослый: прочитано верно',
            exact: true,
          })
          .click();
        await page.waitForFunction(
          () =>
            window.testHarness.controller.visible()?.readingStageFinished ===
            true,
        );
        await reloadExact();
        await page
          .getByRole('button', { name: 'Открыть варианты ответа', exact: true })
          .click();
        await page.waitForFunction(
          () =>
            window.testHarness.controller.visible()?.optionsRevealed === true,
        );
        await reloadExact();
        for (const [index, question] of item.answer.questions.entries()) {
          const form = page
            .locator('.curriculum-question')
            .filter({ has: page.getByText(question.prompt, { exact: true }) });
          for (const id of question.correctOptionIds)
            await form
              .getByRole('button', {
                name: question.options.find((o) => o.id === id).text,
                exact: true,
              })
              .click();
          await form
            .getByRole('button', { name: 'Сохранить ответ', exact: true })
            .click();
          if (index < item.answer.questions.length - 1) {
            await page.waitForFunction(
              (id) =>
                !!window.testHarness.controller.snapshot().profile
                  .activeInstance?.answers[id]?.length,
              question.id,
            );
            assert.equal(
              (await snapshot()).profile.attempts.length,
              0,
              'partial is not a completed attempt',
            );
            await reloadExact();
            assert.deepEqual(
              (await visible()).selectedAnswers[question.id],
              question.correctOptionIds,
            );
          }
        }
        break;
      case 'boundary':
        assert.deepEqual(shown.tokens, []);
        assert.equal('partsAfterAnswer' in shown, false);
        for (const boundary of item.answer.acceptedBoundaries[0])
          await page
            .getByRole('button', {
              name: 'Граница после буквы ' + boundary,
              exact: true,
            })
            .click();
        await page
          .getByRole('button', { name: 'Ответить', exact: true })
          .click();
        break;
      case 'transform':
        assert.equal('resultText' in shown, false);
        await page
          .getByLabel('Напиши, что получилось', { exact: true })
          .fill(item.answer.value);
        await page
          .getByRole('button', { name: 'Ответить', exact: true })
          .click();
        // Transform may introduce a separately saved result-reading stage.
        await page.waitForFunction(
          (id) =>
            window.testHarness.controller.snapshot().profile.receipts[id] ||
            window.testHarness.controller.visible()?.transformText,
          instanceId,
        );
        if (!(await snapshot()).profile.receipts[instanceId]) {
          await reloadExact();
          await page
            .getByRole('button', {
              name: 'Взрослый: прочитано верно',
              exact: true,
            })
            .click();
        }
        break;
      default:
        throw new Error('No browser fixture answer for ' + item.kind);
    }
    await page.waitForFunction(
      (id) => !!window.testHarness.controller.snapshot().profile.receipts[id],
      instanceId,
    );
    await waitSaved();
    const state = await snapshot();
    assert.equal(
      state.profile.attempts.filter(
        (attempt) => attempt.instanceId === instanceId,
      ).length,
      1,
    );
    assert.equal(state.profile.receipts[instanceId].outcome, 'correct');
  }

  // Session controls are semantic and deliberately explicit; no controller answer/launch calls substitute for UI.
  async function nextScreen() {
    await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  }
  async function startVisit(budget) {
    await page
      .getByLabel('Длина занятия', { exact: true })
      .selectOption(String(budget));
    await page
      .getByRole('button', { name: 'Начать занятие', exact: true })
      .click();
    await page.waitForFunction(() => !!window.testHarness.controller.visible());
    await waitSaved();
  }
  for (const episodeId of ['ep.p1.A01.01', 'ep.p2.W01.01', 'ep.p2.P04.01']) {
    await prepare(episodeId);
    await startVisit(7);
    const episode = c.episodes[episodeId];
    for (const step of episode.steps) {
      if (!(await visible())) await nextScreen();
      await page.waitForFunction((id) => {
        const p = window.testHarness.controller.snapshot().profile;
        return (
          p.activeInstance?.stepId === id ||
          p.programs[p.currentProgramId]?.activeInfo?.stepId === id
        );
      }, step.id);
      await reloadExact();
      if (step.itemId) await answerTask(step.itemId);
      else
        await page
          .getByRole('button', { name: 'Продолжить', exact: true })
          .click();
      await page.waitForFunction((id) => {
        const p = window.testHarness.controller.snapshot().profile;
        return p.programs[p.currentProgramId].completedSteps.includes(id);
      }, step.id);
    }
    const state = await snapshot(),
      position = state.profile.programs[episode.programId];
    assert(
      episode.steps.every((step) => position.completedSteps.includes(step.id)),
    );
    assert.equal(
      state.profile.attempts.length,
      episode.steps.filter((step) => step.itemId).length,
    );
    assert.deepEqual(state.profile.confirmedSkills, []);
    assert.deepEqual(state.profile.knownLetters, []);
    assert.equal(state.profile.currentVisit.actions, episode.steps.length);
    await page.screenshot({
      path: path.join(reportDir, episodeId + '.png'),
      fullPage: true,
    });
    completed.push({
      episodeId,
      steps: episode.steps.map((step) => step.id),
      attempts: state.profile.attempts.length,
    });
  }

  // The fourth authored screen cannot appear until the user explicitly ends and starts a visit.
  await prepare('ep.p1.A01.01');
  await startVisit(3);
  for (const step of c.episodes['ep.p1.A01.01'].steps.slice(0, 3)) {
    if (!(await visible())) await nextScreen();
    await page.waitForFunction((id) => {
      const p = window.testHarness.controller.snapshot().profile;
      return (
        p.activeInstance?.stepId === id ||
        p.programs[p.currentProgramId]?.activeInfo?.stepId === id
      );
    }, step.id);
    if (step.itemId) await answerTask(step.itemId);
    else
      await page
        .getByRole('button', { name: 'Продолжить', exact: true })
        .click();
    await page.waitForFunction((id) => {
      const p = window.testHarness.controller.snapshot().profile;
      return p.programs[p.currentProgramId].completedSteps.includes(id);
    }, step.id);
  }
  const paused = await snapshot();
  assert.equal(paused.profile.currentVisit.actions, 3);
  assert.equal(paused.profile.currentVisit.budget, 3);
  assert.equal(paused.profile.completedVisits.length, 0);
  assert.equal(paused.profile.programs.method_syllable_first.stepIndex, 3);
  assert.equal(await visible(), null);
  await page
    .getByRole('button', { name: 'Завершить занятие', exact: true })
    .waitFor();
  await reloadExact();
  assert.equal(
    (await snapshot()).profile.currentVisit.id,
    paused.profile.currentVisit.id,
  );
  await page
    .getByRole('button', { name: 'Завершить занятие', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Начать занятие', exact: true })
    .waitFor();
  await startVisit(3);
  assert.notEqual(
    (await snapshot()).profile.currentVisit.id,
    paused.profile.currentVisit.id,
  );
  assert.equal(
    (await snapshot()).profile.activeInstance.stepId,
    'ep.p1.A01.01.s04',
  );
  await answerTask('task.41a973db156b');
  assert.equal((await snapshot()).profile.currentVisit.actions, 1);
  assert.equal((await snapshot()).profile.completedVisits.length, 1);
  completed.push({
    scenario:
      'budget 3 pauses before fourth screen; reload and explicit new visit resume exact step',
  });

  for (const condition of [
    { name: 'find_part', matches: (item) => item.kind === 'find_part' },
    {
      name: 'passage partial',
      matches: (item) =>
        item.kind === 'passage' && item.answer.questions.length >= 2,
    },
    { name: 'read_meaning', matches: (item) => item.kind === 'read_meaning' },
    {
      name: 'companion_function',
      matches: (item) => item.answer.kind === 'companion_function',
    },
    {
      name: 'free transform followup',
      matches: (item) => item.kind === 'transform',
    },
  ]) {
    const item = Object.values(c.items).find(
      (item) => item.id !== 'task.1bb67acaeb41' && condition.matches(item),
    );
    assert(item, 'Missing real fixture for ' + condition.name);
    await page.evaluate((id) => window.testHarness.prepareFree(id), item.id);
    await page.reload();
    await ready();
    await answerTask(item.id);
    const final = await snapshot();
    assert.deepEqual(final.profile.confirmedSkills, []);
    assert.deepEqual(final.profile.knownLetters, []);
    assert.equal(final.profile.attempts.length, 1);
    assert.equal(final.profile.currentVisit.actions, 1);
    completed.push({
      scenario: condition.name,
      itemId: item.id,
      kind: item.kind,
    });
  }

  const demoTitles = { p1: 'По шагам от слогов', p2: 'От знакомых слов' };
  const demoIds = { p1: 'ep.p1.C01.91', p2: 'ep.p2.P05.91' };
  async function selectDemo(method) {
    await page
      .getByRole('button', {
        name: 'Попробовать: ' + demoTitles[method],
        exact: true,
      })
      .click();
    await page.waitForFunction((method) => {
      const s = window.testHarness.controller.snapshot();
      return s.studyMode === 'demonstration' && s.route?.routeId === method;
    }, method);
    await waitSaved();
  }
  async function finishDemo(method) {
    const episode = c.episodes[demoIds[method]];
    for (const [index, step] of episode.steps.entries()) {
      let state = await snapshot();
      assert.equal(state.demonstrationRuns[method].position, index);
      if (!(await visible())) {
        if (
          state.profile.currentVisit &&
          state.profile.currentVisit.actions >=
            state.profile.currentVisit.budget
        ) {
          const paused = state;
          await page
            .getByRole('button', { name: 'Завершить занятие', exact: true })
            .waitFor();
          await reloadExact();
          assert.equal(
            (await snapshot()).profile.currentVisit.id,
            paused.profile.currentVisit.id,
          );
          await page
            .getByRole('button', { name: 'Завершить занятие', exact: true })
            .click();
          await page
            .getByRole('button', { name: 'Начать занятие', exact: true })
            .waitFor();
          state = await snapshot();
        }
        if (!state.profile.currentVisit) await startVisit(3);
        else await nextScreen();
      }
      await page.waitForFunction(
        ({ method, index, stepId, task }) => {
          const s = window.testHarness.controller.snapshot();
          return (
            s.demonstrationRuns[method].position === index &&
            (task
              ? s.profile.activeInstance?.stepId === stepId
              : !!s.demonstrationRuns[method].activeInfo)
          );
        },
        { method, index, stepId: step.id, task: !!step.itemId },
      );
      await reloadExact();
      if (step.itemId) await answerTask(step.itemId);
      else
        await page
          .getByRole('button', { name: 'Продолжить', exact: true })
          .click();
      await page.waitForFunction(
        ({ method, index }) =>
          window.testHarness.controller.snapshot().demonstrationRuns[method]
            .position ===
          index + 1,
        { method, index },
      );
    }
    assert.equal(
      (await snapshot()).demonstrationRuns[method].comfort,
      null,
      'Comfort must never be inferred from correct answers',
    );
    await page
      .getByRole('button', { name: 'Было удобно', exact: true })
      .waitFor();
    await assertDemoFinished();
    await reloadExact();
    await assertDemoFinished();
  }
  async function assertDemoFinished() {
    await page.getByText('Демонстрация завершена.', { exact: false }).waitFor();
    assert.equal(
      await page.getByRole('button', { name: 'Дальше', exact: true }).count(),
      0,
      'Completed demo must not offer another screen',
    );
    assert.equal(
      await page
        .getByRole('button', { name: 'Начать занятие', exact: true })
        .count(),
      0,
      'Completed demo must not offer an empty new visit',
    );
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await prepare('ep.p1.A01.01');
  const officialBeforeDemos = (await snapshot()).profile.programs;
  const exposuresBeforeDemos = (await snapshot()).profile.exposures;
  for (const method of ['p1', 'p2']) {
    await selectDemo(method);
    await finishDemo(method);
    const choice =
      method === 'p1'
        ? { label: 'Было удобно', value: 'comfortable' }
        : { label: 'Нужна помощь', value: 'needs_help' };
    await page.getByRole('button', { name: choice.label, exact: true }).click();
    await page.waitForFunction(
      ({ method, value }) =>
        window.testHarness.controller.snapshot().demonstrationRuns[method]
          .comfort === value,
      { method, value: choice.value },
    );
    await reloadExact();
    await assertDemoFinished();
    const after = await snapshot();
    assert.deepEqual(
      after.profile.programs,
      officialBeforeDemos,
      'Demonstration must not move a course position',
    );
    assert.deepEqual(after.profile.confirmedSkills, []);
    assert.deepEqual(after.profile.skillBasis, {});
    assert.deepEqual(after.profile.knownLetters, []);
    assert.equal(
      after.demonstrationRuns[method].position,
      c.episodes[demoIds[method]].steps.length,
    );
    await page.screenshot({
      path: path.join(reportDir, demoIds[method] + '.png'),
      fullPage: true,
    });
    completed.push({
      scenario:
        'full demonstration with budget3 pauses, exact reload and explicit comfort',
      episodeId: demoIds[method],
      steps: c.episodes[demoIds[method]].steps.map((step) => step.id),
      comfort: choice.value,
    });
  }
  const demosComplete = await snapshot();
  assert.equal(demosComplete.profile.attempts.length, 6);
  assert(
    demosComplete.profile.attempts.every(
      (attempt) => attempt.context === 'demo' && attempt.phase === 'demo',
    ),
  );
  assert(
    demosComplete.profile.exposures.events.length >
      exposuresBeforeDemos.events.length,
  );
  for (const target of ['ЛУНА', 'ЛУПА'])
    assert(
      demosComplete.profile.exposures.words.includes(target),
      'Both demos must use the shared exposure ledger: ' + target,
    );
  assert(
    demosComplete.sourceEvents.filter(
      (event) => event.source === 'demonstration',
    ).length > 0,
  );

  // Park a real unfinished task, open the other demo, then restore both instances without extra screens.
  await prepare('ep.p1.A01.01');
  const officialBeforeSwitch = (await snapshot()).profile.programs;
  await selectDemo('p1');
  await startVisit(7);
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await page.waitForFunction(
      (position) =>
        window.testHarness.controller.snapshot().demonstrationRuns.p1
          .position === position,
      i + 1,
    );
    await nextScreen();
    await page.waitForFunction(() => !!window.testHarness.controller.visible());
  }
  const p1Active = (await snapshot()).profile.activeInstance;
  assert.equal(p1Active.stepId, 'ep.p1.C01.91.s03');
  await selectDemo('p2');
  assert.deepEqual(
    (await snapshot()).demonstrationRuns.p1.suspendedInstance,
    p1Active,
  );
  await nextScreen();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page.waitForFunction(
    () =>
      window.testHarness.controller.snapshot().demonstrationRuns.p2.position ===
      1,
  );
  await nextScreen();
  await page.waitForFunction(
    () => !!window.testHarness.controller.snapshot().profile.activeInstance,
  );
  const p2Active = (await snapshot()).profile.activeInstance;
  const actionsBeforeSwitch = (await snapshot()).profile.currentVisit.actions;
  assert.equal(p2Active.stepId, 'ep.p2.P05.91.s02');
  await selectDemo('p1');
  await reloadExact();
  assert.deepEqual((await snapshot()).profile.activeInstance, p1Active);
  assert.deepEqual(
    (await snapshot()).demonstrationRuns.p2.suspendedInstance,
    p2Active,
  );
  assert.equal(
    (await snapshot()).profile.currentVisit.actions,
    actionsBeforeSwitch,
  );
  await selectDemo('p2');
  await reloadExact();
  const switched = await snapshot();
  assert.deepEqual(switched.profile.activeInstance, p2Active);
  assert.deepEqual(switched.profile.programs, officialBeforeSwitch);
  assert.equal(switched.profile.currentVisit.actions, actionsBeforeSwitch);
  assert.equal(switched.profile.attempts.length, 0);
  completed.push({
    scenario:
      'switching demonstrations parks/restores both unfinished tasks without counting new screens',
  });

  const geometry = [];
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 820, height: 1180 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() =>
      window.testHarness.prepareFree('task.7b27909468f1'),
    );
    await page.reload();
    await ready();
    await page.evaluate(() => document.fonts.ready);
    const measure = () =>
      page.evaluate(() => {
        const box = (selector) => {
          const rect = document.querySelector(selector).getBoundingClientRect();
          return {
            x: rect.x + scrollX,
            y: rect.y + scrollY,
            width: rect.width,
            height: rect.height,
          };
        };
        return {
          header: box('.curriculum-session-header'),
          progress: box('.curriculum-session-progress'),
          viewportWidth: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
        };
      });
    const before = await measure();
    assert(
      before.documentWidth <= before.viewportWidth,
      'Horizontal overflow before help at ' + viewport.width,
    );
    await page.screenshot({
      path: path.join(reportDir, 'viewport-' + viewport.width + '-before.png'),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Подсказка', exact: true }).click();
    await page.waitForFunction(
      () => window.testHarness.controller.visible()?.hints.length > 0,
    );
    await waitSaved();
    const after = await measure();
    assert(
      after.documentWidth <= after.viewportWidth,
      'Horizontal overflow after help at ' + viewport.width,
    );
    for (const region of ['header', 'progress'])
      for (const dimension of ['x', 'y', 'width', 'height'])
        assert(
          Math.abs(after[region][dimension] - before[region][dimension]) <=
            0.25,
          region + ' ' + dimension + ' shifted after help at ' + viewport.width,
        );
    await page.screenshot({
      path: path.join(reportDir, 'viewport-' + viewport.width + '-after.png'),
      fullPage: true,
    });
    geometry.push({ viewport, before, after });
  }

  assert.deepEqual(errors, []);
  const report = {
    date: new Date().toISOString(),
    browser: await page.evaluate(() => navigator.userAgent),
    completed,
    geometry,
    deferred: [],
  };
  fs.writeFileSync(
    path.join(reportDir, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  await context.close();
} finally {
  if (browser) await browser.close();
  await server.close();
}
