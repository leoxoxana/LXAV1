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

describe('http-only stations: the https twin is probed', () => {
  const run = (ro, probe) => radio.buildList({ fetchRo: async () => ro, fetchRoAll: async () => [], fetchForeign: async () => [], probe, now: Date.now });
  const items = (data, id) => data.cats.find(c => c.id === id).items;
  const plain = (over = {}) => st({ url_resolved: 'http://live.example.ro:8132/stream', tags: 'manele', name: 'Trapanele Radio', ...over });

  test('upgradable(): only a plain-http station that would be fine over https', () => {
    expect(radio.upgradable(plain())).toBe(true);
    expect(radio.upgradable(plain({ lastcheckok: 0 }))).toBe(false);
    expect(radio.upgradable(plain({ codec: 'FLV' }))).toBe(false);
    expect(radio.upgradable(st())).toBe(false);   // already https
    expect(radio.upgraded(plain()).url_resolved).toBe('https://live.example.ro:8132/stream');
  });
  test('an http-only station whose https twin delivers audio is listed WITH the https url', async () => {
    const data = await run([plain()], async url => url === 'https://live.example.ro:8132/stream');
    expect(items(data, 'manele').map(i => i.u)).toEqual(['https://live.example.ro:8132/stream']);
  });
  test('an http-only station whose https twin does not answer is dropped; an http url never reaches the player', async () => {
    const data = await run([plain(), st({ tags: 'manele', name: 'Fine Manele' })], async url => url.startsWith('https://s'));
    const all = data.cats.flatMap(c => c.items);
    expect(all.some(i => i.n === 'Trapanele Radio')).toBe(false);
    expect(all.every(i => /^https:\/\//.test(i.u))).toBe(true);
    expect(items(data, 'manele').map(i => i.n)).toEqual(['Fine Manele']);
  });
});

describe('pinned words', () => {
  test('a "trapanele" station with no clicks is probed and listed even when many better-scored manele stations exist', async () => {
    const crowd = Array.from({ length: 80 }, (_, i) => st({ name: 'Manele Crowd ' + i, tags: 'manele', clickcount: 5000 - i }));
    const tiny = st({ name: 'Trapanele Radio', tags: 'manele', clickcount: 0, votes: 1, url_resolved: 'http://live.example.ro:8132/stream' });
    const data = await radio.buildList({ fetchRo: async () => [...crowd, tiny], fetchRoAll: async () => [], fetchForeign: async () => [], probe: async () => true, now: Date.now });
    const manele = data.cats.find(c => c.id === 'manele').items;
    expect(manele.some(i => i.n === 'Trapanele Radio' && i.u === 'https://live.example.ro:8132/stream')).toBe(true);
  });
});

describe('second chance for failed probes', () => {
  test('a healthy station that fails the first probe under load is listed after the second try; a really dead one stays out', async () => {
    const slow = st({ name: 'Slow Manele', tags: 'manele' }), dead = st({ name: 'Dead Manele', tags: 'manele' });
    const calls = {};
    const probe = async url => { calls[url] = (calls[url] || 0) + 1; if (url === dead.url_resolved) return false; return calls[url] >= 2; };   // slow: fails once, then answers
    const data = await radio.buildList({ fetchRo: async () => [slow, dead], fetchRoAll: async () => [], fetchForeign: async () => [], probe, now: Date.now });
    const names = data.cats.find(c => c.id === 'manele').items.map(i => i.n);
    expect(names).toEqual(['Slow Manele']);
    expect(calls[dead.url_resolved]).toBe(2);   // tried twice, then given up
  });
});

describe('styles of manele', () => {
  const run = ro => radio.buildList({ fetchRo: async () => ro, fetchRoAll: async () => [], fetchForeign: async () => [], probe: async () => true, now: Date.now });
  const manele = data => data.cats.find(c => c.id === 'manele').items;
  test('styleOf recognises old / new / trap / etno / folk from tags and names', () => {
    expect(radio.styleOf(st({ tags: 'hip-hop,manele,rap,trap' }))).toContain('trap');
    expect(radio.styleOf(st({ tags: 'club,dance,manele' }))).toContain('trap');
    expect(radio.styleOf(st({ name: 'Tehno Manele Live', tags: 'manele' }))).toContain('trap');
    expect(radio.styleOf(st({ tags: 'manele noi' }))).toContain('new');
    expect(radio.styleOf(st({ name: 'Radio Manele Vechi', tags: 'manele' }))).toContain('old');
    expect(radio.styleOf(st({ tags: 'etno,manele' }))).toContain('etno');
    expect(radio.styleOf(st({ name: 'Taraf Romania - Radio Manele', tags: 'manele' }))).toContain('etno');
    expect(radio.styleOf(st({ tags: 'manele,petrecere' }))).toEqual([]);
  });
  test('folk: "muzica populara" / folclor yes; the party tag "populara" alone no; multi-genre stations no', () => {
    expect(radio.isFolk(st({ name: 'Radio Folclor', tags: 'folclor,folk,petrecere' }))).toBe(true);
    expect(radio.isFolk(st({ name: 'Antena Satelor', tags: 'muzică populară,news' }))).toBe(true);
    expect(radio.isFolk(st({ name: 'Super Popular', tags: 'petrecere,populară' }))).toBe(true);
    expect(radio.isFolk(st({ name: 'Super FM', tags: 'manele,petrecere,populară' }))).toBe(false);
    expect(radio.isFolk(st({ name: 'Everything', tags: 'a,b,c,d,e,f,g,h,folclor' }))).toBe(false);
    expect(radio.isFolk(st({ name: 'Radio Folclor', tags: 'folclor,folk,muzică de petrecere,muzică populară,muzică românească,petrecere,pop,populară,romanian' }))).toBe(true);   // many tags, but the name says folclor
  });
  test('buildList: style codes (s) are listed for MANELE and plain manele carry none; no station is hidden', async () => {
    const data = await run([st({ name: 'Ade FM', tags: 'hip-hop,manele,rap,trap' }), st({ name: 'Radio Folclor', tags: 'folclor,folk,petrecere,populară' }), st({ name: 'Antena Satelor', tags: 'muzică populară,radio public' }), st({ name: 'Plain Manele', tags: 'manele,petrecere' })]);
    const byName = Object.fromEntries(manele(data).map(i => [i.n, i]));
    expect(byName['Ade FM'].s).toContain('trap');
    expect(byName['Radio Folclor'].s).toContain('folk');
    expect(byName['Antena Satelor'].s).toContain('folk');   // folk-only stations that work are still listed (at the bottom)
    expect(byName['Plain Manele'].s).toBeUndefined();
    expect(manele(data).some(i => i.h)).toBe(false);
  });
  test('TASTE ORDER: trap / techno first, new next, manele, party-only (no word manele), folk and ethno LAST; nothing removed; the quality order is kept inside a tier', async () => {
    const data = await run([
      st({ name: 'Folk A', tags: 'folclor,petrecere', clickcount: 9000 }), st({ name: 'Etno B', tags: 'etno,manele', clickcount: 8000 }),
      st({ name: 'Plain C', tags: 'manele,petrecere', clickcount: 7000 }), st({ name: 'Plain D', tags: 'manele', clickcount: 6000 }),
      st({ name: 'New E', tags: 'manele noi', clickcount: 5000 }), st({ name: 'Old F', tags: 'manele vechi', clickcount: 4000 }),
      st({ name: 'Trap G', tags: 'manele,trap', clickcount: 100 }), st({ name: 'Club H', tags: 'manele,club', clickcount: 50 }),
      st({ name: 'Club Etno I', tags: 'manele,club,etno', clickcount: 10 }), st({ name: 'Party Z', tags: 'petrecere,populară', clickcount: 3000 })
    ]);
    expect(manele(data).map(i => i.n)).toEqual(['Trap G', 'Club H', 'Club Etno I', 'New E', 'Plain C', 'Plain D', 'Old F', 'Party Z', 'Folk A', 'Etno B']);
  });
  test('the 🔥 top flag marks the three best by quality, not the first three after the taste order', async () => {
    const data = await run([st({ name: 'Plain Big', tags: 'manele', clickcount: 9000 }), st({ name: 'Plain Mid', tags: 'manele', clickcount: 8000 }), st({ name: 'Plain Two', tags: 'manele', clickcount: 7000 }), st({ name: 'Plain Four', tags: 'manele', clickcount: 6000 }), st({ name: 'Trap Tiny', tags: 'manele,trap', clickcount: 1 })]);
    const list = manele(data);
    expect(list[0].n).toBe('Trap Tiny');                                 // first by taste ...
    expect(list.filter(i => i.top).map(i => i.n).sort()).toEqual(['Plain Big', 'Plain Mid', 'Plain Two']);   // ... but not "top"
  });
  test('style codes exist only in MANELE: the same station in another category carries none', async () => {
    const data = await run([st({ name: 'Club Pop', tags: 'club,pop' })]);
    for (const c of data.cats) for (const i of c.items) expect(i.s).toBeUndefined();
  });
});

describe('MANELE keeps every working manele station', () => {
  const run = ro => radio.buildList({ fetchRo: async () => ro, fetchRoAll: async () => [], fetchForeign: async () => [], probe: async () => true, now: Date.now });
  test('100 manele stations are all listed (no small cap), also the ones that are tagged for other genres too', async () => {
    const plain = Array.from({ length: 100 }, (_, i) => st({ name: 'Manele Radio ' + i, tags: 'manele', clickcount: 1000 - i }));
    const data = await run(plain);
    expect(data.cats.find(c => c.id === 'manele').items).toHaveLength(100);
  });
  test('a station that says manele stays in MANELE even when two other genres score higher', async () => {
    const busy = st({ name: 'Club House Manele', tags: 'manele,dance,club,house,deep house' });
    expect(radio.topCategories(busy)).toContain('manele');
    const data = await run([busy]);
    expect(data.cats.find(c => c.id === 'manele').items.map(i => i.n)).toContain('Club House Manele');
  });
  test('explicit manele (word in tags or name) is flagged m; a party-only station is not', async () => {
    const data = await run([st({ name: 'Real Manele', tags: 'manele' }), st({ name: 'Party Only', tags: 'petrecere,populară' })]);
    const by = Object.fromEntries(data.cats.find(c => c.id === 'manele').items.map(i => [i.n, i]));
    expect(by['Real Manele'].m).toBe(1); expect(by['Party Only'].m).toBeUndefined();
  });
  test('electro / house / minimal / techno manele count as the trap tier', () => {
    for (const tags of ['manele,electro', 'manele,house', 'manele,minimal', 'manele,techno', 'manele,tehno']) expect(radio.styleOf(st({ tags }))).toContain('trap');
  });
});
