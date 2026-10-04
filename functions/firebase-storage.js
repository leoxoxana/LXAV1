/**
 * Firebase Realtime Database storage
 * Free tier: 1GB storage, 10GB/month bandwidth
 * Perfect for multiplayer persistent storage
 */

const { getApps, initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

let app = null;
let db = null;

function initFirebase() {
  if (app) return;

  try {
    const DEFAULT_DB_URL = 'https://lxav1-a5cfd-default-rtdb.europe-west1.firebasedatabase.app';
    const envUrl = String(process.env.FIREBASE_DATABASE_URL || '').trim().replace(/^["']+|["']+$/g, '').replace(/\/+$/, '');
    const databaseURL = /^https:\/\/[^\s/]+\.firebasedatabase\.app$|^https:\/\/[^\s/]+\.firebaseio\.com$/.test(envUrl) ? envUrl : DEFAULT_DB_URL;
    const existingApps = getApps();

    // Initialize Firebase Admin app
    if (existingApps.length === 0) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        app = initializeApp({
          credential: cert(serviceAccount),
          databaseURL
        });
      } else {
        // Test mode without credentials
        app = initializeApp({
          databaseURL
        });
      }
    } else {
      app = existingApps[0];
    }

    // Get database reference
    db = getDatabase(app);
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Firebase init error:', error.message);
  }
}

// FAIL CLOSED: a failed read must never look like an empty database. Returning {} here used to make login answer
// "ID not found", and made `create` hand out an id that already exists (duplicate ids -> the wrong account answers a
// token check -> "session expired"). Callers now get an error (HTTP 500 "Server temporarily unavailable").
async function getAccounts() {
  try {
    initFirebase();
    if (!db) throw new Error('Firebase not initialized');
    const ref = db.ref('accounts');
    const snapshot = await ref.once('value');
    return snapshot.val() || {};
  } catch (error) {
    console.error('getAccounts error:', error.message);
    throw error;
  }
}

async function saveAccounts(accounts) {
  try {
    initFirebase();
    if (!db) throw new Error('Firebase not initialized');
    const ref = db.ref('accounts');
    await ref.set(accounts);
  } catch (error) {
    console.error('saveAccounts error:', error.message);
    throw error;
  }
}

// Atomically read-modify-write a single account. `mutate` receives the
// account's current server-side value (or null if it doesn't exist yet)
// and must return the new value to persist. Firebase retries `mutate`
// itself if the underlying value changed between read and write, so two
// concurrent requests for the SAME account (double-click spin, two tabs)
// can no longer silently overwrite each other's balance change.
async function updateAccount(accountKey, mutate) {
  initFirebase();
  if (!db) throw new Error('Firebase not initialized');
  const ref = db.ref(`accounts/${accountKey}`);
  const result = await ref.transaction(current => mutate(current || null));
  if (!result.committed) throw new Error('Account update did not commit');
  return result.snapshot.val();
}

// `strict` is for read-modify-write callers: if the read fails they must stop instead of saving a board built from {}
// (saveLeaderboard replaces the whole node). Plain display reads keep the old forgiving behaviour.
// Account ids come from an atomic counter (`meta/lastAccountId`) so two simultaneous `create` calls can never receive the same id
// (verified: 5 parallel creates all got id 12 when the id was computed as max(existing)+1 from a read). `floor` = highest id seen in
// `accounts`, so the counter can never fall behind existing accounts.
async function reserveAccountId(floor) {
  initFirebase();
  if (!db) throw new Error('Firebase not initialized');
  const result = await db.ref('meta/lastAccountId').transaction(current => Math.max(Number(current) || 0, Number(floor) || 0) + 1);
  if (!result.committed) throw new Error('Account id reservation did not commit');
  return result.snapshot.val();
}

// A name is claimed for 60 s with an atomic transaction (`meta/names/<digest>` = {id, at}) so two simultaneous `create` calls with the same name cannot both win.
// The permanent truth stays the accounts list (checked first); an old claim (>= 60 s) is simply taken over, so a failed create never blocks a name for long.
async function reserveName(digest, id, now = Date.now()) {
  initFirebase();
  if (!db) throw new Error('Firebase not initialized');
  const result = await db.ref(`meta/names/${digest}`).transaction(current => (!current || Number(current.id) === Number(id) || now - Number(current.at || 0) >= 60000) ? { id: Number(id), at: now } : undefined);
  return Boolean(result.committed);
}

// Radio list (functions/radio.js): the last good list is kept in `meta/radio` so a cold start or a Radio Browser outage never leaves the player empty.
async function getRadioCache() {
  initFirebase();
  if (!db) return null;
  const snapshot = await db.ref('meta/radio').once('value');
  return snapshot.val() || null;
}
async function saveRadioCache(data) {
  initFirebase();
  if (!db) throw new Error('Firebase not initialized');
  await db.ref('meta/radio').set(data);
}

// Radio health (functions/radio-reports.js): player reports per station (`radioReports/<key>`) and the owner's hide list (`meta/radioHide/<key>` = {u, n, at}).
async function updateRadioReport(key, mutate) {
  initFirebase();
  if (!db) throw new Error('Firebase not initialized');
  const result = await db.ref(`radioReports/${key}`).transaction(current => mutate(current || null));
  if (!result.committed) throw new Error('Radio report did not commit');
}
async function getRadioReports() {
  initFirebase();
  if (!db) return {};
  return (await db.ref('radioReports').once('value')).val() || {};
}
async function clearRadioReport(key) {
  initFirebase();
  if (!db) throw new Error('Firebase not initialized');
  await db.ref(`radioReports/${key}`).remove();
}
async function getRadioHidden() {
  initFirebase();
  if (!db) return {};
  return (await db.ref('meta/radioHide').once('value')).val() || {};
}
async function setRadioHidden(key, value) {
  initFirebase();
  if (!db) throw new Error('Firebase not initialized');
  if (value) await db.ref(`meta/radioHide/${key}`).set(value); else await db.ref(`meta/radioHide/${key}`).remove();
}

// Radio: the owner's moves (`meta/radioMove/<key>` = {u, n, cat, at}) and the players' stars (TOP): one membership node per device and station (`radioFavDev/<device>/<key>`) and ONE counter per station
// (`meta/radioFav/<key>`), so the list is served from a few hundred small numbers, never from per-player records.
async function getRadioMoves() {
  initFirebase();
  if (!db) return {};
  return (await db.ref('meta/radioMove').once('value')).val() || {};
}
async function setRadioMove(key, value) {
  initFirebase();
  if (!db) throw new Error('Firebase not initialized');
  if (value) await db.ref(`meta/radioMove/${key}`).set(value); else await db.ref(`meta/radioMove/${key}`).remove();
}
async function getRadioFavCounts() {
  initFirebase();
  if (!db) return {};
  return (await db.ref('meta/radioFav').once('value')).val() || {};
}
// Stations of the players: links they offered (`radioSuggest/<key>`, one node per link), links the owner rejected (`meta/radioReject/<key>`), stations the owner approved (`meta/radioCustom/<key>`),
// and a counter of suggestions per day (`meta/radioSuggestDay` = {day, n}) that keeps the whole thing bounded.
async function updateRadioSuggest(key, mutate) {
  initFirebase();
  if (!db) throw new Error('Firebase not initialized');
  const result = await db.ref(`radioSuggest/${key}`).transaction(current => mutate(current || null));
  if (!result.committed) throw new Error('Suggestion did not commit');
}
async function getRadioSuggest() { initFirebase(); if (!db) return {}; return (await db.ref('radioSuggest').once('value')).val() || {}; }
async function getRadioSuggestNode(key) { initFirebase(); if (!db) return null; return (await db.ref(`radioSuggest/${key}`).once('value')).val() || null; }
async function removeRadioSuggest(key) { initFirebase(); if (!db) throw new Error('Firebase not initialized'); await db.ref(`radioSuggest/${key}`).remove(); }
async function getRadioRejected() { initFirebase(); if (!db) return {}; return (await db.ref('meta/radioReject').once('value')).val() || {}; }
// a rejected link: the node keeps WHO sent it and WHAT it was (an old row is just the time stamp); the link never shows up again
async function addRadioReject(key, record) { initFirebase(); if (!db) throw new Error('Firebase not initialized'); await db.ref(`meta/radioReject/${key}`).set(record && typeof record === 'object' ? record : Date.now()); }
// the health of an APPROVED station (OK / DEGRADED / OFFLINE): only the `health` field changes, a station the owner removed meanwhile is NOT brought back
async function patchRadioCustomHealth(key, health) { initFirebase(); if (!db) throw new Error('Firebase not initialized'); await db.ref(`meta/radioCustom/${key}`).transaction(current => (current && current.u ? { ...current, health } : current)); }
async function getRadioCustoms() { initFirebase(); if (!db) return {}; return (await db.ref('meta/radioCustom').once('value')).val() || {}; }
async function setRadioCustom(key, value) { initFirebase(); if (!db) throw new Error('Firebase not initialized'); if (value) await db.ref(`meta/radioCustom/${key}`).set(value); else await db.ref(`meta/radioCustom/${key}`).remove(); }
async function bumpSuggestDay(day, max) {
  initFirebase();
  if (!db) throw new Error('Firebase not initialized');
  let allowed = false;
  await db.ref('meta/radioSuggestDay').transaction(current => { const same = current && current.day === day; const n = same ? Number(current.n) || 0 : 0; allowed = n < max; return allowed ? { day, n: n + 1 } : (same ? current : { day, n }); });
  return allowed;
}
const MAX_FAV_PER_DEVICE = 60;
async function setRadioFav(key, device, on) {
  initFirebase();
  if (!db) throw new Error('Firebase not initialized');
  if (on) { const mine = await db.ref(`radioFavDev/${device}`).once('value'); if (mine.numChildren() >= MAX_FAV_PER_DEVICE && !mine.hasChild(key)) return { changed: false }; }
  let before = null;
  await db.ref(`radioFavDev/${device}/${key}`).transaction(current => { before = current; return on ? 1 : null; });
  const changed = Boolean(before) !== Boolean(on);
  if (changed) await db.ref(`meta/radioFav/${key}`).transaction(current => { const next = Math.max(0, (Number(current) || 0) + (on ? 1 : -1)); return next || null; });
  return { changed };
}

async function getLeaderboard({ strict = false } = {}) {
  try {
    initFirebase();
    if (!db) throw new Error('Firebase not initialized');
    const ref = db.ref('leaderboard');
    const snapshot = await ref.once('value');
    return snapshot.val() || {};
  } catch (error) {
    console.error('getLeaderboard error:', error.message);
    if (strict) throw error;
    return {};
  }
}

async function saveLeaderboard(leaderboard) {
  try {
    initFirebase();
    if (!db) throw new Error('Firebase not initialized');
    const ref = db.ref('leaderboard');
    await ref.set(leaderboard);
  } catch (error) {
    console.error('saveLeaderboard error:', error.message);
    throw error;
  }
}

// Same `strict` rule as getLeaderboard: the admin save path merges into this value and replaces the whole node.
async function getRtpSettings({ strict = false } = {}) {
  try {
    initFirebase();
    if (!db) throw new Error('Firebase not initialized');
    const ref = db.ref('rtpSettings');
    const snapshot = await ref.once('value');
    return snapshot.val() || {};
  } catch (error) {
    console.error('getRtpSettings error:', error.message);
    if (strict) throw error;
    return {};
  }
}

async function saveRtpSettings(settings) {
  try {
    initFirebase();
    if (!db) throw new Error('Firebase not initialized');
    const ref = db.ref('rtpSettings');
    await ref.set(settings);
  } catch (error) {
    console.error('saveRtpSettings error:', error.message);
    throw error;
  }
}

module.exports = {
  getAccounts,
  saveAccounts,
  getLeaderboard,
  saveLeaderboard,
  updateAccount,
  reserveAccountId,
  reserveName,
  getRadioCache,
  saveRadioCache,
  updateRadioReport,
  getRadioReports,
  clearRadioReport,
  getRadioHidden,
  setRadioHidden,
  getRadioMoves,
  setRadioMove,
  getRadioFavCounts,
  setRadioFav,
  updateRadioSuggest,
  getRadioSuggest,
  removeRadioSuggest,
  getRadioSuggestNode,
  getRadioRejected,
  addRadioReject,
  patchRadioCustomHealth,
  getRadioCustoms,
  setRadioCustom,
  bumpSuggestDay,
  getRtpSettings,
  saveRtpSettings
};
