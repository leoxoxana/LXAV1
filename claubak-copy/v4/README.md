# v4 — Installed app header: glow only over the art band (2026-10-03)

Files (same relative paths as the LXAV1 root): `layout-fix.css` (new block at the end), `index.html` (layout-fix.css?v=433).

Problem (user screenshots, browser vs PWA): purple haze above the animated LXA in the installed app, not in the phone browser.
Cause: in standalone the `.brand` box = status-bar spacer + art (112px); the animated `::after` glow (% of the box) bloomed into the spacer.
Fix: `@media (display-mode:standalone){ .brand::after{inset:env(safe-area-inset-top,0px) 0 8px 0!important} }`.

Measured (Edge --app + safe-area 62px, 440px wide, frames paused at 1.5 s): area above the art colour range 31/25/41 -> 7/2/5; art-band brightness browser 57.2, PWA 58.3.
NOT verified on a real iPhone. NOT deployed.
