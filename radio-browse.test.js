'use strict';
jest.mock('./functions/firebase-storage.js', () => ({ getRadioHidden: async () => ({}), getRadioMoves: async () => ({}), getRadioFavCounts: async () => ({}), getRadioCustoms: async () => ({}), getRadioCache: async () => null }));
const br = require('./functions/radio-browse');
const radio = require('./functions/radio');
const validate = require('./functions/radio-validate');
const mk = (name, cc, url, over = {}) => ({ name, countrycode: cc, url_resolved: url, codec: 'MP3', bitrate: 128, lastcheckok: 1, hls: 0, ssl_error: 0, clickcount: 10, state: 'X', ...over });
const DATA = {
  DE: [mk('NDR 90,3', 'DE', 'https://a.example.de/ndr'), mk('Radio Eins 95.8', 'DE', 'https://a.example.de/eins'), mk('97.5 Alpha', 'DE', 'https://b.example.de/a', { clickcount: 50 }), mk('97.5 Beta FM', 'DE', 'https://c.example.de/b'), mk('Alpha again 97.5', 'DE', 'https://www.b.example.de/a/'), mk('Plain Name', 'DE', 'https://d.example.de/p'), mk('Dead 97.5', 'DE', 'https://e.example.de/x', { lastcheckok: 0 }), mk('Not 197.55', 'DE', 'https://f.example.de/n')],
  US: [mk('102.7 KIIS FM', 'US', 'https://u.example.com/kiis'), mk('Radio 97.5', 'US', 'https://u.example.com/r975')],
  JP: [mk('J-Wave 81.3', 'JP', 'https://j.example.jp/w')]
};
let calls; const make = () => { calls = []; br.__reset(); return br.create({ rb: async path => { calls.push(path); if (path.includes('/countries')) return [{ name: 'Germany', iso_3166_1: 'DE', stationcount: 5 }, { name: 'Empty', iso_3166_1: 'XX', stationcount: 0 }, { name: 'Japan', iso_3166_1: 'JP', stationcount: 2 }]; const cc = (path.match(/countrycode=([A-Z]{2})/) || [])[1]; if (cc) return DATA[cc] || []; const m = decodeURIComponent((path.match(/name=([^&]+)/) || [])[1] || ''); return Object.values(DATA).flat().filter(s => s.name.includes(m)); }, usable: s => Number(s.lastcheckok) === 1, toItem: s => ({ n: s.name, u: s.url_resolved, c: 'MP3', b: 128, cc: s.countrycode }), canonical: validate.canonicalStream }); };
describe('frequency parsing', () => {
  test('reads dot / comma decimals and integers before FM / AM / kHz; nothing from plain names', () => {
    expect(br.freqsOf('NDR 90,3')).toEqual([90.3]); expect(br.freqsOf('102.7 KIIS FM')).toEqual([102.7]); expect(br.freqsOf('Radio 1008 AM')).toEqual([1008]); expect(br.freqsOf('Plain Name')).toEqual([]);
    expect(br.parseFreq('97,5')).toBe(97.5); expect(br.parseFreq('abc')).toBeNull(); expect(br.cleanCc('de')).toBe('DE'); expect(br.cleanCc('DEU')).toBe('');
  });
});
describe('browse any country', () => {
  test('countries: only countries with stations', async () => { expect((await make().countries()).map(c => c.cc)).toEqual(['DE', 'JP']); });
  test('exact frequency: every distinct real station (same frequency is NOT a duplicate), same stream once, broken ones and 197.55 left out', async () => {
    const r = await make().search('DE', '97.5');
    expect(r.items.map(i => i.n)).toEqual(['97.5 Alpha', '97.5 Beta FM']);   // "Alpha again" is the same stream as "97.5 Alpha"
    expect(r.items.every(i => i.f === 97.5)).toBe(true);
  });
  test('other countries work the same, nothing is hardcoded; global search asks the directory by name', async () => {
    const b = make(); expect((await b.search('JP', '81.3')).items.map(i => i.n)).toEqual(['J-Wave 81.3']); expect((await b.search('US', '97.5')).items.map(i => i.n)).toEqual(['Radio 97.5']);
    const g = await b.search('', '97.5'); expect(g.items.map(i => i.n).sort()).toEqual(['97.5 Alpha', '97.5 Beta FM', 'Radio 97.5']);
    expect((await b.search('DE', 'x')).error).toBe('bad-frequency');
  });
  test('scanner: the frequencies of a range that have stations, sorted, from ONE cached country read (no request per frequency)', async () => {
    const b = make(); const r = await b.scan('DE', '90', '98'); expect(r.found.map(x => x.f)).toEqual([90.3, 95.8, 97.5]); expect(r.found[2].items).toHaveLength(2); expect(r.total).toBe(4);
    await b.scan('DE', '80', '110'); await b.search('DE', '95.8'); expect(calls.filter(p => p.includes('countrycode=DE'))).toHaveLength(1);
    expect((await b.scan('', '90', '98')).error).toBe('country-required'); expect((await b.scan('DE', '98', '90')).error).toBe('bad-range');
  });
});
describe('handler + check', () => {
  const ev = (qs, h = {}) => ({ httpMethod: 'GET', queryStringParameters: qs, headers: h });
  test('?browse=countries gives the player country from the platform header; freq and scan answer; garbage is refused', async () => {
    radio.__setBrowser(make());
    const c = JSON.parse((await radio.handler(ev({ browse: 'countries' }, { 'x-vercel-ip-country': 'jp' }))).body); expect(c.mine).toBe('JP'); expect(c.countries).toHaveLength(2);
    expect(JSON.parse((await radio.handler(ev({ browse: 'freq', cc: 'DE', f: '95.8' }))).body).items).toHaveLength(1);
    expect(JSON.parse((await radio.handler(ev({ browse: 'scan', cc: 'DE', from: '90', to: '99' }))).body).found.length).toBe(3);
    expect((await radio.handler(ev({ browse: 'nope' }))).statusCode).toBe(400);
    radio.__setBrowser(null);
  });
  test('POST check validates one stream, saves nothing, never opens private addresses, and gives one of the six states', async () => {
    radio.__setValidator(async url => url.includes('good') ? { ok: true, url, codec: 'MP3' } : url.includes('html') ? { ok: false, why: 'html' } : { ok: false, why: 'unreachable' });
    const post = async u => JSON.parse((await radio.handler({ httpMethod: 'POST', headers: { 'x-forwarded-for': '9.9.9.' + Math.floor(Math.random() * 200) }, body: JSON.stringify({ action: 'check', u }) })).body);
    expect((await post('https://good.example.com/s')).state).toBe('VALID'); expect((await post('https://html.example.com/s')).state).toBe('NO AUDIO'); expect((await post('https://down.example.com/s')).state).toBe('OFFLINE');
    expect((await post('http://127.0.0.1/s')).ok).toBe(false); expect((await post('http://169.254.169.254/latest')).ok).toBe(false);
    radio.__setValidator(null);
  });
  test('fast CHECK (before PLAY): ~1.5 s read, no page resolving for an address the server returned, answers reused (10 min ok / 1 min failed), other addresses still resolved', async () => {
    radio.__resetCheckCache(); let calls = 0, lastOpts = null;
    radio.__setBrowser({ lookup: key => (key === validate.canonicalStream('https://known.example.com/live') ? { n: 'K', u: 'https://known.example.com/live' } : null) });
    radio.__setValidator(async (url, opts) => { calls++; lastOpts = opts; return url.includes('dead') ? { ok: false, why: 'unreachable' } : { ok: true, url, codec: 'MP3' }; });
    const post = (u, ip, fast = true) => radio.handler({ httpMethod: 'POST', headers: { 'x-forwarded-for': ip }, body: JSON.stringify({ action: 'check', u, fast }) }).then(r => JSON.parse(r.body));
    const a = await post('https://known.example.com/live', '1.0.0.1'); expect(a).toMatchObject({ ok: true, state: 'VALID' }); expect(lastOpts.durationMs).toBe(1500); expect(typeof lastOpts.resolve).toBe('function');
    const b = await post('https://known.example.com/live', '1.0.0.2'); expect(b.cached).toBe(true); expect(calls).toBe(1);
    const c = await post('https://other.example.com/live', '1.0.0.3'); expect(c.ok).toBe(true); expect(lastOpts.resolve).toBeUndefined(); expect(lastOpts.durationMs).toBe(1500);
    expect(await post('https://dead.example.com/x', '1.0.0.4')).toMatchObject({ ok: false, state: 'OFFLINE' }); expect((await post('https://dead.example.com/x', '1.0.0.5')).cached).toBe(true);
    const LONG = 'https://long.example.com/live?token=' + 'x'.repeat(900); radio.__setBrowser({ lookup: key => (key === validate.canonicalStream(LONG) ? { n: 'L', u: LONG } : null) });
    expect(await post(LONG, '1.0.0.7')).toMatchObject({ ok: true, state: 'VALID' }); expect(lastOpts.maxUrl).toBe(4000);   // a long directory address is checked (the server uses its own record)
    expect((await post('https://nobody.example.com/live?t=' + 'y'.repeat(900), '1.0.0.8')).ok).toBe(false);   // a long address the server never returned is refused
    radio.__setBrowser({ lookup: key => (key === validate.canonicalStream('https://known.example.com/live') ? { n: 'K', u: 'https://known.example.com/live' } : null) });
    await post('https://known.example.com/live', '1.0.0.6', false); expect(lastOpts.durationMs).toBe(5000);   // the normal check keeps the full read
    radio.__setBrowser(null); radio.__setValidator(null);
  });
  test('stateOf covers the six states', () => {
    const s = validate.stateOf; expect(s({ ok: true })).toBe('VALID'); expect(s({ ok: true, warnings: ['x'] })).toBe('DEGRADED'); expect(s({ ok: false, why: 'unreachable' })).toBe('OFFLINE'); expect(s({ ok: false, why: 'not-audio' })).toBe('NO AUDIO'); expect(s({ ok: false, why: 'x', hls: true })).toBe('UNSUPPORTED'); expect(s({ ok: false, why: 'blocked' })).toBe('INVALID');
  });
});
