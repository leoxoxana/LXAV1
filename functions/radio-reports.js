'use strict';
// RADIO HEALTH: reports from the players ("this station does not play") and the owner's hide list.
// Anonymous: the player sends a random id that exists only in its own localStorage (hashed again here), never the account. Nothing here changes the list by itself:
// the reports are evidence for the owner (admin panel > RADIO), who hides a station with one tap (stored in Firebase, no deploy needed).
const crypto = require('crypto');

const DEDUPE_MS = 10 * 60 * 1000;        // the same device reporting the same station the same way within 10 min counts once
const MAX_DEVICES = 40;                  // devices remembered per station (oldest dropped): the node stays small
const MAX_BODY = 1500;
const LIMIT_PER_HOUR = 30, LIMIT_DEVICES = 5000;
const NETS = new Set(['slow-2g', '2g', '3g', '4g', '5g', 'wifi']);

const sha = (text, length) => crypto.createHash('sha1').update(String(text)).digest('hex').slice(0, length);
const radioKey = url => sha(url, 16);
const platformOf = agent => { const ua = String(agent || ''); return /iphone|ipad|ipod/i.test(ua) ? 'ios' : /android/i.test(ua) ? 'android' : /mobile/i.test(ua) ? 'mobile' : 'desktop'; };
const int = (value, min, max) => Math.max(min, Math.min(max, Math.round(Number(value) || 0)));

// body of POST /api/radio {action:'report', ...} -> a clean report or null
function cleanReport(raw, agent) {
  if (!raw || typeof raw !== 'object') return null;
  const u = String(raw.u || '');
  if (!/^https:\/\/[^\s]{4,400}$/i.test(u)) return null;
  if (raw.kind !== 'auto' && raw.kind !== 'manual') return null;
  if (!/^[a-z0-9]{8,40}$/i.test(String(raw.dev || ''))) return null;
  const code = /^[a-z0-9-]{1,12}$/.test(String(raw.code || '')) ? String(raw.code) : 'x';
  return { u, kind: raw.kind, code, dev: sha(String(raw.dev).toLowerCase(), 12), plat: platformOf(agent), net: NETS.has(String(raw.net)) ? String(raw.net) : '', ms: int(raw.ms, 0, 120000), ns: int(raw.ns, 0, 4), rs: int(raw.rs, 0, 4) };
}
const bump = (map, key) => { const out = { ...(map || {}) }; out[key] = (Number(out[key]) || 0) + 1; return out; };
// the node of one station after one more report (pure: used inside the Firebase transaction)
function applyReport(current, report, name, now, codec) {
  const node = current && typeof current === 'object' ? { ...current } : {};
  node.u = report.u; node.n = String(name || node.n || '').slice(0, 60); if (codec) node.c = String(codec).slice(0, 12); node.first = Number(node.first) || now; node.last = now;
  const devices = { ...(node.devices || {}) }, before = devices[report.dev], again = before && before.k === report.kind && now - Number(before.t || 0) < DEDUPE_MS;
  devices[report.dev] = { t: now, k: report.kind };
  const keys = Object.keys(devices); if (keys.length > MAX_DEVICES) keys.sort((a, b) => devices[a].t - devices[b].t).slice(0, keys.length - MAX_DEVICES).forEach(key => { delete devices[key]; });
  node.devices = devices;
  if (!again) {
    node.count = (Number(node.count) || 0) + 1; node[report.kind] = (Number(node[report.kind]) || 0) + 1;
    node.codes = bump(node.codes, report.code); node.plats = bump(node.plats, report.plat); if (report.net) node.nets = bump(node.nets, report.net);
    node.lastCode = report.code; node.lastPlat = report.plat; node.lastMs = report.ms; node.lastNs = report.ns; node.lastRs = report.rs;
  }
  return node;
}

// small per-instance limiter (the report endpoint is public): 30 reports / hour / device, and the table cannot grow without bound
const hits = new Map();
function allow(dev, now = Date.now()) {
  if (hits.size > LIMIT_DEVICES) hits.clear();
  const recent = (hits.get(dev) || []).filter(t => now - t < 3600000);
  if (recent.length >= LIMIT_PER_HOUR) { hits.set(dev, recent); return false; }
  recent.push(now); hits.set(dev, recent); return true;
}

// what the admin panel shows: the most reported stations first (distinct devices, then recency)
function summarize(reports, hidden, now = Date.now()) {
  const hiddenMap = hidden || {};
  const rows = Object.entries(reports || {}).filter(([, node]) => node && node.u).map(([key, node]) => ({
    key, n: String(node.n || ''), c: String(node.c || ''), u: String(node.u), devices: Object.keys(node.devices || {}).length, count: Number(node.count) || 0, auto: Number(node.auto) || 0, manual: Number(node.manual) || 0,
    last: Number(node.last) || 0, codes: node.codes || {}, plats: node.plats || {}, nets: node.nets || {}, lastCode: node.lastCode || '', lastMs: Number(node.lastMs) || 0, hidden: Boolean(hiddenMap[key]), ageH: Math.round((now - (Number(node.last) || 0)) / 3600000)
  }));
  rows.sort((a, b) => b.devices - a.devices || b.last - a.last);
  const hiddenRows = Object.entries(hiddenMap).filter(([, v]) => v && v.u).map(([key, v]) => ({ key, n: String(v.n || ''), u: String(v.u), at: Number(v.at) || 0 })).sort((a, b) => b.at - a.at);
  return { reports: rows.slice(0, 100), hidden: hiddenRows };
}

exports.DEDUPE_MS = DEDUPE_MS; exports.MAX_BODY = MAX_BODY; exports.radioKey = radioKey; exports.platformOf = platformOf; exports.cleanReport = cleanReport; exports.applyReport = applyReport; exports.allow = allow; exports.summarize = summarize;
exports.__resetLimiter = () => hits.clear();
