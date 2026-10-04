'use strict';
// BROWSE: any country + frequency search + auto scanner, built ONLY on real directory records (Radio Browser). The directory has NO frequency field: the frequency is read from the station NAME
// ("102.7 KIIS FM", "NDR 90,3", "Radio X 91.6 FM"); a station that does not write its frequency in its name cannot be found by frequency (real limit, shown to the player as such).
// One request per country page (up to 3 x 1000 stations, cached 6 h): a search or a whole scan reads the cache, so scanning never floods the directory.
// Same frequency != same station: stations are only merged when their canonical stream address is the same.
const PAGE = 1000, PAGES = 3, TTL = 6 * 3600 * 1000, CAP_RESULTS = 60, CAP_SCAN = 300;
const cache = new Map(); let countriesCache = null;
// every frequency written in a name: decimals with 1-2 digits ("97.5", "90,3") or an integer followed by FM / AM / MHz / kHz ("1008 AM"); returned as numbers
function freqsOf(name) {
  const text = String(name || ''), found = new Set();
  for (const m of text.matchAll(/(?<![\d.,])(\d{2,4})[.,](\d{1,2})(?![\d])/g)) found.add(Number(m[1] + '.' + m[2]));
  for (const m of text.matchAll(/(?<![\d.,])(\d{3,4})\s*(?:k?hz|am|mw)\b/gi)) found.add(Number(m[1]));
  return [...found].filter(n => n > 0);
}
const parseFreq = value => { const n = Number(String(value || '').trim().replace(',', '.')); return Number.isFinite(n) && n > 0 && n < 100000 ? n : null; };
const cleanCc = value => { const cc = String(value || '').trim().toUpperCase(); return /^[A-Z]{2}$/.test(cc) ? cc : ''; };
function create({ rb, usable, toItem, canonical, now = Date.now }) {
  async function countries() {
    if (countriesCache && now() - countriesCache.at < 24 * 3600 * 1000) return countriesCache.list;
    const raw = await rb('/json/countries');
    const list = raw.filter(c => cleanCc(c.iso_3166_1) && Number(c.stationcount) > 0).map(c => ({ cc: cleanCc(c.iso_3166_1), name: String(c.name || c.iso_3166_1).slice(0, 60), n: Number(c.stationcount) || 0 })).sort((a, b) => a.name.localeCompare(b.name));
    countriesCache = { at: now(), list }; return list;
  }
  async function stationsOf(cc) {
    const hit = cache.get(cc); if (hit && now() - hit.at < TTL) return hit.list;
    let all = [];
    for (let page = 0; page < PAGES; page++) {
      const part = await rb(`/json/stations/search?hidebroken=true&order=clickcount&reverse=true&countrycode=${cc}&limit=${PAGE}&offset=${page * PAGE}`);
      all = all.concat(part); if (part.length < PAGE) break;
    }
    const list = all.filter(usable).map(s => ({ s, f: freqsOf(s.name) })).filter(x => x.f.length);
    cache.set(cc, { at: now(), list }); return list;
  }
  const dedupe = rows => { const seen = new Set(), out = []; for (const row of rows) { const key = canonical(row.it.u) || row.it.u; if (seen.has(key)) continue; seen.add(key); out.push(row); } return out; };
  const itemOf = (s, f) => ({ ...toItem(s), f, st: String(s.state || '').slice(0, 40) });
  // exact frequency: all real stations of the country (or of the whole directory when cc is empty) that write exactly this frequency
  async function search(cc, freq) {
    const f = parseFreq(freq); if (f === null) return { error: 'bad-frequency' };
    let rows;
    if (cc) rows = (await stationsOf(cc)).filter(x => x.f.includes(f)).map(x => ({ it: itemOf(x.s, f), clicks: Number(x.s.clickcount) || 0 }));
    else {
      const variants = [...new Set([String(f), String(f).replace('.', ',')])], lists = await Promise.all(variants.map(v => rb(`/json/stations/search?hidebroken=true&order=clickcount&reverse=true&limit=200&name=${encodeURIComponent(v)}`).catch(() => [])));
      rows = lists.flat().filter(usable).filter(s => freqsOf(s.name).includes(f)).map(s => ({ it: itemOf(s, f), clicks: Number(s.clickcount) || 0 }));
    }
    return { cc, f, items: dedupe(rows.sort((a, b) => b.clicks - a.clicks)).slice(0, CAP_RESULTS).map(r => r.it) };
  }
  // scanner: every frequency of the range that has at least one real station, from the ONE cached country read (nothing is requested per frequency)
  async function scan(cc, from, to) {
    const a = parseFreq(from), b = parseFreq(to); if (!cc) return { error: 'country-required' }; if (a === null || b === null || b < a) return { error: 'bad-range' };
    const byFreq = new Map();
    for (const x of await stationsOf(cc)) for (const f of x.f) if (f >= a && f <= b) { if (!byFreq.has(f)) byFreq.set(f, []); byFreq.get(f).push({ it: itemOf(x.s, f), clicks: Number(x.s.clickcount) || 0 }); }
    const found = []; let count = 0;
    for (const f of [...byFreq.keys()].sort((x, y) => x - y)) { const items = dedupe(byFreq.get(f).sort((x, y) => y.clicks - x.clicks)).map(r => r.it); if (count + items.length > CAP_SCAN) break; count += items.length; found.push({ f, items }); }
    return { cc, from: a, to: b, found, total: count };
  }
  return { countries, search, scan, stationsOf };
}
exports.create = create; exports.freqsOf = freqsOf; exports.parseFreq = parseFreq; exports.cleanCc = cleanCc; exports.__reset = () => { cache.clear(); countriesCache = null; };
