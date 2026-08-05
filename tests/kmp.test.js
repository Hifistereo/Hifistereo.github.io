// Tests for shared/kmp.js — the shared child profile store.
//
// This file is a contract with five separate repositories, so the cases that
// matter most are the hostile ones. A game must survive being opened with no
// kmp:* at all (that is hifistereo.github.io/<repo>/, a different origin),
// with storage disabled, and with hand-mangled JSON — because in every one of
// those situations the alternative is a child staring at a blank screen.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SOURCE = readFileSync(new URL('../shared/kmp.js', import.meta.url), 'utf8');

/** A fresh KMP bound to a fake localStorage, so tests cannot leak into each other. */
function load({ storage = fakeStorage(), noStorage = false } = {}) {
  const sandbox = { console };
  if (!noStorage) sandbox.localStorage = storage;
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('globalThis', 'module', `${SOURCE}\nreturn globalThis.KMP;`)(sandbox, module);
  return { KMP: sandbox.KMP, storage };
}

function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
    _dump: () => Object.fromEntries(map),
  };
}

const ANNA = { id: 'anna-1a2b', name: 'Anna', ageYears: 5, avatar: 'lapsa' };
const JANIS = { id: 'janis-9z8y', name: 'Jānis', ageYears: 3, avatar: 'varde' };

// --- degrading to nothing ---------------------------------------------------

test('with no kmp:* at all, a game still gets a usable child', () => {
  const { KMP } = load();
  const child = KMP.activeChild();
  assert.equal(child.guest, true);
  assert.equal(child.name, '');
  assert.equal(child.ageYears, null);
  assert.ok(child.id, 'guest must still have an id so keys can be namespaced');
});

test('with localStorage entirely unavailable, nothing throws', () => {
  const { KMP } = load({ noStorage: true });
  assert.equal(KMP.activeChild().guest, true);
  assert.deepEqual(KMP.prefs(), { sound: true, reducedMotion: false });
  assert.equal(KMP.ageBand('eng'), null);
  assert.equal(KMP.lastVisit(), null);
  assert.doesNotThrow(() => KMP.noteVisit('Paint'));
  assert.equal(KMP.migrateKey('anything'), false);
  assert.equal(KMP.setActive('x'), false);
});

test('when localStorage throws on write, reads still work', () => {
  const hostile = fakeStorage({ 'kmp:profiles': JSON.stringify([ANNA]), 'kmp:active': ANNA.id });
  hostile.setItem = () => { throw new Error('QuotaExceededError'); };
  const { KMP } = load({ storage: hostile });
  // The probe write fails, so the store reports no backend and falls back to
  // guest rather than half-reading. What matters is that it does not throw.
  assert.doesNotThrow(() => KMP.activeChild());
  assert.doesNotThrow(() => KMP.noteVisit('Memory'));
});

test('malformed JSON never throws and never yields a broken profile', () => {
  for (const junk of ['{not json', 'null', '"a string"', '42', '[]', '[{"no":"id"}]']) {
    const { KMP } = load({ storage: fakeStorage({ 'kmp:profiles': junk }) });
    assert.doesNotThrow(() => KMP.activeChild(), `threw on ${junk}`);
    assert.ok(Array.isArray(KMP.profiles()), `profiles() not an array for ${junk}`);
    assert.equal(KMP.activeChild().guest, true, `bad profile survived ${junk}`);
  }
});

test('the frozen guest cannot be mutated by a careless caller', () => {
  const { KMP } = load();
  const child = KMP.activeChild();
  try { child.name = 'Injected'; } catch { /* strict mode throws, fine */ }
  assert.equal(KMP.activeChild().name, '', 'the shared guest default was mutated');
});

// --- profiles ---------------------------------------------------------------

test('the active child is the one kmp:active points at', () => {
  const { KMP } = load({ storage: fakeStorage({
    'kmp:profiles': JSON.stringify([ANNA, JANIS]),
    'kmp:active': JANIS.id,
  }) });
  assert.equal(KMP.activeChild().name, 'Jānis');
  assert.equal(KMP.profiles().length, 2);
});

test('an active id pointing at a deleted profile falls back to the first, not to guest', () => {
  // Falling back to guest would make a child appear to have lost their whole
  // collection, because every namespaced key would change at once.
  const { KMP } = load({ storage: fakeStorage({
    'kmp:profiles': JSON.stringify([ANNA]),
    'kmp:active': 'someone-who-was-deleted',
  }) });
  assert.equal(KMP.activeChild().id, ANNA.id);
  assert.equal(KMP.activeChild().guest, false);
});

test('profiles are capped and malformed entries are dropped, not fatal', () => {
  const { KMP } = load({ storage: fakeStorage({
    'kmp:profiles': JSON.stringify([ANNA, null, { name: 'no id' }, JANIS, ANNA, ANNA, ANNA, ANNA]),
  }) });
  const list = KMP.profiles();
  assert.ok(list.length <= KMP.MAX_PROFILES);
  assert.ok(list.every((p) => p.id));
});

test('a stored name is clamped rather than trusted', () => {
  const { KMP } = load({ storage: fakeStorage({
    'kmp:profiles': JSON.stringify([{ id: 'x', name: 'A'.repeat(200), ageYears: 4 }]),
    'kmp:active': 'x',
  }) });
  assert.equal(KMP.activeChild().name.length, 16);
});

test('saveProfiles round-trips through setActive', () => {
  const { KMP } = load();
  KMP.saveProfiles([ANNA, JANIS]);
  KMP.setActive(JANIS.id);
  assert.equal(KMP.activeChild().name, 'Jānis');
});

test('makeId is slugged, bounded and unique', () => {
  const { KMP } = load();
  const a = KMP.makeId('Anna Marija');
  assert.match(a, /^[a-z0-9-]+$/);
  assert.notEqual(a, KMP.makeId('Anna Marija'));
  assert.match(KMP.makeId(' Āķīšs Žēl'), /^[a-z0-9-]+$/, 'diacritics must not leak into an id');
  assert.ok(KMP.makeId('').length > 0);
});

// --- per-child keys ---------------------------------------------------------

test('keys are namespaced per child, so siblings never collide', () => {
  const storage = fakeStorage({
    'kmp:profiles': JSON.stringify([ANNA, JANIS]),
    'kmp:active': ANNA.id,
  });
  const { KMP } = load({ storage });
  const annaKey = KMP.key('burtu-feja-progress');
  KMP.setActive(JANIS.id);
  const janisKey = KMP.key('burtu-feja-progress');
  assert.notEqual(annaKey, janisKey);
  assert.match(annaKey, /^burtu-feja-progress:/);
});

test('migrateKey moves pre-existing data onto the active child exactly once', () => {
  const storage = fakeStorage({
    'kmp:profiles': JSON.stringify([ANNA]),
    'kmp:active': ANNA.id,
    'burtu-feja-progress': '{"stars":42}',
  });
  const { KMP } = load({ storage });

  assert.equal(KMP.migrateKey('burtu-feja-progress'), true);
  assert.equal(storage.getItem(`burtu-feja-progress:${ANNA.id}`), '{"stars":42}');
  assert.equal(storage.getItem('burtu-feja-progress'), null, 'legacy key should be cleared');

  // Safe to call on every boot.
  assert.equal(KMP.migrateKey('burtu-feja-progress'), false);
});

test('migrateKey never clobbers a child who already has data', () => {
  const storage = fakeStorage({
    'kmp:profiles': JSON.stringify([ANNA]),
    'kmp:active': ANNA.id,
    'burtu-feja-progress': '{"stars":1}',
    [`burtu-feja-progress:${ANNA.id}`]: '{"stars":99}',
  });
  const { KMP } = load({ storage });
  assert.equal(KMP.migrateKey('burtu-feja-progress'), false);
  assert.equal(storage.getItem(`burtu-feja-progress:${ANNA.id}`), '{"stars":99}');
});

test('migrating with no profile set up parks the data under guest, not nowhere', () => {
  const storage = fakeStorage({ 'ciparu-darzs-data': '{"v":1}' });
  const { KMP } = load({ storage });
  assert.equal(KMP.migrateKey('ciparu-darzs-data'), true);
  assert.equal(storage.getItem('ciparu-darzs-data:guest'), '{"v":1}');
});

// --- age bands --------------------------------------------------------------

test('one stored age maps onto each game\'s own bands', () => {
  const cases = [
    [2, 2, '2-3', 'toddler'],
    [3, 2, '2-3', 'toddler'],
    [4, 2, '4-5', 'preschool'],
    [5, 5, '4-5', 'preschool'],
    [6, 5, '5-6', 'preschool'],
    [7, 5, '5-6', 'school'],
  ];
  for (const [years, eng, memory, band] of cases) {
    const { KMP } = load({ storage: fakeStorage({
      'kmp:profiles': JSON.stringify([{ id: 'k', name: 'K', ageYears: years }]),
      'kmp:active': 'k',
    }) });
    assert.equal(KMP.ageBand('eng'), eng, `eng band for age ${years}`);
    assert.equal(KMP.ageBand('memory'), memory, `memory band for age ${years}`);
    assert.equal(KMP.ageBand('band'), band, `generic band for age ${years}`);
  }
});

test('an unknown age returns null so callers ask rather than guess', () => {
  const { KMP } = load({ storage: fakeStorage({
    'kmp:profiles': JSON.stringify([{ id: 'k', name: 'K' }]),
    'kmp:active': 'k',
  }) });
  assert.equal(KMP.ageBand('eng'), null);
  assert.equal(KMP.ageBand('memory'), null);
});

// --- preferences ------------------------------------------------------------

test('preferences default to sound on, motion unrestricted', () => {
  const { KMP } = load();
  assert.deepEqual(KMP.prefs(), { sound: true, reducedMotion: false });
});

test('preferences round-trip and coerce junk to the safe default', () => {
  const { KMP } = load();
  KMP.savePrefs({ sound: false, reducedMotion: true });
  assert.deepEqual(KMP.prefs(), { sound: false, reducedMotion: true });

  const { KMP: junk } = load({ storage: fakeStorage({ 'kmp:prefs': '"nonsense"' }) });
  assert.deepEqual(junk.prefs(), { sound: true, reducedMotion: false });
});

// --- last visit -------------------------------------------------------------

test('noteVisit records the app and the child, and is the only key games write', () => {
  const storage = fakeStorage({
    'kmp:profiles': JSON.stringify([ANNA]),
    'kmp:active': ANNA.id,
  });
  const { KMP } = load({ storage });
  KMP.noteVisit('KidlaTest');

  const seen = KMP.lastVisit();
  assert.equal(seen.app, 'KidlaTest');
  assert.equal(seen.child, ANNA.id);
  assert.ok(seen.at > 0);

  const written = Object.keys(storage._dump()).filter((k) => k.startsWith('kmp:'));
  assert.deepEqual(written.sort(), ['kmp:active', 'kmp:lastApp', 'kmp:profiles']);
});

test('a mangled lastApp reads as "no last visit" rather than a broken card', () => {
  const { KMP } = load({ storage: fakeStorage({ 'kmp:lastApp': '{"at":"soon"}' }) });
  assert.equal(KMP.lastVisit(), null);
});

// --- delete everything ------------------------------------------------------

test('deleteAll clears kmp:* and every game\'s own keys, and nothing else', () => {
  const storage = fakeStorage({
    'kmp:profiles': JSON.stringify([ANNA]),
    'kmp:active': ANNA.id,
    'kmp:prefs': '{}',
    'burtu-feja-progress:anna-1a2b': '{}',
    'engl.v1.progress': '{}',
    'ciparu-darzs-data': '{}',
    'prata-sala-v1': '{}',
    'unrelated-site-key': 'keep me',
  });
  const { KMP } = load({ storage });
  assert.equal(KMP.deleteAll(), true);

  const left = Object.keys(storage._dump());
  assert.deepEqual(left, ['unrelated-site-key'], `left over: ${left.join(', ')}`);
});
