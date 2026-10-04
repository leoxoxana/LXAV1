// The player's rank on the leaderboard: by id when the account has a row, otherwise ranked by its own score (it used to come back null -> "#-").
// The board is rebuilt from the real accounts when it is read: every row needs an existing account (names and scores come from the account).
const BOARD = 'leaderboard:profile-3:1';
jest.mock('./functions/firebase-storage.js', () => {
  let accounts = {};
  const boards = { 'leaderboard:profile-3:1': [
    { id: 901, name: 'A', score: 50, updatedAt: 1 }, { id: 902, name: 'B', score: 10, updatedAt: 2 }, { id: 903, name: 'C', score: -5, updatedAt: 3 }] };
  return {
    getAccounts: async () => accounts, saveAccounts: async next => { accounts = next; },
    updateAccount: async (key, mutate) => { const next = mutate(accounts[key]); if (next === undefined) throw new Error('no commit'); if (next === null) delete accounts[key]; else accounts[key] = next; },
    reserveAccountId: async floor => floor + 1,
    getLeaderboard: async () => boards,
    saveLeaderboard: async () => {}, getRtpSettings: async () => ({}), saveRtpSettings: async () => {},
    __accounts: () => accounts
  };
});

let ip = 0;
async function setup() {
  jest.resetModules();
  const storage = require('./functions/firebase-storage.js');
  const { handler } = require('./functions/lxa-account.js');
  const call = async (action, data) => { const r = await handler({ httpMethod: 'POST', headers: { 'x-vercel-forwarded-for': '10.8.0.' + (ip++ & 255) }, body: JSON.stringify({ action, ...data }) }); return { status: r.statusCode, body: JSON.parse(r.body) }; };
  const made = await call('create', { name: 'Rank' + ip });
  // the three rows of the board belong to real accounts (their name and score are read from them)
  const accounts = storage.__accounts();
  [[901, 'A', 50], [902, 'B', 10], [903, 'C', -5]].forEach(([id, name, score]) => { accounts[id + ' : ' + name] = { id, name, role: 'user', createdAt: id, updatedAt: id, difficultyData: { 1: { score, spins: 1, wins: 0 } } }; });
  return { call, storage, id: made.body.account.id };
}

test('an account without a row is ranked by its own score among the rows', async () => {
  const t = await setup();
  const acc = Object.values(t.storage.__accounts()).find(a => a.id === t.id);
  acc.difficultyData = { 1: { score: 20, spins: 3, wins: 1 } };
  const r = await t.call('leaderboard', { difficulty: 1, id: t.id });
  expect(r.status).toBe(200);
  expect(r.body.yourPosition).toBe(2);          // 50 > 20 > 10
  acc.difficultyData = { 1: { score: -100, spins: 1, wins: 0 } };
  expect((await t.call('leaderboard', { difficulty: 1, id: t.id })).body.yourPosition).toBe(4);
  acc.difficultyData = { 1: { score: 999, spins: 1, wins: 1 } };
  expect((await t.call('leaderboard', { difficulty: 1, id: t.id })).body.yourPosition).toBe(1);
});

test('an account that has a row keeps the position found by its id, and a request without an id has none', async () => {
  const t = await setup();
  const board = await t.storage.getLeaderboard();
  board[BOARD][1].id = t.id;                    // the row of B now belongs to this account
  const acc = Object.values(t.storage.__accounts()).find(a => a.id === t.id);
  acc.difficultyData = { 1: { score: 10, spins: 2, wins: 1 } };
  const r = await t.call('leaderboard', { difficulty: 1, id: t.id });
  expect(r.body.yourPosition).toBe(2);
  expect((await t.call('leaderboard', { difficulty: 1 })).body.yourPosition).toBeNull();
  expect(r.body.records.length).toBe(3);
});
