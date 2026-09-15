import type {
  ProgressState,
  ProgressStore,
  Supply,
  Action,
  CustomRoute,
  Questionnaire,
  DemoMethod,
} from '../../lib/curriculum/types.js';
import type {
  ReadingProof,
  Submission,
} from '../../lib/curriculum/contracts.js';
import { engine, routeEngine } from '../../lib/curriculum/core.js';
import { validateState } from '../../lib/progress/validation.js';
import {
  createState,
  decodeProgress,
  encodeProgress,
} from '../../lib/progress/state.js';
import {
  recommendedSource,
  customSource,
  type ActionSource,
} from './action-source.js';
import { park, logSource, launchFreeProfile } from './state-transitions.js';
import { applyAnswer, applyReading, applyReveal } from './task-transitions.js';
import { preparePresentation } from './token-order.js';
import { presentation } from './presentation.js';
import { optionAudio } from './option-audio.js';
import { illustrationMatch } from './illustration-match.js';
import type { RuntimeInstance } from '../../lib/curriculum/types.js';
import {
  currentDemo,
  demoEpisode,
  demoInformation,
  planDemonstration,
  launchDemonstration,
  acknowledgeDemonstration,
} from './demonstration.js';
import { ensureEntry, checkpoint } from '../onboarding/entry-state.js';
import {
  planEntry,
  launchEntry,
  recordEntryCompletion,
} from '../onboarding/entry-execution.js';
import {
  exposureInput,
  type FreeExposure,
} from '../../lib/curriculum/free-exposure.js';
import { EntryCommands } from '../onboarding/entry-commands.js';
export interface PlanToken {
  storageRevision: number;
  kind: string;
  planId: string | null;
}
export class CurriculumController extends EntryCommands {
  private tail: Promise<unknown> = Promise.resolve();
  private pending: { token: PlanToken; action: Action } | null = null;
  private constructor(
    protected supply: Supply,
    private store: ProgressStore,
    private state: ProgressState,
    private sources: Record<'recommended' | 'custom', ActionSource>,
  ) {
    super();
  }
  static async open(
    supply: Supply,
    store: ProgressStore,
    legacy: Pick<Storage, 'getItem'>,
    sources = { recommended: recommendedSource, custom: customSource },
  ) {
    let state = await store.read();
    if (!state) state = await store.commit(createState(supply, legacy), null);
    validateState(state, supply);
    return new CurriculumController(supply, store, state, sources);
  }
  snapshot() {
    return structuredClone(this.state);
  }
  visible() {
    if (this.state.studyMode === 'demonstration')
      return this.state.profile.activeInstance
        ? presentation(this.state.profile, this.supply)
        : demoInformation(this.state, this.supply);
    // A deferred route cannot accidentally show the active informational screen of a parked course.
    if (
      this.state.studyMode !== 'recommended' &&
      !this.state.profile.activeInstance
    )
      return null;
    return presentation(this.state.profile, this.supply);
  }
  demonstrationComplete() {
    return (
      this.state.studyMode === 'demonstration' &&
      !currentDemo(this.state, this.supply).step
    );
  }
  protected changeEntry(fn: (s: ProgressState) => void) {
    return this.serial(async () => {
      const s = this.snapshot();
      if (s.studyMode !== 'entry') throw new Error('NOT_ENTRY_MODE');
      fn(s);
      return this.save(s);
    });
  }
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn);
    this.tail = result.catch(() => undefined);
    return result;
  }
  private async save(next: ProgressState, backup = false) {
    preparePresentation(next.profile, this.supply);
    validateState(next, this.supply);
    const saved = await this.store.commit(
      next,
      this.state.storageRevision,
      backup,
    );
    this.state = saved;
    this.pending = null;
    return this.snapshot();
  }
  refresh() {
    return this.serial(async () => {
      const saved = await this.store.read();
      if (!saved) throw new Error('PROGRESS_MISSING');
      validateState(saved, this.supply);
      this.state = saved;
      this.pending = null;
      return this.snapshot();
    });
  }
  export() {
    return this.serial(async () => encodeProgress(this.state, this.supply));
  }
  import(raw: string) {
    return this.serial(async () =>
      this.save(decodeProgress(raw, this.supply), true),
    );
  }
  deferSetup() {
    return this.serial(async () => {
      const s = this.snapshot();
      park(s);
      s.studyMode = 'free';
      s.onboarding.setupStatus = 'deferred';
      await this.save(s);
      return { screen: 'catalog' as const };
    });
  }
  resumeSetup() {
    return this.serial(async () => {
      const s = this.snapshot();
      park(s);
      s.studyMode = 'free';
      s.onboarding.setupStatus = 'in_progress';
      s.studyMode = 'entry';
      s.route = { source: 'entry', routeId: 'onboarding', version: 1 };
      const flow = ensureEntry(s);
      s.profile.activeInstance = flow.suspendedInstance;
      flow.suspendedInstance = null;
      await this.save(s);
      return { screen: s.onboarding.screen };
    });
  }
  saveQuestionnaire(
    questionnaire: Questionnaire,
    step: keyof Questionnaire | null,
  ) {
    return this.serial(async () => {
      const s = this.snapshot();
      s.onboarding.questionnaire = structuredClone(questionnaire);
      s.onboarding.questionnaireStep = step;
      return this.save(s);
    });
  }
  selectDemonstration(method: DemoMethod) {
    return this.serial(async () => {
      demoEpisode(this.supply, method);
      const s = this.snapshot();
      park(s);
      s.demonstrationRuns ??= {};
      const run = (s.demonstrationRuns[method] ??= {
        position: 0,
        activeInfo: null,
        suspendedInstance: null,
        comfort: null,
      });
      s.studyMode = 'demonstration';
      s.route = { source: 'demonstration', routeId: method, version: 1 };
      s.profile.activeInstance = run.suspendedInstance;
      run.suspendedInstance = null;
      s.profile.revision++;
      return this.save(s);
    });
  }
  saveDemoComfort(comfort: 'comfortable' | 'needs_help' | 'unsure') {
    return this.serial(async () => {
      if (!['comfortable', 'needs_help', 'unsure'].includes(comfort))
        throw new Error('INVALID_COMFORT');
      const s = this.snapshot(),
        { run, episode } = currentDemo(s, this.supply);
      if (run.position !== episode.steps.length)
        throw new Error('DEMONSTRATION_UNFINISHED');
      run.comfort = comfort;
      return this.save(s);
    });
  }
  selectProgram(programId: string) {
    return this.serial(async () => {
      const s = this.snapshot();
      park(s);
      s.profile = engine.switchProgram(
        s.profile,
        programId,
        this.supply.curriculum,
      );
      const position = s.profile.programs[programId];
      if (!s.profile.activeInstance && position.suspendedInstance) {
        s.profile.activeInstance = position.suspendedInstance;
        position.suspendedInstance = null;
        s.profile.revision++;
      }
      s.studyMode = 'recommended';
      s.route = { source: 'recommended', routeId: programId, version: 1 };
      return this.save(s);
    });
  }
  /** No UI/editor calls this yet. A future source registers references, not copies of the task bank. */
  registerCustomRoute(route: CustomRoute) {
    return this.serial(async () => {
      const s = this.snapshot();
      if (s.customRoutes[route.routeId])
        throw new Error('ROUTE_ALREADY_EXISTS');
      if (route.position !== 0 || route.suspendedInstance !== null)
        throw new Error('NEW_ROUTE_POSITION');
      s.customRoutes[route.routeId] = structuredClone(route);
      return this.save(s);
    });
  }
  selectCustomRoute(id: string) {
    return this.serial(async () => {
      const s = this.snapshot();
      if (!s.customRoutes[id]) throw new Error('UNKNOWN_CUSTOM_ROUTE');
      park(s);
      const r = s.customRoutes[id];
      s.studyMode = 'custom';
      s.route = { source: 'custom', routeId: id, version: r.version };
      s.profile.activeInstance = r.suspendedInstance;
      r.suspendedInstance = null;
      s.profile.revision++;
      return this.save(s);
    });
  }
  beginVisit(id: string, budget: 3 | 5 | 7 = 5) {
    return this.serial(async () => {
      if (![3, 5, 7].includes(budget)) throw new Error('INVALID_SCREEN_BUDGET');
      const s = this.snapshot();
      s.profile = engine.beginVisit(s.profile, id, { budget });
      return this.save(s);
    });
  }
  endVisit() {
    return this.serial(async () => {
      const s = this.snapshot();
      s.profile = engine.endVisit(s.profile);
      return this.save(s);
    });
  }
  planNext() {
    return this.serial(async () => {
      if (this.state.studyMode === 'free')
        return {
          storageRevision: this.state.storageRevision,
          kind: 'catalog',
          planId: null,
        };
      const s = this.snapshot(),
        p = s.profile;
      let selected: { profile: typeof p; action: Action };
      if (s.studyMode === 'entry')
        selected = { profile: p, action: planEntry(s, this.supply) };
      else if (s.studyMode === 'demonstration')
        selected = { profile: p, action: planDemonstration(s, this.supply) };
      else if (s.studyMode === 'custom' && p.activeInstance)
        selected = { profile: p, action: { kind: 'active_task' } };
      else if (s.studyMode === 'custom' && !p.currentVisit)
        selected = { profile: p, action: { kind: 'begin_visit' } };
      else if (
        s.studyMode === 'custom' &&
        p.currentVisit!.actions >= p.currentVisit!.budget
      )
        selected = { profile: p, action: { kind: 'pause' } };
      else
        selected = this.sources[s.studyMode as 'recommended' | 'custom'].select(
          structuredClone(s),
          this.supply,
        );
      s.profile = selected.profile;
      await this.save(s); // nextAction can reconcile evidence/teachingOrder; save even before launching.
      const token = {
        storageRevision: this.state.storageRevision,
        kind: selected.action.kind,
        planId: selected.action.planId ?? null,
      };
      this.pending = { token, action: selected.action };
      return { ...token };
    });
  }
  launch(
    token: PlanToken,
    instanceId: string = crypto.randomUUID(),
    companionObserved = false,
  ) {
    return this.serial(async () => {
      const pending = this.pending;
      if (
        !pending ||
        token.storageRevision !== this.state.storageRevision ||
        token.planId !== pending.token.planId ||
        token.kind !== pending.token.kind
      )
        throw new Error('STALE_PLAN');
      const s = this.snapshot(),
        a = pending.action;
      if (['active_task', 'active_info'].includes(a.kind))
        return this.visible();
      if (
        !s.profile.currentVisit ||
        s.profile.currentVisit.actions >= s.profile.currentVisit.budget
      )
        throw new Error('VISIT_OR_BUDGET');
      if (s.studyMode === 'entry')
        launchEntry(s, this.supply, a, instanceId, companionObserved);
      else if (s.studyMode === 'demonstration')
        launchDemonstration(s, this.supply, a, instanceId);
      else if (a.kind === 'custom_task')
        s.profile = launchFreeProfile(
          s,
          this.supply,
          a.itemId!,
          a.mode!,
          instanceId,
        );
      else
        s.profile = routeEngine.launchAction(
          s.profile,
          this.supply.curriculum,
          a,
          { instanceId },
        );
      logSource(
        s,
        a.kind.endsWith('_info') ? 'info' : 'launch',
        s.profile.activeInstance?.instanceId ?? null,
      );
      if (s.studyMode === 'entry') {
        const flow = ensureEntry(s),
          event = s.sourceEvents.at(-1)!;
        if (flow.practice) {
          event.entryPracticeId = flow.practice.id;
          event.entryPosition = flow.practice.position;
        } else event.entryCheckpointId = checkpoint(s).id;
      }
      if (s.studyMode === 'demonstration') {
        s.sourceEvents.at(-1)!.demoStepId = currentDemo(
          s,
          this.supply,
        ).step!.id;
        s.sourceEvents.at(-1)!.demoPlanId = a.planId!;
      }
      await this.save(s);
      return this.visible();
    });
  }
  launchFree(
    itemId: string,
    mode: 'read' | 'listen' | 'shared',
    instanceId: string = crypto.randomUUID(),
  ) {
    return this.serial(async () => {
      const s = this.snapshot();
      park(s);
      s.studyMode = 'free';
      if (s.suspendedFreeInstance) {
        if (s.suspendedFreeInstance.itemId !== itemId)
          throw new Error('RESUME_SUSPENDED_FREE_FIRST');
        s.profile.activeInstance = s.suspendedFreeInstance;
        s.suspendedFreeInstance = null;
        s.profile.revision++;
      } else {
        if (
          !s.profile.currentVisit ||
          s.profile.currentVisit.actions >= s.profile.currentVisit.budget
        )
          throw new Error('VISIT_OR_BUDGET');
        s.profile = launchFreeProfile(s, this.supply, itemId, mode, instanceId);
      }
      logSource(s, 'launch', s.profile.activeInstance?.instanceId ?? null);
      await this.save(s);
      return this.visible();
    });
  }
  answer(submission: Submission) {
    return this.serial(async () => {
      const s = this.snapshot();
      if (s.profile.receipts[submission.instanceId]) return this.snapshot(); // no second receipt, reward or route movement
      if (s.studyMode === 'entry') {
        // Use shared raw-answer staging without reconciling any parked official route.
        const program = s.profile.currentProgramId;
        s.profile.currentProgramId = null;
        applyAnswer(s, this.supply, submission);
        s.profile.currentProgramId = program;
        recordEntryCompletion(s, this.supply, submission.instanceId);
      } else if (s.studyMode === 'demonstration') {
        const { run, step } = currentDemo(s, this.supply);
        s.profile = engine.recordAttempt(
          s.profile,
          this.supply.curriculum,
          submission,
        );
        if (s.profile.receipts[submission.instanceId]) {
          logSource(s, 'demonstration_step', submission.instanceId);
          s.sourceEvents.at(-1)!.demoStepId = step!.id;
          run.position++;
        }
      } else applyAnswer(s, this.supply, submission);
      logSource(s, 'answer', submission.instanceId);
      return this.save(s);
    });
  }
  acknowledge(planId: string) {
    return this.serial(async () => {
      if (!['recommended', 'demonstration'].includes(this.state.studyMode))
        throw new Error('NOT_RECOMMENDED_ROUTE');
      const s = this.snapshot();
      if (s.studyMode === 'demonstration') {
        const step = currentDemo(s, this.supply).step!;
        acknowledgeDemonstration(s, this.supply, planId);
        logSource(s, 'demonstration_step', null);
        s.sourceEvents.at(-1)!.demoStepId = step.id;
        s.sourceEvents.at(-1)!.demoPlanId = planId;
      } else
        s.profile = routeEngine.acknowledgeInfo(
          s.profile,
          this.supply.curriculum,
          planId,
        );
      logSource(s, 'info', null);
      return this.save(s);
    });
  }
  help(options: {
    level?: number;
    targetAudio?: boolean;
    revealAnswer?: boolean;
  }) {
    return this.serial(async () => {
      const s = this.snapshot();
      s.profile = engine.requestHelp(
        s.profile,
        this.supply.curriculum,
        options,
      );
      const shown = presentation(s.profile, this.supply);
      if (shown?.kind === 'task' && shown.hints.length)
        s.profile = engine.commitExposure(s.profile, { texts: shown.hints });
      logSource(s, 'help', s.profile.activeInstance!.instanceId);
      await this.save(s);
      return this.visible();
    });
  }
  hint(index: number) {
    return this.serial(async () => {
      const s = this.snapshot();
      s.profile = engine.applyHint(s.profile, this.supply.curriculum, index);
      logSource(s, 'help', s.profile.activeInstance!.instanceId);
      await this.save(s);
      return this.visible();
    });
  }
  informationAudio() {
    return this.serial(async () => {
      const view = this.visible();
      if (view?.kind !== 'info') throw new Error('NO_ACTIVE_INFORMATION');
      const texts = view.spokenTexts.length ? view.spokenTexts : view.texts;
      const s = this.snapshot();
      s.profile = engine.commitExposure(s.profile, { texts });
      logSource(s, 'info', null);
      await this.save(s);
      return texts.join(' ');
    });
  }
  illustration(
    instanceId: string,
    variant: 'main' | 'alternate' | 'context' = 'main',
  ) {
    return this.serial(async () => {
      const s = this.snapshot(),
        active = s.profile.activeInstance;
      if (!active || active.instanceId !== instanceId)
        throw new Error('STALE_INSTANCE');
      const asset = illustrationMatch(
        this.supply.curriculum.items[active.itemId],
      );
      if (
        !asset ||
        !['main', 'alternate', 'context'].includes(variant) ||
        (asset.kind === 'story' && variant !== 'main')
      )
        throw new Error('INVALID_ILLUSTRATION');
      s.profile = engine.requestHelp(s.profile, this.supply.curriculum, {
        level: 1,
      });
      (s.profile.activeInstance as RuntimeInstance).illustrationVariant =
        variant;
      const shown = presentation(s.profile, this.supply);
      if (shown?.kind === 'task' && shown.hints.length)
        s.profile = engine.commitExposure(s.profile, { texts: shown.hints });
      logSource(s, 'help', instanceId);
      await this.save(s);
      return this.visible();
    });
  }
  optionAudio(
    instanceId: string,
    questionId: string | null,
    optionId: string | null,
  ) {
    return this.serial(async () => {
      const s = this.snapshot();
      const audio = optionAudio(
        s.profile,
        this.supply,
        instanceId,
        questionId,
        optionId,
      );
      s.profile = audio.profile;
      logSource(s, 'options', instanceId);
      await this.save(s);
      return audio.text;
    });
  }
  recordReading(instanceId: string, reading?: ReadingProof) {
    return this.serial(async () => {
      const s = this.snapshot();
      applyReading(s, this.supply, instanceId, reading);
      logSource(s, 'reading', instanceId);
      return this.save(s);
    });
  }
  revealOptions() {
    return this.serial(async () => {
      const s = this.snapshot();
      const instanceId = applyReveal(s, this.supply);
      logSource(s, 'options', instanceId);
      await this.save(s);
      return this.visible();
    });
  }
  updateInterests(tags: string[]) {
    return this.serial(async () => {
      const known = new Set(
        Object.values(this.supply.curriculum.items).flatMap(
          (item) => item.interestTags,
        ),
      );
      if (!Array.isArray(tags) || tags.some((tag) => !known.has(tag)))
        throw new Error('INVALID_INTERESTS');
      const s = this.snapshot();
      s.profile.interests = [...new Set(tags)];
      s.onboarding.questionnaire.interests = [...s.profile.interests];
      s.profile.revision++;
      return this.save(s);
    });
  }
  recordFreeExposure(input: string[] | FreeExposure) {
    return this.serial(async () => {
      const exposure = exposureInput(
        this.supply,
        Array.isArray(input) ? { texts: input } : input,
      );
      const s = this.snapshot();
      s.profile = engine.commitExposure(s.profile, exposure);
      s.sourceEvents.push({
        id: crypto.randomUUID(),
        source: 'free',
        routeId: null,
        routeVersion: null,
        instanceId: null,
        kind: 'free_exposure',
        customStepId: null,
      });
      return this.save(s);
    });
  }
}
