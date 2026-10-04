# v8 - Persistent login, real logout, AUTO waits while the bet changes (2026-10-03, commit 4f748aa)
Files: functions/lxa-account.js, renderer.js (v=404), index.html, auth-session.test.js (12 tests), e2e_auth_auto.js (21 end-to-end checks: real Edge page -> intercepted /api -> the REAL handler with in-memory storage; needs cdp_lib.js from MEMORY.md recipe).
See CHANGELOG 'Persistent login, logout, AUTO/bet synchronisation'. NOT deployed. NOT verified on real devices.
Restore: git revert the commit 'Persistent login, real logout, and AUTO that waits while the bet changes'.
