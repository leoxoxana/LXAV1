# v3 — Opt-in ?debug=1 overlay for the SPIN button (2026-10-03)

Files (same relative paths as the LXAV1 root): `renderer.js` (trace calls in the SPIN onclick, v=401), `spin-button.js` (overlay + `api.trace`, v=8), `index.html` (versions).

Why: the user says SPIN does nothing at all in phone browsers (works in the installed app). Not reproducible in emulation. With `?debug=1` the page shows an on-screen log:
taps (target + element on top), JS errors/rejections, SPIN handler decisions (onclick type, spinning, credits, bet, "round starts", "round failed: ...").
Without the parameter nothing is created. Nothing is stored or sent. The text is English only (developer tool, not UI).

Verified locally with a real touch tap: pointerdown -> onclick -> round starts -> click dropped. NOT yet run on the user's phone. NOT deployed.
Restore/removal: `git revert` the commit "Opt-in ?debug=1 on-screen log for the SPIN button" once the cause is found.
