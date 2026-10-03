// Two simultaneous `create` calls with the same name used to both pass the "name already used" check (both read the accounts before either saved), giving two players with one name.
// The name is now claimed with an atomic reservation (meta/names/<digest>), like the id counter.
jest.mock('./functions/firebase-storage.js', () => {
  let accounts = {}, names = {}, nextId = 11;
  const copy = value => (value === null || value === undefined ? value : JSON.parse(JSON.stringify(value)));
  const tick = () => new Promise(resolve => setImmediate(resolve));
  return {
    // a slow read: both racers read the accounts before either of them has saved
    getAccounts: async () => { const snapshot = copy(accounts); await tick(); await tick(); return snapshot; },
    saveAccounts: async next => { accounts = copy(next); },
    updateAccount: async (key, mutate) => { await tick(); const next = mutate(copy(accounts[key]) || null); if (next === undefined) throw new Error('no commit'); if (next === null) delete accounts[key]; else accounts[key] = copy(next); },
    reserveAccountId: async floor => { await tick(); nextId = Math.max(nextId, floor) + 1; return nextId; },
    // atomic like a Firebase transaction: the function runs synchronously on the current value
    reserveName: async (digest, id, now = Date.now()) => { await tick(); const current = names[digest]; if (current && current.id !== id && now - current.at < 60000) return false; names[digest] = { id, at: now }; return true; },
    getLeaderboard: async () => ({}), saveLeaderboard: async () => {}, getRtpSettings: async () => ({}), saveRtpSettings: async () => {},
    __names: () => names
  };
});

let ip = 0;
const setup = () => { jest.resetModules(); const { handler } = require('./functions/lxa-account.js'); return async (action, data) => { const r = await handler({ httpMethod: 'POST', headers: { 'x-vercel-forwarded-for': '10.13.0.' + (ip++ & 255) }, body: JSON.stringify({ action, ...data }) }); return { status: r.statusCode, body: JSON.parse(r.body) }; }; };

test('two simultaneous creates with the same name: exactly one wins, the other gets "name in use"', async () => {
  const call = setup();
  const [a, b] = await Promise.all([call('create', { name: 'Twin' }), call('create', { name: 'twin ' })]);
  expect([a.status, b.status].sort()).toEqual([200, 409]);
  expect((a.status === 409 ? a : b).body.error).toMatch(/already in use/i);
});

test('three at once, still exactly one account', async () => {
  const call = setup();
  const results = await Promise.all([call('create', { name: 'Triple' }), call('create', { name: 'Triple' }), call('create', { name: 'TRIPLE' })]);
  expect(results.filter(r => r.status === 200)).toHaveLength(1);
  expect(results.filter(r => r.status === 409)).toHaveLength(2);
});

test('different names are not affected, and a taken name is still refused later by the normal check', async () => {
  const call = setup();
  const [a, b] = await Promise.all([call('create', { name: 'Alpha' }), call('create', { name: 'Bravo' })]);
  expect([a.status, b.status]).toEqual([200, 200]);
  expect((await call('create', { name: 'Alpha' })).status).toBe(409);
});
