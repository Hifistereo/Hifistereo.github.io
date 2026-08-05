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

`shared/` is the source of truth for how all six sites look: the Fredoka +
Nunito webfonts, the design tokens, and a small set of UI primitives. It is
**copied into** each app rather than linked across sites — see
[`shared/README.md`](shared/README.md) for why, where each app keeps its copy,
and how to sync a change.

## Files

| Path | What it is |
|---|---|
| `index.html` | the hub page |
| `styles.css` | hub-only layout; everything else comes from `shared/` |
| `js/site.js` | one line of JavaScript (the footer year) |
| `privatums.html` | privacy statement |
| `404.html` | branded not-found page |
| `shared/` | the design system, copied into every app |
| `icon.svg`, `icon-*.png`, `apple-touch-icon.png` | app icons |
| `manifest.webmanifest`, `robots.txt`, `sitemap.xml` | site metadata |
| `.nojekyll` | serve files as-is, no Jekyll processing |

## Editing

There is no build step. Edit, commit, push to `main`; GitHub Pages redeploys.

To preview locally, serve the directory over HTTP rather than opening
`index.html` from disk — the root-relative paths (`/shared/…`) only resolve
when there is a server root:

```sh
python3 -m http.server 8000
```

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
- **Only real font weights.** Fredoka 400/500/600/700, Nunito 400/600/700/800.
  Anything else gets a synthesised face that looks wrong.
