# LXAV1 — MEMORY (permanent, verified knowledge)

Rewritten from scratch 2026-10-03. Everything here was checked against the code/tools unless it says NOT VERIFIED. Older sibling notes (Drollyv3): `ClauBack\CONTEXT\*` — inspiration only.

## 1. The user and the standing rules (never relax)
- Romanian speaker; long explanations overwhelm them. Answer SHORT, NUMBERED, in Romanian. "brainstorm" = explain with concrete numbers in a small table, no code.
- ONLY THE USER DEPLOYS ("doar eu dau deploy mereu"): `vercel --prod` from the LXAV1 folder. I never deploy and never push unless explicitly asked. End every work round with
  "rulează `vercel --prod` din folderul LXAV1".
- Never type API keys / service-account JSON / tokens / passwords anywhere and never read `.env.local`. If a tool or the safety classifier blocks something (secret-store writes, `git remote`
  changes, moving the session to the cloud, deletions), give the user the exact command and do NOT work around the denial.
- Every visible text change goes into ALL 3 languages (de = default, ro, en), including CSS `content:` strings, checked through the real language menu.
- Verify measurably before saying "done" (headless Edge/CDP: phone, PC, landscape, real standalone) and say plainly what could not be verified (real iPhone/Android, Safari, Firefox).
- No PWA/"Install" button unless the user newly asks. The user authorised fixing other problems found on the way, but I still report them.
- Backups in ClauBack are pre-authorised. Commits: trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`, message in a scratchpad file, `git commit -F`
  (PowerShell shows "Exit code 255" only because git's LF->CRLF warning goes to stderr).
- Ask ONE precise question when a rule has two readings and show numbers (I once built the wrong stake rule; see section 3).
- The audit master prompt (2026-10-03) also applies: preserve the existing LXA design, minimal root-cause repairs, no redesign, no production deploy.

## 2. Product and design facts
- Static client + Vercel serverless API. Design = futuristic cyber/neon (dark blue/violet/magenta), already defined; never redesign, only repair real defects.
- Languages de/ro/en; strings live in the `tx118` table (renderer.js, `T118(key)`), in `data-i` markup, and a few CSS `content:` strings.
- Euro display, start balance 250, 5 lines x 10 columns, target word LEONXOXANA (reel letters L E O N X A).

## 3. Game rules (engine = single source for client and server)
- PAYTABLE x line stake (bet/5): 3/10 .50, 4/10 .75, 5/10 1, 6/10 1.5, 7/10 2, 8/10 3, 9/10 5, 10/10 8.
- Jackpot mission: complete 5 DIFFERENT lines at 10/10; tier multipliers [1,2,3,4,5] x the stake; 5/5 pays 5x the stake (15x is the whole-cycle total; I once said 15x and was corrected). One jackpot
  line per spin; after 5/5 the cycle restarts. A line that shows a WILD cell is excluded from the mission and from record hits (it still pays its normal payout).
- WILD: chance 50% + 0.2% per level (level cap 50); extra WILDs by level bands; a WILD fills the missing letter. Price ladder (`wildUpgradeCost` = price of the NEXT level): L1 2.5M, L2-3 3.5M, L4-5 4.5M,
  from L6 n x 1M, up to 50M. The round summary shows no "WILD xN - %" tag any more (it looked like a multiplier; removed 2026-10-03).
- MAX STAKE (user-defined, final): `maxBetForWildLevel(level) = max(5, floor(price of level+1 / 2))`: WILD 0 -> 1,250,000; 1 -> 1,750,000; 10 -> 5,500,000; 37 -> 19,000,000; 40 -> 20,500,000;
  48 -> 24,500,000; 49 -> 25,000,000; 50 -> 25,500,000 (no level 51: the ladder continues). "+" raises the stake up to the WHOLE balance but never above the cap. 50% button = half of the balance,
  then clamped to the same cap. The "MAX ..." line = min(balance, cap); BANK is not counted. Enforced in the engine (`resolveSpin`), the server (`spin` -> HTTP 400) and the UI (`setLocalBet`, `normalizeLocalBet`).
  WRONG TURN: I once capped "+" at half the balance; the user wanted the whole balance, WILD-limited only. Never re-add a half-balance cap for "+". Reason for the cap: tiers pay a multiple of the stake.
- AUTO: repeats rounds (260 ms gap) until STOP, until the balance cannot cover the stake, or until a round fails. Stake buttons stay active during AUTO; the new stake is queued (`queuedBet`) and applied
  to the next round with the same caps. Manual (non-AUTO) spins keep the stake locked while a round runs.

- RTP (measured and exact, 2026-10-03): the admin RTP value is the LINE return (`expectedLineMultiplier`); WILD substitution and the jackpot pay on top. Exact long-run TOTAL return for a player at WILD level L:
  `game.expectedTotalRtp(difficulty, L)` (closed-form model of the real rules, validated against seeded 300k-spin simulations with CHAINED state - jackpot progress carried between spins - within 1 standard error:
  difficulty 1/2/3 at WILD 0 = 163.2% / 136.7% / 107.6% with the shipped 150/125/100 targets; at WILD 25 difficulty 2 = 151.3%). Earlier figures quoted in chat (162/135/107) came from fresh-state simulations that
  under-count the jackpot cycle by ~1-1.6 points. Production `rtpSettings` was EMPTY on 2026-10-03 (defaults 150/125/100 are what runs).
  CONNECTED RTP (new admin switch, default OFF = today's behaviour): `rtpLinked: true` makes the admin value the TOTAL return (lines + WILD + jackpot) at `rtpRefLevel` (default WILD 0); `setDifficultyTotalRtp` solves
  the line target by bisection (admin 130/110/95 total -> line targets 118.6 / 99.8 / 87.9; totals 129.9 / 110.0 / 95.1; solving 3 difficulties = ~17 ms). Higher WILD levels still pay more (the same targets give
  144.0% / 121.1% / 105.8% at WILD 50) - WILD upgrades stay valuable. A custom win-chance table keeps precedence (that difficulty is skipped). An unreachable total is clamped and reported (`clamped`).
  `game.applyAdminSettings(settings)` is the ONE function that turns stored admin settings into engine state (fixed order, deterministic, payout multiplier reset first, connected solve last): the server runs it before
  every spin / settings read, the browser runs it for the guest mirror (this also fixed guests silently ignoring the jackpot-frequency and payout/jackpot multipliers). The admin panel shows line / total / WILD 0 / WILD 50 figures.
  NO ROUNDING, SAME RETURN AT EVERY STAKE (fixed 2026-10-03, engine v=378): money has CENT precision everywhere. The server (logged-in players) always used `money()` = 2 decimals: measured through the real handler difficulty 1 = 163.0 / 162.7 / 163.5 / 163.6% at stakes 5 / 10 / 50 / 1000 (model 163.2). The guest/local engine used `cents()` = whole euros, which paid guests more at small stakes (stake 5: 181.6 / 156.5 / 129.5%); `cents()` now rounds to 2 decimals like the server, and the guest return is 163.2 / 136.7 / 107.7% at stakes 5, 50 and 1000. Balances and wins can therefore have cents (as for accounts); the UI shows whole euros.

## 4. Accounts, server, configuration ownership
- Files: `api/lxa-account.js` (Vercel adapter) -> `functions/lxa-account.js` (all actions) + `functions/firebase-storage.js` (firebase-admin Realtime DB) + `functions/security.js` (limits, idempotency).
  `middleware.js` (Edge) 404s sensitive root files. The client never talks to Firebase directly.
- Env var NAMES (values only in Vercel): FIREBASE_SERVICE_ACCOUNT (server only), FIREBASE_DATABASE_URL (pattern-validated, falls back to the LXAV1 DB URL constant), LXA_PEPPER (fallback default pepper in
  source; never change once accounts exist; a production warning is logged if it is missing). Env values added AFTER a deploy need a redeploy (login once failed with "Server temporarily unavailable" for that reason).
- SESSIONS (rewritten 2026-10-03): login needs the PASSWORD (id or name + password). ID and name are identifiers, never proof: the old "any 2 of 3 / id + name" login was removed (it handed a full token to anyone who
  knew a public leaderboard name and a small id). Each real login issues a NEW per-device session token (24 random bytes); the server stores only `sessions: [{h: sha256(token), at}]` (max 8 devices; the legacy single
  `sessionToken` field is still honoured until logout / password change). The browser keeps only the token (`lxa-session-token-v1`) and a display cache (`lxa-account-cache-v1`); the password is NEVER stored anywhere
  (memory only, for the update / admin actions). Closing the tab/browser is not a logout; only the explicit LOGOUT button is: it calls the `logout` action (revokes THAT device's token on the server), stops AUTO, bumps
  `lxaAuthGeneration` (drops any in-flight spin result and animation) and clears token + cache. A token the server rejects (401 "Session expired") or a cached id without a token = UNAUTHENTICATED: token and cache are
  cleared and the login panel opens (a stored id/name/balance is only a label). Changing the password (`update`) or an admin password reset revokes EVERY session (the changing device gets a fresh one).
  Admin = `role:"admin"` on the account record (7 checks, no hardcoded id; a cached role is never trusted). Per-account password lockout (5 wrong attempts -> 15 min) is persisted; per-IP limits are in memory per instance
  (create 5/h, real login 10/h, spin 500/h per account, buy-wild 100/h, global 5000/min).
- PASSWORD RECOVERY (no email infrastructure exists; none invented): forgotten password = the admin edits the player in Admin Panel > PLAYERS (sets a new password; all sessions are revoked), or the owner sets a plain-text
  `safeWord` on the account in the database console (the server accepts a non-hashed value once and stores a salted hash at the next successful login). There is no self-service reset.
- Authorisation per action: session token OR password (`authorize`) for spin, set-difficulty, deposit (BANK), buy-wild (WILD), reset-geld (GELD; it had NO authentication before 2026-10-03) and reset-new-game (RESET; the
  client now asks for a confirmation, text `resetConfirm` in 3 languages); PASSWORD ONLY for `update` (name/password change) and every admin action (the admin panel asks for the password again after a reopen, by design);
  `logout` needs the token (a bad token is a silent no-op). Spin also validates the bet + idempotency (requestId cache).
- Account nodes: `accounts/"<id> : <name>"` (no zero padding); the server finds accounts by the `id` FIELD (hand-edited nodes work); the key is renamed on the next save / when the admin opens PLAYERS.
- FAIL-CLOSED RULE: reads that feed auth, id allocation or a whole-node write must THROW, never return {} (`getAccounts`; `getLeaderboard`/`getRtpSettings` with `{strict:true}` for read-modify-write
  callers). Reason: a failed read used to look like an empty DB -> login "ID not found", `create` reused id 12 (duplicate ids -> a token valid for one node fails on the other = "session expired"), and a
  whole-node save could wipe boards/settings. Display reads stay forgiving.
- Client IP behind Vercel: x-vercel-forwarded-for > x-real-ip > x-forwarded-for[0]. NEVER trust x-nf-* (Netlify-only; spoofable on Vercel).
- Game numbers: `game-engine.js` defaults; admin values in Firebase `rtpSettings` override them per field (RTP per difficulty, jackpot frequency, WILD chance / per level / cap / cost multiplier / extra-WILD
  frequency, payout + jackpot-value multipliers); `game.applyAdminSettings` applies them (server before every spin / settings read; browser guest mirror at startup via `get-rtp-settings`). Conflict winner = Firebase value, else default.
- Persistence: guest = localStorage `lxa-v107-game-state`; account = Firebase (server authoritative), cache `lxa-account-cache-v1`, token `lxa-session-token-v1`, the typed password only in memory.
  `lxaRestoreSession` shows the cached account when the server is unreachable; an invalid token used to look "logged in" while spins failed (now the spin error says so and opens the login panel).
- Production Firebase holds test accounts (zzprobe*, lxatest*, lxaspd*, ids 14-19): the user deletes them. Old `rtpSettings`/accounts were not migrated from the previous project (`settings:{}` = code defaults).

## 5. Deployment (Vercel)
- Project lxa3/lxa; domains lxoxa.vercel.app (primary), lxav1.vercel.app, lxa-lxa3.vercel.app. `vercel.json`: outputDirectory ".", `no-cache, must-revalidate` on everything, CSP (`default-src 'self'`,
  `connect-src` firebasedatabase.app), HSTS, X-Frame-Options DENY. No netlify.toml / Netlify runtime code left (only history comments).
- `.vercelignore` keeps tests, dev tools, readme, ESLint config and database rules out of the deployment (the unreferenced art, `scripts/` and `docs-context/` were deleted from git on 2026-10-04). Never add a file the site needs (index.html, the 4 stylesheets, game-engine.js,
  renderer.js, spin-button.js, sw.js, manifest, middleware.js, api/, functions/, used assets).
- Cache-bust: bump `?v=NNN` in index.html on EVERY edit of style.css / layout-fix.css / responsive-compact.css / game-engine.js / renderer.js / spin-button.js. `sw.js` is network-first (cache `lxa-v3-cache`,
  the API is never cached), so a new deploy is picked up; an installed iOS PWA can still keep an old page alive for days (close it completely).
- Firebase Realtime Database rules (owner confirmed 2026-10-03, file `database.rules.json`): `.read:false`, `.write:false`: only the server (admin SDK) can touch data. Anonymous access probe: read 401, write 401. `npm audit --omit=dev`: 2 moderate (uuid via gaxios inside firebase-admin, not reachable from this code).

## 6. UI / CSS system (PERMANENT lessons)
- `layout-fix.css` (~5200 lines) is patched by appended blocks: `html body:not(#_):not(#__):not(#___)` + `!important`; the later block wins. When "nothing changes", suspect a later equal/higher-specificity
  rule and read the COMPUTED style through CDP. An edited CSS file is not proof that the browser uses the rule.
- `.machine` = CSS Grid with `grid-template-areas`; every direct child needs an explicit area. Gap between main containers = 1 px (user decision). One card style: radius 14, 1 px soft border, 2 px magenta
  top border, 145deg blue->violet gradient.
- Header: transparent animated WebP + CSS `::after` sweep/glow + rails; `.brand/.topbar{overflow:visible}`; the glow layer fades on 4 sides. In the installed app the header box also holds the status-bar
  spacer, so the glow layer is limited to the art band (`inset: env(safe-area-inset-top) 0 8px 0`). Browser/PC get `.topbar{margin-bottom:calc(var(--lxa-logo-h)*.1 + 3px)}` so the gap art->cards is 6 px in all modes.
- Page background lives on `<html>`, colour #272079 = theme-color = manifest colours; every gradient layer dies out to exactly that colour at top and bottom (overscroll shows the root colour).
- Mission card: heading `clamp(13px,5vw,23px)`, goal `clamp(10px,3.3vw,14px)` (JS `fitMissionTitle` only shrinks further when it overflows), `#missionList{gap:6px}`, no frame on `.mission-line-grid`;
  the progress bars are `.mission-line:before` on the cell bottom edge (that is why a gap below them matters). The prize row keeps its light frame.
- Floating lock + Ko-fi park at the right edge of `.hero` (inline script `updateLockKofiFloat`); the lock blocks scroll only on touch screens.
- Reels: `startReelSpin()` -> {land, fastForward, abort}; the loop (130 ms/cell) starts in the tap frame; one eased landing (~2.5 s); the promise resolves on `animation.finished` (+ safety timer).
- SPIN button (`spin-button.js`): SPIN/STOP only, acts on pointerdown, drops the click that follows the same touch (`recentPointer`). Ring = CSS `@property --spin-p` (needs iOS >= 16.4):
  creeps to 12% while the server answers, `landing(ms)` runs it to 100% over the real slide time, STOP snaps in 180 ms. `fail(text)` shows a rejected round under the label in red.
- `#message` (live status text) is `display:none`: never rely on it for errors. Use `LXASpinButton.fail()` or the account-panel notice.
- Lesson: `vw` mis-sizes variable-length text; prefer `cqw` or JS measure-then-shrink. A hidden flex child can still perturb spacing: remove it from the DOM.

## 7. PWA / icons / platforms
- Manifest: name LXA, standalone, icons `assets/icons/lxa-icon-192.png` (32 KB), `lxa-icon-512.png` (171 KB), `lxa-icon-512-maskable.png` (110 KB) — palette PNGs, no query strings; apple-touch-icon 180 for iOS.
  Old `icon-*.png` are unused (excluded from deploys). Drollyv3 had the same icon set but files ~5x smaller. A home-screen shortcut stores its icon bitmap at creation: after icon changes remove and re-add it.
- An Android icon on a white tile = launcher-made shortcut (WebAPK not created). Chromium reports 0 installability errors locally and live. The cause on the user's phone is not confirmed (need model + browser).
- Standalone vs browser: the layout below the header is identical (<= 1 px); the only intended difference is the status-bar spacer. iOS Safari content starts below the status bar (env top = 0 in a tab).
- Measured parity at 390 px: art->cards gap 6 px in browser, installed app and PC; 11 viewports x 3 languages and live orientation switches: 0 overflow/clip findings.

## 8. Tooling that works here (recreate scripts from these recipes)
- Jest (245 tests, 20 files) + ESLint (0 errors, 18 old warnings). `deployment-check.js` compares client/server numbers.
- Headless Edge via CDP (WebSocket, `Runtime.evaluate`). REAL STANDALONE: start Edge with `--app=http://127.0.0.1:PORT/` (then `matchMedia('(display-mode: standalone)')` is true; `Emulation.setEmulatedMedia`
  does NOT work) plus `Emulation.setSafeAreaInsetsOverride {insets:{top:59,bottom:34,left:0,right:0}}`. Phone browser = normal launch, 390 px, insets 0. Real touch: `Emulation.setTouchEmulationEnabled` +
  `Input.dispatchTouchEvent`. Pause animations before pixel work: `document.getAnimations().forEach(a=>{a.pause();a.currentTime=1500})`. Full-page capture with `captureBeyondViewport` + PIL pixel sampling.
- Server answers can be faked with `Fetch.enable` on `*api/lxa-account*` + `Fetch.fulfillRequest` (used to test the 401/429/500/400 spin errors).
- Static server for tests: `python -m http.server 8890 --bind 127.0.0.1` (guest mode; `local-server.js` talks to PRODUCTION Firebase — never use it for tests).
- Image work: Pillow palette quantisation (`quantize(256)`, FASTOCTREE for RGBA) cut icons/letters by 60-75% with mean error ~3/255.
- TRAP: each headless Edge profile grows to 300-800 MB; 27 of them filled C: to 0 bytes. After every batch delete the `edgeprof_*` folders (`cmd /c rd /s /q \\?\<path>` works where Remove-Item fails)
  and check `Get-PSDrive C`.
- TRAP: never rewrite UTF-8 files with PowerShell 5.1 `Get-Content -Raw | Set-Content` (mojibake + BOM); use Python (`encoding='utf-8', newline=''`) or Edit, and keep the file's CRLF. Quote-heavy Python
  one-liners break in PowerShell: write a `.py` file instead.
- TRAP: `Start-Sleep` followed by a read is blocked by the harness; use background commands and wait for the notification. A timing sample right after a page switch can be throttled; rerun it.
- TRAP: the in-app browser tool can be denied for external sites (do not retry). An unauthenticated PUT probe against Firebase was sent once during the audit (denied, nothing stored): ask before write probes.
- TRAP: a backup copy of the project must not contain `.env.local` (Vercel-pulled secrets). The first FULL snapshot did; it was removed on 2026-10-03.

## 9. Lessons from my mistakes (do not repeat)
- Misread the stake rule (half-balance cap for "+"): implement only after the rule is unambiguous. Confusing tables upset the user: give a small table with real numbers.
- Said 5/5 jackpot = 15x (it is 5x). Said "level 6 -> 3,000,000" (the cap uses the NEXT level's price).
- The header "fix" (overflow:visible) created a 1-2 px overlap in browser/PC modes: always measure ALL modes (browser, real standalone, PC), not just one.
- Judged PWA bugs from a stale PWA page. Hid spin errors behind a display:none element. Filled the disk with test profiles. Copied secrets into a backup folder.
- Thin backups: ClauBack must follow the CONTEXT / vN / FULL design (see ClauBack\LXAV1\NOTES.md).

## 10. NOT VERIFIED
Real iPhone/Android behaviour (safe areas, rubber-band, Install app/WebAPK, installed PWA), Safari/Firefox engines, `@property` ring on iOS < 16.4, the animated header while running on a phone,
live behaviour of everything after commit 116ffd8 (not confirmed deployed), `vercel build` locally, the Firebase security rules text (only anonymous access was probed).
