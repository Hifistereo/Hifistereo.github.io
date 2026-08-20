/* The Adventure progression engine: turns a child's five-game collection
 * into a position on the Adventure map, plus which cosmetic items and
 * friends that has earned.
 *
 * This is a read-only interpretation layer. It never writes to any game's
 * own storage, and it never regresses a child's map position or earned
 * items — see getAdventureProgress() below for exactly how that is kept
 * true even as progression-rules.js or adventure-data.js change over time.
 */

import { collectAll } from './adapters.js';
import { allMilestones } from './progression-rules.js';
import { STAGES, ITEMS } from './adventure-data.js';

const STORE_VERSION = 1;
const stateKey = (childId) => `kmp:adventure:${childId}`;
const stageIds = STAGES.map((s) => s.id);
const stageIndex = (id) => stageIds.indexOf(id);

function defaultState() {
  return {
    version: STORE_VERSION,
    initialized: false,
    maxReachedStageId: 'home',
    seenStageIds: [],
    earnedItemIds: [],
    featuredItemId: null,
    firstAdoptionAcknowledged: false,
  };
}

/**
 * The one place that understands the on-disk shape. Never throws; always
 * returns a fully-valid state object, coercing or dropping anything that
 * does not look right (unknown stage/item ids, wrong types, junk JSON).
 */
export function normalizeAdventureState(raw) {
  if (!raw || typeof raw !== 'object') return defaultState();
  const d = defaultState();
  const earnedItemIds = Array.isArray(raw.earnedItemIds)
    ? raw.earnedItemIds.filter((id) => ITEMS.some((i) => i.id === id))
    : d.earnedItemIds;
  return {
    version: STORE_VERSION,
    initialized: raw.initialized === true,
    maxReachedStageId: stageIds.includes(raw.maxReachedStageId) ? raw.maxReachedStageId : d.maxReachedStageId,
    seenStageIds: Array.isArray(raw.seenStageIds) ? raw.seenStageIds.filter((id) => stageIds.includes(id)) : d.seenStageIds,
    earnedItemIds,
    featuredItemId: typeof raw.featuredItemId === 'string' && earnedItemIds.includes(raw.featuredItemId) ? raw.featuredItemId : null,
    firstAdoptionAcknowledged: raw.firstAdoptionAcknowledged === true,
  };
}

/** null means "nothing valid on disk" — distinct from defaultState(), used
 * to detect a real profile's very first Adventure read. */
function readState(childId) {
  try {
    const raw = localStorage.getItem(stateKey(childId));
    return raw === null ? null : normalizeAdventureState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeState(childId, state) {
  try {
    localStorage.setItem(stateKey(childId), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** The stage a purely-calculated tally would reach right now, ignoring any
 * stored state. Stages are strictly ordinal: the walk stops at the first
 * unmet requirement rather than scanning every stage for the highest match. */
function calcStageId(completedMilestones, domainsTouched) {
  let current = 'home';
  for (const stage of STAGES) {
    if (completedMilestones >= stage.requiredCompletedMilestones && domainsTouched >= stage.domains) {
      current = stage.id;
    } else {
      break;
    }
  }
  return current;
}

/** Whether one ITEMS entry is currently earned, given today's domain tally
 * and today's calculated stage. Stage-reward items are matched by finding
 * the stage whose reward references them; bonus items carry their own
 * `unlock: { type: 'domainCount', domain, count }`. */
function isItemEligible(item, domainCounts, calculatedStageId) {
  if (item.unlock?.type === 'domainCount') {
    return (domainCounts[item.unlock.domain] || 0) >= item.unlock.count;
  }
  const grantingStage = STAGES.find((s) => s.reward?.type === 'item' && s.reward.id === item.id);
  if (!grantingStage) return false;
  return stageIndex(calculatedStageId) >= stageIndex(grantingStage.id);
}

/**
 * The full Adventure model for one child. Async because collectAll() awaits
 * Paint's IndexedDB read.
 *
 * A "real profile" is one that appears in window.KMP.profiles() — the
 * literal 'guest' sentinel KMP.activeChild() returns before any profile
 * exists is not one, and never gets written to storage: naming that
 * sentinel later creates a profile with a *different*, freshly-minted id,
 * so anything saved under 'guest' would be orphaned. For a non-real
 * profile this function still returns a fully-formed, computed preview —
 * it just never persists it.
 */
export async function getAdventureProgress(childId) {
  const isRealProfile = Boolean(window.KMP?.profiles().some((p) => p.id === childId));

  const results = await collectAll(childId);
  const milestones = allMilestones(results);

  const domainCounts = {};
  for (const m of milestones) {
    if (m.achieved) domainCounts[m.domain] = (domainCounts[m.domain] || 0) + 1;
  }
  const completedMilestones = Object.values(domainCounts).reduce((a, b) => a + b, 0);
  const domainsTouched = Object.keys(domainCounts).length;
  const calculatedStageId = calcStageId(completedMilestones, domainsTouched);
  const eligibleItemIds = ITEMS.filter((item) => isItemEligible(item, domainCounts, calculatedStageId)).map((i) => i.id);

  const onDisk = isRealProfile ? readState(childId) : null;
  const isFirstAdoption = isRealProfile && onDisk === null;

  let state;
  if (!isRealProfile) {
    // Sentinel / not-yet-created profile: a read-only preview, never written.
    state = {
      ...defaultState(),
      maxReachedStageId: calculatedStageId,
      seenStageIds: stageIds.slice(0, stageIndex(calculatedStageId) + 1),
      earnedItemIds: eligibleItemIds,
    };
  } else if (isFirstAdoption) {
    // A family with pre-existing game progress opening Adventure for the
    // very first time: baseline everything up to today as already-seen, so
    // this call cannot report years of history as a burst of new unlocks.
    state = {
      version: STORE_VERSION,
      initialized: true,
      maxReachedStageId: calculatedStageId,
      seenStageIds: stageIds.slice(0, stageIndex(calculatedStageId) + 1),
      earnedItemIds: eligibleItemIds,
      featuredItemId: null,
      firstAdoptionAcknowledged: false,
    };
    writeState(childId, state);
  } else {
    const stored = onDisk;
    // maxReachedStageId never regresses — compared by stable index, not by
    // the raw string, since a later STAGES edit could still shift indices.
    const maxReachedStageId = stageIndex(calculatedStageId) > stageIndex(stored.maxReachedStageId)
      ? calculatedStageId
      : stored.maxReachedStageId;
    // earnedItemIds is a permanent union of what was already stored and
    // what's eligible today — never a fresh recompute — so an item already
    // earned cannot be lost to a later rules or game-data change.
    const earnedItemIds = Array.from(new Set([...stored.earnedItemIds, ...eligibleItemIds]));
    state = { ...stored, maxReachedStageId, earnedItemIds };
    if (maxReachedStageId !== stored.maxReachedStageId || earnedItemIds.length !== stored.earnedItemIds.length) {
      writeState(childId, state);
    }
  }

  const maxIdx = stageIndex(state.maxReachedStageId);
  const newlyUnlocked = (isFirstAdoption || !isRealProfile)
    ? []
    : STAGES.slice(0, maxIdx + 1).filter((s) => s.reward && !state.seenStageIds.includes(s.id)).map((s) => s.id);

  // Whether the page should show the one-time "you're already at X" message.
  // Deliberately NOT the same as isFirstAdoption: getAdventureProgress() is
  // called from more than one place (the hub's teaser as well as the
  // Adventure page itself), so whichever caller happens to run first is the
  // one that creates the on-disk state — isFirstAdoption would only ever be
  // true for that one caller, and the hub never shows this message. A
  // separately persisted, explicitly acknowledged flag (see
  // acknowledgeFirstAdoption below) makes this independent of call order.
  const pendingFirstAdoptionMessage = isRealProfile
    && !state.firstAdoptionAcknowledged
    && state.maxReachedStageId !== 'home';

  return {
    childId,
    isRealProfile,
    completedMilestones,
    availableMilestones: milestones.length,
    domainsTouched,
    domainCounts,
    milestones,
    maxReachedStageId: state.maxReachedStageId,
    seenStageIds: state.seenStageIds,
    newlyUnlocked,
    pendingFirstAdoptionMessage,
    earnedItemIds: state.earnedItemIds,
    featuredItemId: state.featuredItemId,
    stages: STAGES.map((s) => ({ ...s, unlocked: stageIndex(s.id) <= maxIdx })),
    nextStage: maxIdx + 1 < STAGES.length ? STAGES[maxIdx + 1] : null,
  };
}

/** Marks the one-time "you're already at X" message as shown, so it never
 * appears again — independent of which caller happened to first create this
 * child's Adventure state (see pendingFirstAdoptionMessage above). */
export function acknowledgeFirstAdoption(childId) {
  const stored = readState(childId) ?? defaultState();
  writeState(childId, { ...stored, firstAdoptionAcknowledged: true });
}

/** Marks a batch of stage ids as seen, so their unlock toast never replays.
 * A no-op (but still safe) call for a child with no prior state yet. */
export function markStagesSeen(childId, stageIdsToMark) {
  const stored = readState(childId) ?? defaultState();
  const seenStageIds = Array.from(new Set([...stored.seenStageIds, ...stageIdsToMark]));
  writeState(childId, { ...stored, seenStageIds });
}

/** Sets the one badge shown next to the avatar. Refuses any item the child
 * has not actually earned, regardless of what the caller passes in. */
export function setFeaturedItem(childId, itemId) {
  const stored = readState(childId) ?? defaultState();
  if (itemId !== null && !stored.earnedItemIds.includes(itemId)) return false;
  writeState(childId, { ...stored, featuredItemId: itemId });
  return true;
}
