import type { Task } from '../../lib/curriculum/contracts.js';

export type TrainerSection =
  | 'letters'
  | 'syllables'
  | 'words'
  | 'sentences'
  | 'stories'
  | 'pictures'
  | 'poems';

// UI grouping of the supplied six trainer kinds; the source bank stays intact.
// Explicit IDs distinguish syllables from real short words (for example, УМ).
const syllableItems = new Set([
  'task.v7.d451e155219e',
  'task.v7.ca7ae081835c',
  'task.v7.163e18745afb',
  'task.v7.2ee1a40f1e1a',
  'task.v7.f42fec45c344',
  'task.v7.1b2f9514db8a',
  'task.v7.b47846279769',
  'task.v7.80d146990160',
  'task.v7.55748f02e0de',
  'task.v7.ea56e89c820b',
  'task.v7.ec472ae80d1b',
  'task.v7.c8f6403dd618',
  'task.v7.b68eeef2e37f',
  'task.v7.c17c63edf627',
  'task.v7.9fee24413eee',
  'task.v7.21ce8e9ba041',
  'task.v7.32ab13dd6908',
  'task.v7.9b6b7d3d4481',
  'task.v7.3a43c4ab34f1',
  'task.v7.6f400066d732',
  'task.v7.5f1df14ff398',
  'task.v7.73ba508d66e7',
  'task.v7.5966f0bc7837',
  'task.v7.44bc53b3da69',
  'task.v7.0372203f6e8a',
  'task.v7.92cf23fb402f',
  'task.v7.fea6a779585a',
  'task.d8428e54ab26',
  'task.e50b797b1842',
  'task.b031335cb0ae',
]);

const sentenceItems = new Set([
  'task.v7.9c985e43ef81',
  'task.v7.a88d221e7c1c',
  'task.e2671d7e7b12',
  'task.663b937452ec',
]);

// Connected mini-texts, unlike the independent rows in text_comparison.
const storyItems = new Set([
  'task.v7.f8131cf710e6',
  'task.v7.d82c3abc0595',
  'task.v7.b740292591de',
  'task.v7.469cd59f1d79',
  'task.v7.487696e8fef4',
  'task.v7.486864352695',
  'task.v7.62078b2d90a0',
  'task.v7.5aaf284458b7',
  'task.v7.c906c0182cac',
  'task.v7.446b4dc8fa84',
]);

export function taskSection(task: Task): TrainerSection {
  if (syllableItems.has(task.id)) return 'syllables';
  if (storyItems.has(task.id)) return 'stories';
  if (sentenceItems.has(task.id)) return 'sentences';
  if (task.kind === 'choice') {
    if (task.evidenceType === 'letter_form') return 'letters';
    if (task.evidenceType === 'text_comparison') return 'sentences';
  }
  if (
    task.kind === 'find_part' &&
    'skillIds' in task &&
    Array.isArray(task.skillIds) &&
    task.skillIds.includes('analyse.meaning_component')
  ) {
    return 'sentences';
  }
  return 'words';
}
