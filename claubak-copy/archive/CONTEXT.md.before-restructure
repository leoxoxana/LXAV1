# LXAV1 — CONTEXT (current state, read this FIRST)

Last rewritten from scratch: 2026-10-03, after commit `c82da19`. Companion docs in this folder: MEMORY.md (permanent knowledge + rules), ARCHITECTURE.md (how it is built),
CHANGELOG.md (what changed and why). The same four files are mirrored in the repo as `docs-context/` (for cloud sessions) — keep both copies identical.

## 1. Snapshot
- Project: LXAV1 = LEONXOXANA virtual-credit slot demo (no real money). Folder `C:\Users\leon4\Desktop\LXAV1`, repo github.com/leoxoxana/LXAV1 (remotes `origin` and `leo`, same URL), branch `main`.
- Code: local `main` is ahead of GitHub by the commits listed by `git rev-list --count origin/main..HEAD` (the owner pushes with `git push origin main`; check before a cloud hand-off). GitHub also has two OLD cloud-made branches:
  `main-hsvmm0` (merged locally, safe to delete) and `claude/project-thread-n4n2yo` (stale, do NOT merge, safe to delete).
- Deploy: the USER deploys (`vercel --prod` from the LXAV1 folder). LIVE (verified by me with read-only requests right after the owner's deploy on 2026-10-03; deployment lxa-jap8guh9a-lxa3, alias https://lxoxa.vercel.app, HTTP 200): game-engine v=377, layout-fix v=436, renderer v=406, spin-button v=9, style v=376 = the code through the connected-RTP commit (login/logout, AUTO bet settle, a11y, RTP switch, atomic ids, new headers). The CLI's 'Deployment Protection' note applies to the unique deployment URL only; the public alias is open. Production `rtpSettings` now holds 130 / 110 / 95 saved by the owner in LINE mode (switch off): totals at WILD 0 = 142.0 / 120.8 / 102.3 (the owner may turn the switch on to make them TOTAL targets). Firebase rules (owner pasted them): `.read:false, .write:false` (kept in `database.rules.json`).
- Vercel: project lxa3/lxa; domains lxoxa.vercel.app (primary), lxav1.vercel.app, lxa-lxa3.vercel.app. Database: Firebase Realtime DB `lxav1-a5cfd` (europe-west1).
- Asset versions now in index.html: style.css 376, layout-fix.css 434, responsive-compact.css 374, game-engine.js 376, spin-button.js 9, renderer.js 403. Service worker cache `lxa-v3-cache`.
- Checks at this commit: Jest 63/63 (7 suites), ESLint 0 errors / 18 warnings (old unused vars), deployment-check.js "client and server in sync", installability errors [].

## 2. What the last session round did (details in CHANGELOG)
1. Stake rules: max stake = half the price of the next WILD level (25.5M at WILD 50); "+" up to the whole balance but never above that cap; 50% = half balance clamped; "MAX ..." line under the stake.
2. Stake can be changed during AUTO (queued for the next round). 3. SPIN ring synced with the real reel timing.
4. Header: no hard edges; same 6 px gap under the art in browser / installed app / PC; no purple haze above the art in the installed app.
5. Page edges for force-scroll: root background ends exactly on #272079.
6. Spin failures are now visible (red reason under SPIN, de/ro/en; expired session opens the login panel). The old status line `#message` is display:none.
7. Mission card: smaller heading/goal, 6 px between the LINIE row and the prize row, no light frame around the LINIE row.
8. Android icons: compressed `lxa-icon-*` files, no `?v` strings. 9. "WILD xN - %" tag removed from the round summary.
10. Master audit: Firebase reads fail closed (duplicate-id / "session expired" root cause), per-IP limits use Vercel's real client IP, `.vercelignore`, lighter assets (letters, Ko-fi mug), slider aria name.
11. `?debug=1` on-screen log (spin-button.js) to diagnose taps on a phone without dev tools.
12. Auth + AUTO rewrite: per-device hashed sessions, explicit logout (server revoke + game invalidation), no id+name login, token-authorised play actions, GELD authentication hole closed, AUTO waits 800 ms while the bet is being changed (no spin/result/balance change from PLUS/MINUS), stale results after logout dropped; 21 end-to-end browser checks against the real server code.
13. Memory/hand-off: this folder, `docs-context/`, `ClauBack\LXAV1\vN` backups, cloud-session hand-off prepared.

## 3. Open items (honest list)
- User report "SPIN does nothing in the phone browser, works in the installed app": NOT reproduced in emulation. Likely explained by invisible server rejections (now visible) — to be confirmed after deploy.
  If it persists: open `https://lxoxa.vercel.app/?debug=1` on the phone, tap SPIN once, send a screenshot of the log.
- Persistent login (done 2026-10-03, needs the deploy): login once with the password, then the per-device session token keeps the user logged in across refresh / tab close / browser restart; BANK, WILD, GELD, RESET and
  difficulty no longer ask for the password (RESET asks for a confirmation). ID + name without a password is no longer a login (a password is required). Forgotten password: see MEMORY.md "PASSWORD RECOVERY" — the owner must
  know the password of at least one account or edit the database (plain `safeWord`). After the deploy every existing browser has a LEGACY token: it keeps working until the user logs out or changes the password.
- Android "Install app" does nothing / shortcut icon sits on a white tile (= launcher-made shortcut, no WebAPK). Icons were slimmed down to match the working Drolly app; unconfirmed on the phone.
  Need: phone model + browser. After deploying, the user must delete the old home-screen shortcut and add it again. Do NOT add an install button unless asked.
- The user's installed iOS PWA can be a stale page (no "MAX ..." line under the stake = build older than 5800313): close it completely and reopen before judging a "fix did not work".
- Firebase still holds test accounts (zzprobe*, lxatest*, lxaspd*, ids 14-19): the user deletes them.
- Not done on purpose: `vercel build` (would pull secret env values to disk); deleting unreferenced art (kept locally, excluded from deploys by `.vercelignore`); duplicate-NAME race on two simultaneous
  `create` calls with the same name (the duplicate-ID race is fixed by the `meta/lastAccountId` counter; needs the deploy, a new DB node appears on the first create); rate limiter is per serverless instance (in memory); Firebase security rules are not in the repo (anonymous read/write verified denied by a probe only).
- GAME MATH TO CONFIRM WITH THE USER (found 2026-10-03 by running `node audit-simulations.js`, 100k spins per difficulty): measured RTP about 164% / 137% / 107% for difficulty 1/2/3 and `game.debugReport` line multipliers 1.50 / 1.25 / 1.00. `renderer.js` `reportBalance()` still compares against the old Drolly targets [.993, .8635, .774], so a stale 'LXA EV deviation' console warning fires at every load. Probably intended (progression game, balances reach hundreds of millions) but NOT confirmed: never change the math on my own; ask one question. Harmless clean-up once confirmed: drop or update the stale check.
- Never verified on real hardware: iPhone, Android, Safari, Firefox, installed PWA on a phone, `@property` ring on iOS < 16.4.

## 4. Next steps (only when the user asks)
0. RTP: the owner's switch is BUILT (2026-10-03): Admin Panel > RTP has 'RTP linked' (value = TOTAL RTP incl. WILD + jackpot, solved exactly, reference WILD level field) vs disconnected (value = line return, today's default). Production `rtpSettings` is still EMPTY: the owner must enter his values in the admin panel after the deploy (for a TOTAL 130/110/95 with the switch ON type 130/110/95; with it OFF type about 121/101/89). OPEN QUESTIONS for the owner: (a) RESOLVED: no rounding for anyone, same RTP at every stake (guest engine now cent-precise like the server; needs the deploy). (b) the stale console warning from `reportBalance` (old Drolly targets) can be removed. Other owner decisions: CSP not now; contrast of 3 tiny labels not now; name-race no; deleting unreferenced art not yet; Firebase rules text pending (console.firebase.google.com > lxav1-a5cfd > Realtime Database > Rules).
1. User pushes (`git push origin main`) and deploys (`vercel --prod`), closes + reopens the PWA, re-adds the Android shortcut.
2. Check SPIN in the phone browser; read the visible error / debug log if it still fails.
3. Optional cleanup with approval: delete unreferenced art, old `icon-*.png`, dead `html.lxa-standalone` CSS (class is never set), unused `responsive-compact.css` rules.
4. Optional: id counter node for `create`; Firebase rules file in the repo.

## 5. Sessions, usage and cloud hand-off
- Plan: Claude Pro. Usage windows: 5-hour (was 86% at the last check, resets about every 5 h) and weekly (51%, resets Thursday 21:00). "Extra usage" is OFF (0 EUR).
- Separate credit: "Cloud session credits" $70 of $100 left, expires 2026-11-05 08:59 (GMT+1). It applies automatically ONLY to cloud sessions (after it is used, the normal plan applies).
- Hand-off: (1) if `git rev-list --count origin/main..HEAD` is not 0 the user runs `git push origin main` (docs-only commits may be pending); (2) menu `LXAV1 v` -> Open in -> Continue in -> Cloud, or New -> Cloud on repo leoxoxana/LXAV1 branch main;
  (3) first message: "Citește docs-context/CONTEXT.md și docs-context/MEMORY.md. Răspunde scurt, numerotat, în română. Nu face deploy și nu face push fără să-ți cer. Textele noi se scriu în de, ro, en.";
  (4) check `git log -1 --oneline` = latest hash. Only ONE session edits the code at a time. Cloud cannot run the Edge/CDP tests nor `vercel --prod`. `.env.local` never leaves the PC.
- An in-app attempt to move the session to the cloud was blocked by the safety classifier; the user does the move/push from the UI (do not work around that).

## 6. Resume protocol (for me, any session)
1. Read this file and MEMORY.md. Open ARCHITECTURE.md only for the area being changed. 2. `git status`, `git log -5`, `git rev-list --count origin/main..HEAD`.
3. After EVERY real change: verify measurably (Jest, ESLint, headless Edge incl. real standalone), commit locally with the trailer, bump the `?v=` of every edited asset in index.html,
   save the touched files in `ClauBack\LXAV1\vN\` with a README, update CHANGELOG + CONTEXT (+ MEMORY if permanent), mirror the 4 docs to `docs-context/`, commit.
4. Answer short, numbered, Romanian; end with "rulează `vercel --prod` din folderul LXAV1". Never deploy, never push, never touch secrets.
