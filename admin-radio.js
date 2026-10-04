// ADMIN > RADIO helpers: the tab bar (reports | stations), the "move to a category" emoji chips and the station manager (EVERY station of the list: search + filter, move, reset, hide / show).
// Loaded after renderer.js; it only uses what the admin panel already has (lxaRequest, lxaAccount, renderAccountPanel, lxaRadioCache, lang). Nothing here runs for players.
// Buttons carry emoji only (the words are in title / aria-label).
(function () {
  'use strict';
  var TEXT = {
    de: { tabReports: '📊 Meldungen', tabStations: '📻 Sender', search: 'Sender suchen…', all: 'Alle Kategorien', moved: 'Verschoben', hidden: 'Versteckt', moveTitle: 'In eine Kategorie verschieben', undoTitle: 'Zurück an den automatischen Platz', hideTitle: 'Verstecken', showTitle: 'Zeigen', count: 'Sender', more: 'Nur die ersten 80 – Suche verfeinern.', none: 'Keine Sender.', hint: 'Jeder Sender lässt sich in jede Kategorie verschieben (📂, er steht dort ganz oben) oder verstecken (🙈). Wirkt für alle Spieler nach wenigen Minuten, ohne Deploy.', failed: 'Nicht gespeichert.' },
    ro: { tabReports: '📊 Rapoarte', tabStations: '📻 Stații', search: 'Caută stație…', all: 'Toate categoriile', moved: 'Mutate', hidden: 'Ascunse', moveTitle: 'Mută într-o categorie', undoTitle: 'Înapoi la locul automat', hideTitle: 'Ascunde', showTitle: 'Arată', count: 'stații', more: 'Doar primele 80 – restrânge căutarea.', none: 'Nicio stație.', hint: 'Orice stație poate fi mutată în orice categorie (📂, apare prima acolo) sau ascunsă (🙈). Se vede la toți jucătorii în câteva minute, fără deploy.', failed: 'Nu s-a salvat.' },
    en: { tabReports: '📊 Reports', tabStations: '📻 Stations', search: 'Search station…', all: 'All categories', moved: 'Moved', hidden: 'Hidden', moveTitle: 'Move to a category', undoTitle: 'Back to the automatic place', hideTitle: 'Hide', showTitle: 'Show', count: 'stations', more: 'Only the first 80 – narrow the search.', none: 'No stations.', hint: 'Any station can be moved to any category (📂, it sits at the top there) or hidden (🙈). Reaches every player within minutes, no deploy.', failed: 'Not saved.' }
  };
  var L = function () { var l = typeof lang === 'string' ? lang : ''; return TEXT[l] || TEXT.de; };
  var esc = function (v) { return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var MAX_ROWS = 80;
  var tab = 'reports', stations = null, categories = [], filter = { q: '', cat: 'all' };
  var cat = function (id) { for (var i = 0; i < categories.length; i++) if (categories[i].id === id) return categories[i]; return null; };
  var emojiOf = function (id) { var c = cat(id); return c ? c.emoji : id; };

  function tabsHtml() {
    return '<div class="radio-admin-tabs" role="tablist">' + [['reports', L().tabReports], ['stations', L().tabStations]].map(function (t) {
      return '<button type="button" role="tab" class="radio-admin-tab' + (tab === t[0] ? ' on' : '') + '" aria-selected="' + (tab === t[0]) + '" data-radio-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>';
  }
  // 📂 opens a row of emoji chips (one per category) under the station; the chip of the category the owner moved it to is lit, the categories it is in by itself are marked
  function toggleHtml(key, moved, cats) {
    return '<button type="button" class="radio-iconbtn" data-radio-movetoggle="' + esc(key) + '" data-moved="' + esc(moved || '') + '" data-cats="' + esc((cats || []).join(',')) + '" title="' + esc(L().moveTitle) + '" aria-label="' + esc(L().moveTitle) + '" aria-expanded="false">📂</button>';
  }
  var panelHtml = function (key) { return '<div class="radio-move-panel" data-panel="' + esc(key) + '" hidden></div>'; };
  function chipsHtml(key, moved, cats) {
    var own = (cats || '').split(',');
    return categories.map(function (c) {
      return '<button type="button" class="radio-chip' + (moved === c.id ? ' on' : own.indexOf(c.id) !== -1 ? ' auto' : '') + '" data-radio-move="' + esc(c.id) + '" data-key="' + esc(key) + '" title="' + esc(c.label) + '" aria-label="' + esc(L().moveTitle + ': ' + c.label) + '"' + (moved === c.id ? ' aria-pressed="true"' : '') + '>' + esc(c.emoji) + '</button>';
    }).join('');
  }

  function request(op, extra) { var data = { id: lxaAccount.id, op: op }; Object.keys(extra || {}).forEach(function (k) { data[k] = extra[k]; }); return lxaRequest('admin-radio', data); }
  // right after a deploy the stored list is still the one of the previous code (it is rebuilt by the first visit of the radio, ~30 s): the panel wakes the builder itself
  var woke = false, wake = function (r) { if (r && r.outdated && !woke) { woke = true; try { fetch('/api/radio', { cache: 'no-store' }).catch(function () { /* the next visit builds it */ }); } catch (e) { /* ignore */ } } };
  function loadStations() { return request('stations').then(function (r) { wake(r); stations = r.stations || []; categories = r.categories || categories; }); }
  function reload(message) {   // the reports view re-reads its list; the station manager re-reads its own
    return request('list').then(function (r) { wake(r); lxaRadioCache = r; if (tab === 'stations') return loadStations().then(function () { renderAccountPanel('radio-admin', message || ''); }); renderAccountPanel('radio-admin', message || ''); });
  }
  var failure = function (err) { renderAccountPanel('radio-admin', (err && err.message) || L().failed); };

  function rowHtml(s) {
    var inCats = (s.cats || []).filter(function (c) { return c !== 'top'; }), emojis = inCats.map(emojiOf).join(' ');
    return '<div class="player-row radio-station' + (s.hidden ? ' is-hidden' : '') + '" data-key="' + esc(s.key) + '"><span class="player-row-info"><b>' + esc(s.n) + (s.moved ? ' <span class="radio-moved-tag">↦ ' + esc(emojiOf(s.moved)) + '</span>' : '') + (s.hidden ? ' <span class="radio-hidden-tag">🙈</span>' : '') + '</b><small>' + esc((s.c || '') + (s.b ? ' ' + s.b : '') + (s.cc && s.cc !== 'RO' ? ' · ' + s.cc : '')) + ' · ' + esc(emojis) + '</small></span>' +
      '<span class="radio-station-actions">' + toggleHtml(s.key, s.moved, inCats) + (s.moved ? '<button type="button" class="radio-iconbtn" data-radio-op="unmove" data-key="' + esc(s.key) + '" title="' + esc(L().undoTitle) + '" aria-label="' + esc(L().undoTitle) + '">↩</button>' : '') +
      '<button type="button" class="radio-iconbtn' + (s.hidden ? ' radio-show' : '') + '" data-radio-op="' + (s.hidden ? 'unhide' : 'hide') + '" data-key="' + esc(s.key) + '" title="' + esc(s.hidden ? L().showTitle : L().hideTitle) + '" aria-label="' + esc(s.hidden ? L().showTitle : L().hideTitle) + '">' + (s.hidden ? '👁️' : '🙈') + '</button></span>' + panelHtml(s.key) + '</div>';
  }
  function rowsHtml() {
    var q = filter.q.trim().toLowerCase(), list = (stations || []).filter(function (s) {
      if (q && s.n.toLowerCase().indexOf(q) === -1) return false;
      if (filter.cat === 'moved') return !!s.moved; if (filter.cat === 'hidden') return !!s.hidden;
      return filter.cat === 'all' || (s.cats || []).indexOf(filter.cat) !== -1;
    });
    return '<p class="account-hint">' + list.length + ' ' + esc(L().count) + (list.length > MAX_ROWS ? ' · ' + esc(L().more) : '') + '</p>' +
      (list.length ? '<div class="account-players-list">' + list.slice(0, MAX_ROWS).map(rowHtml).join('') + '</div>' : '<p class="account-notice">' + esc(L().none) + '</p>');
  }

  function mountStations(root) {
    root.innerHTML = '<p class="account-hint">' + esc(L().hint) + '</p><div class="radio-station-tools"><input type="search" class="radio-station-search" maxlength="40" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="' + esc(L().search) + '" value="' + esc(filter.q) + '" aria-label="' + esc(L().search) + '"><select class="radio-station-filter" aria-label="' + esc(L().all) + '"><option value="all">' + esc(L().all) + '</option>' +
      categories.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.emoji + ' ' + c.label) + '</option>'; }).join('') + '<option value="moved">↦ ' + esc(L().moved) + '</option><option value="hidden">🙈 ' + esc(L().hidden) + '</option></select></div><div class="radio-station-rows"></div>';
    var rows = root.querySelector('.radio-station-rows'), sel = root.querySelector('.radio-station-filter'), input = root.querySelector('.radio-station-search');
    sel.value = filter.cat; rows.innerHTML = rowsHtml();
    input.addEventListener('input', function () { filter.q = input.value; rows.innerHTML = rowsHtml(); });   // only the rows are redrawn: the keyboard stays open
    sel.addEventListener('change', function () { filter.cat = sel.value; rows.innerHTML = rowsHtml(); });
  }

  // one delegated handler for everything in the admin panel (it is re-rendered all the time): tabs, 📂 / chips, ↩, 🙈 / 👁️
  var bound = false;
  function bind(panel) {
    if (bound) return; bound = true;
    panel.addEventListener('click', function (e) {
      var t = e.target; if (!t || !t.closest) return;
      var tabBtn = t.closest('[data-radio-tab]');
      if (tabBtn) { tab = tabBtn.dataset.radioTab; if (tab === 'stations') loadStations().then(function () { renderAccountPanel('radio-admin'); }).catch(function (err) { tab = 'reports'; failure(err); }); else renderAccountPanel('radio-admin'); return; }
      var toggle = t.closest('[data-radio-movetoggle]');
      if (toggle) {
        var row = toggle.closest('.player-row'), box = row && row.querySelector('.radio-move-panel'); if (!box) return;
        var open = box.hidden; panel.querySelectorAll('.radio-move-panel').forEach(function (p) { p.hidden = true; }); panel.querySelectorAll('[data-radio-movetoggle]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
        if (open) { box.innerHTML = chipsHtml(toggle.dataset.radioMovetoggle, toggle.dataset.moved, toggle.dataset.cats); box.hidden = false; toggle.setAttribute('aria-expanded', 'true'); }
        return;
      }
      var chip = t.closest('[data-radio-move]');
      if (chip) { chip.disabled = true; request('move', { key: chip.dataset.key, cat: chip.dataset.radioMove }).then(function () { return reload(); }).catch(function (err) { chip.disabled = false; failure(err); }); return; }
      var btn = t.closest('[data-radio-op]'); if (!btn) return;
      btn.disabled = true;
      request(btn.dataset.radioOp, { key: btn.dataset.key }).then(function () { return reload(); }).catch(function (err) { btn.disabled = false; failure(err); });
    });
  }
  // called by the admin panel after it drew the RADIO view
  function afterRender(panel) {
    bind(panel);
    var root = panel.querySelector('#radioStations'); if (root && stations) mountStations(root);
  }
  function reset() { tab = 'reports'; stations = null; filter = { q: '', cat: 'all' }; }

  window.LXAAdminRadio = { wake: wake, tabsHtml: tabsHtml, toggleHtml: toggleHtml, panelHtml: panelHtml, afterRender: afterRender, reset: reset, tab: function () { return tab; }, setCategories: function (c) { if (c && c.length) categories = c; } };
})();
