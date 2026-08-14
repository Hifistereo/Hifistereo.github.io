/* Reading each game's own storage, so the hub can show one collection.
 *
 * The games do not publish anything. They write their own keys exactly as they
 * always have, and the hub reads them from here — which is why the collection
 * page and the parent rollup required no changes to game logic at all, and why
 * a bug in this file cannot break a running game.
 *
 * The cost of that choice is coupling: this file knows each game's storage
 * shape. Two things keep it honest —
 *   - every adapter returns an empty result rather than throwing when the key
 *     is missing, malformed, or a shape it does not recognise;
 *   - tests/adapters.test.js pins each one against a fixture captured from the
 *     real app.
 *
 * A key can be in one of two places. Games namespace their storage per child
 * (`burtu-feja-progress:anna-1a2b`), but a family who played before that
 * existed still has data at the bare key. Read both, newest shape first.
 */

import { CATALOGUES } from './catalogues.js';

/** Read `base:<childId>`, falling back to the pre-namespacing bare key. */
function readFor(base, childId) {
  for (const k of [`${base}:${childId}`, base]) {
    try {
      const raw = localStorage.getItem(k);
      if (raw === null) continue;
      return JSON.parse(raw);
    } catch {
      // Malformed JSON at this key: try the next one, then give up quietly.
    }
  }
  return null;
}

function readRawFor(base, childId) {
  for (const k of [`${base}:${childId}`, base]) {
    try {
      const raw = localStorage.getItem(k);
      if (raw !== null) return raw;
    } catch { /* storage unavailable */ }
  }
  return null;
}

/** Shape every adapter returns. `owned` is a Set of catalogue ids. */
const empty = (app) => ({ app, items: [], owned: 0, total: 0, stats: {} });

function build(app, catalogue, isOwned) {
  const items = catalogue.map((entry) => ({
    app,
    id: entry.id,
    name: entry.name,
    hint: entry.hint || null,
    tier: entry.tier || null,
    art: entry.art,
    owned: !!isOwned(entry),
  }));
  return { app, items, owned: items.filter((i) => i.owned).length, total: items.length };
}

// --- PrataSala --------------------------------------------------------------
// prata-sala-v1: { v, theme, levels, cardIds: [1, 4, 7], speech, stats, daily }

export function prataSala(childId) {
  try {
    const save = readFor('prata-sala-v1', childId);
    const ids = new Set((save && Array.isArray(save.cardIds) ? save.cardIds : []).map(String));
    const out = build('PrataSala', CATALOGUES.PrataSala.cards, (c) => ids.has(c.id));
    out.stats = {
      levels: save && typeof save.levels === 'object' ? Object.keys(save.levels).length : 0,
    };
    return out;
  } catch {
    return empty('PrataSala');
  }
}

// --- KidlaTest --------------------------------------------------------------
// burtu-feja-progress:     { currentId, levelStars: {}, totalStars }
// burtu-feja-streak-cards: "3"  (a bare integer, not JSON-wrapped)
//
// A chapter card unlocks when its last level is done (endId < currentId); a
// streak card unlocks on the nth ten-in-a-row (n <= streakCards). Both rules
// are copied from screens.jsx, where the in-game gallery applies them.

export function kidlaTest(childId) {
  try {
    const p = readFor('burtu-feja-progress', childId) || {};
    const currentId = Number(p.currentId) || 0;
    const streak = Number(readRawFor('burtu-feja-streak-cards', childId)) || 0;

    const cards = build('KidlaTest', CATALOGUES.KidlaTest.cards, (c) =>
      c.unlock.kind === 'streak' ? c.unlock.n <= streak : c.unlock.endId < currentId);

    const totalStars = Number(p.totalStars) || 0;
    const treasures = build('KidlaTest', CATALOGUES.KidlaTest.treasures, (t) =>
      totalStars >= Number(String(t.id).replace('treasure-', '')));

    return {
      app: 'KidlaTest',
      items: cards.items.concat(treasures.items),
      owned: cards.owned + treasures.owned,
      total: cards.total + treasures.total,
      stats: { stars: totalStars, level: currentId },
    };
  } catch {
    return empty('KidlaTest');
  }
}

// --- ENG-learning -----------------------------------------------------------
// engl.v1.progress.<profileId>: { words, achievements: { id: ts }, stickers,
//                                 sessions, unlockedUnits, totals }
// engl.v1.profiles:             [ { id, name, ageBand, ... } ]
//
// ENG-learning has always had its own profiles. Once it adopts the shared one
// its profile id IS the KidMindPath child id, so look there first. Before that
// migration, fall back to its single profile — but only when there is exactly
// one, since with several there is no safe way to guess which child is which.

export function engLearning(childId) {
  try {
    const direct = readFor(`engl.v1.progress.${childId}`, childId);
    let progress = direct;

    if (!progress) {
      let list = [];
      try { list = JSON.parse(localStorage.getItem('engl.v1.profiles') || '[]'); } catch { list = []; }
      // Same rule as Memory below: a lone profile is only fair to attribute
      // while it has not been claimed by a named child. Once linkedToHub is
      // set and the id does not match, it belongs to a sibling.
      const lone = Array.isArray(list) && list.length === 1 ? list[0] : null;
      if (lone && lone.id && !lone.linkedToHub) {
        try {
          progress = JSON.parse(localStorage.getItem(`engl.v1.progress.${lone.id}`) || 'null');
        } catch { progress = null; }
      }
    }

    const unlocked = new Set(Object.keys((progress && progress.achievements) || {}));
    const out = build('ENG-learning', CATALOGUES['ENG-learning'].cards, (c) => unlocked.has(c.id));
    const totals = (progress && progress.totals) || {};
    out.stats = {
      sessions: Number(totals.sessions) || 0,
      items: Number(totals.items) || 0,
      correct: Number(totals.correct) || 0,
      words: progress && progress.words ? Object.keys(progress.words).length : 0,
    };
    return out;
  } catch {
    return empty('ENG-learning');
  }
}

// --- Memory -----------------------------------------------------------------
// ciparu-darzs-data: { version, selectedProfileId,
//                      profiles: [ { id, nickname, progress: { gameId: {...} } } ] }
//
// Memory's collectible is stars per game rather than a card, so the catalogue
// entry is the game and "owned" means at least one star earned in it.

export function memory(childId) {
  try {
    const data = readFor('ciparu-darzs-data', childId);
    const list = data && Array.isArray(data.profiles) ? data.profiles : [];
    // Exact match first. Then, only if nothing has been claimed by the hub
    // yet, a lone unlinked profile — that is a device that played before the
    // hub existed and has not been linked, so the data is fair to attribute.
    //
    // A profile carrying linkedToHub belongs to a NAMED child. If its id does
    // not match, it is someone else's, and showing it here would put one
    // sibling's stars in the other's collection.
    const exact = list.find((p) => p && p.id === childId);
    const unclaimed = list.length === 1 && list[0] && !list[0].linkedToHub ? list[0] : null;
    const profile = exact || unclaimed || null;

    const progress = (profile && profile.progress) || {};
    const stars = (id) => Number((progress[id] || {}).stars) || 0;

    const items = CATALOGUES.Memory.games.map((g) => ({
      app: 'Memory',
      id: g.id,
      name: g.name,
      hint: 'Nopelni zvaigzni šajā spēlē',
      tier: null,
      art: { type: 'stars', value: stars(g.id) },
      owned: stars(g.id) > 0,
    }));

    return {
      app: 'Memory',
      items,
      owned: items.filter((i) => i.owned).length,
      total: items.length,
      stats: {
        stars: Object.values(progress).reduce((n, p) => n + (Number(p.stars) || 0), 0),
        sessions: Object.values(progress).reduce((n, p) => n + (Number(p.sessions) || 0), 0),
        attempts: Object.values(progress).reduce((n, p) => n + (Number(p.attempts) || 0), 0),
        correct: Object.values(progress).reduce((n, p) => n + (Number(p.correct) || 0), 0),
      },
    };
  } catch {
    return empty('Memory');
  }
}

// --- Paint ------------------------------------------------------------------
// IndexedDB `little-fingers-paint` / store `artwork` / key `current`.
//
// The only asynchronous adapter, and the only game with no catalogue: its
// collectible is the child's own drawing, which cannot be enumerated ahead of
// time. It reports whether a painting exists, not a list of things to collect.

export function paint(childId) {
  return new Promise((resolve) => {
    const none = { app: 'Paint', items: [], owned: 0, total: 0, stats: { artworks: 0 } };
    let settled = false;
    let opened = null;

    // Whichever path finishes first wins, and it takes the timer and the
    // connection down with it: an open IndexedDB handle blocks Paint's own
    // upgrades in another tab, and the timer would otherwise keep the page
    // alive for a result nobody is waiting for any more.
    const done = (v) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { opened?.close(); } catch { /* already closing */ }
      resolve(v);
    };

    // IndexedDB can hang indefinitely when a blocked upgrade is pending; the
    // collection page must render regardless.
    const timer = setTimeout(() => done(none), 1500);

    try {
      const req = indexedDB.open('little-fingers-paint');
      req.onerror = () => done(none);
      req.onsuccess = () => {
        const db = req.result;
        opened = db;
        // The open succeeded after we gave up; nothing wants the result now.
        if (settled) { try { db.close(); } catch { /* already closing */ } return; }
        try {
          if (!db.objectStoreNames.contains('artwork')) return done(none);
          const keys = db.transaction('artwork').objectStore('artwork').getAllKeys();
          keys.onsuccess = () => {
            const all = keys.result || [];
            // Post-namespacing the record is `current:<childId>`; before it,
            // a single `current`.
            const mine = all.filter((k) => k === `current:${childId}` || k === 'current');
            done({ ...none, stats: { artworks: mine.length } });
          };
          keys.onerror = () => done(none);
        } catch {
          done(none);
        }
      };
    } catch {
      done(none);
    }
  });
}

/** Every game's collection for one child. Paint resolves last; it is async. */
export async function collectAll(childId) {
  const sync = [prataSala(childId), kidlaTest(childId), engLearning(childId), memory(childId)];
  const paintResult = await paint(childId);
  return [...sync, paintResult];
}
