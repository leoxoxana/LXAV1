// ADMIN > RADIO helpers: the tab bar (reports | stations), the "move to a category" drop-down and the station manager (every station of the list, search + filter, move / hide / show).
// Loaded after renderer.js; it only uses what the admin panel already has (lxaRequest, lxaAccount, renderAccountPanel, lxaRadioCache, lang). Nothing here runs for players.
(function () {
  'use strict';
  var TEXT = {
    de: { tabReports: '📊 Meldungen', tabStations: '🗂 Sender', search: 'Sender suchen…', all: 'Alle Kategorien', moved: 'Verschoben', hidden: 'Versteckt', moveTo: '↦ Verschieben nach…', movedTag: 'VERSCHOBEN', hiddenTag: 'VERSTECKT', undo: 'Zurücksetzen', undoTitle: 'Zurück an den automatischen Platz', count: 'Sender', more: 'Nur die ersten 80 – Suche verfeinern.', none: 'Keine Sender.', hide: 'Verstecken', show: 'Zeigen', hint: 'Jeden Sender in jede Kategorie verschieben (er steht dort ganz oben) oder verstecken. Wirkt für alle Spieler nach wenigen Minuten, ohne Deploy.', failed: 'Nicht gespeichert.' },
    ro: { tabReports: '📊 Rapoarte', tabStations: '🗂 Stații', search: 'Caută stație…', all: 'Toate categoriile', moved: 'Mutate', hidden: 'Ascunse', moveTo: '↦ Mută în…', movedTag: 'MUTATĂ', hiddenTag: 'ASCUNSĂ', undo: 'Resetează', undoTitle: 'Înapoi la locul automat', count: 'stații', more: 'Doar primele 80 – restrânge căutarea.', none: 'Nicio stație.', hide: 'Ascunde', show: 'Arată', hint: 'Muți orice stație în orice categorie (apare prima acolo) sau o ascunzi. Se vede la toți jucătorii în câteva minute, fără deploy.', failed: 'Nu s-a salvat.' },
    en: { tabReports: '📊 Reports', tabStations: '🗂 Stations', search: 'Search station…', all: 'All categories', moved: 'Moved', hidden: 'Hidden', moveTo: '↦ Move to…', movedTag: 'MOVED', hiddenTag: 'HIDDEN', undo: 'Reset', undoTitle: 'Back to the automatic place', count: 'stations', more: 'Only the first 80 – narrow the search.', none: 'No stations.', hide: 'Hide', show: 'Show', hint: 'Move any station to any category (it sits at the top there) or hide it. Reaches every player within minutes, no deploy.', failed: 'Not saved.' }
  };
  var L = function () { var l = typeof lang === 'string' ? lang : ''; return TEXT[l] || TEXT.de; };
  var esc = function (v) { return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var MAX_ROWS = 80;
  var tab = 'reports', stations = null, categories = [], filter = { q: '', cat: 'all' };
  var label = function (id) { for (var i = 0; i < categories.length; i++) if (categories[i].id === id) return categories[i].emoji + ' ' + categories[i].label; return id; };

  function tabsHtml() {
    return '<div class="radio-admin-tabs" role="tablist">' + [['reports', L().tabReports], ['stations', L().tabStations]].map(function (t) {
      return '<button type="button" role="tab" class="radio-admin-tab' + (tab === t[0] ? ' on' : '') + '" aria-selected="' + (tab === t[0]) + '" data-radio-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>';
  }
  // the drop-down: always shows "move to…", the categories as options (the station's current manual category is marked)
  function moveSelectHtml(key, cats, current) {
    var list = cats && cats.length ? cats : categories;
    return '<select class="radio-move" data-key="' + esc(key) + '" aria-label="' + esc(L().moveTo) + '"><option value="">' + esc(L().moveTo) + '</option>' + list.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (current === c.id ? ' disabled' : '') + '>' + (current === c.id ? '✓ ' : '') + esc(c.emoji + ' ' + c.label) + '</option>';
    }).join('') + '</select>';
  }

  function request(op, extra) { var data = { id: lxaAccount.id, op: op }; Object.keys(extra || {}).forEach(function (k) { data[k] = extra[k]; }); return lxaRequest('admin-radio', data); }
  function reload(message) {   // the reports view re-reads its list; the station manager re-reads its own
    return request('list').then(function (r) { lxaRadioCache = r; if (tab === 'stations') return loadStations().then(function () { renderAccountPanel('radio-admin', message || ''); }); renderAccountPanel('radio-admin', message || ''); });
  }
  function loadStations() { return request('stations').then(function (r) { stations = r.stations || []; categories = r.categories || categories; }); }

  function rowHtml(s) {
    var cats = (s.cats || []).filter(function (c) { return c !== 'top'; }).map(label).join(' · ');
    return '<div class="player-row radio-station' + (s.hidden ? ' is-hidden' : '') + '" data-key="' + esc(s.key) + '"><span class="player-row-info"><b>' + esc(s.n) + (s.moved ? ' <span class="radio-moved-tag">' + esc(L().movedTag) + ' → ' + esc(label(s.moved)) + '</span>' : '') + (s.hidden ? ' <span class="radio-hidden-tag">' + esc(L().hiddenTag) + '</span>' : '') + '</b><small>' + esc((s.c || '') + (s.b ? ' ' + s.b : '') + (s.cc && s.cc !== 'RO' ? ' · ' + s.cc : '')) + ' · ' + esc(cats) + '</small></span>' +
      '<span class="radio-station-actions">' + moveSelectHtml(s.key, categories, s.moved) + (s.moved ? '<button type="button" class="radio-textbtn" data-radio-op="unmove" data-key="' + esc(s.key) + '" title="' + esc(L().undoTitle) + '">↩ ' + esc(L().undo) + '</button>' : '') +
      '<button type="button" class="radio-textbtn' + (s.hidden ? ' radio-show' : '') + '" data-radio-op="' + (s.hidden ? 'unhide' : 'hide') + '" data-key="' + esc(s.key) + '">' + (s.hidden ? '👁️ ' + esc(L().show) : '🙈 ' + esc(L().hide)) + '</button></span></div>';
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

  // one delegated handler for every move drop-down, hide / show / reset button in the admin panel (the panel is re-rendered all the time)
  var bound = false;
  function bind(panel) {
    if (bound) return; bound = true;
    panel.addEventListener('change', function (e) {
      var el = e.target; if (!el || !el.classList || !el.classList.contains('radio-move') || !el.value) return;
      var key = el.dataset.key, cat = el.value; el.disabled = true;
      request('move', { key: key, cat: cat }).then(function () { return reload(); }).catch(function (err) { el.disabled = false; el.value = ''; renderAccountPanel('radio-admin', (err && err.message) || L().failed); });
    });
    panel.addEventListener('click', function (e) {
      var tabBtn = e.target.closest && e.target.closest('[data-radio-tab]');
      if (tabBtn) { tab = tabBtn.dataset.radioTab; if (tab === 'stations') loadStations().then(function () { renderAccountPanel('radio-admin'); }).catch(function (err) { tab = 'reports'; renderAccountPanel('radio-admin', (err && err.message) || L().failed); }); else renderAccountPanel('radio-admin'); return; }
      var btn = e.target.closest && e.target.closest('[data-radio-op]'); if (!btn) return;
      btn.disabled = true;
      request(btn.dataset.radioOp, { key: btn.dataset.key }).then(function () { return reload(); }).catch(function (err) { btn.disabled = false; renderAccountPanel('radio-admin', (err && err.message) || L().failed); });
    });
  }
  // called by the admin panel after it drew the RADIO view
  function afterRender(panel) {
    bind(panel);
    var root = panel.querySelector('#radioStations'); if (root && stations) mountStations(root);
  }
  function reset() { tab = 'reports'; stations = null; filter = { q: '', cat: 'all' }; }

  window.LXAAdminRadio = { tabsHtml: tabsHtml, moveSelectHtml: moveSelectHtml, afterRender: afterRender, reset: reset, tab: function () { return tab; }, setCategories: function (c) { if (c && c.length) categories = c; } };
})();
