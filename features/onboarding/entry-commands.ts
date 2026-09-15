import type {
  ProgressState,
  Supply,
  Questionnaire,
} from '../../lib/curriculum/types.js';
import { ensureEntry, checkpoint, decideEntryGroup } from './entry-state.js';
import * as entryActions from './entry-actions.js';
import { applyAnswer } from '../curriculum/task-transitions.js';
import { recordEntryCompletion } from './entry-execution.js';
import { logSource } from '../curriculum/state-transitions.js';
/** Commands mutate the controller-owned draft; this class owns no state or storage. */
export abstract class EntryCommands {
  protected abstract supply: Supply;
  protected abstract changeEntry(
    fn: (s: ProgressState) => void,
  ): Promise<ProgressState>;
  editQuestionnaire() {
    return this.changeEntry((s) => {
      if (s.profile.activeInstance || ensureEntry(s).suspendedInstance)
        throw new Error('FINISH_ENTRY_TASK_FIRST');
      s.onboarding.screen = 'questionnaire';
    });
  }
  pauseEntryReport() {
    return this.changeEntry((s) =>
      entryActions.pauseEntryReport(s, this.supply),
    );
  }
  continueQuestionnaire() {
    return this.changeEntry((s) => entryActions.questionnaireReady(s));
  }
  saveAccess(q: Questionnaire) {
    return this.changeEntry((s) => entryActions.accessSave(s, q));
  }
  answerAccess(shape: 'circle' | 'square') {
    return this.changeEntry((s) => entryActions.accessAnswer(s, shape));
  }
  startEntryCheck() {
    return this.changeEntry((s) =>
      entryActions.beginEntryCheck(s, this.supply),
    );
  }
  finishEntryPractice() {
    return this.changeEntry((s) => {
      const f = ensureEntry(s);
      if (!f.practice || s.profile.activeInstance)
        throw new Error('PRACTICE_ACTIVE');
      f.practice = null;
      s.onboarding.screen = 'placement_report';
    });
  }
  retestEntry() {
    return this.changeEntry((s) => entryActions.retestEntry(s, this.supply));
  }
  finishEntryGroup(confirm: boolean) {
    return this.changeEntry((s) => decideEntryGroup(s, this.supply, confirm));
  }
  deferEntryCheck() {
    return this.changeEntry((s) => {
      const active = s.profile.activeInstance;
      if (active) {
        const program = s.profile.currentProgramId;
        s.profile.currentProgramId = null;
        applyAnswer(s, this.supply, {
          instanceId: active.instanceId,
          disposition: 'skipped',
        });
        s.profile.currentProgramId = program;
        recordEntryCompletion(s, this.supply, active.instanceId);
        logSource(s, 'answer', active.instanceId);
      }
      entryActions.deferCheck(s, this.supply);
    });
  }
  startEntryPractice() {
    return this.changeEntry((s) => entryActions.startPractice(s, this.supply));
  }
  requestPrerequisite() {
    return this.changeEntry((s) =>
      entryActions.requestPrerequisite(s, this.supply),
    );
  }
  requestSideCheck() {
    return this.changeEntry((s) => entryActions.requestSide(s, this.supply));
  }
  acceptPlacement() {
    return this.changeEntry((s) =>
      entryActions.acceptPlacement(s, this.supply),
    );
  }
  markEntryMemorised(instanceId: string, value: boolean) {
    return this.changeEntry((s) => {
      if (
        s.studyMode !== 'entry' ||
        s.profile.activeInstance?.instanceId !== instanceId ||
        typeof value !== 'boolean'
      )
        throw new Error('STALE_ENTRY_OBSERVATION');
      checkpoint(s).metadata[instanceId].onlyMemorised = value;
    });
  }
}
