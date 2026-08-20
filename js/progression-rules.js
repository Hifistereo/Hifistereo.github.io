/* Turns one game's adapter result into a list of Adventure milestones.
 *
 * Every adapter (except Paint) already returns a catalogue of collectible
 * items with an `owned` boolean — those are the games' own natural unlock
 * signals, already normalised and already pinned by tests/adapters.test.js.
 * A milestone is just one of those items crossing owned:false -> true, so
 * this file never invents a stat threshold; it only decides which of the
 * adapters' own items count, and excludes anything that rewards a loyalty
 * or day-streak habit rather than actual learning.
 */

import { CATALOGUES } from './catalogues.js';

export const DOMAIN_BY_APP = {
  PrataSala: 'thinking',
  KidlaTest: 'reading',
  'ENG-learning': 'english',
  Memory: 'numbers',
  Paint: 'creativity',
};

// adapters.js strips catalogue metadata down to {app,id,name,hint,tier,art,
// owned} — it does not pass through unlock.kind. So excluding KidlaTest's
// streak cards means looking their kind up in the catalogue directly. Only
// CATALOGUES.KidlaTest.cards carries `unlock`; treasures do not, and
// Map#get on a missing key returns undefined (never 'streak'), so treasures
// are included by default.
const KIDLATEST_KIND_BY_ID = new Map(
  CATALOGUES.KidlaTest.cards.map((c) => [c.id, c.unlock.kind]),
);

// ENG-learning's four day-streak achievements reward consecutive-day play,
// the same loyalty mechanic KidlaTest's streak cards reward — excluded for
// the same reason: Adventure progress must never be driven by a habit
// streak, only by what a child has actually learned.
const ENG_EXCLUDED_IDS = new Set(['streak_3', 'streak_7', 'streak_14', 'streak_30']);

/** One collectAll() result -> its Adventure milestones. */
export function milestonesForResult(result) {
  const domain = DOMAIN_BY_APP[result.app];
  if (!domain) return [];

  if (result.app === 'KidlaTest') {
    return result.items
      .filter((i) => KIDLATEST_KIND_BY_ID.get(i.id) !== 'streak')
      .map((i) => ({ id: `KidlaTest:${i.id}`, domain, achieved: i.owned, label: i.name }));
  }
  if (result.app === 'ENG-learning') {
    return result.items
      .filter((i) => !ENG_EXCLUDED_IDS.has(i.id))
      .map((i) => ({ id: `ENG-learning:${i.id}`, domain, achieved: i.owned, label: i.name }));
  }
  if (result.app === 'Paint') {
    // Paint keeps exactly one current drawing per child (overwritten on
    // every save, not an append-only history) — stats.artworks can only
    // ever be 0 or 1. A single "first artwork" milestone is the only signal
    // this storage shape can honestly support without touching Paint's own
    // repo, which v1 does not do.
    const hasArtwork = (Number(result.stats?.artworks) || 0) >= 1;
    return [{ id: 'Paint:first-artwork', domain, achieved: hasArtwork, label: 'Pirmais zīmējums' }];
  }
  // PrataSala and Memory: every catalogue item already IS a natural milestone.
  return result.items.map((i) => ({ id: `${result.app}:${i.id}`, domain, achieved: i.owned, label: i.name }));
}

/** All five collectAll() results -> the flat milestone list the engine consumes. */
export function allMilestones(collectAllResults) {
  return collectAllResults.flatMap(milestonesForResult);
}
