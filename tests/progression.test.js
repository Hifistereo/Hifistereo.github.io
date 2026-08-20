// Tests for js/progression.js — the Adventure progression engine.
//
// The engine sits on top of js/adapters.js, so most of these seed the same
// game storage shapes tests/adapters.test.js already pins, then check what
// the engine derives from them: which domains were touched, which stage
// that reaches, and — just as important — the correctness properties that
// keep progress permanent and safe (the diversity gate actually blocking a
// single-domain farm, a returning family's existing progress never
// replaying as a burst of new unlocks, and a not-yet-created "guest"
// profile never getting its own orphaned save).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, ITEMS, FRIENDS } from '../js/adventure-data.js';

const CHILD = 'anna-1a2b';

/** A minimal fake IndexedDB matching just enough of the real API for
 * js/adapters.js's paint() to read a list of existing artwork keys. */
function fakeIndexedDB(existingKeys) {
  return {
    open() {
      const req = {};
      queueMicrotask(() => {
        req.result = {
          objectStoreNames: { contains: (name) => name === 'artwork' },
          transaction: () => ({
            objectStore: () => ({
              getAllKeys: () => {
                const keysReq = {};
                queueMicrotask(() => {
                  keysReq.result = existingKeys;
                  keysReq.onsuccess?.();
                });
                return keysReq;
              },
            }),
          }),
          close() {},
        };
        req.onsuccess?.();
      });
      return req;
    },
  };
}

/**
 * Installs a fake localStorage (seeded with game data and, optionally, a
 * pre-existing kmp:adventure:<CHILD> record), a fake window.KMP.profiles(),
 * and a fake indexedDB, then imports progression.js fresh against them.
 *
 * `indexedDBKeys: null` simulates indexedDB not existing at all (the
 * "missing IndexedDB" case); any array (default: empty) defines a fake IDB
 * with that many matching artwork keys.
 */
async function withEngine({ seed = {}, profiles = [{ id: CHILD }], indexedDBKeys = [], adventure } = {}) {
  const map = new Map(Object.entries(seed));
  if (adventure !== undefined) {
    map.set(`kmp:adventure:${CHILD}`, typeof adventure === 'string' ? adventure : JSON.stringify(adventure));
  }
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
  globalThis.window = { KMP: { profiles: () => profiles } };
  if (indexedDBKeys === null) delete globalThis.indexedDB;
  else globalThis.indexedDB = fakeIndexedDB(indexedDBKeys);

  const mod = await import(`../js/progression.js?t=${Math.random()}`);
  return { ...mod, storageMap: map };
}

// --- behavioral: baseline & single/multi-domain progress --------------------

test('empty child: stage home, nothing completed, nothing to unlock', async () => {
  const { getAdventureProgress } = await withEngine({});
  const r = await getAdventureProgress(CHILD);
  assert.equal(r.maxReachedStageId, 'home');
  assert.equal(r.completedMilestones, 0);
  assert.deepEqual(r.newlyUnlocked, []);
});

test('single-game progress reaches a single-domain stage, not further', async () => {
  const { getAdventureProgress } = await withEngine({
    seed: { 'prata-sala-v1': JSON.stringify({ cardIds: [1, 4, 7], levels: {} }) },
  });
  const r = await getAdventureProgress(CHILD);
  assert.equal(r.domainCounts.thinking, 3);
  assert.equal(r.domainsTouched, 1);
  assert.equal(r.maxReachedStageId, 'forest'); // meadow needs 2 domains
});

test('multi-domain progress reaches the exact diversity-gated stage', async () => {
  const { getAdventureProgress } = await withEngine({
    seed: {
      'prata-sala-v1': JSON.stringify({ cardIds: [1, 4, 7], levels: {} }), // thinking: 3
      'burtu-feja-progress': JSON.stringify({ currentId: 45, levelStars: {}, totalStars: 0 }), // reading: 4 chapters
      'burtu-feja-streak-cards': '0',
      'ciparu-darzs-data': JSON.stringify({ profiles: [{ id: CHILD, progress: { dots: { stars: 1 }, count: { stars: 1 }, bigger: { stars: 1 } } }] }), // numbers: 3
    },
  });
  const r = await getAdventureProgress(CHILD);
  assert.equal(r.completedMilestones, 10); // 3 + 4 + 3
  assert.equal(r.domainsTouched, 3);
  assert.equal(r.maxReachedStageId, 'lake'); // 9/3 met; orchard needs 12
});

test('diversity gate blocks farming a single game past its own domain', async () => {
  const { getAdventureProgress } = await withEngine({
    seed: {
      // Every non-streak KidlaTest milestone: 11 chapters + 16 treasures = 27.
      'burtu-feja-progress': JSON.stringify({ currentId: 200, levelStars: {}, totalStars: 400 }),
      'burtu-feja-streak-cards': '0',
    },
  });
  const r = await getAdventureProgress(CHILD);
  assert.equal(r.completedMilestones, 27);
  assert.equal(r.domainsTouched, 1);
  // A raw-count read of 27 would suggest a much later stage; the diversity
  // gate caps this at the last single-domain stage instead.
  assert.equal(r.maxReachedStageId, 'forest');
});

test('KidlaTest streak cards are excluded from reading milestones', async () => {
  const { getAdventureProgress } = await withEngine({
    seed: {
      'burtu-feja-progress': JSON.stringify({ currentId: 0, levelStars: {}, totalStars: 0 }),
      'burtu-feja-streak-cards': '10', // the adapter's own `owned` count would be 10
    },
  });
  const r = await getAdventureProgress(CHILD);
  assert.equal(r.domainCounts.reading, undefined);
});

test('ENG-learning day-streak achievements are excluded from english milestones', async () => {
  const { getAdventureProgress } = await withEngine({
    seed: {
      [`engl.v1.progress.${CHILD}`]: JSON.stringify({ achievements: { streak_30: 1 }, totals: {} }),
    },
  });
  const r = await getAdventureProgress(CHILD);
  assert.equal(r.domainCounts.english, undefined);
});

test('Paint contributes at most one milestone, however often it is checked', async () => {
  const { getAdventureProgress: first } = await withEngine({ indexedDBKeys: [`current:${CHILD}`] });
  const r1 = await first(CHILD);
  assert.equal(r1.domainCounts.creativity, 1);

  // A second "save" still only overwrites the same one record.
  const { getAdventureProgress: second } = await withEngine({ indexedDBKeys: [`current:${CHILD}`] });
  const r2 = await second(CHILD);
  assert.equal(r2.domainCounts.creativity, 1);
});

// --- behavioral: permanence, first adoption, guest safety --------------------

test('a stored maxReachedStageId never regresses below live data', async () => {
  const { getAdventureProgress } = await withEngine({
    adventure: {
      version: 1, initialized: true, maxReachedStageId: 'castle',
      seenStageIds: STAGES.slice(0, STAGES.findIndex((s) => s.id === 'castle') + 1).map((s) => s.id),
      earnedItemIds: [], featuredItemId: null,
    },
  });
  const r = await getAdventureProgress(CHILD); // no live game data at all
  assert.equal(r.maxReachedStageId, 'castle');
});

test('first Adventure launch for a family with existing progress baselines quietly', async () => {
  const { getAdventureProgress, storageMap } = await withEngine({
    seed: {
      'prata-sala-v1': JSON.stringify({ cardIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], levels: {} }), // thinking: 12
      'burtu-feja-progress': JSON.stringify({ currentId: 45, levelStars: {}, totalStars: 0 }), // reading: 4
      'burtu-feja-streak-cards': '0',
      'ciparu-darzs-data': JSON.stringify({ profiles: [{ id: CHILD, progress: { dots: { stars: 1 }, count: { stars: 1 }, bigger: { stars: 1 }, path: { stars: 1 }, market: { stars: 1 } } }] }), // numbers: 5
      [`engl.v1.progress.${CHILD}`]: JSON.stringify({ achievements: { first_session: 1, first_word: 1 }, totals: {} }), // english: 2
    },
    // No pre-existing kmp:adventure:<CHILD> key.
  });
  const r = await getAdventureProgress(CHILD);
  assert.equal(r.completedMilestones, 23); // 12 + 4 + 5 + 2
  assert.equal(r.domainsTouched, 4);
  assert.equal(r.maxReachedStageId, 'mountain-peak'); // 23/4; observatory needs 27
  assert.deepEqual(r.newlyUnlocked, [], 'existing progress must not replay as a burst of new unlocks');
  assert.ok(r.pendingFirstAdoptionMessage, 'a one-time explanatory message should be pending');

  const saved = JSON.parse(storageMap.get(`kmp:adventure:${CHILD}`));
  const idx = STAGES.findIndex((s) => s.id === 'mountain-peak');
  assert.deepEqual(saved.seenStageIds, STAGES.slice(0, idx + 1).map((s) => s.id));
});

test('the first-adoption message stays pending across callers until explicitly acknowledged', async () => {
  // Simulates the real page flow: the hub's teaser calls getAdventureProgress
  // first (creating the on-disk state as a side effect), and only later does
  // the child actually open the Adventure page. The message must still be
  // pending on that second call — it must not have been silently consumed by
  // whichever caller happened to run first.
  const { getAdventureProgress, acknowledgeFirstAdoption } = await withEngine({
    seed: { 'prata-sala-v1': JSON.stringify({ cardIds: [1, 4], levels: {} }) }, // thinking: 2 -> stage forest
  });

  const fromHubTeaser = await getAdventureProgress(CHILD); // creates the state
  assert.ok(fromHubTeaser.pendingFirstAdoptionMessage);

  const fromAdventurePage = await getAdventureProgress(CHILD); // a later, separate call
  assert.ok(fromAdventurePage.pendingFirstAdoptionMessage, 'must still be pending for the second caller');

  acknowledgeFirstAdoption(CHILD);
  const afterAck = await getAdventureProgress(CHILD);
  assert.equal(afterAck.pendingFirstAdoptionMessage, false);
});

test('a later crossing after adoption is reported as newly unlocked', async () => {
  const { getAdventureProgress, storageMap } = await withEngine({
    seed: { 'prata-sala-v1': JSON.stringify({ cardIds: [1, 4, 7, 10], levels: {} }) }, // thinking: 4, domains: 1
  });
  const first = await getAdventureProgress(CHILD); // first adoption, lands at forest
  assert.equal(first.maxReachedStageId, 'forest');
  assert.deepEqual(first.newlyUnlocked, []);

  // A second domain's worth of progress arrives later in the same session.
  storageMap.set('ciparu-darzs-data', JSON.stringify({ profiles: [{ id: CHILD, progress: { dots: { stars: 1 } } }] }));
  const second = await getAdventureProgress(CHILD);
  assert.equal(second.maxReachedStageId, 'meadow');
  assert.deepEqual(second.newlyUnlocked, ['meadow']);
});

test('marking a stage seen suppresses it from later newlyUnlocked', async () => {
  const { getAdventureProgress, markStagesSeen, storageMap } = await withEngine({
    seed: { 'prata-sala-v1': JSON.stringify({ cardIds: [1, 4, 7, 10], levels: {} }) },
  });
  await getAdventureProgress(CHILD); // first adoption at forest

  storageMap.set('ciparu-darzs-data', JSON.stringify({ profiles: [{ id: CHILD, progress: { dots: { stars: 1 } } }] }));
  const second = await getAdventureProgress(CHILD);
  assert.ok(second.newlyUnlocked.includes('meadow'));

  markStagesSeen(CHILD, second.newlyUnlocked);
  const third = await getAdventureProgress(CHILD);
  assert.ok(!third.newlyUnlocked.includes('meadow'));
});

test('the guest sentinel is computed but never persisted', async () => {
  const { getAdventureProgress, storageMap } = await withEngine({ profiles: [] });
  const r = await getAdventureProgress('guest');
  assert.equal(r.isRealProfile, false);
  assert.equal(r.maxReachedStageId, 'home');
  assert.ok(!storageMap.has('kmp:adventure:guest'), 'a not-yet-created profile must never get its own save');
});

test('earned bonus items are never lost, even if today\'s data no longer qualifies', async () => {
  const { getAdventureProgress } = await withEngine({
    seed: { 'prata-sala-v1': JSON.stringify({ cardIds: [1, 4], levels: {} }) }, // thinking: 2, well under thinker-badge's threshold of 8
    adventure: {
      version: 1, initialized: true, maxReachedStageId: 'forest',
      seenStageIds: ['home', 'forest'], earnedItemIds: ['thinker-badge'], featuredItemId: null,
    },
  });
  const r = await getAdventureProgress(CHILD);
  assert.ok(r.earnedItemIds.includes('thinker-badge'), 'a previously earned item must survive a lower live count');
});

// --- behavioral: hostile input -----------------------------------------------

test('malformed kmp:adventure state degrades to safe defaults instead of throwing', async () => {
  const junkValues = [
    '{not json',
    '"hello"',
    '42',
    'null',
    '[1,2,3]',
    '{"maxReachedStageId":"nonexistent-stage","seenStageIds":"nope","earnedItemIds":"nope","featuredItemId":123}',
  ];
  for (const junk of junkValues) {
    const { getAdventureProgress } = await withEngine({ adventure: junk });
    const r = await getAdventureProgress(CHILD);
    assert.equal(r.maxReachedStageId, 'home', `for junk value ${junk}`);
    assert.deepEqual(r.newlyUnlocked, [], `for junk value ${junk}`);
  }
});

test('a missing indexedDB global does not hang or throw', async () => {
  const { getAdventureProgress } = await withEngine({ indexedDBKeys: null });
  const r = await getAdventureProgress(CHILD);
  assert.equal(r.domainCounts.creativity, undefined);
});

test('a broken adapter does not blank the others', async () => {
  const { getAdventureProgress } = await withEngine({
    seed: {
      'prata-sala-v1': 'not json at all',
      'ciparu-darzs-data': JSON.stringify({ profiles: [{ id: CHILD, progress: { dots: { stars: 1 }, count: { stars: 1 } } }] }),
    },
  });
  const r = await getAdventureProgress(CHILD);
  assert.equal(r.domainCounts.thinking, undefined);
  assert.equal(r.domainCounts.numbers, 2);
});

// --- data integrity: protects future edits to adventure-data.js -------------

test('data integrity: stage ids are unique', () => {
  const ids = STAGES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('data integrity: item ids are unique', () => {
  const ids = ITEMS.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('data integrity: friend ids are unique', () => {
  const ids = FRIENDS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('data integrity: stage milestone requirements never decrease', () => {
  for (let i = 1; i < STAGES.length; i++) {
    assert.ok(
      STAGES[i].requiredCompletedMilestones >= STAGES[i - 1].requiredCompletedMilestones,
      `${STAGES[i].id} requires fewer milestones than ${STAGES[i - 1].id}`,
    );
  }
});

test('data integrity: stage domain requirement never exceeds 5', () => {
  for (const stage of STAGES) {
    assert.ok(stage.domains <= 5, `${stage.id} requires more than 5 domains`);
  }
});

test('data integrity: every stage reward references a real item or friend', () => {
  const itemIds = new Set(ITEMS.map((i) => i.id));
  const friendIds = new Set(FRIENDS.map((f) => f.id));
  for (const stage of STAGES) {
    if (!stage.reward) continue;
    if (stage.reward.type === 'item') assert.ok(itemIds.has(stage.reward.id), `${stage.id} rewards unknown item ${stage.reward.id}`);
    if (stage.reward.type === 'friend') assert.ok(friendIds.has(stage.reward.id), `${stage.id} rewards unknown friend ${stage.reward.id}`);
  }
});

test('data integrity: every friend unlockStage references a real stage', () => {
  const stageIds = new Set(STAGES.map((s) => s.id));
  for (const friend of FRIENDS) {
    assert.ok(stageIds.has(friend.unlockStage), `${friend.id} references unknown stage ${friend.unlockStage}`);
  }
});

test('setFeaturedItem refuses an item the child has not earned', async () => {
  const { setFeaturedItem, storageMap } = await withEngine({});
  const ok = setFeaturedItem(CHILD, 'gold-crown');
  assert.equal(ok, false);
  assert.ok(!storageMap.has(`kmp:adventure:${CHILD}`));
});

test('stage "home" can never appear in newlyUnlocked', async () => {
  const { getAdventureProgress } = await withEngine({});
  const r = await getAdventureProgress(CHILD);
  assert.ok(!r.newlyUnlocked.includes('home'));
});
