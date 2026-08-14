/* Launches a KidMindPath game as a same-page overlay instead of a top-level
   navigation, so the browser/OS back gesture keeps working and the game can
   be requested into fullscreen. All five games are same-origin repos under
   www.kidmindpath.com, so the overlay's <iframe> and its document are fully
   readable/writable here.

   Degrades to nothing with JavaScript off: the real <a href="/PrataSala/">
   links this listens on still navigate normally, nothing is built, nothing
   is hidden. Works the same on every page that imports it (index.html,
   kolekcija.html, vecakiem.html) because it matches by resolved pathname
   against js/games.js's GAMES list rather than special-casing any one page's
   markup. */

import { GAMES } from './games.js';
import { el } from './dom.js';

const byPath = new Map(GAMES.map((g) => [g.path, g]));
const EXIT_LINK_SELECTOR = '.kmp-bar__back, .kmp-bar__who, .kmp-home';
const HUB_ORIGIN = 'https://www.kidmindpath.com';
const BAR_CHECK_DELAY_MS = 2000; // covers PrataSala's async design-board fetch before it mounts .kmp-bar

let overlay = null;
let frameEl = null;
let iframeEl = null;
let fallbackExit = null;
let lastFocused = null;
let barCheckTimer = null;
let hiddenSiblings = [];
let pendingNavigation = null;

function buildOverlay() {
  fallbackExit = el('button.kmp-launcher__fallback-exit', {
    type: 'button',
    hidden: true,
    'aria-label': 'Aizvērt spēli un atgriezties spēļu sarakstā',
    on: { click: () => requestClose() },
  }, [el('span', { 'aria-hidden': 'true', text: '←' }), ' Uz spēlēm']);

  iframeEl = newIframe();

  frameEl = el('div.kmp-launcher__frame', {}, [fallbackExit, iframeEl]);
  overlay = el('div.kmp-launcher', { hidden: true, tabindex: '-1', role: 'dialog', 'aria-modal': 'true' }, [frameEl]);
  document.body.append(overlay);
}

function newIframe() {
  return el('iframe.kmp-launcher__iframe', { referrerpolicy: 'no-referrer', allow: 'fullscreen' });
}

function isPlainLeftClick(e) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

function findGameAnchor(target) {
  const a = target.closest && target.closest('a[href]');
  if (!a || a.origin !== location.origin) return null;
  if (a.target && a.target !== '_self') return null;
  return byPath.get(a.pathname) ? a : null;
}

function onDocumentClick(e) {
  if (e.defaultPrevented || !isPlainLeftClick(e)) return;
  const a = findGameAnchor(e.target);
  if (!a) return;
  const game = byPath.get(a.pathname);
  e.preventDefault();
  openGame(game, a);
}

function openGame(game, anchor) {
  if (!overlay) buildOverlay();

  lastFocused = anchor;
  fallbackExit.hidden = true;
  iframeEl.title = game.title;
  iframeEl.src = game.path;
  overlay.setAttribute('aria-label', game.title);
  overlay.hidden = false;
  setSiblingsInert(true);

  history.pushState({ kmpGame: game.id }, '', location.href);
  // The fallback exit button is hidden at this point (only shown once we know
  // the game's own bar didn't mount), so there's nothing else to focus yet —
  // send focus into the iframe itself rather than the dialog wrapper: once
  // fullscreen is entered, Chrome silently refuses to hold focus on a plain
  // wrapping element inside a fullscreen subtree that contains an iframe,
  // but reliably accepts it on the iframe. Tabbing from there also reaches
  // the game's own back-bar controls, which is the more useful target anyway.
  iframeEl.focus();
  requestOverlayFullscreen();

  iframeEl.addEventListener('load', () => onFrameLoaded(), { once: true });
}

function requestOverlayFullscreen() {
  if (!frameEl.requestFullscreen) return;
  // The requestFullscreen() promise can settle before the transition's own
  // focus-reset side effect actually happens, so re-applying focus in a
  // .then()/.finally() is too early and gets clobbered a moment later — and
  // even the fullscreenchange event itself still fires a tick before the
  // browser's internal focus bookkeeping has settled, so a focus() call
  // synchronous within that handler doesn't stick either. Deferring one more
  // tick (setTimeout 0) after fullscreenchange is what actually holds.
  document.addEventListener('fullscreenchange', function reapplyFocus() {
    document.removeEventListener('fullscreenchange', reapplyFocus);
    setTimeout(() => { if (overlay && !overlay.hidden) iframeEl.focus(); }, 0);
  }, { once: true });
  frameEl.requestFullscreen().catch(() => {});
}

function onFrameLoaded() {
  let doc;
  try {
    doc = iframeEl.contentDocument;
  } catch {
    fallbackExit.hidden = false;
    return;
  }
  if (!doc || !doc.body) {
    fallbackExit.hidden = false;
    return;
  }

  // One delegated listener catches clicks on the game's own back-bar links
  // even if they mount asynchronously after load — no need to watch the DOM
  // for their arrival, only to listen for a click once they exist.
  doc.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest(EXIT_LINK_SELECTOR);
    if (!link) return;
    e.preventDefault();
    requestClose(link.classList.contains('kmp-bar__who') ? `${HUB_ORIGIN}/kolekcija.html` : null);
  });

  // Focus lives inside the iframe while a game is open, so the host document
  // never sees the keystroke. Same-origin, so we can listen in there too.
  doc.addEventListener('keydown', onEscape);

  clearTimeout(barCheckTimer);
  if (doc.querySelector('.kmp-bar')) return;
  barCheckTimer = setTimeout(() => {
    if (overlay && !overlay.hidden && !doc.querySelector('.kmp-bar')) fallbackExit.hidden = false;
  }, BAR_CHECK_DELAY_MS);
}

/* The overlay is a modal dialog, so Escape has to leave it. Browsers spend the
   first Escape on exiting fullscreen without firing keydown here, which is why
   this closes on the press it does see rather than trying to count them: the
   overlay is dismissible either way, and closeOverlay() exits fullscreen itself
   if we are still in it. */
function onEscape(e) {
  if (e.key !== 'Escape' || !overlay || overlay.hidden) return;
  requestClose();
}

/** Every "leave the game" path funnels through here, so native back/forward
    and every in-app control close the overlay identically and can never
    desync — see the popstate listener below, which is the only place that
    actually calls closeOverlay(). */
function requestClose(navigateTo = null) {
  pendingNavigation = navigateTo;
  if (history.state && history.state.kmpGame) history.back();
  else closeOverlay();
}

window.addEventListener('popstate', () => {
  if (overlay && !overlay.hidden) closeOverlay();
  if (pendingNavigation) {
    const dest = pendingNavigation;
    pendingNavigation = null;
    window.location.assign(dest);
  }
});

function closeOverlay() {
  if (!overlay || overlay.hidden) return;
  clearTimeout(barCheckTimer);

  // Replace the iframe rather than navigating the same element to
  // about:blank: re-navigating one persistent iframe repeatedly, right
  // before the next fullscreen+pushState cycle, leaves Chrome's history
  // navigation silently inert on the following close (reproduced directly —
  // swapping in a fresh element every time avoids it entirely) and, as a
  // bonus, guarantees the previous game's audio/timers actually stop rather
  // than merely being hidden.
  const fresh = newIframe();
  iframeEl.replaceWith(fresh);
  iframeEl = fresh;

  overlay.hidden = true;
  setSiblingsInert(false);

  const toFocus = lastFocused;
  lastFocused = null;
  toFocus?.focus();

  if (document.fullscreenElement) {
    // Same promise-settles-and-even-fullscreenchange-fires-too-early quirk as
    // requestOverlayFullscreen() above.
    document.addEventListener('fullscreenchange', function reapplyFocus() {
      document.removeEventListener('fullscreenchange', reapplyFocus);
      setTimeout(() => toFocus?.focus(), 0);
    }, { once: true });
    document.exitFullscreen().catch(() => {});
  }
}

function setSiblingsInert(on) {
  if (on) {
    hiddenSiblings = Array.from(document.body.children).filter((n) => n !== overlay);
    hiddenSiblings.forEach((n) => { n.inert = true; n.setAttribute('aria-hidden', 'true'); });
  } else {
    hiddenSiblings.forEach((n) => { n.inert = false; n.removeAttribute('aria-hidden'); });
    hiddenSiblings = [];
  }
}

// A page can load with a stale {kmpGame} history entry (e.g. reloaded while
// "inside" a game) even though no overlay exists yet in this fresh document.
// Clear it before anything can act on it, or a later legitimate back could
// misfire against a marker with nothing to close.
if (history.state && history.state.kmpGame) history.replaceState(null, '', location.href);

document.addEventListener('click', onDocumentClick);
document.addEventListener('keydown', onEscape);
