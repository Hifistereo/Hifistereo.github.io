/* The two DOM helpers every screen on the hub needs.
 *
 * These lived as identical copies in hub.js, kolekcija.js, vecakiem.js and
 * game-launcher.js — game-launcher.js's copy even said "copied from js/hub.js"
 * in its own comment. One home instead, so a fix to el() cannot land in three
 * files out of four.
 *
 * shared/kmp.js deliberately does NOT use these. It is a classic script
 * vendored into five other repositories and cannot carry an `import`.
 */

/**
 * Build an element without touching innerHTML — a child's name never becomes
 * markup, which is the whole reason this exists rather than a template string.
 *
 *   el('button.chip', { type: 'button', text: 'Sākt spēlēt' })
 *
 * The tag is `name.class.class`. Attributes are set as attributes, except:
 * `text` sets textContent, and `on` takes a { event: handler } map. A value of
 * null / undefined / false skips the attribute entirely, so a caller can write
 * `{ hidden: someCondition }` without branching; `true` sets it empty.
 *
 * @param {string} tag
 * @param {Object<string, any>} [attrs]
 * @param {Array|Node|string} [kids]
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, kids = []) {
  const [name, ...classes] = tag.split('.');
  const node = document.createElement(name || 'div');
  if (classes.length) node.classList.add(...classes);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'text') node.textContent = String(v);
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) node.addEventListener(ev, fn);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of [].concat(kids)) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

/** Empty a node and hand it back, so a re-render can chain straight into append(). */
export const clear = (node) => {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
};
