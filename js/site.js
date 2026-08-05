/* Kept in a file rather than inline so the page can run `script-src 'self'`
   with no 'unsafe-inline'. If this ever grows past a few lines, it probably
   belongs in an app instead — the hub is meant to be a static index. */
document.addEventListener('DOMContentLoaded', () => {
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
});
