import type {
  Episode,
  Node,
  Task,
  Segment,
  Option,
} from '../curriculum/contracts';
import {
  learningPlan,
  speechIssue as classifySpeechIssue,
} from './vendor/lite-entry.mjs';

export interface PersonalCurriculum {
  items: Record<string, Task>;
  episodes: Record<string, Episode>;
  nodes: Record<string, Node>;
}
export interface PersonalObservation {
  instanceId: string;
  taskId: string;
  nodeId: string;
  visitId: string;
  target: string;
  result: 'correct' | 'incorrect' | 'unassessed' | 'skipped';
  assisted: boolean;
  reading: 'observed' | 'assisted' | 'unassessed' | null;
  verifier: 'asr' | 'deterministic' | 'none';
  meaning?: 'correct' | 'incorrect';
}
export interface PersonalSpeechIssue {
  kind: string;
  code: string;
  message: string;
  retryable: boolean;
  actions: string[];
}
export interface PersonalRun {
  version: '0.8.1';
  /** Supplier demo cursor retained for audit only; never counted as completed learning. */
  legacyPreview?: unknown;
  entryId: string;
  revision: number;
  cursor: {
    programId: string;
    sourceProgramId: string;
    nodeId: string;
    episodeId: string;
    stepIndex: number;
    provisional: true;
  };
  visit: { id: string; number: number; used: number; budget: number };
  completedSteps: string[];
  completedEpisodes: string[];
  observations: PersonalObservation[];
  promptedTargets: string[];
  exposedTaskIds: string[];
  active: {
    instanceId: string;
    stepId: string;
    taskId: string | null;
    phase: 'info' | 'read' | 'listen' | 'question' | 'answer' | 'feedback';
    assisted: boolean;
    played: boolean;
    reading: PersonalObservation['reading'];
    questionIndex: number;
    meaningCorrect: boolean;
    result: PersonalObservation['result'] | null;
    retries: number;
    captureId: string | null;
    pendingUnit: boolean;
    hintShown: boolean;
    speechIssue?: PersonalSpeechIssue | null;
    audio: { id: string; scope: 'instruction' | 'target' | 'option' } | null;
  } | null;
  paused: boolean;
  episodeComplete: boolean;
  serial: number;
  proposedNodeId: string | null;
}
export type PersonalAnswer = {
  instanceId: string;
  kind:
    | 'speech'
    | 'choice'
    | 'compose'
    | 'find_part'
    | 'boundary'
    | 'transform'
    | 'skip'
    | 'help'
    | 'info'
    | 'unassessed';
  value?: string;
  optionIds?: string[];
  tokenIds?: string[];
  segments?: Segment[];
  boundaries?: number[];
  isFinal?: boolean;
  confidence?: number;
  error?: string;
  captureId?: string;
};
export interface PersonalView {
  kind: 'info' | 'task' | 'feedback' | 'pause' | 'complete';
  instanceId: string | null;
  title: string;
  instruction: string;
  text: string;
  taskKind: Task['kind'] | null;
  phase: PersonalRun['active'] extends infer A
    ? A extends { phase: infer P }
      ? P
      : never
    : never;
  options: Option[];
  tokens: { tokenId: string; text: string }[];
  lines: string[];
  hint: string | null;
  audioAvailable: boolean;
  canContinue: boolean;
  result: PersonalObservation['result'] | null;
  assisted: boolean;
  questionIndex: number;
  questionCount: number;
  answerKind: Task['answer']['kind'] | null;
  joiner: string;
  questionId: string | null;
  sourceTaskId: string | null;
  mode: 'read' | 'listen' | 'shared';
  transformText?: string;
  speechIssue?: PersonalSpeechIssue | null;
}

export type EntryForPersonal = {
  id: string;
  visit: { id: string; number: number; used: number; budget: number };
  config: { program: string };
  [key: string]: unknown;
};
const clone = <T>(value: T): T => structuredClone(value);
const normalized = (value: string) =>
  value
    .normalize('NFC')
    .replace(/[\u0300\u0301]/g, '')
    .toUpperCase()
    .replace(/[^А-ЯЁ0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const matches = (value: string, expected: string) =>
  normalized(value) === normalized(expected) ||
  (!normalized(expected).includes(' ') &&
    normalized(value).replace(/ /g, '') === normalized(expected));
const sameSet = (a: unknown[], b: unknown[]) =>
  a.length === b.length &&
  new Set(a).size === a.length &&
  [...a].sort().every((v, i) => v === [...b].sort()[i]);
const touched = (run: PersonalRun) => {
  run.revision++;
  return run;
};
const source = (run: PersonalRun, c: PersonalCurriculum) => {
  const episode = c.episodes[run.cursor.episodeId];
  if (!episode || episode.nodeId !== run.cursor.nodeId)
    throw new Error('PERSONAL_EPISODE_MISSING');
  const step = episode.steps[run.cursor.stepIndex];
  return {
    episode,
    step,
    task: step?.itemId ? c.items[step.itemId] : undefined,
  };
};
const target = (task: Task) =>
  task.kind === 'transform' && task.answer.kind === 'exact'
    ? task.answer.value
    : task.learnerText;
const questionTask = (task: Task) =>
  task.kind === 'passage' || task.kind === 'read_meaning';
const taskCost = (_task: Task) => 1;
const openQuestion = (run: PersonalRun) => {
  const a = run.active!;
  a.phase = 'question';
  if (run.visit.used >= run.visit.budget) {
    a.pendingUnit = true;
    run.paused = true;
  } else {
    run.visit.used++;
    a.pendingUnit = false;
  }
  return touched(run);
};

/** Pure sidecar. Never modifies the legacy profile or grants curriculum mastery. */
export function startPersonal(
  entry: EntryForPersonal,
  bank: unknown,
  curriculum: PersonalCurriculum,
  profile: Record<string, unknown>,
): PersonalRun {
  const saved = (
    profile.personalPath08 as
      | Record<string, Partial<PersonalRun> & Record<string, unknown>>
      | undefined
  )?.[entry.id];
  if (saved?.version === '0.8.1' && saved.cursor && saved.visit)
    return clone(saved as PersonalRun);
  const plan = learningPlan(entry, bank, curriculum, profile);
  // The supplied adapter stored a flat preview cursor. Preserve its authored
  // episode, but replay it as a real lesson: preview frames prove no answers.
  const legacyEpisode =
    typeof saved?.episodeId === 'string'
      ? curriculum.episodes[saved.episodeId]
      : undefined;
  const legacyNode =
    legacyEpisode && typeof saved?.nodeId === 'string'
      ? curriculum.nodes[saved.nodeId]
      : undefined;
  const preserveEpisode =
    !!legacyEpisode &&
    !!legacyNode &&
    legacyEpisode.nodeId === legacyNode.id &&
    legacyNode.episodeIds.includes(legacyEpisode.id);
  const cursor = preserveEpisode
    ? {
        programId: entry.config.program,
        sourceProgramId: legacyNode!.programId,
        nodeId: legacyNode!.id,
        episodeId: legacyEpisode!.id,
        stepIndex: 0,
        provisional: true as const,
      }
    : { ...plan.cursor, provisional: true as const };
  const run: PersonalRun = {
    version: '0.8.1',
    ...(saved ? { legacyPreview: clone(saved) } : {}),
    entryId: entry.id,
    revision: 0,
    cursor,
    visit: clone(entry.visit),
    completedSteps: [],
    completedEpisodes: [],
    observations: [],
    promptedTargets: [],
    exposedTaskIds: [],
    active: null,
    paused: false,
    episodeComplete: false,
    serial: 0,
    proposedNodeId: null,
  };
  // Entry prompts are carried forward: an echoed answer is never independent evidence.
  const prompts = entry.prompts as { target: string }[] | undefined;
  run.promptedTargets = [
    ...new Set((prompts ?? []).map((p) => normalized(p.target))),
  ];
  return nextPersonal(run, curriculum);
}

function observe(
  run: PersonalRun,
  task: Task,
  result: PersonalObservation['result'],
  verifier: PersonalObservation['verifier'],
  meaning?: PersonalObservation['meaning'],
) {
  const active = run.active!;
  if (run.observations.some((o) => o.instanceId === active.instanceId))
    return run;
  run.observations.push({
    instanceId: active.instanceId,
    taskId: task.id,
    nodeId: run.cursor.nodeId,
    visitId: run.visit.id,
    target: target(task),
    result,
    assisted: active.assisted,
    reading: active.reading,
    verifier,
    ...(meaning ? { meaning } : {}),
  });
  active.phase = 'feedback';
  active.result = result;
  active.captureId = null;
  active.audio = null;
  return touched(run);
}
function proposed(run: PersonalRun, c: PersonalCurriculum) {
  const good = run.observations.filter(
    (o) =>
      o.nodeId === run.cursor.nodeId &&
      o.result === 'correct' &&
      !o.assisted &&
      o.verifier === 'asr' &&
      o.reading === 'observed',
  );
  const enough = good.some((a) =>
    good.some(
      (b) =>
        a.taskId !== b.taskId &&
        a.visitId !== b.visitId &&
        normalized(a.target) !== normalized(b.target),
    ),
  );
  const next = c.nodes[run.cursor.nodeId]?.defaultNext;
  // Teaching progression is provisional; this never writes confirmedSkills or completedNodes.
  return enough && next && c.nodes[next] ? next : null;
}

/** Opening reserves the first answer; subsequent questions reserve their own units. */
export function nextPersonal(
  previous: PersonalRun,
  c: PersonalCurriculum,
  options: {
    newVisit?: boolean;
    continueEpisode?: boolean;
    acceptProposed?: boolean;
  } = {},
): PersonalRun {
  const run = clone(previous);
  if (options.newVisit) {
    if (!run.paused) throw new Error('PERSONAL_NOT_PAUSED');
    run.visit = {
      ...run.visit,
      number: run.visit.number + 1,
      id: `${run.entryId}:personal:v${run.visit.number + 1}`,
      used: 0,
    };
    run.paused = false;
    run.promptedTargets = [];
  }
  if (run.paused) return run;
  if (run.active?.pendingUnit) {
    run.active.pendingUnit = false;
    run.visit.used++;
    return touched(run);
  }
  if (run.active) {
    if (run.active.phase !== 'feedback') return run;
    run.completedSteps.push(run.active.stepId);
    run.active = null;
    run.cursor.stepIndex++;
  }
  if (run.episodeComplete) {
    if (!options.continueEpisode && !options.acceptProposed) return run;
    const nodeId =
      options.acceptProposed && run.proposedNodeId
        ? run.proposedNodeId
        : run.cursor.nodeId;
    const node = c.nodes[nodeId];
    if (!node) throw new Error('PERSONAL_NODE_MISSING');
    const episodes = node.episodeIds.filter((id) => c.episodes[id]);
    const unseen = episodes.find((id) => !run.completedEpisodes.includes(id));
    const currentIndex = episodes.indexOf(run.cursor.episodeId);
    const episodeId = unseen ?? episodes[(currentIndex + 1) % episodes.length];
    if (!episodeId) throw new Error('PERSONAL_EPISODE_MISSING');
    run.cursor = {
      ...run.cursor,
      nodeId,
      sourceProgramId: node.programId,
      episodeId,
      stepIndex: 0,
    };
    run.episodeComplete = false;
    run.proposedNodeId = null;
  }
  const { step, task } = source(run, c);
  if (!step) {
    run.episodeComplete = true;
    run.completedEpisodes = [
      ...new Set([...run.completedEpisodes, run.cursor.episodeId]),
    ];
    run.proposedNodeId = proposed(run, c);
    return touched(run);
  }
  if (step.itemId && !task) throw new Error('PERSONAL_TASK_MISSING');
  const cost = task ? taskCost(task) : 0;
  if (run.visit.used + cost > run.visit.budget) {
    run.paused = true;
    return touched(run);
  }
  run.visit.used += cost;
  const instanceId = `${run.entryId}:personal:${++run.serial}`;
  const phase = !task
    ? 'info'
    : step.mode === 'listen' && questionTask(task)
      ? 'listen'
      : task.kind === 'read' || questionTask(task)
        ? 'read'
        : task.kind === 'choice'
          ? 'question'
          : 'answer';
  const assisted =
    !!task && run.promptedTargets.includes(normalized(target(task)));
  run.active = {
    instanceId,
    stepId: step.id,
    taskId: task?.id ?? null,
    phase,
    assisted,
    played: false,
    reading: null,
    questionIndex: 0,
    meaningCorrect: true,
    result: null,
    retries: 0,
    captureId: null,
    pendingUnit: false,
    hintShown: false,
    audio: null,
  };
  if (task) run.exposedTaskIds.push(task.id);
  // Visible chunk scaffolding is help even without audio.
  if (!task && step.chunks?.length) {
    const full = normalized(step.chunks.join(''));
    if (!run.promptedTargets.includes(full)) run.promptedTargets.push(full);
  }
  return touched(run);
}

const INFO_INSTRUCTIONS: Record<string, string> = {
  show_chunks: 'Посмотри на части.',
  model_blend: 'Послушай, как соединяются части.',
  meaning_anchor: 'Послушай, что означает слово.',
  show_whole: 'Посмотри на слово.',
  fade_support: 'Теперь попробуй без подсказки.',
};
const TASK_INSTRUCTIONS: Partial<Record<Task['kind'], string>> = {
  read: 'Прочитай.',
  compose: 'Собери по порядку.',
  boundary: 'Раздели слово на слоги.',
  passage: 'Прочитай. Потом ответь на вопрос.',
  read_meaning: 'Прочитай. Потом выбери значение.',
};

export function personalView(
  run: PersonalRun,
  c: PersonalCurriculum,
): PersonalView {
  const { episode, step, task } = source(run, c),
    active = run.active;
  const question =
    task?.answer.kind === 'question_set'
      ? task.answer.questions[active?.questionIndex ?? 0]
      : null;
  const showOptions =
    !run.paused && (active?.phase === 'question' || active?.phase === 'answer');
  const listening = step?.mode === 'listen';
  return {
    kind: run.paused
      ? 'pause'
      : run.episodeComplete
        ? 'complete'
        : active?.phase === 'feedback'
          ? 'feedback'
          : task
            ? 'task'
            : 'info',
    instanceId: active?.instanceId ?? null,
    title: episode.title,
    instruction:
      active?.phase === 'question'
        ? (question?.prompt ?? task?.assistantPrompt ?? 'Выбери ответ.')
        : task
          ? listening
            ? 'Послушай рассказ. Потом ответь на вопрос.'
            : (TASK_INSTRUCTIONS[task.kind] ?? task.assistantPrompt)
          : step
            ? (INFO_INSTRUCTIONS[step.action] ?? 'Посмотри на пример.')
            : 'Занятие завершено.',
    text: listening
      ? ''
      : task
        ? task.kind === 'transform' && active?.phase !== 'read'
          ? task.learnerText
          : target(task)
        : (step?.visibleText ?? ''),
    taskKind: task?.kind ?? null,
    phase: active?.phase ?? 'info',
    options: showOptions ? clone(question?.options ?? task?.options ?? []) : [],
    tokens:
      task?.kind === 'compose' ? clone(task.partTokens ?? []).reverse() : [],
    lines: listening
      ? []
      : clone(task?.lines ?? (task ? [task.learnerText] : [])),
    hint: !listening && active?.hintShown ? (task?.hints[0] ?? null) : null,
    speechIssue: clone(active?.speechIssue ?? null),
    audioAvailable: !!(task || step?.spokenText),
    canContinue: active?.phase === 'info' || active?.phase === 'feedback',
    result: active?.result ?? null,
    assisted: active?.assisted ?? false,
    questionIndex: active?.questionIndex ?? 0,
    questionCount:
      task?.answer.kind === 'question_set'
        ? task.answer.questions.length
        : task?.kind === 'read_meaning'
          ? 1
          : 0,
    answerKind: task?.answer.kind ?? null,
    joiner:
      task?.answer.kind === 'ordered_parts' ? (task.answer.joiner ?? '') : '',
    questionId: question?.id ?? null,
    sourceTaskId: task?.id ?? null,
    mode: step?.mode ?? 'read',
    transformText:
      task?.kind === 'transform' && active?.phase === 'read'
        ? target(task)
        : undefined,
  };
}

export function startPersonalCapture(
  previous: PersonalRun,
  captureId: string,
): PersonalRun {
  if (
    !previous.active ||
    !['read', 'question'].includes(previous.active.phase) ||
    previous.paused
  )
    throw new Error('PERSONAL_CAPTURE_UNAVAILABLE');
  const run = cancelPersonalMedia(previous);
  run.active!.captureId = captureId;
  run.active!.speechIssue = null;
  return touched(run);
}
export function cancelPersonalMedia(previous: PersonalRun): PersonalRun {
  const run = clone(previous);
  if (run.active) {
    run.active.audio = null;
    run.active.captureId = null;
  }
  return touched(run);
}
export function pausePersonal(previous: PersonalRun): PersonalRun {
  const run = cancelPersonalMedia(previous);
  run.paused = true;
  return touched(run);
}

function speechFailure(run: PersonalRun, task: Task, code: string) {
  const issue = classifySpeechIssue(code) as PersonalSpeechIssue;
  run.active!.speechIssue = issue;
  if (!issue.retryable) return touched(run);
  run.active!.retries++;
  return run.active!.retries >= 2
    ? observe(run, task, 'unassessed', 'none')
    : touched(run);
}

export function answerPersonal(
  previous: PersonalRun,
  c: PersonalCurriculum,
  answer: PersonalAnswer,
): PersonalRun {
  const active = previous.active;
  if (
    !active ||
    active.instanceId !== answer.instanceId ||
    active.phase === 'feedback' ||
    previous.paused
  )
    return previous;
  let run = clone(previous);
  const a = run.active!,
    { task } = source(run, c);
  if (answer.kind === 'info') {
    if (a.phase !== 'info') throw new Error('PERSONAL_NOT_INFO');
    a.phase = 'feedback';
    return touched(run);
  }
  if (!task) throw new Error('PERSONAL_NOT_TASK');
  if (answer.kind === 'help') {
    a.assisted = true;
    a.hintShown = true;
    a.captureId = null;
    a.audio = null;
    run.promptedTargets.push(normalized(target(task)));
    return touched(run);
  }
  if (answer.kind === 'skip' || answer.kind === 'unassessed') {
    if (a.phase === 'read' && questionTask(task)) {
      a.reading = 'unassessed';
      a.captureId = null;
      return openQuestion(run);
    }
    return observe(
      run,
      task,
      answer.kind === 'skip' ? 'skipped' : 'unassessed',
      'none',
    );
  }
  if (answer.kind === 'speech') {
    if (
      !answer.captureId ||
      answer.captureId !== a.captureId ||
      !['read', 'question'].includes(a.phase)
    )
      return previous;
    if (!answer.isFinal && !answer.error) return previous;
    a.captureId = null;
    if (
      answer.error ||
      !answer.value ||
      (Number.isFinite(answer.confidence) && answer.confidence! < 0.8)
    ) {
      return speechFailure(
        run,
        task,
        answer.error ?? (!answer.value ? 'no_speech' : 'low_confidence'),
      );
    }
    if (a.phase === 'question') {
      const q =
        task.answer.kind === 'question_set'
          ? task.answer.questions[a.questionIndex]
          : null;
      const selected = (q?.options ?? task.options).filter(
        (o) => normalized(o.text) === normalized(answer.value!),
      );
      if (selected.length !== 1) {
        return speechFailure(run, task, 'asr_uncertain');
      }
      return answerPersonal(run, c, {
        instanceId: a.instanceId,
        kind: 'choice',
        optionIds: [selected[0].id],
      });
    }
    if (task.answer.kind === 'companion_function')
      return observe(run, task, 'unassessed', 'none');
    if (!matches(answer.value, target(task))) {
      return speechFailure(run, task, 'asr_uncertain');
    }
    a.reading = a.assisted ? 'assisted' : 'observed';
    if (questionTask(task)) {
      a.retries = 0;
      return openQuestion(run);
    }
    return observe(run, task, 'correct', 'asr');
  }
  let correct = false;
  if (answer.kind === 'choice') {
    if (!['question', 'answer'].includes(a.phase))
      throw new Error('PERSONAL_OPTIONS_HIDDEN');
    const q =
      task.answer.kind === 'question_set'
        ? task.answer.questions[a.questionIndex]
        : null;
    const expected =
      q?.correctOptionIds ??
      (task.answer.kind === 'choice' ? task.answer.correctOptionIds : null);
    if (!expected) throw new Error('PERSONAL_INVALID_ANSWER_KIND');
    const options = q?.options ?? task.options;
    if (
      !answer.optionIds?.length ||
      answer.optionIds.some((id) => !options.some((o) => o.id === id))
    )
      throw new Error('PERSONAL_UNKNOWN_OPTION');
    correct = sameSet(answer.optionIds, expected);
    a.meaningCorrect = a.meaningCorrect && correct;
    if (
      q &&
      task.answer.kind === 'question_set' &&
      a.questionIndex + 1 < task.answer.questions.length
    ) {
      a.questionIndex++;
      return openQuestion(run);
    }
    return observe(
      run,
      task,
      a.meaningCorrect ? 'correct' : 'incorrect',
      a.reading === 'observed' || a.reading === 'assisted'
        ? 'asr'
        : 'deterministic',
      questionTask(task)
        ? a.meaningCorrect
          ? 'correct'
          : 'incorrect'
        : undefined,
    );
  }
  if (a.phase !== 'answer') throw new Error('PERSONAL_NOT_ANSWER_STAGE');
  if (answer.kind === 'compose' && task.answer.kind === 'ordered_parts') {
    const ids = answer.tokenIds ?? [];
    const tokens = task.partTokens ?? [];
    if (
      ids.length !== tokens.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !tokens.some((t) => t.tokenId === id))
    )
      throw new Error('PERSONAL_INVALID_TOKENS');
    correct =
      normalized(
        ids
          .map((id) => tokens.find((t) => t.tokenId === id)!.text)
          .join(task.answer.joiner ?? ''),
      ) === normalized(task.answer.joined);
  } else if (answer.kind === 'find_part' && task.answer.kind === 'spans') {
    const key = (s: Segment) => `${s.line}:${s.start}:${s.end}`;
    correct = sameSet(
      (answer.segments ?? []).map(key),
      task.answer.segments.map(key),
    );
  } else if (answer.kind === 'boundary' && task.answer.kind === 'boundaries') {
    correct = task.answer.acceptedBoundaries.some((values) =>
      sameSet(answer.boundaries ?? [], values),
    );
  } else if (answer.kind === 'transform' && task.answer.kind === 'exact') {
    correct = normalized(answer.value ?? '') === normalized(task.answer.value);
    if (correct) {
      a.phase = 'read';
      return touched(run);
    }
  } else throw new Error('PERSONAL_INVALID_ANSWER_KIND');
  return observe(run, task, correct ? 'correct' : 'incorrect', 'deterministic');
}

export function requestPersonalAudio(
  previous: PersonalRun,
  c: PersonalCurriculum,
  request: {
    scope: 'instruction' | 'target' | 'option';
    optionId?: string;
    userGesture: boolean;
  },
) {
  if (!request.userGesture || !previous.active || previous.paused)
    throw new Error('PERSONAL_AUDIO_REQUIRES_PRESS');
  const run = cancelPersonalMedia(previous),
    a = run.active!,
    { task, step } = source(run, c),
    view = personalView(run, c);
  let text = '';
  if (request.scope === 'instruction') text = view.instruction;
  else if (request.scope === 'option') {
    text = view.options.find((o) => o.id === request.optionId)?.text ?? '';
    if (!text) throw new Error('PERSONAL_OPTION_HIDDEN');
  } else {
    text = task
      ? task.kind === 'transform' && a.phase !== 'read'
        ? task.learnerText
        : target(task)
      : (step?.spokenText ?? step?.visibleText ?? '');
    if (task && a.phase === 'read') {
      a.assisted = true;
      run.promptedTargets.push(normalized(target(task)));
    } else if (!task && step?.visibleText)
      run.promptedTargets.push(normalized(step.visibleText));
  }
  const audioId = `${a.instanceId}:audio:${++run.serial}`;
  a.audio = { id: audioId, scope: request.scope };
  return {
    run: touched(run),
    effect: { text, instanceId: a.instanceId, audioId, scope: request.scope },
  };
}
export function finishPersonalAudio(
  previous: PersonalRun,
  event: {
    instanceId: string;
    audioId: string;
    ok: boolean;
    cancelled?: boolean;
  },
): PersonalRun {
  const a = previous.active;
  if (!a || a.instanceId !== event.instanceId || a.audio?.id !== event.audioId)
    return previous;
  const run = clone(previous);
  run.active!.audio = null;
  if (a.audio.scope === 'target' && a.phase === 'listen' && event.ok) {
    run.active!.played = true;
    return openQuestion(run);
  }
  return touched(run);
}
