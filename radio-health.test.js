// RADIO HEALTH: strict two-client probe, periodic re-check, anonymous player reports, owner's hide list + admin actions.
jest.mock('./functions/firebase-storage.js', () => {
  let accounts = {}, cache = null, reports = {}, hidden = {}, moves = {}, favs = {}, suggest = {}, rejected = {}, customs = {}, suggestDay = { day: '', n: 0 }, recommend = {}; const favDev = new Set();
  const copy = v => (v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)));
  return {
    getAccounts: async () => copy(accounts), saveAccounts: async n => { accounts = n; },
    updateAccount: async (key, mutate) => { const next = mutate(copy(accounts[key])); if (next === undefined) throw new Error('no commit'); if (next === null) delete accounts[key]; else accounts[key] = next; },
    reserveAccountId: async f => f + 1, getLeaderboard: async () => ({}), saveLeaderboard: async () => {}, getRtpSettings: async () => ({}), saveRtpSettings: async () => {},
    getRadioCache: async () => copy(cache), saveRadioCache: async c => { cache = copy(c); },
    updateRadioReport: async (key, mutate) => { const next = mutate(copy(reports[key])); if (next === undefined) throw new Error('no commit'); reports[key] = next; },
    getRadioReports: async () => copy(reports), clearRadioReport: async key => { delete reports[key]; },
    getRadioHidden: async () => copy(hidden), setRadioHidden: async (key, v) => { if (v) hidden[key] = v; else delete hidden[key]; },
    getRadioMoves: async () => copy(moves), setRadioMove: async (key, v) => { if (v) moves[key] = v; else delete moves[key]; },
    getRadioFavCounts: async () => copy(favs),
    setRadioFav: async (key, device, on) => { const id = device + key, had = favDev.has(id); if (on) favDev.add(id); else favDev.delete(id); const changed = had !== on; if (changed) { favs[key] = Math.max(0, (favs[key] || 0) + (on ? 1 : -1)); if (!favs[key]) delete favs[key]; } return { changed }; },
    updateRadioSuggest: async (key, mutate) => { const next = mutate(copy(suggest[key])); if (next === undefined) throw new Error('no commit'); suggest[key] = next; }, getRadioSuggest: async () => copy(suggest), getRadioSuggestNode: async key => copy(suggest[key]) || null, removeRadioSuggest: async key => { delete suggest[key]; },
    getRadioRejected: async () => copy(rejected), addRadioReject: async (key, record) => { rejected[key] = record || 1; }, patchRadioCustomHealth: async (key, health) => { if (customs[key] && customs[key].u) customs[key] = { ...customs[key], health }; }, getRadioCustoms: async () => copy(customs), setRadioCustom: async (key, v) => { if (v) customs[key] = v; else delete customs[key]; },
    bumpSuggestDay: async (day, max) => { if (!day || suggestDay.day !== day) suggestDay = { day, n: 0 }; if (suggestDay.n >= max) return false; suggestDay.n++; return true; },
    updateRadioRecommend: async (key, mutate) => { const next = mutate(copy(recommend[key])); if (next === undefined) throw new Error('no commit'); recommend[key] = next; }, getRadioRecommend: async () => copy(recommend), removeRadioRecommend: async key => { delete recommend[key]; }, __recommend: () => recommend,
    __suggest: () => suggest, __customs: () => customs, __rejected: () => rejected,
    __moves: () => moves, __favs: () => favs, __setFavs: v => { favs = v; },
    __reset: () => { accounts = {}; cache = null; reports = {}; hidden = {}; moves = {}; favs = {}; suggest = {}; rejected = {}; customs = {}; recommend = {}; suggestDay = { day: '', n: 0 }; favDev.clear(); }, __put: (k, a) => { accounts[k] = a; }, __cache: c => { cache = c; }, __reports: () => reports, __hidden: () => hidden
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

describe('blocked host (Radio Marketescu on radiolize.com does not play on the owner\'s phone)', () => {
  const MARK = 'https://s45.radiolize.com/radio/8060/radio.mp3';
  test('blockedUrl: the host and its sub-hosts, nothing else', () => {
    expect(radio.blockedUrl(MARK)).toBe(true); expect(radio.blockedUrl('https://radiolize.com/x')).toBe(true);
    expect(radio.blockedUrl('https://notradiolize.com/x')).toBe(false); expect(radio.blockedUrl('https://stream.zeno.fm/abc')).toBe(false); expect(radio.blockedUrl('not a url')).toBe(false);
  });
  test('a station on the blocked host is never usable, not even through its https twin', () => {
    const st = { stationuuid: 'm', name: 'Radio Marketescu Rap&Trap', url_resolved: MARK, codec: 'AAC', bitrate: 192, lastcheckok: 1, hls: 0, ssl_error: 0, countrycode: 'RO', tags: 'rap,trap' };
    expect(radio.usable(st)).toBe(false); expect(radio.upgradable({ ...st, url_resolved: MARK.replace('https', 'http') })).toBe(false);
  });
  test('a list that was built BEFORE the block still stops serving the station (no rebuild needed)', async () => {
    await stored({ cats: [{ id: 'rap', emoji: 'x', label: 'RAP', items: [item('Radio Marketescu Rap&Trap', MARK), item('Alpha', URL_A)] }] });
    const body = JSON.parse((await radio.handler({ httpMethod: 'GET', queryStringParameters: {} })).body);
    expect(body.cats[0].items.map(i => i.n)).toEqual(['Alpha']);
  });
  test('a report remembers the codec / bitrate of the station (to see whether one format fails on phones)', async () => {
    await stored({ cats: [{ id: 'pop', emoji: 'y', label: 'POP', items: [{ n: 'Aac One', u: URL_A, c: 'AAC', b: 192, cc: 'RO' }] }] });
    await radio.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ action: 'report', u: URL_A, kind: 'manual', code: 'nostart', dev: 'abcdef123456abcd' }) });
    expect(storage.__reports()[health.radioKey(URL_A)].c).toBe('AAC 192');
    expect(health.summarize(storage.__reports(), {}).reports[0].c).toBe('AAC 192');
  });
});
describe('RETRO and GLOBAL categories (build)', () => {
  let n = 0;
  const st = (over = {}) => { n++; return { stationuuid: 'r' + n, name: 'Station R' + n, url_resolved: 'https://r' + n + '.example.ro/live', codec: 'MP3', bitrate: 128, lastcheckok: 1, hls: 0, ssl_error: 0, countrycode: 'RO', tags: 'pop', clickcount: 100 + n, votes: 10, ...over }; };
  const run = (ro, global = [], probe = async () => true) => radio.buildList({ fetchRo: async () => ro, fetchRoAll: async () => [], fetchForeign: async () => [], fetchGlobal: async () => global.map(s => ({ language: 'english', ...s })), probe, now: Date.now });
  const items = (data, id) => data.cats.find(c => c.id === id).items.map(i => i.n);
  test('RETRO: 80s / 90s / oldies stations (also "90\'s" in the name); manele "vechi" and folk are not retro', async () => {
    const data = await run([st({ name: "Play 90's", tags: '90s,pop' }), st({ name: 'Oldies FM', tags: 'oldies' }), st({ name: 'Radio 80s Hits', tags: '80s,hits' }), st({ name: 'Manele Vechi', tags: 'manele vechi,retro' }), st({ name: 'Folclor Retro', tags: 'folclor,retro' }), st({ name: 'Plain Pop', tags: 'pop' })]);
    expect(items(data, 'retro').sort()).toEqual(['Oldies FM', "Play 90's", 'Radio 80s Hits']);
    expect(items(data, 'manele')).toEqual(['Manele Vechi']);
  });
  test('GLOBAL: the most listened English-language music of the whole world that really plays, news / talk left out, foreign ones carry their country', async () => {
    const world = [st({ name: 'BBC World News', countrycode: 'GB', tags: 'news', clickcount: 9000 }), st({ name: 'Big US Pop', countrycode: 'US', tags: 'pop', clickcount: 8000 }), st({ name: 'Dead DE', countrycode: 'DE', tags: 'pop', clickcount: 7000 }), st({ name: 'Good FR', countrycode: 'FR', tags: 'electro', clickcount: 6000 }), st({ name: 'Ro Top', countrycode: 'RO', tags: 'pop', clickcount: 5000 })];
    const dead = world[2].url_resolved;
    const data = await run([], world, async url => url !== dead);
    expect(items(data, 'global')).toEqual(['Big US Pop', 'Good FR', 'Ro Top']);
    expect(data.cats.find(c => c.id === 'global').items.map(i => i.cc)).toEqual(['US', 'FR', 'RO']);
  });
  test('GLOBAL is MUSIC: a station that names no music genre in its tags (a Lagos news / talk radio) is left out however many clicks it has', async () => {
    const world = [st({ name: 'METRO FM LAGOS', countrycode: 'NG', tags: '', clickcount: 9000 }), st({ name: 'Business FM', countrycode: 'NG', tags: 'business,commerce', clickcount: 9000 }), st({ name: 'Afro Hits', countrycode: 'NG', tags: 'afrobeats', clickcount: 100 }), st({ name: 'Top Hits', countrycode: 'US', tags: 'hits', clickcount: 50 })];
    expect(items(await run([], world), 'global').sort()).toEqual(['Afro Hits', 'Top Hits']);
    for (const [tags, yes] of [['pop', true], ['hits', true], ['80s', true], ['jazz,lounge', true], ['afrobeats', true], ['', false], ['talk', false], ['business,commerce', false], ['bbc', false], ['police scanner', false]]) expect(radio.hasMusicTag({ tags })).toBe(yes);
  });
  test('GLOBAL variety: at most 100; one per name; one per CURRENT TITLE (stations on one feed); 5 per network; 60 per English-speaking country; 3 per other country and 14 in all', async () => {
    const titles = new Map(); const reader = async url => ({ ok: true, metaint: 1, title: titles.get(url) || '' });
    const station = (name, cc, host, n, over = {}) => { const s = st({ name, countrycode: cc, clickcount: 9000 - n, ...over }); s.url_resolved = `https://${host}/s${n}`; return s; };
    const world = []; let n = 0;
    for (let i = 0; i < 8; i++) world.push(station('Soma ' + i, 'US', 'ice1.somafm.com', n++));                        // one network
    for (let i = 0; i < 4; i++) { const s = station('Same Feed ' + i, 'DE', 'h' + i + '.feed' + i + '.de', n++); titles.set(s.url_resolved, 'Linkin Park - What I\'ve Done'); world.push(s); }   // one feed on 4 stations
    for (let i = 0; i < 40; i++) world.push(station('Native ' + i, i % 2 ? 'US' : 'GB', 'n' + i + '.native' + i + '.com', n++));
    for (let i = 0; i < 30; i++) world.push(station('Other ' + i, ['DE', 'FR', 'IT', 'ES', 'JP', 'RU', 'MA', 'NG', 'GR', 'AT', 'CH'][i % 11], 'o' + i + '.other' + i + '.org', n++));
    const data = await radio.buildList({ fetchRo: async () => [], fetchRoAll: async () => [], fetchForeign: async () => [], fetchGlobal: async () => world.map(s => ({ language: 'english', ...s })), probe: async () => true, readIcy: reader, now: Date.now });
    const g = data.cats.find(c => c.id === 'global').items, byName = prefix => g.filter(i => i.n.startsWith(prefix)).length;
    expect(g.length).toBeLessThanOrEqual(100); expect(g.length).toBeGreaterThanOrEqual(40); expect(byName('Soma')).toBe(5); expect(byName('Same Feed')).toBe(1); expect(new Set(g.map(i => i.n)).size).toBe(g.length);
    const native = g.filter(i => ['US', 'GB', 'CA', 'AU', 'IE', 'NZ', 'ZA'].includes(i.cc)), other = g.filter(i => !['US', 'GB', 'CA', 'AU', 'IE', 'NZ', 'ZA'].includes(i.cc));
    expect(other.length).toBeLessThanOrEqual(14); expect(native.length).toBeGreaterThanOrEqual(40);
    const per = {}; for (const i of other) per[i.cc] = (per[i.cc] || 0) + 1; expect(Math.max(...Object.values(per))).toBeLessThanOrEqual(3);
  });
  test('GLOBAL ranking: a confirmed song right now lifts a station; English-speaking countries rank first; a talk segment on the air removes a station outside them but not inside them; leading symbols are removed from names', async () => {
    const titles = {}; const reader = async url => ({ ok: true, metaint: 1, title: titles[url] || '' });
    const a = st({ name: '# Unknown Title', countrycode: 'US', clickcount: 1000 }), b = st({ name: 'Playing Now', countrycode: 'US', clickcount: 900 }), c = st({ name: 'FM4 Talk', countrycode: 'AT', clickcount: 5000 }), d = st({ name: 'UK Breakfast', countrycode: 'GB', clickcount: 800 }), e = st({ name: 'Other Playing', countrycode: 'FR', clickcount: 1000 });
    titles[b.url_resolved] = 'Queen - Save Me'; titles[c.url_resolved] = 'Eva von Redecker über Faschismus heute'; titles[d.url_resolved] = 'Morning Show with Tom'; titles[e.url_resolved] = 'Bangles - Manic Monday';
    const data = await radio.buildList({ fetchRo: async () => [], fetchRoAll: async () => [], fetchForeign: async () => [], fetchGlobal: async () => [a, b, c, d, e].map(s => ({ language: 'english', ...s })), probe: async () => true, readIcy: reader, now: Date.now });
    const names = items(data, 'global');
    expect(names).toEqual(['Playing Now', 'Unknown Title', 'UK Breakfast', 'Other Playing']);   // song > unknown among natives; natives first; AT talk left out; GB talk stays; "# " removed
    expect(names).not.toContain('FM4 Talk');
  });
  test('GLOBAL is English only (the FIRST language listed), music only, ordered by recent clicks (votes only break ties), one query without the vote ranking', async () => {
    const world = [
      st({ name: 'Votes Farm', countrycode: 'DE', clickcount: 600, votes: 800000 }), st({ name: 'Busy English', countrycode: 'NG', clickcount: 4700, votes: 400 }), st({ name: 'Portuguese First', countrycode: 'BR', language: 'portuguese,english', clickcount: 9000 }),
      st({ name: 'Spanish', countrycode: 'ES', language: 'spanish', clickcount: 9000 }), st({ name: 'No Language', countrycode: 'US', language: '', clickcount: 9000 }), st({ name: 'British English', countrycode: 'GB', language: 'british english', clickcount: 300, votes: 10 }),
      st({ name: 'English Gospel', countrycode: 'US', tags: 'gospel,christian', clickcount: 5000 }), st({ name: 'English Talk', countrycode: 'US', tags: 'talk', clickcount: 5000 })];
    const names = items(await run([], world), 'global');
    expect(names).toEqual(expect.arrayContaining(['Busy English', 'British English', 'Votes Farm', 'No Language']));   // an empty language counts as English in an English-speaking country
    expect(names).not.toContain('Spanish'); expect(names).not.toContain('Portuguese First'); expect(names).not.toContain('English Talk');   // clicks first (600 clicks with 800 000 votes does not beat 4700 clicks); an English-speaking country ranks above a foreign station of similar size
    expect(radio.isEnglish({ language: 'English' })).toBe(true); expect(radio.isEnglish({ language: 'english,german' })).toBe(true); expect(radio.isEnglish({ language: 'german,english' })).toBe(false); expect(radio.isEnglish({})).toBe(false); expect(radio.isEnglish({ language: 'englishman' })).toBe(false);
    expect(radio.globalScore({ clickcount: 4700, votes: 400 })).toBeGreaterThan(radio.globalScore({ clickcount: 600, votes: 800000 }));
  });
  test('the GLOBAL query asks the directory for English only, ordered by clicks (not by votes)', async () => {
    const seen = []; const real = global.fetch; global.fetch = async url => { seen.push(String(url)); return { ok: true, status: 200, json: async () => [] }; };
    try { await radio.buildList({ fetchRo: async () => [], fetchRoAll: async () => [], fetchForeign: async () => [], probe: async () => true, now: Date.now }); } finally { global.fetch = real; }
    const globalCalls = seen.filter(u => /language=english/.test(u)); expect(globalCalls).toHaveLength(1); expect(globalCalls[0]).toMatch(/limit=500/); expect(globalCalls[0]).toMatch(/order=clickcount/); expect(seen.some(u => /order=votes/.test(u))).toBe(false);
  });
  test('a failing GLOBAL query does not break the rest of the build', async () => {
    const broken = await radio.buildList({ fetchRo: async () => [st({ name: 'Local Pop', tags: 'pop' })], fetchRoAll: async () => [], fetchForeign: async () => [], fetchGlobal: async () => { throw new Error('boom'); }, probe: async () => true, now: Date.now });
    expect(items(broken, 'pop')).toEqual(['Local Pop']); expect(items(broken, 'global')).toEqual([]);
  });
});

describe('served list: TOP (the players\' stars) and moves', () => {
  const state = (over = {}) => ({ hidden: new Set(), moves: new Map(), favs: new Map(), ...over });
  const key = u => health.radioKey(u);
  const ids = data => data.cats.map(c => c.id);
  test('the served list always ends with TOP: 12 tabs once the build has all 11', () => {
    const full = { cats: ['manele', 'etno', 'rap', 'house', 'techno', 'dance', 'pop', 'rock', 'chill', 'retro', 'global'].map(id => ({ id, emoji: 'x', label: id, items: [] })) };
    const out = radio.servedList(full, state()); expect(ids(out)).toHaveLength(12); expect(ids(out)[11]).toBe('top'); expect(out.cats[11].items).toEqual([]);
  });
  test('TOP: stations starred by at least 2 players, most starred first, once each, without flame / style marks; hidden ones are not in it', () => {
    const data = { cats: [{ id: 'manele', emoji: 'x', label: 'M', items: [{ ...item('Alpha', URL_A), top: 1, s: ['trap'], m: 1 }, item('Beta', URL_B)] }, { id: 'pop', emoji: 'y', label: 'P', items: [item('Beta', URL_B), item('Gamma', URL_C)] }] };
    const favs = new Map([[key(URL_A), 2], [key(URL_B), 5], [key(URL_C), 1]]);
    let top = radio.servedList(data, state({ favs })).cats.find(c => c.id === 'top').items;
    expect(top.map(i => i.n)).toEqual(['Beta', 'Alpha']); expect(top[1].top).toBeUndefined(); expect(top[1].s).toBeUndefined(); expect(top[1].m).toBeUndefined();
    top = radio.servedList(data, state({ favs, hidden: new Set([key(URL_B)]) })).cats.find(c => c.id === 'top').items; expect(top.map(i => i.n)).toEqual(['Alpha']);
  });
  test('TOP shows at most the 40 most starred', () => {
    const many = Array.from({ length: 60 }, (_, i) => item('S' + i, 'https://s' + i + '.example.ro/x')), favs = new Map(many.map((m, i) => [key(m.u), 2 + i]));
    const top = radio.servedList({ cats: [{ id: 'pop', emoji: 'y', label: 'P', items: many }] }, state({ favs })).cats.find(c => c.id === 'top').items;
    expect(top).toHaveLength(40); expect(top[0].n).toBe('S59');
  });
  test('a moved station leaves every category, goes to the TOP of its new category without the flame; a missing target category is ignored', () => {
    const data = { cats: [{ id: 'manele', emoji: 'x', label: 'M', items: [{ ...item('Alpha', URL_A), top: 1, s: ['trap'] }, item('Beta', URL_B)] }, { id: 'etno', emoji: 'y', label: 'E', items: [item('Gamma', URL_C)] }, { id: 'pop', emoji: 'z', label: 'P', items: [item('Alpha', URL_A)] }] };
    const out = radio.servedList(data, state({ moves: new Map([[key(URL_A), 'etno']]) })), by = id => out.cats.find(c => c.id === id).items.map(i => i.n);
    expect(by('manele')).toEqual(['Beta']); expect(by('pop')).toEqual([]); expect(by('etno')).toEqual(['Alpha', 'Gamma']);
    expect(out.cats.find(c => c.id === 'etno').items[0].top).toBeUndefined(); expect(out.cats.find(c => c.id === 'etno').items[0].s).toBeUndefined();
    const ignored = radio.servedList(data, state({ moves: new Map([[key(URL_A), 'nowhere']]) })); expect(ignored.cats.find(c => c.id === 'manele').items.map(i => i.n)).toEqual(['Alpha', 'Beta']);   // the target does not exist: the station stays where it was
  });
  test('a moved station can be starred into TOP too, and the original arrays are never modified', () => {
    const data = { cats: [{ id: 'manele', emoji: 'x', label: 'M', items: [item('Alpha', URL_A)] }, { id: 'etno', emoji: 'y', label: 'E', items: [] }] };
    const out = radio.servedList(data, state({ moves: new Map([[key(URL_A), 'etno']]), favs: new Map([[key(URL_A), 3]]) }));
    expect(out.cats.find(c => c.id === 'top').items.map(i => i.n)).toEqual(['Alpha']); expect(data.cats[0].items).toHaveLength(1); expect(data.cats).toHaveLength(2);
  });
});

describe('stars (POST fav) feed TOP; admin moves', () => {
  const post = body => radio.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify(body) });
  const fav = (dev, on = true, u = URL_A) => post({ action: 'fav', u, on, dev });
  const get = async () => JSON.parse((await radio.handler({ httpMethod: 'GET', queryStringParameters: {} })).body);
  test('one vote per device and station; two players put the station into TOP (served within the cache time); un-starring removes the vote', async () => {
    await stored();
    expect((await fav('device0000000001')).statusCode).toBe(200); expect((await fav('device0000000001')).statusCode).toBe(200);   // the same device twice: still one vote
    expect(storage.__favs()[health.radioKey(URL_A)]).toBe(1);
    radio.__resetHidden(); expect((await get()).cats.find(c => c.id === 'top').items).toEqual([]);   // 1 player is not enough
    await fav('device0000000002'); radio.__resetHidden();
    expect((await get()).cats.find(c => c.id === 'top').items.map(i => i.n)).toEqual(['Alpha']);
    await fav('device0000000002', false); expect(storage.__favs()[health.radioKey(URL_A)]).toBe(1);
  });
  test('refused: a station that is not in the list (404), junk (400), no boolean, and the 61st change of one device within an hour (429)', async () => {
    await stored();
    expect((await fav('device0000000003', true, 'https://nowhere.example.com/x')).statusCode).toBe(404);
    expect((await post({ action: 'fav', u: URL_A, on: 'yes', dev: 'device0000000003' })).statusCode).toBe(400);
    expect((await post({ action: 'fav', u: 'http://a.example.ro/x', on: true, dev: 'device0000000003' })).statusCode).toBe(400);
    expect((await post({ action: 'fav', u: URL_A, on: true, dev: 'x' })).statusCode).toBe(400);
    let last; for (let i = 0; i < 61; i++) last = await fav('device0000000004', i % 2 === 0);
    expect(last.statusCode).toBe(429);
  });
  describe('admin', () => {
    let call;
    const setup = async () => {
      jest.resetModules(); storage = require('./functions/firebase-storage.js'); storage.__reset(); radio = require('./functions/radio.js'); radio.__resetMemory(); radio.__resetHidden(); require('./functions/radio-reports.js').__resetLimiter();
      storage.__put('1 : Boss', { id: 1, name: 'Boss', safeWord: 'pw', role: 'admin', balance: 100, difficulty: 2, createdAt: 1 });
      storage.__cache({ updatedAt: Date.now(), v: radio.BUILDER_VERSION, cats: [{ id: 'manele', emoji: 'F', label: 'MANELE', items: [item('Alpha', URL_A), item('Beta', URL_B)] }, { id: 'etno', emoji: 'E', label: 'ETNO', items: [] }, { id: 'pop', emoji: 'P', label: 'POP', items: [item('Beta', URL_B), item('Gamma', URL_C)] }, { id: 'global', emoji: 'G', label: 'GLOBAL', items: [item('Gamma', URL_C)] }] });
      const { handler } = require('./functions/lxa-account.js'); let ip = 0;
      call = async data => { const r = await handler({ httpMethod: 'POST', headers: { 'x-vercel-forwarded-for': '10.8.0.' + (ip++ & 255) }, body: JSON.stringify({ action: 'admin-radio', id: 1, safeWord: 'pw', ...data }) }); return { status: r.statusCode, body: JSON.parse(r.body) }; };
    };
    test('stations: every station once with its categories, moved / hidden flags; the move targets exclude TOP and GLOBAL', async () => {
      await setup(); const r = (await call({ op: 'stations' })).body;
      expect(r.stations.map(s => s.n)).toEqual(['Alpha', 'Beta', 'Gamma']); expect(r.stations.find(s => s.n === 'Beta').cats).toEqual(['manele', 'pop']); expect(r.stations.find(s => s.n === 'Gamma').cats).toEqual(['pop', 'global']);
      expect(r.categories.map(c => c.id)).toEqual(['manele', 'etno', 'pop']);
    });
    test('move -> the served list shows it in the new category at once; the station manager shows it moved; unmove restores the automatic place', async () => {
      await setup(); const key = health.radioKey(URL_A);
      expect((await call({ op: 'move', key, cat: 'etno' })).body.ok).toBe(true); expect(storage.__moves()[key]).toMatchObject({ u: URL_A, n: 'Alpha', cat: 'etno' });
      radio.__resetHidden(); let served = JSON.parse((await radio.handler({ httpMethod: 'GET', queryStringParameters: {} })).body);
      expect(served.cats.find(c => c.id === 'etno').items.map(i => i.n)).toEqual(['Alpha']); expect(served.cats.find(c => c.id === 'manele').items.map(i => i.n)).toEqual(['Beta']);
      expect((await call({ op: 'stations' })).body.stations.find(s => s.n === 'Alpha').moved).toBe('etno');
      expect((await call({ op: 'list' })).body.categories.map(c => c.id)).toEqual(['manele', 'etno', 'pop']);
      await call({ op: 'unmove', key }); radio.__resetHidden(); served = JSON.parse((await radio.handler({ httpMethod: 'GET', queryStringParameters: {} })).body);
      expect(served.cats.find(c => c.id === 'manele').items.map(i => i.n)).toEqual(['Alpha', 'Beta']);
    });
    test('any station of the list can be hidden (reported or not) and shows up as hidden in the station manager', async () => {
      await setup(); const key = health.radioKey(URL_C);
      expect((await call({ op: 'hide', key })).body.ok).toBe(true);
      expect((await call({ op: 'stations' })).body.stations.find(s => s.n === 'Gamma').hidden).toBe(true);
    });
    test('move is refused for a bad key, an unknown station, a category that is not a target (top, global, junk)', async () => {
      await setup(); const key = health.radioKey(URL_A);
      expect((await call({ op: 'move', key: 'zz', cat: 'etno' })).status).toBe(400);
      expect((await call({ op: 'move', key: '0123456789abcdef', cat: 'etno' })).status).toBe(404);
      for (const cat of ['top', 'global', 'nope', '']) expect((await call({ op: 'move', key, cat })).status).toBe(400);
    });
  });
});
describe('stations of the players: submit (validated by the server, saved automatically), resolve, approve into any of the 12 categories', () => {
  const MINE = 'https://mine.example.ro/live', post = body => radio.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify(body) });
  // the SERVER judges the stream (radio-validate.js): here its verdict is stubbed, the real checks are in radio-submit.test.js
  const verdictOK = (u, over = {}) => ({ ok: true, url: u, name: '', codec: 'MP3', bitrate: 128, sampleRate: 44100, channels: 2, stable: true, stalls: 0, warnings: [], audio: true, hls: false, level: null, checkedAt: Date.now(), ...over });
  const suggest = (over = {}) => { radio.__setValidator(async input => verdictOK(input)); return post({ action: 'submit', u: MINE, n: 'My Radio', dev: 'suggestdevice0001', ...over }); };
  const withValidate = async (fn, body) => { const validate = require('./functions/radio-validate.js'); const real = validate.validateStream; validate.validateStream = fn; try { return await body(); } finally { validate.validateStream = real; } };
  const get = async () => JSON.parse((await radio.handler({ httpMethod: 'GET', queryStringParameters: {} })).body);
  test('a suggestion is stored once per link; the players who sent it are counted (one per device)', async () => {
    await stored(); expect((await suggest()).statusCode).toBe(200); await suggest(); await suggest({ dev: 'suggestdevice0002', n: 'Other Name' });
    const rows = Object.values(storage.__suggest()); expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ u: MINE, n: 'My Radio', count: 2, status: 'VALID', canon: 'mine.example.ro/live' }); expect(rows[0].v).toMatchObject({ ok: true, codec: 'MP3', bitrate: 128 });
  });
  test('refused: user:password@, private / local addresses (answered, nothing stored), no device id / junk body (400); the 9th submission of one device within an hour is stopped', async () => {
    await stored();
    for (const bad of [{ u: 'https://u:p@mine.example.ro/x' }, { u: 'https://127.0.0.1/x' }, { u: 'https://10.0.0.5/x' }, { u: 'http://localhost/x' }, { u: 'ftp://mine.example.ro/x' }]) { const r = await suggest(bad); expect(r.statusCode).toBe(200); expect(JSON.parse(r.body)).toMatchObject({ ok: false, status: 'INVALID' }); }
    for (const bad of [{ dev: 'x' }, { u: '' }]) expect((await suggest(bad)).statusCode).toBe(400);
    expect(Object.keys(storage.__suggest())).toHaveLength(0);
    for (let i = 0; i < 8; i++) expect((await suggest({ u: 'https://m' + i + '.example.ro/s', dev: 'suggestdevice0009' })).statusCode).toBe(200);
    expect((await suggest({ u: 'https://m9.example.ro/s', dev: 'suggestdevice0009' })).statusCode).toBe(429); expect(Object.keys(storage.__suggest())).toHaveLength(8);
  });
  test('a station that is in the list already is not stored again; the daily cap (200) stops a flood; the name is cleaned', async () => {
    await stored(); expect(JSON.parse((await suggest({ u: URL_A })).body)).toMatchObject({ ok: true, dup: 'public', queued: false, url: URL_A }); expect(Object.keys(storage.__suggest())).toHaveLength(0);
    await suggest({ n: '<b>Bold</b>\u0007 Name   here' }); expect(Object.values(storage.__suggest())[0].n).toBe('b Bold /b Name here');
    for (let i = 0; i < 199; i++) await storage.bumpSuggestDay(new Date().toISOString().slice(0, 10), 200);
    expect(JSON.parse((await suggest({ u: 'https://flood.example.ro/s', dev: 'suggestdevice0007' })).body)).toMatchObject({ ok: true, queued: false, note: 'day-limit' });   // he can still play it, it just does not reach the owner today
  });
  test('the old GET ?resolve= endpoint is gone: one validation path only (POST submit), a GET with it just serves the list', async () => {
    await stored(); const res = await radio.handler({ httpMethod: 'GET', queryStringParameters: { resolve: 'https://a.example.ro/s' }, headers: { 'x-forwarded-for': '1.2.3.4' } });
    expect(res.statusCode).toBe(200); expect(JSON.parse(res.body)).toHaveProperty('cats'); expect(JSON.parse(res.body)).not.toHaveProperty('url'); expect(radio.__setResolver).toBeUndefined();
  });
  describe('admin 📨', () => {
    let call, key;
    const setup = async () => {
      jest.resetModules(); storage = require('./functions/firebase-storage.js'); storage.__reset(); radio = require('./functions/radio.js'); radio.__resetMemory(); radio.__resetHidden(); require('./functions/radio-reports.js').__resetLimiter();
      storage.__put('1 : Boss', { id: 1, name: 'Boss', safeWord: 'pw', role: 'admin', balance: 100, difficulty: 2, createdAt: 1 });
      storage.__cache({ updatedAt: Date.now(), v: radio.BUILDER_VERSION, cats: [{ id: 'manele', emoji: 'F', label: 'MANELE', items: [item('Alpha', URL_A)] }, { id: 'etno', emoji: 'E', label: 'ETNO', items: [] }, { id: 'pop', emoji: 'P', label: 'POP', items: [item('Gamma', URL_C)] }, { id: 'global', emoji: 'G', label: 'GLOBAL', items: [] }] });
      const { handler } = require('./functions/lxa-account.js'); let ip = 0;
      call = async data => { const r = await handler({ httpMethod: 'POST', headers: { 'x-vercel-forwarded-for': '10.6.0.' + (ip++ & 255) }, body: JSON.stringify({ action: 'admin-radio', id: 1, safeWord: 'pw', ...data }) }); return { status: r.statusCode, body: JSON.parse(r.body) }; };
      radio.__setValidator(async input => verdictOK(input, { codec: 'AAC', bitrate: 64 }));
      await radio.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ action: 'submit', u: MINE, n: 'My Radio', dev: 'suggestdevice0001' }) });
      await radio.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ action: 'submit', u: MINE, n: 'My Radio', dev: 'suggestdevice0002' }) });
      key = health.radioKey('mine.example.ro/live');   // a submission is keyed by the CANONICAL address (not by the string the player typed)
    };
    test('list: one row per link with the number of players, the 12 targets', async () => {
      await setup(); const r = (await call({ op: 'suggestions' })).body;
      expect(r.suggestions).toHaveLength(1); expect(r.suggestions[0]).toMatchObject({ key, host: 'mine.example.ro', path: '/live', count: 2, n: 'My Radio', query: false, status: 'VALID', dup: 'new', orig: MINE }); expect(r.suggestions[0].v).toMatchObject({ ok: true, codec: 'AAC' }); expect(r.approved).toEqual([]); expect(r.rejected).toEqual([]); expect(r.targets).toHaveLength(12); expect(r.targets).toEqual(expect.arrayContaining(['top', 'global', 'manele', 'retro']));
    });
    test('approve into ANY of the 12 categories (also GLOBAL and TOP): the station is public at the top of it, one row less in the list, the suggestion is gone', async () => {
      for (const cat of ['etno', 'global', 'top', 'manele']) {
        await setup();
        const r = await call({ op: 'sug-approve', key, cat, name: 'My Radio PUBLIC' });
        expect(r.body.ok).toBe(true); expect(Object.keys(storage.__suggest())).toHaveLength(0); expect(Object.values(storage.__customs())[0]).toMatchObject({ u: MINE, n: 'My Radio PUBLIC', cat, c: 'AAC', b: 64 });
        radio.__resetHidden(); const served = (await radio.handler({ httpMethod: 'GET', queryStringParameters: {} })).body, cats = JSON.parse(served).cats;
        expect(cats.find(c => c.id === cat).items[0]).toMatchObject({ n: 'My Radio PUBLIC', u: MINE }); expect(cats.filter(c => c.items.some(i => i.u === MINE))).toHaveLength(1);
      }
    });
    test('approve is refused: a category that is not one of the 12, a name that is too short, a stream that does not play (unless forced), an unknown key', async () => {
      await setup();
      expect((await call({ op: 'sug-approve', key, cat: 'nope', name: 'Okay' })).status).toBe(400); expect((await call({ op: 'sug-approve', key, cat: 'pop', name: 'x' })).status).toBe(400);
      expect((await call({ op: 'sug-approve', key: '0123456789abcdef', cat: 'pop', name: 'Okay' })).status).toBe(404);
      storage.__suggest()[key].v = { ok: false, why: 'unreachable' };   // the stored verdict is not a pass: the server checks again before it publishes
      const bad = await withValidate(async () => ({ ok: false, why: 'unreachable' }), () => call({ op: 'sug-approve', key, cat: 'pop', name: 'Okay' })); expect(bad.status).toBe(409);
      const forced = await withValidate(async () => ({ ok: false, why: 'unreachable' }), () => call({ op: 'sug-approve', key, cat: 'pop', name: 'Okay', force: true })); expect(forced.body.ok).toBe(true);
    });
    test('reject: the suggestion goes and the same link is accepted silently but never listed again; TEST AGAIN stores the new verdict on the submission', async () => {
      await setup(); expect((await call({ op: 'suggestions' }, undefined)).status).toBe(200);
      const t = await withValidate(async () => verdictOK(MINE, { codec: 'MP3', bitrate: 96 }), () => call({ op: 'sug-test', key })); expect(t.body).toMatchObject({ ok: true, status: 'VALID' }); expect(t.body.v).toMatchObject({ codec: 'MP3', bitrate: 96 }); expect(storage.__suggest()[key].v.bitrate).toBe(96);
      const down = await withValidate(async () => ({ ok: false, why: 'disconnects' }), () => call({ op: 'sug-test', key })); expect(down.body).toMatchObject({ status: 'INVALID' }); expect(storage.__suggest()[key]).toMatchObject({ status: 'INVALID' });
      expect((await call({ op: 'sug-reject', key })).body.ok).toBe(true); expect(Object.keys(storage.__suggest())).toHaveLength(0); expect(storage.__rejected()[key]).toMatchObject({ u: MINE, orig: MINE });
      radio.__setValidator(async input => verdictOK(input));
      const again = await radio.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ action: 'submit', u: MINE, n: 'Again', dev: 'suggestdevice0003' }) }); expect(JSON.parse(again.body)).toMatchObject({ ok: true, queued: false, dup: 'rejected' }); expect(Object.keys(storage.__suggest())).toHaveLength(0);
      expect((await call({ op: 'suggestions' })).body.rejected[0]).toMatchObject({ key, u: MINE });
    });
    test('an approved station can be moved, hidden, starred and reported like any other; the station manager lists it flagged; remove deletes it', async () => {
      await setup(); await call({ op: 'sug-approve', key, cat: 'pop', name: 'Mine Public' });
      const stationKey = health.radioKey(MINE), stations = (await call({ op: 'stations' })).body.stations, row = stations.find(s => s.key === stationKey); expect(row).toMatchObject({ n: 'Mine Public', custom: true, cats: ['pop'] });
      expect((await call({ op: 'move', key: stationKey, cat: 'etno' })).body.ok).toBe(true);
      expect((await call({ op: 'hide', key: stationKey })).body.ok).toBe(true);
      const post = body => radio.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify(body) }); radio.__resetHidden();
      expect((await post({ action: 'fav', u: MINE, on: true, dev: 'favdevice00000001' })).statusCode).toBe(200); expect((await post({ action: 'report', u: MINE, kind: 'manual', code: 'playing', dev: 'favdevice00000001' })).statusCode).toBe(200);
      radio.__resetHidden(); expect(JSON.parse((await radio.handler({ httpMethod: 'GET', queryStringParameters: {} })).body).cats.some(c => c.items.some(i => i.u === MINE))).toBe(false);   // hidden
      expect((await call({ op: 'custom-remove', key: stationKey })).body.ok).toBe(true); expect(Object.keys(storage.__customs())).toHaveLength(0);
    });
  });
  test('served list: customs go to the top of their category, replace a station with the same address, honour hide, and TOP takes customs first', () => {
    const data = { cats: [{ id: 'manele', emoji: 'x', label: 'M', items: [item('Alpha', URL_A)] }, { id: 'pop', emoji: 'y', label: 'P', items: [item('Old Copy', MINE), item('Gamma', URL_C)] }, { id: 'global', emoji: 'g', label: 'G', items: [] }] };
    const state = { hidden: new Set(), moves: new Map(), favs: new Map([[health.radioKey(URL_A), 3]]), customs: [{ key: health.radioKey(MINE), u: MINE, n: 'Mine', c: 'MP3', b: 128, cat: 'manele', at: 2 }, { key: health.radioKey('https://t.example.ro/s'), u: 'https://t.example.ro/s', n: 'Toppy', c: '', b: 0, cat: 'top', at: 1 }] };
    const out = radio.servedList(data, state), by = id => out.cats.find(c => c.id === id).items.map(i => i.n);
    expect(by('manele')).toEqual(['Mine', 'Alpha']); expect(by('pop')).toEqual(['Gamma']); expect(by('top')).toEqual(['Toppy', 'Alpha']);
    const hid = radio.servedList(data, { ...state, hidden: new Set([health.radioKey(MINE)]) }); expect(hid.cats.find(c => c.id === 'manele').items.map(i => i.n)).toEqual(['Alpha']);
  });
});
describe('player submission → admin → public: the server validates, saves automatically, decides duplicates, never trusts the player', () => {
  const MINE = 'https://mine.example.ro/live', DEV1 = 'submitdevice00001', DEV2 = 'submitdevice00002';
  const verdictOK = (u, over = {}) => ({ ok: true, url: u, name: '', codec: 'MP3', bitrate: 128, sampleRate: 44100, channels: 2, stable: true, stalls: 0, warnings: [], audio: true, hls: false, level: null, measuredKbps: 127, checkedAt: Date.now(), ...over });
  const submit = (body, headers = {}) => radio.handler({ httpMethod: 'POST', headers, body: JSON.stringify({ action: 'submit', u: MINE, n: 'My Radio', dev: DEV1, ...body }) });
  const json = r => JSON.parse(r.body);
  beforeEach(async () => { await stored(); radio.__setValidator(async input => verdictOK(input)); radio.__setAccountVerifier(async (id, token) => (token === 'good-token' && Number(id) === 7 ? { id: 7, name: 'Ana' } : null)); });

  test('valid stream: the player gets everything he needs to PLAY now, the submission is saved by itself as VALID/queued, nothing is public', async () => {
    const r = json(await submit({}));
    expect(r).toMatchObject({ ok: true, status: 'VALID', url: MINE, codec: 'MP3', bitrate: 128, sampleRate: 44100, channels: 2, stable: true, queued: true, dup: 'new' });
    const row = Object.values(storage.__suggest())[0]; expect(row).toMatchObject({ status: 'VALID', u: MINE, orig: MINE, count: 1 }); expect(Object.keys(storage.__customs())).toHaveLength(0);
    expect(JSON.parse((await radio.handler({ httpMethod: 'GET', queryStringParameters: {} })).body).cats.some(c => c.items.some(i => i.u === MINE))).toBe(false);   // not public
  });
  test('the player never sees the owner\'s data (account, original / canonical address, devices, raw verdict)', async () => {
    const r = json(await submit({ id: 7, token: 'good-token' }));
    for (const hidden of ['by', 'accounts', 'canon', 'orig', 'devices', 'v', 'first', 'last', 'count', 'checkedAt']) expect(r).not.toHaveProperty(hidden);
  });
  test('who sent it: recorded ONLY with a valid session token; a wrong token, a wrong id or none = anonymous', async () => {
    await submit({ id: 7, token: 'good-token' }); expect(Object.values(storage.__suggest())[0].by).toEqual({ id: 7, name: 'Ana' });
    storage.__reset(); await stored(); await submit({ id: 7, token: 'stolen' }); await submit({ id: 8, token: 'good-token', dev: DEV2 });
    const row = Object.values(storage.__suggest())[0]; expect(row.by).toBeUndefined(); expect(row.accounts).toEqual([]); expect(row.count).toBe(2);
  });
  test('the player cannot write status, verdict, approval or ownership: those fields in the body are ignored', async () => {
    radio.__setValidator(async () => ({ ok: false, why: 'not-audio' }));
    const r = json(await submit({ status: 'APPROVED', approved: true, public: true, v: { ok: true, codec: 'FLAC' }, by: { id: 1, name: 'Boss' }, cat: 'top', health: { status: 'OK' }, level: 99, validation: 'ok' }));
    expect(r).toMatchObject({ ok: false, status: 'INVALID', why: 'not-audio' });
    const row = Object.values(storage.__suggest())[0]; expect(row).toMatchObject({ status: 'INVALID', v: { ok: false, why: 'not-audio' } }); expect(row.by).toBeUndefined(); expect(row.cat).toBeUndefined(); expect(row.health).toBeUndefined(); expect(Object.keys(storage.__customs())).toHaveLength(0);
  });
  test('an INVALID link is kept for the owner with the exact reason (and the player is told the real reason)', async () => {
    for (const why of ['html', 'not-audio', 'disconnects', 'unstable', 'unreachable', 'http-only', 'blocked', 'no-data']) {
      storage.__reset(); await stored(); radio.__setValidator(async () => ({ ok: false, why })); radio.__resetHidden();
      expect(json(await submit({}))).toMatchObject({ ok: false, status: 'INVALID', why, queued: true }); expect(Object.values(storage.__suggest())[0]).toMatchObject({ status: 'INVALID', v: { why } });
    }
  });
  test('duplicates are decided on the canonical address, and ONE row results when two players send it at the same moment', async () => {
    const variants = ['HTTP://mine.example.ro/live', 'http://mine.example.ro/live/', 'https://www.mine.example.ro:443/live', 'https://mine.example.ro/live?utm_source=a'];
    const out = await Promise.all(variants.map((u, i) => submit({ u, dev: 'racedevice0000' + (i + 1) }).then(json)));
    expect(Object.keys(storage.__suggest())).toHaveLength(1); const row = Object.values(storage.__suggest())[0]; expect(row.count).toBe(4);
    expect(out.filter(r => r.dup === 'new')).toHaveLength(1); expect(out.filter(r => r.dup === 'pending')).toHaveLength(3); expect(out.every(r => r.ok && r.queued)).toBe(true);
  });
  test('a duplicate of a row that is waiting is NOT validated again and can never turn a good row into a bad one (the other spelling may not even work on the real server)', async () => {
    let calls = 0; radio.__setValidator(async input => { calls++; return verdictOK(input); });
    expect(json(await submit({}))).toMatchObject({ ok: true, dup: 'new' }); expect(calls).toBe(1);
    radio.__setValidator(async () => { calls++; return { ok: false, why: 'unreachable' }; });
    const again = json(await submit({ u: 'HTTP://MINE.example.ro/live/', dev: DEV2 }));
    expect(again).toMatchObject({ ok: true, status: 'VALID', dup: 'pending', queued: true, url: MINE, codec: 'MP3', bitrate: 128 }); expect(calls).toBe(1);   // the first answer is reused
    const row = Object.values(storage.__suggest())[0]; expect(row).toMatchObject({ status: 'VALID', count: 2 }); expect(row.v).toMatchObject({ ok: true, codec: 'MP3' });
  });
  test('an INVALID row is checked again when somebody sends it later: if it plays now it becomes VALID; if the stored check is old a failing result still cannot downgrade a VALID row', async () => {
    radio.__setValidator(async () => ({ ok: false, why: 'unreachable' })); await submit({});
    expect(Object.values(storage.__suggest())[0].status).toBe('INVALID');
    radio.__setValidator(async input => verdictOK(input)); expect(json(await submit({ dev: DEV2 }))).toMatchObject({ ok: true, status: 'VALID', dup: 'pending' });
    const row = Object.values(storage.__suggest())[0]; expect(row).toMatchObject({ status: 'VALID', count: 2 });
    row.checkedAt = Date.now() - 7 * 3600 * 1000;   // the stored check is older than 6 hours: it is checked again, but a bad answer only adds the player
    radio.__setValidator(async () => ({ ok: false, why: 'disconnects' })); await submit({ dev: 'submitdevice00003' });
    expect(Object.values(storage.__suggest())[0]).toMatchObject({ status: 'VALID', count: 3 });
  });
  test('already in the public list / already approved / already rejected: the player can listen, nothing is queued again', async () => {
    expect(json(await submit({ u: 'HTTP://A.example.ro/live/' }))).toMatchObject({ ok: true, dup: 'public', queued: false, url: URL_A });
    storage.__customs()[health.radioKey(MINE)] = { u: MINE, n: 'Approved', c: 'MP3', b: 96, cat: 'pop', at: 1 }; radio.__resetHidden();
    expect(json(await submit({ u: 'https://www.mine.example.ro/live/' }))).toMatchObject({ ok: true, dup: 'approved', queued: false, name: 'Approved' });
    storage.__reset(); await stored(); radio.__resetHidden(); storage.__rejected()[health.radioKey('mine.example.ro/live')] = { at: 1 };
    expect(json(await submit({}))).toMatchObject({ ok: true, dup: 'rejected', queued: false }); expect(Object.keys(storage.__suggest())).toHaveLength(0);
  });
  test('a page or playlist that leads to a stream already in the list is a duplicate too (checked on the stream it resolves to)', async () => {
    radio.__setValidator(async () => verdictOK(URL_A)); expect(json(await submit({ u: 'https://page.example.ro/radio.pls' }))).toMatchObject({ ok: true, dup: 'public', queued: false }); expect(Object.keys(storage.__suggest())).toHaveLength(0);
  });
  test('SSRF at the door: private, local and credential addresses never reach the validator; the validator is not even called', async () => {
    let called = 0; radio.__setValidator(async () => { called++; return verdictOK(MINE); });
    for (const u of ['http://127.0.0.1/x', 'https://169.254.169.254/latest', 'http://[::1]/x', 'https://192.168.0.5/s', 'http://localhost:8080/x', 'https://u:p@mine.example.ro/x', 'file:///etc/passwd', 'ftp://mine.example.ro/x']) expect(json(await submit({ u }))).toMatchObject({ ok: false, status: 'INVALID' });
    expect(called).toBe(0); expect(Object.keys(storage.__suggest())).toHaveLength(0);
  });
  test('limits: 8 submissions per device per hour and 15 validations per visitor per hour (the expensive part) → 429', async () => {
    for (let i = 0; i < 15; i++) expect((await submit({ u: 'https://l' + i + '.example.ro/s', dev: 'limitdevice' + String(100000 + i) }, { 'x-forwarded-for': '9.9.9.9' })).statusCode).toBe(200);
    expect((await submit({ u: 'https://l99.example.ro/s', dev: 'limitdevice999999' }, { 'x-forwarded-for': '9.9.9.9' })).statusCode).toBe(429);
    expect((await submit({ u: 'https://l98.example.ro/s', dev: 'limitdevice999998' }, { 'x-forwarded-for': '8.8.8.8' })).statusCode).toBe(200);
  });
  test('the old "suggest" action goes through the SAME validated pipeline (no second system)', async () => {
    radio.__setValidator(async () => ({ ok: false, why: 'html' }));
    expect(json(await radio.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ action: 'suggest', u: MINE, n: 'Old client', dev: DEV1 }) }))).toMatchObject({ ok: false, why: 'html' }); expect(Object.values(storage.__suggest())[0].status).toBe('INVALID');
  });

  describe('admin: one place for everything, and the stored status can only be changed by the admin', () => {
    let call; const key = health.radioKey('mine.example.ro/live');
    beforeEach(() => {
      storage.__put('1 : Boss', { id: 1, name: 'Boss', safeWord: 'pw', role: 'admin', balance: 100, difficulty: 2, createdAt: 1 }); storage.__put('2 : Ana', { id: 2, name: 'Ana', safeWord: 'pw', balance: 100, difficulty: 2, createdAt: 1 });
      const { handler } = require('./functions/lxa-account.js'); let ip = 0;
      call = async (data, id = 1) => { const r = await handler({ httpMethod: 'POST', headers: { 'x-vercel-forwarded-for': '10.7.0.' + (ip++ & 255) }, body: JSON.stringify({ action: 'admin-radio', id, safeWord: 'pw', ...data }) }); return { status: r.statusCode, body: JSON.parse(r.body) }; };
    });
    test('the owner sees who, the ORIGINAL and the NORMALIZED address, when, the validator result with the measured numbers, duplicate status and a status per row', async () => {
      await submit({ u: 'HTTP://Mine.example.ro/live/?utm_source=z', id: 7, token: 'good-token' }); radio.__setValidator(async () => ({ ok: false, why: 'html' })); await submit({ u: 'https://bad.example.ro/page', dev: DEV2 });
      const rows = (await call({ op: 'suggestions' })).body.suggestions;
      expect(rows.map(r => r.status)).toEqual(['VALID', 'INVALID']);
      expect(rows[0]).toMatchObject({ key, orig: 'HTTP://Mine.example.ro/live/?utm_source=z', u: 'http://mine.example.ro/live/?utm_source=z', canon: 'mine.example.ro/live', dup: 'new', by: { id: 7, name: 'Ana' }, count: 1 });
      expect(rows[0].first).toBeGreaterThan(0); expect(rows[0].checkedAt).toBeGreaterThan(0); expect(rows[0].v).toMatchObject({ ok: true, codec: 'MP3', bitrate: 128, sampleRate: 44100, channels: 2, stable: true, stalls: 0, measuredKbps: 127 }); expect(rows[0].v.level).toBeUndefined();   // the audio level is not measured: the row has no level at all (the panel says so)
      expect(rows[1].v).toMatchObject({ ok: false, why: 'html' });
    });
    test('TEST AGAIN updates the verdict on the row; APPROVE publishes it (with who/original/health); REJECT keeps a record and it never reaches the public list', async () => {
      await submit({}); const validate = require('./functions/radio-validate.js'), real = validate.validateStream;
      try {
        validate.validateStream = async () => ({ ok: false, why: 'disconnects' }); expect((await call({ op: 'sug-test', key })).body).toMatchObject({ status: 'INVALID' }); expect(storage.__suggest()[key].v.why).toBe('disconnects');
        validate.validateStream = async u => verdictOK(u, { bitrate: 64, codec: 'AAC', warnings: ['stalls'], stable: false }); expect((await call({ op: 'sug-test', key })).body).toMatchObject({ status: 'VALID' });
        expect((await call({ op: 'sug-approve', key, cat: 'pop', name: 'Mine OK' })).body.ok).toBe(true);
      } finally { validate.validateStream = real; }
      expect(Object.values(storage.__customs())[0]).toMatchObject({ u: MINE, n: 'Mine OK', cat: 'pop', c: 'AAC', b: 64, orig: MINE, health: { status: 'DEGRADED' } }); expect(Object.keys(storage.__suggest())).toHaveLength(0);   // the codec / bitrate of the LAST test (TEST AGAIN) are the ones published
      radio.__resetHidden(); expect(JSON.parse((await radio.handler({ httpMethod: 'GET', queryStringParameters: {} })).body).cats.find(c => c.id === 'pop').items[0]).toMatchObject({ n: 'Mine OK', u: MINE });
      const list = (await call({ op: 'suggestions' })).body; expect(list.approved[0]).toMatchObject({ n: 'Mine OK', health: { status: 'DEGRADED' }, orig: MINE });
    });
    test('only the admin gets in: a player account cannot read submissions, test, approve, reject or check', async () => {
      await submit({}); for (const op of ['suggestions', 'sug-test', 'sug-approve', 'sug-reject', 'custom-check', 'customs-check', 'custom-remove']) expect((await call({ op, key, cat: 'pop', name: 'Okay' }, 2)).status).toBe(403);
      expect(Object.keys(storage.__suggest())).toHaveLength(1);
    });
    test('health of APPROVED stations: OK / DEGRADED / OFFLINE are written, nothing is deleted or hidden, a removed station is not brought back', async () => {
      const A = 'https://ok.example.ro/s', B = 'https://flaky.example.ro/s', C = 'https://dead.example.ro/s';
      for (const [u, n] of [[A, 'Ok'], [B, 'Flaky'], [C, 'Dead']]) storage.__customs()[health.radioKey(u)] = { u, n, c: 'MP3', b: 128, cat: 'pop', at: 1 };
      radio.__setValidator(async u => (u === A ? verdictOK(u) : u === B ? verdictOK(u, { warnings: ['slow'], stable: false, measuredKbps: 60 }) : { ok: false, why: 'unreachable' }));
      const out = (await call({ op: 'customs-check' })).body.results; expect(out.map(r => r.status).sort()).toEqual(['DEGRADED', 'OFFLINE', 'OK']);
      const c = storage.__customs(); expect(c[health.radioKey(A)].health).toMatchObject({ status: 'OK' }); expect(c[health.radioKey(B)].health).toMatchObject({ status: 'DEGRADED', kbps: 60 }); expect(c[health.radioKey(C)].health).toMatchObject({ status: 'OFFLINE', why: 'unreachable' });
      expect(Object.keys(c)).toHaveLength(3); radio.__resetHidden();
      expect(JSON.parse((await radio.handler({ httpMethod: 'GET', queryStringParameters: {} })).body).cats.find(cat => cat.id === 'pop').items.some(i => i.u === C)).toBe(true);   // OFFLINE is not hidden or deleted automatically
      await storage.patchRadioCustomHealth('0123456789abcdef', { status: 'OK' }); expect(c['0123456789abcdef']).toBeUndefined();
      expect((await call({ op: 'custom-check', key: health.radioKey(C) })).body.results).toHaveLength(1);
      const listed = (await call({ op: 'suggestions' })).body.approved; expect(listed.find(a => a.u === C).health.status).toBe('OFFLINE');
    });
    test('the daily cron (?refresh=1) also runs the health sweep, oldest check first, a bounded batch', async () => {
      const urls = Array.from({ length: 12 }, (_, i) => 'https://s' + i + '.example.ro/s');
      urls.forEach((u, i) => { storage.__customs()[health.radioKey(u)] = { u, n: 'S' + i, c: 'MP3', b: 128, cat: 'pop', at: 1, health: i < 4 ? { status: 'OK', at: 5000 + i } : undefined }; });
      const seen = []; radio.__setValidator(async u => { seen.push(u); return verdictOK(u); });
      await radio.healthSweep(storage, { max: 8 }); expect(seen).toHaveLength(8); expect(seen.some(u => /s[0-3]\./.test(u))).toBe(false);   // the 4 stations checked most recently wait for the next run
    });
    test('the public cron URL cannot be used to hammer the stations: one that was checked within the last 6 hours is skipped by the cron sweep (the admin button always checks)', async () => {
      const A = 'https://fresh.example.ro/s', B = 'https://old.example.ro/s';
      storage.__customs()[health.radioKey(A)] = { u: A, n: 'Fresh', c: 'MP3', b: 128, cat: 'pop', at: 1, health: { status: 'OK', at: Date.now() - 3600 * 1000 } }; storage.__customs()[health.radioKey(B)] = { u: B, n: 'Old', c: 'MP3', b: 128, cat: 'pop', at: 1, health: { status: 'OK', at: Date.now() - 7 * 3600 * 1000 } };
      const seen = []; radio.__setValidator(async u => { seen.push(u); return verdictOK(u); });
      await radio.healthSweep(storage, { max: 8, minAgeMs: 6 * 3600 * 1000 }); expect(seen).toEqual([B]);
      seen.length = 0; await radio.healthSweep(storage, { max: 8 }); expect(seen.sort()).toEqual([A, B]);
    });
  });
});

describe('one category per station', () => {
  test('the same stream is listed once in the whole list, in the category where it fits best', async () => {
    const mk = (name, tags, n) => ({ stationuuid: 'u' + n, name, url_resolved: 'https://d' + n + '.example.ro/live', codec: 'MP3', bitrate: 128, lastcheckok: 1, hls: 0, ssl_error: 0, countrycode: 'RO', tags, clickcount: 100, votes: 10 });
    const data = await radio.buildList({ fetchRo: async () => [mk('Multi', 'house,techno,dance,pop', 1), mk('Only Pop', 'pop', 2), mk('Manele Dance', 'manele,dance', 3)], fetchRoAll: async () => [], fetchForeign: async () => [], fetchGlobal: async () => [], probe: async () => true, now: Date.now });
    const seen = new Map(); for (const cat of data.cats) for (const i of cat.items) seen.set(i.u, (seen.get(i.u) || 0) + 1);
    expect(Math.max(...seen.values())).toBe(1);
    expect(data.cats.find(c => c.id === 'manele').items.map(i => i.n)).toContain('Manele Dance');
  });
});

describe('player RECOMMENDS a station found by frequency → admin → public (own flow, not REPORT)', () => {
  let rv, call, KEY, URL_R;
  const FOUND = { n: 'Server Name FM', u: 'https://fm.example.com/live', c: 'MP3', b: 128, cc: 'DE', f: 97.5, fs: 'EXTERNAL_SOURCE', city: 'Berlin', src: 'radio-browser', sid: 'uuid-1' };
  const verdictOK = (u, over = {}) => ({ ok: true, url: u, name: '', codec: 'MP3', bitrate: 128, sampleRate: 44100, channels: 2, stable: true, stalls: 0, warnings: [], audio: true, hls: false, level: null, checkedAt: Date.now(), ...over });
  const rec = (body, ip = '1.1.1.1') => radio.handler({ httpMethod: 'POST', headers: { 'x-forwarded-for': ip }, body: JSON.stringify({ action: 'recommend', u: FOUND.u, id: 7, token: 'good-token', ...body }) }).then(r => ({ status: r.statusCode, body: JSON.parse(r.body) }));
  beforeEach(async () => {
    jest.resetModules(); storage = require('./functions/firebase-storage.js'); storage.__reset(); radio = require('./functions/radio.js'); radio.__resetMemory(); radio.__resetHidden(); require('./functions/radio-reports.js').__resetLimiter();
    const validate = require('./functions/radio-validate.js'); URL_R = FOUND.u; KEY = health.radioKey(validate.canonicalStream(FOUND.u));
    radio.__setBrowser({ lookup: key => (key === validate.canonicalStream(FOUND.u) ? FOUND : null) });
    radio.__setValidator(async input => verdictOK(input)); radio.__setAccountVerifier(async (id, token) => (token === 'good-token' && Number(id) === 7 ? { id: 7, name: 'Ana' } : token === 'tok8' && Number(id) === 8 ? { id: 8, name: 'Dan' } : token === 'tok9' && Number(id) === 9 ? { id: 9, name: 'Eva' } : null));
    storage.__put('1 : Boss', { id: 1, name: 'Boss', safeWord: 'pw', role: 'admin', balance: 100, difficulty: 2, createdAt: 1 });
    storage.__cache({ updatedAt: Date.now(), v: radio.BUILDER_VERSION, cats: [{ id: 'manele', emoji: 'F', label: 'MANELE', items: [] }, { id: 'etno', emoji: 'E', label: 'ETNO', items: [] }, { id: 'pop', emoji: 'P', label: 'POP', items: [item('Gamma', URL_C)] }, { id: 'global', emoji: 'G', label: 'GLOBAL', items: [] }] });
    const { handler } = require('./functions/lxa-account.js'); let ip = 0;
    call = async data => { const r = await handler({ httpMethod: 'POST', headers: { 'x-vercel-forwarded-for': '10.7.0.' + (ip++ & 255) }, body: JSON.stringify({ action: 'admin-radio', id: 1, safeWord: 'pw', ...data }) }); return { status: r.statusCode, body: JSON.parse(r.body) }; };
  });
  afterEach(() => { radio.__setBrowser(null); radio.__setValidator(null); radio.__setAccountVerifier(null); });
  test('login is required; the player is the verified session, never a body field; unknown results are refused', async () => {
    expect((await rec({ token: 'bad' })).status).toBe(401); expect((await rec({ id: 99, token: 'good-token' })).status).toBe(401);
    expect((await rec({ u: 'https://not-returned.example.com/x' })).status).toBe(404);
    expect(Object.keys(storage.__recommend())).toHaveLength(0);
  });
  test('recommendation = the SERVER record of the result (name, frequency, country, source), PENDING, with the server verdict; client-sent fields cannot change it', async () => {
    const r = await rec({ n: 'HACKED', f: 1, cc: 'XX', status: 'APPROVED', cat: 'pop', fs: 'ADMIN_VERIFIED', by: { id: 1 } });
    expect(r.body).toMatchObject({ ok: true, state: 'RECOMMENDED', vstate: 'VALID', count: 1 });
    const node = storage.__recommend()[KEY]; expect(node.status).toBe('PENDING');
    expect(node.st).toMatchObject({ n: 'Server Name FM', u: FOUND.u, f: 97.5, fs: 'EXTERNAL_SOURCE', cc: 'DE', city: 'Berlin', src: 'radio-browser', sid: 'uuid-1' });
    expect(node.players['7']).toMatchObject({ id: 7, name: 'Ana' }); expect(node.v.ok).toBe(true); expect(node.vstate).toBe('VALID');
    expect(Object.keys(storage.__customs())).toHaveLength(0);   // nothing is public
    expect(JSON.parse((await radio.handler({ httpMethod: 'GET', queryStringParameters: {} })).body).cats.some(c => c.items.some(i => i.u === FOUND.u))).toBe(false);
  });
  test('double tap = nothing changes; two players = ONE record with both names; an invalid stream is still recorded with its real state', async () => {
    await rec({}); expect((await rec({})).body).toMatchObject({ state: 'ALREADY', count: 1 });
    expect((await rec({ id: 8, token: 'tok8' }, '2.2.2.2')).body).toMatchObject({ state: 'RECOMMENDED', count: 2 });
    expect(Object.keys(storage.__recommend())).toHaveLength(1); expect(Object.keys(storage.__recommend()[KEY].players).sort()).toEqual(['7', '8']);
    radio.__setValidator(async () => ({ ok: false, why: 'unreachable' })); storage.__reset(); storage.__put('1 : Boss', { id: 1, name: 'Boss', safeWord: 'pw', role: 'admin', balance: 100, difficulty: 2, createdAt: 1 });
    const bad = await rec({}, '3.3.3.3'); expect(bad.body).toMatchObject({ ok: true, state: 'RECOMMENDED', vstate: 'OFFLINE' }); expect(storage.__recommend()[KEY].v.ok).toBe(false);
    radio.__setValidator(async input => verdictOK(input)); await rec({ id: 8, token: 'tok8' }, '4.4.4.4'); expect(storage.__recommend()[KEY].v.ok).toBe(true);   // a later GOOD check replaces a failed one, and a good one is never replaced by a failed one:
    radio.__setValidator(async () => ({ ok: false, why: 'unreachable' })); await rec({ id: 9, token: 'tok9' }, '4.4.4.5'); expect(storage.__recommend()[KEY].v.ok).toBe(true);
  });
  test('a station already in the list / already rejected is not recommended again', async () => {
    storage.__cache({ updatedAt: Date.now(), v: radio.BUILDER_VERSION, cats: [{ id: 'pop', emoji: 'P', label: 'POP', items: [item('Same', FOUND.u)] }] }); radio.__resetMemory(); radio.__resetHidden();
    expect((await rec({})).body.state).toBe('EXISTS'); expect(Object.keys(storage.__recommend())).toHaveLength(0);
    storage.__cache({ updatedAt: Date.now(), v: radio.BUILDER_VERSION, cats: [{ id: 'pop', emoji: 'P', label: 'POP', items: [] }] }); radio.__resetMemory(); radio.__resetHidden(); await storage.addRadioReject(KEY, { at: 1 });
    expect((await rec({})).body.state).toBe('REJECTED');
  });
  test('admin: list shows who/what/server data; TEST AGAIN stores a fresh verdict; APPROVE & ADD needs an EXISTING category, a fresh stream check and no duplicate; the owner frequency is ADMIN_VERIFIED', async () => {
    await rec({}); await rec({ id: 8, token: 'tok8' }, '2.2.2.2');
    const list = (await call({ op: 'recs' })).body; expect(list.recs).toHaveLength(1); expect(list.recs[0]).toMatchObject({ key: KEY, status: 'PENDING', n: 'Server Name FM', f: 97.5, fs: 'EXTERNAL_SOURCE', cc: 'DE', count: 2, vstate: 'VALID' }); expect(list.recs[0].players.map(p => p.name)).toEqual(['Ana', 'Dan']);
    radio.__setValidator(async () => ({ ok: false, why: 'html' })); const t = (await call({ op: 'rec-test', key: KEY })).body; expect(t).toMatchObject({ ok: true, vstate: 'NO AUDIO' });
    expect((await call({ op: 'rec-approve', key: KEY, cat: 'pop' })).status).toBe(409);   // a stream that does not play now cannot be approved
    radio.__setValidator(async input => verdictOK(input));
    expect((await call({ op: 'rec-approve', key: KEY, cat: 'newcat' })).status).toBe(400);   // no new categories
    const ok = await call({ op: 'rec-approve', key: KEY, cat: 'pop', name: 'Radio 97.5', f: '97,5' }); expect(ok.body.ok).toBe(true);
    expect(Object.values(storage.__customs())[0]).toMatchObject({ u: FOUND.u, n: 'Radio 97.5', cat: 'pop', f: 97.5, fs: 'ADMIN_VERIFIED', cc: 'DE' }); expect(storage.__recommend()[KEY].status).toBe('APPROVED');
    radio.__resetHidden(); const pub = JSON.parse((await radio.handler({ httpMethod: 'GET', queryStringParameters: {} })).body).cats; expect(pub.find(c => c.id === 'pop').items[0]).toMatchObject({ n: 'Radio 97.5', u: FOUND.u });
    expect((await rec({}, '9.9.9.9')).body.state).toBe('APPROVED');   // already in the list
    expect((await call({ op: 'rec-approve', key: KEY, cat: 'pop' })).status).toBe(409);   // duplicate check on approve
  });
  test('admin: REJECT does not publish and blocks a new recommendation; frequency search lists an approved station that has a frequency (owner value first)', async () => {
    await rec({}); expect((await call({ op: 'rec-reject', key: KEY })).body.ok).toBe(true);
    expect(Object.keys(storage.__customs())).toHaveLength(0); expect(storage.__recommend()[KEY].status).toBe('REJECTED'); expect((await rec({}, '8.8.8.8')).body.state).toBe('REJECTED');
    const br = require('./functions/radio-browse.js'), b = br.create({ rb: async () => [], usable: () => true, toItem: s => s, canonical: x => x });
    const r = await b.search('', '97.5', [{ n: 'Mine', u: 'https://m.example.com/x', f: 97.5, fs: 'ADMIN_VERIFIED', cc: 'DE', c: 'MP3', b: 64 }]); expect(r.items[0]).toMatchObject({ n: 'Mine', f: 97.5, fs: 'ADMIN_VERIFIED' });
    expect((await b.search('FR', '97.5', [{ n: 'Mine', u: 'https://m.example.com/x', f: 97.5, cc: 'DE' }])).items).toHaveLength(0);
  });
  test('REPORT is untouched and separate: a report never creates a recommendation', async () => {
    const before = Object.keys(storage.__recommend()).length; const res = await radio.handler({ httpMethod: 'POST', headers: { 'x-forwarded-for': '5.5.5.5' }, body: JSON.stringify({ action: 'report', u: 'https://nowhere.example.com/x', kind: 'dead', dev: 'reportdevice00001' }) });
    expect([400, 404]).toContain(res.statusCode); expect(Object.keys(storage.__recommend()).length).toBe(before);
  });
});
