// RADIO VALIDATION: canonical identity (duplicates), real audio frames (MP3 / AAC / Ogg), the stream held open and timed, SSRF, the verdicts. No network: fetch and DNS are injected.
const v = require('./functions/radio-validate.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const mp3Frame = () => { const f = Buffer.alloc(417); f[0] = 0xff; f[1] = 0xfb; f[2] = 0x90; f[3] = 0x64; return f; };           // MPEG-1 layer 3, 128 kbit/s, 44100 Hz, joint stereo
const mp3 = (n = 30) => Buffer.concat(Array.from({ length: n }, mp3Frame));
const adtsFrame = () => { const f = Buffer.alloc(200); f[0] = 0xff; f[1] = 0xf1; f[2] = 0x50; f[3] = 0x80; f[4] = 25; f[5] = 0x1f; f[6] = 0xfc; return f; };   // AAC-LC, 44100 Hz, 2 channels, 200 bytes
const adts = (n = 30) => Buffer.concat(Array.from({ length: n }, adtsFrame));
const ogg = payload => { const page = Buffer.alloc(27 + 1 + payload.length); page.write('OggS', 0, 'latin1'); page[26] = 1; page[27] = payload.length; payload.copy(page, 28); return page; };
const opusHead = () => { const p = Buffer.alloc(19); p.write('OpusHead', 0, 'latin1'); p[8] = 1; p[9] = 2; p.writeUInt32LE(48000, 12); return p; };
const vorbisId = () => { const p = Buffer.alloc(30); p[0] = 1; p.write('vorbis', 1, 'latin1'); p.writeUInt32LE(0, 7); p[11] = 2; p.writeUInt32LE(44100, 12); p.writeInt32LE(128000, 20); return p; };

// a fake fetch: every call gets a fresh response; `chunks` arrive `gap` ms apart; `forever` repeats the last chunk (a live stream that never ends)
function respond({ type = 'audio/mpeg', status = 200, headers = {}, chunks = [mp3(10)], gap = 40, forever = true, location } = {}) {
  const all = { 'content-type': type, ...headers }; if (location) all.location = location;
  return { status, ok: status >= 200 && status < 300, headers: { get: k => (all[String(k).toLowerCase()] !== undefined ? all[String(k).toLowerCase()] : null) },
    body: { cancel() {}, getReader() { let i = 0, stop = false; return { async read() { if (stop) return { done: true }; await sleep(gap); if (i >= chunks.length) { if (!forever) return { done: true }; return { value: chunks[chunks.length - 1], done: false }; } return { value: chunks[i++], done: false }; }, cancel() { stop = true; } }; } } };
}
const PUBLIC = async () => [{ address: '93.184.216.34', family: 4 }];

describe('canonicalStream: one identity for the same stream', () => {
  test('case of scheme / host, http vs https, www., default ports, trailing slashes, tracking parameters', () => {
    const same = ['HTTP://radio.com/live', 'http://radio.com/live', 'http://radio.com/live/', 'https://www.radio.com:443/live', 'http://radio.com:80/live//', 'http://radio.com/live?utm_source=x&fbclid=1', 'radio.com/live#top'].map(v.canonicalStream);
    expect(new Set(same).size).toBe(1); expect(same[0]).toBe('radio.com/live');
  });
  test('Shoutcast tails and the order of the query do not matter; other ports, paths and parameters do', () => {
    expect(v.canonicalStream('http://h.ro:8000/;')).toBe(v.canonicalStream('https://h.ro:8000/')); expect(v.canonicalStream('http://h.ro:8000/;stream.mp3')).toBe(v.canonicalStream('http://h.ro:8000'));
    expect(v.canonicalStream('http://a.ro/x?b=2&a=1')).toBe(v.canonicalStream('http://a.ro/x?a=1&b=2'));
    expect(v.canonicalStream('http://a.ro:8000/x')).not.toBe(v.canonicalStream('http://a.ro/x')); expect(v.canonicalStream('http://a.ro/x')).not.toBe(v.canonicalStream('http://a.ro/y')); expect(v.canonicalStream('http://a.ro/x?token=1')).not.toBe(v.canonicalStream('http://a.ro/x?token=2'));
  });
  test('nothing for a dangerous or broken address', () => { for (const bad of ['', 'ftp://a.ro/x', 'javascript:alert(1)', 'http://127.0.0.1/x', 'http://localhost/x', 'http://u:p@a.ro/x', 'http://10.0.0.1/x', 'file:///etc/passwd']) expect(v.canonicalStream(bad)).toBe(''); });
});

describe('analyze: only real frames count as audio', () => {
  test('MP3: bitrate, sample rate, channels from the frame headers; an ID3 tag in front is skipped', () => {
    expect(v.analyze(mp3())).toMatchObject({ codec: 'MP3', bitrate: 128, sampleRate: 44100, channels: 2, vbr: false });
    const tag = Buffer.alloc(10 + 300); tag.write('ID3', 0, 'latin1'); tag[3] = 3; tag[8] = 0x02; tag[9] = 0x2c;   // syncsafe size 300
    expect(v.analyze(Buffer.concat([tag, mp3()]))).toMatchObject({ codec: 'MP3', bitrate: 128 });
    expect(v.analyze(Buffer.concat([Buffer.from('some bytes of a half frame'), mp3()]))).toMatchObject({ codec: 'MP3' });   // a stream joined in the middle
  });
  test('AAC (ADTS): codec, sample rate, channels, bitrate estimated from the frame size', () => { expect(v.analyze(adts())).toMatchObject({ codec: 'AAC', sampleRate: 44100, channels: 2 }); expect(v.analyze(adts()).bitrate).toBeGreaterThan(50); });
  test('Ogg Opus and Ogg Vorbis: read from the first page', () => {
    expect(v.analyze(Buffer.concat([ogg(opusHead()), Buffer.alloc(100)]))).toMatchObject({ codec: 'OPUS', sampleRate: 48000, channels: 2 });
    expect(v.analyze(Buffer.concat([ogg(vorbisId()), Buffer.alloc(100)]))).toMatchObject({ codec: 'VORBIS', sampleRate: 44100, channels: 2, bitrate: 128 });
  });
  test('a web page, JSON, zeros, random bytes, a lone sync word and a single frame are NOT audio', () => {
    expect(v.analyze(Buffer.from('<!doctype html><html><body>Radio</body></html>'.repeat(10)))).toBeNull();
    expect(v.analyze(Buffer.from('{"error":"not found"}'.repeat(10)))).toBeNull(); expect(v.analyze(Buffer.alloc(5000))).toBeNull();
    const noise = Buffer.alloc(5000); for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761 >>> 7) & 0xff; expect(v.analyze(noise)).toBeNull();
    expect(v.analyze(Buffer.concat([mp3(1), Buffer.alloc(2000)]))).toBeNull();   // one frame is not a stream
  });
});

describe('readAudio: the stream is held open and timed through the same guard as everything else', () => {
  test('a live stream: bytes, time to the first byte, no stall; the call stops by itself after the window', async () => {
    const r = await v.readAudio('https://live.example.ro/s', { durationMs: 600, fetchFn: async () => respond({ chunks: [mp3(8)], gap: 60 }), lookup: PUBLIC });
    expect(r.ok).toBe(true); expect(r.total).toBeGreaterThan(8000); expect(r.stalls).toBe(0); expect(r.ended).toBe(false); expect(r.spanMs).toBeGreaterThan(400); expect(r.head.length).toBeGreaterThan(3000);
  });
  test('a pause in the data is counted as a stall (also one at the very end of the window)', async () => {
    const slow = { ...respond({ chunks: [] }), body: { cancel() {}, getReader() { let i = 0; return { async read() { i++; if (i === 1) { await sleep(10); return { value: mp3(4), done: false }; } if (i === 2) { await sleep(350); return { value: mp3(4), done: false }; } await sleep(2000); return { done: true }; }, cancel() {} }; } } };
    const r = await v.readAudio('https://live.example.ro/s', { durationMs: 900, stallMs: 200, fetchFn: async () => slow, lookup: PUBLIC });
    expect(r.stalls).toBeGreaterThanOrEqual(1); expect(r.maxGapMs).toBeGreaterThanOrEqual(300);
  });
  test('closing the stream never leaves an unhandled rejection behind (a rejected cancel() must not stop a serverless process)', async () => {
    const seen = []; const onReject = e => seen.push(e); process.on('unhandledRejection', onReject);
    try {
      const rough = () => ({ ...respond(), body: { cancel() { return Promise.reject(new Error('AbortError')); }, getReader() { return { async read() { await sleep(30); return { value: mp3(4), done: false }; }, cancel() { return Promise.reject(new DOMException('aborted', 'AbortError')); }, get closed() { return Promise.reject(new DOMException('aborted', 'AbortError')); } }; } } });
      const r = await v.readAudio('https://live.example.ro/s', { durationMs: 250, fetchFn: async () => rough(), lookup: PUBLIC });
      expect(r.ok).toBe(true); await sleep(60);
    } finally { process.off('unhandledRejection', onReject); }
    expect(seen).toEqual([]);
  });
  test('a stream that is closed by the server right away is reported as ended', async () => {
    const r = await v.readAudio('https://live.example.ro/s', { durationMs: 800, fetchFn: async () => respond({ chunks: [mp3(6)], gap: 10, forever: false }), lookup: PUBLIC });
    expect(r.ended).toBe(true); expect(r.spanMs).toBeLessThan(400);
  });
  test('SSRF: a name that resolves to a private address is never requested; a redirect to the inside is never followed; localhost literals are refused', async () => {
    const calls = []; const fetchFn = async url => { calls.push(url); return respond({ status: 302, location: 'http://127.0.0.1/admin' }); };
    expect((await v.readAudio('https://evil.example.ro/s', { durationMs: 200, fetchFn, lookup: async () => [{ address: '10.0.0.7', family: 4 }] })).error).toBe('blocked'); expect(calls).toHaveLength(0);
    expect((await v.readAudio('https://evil.example.ro/s', { durationMs: 200, fetchFn, lookup: PUBLIC })).error).toBe('bad-redirect'); expect(calls).toEqual(['https://evil.example.ro/s']);
    const dns = async name => (name === 'rebind.example.ro' ? [{ address: '169.254.169.254', family: 4 }] : [{ address: '93.184.216.34', family: 4 }]);
    expect((await v.readAudio('https://hop.example.ro/s', { durationMs: 200, fetchFn: async url => (/hop/.test(url) ? respond({ status: 301, location: 'https://rebind.example.ro/m' }) : respond()), lookup: dns })).error).toBe('blocked');   // the metadata address after a redirect
    for (const bad of ['http://localhost/x', 'http://[::1]/x', 'http://192.168.1.1/x', 'file:///etc/passwd']) expect((await v.readAudio(bad, { fetchFn, lookup: PUBLIC })).error).toBe('bad-url');
  });
});

describe('validateStream: the verdict (the whole chain with a fake network)', () => {
  const run = (response, extra = {}) => v.validateStream('https://live.example.ro/stream', { durationMs: 700, lookup: PUBLIC, fetchFn: async () => (typeof response === 'function' ? response() : response), ...extra });
  test('a real MP3 stream is VALID with codec, bitrate, sample rate, channels, stability; the audio level is honestly not measured', async () => {
    const r = await run(() => respond({ chunks: [mp3(10)], gap: 70, headers: { 'icy-name': 'Radio Test', 'icy-br': '128' } }));
    expect(r).toMatchObject({ ok: true, audio: true, codec: 'MP3', bitrate: 128, sampleRate: 44100, channels: 2, stable: true, stalls: 0, level: null, name: 'Radio Test' });
    expect(r.bytes).toBeGreaterThan(5000); expect(r.warnings).toEqual([]);
  });
  test('a real AAC stream is VALID too', async () => { expect(await run(() => respond({ type: 'audio/aac', chunks: [adts(20)], gap: 70 }))).toMatchObject({ ok: true, codec: 'AAC', sampleRate: 44100, channels: 2 }); });
  test('HTML (even with an audio content type), JSON and random bytes are refused', async () => {
    const page = Buffer.from('<!doctype html><html><body>' + 'x'.repeat(3000) + '</body></html>');
    expect((await run(() => respond({ type: 'text/html', chunks: [page] }))).why).toMatch(/not-audio|html/);
    expect((await run(() => respond({ type: 'audio/mpeg', chunks: [page] }))).ok).toBe(false);
    const noise = Buffer.alloc(4000); for (let i = 0; i < noise.length; i++) noise[i] = (i * 40503 >>> 3) & 0x7f;
    expect(await run(() => respond({ type: 'audio/mpeg', chunks: [noise] }))).toMatchObject({ ok: false, why: 'not-audio' });
  });
  test('a stream that disconnects right after it started, and one that sends nothing, are refused with the real reason', async () => {
    expect(await run(() => respond({ chunks: [mp3(6)], gap: 10, forever: false }))).toMatchObject({ ok: false, why: 'disconnects' });
    const hollow = await v.validateStream('https://live.example.ro/stream', { durationMs: 400, lookup: PUBLIC, fetchFn: async () => respond({ chunks: [Buffer.alloc(300, 0xff)], gap: 50, forever: false }) });
    expect(hollow.ok).toBe(false);
  });
  test('dead or private targets: unreachable / blocked, without a request to the inside', async () => {
    expect((await v.validateStream('https://dead.example.ro/s', { durationMs: 300, lookup: PUBLIC, fetchFn: async () => { throw new Error('ECONNREFUSED'); } })).why).toBe('unreachable');
    const calls = []; const r = await v.validateStream('https://intranet.example.ro/s', { durationMs: 300, lookup: async () => [{ address: '192.168.0.9', family: 4 }], fetchFn: async url => { calls.push(url); return respond(); } });
    expect(r).toMatchObject({ ok: false, why: 'blocked' }); expect(calls).toHaveLength(0);
    expect((await v.validateStream('http://127.0.0.1:8000/s', { fetchFn: async () => respond() })).why).toBe('bad-url');
  });
  test('a pass with warnings (stalls) is VALID but not stable; three stalls make it INVALID (unstable)', async () => {
    const direct = async url => ({ ok: true, url, name: '', codec: 'MP3' });   // only the held-open read is under test here
    const make = pauses => ({ ...respond(), body: { cancel() {}, getReader() { let i = 0; return { async read() { i++; if (i === 1) { await sleep(10); return { value: mp3(10), done: false }; } if (i - 1 <= pauses) { await sleep(130); return { value: mp3(2), done: false }; } await sleep(30); return { value: mp3(1), done: false }; }, cancel() {} }; } } });
    const one = await v.validateStream('https://live.example.ro/s', { durationMs: 900, stallMs: 100, lookup: PUBLIC, resolve: direct, fetchFn: async () => make(1) });
    expect(one.ok).toBe(true); expect(one.stable).toBe(false); expect(one.warnings).toContain('stalls'); expect(v.healthOf(one)).toBe('DEGRADED');
    const many = await v.validateStream('https://live.example.ro/s', { durationMs: 900, stallMs: 100, lookup: PUBLIC, resolve: direct, fetchFn: async () => make(5) });
    expect(many).toMatchObject({ ok: false, why: 'unstable' }); expect(v.healthOf(many)).toBe('OFFLINE');
  });
  test('healthOf: OK / DEGRADED / OFFLINE; an HLS playlist is valid but flagged as not inspected', async () => {
    expect(v.healthOf({ ok: true, warnings: [] })).toBe('OK'); expect(v.healthOf({ ok: true, warnings: ['slow'] })).toBe('DEGRADED'); expect(v.healthOf({ ok: false })).toBe('OFFLINE');
    const hls = await v.validateStream('https://live.example.ro/a.m3u8', { resolve: async url => ({ ok: true, url, hls: true, codec: 'HLS', iosOk: true }) }); expect(hls).toMatchObject({ ok: true, hls: true, codec: 'HLS', stable: null }); expect(hls.warnings).toContain('hls-playlist-only');
  });
});

describe('applySubmission: the stored row is built by the server only', () => {
  const verdict = { ok: true, url: 'https://x.ro/live', codec: 'MP3', bitrate: 128, sampleRate: 44100, channels: 2, stable: true, level: null, evil: 'x', status: 'APPROVED' };
  test('first player creates it, the second adds himself to the SAME row; accounts only when given; status and verdict come from the server verdict, unknown fields are dropped', () => {
    const a = v.applySubmission(null, { u: 'https://x.ro/live', orig: 'HTTP://X.ro/live/', canon: 'x.ro/live', n: 'X', device: 'd1', by: { id: 7, name: 'Ana' }, verdict }, 1000);
    expect(a).toMatchObject({ u: 'https://x.ro/live', orig: 'HTTP://X.ro/live/', canon: 'x.ro/live', n: 'X', count: 1, first: 1000, last: 1000, status: 'VALID', by: { id: 7, name: 'Ana' } }); expect(a.v).toMatchObject({ ok: true, codec: 'MP3' }); expect(a.v.evil).toBeUndefined(); expect(a.v.status).toBeUndefined();
    const b = v.applySubmission(a, { u: 'https://x.ro/live', orig: 'other', canon: 'x.ro/live', n: 'Y', device: 'd2', by: null, verdict: { ok: false, why: 'disconnects' } }, 2000);
    expect(b).toMatchObject({ count: 2, first: 1000, last: 2000, orig: 'HTTP://X.ro/live/', n: 'X', status: 'VALID', by: { id: 7 } }); expect(b.v).toMatchObject({ ok: true, codec: 'MP3' });   // a later failing check of a VALID row only adds the player
    const bad = v.applySubmission(null, { u: 'https://y.ro/s', canon: 'y.ro/s', device: 'd1', verdict: { ok: false, why: 'disconnects' } }, 5), up = v.applySubmission(bad, { u: 'https://y.ro/s', canon: 'y.ro/s', device: 'd2', verdict }, 6);
    expect(bad).toMatchObject({ status: 'INVALID', v: { ok: false, why: 'disconnects' } }); expect(up).toMatchObject({ status: 'VALID', count: 2, checkedAt: 6 });   // an INVALID row becomes VALID when it plays now
    expect(v.applySubmission(a, { u: 'https://x.ro/live', canon: 'x.ro/live', device: 'd3', verdict: { ok: true, codec: 'AAC' }, reused: true }, 9)).toMatchObject({ count: 2, checkedAt: 1000, v: { codec: 'MP3' } });   // a reused verdict is not re-stamped
    expect(v.applySubmission(b, { u: 'https://x.ro/live', canon: 'x.ro/live', device: 'd2', verdict }, 3000).count).toBe(2);   // the same device again is not a new player
  });
});

describe('readIcy / songLike / programLike: evidence of songs from the stream (not a listening test)', () => {
  const icyBody = (metaint, text) => { const audio = Buffer.alloc(metaint, 0x55), block = Buffer.from(text), padded = Buffer.alloc(Math.ceil(block.length / 16) * 16); block.copy(padded); return Buffer.concat([audio, Buffer.from([padded.length / 16]), padded, Buffer.alloc(200, 0x55)]); };
  const icyResponse = (metaint, text, headers = {}) => { const body = icyBody(metaint, text); let sent = false; return { status: 200, ok: true, headers: { get: k => ({ 'icy-metaint': String(metaint), 'icy-name': 'Test FM', ...headers })[String(k).toLowerCase()] || null }, body: { cancel() {}, getReader() { return { async read() { if (sent) return { done: true }; sent = true; return { value: body, done: false }; }, cancel() {}, closed: Promise.resolve() }; } } }; };
  test('the StreamTitle is read after metaint bytes of audio; the request asks for metadata', async () => {
    let asked = null; const r = await v.readIcy('https://live.example.ro/s', { lookup: PUBLIC, fetchFn: async (u, o) => { asked = o.headers; return icyResponse(1024, "StreamTitle='Daft Punk - One More Time';StreamUrl='';"); } });
    expect(r).toMatchObject({ ok: true, metaint: 1024, title: 'Daft Punk - One More Time', name: 'Test FM' }); expect(asked['icy-metadata']).toBe('1');
  });
  test('an empty title, no metadata at all, a private target and a dead server are all answered without an exception', async () => {
    expect((await v.readIcy('https://live.example.ro/s', { lookup: PUBLIC, fetchFn: async () => icyResponse(512, "StreamTitle='';") })).title).toBe('');
    expect(await v.readIcy('https://live.example.ro/s', { lookup: PUBLIC, fetchFn: async () => respond({ headers: {} }) })).toMatchObject({ ok: true, metaint: 0, title: '' });
    const calls = []; expect((await v.readIcy('https://intranet.example.ro/s', { lookup: async () => [{ address: '10.1.1.1', family: 4 }], fetchFn: async u => { calls.push(u); return respond(); } })).why).toBe('blocked'); expect(calls).toHaveLength(0);
    expect((await v.readIcy('https://dead.example.ro/s', { lookup: PUBLIC, fetchFn: async () => { throw new Error('refused'); } })).ok).toBe(false);
  });
  test('songLike: "Artist - Title" yes; the station name, a jingle, an ad, a web address, a broken template, a programme no', () => {
    for (const t of ['Daft Punk - One More Time', 'Adele – Hello', 'Earth, Wind & Fire - Fantasy']) expect(v.songLike(t, 'Some Radio')).toBe(true);
    for (const t of ['Heart 80s', 'Heart 80s - Heart 80s', '', 'News - top of the hour', 'www.radio.com - listen live', 'ADWTAG_60000 - THIS STATION WILL CONTINUE AFTER', 'Adela - text="Aint In La" song_spot="M"', 'Telegram - @waveanime', 'Advert: - Live365 - Advertisement', 'STOP ADBREAK 1']) expect(v.songLike(t, 'Heart 80s')).toBe(false);
  });
  test('programLike: a talk segment / programme title is not a song and not an ad; ads, jingles, empty and the station name are not "programmes"', () => {
    expect(v.programLike('Eva von Redecker über Faschismus heute', 'FM4')).toBe(true); expect(v.programLike('Morning Show with Tom', 'X')).toBe(true);
    for (const t of ['Daft Punk - One More Time', '', 'STOP ADBREAK 1', 'Advert: - Live365 - Advertisement', 'AD 7', 'FM4', ' - ']) expect(v.programLike(t, 'FM4')).toBe(false);
  });
});
