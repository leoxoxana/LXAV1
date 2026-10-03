// Compact radio player (bottom of the page, above the Ko-fi goal bar). ONE audio element, the station list comes from /api/radio (Radio Browser, filtered + probed on the server).
// Nothing starts by itself: the list is fetched on the first tap, audio only plays after a tap. Station names are inserted with textContent (never as HTML).
(function () {
  'use strict';
  var bar = document.getElementById('radioBar');
  if (!bar) return;
  var $ = function (id) { return document.getElementById(id); };
  var playBtn = $('radioPlay'), titleBtn = $('radioTitle'), nameEl = $('radioName'), volEl = $('radioVol'), toggleBtn = $('radioToggle'),
      panel = $('radioPanel'), catsEl = $('radioCats'), searchEl = $('radioSearch'), listEl = $('radioList'), msgEl = $('radioMsg');
  var KEY = 'lxa-radio-v1', LIST_KEY = 'lxa-radio-list-v1', LIST_TTL = 30 * 60 * 1000;
  var TEXT = {
    de: { pick: 'Sender wählen', search: 'Suchen…', loading: 'Lädt…', none: 'Keine Sender gefunden.', fail: 'Radio-Liste nicht erreichbar.', broken: 'Sender nicht erreichbar – nächster…', allbroken: 'Kein Sender in dieser Kategorie erreichbar.', play: 'Radio abspielen', pause: 'Radio pausieren', stations: 'Senderliste', volume: 'Lautstärke' },
    ro: { pick: 'Alege o stație', search: 'Caută…', loading: 'Se încarcă…', none: 'Nicio stație găsită.', fail: 'Lista de radio nu e disponibilă.', broken: 'Stația nu răspunde – trec la următoarea…', allbroken: 'Nicio stație din această categorie nu răspunde.', play: 'Pornește radioul', pause: 'Oprește radioul', stations: 'Lista de stații', volume: 'Volum' },
    en: { pick: 'Pick a station', search: 'Search…', loading: 'Loading…', none: 'No stations found.', fail: 'Radio list unavailable.', broken: 'Station not reachable – trying the next one…', allbroken: 'No station in this category is reachable.', play: 'Play radio', pause: 'Pause radio', stations: 'Station list', volume: 'Volume' }
  };
  var L = function () { var l = typeof lang === 'string' ? lang : ''; if (!TEXT[l]) { try { l = localStorage.getItem('lxaLang') || ''; } catch (e) { l = ''; } } return TEXT[l] || TEXT.de; };

  var audio = null;                    // created at the first play: the ONE audio element
  var data = null, catId = 'pop', current = null /* {cat, i} */, state = 'idle', failTimer = 0, tries = 0, loadingList = null;
  var saved = {}; try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
  var persist = function () { try { localStorage.setItem(KEY, JSON.stringify({ cat: catId, url: current ? currentItem().u : saved.url, name: current ? currentItem().n : saved.name, vol: Number(volEl.value) })); } catch (e) { /* storage unavailable */ } };
  if (saved.cat) catId = saved.cat;
  if (typeof saved.vol === 'number') volEl.value = String(Math.max(0, Math.min(100, saved.vol)));

  var cat = function (id) { return data && data.cats.filter(function (c) { return c.id === id; })[0]; };
  var currentItem = function () { var c = current && cat(current.cat); return c && c.items[current.i]; };
  var safeUrl = function (u) { return typeof u === 'string' && /^https:\/\/[^\s]+$/i.test(u); };

  function setState(next, text) {
    state = next; bar.setAttribute('data-state', next);
    var playing = next === 'playing' || next === 'loading';
    playBtn.textContent = playing ? '⏸' : '▶';
    playBtn.setAttribute('aria-label', playing ? L().pause : L().play);
    if (text !== undefined) msgEl.textContent = text;
  }
  function label() { var item = currentItem(); nameEl.textContent = item ? item.n : (saved.name || L().pick); }
  function applyText() {
    searchEl.placeholder = L().search; toggleBtn.setAttribute('aria-label', L().stations); volEl.setAttribute('aria-label', L().volume);
    setState(state); label();
  }

  // ---- list
  function fetchList() {
    if (data && Date.now() - data.at < LIST_TTL) return Promise.resolve(data);
    if (loadingList) return loadingList;
    var cached = null; try { cached = JSON.parse(localStorage.getItem(LIST_KEY) || 'null'); } catch (e) { cached = null; }
    if (!data && cached && cached.cats && Date.now() - cached.at < LIST_TTL) { data = cached; return Promise.resolve(data); }
    msgEl.textContent = L().loading;
    loadingList = fetch('/api/radio', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); }).then(function (json) {
      if (!json || !Array.isArray(json.cats)) throw new Error('bad list');
      // validate everything that goes into the page / the audio element
      json.cats = json.cats.map(function (c) { return { id: String(c.id), emoji: String(c.emoji || ''), label: String(c.label || c.id), items: (Array.isArray(c.items) ? c.items : []).filter(function (i) { return i && safeUrl(i.u) && typeof i.n === 'string'; }).map(function (i) { return { n: i.n.slice(0, 60), u: i.u, c: String(i.c || ''), b: Number(i.b) || 0, cc: String(i.cc || '').slice(0, 2) }; }) }; });
      json.at = Date.now(); data = json; try { localStorage.setItem(LIST_KEY, JSON.stringify(json)); } catch (e) { /* too big or blocked */ }
      msgEl.textContent = ''; return data;
    }).catch(function (e) {
      if (cached && cached.cats) { data = cached; msgEl.textContent = ''; return data; }   // last list this device saw
      msgEl.textContent = L().fail; throw e;
    }).then(function (d) { loadingList = null; return d; }, function (e) { loadingList = null; throw e; });
    return loadingList;
  }

  // ---- rendering
  function renderCats() {
    catsEl.textContent = '';
    data.cats.forEach(function (c) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'radio-cat' + (c.id === catId ? ' on' : ''); b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', c.id === catId ? 'true' : 'false');
      b.textContent = c.emoji + ' ' + c.label; b.addEventListener('click', function () { catId = c.id; searchEl.value = ''; renderCats(); renderList(); persist(); });
      catsEl.appendChild(b);
    });
  }
  function renderList() {
    listEl.textContent = '';
    if (!data) return;
    var q = searchEl.value.trim().toLowerCase(), rows = [];
    if (q) data.cats.forEach(function (c) { c.items.forEach(function (it, i) { if (it.n.toLowerCase().indexOf(q) !== -1 && !rows.some(function (r) { return r.it.u === it.u; })) rows.push({ c: c, it: it, i: i }); }); });
    else (cat(catId) || { items: [] }).items.forEach(function (it, i) { rows.push({ c: cat(catId), it: it, i: i }); });
    if (!rows.length) { var empty = document.createElement('li'); empty.className = 'radio-empty'; empty.textContent = L().none; listEl.appendChild(empty); return; }
    var now = currentItem();
    rows.forEach(function (r) {
      var li = document.createElement('li'), b = document.createElement('button'); b.type = 'button'; b.className = 'radio-st';
      var on = now && now.u === r.it.u; if (on) { b.classList.add('on'); b.setAttribute('aria-current', 'true'); }
      var name = document.createElement('span'); name.className = 'radio-st-name'; name.textContent = r.it.n;
      var meta = document.createElement('small'); meta.textContent = (r.it.cc && r.it.cc !== 'RO' ? r.it.cc + ' · ' : '') + r.it.c + (r.it.b ? ' ' + r.it.b : '');
      b.appendChild(name); b.appendChild(meta);
      b.addEventListener('click', function () { playStation(r.c.id, r.i); });
      li.appendChild(b); listEl.appendChild(li);
    });
  }

  // ---- audio
  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio(); audio.preload = 'none';
    audio.addEventListener('playing', function () { clearTimeout(failTimer); tries = 0; setState('playing', ''); if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing'; });
    audio.addEventListener('waiting', function () { if (state === 'playing') armFail(); });
    audio.addEventListener('error', function () { onBroken(); });
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
  function armFail() { clearTimeout(failTimer); failTimer = setTimeout(onBroken, 12000); }
  function onBroken() {
    clearTimeout(failTimer);
    if (state === 'idle' || state === 'paused') return;
    var c = current && cat(current.cat);
    if (!c || tries >= 4 || c.items.length < 2) { tries = 0; setState('error', L().allbroken); if (audio) { audio.pause(); } return; }
    tries++; setState('loading', L().broken); play(current.cat, (current.i + 1) % c.items.length, true);
  }
  function play(catKey, index, auto) {
    var c = cat(catKey), item = c && c.items[index]; if (!item || !safeUrl(item.u)) return;
    var a = ensureAudio(); current = { cat: catKey, i: index }; if (!auto) tries = 0;
    label(); setState('loading', auto ? msgEl.textContent : ''); armFail();
    a.src = item.u;
    var p = a.play(); if (p && p.catch) p.catch(function (e) { if (e && e.name === 'NotAllowedError') { clearTimeout(failTimer); setState('paused', ''); } else onBroken(); });
    if (navigator.mediaSession && window.MediaMetadata) navigator.mediaSession.metadata = new MediaMetadata({ title: item.n, artist: 'LXA Radio' });
    persist(); if (!panel.hidden) renderList();
  }
  function playStation(catKey, index) { play(catKey, index, false); }
  function step(dir) { var c = current && cat(current.cat); if (!c || !c.items.length) return; play(current.cat, (current.i + dir + c.items.length) % c.items.length, false); }
  function pause() { clearTimeout(failTimer); if (audio) audio.pause(); setState('paused', ''); if (navigator.mediaSession) navigator.mediaSession.playbackState = 'paused'; }
  function toggle() {
    if (state === 'playing' || state === 'loading') { pause(); return; }
    fetchList().then(function () {
      if (current && cat(current.cat) && currentItem()) { play(current.cat, current.i, false); return; }
      var c = cat(catId) || data.cats[0], idx = 0;
      if (saved.url) { var f = c.items.map(function (i) { return i.u; }).indexOf(saved.url); if (f >= 0) idx = f; }
      play(c.id, idx, false);
    }).catch(function () { setState('error', L().fail); });
  }

  // ---- panel
  function openPanel(open) {
    panel.hidden = !open; toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); titleBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); bar.classList.toggle('open', open);
    toggleBtn.textContent = open ? '▴' : '▾';
    if (open) fetchList().then(function () { renderCats(); renderList(); var on = listEl.querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' }); }).catch(function () { /* message already shown */ });
  }

  playBtn.addEventListener('click', toggle);
  toggleBtn.addEventListener('click', function () { openPanel(panel.hidden); });
  titleBtn.addEventListener('click', function () { openPanel(panel.hidden); });
  searchEl.addEventListener('input', renderList);
  volEl.addEventListener('input', function () { if (audio) audio.volume = Number(volEl.value) / 100; persist(); });
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'language') applyText(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) openPanel(false); });

  setState('idle', ''); applyText();
  window.LXARadio = { state: function () { return { state: state, cat: catId, current: current && currentItem(), tries: tries }; }, audio: function () { return audio; } };
})();
