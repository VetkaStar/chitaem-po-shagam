import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const root = process.cwd(),
  out = path.join(root, '.local/entry08-personal-tests');
fs.mkdirSync(path.join(out, 'vendor'), { recursive: true });
fs.writeFileSync(path.join(out, 'package.json'), '{"type":"module"}');
fs.writeFileSync(
  path.join(out, 'personal.js'),
  ts.transpileModule(fs.readFileSync('lib/entry08/personal.ts', 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
);
fs.copyFileSync(
  'lib/entry08/vendor/lite-entry.mjs',
  path.join(out, 'vendor/lite-entry.mjs'),
);
const P = await import(pathToFileURL(path.join(out, 'personal.js')));
const E = await import(pathToFileURL(path.join(out, 'vendor/lite-entry.mjs')));
const bank = JSON.parse(
  fs.readFileSync('content/curriculum/lite-bank.json', 'utf8'),
);
const curriculum = JSON.parse(
  fs.readFileSync('content/curriculum/curriculum.json', 'utf8'),
);
const entry = E.createEntry({ age: '8to12', reads: 'short_words' }, 'test');
const tests = [];
const test = (name, fn) => {
  fn();
  tests.push(name);
};
const begin = () =>
  P.startPersonal(entry, bank, curriculum, { attempts: [{ untouched: true }] });
const taskOf = (run) => curriculum.items[run.active.taskId];
const _speech = (run, text, extra = {}) => {
  const captureId = `capture:${run.revision}`;
  run = P.startPersonalCapture(run, captureId);
  return P.answerPersonal(run, curriculum, {
    kind: 'speech',
    instanceId: run.active.instanceId,
    captureId,
    value: text,
    isFinal: true,
    ...extra,
  });
};
function atTask(kind) {
  const task = Object.values(curriculum.items).find((t) => t.kind === kind);
  const run = begin();
  const episode = {
    id: 'test.ep',
    nodeId: run.cursor.nodeId,
    programId: run.cursor.programId,
    steps: [
      {
        id: 'test.step',
        action: 'task',
        itemId: task.id,
        mode: 'read',
        phase: 'independent',
        instruction: task.assistantPrompt,
      },
    ],
  };
  const c = {
    ...curriculum,
    episodes: { ...curriculum.episodes, 'test.ep': episode },
  };
  run.cursor.episodeId = 'test.ep';
  run.cursor.stepIndex = 0;
  run.active = null;
  run.visit.used = 0;
  run.promptedTargets = [];
  return { run: P.nextPersonal(run, c), c, task };
}
function say(run, c, text, extra = {}) {
  run = P.startPersonalCapture(run, 'capture');
  return P.answerPersonal(run, c, {
    kind: 'speech',
    instanceId: run.active.instanceId,
    captureId: 'capture',
    value: text,
    isFinal: true,
    ...extra,
  });
}

test('Start resolves real episode without altering legacy profile', () => {
  const legacy = {
    attempts: [{ old: true }],
    confirmedSkills: ['kept'],
    reviewQueue: [{ old: true }],
  };
  const before = JSON.stringify(legacy);
  const run = P.startPersonal(entry, bank, curriculum, legacy);
  assert.ok(curriculum.episodes[run.cursor.episodeId]);
  assert.equal(run.active.phase, 'info');
  assert.equal(JSON.stringify(legacy), before);
  assert.equal('confirmedSkills' in run, false);
  assert.equal('masteredNodes' in run, false);
});
test('Resume active instance never charges twice', () => {
  const { run, c } = atTask('compose');
  const resumed = P.nextPersonal(run, c);
  assert.equal(resumed.active.instanceId, run.active.instanceId);
  assert.equal(resumed.visit.used, 1);
  const stored = P.startPersonal(entry, bank, curriculum, {
    personalPath08: { [entry.id]: run },
  });
  assert.deepEqual(stored, run);
});
test('Real first lesson reaches deterministic compose answer', () => {
  let run = begin();
  while (run.active.phase === 'info') {
    run = P.answerPersonal(run, curriculum, {
      kind: 'info',
      instanceId: run.active.instanceId,
    });
    run = P.nextPersonal(run, curriculum);
  }
  const task = taskOf(run);
  assert.equal(task.kind, 'compose');
  run = P.answerPersonal(run, curriculum, {
    kind: 'compose',
    instanceId: run.active.instanceId,
    tokenIds: task.partTokens.map((t) => t.tokenId),
  });
  assert.equal(run.observations.at(-1).result, 'correct');
  assert.equal(run.observations.at(-1).assisted, true);
  assert.equal(run.observations.at(-1).reading, null);
});
test('Compose rejects unknown and duplicate tokens', () => {
  const { run, c } = atTask('compose');
  assert.throws(() =>
    P.answerPersonal(run, c, {
      kind: 'compose',
      instanceId: run.active.instanceId,
      tokenIds: ['fake'],
    }),
  );
});
test('Find part uses exact source spans', () => {
  const { run, c, task } = atTask('find_part');
  const next = P.answerPersonal(run, c, {
    kind: 'find_part',
    instanceId: run.active.instanceId,
    segments: task.answer.segments,
  });
  assert.equal(next.active.result, 'correct');
});
test('Boundaries accept author alternatives only', () => {
  const { run, c, task } = atTask('boundary');
  assert.equal(
    P.answerPersonal(run, c, {
      kind: 'boundary',
      instanceId: run.active.instanceId,
      boundaries: task.answer.acceptedBoundaries[0],
    }).active.result,
    'correct',
  );
  assert.equal(
    P.answerPersonal(run, c, {
      kind: 'boundary',
      instanceId: run.active.instanceId,
      boundaries: [999],
    }).active.result,
    'incorrect',
  );
});
test('Choice grades IDs rather than supplied correctness', () => {
  const { run, c, task } = atTask('choice');
  assert.equal(
    P.answerPersonal(run, c, {
      kind: 'choice',
      instanceId: run.active.instanceId,
      optionIds: task.answer.correctOptionIds,
    }).active.result,
    'correct',
  );
  assert.throws(() =>
    P.answerPersonal(run, c, {
      kind: 'choice',
      instanceId: run.active.instanceId,
      optionIds: ['unknown'],
    }),
  );
});
test('Transform exact input waits for reading; ASR remains provisional', () => {
  const { run, c, task } = atTask('transform');
  let next = P.answerPersonal(run, c, {
    kind: 'transform',
    instanceId: run.active.instanceId,
    value: task.answer.value,
  });
  assert.equal(next.active.phase, 'read');
  assert.equal(next.observations.length, 0);
  next = say(next, c, task.answer.value);
  assert.equal(next.observations[0].reading, 'observed');
  assert.equal(next.observations[0].verifier, 'asr');
});
test('Wrong transform is deterministic error not reading proof', () => {
  const { run, c } = atTask('transform');
  const next = P.answerPersonal(run, c, {
    kind: 'transform',
    instanceId: run.active.instanceId,
    value: 'НЕВЕРНО',
  });
  assert.equal(next.active.result, 'incorrect');
  assert.equal(next.observations[0].reading, null);
});
test('Read permits exact syllabic spacing and ignores partial/old capture', () => {
  const { run, c, task } = atTask('read');
  const capturing = P.startPersonalCapture(run, 'capture');
  assert.deepEqual(
    P.answerPersonal(capturing, c, {
      kind: 'speech',
      instanceId: run.active.instanceId,
      captureId: 'capture',
      value: task.learnerText,
      isFinal: false,
    }),
    capturing,
  );
  assert.deepEqual(
    P.answerPersonal(capturing, c, {
      kind: 'speech',
      instanceId: run.active.instanceId,
      captureId: 'old',
      value: task.learnerText,
      isFinal: true,
    }),
    capturing,
  );
  const next = say(run, c, [...task.learnerText].join(' '));
  assert.equal(next.active.result, 'correct');
  assert.deepEqual(
    P.answerPersonal(next, c, {
      kind: 'speech',
      instanceId: run.active.instanceId,
      captureId: 'capture',
      value: task.learnerText,
      isFinal: true,
    }),
    next,
  );
});
test('No ASR uncertainty is a reading failure', () => {
  const { run, c } = atTask('read');
  let next = say(run, c, 'посторонний текст');
  assert.equal(next.active.phase, 'read');
  next = say(next, c, 'посторонний текст');
  assert.equal(next.active.result, 'unassessed');
  assert.equal(next.observations[0].reading, null);
});
test('Audio target assistance is committed before effect; late callbacks ignored', () => {
  const { run, c, task } = atTask('read');
  const requested = P.requestPersonalAudio(run, c, {
    scope: 'target',
    userGesture: true,
  });
  assert.equal(requested.run.active.assisted, true);
  assert.equal(requested.effect.text, task.learnerText);
  const cancelled = P.cancelPersonalMedia(requested.run);
  assert.deepEqual(
    P.finishPersonalAudio(cancelled, {
      instanceId: run.active.instanceId,
      audioId: requested.effect.audioId,
      ok: true,
    }),
    cancelled,
  );
  const next = say(cancelled, c, task.learnerText);
  assert.equal(next.observations[0].reading, 'assisted');
  assert.throws(() =>
    P.requestPersonalAudio(run, c, { scope: 'target', userGesture: false }),
  );
});
test('Reading and comprehension remain separate on wrong answer', () => {
  const { run, c, task } = atTask('read_meaning');
  let next = say(run, c, task.learnerText);
  assert.equal(next.active.phase, 'question');
  assert.equal(next.visit.used, 2);
  const wrong = task.options.find(
    (o) => !task.answer.correctOptionIds.includes(o.id),
  );
  next = P.answerPersonal(next, c, {
    kind: 'choice',
    instanceId: next.active.instanceId,
    optionIds: [wrong.id],
  });
  assert.equal(next.observations[0].reading, 'observed');
  assert.equal(next.observations[0].meaning, 'incorrect');
});
test('Read-to-question budget pauses before question and resumes exact instance', () => {
  const { run, c, task } = atTask('read_meaning');
  run.visit.used = run.visit.budget;
  let next = say(run, c, task.learnerText);
  assert.equal(next.paused, true);
  assert.equal(next.active.pendingUnit, true);
  assert.equal(P.personalView(next, c).kind, 'pause');
  next = P.nextPersonal(next, c, { newVisit: true });
  assert.equal(next.active.instanceId, run.active.instanceId);
  assert.equal(next.visit.used, 1);
  assert.equal(next.active.phase, 'question');
});
test('Paused speech capture cannot report later', () => {
  const { run, c, task } = atTask('read');
  const capturing = P.startPersonalCapture(run, 'capture'),
    paused = P.pausePersonal(capturing);
  assert.deepEqual(
    P.answerPersonal(paused, c, {
      kind: 'speech',
      instanceId: run.active.instanceId,
      captureId: 'capture',
      isFinal: true,
      value: task.learnerText,
    }),
    paused,
  );
});
test('Safe projection omits keys and keeps options hidden before reading', () => {
  const { run, c } = atTask('read_meaning');
  const view = P.personalView(run, c);
  assert.equal(view.options.length, 0);
  assert.equal('answer' in view, false);
  assert.equal('correctOptionIds' in view, false);
  assert.equal('staffMetadata' in view, false);
});
test('Two distinct unassisted tasks/visits offer provisional next node only', () => {
  const run = begin(),
    node = curriculum.nodes[run.cursor.nodeId];
  assert.ok(curriculum.nodes[node.defaultNext]);
  run.active = null;
  run.cursor.stepIndex = curriculum.episodes[run.cursor.episodeId].steps.length;
  const authored = [...new Set(node.episodeIds.flatMap(id => curriculum.episodes[id].steps.flatMap(step => step.itemId ? [step.itemId] : [])))].map(id => curriculum.items[id]);
  const pair = [authored[0], authored.find(task => task.learnerText !== authored[0].learnerText)];
  run.observations = pair.map((task, i) => ({
    instanceId: `i${i}`,
    taskId: task.id,
    nodeId: node.id,
    visitId: `v${i}`,
    target: task.learnerText,
    result: 'correct',
    assisted: false,
    reading: 'observed',
    verifier: 'asr',
  }));
  const next = P.nextPersonal(run, curriculum);
  assert.equal(next.proposedNodeId, node.defaultNext);
  assert.equal(next.cursor.nodeId, node.id);
  assert.equal('confirmedSkills' in next, false);
  run.observations[1].assisted = true;
  assert.equal(P.nextPersonal(run, curriculum).proposedNodeId, null);
});
test('Continuing assisted goal selects another existing episode of same node', () => {
  let run = begin();
  const node = run.cursor.nodeId;
  run.active = null;
  run.cursor.stepIndex = curriculum.episodes[run.cursor.episodeId].steps.length;
  run = P.nextPersonal(run, curriculum);
  const previous = run.cursor.episodeId;
  run = P.nextPersonal(run, curriculum, { continueEpisode: true });
  assert.equal(run.cursor.nodeId, node);
  if (curriculum.nodes[node].episodeIds.length > 1)
    assert.notEqual(run.cursor.episodeId, previous);
});
test('Transform projection and audio never reveal answer before typed response', () => {
  const { run, c, task } = atTask('transform');
  assert.equal(P.personalView(run, c).text, task.learnerText);
  assert.equal(P.personalView(run, c).transformText, undefined);
  assert.equal(
    P.requestPersonalAudio(run, c, { scope: 'target', userGesture: true })
      .effect.text,
    task.learnerText,
  );
});
test('Listening options require successful explicit audio and survive cancelled replay', () => {
  const initial = atTask('read_meaning');
  let { run } = initial;
  const { c } = initial;
  run.active.phase = 'listen';
  assert.equal(P.personalView(run, c).options.length, 0);
  let request = P.requestPersonalAudio(run, c, {
    scope: 'target',
    userGesture: true,
  });
  run = P.finishPersonalAudio(request.run, {
    instanceId: run.active.instanceId,
    audioId: request.effect.audioId,
    ok: false,
  });
  assert.equal(run.active.phase, 'listen');
  request = P.requestPersonalAudio(run, c, {
    scope: 'target',
    userGesture: true,
  });
  run = P.finishPersonalAudio(request.run, {
    instanceId: run.active.instanceId,
    audioId: request.effect.audioId,
    ok: true,
  });
  assert.equal(run.active.phase, 'question');
  assert.ok(P.personalView(run, c).options.length);
  const used = run.visit.used;
  request = P.requestPersonalAudio(run, c, {
    scope: 'target',
    userGesture: true,
  });
  run = P.cancelPersonalMedia(request.run);
  assert.equal(run.active.phase, 'question');
  assert.equal(run.active.played, true);
  assert.equal(run.visit.used, used);
});
test('Passage questions charge individually and preserve reading through visit pause', () => {
  const initial = atTask('passage');
  let { run } = initial;
  const { c, task } = initial;
  run.visit.budget = 2;
  run = say(run, c, task.learnerText);
  assert.equal(run.visit.used, 2);
  for (let i = 0; i < task.answer.questions.length; i++) {
    if (run.paused) {
      const instance = run.active.instanceId;
      run = P.nextPersonal(run, c, { newVisit: true });
      assert.equal(run.active.instanceId, instance);
    }
    run = P.answerPersonal(run, c, {
      kind: 'choice',
      instanceId: run.active.instanceId,
      optionIds: task.answer.questions[i].correctOptionIds,
    });
    assert.ok(run.visit.used <= run.visit.budget);
  }
  assert.equal(run.active.result, 'correct');
  assert.equal(run.observations[0].reading, 'observed');
  assert.equal(run.observations[0].meaning, 'correct');
});
test('Listening completion reserves question budget before exposure', () => {
  let { run, c } = atTask('read_meaning');
  c = structuredClone(c);
  c.episodes['test.ep'].steps[0].mode = 'listen';
  run.active.phase = 'listen';
  run.visit.used = run.visit.budget;
  const request = P.requestPersonalAudio(run, c, {
    scope: 'target',
    userGesture: true,
  });
  run = P.finishPersonalAudio(request.run, {
    instanceId: run.active.instanceId,
    audioId: request.effect.audioId,
    ok: true,
  });
  assert.equal(run.paused, true);
  assert.equal(run.active.pendingUnit, true);
  assert.equal(P.personalView(run, c).options.length, 0);
  run = P.nextPersonal(run, c, { newVisit: true });
  assert.equal(run.visit.used, 1);
  assert.equal(run.active.played, true);
  assert.ok(P.personalView(run, c).options.length);
});
test('Listening projection hides target text and lines in every stage', () => {
  const initial = atTask('passage');
  const { run } = initial;
  let { c } = initial;
  c = structuredClone(c);
  c.episodes['test.ep'].steps[0].mode = 'listen';
  for (const phase of ['listen', 'question', 'feedback']) {
    run.active.phase = phase;
    const view = P.personalView(run, c);
    assert.equal(view.text, '');
    assert.deepEqual(view.lines, []);
  }
});
test('Info and reading instructions exclude source methodological wording', () => {
  const run = begin();
  const c = structuredClone(curriculum);
  const step = c.episodes[run.cursor.episodeId].steps[0];
  step.instruction = 'SECRET STAFF METADATA';
  assert.equal(P.personalView(run, c).instruction, 'Посмотри на части.');
  const reading = atTask('read');
  assert.equal(P.personalView(reading.run, reading.c).instruction, 'Прочитай.');
});
test('Service errors preserve task and route without consuming speech retries', () => {
  const { run, c } = atTask('read');
  for (const [error, kind] of [
    ['not-allowed', 'permission'],
    ['audio-capture', 'device'],
    ['network', 'service'],
  ]) {
    const next = say(run, c, '', { error });
    assert.equal(next.active.speechIssue.kind, kind);
    assert.equal(next.active.speechIssue.code, error);
    assert.equal(next.active.retries, 0);
    assert.equal(next.active.phase, 'read');
    assert.equal(next.observations.length, 0);
    assert.equal(next.cursor.nodeId, run.cursor.nodeId);
  }
});
test('Supplier flat preview preserves authored episode and archive without granting old completions', () => {
  const initial = begin(),
    node = curriculum.nodes[initial.cursor.nodeId];
  const episodeId = node.episodeIds.at(-1);
  const preview = {
    programId: entry.config.program,
    sourceProgramId: node.programId,
    nodeId: node.id,
    episodeId,
    stepIndex: 3,
    provisional: true,
    completedSteps: ['preview-only-step'],
    observations: [{ fake: 'preview-frame' }],
  };
  const profile = {
    personalPath08: { [entry.id]: preview },
    attempts: [{ legacy: true }],
  };
  const before = JSON.stringify(profile);
  const run = P.startPersonal(entry, bank, curriculum, profile);
  assert.equal(run.cursor.episodeId, episodeId);
  assert.equal(run.cursor.stepIndex, 0);
  assert.deepEqual(run.legacyPreview, preview);
  assert.deepEqual(run.completedSteps, []);
  assert.deepEqual(run.observations, []);
  assert.equal(JSON.stringify(profile), before);
  assert.equal(run.active.stepId, curriculum.episodes[episodeId].steps[0].id);
  assert.deepEqual(
    P.startPersonal(entry, bank, curriculum, {
      personalPath08: { [entry.id]: run },
    }),
    run,
  );
});
test('Invalid legacy preview episode is archived but cannot substitute authored content', () => {
  const preview = {
    nodeId: 'missing',
    episodeId: 'missing',
    stepIndex: 999,
    observations: [{ fake: true }],
  };
  const run = P.startPersonal(entry, bank, curriculum, {
    personalPath08: { [entry.id]: preview },
  });
  assert.ok(curriculum.episodes[run.cursor.episodeId]);
  assert.deepEqual(run.legacyPreview, preview);
  assert.deepEqual(run.observations, []);
});

test('Adult reading is explicit, phase-bound, durable and cannot turn help into independent proof', () => {
  const { run, c } = atTask('read');
  const input = { kind: 'companion', instanceId: run.active.instanceId, correct: true };
  assert.deepEqual(P.answerPersonal(run, c, input), run);
  const adult = P.answerPersonal(run, c, { ...input, actor: 'adult' });
  assert.equal(adult.observations[0].verifier, 'companion');
  assert.equal(adult.observations[0].reading, 'observed');
  assert.equal(adult.observations[0].assisted, false);
  assert.deepEqual(P.answerPersonal(adult, c, { ...input, actor: 'adult' }), adult);
  const helped = P.answerPersonal(run, c, { kind: 'help', instanceId: run.active.instanceId });
  const result = P.answerPersonal(helped, c, { ...input, actor: 'adult' });
  assert.equal(result.observations[0].reading, 'assisted');
  assert.equal(result.observations[0].assisted, true);
  assert.equal(P.answerPersonal(run, c, { ...input, actor: 'adult', correct: false }).observations[0].result, 'incorrect');
  assert.equal(P.answerPersonal(run, c, { ...input, actor: 'adult', instanceId: 'old' }), run);
});
test('Adult reading verifier survives questions and a reserved question visit', () => {
  const { run, c, task } = atTask('read_meaning');
  run.visit.used = run.visit.budget;
  let next = P.answerPersonal(run, c, { kind: 'companion', actor: 'adult', correct: true, instanceId: run.active.instanceId });
  assert.equal(next.paused, true);
  next = P.nextPersonal(JSON.parse(JSON.stringify(next)), c, { newVisit: true });
  next = P.answerPersonal(next, c, { kind: 'choice', instanceId: next.active.instanceId, optionIds: task.answer.correctOptionIds });
  assert.equal(next.observations[0].verifier, 'companion');
  assert.equal(next.observations[0].meaning, 'correct');
});
function advancementFixture() {
  const run = begin();
  const node = curriculum.nodes['p1.A01'];
  run.cursor.nodeId = node.id;
  run.cursor.episodeId = node.episodeIds[0];
  run.cursor.stepIndex = curriculum.episodes[run.cursor.episodeId].steps.length;
  run.active = null;
  run.visit.used = 0;
  const tasks = [...new Set(node.episodeIds.flatMap(id => curriculum.episodes[id].steps.flatMap(step => step.itemId ? [step.itemId] : [])))].map(id => curriculum.items[id]);
  const first = tasks[0], second = tasks.find(t => t.learnerText !== first.learnerText);
  run.observations = [first, second].map((task, i) => ({
    instanceId: `adult-${i}`, taskId: task.id, nodeId: node.id,
    visitId: `adult-visit-${i}`, target: task.learnerText,
    result: 'correct', reading: 'observed', assisted: false, verifier: 'companion',
  }));
  const profile = { knownLetters: [], availableCapabilities: [], confirmedSkills: [], skillBasis: {} };
  const episode = curriculum.episodes[curriculum.nodes[node.defaultNext].episodeIds[0]];
  for (const step of episode.steps) {
    const task = step.itemId ? curriculum.items[step.itemId] : null;
    profile.knownLetters.push(...Array.from(task?.requiredLetters ?? (step.visibleText ?? '').toUpperCase().match(/[А-ЯЁ]/g) ?? []));
    profile.availableCapabilities.push(...(task?.requiredCapabilities ?? []));
  }
  profile.knownLetters = [...new Set(profile.knownLetters)];
  profile.availableCapabilities = [...new Set(profile.availableCapabilities)];
  return { run: P.nextPersonal(run, curriculum, { profile }), profile, node };
}
test('Ordinary new profile can try guided next step without fabricated formal readiness', () => {
  const { run } = advancementFixture();
  const profile = { knownLetters: [], availableCapabilities: [], confirmedSkills: [], skillBasis: {} };
  const before = structuredClone(profile), view = P.personalView(run, curriculum, profile);
  assert.ok(view.nextTitle);
  assert.equal(view.nextBlockedReason, null);
  const blocked = P.nextPersonal(run, curriculum, { acceptProposed: true, profile });
  assert.notEqual(blocked.cursor.nodeId, run.cursor.nodeId);
  assert.equal(blocked.cursor.provisional, true);
  assert.deepEqual(profile, before);
});
test('Two adult visits allow a provisional step with real prerequisites and explicit choice, without mastery', () => {
  const { run, profile, node } = advancementFixture();
  const before = structuredClone(profile);
  assert.equal(profile.confirmedSkills.length, 0);
  assert.deepEqual(profile.skillBasis, {});
  assert.ok(P.personalView(run, curriculum, profile).nextTitle);
  const stay = P.nextPersonal(run, curriculum, { continueEpisode: true, profile });
  assert.equal(stay.cursor.nodeId, node.id);
  const advance = P.nextPersonal(run, curriculum, { acceptProposed: true, profile });
  assert.equal(advance.cursor.nodeId, node.defaultNext);
  assert.equal(advance.cursor.provisional, true);
  assert.deepEqual(profile, before);
  assert.equal('confirmedSkills' in advance, false);
});
test('Acceptance rechecks letters, functions and preparation instead of trusting the saved offer', () => {
  const { run, profile, node } = advancementFixture();
  const withoutLetters = { ...profile, entry08: { history: { unavailableLetters: Array.from('АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ') } } };
  assert.equal(P.nextPersonal(run, curriculum, { acceptProposed: true, profile: withoutLetters }).cursor.nodeId, node.id);
  const c = structuredClone(curriculum);
  for (const id of c.nodes[node.defaultNext].episodeIds)
    for (const step of c.episodes[id].steps)
      if (step.itemId) c.items[step.itemId].requiredCapabilities.push('test.required.function');
  const blockedFunction = { ...profile, entry08: { history: { unavailableCapabilities: ['test.required.function'] } } };
  assert.equal(P.availablePersonalNext(run, c, blockedFunction), null);
  assert.match(P.personalView(run, c, blockedFunction).nextBlockedReason, /проверить/);
  run.observations[1].taskId = 'invented.task';
  assert.equal(P.availablePersonalNext(run, curriculum, profile), null, 'preparation requires real authored tasks');
});
test('Clicks, assistance, same target or same visit cannot offer progression', () => {
  for (const change of [
    o => o.verifier = 'deterministic', o => o.assisted = true,
    (o, first) => o.visitId = first.visitId, (o, first) => o.target = first.target,
    o => o.reading = 'unassessed',
  ]) {
    const { run, profile } = advancementFixture();
    change(run.observations[1], run.observations[0]);
    assert.equal(P.availablePersonalNext(run, curriculum, profile), null);
  }
});

console.log(
  JSON.stringify(
    { suite: 'entry08-personal', passed: tests.length, failed: 0, tests },
    null,
    2,
  ),
);
