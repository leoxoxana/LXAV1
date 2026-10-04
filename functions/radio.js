'use strict';
// RADIO LIST for the compact player at the bottom of the page.
// Source: Radio Browser (community directory, no key). Pipeline: Romanian stations per category (tags + name), HTTPS + MP3/AAC + direct url_resolved only,
// de-duplicated, a REAL reachability probe (first bytes of audio), then - only where Romania has too few working stations - a few top-voted foreign ones.
// The result is cached in memory and in Firebase (meta/radio), so a Radio Browser outage never empties the player: the last good list is served instead.
const SERVERS = ['https://de1.api.radio-browser.info', 'https://at1.api.radio-browser.info', 'https://nl1.api.radio-browser.info'];
const USER_AGENT = 'LXAV1-radio/1.0 (+https://lxoxa.vercel.app)';
const MAX_AGE_MS = 12 * 3600 * 1000;          // a stored list younger than this is served as is
const MIN_REFRESH_MS = 30 * 60 * 1000;        // ?refresh=1 (daily cron) cannot rebuild more often than this
const PER_CATEGORY_CANDIDATES = 35;           // best-scored https candidates per category that get probed
const PER_CATEGORY_TWINS = 15;                // plus this many best-scored http-only stations whose https twin is tried (separate slots: they must not push good https stations out)
const SECOND_CHANCE_MAX = 60;                 // failed probes that get a second try (pinned first, then best-scored)
const TWIN_TIMEOUT_MS = 3500;                 // a twin that does not answer quickly is not worth waiting for
const PER_CATEGORY_MAX = 60;                  // stations kept per category
const MIN_PER_CATEGORY = 10;                  // below this many Romanian stations, top foreign ones are added ...
const MAX_FOREIGN = 6;                        // ... but never more than this many per category
const PROBE_TIMEOUT_MS = 5000;
const BUILD_BUDGET_MS = 26000;                // the function may run 30 s (vercel.json): leave room for the Firebase write and the response

// not = stations that are about something else (news, talk, religion) never enter a music category
const CATEGORIES = [
  { id: 'manele', emoji: '🔥', label: 'MANELE', limits: { direct: 120, twins: 80, max: 120 }, pin: /trapanel|\btrap\b|t[e]?hno|techno|\belectro|\bhouse\b|minimal|\bclub\b|hip[ -]?hop|\bdj\b|remix|manele noi|manele vechi/i, re: /manele|manea|trapanel|petrecere|lautaresc|lăutăresc|taraf|folclor|folcloric|muzic[aă] popular[aă]/i, queries: ['manele', 'petrecere', 'trapanele', 'lautareasca'], foreign: [] },
  { id: 'rap', emoji: '🎤', label: 'RAP', re: /\brap\b|hip[ -]?hop|\btrap\b|urban|\br&b\b/i, queries: ['rap', 'hip hop', 'trap'], foreign: ['hip hop', 'rap'] },
  { id: 'house', emoji: '🪩', label: 'HOUSE', re: /\bhouse\b|deep house|progressive house/i, not: /tech[ -]?house/i, queries: ['house', 'deep house'], foreign: ['house', 'deep house'] },
  { id: 'techno', emoji: '⚡', label: 'TECHNO', re: /techno|minimal|tech[ -]?house|trance|\belectronic\b/i, queries: ['techno', 'minimal', 'trance', 'electronic'], foreign: ['techno', 'minimal'] },
  { id: 'dance', emoji: '🎉', label: 'DANCE', re: /\bdance\b|\bedm\b|\belectro\b|\bclub\b|eurodance/i, queries: ['dance', 'edm', 'club'], foreign: ['dance', 'edm'] },
  { id: 'pop', emoji: '🎵', label: 'POP', re: /\bpop\b|top ?40|top hits|\bhits\b|mainstream|\bcharts?\b/i, queries: ['pop', 'top 40', 'hits'], foreign: ['pop', 'top 40'] },
  { id: 'rock', emoji: '🎸', label: 'ROCK', re: /rock|alternative|\bmetal\b|punk|grunge/i, queries: ['rock', 'alternative', 'metal'], foreign: ['rock', 'classic rock'] },
  { id: 'chill', emoji: '🌴', label: 'CHILL', re: /chill|lounge|ambient|relax|downtempo|\bjazz\b|easy listening/i, queries: ['chillout', 'lounge', 'ambient', 'relax', 'jazz'], foreign: ['chillout', 'lounge'] }
];
const NOT_MUSIC = /\bnews\b|\btalk\b|religio|cre[sș]tin|christian|gospel|\bsport|podcast|stiri|știri|biseric/i;

// Moderation without a fixed station list: RADIO_HIDE=word1,word2 (Vercel env) hides every station whose name contains one of the words.
const hiddenWords = () => String(process.env.RADIO_HIDE || '').toLowerCase().split(',').map(w => w.trim()).filter(Boolean);
const isHidden = station => { const name = String(station.name || '').toLowerCase(); return hiddenWords().some(word => name.includes(word)); };
// STYLES of manele (only the MANELE category carries them). The directory has no tag for "trapanele" / "tehno manele" (1 station says so), so styles are recognised from the tags + name signals that really exist:
//  old = manele vechi / de aur / retro,  new = manele noi / hits,  trap = trap / techno / club / hip hop / dj / remix / edm / bass / electronic,  etno = etno / lautareasca / taraf / orient / balcan,
//  folk = muzica populara / folclor (the tag "populara" alone is only a party tag on ~45 manele stations: it counts together with "popular" in the name).
// TASTE ORDER inside MANELE (owner's decision: nothing that works is deleted, what he likes goes first, what he does not like goes last):
//   0 trap / techno / electro / house / minimal / club manele,  1 new manele,  2 manele (the word is in the tags or the name),  3 party-only (petrecere / populara without the word manele),  4 folk and ethno (last).
// Trap wins over folk / ethno (a club station that also has an ethno tag stays on top).
const STYLE_RES = { old: /manele vechi|manele de aur|\bvechi\b|\bretro\b|nostalg|oldies|\b90s\b/i, new: /manele noi|\bhits?\b|hituri|\b20[12][0-9]\b/i, trap: /trapanel|\btrap\b|t[e]?hno|techno|\belectro|\bhouse\b|minimal|\bclub\b|hip[ -]?hop|\bdj\b|remix|\bedm\b|\bbass\b/i, etno: /\betno\b|l[aă]utar|\btaraf\b|orient|balcan|damblagii/i };
const FOLK_TAGS = ['folclor', 'muzică populară', 'muzica populara', 'folclor românesc', 'folclor romanesc', 'muzică folclorică', 'muzica folclorica'];
const isFolk = station => { const tags = String(station.tags || '').toLowerCase().split(',').map(t => t.trim()).filter(Boolean); if (tags.length > 8 && !/folclor|folcloric/i.test(station.name || '')) return false;   // multi-genre stations are not folk stations (unless the name says folclor)
  return tags.some(t => FOLK_TAGS.includes(t)) || /folclor|folcloric/i.test(station.name || '') || (tags.some(t => t === 'populară' || t === 'populara') && /\bpopular\b/i.test(station.name || '')); };
const styleOf = station => { const text = `${station.tags || ''} ${station.name || ''}`, out = Object.keys(STYLE_RES).filter(key => STYLE_RES[key].test(text)); if (isFolk(station)) out.push('folk'); return out; };
const cleanName = value => String(value || '').replace(/[\p{Cc}<>]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 48);
const isHttps = url => /^https:\/\/[^\s]+$/i.test(String(url || ''));
const codecOf = station => { const c = String(station.codec || '').toUpperCase(); return c.startsWith('AAC') ? 'AAC' : c === 'MP3' ? 'MP3' : ''; };
const streamUrl = station => String(station.url_resolved || station.url || '').trim();
const textOf = station => `${station.tags || ''} ${station.name || ''}`;
const streamKey = url => { try { const u = new URL(url); return (u.hostname + u.pathname).toLowerCase().replace(/\/+$/, ''); } catch (error) { return url; } };
const nameKey = name => String(name || '').toLowerCase().replace(/[^a-z0-9ăâîșşțţ]+/g, '');

// a station must be a usable, direct, browser-playable stream
function usable(station) {
  const url = streamUrl(station);
  if (!isHttps(url) || /\.(pls|m3u8?|asx|xspf)(\?|$)/i.test(url)) return false;
  if (!codecOf(station)) return false;
  if (Number(station.hls) === 1) return false;
  if (Number(station.lastcheckok) !== 1) return false;
  if (Number(station.ssl_error) === 1) return false;
  return cleanName(station.name).length >= 2 && !isHidden(station);
}
// Many directory entries are plain http only, which a https page cannot play (mixed content). The very same address often answers over https too (e.g. the same port with TLS):
// such a station is kept as a candidate, its https twin is what gets probed and, if it really delivers audio, what the player uses. The player never receives an http url.
const httpsTwin = station => { const url = streamUrl(station); return /^http:\/\/[^\s]+$/i.test(url) ? 'https://' + url.slice(7) : ''; };
const upgradable = station => { const twin = httpsTwin(station); return Boolean(twin) && usable({ ...station, url_resolved: twin }); };
const upgraded = station => { const twin = httpsTwin(station); return twin ? { ...station, url_resolved: twin, url: twin, __twin: true } : station; };
const score = station => Math.log10(1 + (Number(station.clickcount) || 0)) * 2 + Math.log10(1 + (Number(station.votes) || 0)) + (Number(station.bitrate) >= 96 ? 1 : Number(station.bitrate) >= 64 ? .5 : 0) + (codecOf(station) === 'AAC' ? .2 : 0);
const inCategory = (category, station) => { const text = textOf(station); return category.re.test(text) && !(category.not && category.not.test(text)) && !(NOT_MUSIC.test(station.tags || '') && !/manele|petrecere/i.test(station.tags || '')); };

const tagList = station => String(station.tags || '').toLowerCase().split(',').map(tag => tag.trim()).filter(Boolean);
// how well a station fits a category: an exact query tag 3, a matching tag 2, a matching name 1 (0 = does not belong)
function categoryScore(category, station) {
  if (!inCategory(category, station)) return 0;
  let points = 0;
  for (const tag of tagList(station)) { if (category.queries.includes(tag)) points += 3; else if (category.re.test(tag)) points += 2; }
  if (category.re.test(station.name || '')) points += 1;
  return points || 1;
}
// at most two categories per station (a station tagged house + techno + dance + chill + pop is not shown in five lists)
// a station that says manele (tag or name) is always listed in MANELE, whatever else it is tagged (dance, house, club, ...), plus its best other category
const explicitManele = station => /manele|manea|trapanel/i.test(station.tags || '') || /manele|manea|trapanel/i.test(station.name || '');
const topCategories = station => explicitManele(station) && inCategory(CATEGORIES[0], station) ? ['manele', ...topCategoriesBase(station).filter(id => id !== 'manele').slice(0, 1)] : topCategoriesBase(station);
const topCategoriesBase = station => CATEGORIES.map(category => ({ id: category.id, points: categoryScore(category, station) })).filter(item => item.points > 0).sort((a, b) => b.points - a.points).filter((item, index) => index === 0 || (index === 1 && item.points >= 2)).map(item => item.id);

// real reachability: the stream must answer 2xx with audio bytes (not an HTML error page, not HLS)
async function probeStream(url, timeoutMs = PROBE_TIMEOUT_MS) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'user-agent': USER_AGENT, 'icy-metadata': '0' } });
    const type = String(response.headers.get('content-type') || '').toLowerCase();
    if (!response.ok || !/audio|mpeg|aac|ogg|octet-stream/.test(type) || /mpegurl/.test(type)) { try { response.body && response.body.cancel(); } catch (error) { /* ignore */ } return false; }
    const reader = response.body.getReader(), { value } = await reader.read();
    try { reader.cancel(); } catch (error) { /* ignore */ }
    return Boolean(value && value.length > 200);
  } catch (error) { return false; } finally { clearTimeout(timer); }
}

async function radioBrowser(path) {
  let lastError;
  for (const base of SERVERS) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 9000);
    try { const response = await fetch(base + path, { signal: controller.signal, headers: { 'user-agent': USER_AGENT } }); if (response.ok) { const data = await response.json(); if (Array.isArray(data)) return data; } lastError = new Error('bad response ' + response.status); }
    catch (error) { lastError = error; } finally { clearTimeout(timer); }
  }
  throw lastError || new Error('Radio Browser unavailable');
}

const base = '/json/stations/search?hidebroken=true&order=clickcount&reverse=true';
async function defaultFetchRo(category) {
  const lists = await Promise.all([...category.queries.map(tag => radioBrowser(`${base}&countrycode=RO&limit=300&tag=${encodeURIComponent(tag)}`).catch(() => []))]);
  return lists.flat();
}
async function defaultFetchRoAll() { return radioBrowser(`${base}&countrycode=RO&limit=1000`).catch(() => []); }
async function defaultFetchForeign(category) {
  const lists = await Promise.all(category.foreign.map(tag => radioBrowser(`/json/stations/search?hidebroken=true&order=votes&reverse=true&limit=80&tagExact=true&tag=${encodeURIComponent(tag)}`).catch(() => [])));
  return lists.flat();
}

const maneleTier = item => { const s = item.s || []; if (s.includes('trap')) return 0; if (s.includes('folk') || s.includes('etno')) return 4; if (s.includes('new')) return 1; return item.m ? 2 : 3; };
const publicItem = (station, foreign, categoryId) => {
  const item = { n: cleanName(station.name), u: streamUrl(station), c: codecOf(station), b: Math.round(Number(station.bitrate) || 0), cc: foreign ? String(station.countrycode || '').toUpperCase().slice(0, 2) : 'RO' };
  if (categoryId === 'manele' && !foreign) { const styles = styleOf(station); if (styles.length) item.s = styles; if (explicitManele(station)) item.m = 1; }
  return item;
};

// deps are injectable for tests
async function buildList(deps = {}) {
  const fetchRo = deps.fetchRo || defaultFetchRo, fetchRoAll = deps.fetchRoAll || defaultFetchRoAll, fetchForeign = deps.fetchForeign || defaultFetchForeign, probe = deps.probe || probeStream, now = deps.now || Date.now;
  const started = now();
  const overBudget = () => now() - started > BUILD_BUDGET_MS;
  const roAll = (await fetchRoAll()).filter(s => String(s.countrycode || 'RO').toUpperCase() === 'RO');
  const probed = new Map();   // stream url -> boolean
  const probeMany = async stations => {
    const queue = stations.filter(s => !probed.has(streamUrl(s))); let index = 0;
    await Promise.all(Array.from({ length: 32 }, async () => { while (index < queue.length && !overBudget()) { const s = queue[index++]; probed.set(streamUrl(s), await probe(streamUrl(s), s.__twin && !s.__pin ? TWIN_TIMEOUT_MS : PROBE_TIMEOUT_MS)); } }));
  };
  const picked = new Map();   // category id -> stations (raw), best first
  for (const category of CATEGORIES) {
    const raw = [...(await fetchRo(category)).filter(s => String(s.countrycode || 'RO').toUpperCase() === 'RO'), ...roAll].filter(s => (usable(s) || upgradable(s)) && topCategories(s).includes(category.id));
    const unique = new Map(); for (const s of raw) { const key = s.stationuuid || streamKey(streamUrl(s)); if (!unique.has(key)) unique.set(key, s); }
    const ranked = [...unique.values()].sort((a, b) => score(b) - score(a));
    const limits = category.limits || {};
    const direct = ranked.filter(s => usable(s)).slice(0, limits.direct || PER_CATEGORY_CANDIDATES), twins = ranked.filter(s => !usable(s)).slice(0, limits.twins || PER_CATEGORY_TWINS);
    const pinned = category.pin ? ranked.filter(s => category.pin.test(textOf(s))) : [];   // rare wanted words (e.g. "trapanele") are always tried, whatever their click count
    const chosen = new Map(); for (const s of [...direct, ...twins, ...pinned]) { const key = s.stationuuid || streamKey(streamUrl(s)); if (!chosen.has(key)) chosen.set(key, pinned.includes(s) ? { ...upgraded(s), __pin: true } : upgraded(s)); }
    picked.set(category.id, [...chosen.values()].sort((a, b) => score(b) - score(a)));
  }
  // wanted (pinned) stations are probed FIRST, with the full timeout: they must not depend on how much of the time budget the bulk probing uses
  const everything = [...picked.values()].flat();
  await probeMany(everything.filter(s => s.__pin));
  await probeMany(everything);
  // SECOND CHANCE: 20 probes at once can starve a slow but healthy stream (false negative, e.g. a TLS handshake that needs more than 3.5 s under load). The failures are tried again,
  // wanted (pinned) stations first, with the full timeout and only a few at a time. A station can only go from failed to working here, never the other way.
  const failed = [...new Map([...picked.values()].flat().filter(s => probed.get(streamUrl(s)) === false).map(s => [streamUrl(s), s])).values()].sort((a, b) => (b.__pin ? 1 : 0) - (a.__pin ? 1 : 0) || score(b) - score(a)).slice(0, SECOND_CHANCE_MAX);
  let again = 0; await Promise.all(Array.from({ length: 8 }, async () => { while (again < failed.length && !overBudget()) { const s = failed[again++]; if (await probe(streamUrl(s), PROBE_TIMEOUT_MS)) probed.set(streamUrl(s), true); } }));
  const result = [];
  for (const category of CATEGORIES) {
    const items = [], localKeys = new Set();
    const add = (station, foreign) => { const url = streamUrl(station), key = streamKey(url), nk = nameKey(station.name); if (localKeys.has(key) || localKeys.has('n:' + nk)) return false; localKeys.add(key); localKeys.add('n:' + nk); items.push(publicItem(station, foreign, category.id)); return true; };
    for (const station of picked.get(category.id)) { if (items.length >= ((category.limits || {}).max || PER_CATEGORY_MAX)) break; if (probed.get(streamUrl(station)) === true) add(station, false); }
    const romanian = items.length;
    if (romanian < MIN_PER_CATEGORY && category.foreign.length && !overBudget()) {
      const foreign = (await fetchForeign(category)).filter(s => String(s.countrycode || '').toUpperCase() !== 'RO' && usable(s) && Number(s.votes) >= 20).sort((a, b) => (Number(b.votes) || 0) - (Number(a.votes) || 0));
      const unique = new Map(); for (const s of foreign) if (!unique.has(streamKey(streamUrl(s)))) unique.set(streamKey(streamUrl(s)), s);
      const candidates = [...unique.values()].slice(0, 24);
      await probeMany(candidates);
      let added = 0;
      for (const station of candidates) { if (romanian + added >= MIN_PER_CATEGORY || added >= MAX_FOREIGN) break; if (probed.get(streamUrl(station)) === true && add(station, true)) added++; }
    }
    // the three best Romanian stations by quality (listeners / votes / bitrate) are flagged BEFORE the taste order is applied: the 🔥 means popular, not "first in the list"
    items.filter(item => item.cc === 'RO').slice(0, 3).forEach(item => { item.top = 1; });
    if (category.id === 'manele') items.sort((a, b) => maneleTier(a) - maneleTier(b));   // stable: inside a tier the quality order stays
    result.push({ id: category.id, emoji: category.emoji, label: category.label, items });
  }
  return { updatedAt: now(), cats: result };
}

let memory = null, building = null;
const total = data => (data && data.cats ? data.cats.reduce((n, c) => n + c.items.length, 0) : 0);
async function loadStored(storage) { try { return storage && storage.getRadioCache ? await storage.getRadioCache() : null; } catch (error) { return null; } }
async function saveStored(storage, data) { try { if (storage && storage.saveRadioCache) await storage.saveRadioCache(data); } catch (error) { /* the list still works from memory */ } }

async function getList({ refresh = false, storage, build = buildList, now = Date.now } = {}) {
  if (!memory) memory = await loadStored(storage);
  const age = memory ? now() - Number(memory.updatedAt || 0) : Infinity;
  const needs = !memory || age > MAX_AGE_MS || (refresh && age > MIN_REFRESH_MS);
  if (!needs) return { data: memory, stale: false };
  try {
    if (!building) building = build().then(async data => { if (total(data) < 10) throw new Error('too few stations'); memory = data; await saveStored(storage, data); return data; }).finally(() => { building = null; });
    return { data: await building, stale: false };
  } catch (error) {
    if (memory) return { data: memory, stale: true };   // Radio Browser down: keep serving the last good list
    throw error;
  }
}

const reply = (body, statusCode = 200, extra = {}) => ({ statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', ...extra }, body: JSON.stringify(body) });

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS' }, body: '' };
  if (event.httpMethod !== 'GET') return reply({ error: 'Method not allowed.' }, 405);
  let storage = null; try { storage = require('./firebase-storage'); } catch (error) { storage = null; }
  try {
    const { data, stale } = await getList({ refresh: String((event.queryStringParameters || {}).refresh || '') === '1', storage });
    return reply({ ...data, stale }, 200, { 'cache-control': stale ? 'public, s-maxage=60' : 'public, s-maxage=900, stale-while-revalidate=3600' });
  } catch (error) {
    return reply({ error: 'Radio list temporarily unavailable.' }, 503, { 'cache-control': 'no-store' });
  }
};
exports.buildList = buildList; exports.getList = getList; exports.explicitManele = explicitManele; exports.styleOf = styleOf; exports.maneleTier = maneleTier; exports.isFolk = isFolk; exports.usable = usable; exports.upgradable = upgradable; exports.upgraded = upgraded; exports.inCategory = inCategory; exports.topCategories = topCategories; exports.categoryScore = categoryScore; exports.CATEGORIES = CATEGORIES; exports.probeStream = probeStream;
exports.__resetMemory = () => { memory = null; building = null; };
