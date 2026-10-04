'use strict';
// RADIO LIST for the compact player at the bottom of the page.
// Source: Radio Browser (community directory, no key). Pipeline: Romanian stations per category (tags + name), HTTPS + MP3/AAC + direct url_resolved only,
// de-duplicated, a REAL reachability probe (first bytes of audio), then - only where Romania has too few working stations - a few top-voted foreign ones.
// The result is cached in memory and in Firebase (meta/radio), so a Radio Browser outage never empties the player: the last good list is served instead.
const crypto = require('crypto'), fs = require('fs'), reports = require('./radio-reports'), custom = require('./radio-custom'), { popularity, collectListeners } = require('./radio-popularity');
// Version of the list builder = hash of this very file. A list stored (memory / Firebase) by a different version is rebuilt on the next request, so a deploy never keeps serving the list
// of the previous code for the 12 h freshness window (that is exactly what kept 39 manele stations on the live site after the fix was deployed).
const BUILDER_VERSION = (() => { try { return crypto.createHash('sha1').update(fs.readFileSync(__filename)).digest('hex').slice(0, 12); } catch (error) { return 'unknown'; } })();
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
const RECHECK_AFTER_MS = 3 * 3600 * 1000;     // the listed stations are probed again when the last check is older than this (asked by a player, decided here)
const RECHECK_BUDGET_MS = 22000, RECHECK_MAX_DROP = 0.4;
const BUILD_BUDGET_MS = 32000;               // the function may run 60 s (vercel.json): the probing stops here, then the listener phase (6 s), the Firebase write and the response

// not = stations that are about something else (news, talk, religion) never enter a music category
const CATEGORIES = [
  { id: 'manele', emoji: '🔥', label: 'MANELE', limits: { direct: 120, twins: 80, max: 120 }, pin: /trapanel|\btrap\b|t[e]?hno|techno|\belectro|\bhouse\b|minimal|\bclub\b|hip[ -]?hop|\bdj\b|remix|manele noi|manele vechi/i, re: /manele|manea|trapanel|petrecere|lautaresc|lăutăresc|taraf|folclor|folcloric|muzic[aă] popular[aă]|\betno\b|popular[aă]|\bfolk\b/i, queries: ['manele', 'petrecere', 'trapanele', 'lautareasca', 'folclor', 'populara', 'etno'], foreign: [] },
  // ETNO is derived: the stations of the MANELE pipeline that are not manele (folk / popular / ethno / party-only "populara"), see buildList. TOP (the players' favourites) is added when the list is served.
  { id: 'etno', emoji: '🎻', label: 'ETNO', derived: true },
  { id: 'rap', emoji: '🎤', label: 'RAP', re: /\brap\b|hip[ -]?hop|\btrap\b|urban|\br&b\b/i, queries: ['rap', 'hip hop', 'trap'], foreign: ['hip hop', 'rap'] },
  { id: 'house', emoji: '🪩', label: 'HOUSE', re: /\bhouse\b|deep house|progressive house/i, not: /tech[ -]?house/i, queries: ['house', 'deep house'], foreign: ['house', 'deep house'] },
  { id: 'techno', emoji: '⚡', label: 'TECHNO', re: /techno|minimal|tech[ -]?house|trance|\belectronic\b/i, queries: ['techno', 'minimal', 'trance', 'electronic'], foreign: ['techno', 'minimal'] },
  { id: 'dance', emoji: '🎉', label: 'DANCE', re: /\bdance\b|\bedm\b|\belectro\b|\bclub\b|eurodance/i, queries: ['dance', 'edm', 'club'], foreign: ['dance', 'edm'] },
  { id: 'pop', emoji: '🎵', label: 'POP', re: /\bpop\b|top ?40|top hits|\bhits\b|mainstream|\bcharts?\b/i, queries: ['pop', 'top 40', 'hits'], foreign: ['pop', 'top 40'] },
  { id: 'rock', emoji: '🎸', label: 'ROCK', re: /rock|alternative|\bmetal\b|punk|grunge/i, queries: ['rock', 'alternative', 'metal'], foreign: ['rock', 'classic rock'] },
  { id: 'chill', emoji: '🌴', label: 'CHILL', re: /chill|lounge|ambient|relax|downtempo|\bjazz\b|easy listening/i, queries: ['chillout', 'lounge', 'ambient', 'relax', 'jazz'], foreign: ['chillout', 'lounge'] },
  // the most listened music that was missing: 80s / 90s / oldies / classic hits (manele "vechi" and folk are not retro)
  { id: 'retro', emoji: '🕰', label: 'RETRO', re: /\b(70|80|90)'?s\b|oldies|retro|\bdisco\b|classic hits|\bgolden\b|nostalg|anii (70|80|90)/i, not: /manele|manea|trapanel|petrecere|folclor|popular/i, queries: ['oldies', '80s', '90s', '70s', 'retro', 'classic hits', 'disco'], foreign: ['oldies', '80s', '90s'] }
];
const NOT_MUSIC = /\bnews\b|\btalk\b|religio|cre[sș]tin|christian|gospel|\bsport|podcast|stiri|știri|biseric/i;

// Moderation without a fixed station list: RADIO_HIDE=word1,word2 (Vercel env) hides every station whose name contains one of the words.
const hiddenWords = () => String(process.env.RADIO_HIDE || '').toLowerCase().split(',').map(w => w.trim()).filter(Boolean);
const isHidden = station => { const name = String(station.name || '').toLowerCase(); return hiddenWords().some(word => name.includes(word)); };
// Hosts that are known NOT to play on the owner's phone although they answer this server's probe (Radio Marketescu on radiolize.com does not play even when its address is opened directly in Safari).
// No probe can see that (the server is in Frankfurt, the phone is not): the owner's report is the evidence. More hosts can be hidden without a deploy from admin > RADIO.
const BLOCKED_HOSTS = ['radiolize.com'];
const blockedUrl = url => { let host = ''; try { host = new URL(url).hostname.toLowerCase(); } catch (error) { return false; } return BLOCKED_HOSTS.some(blocked => host === blocked || host.endsWith('.' + blocked)); };
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
  return cleanName(station.name).length >= 2 && !isHidden(station) && !blockedUrl(streamUrl(station));
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
const topCategoriesBase = station => CATEGORIES.filter(category => !category.derived).map(category => ({ id: category.id, points: categoryScore(category, station) })).filter(item => item.points > 0).sort((a, b) => b.points - a.points).filter((item, index) => index === 0 || (index === 1 && item.points >= 2)).map(item => item.id);

// real reachability: the stream must answer 2xx with audio bytes (not an HTML error page, not HLS) - and it has to do so for TWO kinds of client:
// this server (plain request) and a phone (iPhone Safari headers: Range, icy-metadata). Some hosts answer a phone with an HTML page or nothing while a plain request works (found on the live list:
// Radio Pro Manele, Radio Noise Party, Replica Radio Rock, RadioClick): those never reach the player. The phone check runs only after the plain one passed (one connection at a time: tiny hosts limit listeners).
const PHONE_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const SERVER_HEADERS = { 'user-agent': USER_AGENT, 'icy-metadata': '0' }, PHONE_HEADERS = { 'user-agent': PHONE_AGENT, accept: '*/*', range: 'bytes=0-', 'icy-metadata': '1' };
async function probeOnce(url, timeoutMs, headers) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs), started = Date.now();
  const done = (ok, why) => ({ ok, why, ms: Date.now() - started });
  try {
    const response = await fetch(url, { signal: controller.signal, headers });
    const type = String(response.headers.get('content-type') || '').toLowerCase();
    if (!response.ok) { try { response.body && response.body.cancel(); } catch (error) { /* ignore */ } return done(false, 'http ' + response.status); }
    if (!/audio|mpeg|aac|ogg|octet-stream/.test(type) || /mpegurl/.test(type)) { try { response.body && response.body.cancel(); } catch (error) { /* ignore */ } return done(false, 'type ' + (type || 'none').slice(0, 30)); }
    const reader = response.body.getReader(), { value } = await reader.read();
    try { reader.cancel(); } catch (error) { /* ignore */ }
    if (!value || value.length <= 200) return done(false, 'no audio');
    if (value[0] === 0x3c) return done(false, 'html body');   // "<": a web page behind an audio content-type
    return done(true, 'ok');
  } catch (error) { return done(false, error && error.name === 'AbortError' ? 'timeout' : String((error && error.cause && error.cause.code) || (error && error.message) || 'error').slice(0, 40)); } finally { clearTimeout(timer); }
}
async function probeStream(url, timeoutMs = PROBE_TIMEOUT_MS) {
  if (!(await probeOnce(url, timeoutMs, SERVER_HEADERS)).ok) return false;
  return (await probeOnce(url, timeoutMs, PHONE_HEADERS)).ok;
}
// both kinds of request, with the reason: for the admin "test" button
async function diagnose(url, timeoutMs = PROBE_TIMEOUT_MS) {
  const server = await probeOnce(url, timeoutMs, SERVER_HEADERS), phone = await probeOnce(url, timeoutMs, PHONE_HEADERS);
  return { server, phone };
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
// the most listened stations of the whole world: the best by recent clicks and the best by votes
async function defaultFetchGlobal() {
  const lists = await Promise.all(['clickcount', 'votes'].map(order => radioBrowser(`/json/stations/search?hidebroken=true&order=${order}&reverse=true&limit=300`).catch(() => [])));
  return lists.flat();
}
async function defaultFetchRoAll() { return radioBrowser(`${base}&countrycode=RO&limit=1000`).catch(() => []); }
async function defaultFetchForeign(category) {
  const lists = await Promise.all(category.foreign.map(tag => radioBrowser(`/json/stations/search?hidebroken=true&order=votes&reverse=true&limit=80&tagExact=true&tag=${encodeURIComponent(tag)}`).catch(() => [])));
  return lists.flat();
}

const STYLE_BONUS = { trap: 1.2, new: 0.4 };   // added to the popularity score of a manele station (trap = trap / techno / electro / house / minimal / club / dj)
const ETNO_MAX = 60, GLOBAL_CANDIDATES = 160, GLOBAL_MAX = 40, GLOBAL_PER_COUNTRY = 4;   // folk / popular / ethno / party-only stations (tiers 3 and 4) are not manele: they go to ETNO
const maneleTier = item => { const s = item.s || []; if (s.includes('trap')) return 0; if (s.includes('folk') || s.includes('etno')) return 4; if (s.includes('new')) return 1; return item.m ? 2 : 3; };
const notManele = item => maneleTier(item) >= 3;
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
  // the directory queries of all categories run AT ONCE (they were one after the other: ~10 s of the 45 s the function may run)
  const fetched = new Map(await Promise.all(CATEGORIES.filter(category => !category.derived).map(async category => [category.id, await fetchRo(category)])));
  for (const category of CATEGORIES) {
    if (category.derived) continue;
    const raw = [...(fetched.get(category.id) || []).filter(s => String(s.countrycode || 'RO').toUpperCase() === 'RO'), ...roAll].filter(s => (usable(s) || upgradable(s)) && topCategories(s).includes(category.id));
    const unique = new Map(); for (const s of raw) { const key = s.stationuuid || streamKey(streamUrl(s)); if (!unique.has(key)) unique.set(key, s); }
    const ranked = [...unique.values()].sort((a, b) => score(b) - score(a));
    const limits = category.limits || {};
    const direct = ranked.filter(s => usable(s)).slice(0, limits.direct || PER_CATEGORY_CANDIDATES), twins = ranked.filter(s => !usable(s)).slice(0, limits.twins || PER_CATEGORY_TWINS);
    const pinned = category.pin ? ranked.filter(s => category.pin.test(textOf(s))) : [];   // rare wanted words (e.g. "trapanele") are always tried, whatever their click count
    const chosen = new Map(); for (const s of [...direct, ...twins, ...pinned]) { const key = s.stationuuid || streamKey(streamUrl(s)); if (!chosen.has(key)) chosen.set(key, pinned.includes(s) ? { ...upgraded(s), __pin: true } : upgraded(s)); }
    picked.set(category.id, [...chosen.values()].sort((a, b) => score(b) - score(a)));
  }
  // wanted (pinned) stations are probed FIRST, with the full timeout: they must not depend on how much of the time budget the bulk probing uses
  // GLOBAL: the most listened music stations of the whole world (any country), probed together with the rest
  const globalCandidates = [], seenGlobal = new Set();
  try { for (const s of (await (deps.fetchGlobal || defaultFetchGlobal)()).filter(s => usable(s) && !NOT_MUSIC.test(textOf(s))).sort((a, b) => score(b) - score(a))) { const key = streamKey(streamUrl(s)); if (seenGlobal.has(key)) continue; seenGlobal.add(key); globalCandidates.push(s); if (globalCandidates.length >= GLOBAL_CANDIDATES) break; } } catch (error) { /* no global list this time: the rest of the build is not affected */ }
  const everything = [...picked.values()].flat();
  await probeMany(everything.filter(s => s.__pin));
  await probeMany([...everything, ...globalCandidates]);
  // SECOND CHANCE: 20 probes at once can starve a slow but healthy stream (false negative, e.g. a TLS handshake that needs more than 3.5 s under load). The failures are tried again,
  // wanted (pinned) stations first, with the full timeout and only a few at a time. A station can only go from failed to working here, never the other way.
  const failed = [...new Map([...picked.values()].flat().filter(s => probed.get(streamUrl(s)) === false).map(s => [streamUrl(s), s])).values()].sort((a, b) => (b.__pin ? 1 : 0) - (a.__pin ? 1 : 0) || score(b) - score(a)).slice(0, SECOND_CHANCE_MAX);
  let again = 0; await Promise.all(Array.from({ length: 8 }, async () => { while (again < failed.length && !overBudget()) { const s = failed[again++]; if (await probe(streamUrl(s), PROBE_TIMEOUT_MS)) probed.set(streamUrl(s), true); } }));
  const result = []; let etnoItems = []; const stationOf = new Map();   // public item -> the directory record it came from (votes, clicks, bitrate for the popularity order)
  const collect = deps.collectListeners || (deps.probe ? async () => new Map() : collectListeners);   // (tests that inject their own probe never touch the network here)
  for (const category of CATEGORIES) {
    if (category.derived) {   // ETNO = what the MANELE pipeline found that is not manele (it comes right after MANELE in CATEGORIES)
      etnoItems.slice(0, 3).forEach(item => { item.top = 1; });
      result.push({ id: category.id, emoji: category.emoji, label: category.label, items: etnoItems }); continue;
    }
    const items = [], localKeys = new Set();
    const add = (station, foreign) => { const url = streamUrl(station), key = streamKey(url), nk = nameKey(station.name); if (localKeys.has(key) || localKeys.has('n:' + nk)) return false; localKeys.add(key); localKeys.add('n:' + nk); const item = publicItem(station, foreign, category.id); stationOf.set(item, station); items.push(item); return true; };
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
    // MANELE: the flame never goes to a folk / popular / ethno station (they are the last of the category, see below)
    if (category.id !== 'manele') items.filter(item => item.cc === 'RO').slice(0, 3).forEach(item => { item.top = 1; });
    if (category.id === 'manele') {
      // owner's decisions: folk / popular / ethno are not manele, they have their own category (ETNO); MANELE is ordered by POPULARITY FROM OUTSIDE this site (votes in the station directory + the listeners
      // the stream servers report, see radio-popularity.js), with a small bonus for the styles he likes (trap / techno / electro / house / minimal / club, then new) so a big plain station and a
      // big trap station are both near the top while a tiny trap station no longer beats a station with thousands of listeners. The flame = the three most popular manele.
      const listeners = overBudget() ? new Map() : await collect(items.map(item => item.u)).catch(() => new Map());
      const base = item => popularity(stationOf.get(item) || {}, listeners.get(item.u)), bonus = item => { const styles = item.s || []; return styles.includes('trap') ? STYLE_BONUS.trap : styles.includes('new') ? STYLE_BONUS.new : 0; };
      const real = items.filter(item => !notManele(item)).sort((a, b) => (base(b) + bonus(b)) - (base(a) + bonus(a)));
      real.filter(item => item.cc === 'RO').slice(0, 3).forEach(item => { item.top = 1; });
      etnoItems = items.filter(notManele).sort((a, b) => base(b) - base(a)).slice(0, ETNO_MAX); etnoItems.forEach(item => { delete item.s; delete item.top; delete item.m; });
      items.length = 0; items.push(...real);
    }
    result.push({ id: category.id, emoji: category.emoji, label: category.label, items });
  }
  // GLOBAL after the last category: the first GLOBAL_MAX candidates that really play (best score first)
  // (at most GLOBAL_PER_COUNTRY per country: the raw ranking is dominated by a few big radio countries and would show eight stations of Lagos in a row)
  const globalItems = [], globalKeys = new Set(), perCountry = new Map();
  for (const station of globalCandidates) {
    if (globalItems.length >= GLOBAL_MAX) break; const nk = nameKey(station.name), country = String(station.countrycode || '').toUpperCase();
    if (probed.get(streamUrl(station)) !== true || globalKeys.has(nk) || (perCountry.get(country) || 0) >= GLOBAL_PER_COUNTRY) continue;
    globalKeys.add(nk); perCountry.set(country, (perCountry.get(country) || 0) + 1); globalItems.push(publicItem(station, true, 'global'));
  }
  result.push({ id: 'global', emoji: '🌍', label: 'GLOBAL', items: globalItems });
  return { updatedAt: now(), cats: result };
}

// RE-CHECK: a station that worked at build time can die hours later (6 of 220 on the live list within a day). Every few hours the listed stations are probed again (the same strict two-client probe,
// failures get a second try) and the dead ones leave the list; they come back at the next full build if they work again. Nothing is ever ADDED here, and if more than 40 % "died" at once the cause is
// this server's own network, not the stations: nothing is removed. Stations that could not be probed in time stay.
async function recheckList(data, deps = {}) {
  const probe = deps.probe || probeStream, now = deps.now || Date.now, started = now(), overBudget = () => now() - started > RECHECK_BUDGET_MS;
  const urls = [...new Set(data.cats.flatMap(cat => cat.items.map(item => item.u)))], results = new Map();
  const run = async (list, width) => { let index = 0; await Promise.all(Array.from({ length: width }, async () => { while (index < list.length && !overBudget()) { const url = list[index++]; results.set(url, await probe(url, PROBE_TIMEOUT_MS)); } })); };
  await run(urls, 32);
  await run(urls.filter(url => results.get(url) === false), 8);   // second chance, fewer at a time
  const dead = new Set(urls.filter(url => results.get(url) === false));
  if (!dead.size || dead.size > urls.length * RECHECK_MAX_DROP) return { ...data, checkedAt: now() };
  const names = new Map(); data.cats.forEach(cat => cat.items.forEach(item => { if (dead.has(item.u)) names.set(item.u, item.n); }));
  const dropped = [...names].map(([u, n]) => ({ n, u, at: now() })).concat(Array.isArray(data.dropped) ? data.dropped : []).slice(0, 40);
  return { ...data, cats: data.cats.map(cat => ({ ...cat, items: cat.items.filter(item => !dead.has(item.u)) })), checkedAt: now(), dropped };
}

let memory = null, building = null, rechecking = null;
const total = data => (data && data.cats ? data.cats.reduce((n, c) => n + c.items.length, 0) : 0);
async function loadStored(storage) { try { return storage && storage.getRadioCache ? await storage.getRadioCache() : null; } catch (error) { return null; } }
async function saveStored(storage, data) { try { if (storage && storage.saveRadioCache) await storage.saveRadioCache(data); } catch (error) { /* the list still works from memory */ } }

async function getList({ refresh = false, recheck = false, storage, build = buildList, check = recheckList, now = Date.now } = {}) {
  if (!memory) memory = await loadStored(storage);
  const age = memory ? now() - Number(memory.updatedAt || 0) : Infinity;
  const needs = !memory || memory.v !== BUILDER_VERSION || age > MAX_AGE_MS || (refresh && age > MIN_REFRESH_MS);   // a list built by older code (or without a version) is never served as fresh
  if (!needs && recheck && now() - Number(memory.checkedAt || memory.updatedAt || 0) > RECHECK_AFTER_MS) {   // the server decides, whatever the client asks: nobody can force a re-check more often than this
    try {
      if (!rechecking) rechecking = check(memory).then(async data => { memory = data; await saveStored(storage, data); return data; }).finally(() => { rechecking = null; });
      return { data: await rechecking, stale: false, rechecked: true };
    } catch (error) { return { data: memory, stale: false }; }
  }
  if (!needs) return { data: memory, stale: false };
  try {
    if (!building) building = build().then(async data => { if (total(data) < 10) throw new Error('too few stations'); data.v = BUILDER_VERSION; memory = data; await saveStored(storage, data); return data; }).finally(() => { building = null; });
    return { data: await building, stale: false };
  } catch (error) {
    if (memory) return { data: memory, stale: true };   // Radio Browser down: keep serving the last good list
    throw error;
  }
}

const reply = (body, statusCode = 200, extra = {}) => ({ statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', ...extra }, body: JSON.stringify(body) });

// SERVING STATE: what the owner decides in admin > RADIO (hide list, moves of a station to another category) and what the players decide (the ⭐ counters of the TOP category).
// It is applied when the list is SERVED, so none of it needs a rebuild or a deploy. Read from Firebase, kept 30 s in memory (a failed read keeps the previous state).
const MOVE_TARGETS = ['manele', 'etno', 'rap', 'house', 'techno', 'dance', 'pop', 'rock', 'chill', 'retro'];   // the categories a station can be moved to (TOP and GLOBAL are computed)
const CUSTOM_TARGETS = [...MOVE_TARGETS, 'global', 'top'];   // a station of a player the owner approved can be put into ANY of the 12 categories
const MIN_FAV_VOTES = 2, TOP_MAX = 40;                                                                           // a station is in TOP from 2 players, the 40 most starred
let servingCache = null;
async function servingState(storage, now = Date.now()) {
  if (servingCache && now - servingCache.at < 30000) return servingCache.state;
  const before = servingCache && servingCache.state;
  const read = async (fn, old) => { try { return storage && storage[fn] ? ((await storage[fn]()) || {}) : {}; } catch (error) { return old || {}; } };
  const raw = { hidden: await read('getRadioHidden', before && before.raw.hidden), moves: await read('getRadioMoves', before && before.raw.moves), favs: await read('getRadioFavCounts', before && before.raw.favs), customs: await read('getRadioCustoms', before && before.raw.customs) };
  const state = { raw, hidden: new Set(Object.keys(raw.hidden)), moves: new Map(Object.entries(raw.moves).filter(([, v]) => v && MOVE_TARGETS.includes(v.cat)).map(([k, v]) => [k, v.cat])), favs: new Map(Object.entries(raw.favs).map(([k, v]) => [k, Number(v) || 0])), customs: Object.entries(raw.customs).filter(([, v]) => v && v.u && CUSTOM_TARGETS.includes(v.cat)).map(([key, v]) => ({ key, u: String(v.u), n: String(v.n || '').slice(0, 48), c: String(v.c || ''), b: Number(v.b) || 0, cat: v.cat, at: Number(v.at) || 0 })).sort((a, b) => b.at - a.at) };
  servingCache = { at: now, state }; return state;
}
const stripMarks = item => { const copy = { ...item }; delete copy.top; delete copy.s; delete copy.m; return copy; };
const servedList = (data, given) => {
  const state = given instanceof Set ? { hidden: given, moves: new Map(), favs: new Map() } : given;
  const rest = { ...data }; delete rest.dropped;   // `dropped` is for the admin, players do not need it
  const shown = item => !blockedUrl(item.u) && !state.hidden.has(reports.radioKey(item.u));   // blocked hosts also leave a list that was built before the block existed
  let cats = rest.cats.map(cat => ({ ...cat, items: cat.items.filter(shown) }));
  // STATIONS OF THE PLAYERS the owner approved: put at the top of the category he chose (any of the 12); a station with the same address that is in the list already is replaced by this one
  const customs = (state.customs || []).filter(custom => shown(custom)), topCustoms = [];
  if (customs.length) {
    const keys = new Set(customs.map(custom => streamKey(custom.u)));
    cats = cats.map(cat => ({ ...cat, items: cat.items.filter(item => !keys.has(streamKey(item.u))) }));
    for (const custom of [...customs].reverse()) { const item = { n: custom.n, u: custom.u, c: custom.c, b: custom.b, cc: '' }, cat = cats.find(c => c.id === custom.cat); if (custom.cat === 'top') topCustoms.unshift(item); else if (cat) cat.items = [item, ...cat.items]; }
  }
  const moves = new Map([...state.moves].filter(([, target]) => cats.some(cat => cat.id === target)));   // a move to a category that does not exist (any more) changes nothing
  if (moves.size) {   // a moved station leaves every category and goes to the TOP of its new one (without the flame: it is the owner's pick, not a ranking)
    const first = new Map(); for (const cat of cats) for (const item of cat.items) { const key = reports.radioKey(item.u); if (!first.has(key)) first.set(key, item); }
    cats = cats.map(cat => ({ ...cat, items: cat.items.filter(item => !moves.has(reports.radioKey(item.u))) }));
    for (const [key, target] of [...moves].reverse()) { const item = first.get(key), cat = cats.find(c => c.id === target); if (item && cat) cat.items = [stripMarks(item), ...cat.items]; }
  }
  // TOP = the stations the players starred, most starred first (a station needs MIN_FAV_VOTES players); only stations that are in the list right now
  const seen = new Map(); for (const cat of cats) for (const item of cat.items) if (!seen.has(item.u)) seen.set(item.u, item);
  const top = [...seen.values()].map(item => ({ item, votes: state.favs.get(reports.radioKey(item.u)) || 0 })).filter(row => row.votes >= MIN_FAV_VOTES).sort((a, b) => b.votes - a.votes || a.item.n.localeCompare(b.item.n)).slice(0, TOP_MAX).map(row => stripMarks(row.item));
  const topSeen = new Set(topCustoms.map(item => item.u)); cats.push({ id: 'top', emoji: '⭐', label: 'TOP', items: [...topCustoms, ...top.filter(item => !topSeen.has(item.u))] });
  return { ...rest, cats };
};
// every station of the list once, with the categories it is in (admin > RADIO > stations)
const stationIndex = (data, customs) => { const map = new Map(); for (const cat of (data && data.cats) || []) for (const item of cat.items) { const key = reports.radioKey(item.u); const row = map.get(key) || { key, u: item.u, n: item.n, c: item.c, b: item.b, cc: item.cc, cats: [] }; row.cats.push(cat.id); map.set(key, row); }
  for (const custom of customs || []) { const key = reports.radioKey(custom.u); if (!map.has(key)) map.set(key, { key, u: custom.u, n: custom.n, c: custom.c, b: custom.b, cc: '', cats: [custom.cat], custom: true }); }   // approved stations of players: they can be starred, reported, hidden, moved like any other
  return map; };

// POST {action:'report'}: a player says a station does not play (automatic after a failure, or the 🚩 button). Only stations of the current list are accepted, so the node count is bounded.
// POST {action:'fav', u, on, dev}: a player stars / un-stars a station (the counters feed the TOP category). One vote per device and station, 60 stars per device, 60 changes per hour.
async function handleFav(body, storage) {
  const u = String(body.u || ''), dev = String(body.dev || '');
  if (!/^https:\/\/[^\s]{4,400}$/i.test(u) || !/^[a-z0-9]{8,40}$/i.test(dev) || typeof body.on !== 'boolean') return reply({ error: 'Bad request.' }, 400, { 'cache-control': 'no-store' });
  const device = reports.deviceKey(dev);
  if (!reports.allow('fav' + device, Date.now(), 60)) return reply({ error: 'Too many changes.' }, 429, { 'cache-control': 'no-store' });
  if (!memory) memory = await loadStored(storage);
  if (!stationIndex(memory, (await servingState(storage)).customs).has(reports.radioKey(u))) return reply({ error: 'Unknown station.' }, 404, { 'cache-control': 'no-store' });
  try { const result = await storage.setRadioFav(reports.radioKey(u), device, body.on); servingCache = null; return reply({ ok: true, changed: Boolean(result && result.changed) }, 200, { 'cache-control': 'no-store' }); }
  catch (error) { return reply({ error: 'Not saved.' }, 503, { 'cache-control': 'no-store' }); }
}
// POST {action:'suggest', u, n, dev}: a player offers the link of HIS station to the owner (only when he taps 📨). Nothing becomes public by this: the owner decides in admin > RADIO > 📨.
// https links only, no user:password@, one row per link (the players who sent it are counted), 5 per hour per device, 200 per day for everybody, a rejected link is accepted silently and dropped.
async function handleSuggest(body, storage) {
  const u = custom.cleanStreamUrl(body.u), dev = String(body.dev || ''), name = String(body.n || '').replace(/[\p{Cc}<>]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!u || !/^https:/i.test(u) || !/^[a-z0-9]{8,40}$/i.test(dev)) return reply({ error: 'Bad request.' }, 400, { 'cache-control': 'no-store' });
  const device = reports.deviceKey(dev), key = reports.radioKey(u);
  if (!reports.allow('sug' + device, Date.now(), 5)) return reply({ error: 'Too many suggestions.' }, 429, { 'cache-control': 'no-store' });
  try {
    if (((await storage.getRadioRejected()) || {})[key]) return reply({ ok: true }, 200, { 'cache-control': 'no-store' });
    if (!memory) memory = await loadStored(storage);
    if (stationIndex(memory, (await servingState(storage)).customs).has(key)) return reply({ ok: true, known: true }, 200, { 'cache-control': 'no-store' });   // it is in the list already
    if (!(await storage.bumpSuggestDay(new Date().toISOString().slice(0, 10), 200))) return reply({ error: 'Too many suggestions today.' }, 429, { 'cache-control': 'no-store' });
    const now = Date.now(); await storage.updateRadioSuggest(key, current => custom.applySuggestion(current, { u, n: name, device }, now));
    return reply({ ok: true }, 200, { 'cache-control': 'no-store' });
  } catch (error) { return reply({ error: 'Not saved.' }, 503, { 'cache-control': 'no-store' }); }
}
async function handleReport(event, storage) {
  const raw = String(event.body || ''); if (raw.length > reports.MAX_BODY) return reply({ error: 'Too large.' }, 413, { 'cache-control': 'no-store' });
  let body; try { body = JSON.parse(raw || '{}'); } catch (error) { return reply({ error: 'Bad request.' }, 400, { 'cache-control': 'no-store' }); }
  if (body && body.action === 'fav') return handleFav(body, storage);
  if (body && body.action === 'suggest') return handleSuggest(body, storage);
  const headers = event.headers || {}, report = body && body.action === 'report' ? reports.cleanReport(body, headers['user-agent'] || headers['User-Agent']) : null;
  if (!report) return reply({ error: 'Bad request.' }, 400, { 'cache-control': 'no-store' });
  if (!reports.allow(report.dev)) return reply({ error: 'Too many reports.' }, 429, { 'cache-control': 'no-store' });
  if (!memory) memory = await loadStored(storage);
  const known = stationIndex(memory, (await servingState(storage)).customs).get(reports.radioKey(report.u));
  if (!known) return reply({ error: 'Unknown station.' }, 404, { 'cache-control': 'no-store' });
  const name = known.n, codec = `${known.c || ''}${known.b ? ' ' + known.b : ''}`.trim();
  try { const now = Date.now(); await storage.updateRadioReport(reports.radioKey(report.u), current => reports.applyReport(current, report, name, now, codec)); } catch (error) { return reply({ error: 'Report not saved.' }, 503, { 'cache-control': 'no-store' }); }
  return reply({ ok: true }, 200, { 'cache-control': 'no-store' });
}

let resolver = custom.resolveStation;   // replaceable in tests (no network)
exports.__setResolver = fn => { resolver = fn || custom.resolveStation; };
exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'Content-Type' }, body: '' };
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
  let storage = null; try { storage = require('./firebase-storage'); } catch (error) { storage = null; }
  if (event.httpMethod === 'POST') return handleReport(event, storage);
  const query = event.queryStringParameters || {};
  if (query.resolve !== undefined) {   // GET ?resolve=<what the player pasted>: a playlist / page / stream -> a stream address that plays (guarded: public addresses only), 12 per hour per visitor
    const headers = event.headers || {}, who = String(headers['x-vercel-forwarded-for'] || headers['x-forwarded-for'] || headers['X-Forwarded-For'] || 'anon').split(',')[0].trim();
    if (!reports.allow('res' + who, Date.now(), 12)) return reply({ ok: false, why: 'limit' }, 429, { 'cache-control': 'no-store' });
    try { return reply(await resolver(String(query.resolve)), 200, { 'cache-control': 'no-store' }); } catch (error) { return reply({ ok: false, why: 'error' }, 200, { 'cache-control': 'no-store' }); }
  }
  try {
    const { data, stale, rechecked } = await getList({ refresh: String(query.refresh || '') === '1', recheck: String(query.recheck || '') === '1', storage });
    const state = await servingState(storage);
    return reply({ ...servedList(data, state), stale }, 200, { 'cache-control': rechecked ? 'no-store' : stale ? 'public, s-maxage=60' : 'public, s-maxage=300, stale-while-revalidate=900' });
  } catch (error) {
    return reply({ error: 'Radio list temporarily unavailable.' }, 503, { 'cache-control': 'no-store' });
  }
};
exports.BUILDER_VERSION = BUILDER_VERSION; exports.blockedUrl = blockedUrl; exports.diagnose = diagnose; exports.recheckList = recheckList; exports.servedList = servedList; exports.stationIndex = stationIndex; exports.MOVE_TARGETS = MOVE_TARGETS; exports.CUSTOM_TARGETS = CUSTOM_TARGETS; exports.__resetHidden = () => { servingCache = null; }; exports.buildList = buildList; exports.getList = getList; exports.explicitManele = explicitManele; exports.styleOf = styleOf; exports.maneleTier = maneleTier; exports.isFolk = isFolk; exports.usable = usable; exports.upgradable = upgradable; exports.upgraded = upgraded; exports.inCategory = inCategory; exports.topCategories = topCategories; exports.categoryScore = categoryScore; exports.CATEGORIES = CATEGORIES; exports.probeStream = probeStream;
exports.__resetMemory = () => { memory = null; building = null; };
