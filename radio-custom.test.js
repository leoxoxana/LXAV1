// stations of the players: the guard against reaching private networks, link cleaning, playlist / page parsing, the resolver (no network: fetch and DNS are stubbed)
const c = require('./functions/radio-custom.js');

const PUBLIC = async () => [{ address: '93.184.216.34', family: 4 }];
// a fake fetch: routes[url] = {status, type, body (string | Buffer), headers, location}
const fakeFetch = routes => async (url, options) => {
  const r = routes[url]; if (!r) throw Object.assign(new Error('unreachable'), { name: 'TypeError' });
  const buf = Buffer.isBuffer(r.body) ? r.body : Buffer.from(r.body || ''), headers = { 'content-type': r.type || '', ...(r.headers || {}) }; if (r.location) headers.location = r.location;
  let sent = false;
  return { status: r.status || 200, ok: (r.status || 200) < 400, headers: { get: name => headers[String(name).toLowerCase()] ?? null }, body: { getReader: () => ({ read: async () => { if (sent) return { done: true }; sent = true; return { value: new Uint8Array(buf), done: false }; }, cancel: () => {} }), cancel: () => {} } };
};
const AUDIO = Buffer.alloc(3000, 0x49);
const audio = (type = 'audio/mpeg', headers = {}) => ({ type, body: AUDIO, headers });
const run = (input, routes) => c.resolveStation(input, { lookup: PUBLIC, fetchFn: fakeFetch(routes) });

describe('addresses that must never be reached', () => {
  test('private, loopback, link-local (cloud metadata), carrier-grade NAT and unique-local addresses are refused, public ones pass', () => {
    for (const ip of ['10.1.2.3', '192.168.0.1', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.1', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1', 'nonsense']) expect(c.privateIp(ip)).toBe(true);
    for (const ip of ['8.8.8.8', '93.184.216.34', '172.32.0.1', '100.63.0.1', '2606:4700::1111']) expect(c.privateIp(ip)).toBe(false);
  });
  test('assertPublic: every address the name resolves to must be public; localhost / .local / .internal / DNS failure are refused', async () => {
    expect(await c.assertPublic('radio.example.ro', PUBLIC)).toBe(true);
    expect(await c.assertPublic('evil.example', async () => [{ address: '93.184.216.34' }, { address: '10.0.0.5' }])).toBe(false);   // one private answer is enough to refuse
    expect(await c.assertPublic('evil.example', async () => [{ address: '169.254.169.254' }])).toBe(false);
    for (const host of ['localhost', 'x.localhost', 'printer.local', 'db.internal', '', '127.0.0.1', '[::1]']) expect(await c.assertPublic(host, PUBLIC)).toBe(false);
    expect(await c.assertPublic('gone.example', async () => { throw new Error('ENOTFOUND'); })).toBe(false); expect(await c.assertPublic('8.8.8.8')).toBe(true);
  });
});

describe('cleaning what the player pasted', () => {
  test('a bare host gets https://, user:password@ and other protocols are refused, the fragment goes, too long is refused, private literals are refused', () => {
    expect(c.cleanStreamUrl('stream.example.ro/live')).toBe('https://stream.example.ro/live'); expect(c.cleanStreamUrl('  http://a.example.ro:8000/x#frag ')).toBe('http://a.example.ro:8000/x');
    for (const bad of ['', 'ftp://a.example.ro/x', 'javascript:alert(1)', 'https://user:pw@a.example.ro/x', 'https://a.example.ro:pw@b.ro/', 'http://127.0.0.1/x', 'http://10.0.0.1/x', 'https://localhost/x', 'https://x.local/a', 'https://a.example.ro/' + 'a'.repeat(500), null, undefined]) expect(c.cleanStreamUrl(bad)).toBe('');
  });
  test('hasQuery tells links that carry a token / query', () => { expect(c.hasQuery('https://a.ro/s?token=abc')).toBe(true); expect(c.hasQuery('https://a.ro/s')).toBe(false); });
});

describe('the guarded fetch', () => {
  test('a redirect to a private address (cloud metadata) is blocked, also in the second hop; a public redirect is followed', async () => {
    const lookup = async name => [{ address: name === 'meta.example' ? '169.254.169.254' : '93.184.216.34' }];
    const evil = await c.safeFetch('https://a.example.ro/x', { lookup, fetchFn: fakeFetch({ 'https://a.example.ro/x': { status: 302, location: 'https://meta.example/latest' } }) }); expect(evil.error).toBe('blocked');
    const literal = await c.safeFetch('https://a.example.ro/x', { lookup, fetchFn: fakeFetch({ 'https://a.example.ro/x': { status: 301, location: 'http://169.254.169.254/' } }) }); expect(literal.error).toBe('bad-redirect');
    const ok = await c.safeFetch('https://a.example.ro/x', { lookup, fetchFn: fakeFetch({ 'https://a.example.ro/x': { status: 302, location: '/y' }, 'https://a.example.ro/y': { type: 'text/plain', body: 'hello' } }) }); expect(ok.bytes.toString()).toBe('hello'); expect(ok.url).toBe('https://a.example.ro/y');
  });
  test('more than 3 redirects, an http error, an unreachable host and a body larger than the limit are handled', async () => {
    const loop = { 'https://a.ro/1': { status: 302, location: '/2' }, 'https://a.ro/2': { status: 302, location: '/3' }, 'https://a.ro/3': { status: 302, location: '/4' }, 'https://a.ro/4': { status: 302, location: '/5' }, 'https://a.ro/5': { type: 'text/plain', body: 'x' } };
    expect((await c.safeFetch('https://a.ro/1', { lookup: PUBLIC, fetchFn: fakeFetch(loop) })).error).toBe('too-many-redirects');
    expect((await c.safeFetch('https://a.ro/n', { lookup: PUBLIC, fetchFn: fakeFetch({ 'https://a.ro/n': { status: 404 } }) })).error).toBe('http 404');
    expect((await c.safeFetch('https://a.ro/z', { lookup: PUBLIC, fetchFn: fakeFetch({}) })).error).toBe('unreachable');
    expect((await c.safeFetch('https://a.ro/big', { lookup: PUBLIC, maxBytes: 10, fetchFn: fakeFetch({ 'https://a.ro/big': { type: 'text/plain', body: 'x'.repeat(100) } }) })).bytes.length).toBe(10);
    expect((await c.safeFetch('http://127.0.0.1/', { fetchFn: fakeFetch({}) })).error).toBe('bad-url');
  });
});

describe('playlists and pages', () => {
  test('.pls: the File entries with their titles; .m3u with #EXTINF titles; .xspf; .asx', () => {
    expect(c.parsePlaylist('[playlist]\nNumberOfEntries=2\nFile1=http://a.ro:8000/live\nTitle1=Radio A\nFile2=https://b.ro/live\nTitle2=Radio B\nVersion=2')).toEqual({ urls: ['http://a.ro:8000/live', 'https://b.ro/live'], names: ['Radio A', 'Radio B'] });
    expect(c.parsePlaylist('#EXTM3U\n#EXTINF:-1,Radio C\nhttps://c.ro/live\n\n#EXTINF:-1,Radio D\nhttp://d.ro/x').urls).toEqual(['https://c.ro/live', 'http://d.ro/x']);
    expect(c.parsePlaylist('<playlist><trackList><track><location>https://e.ro/s</location></track></trackList></playlist>').urls).toEqual(['https://e.ro/s']);
    expect(c.parsePlaylist('<asx><entry><ref href="http://f.ro/s"/></entry></asx>').urls).toEqual(['http://f.ro/s']);
    expect(c.parsePlaylist('nothing useful here').urls).toEqual([]);
    expect(c.parsePlaylist('[playlist]\nFile1=javascript:alert(1)\nFile2=ftp://x/y').urls).toEqual([]);
  });
  test('a Shoutcast / Icecast server page: the audio and playlist links, absolute; the Shoutcast v1 /; mount; nothing else', () => {
    const html = '<html><body><a href="/listen.pls">Listen</a> <a href="stream.m3u">m3u</a> <a href="/admin.cgi">admin</a> <a href="javascript:x">js</a></body></html>';
    expect(c.pageLinks(html, 'https://h.example.ro:8000/')).toEqual(['https://h.example.ro:8000/listen.pls', 'https://h.example.ro:8000/stream.m3u']);
    expect(c.pageLinks('<title>SHOUTcast Server</title>', 'https://h.example.ro:8000/')).toContain('https://h.example.ro:8000/;');
  });
});

describe('resolveStation: what the player pasted becomes a stream that plays', () => {
  test('a direct stream: ok, the name from the server (icy-name), the codec from the content type, the ORIGINAL address (a tokenized redirect is not stored)', async () => {
    const r = await run('https://live.example.ro/radio.mp3', { 'https://live.example.ro/radio.mp3': audio('audio/mpeg', { 'icy-name': 'Radio Direct', 'icy-br': '128' }) });
    expect(r).toMatchObject({ ok: true, url: 'https://live.example.ro/radio.mp3', name: 'Radio Direct', codec: 'MP3', bitrate: 128, from: 'direct', iosOk: true });
    const red = await run('https://zeno.example.ro/abc', { 'https://zeno.example.ro/abc': { status: 302, location: 'https://node7.example.ro/abc?zt=TOKEN' }, 'https://node7.example.ro/abc?zt=TOKEN': audio('audio/aacp') });
    expect(red.ok).toBe(true); expect(red.url).toBe('https://zeno.example.ro/abc'); expect(red.codec).toBe('AAC');
  });
  test('an http link: its https twin is what plays; when only http answers: "http-only" (the browser would block it)', async () => {
    expect(await run('http://a.example.ro:8000/live', { 'https://a.example.ro:8000/live': audio() })).toMatchObject({ ok: true, url: 'https://a.example.ro:8000/live', upgraded: true });
    expect(await run('http://a.example.ro:8000/live', { 'http://a.example.ro:8000/live': audio() })).toEqual({ ok: false, why: 'http-only' });
  });
  test('a .pls playlist: the first candidate that really plays; http candidates are upgraded to https, others are skipped; the playlist name is used when the server sends none', async () => {
    const pls = '[playlist]\nFile1=http://dead.example.ro/live\nTitle1=Dead\nFile2=http://good.example.ro:8000/live\nTitle2=Good One\nFile3=https://spare.example.ro/live';
    const r = await run('https://p.example.ro/listen.pls', { 'https://p.example.ro/listen.pls': { type: 'audio/x-scpls', body: pls }, 'https://good.example.ro:8000/live': audio() });
    expect(r).toMatchObject({ ok: true, url: 'https://good.example.ro:8000/live', name: 'Good One', from: 'playlist', upgraded: true });
  });
  test('an .m3u whose streams are http only: "http-only"; an unreachable playlist stream: "unreachable"', async () => {
    expect(await run('https://p.example.ro/a.m3u', { 'https://p.example.ro/a.m3u': { type: 'audio/x-mpegurl', body: '#EXTM3U\nhttp://h.example.ro/live' } })).toEqual({ ok: false, why: 'http-only' });
    expect(await run('https://p.example.ro/a.m3u', { 'https://p.example.ro/a.m3u': { type: 'audio/x-mpegurl', body: '#EXTM3U\nhttps://gone.example.ro/live' } })).toEqual({ ok: false, why: 'unreachable' });
  });
  test('a server page (HTML): the playlist / stream it links to is followed', async () => {
    const r = await run('https://h.example.ro:8000/', { 'https://h.example.ro:8000/': { type: 'text/html', body: '<a href="/listen.pls">x</a>' }, 'https://h.example.ro:8000/listen.pls': { type: 'audio/x-scpls', body: '[playlist]\nFile1=https://h.example.ro:8000/stream' }, 'https://h.example.ro:8000/stream': audio('audio/aac') });
    expect(r).toMatchObject({ ok: true, url: 'https://h.example.ro:8000/stream', codec: 'AAC' });
  });
  test('HLS (.m3u8) is passed on, flagged (iPhone / Safari play it); ogg / flac are marked as not playable on iPhone', async () => {
    expect(await run('https://h.example.ro/live.m3u8', { 'https://h.example.ro/live.m3u8': { type: 'application/vnd.apple.mpegurl', body: '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=64000\nlow.m3u8' } })).toMatchObject({ ok: true, hls: true, codec: 'HLS', iosOk: true });
    expect(await run('https://h.example.ro/live.ogg', { 'https://h.example.ro/live.ogg': audio('audio/ogg') })).toMatchObject({ ok: true, codec: 'OGG', iosOk: false });
  });
  test('refused or failed: a web page without audio, a private / blocked host, a bad link, a 404, a page that is not audio behind an audio type', async () => {
    expect(await run('https://h.example.ro/page', { 'https://h.example.ro/page': { type: 'text/html', body: '<html>just a page</html>' } })).toEqual({ ok: false, why: 'not-audio' });
    expect(await c.resolveStation('https://sneaky.example/x', { lookup: async () => [{ address: '10.0.0.9' }], fetchFn: fakeFetch({}) })).toEqual({ ok: false, why: 'blocked' });
    expect(await run('http://127.0.0.1:8890/', {})).toEqual({ ok: false, why: 'bad-url' }); expect(await run('', {})).toEqual({ ok: false, why: 'bad-url' });
    expect(await run('https://h.example.ro/gone', { 'https://h.example.ro/gone': { status: 404 } })).toEqual({ ok: false, why: 'unreachable' });
    expect((await run('https://h.example.ro/fake.mp3', { 'https://h.example.ro/fake.mp3': { type: 'audio/mpeg', body: Buffer.from('<html>' + 'x'.repeat(3000)) } })).ok).toBe(false);
  });
});

describe('the suggestion node', () => {
  test('one count per device, the newest 30 devices kept, the first name wins', () => {
    let node = null; node = c.applySuggestion(node, { u: 'https://a.ro/s', n: 'First', device: 'd1' }, 1000); node = c.applySuggestion(node, { u: 'https://a.ro/s', n: 'Second', device: 'd1' }, 2000);
    expect(node).toMatchObject({ u: 'https://a.ro/s', n: 'First', count: 1, first: 1000, last: 2000 });
    node = c.applySuggestion(node, { u: 'https://a.ro/s', n: '', device: 'd2' }, 3000); expect(node.count).toBe(2);
    let big = null; for (let i = 0; i < 40; i++) big = c.applySuggestion(big, { u: 'https://a.ro/s', n: '', device: 'dev' + i }, 1000 + i); expect(Object.keys(big.devices)).toHaveLength(30); expect(big.count).toBe(40);
  });
});
