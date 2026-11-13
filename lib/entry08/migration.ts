import type { ProgressState } from '../curriculum/types';
import type { Answers, EntryUi } from './types';
import { entry } from './api';
export function migrateAnswers(state: ProgressState, age?: string): Answers {
  const q = state.onboarding.questionnaire,
    a: Answers = {};
  if (q.respondent)
    a.respondent = q.respondent === 'learner' ? 'self' : 'parent';
  if (q.ageBand)
    a.age = ['under_6', '6_7'].includes(q.ageBand)
      ? 'under8'
      : q.ageBand === '8_12'
        ? '8to12'
        : '13plus';
  else if (age && /^\d+$/.test(age))
    a.age = Number(age) < 8 ? 'under8' : Number(age) <= 12 ? '8to12' : '13plus';
  else if (age === '12+') a.age = 'unknown'; // The saved range crosses the new boundary; do not invent an exact age or ask again.
  if (q.reads?.length) a.reads = q.reads;
  if (q.blendingDifficulty === 'often' || q.blendingDifficulty === 'sometimes')
    a.difficulty = 'blending';
  if (['words', 'sentences', 'meaning'].includes(q.goal ?? '')) a.goal = q.goal;
  if (q.companionAvailable !== null)
    a.companion = q.companionAvailable ? 'yes' : 'no';
  if (['voice', 'buttons', 'both'].includes(q.responseMode ?? ''))
    a.input = q.responseMode;
  else if (q.responseMode === 'voice_companion') a.input = 'voice';
  else if (
    q.responseMode === 'keyboard' ||
    q.responseMode === 'companion_select'
  )
    a.input = 'buttons';
  if (q.interests?.length) {
    const known = q.interests.filter((x) =>
      ['technology', 'videogames', 'animals', 'everyday'].includes(x),
    );
    if (known.length) a.interests = known;
  }
  a.program =
    state.profile.currentProgramId ?? q.program ?? 'method_syllable_first';
  return a;
}
export function questionPage(answers: Answers): EntryUi['page'] {
  if (!answers.respondent) return 'role';
  if (!answers.age) return 'age';
  if (answers.respondent === 'child')
    return answers.interests ? 'access' : 'interests';
  const next = entry.questionnaireFor(answers)[0];
  return !next ? 'access' : next.id === 'interests' ? 'interests' : 'questions';
}
