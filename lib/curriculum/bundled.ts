import { loadSupply } from './loader.js';
import type { Supply } from './types.js';
let pending: Promise<Supply> | undefined;
/** Lazy: free trainers do not need to load the curriculum or open a profile. */
export function loadBundledSupply(): Promise<Supply> {
  return pending ??= Promise.all([
    import('../../content/curriculum/curriculum.json?raw'),
    import('../../content/curriculum/entry_registry.json?raw'),
  ]).then(([c, r]) => loadSupply(c.default, r.default)).catch(error => { pending = undefined; throw error; });
}
