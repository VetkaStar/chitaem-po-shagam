import type { EntryState, EntryUi } from './types';
import type { PersonalRun } from './personal';

export type EntryAge = 'under8' | '8to12' | '13plus' | 'unknown';
export function profileAgeBand(age?: string): EntryAge | undefined {
  if (age === '12+') return 'unknown';
  if (age === '13+') return '13plus';
  if (!age || !/^\d+$/.test(age)) return undefined;
  const years = Number(age);
  if (years < 3 || years > 12) return undefined;
  return years < 8 ? 'under8' : '8to12';
}
export function ageVisitBudget(age: string): 3 | 5 {
  return age === 'under8' || age === 'unknown' ? 3 : 5;
}

/** Keep the reserved attempt and consumed budget intact; the next visit uses the new age. */
export function syncProfileAge(
  age: string | undefined,
  ui: EntryUi,
  entry?: EntryState,
  personal?: PersonalRun,
): { ui: EntryUi; entry?: EntryState; personal?: PersonalRun } {
  let band = profileAgeBand(age);
  if (!band) return { ui, entry, personal };
  const clarified = [ui.answers.age, entry?.config.age].find((value) =>
    value === 'under8' || value === '8to12' || value === '13plus') as EntryAge | undefined;
  if (clarified && (age === '12+' || ui.profileAge === age)) band = clarified;
  const budget = ageVisitBudget(band);
  const nextUi = { ...ui, profileAge: age, answers: { ...ui.answers, age: band } };
  const nextEntry = entry ? structuredClone(entry) : undefined;
  if (nextEntry) {
    nextEntry.config.age = band;
    if (!nextEntry.active && nextEntry.visit.used === 0) nextEntry.visit.budget = budget;
    const totalBudget = budget === 3 ? 4 : 6;
    if (nextEntry.total <= totalBudget) nextEntry.totalBudget = totalBudget;
    if (JSON.stringify(nextEntry) !== JSON.stringify(entry)) nextEntry.revision++;
  }
  const nextPersonal = personal ? structuredClone(personal) : undefined;
  if (nextPersonal && !nextPersonal.active && nextPersonal.visit.used === 0) {
    if (nextPersonal.visit.budget !== budget) nextPersonal.revision++;
    nextPersonal.visit.budget = budget;
  }
  return { ui: nextUi, entry: nextEntry, personal: nextPersonal };
}
