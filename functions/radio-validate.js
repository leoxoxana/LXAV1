'use strict';
// STREAM VALIDATION (server side, authoritative): what the player pasted -> a verdict about a real, stable audio stream, with the numbers that were MEASURED.
//   1. canonicalStream(): one identity for http/https, www., default ports, trailing slashes, Shoutcast "/;" tails, tracking parameters (duplicate detection uses it, never the raw string)
//   2. radio-custom.resolveStation(): playlists / pages / https upgrade / first-bytes probe (every address, also after every redirect, must be PUBLIC: no SSRF)
//   3. readAudio(): the stream is held open for a few seconds through the same guard, the arrival of every chunk is timed
//   4. analyze(): the first bytes are parsed as real frames (MP3 / AAC-ADTS / Ogg Opus + Vorbis / FLAC): codec, bitrate, sample rate, channels. A page, a JSON answer or random bytes have no frames.
// NOT measured (there is no audio decoder here, nothing is invented): audio level and silence. The result says so (`level: null`).
const custom = require('./radio-custom');

const READ_MS = 5000, READ_MAX_BYTES = 512 * 1024, HEAD_BYTES = 96 * 1024, STALL_MS = 2500, MIN_AUDIO_BYTES = 2000, MAX_HOPS = 3;
const UA = 'LXAV1-radio/1.0 (+https://lxoxa.vercel.app)';

// ---- canonical identity of a stream address (a STRING: hash it with radio-reports.radioKey for a node key)
const TRACKING = /^(utm_[a-z]+|fbclid|gclid|ref|source)$/i;
function canonicalStream(raw) {
  const clean = custom.cleanStreamUrl(raw); if (!clean) return '';
  let url; try { url = new URL(clean); } catch (error) { return ''; }
  const host = url.hostname.replace(/^www\./i, '').toLowerCase();
  const port = url.port && url.port !== '80' && url.port !== '443' ? ':' + url.port : '';   // 80 / 443 are the same whichever scheme was typed
  let path = url.pathname.replace(/\/{2,}/g, '/').replace(/\/;[^/]*$/, '').replace(/\/+$/, '');   // "/live/" = "/live"; "/;" and "/;stream.mp3" (Shoutcast) = the root of the server
  const pairs = [...url.searchParams.entries()].filter(([key]) => !TRACKING.test(key)).sort((a, b) => a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : (a[0] < b[0] ? -1 : 1));
  const query = pairs.length ? '?' + pairs.map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&') : '';
  return host + port + path + query;   // the scheme is left out on purpose: http://x/live and https://x/live are the same station
}

// ---- audio containers: real frames or nothing
const MP3_BR = { 11: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448], 12: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384], 13: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  21: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256], 22: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], 23: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] };
const MP3_SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
function mp3Header(b, i) {
  if (i + 4 > b.length || b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) return null;
  const ver = (b[i + 1] >> 3) & 3, layer = (b[i + 1] >> 1) & 3; if (ver === 1 || layer === 0) return null;
  const bri = b[i + 2] >> 4, sri = (b[i + 2] >> 2) & 3; if (bri === 0 || bri === 15 || sri === 3) return null;
  const L = 4 - layer, family = (ver === 3 ? 1 : 2) * 10 + L, kbps = MP3_BR[family][bri], sr = MP3_SR[ver][sri], pad = (b[i + 2] >> 1) & 1;
  const size = L === 1 ? (Math.floor(12 * kbps * 1000 / sr) + pad) * 4 : (L === 3 && ver !== 3 ? Math.floor(72 * kbps * 1000 / sr) + pad : Math.floor(144 * kbps * 1000 / sr) + pad);
  return size >= 24 ? { size, kbps, sr, ch: (b[i + 3] >> 6) === 3 ? 1 : 2, layer: L, ver } : null;
}
const ADTS_SR = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
function adtsHeader(b, i) {
  if (i + 7 > b.length || b[i] !== 0xff || (b[i + 1] & 0xf6) !== 0xf0) return null;
  const sfi = (b[i + 2] >> 2) & 15, ch = ((b[i + 2] & 1) << 2) | (b[i + 3] >> 6), size = ((b[i + 3] & 3) << 11) | (b[i + 4] << 3) | (b[i + 5] >> 5);
  return sfi <= 12 && ch >= 1 && ch <= 7 && size >= 7 ? { size, sr: ADTS_SR[sfi], ch: ch === 7 ? 8 : ch, kbps: Math.round(size * 8 * ADTS_SR[sfi] / 1024 / 1000) } : null;
}
// follow a chain of consecutive frames from `start`; the chain is real audio when it holds at least `need` frames in a row
function chain(buf, start, parse, need) {
  const frames = []; let i = start;
  while (i < buf.length) { const h = parse(buf, i); if (!h) break; frames.push(h); i += h.size; }
  return frames.length >= need ? frames : null;
}
function analyze(buf) {
  if (!buf || buf.length < 64) return null;
  // Ogg (Opus / Vorbis): the first page names the codec
  if (buf.toString('latin1', 0, 4) === 'OggS') {
    const segs = buf[26], at = 27 + segs;
    if (buf.length >= at + 20 && buf.toString('latin1', at, at + 8) === 'OpusHead') return { format: 'OGG-OPUS', codec: 'OPUS', bitrate: 0, sampleRate: 48000, channels: buf[at + 9], frames: 1, vbr: true };
    if (buf.length >= at + 28 && buf[at] === 1 && buf.toString('latin1', at + 1, at + 7) === 'vorbis') { const nominal = buf.readInt32LE(at + 20); return { format: 'OGG-VORBIS', codec: 'VORBIS', bitrate: nominal > 0 ? Math.round(nominal / 1000) : 0, sampleRate: buf.readUInt32LE(at + 12), channels: buf[at + 11], frames: 1, vbr: true }; }
    return null;
  }
  if (buf.toString('latin1', 0, 4) === 'fLaC' && buf.length >= 22) { const w = buf.readUInt32BE(18); return { format: 'FLAC', codec: 'FLAC', bitrate: 0, sampleRate: w >>> 12, channels: ((w >> 9) & 7) + 1, frames: 1, vbr: true }; }
  let skip = 0; if (buf.toString('latin1', 0, 3) === 'ID3' && buf.length > 10) skip = 10 + ((buf[6] & 0x7f) << 21 | (buf[7] & 0x7f) << 14 | (buf[8] & 0x7f) << 7 | (buf[9] & 0x7f));
  const limit = Math.min(buf.length - 4, skip + 16384);
  for (let i = skip; i < limit; i++) {
    if (buf[i] !== 0xff) continue;
    const adts = (buf[i + 1] & 0xf6) === 0xf0, frames = chain(buf, i, adts ? adtsHeader : mp3Header, 4);
    if (!frames) continue;
    const kbps = [...new Set(frames.map(f => f.kbps))], mean = Math.round(frames.reduce((s, f) => s + f.kbps, 0) / frames.length);
    return { format: adts ? 'AAC-ADTS' : 'MPEG-L' + frames[0].layer, codec: adts ? 'AAC' : 'MP3', bitrate: mean, sampleRate: frames[0].sr, channels: frames[0].ch, frames: frames.length, vbr: kbps.length > 1 };
  }
  return null;
}

// ---- hold the stream open and time it (same guard as safeFetch: manual redirects, every hop must be a PUBLIC address)
const sleep = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
async function readAudio(rawUrl, deps = {}) {
  const durationMs = deps.durationMs || READ_MS, maxBytes = deps.maxBytes || READ_MAX_BYTES, fetchFn = deps.fetchFn || ((...args) => fetch(...args));
  let url = custom.cleanStreamUrl(rawUrl); if (!url) return { error: 'bad-url' };
  const controller = new AbortController(), began = Date.now(), connectTimer = setTimeout(() => controller.abort(), deps.connectMs || 8000);
  try {
    let response = null;
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      if (!(await custom.assertPublic(new URL(url).hostname, deps.lookup))) return { error: 'blocked' };
      response = await fetchFn(url, { signal: controller.signal, redirect: 'manual', headers: { 'user-agent': UA, 'icy-metadata': '0', accept: '*/*' } });
      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        try { response.body && Promise.resolve(response.body.cancel()).catch(() => {}); } catch (error) { /* ignore */ }
        url = custom.cleanStreamUrl(new URL(response.headers.get('location'), url).href); if (!url) return { error: 'bad-redirect' }; response = null; continue;
      }
      break;
    }
    clearTimeout(connectTimer);
    if (!response) return { error: 'too-many-redirects' };
    if (!response.ok) { try { response.body && Promise.resolve(response.body.cancel()).catch(() => {}); } catch (error) { /* ignore */ } return { error: 'http ' + response.status, status: response.status }; }
    const type = String(response.headers.get('content-type') || '').toLowerCase(), icy = { name: response.headers.get('icy-name') || '', br: Number(response.headers.get('icy-br')) || 0 };
    if (!response.body) return { error: 'no-body' };
    const reader = response.body.getReader(), head = [], times = []; let total = 0, headLen = 0, ended = false, failed = false, first = 0, last = 0;
    const stopAt = Date.now() + durationMs;
    while (Date.now() < stopAt && total < maxBytes) {
      let step; try { step = await Promise.race([reader.read(), sleep(stopAt - Date.now()).then(() => 'time')]); } catch (error) { failed = true; ended = true; break; }
      if (step === 'time') break;
      if (step.done) { ended = true; break; }
      const now = Date.now(); if (!first) first = now; last = now; total += step.value.length; times.push([now - first, step.value.length]);
      if (headLen < HEAD_BYTES) { const piece = Buffer.from(step.value).subarray(0, HEAD_BYTES - headLen); head.push(piece); headLen += piece.length; }
    }
    const finished = Date.now();
    // close the stream WITHOUT leaving a rejected promise behind (an AbortError nobody handles would stop a serverless process): cancel first, swallow what it says, then abort the request
    try { reader.closed.catch(() => {}); } catch (error) { /* ignore */ }
    try { const closing = reader.cancel(); if (closing && closing.catch) closing.catch(() => {}); } catch (error) { /* ignore */ }
    try { controller.abort(); } catch (error) { /* ignore */ }
    const span = first ? Math.max(1, (ended ? last : finished) - first) : 0;
    // steady rate: what arrived after the first 1.5 s (Icecast sends a burst of buffer at the start, which would flatter the number)
    let steadyBytes = 0, steadyFrom = 1500; for (const [t, n] of times) if (t >= steadyFrom) steadyBytes += n;
    const steadyMs = span - steadyFrom, steadyKbps = steadyMs >= 1500 ? Math.round(steadyBytes * 8 / steadyMs) : 0;
    const stallMs = deps.stallMs || STALL_MS; let stalls = 0, maxGap = 0; for (let i = 1; i < times.length; i++) { const gap = times[i][0] - times[i - 1][0]; if (gap > maxGap) maxGap = gap; if (gap > stallMs) stalls++; }
    if (first && !ended && finished - last > stallMs) { stalls++; maxGap = Math.max(maxGap, finished - last); }   // silence on the line at the end of the window
    return { ok: true, status: response.status, url, type, icy, head: Buffer.concat(head), total, ttfbMs: first ? first - began : 0, spanMs: span, steadyKbps, stalls, maxGapMs: maxGap, ended, failed, durationMs };
  } catch (error) {
    return { error: error && error.name === 'AbortError' ? 'timeout' : 'unreachable' };
  } finally { clearTimeout(connectTimer); }
}

// ---- "what is playing now" (ICY metadata): a music station sends "Artist - Title", a news / talk station sends its name or a programme. One short read, same guard as everything else.
// This is EVIDENCE of songs, not a listening test (there is no decoder here): a station without metadata stays "unknown", it is not condemned.
async function readIcy(rawUrl, deps = {}) {
  const timeoutMs = deps.timeoutMs || 4500, fetchFn = deps.fetchFn || ((...args) => fetch(...args));
  let url = custom.cleanStreamUrl(rawUrl); if (!url) return { ok: false, why: 'bad-url' };
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response = null;
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      if (!(await custom.assertPublic(new URL(url).hostname, deps.lookup))) return { ok: false, why: 'blocked' };
      response = await fetchFn(url, { signal: controller.signal, redirect: 'manual', headers: { 'user-agent': UA, 'icy-metadata': '1', accept: '*/*' } });
      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) { try { response.body && Promise.resolve(response.body.cancel()).catch(() => {}); } catch (error) { /* ignore */ } url = custom.cleanStreamUrl(new URL(response.headers.get('location'), url).href); if (!url) return { ok: false, why: 'bad-redirect' }; response = null; continue; }
      break;
    }
    if (!response || !response.ok || !response.body) return { ok: false, why: 'http' };
    const metaint = Number(response.headers.get('icy-metaint')) || 0, name = String(response.headers.get('icy-name') || '');
    if (!(metaint > 0 && metaint <= 65536)) { try { Promise.resolve(response.body.cancel()).catch(() => {}); } catch (error) { /* ignore */ } return { ok: true, metaint: 0, title: '', name }; }
    const reader = response.body.getReader(), chunks = []; let have = 0, need = metaint + 1, title = '';
    try { reader.closed.catch(() => {}); } catch (error) { /* ignore */ }
    while (have < need) {
      const step = await reader.read(); if (step.done) break; const piece = Buffer.from(step.value); chunks.push(piece); have += piece.length;
      if (need === metaint + 1 && have >= metaint + 1) { const all = Buffer.concat(chunks); need = metaint + 1 + all[metaint] * 16; if (all[metaint] === 0) { title = ''; break; } }
    }
    const all = Buffer.concat(chunks);
    if (all.length >= need && all.length > metaint + 1) { const block = all.subarray(metaint + 1, need).toString('utf8'); const m = /StreamTitle='((?:[^']|'(?!;))*)'/.exec(block); title = m ? m[1].replace(/[\p{Cc}<>]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 140) : ''; }
    try { Promise.resolve(reader.cancel()).catch(() => {}); } catch (error) { /* ignore */ }
    return { ok: true, metaint, title, name };
  } catch (error) { return { ok: false, why: error && error.name === 'AbortError' ? 'timeout' : 'unreachable' };
  } finally { clearTimeout(timer); try { controller.abort(); } catch (error) { /* ignore */ } }
}
const AD_LIKE = /adwtag|song_spot|text=|advert|commercial|this station will|stop adbreak|^ad \d+|\bjingle\b|station id|\bpromo\b/i;
// "Artist - Title" and not the name of the station / a jingle / an address
function songLike(title, stationName) {
  const t = String(title || '').trim(); if (t.length < 5 || t.length > 140) return false;
  if (!/\S\s[-–—]\s\S/.test(t)) return false;
  const key = text => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, ''), station = key(stationName);
  if (station.length > 3 && key(t).startsWith(station)) return false;
  if (/^(news|weather|traffic|advert|commercial|jingle|station id|promo|sports?|live)\b/i.test(t) || /https?:\/\/|www\.|@\w|adwtag|song_spot|text=|advert|commercial|this station will|stop adbreak|\bjingle\b|station id/i.test(t)) return false;   // ads, jingles, web addresses, broken templates are not songs
  return true;
}

// ---- the verdict
const FAIL = why => ({ ok: false, why });
async function validateStream(input, deps = {}) {
  const resolve = deps.resolve || custom.resolveStation, read = deps.read || readAudio, checkedAt = (deps.now || Date.now)();
  const res = await resolve(input, deps);
  if (!res || !res.ok) return { ...FAIL(res && res.why ? res.why : 'unreachable'), checkedAt };
  const base = { url: res.url, name: String(res.name || '').slice(0, 40), from: res.from || '', upgraded: Boolean(res.upgraded), phoneOk: res.phoneOk !== false, iosOk: res.iosOk !== false, level: null, checkedAt };
  if (res.hls) return { ok: true, ...base, audio: true, hls: true, codec: 'HLS', bitrate: 0, sampleRate: 0, channels: 0, stable: null, stalls: 0, warnings: ['hls-playlist-only'] };   // an HLS playlist is not held open here: only the playlist was read
  const got = await read(res.url, deps);
  if (got.error) return { ...FAIL(got.error === 'blocked' ? 'blocked' : got.error === 'timeout' ? 'timeout' : 'unreachable'), ...base };
  const looksText = /html|json|xml|text\//.test(got.type) || (got.head && got.head.length && got.head[0] === 0x3c);
  if (looksText) return { ...FAIL('html'), ...base, type: got.type.slice(0, 40) };
  if (got.total < MIN_AUDIO_BYTES) return { ...FAIL(got.ended ? 'disconnects' : 'no-data'), ...base, bytes: got.total };
  const a = analyze(got.head);
  if (!a) return { ...FAIL('not-audio'), ...base, type: got.type.slice(0, 40), bytes: got.total };
  const shortLived = got.ended && got.spanMs < got.durationMs * 0.6;
  if (shortLived) return { ...FAIL('disconnects'), ...base, codec: a.codec, bytes: got.total, spanMs: got.spanMs };
  const nominal = a.bitrate || got.icy.br || 0, warnings = [];
  if (got.stalls >= 3) return { ...FAIL('unstable'), ...base, codec: a.codec, bitrate: a.bitrate, stalls: got.stalls, maxGapMs: got.maxGapMs, bytes: got.total };
  if (got.stalls > 0) warnings.push('stalls');
  if (nominal && got.steadyKbps && got.steadyKbps < nominal * 0.7) warnings.push('slow');
  if (a.channels === 1 && a.bitrate && a.bitrate >= 96) warnings.push('mono');
  return { ok: true, ...base, audio: true, hls: false, format: a.format, codec: a.codec, bitrate: a.bitrate || got.icy.br || 0, vbr: a.vbr, sampleRate: a.sampleRate, channels: a.channels, frames: a.frames,
    stable: warnings.indexOf('stalls') === -1 && warnings.indexOf('slow') === -1, stalls: got.stalls, maxGapMs: got.maxGapMs, measuredKbps: got.steadyKbps, ttfbMs: got.ttfbMs, bytes: got.total, spanMs: got.spanMs, warnings };
}
// the state of an approved station after a check: OK / DEGRADED / OFFLINE (it is never deleted by this)
const healthOf = verdict => !verdict || !verdict.ok ? 'OFFLINE' : (verdict.warnings && verdict.warnings.length ? 'DEGRADED' : 'OK');

// ---- the stored submission (Firebase `radioSuggest/<key>`): ONLY the server writes it, from its own verdict; a player's request never carries status / validation fields
const KEEP = ['ok', 'why', 'url', 'codec', 'format', 'bitrate', 'vbr', 'sampleRate', 'channels', 'frames', 'stable', 'stalls', 'maxGapMs', 'measuredKbps', 'ttfbMs', 'bytes', 'spanMs', 'warnings', 'hls', 'audio', 'phoneOk', 'iosOk', 'from', 'upgraded', 'level', 'checkedAt', 'type'];
const compactVerdict = verdict => { const out = {}; for (const key of KEEP) if (verdict && verdict[key] !== undefined && verdict[key] !== null) out[key] = verdict[key]; if (out.url) out.url = String(out.url).slice(0, 400); return out; };
const MAX_DEVICES = 30, MAX_ACCOUNTS = 10;
// the node after one more player sent the same stream (pure: runs inside the Firebase transaction, so two players sending it at the same moment end up in ONE node)
function applySubmission(current, sub, now) {
  const node = current && typeof current === 'object' ? { ...current } : {};
  if (!node.u) { node.first = now; node.orig = String(sub.orig || '').slice(0, 400); node.count = 0; node.devices = {}; node.accounts = []; }
  node.u = String(sub.u || node.u || '').slice(0, 400); node.canon = String(sub.canon || node.canon || '').slice(0, 300); node.n = node.n || String(sub.n || '').slice(0, 48); node.last = now;
  const devices = { ...(node.devices || {}) };
  if (!devices[sub.device]) node.count = (Number(node.count) || 0) + 1;
  devices[sub.device] = now;
  const keys = Object.keys(devices); if (keys.length > MAX_DEVICES) keys.sort((a, b) => devices[a] - devices[b]).slice(0, keys.length - MAX_DEVICES).forEach(key => { delete devices[key]; });
  node.devices = devices;
  const accounts = Array.isArray(node.accounts) ? node.accounts.slice() : [];
  if (sub.by && sub.by.id !== undefined && !accounts.some(a => a && String(a.id) === String(sub.by.id))) accounts.push({ id: sub.by.id, name: String(sub.by.name || '').slice(0, 30) });
  node.accounts = accounts.slice(0, MAX_ACCOUNTS); if (!node.by && node.accounts.length) node.by = node.accounts[0];
  // a later player (or a different spelling of the same address) NEVER turns a good row into a bad one, and a reused verdict is not re-stamped as a new check: only a real check (TEST AGAIN, a first submission, a retry of an INVALID row) writes the verdict
  const ok = Boolean(sub.verdict && sub.verdict.ok);
  if (sub.reused || (node.status === 'VALID' && !ok)) return node;
  node.status = ok ? 'VALID' : 'INVALID'; node.v = compactVerdict(sub.verdict || { ok: false, why: 'unreachable' }); node.checkedAt = now;
  return node;
}

// text on the air that is neither a song nor an ad / jingle: a talk segment or a programme title
const programLike = (title, stationName) => { const t = String(title || '').trim(); return Boolean(t) && !songLike(t, stationName) && !AD_LIKE.test(t) && !/^[-–—\s]*$/.test(t) && t.replace(/[^a-z0-9]/gi, '').toLowerCase() !== String(stationName || '').replace(/[^a-z0-9]/gi, '').toLowerCase(); };
exports.programLike = programLike; exports.readIcy = readIcy; exports.songLike = songLike; exports.canonicalStream = canonicalStream; exports.analyze = analyze; exports.readAudio = readAudio; exports.validateStream = validateStream; // the six states shown to people: VALID / DEGRADED (plays, with warnings) / OFFLINE (no answer, dropped) / NO AUDIO (answers but no audio: HTML page, no data) / UNSUPPORTED (HLS, unknown format) / INVALID (bad or blocked address)
const stateOf = verdict => {
  if (!verdict) return 'OFFLINE';
  if (verdict.ok) return verdict.warnings && verdict.warnings.length ? 'DEGRADED' : 'VALID';
  const why = String(verdict.why || '');
  if (verdict.hls || why === 'hls' || why === 'unsupported') return 'UNSUPPORTED';
  if (['html', 'no-data', 'not-audio'].includes(why)) return 'NO AUDIO';
  if (why === 'unstable') return 'DEGRADED';
  if (['unreachable', 'timeout', 'http', 'disconnects'].includes(why)) return 'OFFLINE';
  return 'INVALID';
};
exports.stateOf = stateOf; exports.healthOf = healthOf;
exports.applySubmission = applySubmission; exports.compactVerdict = compactVerdict; exports.mp3Header = mp3Header; exports.adtsHeader = adtsHeader; exports.READ_MS = READ_MS;
