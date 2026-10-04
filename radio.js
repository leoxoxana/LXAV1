// Compact radio player (bottom of the page, above the Ko-fi goal bar). ONE audio element, the station list comes from /api/radio (Radio Browser, filtered + probed on the server).
// Nothing starts by itself: the list is fetched on the first tap, audio only plays after a tap. Station names are inserted with textContent (never as HTML).
(function () {
  'use strict';
  var bar = document.getElementById('radioBar');
  if (!bar) return;
  var $ = function (id) { return document.getElementById(id); };
  var playBtn = $('radioPlay'), prevBtn = $('radioPrev'), nextBtn = $('radioNext'), titleBtn = $('radioTitle'), nameEl = $('radioName'), statusEl = $('radioStatus'), volEl = $('radioVol'), toggleBtn = $('radioToggle'),
      panel = $('radioPanel'), catsEl = $('radioCats'), searchEl = $('radioSearch'), diceBtn = $('radioDice'), favBtn = $('radioFav'), recentBtn = $('radioRecent'), listEl = $('radioList'),
      subEl = $('radioSub'), sleepEl = $('radioSleep'), ecoEl = $('radioEco'), ecoLabel = $('radioEcoLabel'), msgEl = $('radioMsg');
  var KEY = 'lxa-radio-v1', LIST_KEY = 'lxa-radio-list-v1', BAD_KEY = 'lxa-radio-bad-v1', FAV_KEY = 'lxa-radio-fav-v1', RECENT_KEY = 'lxa-radio-recent-v1';
  var LIST_TTL = 30 * 60 * 1000, BAD_TTL = 24 * 3600 * 1000, ECO_KBPS = 96, MAX_FAV = 60, MAX_RECENT = 5;
  var TEXT = {
    de: { pick: 'Sender wählen', search: 'Suchen…', loading: 'Lädt…', none: 'Keine Sender gefunden.', fail: 'Radio-Liste nicht erreichbar.', broken: 'Sender nicht erreichbar – nächster…', allbroken: 'Kein Sender in dieser Kategorie erreichbar.', reconnect: 'Verbindet neu…', offline: 'Offline – wartet auf Netz', error: 'Fehler',
          play: 'Radio abspielen', pause: 'Radio pausieren', stations: 'Senderliste', volume: 'Lautstärke', prev: 'Vorheriger Sender', next: 'Nächster Sender', dice: 'Zufälliger Sender', fav: 'Favoriten', recent: 'Zuletzt gehört', noFav: 'Noch keine Favoriten – tippe ☆ bei einem Sender.', noRecent: 'Noch nichts gehört.', sleep: 'Einschlaf-Timer', eco: 'Eco ≤96 kbps', addFav: 'Zu Favoriten', delFav: 'Aus Favoriten', sleepDone: 'Gute Nacht – Radio aus', sub: { all: 'Alle', old: 'Alt', new: 'Neu', trap: 'Trap / Techno / Electro' }, subLabel: 'Stil' },
    ro: { pick: 'Alege o stație', search: 'Caută…', loading: 'Se încarcă…', none: 'Nicio stație găsită.', fail: 'Lista de radio nu e disponibilă.', broken: 'Stația nu răspunde – trec la următoarea…', allbroken: 'Nicio stație din această categorie nu răspunde.', reconnect: 'Se reconectează…', offline: 'Offline – aștept rețeaua', error: 'Eroare',
          play: 'Pornește radioul', pause: 'Oprește radioul', stations: 'Lista de stații', volume: 'Volum', prev: 'Stația anterioară', next: 'Stația următoare', dice: 'Stație la întâmplare', fav: 'Favorite', recent: 'Ascultate recent', noFav: 'Încă nu ai favorite – atinge ☆ la o stație.', noRecent: 'Încă n-ai ascultat nimic.', sleep: 'Cronometru de somn', eco: 'Eco ≤96 kbps', addFav: 'Adaugă la favorite', delFav: 'Scoate din favorite', sleepDone: 'Noapte bună – radio oprit', sub: { all: 'Toate', old: 'Vechi', new: 'Noi', trap: 'Trapanele / Tehno / Electro' }, subLabel: 'Stil' },
    en: { pick: 'Pick a station', search: 'Search…', loading: 'Loading…', none: 'No stations found.', fail: 'Radio list unavailable.', broken: 'Station not reachable – trying the next one…', allbroken: 'No station in this category is reachable.', reconnect: 'Reconnecting…', offline: 'Offline – waiting for network', error: 'Error',
          play: 'Play radio', pause: 'Pause radio', stations: 'Station list', volume: 'Volume', prev: 'Previous station', next: 'Next station', dice: 'Random station', fav: 'Favorites', recent: 'Recently played', noFav: 'No favorites yet – tap ☆ on a station.', noRecent: 'Nothing played yet.', sleep: 'Sleep timer', eco: 'Eco ≤96 kbps', addFav: 'Add to favorites', delFav: 'Remove from favorites', sleepDone: 'Good night – radio off', sub: { all: 'All', old: 'Old school', new: 'New', trap: 'Trap / Techno / Electro' }, subLabel: 'Style' }
  };
  var L = function () { var l = typeof lang === 'string' ? lang : ''; if (!TEXT[l]) { try { l = localStorage.getItem('lxaLang') || ''; } catch (e) { l = ''; } } return TEXT[l] || TEXT.de; };
  var store = {
    get: function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };

  var audio = null;                    // created at the first play: the ONE audio element
  var data = null, view = 'cat' /* cat | fav | recent */, catId = 'pop', current = null /* {cat, i} */, state = 'idle', statusKey = '', failTimer = 0, tries = 0, retried = false, waitOnline = false, loadingList = null;
  var stat = { retry: 0, skip: 0 };   // diagnostics (window.LXARadio.stats)
  var attemptSeq = 0, handledAttempt = 0;   // every (re)start of a stream is one attempt; the error event AND the play() rejection of the same attempt count once
  var sleepTimer = 0, sleepTick = 0, sleepEnd = 0, lastDir = 1;   // lastDir: a dead station is skipped in the direction the listener was going (⏮ keeps going back)
  var saved = store.get(KEY, {}); if (!saved || typeof saved !== 'object') saved = {};
  var eco = saved.eco === true, sub = typeof saved.sub === 'string' ? saved.sub : 'all';   // sub: style filter inside MANELE (all | trap | old | new | etno | folk)
  var STYLE_ICON = { trap: '⚡', old: '🕰', 'new': '✨' }, STYLE_ORDER = ['trap', 'old', 'new'];   // folk / ethno stations are listed last by the server and have no filter
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
  var persist = function () { var it = currentItem(); store.set(KEY, { cat: catId, url: it ? it.u : saved.url, name: it ? it.n : saved.name, vol: Number(volEl.value), eco: eco, sub: sub }); };

  // ---- device memory: favorites, recent, stations that failed here in the last 24 h
  var favs = function () { return store.get(FAV_KEY, []).map(cleanItem).filter(Boolean); };
  var recents = function () { return store.get(RECENT_KEY, []).map(cleanItem).filter(Boolean); };
  var isFav = function (u) { return favs().some(function (f) { return f.u === u; }); };
  var bad = function () { var m = store.get(BAD_KEY, {}), now = Date.now(), out = {}; Object.keys(m).forEach(function (u) { if (now - m[u] < BAD_TTL) out[u] = m[u]; }); return out; };
  var isBad = function (u) { return !!bad()[u]; };
  var markBad = function (u) { var m = bad(); m[u] = Date.now(); store.set(BAD_KEY, m); };
  var clearBad = function (u) { var m = bad(); if (m[u]) { delete m[u]; store.set(BAD_KEY, m); } };
  function toggleFav(item) { var list = favs(); var at = -1; list.forEach(function (f, i) { if (f.u === item.u) at = i; }); if (at >= 0) list.splice(at, 1); else list.unshift(item); store.set(FAV_KEY, list.slice(0, MAX_FAV)); }
  function addRecent(item) { var list = recents().filter(function (r) { return r.u !== item.u; }); list.unshift(item); store.set(RECENT_KEY, list.slice(0, MAX_RECENT)); }

  // ---- lists: real categories (from the server) + the two device lists; eco keeps stations up to 96 kbps (unless that would leave almost nothing)
  var ecoFilter = function (items) { var small = items.filter(function (i) { return !i.b || i.b <= ECO_KBPS; }); return small.length >= 3 ? small : items; };
  function catRaw(id) { var c = data && data.cats.filter(function (x) { return x.id === id; })[0]; return c ? (eco ? { id: c.id, emoji: c.emoji, label: c.label, items: ecoFilter(c.items) } : c) : null; }
  // MANELE: 'all' lists everything (the server puts trap / techno first and folk / ethno last), a style shows only the stations that carry it
  var styleFilter = function (items) { return sub === 'all' ? items : items.filter(function (i) { return i.s && i.s.indexOf(sub) !== -1; }); };
  function cat(id) {
    if (id === 'fav') return { id: 'fav', items: favs() };
    if (id === 'recent') return { id: 'recent', items: recents() };
    var c = catRaw(id); if (!c) return null;
    return id === 'manele' ? { id: c.id, emoji: c.emoji, label: c.label, items: styleFilter(c.items) } : c;
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
    var t = statusKey ? L()[statusKey] : '';
    if (!t && sleepEnd) { var min = Math.max(1, Math.ceil((sleepEnd - Date.now()) / 60000)); t = '⏲ ' + min + ' min'; }
    statusEl.textContent = t || '';
    bar.classList.toggle('has-status', !!t);
    msgEl.textContent = statusKey === 'broken' || statusKey === 'allbroken' || statusKey === 'offline' || statusKey === 'fail' ? L()[statusKey] : '';
  }
  function label() { var item = currentItem(); nameEl.textContent = item ? item.n : (saved.name || L().pick); }
  function applyText() {
    searchEl.placeholder = L().search; toggleBtn.setAttribute('aria-label', L().stations); volEl.setAttribute('aria-label', L().volume); prevBtn.setAttribute('aria-label', L().prev); nextBtn.setAttribute('aria-label', L().next);
    diceBtn.setAttribute('aria-label', L().dice); diceBtn.title = L().dice; favBtn.setAttribute('aria-label', L().fav); favBtn.title = L().fav; recentBtn.setAttribute('aria-label', L().recent); recentBtn.title = L().recent;
    sleepEl.setAttribute('aria-label', L().sleep); sleepEl.title = L().sleep; ecoLabel.textContent = L().eco; setState(state, statusKey); label(); if (data && !panel.hidden) { renderSub(); renderList(); }
  }

  // ---- list from the server
  function fetchList() {
    if (data && Date.now() - data.at < LIST_TTL) return Promise.resolve(data);
    if (loadingList) return loadingList;
    var cached = store.get(LIST_KEY, null);
    if (!data && cached && cached.cats && Date.now() - cached.at < LIST_TTL) { data = cached; return Promise.resolve(data); }
    setState(state, state === 'idle' ? 'loading' : statusKey);
    loadingList = fetch('/api/radio', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); }).then(function (json) {
      if (!json || !Array.isArray(json.cats)) throw new Error('bad list');
      json.cats = json.cats.map(function (c) { return { id: String(c.id), emoji: String(c.emoji || ''), label: String(c.label || c.id), items: (Array.isArray(c.items) ? c.items : []).map(cleanItem).filter(Boolean) }; });
      json.at = Date.now(); data = json; store.set(LIST_KEY, json);
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
    renderSub();
  }
  function renderSub() {
    var show = !!data && view === 'cat' && catId === 'manele' && !searchEl.value.trim(); subEl.hidden = !show; if (!show) return;
    var c = catRaw('manele'); if (!c) { subEl.hidden = true; return; }
    var counts = {}, plain = c.items.length; c.items.forEach(function (i) { (i.s || []).forEach(function (s) { counts[s] = (counts[s] || 0) + 1; }); });
    var keys = STYLE_ORDER.filter(function (k) { return counts[k] >= 2; }); if (sub !== 'all' && keys.indexOf(sub) === -1) sub = 'all';
    subEl.setAttribute('aria-label', L().subLabel); subEl.textContent = '';
    ['all'].concat(keys).forEach(function (k) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'radio-subbtn' + (sub === k ? ' on' : ''); b.setAttribute('aria-pressed', sub === k ? 'true' : 'false');
      b.textContent = (STYLE_ICON[k] ? STYLE_ICON[k] + ' ' : '') + L().sub[k] + ' ' + (k === 'all' ? plain : counts[k]);
      b.addEventListener('click', function () { sub = k; renderSub(); renderList(); persist(); });
      subEl.appendChild(b);
    });
  }
  function renderList() {
    listEl.textContent = '';
    if (!data) return;
    var q = searchEl.value.trim().toLowerCase(), rows = [], key = activeCatKey();
    if (q) data.cats.forEach(function (c) { (catRaw(c.id).items).forEach(function (it) { if (it.n.toLowerCase().indexOf(q) !== -1 && !rows.some(function (r) { return r.it.u === it.u; })) rows.push({ cid: c.id, it: it, i: -1 }); }); });
    else (cat(key) || { items: [] }).items.forEach(function (it, i) { rows.push({ cid: key, it: it, i: i }); });
    if (view === 'cat' && !q) listEl.setAttribute('aria-labelledby', 'radioTab-' + catId); else listEl.removeAttribute('aria-labelledby');
    if (!rows.length) { var empty = document.createElement('li'); empty.className = 'radio-empty'; empty.textContent = q ? L().none : (view === 'fav' ? L().noFav : view === 'recent' ? L().noRecent : L().none); listEl.appendChild(empty); return; }
    var now = currentItem(), faved = favs().map(function (f) { return f.u; }), badMap = bad();
    rows.forEach(function (r) {
      var li = document.createElement('li'); li.className = 'radio-row-li';
      var b = document.createElement('button'); b.type = 'button'; b.className = 'radio-st';
      var on = now && now.u === r.it.u; if (on) { b.classList.add('on'); b.setAttribute('aria-current', 'true'); }
      if (badMap[r.it.u]) b.classList.add('bad');
      var name = document.createElement('span'); name.className = 'radio-st-name';
      if (view === 'cat' && !q && r.it.top) { var top = document.createElement('span'); top.className = 'radio-top'; top.textContent = '🔥'; top.setAttribute('aria-hidden', 'true'); name.appendChild(top); }   // 🔥 = one of the three most popular stations of the category (flag from the server); it sits INSIDE the name, so the row layout (name left, quality right) stays the same
      name.appendChild(document.createTextNode(r.it.n));
      var meta = document.createElement('small'); meta.textContent = (r.cid === 'manele' && r.it.s ? r.it.s.map(function (s) { return STYLE_ICON[s] || ''; }).join('') + ' ' : '') + (r.it.cc && r.it.cc !== 'RO' ? r.it.cc + ' · ' : '') + r.it.c + (r.it.b ? ' ' + r.it.b : '');
      b.appendChild(name); b.appendChild(meta);
      b.addEventListener('click', function () { if (r.i >= 0) play(r.cid, r.i, false); else { var cc = cat(r.cid), k = cc ? indexOfUrl(cc.items, r.it.u) : -1; play(r.cid, k >= 0 ? k : 0, false, k >= 0 ? undefined : r.it); } afterPick(); });
      var star = document.createElement('button'); star.type = 'button'; star.className = 'radio-star'; var isF = faved.indexOf(r.it.u) !== -1;
      star.textContent = isF ? '★' : '☆'; star.setAttribute('aria-pressed', isF ? 'true' : 'false'); star.setAttribute('aria-label', (isF ? L().delFav : L().addFav) + ': ' + r.it.n); star.classList.toggle('on', isF);
      star.addEventListener('click', function () { toggleFav(r.it); if (view === 'fav') { renderList(); } else { var f = isFav(r.it.u); star.textContent = f ? '★' : '☆'; star.setAttribute('aria-pressed', f ? 'true' : 'false'); star.classList.toggle('on', f); star.setAttribute('aria-label', (f ? L().delFav : L().addFav) + ': ' + r.it.n); } });
      li.appendChild(b); li.appendChild(star); listEl.appendChild(li);
    });
  }
  function afterPick() { if (window.matchMedia && matchMedia('(max-width: 700px)').matches) openPanel(false); }

  // ---- audio
  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio(); audio.preload = 'none';
    audio.addEventListener('playing', function () {
      clearTimeout(failTimer); tries = 0; retried = false; waitOnline = false; setState('playing', '');
      var it = currentItem(); if (it) { clearBad(it.u); addRecent(it); }
      if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing';
    });
    audio.addEventListener('waiting', function () { if (state === 'playing') armFail(); });
    audio.addEventListener('error', function () { onBroken(attemptSeq); });
    audio.addEventListener('stalled', function () { if (state === 'loading') armFail(); });
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
  function armFail() { clearTimeout(failTimer); var my = attemptSeq; failTimer = setTimeout(function () { onBroken(my); }, 12000); }
  function start(item) {
    var a = ensureAudio(), my = ++attemptSeq; armFail(); a.src = item.u;
    var p = a.play(); if (p && p.catch) p.catch(function (e) { if (my !== attemptSeq) return; if (e && e.name === 'NotAllowedError') { clearTimeout(failTimer); setState('paused', ''); } else onBroken(my); });
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
    markBad(it.u); retried = false; stat.skip++;
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
  function openPanel(open) {
    panel.hidden = !open; toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); titleBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); bar.classList.toggle('open', open);
    toggleBtn.textContent = open ? '▴' : '▾';
    if (open) fetchList().then(function () { renderCats(); renderList(); var on = listEl.querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' }); }).catch(function () { /* message already shown */ });
  }
  function viewButton(which) { view = view === which ? 'cat' : which; searchEl.value = ''; if (data) { renderCats(); renderList(); } else fetchList().then(function () { renderCats(); renderList(); }).catch(function () { /* shown */ }); }

  playBtn.addEventListener('click', toggle);
  prevBtn.addEventListener('click', function () { step(-1); });
  nextBtn.addEventListener('click', function () { step(1); });
  toggleBtn.addEventListener('click', function () { openPanel(panel.hidden); });
  titleBtn.addEventListener('click', function () { openPanel(panel.hidden); });
  searchEl.addEventListener('input', function () { renderSub(); renderList(); });
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
  window.LXARadio = { state: function () { return { state: state, view: view, cat: catId, current: currentItem() || null, tries: tries, status: statusKey, eco: eco, dir: lastDir, retried: retried }; }, audio: function () { return audio; }, bad: bad, stats: stat };
})();
