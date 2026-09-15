import { loadSupply } from './loader.js';
import type { Supply } from './types.js';
let pending: Promise<Supply> | undefined;
/** Loaded on entering a curriculum screen or before the first free-material exposure. */
export function loadBundledSupply(): Promise<Supply> {
  return pending ??= Promise.all([
    import('../../content/curriculum/curriculum.json?raw'),
    import('../../content/curriculum/entry_registry.json?raw'),
  ]).then(([c, r]) => loadSupply(c.default, r.default)).catch(error => { pending = undefined; throw error; });
}
