// The leaderboard shows the real accounts: no rows of deleted accounts, current names, current scores, one row per account, and the rank is the index in the list that is shown.
jest.mock('./functions/firebase-storage.js', () => {
  let accounts = {}, boards = {}, unreadable = false;
  return {
    getAccounts: async () => { if (unreadable) throw new Error('boom'); return JSON.parse(JSON.stringify(accounts)); },   // a copy, like a real database read saveAccounts: async next => { accounts = next; },
    updateAccount: async (key, mutate) => { const next = mutate(accounts[key]); if (next === undefined) throw new Error('no commit'); if (next === null) delete accounts[key]; else accounts[key] = next; },
    reserveAccountId: async floor => floor + 1,
    getLeaderboard: async () => boards, saveLeaderboard: async next => { boards = next; }, getRtpSettings: async () => ({}), saveRtpSettings: async () => {},
    __set: (a, b) => { accounts = a; boards = b; }, __accounts: () => accounts, __unreadable: v => { unreadable = v; }
  };
});

const ROW = (id, name, score, updatedAt = id) => ({ id, name, score, updatedAt });
const ACC = (id, name, score, level = 2) => ({ id, name, role: 'user', createdAt: id, updatedAt: id, balance: score, bank: 0, difficultyData: { [level]: { score, spins: 5, wins: 1 } } });
let ip = 0;
async function setup(accountList, rows) {
  jest.resetModules();
  const storage = require('./functions/firebase-storage.js');
  storage.__set(Object.fromEntries(accountList.map(a => [a.id + ' : ' + a.name, a])), { 'leaderboard:profile-3:2': rows });
  const { handler } = require('./functions/lxa-account.js');
  const call = async (action, data) => { const r = await handler({ httpMethod: 'POST', headers: { 'x-vercel-forwarded-for': '10.9.0.' + (ip++ & 255) }, body: JSON.stringify({ action, ...data }) }); return { status: r.statusCode, body: JSON.parse(r.body) }; };
  return { call, storage };
}
const names = r => r.body.records.map(x => x.name);

test('a row whose account no longer exists disappears (the second "Leo" of the screenshot)', async () => {
  const t = await setup([ACC(1, 'Leo', -57327.25), ACC(2, 'AiDrian', 141)], [ROW(2, 'AiDrian', 141), ROW(77, 'Leo', 65.25), ROW(1, 'Leo', -57327.25)]);
  const r = await t.call('leaderboard', { difficulty: 2, id: 1 });
  expect(names(r)).toEqual(['AiDrian', 'Leo']);
  expect(r.body.records.find(x => x.name === 'Leo').score).toBe(-57327.25);
  expect(r.body.yourPosition).toBe(2);
});
test('the name and the score are the account\'s own, not the ones stored in the row (rename, stale score)', async () => {
  const t = await setup([ACC(1, 'NewName', 80), ACC(2, 'Other', 30)], [ROW(1, 'OldName', 5), ROW(2, 'Other', 99)]);
  const r = await t.call('leaderboard', { difficulty: 2, id: 2 });
  expect(r.body.records).toEqual([{ name: 'NewName', score: 80, lvl: 0 }, { name: 'Other', score: 30, lvl: 0 }]);   // re-ordered by the real scores
  expect(r.body.yourPosition).toBe(2);
});
test('ties: the row that reached the score first stays ahead; one row per account even if the board holds the id twice', async () => {
  const t = await setup([ACC(1, 'First', 10), ACC(2, 'Second', 10)], [ROW(2, 'Second', 10, 20), ROW(1, 'First', 10, 10), ROW(1, 'First', 10, 10)]);
  const r = await t.call('leaderboard', { difficulty: 2, id: 2 });
  expect(names(r)).toEqual(['First', 'Second']); expect(r.body.yourPosition).toBe(2);
});
test('the position is always the index in the shown list, also when the account has no row yet', async () => {
  const t = await setup([ACC(1, 'A', 50), ACC(2, 'B', 40), ACC(3, 'Me', 45)], [ROW(1, 'A', 50), ROW(2, 'B', 40)]);
  const r = await t.call('leaderboard', { difficulty: 2, id: 3 });
  expect(r.body.yourPosition).toBe(2);   // 50 > 45 > 40, although "Me" has no row
});
test('the excluded names never show up', async () => {
  const t = await setup([ACC(1, 'LXA', 999), ACC(2, 'Real', 1)], [ROW(1, 'LXA', 999), ROW(2, 'Real', 1)]);
  expect(names(await t.call('leaderboard', { difficulty: 2 }))).toEqual(['Real']);
});
test('if the accounts cannot be read the stored rows are shown as they are (the board never disappears)', async () => {
  const t = await setup([ACC(1, 'A', 5)], [ROW(1, 'A', 5), ROW(2, 'B', 3)]);
  t.storage.__unreadable(true);
  const r = await t.call('leaderboard', { difficulty: 2 });
  expect(names(r)).toEqual(['A', 'B']);
});
test('a write drops the 5-second account cache: the next read already sees it; without a write the cache may be used', async () => {
  const t = await setup([ACC(1, 'A', 5), ACC(2, 'B', 3)], [ROW(1, 'A', 5), ROW(2, 'B', 3)]);
  expect((await t.call('leaderboard', { difficulty: 2 })).body.records[0].score).toBe(5);
  t.storage.__accounts()['1 : A'].balance = 100;                       // changed behind the cache
  expect((await t.call('leaderboard', { difficulty: 2 })).body.records[0].score).toBe(5);   // cached for up to 5 s
  const made = await t.call('create', { name: 'Fresh' });                              // any write of this instance drops the cache
  expect(made.status).toBe(200);
  expect((await t.call('leaderboard', { difficulty: 2 })).body.records[0].score).toBe(100);
});

const WACC = (id, name, score, wildLevel) => ({ ...ACC(id, name, score), wildLevel });
test('LVL (wild level 0-50) ranks FIRST, then the money; players without a level are ranked by money; the answer carries the level', async () => {
  const t = await setup([WACC(1, 'Rich', 90000, 0), WACC(2, 'Lvl10', -500, 10), WACC(3, 'Lvl10Rich', 40, 10), WACC(4, 'Max', -99999, 50), WACC(5, 'Poor', 5, 0)], [ROW(1, 'Rich', 90000), ROW(2, 'Lvl10', -500), ROW(3, 'Lvl10Rich', 40), ROW(4, 'Max', -99999), ROW(5, 'Poor', 5)]);
  const r = await t.call('leaderboard', { difficulty: 2, id: 5 });
  expect(names(r)).toEqual(['Max', 'Lvl10Rich', 'Lvl10', 'Rich', 'Poor']);
  expect(r.body.records.map(x => x.lvl)).toEqual([50, 10, 10, 0, 0]); expect(r.body.yourPosition).toBe(5);
});
test('an account without a row is ranked with the same order (level first)', async () => {
  const t = await setup([WACC(1, 'Top', 100, 0), WACC(2, 'Lvl3', -5, 3), WACC(3, 'NewHigh', -1000, 20)], [ROW(1, 'Top', 100), ROW(2, 'Lvl3', -5)]);
  expect((await t.call('leaderboard', { difficulty: 2, id: 3 })).body.yourPosition).toBe(1);   // level 20 beats level 3 and money
});
test('a bad level value is read as 0 and capped at 50', async () => {
  const t = await setup([WACC(1, 'A', 1, 'abc'), WACC(2, 'B', 2, 999), WACC(3, 'C', 3, -4)], [ROW(1, 'A', 1), ROW(2, 'B', 2), ROW(3, 'C', 3)]);
  const r = await t.call('leaderboard', { difficulty: 2 }); expect(names(r)).toEqual(['B', 'C', 'A']); expect(r.body.records.map(x => x.lvl)).toEqual([50, 0, 0]);
});
test('the money column is what the player HAS (balance + WILD bank), not the net result; the level still ranks first', async () => {
  const mk = (id, name, balance, bank, wildLevel, net) => ({ id, name, role: 'user', createdAt: id, updatedAt: id, balance, bank, wildLevel, difficultyData: { 2: { score: net, spins: 5, wins: 1 } } });
  const t = await setup([mk(1, 'NetKing', 250000, 0, 0, 90000), mk(2, 'Holder', 100, 400000, 0, -5), mk(3, 'Lvl1', 10, 0, 1, -9999)], [ROW(1, 'NetKing', 0), ROW(2, 'Holder', 0), ROW(3, 'Lvl1', 0)]);
  const r = await t.call('leaderboard', { difficulty: 2, id: 2 });
  expect(names(r)).toEqual(['Lvl1', 'Holder', 'NetKing']); expect(r.body.records.map(x => x.score)).toEqual([10, 400100, 250000]);
});
