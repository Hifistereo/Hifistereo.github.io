/* Regenerate js/catalogues.js from the game repositories.
 *
 * The hub has to know what a child COULD collect, not just what they have —
 * a collection page that only shows what you already own is not a collection,
 * it is a receipt. That means duplicating each game's catalogue here, which
 * means it can drift when a game adds a card.
 *
 * So: generate it rather than hand-copy it, and re-run this whenever a game
 * changes its collectibles.
 *
 *   node scripts/extract-catalogues.mjs [--repos /path/to/workspace]
 *
 * Expects the five game repos checked out as siblings (lowercase directory
 * names, as `git clone` leaves them):
 *
 *   <repos>/pratasala  <repos>/kidlatest  <repos>/eng-learning  <repos>/memory
 *
 * Paint has no catalogue — its collectible is the child's own artwork, which
 * cannot be enumerated in advance — so it is absent by design, not by omission.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'js', 'catalogues.js');

const arg = process.argv.indexOf('--repos');
const REPOS = arg > -1 ? process.argv[arg + 1] : '/workspace';

const need = (p) => {
  if (!existsSync(p)) {
    console.error(`missing: ${p}\nCheck out the game repos first, or pass --repos <dir>.`);
    process.exit(1);
  }
  return p;
};

// --- PrataSala: CARD_DEFS, inline in the design-board export ----------------

function prata() {
  const src = readFileSync(need(join(REPOS, 'pratasala', 'Prata Sala.dc.html')), 'utf8');
  const block = /CARD_DEFS\s*=\s*\[([\s\S]*?)\];/.exec(src);
  if (!block) throw new Error('PrataSala: CARD_DEFS not found');
  const items = [...block[1].matchAll(/\{\s*id:\s*(\d+),\s*e:\s*'([^']+)',\s*n:\s*'([^']+)'\s*\}/g)];
  if (!items.length) throw new Error('PrataSala: CARD_DEFS matched but parsed empty');
  return items.map((m) => ({
    id: String(m[1]),
    name: m[3],
    art: { type: 'emoji', value: m[2] },
  }));
}

/**
 * Count the keys of a top-level object literal, ignoring nested ones.
 *
 * Depth-aware rather than a regex, because the values are themselves objects
 * containing `key:` pairs and a flat count would run wildly high. Good enough
 * for a hand-written data file; it is not a JavaScript parser, and it will
 * mis-count if a string value ever contains an unbalanced brace.
 */
function countTopLevelKeys(src, name) {
  const start = new RegExp(`const\\s+${name}\\s*=\\s*\\{`).exec(src);
  if (!start) return 0;
  let i = start.index + start[0].length;
  let depth = 1;
  let count = 0;
  let quote = null;

  for (; i < src.length && depth > 0; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{' || ch === '[') { depth++; continue; }
    if (ch === '}' || ch === ']') { depth--; continue; }
    // A `key:` sitting directly inside the outer braces is one entry.
    if (ch === ':' && depth === 1) count++;
  }
  return count;
}

// --- KidlaTest: milestone artwork + treasures -------------------------------

function kidla() {
  const src = readFileSync(need(join(REPOS, 'kidlatest', 'data.jsx')), 'utf8');

  const total = Number(/MILESTONE_CARD_IMAGES\s*=\s*(\d+)/.exec(src)?.[1]);
  if (!total) throw new Error('KidlaTest: MILESTONE_CARD_IMAGES not found');

  const size = Number(/CHAPTER_SIZE\s*=\s*(\d+)/.exec(src)?.[1]);
  if (!size) throw new Error('KidlaTest: CHAPTER_SIZE not found');

  // LEVELS is LEVEL_WORDS.map((word, i) => ({ id: i + 1, ... })) and
  // LEVEL_WORDS is Object.keys(WORDS), so level ids are 1..N sequential where
  // N is the number of top-level WORDS entries, and a chapter's endId is
  // derivable without evaluating the file — which is not possible here,
  // because data.jsx contains JSX that Node cannot parse.
  const levelCount = countTopLevelKeys(src, 'WORDS');
  if (!levelCount) throw new Error('KidlaTest: could not count WORDS entries');

  const art = (img) => ({
    type: 'img',
    // Absolute from the site root, so it resolves from the hub rather than
    // from /KidlaTest/ where the app itself loads it.
    value: `/KidlaTest/images/milestones/${String(img).padStart(2, '0')}.png`,
  });

  // Chapter cards and streak cards share one id space — a card's id is its
  // image number, which is what lets the companion picker store one id for
  // either kind. Chapters come first, streak cards fill the rest.
  const cards = [];
  for (let img = 1, start = 0; start < levelCount; img++, start += size) {
    cards.push({
      id: String(img),
      name: `Ceļojuma kartīte ${img}`,
      // A chapter card unlocks once its last level is done: endId < currentId.
      unlock: { kind: 'chapterEnd', endId: Math.min(start + size, levelCount) },
      art: art(img),
    });
  }
  const chapterCount = cards.length;
  for (let img = chapterCount + 1, n = 1; img <= total; img++, n++) {
    cards.push({
      id: String(img),
      name: `Sērijas kartīte ${n}`,
      hint: `${n * 10} vārdi pēc kārtas`,
      // A streak card unlocks on the nth ten-in-a-row: n <= streakCards.
      unlock: { kind: 'streak', n },
      art: art(img),
    });
  }

  const treasures = [...src.matchAll(/\{\s*at:\s*(\d+),\s*icon:\s*'([^']+)',\s*name:\s*'([^']+)'\s*\}/g)]
    .map((m) => ({
      id: `treasure-${m[1]}`,
      name: m[3],
      art: { type: 'emoji', value: m[2] },
      hint: `${m[1]} zvaigznes`,
    }));

  return { cards, treasures };
}

// --- ENG-learning: the achievement card catalogue ---------------------------

async function eng() {
  const file = need(join(REPOS, 'eng-learning', 'src', 'data', 'achievements.js'));
  const { CARDS } = await import(pathToFileURL(file).href);
  if (!Array.isArray(CARDS) || !CARDS.length) throw new Error('ENG-learning: CARDS empty');
  return CARDS.map((c) => ({
    id: c.id,
    name: c.title,
    hint: c.hint,
    tier: c.tier,
    art: { type: 'emoji', value: c.emoji },
  }));
}

// --- Memory: the five games (stars are the collectible) ---------------------

function memory() {
  const src = readFileSync(need(join(REPOS, 'memory', 'src', 'games.ts')), 'utf8');
  const items = [...src.matchAll(/id:\s*'([a-z]+)',\s*title:\s*'([^']+)'/g)];
  if (!items.length) throw new Error('Memory: game metas not found');
  return items.map((m) => ({ id: m[1], name: m[2] }));
}

// --- write ------------------------------------------------------------------

const k = kidla();
const data = {
  PrataSala: { cards: prata() },
  KidlaTest: { cards: k.cards, treasures: k.treasures },
  'ENG-learning': { cards: await eng() },
  Memory: { games: memory() },
};

const banner = `/* GENERATED by scripts/extract-catalogues.mjs — do not edit by hand.
   Regenerate whenever a game adds or changes collectibles:

     node scripts/extract-catalogues.mjs --repos /path/to/checkouts

   This is what a child COULD collect. The hub needs it to show locked items
   with their hints; without that a collection page is just a receipt for what
   you already have. Paint is absent on purpose — its collectible is the
   child's own artwork, which cannot be enumerated in advance.

   Counts at generation time: ${Object.entries(data)
     .map(([app, v]) => `${app} ${Object.values(v).reduce((n, arr) => n + arr.length, 0)}`)
     .join(', ')}. */\n\n`;

writeFileSync(OUT, `${banner}export const CATALOGUES = ${JSON.stringify(data, null, 2)};\n`);

console.log(`wrote ${OUT}`);
for (const [app, v] of Object.entries(data)) {
  for (const [kind, arr] of Object.entries(v)) console.log(`  ${app}.${kind}: ${arr.length}`);
}
