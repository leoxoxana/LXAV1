# v10 - Connected RTP switch + exact total-RTP model (2026-10-03, commit 210872f)
Files: game-engine.js (v=377), functions/lxa-account.js, renderer.js (v=406), index.html, layout-fix.css (v=436), rtp-linked.test.js, rtp-linked-server.test.js, e2e_rtp_admin.js, rtp_chain_check.js (scripts need cdp_lib.js from the MEMORY.md recipe).
Admin Panel > RTP: switch linked (value = TOTAL RTP incl. WILD + jackpot at a reference WILD level) vs disconnected (value = line return, default). Exact model validated vs 300k-spin chained simulations. 89 Jest tests, 9 end-to-end checks. NOT deployed.
