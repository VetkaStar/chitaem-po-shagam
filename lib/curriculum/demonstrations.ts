import type { Supply } from './types.js';
export function demoEpisode(supply: Supply, method: string) {
  const catalog = supply.curriculum.methodComparison as Record<
    string,
    { episodeId?: string }
  >;
  const episode = supply.curriculum.episodes[catalog[method]?.episodeId ?? ''];
  if (
    !['p1', 'p2'].includes(method) ||
    !episode ||
    episode.purpose !== 'demonstration'
  )
    throw new Error('UNKNOWN_DEMONSTRATION');
  return episode;
}
