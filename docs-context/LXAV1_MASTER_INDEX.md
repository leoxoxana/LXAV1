# LXAV1 — MASTER INDEX

**MASTER INDEX BASELINE** — observed 2026-10-04, git `0f5a8d0` (origin/main). Documentation only: no runtime file was touched.
Scope: whole repo. Method: file sizes/line counts, grep of entry points, Firebase paths, env names, globals, test requires. Nothing here was run in a browser.
Status words: **VERIFIED** (read in code at this commit) / **NOT VERIFIED** (stated by older docs or inferred).

## 0. Paths and the Drollyv3 rule
| Role | Path | Status |
|---|---|---|
| Runtime / deployable source of truth | `C:\Users\leon4\Desktop\LXAV1` (cloud copy: `/home/user/LXAV1`) | AUTHORITATIVE |
| Knowledge workspace (target) | `C:\Users\leon4\Desktop\ClauBack\LXAV1` | NOT REACHABLE from the cloud session. This file was written to `docs-context/` in the repo; **copy it** to ClauBack\LXAV1 by hand. |
| Legacy | `C:\Users\leon4\Desktop\ClauBack` (parent: old Drollyv3 + others) | NEVER current LXAV1 information. Drolly notes may only be read when explicitly asked. |

Source priority: executable code > deployed config (`vercel.json`, env names) > docs that match code > ClauBack\LXAV1 memory > history > legacy. Conflicts are in §20.

## 29. NAVIGATION TREE (start here)
```
LXAV1
├─ AUTH/SESSION  → §14   functions/lxa-account.js (L73-206, 245), renderer.js (L124-145, 335), session-*.test.js
├─ ACCOUNT       → §9.3  functions/lxa-account.js actions create/login/update, firebase-storage.js
├─ GAME/SPIN/BET → §9.4  game-engine.js, renderer.js spin+stake, spin-button.js, lxa-account.js `spin`
├─ ADMIN         → §9.7  renderer.js L259-309 (+admin-radio.js), lxa-account.js admin-* actions
├─ LEADERBOARD   → §9.8  firebase-storage.js getLeaderboard/…, lxa-account.js `leaderboard`
├─ FIREBASE      → §15   functions/firebase-storage.js (only file that talks to the DB), database.rules.json
├─ VERCEL/API    → §16   vercel.json, middleware.js, api/*.js, .vercelignore
├─ RADIO         → §17   radio.js, admin-radio.js, functions/radio*.js, api/radio.js (+ embeds in 6 shared files)
├─ UI/CSS/MOBILE → §9.2  style.css → layout-fix.css (5954 lines) → responsive-compact.css, header-fit.js
├─ PWA           → §9.9  manifest.webmanifest, sw.js, sw-register.js
├─ CONFIG        → §21   env: FIREBASE_DATABASE_URL, FIREBASE_SERVICE_ACCOUNT, LXA_PEPPER, RADIO_HIDE
├─ TESTS         → §23   20 *.test.js (Jest), audit-simulations.js, deployment-check.js
└─ DOCS/MEMORY   → §24   docs-context/*.md
```

## A. Project identity
- **Name**: LXAV1 = LEONXOXANA reskin of Drollyv3. Virtual credits only, no real money. Package `lxa-virtual-reels` 2.0.0, Node >=18.
- **Deploy model**: Vercel. Static site = repo root served as-is (`outputDirectory "."`, no build); serverless Node functions in `api/` (region `fra1`); Edge middleware `middleware.js`. **Only the owner deploys** (`vercel --prod`). Domains: lxoxa.vercel.app (primary), lxav1.vercel.app, lxa-lxa3.vercel.app (from MEMORY.md, NOT VERIFIED here).
- **Frontend**: plain HTML + classic global scripts + 3 CSS files. No framework, no bundler, no modules. Languages de (default) / ro / en inside `renderer.js`.
- **Backend**: two Vercel functions (`api/lxa-account.js`, `api/radio.js`) that adapt `(req,res)` to a Netlify-style `handler(event)` in `functions/`. Note: the code comments say "Netlify" for historical reasons; **Netlify is not used** (no netlify.toml).
- **Database**: Firebase Realtime Database via `firebase-admin` (server only). Rules `database.rules.json` = read/write false (client has no direct DB access).
- **Auth**: custom (not Firebase Auth): id-or-name + password ("safeWord", peppered hash), per-device session token (sha256 stored) + httpOnly cookie `lxa_sid`. Admin = `role:"admin"` on the account.
- **External services**: Radio Browser API mirrors (de1/nl1/at1.api.radio-browser.info) and arbitrary station stream URLs (server probes them); Ko-fi (static gifs/link). Fonts are self-hosted.
- **Constraints**: CSP `script-src 'self'` (no inline scripts), `media-src 'self' https:`; cron `GET /api/radio?refresh=1` daily 05:00 UTC; `functions/` and tests are blocked from the web by middleware.

## B. Directory map
| Path | Purpose | Class | Excluded from normal audits? |
|---|---|---|---|
| `/` (root) | all client code, tests, config (flat) | runtime + source + tests | no |
| `api/` | Vercel function adapters (2 files, ~2 KB) | runtime | no |
| `functions/` | all server logic (8 files, ~165 KB) | runtime, security-sensitive | no (radio-* yes unless radio task) |
| `assets/` | fonts, icons, letters, wild art, header webp, ko-fi gifs | runtime assets (binary) | **yes** |
| `assets/` unreferenced art (4 big PNG/GIF, `wild.webp`, `wild-line/tall.webp`, `lxa-header.gif`, `ezgif…`) | source art; `.vercelignore`-d | legacy/unused | **yes**; do not delete without approval |
| `docs-context/` | project memory (CONTEXT, MEMORY, ARCHITECTURE, CHANGELOG, this index, `prompts/`) | documentation | yes except for resume |
| `scripts/` | `build.js` (copies to dist/; **not used by Vercel**) | legacy | yes |
| `.git`, `node_modules` | — | generated | yes |
Not in repo: ClauBack (backups/snapshots/old Drolly material, local only).

## C. File map (runtime and config; sizes at `0f5a8d0`)
Risk: H high / M medium / L low. "Big" = expensive to read; use grep, never full read.
| File | Size | Role | Subsystem | Risk |
|---|---|---|---|---|
| `index.html` | 14 KB/38 lines | markup; loads 7 scripts + 3 CSS; no inline script | shell | M |
| `style.css` | 42 KB | base styles, `--lxa-*` tokens | UI | M |
| **`layout-fix.css`** | **442 KB / 5954 lines** | override layer, appended blocks, 6k+ `!important`, `:not(#_)` specificity hacks | UI/layout (all subsystems) | **H, BIG** |
| `responsive-compact.css` | 12 KB | compact breakpoints, still linked | UI | M |
| `game-engine.js` | 49 KB/738 | UMD pure rules (also `require`d by server and Jest) | game | H |
| **`renderer.js`** | **162 KB / 1566** | client app: i18n table, game UI, stake, spin flow, account/auth, admin views, leaderboard, confirm dialog | everything client | **H, BIG** (very long lines) |
| `spin-button.js` | 9 KB | SPIN/STOP button + progress ring, `window.LXASpinButton` | spin UI | M |
| `header-fit.js` | 20 KB | header/lock/Ko-fi fitting + zoom/lock handling | header | M (caused cross-bug lock+zoom) |
| `boot-wild-preload.js` | tiny | picks wild art preload by viewport | shell | L |
| `sw.js`, `sw-register.js` | 1.6 KB, tiny | service worker (network-first, cache `lxa-v3-cache`), registration | PWA | M |
| `manifest.webmanifest` | 0.7 KB | PWA manifest | PWA | L |
| `radio.js` | 41 KB/392 | player + list, `window.LXARadio` | radio | M |
| `admin-radio.js` | 20 KB/137 | admin radio tabs, `window.LXAAdminRadio` | radio-admin | M |
| `api/lxa-account.js` | 1.7 KB | adapter → `functions/lxa-account.js` | backend | M |
| `api/radio.js` | 0.7 KB | adapter → `functions/radio.js` | backend/radio | L |
| **`functions/lxa-account.js`** | **69 KB/636** | the account+game+admin API, 20 actions, sessions, cookie | auth/account/game/admin/leaderboard/radio-admin | **H, BIG** |
| `functions/firebase-storage.js` | 12 KB/286 | the ONLY DB access layer (accounts, leaderboard, rtp, meta, radio nodes) | firebase | H |
| `functions/security.js` | 7 KB | validateBet, rate limits, audit/fraud log, idempotency helpers | security | H |
| `functions/radio.js` | 45 KB/404 | list builder/cache, probes, Radio Browser, fav/suggest/report handlers, `handler` | radio | M |
| `functions/radio-custom.js` / `-popularity.js` / `-reports.js` | 14/6/5 KB | player stations resolver / MANELE popularity order / health reports | radio | L |
| `vercel.json`, `middleware.js`, `.vercelignore` | 1.4/1.7/0.7 KB | headers+CSP+cron, 404 on sensitive paths, upload excludes | deploy/security | H |
| `database.rules.json` | 61 B | deny-all client rules | firebase/security | H |
| `local-server.js` | 3 KB | dev server on :8888, **talks to PRODUCTION Firebase** | dev | M |
| `.eslintrc.json`, `package.json`, `package-lock.json` (240 KB, ignore) | — | config | tooling | L |
| `audit-simulations.js` (13 KB), `deployment-check.js` (4.5 KB) | — | dev diagnostics (RTP sims; client/server rule sync) | tests | L |
| `readme.md` | 9.5 KB | user-facing readme (blocked by middleware: `*.md`) | docs | L |

## 9. Subsystems (identity · entry · deps · data · risk · read/skip)
### 9.1 Application shell
`index.html` → script order is meaningful and **undocumented in code**: `boot-wild-preload` → `game-engine` → `spin-button` → `admin-radio` → `renderer` → `radio` → `sw-register` → `header-fit`. `renderer.js` runs while the DOM is partly parsed (comment at L190). `admin-radio.js` must load before `renderer.js`; `radio.js` after. Read: index.html. Skip: assets.

### 9.2 UI / layout / responsive / mobile
Cascade: `style.css` → `layout-fix.css` → `responsive-compact.css`. `layout-fix.css` is patched by appended blocks (version comments V98…V366+), wins by `html body:not(#_):not(#__)… !important`; **order matters, never move rules**. Rough content: game ≈38 %, header/lock/Ko-fi ≈23 %, base ≈22 %, account ≈7 %, radio ≈6 % (author-supplied estimate, NOT VERIFIED by me). Radio CSS is the contiguous tail ~L5773–5955 (verified by grep). Page background lives on `<html>` (#272079). Debug with computed styles, not by reading CSS. Read: grep selector family in `layout-fix.css`; `header-fit.js` for lock/Ko-fi/zoom. Skip: whole-file reads.

### 9.3 Account (create/login/update/logout)
Client: `renderer.js` (`accountText`, `renderAccountPanel` L259, `lxaRestoreSession` L335, remembered password L139, auth log L130). Server: `functions/lxa-account.js` actions `create, login, logout, update`. Storage: Firebase `accounts/<id> : <name>` (key renamed on save when name changes; lookup by `id` field), `meta/lastAccountId` (counter), `meta/names/<hash>` (name uniqueness transaction). Tests: `account-keys`, `account-id-counter`, `name-race`, `auth-session`.

### 9.4 Game / spin / bet / payouts
- Rules: `game-engine.js` (5 lines × 10 columns, word LEONXOXANA, PAYTABLE, WILD, jackpot mission, RTP functions; `resolveSpin`, `maxBetForWildLevel`, `wildUpgradeCost`, `wildChance`). Exported as `module.exports` (server/Jest) and browser global.
- Server-authoritative spin for logged-in players: `lxa-account.js` action `spin` (validateBet in `security.js` → `applyRtpSettings` from Firebase `rtpSettings` → WILD cap check → resolve → save account + leaderboard). Guests: `resolveSpin` in the browser, state in localStorage `lxa-v107-game-state`.
- **Client and server keep separate copies of WILD placement/payout code** (ARCHITECTURE.md; synced by hand; `deployment-check.js` compares numbers). → duplication, §20.
- Stake controls (+, hold, 50 %, AUTO, MAX line) in `renderer.js` (`setLocalBet`/`normalizeLocalBet`, `bindHoldBet`, `#betMax`); cap enforced in 3 places (engine, server, UI).
- Spin UI: `spin-button.js` (pointerdown, ring synced via `LXASpinButton.landing(ms)`), reels in `renderer.js` (`startReelSpin`).
- Tests: `game-engine`, `rtp-linked`, `rtp-linked-server`, `spin-grid-letters`, `idempotency`, `renderer-money-routing`.

### 9.5 Session / persistence
See §14. Client keys: `lxa-session-token-v1`, `lxa-account-cache-v1`, `lxa-last-restore-v1`, `lxa-auth-log-v1`, `lxaLang`, `lxa-v107-game-state`; cookie `lxa_seen`; server cookie `lxa_sid`.

### 9.6 Security helpers
`functions/security.js`: `validateBet`, `checkRateLimit`, `checkGlobalRateLimit`, `auditAction`, `detectFraud`, `sanitizeInput`, `validateEmail`. Rate limits + idempotency cache are in-memory per function instance (NOT VERIFIED for multi-instance behaviour).

### 9.7 Admin
Client: `renderer.js` L259–309 (hub, rtp-admin, jackpot-admin, custom-admin, players, radio-admin) + `admin-radio.js`. Server: actions `get/set/reset-rtp-settings, set-custom-distribution, reset-leaderboard, list-players, admin-update-player, admin-delete-player, admin-radio`. `LXA_PROTECTED_ACTIONS` list at renderer L234 (client-side re-login gate); the server is the authority (role check) — NOT VERIFIED line by line.

### 9.8 Leaderboard
Server action `leaderboard`, written during `spin`; Firebase `leaderboard`; strict reads (fail closed). Tests `leaderboard-truth`, `leaderboard-position`. Client: rank line under the stake in `renderer.js`.

### 9.9 PWA / service worker
`sw.js` network-first, API never cached, asset list hard-coded (must be kept in step when files are added/renamed — it already lists radio.js/admin-radio.js/header-fit.js). Install-button: none (owner request needed).

### 9.10 Dev / diagnostics
`?debug=1` log in `spin-button.js`, auth log in localStorage, `audit-simulations.js`, `deployment-check.js`, `local-server.js`. `scripts/build.js` unused.

## 12. Data flows (only flows that exist)
- **Login**: login form (`renderer.js`) → `lxaRequest` POST `/api/lxa-account` `{action:'login',id|name,safeWord}` → rate limit (10/h/IP) → `checkSafeWord` → `issueSession` (token to body + `Set-Cookie lxa_sid`) → `firebase-storage.updateAccount` → response `publicAccount` → `lxaAccount` + `lxa-account-cache-v1` + token in localStorage.
- **Silent restore**: page load → `lxaRestoreSession` (renderer L335) → `login` `{silent:true, token}`; if the token is missing, server uses cookie `lxa_sid` (same-site requests only) → account loaded.
- **Spin (account)**: tap → `spin-button` pointerdown → `#spin` handler → `startReelSpin` immediately → `lxaAccountResolveSpin` POST `spin` `{bet, requestId, token}` → `validateBet` + cap + idempotency → `game.resolveSpin`-equivalent server copy → transaction save account + leaderboard → response → `LXASpinButton.landing(ms)` → reels stop → state + summary. Failure → `LXASpinButton.fail(...)`.
- **Spin (guest)**: same UI, `game.resolveSpin` in browser, localStorage state.
- **Bet**: `setLocalBet` clamps to min(balance, `maxBetForWildLevel`); server rejects above cap with HTTP 400.
- **WILD purchase**: `buy-wild` (limit 100/h) → price from `wildUpgradeCost`.
- **Radio list**: `radio.js` GET `/api/radio` → `functions/radio.js getList` (memory cache → Firebase `meta/radio` → build from Radio Browser + probes; cron refresh daily) → stations JSON → localStorage `lxa-radio-list-v3`.
- **Radio playback**: one `<audio>`, station URL direct from the provider (`media-src https:`), failures → `report` POST `/api/radio` → `radio-reports` → Firebase `radioReports/*`.
- **Admin radio**: renderer `open-radio-admin` → POST `admin-radio` on `/api/lxa-account` (role check) → `store.get/set…` nodes → response → `lxaRadioCache` → `LXAAdminRadio`.
- **Persistence**: every account change goes through `firebase-storage.updateAccount` (transaction).

## 14. Auth / session architecture
- **AUTH SESSION** (authoritative = server): account node `accounts/<key>` fields `safeWord` (hash, peppered with `LXA_PEPPER`), `sessions[] {h: sha256(token), at}` (max 25 devices), legacy `sessionToken`, `role`. Plain token exists only on the device.
- Session ops are recorded as in-memory ops on the account and merged inside the DB transaction (`mergeSessions`, L94) so concurrent requests cannot wipe a fresh session. Tests `session-race`, `session-cookie`, `auth-session`.
- Cookie: `lxa_sid`, HttpOnly, Secure, SameSite=Lax, Path=/api, 400 days; used only when the request has no token, only same-site.
- Normal play actions need a valid token (`authorize`, L106); sensitive ones (password change, admin) need the password (`checkSafeWord`).
- Logout: `revokeSession` server side; offline logout is queued (renderer L143).
- Expiration/refresh: no expiry other than cookie Max-Age and the 25-device cap (VERIFIED by grep; no refresh endpoint).
- **GAME/OPERATION STATE** is separate: `gameState` in `renderer.js` (global), mirrored to the account node on the server for logged-in players, to localStorage for guests.
- Firebase Auth: **not used**.

## 15. Firebase master map
- Config: env `FIREBASE_DATABASE_URL` (default URL fallback in `firebase-storage.js`, sanitised), `FIREBASE_SERVICE_ACCOUNT` (JSON, Vercel only). Never in repo.
- Access: server only, `firebase-admin`, `initFirebase()` (shared by all storage functions). Client has no Firebase SDK. CSP `connect-src` still allows `*.firebasedatabase.app` (unneeded; NOT VERIFIED that nothing uses it).
- Rules: deny-all; **the file is not deployed by Vercel** — whether the live project uses these rules is NOT VERIFIED (Firebase console).
- Paths (VERIFIED in `firebase-storage.js`): `accounts/<id : name>`, `leaderboard`, `rtpSettings`, `meta/lastAccountId`, `meta/names/<hash>`, `meta/radio` (cached list), `meta/radioHide`, `meta/radioMove`, `meta/radioFav` (counters), `meta/radioRejected`, `meta/radioCustoms`, `meta/radioSuggestDay`, `radioReports/<key>`, `radioSuggest/<key>`, `radioFavDev/<device>/<key>`.
- Authoritative: accounts (balance, wild level, sessions), rtpSettings (admin odds). Derived: leaderboard (from accounts at spin time), `meta/radio` (rebuildable), `meta/radioFav` (from radioFavDev).
- Conflict points: key rename on name change (`save()` migration), legacy `account:N` nodes, production still holds test accounts (zzprobe*, lxatest*, lxaspd*) — owner cleans.

## 16. Backend / Vercel master map
- Entry: `/api/lxa-account` (GET/POST/OPTIONS) and `/api/radio` (GET `?refresh/recheck/resolve`, POST actions fav/suggest/report). No redirects/rewrites in `vercel.json`.
- Headers (all paths): no-cache, X-Frame-Options DENY, nosniff, strict referrer, CSP (script-src 'self'), HSTS, Permissions-Policy, COOP same-origin.
- `functions.api/radio.js.maxDuration` 60 s; cron daily `GET /api/radio?refresh=1`.
- `middleware.js` returns 404 for `/functions/`, package*.json, `*.test.js`, dev tools, `*.md`, `*.bak`, `/data/`, `/node_modules/`. The `.vercelignore` additionally keeps tests/docs out of the upload.
- Env names: FIREBASE_DATABASE_URL, FIREBASE_SERVICE_ACCOUNT, LXA_PEPPER, RADIO_HIDE (optional), VERCEL_ENV.
- Server-authoritative: spin, deposits, WILD purchase, sessions, all admin actions, radio list.
- Lesson: env vars added after a deploy need a redeploy ("Server temporarily unavailable" on login).

## 17. RADIO master map
**Pieces**: client `radio.js` (`window.LXARadio`), `admin-radio.js` (`window.LXAAdminRadio`); server `api/radio.js` → `functions/radio.js` (+ `-custom`, `-popularity`, `-reports`); Firebase nodes in §15; tests `radio`, `radio-health`, `radio-custom`, `radio-popularity` (129 tests, ≈ 90 KB of test code).
- **Entry**: bar `#radioBar` (+ `radioPlay/Prev/Next/Title/Name/Status/Vol/Flag/Toggle`) in `index.html`, script `radio.js`. Placement: its own grid row above the Ko-fi goal.
- **UI/state**: radio.js localStorage keys `lxa-radio-v1`, `-list-v3`, `-bad-v1`, `-fav-v1`, `-mine-v1` (player's own stations, device-private, max 10), `-rep-v1`, `-dev-v1`. One `<audio>`; MediaSession API.
- **Radio Browser**: `functions/radio.js radioBrowser()` mirrors de1/nl1/at1; categories scored by `categoryScore`; stream health via `probeStream`/`diagnose` (server-side probes); `blockedUrl` guard.
- **User stations**: `+` (private, plays at once, top of Favorites) and `📨` (offer to owner → `radioSuggest`, daily cap `meta/radioSuggestDay`), approval in admin → `meta/radioCustoms`, resolver `radio-custom.resolveStation`.
- **Admin**: tab inside the account panel (`renderer.js` L281-285, 308-309) delegating to `LXAAdminRadio`; server action `admin-radio` in `lxa-account.js` L561–~600 (ops list/hide/resolve/suggestions/approve/reject).
- **Radio needs from the rest of LXAV1** (VERIFIED by grep): global `lang` (fallback localStorage `lxaLang`); ~28 DOM ids in `index.html`; `/api/radio` URL; the shared Vercel project/CSP (`media-src https:`). `admin-radio.js` needs six names from `renderer.js`: `lxaRequest, lxaAccount, renderAccountPanel, lxaRadioCache, lang, lxaConfirm`.
- **The rest needs from Radio**: `window.LXARadio`, `window.LXAAdminRadio`, the `admin-radio` action, `firebase-storage.js` radio functions, `sw.js` asset entries, ESLint override entry.
- **Embedded in shared files** (grep counts of "radio"): `layout-fix.css` 117 (tail block L5773–5955), `functions/firebase-storage.js` 58 (L117–205), `functions/lxa-account.js` 30 (`admin-radio` L561–600), `renderer.js` 15 lines (L124,190,224,234,259,278-285,297,308-309), `index.html` 2, `sw.js` 2, `.eslintrc.json` 3, `vercel.json` (maxDuration + cron).
- **Isolation level today**: partial. Own client files, own API endpoint, own functions; auth-free for players (device id), admin through the shared account API. Seam is narrow and clean.

## 18. Large-file / monolith map
| File | Subsystems inside | Why big | Extraction risk |
|---|---|---|---|
| `layout-fix.css` 442 KB | game, header, base, account, radio, admin, confirm, PWA-standalone | append-only patch history, 6k+ `!important`, 189 selectors rewritten 4+ times (author estimate) | contiguous tail blocks (radio, admin radio): LOW; old rules by subsystem: **HIGH** (cascade order) |
| `renderer.js` 162 KB | i18n (`t`, `tx118`), game UI, stake, spin, account/auth, admin views, radio admin view, confirm, leaderboard | single global scope, very long lines (one ≈10 KB) | admin/account/radio views (L224–310): LOW-MEDIUM; core state (`gameState`, `lang`, `lxaAccount`): HIGH |
| `functions/lxa-account.js` 69 KB | auth, account, game, admin, leaderboard, radio-admin | one handler dispatching 20 actions | split by action group: MEDIUM (shared helpers) |
| `game-engine.js` 49 KB | rules+RTP, UMD for browser+server | shared core | do not split; black box with tests |
| `functions/radio.js` 45 KB, `radio.js` 41 KB | radio only | self-contained | already isolated |

## 19. Coupling map
| Coupling | Level | Why |
|---|---|---|
| `renderer.js` globals (`gameState`, `lxaAccount`, `lang`) used across game/account/admin/radio-admin | **CRITICAL** | one global scope; ~124/91/72 references (author-measured) |
| Cascade order in `layout-fix.css` | **CRITICAL** | moving a rule changes appearance |
| Script load order (`index.html`) | HIGH | undocumented dependency |
| Client/server duplicated WILD/payout rules | HIGH | must stay equal by hand |
| `functions/lxa-account.js` ↔ `firebase-storage.js` | MEDIUM | one storage API, all transactions |
| `firebase-storage.js initFirebase` shared by account and radio | MEDIUM | one init |
| Header/lock/Ko-fi/zoom (`header-fit.js` + CSS + inline z-index) | HIGH | already produced a lock+zoom cross-bug |
| `admin-radio.js` → six renderer names | MEDIUM | narrow, explicit |
| `radio.js` → `lang` + DOM ids | LOW | narrow |
| `api/radio` ↔ account API | LOW | separate endpoints, separate functions |
| Circular dependencies | none found among server files (`lxa-account` requires radio lazily); client has no module graph |

## 20. Duplication / conflict map
- **CONFLICT / NEEDS RESOLUTION** — service-worker cache name: `docs-context/MEMORY.md` says `lxa-v2-cache`; `sw.js` says `lxa-v3-cache`. Code wins (priority 1). Doc stale.
- **CONFLICT** — `docs-context/ARCHITECTURE.md` §1 says index.html has "inline scripts" and "7 test files"; code now has no inline scripts (CSP `script-src 'self'`) and 20 test files; also does not list radio, header-fit.js, boot-wild-preload, sw-register. Doc stale (rewritten for commit `c82da19`).
- **CONFLICT** — `docs-context/CONTEXT.md` asset versions (layout-fix 434, renderer 403) vs `index.html` (layout-fix 497, renderer 428). Code wins.
- Duplicate logic: WILD placement/payout (client engine vs server copy); account name/ID helpers; `lang` fallback logic in radio.js vs renderer.
- Multiple definitions: `renderer.js` re-assigns base functions later in the file ("12 reassignments" per the other session; NOT VERIFIED by me); old CSS rules overridden by later blocks (279 version comments).
- Legacy still present: `responsive-compact.css` (still linked), `scripts/build.js` (unused), `middleware.js` BLOCKED list and comment mention `bot-player.js` (file absent); `api/lxa-account.js` and `middleware.js` comments mention Netlify.
- Unreferenced assets (see §B).
- Dead code candidates: not scanned (NOT VERIFIED); do not delete without approval.

## 21. Configuration ownership
| Behavior | Authoritative | Fallback | Who edits |
|---|---|---|---|
| Admin odds/RTP/costs | Firebase `rtpSettings` (server `applyRtpSettings`) | code defaults in `game-engine.js` (production `settings:{}` = defaults) | admin via admin actions |
| Max stake | `maxBetForWildLevel` in `game-engine.js` (client+server share the file) | none | code only |
| Language | localStorage `lxaLang`, default `de` | — | player |
| Radio hide list | Firebase `meta/radioHide` + env `RADIO_HIDE` | — | admin / owner. **OWNERSHIP = UNCLEAR** which wins when both set (NOT VERIFIED) |
| Radio category order | code (`CATEGORIES`, popularity) + `meta/radioMove` | — | admin |
| CSP/headers, cron | `vercel.json` | — | owner (deploy) |
| DB secrets | Vercel env | — | owner |
| Asset version query (`?v=`) | `index.html` | — | bump on every client edit (manual) |

## 22. Security-sensitive map
passwords/pepper/hash/sessions/cookie: `functions/lxa-account.js` L73–206; remembered password in memory only (renderer L139); admin role + protected actions: `lxa-account.js` handler + `LXA_PROTECTED_ACTIONS`; rate limits/fraud/audit: `security.js`; DB access boundary: `firebase-storage.js` + `database.rules.json`; headers/CSP: `vercel.json`; blocked paths: `middleware.js`, `.vercelignore`; env secrets: Vercel only (never in repo; do not print). Account recovery: none beyond login with id/name + password (no email flow found, `validateEmail` helper exists in security.js — usage NOT VERIFIED).

## 23. Test / verification map
- Run: `npx jest` (20 files). `npx eslint .`. Dev: `audit-simulations.js` (RTP simulations), `deployment-check.js` (client/server rule sync).
- By area: game → `game-engine`, `rtp-linked`; account/auth → `account-keys`, `account-id-counter`, `auth-session`, `session-cookie`, `session-race`, `name-race`, `idempotency`, `storage-contract`, `storage-failure`; leaderboard → `leaderboard-truth`, `leaderboard-position`; spin/money → `rtp-linked-server`, `spin-grid-letters`, `renderer-money-routing`; radio → `radio`, `radio-health`, `radio-custom`, `radio-popularity`.
- Server tests `require` `functions/*.js` directly with a stubbed storage; UI/layout has **no automated tests in the repo** (headless-Edge scripts lived in sessions' scratchpads and are lost; NOT VERIFIED that they exist elsewhere).
- Last verified count recorded in docs: 56 tests (older); I did not re-run the suite for this documentation task.

## 24. Documentation / memory map (`docs-context/`)
| File | Size | Class |
|---|---|---|
| `CONTEXT.md` | 10 KB | current state — partly stale (§20) |
| `MEMORY.md` | 20 KB | permanent rules + game rules; mostly current, SW name stale |
| `ARCHITECTURE.md` | 8.7 KB | rewritten 2026-10-03; stale on tests/inline scripts/radio |
| `CHANGELOG.md` | 90 KB | history; **do not read fully** — newest entry first |
| `prompts/` (`MASTER_AUDIT_LITE`, `MASTER_AUDIT_v2`, `UNIVERSAL_PROMPT`) | 38 KB | reusable prompts; historical |
| `LXAV1_MASTER_INDEX.md` (this file) | — | navigation |
ClauBack\LXAV1 itself could not be inspected: its snapshots/backups are NOT VERIFIED.

## 11. WHERE TO LOOK (task → minimum file set)
| Task | Open first | Then, only if needed |
|---|---|---|
| LOGIN / AUTH bug | `functions/lxa-account.js` L73–260 (grep `login`, `authorize`) · `renderer.js` grep `lxaRestoreSession`, `lxaRequest` | `security.js` rate limits · `auth-session.test.js` |
| SESSION / "logged out" bug | `lxa-account.js` `tokenMatches/mergeSessions/readSessionCookie` · renderer L124–145, 335 · auth log in localStorage | `session-race.test.js`, `session-cookie.test.js` |
| ACCOUNT bug (name, id, password) | `lxa-account.js` actions `create/update` · `firebase-storage.js` L55–110 | `account-keys.test.js`, `name-race.test.js` |
| BET / stake cap | `game-engine.js maxBetForWildLevel` · `renderer.js` grep `setLocalBet` · `lxa-account.js` `spin` | `game-engine.test.js` |
| SPIN / reels / ring | `spin-button.js` · `renderer.js` grep `startReelSpin`, `onclick` of `#spin` | `lxa-account.js` `spin` |
| PAYOUT / RTP / WILD | `game-engine.js` · `lxa-account.js` `spin`, `buy-wild`, `applyRtpSettings` | `rtp-linked*.test.js`, `deployment-check.js` |
| LEADERBOARD | `firebase-storage.js` L205–230 · `lxa-account.js` `leaderboard` | `leaderboard-*.test.js` |
| ADMIN (non-radio) | `renderer.js` L259–310 · `lxa-account.js` admin-* | — |
| FIREBASE data bug | `firebase-storage.js` · `lxa-account.js save()` L130–165 | `storage-*.test.js`, env names (§16) |
| RADIO bug (player) | `radio.js` · `/api/radio` → `functions/radio.js` | `radio-reports.js`, `radio-health.test.js` |
| RADIO admin / stations of players | `admin-radio.js` · `lxa-account.js` L561–600 · `radio-custom.js` | `renderer.js` L281–285, 308 |
| CSS / mobile layout | grep selector in `layout-fix.css`; `responsive-compact.css`; computed style via CDP | `index.html` for structure; `header-fit.js` for header/lock/zoom |
| HEADER / lock / Ko-fi / zoom | `header-fit.js` · `layout-fix.css` grep `.topbar`, `.brand`, `lock` | `index.html` viewport meta |
| Page edges / overscroll | `layout-fix.css` root background blocks · `index.html` | — |
| PWA / install | `sw.js`, `sw-register.js`, `manifest.webmanifest` | — |
| DEPLOYMENT / headers / blocked file | `vercel.json`, `middleware.js`, `.vercelignore` | `deployment-check.js` |
| TEXT / translation | `renderer.js` `t`, `tx118`, `accountText`, `data-i` markup; radio texts in `radio.js` `TEXT`; CSS `content:` strings | — |
| TESTS fail | the named test file + the one `functions/` file it requires | — |

## 25. Claude context optimization (ranked, not implemented)
| Rank | Finding | Fix idea |
|---|---|---|
| VERY HIGH | `layout-fix.css` (442 KB) and `renderer.js` (162 KB, very long lines) read for unrelated tasks | always grep; split contiguous tail blocks (radio/admin) into own files loaded in same order |
| VERY HIGH | this index + a ≤2 KB routing note (CLAUDE.md) | adopt this file as the start |
| HIGH | `CHANGELOG.md` 90 KB loaded for resume | keep last ~10 entries in repo; archive rest to ClauBack\LXAV1 |
| HIGH | radio code embedded in 6 shared files | package radio behind `LXARadio` + `/api/radio` seam |
| HIGH | no UI tests in repo | commit headless-browser checks per area |
| MEDIUM | `lxa-account.js` 69 KB single handler | split by action group |
| MEDIUM | stale docs (§20) cause re-discovery | refresh ARCHITECTURE/CONTEXT in one pass |
| LOW | `package-lock.json`, assets | exclude by routing rule |

## 26. NORMAL AUDIT EXCLUSIONS
- `assets/**`, `package-lock.json`, `.git`, `node_modules`, unreferenced art, `scripts/build.js`, `docs-context/CHANGELOG.md` (except top entry), `docs-context/prompts/`.
- **Radio** (`radio.js`, `admin-radio.js`, `functions/radio*.js`, `api/radio.js`, radio tests, CSS tail L5773–5955, radio nodes in firebase-storage): **EXCLUDED UNLESS EXPLICITLY REQUESTED** for non-radio tasks. Safe because the seam is §17 (shared `lang`, DOM ids, six renderer names, `admin-radio` action). Exception: any task touching `firebase-storage.js initFirebase`, CSP, `sw.js`, or the admin panel layout.
- `game-engine.js`: read only for game-math tasks.
- NOT excluded: auth/session/`security.js`, `vercel.json`/`middleware.js`, header/lock/Ko-fi/overlay z-index.

## 27. Modularization candidates (not implemented)
| Current | Possible | Benefit | Risk | Difficulty |
|---|---|---|---|---|
| radio files in root | `radio/` folder (client+server+tests+README) | clear ownership, skip rule | paths in `sw.js`, `.eslintrc`, `vercel.json`, `.vercelignore`, test requires | LOW-MED |
| radio CSS tail of `layout-fix.css` | `radio.css` linked after it | −24 KB per read | must keep cascade position | LOW |
| admin/radio-admin view code in `renderer.js` (L224–310) | separate classic script | −~40 KB per read | shares globals | MED |
| `admin-radio` action in `lxa-account.js` | delegate to `radio/admin.js` | −5 KB | shared helpers (`json`, auth) | LOW-MED |
| `lxa-account.js` | auth / game / admin modules | readability | shared helpers | MED |
| layout-fix old rules | per-subsystem CSS | big read saving | cascade, **HIGH** | HIGH |

## 28. Radio vs whole-site separation (ranked for THIS architecture)
Facts: radio already has its own endpoint/function/cron; players need no login; one `<audio>`; MediaSession; uses global `lang` and fixed DOM ids; admin runs inside the shared account panel; one Firebase project and one `initFirebase`; strict CSP and `X-Frame-Options DENY`/`frame-ancestors 'none'`.
| Option | Compat. | Audio/mobile | Auth/Firebase | Deploy | Context saving | Regression risk | Rank |
|---|---|---|---|---|---|---|---|
| A. Folder isolation | high | unchanged | unchanged | trivial | high | low | **1** |
| B. Black box (A + written contract + contract tests) | high | unchanged | unchanged | trivial | highest | low | **1 (with A)** |
| C. Shadow DOM | medium (CSS in `layout-fix.css` must move; DOM ids used by script) | same page → audio unchanged | unchanged | trivial | medium | medium | 3 |
| D. iframe / micro-app | low: needs `frame-ancestors`/`X-Frame-Options` relaxed, iOS background audio + lock-screen controls risk, language sync | **risky** | admin sync needed | medium | high | high | 4 |
| E. Separate deployable | low: new CORS/CSP, cron, domain, Firebase env duplicated, admin API split | risky | duplicated | high | high | high | 5 |
Recommendation (from the architecture, not theory): A+B first; C optional later; avoid D/E.

## 31. Index maintenance rule
Update this file whenever a change alters: file location, module ownership, dependency relationship, script order, entry point, API contract/action list, configuration ownership, persistence path or Firebase structure, backend routing/headers/cron, deployment architecture, module boundary, audit exclusion. Do NOT update for text/style tweaks or version bumps. Refresh the baseline line on update. Keep it ≤ ~30 KB and keep it a map (no code, no history).

## 32. Integrity check (this pass)
VERIFIED: every path in §C exists at `0f5a8d0` (from `git ls-files`); script order from `index.html`; actions list and env names by grep; Firebase paths by grep of `firebase-storage.js`; global names by grep; vercel/middleware/ignore contents read. No secret value read or written (only names). No runtime file modified (only `docs-context/*.md`). No Drollyv3 text used as current.
NOT VERIFIED: ClauBack\LXAV1 contents; live Firebase rules vs `database.rules.json`; `RADIO_HIDE` vs `meta/radioHide` precedence; admin role check line-by-line; multi-instance rate-limit behaviour; share of CSS/JS by subsystem (author estimates); the "12 reassigned functions" claim; test suite result at this commit (not re-run); live deploy state; real iPhone/Android behaviour.
Not found / absent: `bot-player.js`, `netlify.toml`, Firebase client SDK, Firestore.
