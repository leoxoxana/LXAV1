// EVERY player (not only admins) can change his own name / password in KONTO > Einstellungen: the current password proves who he is, the new one replaces it at once.
jest.mock('./functions/firebase-storage.js', () => {
  let accounts = {}, boards = {};
  return {
    getAccounts: async () => JSON.parse(JSON.stringify(accounts)), saveAccounts: async next => { accounts = next; },
    updateAccount: async (key, mutate) => { const next = mutate(accounts[key] === undefined ? undefined : JSON.parse(JSON.stringify(accounts[key]))); if (next === undefined) throw new Error('no commit'); if (next === null) delete accounts[key]; else accounts[key] = next; },
    reserveAccountId: async floor => floor + 1, reserveName: async () => true, getLeaderboard: async () => boards, saveLeaderboard: async next => { boards = next; }, getRtpSettings: async () => ({}), saveRtpSettings: async () => {},
    __reset: () => { accounts = {}; boards = {}; }
  };
});
let ip = 0;
async function setup() {
  jest.resetModules(); require('./functions/firebase-storage.js').__reset();
  const { handler } = require('./functions/lxa-account.js');
  return async (action, data) => { const r = await handler({ httpMethod: 'POST', headers: { 'x-vercel-forwarded-for': '10.8.0.' + (ip++ & 255) }, body: JSON.stringify({ action, ...data }) }); return { status: r.statusCode, body: JSON.parse(r.body) }; };
}
test('a normal player changes his password with the current one: new works, old does not, the device stays logged in', async () => {
  const call = await setup(); const made = (await call('create', { name: 'Normal' })).body, id = made.account.id, auto = made.safeWord;
  expect(made.account.role).not.toBe('admin'); expect(auto).toBeTruthy();
  const res = await call('update', { id, name: 'Normal', safeWord: auto, newSafeWord: 'MyOwn123', token: made.token });
  expect(res.status).toBe(200); expect(res.body.token).toBeTruthy();
  expect((await call('login', { id, safeWord: 'MyOwn123' })).status).toBe(200);
  expect((await call('login', { id, safeWord: auto })).status).toBe(401);
});
test('the SAME save sent a second time (double tap) answers Wrong password because the old one is gone - the client now sends it once and shows "saved"', async () => {
  const call = await setup(); const made = (await call('create', { name: 'Twice' })).body, id = made.account.id;
  expect((await call('update', { id, name: 'Twice', safeWord: made.safeWord, newSafeWord: 'Second11', token: made.token })).status).toBe(200);
  const again = await call('update', { id, name: 'Twice', safeWord: made.safeWord, newSafeWord: 'Second11', token: made.token });
  expect(again.status).toBe(401); expect(again.body.error).toBe('Wrong password.');
});
test('a wrong current password changes nothing; the name alone can be changed with the current password', async () => {
  const call = await setup(); const made = (await call('create', { name: 'Keeper' })).body, id = made.account.id;
  expect((await call('update', { id, name: 'Keeper', safeWord: 'nope', newSafeWord: 'Hacked99' })).status).toBe(401);
  expect((await call('login', { id, safeWord: made.safeWord })).status).toBe(200);
  const renamed = await call('update', { id, name: 'Keeper2', safeWord: made.safeWord }); expect(renamed.status).toBe(200); expect(renamed.body.account.name).toBe('Keeper2');
  expect((await call('login', { id, safeWord: made.safeWord })).status).toBe(200);   // password unchanged
});
