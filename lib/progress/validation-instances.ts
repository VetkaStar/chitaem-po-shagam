import type { Profile } from '../curriculum/contracts.js';
import type { Curriculum } from '../curriculum/types.js';
import { demand, object, strings, natural, own } from '../curriculum/loader.js';
import {
  catalogChecks,
  modes,
  phases,
  contexts,
  isText,
  proof,
} from './validation-helpers.js';
export function instanceValidator(p: Profile, c: Curriculum) {
  const { prog, node, item } = catalogChecks(c);
  const optionAnswers = (v: unknown, itemId: string) => {
    demand(object(v), 'answers');
    const t = c.items[itemId];
    const questions =
      t.answer.kind === 'question_set' ? t.answer.questions : [];
    for (const [qid, ids] of Object.entries(v)) {
      const q = questions.find((q) => q.id === qid);
      demand(
        q &&
          strings(ids) &&
          new Set(ids).size === ids.length &&
          ids.every((id) => q.options.some((o) => o.id === id)),
        'question/option answer',
      );
    }
  };
  const instance = (v: unknown, completed = false) => {
    demand(
      object(v) && isText(v.instanceId) && item(v.itemId),
      'instance identity',
    );
    const t = c.items[v.itemId as string];
    demand(
      v.contentVersion === c.contentVersion && v.contentHash === t.contentHash,
      'instance content version/hash',
    );
    demand(
      contexts.includes(v.context as string) &&
        phases.includes(v.phase as string) &&
        modes.includes(v.mode as string) &&
        t.allowedModes.includes(v.mode as 'read'),
      'instance context/mode',
    );
    demand(v.programId === null || prog(v.programId), 'instance program');
    demand(v.nodeId === null || node(v.nodeId), 'instance node');
    if (v.context === 'route')
      demand(
        node(v.nodeId) && c.nodes[v.nodeId as string].programId === v.programId,
        'instance ownership',
      );
    demand(
      isText(v.sessionId) &&
        natural(v.visitIndex) &&
        natural(v.helpLevel) &&
        v.helpLevel <= 4,
      'instance counters',
    );
    for (const key of [
      'freshAtPresentation',
      'novelTargetAtPresentation',
      'eligibleAtPresentation',
      'readingTargetAudioPlayed',
      'promptFreeAtPresentation',
    ])
      demand(typeof v[key] === 'boolean', 'instance.' + key);
    for (const key of ['readingStageFinished', 'optionsRevealed'])
      if (key in v) demand(typeof v[key] === 'boolean', key);
    if (v.reading !== undefined) proof(v.reading);
    if (
      ['passage', 'read_meaning'].includes(t.kind) &&
      v.optionsRevealed === true
    )
      demand(v.readingStageFinished === true, 'options before reading stage');
    demand(object(v.optionOrder), 'optionOrder');
    const expected: Record<string, string[]> = {};
    if (t.options.length) expected.task = t.options.map((o) => o.id);
    if (t.answer.kind === 'question_set')
      for (const q of t.answer.questions)
        expected[q.id] = q.options.map((o) => o.id);
    demand(
      Object.keys(v.optionOrder).length === Object.keys(expected).length,
      'optionOrder keys',
    );
    for (const [key, ids] of Object.entries(expected)) {
      const order = v.optionOrder[key];
      demand(
        strings(order) &&
          order.length === ids.length &&
          new Set(order).size === order.length &&
          order.every((id) => ids.includes(id)),
        'optionOrder permutation',
      );
    }
    if ('transformText' in v)
      demand(
        t.kind === 'transform' &&
          v.context === 'free' &&
          (t as typeof t & { requiresFollowupReading?: boolean })
            .requiresFollowupReading === true &&
          typeof v.transformText === 'string' &&
          v.transformText.trim().length > 0,
        'transform reading stage',
      );
    if ('tokenOrder' in v) {
      const ids = (t.partTokens ?? []).map((token) => token.tokenId);
      demand(
        t.kind === 'compose' &&
          strings(v.tokenOrder) &&
          v.tokenOrder.length === ids.length &&
          new Set(v.tokenOrder).size === ids.length &&
          v.tokenOrder.every((id) => ids.includes(id)),
        'tokenOrder permutation',
      );
    }
    optionAnswers(v.answers, t.id);
    if (v.episodeId !== null) {
      demand(
        typeof v.episodeId === 'string' && own(c.episodes, v.episodeId),
        'instance episode',
      );
      demand(
        c.episodes[v.episodeId].steps.some(
          (step) => step.id === v.stepId && step.itemId === t.id,
        ),
        'instance step',
      );
    } else demand(v.stepId === null, 'orphan step');
    if (!completed)
      demand(!own(p.receipts, v.instanceId), 'completed instance resurrected');
  };
  return instance;
}
