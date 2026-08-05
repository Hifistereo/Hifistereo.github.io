# KidMindPath shared design system

The single source of truth for how every KidMindPath site looks. This directory
lives in `Hifistereo/Hifistereo.github.io` and is **copied into** each app repo.

## Why copied, not linked

It would be tidier for each app to load `https://www.kidmindpath.com/shared/kidmindpath-tokens.css`.
Don't. KidlaTest and ENG-learning are offline-first, with service workers that
precache an explicit file list — a stylesheet fetched from outside their own
scope breaks offline boot, blocks first paint on a network round-trip, and
widens every app's Content-Security-Policy for no benefit. Copying costs 540 KB
per app and removes the whole class of problem.

(Paint and Memory ship a web app manifest but **no service worker**, so they
are installable without being offline-capable. That is a pre-existing gap, not
something the design system introduced — but it does mean an installed Paint
opens to nothing with no connection. Worth fixing separately.)

So each app carries its own copy, and every file is stamped with a version on
line 1 so drift is visible at a glance.

## Files

| File | What it is | Who needs it |
|---|---|---|
| `kidmindpath-fonts.css` | `@font-face` for Fredoka + Nunito | everyone |
| `fonts/*.woff2` | 18 files, 508 KB, latin + latin-ext | everyone |
| `kidmindpath-tokens.css` | custom properties only — inert until referenced | everyone |
| `kidmindpath-ui.css` | `.kmp-bar`, `.kmp-home`, `.kmp-btn`, `.kmp-card`, focus ring | everyone |
| `kmp.js` | the shared child profile store — `window.KMP` | everyone |
| `VERSION` | the version stamped into each file's header | — |

**`latin-ext` is not optional.** It is the subset that carries ā ē ī ū ķ ļ ņ ģ š ž č.
Dropping it to save 150 KB makes every Latvian word on the site render with
fallback glyphs for its diacritics.

## Where each app keeps its copy

| Repo | Destination | Referenced as | Notes |
|---|---|---|---|
| `Hifistereo.github.io` | `shared/` | `/shared/…` | the source of truth |
| `PrataSala` | `shared/` | `./shared/…` | served from branch root |
| `KidlaTest` | `shared/` (tokens only) | `shared/…` | **keeps its own `vendor/fonts/`** — see below |
| `ENG-learning` | `shared/` | `./shared/…` | add to `sw.js` `ASSETS` |
| `Paint` | `public/shared/` | `./shared/…` | Vite copies `public/` to `dist/` root |
| `Memory` | `public/shared/` | `./shared/…` | Vite copies `public/` to `dist/` root |

KidlaTest already vendored these exact woff2 files at `vendor/fonts/` before the
design system existed, and all 18 are listed individually in its service-worker
precache. Moving them would churn that list for no gain, so KidlaTest takes
`kidmindpath-tokens.css` and keeps its own font files.

## Syncing a change

Edit here, bump `VERSION` and the version comment on line 1 of each changed
file, then copy into each app and commit there:

```sh
HUB=path/to/Hifistereo.github.io
APP=path/to/SomeApp                 # use APP/public/shared for Paint and Memory
mkdir -p "$APP/shared"
cp "$HUB"/shared/kidmindpath-*.css "$HUB"/shared/kmp.js "$HUB"/shared/VERSION "$APP/shared/"
cp -r "$HUB"/shared/fonts "$APP/shared/"
```

Then, in that app:

- if it has a service worker, **add any new file to the precache list and bump
  the cache version** — otherwise returning tablets keep serving the old copy
  forever;
- if it is a Vite app, nothing else to do, `public/` is copied verbatim.

To find copies that have fallen behind:

```sh
head -1 */shared/kidmindpath-tokens.css
```

## `kmp.js` — the shared profile

All six sites are on one origin, so they already share one `localStorage`.
`kmp.js` is the agreed vocabulary on top of it: who is playing, how old they
are, and the global sound/motion settings — so a child is named once on the hub
instead of once per game.

**One rule: the hub writes `kmp:*`, games only read it.** The single exception
is `KMP.noteVisit()`, which writes `kmp:lastApp` for the hub's "continue where
you left off". Because the two directions never touch the same keys, there are
no write conflicts, and a game cannot corrupt the profile.

Games keep their own storage exactly as it was. The hub reads those keys
directly to build the collection page and the parent rollup (`js/adapters/`),
which is why adding either required no changes to game logic.

It is a **classic script, not an ES module**, on purpose: KidlaTest transpiles
its JSX with in-browser Babel and PrataSala runs a design-board runtime, and
neither can `import`. One `<script src="./shared/kmp.js"></script>` before the
app's own scripts works in all six.

```js
KMP.activeChild()          // {id, name, ageYears, avatar, guest} — never null
KMP.prefs()                // {sound, reducedMotion}
KMP.key('my-storage-key')  // 'my-storage-key:<childId>' — namespace per child
KMP.migrateKey('my-key')   // one-time move of pre-existing data onto the child
KMP.ageBand('eng')         // one stored age -> this app's own bands, or null
KMP.homeBar({ appId, title, onLeave })
```

### It must degrade to nothing

Every app is *also* reachable at `hifistereo.github.io/<repo>/`, which is a
**different origin with no `kmp:*` at all**, and it has to keep working exactly
as it did before any of this existed. So every read is wrapped, every failure
returns a default, and nothing throws — storage disabled, private mode, quota
full, and hand-mangled JSON are all covered by `tests/kmp.test.js`. If you add
a method, add its hostile case there too.

### The back bar

`KMP.homeBar()` injects `.kmp-bar`, fixed to the top of every screen, one tap
back to the hub. Two obligations on the app:

- **Make room for it.** It publishes its measured height as `--kmp-bar-h` on
  `<html>`; put `padding-top: var(--kmp-bar-h)` (or equivalent) on your root.
  All five games are full-screen layouts that would otherwise run underneath.
  The height is measured rather than hard-coded because the safe-area inset
  changes it on a notched phone.
- **Save the round in `onLeave`.** The bar leaves on a plain tap, so a child
  mid-activity can end a round by hitting it. `onLeave` is the last moment
  before the page goes away — write state there. Do not rely on `pagehide`;
  Safari does not fire it reliably for a link navigation.

## Using the tokens in an app

Repoint the app's existing variables at the shared ones. Keep the app's own
variable names — that way no component CSS has to change:

```css
/* ENG-learning styles/tokens.css */
:root {
  --font: var(--kmp-font-body);
  --c-ink: var(--kmp-ink);
  --c-paper: var(--kmp-paper);
}
```

Link order matters. Fonts and tokens must come **before** the app's own
stylesheet, or the app's rules will resolve `var(--kmp-*)` to nothing:

```html
<link rel="stylesheet" href="./shared/kidmindpath-fonts.css">
<link rel="stylesheet" href="./shared/kidmindpath-tokens.css">
<link rel="stylesheet" href="./shared/kidmindpath-ui.css">   <!-- if used -->
<link rel="stylesheet" href="./styles.css">
```

## The three accent roles

Each app owns one hue in three roles, and they are **not** interchangeable:

- `--kmp-<app>-tint` — card/panel background
- `--kmp-<app>-hue` — decorative only: icon fills, rules, progress bars. **Never text.**
  Paint's gold carries white text at 2.8:1.
- `--kmp-<app>-ink` — text on paper or tint, and button background with white text
- `--kmp-<app>-line` — border on tint

Every `-ink` is ≥ 4.9:1 on both paper and its own tint, and white on every
`-ink` is ≥ 5.4:1. If you add or change an accent, re-check both directions
before committing — a hue that looks fine can fail badly as a text colour.

## Font weights that actually exist

Fredoka 400 / 500 / 600 / 700 and Nunito 400 / 600 / 700 / 700-italic / 800.
Asking for anything else (`font-weight: 850`, a Fredoka italic) gets a browser-
synthesised face that looks subtly wrong and differs between browsers.
