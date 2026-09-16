import type { Profile } from '../curriculum/contracts';
import type { Curriculum } from '../curriculum/types';
import { demand, natural, object } from '../curriculum/loader';
import bank from '../../content/curriculum/lite-bank.json';
const phases = ['read', 'question', 'feedback', 'listen', 'listening'];
export function validateEntry08(p: Profile, c: Curriculum) {
  const ui = p.entry08Ui,
    e = p.entry08;
  if (ui)
    demand(
      ui.version === '0.8.1' &&
        object(ui.answers) &&
        [
          'role',
          'age',
          'questions',
          'interests',
          'access',
          'voice',
          'mic_trial',
          'probe',
          'pause',
          'report',
          'lesson',
        ].includes(ui.page),
      'entry08 ui',
    );
  if (!e) {
    demand(!p.personalPath08, 'personal without entry');
    return;
  }
  demand(
    ['0.8.0', '0.8.1'].includes(e.version) &&
      typeof e.id === 'string' &&
      e.id.length > 0 &&
      natural(e.revision),
    'entry08 version',
  );
  demand(
    object(e.config) &&
      object(e.visit) &&
      natural(e.visit.used) &&
      [3, 5].includes(e.visit.budget) &&
      e.visit.used <= e.visit.budget &&
      natural(e.total) &&
      [4, 6].includes(e.totalBudget) &&
      e.total <= e.totalBudget,
    'entry08 budgets',
  );
  demand(
    Array.isArray(e.observations) &&
      Array.isArray(e.used) &&
      Array.isArray(e.prompts) &&
      Array.isArray(e.sourceExposures),
    'entry08 history',
  );
  demand(
    typeof e.config.companion === 'boolean' &&
      ['voice', 'buttons', 'both'].includes(e.config.input) &&
      ['parent', 'self', 'child'].includes(e.config.respondent) &&
      Array.isArray(e.config.interests),
    'entry08 config',
  );
  demand(
    natural(e.visit.number) &&
      e.visit.number > 0 &&
      typeof e.visit.id === 'string' &&
      Object.hasOwn(bank.groups, e.group),
    'entry08 visit/group',
  );
  demand(
    Array.isArray(e.receipts) && Array.isArray(e.trace) && object(e.history),
    'entry08 state',
  );
  demand(
    e.used.every((id) => Object.hasOwn(bank.cards, id)) &&
      new Set(e.used).size === e.used.length,
    'entry08 cards',
  );
  if (e.active)
    demand(
      object(e.active) &&
        e.used.includes(e.active.cardId) &&
        typeof e.active.instanceId === 'string' &&
        phases.includes(e.active.phase),
      'entry08 active',
    );
  for (const item of e.observations)
    demand(
      object(item) &&
        !Object.hasOwn(item, 'transcript') &&
        !Object.hasOwn(item, 'audio'),
      'entry08 private data',
    );
  for (const exposure of e.sourceExposures)
    demand(
      object(exposure) &&
        typeof exposure.target === 'string' &&
        Object.hasOwn(c.items, exposure.sourceTaskId) &&
        ['shown', 'heard'].includes(exposure.type),
      'entry08 source exposure',
    );
  for (const prompt of e.prompts)
    demand(
      object(prompt) &&
        typeof prompt.target === 'string' &&
        typeof prompt.visitId === 'string',
      'entry08 prompt',
    );
  for (const [id, run] of Object.entries(p.personalPath08 ?? {})) {
    demand(object(run), 'personal shape');
    if (!run.version) {
      const legacy = run as unknown as Record<string, unknown>;
      demand(
        typeof legacy.nodeId === 'string' &&
          typeof legacy.episodeId === 'string' &&
          Object.hasOwn(c.nodes, legacy.nodeId) &&
          Object.hasOwn(c.episodes, legacy.episodeId) &&
          natural(legacy.stepIndex) &&
          Array.isArray(legacy.completedSteps) &&
          Array.isArray(legacy.observations),
        'legacy personal preview',
      );
      continue;
    }
    demand(
      run.version === '0.8.1' &&
        run.entryId === id &&
        object(run.cursor) &&
        Array.isArray(run.observations) &&
        natural(run.revision),
      'personal run',
    );
    demand(
      Object.hasOwn(c.nodes, run.cursor.nodeId) &&
        Object.hasOwn(c.episodes, run.cursor.episodeId) &&
        c.episodes[run.cursor.episodeId].nodeId === run.cursor.nodeId &&
        natural(run.cursor.stepIndex),
      'personal source',
    );
    demand(
      object(run.visit) &&
        natural(run.visit.used) &&
        [3, 5].includes(run.visit.budget) &&
        run.visit.used <= run.visit.budget &&
        natural(run.visit.number),
      'personal budget',
    );
    demand(
      Array.isArray(run.completedSteps) &&
        Array.isArray(run.completedEpisodes) &&
        Array.isArray(run.promptedTargets) &&
        Array.isArray(run.exposedTaskIds) &&
        run.exposedTaskIds.every((id) => Object.hasOwn(c.items, id)),
      'personal history',
    );
    if (run.active)
      demand(
        typeof run.active.instanceId === 'string' &&
          ['info', 'read', 'listen', 'question', 'answer', 'feedback'].includes(
            run.active.phase,
          ) &&
          (run.active.taskId === null ||
            Object.hasOwn(c.items, run.active.taskId)),
        'personal active',
      );
    for (const o of run.observations)
      demand(
        object(o) &&
          Object.hasOwn(c.items, o.taskId) &&
          typeof o.visitId === 'string' &&
          !Object.hasOwn(o, 'transcript'),
        'personal observation',
      );
  }
}
