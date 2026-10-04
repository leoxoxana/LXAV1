# v2 — Header gap parity browser / PWA / PC (2026-10-03)

Files (same relative paths as the LXAV1 root): `layout-fix.css` (new block at the end), `index.html` (layout-fix.css?v=432).

What changed: `@media not all and (display-mode:standalone){ .topbar{margin-bottom:calc(var(--lxa-logo-h)*.1 + 3px)} }`.
Measured gap between the animated header art and the cards (390 px phone, 1280 px PC):
before = browser -1px, PC -2px (overlap), PWA +6px; after = +6px in all three. Layout below the header: browser vs PWA identical (<=1px, 18 elements).

Measuring recipe (permanent, see CONTEXT\MEMORY.md): Edge headless `--app=URL` = real standalone + `Emulation.setSafeAreaInsetsOverride`.

NOT verified on a real iPhone/Android. NOT deployed. Open: "SPIN dead in phone browsers" (not reproduced), stale PWA on the user's phone.
Restore: copy the two files back or `git revert` the commit "Header: same gap under the animated art ...".
