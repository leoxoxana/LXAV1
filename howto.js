/* HOW TO PLAY: one ❓ button + overlay with 6 short steps (de / ro / en). Own styles, no dependency on the game code. */
(function () {
  var TEXT = {
    de: { btn: 'SO WIRD GESPIELT', title: 'SO WIRD GESPIELT', close: 'OK', steps: [
      ['1️⃣', 'Einsatz & SPIN', 'Wähle den Einsatz (− / + oder 50 %) und drücke SPIN.'],
      ['2️⃣', '5 Reihen', 'Jede Reihe versucht, von links das Wort L E O N X O X A N A zu schreiben.'],
      ['3️⃣', 'Leuchtende Buchstaben', 'Passende Buchstaben von links leuchten auf. L-E-O leuchtet = 3/10. Ab 3/10 gewinnst du; je mehr, desto mehr (10/10 = ×8).'],
      ['🏆', 'Ziel: JACKPOT', 'Bringe 5 verschiedene Reihen auf 10/10, ohne WILD. Jede zahlt 1×, 2×, 3×, 4×, 5× Einsatz. Bei 5/5 beginnst du neu.'],
      ['🃏', 'WILD', 'Erscheint in manchen Feldern und gibt der Reihe einen Buchstaben extra. Der WILD-Button kauft ein Level (0–50) mit mehr WILD pro Spin. Eine Reihe mit WILD zählt nicht für den JACKPOT.'],
      ['🏦', 'BANK', 'Geld beiseite, zuerst für WILD', 'sg'],
      ['💸', 'GELD', '250.000 €, wenn du höchstens 25.000 € hast', 's'],
      ['⚠️', 'RESET', 'neues Spiel, löscht alles', 's'],
      ['🎫', 'Konto', 'speichert Fortschritt + Rangliste; ohne Konto: GAST', 's'],
      ['🌐', 'Sprache', 'DE · RO · EN', 's'],
      ['🔓', 'Schloss', 'sperrt das Scrollen der Seite', 's'],
      ['☕', 'Ko-fi', 'freiwillige Unterstützung', 's'],
      ['📻', 'Radio', 'Kategorien, Frequenz, ⭐', 's']
    ] },
    ro: { btn: 'CUM SE JOACĂ', title: 'CUM SE JOACĂ', close: 'OK', steps: [
      ['1️⃣', 'Miză și SPIN', 'Alegi miza (− / + sau 50%) și apeși SPIN.'],
      ['2️⃣', '5 rânduri', 'Fiecare rând încearcă să scrie, de la stânga, cuvântul L E O N X O X A N A.'],
      ['3️⃣', 'Litere aprinse', 'Literele care se potrivesc, de la stânga, se aprind. L-E-O aprinse = 3/10. De la 3/10 câștigi; cu cât mai multe, cu atât mai mult (10/10 = ×8).'],
      ['🏆', 'Scop: JACKPOT', 'Fă 5 rânduri diferite la 10/10, fără WILD. Fiecare plătește 1×, 2×, 3×, 4×, 5× miza. La 5/5 începi din nou.'],
      ['🃏', 'WILD', 'Apare în unele câmpuri și adaugă o literă în plus rândului în care e. Butonul WILD cumpără un nivel (0–50) cu mai multe WILD pe spin. Un rând cu WILD nu se numără la JACKPOT.'],
      ['🏦', 'BANK', 'bani deoparte, primii la WILD', 'sg'],
      ['💸', 'BANI', '250.000 € când ai cel mult 25.000 €', 's'],
      ['⚠️', 'RESET', 'joc nou, șterge tot', 's'],
      ['🎫', 'Cont', 'salvează progresul + clasament; fără cont: OASPETE', 's'],
      ['🌐', 'Limba', 'DE · RO · EN', 's'],
      ['🔓', 'Lacăt', 'blochează derularea paginii', 's'],
      ['☕', 'Ko-fi', 'sprijin voluntar', 's'],
      ['📻', 'Radio', 'categorii, frecvență, ⭐', 's']
    ] },
    en: { btn: 'HOW TO PLAY', title: 'HOW TO PLAY', close: 'OK', steps: [
      ['1️⃣', 'Bet & SPIN', 'Pick your bet (− / + or 50%) and press SPIN.'],
      ['2️⃣', '5 rows', 'Each row tries to spell the word L E O N X O X A N A from the left.'],
      ['3️⃣', 'Lit letters', 'Matching letters from the left light up. L-E-O lit = 3/10. You win from 3/10; the more, the more you win (10/10 = ×8).'],
      ['🏆', 'Goal: JACKPOT', 'Get 5 different rows to 10/10, without WILD. Each pays 1×, 2×, 3×, 4×, 5× your bet. At 5/5 you start over.'],
      ['🃏', 'WILD', 'Shows up in some cells and adds one extra letter to its row. The WILD button buys a level (0–50) with more WILDs per spin. A row with a WILD does not count for the JACKPOT.'],
      ['🏦', 'BANK', 'money set aside, used first for WILD', 'sg'],
      ['💸', 'CASH', '250,000 € when you have at most 25,000 €', 's'],
      ['⚠️', 'RESET', 'new game, wipes everything', 's'],
      ['🎫', 'Account', 'saves progress + leaderboard; without one: GUEST', 's'],
      ['🌐', 'Language', 'DE · RO · EN', 's'],
      ['🔓', 'Lock', 'locks page scrolling', 's'],
      ['☕', 'Ko-fi', 'voluntary support', 's'],
      ['📻', 'Radio', 'categories, frequency, ⭐', 's']
    ] }
  };
  var css = 'html body .topbar .brand-cluster .brand{position:relative}' +
    'html body .topbar .howto-btn{position:absolute;z-index:9;left:3px;top:28px;transform:translateY(-50%);width:32px;height:32px;min-width:0;min-height:0;margin:0;padding:0;border-radius:50%;border:2px solid #4fc3ff;background:radial-gradient(circle at 35% 30%,#7a6cff,#3a2aa8 70%);color:#fff;font-size:17px;line-height:1;cursor:pointer;opacity:1;box-shadow:0 0 8px rgba(70,170,255,.7)}' +
    'html body .topbar .howto-btn:active{transform:translateY(-50%) scale(.94)}' +
    '.howto-back{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,0,15,.82)}' +
    '.howto-box{max-width:460px;width:100%;max-height:90vh;overflow:auto;border:1px solid #c58bff;border-radius:16px;background:#14082a;color:#f2e2ff;padding:16px 16px 12px;box-shadow:0 0 30px rgba(170,90,255,.45)}' +
    '.howto-box h2{margin:0 0 10px;font-size:16px;letter-spacing:.08em;text-align:center}' +
    '.howto-step{display:flex;gap:9px;margin:0 0 8px;align-items:flex-start}.howto-step>span{font-size:20px;line-height:1.1;flex:0 0 26px;text-align:center}' +
    '.howto-step b{color:#fff;letter-spacing:.02em}.howto-step p{margin:0;font-size:12px;line-height:1.3;opacity:.95}' +
    '.howto-step.s{margin:0 0 4px}.howto-step.s>span{font-size:16px;flex:0 0 26px}.howto-step.s p{font-size:12px}.howto-step.sg{margin-top:10px;padding-top:8px;border-top:1px solid rgba(197,139,255,.35)}' +
    '.howto-ok{display:block;position:sticky;bottom:0;margin:6px auto 0;padding:8px 26px;border-radius:999px;border:1px solid #c58bff;background:#7a32c8;color:#fff;font-weight:700;cursor:pointer}';
  function lang() { var l = (document.documentElement.lang || 'de').slice(0, 2); return TEXT[l] ? l : 'de'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function open() {
    var T = TEXT[lang()];
    var back = document.createElement('div');
    back.className = 'howto-back';
    back.setAttribute('role', 'dialog');
    back.setAttribute('aria-modal', 'true');
    back.innerHTML = '<div class="howto-box"><h2>' + esc(T.title) + '</h2>' + T.steps.map(function (s) {
      var small = s[3] === 's' || s[3] === 'sg';
      return '<div class="howto-step' + (small ? ' s' : '') + (s[3] === 'sg' ? ' sg' : '') + '"><span>' + s[0] + '</span><p><b>' + esc(s[1]) + (small ? '</b> — ' : '.</b> ') + esc(s[2]) + '</p></div>';
    }).join('') + '<button type="button" class="howto-ok">' + esc(T.close) + '</button></div>';
    function close() { back.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    back.addEventListener('click', function (e) { if (e.target === back || e.target.classList.contains('howto-ok')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
  }
  function init() {
    var brand = document.querySelector('.topbar .brand-cluster .brand');
    if (!brand || document.querySelector('.howto-btn')) return;
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'howto-btn';
    b.textContent = '❓';
    b.setAttribute('aria-label', TEXT[lang()].btn);
    b.title = TEXT[lang()].btn;
    b.addEventListener('click', open);
    brand.appendChild(b);
    // centred on the logo picture itself: in the home-screen app the header is taller (status bar area), so the middle of the header is NOT the middle of the logo
    var img = brand.querySelector('img');
    function place() {
      if (!img) return;
      var br = brand.getBoundingClientRect(), ir = img.getBoundingClientRect();
      if (ir.height > 0) b.style.top = Math.round(ir.top - br.top + ir.height / 2) + 'px';
      b.style.left = Math.round(12 - br.left) + 'px';   // always 12 px from the screen edge (the header box itself starts at the edge in the home-screen app, 8 px in from it in the browser)
    }
    place();
    if (img && !img.complete) img.addEventListener('load', place);
    window.addEventListener('resize', place);
    window.addEventListener('orientationchange', place);
    window.addEventListener('load', place);
    setTimeout(place, 400);
    setTimeout(place, 1500);
    if (window.ResizeObserver) new ResizeObserver(place).observe(brand);
    new MutationObserver(function () { b.setAttribute('aria-label', TEXT[lang()].btn); b.title = TEXT[lang()].btn; }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
