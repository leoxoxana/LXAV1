# v1 — Stake can be changed while AUTO runs (2026-10-03)

Files (same relative paths as in the LXAV1 root): `renderer.js`, `index.html` (renderer.js?v=400).

What changed
- While AUTO is on, `+`, `-` and `50%` work during a round. The new stake is shown at once, remembered in `queuedBet`
  and re-applied right after the round result lands (`gameState = result.state`), clamped to balance and `maxBetForWildLevel`.
- `queuedBet` is cleared at every round start. Manual (non-AUTO) spins stay locked while `spinning`.

Why: AUTO leaves only 0.26 s between rounds and `+/-/50%` returned early while `spinning`, so the stake was practically locked.

Verified (headless Edge 390 px, guest): 100 -> `+,+` mid-round -> 120; stake per round = 100 (in flight), then 120 x4;
50% mid-round at 100k -> 50,000 next round; `+` x30 at 120M/WILD 0 stays at the 1,250,000 cap; manual spin: `+` stays locked.
Jest 56/56, ESLint 0 errors. NOT verified on a real phone. NOT deployed.

Restore: copy these two files over the repo files (or `git revert` the commit "Allow changing the stake while AUTO runs").
