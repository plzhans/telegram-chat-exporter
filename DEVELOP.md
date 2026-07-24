# telegram-chat-exporter

[![ChatExporter](https://img.shields.io/badge/Telegram-ChatExporter-26A5E4?logo=telegram&logoColor=white)](https://telegram-exporter.plzhans.com)
[![Release](https://github.com/plzhans/telegram-chat-exporter/actions/workflows/release.yml/badge.svg)](https://github.com/plzhans/telegram-chat-exporter/actions/workflows/release.yml)
[![Deploy Pages](https://github.com/plzhans/telegram-chat-exporter/actions/workflows/deploy.yml/badge.svg)](https://github.com/plzhans/telegram-chat-exporter/actions/workflows/deploy.yml)
[![Release](https://img.shields.io/github/v/release/plzhans/telegram-chat-exporter)](https://github.com/plzhans/telegram-chat-exporter/releases)

[![Issues](https://img.shields.io/github/issues/plzhans/telegram-chat-exporter)](https://github.com/plzhans/telegram-chat-exporter/issues)
[![Last Commit](https://img.shields.io/github/last-commit/plzhans/telegram-chat-exporter)](https://github.com/plzhans/telegram-chat-exporter/commits/main)
[![Downloads](https://img.shields.io/github/downloads/plzhans/telegram-chat-exporter/latest/total)](https://github.com/plzhans/telegram-chat-exporter/releases/latest)
[![Stars](https://img.shields.io/github/stars/plzhans/telegram-chat-exporter)](https://github.com/plzhans/telegram-chat-exporter/stargazers)

A Telegram chat backup tool that runs entirely in the browser. No backend, deployed as a
static site, and it never stores your credentials anywhere.

Live: <https://telegram-exporter.plzhans.com/>

한국어 문서: [DEVELOP.ko.md](DEVELOP.ko.md)

---

## Overview

### What this is

A **web page that downloads your Telegram conversations as a zip file**. There is no server —
just some HTML, JS and CSS, and your browser talks to Telegram directly.

- **Input** — api_id/api_hash, phone number, login code (and 2FA password if you have one)
- **Output** — `telegram-<chat-name>-<date>.zip`
  - `index.html` — a readable document that looks like the conversation itself. Open this first
  - `messages.jsonl` — one message per line. The raw form, for machines to read again
  - `messages.txt` — human-readable, chronological
  - `attachments.jsonl` · `meta.json` — attachment records, chat info and export timestamp
- **Not supported** — downloading the actual attachment files (for now only the *kind* of each
  attachment is recorded)

### Why it exists

Three things were needed at once.

1. **Bots can't do this.** The Telegram Bot API cannot read past message history, and private
   chats are inaccessible to bots entirely. Backing up requires the **MTProto client API**,
   which connects as a human account.

2. **It should work without installing anything.** MTProto tools are usually Python or Node
   scripts, so you have to install a runtime and open a terminal. Running in the browser removes
   that step. It uses exactly what `web.telegram.org` actually does (WebSocket), so no relay
   server is needed either.

3. **Credentials should not be handed to anyone.** If you build this as a "service", the user's
   phone number and login code pass through someone else's server. With no server at all there is
   nowhere for them to pass through — and **the user can verify that themselves in devtools**,
   because the CSP opens `connect-src` only to Telegram's WebSocket. Even if this code were
   malicious, it could not exfiltrate anything. See [Trust model](#trust-model) below for details.

---

## Build

### Build environment

| | Version | Source of truth |
| --- | --- | --- |
| Node | **24.18.0** | `.nvmrc` |
| pnpm | **11.10.0** | `packageManager` in `package.json` |

**pnpm only.** `preinstall` runs `only-allow pnpm`, so installing with npm or yarn is rejected.
There is exactly one lockfile (`pnpm-lock.yaml`), so any other tool resolves different dependency
versions — and the `telegram` package in particular must be **pinned to exactly 2.26.21** to work
in the browser (see "Do not upgrade `telegram`" below).

There are no OS dependencies. Dependencies that need a native build (`bufferutil` and friends)
are all disabled in `pnpm-workspace.yaml` — this bundles for the browser only, so they aren't
needed.

```bash
# Set up Node (if you use nvm)
nvm install && nvm use     # reads .nvmrc

# Set up pnpm (either one)
corepack enable            # use the corepack that ships with Node — version matches automatically
npm install -g pnpm        # global install

# Install dependencies
pnpm install
```

### Environment variables

All of them are **optional**. The app works with none of them set.

```bash
cp .env.example .env.local   # Vite reads this automatically. It is gitignored.
```

| Variable | Unset | Set |
| --- | --- | --- |
| `VITE_TELEGRAM_API_ID` | The first screen offers only "enter my own api_id" | A "start right away" option appears alongside |
| `VITE_TELEGRAM_API_HASH` | Same as above (the two always go together) | Same as above |
| `VITE_GITHUB_REPO_URL` | This repository's URL is the default | Changes the "view source" link in the header |
| `VITE_RELEASE_DOWNLOAD_URL` | Composed from the latest release of the repo above | The landing page's "download" button links to this URL verbatim (for hosting outside GitHub) |
| `VITE_RELEASE_ASSET_FILE_NAME` | `telegram-exporter.zip` | Changes only the asset name used when composing. Unused if you set the URL above |

`VITE_*` values are **baked into the bundle at build time.** They cannot be changed at runtime,
and they are not hidden. Whether to ship a shared api_id is a policy call, written up separately
in [api_id policy](#api_id-policy) below.

There is one more build variable that does not go in `.env.local`. It is used **only when
deploying**.

| Variable | Unset (local) | Set (CI) |
| --- | --- | --- |
| `SITE_ORIGIN` | canonical and hreflang stay relative | completed into absolute URLs |

A local build is never published anywhere, so it has no canonical address. Rather than invent a
default, it is left blank — the domain is a fact the deployer knows, not the source.

### Running the build

```bash
pnpm build
```

That's all. There are no options or environment variables to add.

`tsc -b` type-checks first (**a single type error stops the build**), then `vite build` produces
`dist/`. An existing `dist/` is wiped and regenerated.

The output is static files only, so any web server will serve it. `dist/` is gitignored.

The chunk-size warning during the build is expected. The MTProto library alone is several hundred
KB, so the threshold is raised to 1500KB.

### Deploying under a sub-path

`base` in `vite.config.ts` is `'/'`. **You never need to touch this locally.**

Pass it from the build side only when deploying somewhere the repository name appears in the path
(GitHub Pages and similar).

```bash
pnpm exec vite build --base=/your-path/
```

The path is not written into the source because where it gets deployed is a fact the deployment
config knows, not the code. Forking or moving the repo requires no source changes.

The router reads this value through `import.meta.env.BASE_URL`, so nothing else needs adjusting.

### Standalone build

A build you use by **double-clicking `index.html`**, with no web server. This is what gets
attached to releases as a zip.

```bash
pnpm build:standalone
```

This produces `dist-standalone/`. Unzip the whole folder and open `index.html` and it just works
(`assets/` must stay next to it — the links are relative).

Because the document is opened over `file://`, three things differ from the web build. **None of
this is about inlining everything into one file — it only sidesteps what browsers block on
`file://`.**

| | Web deploy (`pnpm build`) | standalone |
| --- | --- | --- |
| Script | `<script type="module">` | one plain script (`assets/app.js`) |
| Router | path (`/dialogs`) | hash (`#/dialogs`) |
| Language | URL prefix (`/en-us/`) | stored choice, else browser setting |

- **Not a module.** `file://` blocks `<script type="module">` via CORS (both Chrome and Firefox).
  So it is emitted as a single IIFE with `type="module"` and `crossorigin` stripped. The
  `lazy(() => import(...))` calls in the screen code stay as they are and get merged by
  `inlineDynamicImports`.
- **Hash router.** The address is a file path, so there is nothing for the History API to change.
  The web build keeps path routing — search engines don't treat hashes as separate URLs, which
  would break per-language indexing.
- **The language can't live in the URL.** So the choice is stored in `localStorage` and the
  document is reopened (`switchLanguage` in `src/shared/i18n/index.ts`). On first open it follows
  the browser setting.
- **CSP opens up `file:`.** A `file://` document has an opaque origin, so `'self'` points at
  nothing and the page can't even read its own sibling files. **What actually matters,
  `connect-src`, is unchanged** — this build too can connect nowhere but Telegram.
- **Analytics and ads are off even if the values are present.** People who download this and run
  it on their own machine don't get tracking bundled along. That's what makes "download and run it
  yourself and both are off" in [Analytics and ads](#analytics-and-ads) a real statement rather
  than a promise.

---

## Running it

### Dev mode

```bash
pnpm dev     # http://localhost:5175
```

Port 5175 is **fixed** (`strictPort`). If it's already taken it fails instead of quietly moving to
another port — silently relocating makes it hard to tell which project you're looking at. For the
same reason preview is 5176.

`host: true`, so other devices on the same network (your phone, etc.) can connect. Use the Network
address printed in the terminal.

**CSP is not applied in dev mode.** Vite HMR connects over `ws://localhost` and React Fast Refresh
injects inline scripts, so applying the production policy would stop the dev server from starting
at all. That means **CSP changes are not verified in dev** — check them with preview below.

### Running the dist output

Serves the built `dist/` under the same conditions as the real deployment.

```bash
pnpm build
pnpm preview     # http://localhost:5176
```

**If you touched the CSP, verify it here.** The `<meta>` CSP that only ships in the production
build is actually enforced here, so watch the devtools console for violations. To count violations
in code:

```js
// paste into the devtools console, then use the app
addEventListener('securitypolicyviolation', (e) =>
  console.warn('CSP violation:', e.violatedDirective, e.blockedURI),
);
```

You can use a different static server instead of `vite preview`, but two things must match.

- **SPA fallback** — it uses `createBrowserRouter`, so reloading on `/dialogs` must still return
  `index.html`. Otherwise you get a 404.
- **Don't open it over `file://`** — asset paths are absolute, and module scripts are blocked by
  CORS on `file://`. Serve it over HTTP. If you want something you can open as a file, use the
  [standalone build](#standalone-build) instead of this output.

For example, Python's built-in server has no SPA fallback, so don't use it unless you only want to
look at the first screen.

---

## Internationalization

Both the UI and the search metadata are translated. **14 languages** are currently supported.

Translation files: [`src/shared/i18n/locales/`](src/shared/i18n/locales/)

| Code | Language |
| --- | --- |
| [`ko-kr`](src/shared/i18n/locales/ko-kr.json) | Korean (default) |
| [`en-us`](src/shared/i18n/locales/en-us.json) | English |
| [`ja-jp`](src/shared/i18n/locales/ja-jp.json) | Japanese |
| [`hi-in`](src/shared/i18n/locales/hi-in.json) | Hindi |
| [`ru-ru`](src/shared/i18n/locales/ru-ru.json) | Russian |
| [`id-id`](src/shared/i18n/locales/id-id.json) | Indonesian |
| [`pt-br`](src/shared/i18n/locales/pt-br.json) | Portuguese (Brazil) |
| [`ar-eg`](src/shared/i18n/locales/ar-eg.json) | Arabic |
| [`vi-vn`](src/shared/i18n/locales/vi-vn.json) | Vietnamese |
| [`es-mx`](src/shared/i18n/locales/es-mx.json) | Spanish (Mexico) |
| [`uk-ua`](src/shared/i18n/locales/uk-ua.json) | Ukrainian |
| [`tr-tr`](src/shared/i18n/locales/tr-tr.json) | Turkish |
| [`fil-ph`](src/shared/i18n/locales/fil-ph.json) | Filipino |
| [`kk-kz`](src/shared/i18n/locales/kk-kz.json) | Kazakh |

The order of this list is **the order in the language picker**. The first three are the users this
tool serves first; the rest follow Telegram user counts.

**One language is not split per country.** English for India, the Philippines and Nigeria is all
handled by one `en-us`, and Russian for Ukraine and Kazakhstan by `ru-ru`. Putting the same text
at two URLs splits the translations apart and makes the search index cannibalize itself.
Region matching is handled by each locale's `hreflang` through the broader tags (`en` · `ru`).

The language list and prefix rules live in
[`src/shared/i18n/languages.ts`](src/shared/i18n/languages.ts), and initialization is in
[`src/shared/i18n/index.ts`](src/shared/i18n/index.ts).

### The URL decides the language

```
/            Korean  (the default language, so no prefix)
/en-us/      English
/ar-eg/      Arabic
/en-us/dialogs
```

**Only the default language has no prefix.** Serving both `/` and `/ko-kr/` puts the same content
at two URLs and lets the search engine pick which one to show. There is no reason to hand over
that decision.

**The URL wins over the browser setting.** Someone who receives an `/en-us/` link sees English
even if their browser is set to Korean — that's what the person sharing the link intended, and it
has to match what the search engine indexed at that URL.

The prefix goes into the **router's `basename`**, not the route tree (`src/app/App.tsx`). So none
of the `to="/dialogs"` calls in the screen code need changing. In exchange, `basename` is fixed
when the router is created, so **switching languages means changing the URL and reloading.** That
is the right behavior — each language has its own `index.html` carrying that language's
`<html lang>` and search metadata.

**The exception is the [standalone build](#standalone-build).** The address is a file path, so it
can't carry the language; the choice goes into `localStorage` and the document is reopened. On
first open there is no URL to point at, so it follows the browser setting — the only case where
"the URL wins" doesn't hold.

### Language codes include the region

It's `en-us`, not `en`. With just `en` there would be no place to add British English later, and
splitting an already-published `/en/` URL at that point would change indexed URLs and break links
people had saved.

`hreflang` emits several tags per language. Emitting only `en-US` wouldn't match users in the UK
or Australia, so while there is a single English edition it also emits the broader `en`. The day
`en-gb` exists, just drop `en` from `en-us`'s `hreflang` array. In the same way `fil-ph` also
emits the old code `tl` — some Android devices still report that name.

### Adding a language

Only two places to touch.

1. Create `src/shared/i18n/locales/<code>.json`. Copy an existing file and translate it, then fill
   in the `seo` block at the top (`tag` · `ogLocale` · `hreflang` · `title` · `description` ·
   `shareDescription`) in that language.
2. Add one line for the code to `SUPPORTED_LANGUAGES` in `languages.ts`.

The rest is automatic — `import.meta.glob` picks up the translation files, `Intl.DisplayNames`
renders each name **in the language's own script** (`한국어`, `English`), and the build emits one
more `dist/<code>/index.html`. Where you put it in `SUPPORTED_LANGUAGES` is where it appears in
the picker.

Language names are written in their own language because someone who can't read their own
language's name can't find it in the list.

### Right-to-left languages

Adding Arabic (`ar-eg`) made `<html dir>` necessary. `dirOf()` in `languages.ts` decides it from
the language's base part, and the build bakes that value into each language's `index.html`
(`localizedPages`). The app re-applies it at runtime too, since a 404 fallback can serve another
language's shell.

The UI is written with Tailwind's **logical properties**. Instead of `ml-`, `pr-`, `left-`,
`text-left`, `float-right`, it uses `ms-`, `pe-`, `start-`, `text-start`, `float-end` — those flip
themselves based on `dir`. Icons whose direction carries meaning (previous/next, back arrow) get
`rtl:rotate-180`. **Icons whose direction is not meaning, like a play triangle, are not flipped.**

### Real HTML files per language

```
dist/index.html               landing (static)   <html lang="ko-KR">  canonical → /
dist/en-us/index.html         landing (static)   <html lang="en-US">  canonical → /en-us/
dist/start/index.html         app shell
dist/en-us/start/index.html   app shell
dist/404.html                 app shell (SPA fallback)
dist/en-us/404.html           app shell (SPA fallback)
```

This could be papered over with the SPA fallback (`404.html`), but those URLs **respond with 404**
and search engines don't index them. Since indexing is the whole point of per-language URLs, real
files have to exist. The `localizedPages` plugin in `vite.config.ts` creates all six kinds.

Post-login paths (`/en-us/dialogs`) have no real file and are served through the 404 fallback.
They aren't indexing targets anyway, so that's fine — but even then the app fixes the document's
language at runtime so `<html lang>` is never wrong.

### The landing page is static HTML, not React

The only indexed URLs are `/` and `/<lang>/`. Those are **the documents crawlers actually read**,
so an empty `<div id="root">` there won't do. Google does execute JS, but crawling and rendering
are separate queues that can run days apart, and Naver, Daum and GPTBot effectively can't read it
at all.

Weight is the other reason. The app bundle carries the MTProto library, so it's 530KB gzipped —
making someone download that to see one marketing page hurts LCP and INP, both of which feed
directly into ranking.

| | Landing (`/`) | App (`/start/`) |
| --- | --- | --- |
| HTML | 26KB (content included) | 6KB |
| CSS | 28KB | 28KB |
| JS | **0.5KB** (analytics only) | 1.76MB |

`build/landing.ts` deals only in strings. Keeping it as a React component and calling
`renderToStaticMarkup` was an option, but that means getting i18n, the router and zustand to run
under Node — too much baggage for what it buys.

**The copy lives in the locale JSON under `landing`.** Same files, same keys as the app screens.
Languages without that block fall back to **English, not Korean** — a Korean pitch on a Japanese
URL is worse than an English one. Filling the block in is all it takes; no code changes.

The `connect-src` line shown on screen is **extracted from the CSP that was just injected**.
Writing it by hand would drift every time analytics is toggled — and that sentence is precisely
this app's basis for trust.

**You can't see this screen in dev mode.** The static landing is only emitted at build time, and
in dev even the CSS is injected by JS, so a script-less document would have no styling at all.
Check it with `pnpm build && pnpm preview` — the same reason CSP changes need preview.

---

## Analytics and ads

**Both turn on only when the deployment environment variables are present.** A local build doesn't
even include the code.

| Variable | When on |
| --- | --- |
| `VITE_GOOGLE_ANALYTICS_ID` | Google Analytics. Google's collection hosts open up in `connect-src` |
| `VITE_GOOGLE_ADSENSE_ID` | Google AdSense. script, frame, img and connect open up to the ad network |

### What turning them on breaks

This app's basis for trust is that **`connect-src` contains Telegram and nothing else.** It's a
fact anyone can confirm by opening the devtools network tab, and the in-app copy leans on it.

Turning on analytics or ads makes **that sentence no longer true.** A guarantee the browser was
enforcing degrades into a promise that "we won't send anything." So a single value decides three
things at once.

1. The feature is included
2. The CSP opens up accordingly
3. **An external-connection notice appears on the first screen**

Tying all three to one switch means there is no state where it's on but undisclosed.

### What the notice says

`trust.analytics` · `trust.ads` (locale JSON). Only what's actually enabled is shown.

- It names the hosts it connects to
- It separates what is sent (landing visit, language) from what is not (message contents, phone
  number, login code, chat id)
- It states that blocking them still leaves the tool working
- **It tells you to download and run it yourself if you don't want them.** Building it yourself
  turns both off, so this isn't an empty statement

### Chat ids are not sent

The number in `/dialogs/123456789` is a Telegram chat id. Default gtag sends the whole URL, so
leaving it alone would **accumulate which chats you opened in Google.** `send_page_view: false`
disables automatic collection and only the landing path is sent
(`src/shared/analytics/gtag.ts`).

For the same reason **no ads are placed on the login or conversation screens.** Putting someone
else's iframe where a phone number and login code are entered runs directly against the trust this
tool asks for.

### How far the CSP opens — the source documents

The two products have **completely different requirements.** Analytics needs a few domains
opened; AdSense effectively means giving up script-src.

| | Source document | Scope opened |
| --- | --- | --- |
| Analytics | [Google tag CSP guide](https://developers.google.com/tag-platform/security/guides/csp) | 3 domains |
| AdSense | [AdSense content security policy](https://support.google.com/adsense/answer/16283098) | all of `https:` + `unsafe-eval` |

**Analytics** — added exactly as the document specifies. The wildcard only appears to the left of
the host, so regional endpoints like `region1.google-analytics.com` are covered by
`*.google-analytics.com`.

```
script-src  https://*.googletagmanager.com
img-src     https://*.google-analytics.com https://*.googletagmanager.com
connect-src https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com
```

Google's snippet puts configuration code inside a `<script>` tag, which requires
`script-src 'unsafe-inline'` — **that was not granted.** The moment inline is allowed, one XSS
becomes login-code theft. The same work is done by bundled code instead
(`src/shared/analytics/gtag.ts`), covered by `script-src 'self'`, opening only the external script
hosts.

### ⚠️ AdSense is incompatible with this site's CSP

The **only** form the documentation says is supported is nonce-based, and it requires this:

```
script-src 'nonce-{new value per response}' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https:
```

The same document explicitly states that **domain allowlists are not recommended** — the domains
ads use change constantly. And **this site has no server, so it cannot generate a nonce.** Static
files have nobody to vary a value per response.

That leaves opening all of `https:`, which makes script-src effectively nonexistent. Any script
from any https origin executes, and `eval` is open too. On a screen that takes a phone number and
a login code, that price is especially high.

Setting `VITE_GOOGLE_ADSENSE_ID` applies that policy as-is. Nothing is hidden, but before you set
it, consider **moving ads onto a page on a different origin** — ads on a landing page only, with
the tool keeping its current CSP.

### Nothing is sent in dev mode

Even with values in `.env.local`, `pnpm dev` sends nothing (blocked via `import.meta.env.PROD`).
Refreshes during development counting as visits would pollute the stats. To see the same screen as
production, build and check with `pnpm preview`.

---

## Deployment

**GitHub Actions deploys to GitHub Pages.** `.github/workflows/deploy.yml` runs build→deploy on
every push to `main`. Build output is not committed to the repository.

One-time repository setup: **Settings → Pages → Source set to `GitHub Actions`**.

The URL is not written into the workflow. `actions/configure-pages` **reads the real URL from the
Pages settings** and the resulting value is passed to the build. So attaching or removing a custom
domain, forking, or moving the repository requires no changes.

| Value passed | With a custom domain | On `github.io` |
| --- | --- | --- |
| `--base` | `/` | `/<repo-name>/` |
| `SITE_ORIGIN` | `https://<custom domain>` | `https://<owner>.github.io` |

CI also fills `VITE_GITHUB_REPO_URL` with its own repository URL — it has to point at where the same
commit as the deployment lives.

**This repository uses a custom domain.** So the real deployment goes out without `--base` (at the
root) and canonical points at `https://telegram-exporter.plzhans.com/`.

**The SPA fallback (`404.html`) is produced by the build, not the workflow.** Pages has no rewrite
rules, so reloading `/dialogs` hits a nonexistent file and Pages serves `404.html`. As long as
that file is the app shell, the router reads the path and renders normally. (The response code
stays 404, but the screen is correct.)

This step used to be `cp dist/index.html dist/404.html` here in the workflow. That no longer
works: `index.html` is now the **script-less static landing**, so copying it produces a fallback
where the app never boots. Which document is the shell is a fact only the build knows, so
`localizedPages` emits it.

**Each language directory gets its own `404.html` too.** Making do with the root one alone would
show the Korean shell on an `/en-us/dialogs` reload, silently resetting the language.

If you're going to use a shared api_id, put `VITE_TELEGRAM_API_ID` / `VITE_TELEGRAM_API_HASH` in
**Settings → Secrets and variables → Actions → Variables**. Variables rather than Secrets, because
the value ends up in the client bundle verbatim anyway, so hiding it is meaningless — see
[Running a shared key: no obfuscation](#running-a-shared-key-no-obfuscation) below.

### ⚠️ GitHub Pages cannot set CSP as a header

This app's basis for trust is the CSP, but **Pages does not support custom response headers.** So
only the `<meta>` CSP in `index.html` applies, with these differences:

- `frame-ancestors` **does not work** (it is not a directive supported in meta tags). That means
  another site can wrap this page in an iframe.
- A meta CSP applies **after HTML parsing has begun.** It takes effect later than a header would.
- Other security headers such as `X-Content-Type-Options` and `Referrer-Policy` are missing too.

The critical part, `connect-src` (= nothing can be sent anywhere but Telegram), is still enforced
through meta, so the most important promise holds. Still, **if you need real headers, use
Cloudflare Pages** — the policy is already in `public/_headers`, and `public/_redirects` handles
the SPA fallback. Both files are simply ignored on GitHub Pages (they're included in the build
output but have no effect).

Cloudflare deploys at the root, so plain `pnpm build` without `--base` is enough.

### Releases — the downloadable build

`.github/workflows/release.yml` reacts to **`release/v*` tags**. When a tag is pushed it runs the
[standalone build](#standalone-build), zips it, and creates a release under that name with the zip
attached.

```bash
# Bump the version, commit, and tag in one step.
pnpm release minor          # patch · minor · major, or an exact value like 1.0.0
git push --follow-tags
```

`pnpm release` is just `pnpm version` with `--tag-version-prefix=release/v` attached. It edits
`package.json`, makes a commit containing only that version, and adds a `release/v1.0.0` tag — all
three always move together, so you can't push a version that's out of sync. (Putting the prefix in
`.npmrc` as `tag-version-prefix` doesn't work, because **pnpm doesn't read it.** Hence the script.)

The tag is annotated, so `--follow-tags` pushes it along with the commit. If the working tree is
dirty, `pnpm version` stops first.

**If the tag and the version in `package.json` disagree, the workflow stops.** The version printed
at the bottom of the screen and in exported documents comes from `package.json` — pushing only the
tag would ship a file saying `v0.1.0` under the name `v1.0.0`, and the recipient would have no way
to know which to believe.

Inside the zip is a single `telegram-exporter-v1.0.0/` folder. Unzipping gives you `index.html`,
`assets/`, and a `README.txt` (`.github/release-assets/`) describing how to run it and what goes
where.

**Analytics and ads are not passed into this path at all.** The standalone build would ignore them
anyway, but they're also left out of the workflow so both places say the same thing. The shared
api_id (Variables) goes in under the same rules as the web deployment — the recipient should be
able to enter a phone number and start immediately.

---

## Design background

Everything below is a record of "why it was built this way." You don't need to read it just to use
the tool.

## How it works without a server

It uses the Telegram **MTProto client API, not the Bot API**. Bots cannot read past message
history (and cannot access private chats at all), so they're useless for backup.

Running MTProto in the browser is exactly what `web.telegram.org` does — it connects over
WebSocket (`wss://*.web.telegram.org/apiws`). WebSockets are not subject to CORS policy, so no
relay server is needed.

## Why GramJS (`telegram`)

The `telegram` package is archived and a fork called `teleproto` is maintained instead. GramJS is
still used here — because **teleproto is a Node-oriented fork that stripped browser support out.**

| | `telegram` (GramJS) | `teleproto` |
| --- | --- | --- |
| Browser detection | `isBrowser` in `platform.ts` | none |
| Crypto | `crypto.subtle` (WebCrypto) | Node `crypto` only |
| Default transport | WSS in the browser | `PromisedNetSockets` (raw TCP) |
| Browser bundle | 783KB (gzip 234KB) | 2.6MB (gzip 455KB) |

Moving to teleproto would mean swapping the transport layer by hand and accepting pure-JS crypto
(2FA's PBKDF2-SHA512 gets especially slow). So it stays on GramJS and carries the archived risk.

### ⚠️ Do not upgrade `telegram` — pinned to `2.26.21`

GramJS **ships a Node build and a browser build under the same package.**

| dist-tag | Version | What `CryptoFile.js` points at |
| --- | --- | --- |
| `latest` | 2.26.22 | `require("crypto")` — Node only |
| `browser` | **2.26.21** | `require("./crypto/crypto")` — WebCrypto |

Using `latest` in the browser dies during auth key exchange with
`a.default.randomBytes is not a function`. The browser build replaces not only `CryptoFile` but
also `fs`, `os`, `path`, `net` and `socks` with its own shims, and uses pako instead of zlib.

So `package.json` pins **exactly `"telegram": "2.26.21"`** with no caret. Adding `^` or running
`pnpm update` moves it to 2.26.22 (the Node build) and the same bug comes back.

Thanks to this pin, there's no need to shim Node modules manually on the Vite side, and the only
remaining node polyfill is `buffer`.

## Trust model

From the user's point of view, this site is "a web page I've never seen before asking for my phone
number and login code." Telegram itself writes "don't share this with anyone" in the code message,
so suspicion is the correct reaction. This project is designed above all to give that suspicion a
**verifiable answer**.

1. **The browser enforces it via CSP.** `connect-src` is open only to Telegram's WebSocket, so
   even if this code were malicious it could not send your phone number, login code or message
   contents to another server. Anyone can confirm it in devtools → Network.

   ```
   default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline';
   img-src 'self' data: blob:; font-src 'self';
   connect-src wss://*.web.telegram.org wss://*.web.telegram.org:443;
   form-action 'none'; base-uri 'none'; frame-ancestors 'none'
   ```

2. **No external resources by default.** No CDNs, no web fonts. Every one added loosens the CSP
   above and breaks the promise. (That's why this project alone drops the Google Fonts that
   medifinder-web uses and sticks to system fonts.)

   **The exception is analytics and ads.** Both turn on only through deployment environment
   variables, and the CSP opens accordingly when they do — see
   [Analytics and ads](#analytics-and-ads) above. Building it yourself turns both off.

3. **There is no `eval` in the bundle.** The node polyfills were narrowed to just `buffer` so that
   `script-src 'self'` needs no `unsafe-eval`. Polyfilling `crypto` drags crypto-browserify in,
   which pulls asn1.js → `vm` → `eval` and trips the CSP. The browser build uses WebCrypto, so it
   isn't needed in the first place.

4. **Sessions do not go in localStorage.** With "stay signed in on this tab" enabled, the session
   string goes into **sessionStorage** only. The browser clears it when the tab closes, so a
   refresh survives but it doesn't linger for days. With it off, the session lives in memory only
   and you sign in again after a refresh.

   sessionStorage was chosen because the difference from localStorage is **lifetime**. The session
   string is the auth key itself; putting it in storage that persists until explicitly cleared
   hands the account over on a shared PC or a shared browser profile.

   Stored sessions carry an **idle expiry (60 minutes by default)**. While the tab is alive the
   expiry is pushed forward every minute (and when the tab becomes visible again), so you don't get
   cut off mid-task, but stepping away expires it. sessionStorage alone offers no protection at all
   for **leaving with the tab open**, which is why this exists.

   **It does not, however, promise that closing the browser definitely clears it.** Chrome and
   Firefox session restore ("continue where you left off", recovery after a crash) brings
   sessionStorage back, and duplicating a tab copies its contents. The TTL only blocks the cases
   where **time has passed** — an immediate restore after a crash, or a duplicated tab, still gets
   through. It narrows the exposure window; it doesn't eliminate it. The only sure way is to log
   out (which terminates the session on the account too).

5. **The session is identifiable.** It shows up in Telegram's active sessions list as
   `Telegram Exporter (browser)`, so users know which session to terminate after backing up. The
   in-app "log out and terminate session" button calls `auth.LogOut`, removing this session from
   the account.

Even with all of this, some users will still be suspicious. That's an unavoidable limit, and the
in-app copy doesn't hide it.

## api_id policy

**Both** a shared key and user-entered keys are supported.

- If `VITE_TELEGRAM_API_ID` / `VITE_TELEGRAM_API_HASH` are set, a "start right away" option
  appears. The user only has to enter a phone number.
- If they aren't set, only the screen for entering a key issued at my.telegram.org appears.
- Even with a shared key present, the "enter my own api_id" path is always available.

Going shared-key-only is avoided because it's a **single point of failure**. A publicly known
api_id is easy to reuse for spam, and if Telegram revokes it (`API_ID_PUBLISHED_FLOOD`) every user
is blocked at once. When that error appears, the in-app copy steers you to entering your own.

A user-entered api_id is kept in localStorage. It's only an app identifier, not account access, so
its policy differs from the session's.

### Running a shared key: no obfuscation

Someone might suggest hiding the shared api_id inside the bundle with base64 or similar. **It
doesn't work.**

GramJS sends `InvokeWithLayer(InitConnection({ apiId, deviceModel, ... }))` on every connection
(`client/telegramBaseClient.js`). In other words, Telegram doesn't need to crawl the source — it
sees "this api_id is being used by N different accounts across M IPs" **right in its own server
logs.** What triggers `API_ID_PUBLISHED_FLOOD` is that usage pattern, not source exposure.

On top of that, we send `deviceModel: "Telegram Exporter (browser)"` in the same request. That's a
deliberate choice so users can recognize this tool in their active sessions list, and it means
Telegram can already identify this tool from a single line. Broadcasting the app name to the server
while hiding a number in the bundle doesn't add up.

Above all, obfuscation **fails to fool the side you'd want to fool (Telegram) and only loses the
side you need to persuade (users).** Nobody who finds an obfuscated constant on a page asking for
their phone number has any reason to trust that site. As long as this project's basis for trust is
verifiability, that's a pure loss.

What is actually done:

1. **Keys are not committed.** `.env.local` is gitignored, and deployments inject keys only as
   build environment variables (GitHub Actions Variables, Cloudflare Pages environment variables).
   They remain in the bundle, but the source distribution path is closed. Unlike obfuscation, this
   is a real defense.
2. **The shared key is treated as a consumable.** If it gets revoked, change the environment
   variable and redeploy. The "enter my own api_id" fallback is always open, so the service never
   stops.
3. **Usage is the risk.** Since the blocking signal is the usage pattern, if traffic grows, dropping
   the shared key and leaving only self-issued keys is on the table.

## Stack

Matched to medifinder-web.

pnpm · Vite 6 · React 19 · TypeScript (strict) · Tailwind 3 · zustand · TanStack Query ·
react-router-dom 7 · react-hook-form · zod · i18next · lucide-react

The structure is the same FSD-lite.

```
src/
  app/          router, layout
  features/
    auth/       api_id entry → phone → code → 2FA
    dialogs/    chat list, conversation view
    export/     date-range export, zip writing, HTML document generation
  shared/
    auth/       zustand auth store (wires GramJS callbacks ↔ form submissions)
    telegram/   client lifecycle, api_id resolution, error normalization
    ui/ lib/ i18n/ config/
```

There are only two differences from medifinder, each with the reason written in the file's
comments.

- No web fonts (CSP)
- i18n uses URL prefixes, but **only for non-default languages** — see
  [Internationalization](#internationalization) above

## Current state

What works:

- api_id entry (shared / own, both ways)
- api_id issuance guide plus a troubleshooting list for when only `ERROR` shows up (built into the
  app itself)
- Phone number → login code → 2FA password sign-in
- Re-entry without navigating away on a wrong code or wrong number, and "use a different number"
  to rewind
- FLOOD_WAIT remaining time display
- Chat list (up to 200) with name search and profile photos
- **Conversation view** (`/dialogs/:id`) — jump to a date via calendar, load more in both
  directions (older/newer)
- **Export** (`/dialogs/:id/export`) — date-range zip, with progress display and cancellation
- **A readable HTML document** (`index.html`) — looks like the conversation itself. Self-contained
  in one file, with no scripts
- Korean and English (split by URL prefix)
- The same version string at the bottom of the screen and in exported documents
  (`v0.1.0 · commit hash · build date`)
- Session deletion from the Telegram account on logout

### Why viewing and exporting are separate

When they were on one screen, "period" meant two things — the point you want to look at, and the
range you want to download. In practice the former is **a single point** (jump to that day) and
the latter is **an interval**. Mixed together, it was unclear which one you were manipulating. So
the pages were split: viewing handles only date jumps, exporting handles only intervals.

**The calendar only marks days that have messages.**
`messages.GetSearchResultsCalendar` returns per-period buckets in one call (`periods[]`: date,
count, message id range). There's no need to query each date. Days with no messages aren't
clickable — being able to pick a date that only yields a blank screen reads as "the jump is
broken." Some chats reject this API, in which case the markers are simply omitted and date jumping
still works.

**Jumping to a date lands you in the middle of the conversation.** So message fetching became a
bidirectional infinite query (`fetchPreviousPage` = older, `fetchNextPage` = newer). The direction
names match render order (older at the top), so a single `pages.flatMap(p => p.messages)` yields a
chronological list.

Jumps use **the date (`offsetDate`) rather than a message id.** With ids, boundary inclusion is
ambiguous and it's easy to drop the first message of that day.

### Profile photos — fetched in two stages

**Stage 1 (free):** entities in chat list and message responses come with `strippedThumb`. It's a
few-hundred-byte micro JPEG, restored with GramJS's `strippedPhotoToJpg` and used directly. No
extra requests. The original is only tens of pixels though, so **it's blurry when enlarged.**

**Stage 2 (costs a request):** `downloadProfilePhoto(peer, { isBig: false })` fetches a sharp
version. This is **one request per chat**, so firing 200 at once walks straight into FLOOD_WAIT.
So an IntersectionObserver fetches **only what's on screen**, and even then at most 3 concurrently
(`lib/profilePhoto.ts`). On failure, `null` is frozen into the cache to prevent retries —
otherwise every scroll fires the same failing requests again.

Stage 2 is disabled in the message list. The same person repeats hundreds of times, so it isn't
worth the requests.

No blur filter is applied. The low-resolution original is smooth enough on its own, and adding
blur on top just makes it an out-of-focus photo.

### Export output

```
telegram-<chat-name>-<date>.zip
├── index.html         what you open first after unzipping. Reads like the conversation itself
├── messages.jsonl     one message per line. The raw form, for machines to read again
├── messages.txt       human-readable. Chronological, oldest first
├── attachments.jsonl  attachment kinds and sizes
└── meta.json          chat info, message count, export timestamp
```

`index.html` is **self-contained in one file.** All styles are inlined, so it opens without an
internet connection and without this tool. It has no scripts, so it shows the same thing every
time you open it — a document you present as evidence leaves room for "well, that's what it
rendered that time" if there's code in it.

Compression uses **fflate's synchronous streaming API** (`Zip` + `ZipDeflate`). JSZip and fflate's
async API spin up a Web Worker from a blob URL, which would require opening `worker-src blob:` in
the CSP, so they weren't used. The synchronous API holds the main thread, so control is yielded
back to the event loop every 200 messages to keep the progress display and the cancel button
alive.

### Handling long histories

Exporting an old chat in its entirety breaks in three places. Each is handled:

**1. Tell the user the scale before starting.** Two requests give "how many total, and from when
to when" (`useChatStatsQuery`).
- Total count: `TotalList.total` from a `getMessages(limit: 1)` response
- Oldest message: with `reverse: true`, GramJS reads from the very beginning at `offsetId = 1`

**2. The range can be fetched in chunks.** Pick a start and end date and `offsetDate` sets the
starting point; the end is enforced on our side by watching the dates of chronologically arriving
messages (the API has no end-boundary parameter).

The default is **the last 30 days**. Making the full range the default would start a multi-hour job
on a single click. If you arrived from the conversation view with a date selected (`?date=`), it
uses 30 days from that day — the user already marked that point as the one they care about.

**3. It doesn't die on FLOOD_WAIT.** `floodSleepThreshold` is normally 60 seconds, but at that
value GramJS throws instead of sleeping through the several-hundred-second limits Telegram applies
when sweeping long histories — an hour-long job wiped out by a 90-second wait. It's raised to 15
minutes for the duration of the export and restored afterward.

**4. It doesn't accumulate everything in memory.** If the File System Access API
(`showSaveFilePicker`) is available, compressed chunks are **streamed straight to disk.** If not
(Firefox, Safari), it collects them and downloads a Blob as before, and says so on screen. The
picker requires a user gesture, so it's called **first thing in the click handler** — calling it
after the export has started means the gesture is spent and it gets rejected.

**5. The "looks stuck" problem.** During a FLOOD_WAIT wait, GramJS sleeps silently so the numbers
don't move. If there's no progress for over 8 seconds, "waiting on a rate limit, not stuck" is
shown. Without this, users mistake correct behavior for a failure and close the tab.

Messages are swept **oldest first** with `reverse: true`. Telegram's default is newest first, which
would stack the file in reverse order and make it unreadable — and collecting it in memory to
reverse it defeats the point of streaming. Requests are spaced by `waitTime: 1` (one second) —
without it, large chats hit FLOOD_WAIT almost immediately.

That `a[download]` + blob URL downloads aren't blocked under `default-src 'none'` was verified by
serving the production build with `vite preview` and catching `securitypolicyviolation` events
(zero violations). Downloads are not subject to CSP's fetch directives.

Not there yet:

- **Media downloads** — assembling `upload.getFile` chunks. Only the *kind* of each attachment is
  recorded for now
- **Streaming writes for large exports** — the whole zip is currently built as a Blob and
  downloaded in one go. Very large chats need the File System Access API
  (`showSaveFilePicker`) to stream to disk. It's Chrome/Edge only, so Firefox and Safari fall back
  to the current approach
- **Resume from interruption** — persisting `offset_id` to IndexedDB would allow resuming after a
  disconnect
- **QR login** — GramJS's `signInUserWithQrCode`. The user scans with the Telegram app on their
  phone, so **the login code never has to be typed into this site.** It's the single biggest
  reduction of the trust problem above, so it's high priority

## Not yet verified

The build, type check and headless rendering have been confirmed. **Signing in with a real
Telegram account and fetching a chat list has not been run yet** — it needs a real api_id and phone
number. Verify it yourself with `pnpm dev`.
