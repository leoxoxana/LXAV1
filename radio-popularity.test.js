// popularity from outside the site: parsers of the stats pages of stream servers, the phase that collects them, the score
const pop = require('./functions/radio-popularity.js');

describe('stats pages of the stream servers', () => {
  test('Shoutcast v2 JSON (/stats?sid=1&json=1)', () => { expect(pop.parseShoutcastJson('{"currentlisteners":124,"peaklisteners":318,"maxlisteners":1000}')).toEqual({ now: 124, peak: 318 }); expect(pop.parseShoutcastJson('{"x":1}')).toBeNull(); expect(pop.parseShoutcastJson('<html>')).toBeNull(); });
  test('Shoutcast v2 XML', () => { expect(pop.parseShoutcastXml('<?xml version="1.0"?><SHOUTCASTSERVER><CURRENTLISTENERS>623</CURRENTLISTENERS><PEAKLISTENERS>1527</PEAKLISTENERS></SHOUTCASTSERVER>')).toEqual({ now: 623, peak: 1527 }); expect(pop.parseShoutcastXml('nothing')).toBeNull(); });
  test('Shoutcast v1 7.html', () => { expect(pop.parseShoutcast7('<html><body>45,1,120,500,40,128,Some Song</body></html>')).toEqual({ now: 45, peak: 120 }); expect(pop.parseShoutcast7('<html><body>Not found</body></html>')).toBeNull(); });
  test('Icecast status-json.xsl: the mount of the stream, or all mounts together when it is not found; one source (object) or many (array)', () => {
    const two = JSON.stringify({ icestats: { source: [{ listenurl: 'https://h/live', listeners: 12, listener_peak: 40 }, { listenurl: 'https://h/other', listeners: 5, listener_peak: 9 }] } });
    expect(pop.parseIcecast(two, '/live')).toEqual({ now: 12, peak: 40 }); expect(pop.parseIcecast(two, '/missing')).toEqual({ now: 17, peak: 49 });
    expect(pop.parseIcecast(JSON.stringify({ icestats: { source: { listenurl: 'https://h/a', listeners: 3, listener_peak: 4 } } }), '/a')).toEqual({ now: 3, peak: 4 });
    expect(pop.parseIcecast('{"icestats":{}}', '/a')).toBeNull(); expect(pop.parseIcecast('junk', '/a')).toBeNull();
  });
  test('statsUrls: the usual places, also next to a /8016/stream style path', () => {
    const list = pop.statsUrls('https://h.example.ro:8000/8016/stream').map(c => c.u);
    expect(list).toContain('https://h.example.ro:8000/status-json.xsl'); expect(list).toContain('https://h.example.ro:8000/stats?sid=1&json=1'); expect(list).toContain('https://h.example.ro:8000/8016/stats?sid=1&json=1'); expect(pop.statsUrls('not a url')).toEqual([]);
  });
});

describe('collecting listeners', () => {
  test('fetchListeners tries the places in order and stops at the first that parses', async () => {
    const asked = []; const get = async url => { asked.push(url); return /sid=1&json=1$/.test(url) && !/\/8016\//.test(url) ? '{"currentlisteners":7,"peaklisteners":9}' : null; };
    expect(await pop.fetchListeners('https://h.example.ro/stream', get)).toEqual({ now: 7, peak: 9 }); expect(asked.length).toBeLessThanOrEqual(2);
  });
  test('a host that publishes nothing is skipped after two misses; a host that answered keeps being asked; the whole phase has a time budget', async () => {
    const urls = ['https://a.ro/1', 'https://a.ro/2', 'https://a.ro/3', 'https://a.ro/4', 'https://b.ro/1', 'https://b.ro/2'];
    const asked = new Set(); const get = async url => { asked.add(new URL(url).host); return /^https:\/\/b\.ro/.test(url) && /status-json/.test(url) ? JSON.stringify({ icestats: { source: { listenurl: 'x', listeners: 5, listener_peak: 6 } } }) : null; };
    const out = await pop.collectListeners(urls, { get, width: 1 });
    expect([...out.keys()].sort()).toEqual(['https://b.ro/1', 'https://b.ro/2']);
    let t = 0; const slow = await pop.collectListeners(urls, { get: async () => null, now: () => (t += 4000), budgetMs: 6000, width: 1 }); expect(slow.size).toBe(0);
  });
});

describe('the score', () => {
  test('votes and listeners count on a log scale: 700 votes beat 2 votes, 600 listeners beat 20 votes, the peak counts a third', () => {
    expect(pop.popularity({ votes: 700 })).toBeGreaterThan(pop.popularity({ votes: 2 }));
    expect(pop.popularity({ votes: 0 }, { now: 600, peak: 1500 })).toBeGreaterThan(pop.popularity({ votes: 20 }));
    expect(pop.popularity({ votes: 0 }, { now: 0, peak: 900 })).toBeCloseTo(pop.popularity({ votes: 0 }, { now: 300, peak: 0 }), 5);
  });
  test('missing numbers are zero, never NaN; a decent bitrate adds a little', () => {
    expect(Number.isFinite(pop.popularity({}))).toBe(true); expect(Number.isFinite(pop.popularity({ votes: 'x', clickcount: null }, { now: 'a' }))).toBe(true);
    expect(pop.popularity({ votes: 5, bitrate: 128 })).toBeGreaterThan(pop.popularity({ votes: 5, bitrate: 32 }));
  });
});
