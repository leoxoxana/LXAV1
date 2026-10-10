/* HOW TO PLAY: one ❓ button + overlay with 6 short steps (de / ro / en). Own styles, no dependency on the game code. */
(function () {
  var TEXT = {
    de: { btn: '❓ SO WIRD GESPIELT', title: 'SO WIRD GESPIELT', close: 'OK', steps: [
      ['🎰', 'Einsatz & SPIN', 'Mit − und + (oder 50 % = halbes Guthaben) wählst du den Einsatz, höchstens dein Guthaben. Bei sehr hohem Guthaben begrenzt dein WILD-Level den Einsatz. Dann SPIN. AUTO dreht von selbst.'],
      ['📏', 'Gewinn pro Linie', 'Jede Linie hat 10 Felder. Ab 3 gleichen Treffern gewinnst du: 3/10 bis 10/10. Die Tabelle AUSZAHLUNGSLOGIK zeigt den Faktor.'],
      ['🏆', 'JACKPOT MISSION', 'Bringe 5 verschiedene Linien auf 10/10. Jede erledigte Linie zählt (1/5 … 5/5), danach beginnt die Mission neu. Linien mit WILD zählen dafür nicht.'],
      ['🃏', 'WILD BONUS', 'WILD-Felder helfen beim Füllen der Linien. Mit WILD BONUS kaufst du dauerhaft ein höheres WILD-Level (0–50): mehr WILD pro Spin. Der Preis steht auf dem Button.'],
      ['🏦', 'BANK', 'Der Button BANK verschiebt Guthaben in deine Bank. Beim WILD-Kauf wird zuerst die Bank benutzt, dann das Guthaben.'],
      ['📊', 'Rangliste', 'Platz = zuerst dein WILD-LVL, dann dein Geld (Guthaben + Bank). Schwierigkeit 1–3: 1 ist leichter, 3 schwerer.']
    ] },
    ro: { btn: '❓ CUM SE JOACĂ', title: 'CUM SE JOACĂ', close: 'OK', steps: [
      ['🎰', 'Miză și SPIN', 'Cu − și + (sau 50% = jumătate din sold) alegi miza, maximum tot soldul. La un sold foarte mare, nivelul WILD limitează miza. Apoi SPIN. AUTO se învârte singur.'],
      ['📏', 'Câștig pe linie', 'Fiecare linie are 10 câmpuri. De la 3 potriviri câștigi: de la 3/10 la 10/10. Tabelul LOGICA DE PLATĂ arată factorul.'],
      ['🏆', 'MISIUNE JACKPOT', 'Adu 5 linii diferite la 10/10. Fiecare linie terminată se numără (1/5 … 5/5), apoi misiunea începe din nou. Liniile cu WILD nu contează aici.'],
      ['🃏', 'WILD BONUS', 'Câmpurile WILD te ajută să completezi liniile. Cu WILD BONUS cumperi permanent un nivel WILD mai mare (0–50): mai multe WILD la fiecare spin. Prețul e pe buton.'],
      ['🏦', 'BANK', 'Butonul BANK mută bani din sold în bancă. La cumpărarea WILD se folosește întâi banca, apoi soldul.'],
      ['📊', 'Clasament', 'Locul = întâi LVL WILD, apoi banii tăi (sold + bancă). Dificultate 1–3: 1 e mai ușor, 3 mai greu.']
    ] },
    en: { btn: '❓ HOW TO PLAY', title: 'HOW TO PLAY', close: 'OK', steps: [
      ['🎰', 'Bet & SPIN', 'Use − and + (or 50% = half your balance) to pick your bet, at most your whole balance. With a very high balance your WILD level caps the bet. Then SPIN. AUTO spins by itself.'],
      ['📏', 'Win per line', 'Each line has 10 cells. From 3 matches you win: 3/10 up to 10/10. The PAYOUT table shows the multiplier.'],
      ['🏆', 'JACKPOT MISSION', 'Bring 5 different lines to 10/10. Every finished line counts (1/5 … 5/5), then the mission starts again. Lines containing a WILD do not count here.'],
      ['🃏', 'WILD BONUS', 'WILD cells help you fill lines. WILD BONUS buys a permanently higher WILD level (0–50): more WILDs per spin. The price is on the button.'],
      ['🏦', 'BANK', 'The BANK button moves money from your balance into your bank. Buying WILD uses the bank first, then the balance.'],
      ['📊', 'Leaderboard', 'Rank = your WILD LVL first, then your money (balance + bank). Difficulty 1–3: 1 is easier, 3 is harder.']
    ] }
  };
  var css = '.howto-btn{display:block;margin:10px auto;padding:9px 18px;border-radius:999px;border:1px solid #c58bff;background:rgba(120,50,200,.25);color:#f2e2ff;font:700 13px/1 inherit;letter-spacing:.06em;cursor:pointer}' +
    '.howto-back{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,0,15,.82)}' +
    '.howto-box{max-width:460px;width:100%;max-height:90vh;overflow:auto;border:1px solid #c58bff;border-radius:16px;background:#14082a;color:#f2e2ff;padding:16px 16px 12px;box-shadow:0 0 30px rgba(170,90,255,.45)}' +
    '.howto-box h2{margin:0 0 10px;font-size:16px;letter-spacing:.08em;text-align:center}' +
    '.howto-step{display:flex;gap:10px;margin:0 0 10px;align-items:flex-start}.howto-step>span{font-size:22px;line-height:1.1}' +
    '.howto-step b{display:block;font-size:13px;letter-spacing:.04em;margin-bottom:2px}.howto-step p{margin:0;font-size:12.5px;line-height:1.3;opacity:.92}' +
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
      return '<div class="howto-step"><span>' + s[0] + '</span><div><b>' + esc(s[1]) + '</b><p>' + esc(s[2]) + '</p></div></div>';
    }).join('') + '<button type="button" class="howto-ok">' + esc(T.close) + '</button></div>';
    function close() { back.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    back.addEventListener('click', function (e) { if (e.target === back || e.target.classList.contains('howto-ok')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
  }
  function init() {
    var host = document.querySelector('.quick-info');
    if (!host || document.querySelector('.howto-btn')) return;
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'howto-btn';
    b.textContent = TEXT[lang()].btn;
    b.addEventListener('click', open);
    host.parentNode.insertBefore(b, host);
    new MutationObserver(function () { b.textContent = TEXT[lang()].btn; }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
