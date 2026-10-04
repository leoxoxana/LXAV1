# v5 — Android icons, mission card, visible spin errors (2026-10-03)

Files (same relative paths as the LXAV1 root): `manifest.webmanifest`, `sw.js` (cache lxa-v3), `index.html`, `layout-fix.css` (v=434), `renderer.js` (v=402), `spin-button.js` (v=9),
`assets/icons/lxa-icon-192.png`, `lxa-icon-512.png`, `lxa-icon-512-maskable.png`.

1. Icons: Drollyv3 had the same icon set; difference = file size (Drolly 14/52/41 KB, LXA 79/454/352 KB) and `?v=2` URLs. New palette-compressed icons (32/171/110 KB), no query strings.
   The user's LXA tile on the Android launcher is a white launcher-made shortcut (no WebAPK). Existing shortcut keeps its old bitmap: remove and re-add after deploying.
2. Mission card: smaller title/goal, gap 6px between the LINIE row and the prize row, no light frame around the LINIE row. Checked 320-1280 px x de/ro/en.
3. Spin errors shown under SPIN (red): spinErrSession/Busy/Net/Fail (+ MAX BET), expired session opens the login panel. `#message` is display:none, which hid every error before.

NOT verified on a real phone. NOT deployed. Restore: copy files back or `git revert` the commit "Compact app icons, tidier mission card, visible spin errors".
