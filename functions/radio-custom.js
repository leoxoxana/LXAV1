'use strict';
// STATIONS OF THE PLAYERS: a player pastes the link of "his" radio. This file turns whatever he pasted (a direct stream, a .pls / .m3u / .xspf / .asx playlist, the web page of a Shoutcast / Icecast server)
// into a stream that really plays, WITHOUT ever letting the server be used to reach the inside of a network: every address (also after every redirect) must resolve to a PUBLIC IP, the answer is
// read in small pieces with time limits, nothing the stranger's server says is executed or stored except an https stream address and a short name.
const dns = require('dns'), net = require('net');

const MAX_URL = 400, FETCH_TIMEOUT_MS = 6000, MAX_HOPS = 3, PAGE_BYTES = 60000, PROBE_BYTES = 2048, MAX_CANDIDATES = 5;
const AGENT = 'LXAV1-radio/1.0 (+https://lxoxa.vercel.app)';
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

// ---- addresses that must never be reached
function privateV4(ip) {
  const p = ip.split('.').map(Number); if (p.length !== 4 || p.some(n => !(n >= 0 && n <= 255))) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 0 && p[2] === 0) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}
function privateIp(ip) {
  const text = String(ip).toLowerCase();
  if (net.isIPv4(text)) return privateV4(text);
  if (net.isIPv6(text)) {
    if (text === '::' || text === '::1') return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(text); if (mapped) return privateV4(mapped[1]);
    return /^f[cd]/.test(text) || /^fe[89ab]/.test(text) || /^ff/.test(text);
  }
  return true;   // not an address at all: refuse
}
// the host must be a name / address of the public internet; every address it resolves to is checked (lookup is injectable for tests)
async function assertPublic(hostname, lookup = (name, options) => dns.promises.lookup(name, options)) {
  const host = String(hostname || '').replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan')) return false;
  if (net.isIP(host)) return !privateIp(host);
  try { const found = await lookup(host, { all: true }); return Array.isArray(found) && found.length > 0 && found.every(entry => !privateIp(entry.address)); } catch (error) { return false; }
}
// a link as the player typed it -> a clean absolute http(s) address, or '' (no user:password@, no fragment, no private literal)
function cleanStreamUrl(raw, max = MAX_URL) {   // max: only for an address the SERVER itself took from the directory (long tracking tokens); players' input keeps the 400 limit
  const text = String(raw || '').trim(); if (!text || text.length > max) return '';
  let url; try { url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : 'https://' + text); } catch (error) { return ''; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
  if (url.username || url.password || !url.hostname) return '';
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || (net.isIP(host) && privateIp(host))) return '';
  url.hash = ''; const out = url.href; return out.length > max ? '' : out;
}
const withHttps = url => url.replace(/^http:\/\//i, 'https://');
const hasQuery = url => { try { return Boolean(new URL(url).search); } catch (error) { return false; } };

// ---- a guarded fetch: manual redirects (each hop checked), time limit, at most `maxBytes` of the body read
async function safeFetch(rawUrl, { headers = {}, maxBytes = PAGE_BYTES, timeoutMs = FETCH_TIMEOUT_MS, lookup, fetchFn = (...args) => fetch(...args) } = {}) {
  let url = cleanStreamUrl(rawUrl); if (!url) return { error: 'bad-url' };
  const started = Date.now(), controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      if (!(await assertPublic(new URL(url).hostname, lookup))) return { error: 'blocked' };
      const response = await fetchFn(url, { signal: controller.signal, redirect: 'manual', headers: { 'user-agent': AGENT, ...headers } });
      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        try { response.body && Promise.resolve(response.body.cancel()).catch(() => {}); } catch (error) { /* ignore */ }
        url = cleanStreamUrl(new URL(response.headers.get('location'), url).href); if (!url) return { error: 'bad-redirect' }; continue;
      }
      const type = String(response.headers.get('content-type') || '').toLowerCase(), head = name => response.headers.get(name);
      if (!response.ok) { try { response.body && Promise.resolve(response.body.cancel()).catch(() => {}); } catch (error) { /* ignore */ } return { error: 'http ' + response.status, status: response.status, url }; }
      const chunks = []; let total = 0;
      if (response.body) { const reader = response.body.getReader(); while (total < maxBytes) { const { value, done } = await reader.read(); if (done) break; chunks.push(Buffer.from(value)); total += value.length; } try { Promise.resolve(reader.cancel()).catch(() => {}); } catch (error) { /* ignore */ } }
      return { status: response.status, url, type, bytes: Buffer.concat(chunks).subarray(0, maxBytes), icyName: head('icy-name') || '', icyBr: head('icy-br') || '', ms: Date.now() - started };
    }
    return { error: 'too-many-redirects' };
  } catch (error) { return { error: error && error.name === 'AbortError' ? 'timeout' : 'unreachable' }; } finally { clearTimeout(timer); }
}

// ---- what is it?
const AUDIO_TYPE = /audio|mpeg|aac|ogg|octet-stream|opus|flac/i, PLAYLIST_TYPE = /mpegurl|x-scpls|pls\+xml|xspf|x-ms-asf|video\/x-ms-asf/i;
const codecOf = type => /aac/.test(type) ? 'AAC' : /ogg|opus/.test(type) ? 'OGG' : /flac/.test(type) ? 'FLAC' : /mpeg|mp3/.test(type) ? 'MP3' : '';
const looksLikeText = bytes => { const head = bytes.subarray(0, 8).toString('latin1'); return /^\s*(<|\[|#)/.test(head) || /^\s*https?:/i.test(head); };
function parsePlaylist(text) {
  const urls = [], names = [];
  const add = (u, n) => { if (/^https?:\/\//i.test(u) && !urls.includes(u)) { urls.push(u); names.push(n || ''); } };
  const raw = String(text);
  if (/^\s*\[playlist\]/im.test(raw)) { const titles = {}; for (const m of raw.matchAll(/^Title(\d+)\s*=\s*(.+)$/gim)) titles[m[1]] = m[2].trim(); for (const m of raw.matchAll(/^File(\d+)\s*=\s*(\S+)/gim)) add(m[2], titles[m[1]]); return { urls, names }; }
  if (/<playlist|<location>/i.test(raw)) { for (const m of raw.matchAll(/<location>\s*([^<\s]+)\s*<\/location>/gi)) add(m[1]); return { urls, names }; }
  if (/<asx/i.test(raw)) { for (const m of raw.matchAll(/<ref[^>]+href\s*=\s*["']([^"']+)["']/gi)) add(m[1]); return { urls, names }; }
  let title = ''; for (const line of raw.split(/\r?\n/)) { const t = line.trim(); if (!t) continue; if (/^#EXTINF/i.test(t)) { title = (t.split(',').slice(1).join(',') || '').trim(); continue; } if (t[0] === '#') continue; add(t, title); title = ''; }
  return { urls, names };
}
// the audio / playlist links of a web page (a Shoutcast or Icecast server page), absolute, public looking
function pageLinks(html, base) {
  const out = [];
  for (const m of String(html).matchAll(/(?:href|src)\s*=\s*["']([^"'#]+)["']/gi)) {
    if (!/\.(pls|m3u8?|asx|xspf|mp3|aac)(\?|$)|\/;(\?|$)|listen|stream/i.test(m[1])) continue;
    try { const u = cleanStreamUrl(new URL(m[1], base).href); if (u && !out.includes(u)) out.push(u); } catch (error) { /* skip */ }
  }
  if (/shoutcast/i.test(html)) { const u = cleanStreamUrl(new URL('/;', base).href); if (u && !out.includes(u)) out.push(u); }
  return out.slice(0, 8);
}

// ---- does it really play: first audio bytes through the guarded fetch, for a plain request and for a phone-style one
async function probeSafe(url, deps = {}) {
  const check = async headers => {
    const r = await safeFetch(url, { ...deps, headers, maxBytes: PROBE_BYTES, timeoutMs: deps.timeoutMs || 5000 });
    if (r.error) return { ok: false, why: r.error, ms: 0 };
    if (!AUDIO_TYPE.test(r.type) || /mpegurl/.test(r.type)) return { ok: false, why: 'type ' + (r.type || 'none').slice(0, 30), ms: r.ms };
    if (r.bytes.length <= 200) return { ok: false, why: 'no audio', ms: r.ms };
    if (r.bytes[0] === 0x3c) return { ok: false, why: 'html body', ms: r.ms };
    return { ok: true, why: 'ok', ms: r.ms, type: r.type, name: r.icyName, br: r.icyBr, url: r.url };
  };
  const server = await check({ 'icy-metadata': '0' });
  if (!server.ok) return { server, phone: { ok: false, why: 'skipped', ms: 0 } };
  return { server, phone: await check({ 'user-agent': PHONE, accept: '*/*', range: 'bytes=0-', 'icy-metadata': '1' }) };
}

// what the player pasted -> {ok, url, name, codec, bitrate, from, hls?, iosOk?} or {ok:false, why}
async function resolveStation(input, deps = {}) {
  const first = cleanStreamUrl(input); if (!first) return { ok: false, why: 'bad-url' };
  const depth = Number(deps.depth) || 0;
  // this site is https: an http address is tried through its https twin first; when only the http one answers it is "http-only" (the browser would block it) unless it is a playlist that lists https streams
  const attempt = /^http:/i.test(first) ? withHttps(first) : first; let httpOnly = false;
  let page = await safeFetch(attempt, deps);
  if (page.error && attempt !== first && page.error !== 'blocked') { page = await safeFetch(first, deps); httpOnly = !page.error; }
  if (page.error) return { ok: false, why: page.error === 'blocked' ? 'blocked' : 'unreachable' };
  const text = page.bytes.toString('utf8');
  // HLS (.m3u8): Safari / iPhone play it natively; it is passed on as it is, flagged
  if (/#EXT-X-/i.test(text) && /^\s*#EXTM3U/i.test(text)) return { ok: true, url: page.url, name: '', codec: 'HLS', bitrate: 0, from: 'hls', hls: true, iosOk: true };
  const finish = async (candidate, from, name) => {
    const probe = await probeSafe(candidate, deps);
    if (!probe.server.ok) return { ok: false, why: probe.server.why };
    const codec = codecOf(probe.server.type);
    return { ok: true, url: candidate, name: String(probe.server.name || name || '').slice(0, 40), codec, bitrate: Number(probe.server.br) || 0, from, phoneOk: probe.phone.ok, iosOk: !/OGG|FLAC/.test(codec) };
  };
  const direct = AUDIO_TYPE.test(page.type) && !PLAYLIST_TYPE.test(page.type) && !looksLikeText(page.bytes);
  if (direct) {
    if (httpOnly) return { ok: false, why: 'http-only' };
    const done = await finish(attempt, 'direct', page.icyName);
    if (done.ok) done.upgraded = attempt !== first;
    return done;
  }
  // a playlist or a page: the candidates it lists
  let candidates = [], names = [];
  if (PLAYLIST_TYPE.test(page.type) || /^\s*(\[playlist\]|#EXTM3U|<\?xml|<playlist|<asx)/i.test(text)) { const parsed = parsePlaylist(text); candidates = parsed.urls; names = parsed.names; }
  else if (/html/.test(page.type) || /<html|<body/i.test(text.slice(0, 2000))) candidates = pageLinks(text, page.url);
  else if (looksLikeText(page.bytes)) { const parsed = parsePlaylist(text); candidates = parsed.urls; names = parsed.names; }
  if (!candidates.length) return { ok: false, why: 'not-audio' };
  let sawHttpOnly = false;
  for (let i = 0; i < Math.min(candidates.length, MAX_CANDIDATES); i++) {
    const candidate = cleanStreamUrl(candidates[i]); if (!candidate) continue;
    if (/\.(pls|m3u|asx|xspf)(\?|$)/i.test(candidate) && depth < 2) { const inner = await resolveStation(candidate, { ...deps, depth: depth + 1 }); if (inner.ok) return inner; if (inner.why === 'http-only') sawHttpOnly = true; continue; }   // a page that links to a playlist: one level deeper
    const secure = /^http:/i.test(candidate) ? withHttps(candidate) : candidate;   // the browser blocks http on this https site: the https twin of the same address is what can play
    const done = await finish(secure, 'playlist', names[i]);
    if (!done.ok && /^http:/i.test(candidate) && secure !== candidate) { sawHttpOnly = true; continue; }
    if (done.ok) { done.upgraded = secure !== candidate; return done; }
  }
  return { ok: false, why: sawHttpOnly ? 'http-only' : 'unreachable' };
}

// the node of one suggested link after one more player sent it (pure: used inside the Firebase transaction): one count per device, the 30 newest devices kept
const MAX_SUGGEST_DEVICES = 30;
function applySuggestion(current, suggestion, now) {
  const node = current && typeof current === 'object' ? { ...current } : {};
  node.u = suggestion.u; node.n = node.n || suggestion.n || ''; node.first = Number(node.first) || now; node.last = now;
  const devices = { ...(node.devices || {}) };
  if (!devices[suggestion.device]) node.count = (Number(node.count) || 0) + 1;
  devices[suggestion.device] = now;
  const keys = Object.keys(devices); if (keys.length > MAX_SUGGEST_DEVICES) keys.sort((a, b) => devices[a] - devices[b]).slice(0, keys.length - MAX_SUGGEST_DEVICES).forEach(key => { delete devices[key]; });
  node.devices = devices; return node;
}
exports.applySuggestion = applySuggestion;
exports.privateIp = privateIp; exports.assertPublic = assertPublic; exports.cleanStreamUrl = cleanStreamUrl; exports.hasQuery = hasQuery; exports.safeFetch = safeFetch; exports.parsePlaylist = parsePlaylist; exports.pageLinks = pageLinks;
exports.probeSafe = probeSafe; exports.resolveStation = resolveStation; exports.codecOf = codecOf; exports.MAX_URL = MAX_URL;
