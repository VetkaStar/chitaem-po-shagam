import type { Supply } from '../../lib/curriculum/types';
import type { CurriculumController } from '../curriculum/controller';
import {
  lessonTrainerItems,
  openTrainerLesson,
} from './trainer-lesson-session';
export type SyllablePartsKind = 'compose' | 'find_part';
export const syllablePartsItems = (
  supply: Supply,
  kind: SyllablePartsKind,
  unit: number,
) => lessonTrainerItems(supply, kind, 'syllables', unit);
export const openSyllableParts = (
  controller: CurriculumController,
  supply: Supply,
  kind: SyllablePartsKind,
  unit: number,
  length: number,
  fresh = false,
) =>
  openTrainerLesson(controller, supply, kind, 'syllables', unit, length, fresh);
