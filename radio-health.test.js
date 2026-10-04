// RADIO HEALTH: strict two-client probe, periodic re-check, anonymous player reports, owner's hide list + admin actions.
jest.mock('./functions/firebase-storage.js', () => {
  let accounts = {}, cache = null, reports = {}, hidden = {};
  const copy = v => (v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)));
  return {
    getAccounts: async () => copy(accounts), saveAccounts: async n => { accounts = n; },
    updateAccount: async (key, mutate) => { const next = mutate(copy(accounts[key])); if (next === undefined) throw new Error('no commit'); if (next === null) delete accounts[key]; else accounts[key] = next; },
    reserveAccountId: async f => f + 1, getLeaderboard: async () => ({}), saveLeaderboard: async () => {}, getRtpSettings: async () => ({}), saveRtpSettings: async () => {},
    getRadioCache: async () => copy(cache), saveRadioCache: async c => { cache = copy(c); },
    updateRadioReport: async (key, mutate) => { const next = mutate(copy(reports[key])); if (next === undefined) throw new Error('no commit'); reports[key] = next; },
    getRadioReports: async () => copy(reports), clearRadioReport: async key => { delete reports[key]; },
    getRadioHidden: async () => copy(hidden), setRadioHidden: async (key, v) => { if (v) hidden[key] = v; else delete hidden[key]; },
    __reset: () => { accounts = {}; cache = null; reports = {}; hidden = {}; }, __put: (k, a) => { accounts[k] = a; }, __cache: c => { cache = c; }, __reports: () => reports, __hidden: () => hidden
  };
});

const health = require('./functions/radio-reports.js');
let radio, storage;
beforeEach(() => { jest.resetModules(); storage = require('./functions/firebase-storage.js'); storage.__reset(); radio = require('./functions/radio.js'); radio.__resetMemory(); radio.__resetHidden(); require('./functions/radio-reports.js').__resetLimiter(); });

const URL_A = 'https://a.example.ro/live', URL_B = 'https://b.example.ro/live', URL_C = 'https://c.example.ro/live';
const item = (n, u) => ({ n, u, c: 'MP3', b: 128, cc: 'RO' });
const list = (over = {}) => ({ updatedAt: Date.now(), cats: [{ id: 'manele', emoji: 'x', label: 'MANELE', items: [item('Alpha', URL_A), item('Beta', URL_B)] }, { id: 'pop', emoji: 'y', label: 'POP', items: [item('Beta', URL_B), item('Gamma', URL_C)] }], ...over });
const stored = async (over = {}) => { const { BUILDER_VERSION } = radio; storage.__cache({ ...list(over), v: BUILDER_VERSION }); };

describe('probe: the station must work for a phone-style client too', () => {
  const audio = (first = 0x49) => ({ ok: true, status: 200, headers: { get: () => 'audio/mpeg' }, body: { getReader: () => ({ read: async () => ({ value: new Uint8Array(1000).fill(first) }), cancel: () => {} }), cancel: () => {} } });
  const page = () => ({ ok: true, status: 200, headers: { get: () => 'text/html' }, body: { cancel: () => {} } });
  afterEach(() => { delete global.fetch; });
  test('both requests deliver audio: ok; the phone request really carries phone headers (UA, Range, icy-metadata)', async () => {
    const seen = []; global.fetch = async (url, opts) => { seen.push(opts.headers); return audio(); };
    expect(await radio.probeStream('https://x.example.ro/live', 2000)).toBe(true);
    expect(seen).toHaveLength(2);
    expect(seen[1]['user-agent']).toMatch(/iPhone/); expect(seen[1].range).toBe('bytes=0-'); expect(seen[1]['icy-metadata']).toBe('1');
  });
  test('plain request fine but the phone gets a web page: the station is rejected (the Radio Pro Manele case)', async () => {
    global.fetch = async (url, opts) => (/iPhone/.test(opts.headers['user-agent']) ? page() : audio());
    expect(await radio.probeStream('https://x.example.ro/live', 2000)).toBe(false);
  });
  test('the plain request fails: no second connection is opened (small hosts limit listeners)', async () => {
    let calls = 0; global.fetch = async () => { calls++; return page(); };
    expect(await radio.probeStream('https://x.example.ro/live', 2000)).toBe(false); expect(calls).toBe(1);
  });
  test('a web page behind an audio content-type ("<" first byte) is not audio', async () => {
    global.fetch = async () => audio(0x3c);
    expect(await radio.probeStream('https://x.example.ro/live', 2000)).toBe(false);
  });
  test('diagnose() tells both answers with the reason', async () => {
    global.fetch = async (url, opts) => (/iPhone/.test(opts.headers['user-agent']) ? page() : audio());
    const d = await radio.diagnose('https://x.example.ro/live', 2000);
    expect(d.server.ok).toBe(true); expect(d.phone.ok).toBe(false); expect(d.phone.why).toMatch(/type text\/html/);
  });
});

describe('re-check: stations that died since the build leave the list', () => {
  const data = () => ({ ...list(), v: 'x', cats: list().cats });
  test('dead stations are removed from every category; the others and the order stay; the input is not touched', async () => {
    const input = data(), out = await radio.recheckList(input, { probe: async url => url !== URL_B });
    expect(out.cats[0].items.map(i => i.n)).toEqual(['Alpha']); expect(out.cats[1].items.map(i => i.n)).toEqual(['Gamma']);
    expect(input.cats[0].items).toHaveLength(2);
    expect(out.dropped.map(d => d.n)).toEqual(['Beta']); expect(out.checkedAt).toBeGreaterThan(0);
  });
  test('a flaky station that answers the second try stays', async () => {
    let n = 0; const out = await radio.recheckList(data(), { probe: async url => (url === URL_A ? ++n > 1 : true) });
    expect(out.cats[0].items.map(i => i.n)).toEqual(['Alpha', 'Beta']); expect(out.dropped).toBeUndefined();
  });
  test('more than 40 % "dead" at once is our own network: nothing is removed', async () => {
    const out = await radio.recheckList(data(), { probe: async url => url === URL_C });
    expect(out.cats[0].items).toHaveLength(2); expect(out.cats[1].items).toHaveLength(2); expect(out.checkedAt).toBeGreaterThan(0);
  });
  test('stations that could not be probed in time stay (budget)', async () => {
    let t = 0; const out = await radio.recheckList(data(), { probe: async () => false, now: () => (t += 30000) });
    expect(out.cats[0].items).toHaveLength(2);
  });
});

describe('getList: the re-check runs only when it is due, once, and is stored', () => {
  test('not due (checked 1 h ago): the list is served as is, no probing', async () => {
    await stored({ checkedAt: Date.now() - 3600000 }); const check = jest.fn();
    const r = await radio.getList({ recheck: true, storage, check });
    expect(check).not.toHaveBeenCalled(); expect(r.rechecked).toBeUndefined();
  });
  test('due (last check 4 h ago) and asked for: runs once for simultaneous requests and the result is stored', async () => {
    await stored({ checkedAt: Date.now() - 4 * 3600000 }); const check = jest.fn(async d => ({ ...d, checkedAt: Date.now(), cats: d.cats.map(c => ({ ...c, items: c.items.slice(0, 1) })) }));
    const [a, b] = await Promise.all([radio.getList({ recheck: true, storage, check }), radio.getList({ recheck: true, storage, check })]);
    expect(check).toHaveBeenCalledTimes(1); expect(a.rechecked).toBe(true); expect(b.data.cats[0].items).toHaveLength(1);
    const again = await radio.getList({ recheck: true, storage, check }); expect(check).toHaveBeenCalledTimes(1); expect(again.rechecked).toBeUndefined();   // checkedAt is fresh now
    expect(storage.getRadioCache).toBeDefined();
  });
  test('without ?recheck the list is never re-checked, however old the check is', async () => {
    await stored({ checkedAt: Date.now() - 9 * 3600000 }); const check = jest.fn();
    await radio.getList({ storage, check }); expect(check).not.toHaveBeenCalled();
  });
  test('a failing re-check keeps serving the list', async () => {
    await stored({ checkedAt: Date.now() - 4 * 3600000 });
    const r = await radio.getList({ recheck: true, storage, check: async () => { throw new Error('boom'); } });
    expect(r.data.cats[0].items).toHaveLength(2);
  });
});

describe('reports: validation, counting, limits', () => {
  const body = (over = {}) => ({ action: 'report', u: URL_A, kind: 'auto', code: 'e4', dev: 'abcdef123456abcd', net: '4g', ms: 5000, ns: 3, rs: 0, ...over });
  test('cleanReport accepts a good report and normalises it (device hashed, platform from the user agent)', () => {
    const r = health.cleanReport(body(), 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)');
    expect(r).toMatchObject({ u: URL_A, kind: 'auto', code: 'e4', plat: 'ios', net: '4g', ms: 5000, ns: 3, rs: 0 });
    expect(r.dev).toMatch(/^[0-9a-f]{12}$/); expect(r.dev).not.toContain('abcdef');
    expect(health.cleanReport(body(), 'Mozilla/5.0 (Linux; Android 14) Mobile').plat).toBe('android');
    expect(health.cleanReport(body(), 'Mozilla/5.0 (Windows NT 10.0)').plat).toBe('desktop');
  });
  test('cleanReport rejects junk: http url, unknown kind, bad device id, no object; odd code / net / numbers are cleaned', () => {
    expect(health.cleanReport(body({ u: 'http://a.example.ro/x' }), '')).toBeNull();
    expect(health.cleanReport(body({ kind: 'spam' }), '')).toBeNull();
    expect(health.cleanReport(body({ dev: 'x' }), '')).toBeNull();
    expect(health.cleanReport(null, '')).toBeNull();
    const r = health.cleanReport(body({ code: '<script>', net: 'weird', ms: 9e9, ns: 99, rs: -4 }), '');
    expect(r).toMatchObject({ code: 'x', net: '', ms: 120000, ns: 4, rs: 0 });
  });
  test('applyReport counts per kind / code / platform; the same device + same kind within 10 min counts once; a manual report after an auto one counts', () => {
    const r = health.cleanReport(body(), 'iPhone'), m = health.cleanReport(body({ kind: 'manual', code: 'playing' }), 'iPhone');
    let node = health.applyReport(null, r, 'Alpha', 1000);
    node = health.applyReport(node, r, 'Alpha', 1000 + 60000);
    expect(node.count).toBe(1); expect(node.auto).toBe(1); expect(node.codes).toEqual({ e4: 1 }); expect(node.plats).toEqual({ ios: 1 }); expect(node.n).toBe('Alpha');
    node = health.applyReport(node, m, 'Alpha', 1000 + 120000);
    expect(node.count).toBe(2); expect(node.manual).toBe(1); expect(Object.keys(node.devices)).toHaveLength(1);
    node = health.applyReport(node, m, 'Alpha', 1000 + 130000); expect(node.count).toBe(2);               // the same manual report again within 10 min: once
    node = health.applyReport(node, m, 'Alpha', 1000 + 120000 + 11 * 60000); expect(node.count).toBe(3);   // 11 min later: counts again
  });
  test('only the newest 40 devices are kept per station', () => {
    let node = null; for (let i = 0; i < 55; i++) node = health.applyReport(node, health.cleanReport(body({ dev: 'dev' + String(i).padStart(10, '0') }), ''), 'A', 1000 + i);
    expect(Object.keys(node.devices)).toHaveLength(40); expect(node.count).toBe(55);
  });
  test('limit: 30 reports per hour per device, then refused; another device is not affected', () => {
    for (let i = 0; i < 30; i++) expect(health.allow('d1', 1000 + i)).toBe(true);
    expect(health.allow('d1', 2000)).toBe(false); expect(health.allow('d2', 2000)).toBe(true); expect(health.allow('d1', 1000 + 3700000)).toBe(true);
  });
  test('summarize: the station reported by the most devices first; hidden flag; hidden-only list', () => {
    const a = health.applyReport(null, health.cleanReport(body({ dev: 'aaaaaaaa0001' }), ''), 'Alpha', 5), b1 = health.applyReport(null, health.cleanReport(body({ u: URL_B, dev: 'aaaaaaaa0001' }), ''), 'Beta', 9), b2 = health.applyReport(b1, health.cleanReport(body({ u: URL_B, dev: 'aaaaaaaa0002' }), ''), 'Beta', 10);
    const s = health.summarize({ ka: a, kb: b2 }, { kb: { u: URL_B, n: 'Beta', at: 3 }, kz: { u: URL_C, n: 'Zed', at: 4 } }, 3600000 * 5);
    expect(s.reports.map(r => r.n)).toEqual(['Beta', 'Alpha']); expect(s.reports[0]).toMatchObject({ devices: 2, hidden: true }); expect(s.reports[1].hidden).toBe(false);
    expect(s.hidden.map(h => h.n)).toEqual(['Zed', 'Beta']);
  });
});

describe('handler: POST report, GET with the hide list', () => {
  const post = (body, agent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)') => radio.handler({ httpMethod: 'POST', headers: { 'user-agent': agent }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  const rep = (over = {}) => ({ action: 'report', u: URL_A, kind: 'auto', code: 'timeout', dev: 'abcdef123456abcd', ...over });
  test('a report for a station of the list is stored under its key, with the name from the list', async () => {
    await stored(); const res = await post(rep());
    expect(res.statusCode).toBe(200); expect(res.headers['cache-control']).toBe('no-store');
    const node = storage.__reports()[health.radioKey(URL_A)];
    expect(node).toMatchObject({ u: URL_A, n: 'Alpha', count: 1, auto: 1, lastPlat: 'ios' });
  });
  test('a station that is not in the list is refused (the node count stays bounded), junk and oversized bodies too', async () => {
    await stored();
    expect((await post(rep({ u: 'https://evil.example.com/x' }))).statusCode).toBe(404);
    expect((await post('not json')).statusCode).toBe(400);
    expect((await post(rep({ kind: 'nope' }))).statusCode).toBe(400);
    expect((await post('x'.repeat(3000))).statusCode).toBe(413);
    expect(Object.keys(storage.__reports())).toHaveLength(0);
  });
  test('the 31st report of one device within an hour gets 429', async () => {
    await stored(); let last;
    for (let i = 0; i < 31; i++) last = await post(rep({ kind: i % 2 ? 'auto' : 'manual', code: 'c' + i }));
    expect(last.statusCode).toBe(429);
  });
  test('GET: hidden stations are not served, the admin-only `dropped` is never sent, other stations stay', async () => {
    await stored({ dropped: [{ n: 'Dead', u: 'https://dead.example.ro/x', at: 1 }] });
    await storage.setRadioHidden(health.radioKey(URL_B), { u: URL_B, n: 'Beta', at: 1 });
    const res = await radio.handler({ httpMethod: 'GET', queryStringParameters: {} }), body = JSON.parse(res.body);
    expect(body.cats[0].items.map(i => i.n)).toEqual(['Alpha']); expect(body.cats[1].items.map(i => i.n)).toEqual(['Gamma']);
    expect(body.dropped).toBeUndefined();
  });
  test('GET without a hide list serves everything; POST and OPTIONS are allowed, PUT is not', async () => {
    await stored();
    const body = JSON.parse((await radio.handler({ httpMethod: 'GET', queryStringParameters: {} })).body); expect(body.cats[0].items).toHaveLength(2);
    expect((await radio.handler({ httpMethod: 'OPTIONS' })).statusCode).toBe(200); expect((await radio.handler({ httpMethod: 'PUT' })).statusCode).toBe(405);
  });
});

describe('admin: RADIO view', () => {
  let call;
  const setup = async () => {
    jest.resetModules(); storage = require('./functions/firebase-storage.js'); storage.__reset(); radio = require('./functions/radio.js'); radio.__resetMemory();
    storage.__put('1 : Boss', { id: 1, name: 'Boss', safeWord: 'pw', role: 'admin', balance: 100, difficulty: 2, createdAt: 1 }); storage.__put('2 : Player', { id: 2, name: 'Player', safeWord: 'pw', balance: 100, difficulty: 2, createdAt: 2 });
    await stored({ checkedAt: Date.now() - 2 * 3600000, dropped: [{ n: 'Dead', u: 'https://dead.example.ro/x', at: Date.now() - 3600000 }] });
    const { handler } = require('./functions/lxa-account.js'); let ip = 0;
    call = async (data, who = { id: 1, safeWord: 'pw' }) => { const r = await handler({ httpMethod: 'POST', headers: { 'x-vercel-forwarded-for': '10.7.0.' + (ip++ & 255) }, body: JSON.stringify({ action: 'admin-radio', ...who, ...data }) }); return { status: r.statusCode, body: JSON.parse(r.body) }; };
    await radio.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ action: 'report', u: URL_A, kind: 'manual', code: 'playing', dev: 'abcdef123456abcd' }) });
    await radio.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ action: 'report', u: URL_A, kind: 'auto', code: 'e4', dev: 'fedcba654321fedc' }) });
  };
  test('only the admin with the password gets in', async () => {
    await setup();
    expect((await call({ op: 'list' }, { id: 2, safeWord: 'pw' })).status).toBe(403);
    expect((await call({ op: 'list' }, { id: 1, safeWord: 'wrong' })).status).not.toBe(200);
    expect((await call({ op: 'list' })).status).toBe(200);
  });
  test('list: reported stations (2 devices), the station count, last check, the stations the re-check removed', async () => {
    await setup(); const r = (await call({ op: 'list' })).body;
    expect(r.reports).toHaveLength(1); expect(r.reports[0]).toMatchObject({ n: 'Alpha', devices: 2, count: 2, auto: 1, manual: 1, hidden: false });
    expect(r.stations).toBe(3); expect(r.dropped.map(d => d.n)).toEqual(['Dead']); expect(r.checkedAt).toBeGreaterThan(0);
  });
  test('hide -> the station disappears from the served list at once (no deploy); unhide brings it back; clear forgets the reports', async () => {
    await setup(); const key = health.radioKey(URL_A);
    expect((await call({ op: 'hide', key })).body.ok).toBe(true);
    radio.__resetHidden(); let served = JSON.parse((await radio.handler({ httpMethod: 'GET', queryStringParameters: {} })).body);
    expect(served.cats[0].items.map(i => i.n)).toEqual(['Beta']);
    expect((await call({ op: 'list' })).body.reports[0].hidden).toBe(true);
    await call({ op: 'unhide', key }); radio.__resetHidden(); served = JSON.parse((await radio.handler({ httpMethod: 'GET', queryStringParameters: {} })).body);
    expect(served.cats[0].items.map(i => i.n)).toEqual(['Alpha', 'Beta']);
    await call({ op: 'clear', key }); expect((await call({ op: 'list' })).body.reports).toHaveLength(0);
  });
  test('bad key / unknown station / unknown op are refused', async () => {
    await setup();
    expect((await call({ op: 'hide', key: 'zz' })).status).toBe(400);
    expect((await call({ op: 'hide', key: '0123456789abcdef' })).status).toBe(404);
    expect((await call({ op: 'bogus', key: health.radioKey(URL_A) })).status).toBe(400);
  });
  test('test: probes the station with both kinds of request and returns the reasons', async () => {
    await setup(); global.fetch = async (url, opts) => (/iPhone/.test(opts.headers['user-agent']) ? { ok: true, status: 200, headers: { get: () => 'text/html' }, body: { cancel: () => {} } } : { ok: true, status: 200, headers: { get: () => 'audio/mpeg' }, body: { getReader: () => ({ read: async () => ({ value: new Uint8Array(900).fill(1) }), cancel: () => {} }) } });
    try { const r = (await call({ op: 'test', key: health.radioKey(URL_A) })).body.test; expect(r.server.ok).toBe(true); expect(r.phone.ok).toBe(false); expect(r.phone.why).toMatch(/text\/html/); } finally { delete global.fetch; }
  });
});
