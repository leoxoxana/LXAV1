# v9 - Accessibility: visible keyboard focus, landmark names per language (2026-10-03, commit 90d32ac)
Files: renderer.js (v=405), index.html, layout-fix.css (v=435), deep_b2.js (DEEP audit part 2 script: first-load weight + LCP/CLS, offline/SW, keyboard, contrast; needs cdp_lib.js from the MEMORY.md recipe).
Verified in headless Edge (emulated): focus ring on all 17 tab stops, aria names in de/ro/en, layout matrix 0 findings. NOT deployed.
