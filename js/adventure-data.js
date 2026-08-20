/* Static content for the Adventure world: the map, the cosmetic items, and
 * the friends a child discovers along the way. No logic lives here — see
 * js/progression.js for how these are matched against a child's progress.
 *
 * Stage thresholds are sized against the real milestone pool counted from
 * the five games' own catalogues (see js/progression-rules.js):
 *   thinking 12, reading 27, english 22, numbers 5, creativity 1 -> 67 total.
 * Requirement values are monotonically increasing, and `domains` never
 * exceeds 5 (there are only five games) — both are pinned by
 * tests/progression.test.js so a future edit here can't silently break the
 * invariant.
 *
 * `domains` is a diversity gate: from stage 2 onward a child needs
 * milestones from that many distinct domains, not just a raw total, so no
 * single game can be farmed to unlock the whole map alone. The last four
 * stages require all five domains — reachable early, since every domain
 * has at least one milestone, so it never blocks on volume, only breadth.
 */

export const STAGES = [
  { id: 'home', name: 'Mājas pagalms', icon: '🏡', requiredCompletedMilestones: 0, domains: 0, reward: null },
  { id: 'forest', name: 'Meža taka', icon: '🌲', requiredCompletedMilestones: 2, domains: 1, reward: { type: 'item', id: 'sun-hat' } },
  { id: 'meadow', name: 'Ziedu pļava', icon: '🌼', requiredCompletedMilestones: 4, domains: 2, reward: { type: 'friend', id: 'fox' } },
  { id: 'bridge', name: 'Tiltiņš pār upi', icon: '🌉', requiredCompletedMilestones: 6, domains: 2, reward: { type: 'item', id: 'blue-scarf' } },
  { id: 'lake', name: 'Klusais ezers', icon: '🌊', requiredCompletedMilestones: 9, domains: 3, reward: { type: 'friend', id: 'turtle' } },
  { id: 'orchard', name: 'Augļu dārzs', icon: '🍎', requiredCompletedMilestones: 12, domains: 3, reward: { type: 'item', id: 'red-backpack' } },
  { id: 'cave', name: 'Kristālu ala', icon: '🪨', requiredCompletedMilestones: 16, domains: 3, reward: { type: 'item', id: 'lantern-charm' } },
  { id: 'mountain-foot', name: 'Kalna pakāje', icon: '⛰️', requiredCompletedMilestones: 19, domains: 4, reward: { type: 'friend', id: 'cat' } },
  { id: 'mountain-peak', name: 'Kalna virsotne', icon: '🏔️', requiredCompletedMilestones: 23, domains: 4, reward: { type: 'item', id: 'silver-cape' } },
  { id: 'observatory', name: 'Zvaigžņu observatorija', icon: '🔭', requiredCompletedMilestones: 27, domains: 4, reward: { type: 'item', id: 'star-glasses' } },
  { id: 'castle', name: 'Mākoņu pils', icon: '🏰', requiredCompletedMilestones: 32, domains: 5, reward: { type: 'friend', id: 'parrot' } },
  { id: 'balloon', name: 'Gaisa balons', icon: '🎈', requiredCompletedMilestones: 37, domains: 5, reward: { type: 'item', id: 'gold-crown' } },
  { id: 'cloud-island', name: 'Mākoņu sala', icon: '☁️', requiredCompletedMilestones: 44, domains: 5, reward: { type: 'friend', id: 'dog' } },
  { id: 'star-tower', name: 'Zvaigžņu tornis', icon: '⭐', requiredCompletedMilestones: 52, domains: 5, reward: { type: 'item', id: 'rainbow-wings' } },
];

// `slot` is forward-looking metadata for a future multi-slot equip system —
// v1 uses a single featured item and does not read `slot` anywhere.
export const ITEMS = [
  // Stage-reward items (unlocked by reaching the stage that grants them).
  { id: 'sun-hat', slot: 'head', name: 'Saules cepurīte', art: { type: 'emoji', value: '🧢' } },
  { id: 'blue-scarf', slot: 'back', name: 'Zilā šalle', art: { type: 'emoji', value: '🧣' } },
  { id: 'red-backpack', slot: 'back', name: 'Sarkanā mugursoma', art: { type: 'emoji', value: '🎒' } },
  { id: 'lantern-charm', slot: 'accessory', name: 'Laternas piekariņš', art: { type: 'emoji', value: '🏮' } },
  { id: 'silver-cape', slot: 'back', name: 'Sudraba apmetnis', art: { type: 'emoji', value: '🦸' } },
  { id: 'star-glasses', slot: 'accessory', name: 'Zvaigžņu brilles', art: { type: 'emoji', value: '🕶️' } },
  { id: 'gold-crown', slot: 'head', name: 'Zelta kronītis', art: { type: 'emoji', value: '👑' } },
  { id: 'rainbow-wings', slot: 'back', name: 'Varavīksnes spārni', art: { type: 'emoji', value: '🌈' } },

  // Bonus items: one per domain, unlocked by that domain's own milestone
  // count rather than a map stage, so every domain has its own reward path
  // even where it doesn't happen to gate a visible stage. Thresholds are
  // roughly 60-70% of each domain's pool (numbers/creativity are small
  // enough that "all of it" is the only honest threshold).
  { id: 'thinker-badge', slot: 'accessory', name: 'Domātāja nozīmīte', art: { type: 'emoji', value: '🧠' }, unlock: { type: 'domainCount', domain: 'thinking', count: 8 } },
  { id: 'bookworm-charm', slot: 'accessory', name: 'Grāmattārpa piekariņš', art: { type: 'emoji', value: '📚' }, unlock: { type: 'domainCount', domain: 'reading', count: 18 } },
  { id: 'globe-pin', slot: 'accessory', name: 'Globusa piespraude', art: { type: 'emoji', value: '🌍' }, unlock: { type: 'domainCount', domain: 'english', count: 15 } },
  { id: 'number-medal', slot: 'accessory', name: 'Skaitļu medaļa', art: { type: 'emoji', value: '🔢' }, unlock: { type: 'domainCount', domain: 'numbers', count: 5 } },
  { id: 'artist-beret', slot: 'head', name: 'Mākslinieka berete', art: { type: 'emoji', value: '🎨' }, unlock: { type: 'domainCount', domain: 'creativity', count: 1 } },
];

// Friends reuse the site's existing decorative art (already used as hero
// badges on index.html) — zero new assets needed for v1.
export const FRIENDS = [
  { id: 'fox', name: 'Lapsēns', art: { type: 'img', value: '/img/fox.webp' }, unlockStage: 'meadow' },
  { id: 'turtle', name: 'Bruņurupucis', art: { type: 'img', value: '/img/turtle.webp' }, unlockStage: 'lake' },
  { id: 'cat', name: 'Kaķēns', art: { type: 'img', value: '/img/cat.webp' }, unlockStage: 'mountain-foot' },
  { id: 'parrot', name: 'Papagailis', art: { type: 'img', value: '/img/bird.webp' }, unlockStage: 'castle' },
  { id: 'dog', name: 'Sunītis', art: { type: 'img', value: '/img/dog.webp' }, unlockStage: 'cloud-island' },
];
