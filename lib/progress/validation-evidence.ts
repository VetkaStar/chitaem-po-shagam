import type { Profile } from '../curriculum/contracts.js';
import type { Curriculum } from '../curriculum/types.js';
import { demand, object, strings, natural, own } from '../curriculum/loader.js';
import { catalogChecks, modes, isText, proof } from './validation-helpers.js';
import { engine } from '../curriculum/core.js';
export function validateEvidence(
  p: Profile,
  c: Curriculum,
  instance: (value: unknown, completed?: boolean) => void,
) {
  const { prog, node, item } = catalogChecks(c);
  if (p.currentVisit !== null) {
    const v = p.currentVisit;
    demand(
      isText(v.id) &&
        natural(v.index) &&
        natural(v.actions) &&
        [3, 5, 7].includes(v.budget) &&
        strings(v.checkedNodes) &&
        v.checkedNodes.every(node) &&
        !p.completedVisits.includes(v.id),
      'visit',
    );
    demand(v.index === p.completedVisits.length, 'visit index');
  }
  const attemptIds = new Set<string>();
  for (const a of p.attempts) {
    instance(a, true);
    demand(!attemptIds.has(a.instanceId), 'duplicate attempt');
    attemptIds.add(a.instanceId);
    const receipt = p.receipts[a.instanceId];
    demand(
      receipt &&
        receipt.itemId === a.itemId &&
        receipt.nodeId === a.nodeId &&
        receipt.outcome === a.outcome,
      'receipt missing/mismatch',
    );
    demand(
      object(a.response) &&
        Array.isArray(a.questionResults) &&
        strings(a.subskillIds),
      'attempt response',
    );
    if (a.response.reading) proof(a.response.reading);
  }
  for (const id of Object.keys(p.receipts))
    demand(attemptIds.has(id), 'orphan receipt');
  for (const [skillId, b] of Object.entries(p.skillBasis)) {
    demand(own(c.skills, skillId) && object(b), 'skill basis');
    if (b.source === 'explicit_entry_checkpoint') {
      demand(
        b.status === 'confirmed_entry' &&
          b.verifier === 'companion' &&
          isText(b.reason),
        'entry evidence',
      );
    } else {
      demand(
        b.source === 'node_assessment' &&
          node(b.nodeId) &&
          c.nodes[b.nodeId as string].skillId === skillId &&
          b.contentVersion === c.contentVersion &&
          ['pending_retention', 'mastered'].includes(b.status as string),
        'node evidence',
      );
      const computed = engine.nodeEvidenceStatus(p, c, b.nodeId as string);
      demand(
        computed.status !== 'learning' &&
          (b.status !== 'mastered' || computed.status === 'mastered'),
        'unsupported mastery',
      );
      for (const key of [
        'independentItems',
        'visits',
        'application',
        'baselineVisit',
        'novelDecodingVerified',
        'readingAndQuestionsVerified',
      ])
        demand(b[key] === computed[key], 'evidence.' + key);
    }
  }
  for (const id of p.confirmedSkills)
    demand(own(p.skillBasis, id), 'confirmed skill has no basis');
  for (const [id, b] of Object.entries(p.capabilityEvidence)) {
    demand(
      own(c.capabilitySupports, id) &&
        object(b) &&
        b.verifier === 'companion' &&
        isText(b.reason) &&
        b.scope === 'exact_function_only' &&
        strings(b.observedItemIds) &&
        new Set(b.observedItemIds).size >= 2,
      'capability evidence',
    );
    demand(
      b.observedItemIds.every((itemId) =>
        p.attempts.some(
          (a) =>
            a.itemId === itemId &&
            a.functionVerified &&
            a.functionCapabilityId === id,
        ),
      ),
      'capability attempts',
    );
  }
  for (const r of p.reviewQueue)
    demand(
      node(r.nodeId) &&
        prog(r.programId) &&
        c.nodes[r.nodeId].programId === r.programId &&
        item(r.itemId) &&
        natural(r.dueVisit) &&
        modes.includes(r.mode),
      'review queue',
    );
  for (const event of p.exposures.events) {
    demand(
      strings(event.texts) &&
        strings(event.promptedTexts) &&
        strings(event.heardPassages) &&
        strings(event.itemIds) &&
        event.itemIds.every(item),
      'exposure event values',
    );
  }
}
