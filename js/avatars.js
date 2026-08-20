/* Avatar rendering, shared by the hub's own profile setup/switcher and the
   Adventure page's character panel — one implementation instead of two
   copies drifting apart. Requires js/dom.js's el(). */

import { el } from './dom.js';

// Illustrated portraits, img/avatars/<id>.webp. `lapsa` is load-bearing: it is
// the hardcoded fallback in shared/kmp.js (GUEST and normaliseProfile), so
// this id must never change or be reused for a different character.
export const AVATARS = [
  { id: 'lapsa', label: 'Lapsa' },
  { id: 'kakis', label: 'Kaķis' },
  { id: 'papagailis', label: 'Papagailis' },
  { id: 'sunitis', label: 'Sunītis' },
  { id: 'brunurupucis', label: 'Bruņurupucis' },
  { id: 'meitene-1', label: 'Piedzīvotāja' },
  { id: 'meitene-2', label: 'Pētniece' },
  { id: 'meitene-3', label: 'Māksliniece' },
  { id: 'meitene-4', label: 'Ceļotāja' },
  { id: 'zens-1', label: 'Pilots' },
];

// The emoji friends this picker used to offer. Kept as a redirect, applied
// only at render time, so a child who chose one before the illustrated set
// existed lands on the closest new character instead of silently becoming
// the fox (kmp.js's own fallback). Nothing in localStorage is rewritten.
const LEGACY_AVATARS = { varde: 'brunurupucis', puce: 'papagailis', lacis: 'sunitis' };

export const resolveAvatar = (id) => {
  const resolved = LEGACY_AVATARS[id] || id;
  return AVATARS.find((a) => a.id === resolved) || AVATARS[0];
};

/**
 * One avatar portrait. `draggable` must be the string 'false', not the
 * boolean: el() drops any attribute whose value is boolean false, so passing
 * the boolean would silently leave the image draggable, and on a touch
 * device a long press would lift a drag ghost instead of picking a friend.
 */
export const avatarImg = (id, cls) => el(`img.${cls}`, {
  src: `/img/avatars/${resolveAvatar(id).id}.webp`,
  width: '192',
  height: '192',
  alt: '',
  draggable: 'false',
  decoding: 'async',
});
