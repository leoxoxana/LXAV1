'use strict';
// POPULARITY of a station from OUTSIDE this site: (1) the votes people gave it in the public station directory (Radio Browser, all-time, the stable signal), (2) the listeners that the stream
// server itself reports right now / at its peak (Shoutcast v1 /7.html, Shoutcast v2 /stats, Icecast /status-json.xsl: 26 of 40 manele servers publish them). The stars of the players of this
// site are NOT used here (they feed the TOP category only).
const LISTENER_TIMEOUT_MS = 1800, LISTENER_PHASE_MS = 6000, MAX_CANDIDATES = 4;   // a stats page answers at once when it exists; a stream server that hangs is not worth waiting for

const count = value => { const n = Number(value); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0; };
function parseShoutcastJson(text) {
  try { const data = JSON.parse(text); if (data && (data.currentlisteners !== undefined || data.peaklisteners !== undefined)) return { now: count(data.currentlisteners), peak: count(data.peaklisteners) }; } catch (error) { /* not JSON */ }
  return null;
}
function parseShoutcastXml(text) {
  const now = /<CURRENTLISTENERS>\s*(\d+)\s*</i.exec(text), peak = /<PEAKLISTENERS>\s*(\d+)\s*</i.exec(text);
  return now || peak ? { now: count(now && now[1]), peak: count(peak && peak[1]) } : null;
}
function parseShoutcast7(text) {   // "CURRENT,STATUS,PEAK,MAX,UNIQUE,BITRATE,SONG" (the body of 7.html is wrapped in <HTML><BODY>..</BODY></HTML>)
  const body = /<body[^>]*>([^<]*)/i.exec(text), line = String(body ? body[1] : text).trim(), parts = line.split(',');
  return parts.length >= 6 && /^\d+$/.test(parts[0].trim()) && /^\d+$/.test(parts[2].trim()) ? { now: count(parts[0]), peak: count(parts[2]) } : null;
}
function parseIcecast(text, mount) {
  try {
    const stats = JSON.parse(text).icestats; if (!stats) return null; const list = [].concat(stats.source || []); if (!list.length) return null;
    const hit = list.find(source => String(source.listenurl || '').replace(/\/+$/, '').endsWith(mount)) || null;
    const pick = hit ? [hit] : list;   // the mount is not found by name: all mounts of the server together (one server, one audience)
    return { now: pick.reduce((sum, source) => sum + count(source.listeners), 0), peak: pick.reduce((sum, source) => sum + count(source.listener_peak), 0) };
  } catch (error) { return null; }
}
// every address the stats of this stream could be at, most common first
function statsUrls(streamUrl) {
  let url; try { url = new URL(streamUrl); } catch (error) { return []; }
  const base = url.origin, dir = url.pathname.replace(/\/[^/]*$/, '');
  const list = [{ u: base + '/status-json.xsl', kind: 'icecast' }, { u: base + '/stats?sid=1&json=1', kind: 'sc2json' }, { u: base + '/stats?sid=1', kind: 'sc2xml' }, { u: base + '/7.html', kind: 'sc1' }];
  if (dir) list.splice(2, 0, { u: base + dir + '/stats?sid=1&json=1', kind: 'sc2json' }, { u: base + dir + '/status-json.xsl', kind: 'icecast' });
  return list;
}
const parseBy = (kind, text, mount) => kind === 'icecast' ? parseIcecast(text, mount) : kind === 'sc2json' ? parseShoutcastJson(text) : kind === 'sc2xml' ? parseShoutcastXml(text) : parseShoutcast7(text);
// {now, peak} or null; `get(url, timeoutMs)` -> text or null is injectable for tests
async function fetchListeners(streamUrl, get) {
  let mount = ''; try { mount = new URL(streamUrl).pathname.replace(/\/+$/, ''); } catch (error) { return null; }
  for (const candidate of statsUrls(streamUrl).slice(0, MAX_CANDIDATES)) {
    let text = null; try { text = await get(candidate.u, LISTENER_TIMEOUT_MS); } catch (error) { text = null; }
    if (!text) continue;
    const parsed = parseBy(candidate.kind, text, mount); if (parsed) return parsed;
  }
  return null;
}
const defaultGet = async (url, timeoutMs) => {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  try { const response = await fetch(url, { signal: controller.signal, headers: { 'user-agent': 'LXAV1-radio/1.0 (+https://lxoxa.vercel.app)' } }); if (!response.ok) return null; return (await response.text()).slice(0, 6000); } catch (error) { return null; } finally { clearTimeout(timer); }
};
// listeners of many stations at once, with a time budget for the whole phase (a station that does not answer in time simply has no number)
async function collectListeners(urls, { get = defaultGet, now = Date.now, budgetMs = LISTENER_PHASE_MS, width = 24 } = {}) {
  // hosts that carry many stations (stream.zeno.fm: 13 of 74) and publish no numbers are skipped after two misses: the phase must stay short
  const out = new Map(), started = now(), misses = new Map(), hits = new Set(); let index = 0; const hostOf = url => { try { return new URL(url).host; } catch (error) { return url; } };
  await Promise.all(Array.from({ length: Math.min(width, urls.length) }, async () => { while (index < urls.length && now() - started < budgetMs) { const url = urls[index++], host = hostOf(url); if ((misses.get(host) || 0) >= 2 && !hits.has(host)) continue; const found = await fetchListeners(url, get); if (found) { out.set(url, found); hits.add(host); } else misses.set(host, (misses.get(host) || 0) + 1); } }));
  return out;
}
// the score: votes (stable, all-time) and listeners (what the stream server counts: the peak is a better "how big is this station" than a night-time snapshot) on a log scale, plus a small bonus for a decent bitrate
function popularity(station, listeners) {
  const votes = count(station.votes), heard = listeners ? Math.max(count(listeners.now), Math.round(count(listeners.peak) / 3)) : 0;
  return 2 * Math.log10(1 + votes) + 1.5 * Math.log10(1 + heard) + 0.5 * Math.log10(1 + count(station.clickcount)) + (Number(station.bitrate) >= 96 ? 0.2 : 0);
}
module.exports = { parseShoutcastJson, parseShoutcastXml, parseShoutcast7, parseIcecast, statsUrls, fetchListeners, collectListeners, popularity, LISTENER_PHASE_MS };
