// Tests for js/adapters.js — the hub reading each game's own storage.
//
// The adapters are the one place where the hub knows another repository's
// internals, so the risk they carry is drift: a game changes its stored shape
// and the collection page quietly shows nothing. These fixtures are captured
// from the real shapes (see the comment on each) and are the thing that makes
// that drift visible.
//
// The hostile cases matter as much as the happy ones. A malformed value must
// yield an empty collection, never an exception — the collection page has five
// adapters on it and one bad key must not blank the other four.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const CHILD = 'anna-1a2b';

/** Install a fake localStorage, then import the adapters fresh against it. */
async function withStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
  // Cache-bust so each test sees its own storage.
  return import(`../js/adapters.js?t=${Math.random()}`);
}

// --- PrataSala --------------------------------------------------------------

test('PrataSala: owned creature cards come from cardIds', async () => {
  const { prataSala } = await withStorage({
    // Shape from Prata Sala.dc.html saveProgress().
    'prata-sala-v1': JSON.stringify({
      v: 1, theme: 'day', levels: { 1: true, 2: true },
      cardIds: [1, 4, 7], speech: true, stats: {}, daily: {},
    }),
  });
  const r = prataSala(CHILD);
  assert.equal(r.total, 12);
  assert.equal(r.owned, 3);
  assert.deepEqual(r.items.filter((i) => i.owned).map((i) => i.id), ['1', '4', '7']);
  assert.equal(r.items[0].art.type, 'emoji');
});

test('PrataSala: no save at all is an empty collection, not a crash', async () => {
  const { prataSala } = await withStorage({});
  const r = prataSala(CHILD);
  assert.equal(r.owned, 0);
  assert.equal(r.total, 12, 'locked items must still be listed so there is something to aim for');
});

// --- KidlaTest --------------------------------------------------------------

test('KidlaTest: chapter cards unlock on endId < currentId, streak cards on n <= count', async () => {
  const { kidlaTest } = await withStorage({
    // Shape from app.jsx: localStorage.setItem(PROGRESS_KEY, JSON.stringify({
    //   currentId, levelStars, totalStars }))
    'burtu-feja-progress': JSON.stringify({ currentId: 25, levelStars: {}, totalStars: 14 }),
    // Written as a bare integer, not JSON — String(streakCards).
    'burtu-feja-streak-cards': '2',
  });
  const r = kidlaTest(CHILD);

  const cards = r.items.filter((i) => i.id.match(/^\d+$/));
  const owned = cards.filter((i) => i.owned).map((i) => i.id);
  // currentId 25 clears chapters ending at 10 and 20, not the one ending at 30.
  assert.deepEqual(owned.filter((id) => Number(id) <= 11), ['1', '2']);
  // Two streak cards: images 12 and 13.
  assert.ok(owned.includes('12') && owned.includes('13'));
  assert.ok(!owned.includes('14'), 'a third streak card should still be locked');

  // 14 stars clears the treasures at 5 and 12.
  const treasures = r.items.filter((i) => i.id.startsWith('treasure-') && i.owned);
  assert.deepEqual(treasures.map((t) => t.id), ['treasure-5', 'treasure-12']);
  assert.equal(r.stats.stars, 14);
});

test('KidlaTest: card art is a path that resolves from the hub, not from /KidlaTest/', async () => {
  const { kidlaTest } = await withStorage({});
  const card = kidlaTest(CHILD).items.find((i) => i.art.type === 'img');
  assert.match(card.art.value, /^\/KidlaTest\/images\/milestones\/\d{2}\.png$/);
});

// --- ENG-learning -----------------------------------------------------------

test('ENG-learning: unlocked achievements come from the per-child progress key', async () => {
  const { engLearning } = await withStorage({
    // Shape from state/progress.js emptyProgress(), stored under
    // `engl.v1.` + `progress.<profileId>`.
    [`engl.v1.progress.${CHILD}`]: JSON.stringify({
      words: { apple: {}, dog: {} },
      achievements: { first_session: 1700000000000, first_word: 1700000001000 },
      stickers: [], sessions: [],
      totals: { sessions: 4, items: 40, correct: 33, playedMs: 1000 },
    }),
  });
  const r = engLearning(CHILD);
  assert.equal(r.owned, 2);
  assert.equal(r.stats.sessions, 4);
  assert.equal(r.stats.words, 2);
  assert.ok(r.total >= 20, 'the whole card catalogue should be listed');
  const locked = r.items.find((i) => !i.owned);
  assert.ok(locked.hint, 'a locked card must show its hint, or it is not a goal');
});

test('ENG-learning: before migration, falls back to its own single profile', async () => {
  const { engLearning } = await withStorage({
    'engl.v1.profiles': JSON.stringify([{ id: 'legacy-1', name: 'Anna' }]),
    'engl.v1.progress.legacy-1': JSON.stringify({
      achievements: { first_session: 1 }, totals: { sessions: 2 },
    }),
  });
  assert.equal(engLearning(CHILD).owned, 1);
});

test('ENG-learning: with several of its own profiles it guesses at none', async () => {
  // Two children and no mapping yet: attributing one child's cards to the
  // other would be worse than showing none.
  const { engLearning } = await withStorage({
    'engl.v1.profiles': JSON.stringify([{ id: 'a' }, { id: 'b' }]),
    'engl.v1.progress.a': JSON.stringify({ achievements: { first_session: 1 } }),
    'engl.v1.progress.b': JSON.stringify({ achievements: { first_word: 1 } }),
  });
  assert.equal(engLearning(CHILD).owned, 0);
});

// --- Memory -----------------------------------------------------------------

test('Memory: a game counts as collected once it has a star', async () => {
  const { memory } = await withStorage({
    // Shape from src/types.ts AppData.
    'ciparu-darzs-data': JSON.stringify({
      version: 1,
      selectedProfileId: CHILD,
      profiles: [{
        id: CHILD, nickname: 'Anna', avatar: 'lapsa', ageBand: '4-5',
        progress: {
          dots: { stars: 3, level: 2, sessions: 5, attempts: 20, correct: 18 },
          count: { stars: 0, level: 0, sessions: 0, attempts: 0, correct: 0 },
        },
      }],
    }),
  });
  const r = memory(CHILD);
  assert.equal(r.total, 5);
  assert.equal(r.owned, 1);
  assert.equal(r.stats.stars, 3);
  assert.equal(r.stats.correct, 18);
});

test('Memory: picks the matching child out of several profiles', async () => {
  const { memory } = await withStorage({
    'ciparu-darzs-data': JSON.stringify({
      version: 1,
      selectedProfileId: 'someone-else',
      profiles: [
        { id: 'someone-else', progress: { dots: { stars: 9 } } },
        { id: CHILD, progress: { count: { stars: 2 } } },
      ],
    }),
  });
  const r = memory(CHILD);
  assert.equal(r.stats.stars, 2, 'must not report the sibling\'s stars');
});

// --- hostile input ----------------------------------------------------------

test('every synchronous adapter survives junk without throwing', async () => {
  // Note '42' is deliberately absent: burtu-feja-streak-cards is stored as a
  // BARE INTEGER rather than JSON, so "42" is valid data for that key, not
  // junk. Feeding it here would assert the adapter is broken when it is
  // reading the value correctly.
  const junk = ['{not json', 'null', '"a string"', '[]', '{"cardIds":"nope"}', '{"profiles":{}}'];
  for (const bad of junk) {
    const mod = await withStorage({
      'prata-sala-v1': bad,
      'burtu-feja-progress': bad,
      'burtu-feja-streak-cards': bad,
      'ciparu-darzs-data': bad,
      [`engl.v1.progress.${CHILD}`]: bad,
    });
    for (const name of ['prataSala', 'kidlaTest', 'engLearning', 'memory']) {
      const r = mod[name](CHILD);
      assert.equal(r.owned, 0, `${name} claimed something owned from ${bad}`);
      assert.ok(Array.isArray(r.items), `${name} returned no item list for ${bad}`);
    }
  }
});

test('KidlaTest: a nonsense streak count cannot unlock more than exists', async () => {
  for (const value of ['999999', '-3', 'NaN', '']) {
    const { kidlaTest } = await withStorage({
      'burtu-feja-progress': JSON.stringify({ currentId: 0, totalStars: 0 }),
      'burtu-feja-streak-cards': value,
    });
    const r = kidlaTest(CHILD);
    assert.ok(r.owned <= r.total, `streak "${value}" reported ${r.owned} of ${r.total}`);
    if (value !== '999999') {
      assert.equal(r.owned, 0, `streak "${value}" should unlock nothing`);
    }
  }
});

test('a per-child key wins over the pre-namespacing bare key', async () => {
  const { prataSala } = await withStorage({
    'prata-sala-v1': JSON.stringify({ cardIds: [1, 2, 3, 4, 5] }),
    [`prata-sala-v1:${CHILD}`]: JSON.stringify({ cardIds: [9] }),
  });
  const r = prataSala(CHILD);
  assert.equal(r.owned, 1, 'the migrated per-child key should be preferred');
  assert.equal(r.items.find((i) => i.owned).id, '9');
});

test('data left at the bare key by an unmigrated game is still found', async () => {
  const { prataSala } = await withStorage({
    'prata-sala-v1': JSON.stringify({ cardIds: [1, 2] }),
  });
  assert.equal(prataSala(CHILD).owned, 2);
});
