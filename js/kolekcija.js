/* The collection page: everything a child has earned across all five games,
   and everything they have not earned yet.

   Locked items are shown, not hidden. A collection page that lists only what
   you already own is a receipt; the point is to see what there is to aim for,
   which is why every locked entry carries its hint where the game supplies
   one. */

import { GAMES, byId } from './games.js';
import { collectAll } from './adapters.js';
import { el, clear } from './dom.js';

/** The face of one collectible: emoji, milestone image, or a row of stars. */
function artNode(item) {
  if (item.art.type === 'img') {
    const img = el('img.item-art', {
      src: item.art.value,
      alt: '',
      loading: 'lazy',
      width: '96',
      height: '96',
    });
    // A missing milestone file must not leave a broken-image icon in a child's
    // album; fall back to the generic card face.
    img.addEventListener('error', () => img.replaceWith(el('span.item-art', { text: '🎴' })));
    return img;
  }
  if (item.art.type === 'stars') {
    return el('span.item-art', { text: item.art.value > 0 ? '⭐'.repeat(Math.min(3, item.art.value)) : '☆' });
  }
  return el('span.item-art', { text: item.art.value });
}

function itemNode(item) {
  const node = el(`div.item.${item.owned ? 'is-owned' : 'is-locked'}`, {
    // Locked items announce as locked rather than just looking dimmer.
    'aria-label': item.owned ? item.name : `${item.name} — vēl nav iegūta`,
  }, [
    el('div.item-face', {}, [artNode(item)]),
    el('strong.item-name', { text: item.name }),
    item.tier ? el('span.item-tier', { 'data-tier': item.tier, text: item.tier }) : null,
    !item.owned && item.hint ? el('span.item-hint', { text: item.hint }) : null,
  ]);
  return node;
}

function gameSection(result) {
  const game = byId(result.app);
  if (!game) return null;

  const head = el('div.collection-head', {}, [
    el('div', {}, [
      // The id is what the section's aria-labelledby points at; without it the
      // reference dangles and the section announces with no name at all.
      el('h2', { id: `c-${game.id}`, text: game.title }),
      el('p.collection-count', {
        text: result.total
          ? `${result.owned} no ${result.total}`
          : result.stats.artworks
            ? `${result.stats.artworks} zīmējums${result.stats.artworks === 1 ? '' : 'i'}`
            : 'Vēl nav sākts',
      }),
    ]),
    el('a.kmp-btn.kmp-btn--quiet', { href: game.path, text: `${game.cta} →` }),
  ]);

  const body = result.items.length
    ? el('div.item-grid', {}, result.items.map(itemNode))
    : el('p.collection-empty', {
      text: result.app === 'Paint'
        ? 'Šeit krājas paša zīmējumi — atver Paint un uzzīmē pirmo.'
        : 'Šī spēle vēl nav sākta.',
    });

  return el(`section.collection.card-${game.accent}`, { 'aria-labelledby': `c-${game.id}` }, [
    el('div.collection-inner', {}, [head, body]),
  ]);
}

async function render() {
  const mount = document.getElementById('collection');
  if (!mount) return;

  const child = window.KMP.activeChild();
  const results = await collectAll(child.id);

  const totalOwned = results.reduce((n, r) => n + r.owned, 0);
  const totalAll = results.reduce((n, r) => n + r.total, 0);

  const summary = document.getElementById('collection-summary');
  if (summary) {
    clear(summary).append(
      el('p.section-kicker', { text: child.name ? `${child.name} krājums` : 'Mans krājums' }),
      el('h1', { text: `${totalOwned} no ${totalAll}` }),
      el('p.hero-copy', {
        text: totalOwned === 0
          ? 'Vēl nekas nav savākts. Izvēlies spēli un sāc!'
          : 'Katra spēle dod savas kartītes. Spēlē vairāk, lai savāktu visas.',
      }),
    );
  }

  clear(mount);
  // Keep catalogue order rather than sorting by how much is collected, so an
  // album does not rearrange itself under a child between visits.
  for (const game of GAMES) {
    const result = results.find((r) => r.app === game.id);
    const node = result && gameSection(result);
    if (node) mount.append(node);
  }
}

if (window.KMP) {
  render().catch((err) => {
    console.error('collection failed to render', err);
    const mount = document.getElementById('collection');
    if (mount) {
      clear(mount).append(el('p.collection-empty', {
        text: 'Krājumu pašlaik neizdevās ielādēt. Pamēģini pārlādēt lapu.',
      }));
    }
  });
} else {
  console.warn('kmp.js did not load; collection cannot be shown');
}
