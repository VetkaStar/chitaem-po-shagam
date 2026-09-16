import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const root = process.cwd(),
  require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_PACKAGE
  ? await import(
      pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE, 'index.mjs'))
    )
  : require('playwright');
const dir = path.join(root, '.local/entry08-browser');
fs.mkdirSync(dir, { recursive: true });
const server = await createServer({
  configFile: path.join(root, 'vite.pages.config.ts'),
  base: '/base/',
  server: { host: '127.0.0.1', port: 0, hmr: false, forwardConsole: false },
  logLevel: 'error',
});
await server.listen();
const address = 'http://127.0.0.1:' + server.httpServer.address().port;
const html = await server.transformIndexHtml(
  '/base/__entry08.html',
  `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@fs/${path.join(root, 'tests/fixtures/entry08-preview.tsx').replaceAll('\\', '/')}"></script></body></html>`,
);
const errors = [],
  passed = [];
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || 'msedge',
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await context.route('**/__entry08.html*', (route) =>
    route.fulfill({ contentType: 'text/html', body: html }),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on('pageerror', (e) => errors.push(e.message));
  const snap = () =>
    page.evaluate(() => window.entryHarness.controller.snapshot());
  const click = async (name) => {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForFunction(
      () =>
        document.querySelector('.entry08')?.getAttribute('aria-busy') ===
        'false',
    );
  };
  const ready = async () => {
    await page.waitForFunction(
      () =>
        window.entryHarness?.controller.snapshot().profile.entry08Ui ||
        window.entryError,
    );
    assert.equal(await page.evaluate(() => window.entryError), undefined);
  };
  await page.goto(address + '/base/__entry08.html');
  await ready();
  await click('Ребёнок сам');
  await click('8–12 лет');
  await click('Техника');
  await click('Дальше');
  await click('Круг');
  await click('Попробовать голосом');
  assert.equal((await snap()).profile.entry08Ui.page, 'mic_trial');
  assert.equal(await page.evaluate(() => window.entryHarness.speech.length), 0);
  await click('Сказать');
  await click('Готово');
  await page
    .getByRole('button', { name: 'Ответить голосом', exact: true })
    .waitFor();
  assert.equal((await snap()).profile.entry08.config.companion, false);
  assert.equal(
    await page
      .getByText('Что уже получается читать самостоятельно?', { exact: true })
      .count(),
    0,
  );
  passed.push('Child voice flow without adult questionnaire or autoplay');
  const before = (await snap()).profile.entry08;
  await page.reload();
  await ready();
  assert.equal(
    (await snap()).profile.entry08.active.instanceId,
    before.active.instanceId,
  );
  assert.equal((await snap()).profile.entry08.total, before.total);
  passed.push('Reload preserves instance and reserved budget');
  const firstTarget = await page.evaluate(
    () =>
      window.entryHarness.bank.cards[
        window.entryHarness.controller.snapshot().profile.entry08.active.cardId
      ].target,
  );
  await page.evaluate((text) => window.entryHarness.say(text), firstTarget);
  await click('Ответить голосом');
  await click('Готово');
  await click('Дальше');
  await click('Пока трудно');
  await click('Дальше');
  const target = await page.evaluate(
    () =>
      window.entryHarness.bank.cards[
        window.entryHarness.controller.snapshot().profile.entry08.active.cardId
      ].target,
  );
  assert.equal(target, 'МА');
  await page.evaluate(() => window.entryHarness.say('МА'));
  await click('Ответить голосом');
  await click('Готово');
  await click('Дальше');
  await page
    .getByRole('button', { name: 'Начать занятие', exact: true })
    .waitFor();
  assert.equal(await page.evaluate(() => window.entryHarness.speech.length), 0);
  await click('Начать занятие');
  await page.getByLabel('Моя дорожка', { exact: true }).waitFor();
  let run = (await snap()).profile.personalPath08[
    (await snap()).profile.entry08.id
  ];
  assert.equal(run.cursor.nodeId, 'p1.C01');
  assert.equal(run.cursor.episodeId, 'ep.p1.C01.07');
  passed.push('Observed lower probe maps to C01 and real technology episode');
  for (let n = 0; n < 25; n++) {
    const state = await snap();
    run = state.profile.personalPath08[state.profile.entry08.id];
    if (run.observations.length) break;
    if (run.paused) {
      await click('Продолжить');
      continue;
    }
    if (run.active?.phase === 'info') {
      await click('Продолжить');
      continue;
    }
    if (run.active?.phase === 'feedback') {
      await click('Дальше · Enter');
      continue;
    }
    const task = await page.evaluate(() => {
      const h = window.entryHarness,
        s = h.controller.snapshot(),
        r = s.profile.personalPath08[s.profile.entry08.id];
      return h.supply.curriculum.items[r.active.taskId];
    });
    if (run.active?.phase === 'read') {
      await page.evaluate(
        (text) => window.entryHarness.say(text),
        task.kind === 'transform' ? task.answer.value : task.learnerText,
      );
      await click('Ответить голосом');
      await click('Готово');
    } else if (run.active?.phase === 'answer' && task.kind === 'compose') {
      const tokens = [...task.partTokens];
      let remaining = task.answer.joined;
      while (tokens.length) {
        const index = tokens.findIndex((t) => remaining.startsWith(t.text));
        assert(index >= 0);
        const [token] = tokens.splice(index, 1);
        await page
          .getByRole('button', {
            name: new RegExp('^Часть \\d+: ' + token.text + '$'),
          })
          .click();
        remaining = remaining.slice(token.text.length).trimStart();
      }
      await click('Проверить · Enter');
    } else
      throw Error(
        'Unhandled first lesson phase ' + run.active?.phase + ' ' + task.kind,
      );
  }
  run = (await snap()).profile.personalPath08[
    (await snap()).profile.entry08.id
  ];
  assert(run.observations.length > 0);
  assert.equal(run.observations[0].result, 'correct');
  assert.deepEqual((await snap()).profile.confirmedSkills, []);
  assert.deepEqual((await snap()).profile.attempts, []);
  await page.screenshot({
    path: path.join(dir, 'first-lesson-answer.png'),
    fullPage: true,
  });
  await page.reload();
  await ready();
  const restored = (await snap()).profile.personalPath08[
    (await snap()).profile.entry08.id
  ];
  assert.deepEqual(restored.observations, run.observations);
  passed.push(
    'Real learning answer saved and resumed without granting mastery',
  );
  for (const width of [390, 820, 1920]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1180 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: path.join(dir, `lesson-${width}.png`),
      fullPage: true,
    });
  }
  passed.push('390/820/1920 no horizontal overflow');
  // Independent adult path: eight answers, buttons skips the extra input screen.
  const adultContext = await browser.newContext();
  await adultContext.route('**/__entry08.html*', (route) =>
    route.fulfill({ contentType: 'text/html', body: html }),
  );
  const adult = await adultContext.newPage();
  adult.on('pageerror', (e) => errors.push(e.message));
  await adult.goto(address + '/base/__entry08.html');
  const aClick = async (name) => {
    await adult.getByRole('button', { name, exact: true }).click();
    await adult.waitForFunction(
      () =>
        document.querySelector('.entry08')?.getAttribute('aria-busy') ===
        'false',
    );
  };
  for (const name of [
    'Я о себе',
    '13 лет и старше',
    'Небольшие тексты',
    'Понимать прочитанное',
    'Лучше понимать',
    'Нет',
    'Нажатием',
    'Животные',
    'Дальше',
    'Круг',
  ])
    await aClick(name);
  await adult
    .getByRole('button', { name: 'Послушать рассказ', exact: true })
    .waitFor();
  assert.equal(
    await adult.evaluate(() => window.entryHarness.speech.length),
    0,
  );
  assert.equal(
    await adult.getByText('Как будем отвечать?', { exact: true }).count(),
    0,
  );
  await aClick('Послушать рассказ');
  assert.equal(await adult.locator('.entry08-pick').count(), 0);
  await aClick('Остановить рассказ');
  assert.equal(await adult.locator('.entry08-pick').count(), 0);
  await aClick('Послушать рассказ');
  await adult.evaluate(() => window.entryHarness.completeSound());
  await adult.locator('.entry08-pick').first().waitFor();
  await aClick('Послушать рассказ ещё раз');
  await aClick('Остановить рассказ');
  assert((await adult.locator('.entry08-pick').count()) > 0);
  const answer = await adult.evaluate(() => {
    const h = window.entryHarness,
      s = h.controller.snapshot().profile.entry08,
      c = h.bank.cards[s.active.cardId];
    return c.question.options.find((o) =>
      c.question.correctOptionIds.includes(o.id),
    ).text;
  });
  await aClick(answer);
  await aClick('Дальше');
  await adult
    .getByRole('button', { name: 'Начать занятие', exact: true })
    .waitFor();
  passed.push(
    'Adult eight answers; complete listening gate; cancellation/replay; real answer',
  );
  const voiceContext=await browser.newContext();
  await voiceContext.route('**/__entry08.html*',route=>route.fulfill({contentType:'text/html',body:html}));
  const voice=await voiceContext.newPage();voice.on('pageerror',e=>errors.push(e.message));
  await voice.goto(address+'/base/__entry08.html');
  const vClick=async name=>{await voice.getByRole('button',{name,exact:true}).click();await voice.waitForFunction(()=>document.querySelector('.entry08')?.getAttribute('aria-busy')==='false');};
  for(const name of ['Я о себе','13 лет и старше','Небольшие тексты','Пока не знаю','Подберите начало','Нет','Голосом','Животные','Дальше','Круг'])await vClick(name);
  await voice.getByRole('button',{name:'Сказать',exact:true}).waitFor();
  assert.equal(await voice.getByText('Как будем отвечать?',{exact:true}).count(),0);
  await vClick('Сказать');await vClick('Готово');
  const adultTarget=await voice.evaluate(()=>{const h=window.entryHarness;return h.bank.cards[h.controller.snapshot().profile.entry08.active.cardId].target;});
  await voice.evaluate(text=>window.entryHarness.say(text),adultTarget);
  await vClick('Ответить голосом');await vClick('Готово');
  await voice.locator('.entry08-pick').first().waitFor();
  const adultAnswer=await voice.evaluate(()=>{const h=window.entryHarness,c=h.bank.cards[h.controller.snapshot().profile.entry08.active.cardId];return c.question.options.find(o=>c.question.correctOptionIds.includes(o.id)).text;});
  await vClick(adultAnswer);
  const adultObservation=await voice.evaluate(()=>window.entryHarness.controller.snapshot().profile.entry08.observations.at(-1));
  assert.equal(adultObservation.result,'correct');assert.equal(adultObservation.reading.status,'observed');
  assert.equal(await voice.evaluate(()=>window.entryHarness.speech.length),0);
  passed.push('Adult voice: no ninth question, final passage reading plus correct meaning accepted');
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(dir, 'report.json'),
    JSON.stringify(
      {
        passed,
        errors,
        voice: 'mocked final results; no real-child-speech claim',
      },
      null,
      2,
    ),
  );
  console.log('PASS entry08 browser:', passed.join('; '));
} finally {
  await browser?.close();
  await server.close();
}
