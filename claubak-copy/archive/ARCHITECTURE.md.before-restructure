# LXAV1 — ARCHITECTURE

Rewritten from scratch 2026-10-03 from the code as of commit `c82da19`. Open only the section needed for the task at hand.

## 1. Files and runtime
- Static site, repo root served as-is by Vercel (`vercel.json` outputDirectory "."; no build step). `.vercelignore` limits what is uploaded (tests, docs, dev tools, unreferenced art).
- Client: `index.html` (markup + inline scripts: language/header helpers, `updateLockKofiFloat`, service-worker registration), `style.css` (base + `--lxa-*` tokens), `layout-fix.css` (~395 KB, ~5300 lines of
  appended override blocks), `responsive-compact.css` (still linked), `game-engine.js` (pure rules, UMD, also required by Jest/server), `renderer.js` (~136 KB: UI, i18n tables, account panel, reels, spin loop),
  `spin-button.js` (SPIN/STOP button, progress ring, `?debug=1` log). PWA: `manifest.webmanifest`, `sw.js`, `assets/icons/*`.
- Server (Vercel Node functions): `api/lxa-account.js` (adapter: req/res -> `{httpMethod, queryStringParameters, headers, body}` -> `handler` -> res) -> `functions/lxa-account.js` (all actions),
  `functions/firebase-storage.js`, `functions/security.js`. `middleware.js` = Edge middleware that 404s `/functions/`, package files, `*.test.js`, dev tools, `*.md`, `*.bak`, `/data/`, `/node_modules/`.
- Dev tools in the root: `local-server.js` (talks to PRODUCTION Firebase — do not use for tests), `audit-simulations.js`, `deployment-check.js`. Tests: 7 `*.test.js` files (63 tests).
- Assets used: `lxa-header.webp` (animated header, 334 KB), `letters/{L,E,O,N,X,A}.png` (~34 KB each), `wild-wide.webp` + `wild-stack.webp`, `kofi-support-me-2.gif` (shown 233x62), `kofi-rainbow-mug.gif`
  (120 px, shown 26-32 px), fonts (Barlow Condensed 500/700, JetBrains Mono 400/700, woff2), icons (`lxa-icon-*`, apple-touch-icon, favicon-16/32). Unreferenced source art is kept locally only.

## 2. Game engine (`game-engine.js`)
- UMD module, frozen API. `resolveSpin(state, rng, now)` = the single source of truth for one spin (guest path): per-line result -> WILD application -> payouts (PAYTABLE x line stake) -> jackpot award ->
  credits = credits - stake + payout. Throws "Insufficient credits." and "Bet exceeds the maximum for this WILD level.".
- `maxBetForWildLevel`, `wildUpgradeCost` (price of the NEXT level), `wildChance`, `recommendedBet`, JACKPOT_TIER_MULTIPLIERS [1..5], admin getters/setters (RTP, WILD, multipliers) mirrored from Firebase.
- RTP functions: `computeDistribution(index, lineTarget)` (pure), `expectedTotalRtp(d, level)` (exact total = lines + WILD + jackpot), `setDifficultyTotalRtp(d, target, level)` (connected-mode solver), `applyAdminSettings(settings)` (the only way stored admin settings reach the engine: server before every spin / settings read, browser guest mirror at startup; deterministic order, connected solve last).
- Client and server keep their own copies of the WILD-placement/payout code, kept in sync by hand; `deployment-check.js` compares the numbers (last run: in sync).

## 3. Server (`functions/lxa-account.js`)
- `exports.handler`: parse -> global rate limit -> per-action limits (create 5/h per IP, real login 10/h per IP, spin 500/h per account, buy-wild 100/h) -> dispatch. Client IP = x-vercel-forwarded-for >
  x-real-ip > x-forwarded-for[0]. Errors -> HTTP 500 "Server temporarily unavailable." (also when a Firebase read fails: fail closed).
- Actions: create, login (password / silent with token), logout, update (name/password; password only), set-difficulty, deposit (BANK), reset-geld (GELD), reset-new-game (RESET), buy-wild, spin, leaderboard, get-rtp-settings,
  and admin-only set-rtp-settings, reset-rtp-settings, set-custom-distribution, reset-leaderboard, list-players, admin-update-player, admin-delete-player.
- `spin`: validateBet (min 5, <= balance) -> difficulty -> `applyRtpSettings` (reads Firebase `rtpSettings`, calls `game.applyAdminSettings`) -> cap check `maxBetForWildLevel` (400) -> grid (LXA letters + WILD marker) -> payouts -> jackpot/records (WILD lines skipped) ->
  save + leaderboard (strict read) -> response. Idempotency: client `requestId` (reused on a timeout retry) -> `idempotencyCache` replays the response.
- Storage (`firebase-storage.js`): `getAccounts` throws on failure; `getLeaderboard/getRtpSettings({strict})`; `updateAccount(key, mutate)` = Firebase transaction on `accounts/<key>`; node key `"<id> : <name>"`,
  lookup by the `id` field (`findEntryById`), `save()` migrates a node whose key changed. `create` id = max(11, existing ids, 10) + 1 (a simultaneous double create can still collide; needs an id counter node).

## 4. Client spin flow (`renderer.js`, `spin-button.js`)
- Tap -> `pointerdown` (spin-button.js) -> `#spin.onclick(event)` (renderer ~L925): a `click` that follows the same touch is dropped (`recentPointer`). If a round runs -> STOP (`stopped()` + `fastForward()`).
  Else: normalise the stake, `spinning=true`, `LXASpinButton.start()`, `startReelSpin()` (reels roll at once), then `lxaAccountResolveSpin` (server; guests: `game.resolveSpin`) -> `reels.land(board)` ->
  `LXASpinButton.landing(ms)` -> await the reels -> state update, `queuedBet` applied, render, round summary, `LXASpinButton.finish`, credits count-up, quiet rank refresh.
- Failure path (catch): `LXASpinButton.fail(T118(spinErrSession|spinErrBusy|spinErrNet|maxBet|spinErrFail))` shows the reason under SPIN; 'session expired' also opens the login panel; AUTO stops;
  insufficient/invalid/maximum errors re-read the account from the server (`login` silent) and rescale the stake.
- Stake controls (~L1019-1100): `stakeStep` (5/500/2500/10000 by balance), `normalizeLocalBet`, `setLocalBet` (clamp to balance and WILD cap, "MAX. EINSATZ" hint, stores `queuedBet` during AUTO),
  hold-to-repeat `bindHoldBet`, 50% button, AUTO loop (`runAutoSpin`, 260 ms gap). Display: `#bet`, `#betMax`, `#lineStake` set in `renderGameV79`.
- Debug: `?debug=1` adds an on-screen log (taps with target + element on top, errors, handler decisions) via `LXASpinButton.trace` (inert without the parameter).

## 5. Accounts on the client
- Panel `renderAccountPanel(view, notice)` (views: home, login, create, settings, admin screens). `lxaRequest(action, data)` adds the session token to every call (except `login`), the in-memory password only for the
  password-only actions (update + admin), and treats a 401 on a token action as a lost session (`lxaSessionLost()`). `lxaToken` lives in localStorage; the password only in memory.

- AUTO loop (`runAutoSpin`): stops when the generation changed; waits while PLUS/MINUS are held or changed within `BET_SETTLE_MS` (800 ms); the stake of a running round is never modified (`queuedBet` applies to the next round).
- `lxaRestoreSession()` on every load: silent login with id + token; on failure it shows the cached account (offline-friendly) and retries after 4 s.

## 6. UI / layout
- `.machine` grid with `grid-template-areas`: topbar, hero (payout card + jackpot mission), console (reels), controls (balance | last win | stake | WILD/BANK/GELD/RESET), SPIN, winboard, chance slider
  (`#chance`, labelled by `#chanceLabel #chanceValue`), leaderboard, quick-info, history, Ko-fi bar, footer. 1 px gaps. Header = animated WebP + CSS glow; the page background is on `<html>` (#272079).
- Standalone (`@media (display-mode:standalone)`): header grid row 1 = `env(safe-area-inset-top)` spacer, art band below, brand full-bleed, glow layer limited to the art band. Browser/PC: topbar margin-bottom
  `calc(var(--lxa-logo-h)*.1 + 3px)`. `html.lxa-standalone` selectors in the CSS are dead (the class is never set).
- Mission card: `.jackpot-target` > `.target-head` (#missionTitle, #missionGoal) + `#missionList` (`.mission-line-grid` of `.mission-line`, then `.milestone-list`). JS fitting: `fitMissionTitle`, `fitMilestoneAmounts`.

## 7. Persistence and data flow
- USER -> UI -> renderer (guest: engine + localStorage `lxa-v107-game-state`) -> `/api/lxa-account` -> function -> Firebase `accounts/`, `leaderboard`, `rtpSettings` -> response -> `lxaAccount` + cache
  `lxa-account-cache-v1` -> UI. Server is authoritative for accounts; the client cache never overrides it after a successful restore.

## 8. Dependencies that bite
- Every edit to a linked asset needs its `?v=NNN` bumped in index.html. The SPIN ring needs `@property` + `LXASpinButton.landing()` called from `startReelSpin().land()`.
- `game-engine.js` and `functions/lxa-account.js` must agree on `maxBetForWildLevel` and on the WILD-line jackpot exclusion. The root background colour must match `theme-color`, manifest colours and both gradient ends.
- Never return `{}` from a failed Firebase read; keep `.vercelignore` free of files the site needs.
