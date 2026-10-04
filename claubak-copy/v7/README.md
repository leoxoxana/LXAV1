# v7 - DEEP audit round 2 (2026-10-03, commit 32bf9e7)
Files: functions/firebase-storage.js (reserveAccountId), functions/lxa-account.js (create uses it), vercel.json (+Permissions-Policy, +Cross-Origin-Opener-Policy), account-id-counter.test.js.
Why: 5 parallel creates all got id 12 (duplicate ids). Tests 64/64, ESLint 0 errors. NOT deployed, NOT verified on real Firebase (transaction path untested against the live DB).
Restore: git revert the commit 'Atomic account ids and two more security headers'.
