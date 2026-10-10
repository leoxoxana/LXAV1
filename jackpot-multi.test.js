// (server spin) multi-line jackpot. Account nodes are keyed "<id> : <name>" (e.g. "25 : ANA"); lookups use the id FIELD, so legacy `account:N` and hand-edited nodes still work, and
// every save refreshes the node key after an ID/name edit.
jest.mock('./functions/firebase-storage.js', () => {
  let accounts = {}, leaderboards = {}, rtpSettings = {};
  return {
    getAccounts: async () => accounts,
    saveAccounts: async next => { accounts = next; },
    updateAccount: async (key, mutate) => {
      const next = mutate(accounts[key]);
      if (next === undefined) throw new Error('Account update did not commit');
      if (next === null) delete accounts[key]; else accounts[key] = next;
    },
    getLeaderboard: async () => leaderboards,
    saveLeaderboard: async next => { leaderboards = next; },
    getRtpSettings: async () => rtpSettings,
    saveRtpSettings: async next => { rtpSettings = next; },
    __put: (key, account) => { accounts[key] = account; },
    __accounts: () => accounts
  };
});

function setup() {
  jest.resetModules();
  const storage = require('./functions/firebase-storage.js');
  const { handler } = require('./functions/lxa-account.js');
  const call = async (action, data) => JSON.parse((await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ action, ...data }) })).body);
  return { storage, call };
}
const player = (id, name, extra = {}) => ({ id, name, safeWord: 'pw', balance: 1000, bank: 0, wildLevel: 0, difficulty: 2, createdAt: 1000 + id, ...extra });

describe('server spin: every new natural 10/10 line of a spin counts', () => {
  afterEach(() => jest.restoreAllMocks());

  test('all five lines at 10/10 in one spin pay tiers 1..5 and restart the cycle', async () => {
    const { storage, call } = setup();
    storage.__put('7 : Zed', player(7, 'Zed', { balance: 1000000 }));
    jest.spyOn(Math, 'random').mockReturnValue(0.999999999);
    const res = await call('spin', { id: 7, safeWord: 'pw', bet: 10, difficulty: 1 });
    jest.restoreAllMocks();
    expect(res.spin.jackpotAwards.map(a => a.line)).toEqual([0, 1, 2, 3, 4]);
    expect(res.spin.jackpotAwards.map(a => a.amount)).toEqual([10, 20, 30, 40, 50]);
    expect(res.spin.jackpotCycleCompleted).toBe(true);
    expect(res.account.jackpotProgress).toBe(0);
    expect(res.missionBonus).toBe(150);
  });
});
