// Compact radio player (bottom of the page, above the Ko-fi goal bar). ONE audio element, the station list comes from /api/radio (Radio Browser, filtered + probed on the server).
// Nothing starts by itself: the list is fetched on the first tap, audio only plays after a tap. Station names are inserted with textContent (never as HTML).
(function () {
  'use strict';
  var bar = document.getElementById('radioBar');
  if (!bar) return;
  var $ = function (id) { return document.getElementById(id); };
  var playBtn = $('radioPlay'), prevBtn = $('radioPrev'), nextBtn = $('radioNext'), titleBtn = $('radioTitle'), nameEl = $('radioName'), statusEl = $('radioStatus'), volEl = $('radioVol'), toggleBtn = $('radioToggle'),
      panel = $('radioPanel'), catsEl = $('radioCats'), searchEl = $('radioSearch'), diceBtn = $('radioDice'), favBtn = $('radioFav'), recentBtn = $('radioRecent'), listEl = $('radioList'),
      sleepEl = $('radioSleep'), ecoEl = $('radioEco'), ecoLabel = $('radioEcoLabel'), msgEl = $('radioMsg'),
      addBtn = $('radioAddBtn'), addBox = $('radioAdd'), addUrl = $('radioAddUrl'), addName = $('radioAddName'), addGo = $('radioAddGo'), addClose = $('radioAddClose'), addMsg = $('radioAddMsg'), addCc = $('radioAddCc'), addF = $('radioAddF');
  var findItems = [];
  var KEY = 'lxa-radio-v1', LIST_KEY = 'lxa-radio-list-v3', BAD_KEY = 'lxa-radio-bad-v1', FAV_KEY = 'lxa-radio-fav-v1', RECENT_KEY = 'lxa-radio-recent-v1';
  var LIST_TTL = 30 * 60 * 1000, BAD_TTL = 24 * 3600 * 1000, ECO_KBPS = 96, MAX_FAV = 60, MAX_RECENT = 5;
  var TEXT = {
    de: { pick: 'Sender wählen', search: 'Suchen…', loading: 'Lädt…', none: 'Keine Sender gefunden.', fail: 'Radio-Liste nicht erreichbar.', broken: 'Sender nicht erreichbar – nächster…', allbroken: 'Kein Sender in dieser Kategorie erreichbar.', reconnect: 'Verbindet neu…', offline: 'Offline – wartet auf Netz', error: 'Fehler',
          play: 'Radio abspielen', pause: 'Radio pausieren', stations: 'Senderliste', volume: 'Lautstärke', prev: 'Vorheriger Sender', next: 'Nächster Sender', dice: 'Zufälliger Sender', fav: 'Favoriten', recent: 'Zuletzt gehört', noFav: 'Noch keine Favoriten – tippe ☆ bei einem Sender.', noRecent: 'Noch nichts gehört.', sleep: 'Einschlaf-Timer', eco: 'Eco ≤96 kbps', addFav: 'Zu Favoriten', delFav: 'Aus Favoriten', sleepDone: 'Gute Nacht – Radio aus', flag: 'Sender melden: funktioniert nicht', reported: 'Danke – gemeldet', noTop: 'Noch keine Lieblinge der Community – tippe ☆ bei einem Sender, ab 2 Spielern erscheint er hier.',
          add: 'Eigenen Sender hinzufügen', addGo: 'Hinzufügen und abspielen', addUrl: 'Link (https://…, .pls, .m3u)', addNamePh: 'Name (optional)', close: 'Schließen', removeMine: 'Aus meiner Liste entfernen',
          mAdded: 'Hinzugefügt', mQueued: 'Stream gültig – du kannst jetzt hören. Veröffentlichung erst nach Freigabe.', mKnown: 'Dieser Sender ist schon in der Liste.', mRejected: 'Gültiger Stream – wird aber nicht veröffentlicht.', mNoQueue: 'Gültig – heute aber nicht mehr an den Betreiber gesendet.', mHtml: 'Das ist eine Webseite, kein Stream.', mNoData: 'Der Server sendet keine Daten.', mDisc: 'Der Stream bricht sofort ab.', mUnstable: 'Der Stream ist zu instabil.', mTimeout: 'Zeitüberschreitung beim Verbinden.', mWarn: 'Hinweis: Aussetzer im Test', mBad: 'Das ist kein gültiger Link.', mBlocked: 'Dieser Link ist nicht erlaubt.', mUnreachable: 'Nicht erreichbar oder kein Radio-Stream.', mHttpOnly: 'Nur http: Der Browser blockiert ihn auf dieser Seite.', mNotAudio: 'Dort ist kein Audio-Stream zu finden.', mLimit: 'Zu viele Versuche – bitte später.', mFull: 'Maximal 10 eigene Sender.', mNoIos: 'Dieses Format (Ogg / FLAC) spielt das iPhone nicht ab.', mOffline: 'Keine Verbindung.' },
    ro: { pick: 'Alege o stație', search: 'Caută…', loading: 'Se încarcă…', none: 'Nicio stație găsită.', fail: 'Lista de radio nu e disponibilă.', broken: 'Stația nu răspunde – trec la următoarea…', allbroken: 'Nicio stație din această categorie nu răspunde.', reconnect: 'Se reconectează…', offline: 'Offline – aștept rețeaua', error: 'Eroare',
          play: 'Pornește radioul', pause: 'Oprește radioul', stations: 'Lista de stații', volume: 'Volum', prev: 'Stația anterioară', next: 'Stația următoare', dice: 'Stație la întâmplare', fav: 'Favorite', recent: 'Ascultate recent', noFav: 'Încă nu ai favorite – atinge ☆ la o stație.', noRecent: 'Încă n-ai ascultat nimic.', sleep: 'Cronometru de somn', eco: 'Eco ≤96 kbps', addFav: 'Adaugă la favorite', delFav: 'Scoate din favorite', sleepDone: 'Noapte bună – radio oprit', flag: 'Raportează: stația nu merge', reported: 'Mulțumim – raportat', noTop: 'Încă niciun favorit al comunității – atinge ☆ la o stație, de la 2 jucători apare aici.',
          add: 'Adaugă stația ta', addGo: 'Adaugă și pornește', addUrl: 'Link (https://…, .pls, .m3u)', addNamePh: 'Nume (opțional)', close: 'Închide', removeMine: 'Scoate din lista mea',
          mAdded: 'Adăugată', mQueued: 'Stream valid — poți asculta acum. Așteaptă aprobarea pentru publicare.', mKnown: 'Stația e deja în listă.', mRejected: 'Stream valid — dar nu va fi publicat.', mNoQueue: 'Valid — dar azi nu mai ajunge la administrator.', mHtml: 'Este o pagină web, nu un stream.', mNoData: 'Serverul nu trimite date.', mDisc: 'Streamul se întrerupe imediat.', mUnstable: 'Streamul este prea instabil.', mTimeout: 'Timp expirat la conectare.', mWarn: 'Atenție: întreruperi în test', mBad: 'Nu e un link valid.', mBlocked: 'Linkul nu e permis.', mUnreachable: 'Nu răspunde sau nu e un stream radio.', mHttpOnly: 'Doar http: browserul îl blochează pe acest site.', mNotAudio: 'Acolo nu am găsit un stream audio.', mLimit: 'Prea multe încercări – mai târziu.', mFull: 'Maximum 10 stații proprii.', mNoIos: 'Formatul (Ogg / FLAC) nu merge pe iPhone.', mOffline: 'Fără conexiune.' },
    en: { pick: 'Pick a station', search: 'Search…', loading: 'Loading…', none: 'No stations found.', fail: 'Radio list unavailable.', broken: 'Station not reachable – trying the next one…', allbroken: 'No station in this category is reachable.', reconnect: 'Reconnecting…', offline: 'Offline – waiting for network', error: 'Error',
          play: 'Play radio', pause: 'Pause radio', stations: 'Station list', volume: 'Volume', prev: 'Previous station', next: 'Next station', dice: 'Random station', fav: 'Favorites', recent: 'Recently played', noFav: 'No favorites yet – tap ☆ on a station.', noRecent: 'Nothing played yet.', sleep: 'Sleep timer', eco: 'Eco ≤96 kbps', addFav: 'Add to favorites', delFav: 'Remove from favorites', sleepDone: 'Good night – radio off', flag: 'Report: station does not work', reported: 'Thanks – reported', noTop: 'No community favourites yet – tap ☆ on a station, from 2 players it shows up here.',
          add: 'Add your own station', addGo: 'Add and play', addUrl: 'Link (https://…, .pls, .m3u)', addNamePh: 'Name (optional)', close: 'Close', removeMine: 'Remove from my list',
          mAdded: 'Added', mQueued: 'Stream valid — you can listen now. It is published only after approval.', mKnown: 'This station is already in the list.', mRejected: 'Valid stream — but it will not be published.', mNoQueue: 'Valid — but not sent to the owner any more today.', mHtml: 'That is a web page, not a stream.', mNoData: 'The server sends no data.', mDisc: 'The stream disconnects right away.', mUnstable: 'The stream is too unstable.', mTimeout: 'Connection timed out.', mWarn: 'Note: dropouts during the test', mBad: 'That is not a valid link.', mBlocked: 'This link is not allowed.', mUnreachable: 'Not reachable or not a radio stream.', mHttpOnly: 'http only: the browser blocks it on this site.', mNotAudio: 'No audio stream found there.', mLimit: 'Too many tries – later.', mFull: 'At most 10 own stations.', mNoIos: 'This format (Ogg / FLAC) does not play on iPhone.', mOffline: 'No connection.' }
  };
  TEXT.de.mBadF = 'Ungültige Frequenz (nur eine Zahl, z. B. 97.5).'; TEXT.ro.mBadF = 'Frecvență invalidă (doar un număr, ex. 97.5).'; TEXT.en.mBadF = 'Invalid frequency (a number only, e.g. 97.5).';
  var L = function () { var l = typeof lang === 'string' ? lang : ''; if (!TEXT[l]) { try { l = localStorage.getItem('lxaLang') || ''; } catch (e) { l = ''; } } return TEXT[l] || TEXT.de; };
  var store = {
    get: function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };

  var audio = null;                    // created at the first play: the ONE audio element
  var data = null, view = 'cat' /* cat | fav | recent */, catId = 'pop', current = null /* {cat, i} */, state = 'idle', statusKey = '', failTimer = 0, tries = 0, retried = false, waitOnline = false, loadingList = null;
  var stat = { retry: 0, skip: 0, report: 0 };   // diagnostics (window.LXARadio.stats)
  var attemptSeq = 0, handledAttempt = 0;   // every (re)start of a stream is one attempt; the error event AND the play() rejection of the same attempt count once
  var sleepTimer = 0, sleepTick = 0, sleepEnd = 0, lastDir = 1;   // lastDir: a dead station is skipped in the direction the listener was going (⏮ keeps going back)
  var saved = store.get(KEY, {}); if (!saved || typeof saved !== 'object') saved = {};
  var eco = saved.eco === true;
  var SPECIAL_ICON = { manele: '🔥', rap: '🎤', house: '🪩', techno: '⚡', dance: '🎉', pop: '🌟', rock: '🤘', chill: '🌴', retro: '📼', global: '🌍' };   // the mark of the special stations (flag top from the server) differs per category; FOLK has none
  var STYLE_ICON = { trap: '⚡', old: '🕰', 'new': '✨' };   // small style marks in the rows; the ORDER inside MANELE (trap / techno first, folk / ethno last) comes from the server, there is no style filter
  if (saved.cat) catId = saved.cat;
  if (typeof saved.vol === 'number') volEl.value = String(Math.max(0, Math.min(100, saved.vol)));
  ecoEl.checked = eco;

  var safeUrl = function (u) { return typeof u === 'string' && /^https:\/\/[^\s]+$/i.test(u); };
  var cleanItem = function (i) {
    if (!(i && safeUrl(i.u) && typeof i.n === 'string')) return null;
    var o = { n: i.n.slice(0, 60), u: i.u, c: String(i.c || ''), b: Number(i.b) || 0, cc: String(i.cc || '').slice(0, 2) };
    if (Array.isArray(i.s)) { var st = i.s.filter(function (x) { return typeof x === 'string' && STYLE_ICON[x]; }).slice(0, 5); if (st.length) o.s = st; }
    if (i.top) o.top = 1;
    return o;
  };
  var persist = function () { var it = currentItem(); store.set(KEY, { cat: catId, url: it ? it.u : saved.url, name: it ? it.n : saved.name, vol: Number(volEl.value), eco: eco }); };

  // ---- device memory: favorites, recent, stations that failed here in the last 24 h
  // ---- MY stations: the links the player brought himself (private: they stay on this device; they sit at the top of ⭐ Favorites, marked 🔗). Max 10.
  var MINE_KEY = 'lxa-radio-mine-v1', MAX_MINE = 10;
  var mine = function () { return store.get(MINE_KEY, []).map(function (i) { var o = cleanItem(i); if (o) o.mine = 1; return o; }).filter(Boolean).slice(0, MAX_MINE); };
  var saveMine = function (item) { var list = mine().filter(function (m) { return m.u !== item.u; }); list.unshift(item); store.set(MINE_KEY, list.slice(0, MAX_MINE)); };
  var removeMine = function (u) { store.set(MINE_KEY, mine().filter(function (m) { return m.u !== u; })); };
  var favs = function () { return store.get(FAV_KEY, []).map(cleanItem).filter(Boolean); };
  var recents = function () { return store.get(RECENT_KEY, []).map(cleanItem).filter(Boolean); };
  var isFav = function (u) { return favs().some(function (f) { return f.u === u; }); };
  var bad = function () { var m = store.get(BAD_KEY, {}), now = Date.now(), out = {}; Object.keys(m).forEach(function (u) { if (now - m[u] < BAD_TTL) out[u] = m[u]; }); return out; };
  var isBad = function (u) { return !!bad()[u]; };
  var markBad = function (u) { var m = bad(); m[u] = Date.now(); store.set(BAD_KEY, m); };
  var clearBad = function (u) { var m = bad(); if (m[u]) { delete m[u]; store.set(BAD_KEY, m); } };
  // ---- health reports: a station that keeps failing is reported by itself (after the retry), and the 🚩 button reports by hand. Anonymous: only a random id that never leaves this device's storage
  // except as a hash on the server; no account data. The reports are evidence for the owner (admin panel > RADIO), nothing changes by itself.
  var REPORT_KEY = 'lxa-radio-rep-v1', DEV_KEY = 'lxa-radio-dev-v1', REPORT_TTL = 6 * 3600 * 1000, RECHECK_AFTER = 3 * 3600 * 1000;
  var flagBtn = $('radioFlag'), toastKey = '', toastTimer = 0, attemptAt = 0, failCode = '', rechecked = false;
  var deviceId = function () {
    var id = store.get(DEV_KEY, ''); if (typeof id === 'string' && /^[a-z0-9]{12,40}$/.test(id)) return id;
    id = ''; try { var b = new Uint8Array(10); crypto.getRandomValues(b); for (var k = 0; k < b.length; k++) id += ('0' + b[k].toString(16)).slice(-2); } catch (e) { id = (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + '000000000000').slice(0, 20); }
    store.set(DEV_KEY, id); return id;
  };
  var reportedMap = function () { var m = store.get(REPORT_KEY, {}), now = Date.now(), out = {}; Object.keys(m).forEach(function (k) { if (now - m[k] < REPORT_TTL) out[k] = m[k]; }); return out; };
  function sendReport(item, kind, code) {
    if (!item || !safeUrl(item.u)) return;
    var key = kind + ' ' + item.u, seen = reportedMap(); if (seen[key]) return;   // the same station, the same way: once per 6 h per device
    seen[key] = Date.now(); store.set(REPORT_KEY, seen); stat.report++;
    var net = navigator.connection && navigator.connection.effectiveType;
    var body = { action: 'report', u: item.u, kind: kind, code: code, dev: deviceId(), net: net || '', ms: attemptAt ? Date.now() - attemptAt : 0, ns: audio ? audio.networkState : 0, rs: audio ? audio.readyState : 0 };
    try { fetch('/api/radio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(function () { /* a lost report is no problem */ }); } catch (e) { /* ignore */ }
  }
  // the ⭐ of a station is also one vote for the TOP category (the stations most starred by the players): one request per tap, the server keeps a counter per station, never a list per player
  function sendFav(item, on) {
    if (!item || !safeUrl(item.u)) return;
    try { fetch('/api/radio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'fav', u: item.u, on: !!on, dev: deviceId() }), keepalive: true }).catch(function () { /* a lost vote is no problem */ }); } catch (e) { /* ignore */ }
  }
  function toast(key) { toastKey = key; clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastKey = ''; renderStatus(); }, 2500); renderStatus(); }
  function toggleFav(item) { var list = favs(); var at = -1; list.forEach(function (f, i) { if (f.u === item.u) at = i; }); if (at >= 0) list.splice(at, 1); else list.unshift(item); store.set(FAV_KEY, list.slice(0, MAX_FAV)); sendFav(item, at < 0); }
  function addRecent(item) { var list = recents().filter(function (r) { return r.u !== item.u; }); list.unshift(item); store.set(RECENT_KEY, list.slice(0, MAX_RECENT)); }

  // ---- lists: real categories (from the server) + the two device lists; eco keeps stations up to 96 kbps (unless that would leave almost nothing)
  var ecoFilter = function (items) { var small = items.filter(function (i) { return !i.b || i.b <= ECO_KBPS; }); return small.length >= 3 ? small : items; };
  function catRaw(id) { var c = data && data.cats.filter(function (x) { return x.id === id; })[0]; return c ? (eco ? { id: c.id, emoji: c.emoji, label: c.label, items: ecoFilter(c.items) } : c) : null; }
  function cat(id) {
    if (id === 'fav') { var mineItems = mine(), starred = favs().filter(function (f) { return !mineItems.some(function (m) { return m.u === f.u; }); }); return { id: 'fav', items: mineItems.concat(starred) }; }   // MY stations first, then the stars
    if (id === 'recent') return { id: 'recent', items: recents() };
    if (id === 'find') return { id: 'find', items: findItems };
    var c = catRaw(id); if (!c) return null;
    return c;
  }
  var indexOfUrl = function (items, u) { for (var k = 0; k < items.length; k++) if (items[k].u === u) return k; return -1; };
  var curIndex = function () { var c = current && cat(current.cat); return c ? indexOfUrl(c.items, current.u) : -1; };
  // the station that is playing; if a filter hides it from the list it is still known (current.item), so the bar keeps its name
  var currentItem = function () { if (!current) return undefined; var c = cat(current.cat), k = c ? indexOfUrl(c.items, current.u) : -1; if (k >= 0) { current.i = k; return c.items[k]; } return current.item; };
  var activeCatKey = function () { return view === 'cat' ? catId : view; };

  // ---- status line (second line of the closed bar) and play button
  function setState(next, key) {
    state = next; statusKey = key || ''; bar.setAttribute('data-state', next);
    var playing = next === 'playing' || next === 'loading';
    playBtn.textContent = playing ? '⏸' : '▶'; playBtn.setAttribute('aria-label', playing ? L().pause : L().play);
    renderStatus();
  }
  function renderStatus() {
    var t = toastKey ? L()[toastKey] : statusKey ? L()[statusKey] : '';
    if (!t && sleepEnd) { var min = Math.max(1, Math.ceil((sleepEnd - Date.now()) / 60000)); t = '⏲ ' + min + ' min'; }
    statusEl.textContent = t || '';
    bar.classList.toggle('has-status', !!t);
    msgEl.textContent = statusKey === 'broken' || statusKey === 'allbroken' || statusKey === 'offline' || statusKey === 'fail' ? L()[statusKey] : '';
  }
  function label() { var item = currentItem(); nameEl.textContent = item ? item.n : (saved.name || L().pick); if (flagBtn) flagBtn.hidden = !item; }
  function applyText() {
    searchEl.placeholder = L().search; toggleBtn.setAttribute('aria-label', L().stations); volEl.setAttribute('aria-label', L().volume); prevBtn.setAttribute('aria-label', L().prev); nextBtn.setAttribute('aria-label', L().next);
    diceBtn.setAttribute('aria-label', L().dice); diceBtn.title = L().dice; favBtn.setAttribute('aria-label', L().fav); favBtn.title = L().fav; recentBtn.setAttribute('aria-label', L().recent); recentBtn.title = L().recent;
    if (flagBtn) { flagBtn.setAttribute('aria-label', L().flag); flagBtn.title = L().flag; }
    addBtn.setAttribute('aria-label', L().add); addBtn.title = L().add; addGo.setAttribute('aria-label', L().addGo); addGo.title = L().addGo; addClose.setAttribute('aria-label', L().close); addClose.title = L().close;
    addUrl.placeholder = L().addUrl; addUrl.setAttribute('aria-label', L().addUrl); addName.placeholder = L().addNamePh; addName.setAttribute('aria-label', L().addNamePh);
    sleepEl.setAttribute('aria-label', L().sleep); sleepEl.title = L().sleep; ecoLabel.textContent = L().eco; setState(state, statusKey); label(); if (data && !panel.hidden) renderList();
  }

  // ---- list from the server
  function normalize(json) {
    if (!json || !Array.isArray(json.cats)) throw new Error('bad list');
    json.cats = json.cats.map(function (c) { return { id: String(c.id), emoji: String(c.emoji || ''), label: String(c.label || c.id), items: (Array.isArray(c.items) ? c.items : []).map(cleanItem).filter(Boolean) }; });
    json.at = Date.now(); return json;
  }
  // a station that worked when the list was built can die hours later: when the last check of the server is old, ask it to probe the listed stations again (once per page load; the server decides
  // whether it is really due). The answer replaces the list quietly; what is playing keeps playing.
  function maybeRecheck(json) {
    var checked = Number(json.checkedAt || json.updatedAt) || 0; if (rechecked || !checked || Date.now() - checked < RECHECK_AFTER) return;
    rechecked = true;
    fetch('/api/radio?recheck=1', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j) return; data = normalize(j); store.set(LIST_KEY, data);
      if (!panel.hidden && view !== 'fav' && view !== 'recent') { renderCats(); renderList(); }
    }).catch(function () { /* the list stays as it was */ });
  }
  function fetchList() {
    if (data && Date.now() - data.at < LIST_TTL) return Promise.resolve(data);
    if (loadingList) return loadingList;
    var cached = store.get(LIST_KEY, null);
    if (!data && cached && cached.cats && Date.now() - cached.at < LIST_TTL) { data = cached; return Promise.resolve(data); }
    setState(state, state === 'idle' ? 'loading' : statusKey);
    loadingList = fetch('/api/radio', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); }).then(function (json) {
      json = normalize(json); data = json; store.set(LIST_KEY, json); maybeRecheck(json);
      if (state === 'idle') setState('idle', ''); return data;
    }).catch(function (e) {
      if (cached && cached.cats) { data = cached; if (state === 'idle') setState('idle', ''); return data; }   // last list this device saw
      if (state === 'idle') setState('idle', 'fail'); throw e;
    }).then(function (d) { loadingList = null; return d; }, function (e) { loadingList = null; throw e; });
    return loadingList;
  }

  // ---- rendering
  function renderCats() {
    catsEl.textContent = '';
    data.cats.forEach(function (c) {
      var on = view === 'cat' && c.id === catId;
      var b = document.createElement('button'); b.type = 'button'; b.id = 'radioTab-' + c.id; b.className = 'radio-cat' + (on ? ' on' : ''); b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.textContent = c.emoji + ' ' + c.label;
      b.addEventListener('click', function () { view = 'cat'; catId = c.id; searchEl.value = ''; renderCats(); renderList(); persist(); });
      b.addEventListener('keydown', function (e) { var all = [].slice.call(catsEl.children), i = all.indexOf(b), j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -1; if (j >= 0 && all[(j + all.length) % all.length]) { e.preventDefault(); all[(j + all.length) % all.length].focus(); } });
      catsEl.appendChild(b);
    });
    favBtn.setAttribute('aria-pressed', view === 'fav' ? 'true' : 'false'); favBtn.classList.toggle('on', view === 'fav');
    recentBtn.setAttribute('aria-pressed', view === 'recent' ? 'true' : 'false'); recentBtn.classList.toggle('on', view === 'recent');
  }
  function renderList() {
    listEl.textContent = '';
    if (!data) return;
    var q = searchEl.value.trim().toLowerCase(), rows = [], key = activeCatKey();
    if (q) data.cats.forEach(function (c) { (catRaw(c.id).items).forEach(function (it) { if (it.n.toLowerCase().indexOf(q) !== -1 && !rows.some(function (r) { return r.it.u === it.u; })) rows.push({ cid: c.id, it: it, i: -1 }); }); });
    else (cat(key) || { items: [] }).items.forEach(function (it, i) { rows.push({ cid: key, it: it, i: i }); });
    if (view === 'cat' && !q) listEl.setAttribute('aria-labelledby', 'radioTab-' + catId); else listEl.removeAttribute('aria-labelledby');
    if (!rows.length) { var empty = document.createElement('li'); empty.className = 'radio-empty'; empty.textContent = q ? L().none : (view === 'fav' ? L().noFav : view === 'recent' ? L().noRecent : catId === 'top' ? L().noTop : L().none); listEl.appendChild(empty); return; }
    var now = currentItem(), faved = favs().map(function (f) { return f.u; }), badMap = bad();
    rows.forEach(function (r) {
      var li = document.createElement('li'); li.className = 'radio-row-li';
      var b = document.createElement('button'); b.type = 'button'; b.className = 'radio-st';
      var on = now && now.u === r.it.u; if (on) { b.classList.add('on'); b.setAttribute('aria-current', 'true'); }
      if (badMap[r.it.u] || (view === 'find' && findBad(r.it.u))) b.classList.add('bad');
      var name = document.createElement('span'); name.className = 'radio-st-name';
      if (view === 'cat' && !q && r.it.top) { var top = document.createElement('span'); top.className = 'radio-top'; top.textContent = SPECIAL_ICON[r.cid] || '🔥'; top.setAttribute('aria-hidden', 'true'); name.appendChild(top); }   // 🔥 = one of the three most popular stations of the category (flag from the server); it sits INSIDE the name, so the row layout (name left, quality right) stays the same
      name.appendChild(document.createTextNode(r.it.n));
      var meta = document.createElement('small'); meta.textContent = (r.it.mine ? '🔗 ' : '') + (r.cid === 'manele' && r.it.s ? r.it.s.map(function (s) { return STYLE_ICON[s] || ''; }).join('') + ' ' : '') + (view === 'find' && findBad(r.it.u) ? '❌ ' + findBad(r.it.u) + ' · ' : '') + (r.it.f ? r.it.f + ' · ' : '') + (r.it.cc && r.it.cc !== 'RO' ? r.it.cc + ' · ' : '') + r.it.c + (r.it.b ? ' ' + r.it.b : '');
      b.appendChild(name); b.appendChild(meta);
      b.addEventListener('click', function () { if (view === 'find') { precheck(r, b); return; } if (r.i >= 0) play(r.cid, r.i, false); else { var cc = cat(r.cid), k = cc ? indexOfUrl(cc.items, r.it.u) : -1; play(r.cid, k >= 0 ? k : 0, false, k >= 0 ? undefined : r.it); } afterPick(); });
      var star = document.createElement('button'); star.type = 'button'; star.className = 'radio-star'; var isF = faved.indexOf(r.it.u) !== -1;
      star.textContent = isF ? '★' : '☆'; star.setAttribute('aria-pressed', isF ? 'true' : 'false'); star.setAttribute('aria-label', (isF ? L().delFav : L().addFav) + ': ' + r.it.n); star.classList.toggle('on', isF);
      star.addEventListener('click', function () { toggleFav(r.it); if (view === 'fav') { renderList(); } else { var f = isFav(r.it.u); star.textContent = f ? '★' : '☆'; star.setAttribute('aria-pressed', f ? 'true' : 'false'); star.classList.toggle('on', f); star.setAttribute('aria-label', (f ? L().delFav : L().addFav) + ': ' + r.it.n); } });
      if (r.it.mine) {   // my own station: ✖ takes it out of my list (the star is for the stations of the lists)
        var un = document.createElement('button'); un.type = 'button'; un.className = 'radio-star radio-unmine'; un.textContent = '✖'; un.title = L().removeMine; un.setAttribute('aria-label', L().removeMine + ': ' + r.it.n);
        un.addEventListener('click', function () { removeMine(r.it.u); renderList(); }); star = un;
      }
      if (view === 'find') {   // 📣 recommend this station to the owner (own flow, NOT the report flag): the server builds the recommendation from its own record of this result
        var rec = document.createElement('button'); rec.type = 'button'; rec.className = 'radio-star radio-rec'; rec.textContent = '📣'; rec.title = REC().btn; rec.setAttribute('aria-label', REC().btn + ': ' + r.it.n);
        rec.addEventListener('click', function () { recommend(r.it, rec); }); li.appendChild(b); li.appendChild(star); li.appendChild(rec); listEl.appendChild(li); return;
      }
      li.appendChild(b); li.appendChild(star); listEl.appendChild(li);
    });
  }
  function afterPick() { if (window.matchMedia && matchMedia('(max-width: 700px)').matches) openPanel(false); }

  // ---- audio
  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio(); audio.preload = 'none';
    audio.addEventListener('playing', function () {
      if (unlocking) return;   // the 0.4 s of silence that unlocks the element for a station that is being found: not a station playing
      clearTimeout(failTimer); tries = 0; retried = false; waitOnline = false; setState('playing', '');
      var it = currentItem(); if (it) { clearBad(it.u); addRecent(it); }
      if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing';
    });
    audio.addEventListener('waiting', function () { if (state === 'playing') armFail('stall'); });
    audio.addEventListener('error', function () { if (unlocking) return; failCode = 'e' + (audio.error ? audio.error.code : 0); onBroken(attemptSeq); });   // MediaError: 1 aborted, 2 network, 3 decode, 4 source not supported
    audio.addEventListener('stalled', function () { if (state === 'loading') armFail('timeout'); });
    var v = Number(volEl.value) / 100; audio.volume = v;
    if (Math.abs(audio.volume - v) > 0.01 && v !== 1) bar.classList.add('no-volume');   // iOS: the volume is the hardware buttons only
    if (navigator.mediaSession) {
      navigator.mediaSession.setActionHandler('play', function () { toggle(); });
      navigator.mediaSession.setActionHandler('pause', function () { toggle(); });
      navigator.mediaSession.setActionHandler('nexttrack', function () { step(1); });
      navigator.mediaSession.setActionHandler('previoustrack', function () { step(-1); });
    }
    return audio;
  }
  function armFail(code) { clearTimeout(failTimer); var my = attemptSeq; failTimer = setTimeout(function () { failCode = code || 'timeout'; onBroken(my); }, 12000); }
  function start(item) {
    var a = ensureAudio(), my = ++attemptSeq; attemptAt = Date.now(); failCode = ''; armFail('timeout'); a.src = item.u;
    var p = a.play(); if (p && p.catch) p.catch(function (e) { if (my !== attemptSeq) return; if (e && e.name === 'NotAllowedError') { clearTimeout(failTimer); setState('paused', ''); } else { failCode = failCode || 'reject'; onBroken(my); } });
  }
  // the next station of the list that did not fail here recently (null = every other one failed)
  function nextGood(catKey, from, dir) {
    var c = cat(catKey); if (!c || !c.items.length) return null;
    for (var k = 1; k <= c.items.length; k++) { var i = (from + dir * k + c.items.length * k) % c.items.length; if (i !== from && !isBad(c.items[i].u)) return i; }
    return null;
  }
  function onBroken(attempt) {
    if (attempt !== attemptSeq || attempt === handledAttempt) return;   // an old attempt, or the second signal of an attempt that was already handled
    handledAttempt = attempt; clearTimeout(failTimer);
    if (state === 'idle' || state === 'paused') return;
    var it = currentItem(); if (!it) return;
    if (navigator.onLine === false) { waitOnline = true; if (audio) audio.pause(); setState('error', 'offline'); return; }   // no network: do not burn through the list
    if (!retried) { retried = true; stat.retry++; setState('loading', 'reconnect'); start(it); return; }                                // one more try on the SAME station first
    markBad(it.u); retried = false; stat.skip++; sendReport(it, 'auto', failCode || 'x');   // failed twice in a row on this device: the owner gets to know (anonymous)
    var here = curIndex(), size = (cat(current.cat) || { items: [] }).items.length; if (here < 0) here = lastDir > 0 ? -1 : size;   // the playing station is hidden by a filter: continue from the edge
    var next = nextGood(current.cat, here, lastDir);
    if (next === null || tries >= 4) { tries = 0; if (audio) audio.pause(); setState('error', 'allbroken'); return; }
    tries++; setState('loading', 'broken'); play(current.cat, next, true);
  }
  function play(catKey, index, auto, override) {
    var c = cat(catKey), item = override || (c && c.items[index]); if (!item || !safeUrl(item.u)) return;
    current = { cat: catKey, i: index, u: item.u, item: item }; if (!auto) { tries = 0; lastDir = 1; } retried = false; waitOnline = false;
    label(); setState('loading', auto ? statusKey : '');
    start(item);
    if (navigator.mediaSession && window.MediaMetadata) navigator.mediaSession.metadata = new MediaMetadata({ title: item.n, artist: 'LXA Radio' });
    persist(); if (!panel.hidden) renderList();
  }
  function step(dir) {
    var key = current ? current.cat : activeCatKey(), c = cat(key);
    if (!c || !c.items.length) { fetchList().then(function () { var d = cat(activeCatKey()); if (d && d.items.length) play(d.id, 0, false); }).catch(function () { /* message shown */ }); return; }
    var from = current ? curIndex() : (dir > 0 ? -1 : 0); if (current && from < 0) from = dir > 0 ? -1 : c.items.length;   // not in this list (hidden by a filter): start at the edge
    var next = nextGood(key, from, dir);
    if (next === null) next = (from + dir + c.items.length) % c.items.length;
    play(key, next, false); lastDir = dir;
  }
  function pause() { clearTimeout(failTimer); waitOnline = false; if (audio) audio.pause(); setState('paused', ''); if (navigator.mediaSession) navigator.mediaSession.playbackState = 'paused'; }
  function toggle() {
    if (state === 'playing' || state === 'loading') { pause(); return; }
    fetchList().then(function () {
      if (current && currentItem()) { var at = curIndex(); play(current.cat, at >= 0 ? at : 0, false, at >= 0 ? undefined : current.item); return; }   // resume = reload the live stream (a paused live stream would replay old audio)
      var key = activeCatKey(), c = cat(key) || data.cats[0], idx = 0;
      if (saved.url) { var f = c.items.map(function (i) { return i.u; }).indexOf(saved.url); if (f >= 0) idx = f; else { var g = c.items.findIndex ? c.items.findIndex(function (i) { return !isBad(i.u); }) : 0; idx = g >= 0 ? g : 0; } }
      play(c.id, idx, false);
    }).catch(function () { setState('error', 'fail'); });
  }
  function surprise() {
    fetchList().then(function () {
      var c = cat(activeCatKey()); if (!c || !c.items.length) return;
      var pool = c.items.map(function (i, k) { return k; }).filter(function (k) { return !isBad(c.items[k].u) && !(current && current.cat === c.id && current.u === c.items[k].u); });
      if (!pool.length) return; play(c.id, pool[Math.floor(Math.random() * pool.length)], false); afterPick();
    }).catch(function () { setState('error', 'fail'); });
  }

  // ---- ➕ my own station: the link the player pastes (a stream, a .pls / .m3u playlist or the page of a radio server) is checked by the server, then it plays at once and sits at the top of ⭐ Favorites.
  // It plays at once and stays on this device. The SERVER also validates it and saves it for the owner of the site automatically (admin > RADIO); it becomes public only when the owner approves it.
  var say = function (key, extra) { addMsg.textContent = key ? (extra || '') + L()[key] : ''; };
  var hostOf = function (u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  var WHY = { 'bad-frequency': ['mBadF', '⚠️ '], 'bad-url': ['mBad', '⚠️ '], blocked: ['mBlocked', '⛔ '], unreachable: ['mUnreachable', '❌ '], 'http-only': ['mHttpOnly', '🔓 '], 'not-audio': ['mNotAudio', '🎧 '], html: ['mHtml', '🌐 '], 'no-data': ['mNoData', '🔇 '], disconnects: ['mDisc', '✂️ '], unstable: ['mUnstable', '〰️ '], timeout: ['mTimeout', '⏱️ '], limit: ['mLimit', '⏳ '] };
  function refitPanel() { if (!panel.hidden) fitPanel(true); }   // after the add / find box opens or closes the panel changes height: fit it to the screen again
  function openAdd(open, url) {
    addBox.hidden = !open; addBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); addBtn.classList.toggle('on', open);
    if (open) { if (panel.hidden) openPanel(true); if (typeof url === 'string') addUrl.value = url; say(''); try { addUrl.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    refitPanel();
  }
  // The server needs a moment to find the stream, and a browser (iPhone above all) only lets an audio element start inside the tap that asked for it: so the element is "unlocked" by the tap with 0.4 s of
  // silence (a file of this site), and the real stream is started on the same element afterwards. If nothing plays in the end the element is put back as it was.
  var unlocking = false;
  function unlockAudio() {
    if (state === 'playing' || state === 'loading') return;   // something plays already: the element is unlocked
    try { var a = ensureAudio(); unlocking = true; a.src = '/assets/silence.mp3'; var p = a.play(); if (p && p.catch) p.catch(function () { /* ignore */ }); } catch (e) { unlocking = false; }
  }
  function relock() { if (!unlocking) return; unlocking = false; try { if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); } } catch (e) { /* ignore */ } }
  function addStation() {
    var raw = addUrl.value.trim(), typed = addName.value.trim().slice(0, 40); if (!raw) return;
    if (mine().length >= MAX_MINE && !mine().some(function (m) { return m.u === raw; })) { say('mFull', '⚠️ '); return; }
    say('', ''); addMsg.textContent = '⏳'; addGo.disabled = true; unlockAudio();
    // POST submit: the server validates the stream (authoritative), saves the submission for the owner by itself and answers whether it can be played now. The login (if any) only tells the owner WHO sent it.
    var who = {}; try { if (typeof lxaAccount !== 'undefined' && lxaAccount && typeof lxaToken !== 'undefined' && lxaToken) who = { id: lxaAccount.id, token: lxaToken }; } catch (e) { who = {}; }
    fetch('/api/radio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'submit', u: raw, n: typed, dev: deviceId(), id: who.id, token: who.token, cc: addCc ? addCc.value.trim() : '', f: addF ? addF.value.trim() : '' }) }).then(function (r) { return r.json().catch(function () { return null; }); }).catch(function () { return null; }).then(function (res) {
      addGo.disabled = false;
      var failed = function (key, mark) { relock(); say(key, mark); };
      var local = false;
      if (!res) { if (/^https:\/\/[^\s]+$/i.test(raw)) { res = { ok: true, url: raw, name: '', codec: '', bitrate: 0 }; local = true; } else { failed('mOffline', '📡 '); return; } }   // the server cannot be asked: a plain https link is tried as it is (not sent to the owner)
      if (res.error) { failed('mBad', '⚠️ '); return; }
      if (!res.ok) { var w = WHY[res.why] || WHY.unreachable; failed(w[0], w[1]); return; }
      if (res.iosOk === false && /iPhone|iPad|iPod/i.test(navigator.userAgent)) { failed('mNoIos', '⚠️ '); return; }
      var item = { n: (typed || res.name || hostOf(res.url) || 'Radio').slice(0, 48), u: res.url, c: String(res.codec || ''), b: Number(res.bitrate) || 0, cc: '', mine: 1 };
      if (!safeUrl(item.u)) { failed('mBad', '⚠️ '); return; }
      saveMine(item);
      var note = res.dup === 'public' || res.dup === 'approved' ? 'mKnown' : res.dup === 'rejected' ? 'mRejected' : res.queued ? 'mQueued' : local ? 'mAdded' : 'mNoQueue';
      say(note, '✅ '); if (res.queued && res.warnings && res.warnings.length && res.stable === false) addMsg.textContent += ' · ' + L().mWarn;
      addUrl.value = ''; addName.value = ''; if (addF) addF.value = '';
      unlocking = false;   // the element stays unlocked: the real stream starts on it now
      view = 'fav'; searchEl.value = ''; renderCats(); renderList(); persist(); play('fav', 0, false);
    });
  }
  addBtn.addEventListener('click', function () { openAdd(addBox.hidden); });
  addClose.addEventListener('click', function () { openAdd(false); });
  addGo.addEventListener('click', addStation);
  addUrl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addStation(); } });
  // a shared link (?radio=<stream address>) opens the form with the address filled in; nothing is added or played before the player taps ▶
  try { var shared = new URLSearchParams(location.search).get('radio'); if (shared && /^https?:\/\//i.test(shared)) { setTimeout(function () { openAdd(true, shared.slice(0, 400)); }, 400); if (history.replaceState) history.replaceState(null, '', location.pathname); } } catch (e) { /* ignore */ }

  // ---- sleep timer
  function setSleep(min) {
    clearTimeout(sleepTimer); clearInterval(sleepTick); sleepEnd = 0;
    if (min > 0) {
      sleepEnd = Date.now() + min * 60000;
      sleepTimer = setTimeout(function () { sleepEnd = 0; clearInterval(sleepTick); sleepEl.value = '0'; pause(); setState('paused', 'sleepDone'); }, min * 60000);
      sleepTick = setInterval(renderStatus, 30000);
    }
    renderStatus();
  }

  // ---- panel
  // PHONES: an open panel must fit the visible screen together with the Ko-fi strip under it. The panel gets a maximum height (screen - controls row - Ko-fi strip), scrolls inside itself,
  // and the page is moved ONCE so the radio starts at the top of the screen; closing puts the page back exactly where it was.
  var savedY = null, closedGap = 0, fitY = null;
  var isPhone = function () { return window.matchMedia && matchMedia('(max-width: 700px)').matches; };
  // the padlock (scroll lock) pins the page position: while the radio moves the page itself the lock is lifted for that one move and put back, so the pin takes the NEW position
  function movePage(fn) { var locked = document.body.classList.contains('scroll-locked'); if (locked) document.body.classList.remove('scroll-locked'); try { fn(); } finally { if (locked) document.body.classList.add('scroll-locked'); } }
  function fitPanel(moveToo) {
    if (panel.hidden || !isPhone()) return;
    var vv = window.visualViewport, vh = vv ? vv.height : window.innerHeight, kofi = document.querySelector('.kofi-goal-bar');
    var head = panel.getBoundingClientRect().top - bar.getBoundingClientRect().top, below = kofi ? kofi.getBoundingClientRect().height + closedGap : 0;
    panel.style.maxHeight = Math.max(200, Math.floor(vh - 8 - head - below - 8)) + 'px';
    if (moveToo) { movePage(function () { window.scrollBy(0, bar.getBoundingClientRect().top - 8); }); fitY = window.scrollY; }
  }
  function openPanel(open) {
    if (open && panel.hidden && isPhone()) { var k = document.querySelector('.kofi-goal-bar'); closedGap = k ? Math.max(0, k.getBoundingClientRect().top - bar.getBoundingClientRect().bottom) : 0; savedY = window.scrollY; }
    var wasOpen = !panel.hidden;
    panel.hidden = !open; toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); titleBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); bar.classList.toggle('open', open);
    if (open && !wasOpen) { fitPanel(true); window.requestAnimationFrame(function () { fitPanel(false); }); }
    if (!open && wasOpen) { panel.style.maxHeight = ''; if (savedY !== null) { var back = savedY; movePage(function () { window.scrollTo(0, back); }); savedY = null; } }
    toggleBtn.textContent = open ? '▴' : '▾';
    // the playing station is scrolled into view INSIDE the list only (scrollIntoView also moved the whole page)
    if (open) fetchList().then(function () { renderCats(); renderList(); var on = listEl.querySelector('.on'); if (on) listEl.scrollTop += on.getBoundingClientRect().top - listEl.getBoundingClientRect().top - (listEl.clientHeight - on.offsetHeight) / 2; if (!panel.hidden && fitY !== null && Math.abs(window.scrollY - fitY) < 4) fitPanel(true); }).catch(function () { /* message already shown */ });
  }
  if (window.visualViewport) window.visualViewport.addEventListener('resize', function () { fitPanel(false); });   // keyboard / browser bars: the panel follows the visible height
  window.addEventListener('orientationchange', function () { setTimeout(function () { fitPanel(false); }, 300); });
  function viewButton(which) { view = view === which ? 'cat' : which; searchEl.value = ''; if (data) { renderCats(); renderList(); } else fetchList().then(function () { renderCats(); renderList(); }).catch(function () { /* shown */ }); }

  // 🚩 = "this station does not work for me" (also: it plays but is silent / the wrong thing). Reports it, dims it here for 24 h and moves on to the next one in the direction the listener was going.
  function flag() {
    var it = currentItem(); if (!it) return;
    sendReport(it, 'manual', state === 'playing' ? 'playing' : state === 'loading' ? 'loading' : 'nostart');
    markBad(it.u); toast('reported');
    var key = current.cat, c = cat(key), from = curIndex(); if (from < 0) from = lastDir > 0 ? -1 : (c ? c.items.length : 0);
    if (nextGood(key, from, lastDir) === null) pause(); else step(lastDir);
    if (!panel.hidden) renderList();
  }
  if (flagBtn) flagBtn.addEventListener('click', flag);
  playBtn.addEventListener('click', toggle);
  prevBtn.addEventListener('click', function () { step(-1); });
  nextBtn.addEventListener('click', function () { step(1); });
  toggleBtn.addEventListener('click', function () { openPanel(panel.hidden); });
  titleBtn.addEventListener('click', function () { openPanel(panel.hidden); });
  searchEl.addEventListener('input', renderList);
  diceBtn.addEventListener('click', surprise);
  favBtn.addEventListener('click', function () { viewButton('fav'); });
  recentBtn.addEventListener('click', function () { viewButton('recent'); });
  sleepEl.addEventListener('change', function () { setSleep(Number(sleepEl.value) || 0); });
  ecoEl.addEventListener('change', function () {
    eco = ecoEl.checked; persist();
    if (data) { renderCats(); renderList(); }
  });
  volEl.addEventListener('input', function () { if (audio) audio.volume = Number(volEl.value) / 100; persist(); });
  window.addEventListener('online', function () { if (waitOnline && current && currentItem()) { waitOnline = false; retried = false; setState('loading', 'reconnect'); start(currentItem()); } });
  window.addEventListener('offline', function () { if (state === 'playing' || state === 'loading') { waitOnline = true; setState('error', 'offline'); } });
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'language') applyText(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) openPanel(false); });

  setState('idle', ''); applyText();
  window.LXARadio = { state: function () { return { state: state, view: view, cat: catId, current: currentItem() || null, tries: tries, status: statusKey, eco: eco, dir: lastDir, retried: retried }; }, audio: function () { return audio; }, bad: bad, stats: stat, deviceId: deviceId };


  // ---- RECOMMEND (from the frequency search): POST {action:'recommend', u, id, token}; the answer says what happened (nothing is published, the owner decides)
  var RECT = {
    de: { btn: 'Sender empfehlen', login: 'Bitte einloggen, um zu empfehlen.', RECOMMENDED: 'Empfohlen – der Admin prüft es.', ALREADY: 'Schon empfohlen.', EXISTS: 'Schon in der Liste.', APPROVED: 'Schon in der Liste.', REJECTED: 'Wurde bereits abgelehnt.', UNKNOWN: 'Sender nicht erkannt – bitte neu suchen.', LIMIT: 'Zu viele Empfehlungen, später wieder.', fail: 'Nicht gesendet – Netzwerk / Server.', stream: 'Stream: ', checking: 'Sender wird geprüft…', noCheck: 'Prüfung nicht möglich – Sender wird direkt versucht.', degraded: 'Stream läuft, aber instabil.', states: { OFFLINE: 'Offline – antwortet nicht', 'NO AUDIO': 'Kein Audio im Stream', UNSUPPORTED: 'Format nicht unterstützt', INVALID: 'Ungültiger Stream', DEGRADED: 'Instabil' } },
    ro: { btn: 'Recomandă postul', login: 'Intră în cont ca să recomanzi.', RECOMMENDED: 'Recomandat – adminul îl verifică.', ALREADY: 'Ai recomandat deja.', EXISTS: 'E deja în listă.', APPROVED: 'E deja în listă.', REJECTED: 'A fost deja respins.', UNKNOWN: 'Post necunoscut – caută din nou.', LIMIT: 'Prea multe recomandări, încearcă mai târziu.', fail: 'Netrimis – rețea / server.', stream: 'Stream: ', checking: 'Se verifică postul…', noCheck: 'Verificarea nu a mers – încerc direct postul.', degraded: 'Stream-ul merge, dar e instabil.', states: { OFFLINE: 'Offline – nu răspunde', 'NO AUDIO': 'Fără audio în stream', UNSUPPORTED: 'Format nesuportat', INVALID: 'Stream invalid', DEGRADED: 'Instabil' } },
    en: { btn: 'Recommend station', login: 'Log in to recommend.', RECOMMENDED: 'Recommended – the admin will review it.', ALREADY: 'Already recommended.', EXISTS: 'Already in the list.', APPROVED: 'Already in the list.', REJECTED: 'Already rejected.', UNKNOWN: 'Unknown station – search again.', LIMIT: 'Too many recommendations, try later.', fail: 'Not sent – network / server.', stream: 'Stream: ', checking: 'Checking the station…', noCheck: 'Check unavailable – trying the station directly.', degraded: 'The stream plays but is unstable.', states: { OFFLINE: 'Offline – not answering', 'NO AUDIO': 'No audio in the stream', UNSUPPORTED: 'Format not supported', INVALID: 'Invalid stream', DEGRADED: 'Unstable' } }
  };
  var REC = function () { var l = typeof lang === 'string' ? lang : ''; return RECT[l] || RECT.en; };
  function recommend(item, button) {
    var msg = $('radioFindMsg'), say = function (t) { if (msg) msg.textContent = t; }, who = null;
    try { if (typeof lxaAccount !== 'undefined' && lxaAccount && typeof lxaToken !== 'undefined' && lxaToken) who = { id: lxaAccount.id, token: lxaToken }; } catch (e) { who = null; }
    if (!who) { say(REC().login); return; }
    if (button.disabled) return; button.disabled = true;   // no double send
    fetch('/api/radio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'recommend', u: item.u, id: who.id, token: who.token }) })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (r) { var key = r.state; say(r.ok ? (REC()[key] || REC().RECOMMENDED) + (r.vstate && r.vstate !== 'VALID' && key === 'RECOMMENDED' ? ' ' + REC().stream + r.vstate : '') : (key === 'LOGIN' ? REC().login : (REC()[key] || REC().fail))); if (!(r.ok && key === 'RECOMMENDED')) button.disabled = key === 'ALREADY' || key === 'EXISTS' || key === 'APPROVED' || key === 'REJECTED'; else { button.textContent = '✅'; } })
      .catch(function () { button.disabled = false; say(REC().fail); });
  }

  // ---- CHECK BEFORE PLAY (frequency search): the stream is verified by the SERVER first (~2 s, answers of the last minutes are reused); a station that does not play is NOT started, its real state is shown.
  // If the server cannot be asked at all (network / 503) the station is tried as it is (fail-open), the normal error handling of the player takes over.
  var findState = {};
  var findBad = function (u) { var x = findState[u]; return x && !x.ok && Date.now() - x.at < 60000 ? x.state : ''; };
  function precheck(r, button) {
    var msg = $('radioFindMsg'), say = function (t) { if (msg) msg.textContent = t; }, u = r.it.u, hit = findState[u];
    var go = function () { unlocking = false; if (r.i >= 0) play(r.cid, r.i, false); afterPick(); };
    if (button.dataset.busy) return;
    if (hit && hit.ok && Date.now() - hit.at < 600000) { go(); return; }
    button.dataset.busy = '1'; button.classList.add('checking'); say('⏳ ' + REC().checking); unlockAudio();
    fetch('/api/radio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'check', u: u, fast: true }) })
      .then(function (res) { return res.ok ? res.json() : null; }).catch(function () { return null; })
      .then(function (res) {
        delete button.dataset.busy; button.classList.remove('checking');
        if (!res || res.error) { say(REC().noCheck); go(); return; }
        var state = String(res.state || (res.ok ? 'VALID' : 'INVALID')); findState[u] = { ok: !!res.ok, state: state, at: Date.now() };
        if (res.ok) { say(state === 'DEGRADED' ? REC().degraded : ''); go(); return; }
        relock(); say(r.it.n + ' – ' + (REC().states[state] || state)); renderList();
      });
  }
  // ---- FIND: any country, exact frequency, auto scanner (data comes from the directory through /api/radio?browse=...; the frequency is read from station names, so a station that does not write it cannot be found)
  var fb = $('radioFindBtn'), fbox = $('radioFind'), fcc = $('radioFindCc'), ff = $('radioFindF'), fgo = $('radioFindGo'), sa = $('radioScanA'), sb = $('radioScanB'), sgo = $('radioScanGo'), fclose = $('radioFindClose'), fmsg = $('radioFindMsg');
  if (fb && fbox) (function () {
    var T = { de: { n: 'Keine Sender mit dieser Frequenz.', bad: 'Ungültige Eingabe.', fail: 'Nicht erreichbar.', all: 'Alle Länder', stop: 'Stopp', scanning: 'Scan…', done: 'Scan fertig: ', st: ' Sender', warn: 'Prüfung: ' }, ro: { n: 'Nicio stație pe această frecvență.', bad: 'Valoare invalidă.', fail: 'Indisponibil.', all: 'Toate țările', stop: 'Stop', scanning: 'Scanare…', done: 'Scanare gata: ', st: ' stații', warn: 'Verificare: ' }, en: { n: 'No stations on this frequency.', bad: 'Invalid input.', fail: 'Unavailable.', all: 'All countries', stop: 'Stop', scanning: 'Scanning…', done: 'Scan done: ', st: ' stations', warn: 'Check: ' } };
    var X = function () { var l = typeof lang === 'string' ? lang : ''; return T[l] || T.en; }, say = function (t) { fmsg.textContent = t || ''; }, loaded = false, scanTimer = 0, myCc = '';
    var api = function (q) { return fetch('/api/radio?' + q, { cache: 'no-cache' }).then(function (r) { return r.json(); }); };
    function show() { view = 'find'; searchEl.value = ''; if (data) { renderCats(); renderList(); } else fetchList().then(function () { renderCats(); renderList(); }).catch(function () { /* shown */ }); }
    function loadCountries() {
      if (loaded) return; loaded = true;
      api('browse=countries').then(function (r) {
        var o = document.createElement('option'); o.value = ''; o.textContent = X().all; fcc.appendChild(o);
        (r.countries || []).forEach(function (c) { var e = document.createElement('option'); e.value = c.cc; e.textContent = c.name + ' (' + c.cc + ')'; fcc.appendChild(e); });
        myCc = r.mine || ''; try { var saved = localStorage.getItem('lxa-radio-cc'); fcc.value = saved !== null ? saved : myCc; } catch (e) { fcc.value = myCc; } if (fcc.value !== (saved || myCc)) fcc.value = '';
      }).catch(function () { loaded = false; say(X().fail); });
    }
    function openFind(open) { fbox.hidden = !open; fb.setAttribute('aria-expanded', open ? 'true' : 'false'); fb.classList.toggle('on', open); if (open) { if (panel.hidden) openPanel(true); loadCountries(); say(''); try { ff.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } else { stopScan(); if (view === 'find') { view = 'cat'; if (data) { renderCats(); renderList(); } } } refitPanel(); }
    function stopScan() { clearTimeout(scanTimer); scanTimer = 0; sgo.textContent = '▶'; sgo.setAttribute('aria-label', 'Scan'); }
    function remember() { try { localStorage.setItem('lxa-radio-cc', fcc.value); } catch (e) { /* ignore */ } }
    function results(items) { findItems = items.map(function (i) { var o = cleanItem(i); if (o) { o.f = i.f; o.cc = i.cc || ''; } return o; }).filter(Boolean); show(); }
    fb.addEventListener('click', function () { openFind(fbox.hidden); });
    fclose.addEventListener('click', function () { openFind(false); });
    fcc.addEventListener('change', remember);
    function search() {
      stopScan(); var f = ff.value.trim(); if (!/^\d{2,4}([.,]\d{1,2})?$/.test(f)) { say(X().bad); return; }
      remember(); say(X().scanning); fgo.disabled = true;
      api('browse=freq&cc=' + encodeURIComponent(fcc.value) + '&f=' + encodeURIComponent(f)).then(function (r) {
        fgo.disabled = false; if (r.error) { say(X().bad); return; }
        results(r.items || []); say((r.items || []).length ? (r.items.length + X().st + ' · ' + f) : X().n);
      }).catch(function () { fgo.disabled = false; say(X().fail); });
    }
    fgo.addEventListener('click', search); ff.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); search(); } });
    // scanner: ONE request returns every frequency of the range that has stations; they are then revealed one by one (the sweep), Stop ends it
    sgo.addEventListener('click', function () {
      if (scanTimer) { stopScan(); say(X().stop); return; }
      var a = sa.value.trim(), b = sb.value.trim(); if (!fcc.value || !/^\d{2,4}([.,]\d{1,2})?$/.test(a) || !/^\d{2,4}([.,]\d{1,2})?$/.test(b)) { say(X().bad); return; }
      remember(); say(X().scanning); findItems = []; show(); sgo.textContent = '■'; sgo.setAttribute('aria-label', X().stop);
      scanTimer = -1;
      api('browse=scan&cc=' + encodeURIComponent(fcc.value) + '&from=' + encodeURIComponent(a) + '&to=' + encodeURIComponent(b)).then(function (r) {
        if (scanTimer !== -1) return;   // stopped meanwhile
        if (r.error) { stopScan(); say(X().bad); return; }
        var found = r.found || [], k = 0;
        (function step() {
          if (k >= found.length) { stopScan(); say(X().done + r.total + X().st); return; }
          var g = found[k++]; say(X().scanning + ' ' + g.f); findItems = findItems.concat(g.items.map(function (i) { var o = cleanItem(i); if (o) { o.f = g.f; o.cc = i.cc || ''; } return o; }).filter(Boolean)); renderList();
          scanTimer = setTimeout(step, 250);
        })();
      }).catch(function () { stopScan(); say(X().fail); });
    });
  })();
})();
