# LXAV1 — MASTER AUDIT / REPAIR / READINESS PROMPT v2

Paste everything below the line into a new session (local or cloud). It assumes the project memory exists (`docs-context/` in the repo = `ClauBack\LXAV1\CONTEXT\`), so it does NOT repeat project facts.
Write the answer in ROMANIAN, short and numbered. Replace the three settings in section 0 if needed.

------------------------------------------------------------------------------------------------

## 0. SETTINGS (edit these, nothing else)
- MODE = STANDARD            (LITE = sections 1-3, 6 and 9 only, targeted to SCOPE · STANDARD = all phases, sampled checks · DEEP = all phases, exhaustive checks, extra tests)
- SCOPE = all                (all | security | data | ui | pwa | perf | vercel | a11y | game)
- PROJECT = C:\Users\leon4\Desktop\LXAV1   (source of truth; older Drolly/V3 knowledge is context only and loses every conflict)

## 1. PRIORITIES (when rules conflict, the lower number wins)
1. Never harm: no secrets read/typed/printed, no destructive or outward-facing action without the user's explicit yes, no production deploy, no push unless asked.
2. Obey the project's own rules (`docs-context/MEMORY.md` section 1, CLAUDE.md/AGENTS.md if present) and the user's latest message.
3. Correctness and security of data and money-like logic (credits, stakes, jackpot, accounts).
4. Preserve the existing LXA design, behaviour and game math. A change needs a concrete defect, not taste.
5. Economy (tokens, tool calls, disk, time) — never at the price of 1-4.

## 2. HARD RULES
- Only the user deploys (`vercel --prod`) and pushes. If a tool or the safety classifier denies something, give the exact command and STOP on that item; never route around the denial.
- Never read `.env*`, service-account files or tokens; never copy them into backups; never run `vercel pull/build/env` (they write secrets to disk); print env var NAMES only.
- No write/mutation probes against production (Firebase, API, DB). Read-only probes of the user's own endpoints are allowed only when needed for the audit, shallow and minimal; say what was sent.
- Every visible text change goes into de (default), ro, en — including CSS `content:`, aria-labels, error texts — and is checked through the real language menu.
- No redesign, no new framework/design-token system, no speculative refactor, no dependency upgrade unless it fixes a concrete security/compat defect.
- Evidence labels in the report are mandatory: STATIC (read) · RUNTIME (executed) · EMULATED (headless/CDP) · PHYSICAL (real device) · NOT VERIFIED. Never write "iOS/Android/PWA verified" without PHYSICAL.
- One precise question (with numbers) when a rule has two readings; otherwise choose the conservative reading and state it. Ask nothing else.

## 3. ECONOMY ENGINE (how to be cheap AND thorough)
- Reuse, don't rediscover: read `CONTEXT.md` + `MEMORY.md` once; open ARCHITECTURE.md/CHANGELOG.md sections only when the task touches them. Anything the CHANGELOG lists as verified at the current HEAD
  is skipped unless the files it depends on changed since (`git diff --stat <hash> HEAD`).
- Keep a LEDGER in the scratchpad (one file, 30 lines max): facts learned, checks done (+evidence), findings (P0-P3), fixes (+commit), open questions. Re-read the ledger, not the whole repo, after context compaction.
- Batch independent tool calls in parallel; use targeted `rg`/Grep with narrow globs; read files with offset/limit; never dump huge lines (cut to ~200 chars); prefer one script that checks 30 things over 30 calls.
- Long, mechanical, independent sweeps (e.g. 11 viewports x 3 languages) go into ONE CDP script that prints findings only (silence = pass).
- Run the full regression (Jest + ESLint + browser matrix) at milestones and at the end, not after every edit; run the targeted test after each fix.
- Disk hygiene: before browser work check `Get-PSDrive C` (>= 2 GB free); each headless profile costs 300-800 MB — reuse ONE profile dir per session or delete `edgeprof_*` after each batch (`cmd /c rd /s /q \\?\path`).
- No sub-agents unless a task is truly parallel and read-only; their startup cost is paid again.
- Stop rule: if a check needs a real device, a secret, or a decision only the user can make, record it as NOT VERIFIED with the exact step for the user, and move on.

## 4. PHASES (gate at the end of each; do not skip a gate, do not repeat a phase)
### Phase 0 — Preflight (<= 6 tool calls)
`git status`, `git log -5`, `git rev-list --count origin/main..HEAD` (+`git fetch`) · disk space · tool check (node, python, Edge, jest) · read CONTEXT.md + MEMORY.md · create the ledger ·
note which asset versions (`?v=`) and which hash are live vs local (live = what the user last confirmed deployed). Gate: you can state HEAD, unpushed count, live-vs-local gap, tests baseline.
### Phase 1 — Map (internal, 15 lines in the ledger)
Entry points, data flow USER -> UI -> client logic -> /api -> function -> Firebase -> response -> state -> UI; config owners and precedence (engine default vs admin value in Firebase vs env); trust boundaries;
what is local vs server-authoritative vs cache vs PWA state. Reuse ARCHITECTURE.md; verify only what changed.
### Phase 2 — Audit by domain (SCOPE filters this; MODE sets depth). Hunt these known high-yield defect classes first
A. DATA INTEGRITY — every Firebase/DB read that feeds auth, id allocation or a whole-node write must FAIL CLOSED (throw), never return `{}`/default; read-modify-write uses transactions; ids/names unique; no
   whole-node `set()` built from a possibly-empty read; idempotency on spin/deposit/buy; race on simultaneous creates; backups/rollback path.
B. SECURITY — authN/authZ per action (table: action -> guard -> evidence); IDOR/ID manipulation; admin only via server-side role, no hardcoded id; password hashing + pepper fallback; lockout; replay;
   rate limits keyed on a TRUSTED client IP (Vercel: x-vercel-forwarded-for / x-real-ip; never platform-foreign headers like x-nf-*); per-instance limiter weakness; CSP/HSTS/frame headers; XSS (every
   server/user string rendered via escape or textContent); open redirects; error/log leakage; secrets in git history/backups/bundles (`git grep` + `git log -S`); `npm audit --omit=dev` (judge reachability);
   public Firebase rules (read-only anonymous probe, never a write); middleware blocklist vs what is actually uploaded (`.vercelignore`).
C. API/VERCEL — adapter contract (req/res vs event), routes, methods, CORS, env names used vs set, cold-start init, function bundle includes (`functions/`, `game-engine.js`), `vercel.json` validity, headers on
   sw.js/manifest, no platform-foreign leftovers (Netlify), cache headers vs the cache-bust scheme.
D. CLIENT LOGIC & ERROR VISIBILITY — enumerate every failure path (401/403/404/429/500/network/timeout/offline/session expired/stale token/duplicate tap/AUTO) and prove the USER SEES a reason in the
   right language; no hidden elements (`display:none`) used as an error channel; no stuck state after failure (spinning flag, disabled button, queued value); double-submit and rapid-tap behaviour;
   state sync after reload/resume/back-forward cache; local state can never override server state.
E. UI/CSS (preserve design) — for every visual finding: PROBLEM -> ROOT CAUSE (read the COMPUTED style/cascade, not the CSS by eye) -> MINIMAL FIX -> VERIFY in ALL modes. Check: overflow/clip/overlap,
   z-index, safe areas, specificity wars in the appended-override stylesheet, duplicate/contradicting rules, dead selectors, text expansion in ro/de at 320 px, reduced-motion, high-DPR.
F. MODE PARITY — measure, don't eyeball: phone browser tab vs REAL standalone vs desktop, portrait/landscape and live orientation switches. Compare element rectangles across modes (differences only where
   intended, e.g. the status-bar spacer). Test the same user action (real touch event) in each mode.
G. PWA/ICONS/SW — manifest validity and installability errors; icon set (192/512/maskable, apple 180, favicons), file-size budget (<= ~60 KB for 192, <= ~200 KB for 512), no query strings on manifest/icon URLs;
   SW strategy (network-first for the shell, never cache the API, cache-name bump on change, update path, offline fallback); stale-page risk of installed PWAs; launcher behaviour differences Android vs iOS;
   remember a home-screen shortcut keeps the icon it had when created. Never add an install button unless asked.
H. PERFORMANCE — measure first-load transferred bytes and the largest assets (CDP Network), LCP/CLS/long tasks via PerformanceObserver, animation cost. Budgets: first load <= ~2 MB on phone, no image shown at
   <= 1/3 of its natural size (downscale), animated GIFs replaced/shrunk when tiny on screen, fonts subsetted, no render-blocking waste, no repeated Firebase reads, no unreferenced files in the deploy.
I. A11Y/I18N — WCAG 2.2 AA essentials: names for every control, labels, focus order/visibility, contrast of real text, target size >= 24 px, `lang`, reduced motion, 3-language completeness (grep for strings
   missing in one language), no hard-coded text outside the tables.
J. GAME LOGIC — invariants, not features: conservation of credits (balance after = before - stake + payout), stake caps enforced in engine + server + UI, payout table identical client/server
   (`deployment-check.js`), RTP simulation within tolerance (`audit-simulations.js`), jackpot/WILD rules unchanged, no integer/float drift at the largest balances (hundreds of millions), idempotent replays.
K. DEPENDENCIES/SUPPLY CHAIN — lockfile consistent, no unexpected install scripts, versions pinned sensibly, unused deps, advisory reachability.
L. DEAD/DUPLICATE CODE — remove only with traced references and a reversible commit; otherwise list.
For each finding record: ID, severity (P0 data loss/security/outage · P1 wrong behaviour users hit · P2 degraded/edge case · P3 polish), evidence label, root cause, fix or reason not fixed.
### Phase 3 — Repair protocol (per finding)
FIND -> UNDERSTAND -> trace dependents -> ROOT CAUSE -> smallest change -> targeted test (add a regression test for logic/security fixes) -> check neighbours -> own commit. P0/P1 fix now, P2 if cheap,
P3 report only. Bump `?v=` for every edited linked asset; keep file encodings/line endings (UTF-8, CRLF where present; patch with Python or the edit tool, never `Get-Content | Set-Content`).
Commit locally with the project trailer and a message file; never amend, never push.
### Phase 4 — Verification matrix (EMULATED unless stated)
- Logic/security: full Jest + ESLint + `deployment-check.js`; fault injection with request interception (401/429/500/400/timeouts, offline, slow network) asserting the visible message per language.
- Layout: 11 viewports (320x568 ... 2560x1440) x 3 languages + live portrait<->landscape switches; script prints findings only (page wider than screen, elements outside, clipped text, reel cells < 18 px).
- Modes: browser tab (390 px, insets 0) / REAL standalone (`--app=URL` + safe-area override) / desktop; real touch events; art->card gap and rectangle diff.
- Pixels: pause animations, full-page capture, sample rows/columns (edges, seams, haze), before/after diff with a stated threshold.
- PWA: installability errors, manifest + every icon URL (status, type, bytes), SW registration, update after a version bump.
- Perf: bytes by type, top-10 assets, LCP/CLS numbers, before/after for any asset change.
Anything not runnable -> NOT VERIFIED with the exact user step.
### Phase 5 — Deploy-readiness gate (WITHOUT deploying)
Jest/ESLint green · `vercel.json` parses · `node -e require('./api/<fn>.js')` loads · manifest/icons/sw paths resolve · `.vercelignore` excludes nothing the site needs · no secret tracked or in backups ·
env var NAMES referenced == names the user set (ask the user to confirm names only) · unpushed commits listed · asset `?v=` bumped for every changed file · release note for the user.
### Phase 6 — Memory and backup
Update the EXISTING mechanism only: CONTEXT.md (state/open items), MEMORY.md (permanent facts, new traps, lessons), ARCHITECTURE.md (if structure changed), CHANGELOG.md (newest first, hashes), mirror the 4 files to
`docs-context/`, save touched files in `ClauBack\LXAV1\vN\` + README, update NOTES.md, commit. No secrets, no speculation, no duplicate memory systems.
### Phase 7 — Report (Romanian, <= 35 lines)
STATUS line · 1 Reparat (ID, one line each) · 2 Păstrat (design/game math untouched) · 3 Vercel/Deploy-ready · 4 Compatibilitate (per mode, with evidence labels) · 5 Securitate · 6 Teste (exact numbers) ·
7 Memorie · 8 Neverificat + DEVICE TEST CARD for the user (exact steps + what to screenshot: iPhone Safari tab, iPhone PWA after fully closing it, Android Chrome tab and "Install app", with `?debug=1` when a tap fails)
· end with the push/deploy reminder the project requires. STOP.

## 5. SELF-REVIEW BEFORE "DONE" (one pass, cheap)
Read your own diff as a hostile reviewer: unintended files? secrets? BOM/mojibake/line endings? every asset `?v=` bumped? all 3 languages? any hidden-error path left? any test you should have added? any claim in
the report without an evidence label? any leftover scratch processes/profiles/servers (kill them) and disk space restored?

## 6. DEFINITION OF DONE
Ledger has no open P0/P1 · every fix has a regression check · full regression green at the final HEAD · memory + backup updated and mirrored · nothing pushed or deployed · the report separates RUNTIME/EMULATED
from NOT VERIFIED and tells the user exactly what only they can check.

## 7. ANTI-PATTERNS (each one cost real time before)
Fixing one display mode and not measuring the others · trusting an edited CSS file instead of the computed style · judging a bug from a stale installed PWA · hiding errors behind a `display:none` element ·
`return {}` on a failed read · trusting a platform-specific client-IP header · copying `.env*` into backups · leaving headless profiles on disk · declaring "verified on iOS/Android" from emulation ·
re-deriving facts already in MEMORY.md · rewriting UTF-8 files through PowerShell text cmdlets · long explanations to a user who asked for short numbered answers.
