/* The Adventure page: the world map, the character, the cosmetic items, and
   the friends a child has discovered. Requires shared/kmp.js (window.KMP)
   to have loaded first.

   This is a read-only view over js/progression.js's model — it never
   computes progress itself, only renders it and forwards the two small
   writes a child can make here (pick a featured item, acknowledge a new
   unlock) back through progression.js's own API. */

import { el, clear } from './dom.js';
import { avatarImg } from './avatars.js';
import { getAdventureProgress, markStagesSeen, setFeaturedItem, acknowledgeFirstAdoption } from './progression.js';
import { ITEMS, FRIENDS } from './adventure-data.js';

/** Emoji or image art, matching the collection page's own broken-image
    fallback so a missing file never leaves a broken-image icon in view. */
function artNode(art) {
  if (art.type === 'img') {
    const img = el('img.item-art', { src: art.value, alt: '', loading: 'lazy', width: '96', height: '96' });
    img.addEventListener('error', () => img.replaceWith(el('span.item-art', { text: '🐾' })));
    return img;
  }
  return el('span.item-art', { text: art.value });
}

// --- map ----------------------------------------------------------------

/**
 * Locked stages reveal nothing: not their name, not their theme icon —
 * that surprise is the point of the unlock toast. The one exception is the
 * stage right after the child's current position, whose theme icon (but
 * not its name) is shown so the map reads as "something is coming", not as
 * a dead end.
 */
function stageNode(stage, { isCurrent, isNext }) {
  const locked = !stage.unlocked;
  const cls = ['stage-node'];
  if (locked) cls.push('is-locked');
  if (isCurrent) cls.push('is-current');

  const icon = locked
    ? el('span.stage-icon', { 'aria-hidden': 'true', text: isNext ? stage.icon : '🔒' })
    : el('span.stage-icon', { 'aria-hidden': 'true', text: stage.icon });

  const label = locked
    ? el('span.stage-name', { text: 'Vēl neatklāts posms' })
    : el('span.stage-name', { text: stage.name });

  return el(`li.${cls.join('.')}`, {
    'aria-label': locked ? 'Vēl neatklāts posms' : `${stage.name}${isCurrent ? ' — tu esi šeit' : ''}`,
  }, [icon, label]);
}

function renderMap(mount, progress) {
  const maxIdx = progress.stages.findIndex((s) => s.id === progress.maxReachedStageId);
  const nextIdx = progress.nextStage ? progress.stages.findIndex((s) => s.id === progress.nextStage.id) : -1;

  const list = el('ol.adventure-map', { role: 'list' }, progress.stages.map((stage, i) => {
    const node = stageNode(stage, { isCurrent: i === maxIdx, isNext: i === nextIdx });
    node.classList.add(i % 2 === 0 ? 'is-left' : 'is-right');
    return node;
  }));

  const currentStage = progress.stages[maxIdx];
  const next = progress.nextStage;
  const nextText = !next
    ? 'Viss piedzīvojums ir atklāts!'
    : (() => {
      const need = next.requiredCompletedMilestones - progress.completedMilestones;
      const domainsNeed = next.domains - progress.domainsTouched;
      const parts = [];
      if (need > 0) parts.push(`vēl ${need} sasniegum${need === 1 ? 's' : 'i'}`);
      if (domainsNeed > 0) parts.push(`${domainsNeed === 1 ? 'vēl viena' : `vēl ${domainsNeed}`} jauna joma`);
      return parts.length ? `Nākamais atklājums: ${parts.join(' un ')}.` : 'Nākamais atklājums tuvojas!';
    })();

  clear(mount).append(
    list,
    el('p.adventure-current', { text: currentStage ? `Tu esi šeit: ${currentStage.icon} ${currentStage.name}` : '' }),
    el('p.adventure-next', { text: nextText }),
  );
}

// --- character ------------------------------------------------------------

function renderCharacter(mount, child, progress) {
  const featured = progress.featuredItemId ? ITEMS.find((i) => i.id === progress.featuredItemId) : null;

  const avatarWrap = el('div.adventure-avatar-wrap', {}, [
    avatarImg(child.avatar, 'avatar-img'),
    featured ? el('span.featured-badge', { 'aria-hidden': 'true' }, [artNode(featured.art)]) : null,
  ]);

  clear(mount).append(
    avatarWrap,
    el('p.adventure-character-name', { text: child.name || 'Tavs varonis' }),
    !progress.isRealProfile
      ? el('p.adventure-preview-note', {
        text: 'Izveido profilu hub lapā, lai piedzīvojums tiktu saglabāts.',
      })
      : null,
  );
}

// --- items & friends --------------------------------------------------------

function itemNode(item, { owned, featured, onPick }) {
  const node = el(`div.item.${owned ? 'is-owned' : 'is-locked'}`, {
    'aria-label': owned ? item.name : `${item.name} — vēl nav iegūta`,
  }, [
    el('div.item-face', {}, [artNode(item.art)]),
    el('strong.item-name', { text: item.name }),
    featured ? el('span.item-featured', { text: 'Izvēlēts' }) : null,
  ]);

  if (owned && onPick) {
    const btn = el('button.item-pick', {
      type: 'button',
      'aria-pressed': String(featured),
      text: featured ? 'Izvēlēts' : 'Izvēlēties',
    });
    btn.addEventListener('click', onPick);
    node.append(btn);
  }
  return node;
}

function renderItems(mount, child, progress) {
  const canPick = progress.isRealProfile;
  clear(mount).append(el('div.item-grid', {}, ITEMS.map((item) => {
    const owned = progress.earnedItemIds.includes(item.id);
    const featured = progress.featuredItemId === item.id;
    return itemNode(item, {
      owned,
      featured,
      onPick: canPick && owned ? () => {
        setFeaturedItem(child.id, featured ? null : item.id);
        renderAll();
      } : null,
    });
  })));
}

function friendNode(friend, owned) {
  return el(`div.item.${owned ? 'is-owned' : 'is-locked'}`, {
    'aria-label': owned ? friend.name : `${friend.name} — vēl nav sastapts`,
  }, [
    el('div.item-face', {}, [artNode(friend.art)]),
    el('strong.item-name', { text: owned ? friend.name : '???' }),
  ]);
}

function renderFriends(mount, progress) {
  const unlockedStageIds = new Set(progress.stages.filter((s) => s.unlocked).map((s) => s.id));
  clear(mount).append(el('div.item-grid', {}, FRIENDS.map((f) => friendNode(f, unlockedStageIds.has(f.unlockStage)))));
}

// --- unlock toasts ----------------------------------------------------------

function showUnlockToasts(progress) {
  if (!progress.isRealProfile || progress.newlyUnlocked.length === 0) return;
  const region = document.getElementById('adventure-toast-region');
  if (!region) return;

  for (const stageId of progress.newlyUnlocked) {
    const stage = progress.stages.find((s) => s.id === stageId);
    if (!stage) continue;
    const toast = el('p.adventure-toast', { text: `Tu atklāji: ${stage.icon} ${stage.name}!` });
    region.append(toast);
    // Two rAFs so the initial (opacity:0) state actually paints before the
    // transition-triggering class is added — a single frame can coalesce
    // with the append and skip the transition entirely.
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('is-visible')));
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  }

  // Marked seen once per page load, not per toast dismissal, so a refresh
  // mid-animation can never leave a stage stuck in limbo.
  markStagesSeen(progress.childId, progress.newlyUnlocked);
}

// --- render -------------------------------------------------------------

async function renderAll() {
  const child = window.KMP.activeChild();
  const progress = await getAdventureProgress(child.id);

  const mapMount = document.getElementById('adventure-map');
  const charMount = document.getElementById('adventure-character');
  const itemsMount = document.getElementById('adventure-items');
  const friendsMount = document.getElementById('adventure-friends');
  const adoptionMount = document.getElementById('adventure-adoption-note');

  if (mapMount) renderMap(mapMount, progress);
  if (charMount) renderCharacter(charMount, child, progress);
  if (itemsMount) renderItems(itemsMount, child, progress);
  if (friendsMount) renderFriends(friendsMount, progress);

  if (adoptionMount) {
    clear(adoptionMount);
    if (progress.pendingFirstAdoptionMessage) {
      const stage = progress.stages.find((s) => s.id === progress.maxReachedStageId);
      adoptionMount.append(el('p.hero-copy', {
        text: `Tavs piedzīvojums jau ir aizvedis tevi līdz: ${stage.icon} ${stage.name}!`,
      }));
      // Shown once: this page is the only place it can be acknowledged, so
      // it never reappears on a later visit even though other pages (the
      // hub's teaser) also call getAdventureProgress().
      acknowledgeFirstAdoption(child.id);
    }
  }

  showUnlockToasts(progress);
}

if (window.KMP) {
  renderAll().catch((err) => {
    console.error('adventure failed to render', err);
    const mapMount = document.getElementById('adventure-map');
    if (mapMount) {
      clear(mapMount).append(el('p.collection-empty', {
        text: 'Piedzīvojumu pašlaik neizdevās ielādēt. Pamēģini pārlādēt lapu.',
      }));
    }
  });
} else {
  console.warn('kmp.js did not load; adventure cannot be shown');
}
