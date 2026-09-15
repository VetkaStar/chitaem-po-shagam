import type { Profile } from '../curriculum/contracts.js';
import type { Supply } from '../curriculum/types.js';
import {
  CURRICULUM_SHA,
  demand,
  object,
  strings,
  natural,
  own,
} from '../curriculum/loader.js';
import {
  catalogChecks,
  modes,
  isText,
  nullableText,
  booleanOrNull,
  LEGACY_KEYS,
} from './validation-helpers.js';
export function validatePlatform(
  s: Record<string, unknown>,
  supply: Supply,
  active: (value: unknown) => void,
) {
  const c = supply.curriculum,
    registry = supply.registry,
    p = s.profile as unknown as Profile;
  const { prog, node, item } = catalogChecks(c);
  const group = (id: unknown) => {
    demand(
      typeof id === 'string' && own(registry.groups, id),
      'UNKNOWN_ENTRY_GROUP: ' + String(id),
    );
  };
  demand(
    object(s.legacy) && isText(s.legacy.capturedAt) && object(s.legacy.values),
    'legacy backup',
  );
  demand(
    Object.keys(s.legacy.values).length === LEGACY_KEYS.length,
    'legacy keys',
  );
  for (const key of LEGACY_KEYS)
    demand(
      s.legacy.values[key] === null || typeof s.legacy.values[key] === 'string',
      'legacy raw',
    );
  demand(
    ['free', 'recommended', 'custom', 'demonstration', 'entry'].includes(
      s.studyMode as string,
    ),
    'study mode',
  );
  demand(object(s.customRoutes), 'custom routes');
  for (const [id, r] of Object.entries(s.customRoutes)) {
    demand(
      object(r) &&
        r.source === 'custom' &&
        r.routeId === id &&
        natural(r.version) &&
        r.version > 0 &&
        Array.isArray(r.steps) &&
        natural(r.position) &&
        r.position <= r.steps.length,
      'custom route',
    );
    const ids = new Set<string>();
    for (const step of r.steps) {
      demand(
        object(step) &&
          isText(step.id) &&
          !ids.has(step.id) &&
          item(step.itemId) &&
          modes.includes(step.mode as string) &&
          c.items[step.itemId as string].allowedModes.includes(
            step.mode as 'read',
          ),
        'custom step',
      );
      ids.add(step.id);
    }
  }
  for (const route of Object.values(s.customRoutes)) {
    demand(
      object(route) && 'suspendedInstance' in route,
      'custom suspended state',
    );
    active(route.suspendedInstance);
  }
  if (s.route !== null) {
    demand(
      object(s.route) &&
        ['recommended', 'custom', 'demonstration', 'entry'].includes(
          s.route.source as string,
        ) &&
        isText(s.route.routeId) &&
        natural(s.route.version) &&
        s.route.version > 0,
      'route reference',
    );
    if (s.route.source === 'recommended') {
      demand(prog(s.route.routeId), 'recommended program');
      if (s.studyMode === 'recommended')
        demand(
          s.route.routeId === p.currentProgramId,
          'selected program mismatch',
        );
    } else if (s.route.source === 'entry') {
      demand(
        s.route.routeId === 'onboarding' && s.route.version === 1,
        'entry route',
      );
    } else if (s.route.source === 'demonstration') {
      demand(
        ['p1', 'p2'].includes(s.route.routeId as string) &&
          s.route.version === 1,
        'demo route',
      );
    } else {
      const r = s.customRoutes[s.route.routeId] as
        | { version: number }
        | undefined;
      demand(r && r.version === s.route.version, 'custom route version');
    }
  }
  if (s.studyMode !== 'free')
    demand(
      object(s.route) && s.route.source === s.studyMode,
      'selected route missing',
    );
  demand(Array.isArray(s.sourceEvents), 'source events');
  const eventIds = new Set<string>();
  for (const e of s.sourceEvents) {
    demand(
      object(e) &&
        isText(e.id) &&
        !eventIds.has(e.id) &&
        ['free', 'custom', 'recommended', 'demonstration', 'entry'].includes(
          e.source as string,
        ) &&
        [
          'launch',
          'answer',
          'help',
          'reading',
          'options',
          'info',
          'free_exposure',
          'demonstration_step',
        ].includes(e.kind as string) &&
        nullableText(e.routeId) &&
        nullableText(e.instanceId) &&
        (e.routeVersion === null || natural(e.routeVersion)),
      'source event',
    );
    demand(
      e.source === 'custom' && e.kind === 'launch'
        ? isText(e.customStepId) &&
            isText(e.instanceId) &&
            isText(e.routeId) &&
            natural(e.routeVersion) &&
            e.routeVersion > 0
        : e.customStepId === null,
      'source event custom step',
    );
    if (e.source === 'demonstration')
      demand(
        ['p1', 'p2'].includes(e.routeId as string) && e.routeVersion === 1,
        'demo event route',
      );
    if (e.demoStepId !== undefined)
      demand(
        e.source === 'demonstration' && isText(e.demoStepId),
        'demo event step',
      );
    if (e.kind === 'demonstration_step')
      demand(
        e.source === 'demonstration' && isText(e.demoStepId),
        'demo completion event',
      );
    if (e.demoPlanId !== undefined)
      demand(
        e.source === 'demonstration' && isText(e.demoPlanId),
        'demo information plan',
      );
    if (e.source === 'entry')
      demand(
        e.routeId === 'onboarding' && e.routeVersion === 1,
        'entry event route',
      );
    if (e.entryCheckpointId !== undefined)
      demand(
        e.source === 'entry' && isText(e.entryCheckpointId),
        'entry event checkpoint',
      );
    if (e.entryPracticeId !== undefined)
      demand(
        e.source === 'entry' &&
          isText(e.entryPracticeId) &&
          natural(e.entryPosition),
        'entry event practice',
      );
    eventIds.add(e.id);
  }
  const o = s.onboarding;
  demand(
    object(o) &&
      o.schemaVersion === 1 &&
      o.specVersion === 'onboarding-0.7.3' &&
      o.curriculumSha256 === CURRICULUM_SHA,
    'onboarding version',
  );
  demand(
    ['not_started', 'deferred', 'in_progress', 'completed'].includes(
      o.setupStatus as string,
    ) &&
      [
        'questionnaire',
        'access_setup',
        'entry_checkpoint',
        'placement_report',
      ].includes(o.screen as string),
    'onboarding state',
  );
  for (const key of ['currentCheckpointGroup', 'rootGoalGroup'])
    if (o[key] !== null) group(o[key]);
  for (const key of ['deferredGroups', 'sideQueue']) {
    demand(strings(o[key]), key);
    for (const g of o[key]) group(g);
  }
  demand(
    nullableText(o.checkpointId) &&
      [null, 'initial', 'prerequisite', 'side'].includes(
        o.checkpointPurpose as string | null,
      ),
    'checkpoint',
  );
  demand(o.returnToNodeId === null || node(o.returnToNodeId), 'return node');
  const q = o.questionnaire;
  demand(object(q), 'questionnaire');
  demand(
    o.questionnaireStep === null ||
      (typeof o.questionnaireStep === 'string' && own(q, o.questionnaireStep)),
    'questionnaire step',
  );
  demand(
    [null, 'learner', 'adult', 'together'].includes(
      q.respondent as string | null,
    ),
    'respondent',
  );
  demand(
    [null, 'under_6', '6_7', '8_12', '13_17', '18_plus'].includes(
      q.ageBand as string | null,
    ),
    'age band',
  );
  demand(
    q.reads === null ||
      (strings(q.reads) &&
        q.reads.every((x) =>
          [
            'letters',
            'syllables',
            'short_words',
            'multi_part',
            'sentences',
            'texts',
          ].includes(x),
        )),
    'reads',
  );
  demand(
    [null, 'often', 'sometimes', 'never'].includes(
      q.blendingDifficulty as string | null,
    ) && booleanOrNull(q.companionAvailable),
    'observations',
  );
  demand(q.program === null || prog(q.program), 'questionnaire program');
  demand(
    q.budget === null || [3, 5, 7].includes(q.budget as number),
    'questionnaire budget',
  );
  demand(strings(q.interests), 'interests');
  for (const key of [
    'onlyMemorisedWords',
    'instructionsReadable',
    'audioUsable',
    'visualTextUsable',
    'canUseButtons',
    'canUseKeyboard',
    'companionCanSelect',
  ])
    if (q[key] !== undefined)
      demand(booleanOrNull(q[key]), 'questionnaire ' + key);
  if (q.presentation !== undefined)
    demand(
      [null, 'school', 'neutral'].includes(q.presentation as string | null),
      'presentation',
    );
  if (q.letterPairs !== undefined)
    demand(
      strings(q.letterPairs) &&
        q.letterPairs.every((x) => ['LP', 'MS', 'OTHER', 'NONE'].includes(x)),
      'letter pairs',
    );
  for (const key of ['otherLetterPair', 'interestDetails'])
    if (q[key] !== undefined)
      demand(typeof q[key] === 'string', 'questionnaire ' + key);
  for (const key of ['goal', 'responseMode'])
    if (q[key] !== undefined)
      demand(nullableText(q[key]), 'questionnaire ' + key);
  if (q.motionAllowed !== undefined)
    demand(typeof q.motionAllowed === 'boolean', 'motion');
  if (q.instructionAudio !== undefined)
    demand(
      ['button', 'always', 'off'].includes(q.instructionAudio as string),
      'instruction audio',
    );
  if (q.listeningEasier !== undefined)
    demand(
      [null, 'yes', 'no', 'sometimes'].includes(
        q.listeningEasier as string | null,
      ),
      'listening report',
    );
}
