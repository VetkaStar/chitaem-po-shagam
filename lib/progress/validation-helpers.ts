import { demand, object } from '../curriculum/loader.js';
import type { Curriculum } from '../curriculum/types.js';
import { own } from '../curriculum/loader.js';
export const LEGACY_KEYS = [
  'reading-profile-v1',
  'reading-steps-v3',
  'reading-text-options-v1',
] as const;
export const modes = ['read', 'listen', 'shared'];
export const phases = [
  'model',
  'anchor',
  'guided',
  'independent',
  'application',
  'review',
  'support',
  'demo',
  'free',
];
export const contexts = ['route', 'free', 'support', 'demo'];
export const isText = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0;
export const nullableText = (v: unknown) => v === null || isText(v);
export const booleanOrNull = (v: unknown) =>
  v === null || typeof v === 'boolean';
export function jsonTree(v: unknown, depth = 0): void {
  demand(depth < 80, 'JSON depth');
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
  if (typeof v === 'number') {
    demand(Number.isFinite(v), 'finite number');
    return;
  }
  if (Array.isArray(v)) {
    for (const item of v) jsonTree(item, depth + 1);
    return;
  }
  demand(object(v), 'JSON value');
  for (const [key, child] of Object.entries(v)) {
    demand(
      !['__proto__', 'constructor', 'prototype'].includes(key),
      'unsafe key',
    );
    jsonTree(child, depth + 1);
  }
}
export function proof(v: unknown) {
  demand(object(v), 'reading proof');
  // {} is the core representation of an unassessed reading stage.
  if (Object.keys(v).length)
    demand(
      v.verifier === 'companion' && typeof v.correct === 'boolean',
      'reading verifier',
    );
}

export function catalogChecks(c: Curriculum) {
  return {
    prog: (id: unknown) =>
      typeof id === 'string' && c.programs.some((x) => x.id === id),
    node: (id: unknown) => typeof id === 'string' && own(c.nodes, id),
    item: (id: unknown) => typeof id === 'string' && own(c.items, id),
  };
}
