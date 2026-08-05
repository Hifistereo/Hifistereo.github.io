# KidMindPath shared design system

The single source of truth for how every KidMindPath site looks. This directory
lives in `Hifistereo/Hifistereo.github.io` and is **copied into** each app repo.

## Why copied, not linked

It would be tidier for each app to load `https://www.kidmindpath.com/shared/kidmindpath-tokens.css`.
Don't. Three of the five apps (KidlaTest, ENG-learning, Paint) are offline-first
PWAs with explicit service-worker precache lists — a stylesheet fetched from
outside their own scope breaks offline boot, blocks first paint on a network
round-trip, and widens every app's Content-Security-Policy for no benefit.

So each app carries its own copy, and every file is stamped with a version on
line 1 so drift is visible at a glance.

## Files

| File | What it is | Who needs it |
|---|---|---|
| `kidmindpath-fonts.css` | `@font-face` for Fredoka + Nunito | everyone |
| `fonts/*.woff2` | 18 files, 508 KB, latin + latin-ext | everyone |
| `kidmindpath-tokens.css` | custom properties only — inert until referenced | everyone |
| `kidmindpath-ui.css` | `.kmp-home`, `.kmp-btn`, `.kmp-card`, shared focus ring | apps using the components |
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
cp "$HUB"/shared/kidmindpath-*.css "$APP/shared/"
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
