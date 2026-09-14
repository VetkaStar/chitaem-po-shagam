import type { Supply, Curriculum, EntryRegistry } from './types.js';
export const CURRICULUM_SHA = '03c8a7b0d4af5c42d63ff7cb732c1489a04d89a5197f78b2c4c58c72d6440745';
export const ENTRY_SHA = '1aec61f84242a14c74131b9dcbfea7cecc039fb57a12b670fcee6adc0573c368';
export function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function demand(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('INVALID_CURRICULUM_DATA: ' + message);
}
export function strings(v: unknown): v is string[] { return Array.isArray(v) && v.every(x => typeof x === 'string'); }
export function natural(v: unknown): v is number { return Number.isSafeInteger(v) && Number(v) >= 0; }
export function own(o: object, key: string) { return Object.prototype.hasOwnProperty.call(o, key); }
export async function sha256(raw: string | Uint8Array): Promise<string> {
  const bytes = typeof raw === 'string' ? new TextEncoder().encode(raw) : new Uint8Array(raw);
  const hash = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('');
}
export async function loadSupply(curriculumRaw: string, registryRaw: string): Promise<Supply> {
  demand(await sha256(curriculumRaw) === CURRICULUM_SHA, 'curriculum SHA256');
  demand(await sha256(registryRaw) === ENTRY_SHA, 'entry SHA256');
  const c: unknown = JSON.parse(curriculumRaw), r: unknown = JSON.parse(registryRaw);
  demand(object(c) && c.schemaVersion === '2.0.0' && c.contentVersion === '0.7.0', 'curriculum version');
  demand(object(r) && r.specVersion === 'onboarding-0.7.3' && r.curriculumSha256 === CURRICULUM_SHA
    && r.curriculumVersion === c.contentVersion && r.curriculumSchemaVersion === c.schemaVersion, 'registry version');
  for (const key of ['items', 'nodes', 'episodes', 'skills', 'capabilitySupports', 'taskSets']) demand(object(c[key]), key);
  demand(object(r.groups) && Array.isArray(c.programs) && c.programs.length === 2, 'registries');
  const curriculum = c as unknown as Curriculum, registry = r as unknown as EntryRegistry;
  const kinds = ['read', 'choice', 'find_part', 'transform', 'compose', 'passage', 'boundary', 'read_meaning'];
  for (const [id, task] of Object.entries(curriculum.items)) {
    demand(object(task) && task.id === id && kinds.includes(task.kind), 'task ' + id);
    demand(typeof task.learnerText === 'string' && typeof task.contentHash === 'string' && object(task.answer), 'task shape ' + id);
    demand(Array.isArray(task.options) && strings(task.allowedModes), 'task modes ' + id);
  }
  const programIds = new Set(curriculum.programs.map(p => p.id));
  demand(programIds.has('method_syllable_first') && programIds.has('method_word_first'), 'both manifests');
  for (const p of curriculum.programs) {
    demand(p.version === '0.7.0' && strings(p.nodeIds) && strings(p.defaultPath), 'manifest');
    for (const id of p.nodeIds) demand(curriculum.nodes[id]?.programId === p.id, 'program node ' + id);
    demand(p.defaultPath.every(id => p.nodeIds.includes(id)), 'default path');
  }
  for (const [id, ep] of Object.entries(curriculum.episodes)) {
    demand(ep.id === id && Array.isArray(ep.steps) && ep.steps.length > 0, 'episode ' + id);
    demand(new Set(ep.steps.map(s => s.id)).size === ep.steps.length, 'duplicate steps');
    for (const step of ep.steps) demand(!step.itemId || own(curriculum.items, step.itemId), 'step item');
  }
  for (const [id, g] of Object.entries(registry.groups)) {
    demand(g.id === id && own(curriculum.skills, g.skillId) && strings(g.orderedItemIds), 'entry group ' + id);
    demand(g.orderedItemIds.every(itemId => own(curriculum.items, itemId)), 'entry item');
    demand(g.successNextGroup === null || own(registry.groups, g.successNextGroup), 'entry next');
  }
  return { curriculum, registry };
}
