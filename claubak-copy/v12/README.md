# v12 - No rounding: same return at every stake (2026-10-03, commit c138f58)
Files: game-engine.js (v=378: cents() = 2 decimals like the server money()), index.html, rtp-linked.test.js (+2 tests), server_rtp_stake3.js (measures the real server path at stakes 5/10/50/1000).
Server path was already exact (163.0/162.7/163.5/163.6%); only the guest engine rounded to whole euros (stake 5: 181.6/156.5/129.5%). Jest 91/91. NOT deployed.
