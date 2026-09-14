import type {
  ProgressState,
  ProgressStore,
  Supply,
  Action,
  CustomRoute,
  Questionnaire,
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
import { presentation } from './presentation.js';
export interface PlanToken {
  storageRevision: number;
  kind: string;
  planId: string | null;
}
export class CurriculumController {
  private tail: Promise<unknown> = Promise.resolve();
  private pending: { token: PlanToken; action: Action } | null = null;
  private constructor(
    private supply: Supply,
    private store: ProgressStore,
    private state: ProgressState,
    private sources: Record<'recommended' | 'custom', ActionSource>,
  ) {}
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
    // A deferred route cannot accidentally show the active informational screen of a parked course.
    if (
      this.state.studyMode !== 'recommended' &&
      !this.state.profile.activeInstance
    )
      return null;
    return presentation(this.state.profile, this.supply);
  }
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn);
    this.tail = result.catch(() => undefined);
    return result;
  }
  private async save(next: ProgressState, backup = false) {
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
      if (s.studyMode === 'custom' && p.activeInstance)
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
  launch(token: PlanToken, instanceId = crypto.randomUUID()) {
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
      if (a.kind === 'custom_task')
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
      await this.save(s);
      return this.visible();
    });
  }
  launchFree(
    itemId: string,
    mode: 'read' | 'listen' | 'shared',
    instanceId = crypto.randomUUID(),
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
      applyAnswer(s, this.supply, submission);
      logSource(s, 'answer', submission.instanceId);
      return this.save(s);
    });
  }
  acknowledge(planId: string) {
    return this.serial(async () => {
      if (this.state.studyMode !== 'recommended')
        throw new Error('NOT_RECOMMENDED_ROUTE');
      const s = this.snapshot();
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
      logSource(s, 'help', s.profile.activeInstance!.instanceId);
      await this.save(s);
      return this.visible();
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
  recordFreeExposure(texts: string[]) {
    return this.serial(async () => {
      if (!Array.isArray(texts) || !texts.every((x) => typeof x === 'string'))
        throw new Error('INVALID_EXPOSURE');
      const s = this.snapshot();
      s.profile = engine.commitExposure(s.profile, { texts });
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
