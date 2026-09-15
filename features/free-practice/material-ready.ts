const pending = new Set<object>();
const listeners = new Set<() => void>();
export const freeMaterialReady = () => pending.size === 0;
export function setMaterialPending(id: object, value: boolean) {
  const before = freeMaterialReady();
  if (value) pending.add(id);
  else pending.delete(id);
  if (before !== freeMaterialReady())
    for (const listener of listeners) listener();
}
export function subscribeMaterialReady(listener: () => void) {
  listeners.add(listener);
  listener();
  return () => {
    listeners.delete(listener);
  };
}
