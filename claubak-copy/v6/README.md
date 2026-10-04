# v6 — Master audit fixes (2026-10-03)

Files (same relative paths as the LXAV1 root): `functions/firebase-storage.js`, `functions/lxa-account.js`, `functions/security.js`, `scripts/build.js`, `index.html` (chance slider aria),
`.vercelignore`, `storage-failure.test.js`, `storage-contract.test.js`, `assets/kofi-rainbow-mug.gif` (120 px), `assets/letters/*.png` (palette PNG).
The ORIGINAL letters (6 x ~135 KB) and the original 600 px mug GIF are in `FULL_2026-10-03_116ffd8\assets` and in git history.

- getAccounts fails closed; strict getLeaderboard/getRtpSettings for read-modify-write callers (a failed read used to look like an empty database -> duplicate ids / wiped nodes).
- Client IP from Vercel headers (the Netlify-only header was spoofable) -> per-IP login/create limits are real again. Pepper warning in production if LXA_PEPPER is missing.
- .vercelignore: tests/docs/dev tools/unreferenced source art are not uploaded.
- Assets: letters ~135 -> ~34 KB each, mug GIF 533 -> 126 KB. a11y: slider name.
- Tests 63/63, ESLint 0 errors. Layout audit 33 combinations + 4 orientation switches: 0 findings. Header gap 6 px in browser/PWA/PC.
- Anonymous Firebase access probe: read 401, write 401. NOT verified on real devices. NOT deployed.

Restore: `git revert` the commit "Audit fixes: fail-closed Firebase reads, real client IP on Vercel, lighter assets".
