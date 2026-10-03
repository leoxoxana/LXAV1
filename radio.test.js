jest.mock('./functions/firebase-storage.js', () => ({ getRadioCache: async () => null, saveRadioCache: async () => {} }));
const radio = require('./functions/radio.js');

let n = 0;
const st = (over = {}) => { n++; return { stationuuid: 'u' + n, name: 'Station ' + n, url_resolved: 'https://s' + n + '.example.ro/live', codec: 'MP3', bitrate: 128, lastcheckok: 1, hls: 0, ssl_error: 0, countrycode: 'RO', tags: 'pop', clickcount: 100 + n, votes: 10, ...over }; };

describe('station filter', () => {
  test('only HTTPS, MP3/AAC, direct, checked-ok streams are usable', () => {
    expect(radio.usable(st())).toBe(true);
    expect(radio.usable(st({ codec: 'AAC+' }))).toBe(true);
    expect(radio.usable(st({ url_resolved: 'http://plain.example.ro/live' }))).toBe(false);
    expect(radio.usable(st({ url_resolved: 'https://x.example.ro/list.pls' }))).toBe(false);
    expect(radio.usable(st({ url_resolved: 'https://x.example.ro/list.m3u8' }))).toBe(false);
    expect(radio.usable(st({ codec: 'FLV' }))).toBe(false);
    expect(radio.usable(st({ hls: 1 }))).toBe(false);
    expect(radio.usable(st({ lastcheckok: 0 }))).toBe(false);
    expect(radio.usable(st({ ssl_error: 1 }))).toBe(false);
    expect(radio.usable(st({ url_resolved: '', url: 'https://fallback.example.ro/a' }))).toBe(true);
  });
  test('categories: tech house is not house, "populara" is not pop, news never enters music', () => {
    const cat = id => radio.CATEGORIES.find(c => c.id === id);
    expect(radio.inCategory(cat('house'), st({ tags: 'deep house' }))).toBe(true);
    expect(radio.inCategory(cat('house'), st({ tags: 'tech house' }))).toBe(false);
    expect(radio.inCategory(cat('techno'), st({ tags: 'tech house' }))).toBe(true);
    expect(radio.inCategory(cat('pop'), st({ tags: 'populară' }))).toBe(false);
    expect(radio.inCategory(cat('manele'), st({ tags: 'manele,petrecere' }))).toBe(true);
    expect(radio.inCategory(cat('pop'), st({ tags: 'pop,news' }))).toBe(false);
    expect(radio.inCategory(cat('rap'), st({ name: 'Radio Hip-Hop RO', tags: '' }))).toBe(true);
    expect(radio.inCategory(cat('chill'), st({ tags: 'lounge' }))).toBe(true);
    expect(radio.inCategory(cat('rock'), st({ tags: 'classic rock' }))).toBe(true);
    expect(radio.inCategory(cat('dance'), st({ tags: 'electronic' }))).toBe(false);   // "electronic" belongs to techno, not dance
  });
});

describe('buildList', () => {
  const run = (ro, foreign = [], probe = async () => true) => radio.buildList({ fetchRo: async () => ro, fetchRoAll: async () => [], fetchForeign: async () => foreign, probe, now: Date.now });
  const items = (data, id) => data.cats.find(c => c.id === id).items;

  test('each category gets only its own stations; broken streams (failed probe) are dropped', async () => {
    const good = st({ name: 'Manele Live', tags: 'manele' }), dead = st({ name: 'Manele Dead', tags: 'manele' }), rock = st({ name: 'Rock One', tags: 'rock' });
    const data = await run([good, dead, rock], [], async url => url !== dead.url_resolved);
    expect(items(data, 'manele').map(i => i.n)).toEqual(['Manele Live']);
    expect(items(data, 'rock').map(i => i.n)).toEqual(['Rock One']);
    expect(items(data, 'rap')).toEqual([]);
    expect(data.cats.map(c => c.id)).toEqual(['manele', 'rap', 'house', 'techno', 'dance', 'pop', 'rock', 'chill']);
  });
  test('duplicates (same stream or same name) appear once per category; best-scored first', async () => {
    const a = st({ name: 'Kiss FM', tags: 'pop', clickcount: 5000 }), same = { ...a, stationuuid: 'other', name: 'Kiss FM (2)' }, nameTwin = st({ name: 'KISS  FM!', tags: 'pop', clickcount: 1 });
    const data = await run([nameTwin, a, same]);
    const list = items(data, 'pop');
    expect(list).toHaveLength(1);
    expect(list[0].n).toBe('Kiss FM');
  });
  test('names are cleaned (no tags / control characters) and urls are https only', async () => {
    const data = await run([st({ name: '<img src=x onerror=alert(1)>Pop\u0007 Radio', tags: 'pop' })]);
    const item = items(data, 'pop')[0];
    expect(item.n.includes("<") || item.n.includes(">") || item.n.includes(String.fromCharCode(7))).toBe(false);
    expect(item.u).toMatch(/^https:\/\//);
    expect(item.cc).toBe('RO');
  });
  test('non-Romanian stations in the Romanian queries are ignored', async () => {
    const data = await run([st({ tags: 'pop', countrycode: 'DE', name: 'German Pop' })]);
    expect(items(data, 'pop')).toEqual([]);
  });
  test('a category with fewer than 10 Romanian stations is topped up with a few top-voted foreign ones (max 6, probed, flagged)', async () => {
    const ro = [st({ tags: 'rap', name: 'RO Rap 1' }), st({ tags: 'rap', name: 'RO Rap 2' })];
    const foreign = Array.from({ length: 12 }, (_, i) => st({ tags: 'hip hop', countrycode: 'US', name: 'US Hip Hop ' + i, votes: 1000 - i * 10 }));
    foreign[0] = { ...foreign[0], url_resolved: 'https://dead.example.com/x' };
    const data = await run(ro, foreign, async url => !url.includes('dead.example.com'));
    const list = items(data, 'rap'), outside = list.filter(i => i.cc !== 'RO');
    expect(list.slice(0, 2).every(i => i.cc === 'RO')).toBe(true);
    expect(outside.length).toBe(6);
    expect(outside.every(i => i.cc === 'US')).toBe(true);
    expect(outside.some(i => i.n === 'US Hip Hop 0')).toBe(false);   // the dead one is skipped
    expect(outside[0].n).toBe('US Hip Hop 1');                       // most votes first
  });
  test('manele is never topped up from abroad, and a category with 10+ Romanian stations gets no foreign ones', async () => {
    const popRo = Array.from({ length: 12 }, (_, i) => st({ tags: 'pop', name: 'RO Pop ' + i }));
    const data = await run(popRo, [st({ tags: 'pop', countrycode: 'GB', votes: 5000 })]);
    expect(items(data, 'pop').every(i => i.cc === 'RO')).toBe(true);
    expect(items(data, 'manele')).toEqual([]);
  });
});

describe('getList (cache, outage)', () => {
  const big = (at, name = 'A') => ({ updatedAt: at, cats: [{ id: 'pop', emoji: '🎵', label: 'POP', items: Array.from({ length: 12 }, (_, i) => ({ n: name + i, u: 'https://x.example.ro/' + i, c: 'MP3', b: 128, cc: 'RO' })) }] });
  beforeEach(() => radio.__resetMemory());

  test('a fresh list is served without rebuilding; an old one is rebuilt', async () => {
    let builds = 0; const build = async () => { builds++; return big(Date.now()); };
    const first = await radio.getList({ build }); const second = await radio.getList({ build });
    expect(builds).toBe(1); expect(second.stale).toBe(false); expect(first.data.cats[0].items).toHaveLength(12);
    const later = () => Date.now() + 13 * 3600 * 1000;
    await radio.getList({ build, now: later }); expect(builds).toBe(2);
  });
  test('Radio Browser down: the last good list is served (stale), the player never empties', async () => {
    await radio.getList({ build: async () => big(Date.now(), 'Good') });
    const result = await radio.getList({ build: async () => { throw new Error('down'); }, now: () => Date.now() + 13 * 3600 * 1000 });
    expect(result.stale).toBe(true); expect(result.data.cats[0].items[0].n).toBe('Good0');
  });
  test('no cache and Radio Browser down: error, nothing invented', async () => {
    await expect(radio.getList({ build: async () => { throw new Error('down'); } })).rejects.toThrow();
  });
  test('a build with almost no stations is rejected and does not replace the good list', async () => {
    await radio.getList({ build: async () => big(Date.now(), 'Good') });
    const result = await radio.getList({ build: async () => ({ updatedAt: Date.now(), cats: [] }), now: () => Date.now() + 13 * 3600 * 1000 });
    expect(result.stale).toBe(true); expect(result.data.cats[0].items[0].n).toBe('Good0');
  });
  test('simultaneous first requests share a single build', async () => {
    let builds = 0; const build = async () => { builds++; await new Promise(r => setTimeout(r, 20)); return big(Date.now()); };
    await Promise.all([radio.getList({ build }), radio.getList({ build }), radio.getList({ build })]);
    expect(builds).toBe(1);
  });
  test('?refresh=1 cannot rebuild more often than every 30 minutes', async () => {
    let builds = 0; const build = async () => { builds++; return big(Date.now()); };
    await radio.getList({ build }); await radio.getList({ build, refresh: true });
    expect(builds).toBe(1);
    await radio.getList({ build, refresh: true, now: () => Date.now() + 31 * 60 * 1000 });
    expect(builds).toBe(2);
  });
});

describe('handler', () => {
  beforeEach(() => radio.__resetMemory());
  test('only GET; OPTIONS allowed', async () => {
    expect((await radio.handler({ httpMethod: 'POST' })).statusCode).toBe(405);
    expect((await radio.handler({ httpMethod: 'OPTIONS' })).statusCode).toBe(200);
  });
  test('without any list and with Radio Browser unreachable: 503, no-store', async () => {
    const original = global.fetch; global.fetch = async () => { throw new Error('offline'); };
    try { const res = await radio.handler({ httpMethod: 'GET', queryStringParameters: {} }); expect(res.statusCode).toBe(503); expect(res.headers['cache-control']).toBe('no-store'); }
    finally { global.fetch = original; }
  });
});

describe('best two categories + moderation', () => {
  test('a station tagged for five genres appears in at most its best two categories', () => {
    const many = st({ name: 'Pescobar Radio', tags: 'afro house,house,deep house,techno,dance,chill,lounge' });
    const ids = radio.topCategories(many);
    expect(ids.length).toBeLessThanOrEqual(2);
    expect(ids[0]).toBe('house');   // house has the strongest tag signal (exact "house" and "deep house")
  });
  test('a station with one clear genre stays in exactly one category', () => {
    expect(radio.topCategories(st({ tags: 'manele,petrecere', name: 'Radio Manele' }))).toEqual(['manele']);
    expect(radio.topCategories(st({ tags: 'news,talk', name: 'Stiri Radio' }))).toEqual([]);
  });
  test('buildList really applies the limit: the multi-genre station is in at most two lists', async () => {
    const many = st({ name: 'Everything FM', tags: 'house,techno,dance,chill,pop,rock' });
    const data = await radio.buildList({ fetchRo: async () => [many], fetchRoAll: async () => [], fetchForeign: async () => [], probe: async () => true });
    expect(data.cats.filter(c => c.items.some(i => i.n === 'Everything FM')).length).toBeLessThanOrEqual(2);
  });
  test('RADIO_HIDE hides stations by name without touching code', () => {
    process.env.RADIO_HIDE = 'bad radio, spam';
    try { expect(radio.usable(st({ name: 'My BAD Radio' }))).toBe(false); expect(radio.usable(st({ name: 'Good Radio' }))).toBe(true); }
    finally { delete process.env.RADIO_HIDE; }
    expect(radio.usable(st({ name: 'My BAD Radio' }))).toBe(true);
  });
});
