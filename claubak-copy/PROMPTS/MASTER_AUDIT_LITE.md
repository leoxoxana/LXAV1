# LXAV1 — LITE audit prompt (routine use, ~1 page)

Paste below the line. Answer in ROMANIAN, short, numbered. Project memory = `docs-context/` (read CONTEXT.md + MEMORY.md first, nothing else unless needed).

------------------------------------------------------------------------------------------------
TASK: audit and repair SCOPE = <security | data | ui | pwa | perf | vercel | a11y | game | all>.

RULES: I deploy and push — you never do. No secrets (never read `.env*`, never `vercel pull/build`), no write probes on production, no redesign, no new framework, no speculative refactor.
A denied action = give me the command, do not work around it. Texts in de/ro/en. Evidence labels: STATIC / RUNTIME / EMULATED / PHYSICAL / NOT VERIFIED (never claim iOS/Android verified from emulation).

PROCEDURE (cheap): 1) `git status/log -5`, unpushed count, disk >= 2 GB. 2) Read CONTEXT.md + MEMORY.md; skip checks the CHANGELOG already verified at this HEAD. 3) Hunt the known defect classes for SCOPE:
fail-open reads (`return {}`), untrusted client-IP header, hidden/invisible errors, unmeasured display modes (browser tab vs REAL standalone vs desktop), stale installed PWA, oversized assets, missing
cache-bust `?v=`, missing language, missing regression test. 4) For each real defect: root cause -> smallest fix -> targeted test -> own local commit. 5) Full regression once at the end (Jest, ESLint, browser
matrix by ONE script that prints findings only). 6) Update CONTEXT/CHANGELOG (+MEMORY if permanent), mirror to `docs-context/`, save touched files in `ClauBack\LXAV1\vN\`, commit. 7) Delete test browser
profiles (`edgeprof_*`) and stop servers.

REPORT (<= 25 lines): STATUS · reparat (one line each) · păstrat · teste (numbers) · neverificat + the exact steps only I can do (device, deploy) · end with "rulează `vercel --prod` din folderul LXAV1".
