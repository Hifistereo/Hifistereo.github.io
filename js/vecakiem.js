/* The parent area: one gate, and progress across all five games.
 *
 * The gate is an arithmetic challenge, deliberately identical in spirit to the
 * one ENG-learning already uses (src/ui/screens/parent.js). It is not
 * security — anyone determined gets in — it exists to stop a five-year-old
 * wandering into the settings and deleting their sibling's progress. It
 * unlocks for this visit only and is never persisted, so leaving the page
 * re-locks it.
 *
 * Memory's caregiver view has never had any gate at all, which is why unifying
 * the entrance here is worth doing rather than just tidy.
 */

import { GAMES, byId } from './games.js';
import { collectAll } from './adapters.js';
import { applyMotionPref } from './site.js';
import { el, clear } from './dom.js';

let unlockedThisVisit = false;

const mountEl = () => document.getElementById('parent');

// --- gate -------------------------------------------------------------------

function renderGate() {
  const mount = mountEl();
  const a = 3 + Math.floor(Math.random() * 7);
  const b = 4 + Math.floor(Math.random() * 8);

  const input = el('input.gate-input', {
    type: 'number',
    inputmode: 'numeric',
    autocomplete: 'off',
    'aria-label': `${a} reiz ${b}`,
  });
  const error = el('p.gate-error', { role: 'alert' });

  const form = el('form.gate', {
    on: {
      submit: (e) => {
        e.preventDefault();
        if (Number(input.value) === a * b) {
          unlockedThisVisit = true;
          render();
          return;
        }
        error.textContent = 'Nepareizi. Mēģini vēlreiz.';
        input.value = '';
        input.focus();
      },
    },
  }, [
    // h2, not h1: this renders into a page that already has its own <h1>, and
    // a second one leaves a screen reader with two competing page titles.
    el('p.section-kicker', { text: 'Vecāku sadaļa' }),
    el('h2', { text: 'Atrisini, lai turpinātu' }),
    el('p.gate-sum', { text: `${a} × ${b} = ?` }),
    input,
    error,
    el('button.kmp-btn', { type: 'submit', text: 'Turpināt' }),
    el('a.kmp-btn.kmp-btn--quiet', { href: '/', text: 'Atpakaļ uz spēlēm' }),
  ]);

  clear(mount).append(form);
  setTimeout(() => input.focus(), 50);
}

// --- dashboard --------------------------------------------------------------

function statTile(value, label) {
  return el('div.stat-tile', {}, [
    el('strong', { text: String(value) }),
    el('span', { text: label }),
  ]);
}

function gameRow(result) {
  const game = byId(result.app);
  if (!game) return null;
  const s = result.stats || {};

  const bits = [];
  if (s.sessions) bits.push(`${s.sessions} spēles`);
  if (s.attempts) bits.push(`${Math.round((s.correct / s.attempts) * 100)}% pareizi`);
  if (s.stars) bits.push(`${s.stars} ⭐`);
  if (s.words) bits.push(`${s.words} vārdi`);
  if (s.levels) bits.push(`${s.levels} līmeņi`);
  if (s.artworks) bits.push(`${s.artworks} zīmējumi`);
  if (result.total) bits.push(`${result.owned}/${result.total} kartītes`);

  return el('div.parent-game', {}, [
    el('span.parent-game__icon', { 'aria-hidden': 'true', text: game.icon }),
    el('div.parent-game__text', {}, [
      el('strong', { text: game.title }),
      el('span', { text: bits.length ? bits.join(' · ') : 'Vēl nav spēlēts' }),
    ]),
    // Deep link into the game's own parent view, which holds detail the hub
    // deliberately does not duplicate — ENG-learning's per-word retention data
    // has no equivalent here and should not be reinvented.
    el('a.kmp-btn.kmp-btn--quiet', { href: game.path, text: 'Atvērt →' }),
  ]);
}

function childSwitcher(children, activeId) {
  if (children.length < 2) return null;
  const row = el('div.chip-row', { role: 'group', 'aria-label': 'Kurš bērns' });
  for (const c of children) {
    const b = el('button.chip', {
      type: 'button',
      'aria-pressed': String(c.id === activeId),
      text: c.name || 'Bez vārda',
    });
    b.addEventListener('click', () => { window.KMP.setActive(c.id); render(); });
    row.append(b);
  }
  return row;
}

function prefsPanel() {
  const p = window.KMP.prefs();
  const toggle = (label, hint, on, key) => {
    const b = el('button.pref-row', {
      type: 'button',
      'aria-pressed': String(on),
      on: {
        click: () => {
          window.KMP.savePrefs({ ...window.KMP.prefs(), [key]: !window.KMP.prefs()[key] });
          applyMotionPref();
          render();
        },
      },
    }, [
      el('span', {}, [el('strong', { text: label }), el('small', { text: hint })]),
      el('span.pref-state', { text: on ? 'Ieslēgts' : 'Izslēgts' }),
    ]);
    return b;
  };
  return el('section.parent-panel', {}, [
    el('h3', { text: 'Iestatījumi visām spēlēm' }),
    el('p.muted', { text: 'Šie iestatījumi attiecas uz visām piecām spēlēm.' }),
    toggle('Skaņa', 'Runa, mūzika un efekti', p.sound, 'sound'),
    toggle('Mazāk kustību', 'Samazina animācijas un lēcienus', p.reducedMotion, 'reducedMotion'),
  ]);
}

function dangerPanel() {
  const btn = el('button.kmp-btn.kmp-btn--danger', { type: 'button', text: 'Dzēst visus datus' });
  btn.addEventListener('click', () => {
    const ok = window.confirm(
      'Dzēst visu? Tiks izdzēsti visi profili, viss progress un visas savāktās kartītes '
      + 'visās piecās spēlēs uz šīs ierīces. To nevar atsaukt.',
    );
    if (!ok) return;
    window.KMP.deleteAll();
    window.location.href = '/';
  });

  return el('section.parent-panel.parent-panel--danger', {}, [
    el('h3', { text: 'Dzēst datus' }),
    el('p.muted', {
      text: 'Viss, ko bērns ir savācis, glabājas tikai šajā pārlūkprogrammā. '
        + 'Šī poga izdzēš to visu uzreiz — līdz šim tas bija iespējams tikai, '
        + 'notīrot pārlūkprogrammas datus manuāli.',
    }),
    btn,
  ]);
}

async function renderDashboard() {
  const mount = mountEl();
  const children = window.KMP.profiles();
  const child = window.KMP.activeChild();
  const results = await collectAll(child.id);

  const totals = results.reduce((acc, r) => ({
    owned: acc.owned + r.owned,
    total: acc.total + r.total,
    sessions: acc.sessions + (Number(r.stats.sessions) || 0),
    attempts: acc.attempts + (Number(r.stats.attempts) || 0),
    correct: acc.correct + (Number(r.stats.correct) || 0),
    stars: acc.stars + (Number(r.stats.stars) || 0),
  }), { owned: 0, total: 0, sessions: 0, attempts: 0, correct: 0, stars: 0 });

  clear(mount).append(
    // h2 for the same reason as the gate above; the panels below it are h3.
    el('p.section-kicker', { text: 'Vecāku sadaļa' }),
    el('h2', { text: child.name ? `${child.name} progress` : 'Progress' }),
    childSwitcher(children, child.id),

    el('div.stat-row', {}, [
      statTile(totals.sessions, 'Spēles'),
      statTile(totals.attempts ? `${Math.round((totals.correct / totals.attempts) * 100)}%` : '—', 'Pareizas atbildes'),
      statTile(totals.stars, 'Zvaigznes'),
      statTile(`${totals.owned}/${totals.total}`, 'Kartītes'),
    ]),

    el('p.privacy-box', {
      text: 'Šie skaitļi ir aprēķināti šeit, pārlūkprogrammā, no datiem, kas nekad '
        + 'nav pametuši šo ierīci. Nav servera, kas tos redzētu.',
    }),

    el('section.parent-panel', {}, [
      el('h3', { text: 'Pa spēlēm' }),
      el('p.muted', { text: 'Sīkāka statistika par katru spēli ir pašā spēlē.' }),
      // Catalogue order, matching the home page and the collection, rather
      // than the order the adapters happen to resolve in.
      ...GAMES.map((g) => results.find((r) => r.app === g.id)).filter(Boolean).map(gameRow).filter(Boolean),
    ]),

    prefsPanel(),
    dangerPanel(),
  );
}

function render() {
  if (!unlockedThisVisit) return renderGate();
  renderDashboard().catch((err) => {
    console.error('parent area failed to render', err);
    clear(mountEl()).append(el('p.collection-empty', {
      text: 'Datus pašlaik neizdevās ielādēt. Pamēģini pārlādēt lapu.',
    }));
  });
}

if (window.KMP) {
  render();
} else {
  console.warn('kmp.js did not load; parent area cannot be shown');
}
