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
  // the PLAYERS' STATIONS tab (v2): the server validates every link a player adds and saves it here by itself
  var T2 = {
    de: { tabSuggest: '🎧 Spieler-Sender', sugHint: 'Jeder Link, den ein Spieler hinzufügt, landet hier automatisch – vom SERVER geprüft (echter Audio-Stream, Codec, Bitrate, Stabilität). 🔄 testet nochmal, ▶ hören, ✅ öffentlich machen (12 Kategorien), ❌ ablehnen. Der Pegel / die Stille wird nicht gemessen (kein Decoder).', sugNone: 'Nichts wartet.',
      secPending: 'WARTET', secApproved: 'FREIGEGEBEN', secInvalid: 'UNGÜLTIG / ABGELEHNT', secOffline: 'OFFLINE', testAgain: 'Nochmal testen', play: 'Anhören / testen', stop: 'Stopp', checkAll: 'Freigegebene jetzt prüfen',
      dMore: 'Details', dWho: 'Spieler', dAnon: 'anonym (nicht eingeloggt)', dOrig: 'Original-Link', dNorm: 'Normalisiert', dCanon: 'Kanonisch', dSent: 'Gesendet', dChecked: 'Letzte Prüfung', dPlayers: 'Spieler (Geräte)', dAudio: 'Echter Audio-Stream', dCodec: 'Codec', dBitrate: 'Bitrate', dRate: 'Abtastrate', dChan: 'Kanäle', dStable: 'Stabil', dMeasured: 'Gemessen', dStalls: 'Aussetzer', dTtfb: 'Zeit bis zum ersten Byte', dLevel: 'Pegel / Stille', notMeasured: 'nicht gemessen', dDup: 'Duplikat', dWarn: 'Hinweise', dWhy: 'Grund', yes: 'ja', no: 'nein',
      dupNew: 'neu', dupPending: 'schon eingereicht', dupPublic: 'schon in der Liste', dupApproved: 'schon freigegeben', dupRejected: 'abgelehnt', hOK: 'OK', hDEGRADED: 'schwach', hOFFLINE: 'OFFLINE', rejectedAt: 'abgelehnt',
      whyHtml: 'Webseite, kein Stream', 'whyNot-audio': 'kein Audio erkannt', 'whyNo-data': 'keine Daten', whyDisconnects: 'bricht sofort ab', whyUnstable: 'zu instabil', whyUnreachable: 'nicht erreichbar', whyBlocked: 'Adresse nicht erlaubt', 'whyHttp-only': 'nur http', 'whyBad-url': 'ungültiger Link', whyTimeout: 'Zeitüberschreitung', whyLimit: 'Limit' },
    ro: { tabSuggest: '🎧 Stații jucători', sugHint: 'Orice link adăugat de un jucător ajunge aici automat – verificat de SERVER (stream audio real, codec, bitrate, stabilitate). 🔄 retestează, ▶ ascultă, ✅ îl faci public (12 categorii), ❌ respinge. Nivelul / liniștea nu se măsoară (nu există decoder).', sugNone: 'Nimic nu așteaptă.',
      secPending: 'ÎN AȘTEPTARE', secApproved: 'APROBATE', secInvalid: 'INVALIDE / RESPINSE', secOffline: 'OFFLINE', testAgain: 'Testează din nou', play: 'Ascultă / testează', stop: 'Stop', checkAll: 'Verifică acum stațiile aprobate',
      dMore: 'Detalii', dWho: 'Jucător', dAnon: 'anonim (fără cont)', dOrig: 'Link original', dNorm: 'Normalizat', dCanon: 'Canonic', dSent: 'Trimis', dChecked: 'Ultima verificare', dPlayers: 'Jucători (dispozitive)', dAudio: 'Stream audio real', dCodec: 'Codec', dBitrate: 'Bitrate', dRate: 'Frecvență de eșantionare', dChan: 'Canale', dStable: 'Stabil', dMeasured: 'Măsurat', dStalls: 'Întreruperi', dTtfb: 'Timp până la primul octet', dLevel: 'Nivel / liniște', notMeasured: 'nemăsurat', dDup: 'Duplicat', dWarn: 'Avertismente', dWhy: 'Motiv', yes: 'da', no: 'nu',
      dupNew: 'nou', dupPending: 'deja trimis', dupPublic: 'deja în listă', dupApproved: 'deja aprobat', dupRejected: 'respins', hOK: 'OK', hDEGRADED: 'slab', hOFFLINE: 'OFFLINE', rejectedAt: 'respins',
      whyHtml: 'pagină web, nu stream', 'whyNot-audio': 'nu s-a detectat audio', 'whyNo-data': 'fără date', whyDisconnects: 'se întrerupe imediat', whyUnstable: 'prea instabil', whyUnreachable: 'nu răspunde', whyBlocked: 'adresă nepermisă', 'whyHttp-only': 'doar http', 'whyBad-url': 'link invalid', whyTimeout: 'timp expirat', whyLimit: 'limită' },
    en: { tabSuggest: '🎧 Player stations', sugHint: 'Every link a player adds lands here by itself – checked by the SERVER (a real audio stream, codec, bitrate, stability). 🔄 tests again, ▶ listen, ✅ make it public (12 categories), ❌ reject. The audio level / silence is not measured (there is no decoder).', sugNone: 'Nothing is waiting.',
      secPending: 'PENDING', secApproved: 'APPROVED', secInvalid: 'INVALID / REJECTED', secOffline: 'OFFLINE', testAgain: 'Test again', play: 'Listen / test', stop: 'Stop', checkAll: 'Check approved stations now',
      dMore: 'Details', dWho: 'Player', dAnon: 'anonymous (not logged in)', dOrig: 'Original link', dNorm: 'Normalized', dCanon: 'Canonical', dSent: 'Sent', dChecked: 'Last check', dPlayers: 'Players (devices)', dAudio: 'Real audio stream', dCodec: 'Codec', dBitrate: 'Bitrate', dRate: 'Sample rate', dChan: 'Channels', dStable: 'Stable', dMeasured: 'Measured', dStalls: 'Dropouts', dTtfb: 'Time to first byte', dLevel: 'Level / silence', notMeasured: 'not measured', dDup: 'Duplicate', dWarn: 'Warnings', dWhy: 'Reason', yes: 'yes', no: 'no',
      dupNew: 'new', dupPending: 'already submitted', dupPublic: 'already in the list', dupApproved: 'already approved', dupRejected: 'rejected', hOK: 'OK', hDEGRADED: 'weak', hOFFLINE: 'OFFLINE', rejectedAt: 'rejected',
      whyHtml: 'web page, not a stream', 'whyNot-audio': 'no audio detected', 'whyNo-data': 'no data', whyDisconnects: 'disconnects right away', whyUnstable: 'too unstable', whyUnreachable: 'unreachable', whyBlocked: 'address not allowed', 'whyHttp-only': 'http only', 'whyBad-url': 'invalid link', whyTimeout: 'timed out', whyLimit: 'limit' }
  };
  ['de', 'ro', 'en'].forEach(function (k) { Object.keys(T2[k]).forEach(function (key) { TEXT[k][key] = T2[k][key]; }); });
  var L = function () { var l = typeof lang === 'string' ? lang : ''; return TEXT[l] || TEXT.de; };
  var esc = function (v) { return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var MAX_ROWS = 80;
  var tab = 'reports', stations = null, categories = [], filter = { q: '', cat: 'all' };
  var sugRows = null, approved = [], rejectedRows = [], targets = [], suggestCount = 0, recRows = null, recCount = 0;   // the 📨 tab: links the players offered, stations the owner approved, the 12 target categories
  var EMOJI12 = { global: '🌍', top: '⭐' };
  var cat = function (id) { for (var i = 0; i < categories.length; i++) if (categories[i].id === id) return categories[i]; return null; };
  var emojiOf = function (id) { var c = cat(id); return c ? c.emoji : id; };

  function tabsHtml() {
    return '<div class="radio-admin-tabs" role="tablist">' + [['reports', L().tabReports], ['stations', L().tabStations], ['suggest', L().tabSuggest + (suggestCount ? ' ' + suggestCount : '')], ['recs', L().tabRecs + (recCount ? ' ' + recCount : '')]].map(function (t) {
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
  function loadSuggest() { return request('suggestions').then(function (r) { sugRows = r.suggestions || []; approved = r.approved || []; rejectedRows = r.rejected || []; targets = r.targets || []; suggestCount = sugRows.filter(function (s) { return s.status !== 'INVALID'; }).length; }); }
  function reload(message) {   // the reports view re-reads its list; the station manager and the 📨 tab re-read their own
    return request('list').then(function (r) { wake(r); lxaRadioCache = r; suggestCount = Number(r.suggestCount) || 0; if (tab === 'stations') return loadStations().then(function () { renderAccountPanel('radio-admin', message || ''); }); if (tab === 'suggest') return loadSuggest().then(function () { renderAccountPanel('radio-admin', message || ''); }); if (tab === 'recs') return loadRecs().then(function () { renderAccountPanel('radio-admin', message || ''); }); renderAccountPanel('radio-admin', message || ''); });
  }
  // ---- 📨 the links the players offered: one row per link, 🔍 test, ✅ approve into one of the 12 categories (emoji chips), ❌ reject
  var ago = function (ts) { if (!ts) return ''; var h = Math.round((Date.now() - ts) / 3600000); return h < 1 ? '<1h' : h < 48 ? h + 'h' : Math.round(h / 24) + 'd'; };
  var targetEmoji = function (id) { return EMOJI12[id] || emojiOf(id); };
  var fmt = function (ts) { if (!ts) return '—'; try { return new Date(ts).toLocaleString(); } catch (e) { return String(ts); } };
  var dupLabel = function (d) { return L()['dup' + String(d || 'new').replace(/^./, function (c) { return c.toUpperCase(); })] || String(d || ''); };
  var whyLabel = function (w) { return L()['why' + String(w || '').replace(/^./, function (c) { return c.toUpperCase(); })] || String(w || '?'); };
  var badge = function (status, title) { return '<span class="radio-badge radio-st radio-st-' + esc(String(status).toLowerCase()) + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + esc(status) + '</span>'; };
  var spec = function (v) { return v && v.ok ? [v.codec, v.bitrate ? v.bitrate + 'k' : '', v.sampleRate ? Math.round(v.sampleRate / 100) / 10 + 'kHz' : '', v.channels === 1 ? 'mono' : v.channels === 2 ? 'stereo' : ''].filter(Boolean).join(' · ') : ''; };
  // everything the server measured, in a closed <details> (compact by default)
  function detailsHtml(s) {
    var v = s.v || {}, rows = [], add = function (label, val) { if (val !== undefined && val !== null && val !== '') rows.push('<div><span>' + esc(label) + '</span><b>' + esc(val) + '</b></div>'); };
    add(L().dWho, s.by ? '#' + s.by.id + (s.by.name ? ' · ' + s.by.name : '') + (s.accounts && s.accounts.length > 1 ? ' (+' + (s.accounts.length - 1) + ')' : '') : L().dAnon);
    add(L().recFreq, s.f ? s.f + ' MHz (' + (s.fs || 'USER_PROVIDED') + ')' : ''); add(L().recCountry, s.cc); add(L().dOrig, s.orig); add(L().dNorm, s.u); add(L().dCanon, s.canon); add(L().dSent, fmt(s.first)); add(L().dChecked, fmt(s.checkedAt)); add(L().dPlayers, s.count);
    add(L().dAudio, v.ok === true ? L().yes : v.ok === false ? L().no : '?'); add(L().dCodec, [v.codec, v.vbr ? 'VBR' : ''].filter(Boolean).join(' ')); add(L().dBitrate, v.bitrate ? v.bitrate + ' kbps' : ''); add(L().dRate, v.sampleRate ? v.sampleRate + ' Hz' : ''); add(L().dChan, v.channels);
    add(L().dStable, v.stable === true ? L().yes : v.stable === false ? L().no : (v.hls ? 'HLS' : '')); add(L().dMeasured, v.measuredKbps ? v.measuredKbps + ' kbps' : ''); add(L().dStalls, v.stalls !== undefined ? v.stalls + (v.maxGapMs ? ' (max ' + v.maxGapMs + ' ms)' : '') : ''); add(L().dTtfb, v.ttfbMs ? v.ttfbMs + ' ms' : '');
    add(L().dLevel, L().notMeasured); add(L().dDup, dupLabel(s.dup)); if (v.warnings && v.warnings.length) add(L().dWarn, v.warnings.join(', ')); if (v.ok === false) add(L().dWhy, whyLabel(v.why));
    return '<details class="radio-sug-more"><summary>' + esc(L().dMore) + '</summary><div class="radio-sug-grid">' + rows.join('') + '</div></details>';
  }
  var btn = function (cls, attr, key, title, label, extra) { return '<button type="button" class="radio-iconbtn' + (cls ? ' ' + cls : '') + '" ' + attr + '="' + esc(key) + '"' + (extra || '') + ' title="' + esc(title) + '" aria-label="' + esc(title) + '">' + label + '</button>'; };
  function sugRowHtml(s) {
    var v = s.v || {}, st = s.status, canApprove = st !== 'INVALID', info = st === 'INVALID' ? ' ' + esc(whyLabel(v.why)) : (spec(v) ? ' ' + esc(spec(v)) : '');
    return '<div class="player-row radio-sug" data-key="' + esc(s.key) + '"><span class="player-row-info"><b><input type="text" class="radio-sug-name" maxlength="48" value="' + esc(s.n || s.host) + '" aria-label="Name"> ' + badge(st) + (s.dup && s.dup !== 'new' ? ' <span class="radio-badge" title="' + esc(L().dDup) + '">⚠️ ' + esc(dupLabel(s.dup)) + '</span>' : '') + '</b>' +
      '<small>' + esc(s.host + s.path) + (s.query ? ' 🔑' : '') + ' · ' + esc(ago(s.last)) + ' · ' + esc(s.count) + ' 👥' + (s.by ? ' · #' + esc(s.by.id) + (s.by.name ? ' ' + esc(s.by.name) : '') : '') + info + (v.warnings && v.warnings.length ? ' ⚠️' : '') + '</small>' + detailsHtml(s) + '<small class="radio-test-out" data-sug-out="' + esc(s.key) + '"></small></span>' +
      '<span class="radio-station-actions">' + btn('', 'data-sug-test', s.key, L().testAgain, '🔄') + btn('', 'data-sug-play', s.key, L().play, '▶', ' data-url="' + esc(s.u) + '"') +
      (canApprove ? btn('radio-show', 'data-sug-ok', s.key, L().sugApprove, '✅', ' data-q="' + (s.query ? '1' : '') + '" aria-expanded="false"') : '') + btn('', 'data-sug-reject', s.key, L().sugReject, '❌') + '</span><div class="radio-move-panel" data-sug-panel="' + esc(s.key) + '" hidden></div></div>';
  }
  function approvedRowHtml(a) {
    var h = a.health || null, hs = h ? h.status : '', c = cat(a.cat), spc = [a.codec, a.bitrate ? a.bitrate + 'k' : ''].filter(Boolean).join(' · ');
    return '<div class="player-row radio-sug" data-key="' + esc(a.key) + '"><span class="player-row-info"><b>' + esc(a.n) + ' ' + badge(hs === 'OFFLINE' ? 'OFFLINE' : 'APPROVED') + (hs && hs !== 'OFFLINE' ? ' ' + badge(hs, L()['h' + hs]) : '') + ' <span class="radio-moved-tag">' + esc(targetEmoji(a.cat) || (c ? c.emoji : '')) + '</span></b>' +
      '<small>' + esc(spc) + (h ? ' · ' + esc(L().dChecked) + ' ' + esc(ago(h.at)) : '') + (h && h.status === 'OFFLINE' ? ' · ' + esc(whyLabel(h.why)) : '') + (h && h.kbps ? ' · ' + esc(h.kbps) + ' kbps' : '') + (a.by ? ' · #' + esc(a.by.id) + (a.by.name ? ' ' + esc(a.by.name) : '') : '') + '</small></span>' +
      '<span class="radio-station-actions">' + btn('', 'data-custom-check', a.key, L().testAgain, '🔄') + btn('', 'data-sug-play', a.key, L().play, '▶', ' data-url="' + esc(a.u) + '"') + btn('', 'data-custom-remove', a.key, L().sugRemove, '🗑️') + '</span></div>';
  }
  function rejectedRowHtml(r) { return '<div class="player-row radio-sug is-hidden"><span class="player-row-info"><b>' + esc(r.n || r.orig || r.u || r.key) + ' ' + badge('REJECTED') + '</b><small>' + esc(L().rejectedAt) + ' ' + esc(ago(r.at)) + (r.by ? ' · #' + esc(r.by.id) + (r.by.name ? ' ' + esc(r.by.name) : '') : '') + (r.u ? ' · ' + esc(r.u.replace(/^https?:\/\//, '').slice(0, 60)) : '') + '</small></span></div>'; }
  var section = function (title, count, html) { return '<h4 class="radio-sec">' + esc(title) + ' <span>' + count + '</span></h4>' + (count ? '<div class="account-players-list">' + html + '</div>' : ''); };
  function suggestHtml() {
    var rows = sugRows || [], pending = rows.filter(function (s) { return s.status !== 'INVALID'; }), invalid = rows.filter(function (s) { return s.status === 'INVALID'; }), offline = approved.filter(function (a) { return a.health && a.health.status === 'OFFLINE'; }), live = approved.filter(function (a) { return !(a.health && a.health.status === 'OFFLINE'); });
    return '<p class="account-hint">' + esc(L().sugHint) + '</p><div class="radio-station-tools"><button type="button" class="radio-iconbtn" data-customs-check="1" title="' + esc(L().checkAll) + '" aria-label="' + esc(L().checkAll) + '">🩺</button></div>' +
      (rows.length || approved.length || rejectedRows.length ? '' : '<p class="account-notice">' + esc(L().sugNone) + '</p>') +
      section(L().secPending, pending.length, pending.map(sugRowHtml).join('')) + section(L().secApproved, live.length, live.map(approvedRowHtml).join('')) +
      section(L().secInvalid, invalid.length + rejectedRows.length, invalid.map(sugRowHtml).join('') + rejectedRows.map(rejectedRowHtml).join('')) + section(L().secOffline, offline.length, offline.map(approvedRowHtml).join(''));
  }
  // listen to a link right here (one at a time); a second tap on the same button stops it
  var testAudio = null, testBtn = null;
  function stopTest() { try { if (testAudio) { testAudio.pause(); testAudio.removeAttribute('src'); testAudio.load(); } } catch (e) { /* ignore */ } if (testBtn) testBtn.textContent = '▶'; testAudio = null; testBtn = null; }
  function playTest(button) {
    if (testBtn === button) { stopTest(); return; }
    stopTest(); var url = button.dataset.url; if (!/^https?:\/\//i.test(url || '')) return;
    testAudio = new Audio(); testBtn = button; button.textContent = '⏳';
    testAudio.addEventListener('playing', function () { if (testBtn === button) button.textContent = '⏹'; });
    testAudio.addEventListener('error', function () { if (testBtn === button) { button.textContent = '❌'; testAudio = null; testBtn = null; } });
    testAudio.src = url; var p = testAudio.play(); if (p && p.catch) p.catch(function () { if (testBtn === button) { button.textContent = '❌'; testAudio = null; testBtn = null; } });
  }
  function sugChipsHtml(key) {
    var cur = (sugRows || []).filter(function (x) { return x.key === key; })[0], pre = cur && cur.f ? cur.f : '';
    return '<input type="text" class="radio-rec-f" inputmode="decimal" maxlength="7" value="' + esc(pre) + '" placeholder="MHz" aria-label="' + esc(L().recFreq) + '"> ' + targets.map(function (id) { var c = cat(id); return '<button type="button" class="radio-chip" data-sug-cat="' + esc(id) + '" data-key="' + esc(key) + '" title="' + esc(c ? c.label : id.toUpperCase()) + '" aria-label="' + esc(L().sugApprove + ': ' + (c ? c.label : id.toUpperCase())) + '">' + esc(targetEmoji(id)) + '</button>'; }).join('');
  }
  // ---- ⭐ RECOMMENDATIONS: what players recommended from the frequency search. One row per STATION (several players share it). The data is the server's own record, never the client's.
  function loadRecs() { return request('recs').then(function (r) { recRows = r.recs || []; targets = r.targets || targets; recCount = recRows.filter(function (x) { return x.status === 'PENDING'; }).length; }); }
  function recRowHtml(x) {
    var v = x.v || {}, who = x.players.map(function (p) { return '#' + p.id + (p.name ? ' ' + p.name : ''); }).join(', '), msgs = x.players.filter(function (p) { return p.msg; }).map(function (p) { return p.msg; }).join(' · ');
    var rows = [], add = function (label, val) { if (val !== undefined && val !== null && val !== '' && val !== 0) rows.push('<div><span>' + esc(label) + '</span><b>' + esc(val) + '</b></div>'); };
    add(L().recFreq, x.f ? x.f + ' MHz (' + x.fs + ')' : ''); add(L().recCountry, [x.cc, x.city].filter(Boolean).join(' · ')); add(L().recSource, x.src + (x.sid ? ' / ' + x.sid : '')); add(L().dNorm, x.u); add(L().dCanon, x.canon);
    add(L().recPlayers, who); add(L().recWhen, fmt(x.first)); add(L().dChecked, fmt(x.checkedAt)); add(L().recMsg, msgs); add(L().dDup, x.dup ? dupLabel(x.dup) : ''); add(L().dAudio, v.ok === true ? L().yes : v.ok === false ? L().no : '?');
    add(L().dCodec, [v.codec, v.vbr ? 'VBR' : ''].filter(Boolean).join(' ')); add(L().dBitrate, v.bitrate ? v.bitrate + ' kbps' : ''); add(L().dRate, v.sampleRate ? v.sampleRate + ' Hz' : ''); add(L().dChan, v.channels); add(L().dStable, v.stable === true ? L().yes : v.stable === false ? L().no : '');
    add(L().dStalls, v.stalls !== undefined ? v.stalls : ''); add(L().dLevel, L().notMeasured); if (v.ok === false) add(L().dWhy, whyLabel(v.why));
    var pending = x.status === 'PENDING';
    return '<div class="player-row radio-sug" data-key="' + esc(x.key) + '"><span class="player-row-info"><b><input type="text" class="radio-sug-name" maxlength="48" value="' + esc(x.n) + '" aria-label="Name"> ' + badge(x.status) + (x.vstate ? ' ' + badge(x.vstate) : '') + (x.dup ? ' <span class="radio-badge">⚠️ ' + esc(dupLabel(x.dup)) + '</span>' : '') + '</b>' +
      '<small>' + (x.f ? esc(x.f) + ' MHz · ' : '') + esc(x.cc) + ' · ' + esc(x.count) + ' 👥 ' + esc(who.length > 60 ? who.slice(0, 60) + '…' : who) + '</small>' +
      '<details class="radio-sug-more"><summary>' + esc(L().dMore) + '</summary><div class="radio-sug-grid">' + rows.join('') + '</div></details><small class="radio-test-out" data-rec-out="' + esc(x.key) + '"></small></span>' +
      '<span class="radio-station-actions">' + btn('', 'data-rec-test', x.key, L().testAgain, '🔄') + btn('', 'data-sug-play', x.key, L().play, '▶', ' data-url="' + esc(x.u) + '"') + (pending ? btn('radio-show', 'data-rec-ok', x.key, L().recApprove, '✅', ' aria-expanded="false"') + btn('', 'data-rec-reject', x.key, L().sugReject, '❌') : '') + '</span><div class="radio-move-panel" data-rec-panel="' + esc(x.key) + '" hidden></div></div>';
  }
  function recChipsHtml(key, f) {
    return '<input type="text" class="radio-rec-f" inputmode="decimal" maxlength="7" value="' + esc(f || '') + '" placeholder="MHz" aria-label="' + esc(L().recFreq) + '"> ' + targets.map(function (id) { var c = cat(id); return '<button type="button" class="radio-chip" data-rec-cat="' + esc(id) + '" data-key="' + esc(key) + '" title="' + esc(c ? c.label : id.toUpperCase()) + '" aria-label="' + esc(L().recApprove + ': ' + (c ? c.label : id.toUpperCase())) + '">' + esc(targetEmoji(id)) + '</button>'; }).join('');
  }
  function recsHtml() {
    var rows = recRows || [], by = function (st) { return rows.filter(function (x) { return x.status === st; }); };
    return '<p class="account-hint">' + esc(L().recHint) + '</p>' + (rows.length ? '' : '<p class="account-notice">' + esc(L().recNone) + '</p>') +
      section(L().secPending, by('PENDING').length, by('PENDING').map(recRowHtml).join('')) + section(L().secApproved, by('APPROVED').length, by('APPROVED').map(recRowHtml).join('')) + section(L().secRejected, by('REJECTED').length, by('REJECTED').map(recRowHtml).join(''));
  }
  var T3 = {
    de: { tabRecs: '⭐ Empfehlungen', recHint: 'Spieler empfehlen Sender aus der Frequenzsuche. Daten kommen vom SERVER. Freigabe: Stream wird frisch geprüft, Duplikate geprüft, du wählst eine BESTEHENDE Kategorie; die Frequenz, die du einträgst, gilt als vom Admin bestätigt.', recNone: 'Keine Empfehlungen.', recFreq: 'Frequenz', recCountry: 'Land / Ort', recSource: 'Quelle', recPlayers: 'Empfohlen von', recWhen: 'Zeit', recMsg: 'Nachricht', recApprove: 'Freigeben & hinzufügen', secRejected: 'ABGELEHNT' },
    ro: { tabRecs: '⭐ Recomandări', recHint: 'Jucătorii recomandă posturi găsite după frecvență. Datele vin de pe SERVER. La aprobare: stream verificat din nou, duplicate verificate, alegi o categorie EXISTENTĂ; frecvența scrisă de tine devine confirmată de admin.', recNone: 'Nicio recomandare.', recFreq: 'Frecvență', recCountry: 'Țară / oraș', recSource: 'Sursă', recPlayers: 'Recomandat de', recWhen: 'Când', recMsg: 'Mesaj', recApprove: 'Aprobă și adaugă', secRejected: 'RESPINSE' },
    en: { tabRecs: '⭐ Recommendations', recHint: 'Players recommend stations found by frequency. Data comes from the SERVER. On approval: fresh stream check, duplicate check, you pick an EXISTING category; the frequency you type counts as admin-verified.', recNone: 'No recommendations.', recFreq: 'Frequency', recCountry: 'Country / city', recSource: 'Source', recPlayers: 'Recommended by', recWhen: 'When', recMsg: 'Message', recApprove: 'Approve & add', secRejected: 'REJECTED' }
  };
  ['de', 'ro', 'en'].forEach(function (k) { Object.keys(T3[k]).forEach(function (key) { TEXT[k][key] = T3[k][key]; }); });
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
      if (tabBtn) { stopTest(); tab = tabBtn.dataset.radioTab; var loader = tab === 'stations' ? loadStations : tab === 'suggest' ? loadSuggest : tab === 'recs' ? loadRecs : null; if (loader) loader().then(function () { renderAccountPanel('radio-admin'); }).catch(function (err) { tab = 'reports'; failure(err); }); else renderAccountPanel('radio-admin'); return; }
      var sugTest = t.closest('[data-sug-test]'), cuTest = t.closest('[data-custom-check]'), checkAll = t.closest('[data-customs-check]');
      if (sugTest || cuTest || checkAll) {   // 🔄 the SERVER checks the stream again and stores the new verdict; the tab is redrawn from the stored data
        var which = sugTest ? 'sug-test' : cuTest ? 'custom-check' : 'customs-check', trig = sugTest || cuTest || checkAll, k = trig.dataset.sugTest || trig.dataset.customCheck || '';
        var out = k ? panel.querySelector('[data-sug-out="' + k + '"]') : null; if (out) out.textContent = '⏳'; trig.disabled = true;
        request(which, k ? { key: k } : {}).then(function () { return loadSuggest(); }).then(function () { stopTest(); renderAccountPanel('radio-admin'); }).catch(function (err) { trig.disabled = false; if (out) out.textContent = '❌ ' + ((err && err.message) || ''); });
        return;
      }
      var play = t.closest('[data-sug-play]'); if (play) { playTest(play); return; }
      var recTest = t.closest('[data-rec-test]');
      if (recTest) { var rk = recTest.dataset.recTest, rout = panel.querySelector('[data-rec-out="' + rk + '"]'); if (rout) rout.textContent = '⏳'; recTest.disabled = true; request('rec-test', { key: rk }).then(function () { return loadRecs(); }).then(function () { stopTest(); renderAccountPanel('radio-admin'); }).catch(function (err) { recTest.disabled = false; if (rout) rout.textContent = '❌ ' + ((err && err.message) || ''); }); return; }
      var recOk = t.closest('[data-rec-ok]');
      if (recOk) { var rrow = recOk.closest('.player-row'), rbox = rrow && rrow.querySelector('.radio-move-panel'); if (!rbox) return; var ropen = rbox.hidden; panel.querySelectorAll('.radio-move-panel').forEach(function (p) { p.hidden = true; }); if (ropen) { var cur = (recRows || []).filter(function (x) { return x.key === recOk.dataset.recOk; })[0]; rbox.innerHTML = recChipsHtml(recOk.dataset.recOk, cur && cur.fs === 'ADMIN_VERIFIED' ? cur.f : (cur && cur.f) || ''); rbox.hidden = false; } return; }
      var recCat = t.closest('[data-rec-cat]');
      if (recCat) { var rr = recCat.closest('.player-row'), rname = rr && rr.querySelector('.radio-sug-name'), rf = rr && rr.querySelector('.radio-rec-f'); recCat.disabled = true; request('rec-approve', { key: recCat.dataset.key, cat: recCat.dataset.recCat, name: rname ? rname.value : '', f: rf ? rf.value : '' }).then(function () { return reload(); }).catch(function (err) { recCat.disabled = false; failure(err); }); return; }
      var recRej = t.closest('[data-rec-reject]');
      if (recRej) { recRej.disabled = true; request('rec-reject', { key: recRej.dataset.recReject }).then(function () { return reload(); }).catch(function (err) { recRej.disabled = false; failure(err); }); return; }
      var sugOk = t.closest('[data-sug-ok]');
      if (sugOk) { var host = sugOk.closest('.player-row'), pbox = host && host.querySelector('.radio-move-panel'); if (!pbox) return; var opening = pbox.hidden; panel.querySelectorAll('.radio-move-panel').forEach(function (p) { p.hidden = true; }); if (opening) { pbox.innerHTML = sugChipsHtml(sugOk.dataset.sugOk); pbox.hidden = false; } return; }
      var sugCat = t.closest('[data-sug-cat]');
      if (sugCat) {
        var rowEl = sugCat.closest('.player-row'), nameEl = rowEl && rowEl.querySelector('.radio-sug-name'), hasQuery = !!(rowEl && rowEl.querySelector('[data-q="1"]'));
        var go = function () { sugCat.disabled = true; request('sug-approve', { key: sugCat.dataset.key, cat: sugCat.dataset.sugCat, name: nameEl ? nameEl.value : '', f: rowEl && rowEl.querySelector('.radio-rec-f') ? rowEl.querySelector('.radio-rec-f').value : '' }).then(function () { return reload(); }).catch(function (err) { sugCat.disabled = false; failure(err); }); };
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
    var recs = panel.querySelector('#radioRecs'); if (recs && recRows) recs.innerHTML = recsHtml();
  }
  function reset() { stopTest(); tab = 'reports'; stations = null; sugRows = null; recRows = null; filter = { q: '', cat: 'all' }; }
  var holder = function () { return tab === 'stations' ? '<div id="radioStations"></div>' : tab === 'suggest' ? '<div id="radioSuggest"></div>' : tab === 'recs' ? '<div id="radioRecs"></div>' : ''; };

  window.LXAAdminRadio = { holder: holder, setSuggestCount: function (n) { suggestCount = Number(n) || 0; }, wake: wake, tabsHtml: tabsHtml, toggleHtml: toggleHtml, panelHtml: panelHtml, afterRender: afterRender, reset: reset, tab: function () { return tab; }, setCategories: function (c) { if (c && c.length) categories = c; } };
})();
