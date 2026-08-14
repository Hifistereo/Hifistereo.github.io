/* Kept in a file rather than inline so the page can run `script-src 'self'`
   with no 'unsafe-inline'. Loaded on every page; everything here has to be
   safe on the pages that do not load shared/kmp.js at all. */

/**
 * Mirror the shared "Mazāk kustību" preference onto <html> as
 * data-kmp-motion="reduced", which styles.css keys off alongside the OS-level
 * prefers-reduced-motion query.
 *
 * Without this the toggle on the hub and in the parent area writes kmp:prefs
 * and nothing on the page changes — the setting reads as broken on the very
 * page you set it from. Exported so both those screens can re-apply it after
 * they re-render.
 */
export function applyMotionPref() {
  if (!window.KMP) return;
  const reduced = window.KMP.prefs().reducedMotion;
  document.documentElement.dataset.kmpMotion = reduced ? 'reduced' : 'full';
}

// Runs at once rather than on DOMContentLoaded: <html> already exists by the
// time a deferred script runs, and waiting would let one un-reduced frame paint.
applyMotionPref();

document.addEventListener('DOMContentLoaded', () => {
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
});
