# kidmindpath.com

The KidMindPath hub — a static index page that links to five educational
children's apps, all served from the same domain.

Published with GitHub Pages from this repository (`Hifistereo/Hifistereo.github.io`),
with `CNAME` pointing the site at `www.kidmindpath.com`.

## Layout

```
kidmindpath.com/               this repo
kidmindpath.com/PrataSala/     Hifistereo/PrataSala
kidmindpath.com/Paint/         Hifistereo/Paint
kidmindpath.com/KidlaTest/     Hifistereo/KidlaTest
kidmindpath.com/ENG-learning/  Hifistereo/ENG-learning
kidmindpath.com/Memory/        Hifistereo/Memory
```

Each app is its own repository published as a GitHub Pages *project* site.
Project sites inherit the user site's custom domain automatically, which is why
they appear as subpaths of `kidmindpath.com` without any routing configuration.
The path is the repository name and it is **case-sensitive**.

## `shared/` — the design system

`shared/` is the source of truth for how all six sites look: the Quicksand +
Nunito webfonts, the design tokens, and a small set of UI primitives. It is
**copied into** each app rather than linked across sites — see
[`shared/README.md`](shared/README.md) for why, where each app keeps its copy,
and how to sync a change.

## Pages

| Path | What it is |
|---|---|
| `index.html` | the hub — hero, the five game cards, "who is playing" |
| `kolekcija.html` | everything a child has collected across all five games |
| `vecakiem.html` | the parent page: article, then a gated cross-game dashboard |
| `palidziba.html` | FAQ for Latvian text-to-speech pronunciation |
| `kluda.html` | bug report form (builds a `mailto:`; there is no backend) |
| `privatums.html` | privacy statement |
| `404.html` | branded not-found page |

## Scripts

Every page loads `js/site.js`. Pages that read the shared profile also load
`shared/kmp.js` first, then their own module.

| Path | What it is |
|---|---|
| `js/site.js` | footer year, and mirrors the reduced-motion pref onto `<html>` |
| `js/dom.js` | `el()` and `clear()` — the only two DOM helpers, shared |
| `js/games.js` | the five games: paths, titles, accents, age ranges |
| `js/catalogues.js` | **generated** — what each game's collectibles are |
| `js/adapters.js` | reads each game's own storage into one shape |
| `js/hub.js` | index.html: who is playing, and age-fitting the cards |
| `js/kolekcija.js` | kolekcija.html |
| `js/vecakiem.js` | vecakiem.html: the arithmetic gate and the dashboard |
| `js/kluda.js` | kluda.html |
| `js/game-launcher.js` | opens a game in a same-page fullscreen overlay |

## Everything else

| Path | What it is |
|---|---|
| `styles.css` | hub-only layout; everything else comes from `shared/` |
| `img/` | the hub's character illustrations (see below) |
| `shared/` | the design system, copied into every app |
| `tests/` | `node --test`, no dependencies |
| `scripts/extract-catalogues.mjs` | regenerates `js/catalogues.js` |
| `.github/workflows/indexnow.yml` | pings IndexNow when a page changes |
| `icon.svg`, `icon-*.png`, `apple-touch-icon.png` | app icons |
| `manifest.webmanifest`, `robots.txt`, `sitemap.xml`, `llms.txt` | site metadata |
| `.nojekyll` | serve files as-is, no Jekyll processing |

## `img/` — the hub illustrations

The ten characters on the home page. They came out of a Claude Design canvas as
1254x1254 PNGs totalling 13 MB; what is committed here is the same art trimmed
to its bounding box, resized to roughly twice its display height, and encoded as
WebP — 408 KB for all ten. The PNG originals are deliberately not in the repo.

They are decorative in the strict sense: every one carries `alt=""`, and the
blocks that hold them are hidden from assistive technology. Nothing on the page
depends on a child being able to see them.

`hero-child.webp` is the only one above the fold. It is the LCP element, so it
is eager and `fetchpriority="high"`; every other image is `loading="lazy"`.

## Editing

There is no build step and no dependency. Edit, commit, push to `main`;
GitHub Pages redeploys.

## Testing

```sh
npm test          # node --test, no install needed
```

The suite covers the two files where a mistake is invisible until it reaches a
child: `shared/kmp.js` (the profile store, which must never throw — storage
disabled, private mode, quota full, hand-mangled JSON) and `js/adapters.js`
(which knows five other repositories' storage shapes, pinned against fixtures
captured from the real apps). If you add a method to either, add its hostile
case too.

The page behaviour on top of those — rendering, focus, the game overlay — has
no automated coverage; testing it would mean adding jsdom, the first dependency
this repo would carry. Check those by hand:

```sh
python3 -m http.server 8000
```

Serve over HTTP rather than opening `index.html` from disk — the root-relative
paths (`/shared/…`) only resolve when there is a server root.

## Regenerating the catalogues

`js/catalogues.js` is generated, not hand-written. It is what a child *could*
collect, which is what lets the collection page show locked items rather than
just a receipt for what you already have. Re-run it whenever a game adds or
changes collectibles — it needs the game repos checked out as siblings:

```sh
node scripts/extract-catalogues.mjs --repos /path/to/checkouts
```

## Deploying

Pushing to `main` is the deploy — GitHub Pages serves the repository as-is.

A push that touches an `.html` file or `sitemap.xml` also runs
`.github/workflows/indexnow.yml`, which notifies IndexNow (Bing, Yandex, and
other participating search engines) about the changed page URLs. The key file
at the repo root (`1342b2628f07868a2645d226e9c8aec2.txt`) proves domain
ownership to IndexNow — it's meant to be public, not a secret.

A new page needs three edits to be found: `sitemap.xml`, the nav in the other
pages' headers, and `llms.txt`.

## Conventions worth keeping

- **No inline `<style>` blocks or `style` attributes, and no inline `<script>`.**
  The pages run a strict Content-Security-Policy (`script-src 'self'; style-src 'self'`)
  with no `unsafe-inline`. Adding an inline style or script silently breaks it.
- **No third-party requests.** No CDN fonts, no analytics, no embeds. The CSP
  says `default-src 'self'` and the privacy page promises it in writing.
- **Don't add `frame-ancestors` to the meta CSP.** Browsers ignore it when the
  policy arrives in a `<meta>` element and log an error on every page load. It
  needs a real response header, which GitHub Pages does not let us set — so
  clickjacking protection is simply not available here. On pages with no forms,
  no login and no stored session, that costs nothing. The same goes for
  `report-uri` and `sandbox`.
- **Only real font weights.** Quicksand 400/500/600/700, Nunito 400/600/700/800.
  Anything else gets a synthesised face that looks wrong.
- **`shared/kmp.js` is a contract, not just a file.** It is vendored into all
  five game repos, so a change here means bumping `shared/VERSION` and
  re-syncing every one of them. Hub-only behaviour belongs in `js/`, not in it.
- **Reduced motion has two triggers.** The OS setting, and the site's own
  "Mazāk kustību" toggle, which `js/site.js` mirrors onto `<html>` as
  `data-kmp-motion="reduced"`. Both halves live together at the foot of
  `styles.css`; a new animation needs to answer to both. Both switch animations
  off with `animation: none !important` — the `!important` is load-bearing,
  because `*` has zero specificity and would otherwise lose to any class that
  names an animation.
- **The home page is the only page with rounded corners.** It sets
  `<body class="home">`, and `styles.css` redefines the `--kmp-r-*` tokens on
  that selector. `shared/kidmindpath-tokens.css` stays at radius 0 for every
  page here and for the five vendored copies, so rounding the hub costs no
  re-sync. Anything that must look the same on every page — the header's
  `.nav-cta` pill, for one — needs a literal radius rather than a token.
- **`overflow-x` on `<body>` is `clip`, not `hidden`.** `hidden` turns `<body>`
  into a scroll container, which silently stops the sticky header from
  sticking. `clip` trims the illustrations that bleed past the edges without
  that side effect.
