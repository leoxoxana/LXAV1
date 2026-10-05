// RULE: a line that holds a WILD emblem is never written into the line records (LINIE n x/10) and never counts for the jackpot mission - only lines WITHOUT a wild emblem do.
// Checked over many random spins with a high WILD level (so wild-assisted 10/10 lines are frequent), in the engine (guests) and in the server spin (accounts).
jest.mock('./functions/firebase-storage.js', () => {
  let accounts = {}, boards = {};
  return {
    getAccounts: async () => JSON.parse(JSON.stringify(accounts)), saveAccounts: async next => { accounts = next; },
    updateAccount: async (key, mutate) => { const next = mutate(accounts[key]); if (next === undefined) throw new Error('no commit'); if (next === null) delete accounts[key]; else accounts[key] = next; },
    reserveAccountId: async floor => floor + 1, getLeaderboard: async () => boards, saveLeaderboard: async next => { boards = next; }, getRtpSettings: async () => ({}), saveRtpSettings: async () => {},
    __set: a => { accounts = a; boards = {}; }, __accounts: () => accounts
  };
});
const game = require('./game-engine.js');

const wildLines = spin => new Set((spin.wild.positions || []).map(p => p.line));

test('engine: lines with a wild emblem never change the records and never win the jackpot', () => {
  let state = game.initialState({ credits: 1e12, bet: 5, wildLevel: 50, difficulty: 3 }), wildTens = 0, jackpots = 0;
  for (let i = 0; i < 4000; i++) {
    const before = state.recordHits.slice(), { state: next, spin } = game.resolveSpin(state), wl = wildLines(spin);
    for (const line of wl) {
      if (!spin.jackpotCycleCompleted) expect(next.recordHits[line]).toBe(before[line]);   // (when a NATURAL jackpot finishes the 5/5 cycle, all records restart at 0)
      if (spin.finalResults[line] === 10) wildTens++;
    }
    for (const award of spin.jackpotAwards) { jackpots++; expect(wl.has(award.line)).toBe(false); }
    state = game.initialState({ ...next, credits: 1e12 });
  }
  expect(wildTens).toBeGreaterThan(50);   // the situation really happened many times
});

test('engine: a line without a wild emblem still counts (records and jackpot) - the rule is not "never"', () => {
  let state = game.initialState({ credits: 1e12, bet: 5, wildLevel: 0, difficulty: 3 }), naturalTens = 0, recordsMoved = false;
  for (let i = 0; i < 40000 && !naturalTens; i++) {
    const before = state.recordHits.slice(), { state: next, spin } = game.resolveSpin(state);
    if (spin.jackpotAwards.length) naturalTens++;
    if (next.recordHits.some((v, l) => v > before[l])) recordsMoved = true;
    state = game.initialState({ ...next, credits: 1e12 });
  }
  expect(recordsMoved).toBe(true);
});

test('server spin (accounts): same rule - wild lines are not recorded and never pay or complete the jackpot mission', async () => {
  jest.resetModules();
  const storage = require('./functions/firebase-storage.js');
  const acc = { id: 5, name: 'Wilder', role: 'user', safeWord: 'pw', createdAt: 1, updatedAt: 1, balance: 1e9, bank: 0, wildLevel: 50, difficulty: 3, records: [0, 0, 0, 0, 0], completedLines: [false, false, false, false, false], jackpotProgress: 0, stats: { spins: 0, wins: 0, totalWon: 0 }, history: [], difficultyData: {} };
  storage.__set({ '5 : Wilder': acc });
  const { handler } = require('./functions/lxa-account.js'); let n = 0, wildTens = 0;
  for (let i = 0; i < 150; i++) {
    const before = JSON.parse(JSON.stringify(storage.__accounts()['5 : Wilder']));
    const r = await handler({ httpMethod: 'POST', headers: { 'x-vercel-forwarded-for': '10.1.1.' + (n++ % 250) }, body: JSON.stringify({ action: 'spin', id: 5, safeWord: 'pw', bet: 5, difficulty: 3, requestId: 'req' + i }) });
    const body = JSON.parse(r.body); if (r.statusCode !== 200) throw new Error(r.body);
    const wl = wildLines(body.spin), after = body.account;
    for (const line of wl) { if (body.spin.finalResults[line] === 10) wildTens++; if (!body.spin.jackpotCycleCompleted) expect(after.records[line]).toBe(before.records[line]); }
    for (const award of body.spin.jackpotAwards) expect(wl.has(award.line)).toBe(false);
    storage.__accounts()['5 : Wilder'].balance = 1e9;
  }
  expect(wildTens).toBeGreaterThan(20);
});
