// ADMIN > RADIO helpers: the tab bar (reports | stations), the "move to a category" emoji chips and the station manager (EVERY station of the list: search + filter, move, reset, hide / show).
// Loaded after renderer.js; it only uses what the admin panel already has (lxaRequest, lxaAccount, renderAccountPanel, lxaRadioCache, lang). Nothing here runs for players.
// Buttons carry emoji only (the words are in title / aria-label).
(function () {
  'use strict';
  var TEXT = {
    de: { tabReports: '📊 Meldungen', tabStations: '📻 Sender', search: 'Sender suchen…', all: 'Alle Kategorien', moved: 'Verschoben', hidden: 'Versteckt', moveTitle: 'In eine Kategorie verschieben', undoTitle: 'Zurück an den automatischen Platz', hideTitle: 'Verstecken', showTitle: 'Zeigen', count: 'Sender', more: 'Nur die ersten 80 – Suche verfeinern.', none: 'Keine Sender.', hint: 'Jeder Sender lässt sich in jede Kategorie verschieben (📂, er steht dort ganz oben) oder verstecken (🙈). Wirkt für alle Spieler nach wenigen Minuten, ohne Deploy.', failed: 'Nicht gespeichert.', tabSuggest: '📨 Vorschläge', sugPlayers: 'Spieler, die den Link geschickt haben', sugTest: 'Link jetzt testen', sugApprove: 'Freigeben in einer Kategorie', sugReject: 'Ablehnen (erscheint nie wieder)', sugRemove: 'Freigegebenen Sender entfernen', sugNone: 'Keine Vorschläge.', sugApproved: 'Freigegeben (öffentlich):', sugHint: 'Links, die Spieler mit 📨 geschickt haben, ein Eintrag pro Link. 🔍 testet (🖥️ Server, 📱 Handy), ✅ öffnet die 12 Kategorien: ein Tipp macht den Sender für alle öffentlich (ganz oben dort), ❌ lehnt ab. Den Namen kannst du vorher ändern.', sugTokenWarn: 'Der Link enthält Parameter (🔑, evtl. ein Token). Öffentlich machen?' },
    ro: { tabReports: '📊 Rapoarte', tabStations: '📻 Stații', search: 'Caută stație…', all: 'Toate categoriile', moved: 'Mutate', hidden: 'Ascunse', moveTitle: 'Mută într-o categorie', undoTitle: 'Înapoi la locul automat', hideTitle: 'Ascunde', showTitle: 'Arată', count: 'stații', more: 'Doar primele 80 – restrânge căutarea.', none: 'Nicio stație.', hint: 'Orice stație poate fi mutată în orice categorie (📂, apare prima acolo) sau ascunsă (🙈). Se vede la toți jucătorii în câteva minute, fără deploy.', failed: 'Nu s-a salvat.', tabSuggest: '📨 Propuneri', sugPlayers: 'jucători care au trimis linkul', sugTest: 'Testează linkul acum', sugApprove: 'Aprobă într-o categorie', sugReject: 'Respinge (nu mai apare niciodată)', sugRemove: 'Scoate stația aprobată', sugNone: 'Nicio propunere.', sugApproved: 'Aprobate (publice):', sugHint: 'Linkurile trimise de jucători cu 📨, un rând pe link. 🔍 testează (🖥️ server, 📱 telefon), ✅ deschide cele 12 categorii: o atingere face stația publică pentru toți (prima în categorie), ❌ respinge. Numele îl poți schimba înainte.', sugTokenWarn: 'Linkul are parametri (🔑, poate un token). Îl faci public?' },
    en: { tabReports: '📊 Reports', tabStations: '📻 Stations', search: 'Search station…', all: 'All categories', moved: 'Moved', hidden: 'Hidden', moveTitle: 'Move to a category', undoTitle: 'Back to the automatic place', hideTitle: 'Hide', showTitle: 'Show', count: 'stations', more: 'Only the first 80 – narrow the search.', none: 'No stations.', hint: 'Any station can be moved to any category (📂, it sits at the top there) or hidden (🙈). Reaches every player within minutes, no deploy.', failed: 'Not saved.', tabSuggest: '📨 Suggestions', sugPlayers: 'players who sent the link', sugTest: 'Test the link now', sugApprove: 'Approve into a category', sugReject: 'Reject (never shown again)', sugRemove: 'Remove the approved station', sugNone: 'No suggestions.', sugApproved: 'Approved (public):', sugHint: 'Links that players sent with 📨, one row per link. 🔍 tests (🖥️ server, 📱 phone), ✅ opens the 12 categories: one tap makes the station public for everybody (at the top there), ❌ rejects. You can change the name first.', sugTokenWarn: 'The link has parameters (🔑, maybe a token). Make it public?' }
  };
  var L = function () { var l = typeof lang === 'string' ? lang : ''; return TEXT[l] || TEXT.de; };
  var esc = function (v) { return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var MAX_ROWS = 80;
  var tab = 'reports', stations = null, categories = [], filter = { q: '', cat: 'all' };
  var sugRows = null, approved = [], targets = [], suggestCount = 0;   // the 📨 tab: links the players offered, stations the owner approved, the 12 target categories
  var EMOJI12 = { global: '🌍', top: '⭐' };
  var cat = function (id) { for (var i = 0; i < categories.length; i++) if (categories[i].id === id) return categories[i]; return null; };
  var emojiOf = function (id) { var c = cat(id); return c ? c.emoji : id; };

  function tabsHtml() {
    return '<div class="radio-admin-tabs" role="tablist">' + [['reports', L().tabReports], ['stations', L().tabStations], ['suggest', L().tabSuggest + (suggestCount ? ' ' + suggestCount : '')]].map(function (t) {
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
  function loadSuggest() { return request('suggestions').then(function (r) { sugRows = r.suggestions || []; approved = r.approved || []; targets = r.targets || []; suggestCount = sugRows.length; }); }
  function reload(message) {   // the reports view re-reads its list; the station manager and the 📨 tab re-read their own
    return request('list').then(function (r) { wake(r); lxaRadioCache = r; suggestCount = Number(r.suggestCount) || 0; if (tab === 'stations') return loadStations().then(function () { renderAccountPanel('radio-admin', message || ''); }); if (tab === 'suggest') return loadSuggest().then(function () { renderAccountPanel('radio-admin', message || ''); }); renderAccountPanel('radio-admin', message || ''); });
  }
  // ---- 📨 the links the players offered: one row per link, 🔍 test, ✅ approve into one of the 12 categories (emoji chips), ❌ reject
  var ago = function (ts) { if (!ts) return ''; var h = Math.round((Date.now() - ts) / 3600000); return h < 1 ? '<1h' : h < 48 ? h + 'h' : Math.round(h / 24) + 'd'; };
  var targetEmoji = function (id) { return EMOJI12[id] || emojiOf(id); };
  function sugRowHtml(s) {
    return '<div class="player-row radio-sug" data-key="' + esc(s.key) + '"><span class="player-row-info"><b><input type="text" class="radio-sug-name" maxlength="48" value="' + esc(s.n) + '" aria-label="Name"> <span class="radio-badge" title="' + esc(L().sugPlayers) + '">×' + s.count + '</span></b>' +
      '<small>' + esc(s.host + s.path) + (s.query ? ' 🔑' : '') + ' · ' + esc(ago(s.last)) + '</small><small class="radio-test-out" data-sug-out="' + esc(s.key) + '"></small></span>' +
      '<span class="radio-station-actions"><button type="button" class="radio-iconbtn" data-sug-test="' + esc(s.key) + '" title="' + esc(L().sugTest) + '" aria-label="' + esc(L().sugTest) + '">🔍</button>' +
      '<button type="button" class="radio-iconbtn radio-show" data-sug-ok="' + esc(s.key) + '" data-q="' + (s.query ? '1' : '') + '" title="' + esc(L().sugApprove) + '" aria-label="' + esc(L().sugApprove) + '" aria-expanded="false">✅</button>' +
      '<button type="button" class="radio-iconbtn" data-sug-reject="' + esc(s.key) + '" title="' + esc(L().sugReject) + '" aria-label="' + esc(L().sugReject) + '">❌</button></span><div class="radio-move-panel" data-sug-panel="' + esc(s.key) + '" hidden></div></div>';
  }
  function suggestHtml() {
    var rows = sugRows || [];
    return '<p class="account-hint">' + esc(L().sugHint) + '</p>' + (rows.length ? '<div class="account-players-list">' + rows.map(sugRowHtml).join('') + '</div>' : '<p class="account-notice">' + esc(L().sugNone) + '</p>') +
      (approved.length ? '<p class="account-hint">' + esc(L().sugApproved) + '</p><div class="account-players-list">' + approved.map(function (a) { return '<div class="player-row radio-sug"><span class="player-row-info"><b>' + esc(a.n) + ' <span class="radio-moved-tag">' + esc(targetEmoji(a.cat)) + '</span></b><small>' + esc(a.u.replace(/^https:\/\//, '').slice(0, 60)) + '</small></span><span class="radio-station-actions"><button type="button" class="radio-iconbtn" data-custom-remove="' + esc(a.key) + '" title="' + esc(L().sugRemove) + '" aria-label="' + esc(L().sugRemove) + '">🗑️</button></span></div>'; }).join('') + '</div>' : '');
  }
  function sugChipsHtml(key) {
    return targets.map(function (id) { var c = cat(id); return '<button type="button" class="radio-chip" data-sug-cat="' + esc(id) + '" data-key="' + esc(key) + '" title="' + esc(c ? c.label : id.toUpperCase()) + '" aria-label="' + esc(L().sugApprove + ': ' + (c ? c.label : id.toUpperCase())) + '">' + esc(targetEmoji(id)) + '</button>'; }).join('');
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
      if (tabBtn) { tab = tabBtn.dataset.radioTab; var loader = tab === 'stations' ? loadStations : tab === 'suggest' ? loadSuggest : null; if (loader) loader().then(function () { renderAccountPanel('radio-admin'); }).catch(function (err) { tab = 'reports'; failure(err); }); else renderAccountPanel('radio-admin'); return; }
      var sugTest = t.closest('[data-sug-test]');
      if (sugTest) { var out = panel.querySelector('[data-sug-out="' + sugTest.dataset.sugTest + '"]'); if (out) out.textContent = '⏳'; request('sug-test', { key: sugTest.dataset.sugTest }).then(function (r) { var x = r.resolved || {}, p = r.probe; if (out) out.textContent = x.ok ? ('✅ ' + (x.codec || '') + (x.bitrate ? ' ' + x.bitrate : '') + (x.upgraded ? ' · https' : '') + (p ? ' · ' + (p.server.ok ? '🖥️✅' : '🖥️❌') + ' ' + (p.phone.ok ? '📱✅' : '📱❌') : '') + (x.iosOk === false ? ' ⚠️ iOS' : '')) : ('❌ ' + (x.why || '?')); }).catch(function (err) { if (out) out.textContent = '❌ ' + ((err && err.message) || ''); }); return; }
      var sugOk = t.closest('[data-sug-ok]');
      if (sugOk) { var host = sugOk.closest('.player-row'), pbox = host && host.querySelector('.radio-move-panel'); if (!pbox) return; var opening = pbox.hidden; panel.querySelectorAll('.radio-move-panel').forEach(function (p) { p.hidden = true; }); if (opening) { pbox.innerHTML = sugChipsHtml(sugOk.dataset.sugOk); pbox.hidden = false; } return; }
      var sugCat = t.closest('[data-sug-cat]');
      if (sugCat) {
        var rowEl = sugCat.closest('.player-row'), nameEl = rowEl && rowEl.querySelector('.radio-sug-name'), hasQuery = !!(rowEl && rowEl.querySelector('[data-q="1"]'));
        var go = function () { sugCat.disabled = true; request('sug-approve', { key: sugCat.dataset.key, cat: sugCat.dataset.sugCat, name: nameEl ? nameEl.value : '' }).then(function () { return reload(); }).catch(function (err) { sugCat.disabled = false; failure(err); }); };
        if (hasQuery && typeof lxaConfirm === 'function') lxaConfirm(L().sugTokenWarn).then(function (yes) { if (yes) go(); }); else go();
        return;
      }
      var sugRej = t.closest('[data-sug-reject]');
      if (sugRej) { sugRej.disabled = true; request('sug-reject', { key: sugRej.dataset.sugReject }).then(function () { return reload(); }).catch(function (err) { sugRej.disabled = false; failure(err); }); return; }
      var cRem = t.closest('[data-custom-remove]');
      if (cRem) { cRem.disabled = true; request('custom-remove', { key: cRem.dataset.customRemove }).then(function () { return reload(); }).catch(function (err) { cRem.disabled = false; failure(err); }); return; }
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
    var sug = panel.querySelector('#radioSuggest'); if (sug && sugRows) sug.innerHTML = suggestHtml();
  }
  function reset() { tab = 'reports'; stations = null; sugRows = null; filter = { q: '', cat: 'all' }; }
  var holder = function () { return tab === 'stations' ? '<div id="radioStations"></div>' : tab === 'suggest' ? '<div id="radioSuggest"></div>' : ''; };

  window.LXAAdminRadio = { holder: holder, setSuggestCount: function (n) { suggestCount = Number(n) || 0; }, wake: wake, tabsHtml: tabsHtml, toggleHtml: toggleHtml, panelHtml: panelHtml, afterRender: afterRender, reset: reset, tab: function () { return tab; }, setCategories: function (c) { if (c && c.length) categories = c; } };
})();
