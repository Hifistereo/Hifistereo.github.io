/* Home page behaviour: who is playing, and which games suit them.
   Requires shared/kmp.js (window.KMP) to have loaded first.

   The game cards are NOT built here. They are static markup in index.html so
   the site still works with JavaScript off and so a crawler sees five real
   links. This file only reorders them and annotates them. */

import { GAMES, byId, suitsAge, ageLabel } from './games.js';
import { el, clear } from './dom.js';
import { applyMotionPref } from './site.js';

// Illustrated portraits, img/avatars/<id>.webp. `lapsa` is load-bearing: it is
// the hardcoded fallback in shared/kmp.js (GUEST and normaliseProfile), so
// this id must never change or be reused for a different character.
const AVATARS = [
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

const resolveAvatar = (id) => {
  const resolved = LEGACY_AVATARS[id] || id;
  return AVATARS.find((a) => a.id === resolved) || AVATARS[0];
};

/**
 * One avatar portrait. `draggable` must be the string 'false', not the
 * boolean: el() drops any attribute whose value is boolean false, so passing
 * the boolean would silently leave the image draggable, and on a touch
 * device a long press would lift a drag ghost instead of picking a friend.
 */
const avatarImg = (id, cls) => el(`img.${cls}`, {
  src: `/img/avatars/${resolveAvatar(id).id}.webp`,
  width: '192',
  height: '192',
  alt: '',
  draggable: 'false',
  decoding: 'async',
});

const AGES = [2, 3, 4, 5, 6, 7];

// --- who is playing ---------------------------------------------------------

function renderSetup(mount) {
  const draft = { name: '', ageYears: null, avatar: AVATARS[0].id };

  const nameInput = el('input.setup-name', {
    id: 'kid-name',
    type: 'text',
    maxlength: '16',
    autocomplete: 'off',
    placeholder: 'Ieraksti vārdu',
    on: { input: (e) => { draft.name = e.target.value; } },
  });

  const ageRow = el('div.chip-row', { role: 'group', 'aria-label': 'Cik gadu' },
    AGES.map((age) => {
      const b = el('button.chip', { type: 'button', 'aria-pressed': 'false', text: String(age) });
      b.addEventListener('click', () => {
        draft.ageYears = age;
        ageRow.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
      });
      return b;
    }));

  const avatarRow = el('div.chip-row', { role: 'group', 'aria-label': 'Izvēlies draugu' },
    AVATARS.map((a) => {
      const b = el('button.chip.chip--avatar', {
        type: 'button',
        'aria-pressed': String(a.id === draft.avatar),
        'aria-label': a.label,
      }, [avatarImg(a.id, 'avatar-img')]);
      b.addEventListener('click', () => {
        draft.avatar = a.id;
        avatarRow.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
      });
      return b;
    }));

  const start = (guest) => {
    const name = guest ? '' : draft.name.trim();
    const existing = window.KMP.profiles();

    // Naming a guest UPGRADES them in place rather than creating a second
    // profile. Every game namespaces its storage by this id, so minting a new
    // one would silently orphan everything the guest collected — and the
    // setup card promises the opposite in as many words.
    const guestToName = !guest && existing.length === 1 && existing[0].guest
      ? existing[0]
      : null;

    if (guestToName) {
      window.KMP.saveProfiles(existing.map((p) => (p.id === guestToName.id ? {
        ...p,
        name,
        ageYears: draft.ageYears ?? p.ageYears,
        avatar: draft.avatar,
        guest: false,
      } : p)));
      window.KMP.setActive(guestToName.id);
      render();
      return;
    }

    const id = window.KMP.makeId(name || 'draugs');
    window.KMP.saveProfiles([...existing, {
      id,
      name,
      ageYears: draft.ageYears,
      avatar: draft.avatar,
      guest,
      createdAt: new Date().toISOString(),
    }]);
    window.KMP.setActive(id);
    render();
  };

  mount.append(
    el('div.setup', {}, [
      el('p.section-kicker', { text: 'Sāksim!' }),
      el('h2', { text: 'Kas šodien spēlēs?' }),
      el('label.field-label', { for: 'kid-name', text: 'Kā tevi sauc?' }),
      nameInput,
      el('p.field-label', { text: 'Cik tev gadu?' }),
      ageRow,
      el('p.field-label', { text: 'Izvēlies draugu' }),
      avatarRow,
      el('div.setup-actions', {}, [
        el('button.kmp-btn', { type: 'button', text: 'Sākt spēlēt', on: { click: () => start(false) } }),
        // Deliberately a real button of the same size, not a text link buried
        // underneath. Nobody should have to type a name to use this site.
        el('button.kmp-btn.kmp-btn--quiet', {
          type: 'button',
          text: 'Spēlēt bez vārda',
          on: { click: () => start(true) },
        }),
      ]),
      el('p.setup-note', {
        text: 'Vārdu var pievienot vēlāk — nekas no savāktā nepazudīs. Nekas neaiziet no šīs ierīces.',
      }),
    ]),
  );
}

function renderReturning(mount) {
  const child = window.KMP.activeChild();
  const all = window.KMP.profiles();
  const last = window.KMP.lastVisit();
  const lastGame = last && byId(last.app);

  const heading = child.name
    ? `Sveiks, ${child.name}!`
    : 'Sveiks!';

  const row = el('div.who-row', {}, [
    el('span.who-avatar', { 'aria-hidden': 'true' }, [avatarImg(child.avatar, 'avatar-img')]),
    el('div.who-text', {}, [
      el('strong', { text: heading }),
      el('span', { text: child.ageYears ? `${child.ageYears} gadi` : 'Vecums nav norādīts' }),
    ]),
  ]);

  // No "choose a game" button here: the grid is directly below this panel, so
  // it would point at itself and duplicate the hero button.
  const actions = el('div.who-actions', {}, [
    lastGame && el('a.kmp-btn', { href: lastGame.path, text: `Turpināt: ${lastGame.short} →` }),
    el('a.kmp-btn.kmp-btn--quiet', { href: '/kolekcija.html', text: '🏆 Mani krājumi' }),
  ]);

  // One chip per child, plus "add" while there is room. There is always at
  // least one of the two to show: this only renders when a profile exists, and
  // one profile is below MAX_PROFILES.
  const switcher = el('div.chip-row.who-switch', { role: 'group', 'aria-label': 'Kurš spēlē' });
  for (const p of all) {
    const b = el('button.chip.profile-chip', {
      type: 'button',
      'aria-pressed': String(p.id === child.id),
    }, [
      avatarImg(p.avatar, 'profile-chip-avatar'),
      p.name || 'Bez vārda',
    ]);
    b.addEventListener('click', () => { window.KMP.setActive(p.id); render(); });
    switcher.append(b);
  }
  if (all.length < window.KMP.MAX_PROFILES) {
    // For a guest this is "add your name", not "add another child" — naming
    // a guest upgrades them in place and keeps everything they collected.
    const add = el('button.chip.chip--add', {
      type: 'button',
      text: child.guest && all.length === 1 ? '✏️ Pievienot vārdu' : '+ Pievienot',
    });
    add.addEventListener('click', () => { mount.dataset.mode = 'setup'; render(); });
    switcher.append(add);
  }

  mount.append(el('div.who', {}, [row, actions, switcher, renderPrefs()]));
}

function renderPrefs() {
  const p = window.KMP.prefs();

  /* Each chip is a switch with a FIXED label; only aria-pressed changes. An
     earlier version rewrote the label as well as the state, which made "🐢
     Mazāk kustību" in the unpressed style read as if reduced motion were off
     when it was the name of the setting. A switch should say what it controls,
     not what it is about to become. */
  const toggle = (label, on, key) => {
    const b = el('button.chip', {
      type: 'button',
      'aria-pressed': String(on),
      text: label,
    });
    b.addEventListener('click', () => {
      window.KMP.savePrefs({ ...window.KMP.prefs(), [key]: !window.KMP.prefs()[key] });
      applyMotionPref();
      render();
    });
    return b;
  };

  return el('div.chip-row.who-prefs', { role: 'group', 'aria-label': 'Iestatījumi' }, [
    toggle('🔊 Skaņa', p.sound, 'sound'),
    toggle('🐢 Mazāk kustību', p.reducedMotion, 'reducedMotion'),
  ]);
}

// --- the game grid ----------------------------------------------------------

/**
 * Reorder and annotate the static cards for the child's age.
 *
 * Ordering is done with a CSS class rather than an inline style so the page
 * keeps working under `style-src 'self'` with no 'unsafe-inline'.
 */
function applyAgeFit() {
  const age = window.KMP.activeChild().ageYears;
  const grid = document.querySelector('.game-grid');
  if (!grid) return;

  for (const game of GAMES) {
    const card = grid.querySelector(`[data-game="${game.id}"]`);
    if (!card) continue;

    card.querySelector('.age-fit')?.remove();
    const fits = suitsAge(game, age);
    card.classList.toggle('is-fit', !!age && fits);
    card.classList.toggle('is-other', !!age && !fits);

    if (age && !fits) {
      card.append(el('p.age-fit', { text: `Piemērota vecumam ${ageLabel(game)}` }));
    }
  }
}

// --- render -----------------------------------------------------------------

function render() {
  const mount = document.getElementById('who');
  if (!mount) return;
  const wantsSetup = mount.dataset.mode === 'setup';
  clear(mount);
  mount.hidden = false;

  if (wantsSetup || window.KMP.profiles().length === 0) {
    renderSetup(mount);
    delete mount.dataset.mode;
  } else {
    renderReturning(mount);
  }
  applyAgeFit();
}

if (window.KMP) {
  render();
} else {
  // kmp.js failed to load. The static game cards are still on the page and
  // still work, so say nothing and leave them alone.
  console.warn('kmp.js did not load; home page falls back to the plain game list');
}
