// Account nodes are keyed "<id> : <name>" (e.g. "25 : ANA"); lookups use the id FIELD, so legacy `account:N` and hand-edited nodes still work, and
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

describe('account node keys', () => {
  test('ids above 999 keep a plain number in the key', async () => {
    const { storage, call } = setup();
    storage.__put('account:1500', player(1500, 'Zed'));
    await call('spin', { id: 1500, safeWord: 'pw', bet: 5, difficulty: 2 });
    expect(Object.keys(storage.__accounts())).toEqual(['1500 : Zed']);
  });

  test('a new account is stored under a "<id> : <name>" key', async () => {
    const { storage, call } = setup();
    const created = await call('create', { name: 'Anna' });
    const id = created.account.id;
    expect(Object.keys(storage.__accounts())).toEqual([`${id} : Anna`]);
  });

  test('a legacy account:N node is found by id and renamed on the next save', async () => {
    const { storage, call } = setup();
    storage.__put('account:13', player(13, 'Leo'));
    const res = await call('spin', { id: 13, safeWord: 'pw', bet: 5, difficulty: 2 });
    expect(res.account).toBeDefined();
    expect(Object.keys(storage.__accounts())).toEqual(['13 : Leo']);
  });

  test('a node whose id field was edited by hand is found by the new id', async () => {
    const { storage, call } = setup();
    storage.__put('account:13', player(3, 'Leo'));
    const login = await call('login', { id: 3, safeWord: 'pw' });
    expect(login.account.id).toBe(3);
    expect((await call('login', { id: 13, safeWord: 'pw' })).error).toBeDefined();
  });

  test('admin edit of id and name moves the node to the refreshed key and drops the old one', async () => {
    const { storage, call } = setup();
    storage.__put('1 : Admin', player(1, 'Admin', { role: 'admin' }));
    storage.__put('12 : Bob', player(12, 'Bob'));
    const res = await call('admin-update-player', { id: 1, safeWord: 'pw', playerId: 12, newId: 40, newName: 'Bobby' });
    expect(res.error).toBeUndefined();
    expect(Object.keys(storage.__accounts()).sort()).toEqual(['1 : Admin', '40 : Bobby']);
  });

  test('opening the admin players list normalises every legacy key once', async () => {
    const { storage, call } = setup();
    storage.__put('1 : Admin', player(1, 'Admin', { role: 'admin', updatedAt: 5 }));
    storage.__put('account:12', player(12, 'Bob', { updatedAt: 7 }));
    storage.__put('account:13', player(13, 'Cleo', { updatedAt: 9 }));
    const res = await call('list-players', { id: 1, safeWord: 'pw' });
    expect(res.players.map(p => p.id)).toEqual([1, 12, 13]);
    expect(Object.keys(storage.__accounts()).sort()).toEqual(['1 : Admin', '12 : Bob', '13 : Cleo']);
    expect(storage.__accounts()['12 : Bob'].updatedAt).toBe(7);
  });

  test('an account with role admin and a low or hand-edited id (0-10) logs in and keeps its admin role', async () => {
    const { storage, call } = setup();
    storage.__put('account:13', player(3, 'Leo', { role: 'admin' }));
    storage.__put('account:1', player(1, 'Boss', { role: 'admin' }));
    storage.__put('account:0', player(0, 'Zero', { role: 'admin' }));
    for (const id of [3, 1, 0]) {
      const login = await call('login', { id, safeWord: 'pw' });
      expect(login.account.role).toBe('admin');
      expect((await call('list-players', { id, safeWord: 'pw' })).players.length).toBeGreaterThan(0);
    }
  });

  test('server rejects a stake above half the next WILD level price and accepts exactly that stake', async () => {
    const { storage, call } = setup();
    storage.__put('1 : Rich', player(1, 'Rich', { balance: 1e10 }));
    const tooMuch = await call('spin', { id: 1, safeWord: 'pw', bet: 1250005, difficulty: 2 });
    expect(tooMuch.error).toMatch(/maximum/);
    const ok = await call('spin', { id: 1, safeWord: 'pw', bet: 1250000, difficulty: 2 });
    expect(ok.error).toBeUndefined();
    expect(ok.account).toBeDefined();
  });
});
