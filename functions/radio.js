'use strict';
// RADIO LIST for the compact player at the bottom of the page.
// Source: Radio Browser (community directory, no key). Pipeline: Romanian stations per category (tags + name), HTTPS + MP3/AAC + direct url_resolved only,
// de-duplicated, a REAL reachability probe (first bytes of audio), then - only where Romania has too few working stations - a few top-voted foreign ones.
// The result is cached in memory and in Firebase (meta/radio), so a Radio Browser outage never empties the player: the last good list is served instead.
const SERVERS = ['https://de1.api.radio-browser.info', 'https://at1.api.radio-browser.info', 'https://nl1.api.radio-browser.info'];
const USER_AGENT = 'LXAV1-radio/1.0 (+https://lxoxa.vercel.app)';
const MAX_AGE_MS = 12 * 3600 * 1000;          // a stored list younger than this is served as is
const MIN_REFRESH_MS = 30 * 60 * 1000;        // ?refresh=1 (daily cron) cannot rebuild more often than this
const PER_CATEGORY_CANDIDATES = 45;           // best-scored candidates per category that get probed
const PER_CATEGORY_MAX = 60;                  // stations kept per category
const MIN_PER_CATEGORY = 10;                  // below this many Romanian stations, top foreign ones are added ...
const MAX_FOREIGN = 6;                        // ... but never more than this many per category
const PROBE_TIMEOUT_MS = 6000;
const BUILD_BUDGET_MS = 24000;

// not = stations that are about something else (news, talk, religion) never enter a music category
const CATEGORIES = [
  { id: 'manele', emoji: '🔥', label: 'MANELE', re: /manele|manea|trapanel|petrecere|lautaresc|lăutăresc|taraf/i, queries: ['manele', 'petrecere', 'trapanele', 'lautareasca'], foreign: [] },
  { id: 'rap', emoji: '🎤', label: 'RAP', re: /\brap\b|hip[ -]?hop|\btrap\b|urban|\br&b\b/i, queries: ['rap', 'hip hop', 'trap'], foreign: ['hip hop', 'rap'] },
  { id: 'house', emoji: '🪩', label: 'HOUSE', re: /\bhouse\b|deep house|progressive house/i, not: /tech[ -]?house/i, queries: ['house', 'deep house'], foreign: ['house', 'deep house'] },
  { id: 'techno', emoji: '⚡', label: 'TECHNO', re: /techno|minimal|tech[ -]?house|trance|\belectronic\b/i, queries: ['techno', 'minimal', 'trance', 'electronic'], foreign: ['techno', 'minimal'] },
  { id: 'dance', emoji: '🎉', label: 'DANCE', re: /\bdance\b|\bedm\b|\belectro\b|\bclub\b|eurodance/i, queries: ['dance', 'edm', 'club'], foreign: ['dance', 'edm'] },
  { id: 'pop', emoji: '🎵', label: 'POP', re: /\bpop\b|top ?40|top hits|\bhits\b|mainstream|\bcharts?\b/i, queries: ['pop', 'top 40', 'hits'], foreign: ['pop', 'top 40'] },
  { id: 'rock', emoji: '🎸', label: 'ROCK', re: /rock|alternative|\bmetal\b|punk|grunge/i, queries: ['rock', 'alternative', 'metal'], foreign: ['rock', 'classic rock'] },
  { id: 'chill', emoji: '🌴', label: 'CHILL', re: /chill|lounge|ambient|relax|downtempo|\bjazz\b|easy listening/i, queries: ['chillout', 'lounge', 'ambient', 'relax', 'jazz'], foreign: ['chillout', 'lounge'] }
];
const NOT_MUSIC = /\bnews\b|\btalk\b|religio|cre[sș]tin|christian|gospel|\bsport|podcast|stiri|știri|biseric/i;

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
  return cleanName(station.name).length >= 2;
}
const score = station => Math.log10(1 + (Number(station.clickcount) || 0)) * 2 + Math.log10(1 + (Number(station.votes) || 0)) + (Number(station.bitrate) >= 96 ? 1 : Number(station.bitrate) >= 64 ? .5 : 0) + (codecOf(station) === 'AAC' ? .2 : 0);
const inCategory = (category, station) => { const text = textOf(station); return category.re.test(text) && !(category.not && category.not.test(text)) && !(NOT_MUSIC.test(station.tags || '') && !/manele|petrecere/i.test(station.tags || '')); };

// real reachability: the stream must answer 2xx with audio bytes (not an HTML error page, not HLS)
async function probeStream(url) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
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

const publicItem = (station, foreign) => ({ n: cleanName(station.name), u: streamUrl(station), c: codecOf(station), b: Math.round(Number(station.bitrate) || 0), cc: foreign ? String(station.countrycode || '').toUpperCase().slice(0, 2) : 'RO' });

// deps are injectable for tests
async function buildList(deps = {}) {
  const fetchRo = deps.fetchRo || defaultFetchRo, fetchRoAll = deps.fetchRoAll || defaultFetchRoAll, fetchForeign = deps.fetchForeign || defaultFetchForeign, probe = deps.probe || probeStream, now = deps.now || Date.now;
  const started = now();
  const overBudget = () => now() - started > BUILD_BUDGET_MS;
  const roAll = (await fetchRoAll()).filter(s => String(s.countrycode || 'RO').toUpperCase() === 'RO');
  const probed = new Map();   // stream url -> boolean
  const probeMany = async stations => {
    const queue = stations.filter(s => !probed.has(streamUrl(s))); let index = 0;
    await Promise.all(Array.from({ length: 16 }, async () => { while (index < queue.length && !overBudget()) { const s = queue[index++]; probed.set(streamUrl(s), await probe(streamUrl(s))); } }));
  };
  const picked = new Map();   // category id -> stations (raw), best first
  for (const category of CATEGORIES) {
    const raw = [...(await fetchRo(category)).filter(s => String(s.countrycode || 'RO').toUpperCase() === 'RO'), ...roAll].filter(s => usable(s) && inCategory(category, s));
    const unique = new Map(); for (const s of raw) { const key = s.stationuuid || streamKey(streamUrl(s)); if (!unique.has(key)) unique.set(key, s); }
    picked.set(category.id, [...unique.values()].sort((a, b) => score(b) - score(a)).slice(0, PER_CATEGORY_CANDIDATES));
  }
  await probeMany([...picked.values()].flat());
  const result = [];
  for (const category of CATEGORIES) {
    const items = [], localKeys = new Set();
    const add = (station, foreign) => { const url = streamUrl(station), key = streamKey(url), nk = nameKey(station.name); if (localKeys.has(key) || localKeys.has('n:' + nk)) return false; localKeys.add(key); localKeys.add('n:' + nk); items.push(publicItem(station, foreign)); return true; };
    for (const station of picked.get(category.id)) { if (items.length >= PER_CATEGORY_MAX) break; if (probed.get(streamUrl(station)) === true) add(station, false); }
    const romanian = items.length;
    if (romanian < MIN_PER_CATEGORY && category.foreign.length && !overBudget()) {
      const foreign = (await fetchForeign(category)).filter(s => String(s.countrycode || '').toUpperCase() !== 'RO' && usable(s) && Number(s.votes) >= 20).sort((a, b) => (Number(b.votes) || 0) - (Number(a.votes) || 0));
      const unique = new Map(); for (const s of foreign) if (!unique.has(streamKey(streamUrl(s)))) unique.set(streamKey(streamUrl(s)), s);
      const candidates = [...unique.values()].slice(0, 24);
      await probeMany(candidates);
      let added = 0;
      for (const station of candidates) { if (romanian + added >= MIN_PER_CATEGORY || added >= MAX_FOREIGN) break; if (probed.get(streamUrl(station)) === true && add(station, true)) added++; }
    }
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
exports.buildList = buildList; exports.getList = getList; exports.usable = usable; exports.inCategory = inCategory; exports.CATEGORIES = CATEGORIES; exports.probeStream = probeStream;
exports.__resetMemory = () => { memory = null; building = null; };
