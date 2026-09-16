/** A tab keeps one namespace until reload; pending writes cannot cross profiles. */
const selectionKey = 'reading-active-profile-v1';
const registryPrefix = 'reading-profile-record-v1:';
const validId = (id: string) =>
  id === 'legacy' ||
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export interface LocalProfile {
  id: string;
  name: string;
  age: string;
  start: string;
}
let pinned: string | undefined;
export function activeProfileId(): string {
  if (pinned) return pinned;
  if (typeof sessionStorage === 'undefined') return 'legacy';
  const selected = sessionStorage.getItem(selectionKey);
  if (selected === 'signed-out') throw new Error('PROFILE_SIGNED_OUT');
  if (selected && !validId(selected))
    throw new Error('INVALID_PROFILE_SELECTION');
  pinned = selected || 'legacy';
  return pinned;
}
function storageKey(key: string) {
  const id = activeProfileId();
  if (id === 'legacy') return key;
  return key === 'reading-profile-v1'
    ? registryPrefix + id
    : `reading-local:${id}:${key}`;
}
export const browserStorage = {
  getItem(key: string) {
    return localStorage.getItem(storageKey(key));
  },
  setItem(key: string, value: string) {
    localStorage.setItem(storageKey(key), value);
  },
  removeItem(key: string) {
    localStorage.removeItem(storageKey(key));
  },
};
export function profileDatabaseName(): string {
  const id = activeProfileId();
  return id === 'legacy' ? 'reading-platform-v1' : `reading-platform-v1-${id}`;
}
function parse(raw: string | null, id: string): LocalProfile | null {
  if (!raw) return null;
  const p = JSON.parse(raw);
  if (
    !p ||
    typeof p.name !== 'string' ||
    !p.name.trim() ||
    p.name.length > 30 ||
    !['3', '4', '5', '6', '7', '8', '9', '10', '11', '12+'].includes(p.age) ||
    ![
      'letters',
      'syllables',
      'words',
      'pictures',
      'sentences',
      'stories',
      'poems',
    ].includes(p.start)
  )
    throw new Error('INVALID_LOCAL_PROFILE');
  return { id, name: p.name, age: p.age, start: p.start };
}
export function listLocalProfiles(): LocalProfile[] {
  const result: LocalProfile[] = [];
  const legacy = parse(localStorage.getItem('reading-profile-v1'), 'legacy');
  if (legacy) result.push(legacy);
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    if (!key.startsWith(registryPrefix)) continue;
    const id = key.slice(registryPrefix.length);
    if (!validId(id) || id === 'legacy') continue;
    const p = parse(localStorage.getItem(key), id);
    if (p) result.push(p);
  }
  return result;
}
export function registerCurrentProfile(profile: {
  name: string;
  age: string;
  start: string;
}): void {
  const encoded = JSON.stringify(profile);
  parse(encoded, activeProfileId());
  // Identity and profile-list entry are one atomic localStorage record.
  browserStorage.setItem('reading-profile-v1', encoded);
}
export function bootProfile(): boolean {
  const selected = sessionStorage.getItem(selectionKey);
  if (selected === 'signed-out') return false;
  if (selected) {
    if (!validId(selected)) throw new Error('INVALID_PROFILE_SELECTION');
    pinned = selected;
    return true;
  }
  if (listLocalProfiles().length) {
    if (localStorage.getItem('reading-profile-v1')) {
      sessionStorage.setItem(selectionKey, 'legacy');
      pinned = 'legacy';
      return true;
    }
    return false;
  }
  const id = crypto.randomUUID();
  sessionStorage.setItem(selectionKey, id);
  pinned = id;
  return true;
}
export function chooseProfile(id?: string): void {
  if (
    id !== undefined &&
    !listLocalProfiles().some((profile) => profile.id === id)
  )
    throw new Error('UNKNOWN_PROFILE');
  sessionStorage.setItem(selectionKey, id ?? crypto.randomUUID());
  location.reload();
}
export function logoutProfile(): void {
  sessionStorage.setItem(selectionKey, 'signed-out');
  location.reload();
}
