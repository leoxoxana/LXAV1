# LXAV1 — MASTER INDEX (v2, complete)

**MASTER INDEX BASELINE** — see §33. Observed 2026-10-04 on git `ca2e4ab` (origin/main, after the cleanup). Documentation only; no runtime file was changed to produce it.
Section numbers follow the numbering of the original request (§0–§37) so every requested item has an address.
Status words: **VERIFIED** = read in code at the baseline commit. **NOT VERIFIED** = stated by older notes, author estimate, or not reachable from the cloud session.
Language of this file: English (same as the other ClauBack notes). Keep it ≤ ~75 KB; it is a map, not a copy of code or history.

---
## 0. AUTHORITATIVE PATHS
| Role | Path | Note |
|---|---|---|
| Runtime / deployable source of truth | `C:\Users\leon4\Desktop\LXAV1` (GitHub `leoxoxana/LXAV1`, branch `main`) | The user deploys by hand: `vercel --prod` from this folder (uploads the LOCAL folder, not GitHub) |
| Knowledge workspace | `C:\Users\leon4\Desktop\ClauBack\LXAV1` (this file lives in `CONTEXT\`) | Mirrored for cloud sessions on GitHub branch `claubak-docs` under `claubak-copy/` |
| Legacy, never LXAV1 truth | `C:\Users\leon4\Desktop\ClauBack` (parent: Drollyv3 + others) | Old Drolly material must never override LXAV1; read only on explicit request |

Source priority: (1) executable LXAV1 code, (2) deployed configuration, (3) docs that match the code, (4) ClauBack\LXAV1 memory, (5) history, (6) legacy. Conflicts are recorded in §20 as `CONFLICT / NEEDS RESOLUTION`.

## 29. NAVIGATION TREE (start here)
```
LXAV1
├─ AUTH / SESSION  → §14  functions/lxa-account.js (sessions, cookie) · renderer.js lxaRestoreSession/lxaRequest
├─ ACCOUNT         → §10.3
├─ GAME (spin/bet/payout) → §10.4  game-engine.js · renderer.js · spin-button.js · lxa-account.js `spin`
├─ ADMIN           → §10.8  renderer.js admin views · lxa-account.js admin-* actions
├─ LEADERBOARD     → §10.9
├─ FIREBASE        → §15  functions/firebase-storage.js (only DB access) · database.rules.json
├─ VERCEL/BACKEND  → §16  vercel.json · middleware.js · api/*.js · .vercelignore
├─ RADIO           → §17  radio.js · admin-radio.js · functions/radio*.js · api/radio.js
├─ UI / CSS / MOBILE → §10.2  style.css → layout-fix.css (5.9k lines) → responsive-compact.css · header-fit.js
├─ PWA             → §10.10  manifest.webmanifest · sw.js · sw-register.js
├─ CONFIG / ENV    → §21
├─ TESTS           → §23
├─ DOCS / MEMORY   → §24  ClauBack\LXAV1\CONTEXT
└─ WHERE TO LOOK   → §11  (task → minimum file set)
```

---
## A. PROJECT IDENTITY
- **Name**: LXAV1 = LEONXOXANA reskin of Drollyv3. Virtual credits only, no real money. package `lxa-virtual-reels` 2.0.0, Node >= 18.
- **Source of truth path**: §0. **Deploy model**: Vercel (project `lxa3/lxa`; domains `lxoxa.vercel.app` primary, `lxav1.vercel.app`, `lxa-lxa3.vercel.app` — domains from older notes, NOT VERIFIED here). Static root served as-is (`outputDirectory "."`, no build); serverless functions in `api/`, region `fra1`; Edge middleware. Whether Vercel is also connected to GitHub (preview deploys) is NOT VERIFIED; the owner says he deploys manually.
- **Frontend**: hand-written HTML + classic global scripts + 3 stylesheets. No framework, no bundler, no ES modules. Languages de (default) / ro / en.
- **Backend**: two Vercel functions that adapt `(req,res)` to a Netlify-style `handler(event)` in `functions/` (historical; **Netlify is not used**).
- **Database**: Firebase Realtime Database via `firebase-admin`, server side only. Client has no Firebase SDK.
- **Authentication**: custom — id-or-name + password ("safeWord", peppered hash), per-device session token (sha256 stored) + httpOnly cookie. Firebase Auth is not used.
- **External services**: Radio Browser API mirrors (`de1/nl1/at1.api.radio-browser.info`); arbitrary radio stream hosts (probed server-side, played by the phone); Ko-fi (static gifs + link).
- **Architecture type**: static client + thin serverless API + managed realtime DB; server is authoritative for logged-in players, the browser is authoritative for guests.
- **Constraints**: CSP `script-src 'self'` (no inline scripts); no build step; the root is public unless `middleware.js` blocks a path; only the owner deploys; every visible text in 3 languages; do not rewrite UTF-8 files with PowerShell 5 (`>`, `Get-Content/Set-Content` corrupt encoding — happened to this very index once).
- **Environment assumptions**: owner works on Windows + headless Edge; cloud sessions cannot run the browser checks nor `vercel`; secrets only in Vercel env, never in the repo.

---
## B. DIRECTORY MAP (baseline `ca2e4ab`)
| Path | Purpose | Class | Runtime-critical | Normally excluded from audits |
|---|---|---|---|---|
| `/` (repo root) | client code, tests, config — flat | runtime + source + tests | yes | no |
| `api/` | Vercel function adapters (2 files) | runtime | yes | no |
| `functions/` | server logic (8 files, ~170 KB) | runtime, security-sensitive | yes | `radio*.js` excluded unless radio task |
| `assets/` | fonts (8), icons (6 + favicons/apple), letters (6), wild art (2), header webp, Ko-fi gifs (2), `silence.mp3` — 26 files | runtime assets (binary) | yes | **yes** |
| `.git` | history | generated | — | yes |
Not in `main` any more: `docs-context/`, `scripts/`, 13 unreferenced images (removed 2026-10-04, `ca2e4ab`).
Outside the repo (not reachable from cloud): `ClauBack\LXAV1\` (§24), local branch `radio-restructure-wip` (unfinished radio folder move; NOT in the baseline).

---
## 8. COMPLETE FILE MAP
Columns: size · role · depends on · consumed by · risk (H/M/L) · read-for-unrelated-task?
### 8.1 Client
| File | Size | Role / entry | Depends on | Consumed by | Risk | Unrelated tasks |
|---|---|---|---|---|---|---|
| `index.html` | 14 KB/38 l | markup, script/CSS order, radio bar skeleton, `?v=` cache-bust numbers | all client files | browser | M | read only for structure |
| `style.css` | 42 KB | base styles + `--lxa-*` tokens | — | index | M | no |
| **`layout-fix.css`** | **444 KB/5974 l** | override layer (see §18) | style.css | index | **H, BIG** | never fully |
| `responsive-compact.css` | 12 KB | compact breakpoints | — | index, sw | M | no |
| `game-engine.js` | 49 KB/738 | UMD rules/RTP, `module.exports` + browser global | — | renderer, lxa-account, tests | H | only game math |
| **`renderer.js`** | **162 KB/1566** | the client app (§18) | game-engine, spin-button, admin-radio | index | **H, BIG** | never fully |
| `spin-button.js` | 9 KB | SPIN/STOP button + ring, `window.LXASpinButton` | DOM | renderer | M | no |
| `header-fit.js` | 20 KB | header, lock, Ko-fi, zoom handling | DOM, visualViewport | index | M | header/zoom tasks |
| `boot-wild-preload.js` | 0.4 KB | picks wild art preload by viewport | — | index | L | no |
| `sw-register.js` | 0.3 KB | registers service worker on `load` | sw.js | index | L | no |
| `sw.js` | 1.6 KB | network-first service worker, cache `lxa-v3-cache`, hard-coded asset list | file names | browser | M | no (but update when files move) |
| `manifest.webmanifest` | 0.7 KB | PWA manifest (icons `lxa-icon-*`) | assets | browser | L | no |
| `radio.js` | 42 KB/393 | radio player + the add-a-station form (POSTs `submit`), `window.LXARadio` (§17) | DOM ids, `lang`, `lxaAccount`+`lxaToken` (optional: tells the owner who sent a station) | index | M | exclude |
| `admin-radio.js` | 31 KB/199 | admin radio tabs incl. the player-stations review (sections, details, test again, listen, approve, reject, health), `window.LXAAdminRadio` | 6 renderer names | renderer | M | exclude |
### 8.2 Server / API
| File | Size | Role | Depends on | Consumed by | Risk |
|---|---|---|---|---|---|
| `api/lxa-account.js` | 1.7 KB | adapter req/res → handler | functions/lxa-account | Vercel | M |
| `api/radio.js` | 0.7 KB | adapter | functions/radio | Vercel, cron | L |
| **`functions/lxa-account.js`** | **69 KB/636** | all account/game/admin actions (20) | game-engine, security, firebase-storage, radio (lazy) | api, tests | **H, BIG** |
| `functions/firebase-storage.js` | 12 KB/286 | the only DB layer | firebase-admin, env | lxa-account, radio | H |
| `functions/security.js` | 7 KB/231 | validateBet, rate limits, audit/fraud, idempotency | — | lxa-account | H |
| `functions/radio.js` | 51 KB/444 | list builder, probes, handler, **submit** (server validation + duplicate decision + automatic save), health sweep of approved stations | radio-*.js, storage | api/radio, lxa-account | M |
| `functions/radio-custom.js` | 14 KB | resolves player-added station URLs (playlist / page / https twin) and holds the SSRF guard (`assertPublic`, `cleanStreamUrl`, `safeFetch`) | — | radio, radio-validate, lxa-account | M |
| `functions/radio-validate.js` | 17 KB/173 | **stream validation**: canonical address, real audio-frame analysis (MP3 / AAC-ADTS / Ogg Opus+Vorbis / FLAC → codec, bitrate, sample rate, channels), the stream held open and timed (stalls, throughput, disconnects), verdict with exact reason, merge of a submission into its row. Audio level / silence NOT measured | radio-custom | radio, lxa-account | M |
| `functions/radio-popularity.js` | 6 KB | MANELE popularity order | — | radio | L |
| `functions/radio-reports.js` | 5 KB | player health reports, station key | — | radio, lxa-account | L |
### 8.3 Configuration
| File | Role | Risk |
|---|---|---|
| `vercel.json` | headers+CSP, `functions.api/radio.js.maxDuration` 60, cron `0 5 * * *` → `/api/radio?refresh=1`, region `fra1` | H |
| `middleware.js` | Edge middleware: 404 for `/functions/`, `package*.json`, `*.test.js`, dev tools, `*.md`, `*.bak`, `/data/`, `/node_modules/` | H |
| `.vercelignore` | keeps tests/readme/eslint/rules/dev tools out of the upload | M |
| `database.rules.json` | deny-all rules (owner verified live rules identical) | H |
| `.eslintrc.json`, `package.json`, `package-lock.json` (240 KB, ignore), `.gitignore` | tooling | L |
### 8.4 Tests and dev tools (see §23): 20 `*.test.js` (root), `audit-simulations.js`, `deployment-check.js`, `local-server.js` (dev server :8888, **talks to PRODUCTION Firebase**).
### 8.5 Docs: `readme.md` (blocked from web by middleware). Notes live outside the repo (§24).

---
## 9. SUBSYSTEM LIST (actual, not assumed)
Application shell · UI · Layout · Responsive/mobile · Game · Spin · Bet · Payouts/rewards (jackpot mission, WILD) · Account · Authentication · Session/persistence · Admin · Leaderboard · Firebase/DB · Vercel backend/API · Radio (player, station management, user stations, health reports, admin) · Radio Browser integration · PWA · Security helpers · Config/env · Tests/diagnostics/logging · Deployment · Documentation/memory.
Not present: Firebase Auth, Firestore, Netlify functions, any build pipeline, any email flow.

## 10. SUBSYSTEM ENTRIES
Fields: Identity · Entry · Internals · Depends on · Consumers · Data · Config · Boundaries · Shared · Risk · Audit routing · Status.

### 10.1 Application shell
- **Identity**: `index.html` + load order. **Entry**: browser loads `index.html`.
- **Internals**: head (viewport `minimum-scale=1`, manifest, favicons, 3 CSS with `?v=`, 2 wild preloads) then scripts in this order: `boot-wild-preload` → `game-engine` → `spin-button` → `admin-radio` → `renderer` → `radio` → `sw-register` → `header-fit`. The order is a hidden dependency (`renderer.js` uses `LXAAdminRadio`/`LXASpinButton`; `radio.js` uses `lang`).
- **Depends on**: all client files. **Consumers**: browser. **Data**: none. **Config**: `?v=` numbers are manual cache busters (bump on every edit of that file).
- **Boundaries**: DOM ids shared with every script. **Risk**: wrong order breaks the game. **Routing**: read `index.html` only. **Status**: ACTIVE.

### 10.2 UI · Layout · Responsive/mobile
- **Identity**: CSS cascade `style.css` → `layout-fix.css` → `responsive-compact.css`, plus `header-fit.js`.
- **Entry**: `<link>` in index. **Internals**: `layout-fix.css` is an append-only patch log (version comments V98…V366+, 6.5k `!important`, 1.2k `:not(#_)` specificity hacks). Page background on `<html>` = `#272079` (must equal theme-color; overscroll paints it). Radio CSS = contiguous tail (~L5773–5955). `.machine` is a CSS Grid; each direct child needs a `grid-area`.
- **Depends on**: DOM ids/classes from `index.html` and from strings built in `renderer.js`/`radio.js`. **Consumers**: the whole UI.
- **Shared**: every subsystem's CSS is in the same files. **Risk**: HIGH — cascade order; moving a rule changes appearance. Debug with computed styles, not by reading CSS.
- **Routing**: grep the selector family in `layout-fix.css`; open `responsive-compact.css` only for breakpoints; `header-fit.js` for header/lock/Ko-fi/zoom. Skip whole-file reads. **Status**: ACTIVE, SHARED.

### 10.3 Account (create / login / update / logout)
- **Entry**: UI in `renderer.js` (`accountText`, `renderAccountPanel` ~L259, `lxaRestoreSession` L335, remembered password L139); server actions `create, login, logout, update` in `functions/lxa-account.js` (handler L623, dispatch from ~L221).
- **Data**: Firebase `accounts/<id : name>` (key renamed on save when the name changes; lookups by the `id` field), `meta/lastAccountId` (atomic id counter), `meta/names/<digest>` (name reservation transaction).
- **Config**: limits `CREATE_ACCOUNT` 5/h per IP, `LOGIN_ATTEMPT` 10/h per IP (real logins only; silent restore is not counted).
- **Depends on**: security.js, firebase-storage.js. **Consumers**: every authenticated feature. **Risk**: H (identity). **Tests**: `account-keys`, `account-id-counter`, `name-race`, `auth-session`.
- **Status**: ACTIVE.

### 10.4 Game · Spin · Bet · Payouts
- **Rules** (`game-engine.js`): 5 lines × 10 columns, target word LEONXOXANA; PAYTABLE × line stake (bet/5): 3/10 .50, 4/10 .75, 5/10 1, 6/10 1.5, 7/10 2, 8/10 3, 9/10 5, 10/10 8; jackpot mission: 5 different lines at 10/10, tier multipliers 1–5× stake; WILD: chance 50 % + 0.2 %/level (cap 50), a line showing a WILD cell is excluded from jackpot/records but still pays its line prize; WILD price ladder `wildUpgradeCost`; max stake `maxBetForWildLevel = max(5, floor(price of next level / 2))` (WILD 50 → 25.5M; "+" up to the whole balance, 50 % button = half balance, both cut to the cap).
- **Entry**: UI `#spin` click/pointerdown; server action `spin`.
- **Authoritative**: logged-in = server (`spin` action, atomic account save); guest = browser (`resolveSpin`, state in localStorage `lxa-v107-game-state`).
- **Duplication**: WILD placement/payout code exists in the client engine path and in the server path; kept in sync by hand; `deployment-check.js` compares. **Cap enforced in 3 places** (engine, server HTTP 400, UI).
- **Depends on**: game-engine, security.validateBet, `rtpSettings` (Firebase). **Consumers**: renderer, server, tests.
- **Risk**: H (money logic). **Tests**: `game-engine`, `rtp-linked`, `rtp-linked-server`, `spin-grid-letters`, `idempotency`, `renderer-money-routing`.
- **Routing**: bet bug → `game-engine.js maxBetForWildLevel`, `renderer.js` `setLocalBet`/`normalizeLocalBet`/`bindHoldBet` (~L1019–1179), `lxa-account.js spin`. Spin bug → `spin-button.js`, `renderer.js` `startReelSpin` L888, `lxaAccountResolveSpin` L992, `$('#spin').onclick` L1028. Skip radio/admin code. **Status**: ACTIVE.

### 10.5 Session / persistence — see §14. **Status**: ACTIVE, SHARED between client (`renderer.js`) and server.

### 10.6 Security helpers
- `functions/security.js`: `validateBet`, `checkRateLimit`, `checkGlobalRateLimit` (5000/min), `auditAction`, `detectFraud`, `sanitizeInput`, `validateEmail` (**defined and exported but not used anywhere** — VERIFIED by grep), in-memory `IdempotencyCache`. Rate limiters are in memory per function instance (so not shared across instances — behaviour at scale NOT VERIFIED).
- **Risk**: H. **Status**: ACTIVE.

### 10.7 Firebase / DB — see §15.

### 10.8 Admin
- **Entry**: admin hub in the account panel (`renderer.js` ~L259–309: hub, rtp-admin, jackpot-admin, custom-admin, players, radio-admin) + `admin-radio.js`; server actions `get-rtp-settings, set-rtp-settings, reset-rtp-settings, set-custom-distribution, reset-leaderboard, list-players, admin-update-player, admin-delete-player, admin-radio`.
- **Authorization (VERIFIED)**: server-side `isAdminAccount(account) = account.role === 'admin'` (L12), checked in each admin action (HTTP 403 "Not authorized."), plus the admin's safeWord. The client list `LXA_PROTECTED_ACTIONS` (renderer L234) only asks for the password again; it is a convenience, not the gate. Admin role is set by hand in the Firebase console.
- **Data**: `rtpSettings`, `leaderboard`, `accounts`, radio nodes. **Risk**: H. **Tests**: `rtp-linked-server`, `leaderboard-*`. **Status**: ACTIVE.

### 10.9 Leaderboard
- **Entry**: server action `leaderboard`; written during `spin`; rebuilt from real accounts (no orphan rows); place = position in the displayed list. **Data**: Firebase `leaderboard`; strict reads (fail closed). **Client**: rank line under the stake. **Tests**: `leaderboard-truth`, `leaderboard-position`. **Status**: ACTIVE.

### 10.10 PWA / service worker
- `manifest.webmanifest` (standalone, icons `assets/icons/lxa-icon-192/512/512-maskable`), `sw.js` (network-first, API never cached, cache `lxa-v3-cache`, hard-coded asset list that must be edited when files are added/renamed), `sw-register.js`, apple meta tags. No install button (owner decision). Android "Install app" not working on the owner's phone: cause unknown, NOT VERIFIED (needs phone model + browser). **Status**: ACTIVE.

### 10.11 Radio (summary; full map §17) — ACTIVE, partly embedded in shared files.

### 10.12 Config / environment — §21. Tests/diagnostics/logging — §23 (no server logging service; `auditAction` + console only; client keeps an auth log in localStorage and a `?debug=1` overlay in `spin-button.js`). Deployment — §16. Documentation/memory — §24.

---
## 11. WHERE TO LOOK (task → minimum file set)
| Task | Open first | Then, only if needed |
|---|---|---|
| LOGIN / AUTH | `functions/lxa-account.js` (grep `login`, `authorize`, `tokenMatches`) · `renderer.js` (`lxaRestoreSession`, `lxaRequest`) | `security.js` · `auth-session.test.js` |
| SESSION / "logged out" | `lxa-account.js` (`mergeSessions`, `readSessionCookie`) · renderer L124–151, 335 | `session-race.test.js`, `session-cookie.test.js` |
| ACCOUNT (name, id, password) | `lxa-account.js` actions `create/update` · `firebase-storage.js` L55–110 | `account-keys.test.js`, `name-race.test.js` |
| BET / stake cap | `game-engine.js maxBetForWildLevel` · `renderer.js` `setLocalBet` · `lxa-account.js spin` | `game-engine.test.js` |
| SPIN / reels / ring | `spin-button.js` · `renderer.js` L888, L992, L1028 | `lxa-account.js spin` |
| PAYOUT / RTP / WILD | `game-engine.js` · `lxa-account.js` (`spin`, `buy-wild`, `applyRtpSettings`) | `rtp-linked*.test.js`, `deployment-check.js` |
| LEADERBOARD | `firebase-storage.js` L205–230 · `lxa-account.js leaderboard` | `leaderboard-*.test.js` |
| ADMIN (non-radio) | `renderer.js` L259–310 · `lxa-account.js` admin-* | — |
| FIREBASE DATA | `firebase-storage.js` · `lxa-account.js save()` | `storage-*.test.js`, env names (§16) |
| RADIO (player) | `radio.js` · `/api/radio` → `functions/radio.js` | `radio-reports.js`, `radio-health.test.js` |
| RADIO (player adds a station / validation / duplicates) | `functions/radio-validate.js` · `functions/radio.js` `handleSubmit` · `radio.js` `addStation` | `radio-custom.js` (SSRF guard), `radio-health.test.js`, `radio-validate.test.js` |
| RADIO (admin / players' stations) | `admin-radio.js` · `lxa-account.js` `admin-radio` (suggestions, sug-test, sug-approve, sug-reject, custom-check, customs-check) · `radio-validate.js` | `renderer.js` L281–285, 308–309 |
| CSS / MOBILE | grep selector in `layout-fix.css`; `responsive-compact.css`; computed styles | `index.html` structure |
| HEADER / lock / Ko-fi / zoom | `header-fit.js` · `layout-fix.css` (`.topbar`, `.brand`, lock) | `index.html` viewport meta |
| PAGE EDGES / overscroll | `layout-fix.css` root background blocks · `index.html` | — |
| TEXT / TRANSLATION | `renderer.js` (`t`, `tx118`, `accountText`, `data-i`), `radio.js` `TEXT`, CSS `content:` strings | — |
| PWA / INSTALL | `sw.js`, `sw-register.js`, `manifest.webmanifest` | — |
| DEPLOYMENT / headers / blocked file | `vercel.json`, `middleware.js`, `.vercelignore` | `deployment-check.js` |
| NEW FILE ADDED / MOVED | `index.html` (script order), `sw.js` (asset list), `.vercelignore`, `middleware.js`, `.eslintrc.json` | `readme.md` |
| TEST FAILS | the named test + the one `functions/` file it requires | — |

---
## 12. DATA FLOW MAP (only flows that exist)
**Login** — INPUT login form → `lxaRequest('login', {id|name, safeWord})` (adds token if any) → VALIDATION cleanName/length, rate limit `LOGIN_ATTEMPT` (10/h/IP) → `/api/lxa-account` → `checkSafeWord` → `issueSession` → DB `updateAccount` (transaction) → RESPONSE `publicAccount` (no hash/sessions) + token in body + `Set-Cookie lxa_sid` → UI `lxaAccount`, `localStorage lxa-account-cache-v1`, `lxa-session-token-v1`, the remembered password is the owner's explicit choice (key `lxa-safe-v1`, 4 references in `renderer.js` — VERIFIED).
**Session restoration** — page load → `lxaRestoreSession` → `login {silent:true, token}`; with no token and a same-site request the server uses cookie `lxa_sid` → account loaded → UI.
**Account loading / hydrate** — `lxaHydrate` (L249) loads the server account into client state (`lxaAccount`, `credits`, difficulty, streaks).
**Spin (account)** — tap → `spin-button` pointerdown → `#spin.onclick` (drops the duplicate `click` that follows a touch) → `startReelSpin` (reels roll at once) → `lxaAccountResolveSpin` POST `spin {id, bet, difficulty, token, requestId}` → VALIDATION `validateBet`, token, cap `maxBetForWildLevel`, rate limit 500/h, idempotency by `requestId` → server resolve (server copy of rules) → DB atomic save of account + leaderboard → RESPONSE → `LXASpinButton.landing(ms)` → reels stop → `gameState` update + round summary. Failure → `LXASpinButton.fail(reason)`; "session expired" opens login.
**Spin (guest)** — same UI; `game.resolveSpin` in the browser; localStorage `lxa-v107-game-state`.
**Bet** — `+`/`−`/hold/50 %/AUTO → `setLocalBet` clamps to min(balance, cap); server re-checks (HTTP 400). Changes during AUTO are queued (`queuedBet`) for the next round.
**Buy WILD / deposit / GELD / new game** — `LXA_TOKEN_ACTIONS` (token authorises; deposit has its own `requestId`) → server action → DB save → UI.
**Persistence** — every account change = `firebase-storage.updateAccount(key, mutate)` transaction; sessions merged inside the transaction (§14).
**Radio list** — `radio.js` GET `/api/radio` → `functions/radio.js getList` (memory cache → Firebase `meta/radio` → build from Radio Browser + probes; cron refresh 05:00 UTC; the list rebuilds itself after a deploy because the builder version is hashed) → JSON → `localStorage lxa-radio-list-v3`.
**Radio playback** — user picks a station → `play()` → one `<audio>`, stream URL direct from the provider → on failure `onBroken` → one retry → mark bad → `sendReport` POST `/api/radio` → `radio-reports` → Firebase `radioReports/*`.
**Radio add-a-station** — INPUT the player pastes a link (`radio.js addStation`) → POST `/api/radio` `{action:'submit', u, n, dev, id?, token?}` → VALIDATION on the SERVER: `cleanStreamUrl` (no user:password@, no localhost / private literals) → canonical address (`radio-validate.canonicalStream`) → DUPLICATE check (public list, approved stations, rejected, an already waiting row) → `resolveStation` (playlist / page / https twin, every hop must be a PUBLIC address) → `readAudio` holds the stream open ~5 s and times every chunk → `analyze` parses real frames (codec, bitrate, sample rate, channels) → verdict (`ok` / exact `why`) → DB `radioSuggest/<canonical key>` in ONE transaction (`applySubmission`: first player creates the row, later players only add themselves; a VALID row is never turned INVALID by a later submission; a reused verdict is not re-stamped) → RESPONSE only what the player may see (playable URL, codec, bitrate, sample rate, channels, stable, `dup`, `queued`) → UI plays it at once (private list `lxa-radio-mine-v1`, max 10) and says "valid — waiting for approval". The login (id + session token) is verified server-side (`lxa-account.verifyPlayer`) and only tells the owner WHO sent it. Owner: admin > RADIO > player stations → TEST AGAIN / listen / APPROVE (→ `meta/radioCustom`, public at the top of the chosen category) / REJECT (→ `meta/radioReject` record).
**Radio browse / frequency / scanner (ON MAIN since 5fe3361)** — `radio.js` FIND box (📻) → GET `/api/radio?browse=countries|freq|scan` → `functions/radio-browse.js` (Radio Browser only; no country or frequency is hardcoded; default country = platform header `x-vercel-ip-country`, changeable, "All countries" = name search). The directory has NO frequency field: the frequency is parsed from the station NAME (`97.5`, `90,3`, `1008 AM`); a station that does not write it in its name cannot be found by frequency. One country read (≤3×1000 stations, `hidebroken`, cached 6 h in memory) serves every search and scan (no request per frequency; scan reveals the found frequencies one by one in the UI, Stop ends it). Same frequency ≠ duplicate: results are merged only when the canonical stream address is equal. POST `{action:'check', u}` validates one stream (same SSRF-guarded validator as submit) and saves nothing. `playerView.state` = VALID / DEGRADED / OFFLINE / NO AUDIO / UNSUPPORTED / INVALID (`radio-validate.stateOf`); the legacy `status` VALID/INVALID stays. Limits: directory data (`lastcheckok`) decides what is listed, real validation happens on `check`/submit; audio LEVEL is not measured; real playback in a phone/browser was not tested by the agent. Frequency source = Radio Browser station NAMES only (chosen because it is the project's existing source and carries stream URLs); no frequency database / regulator list is used.
**Radio lists (main)** — one category per station (`buildList` end: best tag score; manele > etno > score; GLOBAL last). GLOBAL = 100 stations: curated names `functions/radio-flagships.js` (general-knowledge choice, NOT a measured audience) + tag-family queries, genre quotas, variety caps, evidence of songs from ICY titles.
**Radio RECOMMEND (ON MAIN since 7b40104)** — separate from REPORT (the 🚩 flag, untouched) and from the player's own link submit. In the FIND results each row has 📣: POST `/api/radio` `{action:'recommend', u, id, token}` → `radio.js handleRecommend`: login REQUIRED (session verified by `lxa-account.verifyPlayer`, the player is never a body field); `u` must be a result the SERVER returned earlier (`radio-browse` `seen` map → `lookup(canonical)`), name / frequency / country / city / source / source id come from that server record, not from the client; already in the list → `EXISTS/APPROVED`, rejected before → `REJECTED`; the server validates the stream (`stateOf` → VALID / DEGRADED / OFFLINE / NO AUDIO / UNSUPPORTED / INVALID; an invalid stream is still recorded with its real state; a VALID verdict is never replaced by a failed one) and stores Firebase `radioRecommend/<radioKey(canonical stream)>` = `{st{n,u,canon,f,fs,cc,city,src,sid,c,b}, players{<id>{id,name,at,msg}}, count, status PENDING|APPROVED|REJECTED, v, vstate, checkedAt, first, last, decidedAt, cat}`. Several players = ONE record; the same player twice = `ALREADY`. 12 recommendations/hour per account. Admin tab ⭐ (`admin-radio.js`, ops in `lxa-account.js`): `recs` (list + dup flag), `rec-test` (fresh check, 8 s), `rec-approve` {key, cat, name, f} (ALWAYS a fresh stream check through `radio.runValidator`, duplicate check on the canonical address, category must be one of the 12 existing `CUSTOM_TARGETS`, writes `meta/radioCustom/<key>` with `f`, `fs`, `cc`), `rec-reject` (→ `meta/radioReject`). Frequency model: number (97.5), source `fs` = ABSENT | EXTERNAL_SOURCE (read from the station NAME by radio-browse) | ADMIN_VERIFIED (typed by the owner at approval; never replaced by a weaker source); approved stations with `f` come FIRST in frequency search / scan. Frequency is never a condition for playing or recommending. Limits: frequency search lists stations that the directory marked working (`lastcheckok`); the real stream state is only checked on recommend / approve, not before each play; audio level not measured; no `AUDIO_VERIFIED` (the server sees MP3/AAC frames, it cannot decode); the 30 s serving cache delays a new approval. Tests: radio-health.test.js (recommend describe), radio-browse.test.js.
**Admin actions** — admin panel → `lxaRequest(action)` (re-asks password for `LXA_PROTECTED_ACTIONS`) → server `isAdminAccount` check (403 otherwise) → DB read/write → RESPONSE → UI cache (`lxaRtpCache`, `lxaPlayersCache`, `lxaRadioCache`).
**Leaderboard** — written during `spin`; read by action `leaderboard`; strict read, fail closed.

## 13. EVENT / CONTROL FLOW (only what is present)
**SPIN chain** — source: `pointerdown` on `#spin` (`spin-button.js` L161) or `click` (renderer L1028; the click after a touch is dropped via `LXASpinButton.recentPointer()`) → handler `#spin.onclick` → state `spinning=true`, `LXASpinButton.start()` → async `startReelSpin()` + `lxaAccountResolveSpin` → callback `LXASpinButton.landing(ms)` → `await` the reels (Web Animations `finished`, timer only a safety net) → result handling in the same handler → `LXASpinButton.finish`. **Cancel**: STOP press fast-forwards (`fastForward()`) / `abort()`. **Ids**: `requestId` (`crypto.randomUUID`, reused on timeout retry, rotated otherwise) for server idempotency; a **generation** token (renderer L151, L972) makes a logout or lost session drop whatever is in flight so an old spin cannot write into a new session.
**AUTO** — `runAutoSpin` (L1234): waits while a bet change settles (`betHolding`, `BET_SETTLE_MS`), calls `$('#spin').onclick()`, then re-arms: 260 ms normally, longer after a profit (`AUTO_PROFIT_PAUSE_MS`).
**Stake controls** — `click`/hold on +/− (`bindHoldBet` L1179: pointer/touch hold-to-repeat), 50 % button, → `setLocalBet` → `#bet`, `#betMax`, `#lineStake`.
**Auth chain** — form submit → `lxaRequest` → server → `lxaStore()` cache → UI; every logout/lost session bumps the generation (L151); offline logout is queued and finished at the next start (renderer L143); 5 taps on the KONTO title show the auth log in the installed app.
**New-version notice** — `visibilitychange` (renderer L211) → `check()` after 400 ms → compares served version.
**Header** — `load`, `pageshow`, `resize`, `orientationchange`, `visualViewport resize`, `scroll` in `header-fit.js` (L262–293) recompute lock/Ko-fi/ID/flag positions every frame; the lock blocks scroll only on touch (`pointer:coarse`); `html.lxa-zoomed` lets fingers pan/pinch while zoomed.
**Radio** — audio events `playing`, `waiting`, `stalled`, `error` (radio.js L223–225), `online`/`offline`; handlers `armFail` (12 s timeout) → `onBroken(attempt)`; **attempt id** `attemptSeq` and `handledAttempt` ignore stale or duplicate signals; `retried` allows one reconnect on the same station, then `markBad`, `nextGood`, up to 4 tries; offline → waits for `online`; MediaSession metadata set on `play`; sleep timer, favourites, recents persist in localStorage.
**Radio add (player)** — click ▶ in the add box → `unlockAudio()` (silence file, so iOS lets the stream start later) → POST `submit` (≈ 7–8 s on a real stream: resolve + 5 s held open) → `⏳` in `#radioAddMsg` → answer → `saveMine` + `play('fav', 0)` or the exact reason (web page, not audio, no data, disconnects, unstable, not allowed, unreachable, http-only, limit). Server side the verdict is computed once per address; ids: none needed (idempotent by canonical key).
**Admin radio** — `input`/`change`/`click` in `admin-radio.js` → `lxaRequest('admin-radio', {op})` → server → `LXAAdminRadio.setCategories(...)` → re-render.
**Service worker** — `load` → register → network-first fetch; navigation falls back to cache offline.

---
## 14. AUTH / SESSION ARCHITECTURE
- **Login UI**: account panel (`renderer.js` `renderAccountPanel`). **Identity**: numeric id or name (id + name alone is not a login any more). **Password**: field `safeWord`; hashed with `LXA_PEPPER` server-side; the typed password is kept only in memory (`lxaSafeWord`), a remembered-password feature exists by owner decision (key `lxa-safe-v1`, VERIFIED in `renderer.js`).
- **AUTH SESSION (authoritative = server)**: account node fields `safeWord` (hash), `sessions[] {h: sha256(token), at}` (max 25 devices), legacy `sessionToken`, `role`. The plain token exists only on the device (`lxa-session-token-v1`).
- **Concurrency**: session changes are recorded as in-memory ops on the account object (`issueSession`, `revokeSession`, `revokeAllSessions`) and merged **inside the DB transaction** (`mergeSessions` ~L94), so a request that read the account earlier cannot wipe a session created meanwhile.
- **Cookie**: `lxa_sid`, HttpOnly, Secure, SameSite=Lax, Path=/api, 400 days — used only when the request carries no token, only for same-site requests, and not after an offline logout was recorded.
- **Authorization ladder**: play actions need a valid token (`authorize` ~L106 → `tokenMatches`); sensitive ones (password change, admin) need the password (`checkSafeWord`); admin also needs `role === 'admin'`.
- **Logout**: `logout` action → `revokeSession`; offline logout is queued. **Expiry/refresh**: none other than cookie Max-Age and the 25-device cap; no refresh endpoint.
- **GAME / OPERATION STATE is separate**: `gameState` (renderer global) mirrors the account node for logged-in players, localStorage for guests.
- Firebase Auth: not used. Netlify: not used.

## 15. FIREBASE MASTER MAP
- **Config**: env `FIREBASE_DATABASE_URL` (default URL fallback in `firebase-storage.js`, sanitised), `FIREBASE_SERVICE_ACCOUNT` (JSON, Vercel only). Never in the repo. Project `lxav1-a5cfd`, europe-west1 (older notes).
- **Access**: server only, `firebase-admin`, `initFirebase()` shared by all storage functions. No client SDK, no listeners, no real-time subscriptions: all reads/writes are request-time.
- **Rules**: deny-all (`.read`/`.write` false) — VERIFIED 2026-10-04 (owner pasted the live console rules; identical to `database.rules.json`). The admin SDK bypasses rules; rules are changed in the console, Vercel does not deploy them.
- **Paths (VERIFIED)**: `accounts/<id : name>` · `leaderboard` · `rtpSettings` · `meta/lastAccountId` · `meta/names/<digest>` · `meta/radio` (cached list) · `meta/radioHide` · `meta/radioMove` · `meta/radioFav` (counters) · `meta/radioReject` · `meta/radioCustom` · `meta/radioSuggestDay` · `radioReports/<key>` · `radioSuggest/<key>` · `radioFavDev/<device>/<key>`.
- **Radio row shapes (VERIFIED)**: `radioSuggest/<key>` (key = hash of the CANONICAL address) = `{u (playable), orig (as typed by the first player), canon, n, first, last, count, devices{}, accounts[{id,name}], by, status VALID|INVALID, v{ok, why, codec, bitrate, sampleRate, channels, stable, stalls, maxGapMs, measuredKbps, ttfbMs, bytes, warnings[], hls, phoneOk, iosOk, from, checkedAt}, checkedAt}` — written ONLY by the server; the audio level is absent (not measured; Firebase drops nulls). `meta/radioCustom/<key>` (key = hash of the PLAYED url, as for hide/move/reports) = `{u, n, c, b, sr, ch, cat, at, orig, by, health{status OK|DEGRADED|OFFLINE, at, why, kbps, stalls, codec, bitrate, warnings}}`. `meta/radioReject/<key>` = `{at, u, n, orig, by}` (older rows: just a time stamp).
- **Authoritative**: accounts (balance, WILD level, sessions, role), `rtpSettings`, `meta/names`. **Derived**: `leaderboard` (from accounts), `meta/radio` (rebuildable), `meta/radioFav` (from `radioFavDev`).
- **Writes**: transactions for accounts, id counter, name reservation, reports, favourites; plain `set` for list cache and hide/move/custom nodes.
- **Conflict points**: key rename on name change (`save()` migration; legacy `account:N` nodes normalised); production still holds test accounts (`zzprobe*`, `lxatest*`, `lxaspd*`, ids 14–19) — the owner deletes them; `rtpSettings` empty in production = code defaults.

## 16. VERCEL / BACKEND MASTER MAP
- **Entries**: `/api/lxa-account` (GET/POST/OPTIONS; JSON body `{action,...}`) and `/api/radio` (GET `?refresh/recheck`, POST actions `submit` (alias `suggest`), `fav`, `report`; the old GET `?resolve=` was removed — one validation path). No redirects or rewrites in `vercel.json`.
- **Account actions (20, VERIFIED)**: `create, login, logout, update, spin, deposit, buy-wild, set-difficulty, reset-geld, reset-new-game, leaderboard, get-rtp-settings, set-rtp-settings, reset-rtp-settings, set-custom-distribution, reset-leaderboard, list-players, admin-update-player, admin-delete-player, admin-radio`.
- **Headers (all paths)**: no-cache, X-Frame-Options DENY, nosniff, strict referrer, CSP (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://*.firebasedatabase.app; media-src 'self' https:; frame-ancestors 'none'`), HSTS, Permissions-Policy (camera/mic/geo/payment/usb off), COOP same-origin. `connect-src` still allows firebasedatabase.app although the client does not use it.
- **Functions config**: `api/radio.js` maxDuration 60 s; cron `0 5 * * *` GET `/api/radio?refresh=1` (also runs the health sweep of approved player stations: oldest check first, 8 per run, stations checked in the last 6 h skipped); region `fra1`.
- **Env names**: `FIREBASE_DATABASE_URL`, `FIREBASE_SERVICE_ACCOUNT`, `LXA_PEPPER`, `RADIO_HIDE` (optional), `VERCEL_ENV`. Env added after a deploy needs a redeploy (symptom: "Server temporarily unavailable" at login).
- **Server-authoritative**: spin, deposit, BANK/WILD/GELD, sessions, admin actions, radio list.
- **Rate limits**: create 5/h (per IP), real login 10/h (per IP), spin 500/h (per account), buy-wild 100/h, global 5000/min — in memory per instance.
- **Client IP**: `x-vercel-forwarded-for` > `x-real-ip` > `x-forwarded-for[0]`. Errors → HTTP 500 "Server temporarily unavailable." (fail closed when Firebase reads fail).
- **Public exposure**: the repo root is the site; `middleware.js` + `.vercelignore` are the only protection for non-asset files.

## 17. RADIO MASTER MAP
**Pieces**: client `radio.js` (`window.LXARadio`), `admin-radio.js` (`window.LXAAdminRadio`); server `api/radio.js` → `functions/radio.js` + `radio-validate.js` (new) + `radio-custom.js` + `radio-popularity.js` + `radio-reports.js`; Firebase nodes (§15); tests `radio`, `radio-health`, `radio-custom`, `radio-popularity`, `radio-validate`.
- **Entry/UI**: `#radioBar` (+ `radioPlay/Prev/Next/Title/Name/Status/Vol/Flag/Toggle`) in `index.html`; its own grid row above the Ko-fi goal bar; CSS = tail block of `layout-fix.css` (~L5773–5955, plus ~117 lines mentioning radio overall).
- **State/persistence (localStorage)**: `lxa-radio-v1` (player state), `lxa-radio-list-v3` (cached list), `lxa-radio-bad-v1` (failed stations, 24 h), `lxa-radio-fav-v1`, `lxa-radio-mine-v1` (user stations, ≤10, private), `lxa-radio-rep-v1`, `lxa-radio-dev-v1` (anonymous device id). One `<audio>`; MediaSession; sleep timer; eco mode; iOS ignores the volume slider.
- **Categories/stations**: Radio-Browser based (RO HTTPS MP3/AAC), 12 categories (manele, etno, rap, house, techno, dance, pop, rock, chill, retro, global, top — VERIFIED in `CATEGORIES`), MANELE ordered by popularity (`radio-popularity.js`), each station in ≤ 2 categories, hide filters: env `RADIO_HIDE` (name words, at list build) + Firebase `meta/radioHide` (station keys, at serving) — **additive, not competing**; `meta/radioMove` re-categorises; HTTP-only streams excluded (mixed content).
- **Radio Browser integration**: `radioBrowser()` in `functions/radio.js`, mirrors de1/nl1/at1; server probes (`probeStream`, `diagnose`, double probe server + phone), re-check every 3 h, `blockedUrl` guard.
- **User stations**: the player adds a link → the SERVER validates (real audio frames, held open and timed, SSRF-guarded), saves the submission automatically (`radioSuggest`) and the player can PLAY at once; it becomes public only when the owner approves (`meta/radioCustom`). Statuses: PENDING (not yet validated, legacy rows) / VALID / INVALID (waiting rows), APPROVED (+ health OK / DEGRADED / OFFLINE after the periodic check), REJECTED (record kept). Duplicates: decided on the canonical address (http/https, `www.`, ports 80/443, trailing slash, Shoutcast `/;`, tracking parameters are one stream) inside one Firebase transaction. The 📨 switch no longer exists.
- **Admin**: tab in the account panel — renderer L281–285, L308–309 delegate to `LXAAdminRadio`; the player-stations tab shows sections PENDING / APPROVED / INVALID-REJECTED / OFFLINE with who sent it, original and normalized address, time, validator result (codec, bitrate, sample rate, channels, stability, measured rate, dropouts), duplicate status, last check, and the actions TEST AGAIN (🔄), listen (▶), APPROVE (✅ into any of the 12 categories), REJECT (❌), 🩺 check all approved. Server action `admin-radio` in `lxa-account.js`: list, hide/show, report rows, suggestions, sug-test, sug-approve, sug-reject, custom-check, customs-check, custom-remove, move.
- **Radio needs from LXAV1** (VERIFIED): global `lang` (fallback localStorage `lxaLang`); optional globals `lxaAccount` + `lxaToken` (to tell the owner who sent a station; the server verifies them with `lxa-account.verifyPlayer`); ~27 DOM ids in `index.html`; URL `/api/radio`; shared Vercel project, CSP `media-src https:`. `admin-radio.js` needs six names from `renderer.js`: `lxaRequest, lxaAccount, renderAccountPanel, lxaRadioCache, lang, lxaConfirm`.
- **LXAV1 needs from Radio**: `window.LXARadio`, `window.LXAAdminRadio`, the `admin-radio` action, `lxa-account.verifyPlayer` (server), radio functions in `firebase-storage.js` (`updateRadioSuggest`, `getRadioSuggestNode`, `patchRadioCustomHealth`, reject records), `sw.js` asset entries, ESLint override entry, `vercel.json` cron + `maxDuration`.
- **Embedded in shared files** (count of lines mentioning "radio"): `layout-fix.css` ~117, `firebase-storage.js` ~58, `lxa-account.js` ~30, `renderer.js` ~15, `index.html` 2, `sw.js` 2, `.eslintrc.json` 3, `vercel.json` 2 settings.
- **External streams/providers**: arbitrary station hosts; `RADIO_HIDE`/hide lists are the moderation tools.
- **Isolation level today**: partial — own client files, own endpoint and functions (now incl. `radio-validate.js`), players need no login (the login is optional); the seam is narrow (list above) but grew by two names: `lxaAccount`/`lxaToken` (client, optional) and `verifyPlayer` (server). A folder move (`radio/`) was started locally (`radio-restructure-wip`, NOT in the baseline) and will conflict with these changes.

## 18. LARGE FILE / MONOLITH MAP
| File | Size | Subsystems inside | Why big | Extraction risk |
|---|---|---|---|---|
| `layout-fix.css` | 442 KB / 5954 l | game ≈38 %, header/lock/Ko-fi ≈23 %, base ≈22 %, account ≈7 %, radio ≈6 % (author estimates, NOT VERIFIED) | append-only patch history; 6.5k `!important`; 189 selectors rewritten 4+ times (author estimate) | contiguous tail blocks (radio, admin radio): LOW; old rules by subsystem: **HIGH** (cascade) |
| `renderer.js` | 162 KB / 1566 | i18n tables, game UI, stake, spin, account/auth, admin views, radio-admin view, confirm dialog, leaderboard | single global scope, very long lines (one ≈10 KB), ~100 version comments, base functions re-assigned later (author reports 12; NOT VERIFIED) | admin/account/radio views: LOW–MEDIUM; core state `gameState`/`lang`/`lxaAccount`: HIGH |
| `functions/lxa-account.js` | 69 KB / 636 | auth, account, game, admin, leaderboard, radio-admin | one handler dispatching 20 actions | split by action group: MEDIUM |
| `game-engine.js` | 49 KB / 738 | rules + RTP, used by browser and server | shared core | do not split; black box with tests |
| `functions/radio.js`, `radio.js` | 45 / 41 KB | radio only | self-contained | already isolated |
Read these with grep, never top to bottom.

## 19. COUPLING MAP
| Coupling | Level | Why |
|---|---|---|
| `renderer.js` globals (`gameState`, `lxaAccount`, `lang`) used across game/account/admin/radio-admin | **CRITICAL** | one global scope (author counts ≈124/91/72 references) |
| Cascade order in `layout-fix.css` | **CRITICAL** | moving a rule changes appearance |
| Script load order in `index.html` | HIGH | undocumented dependency |
| Client vs server copies of WILD/payout rules | HIGH | must stay equal by hand |
| Header/lock/Ko-fi/zoom (`header-fit.js` + CSS + z-index layers) | HIGH | already caused a lock+zoom bug between subsystems |
| `lxa-account.js` ↔ `firebase-storage.js` | MEDIUM | one storage API, all transactions |
| `initFirebase` shared by account and radio | MEDIUM | single init |
| `admin-radio.js` → six renderer names | MEDIUM | narrow, explicit |
| `radio.js` → `lang` + DOM ids | LOW | narrow |
| `api/radio` ↔ account API | LOW | separate endpoints and functions |
| Circular dependencies | none among server files (`lxa-account` requires radio lazily); client has no module graph |

## 20. DUPLICATION / CONFLICT MAP (record only)
- **RESOLVED 2026-10-04**: SW cache name (`lxa-v3-cache` in code; older notes said v2) · ARCHITECTURE.md said "inline scripts / 7 tests" · CONTEXT.md copied `?v=` numbers · `RADIO_HIDE` vs `meta/radioHide` (additive filters). Docs inside `ClauBack\LXAV1\CONTEXT\` still carry the old wording until synced — **CONFLICT / NEEDS RESOLUTION**: source A = ClauBack `CONTEXT\*.md` (written for commit `c82da19`, says Jest 63/63, 7 suites, `origin/main = c82da19`); source B = code at `ca2e4ab` (20 test files). Code wins; ClauBack docs need a refresh.
- **CORRECTED 2026-10-04** (my own error in index v1/v2): the Firebase paths are `meta/radioReject` and `meta/radioCustom` (not `…Rejected` / `…Customs`) — now read from the code. The `GET /api/radio?resolve=` endpoint and the 📨 switch were removed (one validation path).
- **Duplicate logic**: WILD placement/payout (client engine vs server); name/id helpers; `lang` fallback in radio.js vs renderer.
- **Multiple definitions**: renderer base functions re-assigned later (NOT VERIFIED count); old CSS rules overridden by later blocks (≈280 version comments).
- **Legacy still present**: `responsive-compact.css` (linked, in use), `middleware.js` BLOCKED list names `bot-player.js` (file absent), comments in `api/lxa-account.js` and `middleware.js` mention Netlify; `validateEmail` unused.
- **Dead code candidates (not scanned)**: do not delete without approval.
- **Removed 2026-10-04**: `docs-context/`, `scripts/build.js`, 13 unreferenced images (each verified unreferenced).
- **Kept though possibly unused**: font `barlow-condensed-latin-ext-500-normal.woff2` (no reference found, 14 KB), `connect-src https://*.firebasedatabase.app` in CSP.

## 21. CONFIGURATION OWNERSHIP MAP
| Behavior | Authoritative | Fallback | Who edits |
|---|---|---|---|
| Admin odds/RTP/costs | Firebase `rtpSettings` (server `applyRtpSettings`) | code defaults in `game-engine.js` (production `rtpSettings` empty = defaults) | admin via admin actions |
| Max stake | `maxBetForWildLevel` in `game-engine.js` | none | code only |
| Admin rights | `accounts/<id>.role === 'admin'` | none | owner in Firebase console |
| Language | localStorage `lxaLang`, default `de` | — | player |
| Radio hide | env `RADIO_HIDE` (name words, at build) **and** Firebase `meta/radioHide` (keys, at serving) | — | owner / admin; env change needs redeploy + list rebuild |
| Radio category order/moves | code + `meta/radioMove` | — | admin |
| CSP/headers, cron, region | `vercel.json` | — | owner (deploy) |
| DB secrets, pepper | Vercel env | — | owner |
| Asset cache-bust (`?v=`) | `index.html` | — | manual bump on every client edit |
| Service worker cache/asset list | `sw.js` | — | manual |
| Public/non-public files | `middleware.js` + `.vercelignore` | — | owner |
Nothing is currently `OWNERSHIP = UNCLEAR`.

## 22. SECURITY-SENSITIVE MAP
Passwords/pepper/hash/sessions/cookie: `functions/lxa-account.js` L73–206 · remembered password handling: `renderer.js` ~L139 · authorization: `isAdminAccount` (L12) + per-action checks + `authorize` · rate limits/fraud/audit: `security.js` · DB boundary: `firebase-storage.js` + `database.rules.json` (deny-all, live-verified) · headers/CSP: `vercel.json` · blocked paths: `middleware.js`, `.vercelignore` · env secrets: Vercel only (names in §16, never values) · server-authoritative money: `spin`, `deposit`, `buy-wild` · user identity: ids and names in `accounts/` + `meta/names` · account recovery: none beyond login (no email flow; `validateEmail` is unused) — a forgotten password needs a manual database edit by the owner.
Radio add-a-station (new, security-relevant): `functions/radio.js handleSubmit` (public POST, rate limits: 8 submissions per device per hour, 15 validations per visitor per hour, 200 stored per day) → `radio-validate.js` + the SSRF guard in `radio-custom.js` (`cleanStreamUrl`, `assertPublic` on every hop, manual redirects, byte and time limits). Known limit: the guard resolves the name and `fetch` resolves it again (a DNS-rebinding race is not closed; there is no way to pin the address with the built-in `fetch`). The player cannot set status / verdict / approval / ownership; the account is recorded only after `lxa-account.verifyPlayer` accepts the session token.
Never print or commit: service-account JSON, `LXA_PEPPER`, `.env.local`.

## 23. TEST / VERIFICATION MAP
- Run: `npm test` (Jest, 21 files, 284 tests; in a cloud container without `firebase-admin` installed `storage-contract.test.js` cannot load — environment issue, not a code failure), `npm run lint`. Dev: `audit-simulations.js` (RTP simulations), `deployment-check.js` (client/server rule sync), `local-server.js` (**production Firebase** — guest mode only).
- **By area**: game → `game-engine`, `rtp-linked`; account/auth → `account-keys`, `account-id-counter`, `auth-session`, `session-cookie`, `session-race`, `name-race`, `idempotency`, `storage-contract`, `storage-failure`; leaderboard → `leaderboard-truth`, `leaderboard-position`; money/UI routing → `rtp-linked-server`, `spin-grid-letters`, `renderer-money-routing`; radio → `radio`, `radio-health` (incl. the player-submission → admin → public pipeline), `radio-custom`, `radio-popularity`, `radio-validate` (canonical addresses, frame analysis, timing, SSRF, verdicts). Runtime check used 2026-10-04: a harness serving the real site + the real `api/` handlers with an in-memory database and the REAL validation of real public streams (headless Chromium for the UI); the script is not kept in the repo.
- Server tests `require` `functions/*.js` directly with mocked storage.
- **UI/layout has no automated tests in the repo.** Past checks used headless Edge via CDP scripts kept in session scratchpads (lost between sessions; some may exist in `ClauBack\LXAV1\vN\` as `e2e_*.js`, `deep_b2.js`: NOT VERIFIED). Page-edge/header checks = pixel sampling of a full-page screenshot.
- Not verifiable here: real iPhone/Android, Safari/Firefox, installed PWA, `@property` ring on iOS < 16.4.

## 24. DOCUMENTATION / MEMORY MAP (`ClauBack\LXAV1`, read via branch `claubak-docs`)
| Item | Class | Notes |
|---|---|---|
| `NOTES.md` (18 KB) | CURRENT — the folder's own manual + version history v1–v57c | its "next change → v7" line is stale (history reaches v57c) |
| `CONTEXT\CONTEXT.md` (10 KB) | PARTLY STALE | written 2026-10-03; asset versions, test counts, `origin/main` hash outdated (§20) |
| `CONTEXT\MEMORY.md` (20 KB) | CURRENT, mostly | permanent rules + verified knowledge |
| `CONTEXT\ARCHITECTURE.md` (8.7 KB) | STALE on tests/inline scripts/radio | superseded for navigation by this index |
| `CONTEXT\CHANGELOG.md` (18 KB) | CURRENT (trimmed) | full history archived next to it |
| `CONTEXT\LXAV1_MASTER_INDEX.md` (this file) | CURRENT | navigation |
| `archive\*.before-restructure`, `CHANGELOG-full-through-2026-10-04.md` (90 KB) | HISTORICAL | do not read for normal work |
| `PROMPTS\` (`UNIVERSAL_PROMPT`, `MASTER_AUDIT_v2`, `MASTER_AUDIT_LITE`) | REUSABLE | |
| `FULL_2026-10-03_116ffd8\` | BACKUP (full code snapshot, redundant with git) | not copied to GitHub |
| `v1`…`v57c` | BACKUPS of touched files + README per change | only the READMEs are on GitHub |
Legacy parent `ClauBack\NOTES.md` + `ClauBack\CONTEXT\*` = Drollyv3: **never LXAV1 information**.
Cloud-session hand-off: the repo no longer carries notes; give a cloud session the branch `claubak-docs` (or paste CONTEXT + this index).

## 25. CLAUDE CONTEXT OPTIMIZATION MAP (ranked, not implemented)
| Rank | Finding | Idea |
|---|---|---|
| VERY HIGH | `layout-fix.css` (442 KB) and `renderer.js` (162 KB, very long lines) | grep-only rule (already in §11); split contiguous tail blocks (radio, admin radio) to own files loaded in the same order |
| VERY HIGH | no routing file at session start | use §29 + §11 of this index as the first read; ≤2 KB `CLAUDE.md` pointing here |
| HIGH | history files large | keep `CHANGELOG` trimmed (done in ClauBack); never open `archive\` |
| HIGH | radio code embedded in 6 shared files | package behind `LXARadio` + `/api/radio` (§28) |
| HIGH | UI checks lost between sessions | commit headless-browser checks per area |
| MEDIUM | `lxa-account.js` single 69 KB handler | split by action group |
| MEDIUM | stale ClauBack docs force re-discovery | sync `CONTEXT\` with this baseline |
| LOW | `package-lock.json`, `assets/` | exclude by rule |

## 26. NORMAL AUDIT EXCLUSIONS
- `assets/**`, `package-lock.json`, `.git`, `node_modules`.
- ClauBack: `archive\`, `FULL_*`, `vN\` code copies, the Drollyv3 parent folder.
- **RADIO** (`radio.js`, `admin-radio.js`, `functions/radio*.js`, `api/radio.js`, radio tests, radio CSS tail, radio nodes in `firebase-storage.js`): **EXCLUDED UNLESS EXPLICITLY REQUESTED** for non-radio tasks. Safe because the seam is small (§17). Exceptions: tasks touching `initFirebase`, CSP, `sw.js`, the admin panel layout, `index.html` script order.
- `game-engine.js`: read only for game-math tasks.
- NOT excluded: auth/session/`security.js`, `vercel.json`/`middleware.js`, header/lock/Ko-fi/overlay z-index, `index.html`.

## 27. FUTURE MODULARIZATION CANDIDATES (not implemented)
| Current → possible | Benefit | Risk | Dependencies | Difficulty |
|---|---|---|---|---|
| radio files in root → `radio/` folder (client + server + tests + README) | clear ownership, skip rule | paths in `sw.js`, `.eslintrc.json`, `index.html`, tests' `require`; an attempt exists in local branch `radio-restructure-wip` | §17 seam | LOW–MEDIUM |
| radio CSS tail of `layout-fix.css` → `radio.css` linked after it | −24 KB per read | cascade position | none | LOW |
| admin + radio-admin views of `renderer.js` (~L224–310) → separate classic script | −~40 KB per read | shares globals | `lang`, `lxaAccount`, `lxaRequest` | MEDIUM |
| `admin-radio` action → delegate module | −5 KB | shared helpers (`json`, auth) | `store`, `isAdminAccount` | LOW–MEDIUM |
| `lxa-account.js` → auth / game / admin modules | readability | shared helpers | storage, security | MEDIUM |
| old `layout-fix.css` rules → per-subsystem CSS | largest read saving | cascade, **HIGH** | everything | HIGH |
| UI checks → `e2e/<area>/` in the repo | survive sessions | needs browser tooling | Edge/CDP | MEDIUM |

## 28. RADIO VS WHOLE-SITE SEPARATION (for THIS architecture)
Facts: radio already has its own endpoint, function, cron; players need no login; one `<audio>` + MediaSession; script uses global `lang` and fixed DOM ids; admin runs inside the shared account panel; one Firebase project/`initFirebase`; `frame-ancestors 'none'` + `X-Frame-Options DENY`.
| Option | Compat. | Audio / mobile | Auth / Firebase | Deploy | Context saved | Regression risk | Rank |
|---|---|---|---|---|---|---|---|
| A. Folder isolation | high | unchanged | unchanged | trivial | high | low | **1** |
| B. Black box (A + written contract + contract tests) | high | unchanged | unchanged | trivial | highest | low | **1 (with A)** |
| C. Shadow DOM | medium (CSS must move, script uses DOM ids) | same page → audio unchanged | unchanged | trivial | medium | medium | 3 |
| D. iframe / micro-app | low (needs CSP + X-Frame relaxed; iOS background audio + lock-screen controls risk; language sync) | **risky** | admin sync needed | medium | high | high | 4 |
| E. Separate deployable app | low (CORS/CSP, cron, domain, duplicated Firebase env, split admin API) | risky | duplicated | high | high | high | 5 |
Recommendation from the actual architecture: A + B first; C optional later; avoid D/E.

---
## 31. INDEX MAINTENANCE RULE
Update this file whenever a change alters: file location · module ownership · dependency relationship · script order · entry point · API contract or action list · configuration ownership · persistence path or Firebase structure · backend routing/headers/cron · deployment architecture · module boundaries · audit exclusions. Do NOT update for text/style tweaks or version bumps. When updating: change the affected section, refresh §33, keep it a map (no code, no history).

## 32. INDEX INTEGRITY CHECK (this pass)
- **VERIFIED**: file paths and sizes from `git ls-files` at `ca2e4ab`; script order from `index.html`; the 20 account actions, env names, Firebase paths, rate limits, admin authorization (`isAdminAccount`), `validateEmail` unused, event names and handler anchors by grep/read; headers from `vercel.json`; live Firebase rules by the owner's paste; cleanup list checked reference by reference.
- **NOT VERIFIED**: ClauBack folders other than those on `claubak-docs`; Vercel Git integration / preview deploys; whether CSP `connect-src` for Firebase is needed; CSS/JS subsystem percentages and the "12 reassigned functions" claim (author estimates); multi-instance rate-limit behaviour; real-device behaviour (iOS, Android, installed PWA); the full Jest result in a normal environment (19 of 20 suites ran in the cloud container: 242 tests passed; `storage-contract` needs `firebase-admin`).
- No secret values written. No runtime file modified for this document. No Drollyv3 text used as current LXAV1 fact.

## 33. BASELINE SNAPSHOT
| Field | Value |
|---|---|
| Marker | MASTER INDEX BASELINE v2.1 (radio flow updated) |
| Date | 2026-10-04 |
| Project path | `C:\Users\leon4\Desktop\LXAV1` (GitHub `leoxoxana/LXAV1`) |
| Observed commit | `f024a06` (`origin/main`: radio validation + player submissions; before it `ca2e4ab` = cleanup) |
| Workspace path | `C:\Users\leon4\Desktop\ClauBack\LXAV1\CONTEXT` |
| Scope | whole repo + ClauBack notes as copied to branch `claubak-docs` |
| Verification status | see §32 (VERIFIED / NOT VERIFIED lists) |
| Not in baseline | local branch `radio-restructure-wip` (unfinished radio folder move) |
| Supersedes | v1 index (35 KB, 2026-10-04, baseline `0f5a8d0`) |

## 34. MEMORY / CHANGELOG ENTRY (to add in ClauBack\LXAV1)
- `CONTEXT\CONTEXT.md`: one line — "Master Index v2 created 2026-10-04 (`CONTEXT\LXAV1_MASTER_INDEX.md`, baseline `ca2e4ab`). Start every task there. Authoritative project path `C:\Users\leon4\Desktop\LXAV1`; knowledge workspace `ClauBack\LXAV1`; the parent `ClauBack` is legacy Drollyv3 and never LXAV1 information. Update the index only when architecture changes (§31)."
- `CONTEXT\CHANGELOG.md`: one entry "2026-10-04 — Master Index v2 created (docs only); `main` cleaned: docs-context, scripts/build.js and 13 unreferenced images removed (commit `ca2e4ab`)."
- `NOTES.md`: add `LXAV1_MASTER_INDEX.md` to the list of documents in `CONTEXT\` (now 5) and fix the "next change → v7" line.
