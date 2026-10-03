// The session token is also kept in an httpOnly cookie set by the server: a device that lost the token from localStorage (the phone cleared the page storage) can restore from the cookie.
jest.mock('./functions/firebase-storage.js', () => {
  let accounts = {};
  const copy = value => (value === null || value === undefined ? value : JSON.parse(JSON.stringify(value)));
  return {
    getAccounts: async () => copy(accounts),
    saveAccounts: async next => { accounts = copy(next); },
    updateAccount: async (key, mutate) => { const next = mutate(copy(accounts[key]) || null); if (next === undefined) throw new Error('no commit'); if (next === null) delete accounts[key]; else accounts[key] = copy(next); },
    reserveAccountId: async floor => floor + 1,
    getLeaderboard: async () => ({}), saveLeaderboard: async () => {}, getRtpSettings: async () => ({}), saveRtpSettings: async () => {}
  };
});

let ip = 0;
async function setup() {
  jest.resetModules();
  const { handler } = require('./functions/lxa-account.js');
  const call = async (action, data, extraHeaders) => { const r = await handler({ httpMethod: 'POST', headers: { 'x-vercel-forwarded-for': '10.12.0.' + (ip++ & 255), ...(extraHeaders || {}) }, body: JSON.stringify({ action, ...data }) }); return { status: r.statusCode, body: JSON.parse(r.body), cookie: r.headers['set-cookie'] }; };
  const made = await call('create', { name: 'Cookie' + ip });
  return { call, id: made.body.account.id, password: made.body.safeWord, token: made.body.token, made };
}
const cookieHeader = token => ({ cookie: 'other=1; lxa_sid=' + token });

test('create and a password login set an httpOnly, Secure, SameSite=Lax cookie holding the new token', async () => {
  const t = await setup();
  expect(t.made.cookie).toContain('lxa_sid=' + t.token);
  expect(t.made.cookie).toMatch(/HttpOnly/); expect(t.made.cookie).toMatch(/Secure/); expect(t.made.cookie).toMatch(/SameSite=Lax/); expect(t.made.cookie).toMatch(/Path=\/api/); expect(t.made.cookie).toMatch(/Max-Age=34560000/);
  const login = await t.call('login', { id: t.id, safeWord: t.password });
  expect(login.cookie).toContain('lxa_sid=' + login.body.token);
});

test('a silent restore without any token uses the cookie and hands the token back', async () => {
  const t = await setup();
  const restored = await t.call('login', { silent: true }, cookieHeader(t.token));
  expect(restored.status).toBe(200);
  expect(restored.body.account.id).toBe(t.id);
  expect(restored.body.token).toBe(t.token);
  expect(restored.cookie).toContain('lxa_sid=' + t.token);   // renewed
});

test('a silent restore with a token in the body renews / creates the cookie (devices from before the cookie existed)', async () => {
  const t = await setup();
  const restored = await t.call('login', { silent: true, token: t.token });
  expect(restored.status).toBe(200);
  expect(restored.body.token).toBeUndefined();
  expect(restored.cookie).toContain('lxa_sid=' + t.token);
});

test('no cookie, bad cookie, cookie from another site: not restored; a bad cookie is cleared', async () => {
  const t = await setup();
  const none = await t.call('login', { silent: true });
  expect(none.status).toBe(400); expect(none.cookie).toBeUndefined();
  const bad = await t.call('login', { silent: true }, cookieHeader('a'.repeat(48)));
  expect(bad.status).toBe(401); expect(bad.cookie).toMatch(/Max-Age=0/);
  const cross = await t.call('login', { silent: true }, { ...cookieHeader(t.token), 'sec-fetch-site': 'cross-site' });
  expect(cross.status).toBe(400);
  const same = await t.call('login', { silent: true }, { ...cookieHeader(t.token), 'sec-fetch-site': 'same-origin' });
  expect(same.status).toBe(200);
});

test('logout clears the cookie and the old cookie no longer restores', async () => {
  const t = await setup();
  const out = await t.call('logout', { id: t.id, token: t.token });
  expect(out.status).toBe(200); expect(out.cookie).toMatch(/lxa_sid=;/); expect(out.cookie).toMatch(/Max-Age=0/);
  expect((await t.call('login', { silent: true }, cookieHeader(t.token))).status).toBe(401);
});

test('a password change issues a new token and cookie; the old cookie stops working', async () => {
  const t = await setup();
  const changed = await t.call('update', { id: t.id, safeWord: t.password, newSafeWord: 'brandnewpw2' });
  expect(changed.status).toBe(200);
  expect(changed.cookie).toContain('lxa_sid=' + changed.body.token);
  expect((await t.call('login', { silent: true }, cookieHeader(t.token))).status).toBe(401);
  expect((await t.call('login', { silent: true }, cookieHeader(changed.body.token))).status).toBe(200);
});

test('the cookie is only a restore path: it does not authorize game actions on its own', async () => {
  const t = await setup();
  const spin = await t.call('spin', { id: t.id, bet: 1 }, cookieHeader(t.token));
  expect([400, 401, 403]).toContain(spin.status);
});
