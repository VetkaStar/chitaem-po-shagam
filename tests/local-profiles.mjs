import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const source = ts.transpileModule(
  fs.readFileSync(path.join(root, 'lib/progress/profile-storage.ts'), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const selectedKey = 'reading-active-profile-v1';
const record = (id) => 'reading-profile-record-v1:' + id;
const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const profile = { name: 'Тестовый ученик', age: '8', start: 'letters' };
const keys = [
  'reading-profile-v1',
  'reading-steps-v3',
  'reading-text-options-v1',
];
function storage(entries = {}) {
  const data = new Map(Object.entries(entries));
  return {
    data,
    failRead: false,
    failWrite: false,
    get length() {
      return data.size;
    },
    key(index) {
      return [...data.keys()][index] ?? null;
    },
    getItem(key) {
      if (this.failRead) throw new Error('READ_DENIED');
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      if (this.failWrite) throw new Error('WRITE_DENIED');
      data.set(key, String(value));
    },
    removeItem(key) {
      if (this.failWrite) throw new Error('WRITE_DENIED');
      data.delete(key);
    },
  };
}
function tab(local = storage(), session = storage(), uuid = a) {
  const module = { exports: {} },
    reloads = [];
  vm.runInNewContext(
    source,
    {
      module,
      exports: module.exports,
      localStorage: local,
      sessionStorage: session,
      crypto: { randomUUID: () => uuid },
      location: { reload: () => reloads.push(true) },
    },
    { filename: 'profile-storage.js' },
  );
  return { api: module.exports, local, session, reloads };
}
let passed = 0,
  failed = 0;
async function test(name, run) {
  try {
    await run();
    console.log('PASS ' + name);
    passed++;
  } catch (error) {
    console.error('FAIL ' + name + ': ' + error.message);
    failed++;
  }
}
await test('legacy three keys and database remain unchanged', () => {
  const t = tab(
    storage({
      'reading-profile-v1': JSON.stringify(profile),
      'reading-steps-v3': 'old-progress',
      'reading-text-options-v1': 'old-settings',
    }),
  );
  assert.equal(t.api.bootProfile(), true);
  assert.equal(t.api.activeProfileId(), 'legacy');
  assert.equal(t.api.profileDatabaseName(), 'reading-platform-v1');
  for (const key of keys)
    assert.equal(t.api.browserStorage.getItem(key), t.local.getItem(key));
  t.api.browserStorage.setItem(keys[1], 'kept-legacy');
  assert.equal(t.local.getItem(keys[1]), 'kept-legacy');
});
await test('first fresh boot reserves one namespace and remains stable on reload', () => {
  const t = tab();
  assert.equal(t.api.bootProfile(), true);
  assert.equal(t.session.getItem(selectedKey), a);
  assert.equal(t.api.listLocalProfiles().length, 0);
  const reload = tab(t.local, t.session, b);
  assert.equal(reload.api.bootProfile(), true);
  assert.equal(reload.api.activeProfileId(), a);
});
await test('three keys and IndexedDB names never overlap across profiles', () => {
  const local = storage({ 'reading-steps-v3': 'untouched' });
  const first = tab(local, storage({ [selectedKey]: a }));
  const second = tab(local, storage({ [selectedKey]: b }));
  first.api.bootProfile();
  second.api.bootProfile();
  for (const key of keys) {
    first.api.browserStorage.setItem(key, 'one:' + key);
    second.api.browserStorage.setItem(key, 'two:' + key);
    assert.equal(first.api.browserStorage.getItem(key), 'one:' + key);
    assert.equal(second.api.browserStorage.getItem(key), 'two:' + key);
  }
  assert.equal(first.api.profileDatabaseName(), 'reading-platform-v1-' + a);
  assert.equal(second.api.profileDatabaseName(), 'reading-platform-v1-' + b);
  assert.equal(local.getItem('reading-steps-v3'), 'untouched');
  first.api.browserStorage.removeItem(keys[2]);
  assert.equal(second.api.browserStorage.getItem(keys[2]), 'two:' + keys[2]);
});
await test('registration makes one identity record and preserves supplied profile', () => {
  const t = tab();
  t.api.bootProfile();
  t.api.registerCurrentProfile(profile);
  assert.deepEqual(JSON.parse(t.local.getItem(record(a))), profile);
  assert.deepEqual(JSON.parse(JSON.stringify(t.api.listLocalProfiles())), [
    { id: a, ...profile },
  ]);
  assert.equal(t.local.data.size, 1);
});
await test('logout gates the reloaded tab without deleting progress', () => {
  const t = tab();
  t.api.bootProfile();
  t.api.registerCurrentProfile(profile);
  t.api.browserStorage.setItem(keys[1], 'progress');
  t.api.logoutProfile();
  assert.equal(t.reloads.length, 1);
  const next = tab(t.local, t.session);
  assert.equal(next.api.bootProfile(), false);
  assert.throws(
    () => next.api.browserStorage.getItem(keys[1]),
    /PROFILE_SIGNED_OUT/,
  );
  assert.equal(
    t.local.getItem('reading-local:' + a + ':' + keys[1]),
    'progress',
  );
});
await test('known selection opens only its namespace after reload', () => {
  const local = storage({
    [record(a)]: JSON.stringify(profile),
    [record(b)]: JSON.stringify({ ...profile, name: 'Второй' }),
  });
  const t = tab(local, storage({ [selectedKey]: a }));
  t.api.bootProfile();
  t.api.chooseProfile(b);
  assert.equal(t.session.getItem(selectedKey), b);
  assert.equal(t.reloads.length, 1);
  const next = tab(local, t.session);
  next.api.bootProfile();
  assert.equal(next.api.activeProfileId(), b);
});
await test('unknown, malformed and empty explicit selections are rejected before reload', () => {
  for (const id of [b, 'unknown', '../legacy', '__proto__', '']) {
    const t = tab(
      storage({ [record(a)]: JSON.stringify(profile) }),
      storage({ [selectedKey]: a }),
    );
    t.api.bootProfile();
    assert.throws(
      () => t.api.chooseProfile(id),
      /UNKNOWN_PROFILE|INVALID_PROFILE/,
    );
    assert.equal(t.session.getItem(selectedKey), a);
    assert.equal(t.reloads.length, 0);
  }
});
await test('failed registration neither claims success nor destroys another profile', () => {
  const local = storage({ [record(b)]: JSON.stringify(profile) });
  const t = tab(local, storage({ [selectedKey]: a }));
  t.api.bootProfile();
  local.failWrite = true;
  assert.throws(() => t.api.registerCurrentProfile(profile), /WRITE_DENIED/);
  assert.equal(local.getItem(record(a)), null);
  assert.equal(local.getItem(record(b)), JSON.stringify(profile));
});
await test('failed selection and logout do not reload or switch scope', () => {
  const t = tab(
    storage({ [record(a)]: JSON.stringify(profile) }),
    storage({ [selectedKey]: a }),
  );
  t.api.bootProfile();
  t.session.failWrite = true;
  assert.throws(() => t.api.chooseProfile(), /WRITE_DENIED/);
  assert.throws(() => t.api.logoutProfile(), /WRITE_DENIED/);
  assert.equal(t.reloads.length, 0);
  assert.equal(t.api.activeProfileId(), a);
});
await test('queued writes retain the booted namespace after choose and logout', async () => {
  const local = storage({
    [record(a)]: JSON.stringify(profile),
    [record(b)]: JSON.stringify(profile),
  });
  const t = tab(local, storage({ [selectedKey]: a }));
  t.api.bootProfile();
  const queued = Promise.resolve().then(() =>
    t.api.browserStorage.setItem(keys[1], 'queued-old'),
  );
  t.api.chooseProfile(b);
  await queued;
  assert.equal(
    local.getItem('reading-local:' + a + ':' + keys[1]),
    'queued-old',
  );
  assert.equal(local.getItem('reading-local:' + b + ':' + keys[1]), null);
  t.api.logoutProfile();
  t.api.browserStorage.setItem(keys[2], 'queued-logout');
  assert.equal(
    local.getItem('reading-local:' + a + ':' + keys[2]),
    'queued-logout',
  );
  assert.equal(t.api.profileDatabaseName(), 'reading-platform-v1-' + a);
});
await test('invalid registry values fail closed without mutation', () => {
  for (const raw of [
    '{',
    'null',
    '[]',
    '{}',
    JSON.stringify({ ...profile, name: ' ' }),
    JSON.stringify({ ...profile, age: 8 }),
    JSON.stringify({ ...profile, start: '__proto__' }),
    JSON.stringify({ ...profile, name: 'x'.repeat(31) }),
  ]) {
    const local = storage({ [record(a)]: raw });
    const t = tab(local);
    assert.throws(() => t.api.listLocalProfiles());
    assert.equal(local.getItem(record(a)), raw);
  }
});
await test('unsafe registry suffixes are ignored without becoming namespaces', () => {
  const local = storage({
    [record('__proto__')]: JSON.stringify(profile),
    [record('../legacy')]: JSON.stringify(profile),
  });
  const t = tab(local);
  assert.equal(t.api.listLocalProfiles().length, 0);
  assert.equal(local.data.size, 2);
});
await test('invalid selected namespace fails closed and preserves legacy data', () => {
  const local = storage({ 'reading-profile-v1': JSON.stringify(profile) });
  const t = tab(local, storage({ [selectedKey]: '../legacy' }));
  assert.throws(() => t.api.bootProfile(), /INVALID_PROFILE_SELECTION/);
  assert.throws(
    () => t.api.browserStorage.setItem(keys[1], 'bad'),
    /INVALID_PROFILE_SELECTION/,
  );
  assert.equal(local.data.size, 1);
});
await test('new tabs select independently and do not auto-open a nonlegacy profile', () => {
  const local = storage({
    [record(a)]: JSON.stringify(profile),
    [record(b)]: JSON.stringify(profile),
  });
  const first = tab(local, storage({ [selectedKey]: a }));
  first.api.bootProfile();
  const second = tab(local);
  assert.equal(second.api.bootProfile(), false);
  second.api.chooseProfile(b);
  assert.equal(first.session.getItem(selectedKey), a);
  assert.equal(first.api.activeProfileId(), a);
  const next = tab(local, second.session);
  next.api.bootProfile();
  assert.equal(next.api.activeProfileId(), b);
});
await test('storage read denial surfaces without resetting registry', () => {
  const t = tab(storage({ [record(a)]: JSON.stringify(profile) }));
  t.local.failRead = true;
  assert.throws(() => t.api.bootProfile(), /READ_DENIED/);
  assert.equal(t.local.data.size, 1);
  assert.equal(t.session.getItem(selectedKey), null);
});
console.log(`Local profiles: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
