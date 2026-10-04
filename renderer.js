const target='LEONXOXANA'.split(''), symbols=[...new Set(target)], rows=5, cell=36, WILD='__BONUS_WILD__';
const WILD_IMG='<picture><source media="(max-width:700px) and (orientation:portrait)" srcset="assets/wild-stack.webp"><img src="assets/wild-wide.webp" alt="BONUS WILD" decoding="sync"></picture>';
const LXA_LANG_KEY='lxaLang';
// V219: language selection was never persisted — `lang` always restarted at
// the hardcoded 'de' default on every page load/reload, even after the user
// picked ro/en, because nothing wrote it to localStorage. Restore whatever
// was saved last (falls back to 'de' the first time / if storage is empty
// or the stored value isn't one of the 3 supported languages).
const lxaSavedLang=(()=>{try{const v=localStorage.getItem(LXA_LANG_KEY);return v==='ro'||v==='en'||v==='de'?v:'de'}catch{return'de'}})();
let credits=250, bet=5, round=1, spinning=false, lang=lxaSavedLang, chance=1, winStreak=0, recordHits=Array(rows).fill(0), completedLines=Array(rows).fill(false), missionFinished=false;
const $=s=>document.querySelector(s);const maxBet=()=>Math.floor(credits/2);const controlsDock=document.querySelector('.controls'),winBoardDock=document.querySelector('.win-board');if(controlsDock&&winBoardDock)controlsDock.parentNode.insertBefore(controlsDock,winBoardDock);const reels=$('#reels'), money=v=>new Intl.NumberFormat(lang==='en'?'en-US':lang==='ro'?'ro-RO':'de-DE',{style:'currency',currency:'EUR',currencyDisplay:'narrowSymbol',maximumFractionDigits:0}).format(v), jackpotMoney=v=>new Intl.NumberFormat(lang==='en'?'en-US':lang==='ro'?'ro-RO':'de-DE',{style:'currency',currency:'EUR',currencyDisplay:'narrowSymbol',maximumFractionDigits:0}).format(v);
const t={de:{brand:'VIRTUELLE WALZEN',demo:'INOFFIZIELLE DEMO',virtualOnly:'NUR VIRTUELLE CREDITS',eyebrow:'PRÄZISION IN BEWEGUNG',heroAccent:'EIN',subline:'Die LXA Buchstabenwalzen',field:'SERIE 10',round:'RUNDE',targetLabel:'ZIELKOMBINATION JE LINIE',targetHint:'• 5 Linien · von links nach rechts •',balance:'VIRTUELLES GUTHABEN',noReal:'Kein Echtgeld',stake:'EINSATZ PRO RUNDE',line:'/Linie',lastWin:'LETZTER GEWINN',ready:'—',reset:'GUTHABEN ZURÜCKSETZEN',before:'SOLD VORHER',gross:'GEWINN BRUTTO',after:'SOLD NEU',lineResult:'LINIEN-REKORDE',history:'LETZTE RUNDEN',rules:'AUSZAHLUNGSLOGIK',perLine:'€ 1 PRO LINIE',multiBonus:'2+ GEWINNLINIEN',boardReady:'ERGEBNIS DER LETZTEN RUNDE',rolling:'',noMoney:'Zu wenig virtuelles Guthaben. Bitte zurücksetzen.',noWin:'Keine Gewinnlinie · Nächste Runde?',winLine:'Gewinnlinie',system:'System bereit',noLine:'Keine Gewinnlinie'},ro:{brand:'ROLE VIRTUALE',demo:'DEMO NEOFICIALĂ',virtualOnly:'CREDITE VIRTUALE',eyebrow:'PRECIZIE ÎN MIȘCARE',heroAccent:'UN',subline:'Rolele cu litere LXA',field:'SERIA 10',round:'RUNDA',targetLabel:'COMBINAȚIA ȚINTĂ PE LINIE',targetHint:'• 5 linii · de la stânga la dreapta •',balance:'CREDIT VIRTUAL',noReal:'Fără bani reali',stake:'MIZĂ PE RUNDĂ',line:'/linie',lastWin:'ULTIMUL CÂȘTIG',ready:'—',reset:'RESETARE CREDIT',before:'SOLD ÎNAINTE',gross:'CÂȘTIG BRUT',after:'SOLD NOU',lineResult:'RECORDURI LINII',history:'ULTIMELE RUNDE',rules:'REGULA DE PLATĂ',perLine:'€1 PE LINIE',multiBonus:'2+ LINII CÂȘTIGĂTOARE',boardReady:'REZULTATUL ULTIMEI RUNDE',rolling:'',noMoney:'Credit insuficient. Resetează creditul.',noWin:'Nicio linie câștigătoare · Următoarea rundă?',winLine:'Linie câștigătoare',system:'Sistem pregătit',noLine:'Nicio linie'},en:{brand:'VIRTUAL REELS',demo:'UNOFFICIAL DEMO',virtualOnly:'VIRTUAL CREDITS ONLY',eyebrow:'PRECISION IN MOTION',heroAccent:'ONE',subline:'The LXA letter reels',field:'SERIES 10',round:'ROUND',targetLabel:'TARGET COMBINATION PER LINE',targetHint:'• 5 lines · left to right •',balance:'VIRTUAL BALANCE',noReal:'No real money',stake:'BET PER ROUND',line:'/line',lastWin:'LAST WIN',ready:'—',reset:'RESET CREDITS',before:'BALANCE BEFORE',gross:'GROSS WIN',after:'NEW BALANCE',lineResult:'LINE RECORDS',history:'RECENT ROUNDS',rules:'PAYOUT RULES',perLine:'€1 PER LINE',multiBonus:'2+ WINNING LINES',boardReady:'LATEST ROUND RESULT',rolling:'',noMoney:'Not enough credits. Reset your balance.',noWin:'No winning line · Next round?',winLine:'Winning line',system:'System ready',noLine:'No winning line'}};
function applyLanguage(){const x=t[lang];const langLabel=document.querySelector('.lang-label');if(langLabel)langLabel.textContent='🌐';document.documentElement.lang=lang;document.querySelectorAll('[data-i]').forEach(el=>{const k=el.dataset.i;if(x[k])el.textContent=x[k]});const chanceLabel=document.querySelector('[data-i="chanceLabel"]'),chanceHint=document.querySelector('[data-i="chanceHint"]');if(chanceLabel)chanceLabel.textContent=lang==='ro'?'ȘANSĂ DE CÂȘTIG':lang==='en'?'WIN CHANCE':'GEWINNCHANCE';if(chanceHint)chanceHint.textContent=lang==='ro'?'Schimbă doar șansele demo virtuale.':lang==='en'?'Changes virtual demo odds only.':'Ändert nur die virtuellen Demo-Chancen.';$('#language').value=lang;const flagCurrent=$('#flagCurrent');if(flagCurrent)flagCurrent.textContent=lang==='ro'?'🇷🇴':lang==='en'?'🇺🇸':'🇩🇪';drawLines();refresh();refreshChance();renderMission();updateStaticCopy();}
$('#language').onchange=e=>{lang=e.target.value;try{localStorage.setItem(LXA_LANG_KEY,lang)}catch{}applyLanguage()};const scrollLock=$('#scrollLock');scrollLock.onclick=()=>{const locked=document.body.classList.toggle('scroll-locked');document.documentElement.classList.toggle('scroll-locked',locked);scrollLock.textContent=locked?'🔒':'🔓';scrollLock.setAttribute('aria-pressed',String(locked));scrollLock.setAttribute('aria-label',locked?'Seite entsperren':'Seite sperren')};
const chanceCopy={de:['SÜSS 🍯','SCHARF 🌶️','BRUTAL 💀'],ro:['DULCE 🍯','PICANT 🌶️','BRUTAL 💀'],en:['SWEET 🍯','SPICY 🌶️','BRUTAL 💀']};
// v145: the console-top status line wants the plain difficulty word only
// (no emoji) - chanceCopy stays emoji-included for the slider label, this
// just strips it for that one other use.
// \uFE0F (variation selector-16) is listed as its own independent
// alternative here, not meant to combine with the preceding \u{27BF}: this
// strips that trailing marker wherever it follows ANY emoji, not just the
// ones in the ranges above.
// eslint-disable-next-line no-misleading-character-class
const stripEmoji=s=>s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu,'').trim();
const missionCopy={de:{title:'JACKPOT MISSION',goal:'5 VERSCHIEDENE LINIEN AUF 10/10',line:'LINIE',done:'LINIEN ERREICHT',first:'NÄCHSTER JACKPOT: 1/5 · +€1.000',next:'NÄCHSTER JACKPOT',complete:'JACKPOT KOMPLETT · €5.000.000',unlock:'JACKPOT-MISSIONS-BONUS'},ro:{title:'MISIUNE JACKPOT',goal:'5 LINII DIFERITE LA 10/10',line:'LINIA',done:'LINII ATINSE',first:'URMĂTORUL JACKPOT: 1/5 · +€1.000',next:'URMĂTORUL JACKPOT',complete:'JACKPOT COMPLET · 5.000.000 €',unlock:'BONUS MISIUNE JACKPOT'},en:{title:'JACKPOT MISSION',goal:'5 DIFFERENT LINES AT 10/10',line:'LINE',done:'LINES REACHED',first:'NEXT JACKPOT: 1/5 · +€1,000',next:'NEXT JACKPOT',complete:'JACKPOT COMPLETE · €5,000,000',unlock:'JACKPOT MISSION BONUS'}};
/* V118: one dictionary for every text that the later layers used to hard-code in German. */
const tx118={
de:{line:'LINIE',record:'REKORD',reached:'ERREICHT',missionTitle:'JACKPOT MISSION',goal:'Vervollständige 5 verschiedene Linien auf 10/10',tiers:'JACKPOT-STUFEN · JEWEILS EINE NEUE LINIE',hits:'JACKPOT-TREFFER',next:'NÄCHSTER JACKPOT',missionDone:'JACKPOT-MISSION ABGESCHLOSSEN',round:'RUNDE',noWinLine:'KEINE GEWINNLINIE',winLine:'GEWINNLINIE',winLines:'GEWINNLINIEN',noWinNext:'Keine Gewinnlinie · Nächste Runde?',gross:'GEWINN BRUTTO',net:'NETTO',netFormula:'NETTO (GEWINN − EINSATZ)',maxBet:'MAX. EINSATZ',spinErrSession:'BITTE NEU ANMELDEN',spinErrBusy:'ZU VIELE ANFRAGEN - WARTEN',spinErrNet:'KEINE VERBINDUNG',spinErrFail:'SPIN FEHLGESCHLAGEN',paylineFull:'KOMPLETT',geld:'GELD',geldOnly:'GELD ist verfügbar, wenn das GUTHABEN höchstens {x} beträgt.',geldDaily:'Nur 1× GELD pro Tag als Gast. Erstelle ein kostenloses Konto, um weiterzumachen.',geldFail:'GELD konnte nicht geladen werden.',geldDone:'GUTHABEN auf {x} gesetzt.',resetDone:'NEUES SPIEL · GUTHABEN auf {x} gesetzt.',resetFail:'RESET konnte nicht ausgeführt werden.',resetConfirm:'Spiel wirklich zurücksetzen? Guthaben, BANK, WILD und Fortschritt gehen verloren.',wildLevel:'WILD-LEVEL',lvl:'LVL',chance:'Chance',balance:'GUTHABEN',amount:'BETRAG',toBank:'IN DIE BANK',systemReady:'System bereit',leaderboard:'BESTENLISTE',perLineUnit:'/Linie',rank:'PLATZ',guest:'GAST',difficulty:'SCHWIERIGKEIT'},
ro:{line:'LINIA',record:'RECORD',reached:'ATINSĂ',missionTitle:'MISIUNE JACKPOT',goal:'Completează 5 linii diferite la 10/10',tiers:'TREPTE JACKPOT · DE FIECARE DATĂ O LINIE NOUĂ',hits:'JACKPOTURI CÂȘTIGATE',next:'URMĂTORUL JACKPOT',missionDone:'MISIUNE JACKPOT FINALIZATĂ',round:'RUNDA',noWinLine:'NICIO LINIE CÂȘTIGĂTOARE',winLine:'LINIE CÂȘTIGĂTOARE',winLines:'LINII CÂȘTIGĂTOARE',noWinNext:'Nicio linie câștigătoare · Runda următoare?',gross:'CÂȘTIG BRUT',net:'NET',netFormula:'NET (CÂȘTIG − MIZĂ)',maxBet:'MIZĂ MAXIMĂ',spinErrSession:'RECONECTEAZĂ-TE',spinErrBusy:'PREA MULTE CERERI - AȘTEAPTĂ',spinErrNet:'FĂRĂ CONEXIUNE',spinErrFail:'SPIN EȘUAT',paylineFull:'COMPLET',geld:'BANI',geldOnly:'BANI este disponibil când creditul este de cel mult {x}.',geldDaily:'Doar 1× BANI pe zi ca oaspete. Creează un cont gratuit ca să continui.',geldFail:'Banii nu au putut fi încărcați.',geldDone:'Credit setat la {x}.',resetDone:'JOC NOU · credit setat la {x}.',resetFail:'RESET nu a putut fi executat.',resetConfirm:'Resetezi jocul? Creditul, BANK, WILD și progresul se pierd.',wildLevel:'NIVEL WILD',lvl:'NIV.',chance:'șansă',balance:'CREDIT',amount:'SUMĂ',toBank:'ÎN BANK',systemReady:'Sistem pregătit',leaderboard:'CLASAMENT',perLineUnit:'/linie',rank:'POZIȚIA',guest:'OASPETE',difficulty:'DIFICULTATE'},
en:{line:'LINE',record:'RECORD',reached:'DONE',missionTitle:'JACKPOT MISSION',goal:'Complete 5 different lines at 10/10',tiers:'JACKPOT TIERS · A NEW LINE EACH TIME',hits:'JACKPOT HITS',next:'NEXT JACKPOT',missionDone:'JACKPOT MISSION COMPLETE',round:'ROUND',noWinLine:'NO WINNING LINE',winLine:'WINNING LINE',winLines:'WINNING LINES',noWinNext:'No winning line · Next round?',gross:'GROSS WIN',net:'NET',netFormula:'NET (WIN − STAKE)',maxBet:'MAX BET',spinErrSession:'PLEASE LOG IN AGAIN',spinErrBusy:'TOO MANY REQUESTS - WAIT',spinErrNet:'NO CONNECTION',spinErrFail:'SPIN FAILED',paylineFull:'COMPLETE',geld:'CASH',geldOnly:'CASH is available when the balance is at most {x}.',geldDaily:'Only 1× CASH per day as a guest. Create a free account to keep going.',geldFail:'Cash could not be loaded.',geldDone:'Balance set to {x}.',resetDone:'NEW GAME · balance set to {x}.',resetFail:'RESET could not be completed.',resetConfirm:'Really reset the game? Balance, BANK, WILD and progress will be lost.',wildLevel:'WILD LEVEL',lvl:'LVL',chance:'chance',balance:'BALANCE',amount:'AMOUNT',toBank:'TO BANK',systemReady:'System ready',leaderboard:'LEADERBOARD',perLineUnit:'/line',rank:'RANK',guest:'GUEST',difficulty:'DIFFICULTY'}};
const T118=(key,x)=>{const s=(tx118[lang]||tx118.de)[key]??tx118.de[key]??key;return x===undefined?s:s.replace('{x}',x)};
const milestoneRewards=[1000000,2000000,3000000,4000000,5000000];
// Jackpot-Stufen richten sich nach der Anzahl bereits kompletter Linien, nicht nach ihrer Nummer.

function renderMission(){const x=missionCopy[lang],done=completedLines.filter(Boolean).length;$('#missionTitle').textContent=x.title;$('#missionGoal').textContent=x.goal;const lineCards=recordHits.map((hits,i)=>`<div class="mission-line ${completedLines[i]?'complete':''}" style="--progress:${hits*10}%"><span>${x.line} ${i+1}</span><b>${hits}/10${completedLines[i]?' ✓':''}</b><small>REKORD</small></div>`).join('');const milestones=milestoneRewards.map((reward,i)=>`<div class="milestone ${done>i?'unlocked':''}"><span>${i+1}/5</span><b>${jackpotMoney(reward)}</b></div>`).join('');$('#missionList').innerHTML=`<div class="mission-line-grid">${lineCards}</div><div class="milestone-label">JACKPOT-STUFEN · UNABHÄNGIG VON DER LINIENNUMMER</div><div class="milestone-list">${milestones}</div>`;}
function refreshChance(){const label=chanceCopy[lang][chance];$('#chanceValue').textContent=label;$('#chance').value=chance;}
$('#chance').oninput=e=>{chance=Number(e.target.value);refreshChance()};
function render(grid){reels.innerHTML=target.map((_,c)=>`<div class="reel">${grid.map((row,r)=>{const value=row[c];const isWild=value===WILD;return `<span data-row="${r}" class="${isWild?'wild-symbol':'letter-'+value}">${isWild?`${WILD_IMG}`:value}</span>`}).join('')}</div>`).join('');}
function drawLines(){const p=$('.paylines');p.innerHTML=Array.from({length:5},(_,i)=>`<div data-line="${i}"><b>${t[lang].winLine.toUpperCase()} ${i+1}</b></div>`).join('');}
function refresh(){const x=t[lang];if(credits>0)bet=Math.min(bet,maxBet());$('#credits').textContent=money(credits);$('#bet').textContent=money(bet);$('#lineStake').textContent=money(bet/5)+x.line;$('#roundLabel').textContent=`${x.round} ${String(round).padStart(3,'0')}`;$('#before').textContent=$('#before').textContent||money(credits);$('#after').textContent=$('#after').textContent||money(credits);}
function setMsg(s){$('#message').textContent=s}
function showBoard(details,bonus,gross,missionBonus=0,seriesBonus=0){const x=t[lang],board=$('#winBoard'),jackpot=details.find(d=>d.hits===10&&!d.wild),unit=lang==='ro'?'Miză linie':lang==='en'?'Line bet':'Linieneinsatz',bonusLabel=lang==='ro'?`Bonus ${details.length} linii`:lang==='en'?`${details.length}-line bonus`:`Bonus ${details.length} Linien`;$('#boardTitle').textContent=jackpot?'COMPLET':missionBonus?'JACKPOT TARGET':`${details.length} ${({de:'LINIEN',ro:'LINII',en:'LINES'})[lang]||'LINES'}`;const lines=details.map(d=>`<div class="${d.hits===10&&!d.wild?'jackpot-result':''}"><span>${x.winLine} ${d.line+1} · ${d.hits}/10 · ${unit} €1 ×${d.mult}</span><b>+${money(d.amount)}</b></div>`).join('');const extra=bonus?`<div class="board-bonus"><span>${bonusLabel}</span><b>+${money(bonus)}</b></div>`:'';const mission=missionBonus?`<div class="board-bonus mission-bonus"><span>${missionCopy[lang].unlock}</span><b>+${money(missionBonus)}</b></div>`:'';const series=seriesBonus?`<div class="board-bonus series-bonus"><span>${uiStatic[lang].series}</span><b>+${money(seriesBonus)}</b></div>`:'';$('#boardDetails').innerHTML=`${lines}${extra}${mission}${series}<div class="board-total"><span>${x.gross}</span><b>+${money(gross)}</b></div>`;board.classList.add('show')}
const uiStatic={de:{payout:'AUSZAHLUNGSLOGIK',perLine:'€ 1 PRO LINIE',consecutive:'KONSEKUTIVE',lines:'GEWINNLINIEN',record:'REKORD',objective:'OBJEKTIV',milestones:'JACKPOT-STUFEN · UNABHÄNGIG VON DER LINIENNUMMER',protocol:'LIVE-PROTOKOLL',system:'VIRTUAL EURO SYSTEM',series:'3+ GEWINNE',seriesValue:'+ €25',wild:'BONUS-WILD',heroWord:'WALZEN'},ro:{payout:'REGULA DE PLATĂ',perLine:'€ 1 PE LINIE',consecutive:'CONSECUTIVE',lines:'LINII CÂȘTIGĂTOARE',record:'RECORD',objective:'OBIECTIV',milestones:'NIVELURI JACKPOT · INDEPENDENT DE NUMĂRUL LINIEI',protocol:'JURNAL LIVE',system:'SISTEM EURO VIRTUAL',series:'3+ CÂȘTIGURI',seriesValue:'+ €25',wild:'BONUS WILD',heroWord:'ROLE'},en:{payout:'PAYOUT RULES',perLine:'€ 1 PER LINE',consecutive:'CONSECUTIVE',lines:'WINNING LINES',record:'RECORD',objective:'OBJECTIVE',milestones:'JACKPOT LEVELS · INDEPENDENT OF LINE NUMBER',protocol:'LIVE LOG',system:'VIRTUAL EURO SYSTEM',series:'3+ WINS',seriesValue:'+ €25',wild:'BONUS WILD',heroWord:'REELS'}};
function updateStaticCopy(){const x=uiStatic[lang],labels=['10/10',`7–9 ${x.consecutive}`,`4–6 ${x.consecutive}`,`2 ${x.lines}`,`3 ${x.lines}`,`4 ${x.lines}`,`5 ${x.lines}`,x.series],head=document.querySelector('.payout-card-head');if(head)head.innerHTML=`${x.payout} <small>${x.perLine}</small>`;document.querySelectorAll('.payout-card-row b,.payout-row b').forEach((el,i)=>el.textContent=labels[i%8]);document.querySelectorAll('.series-rule strong,.series-rule span').forEach(el=>el.textContent=x.seriesValue);document.querySelectorAll('.mission-line.complete small').forEach(el=>el.textContent=T118('reached'));const milestoneLabel=document.querySelector('.milestone-label');if(milestoneLabel)milestoneLabel.textContent=x.milestones;const protocol=document.querySelector('.history .section-heading small');if(protocol)protocol.textContent=x.protocol}
const baseApplyLanguage=applyLanguage;applyLanguage=()=>{baseApplyLanguage();const x=uiStatic[lang],title=document.querySelector('.title-line strong');if(title)title.innerHTML=`10 <span>${x.heroWord}</span>. <b>${t[lang].heroAccent}</b> MOMENT`;const flagCurrent=$('#flagCurrent');if(flagCurrent)flagCurrent.textContent=lang==='ro'?'🇷🇴':lang==='en'?'🇺🇸':'🇩🇪';const opts=[['de','🇩🇪'],['ro','🇷🇴'],['en','🇺🇸']];opts.forEach(([value,label])=>{const option=document.querySelector(`#language option[value="${value}"]`);if(option)option.textContent=label})};
const finalApplyLanguage=applyLanguage;applyLanguage=()=>{finalApplyLanguage();const flagCurrent=$('#flagCurrent');if(flagCurrent)flagCurrent.textContent=lang==='ro'?'🇷🇴':lang==='en'?'🇺🇸':'🇩🇪';[['de','🇩🇪'],['ro','🇷🇴'],['en','🇺🇸']].forEach(([value,label])=>{const option=document.querySelector(`#language option[value="${value}"]`);if(option)option.textContent=label})};
render(Array.from({length:5},()=>target.slice()));drawLines();applyLanguage();refreshChance();

/* v56: one translation source for every visible label and a real-flag picker.
   The native select is retained as the programmatic source of truth, but its
   Windows-dependent emoji rendering is never exposed to the player. */
Object.assign(t.de,{spin:'SPIN',start:'STARTEN',footer:'UNOFFIZIELLE LXA-DEMO · KEINE ZAHLUNGS- ODER GLÜCKSSPIELFUNKTION · MADE BY LEO',systemReady:'System bereit'});
Object.assign(t.ro,{spin:'ROTIRE',start:'PORNEȘTE',footer:'DEMO LXA NEOFICIALĂ · FĂRĂ FUNCȚIE DE PLATĂ SAU JOCURI DE NOROC · REALIZAT DE LEO',systemReady:'Sistem pregătit'});
Object.assign(t.en,{spin:'SPIN',start:'START',footer:'UNOFFICIAL LXA DEMO · NO PAYMENT OR GAMBLING FUNCTION · MADE BY LEO',systemReady:'System ready'});
Object.assign(missionCopy.de,{record:'REKORD',levels:'JACKPOT-STUFEN · UNABHÄNGIG VON DER LINIENNUMMER'});
Object.assign(missionCopy.ro,{record:'RECORD',levels:'NIVELURI JACKPOT · INDEPENDENT DE NUMĂRUL LINIEI'});
Object.assign(missionCopy.en,{record:'RECORD',levels:'JACKPOT LEVELS · INDEPENDENT OF LINE NUMBER'});

const v56RenderMission=renderMission;
renderMission=()=>{v56RenderMission();const x=missionCopy[lang];document.querySelectorAll('.mission-line.complete small').forEach(el=>el.textContent=T118('reached'));const level=document.querySelector('.milestone-label');if(level)level.textContent=x.levels};

// v159: removed addHistory() and its v56 override below - both wrote into
// the same #history list that renderHistoryV79() (further below) now owns
// exclusively, reading from gameState.spinHistory instead of being called
// explicitly per-spin. Provably dead: no call site anywhere in this file or
// elsewhere in the project calls addHistory(name or override).

function setLockLabel(locked){const labels={de:locked?'Seite entsperren':'Seite sperren',ro:locked?'Deblochează pagina':'Blochează pagina',en:locked?'Unlock page':'Lock page'};scrollLock.setAttribute('aria-label',labels[lang])}
const v56LockClick=scrollLock.onclick;
scrollLock.onclick=()=>{v56LockClick();setLockLabel(document.body.classList.contains('scroll-locked'))};
const touchScreenOnly=()=>window.matchMedia&&window.matchMedia('(pointer:coarse)').matches;
document.addEventListener('touchmove',event=>{if(document.body.classList.contains('scroll-locked')&&!(event.target.closest&&event.target.closest('.account-panel')))event.preventDefault()},{passive:false});
document.addEventListener('wheel',event=>{if(touchScreenOnly()&&document.body.classList.contains('scroll-locked')&&!(event.target.closest&&event.target.closest('.account-panel')))event.preventDefault()},{passive:false});
document.addEventListener('gesturestart',event=>{if(document.body.classList.contains('scroll-locked'))event.preventDefault()},{passive:false});

const languageControl=$('#languageControl'),languageSelect=$('#language');let languageMenu;
function buildLanguageMenu(){const toggle=$('#languageToggle');languageMenu=languageMenu||document.querySelector('#languageMenu');if(!toggle||!languageMenu||toggle.dataset.bound)return;toggle.dataset.bound='1';const setOpen=open=>{languageMenu.classList.toggle('open',open);toggle.setAttribute('aria-expanded',String(open))};toggle.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();setOpen(!languageMenu.classList.contains('open'))});toggle.addEventListener('keydown',event=>{if(event.key==='Escape')setOpen(false)});languageMenu.querySelectorAll('button[data-lang]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();lang=button.dataset.lang;try{localStorage.setItem(LXA_LANG_KEY,lang)}catch{}languageSelect.value=lang;applyLanguage();setOpen(false)}));const closeIfOutside=event=>{if(!languageControl.contains(event.target))setOpen(false)};document.addEventListener('click',closeIfOutside);document.addEventListener('touchend',closeIfOutside,{capture:true});document.addEventListener('mousedown',closeIfOutside,{capture:true})}
function updateLanguagePicker(){const flag=$('#flagCurrent');if(flag){flag.dataset.flag=lang;flag.textContent=''}if(languageSelect)languageSelect.value=lang;setLockLabel(document.body.classList.contains('scroll-locked'))}
const v56ApplyLanguage=applyLanguage;
applyLanguage=()=>{v56ApplyLanguage();buildLanguageMenu();updateLanguagePicker()};
applyLanguage();

const v56ShowBoard=showBoard;
showBoard=(details,bonus,gross,missionBonus=0)=>{v56ShowBoard(details,bonus,gross,missionBonus);const complete={de:'KOMPLETT',ro:'COMPLET',en:'COMPLETE'}[lang];const target={de:'JACKPOT-ZIEL',ro:'ȚINTĂ JACKPOT',en:'JACKPOT TARGET'}[lang];const title=$('#boardTitle');if(title){if(details.find(d=>d.hits===10&&!d.wild))title.textContent=complete;else if(missionBonus)title.textContent=target}};
uiStatic.de.system='VIRTUELLES EURO-SYSTEM';
const v56TitleApply=applyLanguage;
applyLanguage=()=>{v56TitleApply();document.title={de:'LXA | Virtuelle Walzen',ro:'LXA | Role virtuale',en:'LXA | Virtual Reels'}[lang]};
applyLanguage();
const viewportMeta=document.querySelector('meta[name="viewport"]'),baseViewport=viewportMeta?.content||'width=device-width,initial-scale=1,viewport-fit=cover';
const v57LockClick=scrollLock.onclick;
const updateLockState=()=>{const locked=document.body.classList.contains('scroll-locked');scrollLock.dataset.locked=String(locked);scrollLock.classList.toggle('is-locked',locked);scrollLock.setAttribute('aria-pressed',String(locked));setLockLabel(locked);if(viewportMeta)viewportMeta.setAttribute('content',locked?'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover':baseViewport)};
scrollLock.onclick=()=>{v57LockClick();updateLockState()};
updateLockState();

/* V194: the lock used to rely on overflow:hidden, but browsers reset
   scrollTop to 0 when <html> becomes overflow:hidden — the page visibly
   jumped to the top ("ma trage in sus"). Now scrolling is blocked by
   swallowing the scroll events instead, so the position never changes. */
(function lockKeepsScrollPositionV194(){
  const isLocked=()=>document.body.classList.contains('scroll-locked');
  const swallow=event=>{
    if(!isLocked())return;
    // let the user still scroll inside genuinely scrollable panels
    if(event.target.closest&&event.target.closest('.leaderboard-panel,#history,.account-panel'))return;
    event.preventDefault();
  };
  window.addEventListener('wheel',swallow,{passive:false});
  window.addEventListener('touchmove',swallow,{passive:false});
  const SCROLL_KEYS=new Set(['PageUp','PageDown','Home','End','ArrowUp','ArrowDown',' ']);
  window.addEventListener('keydown',event=>{
    if(!isLocked())return;
    const tag=(event.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='select'||tag==='textarea')return;
    if(SCROLL_KEYS.has(event.key))event.preventDefault();
  },{passive:false});
})();

/* v76 account + leaderboard layer.  The reel and payout engine above remains
   the source of truth; this layer persists its resulting state server-side. */
const LXA_API='/api/lxa-account',LXA_CACHE='lxa-account-cache-v1',LXA_TOKEN_KEY='lxa-session-token-v1';
let lxaAccount=null,lxaSafeWord='',lxaLeaderboardLevel=chance+1,lxaRtpCache=null,lxaPlayersCache=null,lxaRadioCache=null,lxaEditPlayerId=null,lxaToken=localStorage.getItem(LXA_TOKEN_KEY)||'';
// v151: lxaToken is a per-device "remember me" credential (separate from
// the real password) returned by the server on create/login/password-change.
// It is what lets lxaRestoreSession() and spin skip re-typing the real
// password - unlike the old silent-restore (id alone, no proof needed), a
// device without a valid cached token gets neither.
// AUTH DIAGNOSTICS: why was this device logged out? A short log (last 15 events) is kept in localStorage and printed by ?debug=1. 'lxa_seen' is a second, independent marker (cookie, 400 days):
// when it is still there but the token is gone, the phone cleared localStorage on its own.
const LXA_AUTH_LOG_KEY='lxa-auth-log-v1',LXA_LAST_RESTORE_KEY='lxa-last-restore-v1';
function lxaAuthLog(why,extra){try{const standalone=!!(matchMedia('(display-mode: standalone)').matches||navigator.standalone),list=JSON.parse(localStorage.getItem(LXA_AUTH_LOG_KEY)||'[]');list.unshift({t:new Date().toISOString(),why,standalone,host:location.host,persisted:window.__lxaPersisted,...extra});localStorage.setItem(LXA_AUTH_LOG_KEY,JSON.stringify(list.slice(0,15)))}catch{}}
function lxaMarkSeen(on){try{document.cookie='lxa_seen='+(on?'1':'')+'; max-age='+(on?34560000:0)+'; path=/; SameSite=Lax'}catch{}}
function lxaWasSeen(){try{return document.cookie.split('; ').includes('lxa_seen=1')}catch{return false}}
// Ask the browser to keep this site's storage (Android Chrome grants it to installed apps; iOS decides on its own and may refuse). The answer is kept for the diagnostics.
function lxaRequestPersist(){try{const s=navigator.storage;if(s&&s.persist)s.persisted().then(p=>p||s.persist()).then(p=>{window.__lxaPersisted=!!p}).catch(()=>{})}catch{}}
lxaRequestPersist();
// REMEMBERED PASSWORD (owner's decision: a demo game with no real money, the phone is personal): the password typed at login / in the KONTO panel is kept on this device (lxa-safe-v1)
// so the KONTO panel and the admin tools have it again after the app is reopened. It is removed at logout / lost session, and dropped when the server refuses it.
const LXA_SAFE_KEY='lxa-safe-v1';
function lxaSetSafe(pw){lxaSafeWord=pw||'';try{if(lxaSafeWord)localStorage.setItem(LXA_SAFE_KEY,lxaSafeWord);else localStorage.removeItem(LXA_SAFE_KEY)}catch{}}
// A logout that cannot reach the server (offline) would leave the session cookie and the server session alive: it is remembered (lxa-pending-logout-v1) and finished at the next start, before any restore.
const LXA_PENDING_LOGOUT_KEY='lxa-pending-logout-v1';
async function lxaSendLogout(id,token){try{localStorage.setItem(LXA_PENDING_LOGOUT_KEY,JSON.stringify({id,token}))}catch{}try{await lxaRequest('logout',{id,token});try{localStorage.removeItem(LXA_PENDING_LOGOUT_KEY)}catch{}return true}catch(error){if(!/network error|timed out/i.test(error.message||''))try{localStorage.removeItem(LXA_PENDING_LOGOUT_KEY)}catch{}return false}}
// The installed app has no address bar, so ?debug=1 cannot be opened there: tapping the KONTO heading 5 times shows the same auth diagnostics inside the panel.
function lxaAuthReport(){let log=[];try{log=JSON.parse(localStorage.getItem(LXA_AUTH_LOG_KEY)||'[]')}catch{}const standalone=!!(matchMedia('(display-mode: standalone)').matches||navigator.standalone),script=document.querySelector('script[src*="renderer.js"]'),ver=script&&(script.src.match(/v=(\d+)/)||[])[1];const head=['mode='+(standalone?'app':'tab'),'host='+location.host,'renderer v='+(ver||'?'),'token='+!!localStorage.getItem(LXA_TOKEN_KEY),'cache='+!!localStorage.getItem(LXA_CACHE),'persisted='+window.__lxaPersisted,'seen='+lxaWasSeen(),'lastRestore='+(localStorage.getItem(LXA_LAST_RESTORE_KEY)||'-')];const rows=log.slice(0,8).map(e=>new Date(e.t).toLocaleString()+' '+e.why+' ('+(e.standalone?'app':'tab')+')'+(e.cache!==undefined?' cache='+e.cache:'')+(e.seenBefore!==undefined?' seenBefore='+e.seenBefore:'')+' persisted='+e.persisted);return head.join('\n')+'\n'+(rows.length?rows.join('\n'):'log: empty')}
function lxaBindDiag(){const h=accountPanel.querySelector('h2');if(!h)return;let n=0,t=0;h.addEventListener('click',()=>{const now=Date.now();n=now-t>2500?1:n+1;t=now;if(n<5)return;n=0;const old=accountPanel.querySelector('.account-diag');if(old){old.remove();return}const box=document.createElement('pre');box.className='account-diag';box.textContent=lxaAuthReport();h.insertAdjacentElement('afterend',box)})}
function lxaSetToken(token){if(!token)return;lxaToken=token;localStorage.setItem(LXA_TOKEN_KEY,lxaToken);lxaMarkSeen(true);lxaRequestPersist()}
function lxaClearToken(){lxaToken='';localStorage.removeItem(LXA_TOKEN_KEY);try{localStorage.removeItem(LXA_SAFE_KEY)}catch{}lxaMarkSeen(false)}
// AUTH SESSION vs GAME SESSION: every logout / lost session bumps the generation and tells the game block to drop whatever is in flight
// (AUTO, pending spin result, reel animation) so an old callback can never produce a result, a win/loss or a balance change afterwards.
let lxaAuthGeneration=0;
function lxaInvalidateGame(){lxaAuthGeneration++;try{if(window.__lxaGameInvalidate)window.__lxaGameInvalidate()}catch(e){}}
// A stored id / name / cached balance is only a label, never a session: when the server says the token is not valid the login state is cleared.
// In-app confirm dialog (the native confirm() is a white system sheet on iOS / Android that cannot be styled): dark glass card, magenta confirm button,
// Esc / tap outside / Cancel = false, Enter / Confirm = true, focus is trapped in the dialog and restored afterwards. Works in all three languages.
function lxaConfirm(message,opts){
  opts=opts||{};
  var l=String(document.documentElement.lang||'de').slice(0,2);
  var T={de:{ok:'Bestätigen',cancel:'Abbrechen'},ro:{ok:'Confirmă',cancel:'Anulează'},en:{ok:'Confirm',cancel:'Cancel'}}[l]||{ok:'Confirm',cancel:'Cancel'};
  return new Promise(function(resolve){
    var prev=document.activeElement;
    var wrap=document.createElement('div'); wrap.className='lxa-confirm'; wrap.setAttribute('role','alertdialog'); wrap.setAttribute('aria-modal','true');
    var card=document.createElement('div'); card.className='lxa-confirm-card';
    var text=document.createElement('p'); text.className='lxa-confirm-text'; text.id='lxaConfirmText'+Date.now(); text.textContent=String(message||'');
    wrap.setAttribute('aria-labelledby',text.id);
    var row=document.createElement('div'); row.className='lxa-confirm-actions';
    var no=document.createElement('button'); no.type='button'; no.className='lxa-confirm-no'; no.textContent=opts.cancelLabel||T.cancel;
    var yes=document.createElement('button'); yes.type='button'; yes.className='lxa-confirm-yes'; yes.textContent=opts.okLabel||T.ok;
    row.append(no,yes); card.append(text,row); wrap.append(card); document.body.append(wrap);
    function done(v){ document.removeEventListener('keydown',key,true); wrap.remove(); try{ if(prev&&prev.focus) prev.focus(); }catch(e){} resolve(v); }
    function key(e){
      if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); done(false); }
      else if(e.key==='Tab'){ e.preventDefault(); (document.activeElement===yes?no:yes).focus(); }
      else if(e.key==='Enter'&&document.activeElement!==no){ e.preventDefault(); e.stopPropagation(); done(true); }
    }
    document.addEventListener('keydown',key,true);
    no.addEventListener('click',function(){done(false)}); yes.addEventListener('click',function(){done(true)});
    wrap.addEventListener('pointerdown',function(e){ if(e.target===wrap) done(false); });
    no.focus();
  });
}
// "New version available": an open tab / installed app keeps running the code it loaded until it is reloaded, so after a deploy some screens showed the new layout and
// others the old one. When the page becomes visible again (and every 10 minutes) the fresh index.html is fetched; if its asset versions differ from the loaded ones a small
// notice offers a reload (never an automatic reload: a round may be running).
function lxaWatchVersion(){
  if(window.__lxaVersionWatch||!window.fetch) return; window.__lxaVersionWatch=true;
  var sig=function(list){ return list.map(function(u){ return String(u).replace(/^.*\//,''); }).filter(function(u){ return /\.(css|js)\?v=\d+/.test(u); }).sort().join('|'); };
  // the list of MY files is read when the check runs, not now: renderer.js executes while the page is still being parsed, so scripts placed after it (radio.js, header-fit.js, ...) are not in the DOM yet
  var mineNow=function(){ return sig(Array.prototype.map.call(document.querySelectorAll('link[href*="?v="],script[src*="?v="]'),function(e){ return e.getAttribute('href')||e.getAttribute('src'); })); };
  var shown=false;
  function notice(){
    if(shown) return; shown=true;
    var l=String(document.documentElement.lang||'de').slice(0,2);
    var T={de:{t:'Neue Version verf\u00fcgbar',b:'Neu laden'},ro:{t:'Versiune nou\u0103 disponibil\u0103',b:'Re\u00eencarc\u0103'},en:{t:'New version available',b:'Reload'}}[l]||{t:'New version available',b:'Reload'};
    var bar=document.createElement('div'); bar.className='lxa-update'; bar.setAttribute('role','status');
    var s=document.createElement('span'); s.textContent=T.t;
    var b=document.createElement('button'); b.type='button'; b.textContent=T.b; b.addEventListener('click',function(){ location.reload(); });
    var x=document.createElement('button'); x.type='button'; x.className='lxa-update-x'; x.setAttribute('aria-label','Close'); x.textContent='\u00d7'; x.addEventListener('click',function(){ bar.remove(); });
    bar.append(s,b,x); document.body.append(bar);
  }
  function check(){
    if(document.hidden||shown) return;
    fetch('/index.html?chk='+Date.now(),{cache:'no-store'}).then(function(res){ return res.ok?res.text():''; }).then(function(html){
      if(!html) return;
      var found=(html.match(/(?:href|src)="[^"]*\?v=\d+"/g)||[]).map(function(m){ return m.replace(/^(?:href|src)="|"$/g,''); });
      if(found.length&&sig(found)!==mineNow()) notice();
    }).catch(function(){});
  }
  document.addEventListener('visibilitychange',function(){ if(!document.hidden) setTimeout(check,400); });
  window.addEventListener('pageshow',function(e){ if(e.persisted) setTimeout(check,400); });
  setInterval(check,10*60*1000);
  setTimeout(check,4000);
}
function lxaSessionLost(reason){if(!lxaAccount&&!lxaToken)return;lxaAuthLog(reason||'session lost');lxaInvalidateGame();lxaAccount=null;lxaSafeWord='';lxaClearToken();lxaStore();try{renderLeaderboard()}catch(e){}if(typeof renderAccountPanel==='function')renderAccountPanel('login',lxaCopy().reauth)}
// v143: admin status lives on the account record (accounts/{id}/role in
// Firebase, set manually via the Firebase Console), never on the id -
// mirrors functions/lxa-account.js's isAdminAccount. This client-side
// check only decides whether to SHOW the admin button; the real gate is
// server-side (it re-reads the account fresh from Firebase on every admin
// action), so this can't be spoofed by editing local state.
const isAdminAccount=account=>Boolean(account)&&account.role==='admin';
const accountText={de:{account:'KONTO',create:'KONTO ERSTELLEN',login:'LOGIN / RECOVERY',hint:'ID oder Name + Passwort.',hintForgot:'Passwort vergessen? Sende deine ID + deinen Namen an den Administrator – er setzt ein neues Passwort.',loginOk:'Erfolgreich angemeldet.',name:'Name',id:'LXA-ID',safe:'Passwort',newSafe:'Neues Passwort',save:'SPEICHERN',logout:'ABMELDEN',settings:'KONTO-EINSTELLUNGEN',back:'ZURÜCK',leaderboard:'LEADERBOARD',your:'DEINE POSITION',empty:'Noch keine Einträge.',offline:'Online-Konto momentan nicht erreichbar.',created:'Konto erstellt. Passwort nur jetzt sichtbar:',duplicate:'Dieser Name wird bereits verwendet.',wrong:'Name oder Passwort ist falsch.',rtpAdmin:'GEWINNCHANCEN (ADMIN)',rtpHint:'Ziel-RTP % pro Schwierigkeit (ohne WILD/Jackpot).',rtpHintLinked:'Verbunden: der Wert ist der GESAMT-RTP % inkl. WILD und Jackpot, exakt für das Referenz-WILD-Level (höhere Level zahlen mehr).',rtpLinkLabel:'RTP verbunden (Gesamt-RTP statt nur Linien)',rtpRefLabel:'Referenz-WILD-Level',rtpLines:'Linien',rtpTotal:'Gesamt',rtpSaved:'Chancen gespeichert.',rtpResetDone:'Auf Standard zurückgesetzt.',rtpReset:'STANDARD',simulateRtp:'🎲 ECHTE RTP',simulating:'Simuliere…',noJackpot:'ohne Jackpot',adminJackpot:'💀 JACKPOT',adminWild:'✨ WILD',adminPayouts:'💰 AUSZAHLUNGEN',difficultyLabel:'Schwierigkeit',jackpotFreqHint:'Jackpot-Häufigkeit pro Schwierigkeit.',jackpotFreqField:'Häufigkeit (×)',wildHint:'Globale WILD-Einstellungen (alle Schwierigkeiten).',wildChanceField:'WILD-Basischance (%)',wildPerLevelField:'Steigerung pro Level (%)',wildCapField:'Normal gezahlte WILDs (pro Linie)',wildCostMultField:'WILD-Upgrade-Kosten (×)',extraWildFreqField:'Häufigkeit zusätzlicher WILDs (×)',payoutHint:'Globale Gewinn-Multiplikatoren.',payoutMultField:'Auszahlungs-Multiplikator (×)',jackpotValueField:'Jackpot-Wert-Multiplikator (×)',resetLeaderboard:'🏆 LEADERBOARD ZURÜCKSETZEN',resetLeaderboardConfirm:'Wirklich das gesamte Leaderboard (alle Schwierigkeiten) löschen? Das kann nicht rückgängig gemacht werden.',resetLeaderboardDone:'Leaderboard zurückgesetzt.',adminCustom:'🎲 EIGENE CHANCEN',customOverride:'⚠️ Eigene Chancen aktiv, RTP-Ziel wird ignoriert',customHint:'Werte werden automatisch auf 100% normiert.',customSaved:'Chancen gespeichert.',wildPreviewUnit:'WILD/Spin · LVL 50',adminPlayers:'👥 SPIELER',adminRadio:'📻 SENDER-MELDUNGEN',adminGroupGame:'🎰 SPIEL',adminGroupPlayers:'👥 SPIELER &amp; BESTENLISTE',adminGroupRadio:'📻 RADIO',radioHint:'Pro Sender eine Zeile, ×N = wie oft gemeldet (🤖 automatisch nach Fehler, 🚩 von Hand). Nichts wird automatisch versteckt. 🔍 testet den Sender jetzt, 🙈 Verstecken nimmt ihn aus der Liste aller Spieler (wenige Minuten, kein Deploy), 👁️ Zeigen holt ihn zurück, 🗑️ löscht die Meldungen.',radioHiddenTag:'VERSTECKT',radioHideBtn:'Verstecken',radioShowBtn:'Zeigen',radioReportedTimes:'Anzahl Meldungen',radioClearTitle:'Meldungen löschen',radioChecked:'Letzte Prüfung',radioStations:'Sender',radioNone:'Keine Meldungen.',radioDevices:'Geräte',radioHiddenTitle:'Versteckt:',radioHiddenSince:'versteckt seit',radioDroppedTitle:'Von der Prüfung entfernt (tot):',radioDroppedAt:'entfernt vor',radioClearConfirm:'Meldungen dieses Senders löschen?',radioServer:'Server',radioPhone:'Handy',radioHideDone:'Versteckt.',lastActive:'Letzte Aktivität',newId:'Neue ID',deletePlayer:'🗑️ SPIELER LÖSCHEN',deletePlayerConfirm:'Diesen Spieler wirklich endgültig löschen? Das kann nicht rückgängig gemacht werden.',deletePlayerDone:'Spieler gelöscht.',saved:'Gespeichert.',reauth:'Sitzung abgelaufen. Bitte Passwort erneut eingeben.'},ro:{account:'CONT',create:'CREEAZĂ CONT',login:'LOGIN / RECUPERARE',hint:'ID sau Nume + Parolă.',hintForgot:'Ai uitat parola? Trimite ID + numele administratorului – îți setează o parolă nouă.',loginOk:'Conectat cu succes.',name:'Nume',id:'ID LXA',safe:'Parolă',newSafe:'Parolă nouă',save:'SALVEAZĂ',logout:'DECONECTARE',settings:'SETĂRI CONT',back:'ÎNAPOI',leaderboard:'CLASAMENT',your:'POZIȚIA TA',empty:'Încă nu există intrări.',offline:'Contul online nu este disponibil momentan.',created:'Cont creat. Parola este vizibilă doar acum:',duplicate:'Acest nume este deja folosit.',wrong:'Numele sau parola este incorectă.',rtpAdmin:'ȘANSE JOC (ADMIN)',rtpHint:'RTP țintă (%) per dificultate (fără WILD/jackpot).',rtpHintLinked:'Conectat: valoarea este RTP-ul TOTAL % cu WILD și jackpot incluse, exact pentru nivelul WILD de referință (niveluri mai mari plătesc mai mult).',rtpLinkLabel:'RTP conectat (RTP total, nu doar linii)',rtpRefLabel:'Nivel WILD de referință',rtpLines:'Linii',rtpTotal:'Total',rtpSaved:'Șanse salvate.',rtpResetDone:'Resetat la valorile implicite.',rtpReset:'IMPLICIT',simulateRtp:'🎲 RTP REAL',simulating:'Simulez…',noJackpot:'fără jackpot',adminJackpot:'💀 JACKPOT',adminWild:'✨ WILD',adminPayouts:'💰 PLĂȚI',difficultyLabel:'Dificultate',jackpotFreqHint:'Multiplicator frecvență jackpot per dificultate.',jackpotFreqField:'Frecvență (×)',wildHint:'Setări globale WILD (toate dificultățile).',wildChanceField:'Șansă de bază WILD (%)',wildPerLevelField:'Creștere per nivel (%)',wildCapField:'WILD-uri plătite normal (per linie)',wildCostMultField:'Cost upgrade WILD (×)',extraWildFreqField:'Frecvență WILD-uri suplimentare (×)',payoutHint:'Multiplicatoare globale de câștig.',payoutMultField:'Multiplicator plăți (×)',jackpotValueField:'Multiplicator valoare jackpot (×)',resetLeaderboard:'🏆 RESETEAZĂ CLASAMENTUL',resetLeaderboardConfirm:'Sigur ștergi tot clasamentul (toate dificultățile)? Nu se poate anula.',resetLeaderboardDone:'Clasament resetat.',adminCustom:'🎲 ȘANSE CUSTOM',customOverride:'⚠️ Șanse Custom active, RTP țintă e ignorat',customHint:'Valorile sunt normalizate automat la 100%.',customSaved:'Șanse salvate.',wildPreviewUnit:'WILD/spin · LVL 50',adminPlayers:'👥 JUCĂTORI',adminRadio:'📻 RAPOARTE STAȚII',adminGroupGame:'🎰 JOC',adminGroupPlayers:'👥 JUCĂTORI &amp; CLASAMENT',adminGroupRadio:'📻 RADIO',radioHint:'Un rând pe stație, ×N = de câte ori a fost raportată (🤖 automat după eroare, 🚩 manual). Nimic nu se ascunde automat. 🔍 testează stația acum, 🙈 Ascunde o scoate din lista tuturor jucătorilor (câteva minute, fără deploy), 👁️ Arată o aduce înapoi, 🗑️ șterge rapoartele.',radioHiddenTag:'ASCUNSĂ',radioHideBtn:'Ascunde',radioShowBtn:'Arată',radioReportedTimes:'număr de rapoarte',radioClearTitle:'Șterge rapoartele',radioChecked:'Ultima verificare',radioStations:'stații',radioNone:'Niciun raport.',radioDevices:'dispozitive',radioHiddenTitle:'Ascunse:',radioHiddenSince:'ascunsă de',radioDroppedTitle:'Scoase de verificare (moarte):',radioDroppedAt:'scoasă acum',radioClearConfirm:'Ștergi rapoartele acestei stații?',radioServer:'Server',radioPhone:'Telefon',radioHideDone:'Ascunsă.',lastActive:'Ultima activitate',newId:'ID nou',deletePlayer:'🗑️ ȘTERGE JUCĂTORUL',deletePlayerConfirm:'Sigur ștergi definitiv acest jucător? Nu se poate anula.',deletePlayerDone:'Jucător șters.',saved:'Salvat.',reauth:'Sesiune expirată. Te rugăm să introduci din nou parola.'},en:{account:'ACCOUNT',create:'CREATE ACCOUNT',login:'LOGIN / RECOVERY',hint:'ID or Name + Password.',hintForgot:'Forgot your password? Send your ID + name to the administrator – they set a new password.',loginOk:'Logged in successfully.',name:'Name',id:'LXA ID',safe:'Password',newSafe:'New Password',save:'SAVE',logout:'LOG OUT',settings:'ACCOUNT SETTINGS',back:'BACK',leaderboard:'LEADERBOARD',your:'YOUR POSITION',empty:'No entries yet.',offline:'Online account is currently unavailable.',created:'Account created. Password is shown only now:',duplicate:'This name is already in use.',wrong:'Name or password is incorrect.',rtpAdmin:'WIN CHANCES (ADMIN)',rtpHint:'Target RTP % per difficulty (excl. WILD/jackpot).',rtpHintLinked:'Linked: the value is the TOTAL RTP % including WILD and jackpot, exact for the reference WILD level (higher levels pay more).',rtpLinkLabel:'RTP linked (total RTP, not only lines)',rtpRefLabel:'Reference WILD level',rtpLines:'Lines',rtpTotal:'Total',rtpSaved:'Chances saved.',rtpResetDone:'Reset to defaults.',rtpReset:'DEFAULT',simulateRtp:'🎲 REAL RTP',simulating:'Simulating…',noJackpot:'no jackpot',adminJackpot:'💀 JACKPOT',adminWild:'✨ WILD',adminPayouts:'💰 PAYOUTS',difficultyLabel:'Difficulty',jackpotFreqHint:'Jackpot frequency per difficulty.',jackpotFreqField:'Frequency (×)',wildHint:'Global WILD settings (all difficulties).',wildChanceField:'WILD base chance (%)',wildPerLevelField:'Increase per level (%)',wildCapField:'WILDs paid normally (per line)',wildCostMultField:'WILD upgrade cost (×)',extraWildFreqField:'Extra WILD frequency (×)',payoutHint:'Global win multipliers.',payoutMultField:'Payout multiplier (×)',jackpotValueField:'Jackpot value multiplier (×)',resetLeaderboard:'🏆 RESET LEADERBOARD',resetLeaderboardConfirm:'Really clear the whole leaderboard (all difficulties)? This cannot be undone.',resetLeaderboardDone:'Leaderboard reset.',adminCustom:'🎲 CUSTOM CHANCES',customOverride:'⚠️ Custom chances active, RTP target is ignored',customHint:'Values auto-normalize to 100%.',customSaved:'Chances saved.',wildPreviewUnit:'WILD/spin · LVL 50',adminPlayers:'👥 PLAYERS',adminRadio:'📻 STATION REPORTS',adminGroupGame:'🎰 GAME',adminGroupPlayers:'👥 PLAYERS &amp; LEADERBOARD',adminGroupRadio:'📻 RADIO',radioHint:'One row per station, ×N = how many times it was reported (🤖 automatic after a failure, 🚩 by hand). Nothing is hidden automatically. 🔍 tests the station now, 🙈 Hide removes it from every player\'s list (a few minutes, no deploy), 👁️ Show brings it back, 🗑️ deletes the reports.',radioHiddenTag:'HIDDEN',radioHideBtn:'Hide',radioShowBtn:'Show',radioReportedTimes:'number of reports',radioClearTitle:'Delete the reports',radioChecked:'Last check',radioStations:'stations',radioNone:'No reports.',radioDevices:'devices',radioHiddenTitle:'Hidden:',radioHiddenSince:'hidden for',radioDroppedTitle:'Removed by the check (dead):',radioDroppedAt:'removed',radioClearConfirm:'Delete the reports of this station?',radioServer:'Server',radioPhone:'Phone',radioHideDone:'Hidden.',lastActive:'Last active',newId:'New ID',deletePlayer:'🗑️ DELETE PLAYER',deletePlayerConfirm:'Really permanently delete this player? This cannot be undone.',deletePlayerDone:'Player deleted.',saved:'Saved.',reauth:'Session expired. Please enter your password again.'}};
const lxaCopy=()=>accountText[lang]||accountText.de;
const lxaEsc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// v149: 'spin' removed from this list per user request - after a page
// reload, lxaRestoreSession() logs the account back in silently (no
// password, V244) but never re-populates lxaSafeWord, so the very next
// spin used to trip this protected-action check and pop the login form
// open uninvited. Spin only touches the account's own balance (no
// bank/wild/identity change), so it no longer needs re-auth; the account
// menu must now ONLY ever open from the user's own click, per that request.
const LXA_PROTECTED_ACTIONS=['update','set-rtp-settings','reset-rtp-settings','set-custom-distribution','reset-leaderboard','list-players','admin-update-player','admin-delete-player','admin-radio'];
// v155 PWA FIX: fetch() had no timeout - if the PWA/tab is suspended by the
// OS mid-request (backgrounded phone, etc.) and the connection never
// formally errors, the awaited promise can hang forever. Since `spinning`
// (and every other in-flight guard in this file) only resets in a
// `finally` block AFTER this call resolves/rejects, a hung request left
// the spin button permanently disabled with no error shown, no way to
// recover short of a hard reload. AbortController forces a clean timeout
// so every existing catch/finally path (already correct, unchanged) runs
// as normal - this is a network-layer fix, not a gameplay/economy change;
// the server remains the sole authority either way.
// Normal play (spin, BANK, WILD, GELD, RESET, difficulty) is authorised by the per-device session token; the password is only kept on this device as the owner chose (lxa-safe-v1, see lxaSetSafe).
const LXA_TOKEN_ACTIONS=['spin','set-difficulty','deposit','reset-new-game','buy-wild','reset-geld'];
async function lxaRequest(action,data={}){if(LXA_PROTECTED_ACTIONS.includes(action)&&data.safeWord===undefined){if(!lxaSafeWord){renderAccountPanel('login');throw new Error(lxaCopy().reauth)}data={...data,safeWord:lxaSafeWord}}if(lxaToken&&data.token===undefined&&action!=='login')data={...data,token:lxaToken};if(LXA_TOKEN_ACTIONS.includes(action)&&!data.token&&data.safeWord===undefined&&!lxaSafeWord){renderAccountPanel('login');throw new Error('Session expired.')}const controller=new AbortController();const timeoutId=setTimeout(()=>controller.abort(),20000);let response;try{response=await fetch(LXA_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...data}),signal:controller.signal})}catch(error){throw new Error(error.name==='AbortError'?'Request timed out. Please try again.':'Network error. Please try again.')}finally{clearTimeout(timeoutId)}const body=await response.json().catch(()=>({error:'Server temporarily unavailable.'}));if(!response.ok){if(response.status===401&&LXA_PROTECTED_ACTIONS.includes(action)&&lxaSafeWord&&data.safeWord===lxaSafeWord)lxaSetSafe('');if(response.status===401&&LXA_TOKEN_ACTIONS.includes(action)){lxaSessionLost('401 on '+action);throw new Error('Session expired.')}throw new Error(body.error||'Request failed.')}return body}
function lxaStore(){if(lxaAccount)localStorage.setItem(LXA_CACHE,JSON.stringify(lxaAccount));else localStorage.removeItem(LXA_CACHE)}
async function lxaHydrate(account,token){lxaAccount=account;if(token)lxaSetToken(token);credits=Number(account.balance)||250;chance=Math.min(2,Math.max(0,Number(account.difficulty||2)-1));lxaLeaderboardLevel=chance+1;winStreak=Number(account.winStreak)||0;recordHits.splice(0,recordHits.length,...(account.records||[0,0,0,0,0]));completedLines.splice(0,completedLines.length,...(account.completedLines||[false,false,false,false,false]));missionFinished=Boolean(account.missionFinished);refresh();refreshChance();renderMission();lxaStore();renderLeaderboard()}
// v151: removed this lxaSaveState's body - it posted action:'save-state',
// which was never implemented server-side (every call silently 404'd into
// its own catch block). Provably dead: lxaSaveState is reassigned to a
// real, working implementation at its other definition further below
// (calls the real 'set-difficulty' action) before any user interaction can
// reach a caller, so that reassignment always wins in practice.
function lxaMoneyNumber(value){const raw=String(value||'').replace(/[^0-9,.-]/g,'');if(lang==='en')return Number(raw.replace(/,/g,''))||0;return Number(raw.replace(/\./g,'').replace(',','.'))||0}
function lxaCreatePanel(){const panel=document.createElement('section');panel.id='accountPanel';panel.className='account-panel';panel.hidden=true;document.body.appendChild(panel);return panel}
const accountPanel=lxaCreatePanel();
function renderAccountPanel(view='home',notice=''){const x=lxaCopy();const a=lxaAccount;let body='';const ADMIN_VIEWS=['admin','rtp-admin','jackpot-admin','wild-admin','payout-admin','players-admin','player-edit','custom-admin','radio-admin'];if(view==='create')body=`<form data-account-form="create"><label>${x.name}<input name="name" required minlength="2" maxlength="30" autocomplete="nickname"></label><button>${x.create}</button></form>`;else if(view==='login')body=`<form data-account-form="login"><p class="account-hint">${x.hint}</p><label>${x.id}<input name="id" type="number" min="1"></label><label>${x.name}<input name="name"></label><label>${x.safe}<input name="safeWord" type="password" autocomplete="current-password"></label><button>${x.login}</button></form>`;else if(view==='settings'&&a)body=`<form data-account-form="settings"><label>${x.name}<input name="name" value="${lxaEsc(a.name)}" required minlength="2" maxlength="30"></label><label>${x.safe}<input name="currentSafeWord" type="password" required maxlength="40" autocomplete="current-password"></label><label>${x.newSafe}<input name="newSafeWord" maxlength="40" autocomplete="new-password"></label><button>${x.save}</button></form>`;
else{
// v151 BUG FIX: this whole block (admin-view gating + every other body
// branch, including the 'home' summary/create-login buttons) used to be a
// SEPARATE, unconditional if/else-if chain instead of continuing the one
// above - so for view 'create'/'login'/'settings' it ran anyway after body
// was already set correctly, fell through every case down to its own final
// else, and silently overwrote body with the logged-out home buttons. That
// made the actual create-account and login forms (and the settings form)
// impossible to ever see, no matter who clicked them. Wrapping everything
// below in this else{} makes it mutually exclusive with the chain above,
// like it was clearly meant to be.
// v143/v148: admin hub (USERS deferred to a future session per user
// request) - RTP / JACKPOT frequency / WILD / PAYOUTS. Reached only from
// 'home' via the 👑 ADMIN button, itself only shown when isAdminAccount(a)
// is true. Settings are fetched ONCE on entering the hub (open-admin-hub
// below) and cached in lxaRtpCache; every sub-view below just reads that
// same cache, so switching between RTP/JACKPOT/WILD/PAYOUTS is instant.
if(ADMIN_VIEWS.includes(view)&&!(a&&isAdminAccount(a)))view='admin-denied';
// Admin hub, grouped by what the tool is about: the GAME (odds first, then what is paid, then the bonus features), the PLAYERS (list, then the destructive leaderboard reset last and marked), the RADIO.
if(view==='admin'){const group=(title,buttons)=>`<section class="admin-group"><h3 class="admin-group-title">${title}</h3><div class="account-actions">${buttons}</div></section>`;body=group(x.adminGroupGame,`<button type="button" data-view="rtp-admin">🎰 RTP</button><button type="button" data-view="custom-admin">${x.adminCustom}</button><button type="button" data-view="payout-admin">${x.adminPayouts}</button><button type="button" data-view="jackpot-admin">${x.adminJackpot}</button><button type="button" data-view="wild-admin">${x.adminWild}</button>`)+group(x.adminGroupPlayers,`<button type="button" data-account-action="open-players-admin">${x.adminPlayers}</button><button type="button" class="admin-danger" data-account-action="reset-leaderboard">${x.resetLeaderboard}</button>`)+group(x.adminGroupRadio,`<button type="button" data-account-action="open-radio-admin">${x.adminRadio}</button>`)}
else if(view==='players-admin'){const players=lxaPlayersCache||[];const fmt=ts=>ts?new Date(ts).toLocaleDateString(lang==='en'?'en-US':'de-DE'):'—';body=players.length?`<div class="account-players-list">${players.map(p=>`<div class="player-row"><span class="player-row-info"><b>#${lxaEsc(p.id)}</b> ${lxaEsc(p.name)}<small>${x.lastActive}: ${fmt(p.lastActive)}</small></span><span class="player-row-actions"><button type="button" data-account-action="edit-player" data-id="${p.id}">✏️</button><button type="button" data-account-action="delete-player" data-id="${p.id}">🗑️</button></span></div>`).join('')}</div>`:`<p class="account-notice">${x.empty}</p>`}
else if(view==='radio-admin'){const R=lxaRadioCache||{},reports=R.reports||[],hidden=R.hidden||[],dropped=R.dropped||[],ago=ts=>{if(!ts)return'—';const h=Math.round((Date.now()-ts)/36e5);return h<1?'<1h':h<48?h+'h':Math.round(h/24)+'d'},tally=o=>Object.entries(o||{}).map(([k,v])=>`${lxaEsc(k)}×${v}`).join(' '),test=key=>`<button type="button" data-account-action="radio-test" data-key="${key}">🔍</button>`,note=key=>`<small class="radio-test-out" data-key="${key}"></small>`,hideBtn=key=>`<button type="button" class="radio-textbtn" data-account-action="radio-hide" data-key="${key}">🙈 ${x.radioHideBtn}</button>`,showBtn=key=>`<button type="button" class="radio-textbtn radio-show" data-account-action="radio-unhide" data-key="${key}">👁️ ${x.radioShowBtn}</button>`;
const reportRow=r=>`<div class="player-row radio-report${r.hidden?' is-hidden':''}"><span class="player-row-info"><b>${lxaEsc(r.n||'?')} <span class="radio-badge" title="${x.radioReportedTimes}">×${r.count}</span>${r.hidden?` <span class="radio-hidden-tag">${x.radioHiddenTag}</span>`:''}</b><small>${r.c?lxaEsc(r.c)+' · ':''}${r.devices} ${x.radioDevices} (${r.auto}🤖 ${r.manual}🚩) · ${ago(r.last)}</small><small>${tally(r.codes)} · ${tally(r.plats)}${r.lastMs?' · '+Math.round(r.lastMs/1000)+'s':''}</small>${note(r.key)}</span><span class="player-row-actions">${test(r.key)}${r.hidden?showBtn(r.key):hideBtn(r.key)}<button type="button" data-account-action="radio-clear" data-key="${r.key}" title="${x.radioClearTitle}">🗑️</button></span></div>`;
const hiddenOnly=hidden.filter(h=>!reports.some(r=>r.key===h.key)),hiddenRow=h=>`<div class="player-row radio-report is-hidden"><span class="player-row-info"><b>${lxaEsc(h.n||'?')} <span class="radio-hidden-tag">${x.radioHiddenTag}</span></b><small>${x.radioHiddenSince} ${ago(h.at)}</small>${note(h.key)}</span><span class="player-row-actions">${test(h.key)}${showBtn(h.key)}</span></div>`,droppedRow=d=>`<div class="player-row radio-report"><span class="player-row-info"><b>${lxaEsc(d.n||'?')}</b><small>${x.radioDroppedAt} ${ago(d.at)}</small>${note(d.key)}</span><span class="player-row-actions">${test(d.key)}</span></div>`;
body=`<p class="account-hint">${x.radioHint}</p><p class="account-hint">${x.radioChecked}: ${ago(R.checkedAt)} · ${R.stations||0} ${x.radioStations}</p>${reports.length?`<div class="account-players-list">${reports.map(reportRow).join('')}</div>`:`<p class="account-notice">${x.radioNone}</p>`}${hiddenOnly.length?`<p class="account-hint">${x.radioHiddenTitle}</p><div class="account-players-list">${hiddenOnly.map(hiddenRow).join('')}</div>`:''}${dropped.length?`<p class="account-hint">${x.radioDroppedTitle}</p><div class="account-players-list">${dropped.map(droppedRow).join('')}</div>`:''}`}
else if(view==='player-edit'){const p=(lxaPlayersCache||[]).find(pl=>Number(pl.id)===Number(lxaEditPlayerId));body=p?`<form data-account-form="player-edit"><label>${x.newId}<input name="newId" type="number" min="1" value="${p.id}"></label><label>${x.name}<input name="newName" value="${lxaEsc(p.name)}" minlength="2" maxlength="30"></label><label>${x.newSafe}<input name="newSafeWord" maxlength="40" placeholder="••••••"></label><button>${x.save}</button></form><button type="button" class="account-back" data-account-action="delete-player" data-id="${p.id}">${x.deletePlayer}</button>`:`<p class="account-notice">${x.wrong}</p>`}
else if(view==='rtp-admin'){const s=lxaRtpCache?.settings||{},d=lxaRtpCache?.defaults?.rtp||{},val=n=>{const v=s[n]??s[String(n)]??d[n];return v===undefined||v===''?'':Math.round(v*10)/10;},b=lxaRtpCache?.bounds?.rtp||{min:50,max:300};const cdActive=[1,2,3].filter(n=>lxaRtpCache?.customDistribution?.[n]),cdNames={1:'SWEET',2:'SPICY',3:'BRUTAL'};const cmp=lxaRtpCache?.computed||{},computedHtml=[1,2,3].filter(n=>cmp[n]).map(n=>`<p class="account-hint">${cdNames[n]}: ${x.rtpLines} ${Number(cmp[n].lineRtp).toFixed(1)}% · ${x.rtpTotal} ${Number(cmp[n].totalRtp).toFixed(1)}% · WILD 0: ${Number(cmp[n].totalRtp0).toFixed(1)}% · WILD 50: ${Number(cmp[n].totalRtpMax).toFixed(1)}%</p>`).join('');body=`<p class="account-hint">${s.rtpLinked===true?x.rtpHintLinked:x.rtpHint}</p>${cdActive.length?`<p class="account-notice">${x.customOverride} (${cdActive.map(n=>cdNames[n]).join(', ')})</p>`:''}<form data-account-form="rtp-admin" class="account-rtp-form"><label>SWEET 🍯<input name="1" type="number" step="0.1" min="${b.min}" max="${b.max}" value="${val(1)}" placeholder="${d[1]?d[1].toFixed(1):''}"></label><label>SPICY 🌶️<input name="2" type="number" step="0.1" min="${b.min}" max="${b.max}" value="${val(2)}" placeholder="${d[2]?d[2].toFixed(1):''}"></label><label>BRUTAL 💀<input name="3" type="number" step="0.1" min="${b.min}" max="${b.max}" value="${val(3)}" placeholder="${d[3]?d[3].toFixed(1):''}"></label><label class="account-check"><input type="checkbox" name="rtpLinked" ${s.rtpLinked===true?'checked':''}> <span>${x.rtpLinkLabel}</span></label><label>${x.rtpRefLabel}<input name="rtpRefLevel" type="number" step="1" min="0" max="50" value="${Number(s.rtpRefLevel)||0}"></label><button>${x.save}</button></form>${computedHtml}<button type="button" class="account-back" data-account-action="reset-admin" data-scope="rtp">${x.rtpReset}</button><button type="button" data-account-action="simulate-rtp">${x.simulateRtp}</button><div class="account-notice" id="rtpSimResult"></div>`}
else if(view==='custom-admin'){const cur=lxaRtpCache?.currentDistribution?.[1]||{},f=(k,l)=>`<label>${l}<input name="b${k}" type="number" step="0.1" min="0" value="${cur[k]??''}"></label>`;body=`<p class="account-hint">${x.customHint}</p><form data-account-form="custom-admin" class="account-rtp-form"><label>${x.difficultyLabel}<select name="difficulty"><option value="1">SWEET 🍯</option><option value="2">SPICY 🌶️</option><option value="3">BRUTAL 💀</option></select></label>${f(0,'0/10')}${f(3,'3/10')}${f(4,'4/10')}${f(5,'5/10')}${f(6,'6/10')}${f(7,'7/10')}${f(8,'8/10')}${f(9,'9/10')}${f(10,'10/10')}<button>${x.save}</button></form><button type="button" class="account-back" data-account-action="reset-custom">${x.rtpReset}</button>`}
else if(view==='jackpot-admin'){const freq=lxaRtpCache?.settings?.jackpotFreq||{},b=lxaRtpCache?.bounds?.jackpotFreq||{min:0.2,max:5},cur=Math.round((freq[1]??1)*10)/10;body=`<p class="account-hint">${x.jackpotFreqHint}</p><form data-account-form="jackpot-admin" class="account-rtp-form"><label>${x.difficultyLabel}<select name="difficulty"><option value="1">SWEET 🍯</option><option value="2">SPICY 🌶️</option><option value="3">BRUTAL 💀</option></select></label><label>${x.jackpotFreqField}<input name="multiplier" type="number" step="0.1" min="${b.min}" max="${b.max}" value="${cur}"></label><button>${x.save}</button></form><button type="button" class="account-back" data-account-action="reset-admin" data-scope="jackpotFreq">${x.rtpReset}</button>`}
else if(view==='wild-admin'){const s=lxaRtpCache?.settings||{},d=lxaRtpCache?.defaults||{},b=lxaRtpCache?.bounds||{};body=`<p class="account-hint">${x.wildHint}</p><form data-account-form="wild-admin" class="account-rtp-form"><label>${x.wildChanceField}<input name="wildChance" type="number" step="0.1" min="0" max="100" value="${s.wildChance??d.wildChance??''}"></label><label>${x.wildPerLevelField}<input name="wildPerLevel" type="number" step="0.01" min="0" max="5" value="${s.wildPerLevel??d.wildPerLevel??''}"></label><label>${x.extraWildFreqField}<input name="extraWildFreq" type="number" step="0.1" min="${(b.extraWildFreq||{}).min||0.2}" max="${(b.extraWildFreq||{}).max||5}" value="${s.extraWildFreq??d.extraWildFreq??1}"><small id="extraWildPreview">≈${Math.min(50,Math.round(2.47*Number(s.extraWildFreq??d.extraWildFreq??1)))} ${x.wildPreviewUnit}</small></label><label>${x.wildCapField}<input name="wildCap" type="number" step="1" min="${(b.wildCap||{}).min||1}" max="${(b.wildCap||{}).max||10}" value="${s.wildCap??d.wildCap??''}"></label><label>${x.wildCostMultField}<input name="wildCostMult" type="number" step="0.1" min="${(b.wildCostMult||{}).min||0.2}" max="${(b.wildCostMult||{}).max||5}" value="${s.wildCostMult??d.wildCostMult??1}"></label><button>${x.save}</button></form><button type="button" class="account-back" data-account-action="reset-admin" data-scope="wild">${x.rtpReset}</button>`}
else if(view==='payout-admin'){const s=lxaRtpCache?.settings||{},b=lxaRtpCache?.bounds||{};body=`<p class="account-hint">${x.payoutHint}</p><form data-account-form="payout-admin" class="account-rtp-form"><label>${x.payoutMultField}<input name="payoutMult" type="number" step="0.1" min="${(b.payoutMult||{}).min||0.2}" max="${(b.payoutMult||{}).max||5}" value="${s.payoutMult??1}"></label><label>${x.jackpotValueField}<input name="jackpotValueMult" type="number" step="0.1" min="${(b.jackpotValueMult||{}).min||0.2}" max="${(b.jackpotValueMult||{}).max||10}" value="${s.jackpotValueMult??1}"></label><button>${x.save}</button></form><button type="button" class="account-back" data-account-action="reset-admin" data-scope="payout">${x.rtpReset}</button>`}
else if(view==='admin-denied')body=`<p class="account-notice">${x.wrong}</p>`;
else if(a)body=`<div class="account-summary"><div class="account-summary-row"><span>${x.id}</span><strong>#${lxaEsc(a.id)}</strong></div><div class="account-summary-row"><span>${x.name}</span><strong>${lxaEsc(a.name)}</strong></div><div class="account-summary-row account-safe-row"><span>${x.safe}</span>${lxaSafeWord?`<span class="account-safe-value-wrap"><strong class="account-safe-value" data-safe-hidden="0">${lxaEsc(lxaSafeWord)}</strong><button type="button" class="account-safe-toggle" data-account-action="toggle-safe" aria-label="hide/show">👁️</button></span>`:`<form data-account-form="reauth" class="account-safe-form"><input name="safeWord" type="password" required maxlength="40" autocomplete="current-password" placeholder="—" aria-label="${x.safe}"><button>OK</button></form>`}</div></div><div class="account-actions"><button data-view="settings">${x.settings}</button>${isAdminAccount(a)?`<button type="button" data-account-action="open-admin-hub">👑 ADMIN</button>`:''}<button data-account-action="logout">${x.logout}</button></div>`;else body=`<div class="account-actions"><button data-view="create">${x.create}</button><button data-view="login">${x.login}</button></div>`;
}
const heading=ADMIN_VIEWS.includes(view)?'👑 ADMIN PANEL':x.account;
const backTarget=view==='admin'?'home':(view==='player-edit'?'players-admin':(ADMIN_VIEWS.includes(view)?'admin':'home'));
accountPanel.innerHTML=`<div class="account-panel-card"><button class="account-close" data-account-action="close" aria-label="Close">×</button><h2>${heading}</h2>${notice?`<p class="account-notice">${lxaEsc(notice)}</p>`:''}${body}${view!=='home'?`<button class="account-back" data-view="${backTarget}">${x.back}</button>`:''}</div>`;accountPanel.hidden=false;accountPanel.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>renderAccountPanel(button.dataset.view));accountPanel.querySelector('[data-account-action="close"]')?.addEventListener('click',()=>{accountPanel.hidden=true});lxaBindDiag();accountPanel.querySelector('[data-account-action="logout"]')?.addEventListener('click',()=>{const revokeId=lxaAccount&&lxaAccount.id,revokeToken=lxaToken;lxaAuthLog('logout by user');lxaInvalidateGame();lxaAccount=null;lxaSafeWord='';lxaClearToken();lxaStore();accountPanel.hidden=true;renderLeaderboard();if(revokeId&&revokeToken)lxaSendLogout(revokeId,revokeToken)});
accountPanel.querySelector('[data-account-action="open-admin-hub"]')?.addEventListener('click',async()=>{try{lxaRtpCache=await lxaRequest('get-rtp-settings',{})}catch{lxaRtpCache=null}renderAccountPanel('admin')});
accountPanel.querySelector('[data-account-action="reset-admin"]')?.addEventListener('click',async event=>{const scope=event.currentTarget.dataset.scope;try{await lxaRequest('reset-rtp-settings',{id:lxaAccount.id,scope});lxaRtpCache=await lxaRequest('get-rtp-settings',{});renderAccountPanel(view,x.rtpResetDone)}catch(error){renderAccountPanel(view,error.message)}});
// v152: on-demand Monte Carlo estimate (line+WILD, real random draws via
// the already-loaded engine, no new deps) - the admin RTP field alone only
// ever showed the line-only expectation (see rtpHint), this shows what a
// player actually nets including WILD. Jackpot excluded on purpose (rare,
// needs multi-spin progression to simulate properly) and said so, short.
accountPanel.querySelector('[data-account-action="simulate-rtp"]')?.addEventListener('click',()=>{const g=window.LxaGameEngine,out=accountPanel.querySelector('#rtpSimResult');if(!g||!out)return;out.textContent=x.simulating;setTimeout(()=>{const trials=3000,bet=5,pct=d=>{let paid=0;for(let i=0;i<trials;i++){const res=Array.from({length:5},()=>g.selectLineResult(d));const w=g.applyWild(res,Math.random,0);paid+=w.paytableResults.reduce((s,h)=>s+(bet/5)*(g.PAYTABLE[h]||0),0)}return Math.round(paid/(trials*bet)*1000)/10};out.textContent=`🍯${pct(1)}% · 🌶️${pct(2)}% · 💀${pct(3)}% (${x.noJackpot})`},10)});
accountPanel.querySelector('[data-account-action="reset-leaderboard"]')?.addEventListener('click',async()=>{if(!await lxaConfirm(x.resetLeaderboardConfirm))return;try{await lxaRequest('reset-leaderboard',{id:lxaAccount.id});renderAccountPanel('admin',x.resetLeaderboardDone)}catch(error){renderAccountPanel('admin',error.message)}});
accountPanel.querySelector('[data-account-action="open-players-admin"]')?.addEventListener('click',async()=>{try{lxaPlayersCache=(await lxaRequest('list-players',{id:lxaAccount.id})).players||[]}catch(error){renderAccountPanel('admin',error.message);return}renderAccountPanel('players-admin')});
accountPanel.querySelector('[data-account-action="open-radio-admin"]')?.addEventListener('click',async()=>{try{lxaRadioCache=await lxaRequest('admin-radio',{id:lxaAccount.id,op:'list'})}catch(error){renderAccountPanel('admin',error.message);return}renderAccountPanel('radio-admin')});
accountPanel.querySelectorAll('[data-account-action^="radio-"]').forEach(button=>button.addEventListener('click',async()=>{const op=button.dataset.accountAction.slice(6),key=button.dataset.key;if(op==='clear'&&!await lxaConfirm(x.radioClearConfirm))return;try{if(op==='test'){const out=accountPanel.querySelector(`.radio-test-out[data-key="${key}"]`);if(out)out.textContent='…';const r=(await lxaRequest('admin-radio',{id:lxaAccount.id,op:'test',key})).test,f=p=>p.ok?`✅ ${p.ms} ms`:`❌ ${p.why}`;if(out)out.textContent=`${x.radioServer} ${f(r.server)} · ${x.radioPhone} ${f(r.phone)}`;return}await lxaRequest('admin-radio',{id:lxaAccount.id,op,key});lxaRadioCache=await lxaRequest('admin-radio',{id:lxaAccount.id,op:'list'});renderAccountPanel('radio-admin',op==='hide'?x.radioHideDone:'')}catch(error){renderAccountPanel('radio-admin',error.message)}}));
accountPanel.querySelectorAll('[data-account-action="edit-player"]').forEach(button=>button.addEventListener('click',()=>{lxaEditPlayerId=Number(button.dataset.id);renderAccountPanel('player-edit')}));
accountPanel.querySelectorAll('[data-account-action="delete-player"]').forEach(button=>button.addEventListener('click',async()=>{const id=Number(button.dataset.id);if(!await lxaConfirm(x.deletePlayerConfirm))return;try{await lxaRequest('admin-delete-player',{id:lxaAccount.id,playerId:id});lxaPlayersCache=(lxaPlayersCache||[]).filter(p=>Number(p.id)!==id);renderAccountPanel('players-admin',x.deletePlayerDone)}catch(error){renderAccountPanel(view,error.message)}}));
accountPanel.querySelector('select[name="difficulty"]')?.addEventListener('change',event=>{const freq=lxaRtpCache?.settings?.jackpotFreq||{},d=event.target.value,input=accountPanel.querySelector('input[name="multiplier"]');if(input)input.value=Math.round((freq[d]??1)*10)/10;if(accountPanel.querySelector('form')?.dataset.accountForm==='custom-admin'){const cur=lxaRtpCache?.currentDistribution?.[d]||{};[0,3,4,5,6,7,8,9,10].forEach(k=>{const el=accountPanel.querySelector(`input[name="b${k}"]`);if(el)el.value=cur[k]??''})}});
accountPanel.querySelector('[data-account-action="reset-custom"]')?.addEventListener('click',async()=>{const d=accountPanel.querySelector('select[name="difficulty"]')?.value||1;try{await lxaRequest('reset-rtp-settings',{id:lxaAccount.id,scope:'customDistribution',scopeDifficulty:d});lxaRtpCache=await lxaRequest('get-rtp-settings',{});renderAccountPanel('custom-admin',x.rtpResetDone)}catch(error){renderAccountPanel('custom-admin',error.message)}});
accountPanel.querySelector('input[name="extraWildFreq"]')?.addEventListener('input',event=>{const preview=accountPanel.querySelector('#extraWildPreview');if(preview)preview.textContent=`≈${Math.min(50,Math.round(2.47*(Number(event.target.value)||1)))} ${x.wildPreviewUnit}`});
accountPanel.querySelector('[data-account-action="toggle-safe"]')?.addEventListener('click',()=>{const valueEl=accountPanel.querySelector('.account-safe-value'),toggleBtn=accountPanel.querySelector('.account-safe-toggle');if(!valueEl)return;const hidden=valueEl.dataset.safeHidden==='1';valueEl.dataset.safeHidden=hidden?'0':'1';valueEl.textContent=hidden?lxaSafeWord:'•'.repeat(Math.max(6,lxaSafeWord.length));if(toggleBtn)toggleBtn.textContent=hidden?'👁️':'🙈'});const form=accountPanel.querySelector('form');if(form)form.onsubmit=async event=>{event.preventDefault();const data=Object.fromEntries(new FormData(form));const action=form.dataset.accountForm;try{if(action==='create'){const result=await lxaRequest('create',{name:data.name});lxaSetSafe(result.safeWord||'');lxaHydrate(result.account,result.token);renderAccountPanel('home',`${x.created} ${lxaSafeWord}`)}else if(action==='login'){
  // v151: self-service "id+name, no password" recovery was removed (see
  // server-side note on the deleted 'reset-safeword' action) - id+password
  // and name+password are now the only two ways in. A forgotten password
  // goes through the site admin (Admin Panel > PLAYERS > edit) instead.
  const id=String(data.id||'').trim(),name=String(data.name||'').trim(),safeWord=String(data.safeWord||'').trim();
  if(id&&safeWord){const result=await lxaRequest('login',{id,safeWord});lxaSetSafe(safeWord);lxaHydrate(result.account,result.token);renderAccountPanel('home',x.loginOk)}
  else if(name&&safeWord){const result=await lxaRequest('login',{name,safeWord});lxaSetSafe(safeWord);lxaHydrate(result.account,result.token);renderAccountPanel('home',x.loginOk)}
  
  else{throw new Error(x.hint)}
}else if(action==='reauth'){const safeWord=String(data.safeWord||'').trim();if(!safeWord)throw new Error(x.hint);const result=await lxaRequest('login',{id:lxaAccount.id,safeWord});lxaSetSafe(safeWord);lxaHydrate(result.account,result.token);renderAccountPanel('home',x.loginOk)}else if(action==='settings'){const result=await lxaRequest('update',{id:lxaAccount.id,name:data.name,safeWord:data.currentSafeWord,newSafeWord:data.newSafeWord});lxaSetSafe((data.newSafeWord||data.currentSafeWord).trim());lxaHydrate(result.account,result.token)}else if(action==='rtp-admin'){const payload={id:lxaAccount.id};[1,2,3].forEach(n=>{const raw=String(data[n]||'').trim();if(raw!=='')payload[n]=raw});payload.rtpLinked=data.rtpLinked?'true':'false';payload.rtpRefLevel=String(data.rtpRefLevel||0);const result=await lxaRequest('set-rtp-settings',payload);lxaRtpCache={settings:result.settings,computed:result.computed,defaults:lxaRtpCache?.defaults,bounds:lxaRtpCache?.bounds,customDistribution:lxaRtpCache?.customDistribution};renderAccountPanel('rtp-admin',x.rtpSaved)}else if(action==='jackpot-admin'){const payload={id:lxaAccount.id};payload[`jackpotFreq${data.difficulty}`]=data.multiplier;const result=await lxaRequest('set-rtp-settings',payload);lxaRtpCache={settings:result.settings,defaults:lxaRtpCache?.defaults,bounds:lxaRtpCache?.bounds};renderAccountPanel('jackpot-admin',x.rtpSaved)}else if(action==='wild-admin'){const payload={id:lxaAccount.id,wildChance:data.wildChance,wildPerLevel:data.wildPerLevel,wildCap:data.wildCap,wildCostMult:data.wildCostMult,extraWildFreq:data.extraWildFreq};const result=await lxaRequest('set-rtp-settings',payload);lxaRtpCache={settings:result.settings,defaults:lxaRtpCache?.defaults,bounds:lxaRtpCache?.bounds};renderAccountPanel('wild-admin',x.rtpSaved)}else if(action==='payout-admin'){const payload={id:lxaAccount.id,payoutMult:data.payoutMult,jackpotValueMult:data.jackpotValueMult};const result=await lxaRequest('set-rtp-settings',payload);lxaRtpCache={settings:result.settings,defaults:lxaRtpCache?.defaults,bounds:lxaRtpCache?.bounds};renderAccountPanel('payout-admin',x.rtpSaved)}else if(action==='custom-admin'){const buckets={};[0,3,4,5,6,7,8,9,10].forEach(k=>buckets[k]=data[`b${k}`]);const result=await lxaRequest('set-custom-distribution',{id:lxaAccount.id,difficulty:data.difficulty,buckets});lxaRtpCache=await lxaRequest('get-rtp-settings',{});renderAccountPanel('custom-admin',x.customSaved)}else if(action==='player-edit'){const payload={id:lxaAccount.id,playerId:lxaEditPlayerId};const newId=String(data.newId||'').trim();if(newId&&Number(newId)!==lxaEditPlayerId)payload.newId=newId;const newName=String(data.newName||'').trim();if(newName)payload.newName=newName;const newSafeWord=String(data.newSafeWord||'').trim();if(newSafeWord)payload.newSafeWord=newSafeWord;const result=await lxaRequest('admin-update-player',payload);lxaPlayersCache=(lxaPlayersCache||[]).map(p=>Number(p.id)===lxaEditPlayerId?result.player:p);lxaEditPlayerId=result.player.id;renderAccountPanel('player-edit',x.saved)}}catch(error){renderAccountPanel(view,error.message)}}}
function lxaSetupAccountButton(){const host=document.querySelector('#headerActions')||document.querySelector('.topbar');if(!host||document.querySelector('#accountButton'))return;const button=document.createElement('button');button.id='accountButton';button.className='account-button';button.type='button';button.textContent='🎫';button.title=accountText.de.account;button.onclick=()=>renderAccountPanel('home');host.prepend(button)}
function lxaSetupLeaderboard(){const bottomGrid=document.querySelector('.bottom-grid');if(!bottomGrid||document.querySelector('#leaderboardPanel'))return;const panel=document.createElement('section');panel.id='leaderboardPanel';panel.className='leaderboard-panel';panel.innerHTML='<div class="leaderboard-head"><span id="leaderboardTitle"></span><small id="leaderboardDifficulty"></small></div><nav id="leaderboardTabs" class="leaderboard-tabs" aria-label="Difficulty leaderboard"></nav><ol id="leaderboardRows" class="leaderboard-rows"></ol><p id="leaderboardHint" class="leaderboard-hint"></p><div id="leaderboardPosition" class="leaderboard-position"></div>';bottomGrid.parentNode.insertBefore(panel,bottomGrid);document.querySelector('#chance').addEventListener('input',()=>{lxaLeaderboardLevel=chance+1;renderLeaderboard()})}
async function renderLeaderboard(){lxaSetupLeaderboard();const x=lxaCopy(),level=chance+1;const title=document.querySelector('#leaderboardTitle'),difficulty=document.querySelector('#leaderboardDifficulty'),tabs=document.querySelector('#leaderboardTabs'),rows=document.querySelector('#leaderboardRows'),position=document.querySelector('#leaderboardPosition');if(!title||!tabs)return;title.textContent=x.leaderboard;difficulty.textContent=`${level}/7`;tabs.innerHTML=Array.from({length:7},(_,i)=>`<button class="${i+1===level?'active':''}" data-level="${i+1}">${i+1}/7</button>`).join('');tabs.querySelectorAll('button').forEach(tab=>tab.onclick=()=>{chance=Number(tab.dataset.level)-1;refreshChance();renderLeaderboard();lxaSaveState()});rows.innerHTML=`<li class="leaderboard-loading">…</li>`;try{const query=new URLSearchParams({action:'leaderboard',difficulty:String(level)});if(lxaAccount)query.set('id',String(lxaAccount.id));const response=await fetch(`${LXA_API}?${query}`);const data=await response.json();if(!response.ok)throw new Error(data.error);rows.innerHTML=data.records?.length?data.records.map((record,i)=>`<li><b>${i+1}</b><span>${lxaEsc(record.name)}</span><strong>${Number(record.score||0).toLocaleString(lang==='en'?'en-US':'de-DE')}</strong></li>`).join(''):`<li class="leaderboard-empty">${x.empty}</li>`;position.textContent=lxaAccount&&data.yourPosition?`${x.your}: #${data.yourPosition}`:''}catch(error){rows.innerHTML=`<li class="leaderboard-empty">${x.offline}</li>`;position.textContent=''}}
// v244: called once on page load. Restores the account visually using only
// the cached id (the password, if remembered, comes from lxa-safe-v1, see lxaSetSafe) via
// the backend's 'silent' login mode. If the network call fails (offline,
// server hiccup) we fall back to the last cached account object so the user
// still sees their name/balance instead of looking logged out; lxaSaveState
// will reconcile with the server again on the next protected action.
async function lxaRestoreSession(){lxaRequestPersist();const cached=JSON.parse(localStorage.getItem(LXA_CACHE)||'null'),cachedId=cached&&cached.id;let pending=null;try{pending=JSON.parse(localStorage.getItem(LXA_PENDING_LOGOUT_KEY)||'null')}catch{}if(pending&&pending.id&&pending.token&&!lxaToken){const done=await lxaSendLogout(pending.id,pending.token);lxaAuthLog('finished a logout that could not reach the server',{done});if(!done)return}if(!lxaToken){try{const result=await lxaRequest('login',{silent:true});if(result&&result.token&&result.account){lxaAuthLog('token restored from the server cookie',{cache:!!cachedId,seenBefore:lxaWasSeen()});lxaSetToken(result.token);lxaHydrate(result.account);try{localStorage.setItem(LXA_LAST_RESTORE_KEY,new Date().toISOString())}catch{}return}}catch{}if(cachedId||lxaWasSeen()){lxaAuthLog('no token at start',{cache:!!cachedId,seenBefore:lxaWasSeen()});lxaMarkSeen(false)}if(cachedId){lxaAccount=null;lxaStore()}return}try{lxaSafeWord=localStorage.getItem(LXA_SAFE_KEY)||''}catch{}const attempt=id=>lxaRequest('login',id?{id,silent:true,token:lxaToken}:{silent:true,token:lxaToken});const expired=error=>/session expired|not found/i.test(error.message||'');try{let result;try{result=await attempt(cachedId)}catch(error){if(cachedId&&/not found/i.test(error.message||''))result=await attempt(null);else throw error}lxaHydrate(result.account);try{localStorage.setItem(LXA_LAST_RESTORE_KEY,new Date().toISOString())}catch{}}catch(error){if(expired(error)){lxaSessionLost('restore: '+error.message);return}if(cachedId)lxaHydrate({...cached,role:undefined});setTimeout(()=>{if(lxaToken)attempt(lxaAccount&&lxaAccount.id).then(res=>lxaHydrate(res.account)).catch(err=>{if(expired(err))lxaSessionLost('restore retry: '+err.message)})},4000)}}
lxaSetupAccountButton();lxaSetupLeaderboard();renderAccountPanel('home');accountPanel.hidden=true;renderLeaderboard();lxaRestoreSession();
// v151: removed a dead $('#spin').onclick wrapper (V76-era stat tracking +
// a call to the also-removed lxaSaveState()) - superseded by the v79
// deterministic game layer's own onclick assignment further below, which
// always wins since plain .onclick= overwrites rather than stacks.
// Local demo mode is authoritative in V84. Do not restore the legacy Netlify
// account cache here; it used to overwrite the local balance after page load.

/* V76: account operations and authoritative server spin */
function lxaSyncMoney(account){
  if(!account)return;
  const bankNode=$('#bank');
  if(bankNode)bankNode.textContent=money(Number(account.bank)||0);
  const buy=$('#buyWild');if(buy){const max=Number(account.wildInventory)>=50;buy.disabled=max;buy.title=max?'MAX WILD BONUS':'WILD BONUS';}
}
const lxaHydrateV76=lxaHydrate;
lxaHydrate=function(account,token){lxaHydrateV76(account,token);lxaSyncMoney(account);};
const lxaSetDifficultyV76=async level=>{if(!lxaAccount)return;try{const result=await lxaRequest('set-difficulty',{id:lxaAccount.id,difficulty:level,token:lxaToken});lxaHydrate(result.account)}catch(error){if($('#message'))$('#message').textContent=error.message}};
// v152: removed lxaOpenDeposit/lxaBuyWild + their addEventListener
// bindings - both fully unreachable (the v79 layer's capture-phase
// listeners on the same buttons always run first and call
// stopImmediatePropagation(), see openLocalMoneyPanel/buyWildDirectly
// below). This is exactly why the real server calls they made were never
// happening for logged-in accounts - their correct logic is now ported
// into the handlers that actually run.
// v151: removed lxaAccountSpinV76 (V76-era server-spin handler) and its
// $('#spin').onclick wiring - both were dead code. The v79 deterministic
// game layer below reassigns $('#spin').onclick of its own (last one wins,
// plain .onclick= always overwrites), via lxaAccountResolveSpin(), which
// is the real, currently-active authoritative spin path for logged-in
// accounts. Confirmed unreachable: nothing else called lxaAccountSpinV76
// or lxaOriginalSpin by name.
// v152: removed a wrapper around renderAccountPanel that only ever
// special-cased views 'deposit'/'buy-wild' (old modal-style BANK/BUY WILD
// screens) - both views are now unreachable (nothing calls
// renderAccountPanel('deposit') or ('buy-wild') anymore; openLocalMoneyPanel
// and buyWildDirectly own those flows via their own inline panels/forms).
// renderAccountPanel is simply the original function again.
document.querySelector('#leaderboardTabs')?.addEventListener('click',event=>{const tab=event.target.closest('button');if(tab&&lxaAccount)lxaSetDifficultyV76(tab.dataset.level)});

/* v79 deterministic game layer. It supersedes only the legacy spin maths;
   layout, animations, account drawer and V78 visual identity remain intact. */
(() => {
  const game = window.LxaGameEngine;
  if (!game) return;
  // v142: mirror any admin-set RTP into this local game instance too, so
  // guest spins (which call game.resolveSpin() directly, never touching the
  // backend) use the same odds as logged-in players. Fire-and-forget - if
  // the request fails (offline, static preview with no functions), guests
  // just keep game-engine.js's own defaults, same as before this existed.
  (async () => {
    try {
      const result = await lxaRequest('get-rtp-settings', {});
      const settings = result.settings || {};
      [1, 2, 3].forEach(d => {
        const raw = settings[d] ?? settings[String(d)];
        if (raw !== undefined && Number.isFinite(Number(raw))) game.setDifficultyRtp(d, Number(raw));
      });
      // v152: this used to only mirror RTP-per-difficulty - none of the WILD
      // admin knobs (base chance, per-level, cap, cost, extra-frequency) ever
      // reached guest play, only logged-in accounts (server applies them
      // before every spin). Guests never noticed since there was no visible
      // error, they just silently kept game-engine.js's own defaults forever.
      if (settings.wildChance !== undefined && Number.isFinite(Number(settings.wildChance))) game.setWildChancePercent(Number(settings.wildChance));
      if (settings.wildPerLevel !== undefined && Number.isFinite(Number(settings.wildPerLevel))) game.setWildPerLevelPercent(Number(settings.wildPerLevel));
      if (settings.wildCap !== undefined && Number.isFinite(Number(settings.wildCap))) game.setWildCap(Number(settings.wildCap));
      if (settings.wildCostMult !== undefined && Number.isFinite(Number(settings.wildCostMult))) game.setWildCostMultiplier(Number(settings.wildCostMult));
      if (settings.extraWildFreq !== undefined && Number.isFinite(Number(settings.extraWildFreq))) game.setExtraWildFrequency(Number(settings.extraWildFreq));
      // v157 BUG FIX: Custom Win Chances (per-bucket override, set via the
      // admin panel) was never mirrored here either - same class of bug as
      // the WILD knobs above. Guests (and the 🎲 RTP simulator, which reads
      // this same local engine instance) silently kept the RTP-target-driven
      // distribution even when an admin had set an explicit custom one for
      // that difficulty - no error, just quietly wrong/inconsistent with
      // what logged-in players actually experienced.
      const customDistribution = settings.customDistribution || {};
      [1, 2, 3].forEach(d => {
        const buckets = customDistribution[d] ?? customDistribution[String(d)];
        if (buckets) game.setCustomDistribution(d, buckets);
      });
      // the same shared function the server runs before every spin: every knob in the right order, jackpot/payout multipliers included,
      // and the connected (total) RTP mode - so guest play and logged-in play can no longer drift apart
      game.applyAdminSettings(settings);
    } catch {}
  })();
  // V96 returns SPIN to the centre of the control row: balance, stake, SPIN,
  // last win, actions. It is no longer a separate band above the reels.
  const controlsBar = $('.controls'), spinButton = $('#spin');
  if (controlsBar && spinButton && !controlsBar.querySelector('.spin-stat')) {
    const slot = document.createElement('div');
    slot.className = 'stat spin-stat';
    slot.append(spinButton);
    controlsBar.insertBefore(slot, controlsBar.querySelector('.stat:nth-of-type(3)'));
  }
  const missionGoal = $('#missionGoal');
  if (missionGoal) missionGoal.textContent = T118('goal');
  // v80 deliberately starts a clean demo state; v79 may contain runaway bets.
  // Each desktop build owns its own demo save so a previous experimental build
  // can never silently overwrite the balance or visual state of this one.
  const STORAGE_KEY = 'lxa-v107-game-state';
  const LEGACY_STORAGE_KEYS = ['lxa-v106-game-state', 'lxa-v105-game-state', 'lxa-v104-game-state', 'lxa-v103-game-state', 'lxa-v102-game-state', 'lxa-v101-game-state', 'lxa-v100-game-state', 'lxa-v99-game-state', 'lxa-v98-game-state', 'lxa-v97-game-state'];
  const migrateV101Difficulty = difficulty => ({ 1: 2, 2: 3, 3: 3 }[Number(difficulty)] || 2);
  const safeLoad = () => {
    try {
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (current) return game.initialState(current);
      const legacyKey = LEGACY_STORAGE_KEYS.find(key => localStorage.getItem(key));
      const legacy = legacyKey ? JSON.parse(localStorage.getItem(legacyKey) || 'null') : null;
      return game.initialState(legacy ? { ...legacy, difficulty: ['lxa-v104-game-state', 'lxa-v103-game-state', 'lxa-v102-game-state'].includes(legacyKey) ? legacy.difficulty : migrateV101Difficulty(legacy.difficulty) } : {});
    }
    catch { return game.initialState(); }
  };
  let gameState = safeLoad();
  const persist = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
  persist();
  const euro = value => money(Number(value) || 0);
  const payoffText = multiplier => `× ${Number(multiplier).toLocaleString(lang === 'en' ? 'en-US' : 'de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  function paintPaytable() {
    document.querySelectorAll('[data-payout]').forEach(row => {
      const hits = Number(row.dataset.payout), multiplier = game.PAYTABLE[hits];
      // v158 (user request): dropped the "· LXA" suffix from the
      // 10/10 payout row label - this JS re-paints the row on every load/
      // language change, so it would have silently overwritten the static
      // HTML text back to "10/10 · LXA" even after editing
      // index.html alone. 10/10 now renders exactly like every other row.
      row.querySelector('b').textContent = `${hits}/10`;
      (row.querySelector('strong') || row.querySelector('span')).textContent = payoffText(multiplier);
    });
  }
  function renderMissionV79() {
    const done = gameState.completedLines.filter(Boolean).length;
    const cards = Array.from({ length: game.LINE_COUNT }, (_, index) => {
      // V118 (idea from V4): an open line shows its best result in the
      // current mission cycle; a completed line is ticked. Records reset with
      // the cycle (engine), so an open line never shows a stale 10/10.
      const complete = Boolean(gameState.completedLines[index]);
      const best = complete ? 10 : Math.min(9, Math.max(0, Number(gameState.recordHits?.[index]) || 0));
      // v158 (user request): dropped the trailing "✓" on a completed line's
      // big number - at narrow/mobile widths "10/10 ✓" didn't fit its box
      // (measured: needs ~65px, box is ~35px at 375px viewport) and was
      // silently clipped by the box's overflow:hidden. Safe to drop: a
      // completed line is already unambiguous from "10/10" alone (an
      // in-progress line is capped at best=9 by `best` above, so "10/10"
      // never appears for an incomplete line) AND still has two OTHER
      // completion indicators untouched - the brighter (non-dimmed) color
      // from .mission-line.complete b and the <small> label switching to
      // T118('reached').
      return `<div class="mission-line ${complete ? 'complete' : ''}" style="--progress:${best * 10}%"><span>${T118('line')} ${index + 1}</span><b>${complete ? '10/10' : `${best}/10`}</b>${complete ? `<small>${T118('reached')}</small>` : ''}</div>`;
    }).join('');
    // v135: jackpot tiers are a multiple of the current bet, not a fixed sum,
    // so the displayed amount is recalculated from gameState.bet every time.
    const tiers = game.JACKPOT_TIER_MULTIPLIERS.map((multiplier, index) => `<div class="milestone ${done > index ? 'unlocked' : ''}"><span>${index + 1}/5</span><b>${euro(multiplier * (Number(gameState.bet) || 0))}</b><small>${multiplier}×</small></div>`).join('');
    // V360: milestone-label div removed entirely (was CSS display:none per
    // V354) - as a zero-height flex child it was still splitting #missionList's
    // single gap into two half-gaps around it, throwing off the flex-end
    // spacing between the grid and the tier row.
    $('#missionList').innerHTML = `<div class="mission-line-grid">${cards}</div><div class="milestone-list">${tiers}</div>`;
    const missionTitle = $('#missionTitle'); if (missionTitle) missionTitle.textContent = T118('missionTitle');
    const missionGoalNode = $('#missionGoal'); if (missionGoalNode) missionGoalNode.textContent = T118('goal');
    fitMilestoneAmounts();
  }
  // v158 (user asked "what if it's 100.000.000?"): the CSS clamp(10px,
  // 21cqw,22px) on .milestone b was tuned against the longest amount
  // observed at the time ("1.250.000 €") - fine until the bet (and so the
  // tier amount, tier x bet) grows past that, at which point the SAME
  // static font-size overflows again, since cqw tracks the column's width
  // but has no idea how long the actual text is. No fixed-length
  // assumption can ever be safe here (the amount is unbounded - it's
  // bet x JACKPOT_TIER_MULTIPLIERS, and bet can grow arbitrarily with
  // balance). Real fix: measure-then-shrink per chip, same technique as
  // fitWinBoardRow() above - the CSS clamp stays as a reasonable-looking
  // starting point for ordinary amounts, this is the safety net that
  // guarantees no overflow regardless of how many digits the amount ever
  // grows to.
  let rankTimer = null;
  // After a spin the leaderboard + "rank #" are re-read in the background (no page reload, no flicker).
  function scheduleRankRefresh() {
    if (!lxaAccount || rankTimer) return;   // already scheduled: AUTO spins every second or two and used to push a debounced refresh back for ever
    rankTimer = setTimeout(() => { rankTimer = null; if (lxaAccount) renderLeaderboard(true); }, 1800);
  }
  function fitMissionTitle() {
    const head = document.querySelector('.jackpot-target .target-head');
    const title = document.querySelector('#missionTitle'), goal = document.querySelector('#missionGoal');
    if (!head || !title || !goal) return;
    [title, goal].forEach(el => el.style.removeProperty('font-size'));
    // real glyph-run width (a stretched flex item's scrollWidth is its box width, not its text)
    const textW = el => { const range = document.createRange(); range.selectNodeContents(el); return range.getBoundingClientRect().width; };
    const shrink = (el, avail) => {
      let size = parseFloat(getComputedStyle(el).fontSize) || 12, guard = 80;
      while (avail > 0 && textW(el) > avail && size > 7 && guard--) { size -= 0.5; el.style.setProperty('font-size', size + 'px', 'important'); }
    };
    const rowMode = getComputedStyle(head).flexDirection === 'row';
    shrink(title, rowMode ? head.clientWidth * 0.5 : head.clientWidth);
    shrink(goal, goal.clientWidth);
  }
  function fitMilestoneAmounts() {
    fitMissionTitle();
    document.querySelectorAll('.milestone').forEach(m => {
      const b = m.querySelector('b');
      if (!b) return;
      // Always starts from a fixed, generous reference size (NOT whatever
      // the CSS clamp(...,21cqw,...) already computed for this box width) -
      // on a narrow box that clamp alone already lands near its own small
      // end, which leaves this loop almost no room left to shrink further.
      // Starting fresh from a known-large value every time guarantees full
      // shrink range regardless of box width or how it was styled before.
      const base = 19;
      b.style.setProperty('font-size', `${base}px`, 'important');
      // +2px tolerance: sub-pixel font rendering doesn't scale perfectly
      // linearly with the requested size, so the geometric correction below
      // can oscillate within a a pixel or two of the exact boundary without
      // fully converging - imperceptible visually, not worth more passes.
      // Text width via a Range (the real rendered glyph run) instead of
      // scrollWidth, which is rounded and was under-reporting on iOS Safari.
      const textW = () => { const r = document.createRange(); r.selectNodeContents(b); return r.getBoundingClientRect().width; };
      const fits = () => textW() <= m.clientWidth - 2;
      if (fits()) return;
      let scale = (m.clientWidth - 2) / textW();
      for (let pass = 0; pass < 10 && !fits() && scale > 0.15; pass++) {
        b.style.setProperty('font-size', `${Math.max(6, base * scale)}px`, 'important');
        if (fits()) break;
        scale *= (m.clientWidth - 2) / textW();
      }
    });
  }
  // The measurement above is only right once the webfont (LxaNum) is loaded
  // and at the current width - re-fit on font load and on width changes, not
  // just when the mission card is re-rendered.
  {
    let fitQueued = false, lastW = 0;
    const queueFit = () => { if (fitQueued) return; fitQueued = true; requestAnimationFrame(() => { fitQueued = false; fitMilestoneAmounts(); }); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueFit);
    window.addEventListener('resize', queueFit);
    const host = document.querySelector('.jackpot-target');
    if (host && window.ResizeObserver) new ResizeObserver(() => { const w = host.clientWidth; if (w !== lastW) { lastW = w; queueFit(); } }).observe(host);
  }
  function signedEuroV112(value) {
    const amount = Math.round(Number(value) || 0);
    return `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${euro(Math.abs(amount))}`;
  }
  // The "last round" line under the reels: net result in the active language.
  // Re-rendered on every language switch (see applyLanguage wrapper below) so it
  // never keeps the previous language or falls back to the placeholder dash.
  function spinNetResult(spin) {
    return Number.isFinite(Number(spin.netResult)) ? Number(spin.netResult) : Number(spin.totalPayout || 0) - Number(spin.totalStake || 0);
  }
  function syncSpinButtonResult(spin) {
    const net = spinNetResult(spin);
    window.LXASpinButton?.setResult(signedEuroV112(net), net);
  }
  function lastRoundMessage(spin) {
    const roundNet = spinNetResult(spin);
    const netText = `${T118('net')} ${signedEuroV112(roundNet)}`;
    return spin.jackpotCycleCompleted ? `${T118('missionDone')} · 5/5 · ${netText}` : netText;
  }
  const applyLanguageBase = applyLanguage;
  applyLanguage = (...args) => {
    const result = applyLanguageBase(...args);
    if (!spinning && gameState.lastSpin) { $('#message').textContent = lastRoundMessage(gameState.lastSpin); syncSpinButtonResult(gameState.lastSpin); }
    return result;
  };
  if (gameState.lastSpin) syncSpinButtonResult(gameState.lastSpin);
  // The control-row result is deliberately expressed as NET first.  Gross is
  // still available underneath for auditability, but it must not visually
  // overshadow the amount that actually changed the player's balance.
  function renderLastWinV116() {
    const grossNode = $('#win');
    if (!grossNode) return;
    const panel = grossNode.closest('.stat');
    let netNode = $('#netPrimary');
    let grossLabel = $('#grossSecondaryLabel');
    if (panel && !netNode) {
      netNode = document.createElement('strong');
      netNode.id = 'netPrimary';
      netNode.className = 'net-primary';
      grossLabel = document.createElement('small');
      grossLabel.id = 'grossSecondaryLabel';
      grossLabel.className = 'gross-secondary-label';
      grossNode.classList.add('gross-secondary');
      grossNode.before(netNode);
      // V118: label and value share one wrapper line, so the label is never cut to "GE…".
      const grossLine = document.createElement('div');
      grossLine.className = 'gross-line';
      grossNode.before(grossLine);
      grossLine.append(grossLabel, grossNode);
    }
    const spin = gameState.lastSpin;
    const net = spin ? (Number.isFinite(Number(spin.netResult)) ? Number(spin.netResult) : Number(spin.totalPayout || 0) - Number(spin.totalStake || 0)) : 0;
    const copy = { net: T118('net'), gross: T118('gross') };
    if (netNode) {
      netNode.dataset.label = copy.net;
      netNode.textContent = signedEuroV112(net);
      netNode.classList.toggle('loss', net < 0);
      netNode.classList.toggle('profit', net > 0);
    }
    if (grossLabel) grossLabel.textContent = copy.gross;
    grossNode.textContent = euro(gameState.lastWin);
  }
  window.__renderLastWinV116 = renderLastWinV116;
  function renderHistoryV79() {
    const list = $('#history');
    if (!list) return;
    const spins = gameState.spinHistory.slice(0, 10);
    list.innerHTML = spins.length ? spins.map(spin => {
      const wildLineSet = new Set((spin.wild?.positions || []).map(position => position.line));
    const winningLines = spin.finalResults.map((hits, index) => ({ hits, index, amount: spin.linePayouts[index], wild: wildLineSet.has(index) })).filter(line => line.amount > 0);
      const summary = winningLines.length ? winningLines.map(line => `L${line.index + 1} · ${line.hits}/10`).join(' · ') : T118('noWinLine');
      // History is the balance change, not the gross return. A round that
      // pays €8,257 from a €7,940 stake is therefore correctly shown as +€317.
      const net = Number.isFinite(Number(spin.netResult)) ? Number(spin.netResult) : Number(spin.totalPayout || 0) - Number(spin.totalStake || 0);
      return `<li><span>${T118('round')} ${String(spin.round || 0).padStart(3, '0')} · ${summary}</span><time class="${net < 0 ? 'loss' : net > 0 ? 'profit' : 'even'}">${signedEuroV112(net)}</time></li>`;
    }).join('') : `<li><span>${T118('systemReady')}</span><time>–</time></li>`;
  }
  function renderGameV79() {
    credits = gameState.credits;
    bet = gameState.bet;
    chance = gameState.difficulty - 1;
    round = gameState.round;
    $('#credits').textContent = euro(gameState.credits);
    $('#bank').textContent = euro(gameState.bank);
    { const inv = $('#wildInventory'); if (inv) inv.innerHTML = `<span>${T118('lvl')}</span><span>×${gameState.wildLevel}/${game.WILD_LEVEL_MAX}</span>`; }
    window.__wildChancePct = Math.round(game.wildChance(gameState.wildLevel) * 100);
    const buyNode = $('#buyWild');
    if (buyNode) {
      const atMax = gameState.wildLevel >= game.WILD_LEVEL_MAX;
      const wildCost = game.wildUpgradeCost(gameState.wildLevel);
      buyNode.disabled = (Number(gameState.credits) || 0) + (Number(gameState.bank) || 0) < wildCost || atMax;
      buyNode.classList.toggle('is-maxed', atMax);
      buyNode.title = `WILD BONUS · ${window.__wildChancePct}% ${T118('chance')}`;
      const price = buyNode.querySelector('small');
      // Compact price (e.g. 38 Mio. €) so the WILD button never cuts digits on phones.
      // Split into "amount" + "unit €" on two lines (e.g. "2,5" / "Mio. €").
      if (price) {
        const priceText = atMax ? 'MAX' : new Intl.NumberFormat(lang === 'en' ? 'en-US' : lang === 'ro' ? 'ro-RO' : 'de-DE', { style: 'currency', currency: 'EUR', currencyDisplay: 'narrowSymbol', notation: 'compact', maximumFractionDigits: 1 }).format(wildCost);
        // Intl.NumberFormat separates amount/unit with a NON-BREAKING space
        // (char 160), not a plain space — matching ' ' literally always failed,
        // which is why the WILD button stayed on 4 rows instead of 5.
        const spaceIdx = priceText.search(/[\s\u00A0]/);
        price.innerHTML = spaceIdx === -1 ? `<span>${priceText}</span>` : `<span>${priceText.slice(0, spaceIdx)}</span><span>${priceText.slice(spaceIdx + 1)}</span>`;
        price.title = euro(wildCost);
      }
    }
    $('#bet').textContent = euro(gameState.bet);
    // effective ceiling: the Guthaben first, then half the price of the next WILD level - whichever is lower
    $('#betMax').textContent = `MAX ${euro(Math.max(0, Math.min(Math.floor(Number(gameState.credits) || 0), game.maxBetForWildLevel(gameState.wildLevel))))}`;
    $('#lineStake').textContent = `${euro(gameState.bet / game.LINE_COUNT)}${T118('perLineUnit')}`;
    $('#roundLabel').textContent = `${T118('round')} ${String(gameState.round).padStart(3, '0')}`;
    // V326: logged-in players see ONE clean line - id/name, round, rank -
    // instead of the guest-only decorative field name + "VIRTUAL EURO
    // SYSTEM" disclaimer (which don't mean anything once play is tied to a
    // real account) stacked on top of the account line. Guests keep the
    // original decorative row unchanged; #leaderboardRank stays hidden then.
    const lbRank = $('#leaderboardRank');
    const fieldLabel = document.querySelector('.field-label');
    const systemLabel = document.querySelector('.system-label');
    const roundLabelEl = $('#roundLabel');
    if (lbRank) {
      if (lxaAccount) {
        // V358: added the difficulty name (same DULCE/PICANT/BRUTAL words
        // shown on the GEWINNCHANCE slider) per user request, so the logged-in
        // status line reads id/name/round/rank/difficulty in one place.
        // v145: split into separate spans (own margins via CSS) instead of
        // one dense "·"-joined string, and difficulty name is emoji-free
        // here (chanceCopy keeps the emoji for the slider label only).
        const difficultyName = stripEmoji(chanceCopy[lang][Math.min(2, Math.max(0, gameState.difficulty - 1))]);
        lbRank.innerHTML = [
          `${lxaAccount.id}/${lxaEsc(lxaAccount.name || '?')}`,
          `${T118('round')} ${String(gameState.round).padStart(3, '0')}`,
          `${T118('rank')} #${lxaAccount.position || '—'}`,
          difficultyName
        ].map(part => `<span class="status-part">${part}</span>`).join('');
        lbRank.style.removeProperty('display');
        // V326: .console-top>span:last-child forces display:inline-block
        // !important in layout-fix.css, so hiding these needs !important too.
        if (fieldLabel) fieldLabel.style.setProperty('display', 'none', 'important');
        if (systemLabel) systemLabel.style.setProperty('display', 'none', 'important');
        if (roundLabelEl) roundLabelEl.style.setProperty('display', 'none', 'important');
      } else {
        // V366/v145: guests get the same one-line status (was SERIA 10 /
        // decorative field name only, which read as ambiguous next to
        // RUNDA) - GUEST/OASPETE/GAST stands in for id/name. Difficulty
        // shown as just the word (no "DIFICULTATE:" label, no emoji), same
        // separate-spans treatment as the logged-in line above.
        const guestDifficultyName = stripEmoji(chanceCopy[lang][Math.min(2, Math.max(0, gameState.difficulty - 1))]);
        lbRank.innerHTML = [
          T118('guest'),
          `${T118('round')} ${String(gameState.round).padStart(3, '0')}`,
          guestDifficultyName
        ].map(part => `<span class="status-part">${part}</span>`).join('');
        lbRank.style.removeProperty('display');
        if (fieldLabel) fieldLabel.style.setProperty('display', 'none', 'important');
        if (systemLabel) systemLabel.style.setProperty('display', 'none', 'important');
        if (roundLabelEl) roundLabelEl.style.setProperty('display', 'none', 'important');
      }
    }
    const geldLabel = $('#geld b'); if (geldLabel) geldLabel.textContent = T118('geld');
    refreshChance();
    renderLastWinV116();
    $('#after').textContent = euro(gameState.credits);
    renderMissionV79();
    paintPaytable();
    renderHistoryV79();
    if (gameState.lastSpin?.board) {
      render(gameState.lastSpin.board);
      applySpinVisualsV84(gameState.lastSpin);
    }
  }
  // This is the visual resolution step used by the V77 reference build:
  // cyan cells and a cyan payline are drawn only after the reels stop.  It is
  // deliberately separate from payout maths, so a re-render can never pay a
  // result twice.
  function applySpinVisualsV84(spin) {
    const paylines = $('.paylines');
    const visibleThreshold = 3;
    // A line showing a Wild icon is never framed as a record or jackpot line
    // (it can still pay and still shows its hits).
    const wildRows = new Set((spin.wild?.positions || []).map(position => position.line));
    const recordCandidates = (spin.finalResults || []).filter((_, row) => !wildRows.has(row));
    paylines?.querySelectorAll('div').forEach((line, row) => {
      const hits = Number(spin.finalResults?.[row] || 0);
      const active = hits >= visibleThreshold;
      const full = hits === game.COLUMN_COUNT && !wildRows.has(row);
      line.classList.toggle('active', active);
      line.classList.toggle('record-top', active && !wildRows.has(row) && hits === Math.max(...recordCandidates));
      line.classList.toggle('jackpot-line', full);
      line.style.width = active ? `${hits * 10}%` : '0%';
      const label = line.querySelector('b');
      if (label) label.textContent = full ? T118('paylineFull') : `${T118('winLine')} ${row + 1} · ${hits}/10`;
    });
    [...document.querySelectorAll('.reel')].forEach((reel, column) => {
      reel.querySelectorAll('span[data-row]').forEach(cell => {
        const row = Number(cell.dataset.row);
        const hits = Number(spin.finalResults?.[row] || 0);
        cell.classList.toggle('hit', column < hits);
        cell.classList.toggle('after-miss', column >= hits);
        cell.classList.toggle('jackpot-letter', hits === game.COLUMN_COUNT && !wildRows.has(row));
        cell.style.animationDelay = column < hits ? `${column * 70}ms` : '';
      });
    });
  }
  function showSpinV79(spin) {
    const wild = ''; // no "WILD ×N · %" tag: it looked like a payout multiplier
    // V353: JACKPOT/5-5 chips moved from #boardDetails into #boardSummary
    // (same reasoning as the V225 GEWINN BRUTTO/NETTO move below) - they used
    // to compete with the 5 LINIE chips for room in #boardDetails, which is
    // what forced that row into a horizontal scrollbar on landscape. Reusing
    // .board-total for layout + .board-bonus.mission-bonus for the existing
    // gold color scheme, so no new CSS is needed for these.
    const jackpot = spin.jackpotPayout ? `<span class="board-total board-bonus mission-bonus"><span>JACKPOT</span><b>+${euro(spin.jackpotPayout)}</b></span>` : '';
    const reset = spin.jackpotCycleCompleted ? `<span class="board-total board-bonus mission-bonus"><span>${T118('missionDone')}</span><b>5/5</b></span>` : '';
    const wildLineSet = new Set((spin.wild?.positions || []).map(position => position.line));
    const winningLines = spin.finalResults.map((hits, index) => ({ hits, index, amount: spin.linePayouts[index], wild: wildLineSet.has(index) })).filter(line => line.amount > 0);
    $('#boardTitle').textContent = spin.jackpotPayout ? T118('missionTitle') : winningLines.length ? `${winningLines.length} ${({de:['LINIE','LINIEN'],ro:['LINIE','LINII'],en:['LINE','LINES']}[lang] || ['LINE','LINES'])[winningLines.length === 1 ? 0 : 1]}` : T118('noWinLine');
    // V225: GEWINN BRUTTO / NETTO render in their own #boardSummary
    // container, separate from the LINIE chips in #boardDetails.
    // v158 (user request): #boardSummary now sits AFTER #boardDetails in
    // the DOM (index.html) instead of before it - the L1..L5 breakdown is
    // meant to be read before the totals now. This file only ever targets
    // these by id, so the content logic below is unchanged; only the
    // markup order (and the CSS layout built around it) moved.
    const totalHtml = `<span class="board-total net-result ${spin.netResult < 0 ? 'loss' : spin.netResult > 0 ? 'profit' : 'even'}"><span>${T118('net')}</span><b>${signedEuroV112(spin.netResult)}</b></span><span class="board-total gross-result"><span>${({de:'BRUTTO',ro:'BRUT',en:'GROSS'}[lang] || 'GROSS')}${wild}</span><b>+${euro(spin.totalPayout)}</b></span>`;   // one row: NETTO first, BRUTTO second (same size); colours come from the classes, not from the position
    if (!winningLines.length && !spin.jackpotPayout) {
      $('#boardDetails').innerHTML = `<span>${T118('noWinNext')}${wild}</span>`;
      $('#boardSummary').innerHTML = '';
    } else {
      // V353: shortened from "LINIE n · h/10 · stake × mult  +amount" to
      // "Ln · h/10  +amount" (same compact L-number convention already used
      // in the round-history summary above) - measured live: the full text
      // needs ~2000px for 5 chips, which never fits a real landscape width
      // at a readable size. This short form fits 5 chips on one row without
      // shrinking the font into illegibility or needing horizontal scroll.
      $('#boardDetails').innerHTML = winningLines.map(line => `<div class="${line.hits === 10 && !line.wild ? 'jackpot-result' : ''}"><span>L${line.index + 1} · ${line.hits}/10</span><b>+${euro(line.amount)}</b></div>`).join('');
      // totalHtml (NETTO + BRUTTO) stays first in the summary; the colours are tied to .net-result / .gross-result (layout-fix.css),
      // so the jackpot / reset blocks after it can never steal them.
      $('#boardSummary').innerHTML = totalHtml + jackpot + reset;
    }
    $('#winBoard').classList.add('show');
    fitWinBoardRow();
  }
  // v158 (user request): in landscape, #winBoard's title + L-line details +
  // totals summary must all fit on ONE row with no scrolling in any
  // direction - same measure-then-shrink technique as index.html's
  // fitHeaderTagline() (reset to a cached base font-size, measure natural
  // vs available width, scale down only if it actually overflows, a couple
  // of corrective passes for subpixel rounding). Portrait doesn't need
  // this - the CSS below stacks everything in a column there, so each line
  // always has the full row width to itself.
  function fitWinBoardRow() {
    const board = $('#winBoard');
    if (!board) return;
    const nodes = [...board.querySelectorAll('.win-board-head *, .board-details *, .board-summary *')].filter(el => el.children.length === 0 && el.textContent.trim());
    if (!nodes.length) return;
    // Always reset to the cached base size first (even in portrait) - a
    // scale applied while in landscape must not linger as leftover tiny
    // text after rotating to portrait, where no shrinking is needed at all.
    nodes.forEach(el => {
      if (!el.dataset.baseFs) el.dataset.baseFs = parseFloat(getComputedStyle(el).fontSize) || 12;
      el.style.setProperty('font-size', `${el.dataset.baseFs}px`, 'important');
    });
    if (window.matchMedia('(orientation: portrait)').matches) return;
    // Gaps between chips/groups don't shrink with font-size, so on a very
    // full row (title + 5 L-chips + up to 3 totals) they alone can keep it
    // from fitting even at a tiny font - scale them down together with the
    // font instead of just the text.
    const gapEls = [board, ...board.querySelectorAll('.win-board-head, .board-details, .board-summary, .board-details>div')];
    gapEls.forEach(el => { if (!el.dataset.baseGap) el.dataset.baseGap = parseFloat(getComputedStyle(el).gap) || 0; el.style.setProperty('gap', `${el.dataset.baseGap}px`, 'important'); });
    const fits = () => board.scrollWidth <= board.clientWidth + 1;
    if (fits()) return;
    let scale = board.clientWidth / board.scrollWidth;
    for (let pass = 0; pass < 10 && !fits() && scale > 0.15; pass++) {
      nodes.forEach(el => el.style.setProperty('font-size', `${Math.max(6, el.dataset.baseFs * scale)}px`, 'important'));
      gapEls.forEach(el => el.style.setProperty('gap', `${Math.max(1, el.dataset.baseGap * scale)}px`, 'important'));
      if (fits()) break;
      scale *= board.clientWidth / board.scrollWidth;
    }
  }
  { let winBoardResizeTimer; const refit = () => { fitWinBoardRow(); fitMilestoneAmounts(); }; window.addEventListener('resize', () => { clearTimeout(winBoardResizeTimer); winBoardResizeTimer = setTimeout(refit, 120); }); window.addEventListener('orientationchange', () => { clearTimeout(winBoardResizeTimer); winBoardResizeTimer = setTimeout(refit, 180); }); }
  function reportBalance() {
    const rows = game.debugReport(console);
    const expected = [.993, .8635, .774];
    rows.forEach((row, index) => {
      if (Math.abs(row.expectedLineMultiplier - expected[index]) > .004) console.warn('LXA EV deviation', row);
    });
  }
  // Animates #credits from one value to another over `duration` ms, easing
  // out, formatted through the same euro() used everywhere else. Used only
  // around spin outcomes; every other #credits update (load, reset, language
  // switch) stays an instant set via renderGameV79().
  function animateCredits(fromValue, toValue, duration) {
    const el = $('#credits');
    const from = Number(fromValue) || 0, to = Number(toValue) || 0;
    if (!el || from === to) { if (el) el.textContent = euro(to); return Promise.resolve(); }
    return new Promise(resolve => {
      const start = performance.now();
      (function tick(now) {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = euro(from + (to - from) * eased);
        if (progress < 1) requestAnimationFrame(tick); else resolve();
      })(start);
    });
  }
  // V161: keeps a handle to the reel animations + the pending finish timer of
  // the CURRENT spin so a fast follow-up click can fast-forward it instead of
  // waiting for it. Lets the user click SPIN quickly in succession while each
  // individual spin's letters still visually roll at the slower speed.
  let activeSpinHandle = null, stopRequested = false;
  // ONE continuous, slow motion. The reels start rolling in the same frame as the tap (a looping strip of random
  // letters at a constant, slow speed). When the server's result arrives, each reel is re-laid out WITHOUT any visible
  // jump: [result rows][a few filler cells][the cells currently on screen, at the same offset] and a single eased
  // slide whose starting speed equals the loop speed carries it down onto the result. No second "restart".
  function startReelSpin() {
    const nodes = [...document.querySelectorAll('.reel')];
    const rnd = () => symbols[Math.floor(Math.random() * symbols.length)];
    const cellHtml = value => {
      const isWild = value === game.WILD;
      return `<span class="${isWild ? 'wild-symbol' : 'letter-' + value}">${isWild ? WILD_IMG : value}</span>`;
    };
    const CELL_MS = 130;                    // loop speed: one cell per 130ms
    const SLOPE0 = 2.4;                     // initial slope of the landing curve (cubic-bezier .25,.6,.35,1 -> .6/.25)
    const EASE = 'cubic-bezier(.25,.6,.35,1)';
    const FILLER = 3;
    const reels = nodes.map(node => {
      const strip = Array.from({ length: 12 }, rnd);
      node.innerHTML = `<div class="reel-track rolling">${[...strip, ...strip].map(cellHtml).join('')}</div>`;
      const track = node.firstElementChild;
      const h = track.firstElementChild?.getBoundingClientRect().height || cell;
      const loop = track.animate([{ transform: `translateY(${-strip.length * h}px)` }, { transform: 'translateY(0px)' }], { duration: strip.length * CELL_MS, iterations: Infinity, easing: 'linear' });
      return { node, h, loop, strip };
    });
    let landed = false, stopWanted = false, animations = [], timer = null, resolvePromise = null;
    const finishAll = () => {
      animations.forEach(anim => { try { anim.finish(); } catch (error) { /* already done */ } });
      clearTimeout(timer);
      if (resolvePromise) resolvePromise();
    };
    const handle = {
      land(grid) {
        landed = true;
        let longest = 0;
        reels.forEach((reel, column) => {
          const { node, h, loop, strip } = reel;
          const period = strip.length * CELL_MS;
          const ty = -strip.length * h + ((Number(loop.currentTime) || 0) % period) / period * strip.length * h;
          const first = Math.max(0, Math.floor(-ty / h));
          const top0 = ty + first * h;
          const onScreen = [...strip, ...strip].slice(first, first + 6);
          const result = grid.map(row => row[column]);
          const filler = Array.from({ length: FILLER }, rnd);
          loop.cancel();
          node.innerHTML = `<div class="reel-track rolling">${[...result, ...filler, ...onScreen].map(cellHtml).join('')}</div>`;
          const track = node.firstElementChild;
          const startY = -((result.length + FILLER) * h) + top0;
          const distance = -startY;
          const duration = SLOPE0 * distance * CELL_MS / h;
          longest = Math.max(longest, duration);
          track.style.transform = `translateY(${startY}px)`;
          animations.push(track.animate([{ transform: `translateY(${startY}px)` }, { transform: 'translateY(0px)' }], { duration, easing: EASE, fill: 'forwards' }));
        });
        // Resolve the moment the last reel actually comes to rest (the timer is only a safety net), and tell the SPIN
        // button how long that slide takes so its progress ring is full exactly then.
        const promise = new Promise(resolve => {
          resolvePromise = resolve;
          timer = setTimeout(resolve, longest + 150);
          Promise.all(animations.map(anim => anim.finished.catch(() => {}))).then(resolve);
        });
        if (!stopWanted) window.LXASpinButton?.landing(longest);
        if (stopWanted) finishAll();
        return promise;
      },
      // Snaps the reels to rest now; if the result has not arrived yet they snap the moment it does.
      fastForward() {
        if (!landed) { stopWanted = true; return; }
        finishAll();
      },
      abort() {
        reels.forEach(reel => { try { reel.loop.cancel(); } catch (error) { /* gone */ } });
        if (!landed) render(gameState.lastSpin?.board || Array.from({ length: rows }, () => target.slice()));
      }
    };
    activeSpinHandle = handle;
    return handle;
  }
  const legacyApplyLanguage = applyLanguage;
  // Landmark names follow the language too (they were German-only in the markup).
  const ARIA_NAMES = { slot: { de: 'Spielautomat', ro: 'Aparat de joc', en: 'Slot machine' }, rules: { de: 'Spielregeln', ro: 'Regulile jocului', en: 'Game rules' } };
  applyLanguage = () => {
    legacyApplyLanguage(); paintPaytable(); renderMissionV79();
    document.querySelectorAll('[data-aria]').forEach(el => { const names = ARIA_NAMES[el.dataset.aria]; if (names) el.setAttribute('aria-label', names[lang] || names.de); });
    // V118: round label, history, last-win panel and the result board also follow the language.
    renderGameV79();
    if (gameState.lastSpin && $('#winBoard')?.classList.contains('show')) showSpinV79(gameState.lastSpin);
  };
  // Any legacy account/language callback now receives the same jackpot view.
  renderMission = renderMissionV79;
  // V161: generation token so a fast-forwarded, still-finishing previous spin
  // never clobbers the state of a newer spin that started on top of it.
  let spinToken = 0, canceledToken = null;
  // V322: this handler used to always resolve spins locally with
  // game.resolveSpin(), even when logged into an account. That meant a
  // logged-in player's spins never reached the backend's 'spin' action,
  // which is the only place that writes into the server leaderboard - so
  // logged-in players never appeared on the leaderboard and their entry
  // never updated, no matter how long they played. lxaAccountResolveSpin()
  // calls the authoritative backend spin instead and returns the same
  // {state, spin} shape as game.resolveSpin(), so the rest of this handler
  // (animation, persistence, rendering) works unchanged for both paths.
  let pendingSpinRequestId = null;
  // v155: reuses the SAME requestId across a timeout-retry (only rotates
  // to a fresh one after a definitive, non-timeout outcome) so the server's
  // idempotency cache (functions/security.js) can recognize "this is the
  // same attempt, already committed" and return the cached result instead
  // of spinning twice - closes the residual gap from the lxaRequest()
  // fetch-timeout fix: a merely-slow (not hung) request that the client
  // gave up on can no longer become a second real spin on retry.
  async function lxaAccountResolveSpin(state, level) {
    const requestId = pendingSpinRequestId || (pendingSpinRequestId = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`));
    let response;
    try {
      response = await lxaRequest('spin', { id: lxaAccount.id, bet: state.bet, difficulty: level + 1, token: lxaToken, requestId });
    } catch (error) {
      if (!/timed out/i.test(error.message || '')) pendingSpinRequestId = null;
      throw error;
    }
    pendingSpinRequestId = null;
    // v158 (user request): the server's grid now only ever contains real
    // LXA letters (see makeGrid in functions/lxa-account.js) -
    // the old client-side 'X'->ad-hoc-alphabet substitution (which used to
    // show letters like B/H/etc. that aren't even in LXA) is gone.
    const board = response.grid;
    const spin = { ...response.spin, round: state.round, board };
    const next = game.initialState({
      ...state,
      credits: Number(response.account.balance),
      bank: Number(response.account.bank),
      wildLevel: Number(response.account.wildLevel),
      wildInventory: Number(response.account.wildInventory),
      difficulty: Number(response.account.difficulty),
      recordHits: response.account.records,
      completedLines: response.account.completedLines,
      jackpotFinished: response.account.jackpotFinished,
      round: state.round + 1,
      lastWin: spin.totalPayout,
      lastSpin: spin,
      spinHistory: [spin, ...state.spinHistory].slice(0, 50)
    });
    const keptPosition = lxaAccount && lxaAccount.position;   // the server's account has no rank: keep the last known one until the leaderboard answers (no "#—" flicker after every spin)
    lxaAccount = response.account; if (keptPosition) lxaAccount.position = keptPosition;
    lxaStore();
    return { state: next, spin };
  }
  $('#spin').onclick = async event => {
    // The press already acted on pointerdown (spin-button.js); drop the click
    // that the same touch generates on release, or it would instantly undo it.
    window.LXASpinButton?.trace?.('onclick ' + (event && event.type) + ' spinning=' + spinning + ' credits=' + gameState.credits + ' bet=' + gameState.bet);
    if (event && event.type === 'click' && event.detail > 0 && window.LXASpinButton?.recentPointer()) { window.LXASpinButton?.trace?.('click dropped (same touch)'); return; }
    // V231: V161's fast-forward-then-immediately-start-a-new-spin made rapid
    // repeated clicks feel like the game "never stops" — every click
    // canceled the round before it could show a result, so a continuous
    // burst of clicks meant no result ever appeared, only whichever click
    // happened to be the last one in the burst got to finish.
    // Fix: a click while a round is running now just STOPS that round
    // instantly (reels snap to rest, result shows right away) — it does
    // NOT start a new spin on top of it. Starting the next round always
    // needs its own separate, later click.
    if (spinning) {
      window.LXASpinButton?.stopped();
      // Tapped STOPP while the server is still resolving the round: remember
      // it and snap the reels the moment their animation exists.
      if (activeSpinHandle) activeSpinHandle.fastForward(); else stopRequested = true;
      return;
    }
    const myToken = ++spinToken;
    gameState = game.initialState({ ...gameState, credits: Number(credits), bet: Number(bet), difficulty: Number(chance) + 1 });
    if (!autoSpinEnabled && normalizeLocalBet()) { persist(); renderGameV79(); }
    if (gameState.credits < gameState.bet) { setMsg(t[lang].noMoney); window.LXASpinButton?.trace?.('no money'); return; }
    window.LXASpinButton?.trace?.('round starts');
    spinning = true;
    queuedBet = null;
    activeSpinHandle = null;
    stopRequested = false;
    window.LXASpinButton?.start();
    $('#winBoard').classList.remove('show');
    const before = gameState.credits;
    $('#before').textContent = euro(before);
    $('#message').textContent = t[lang].rolling;
    try {
      // Resolve once, then debit the full stake immediately while the reels
      // run. The winnings are added only after the final board is visible.
      const reels = startReelSpin();
      const result = lxaAccount ? await lxaAccountResolveSpin(gameState, chance) : game.resolveSpin(gameState);
      if (myToken !== spinToken) return;   // logged out / session lost while the request was in flight: no animation, no result, no balance change
      const afterStake = before - result.spin.totalStake;
      const debitAnimation = animateCredits(before, afterStake, 180);
      const reelAnimation = reels.land(result.spin.board);
      if (stopRequested) { stopRequested = false; reels.fastForward(); }
      await reelAnimation;
      // A newer spin already took over while this one's animation was
      // running (or being fast-forwarded) — drop this run's result entirely,
      // the newer run owns gameState/credits/UI from here on.
      if (myToken !== spinToken || myToken === canceledToken) return;
      gameState = result.state;
      // A stake changed during AUTO applies to the NEXT round (same caps).
      if (queuedBet !== null) {
        const room = Math.floor(Number(gameState.credits) || 0);
        gameState.bet = room >= 5 ? Math.min(queuedBet, room, game.maxBetForWildLevel(gameState.wildLevel)) : queuedBet;
        queuedBet = null;
      } else if (!autoSpinEnabled) normalizeLocalBet();
      // Persist the resolved state before the animation finishes. A reload
      // during the reel animation therefore cannot lose the completed spin.
      persist();
      $('#gross').textContent = euro(result.spin.totalPayout);
      $('#lineResult').textContent = result.spin.finalResults.filter(value => value >= 3).map(value => `${value}/10`).join(' · ') || '—';
      $('#after').textContent = euro(gameState.credits);
      // V314: NET is already shown as the primary win-stat value via
      // renderLastWinV116() — repeating "NET -1€" here as well was the
      // duplicate line under CÂȚIG BRUT. Show "ready for next round" instead.
      $('#message').textContent = lastRoundMessage(result.spin);
      window.lastRoundDetails = result.spin.finalResults.map((hits, line) => ({ line, hits, amount: result.spin.linePayouts[line], mult: game.PAYTABLE[hits] || 0, wild: (result.spin.wild?.positions || []).some(position => position.line === line) }));
      render(result.spin.board);
      applySpinVisualsV84(result.spin);
      showSpinV79(result.spin);
      window.LXASpinButton?.finish(result.spin.totalPayout, spinNetResult(result.spin));
      syncSpinButtonResult(result.spin);
      if (result.spin.totalPayout > 0) {
        await debitAnimation;
        if (myToken !== spinToken || myToken === canceledToken) return;
        await animateCredits(afterStake, gameState.credits, 280);
      } else {
        await debitAnimation;
      }
      if (myToken !== spinToken || myToken === canceledToken) return;
      renderGameV79();
      scheduleRankRefresh();
    } catch (error) {
      window.LXASpinButton?.trace?.('round failed: ' + (error && error.message));
      // The status line (#message) is hidden in this layout, so a rejected spin used to look like "nothing happened".
      // Say why under the SPIN button; an expired session also opens the login panel.
      {
        const reason = String((error && error.message) || '');
        const key = /session expired|reauth|log in/i.test(reason) ? 'spinErrSession' : /too many|busy/i.test(reason) ? 'spinErrBusy'
          : /network|timed out|unavailable/i.test(reason) ? 'spinErrNet' : /maximum/i.test(reason) ? 'maxBet' : 'spinErrFail';
        window.LXASpinButton?.fail?.(T118(key));
        if (key === 'spinErrSession') renderAccountPanel('login', T118(key));
      }
      if (myToken === spinToken) { activeSpinHandle?.abort(); $('#message').textContent = error.message || 'Spin failed.'; }
      // A rejected spin must never be retried forever by AUTO, and a balance
      // the server disagrees with (stale cache / different device) is re-read
      // from the server so the stake is rescaled to what is really available.
      if (autoSpinEnabled) stopAutoSpin();
      if (lxaAccount && /insufficient|invalid bet|maximum/i.test(error.message || '')) {
        try {
          const fresh = await lxaRequest('login', { id: lxaAccount.id, silent: true, token: lxaToken });
          await lxaHydrate(fresh.account);
          gameState = game.initialState({ ...gameState, credits: Number(credits), bet: Number(bet), difficulty: Number(chance) + 1 });
          if (normalizeLocalBet()) { persist(); renderGameV79(); }
        } catch (syncError) { /* keep the original error message on screen */ }
      }
    }
    finally { if (myToken === spinToken) { spinning = false; $('#spin').disabled = false; window.LXASpinButton?.idle(); } }
  };
  const chanceInput = $('#chance');
  chanceInput?.addEventListener('change', () => { gameState.difficulty = Number(chance) + 1; persist(); paintPaytable(); });
  let queuedBet = null;
  // PLUS/MINUS only change the bet of the NEXT round (gameState.bet); the round in flight keeps its own stake. AUTO waits until the changes settle.
  let lastBetChangeAt = 0, betHolding = 0;
  const BET_SETTLE_MS = 800;
  const AUTO_PROFIT_PAUSE_MS = 1000;   // AUTO pauses this long after a profit so the gold result is seen
  const stakeStep = balance => Number(balance) >= 5000000 ? 10000 : Number(balance) >= 1000000 ? 2500 : Number(balance) >= 250000 ? 500 : 5;
  // A stale MAX 50% or manually raised stake must never leave the player with
  // a button that cannot spin after the balance changes. Keep a valid, scaled
  // recommendation instead of silently turning the next round into an all-in.
  const normalizeLocalBet = () => {
    const available = Math.max(0, Math.floor(Number(gameState.credits) || 0));
    const cap = game.maxBetForWildLevel(gameState.wildLevel);
    let changed = false;
    if (gameState.bet > cap) { gameState.bet = cap; changed = true; }
    if (available < 5 || gameState.bet <= available) return changed;
    gameState.bet = Math.min(available, cap, game.recommendedBet(available));
    return true;
  };
  normalizeLocalBet();
  const setLocalBet = value => {
    const step = stakeStep(gameState.credits);
    const cap = game.maxBetForWildLevel(gameState.wildLevel);
    const wanted = Math.round(Number(value) / step) * step;
    gameState.bet = Math.min(cap, Math.max(step, Math.min(Math.max(step, gameState.credits), wanted)));
    if (wanted > cap && !spinning) $('#message').textContent = `${T118('maxBet')}: ${euro(cap)}`;
    lastBetChangeAt = Date.now();
    if (spinning && autoSpinEnabled) queuedBet = gameState.bet;
    persist(); renderGameV79();
  };
  // Scale +/- with the current stake: small balances still move in €5/€500
  // steps, while a €42,405 stake changes by a useful ~10% instead of a tiny
  // fixed amount. The result is rounded to the current tier step.
  const scaledDelta = () => {
    const step = stakeStep(gameState.credits);
    return Math.max(step, Math.round((Math.max(gameState.bet, step) * 0.10) / step) * step);
  };
  // One click changes the bet once. Holding - or + repeats after 320ms and
  // accelerates down to 65ms; Pointer Events make the same control work with
  // a mouse, touch screen, or a phone press-and-hold.
  function bindHoldBet(id, direction) {
    const button = $(id);
    if (!button) return;
    let timer = null, delay = 320, held = false, changedOnPress = false, ignoreClickUntil = 0;
    const change = () => { if (!spinning || autoSpinEnabled) setLocalBet(gameState.bet + direction * scaledDelta()); };
    const stop = () => { if (held) betHolding = Math.max(0, betHolding - 1); if (timer) clearTimeout(timer); timer = null; held = false; delay = 320; };
    const repeat = () => {
      if (!held) return;
      change();
      delay = Math.max(65, Math.round(delay * .72));
      timer = setTimeout(repeat, delay);
    };
    button.addEventListener('pointerdown', event => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!held) betHolding++; held = true; changedOnPress = true; ignoreClickUntil = performance.now() + 800; change();
      button.setPointerCapture?.(event.pointerId);
      timer = setTimeout(repeat, delay);
    }, true);
    ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture'].forEach(type => button.addEventListener(type, stop, true));
    button.addEventListener('click', event => {
      event.preventDefault(); event.stopImmediatePropagation();
      // A keyboard click has no pointerdown, so it still changes the bet once.
      if (!changedOnPress && performance.now() >= ignoreClickUntil) change();
      changedOnPress = false;
    }, true);
    button.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); change(); }
    }, true);
  }
  bindHoldBet('#betDown', -1);
  bindHoldBet('#betUp', 1);
  // Quick-bet: set the stake to 50% of the current balance in one tap.
  // setLocalBet() already clamps to [step, gameState.credits], so this can
  // never push the bet above VIRTUELLES GUTHABEN.
  const betHalfButton = $('#betHalf');
  const fiftyPercentBet = balance => {
    const amount = Math.max(0, Number(balance) || 0);
    return amount * 0.5;
  };
  if (betHalfButton) betHalfButton.addEventListener('click', event => {
    event.preventDefault();
    if (spinning && !autoSpinEnabled) return;
    setLocalBet(fiftyPercentBet(gameState.credits));
  });
  // AUTO is intentionally a visible toggle: it continues until STOP is
  // pressed or the balance can no longer cover the selected stake.
  let autoSpinEnabled = false, autoSpinTimer = null, autoGeneration = 0;
  const autoSpinButton = $('#autoSpin');
  const stopAutoSpin = () => {
    autoSpinEnabled = false;
    if (autoSpinTimer) clearTimeout(autoSpinTimer);
    autoSpinTimer = null;
    if (autoSpinButton) { autoSpinButton.textContent = 'AUTO'; autoSpinButton.setAttribute('aria-pressed', 'false'); }
  };
  const runAutoSpin = async () => {
    if (!autoSpinEnabled) return;
    if (autoGeneration !== lxaAuthGeneration) { stopAutoSpin(); return; }   // the login session changed: AUTO ends, nothing in flight survives
    // AUTO_WAITING_FOR_BET: no new spin / roll / result while PLUS/MINUS are held or were pressed in the last BET_SETTLE_MS.
    if (betHolding > 0 || Date.now() - lastBetChangeAt < BET_SETTLE_MS) { autoSpinTimer = setTimeout(runAutoSpin, 120); return; }
    if (spinning || gameState.credits < gameState.bet) {
      if (gameState.credits < gameState.bet) { stopAutoSpin(); setMsg(t[lang].noMoney); }
      return;
    }
    await $('#spin').onclick();
    // A profit stays on screen for a moment in AUTO (gold SPIN); otherwise the next round wipes it ~0.3 s later.
    const lastNet = gameState.lastSpin ? spinNetResult(gameState.lastSpin) : 0;
    if (autoSpinEnabled) autoSpinTimer = setTimeout(runAutoSpin, lastNet > 0 ? AUTO_PROFIT_PAUSE_MS : 260);
  };
  autoSpinButton?.addEventListener('click', event => {
    event.preventDefault();
    if (autoSpinEnabled) { stopAutoSpin(); return; }
    autoSpinEnabled = true;
    autoGeneration = lxaAuthGeneration;
    autoSpinButton.textContent = 'STOP';
    autoSpinButton.setAttribute('aria-pressed', 'true');
    runAutoSpin();
  });
  window.__lxaGameInvalidate = () => { stopAutoSpin(); spinToken++; try { activeSpinHandle?.abort(); } catch (e) { /* nothing running */ } spinning = false; queuedBet = null; $('#spin').disabled = false; window.LXASpinButton?.idle(); };
  // v159 BUG FIX: this was referenced below with no declaration anywhere in
  // the file - same retry-dedup pattern as pendingSpinRequestId above, but
  // copy-pasted without its `let`. Reading an identifier that was never
  // declared/assigned throws a ReferenceError in JS regardless of strict
  // mode, so the very first BANK deposit by any logged-in account crashed
  // openLocalMoneyPanel's submit handler outright (caught by the
  // surrounding try/catch, surfacing as a generic failure message, but the
  // deposit itself never reached the server).
  let pendingDepositRequestId = null;
  function openLocalMoneyPanel(mode) {
    const isDeposit = mode === 'deposit';
    accountPanel.innerHTML = `<div class="account-panel-card"><button class="account-close" data-local-close aria-label="Close">×</button><h2>BANK</h2><p class="account-notice">${T118('balance')}: ${euro(gameState.credits)}<br>BANK: ${euro(gameState.bank)}</p><form id="localDepositForm"><label>${T118('amount')}<input name="amount" type="number" min="0.01" step="0.01" required></label><button>${T118('toBank')}</button></form></div>`;
    accountPanel.hidden = false;
    accountPanel.querySelectorAll('[data-local-close]').forEach(button => button.onclick = () => { accountPanel.hidden = true; });
    // v152 BUG FIX: same class of bug as buyWildDirectly() below - this was
    // always local-only math on gameState, never the real server 'deposit'
    // action, so a logged-in account's BANK transfer looked like it worked
    // but reverted on the next spin (server re-sync brings back the real,
    // untouched balance/bank). Route logged-in deposits through the server;
    // guests keep the local-only path (correct as-is, no server account).
    if (isDeposit) accountPanel.querySelector('#localDepositForm').onsubmit = async event => {
      event.preventDefault();
      const amount = Number(new FormData(event.currentTarget).get('amount'));
      if (!Number.isFinite(amount) || amount <= 0 || amount > gameState.credits) return;
      if (lxaAccount) {
        // v157: same retry-duplication risk as spin (see pendingSpinRequestId) -
        // a deposit that the client times out on but the server already
        // completed must not become a second real transfer if the user retries.
        const requestId = pendingDepositRequestId || (pendingDepositRequestId = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`));
        try {
          const result = await lxaRequest('deposit', { id: lxaAccount.id, amount, requestId });
          pendingDepositRequestId = null;
          lxaAccount = result.account; lxaStore();
          gameState = game.initialState({ ...gameState, credits: Number(lxaAccount.balance), bank: Number(lxaAccount.bank) });
          persist(); accountPanel.hidden = true; renderGameV79();
        } catch (error) {
          if (!/timed out/i.test(error.message || '')) pendingDepositRequestId = null;
          $('#message').textContent = error.message || T118('geldFail');
        }
        return;
      }
      gameState.credits = Math.round((gameState.credits - amount) * 100) / 100;
      gameState.bank = Math.round((gameState.bank + amount) * 100) / 100;
      normalizeLocalBet(); persist(); accountPanel.hidden = true; renderGameV79();
    };
  }
  // v152 BUG FIX: for a logged-in account this used to ALWAYS do local-only
  // math on gameState (never called the server), regardless of lxaAccount
  // - so a purchase looked like it worked (LVL went up, money went down)
  // but Firebase's real account.wildLevel was never touched. The very next
  // spin re-syncs gameState from the server's real (unchanged) account, so
  // the level visibly snapped back down - this is exactly the "level up
  // Wild, spin, Wild level resets" bug. Root cause: this capture-phase
  // listener (added later, see comment below) always ran BEFORE and fully
  // replaced the older lxaBuyWild() (still defined above, bubble-phase),
  // which DID call the real server action correctly - it just never got a
  // chance to run. Fix: route logged-in purchases through the real
  // 'buy-wild' server action (same call lxaBuyWild already made), keep
  // the local-only path for guests (correct as-is - no server account to
  // desync from).
  async function buyWildDirectly() {
    if (spinning) return;
    if (lxaAccount) {
      try {
        const result = await lxaRequest('buy-wild', { id: lxaAccount.id });
        lxaAccount = result.account; lxaStore();
        gameState = game.initialState({ ...gameState, credits: Number(lxaAccount.balance), bank: Number(lxaAccount.bank), wildLevel: Number(lxaAccount.wildLevel), wildInventory: Number(lxaAccount.wildInventory) });
        persist(); renderGameV79();
        $('#message').textContent = `${T118('wildLevel')} ×${lxaAccount.wildLevel} · ${euro(result.cost)}`;
      } catch (error) { $('#message').textContent = error.message || T118('geldFail'); }
      return;
    }
    const cost = game.wildUpgradeCost(gameState.wildLevel);
    if (gameState.wildLevel >= game.WILD_LEVEL_MAX || (Number(gameState.credits) || 0) + (Number(gameState.bank) || 0) < cost) return;
    const fromBank = Math.min(Number(gameState.bank) || 0, cost);
    const fromCredits = cost - fromBank;
    if (gameState.credits < fromCredits) return;
    gameState.bank = Math.round((gameState.bank - fromBank) * 100) / 100;
    gameState.credits = Math.round((gameState.credits - fromCredits) * 100) / 100;
    gameState.wildLevel += 1;
    gameState.wildInventory = gameState.wildLevel;
    normalizeLocalBet(); persist(); renderGameV79();
    $('#message').textContent = `${T118('wildLevel')} ×${gameState.wildLevel} · ${euro(cost)}`;
  }
  // Capture phase prevents the legacy account-only handlers from opening a login panel.
  $('#buyWild')?.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); buyWildDirectly(); }, true);
  $('#deposit')?.addEventListener('click', event => { event.preventDefault(); event.stopImmediatePropagation(); openLocalMoneyPanel('deposit'); }, true);
  renderLeaderboard = async function (quiet) {
    lxaSetupLeaderboard();
    const x = lxaCopy(), level = Math.min(3, Math.max(1, Number(chance) + 1));
    const title = $('#leaderboardTitle'), difficulty = $('#leaderboardDifficulty'), tabs = $('#leaderboardTabs'), rows = $('#leaderboardRows'), position = $('#leaderboardPosition');
    if (!title || !tabs) return;
    title.textContent = T118('leaderboard');
    const hint = $('#leaderboardHint'); if (hint) hint.textContent = ({ de: 'Rang = Gesamt-NETTO pro Stufe (Gewinn minus Einsatz, alle Runden)', ro: 'Loc = NETTO total pe nivel (câștig minus miză, toate rundele)', en: 'Rank = total NET per level (payout minus stake, all rounds)' }[lang] || '');
    difficulty.textContent = `${level}/3`;
    tabs.innerHTML = Array.from({ length: 3 }, (_, index) => `<button class="${index + 1 === level ? 'active' : ''}" data-level="${index + 1}">${index + 1}/3</button>`).join('');
    tabs.querySelectorAll('button').forEach(tab => tab.onclick = () => { chance = Number(tab.dataset.level) - 1; gameState.difficulty = chance + 1; persist(); refreshChance(); renderLeaderboard(); });
    if (!quiet) rows.innerHTML = `<li class="leaderboard-loading">…</li>`;
    try {
      const query = new URLSearchParams({ action: 'leaderboard', difficulty: String(level) });
      if (lxaAccount) query.set('id', String(lxaAccount.id));
      const response = await fetch(`${LXA_API}?${query}`), data = await response.json();
      if (!response.ok) throw new Error(data.error);
      rows.innerHTML = data.records?.length ? data.records.map((record, index) => `<li><b>${index + 1}</b><span>${lxaEsc(record.name)}</span><strong>${Number(record.score || 0).toLocaleString(lang === 'en' ? 'en-US' : 'de-DE')}</strong></li>`).join('') : `<li class="leaderboard-empty">${x.empty}</li>`;
      position.textContent = lxaAccount && data.yourPosition ? `${x.your}: #${data.yourPosition}` : '';
      // V165 fix: the backend never stores a "position" field on the account
      // object itself (only this leaderboard call returns yourPosition), so
      // #leaderboardRank (which reads lxaAccount.position) always showed
      // the "LOC #—" fallback. Mirror it onto lxaAccount here and re-render
      // so the rank line picks up the real value.
      if (lxaAccount) { lxaAccount.position = data.yourPosition || null; if (!spinning) renderGameV79(); }
    } catch { rows.innerHTML = `<li class="leaderboard-empty">${x.offline}</li>`; if (position) position.textContent = ''; }
  };
  // V96 keeps GELD and RESET separate. The HTML keeps its compact original
  // action markup while this creates the fourth matching action at runtime.
  if (!$('#geld')) {
    const resetAction = $('#reset');
    if (resetAction) {
      const geldAction = document.createElement('button');
      geldAction.className = 'money-action';
      geldAction.id = 'geld';
      geldAction.type = 'button';
      geldAction.innerHTML = `<b>${T118('geld')}</b>`;
      resetAction.before(geldAction);
    }
  }
  const resetButton = $('#reset');
  const geldButton = $('#geld');
  // GELD LIMITER (v151) — guest-only nudge toward creating an account.
  // Deliberately NOT tamper-proof (clearing site data resets it) - it's a
  // soft nudge, not enforcement, per explicit user request. Logged-in
  // accounts stay on the server's own GELD_LIMITS (lxa-account.js),
  // which is left disabled/unlimited on purpose: unlimited GELD is the
  // reward for having an account instead of playing as a guest.
  const GELD_LIMITS = { enabled: true, cooldownHours: 24, maxUsesPerDay: 1 };
  const GELD_HISTORY_KEY = `${STORAGE_KEY}:geldHistory`;
  const readGeldHistory = () => { try { return JSON.parse(localStorage.getItem(GELD_HISTORY_KEY) || '[]'); } catch { return []; } };
  const writeGeldHistory = history => { try { localStorage.setItem(GELD_HISTORY_KEY, JSON.stringify(history.slice(0, 50))); } catch {} };
  geldButton?.addEventListener('click', async event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (spinning) return;
    if (gameState.credits > 25000) {
      setMsg(T118('geldOnly', euro(25000)));
      return;
    }
    if (GELD_LIMITS.enabled && !lxaAccount) {
      const now = Date.now(), dayMs = 24 * 60 * 60 * 1000, cooldownMs = GELD_LIMITS.cooldownHours * 60 * 60 * 1000;
      const history = readGeldHistory().filter(ts => now - Number(ts) < dayMs);
      const lastUse = history[0];
      if (lastUse !== undefined && now - lastUse < cooldownMs) { setMsg(T118('geldDaily')); return; }
      if (history.length >= GELD_LIMITS.maxUsesPerDay) { setMsg(T118('geldDaily')); return; }
      history.unshift(now); writeGeldHistory(history);
    }
    // GELD refills only GUTHABEN. BANK, Wild, jackpot progress and history
    // remain untouched; RESET is the only complete new-game action.
    if (lxaAccount) {
      try {
        const result = await lxaRequest('reset-geld', { id: lxaAccount.id });
        lxaAccount = result.account; lxaStore();
        gameState = game.initialState({ ...gameState, credits: Number(lxaAccount.balance), bank: Number(lxaAccount.bank), wildLevel: Number(lxaAccount.wildLevel), wildInventory: Number(lxaAccount.wildInventory), recordHits: lxaAccount.records, completedLines: lxaAccount.completedLines, jackpotFinished: lxaAccount.jackpotFinished, difficulty: lxaAccount.difficulty });
      } catch (error) { setMsg(error.message || T118('geldFail')); return; }
    } else gameState.credits = 250000;
    gameState.bet = game.recommendedBet(gameState.credits);
    gameState.lastWin = 0;
    persist();
    $('#gross').textContent = euro(0);
    $('#before').textContent = euro(250000);
    $('#after').textContent = euro(250000);
    setMsg(T118('geldDone', euro(250000)));
    renderGameV79();
  }, true);
  resetButton.onclick = async () => {
    if (lxaAccount && !await lxaConfirm(T118('resetConfirm'))) return;
    stopAutoSpin();
    // RESET is the only new-game action: clear every game field, including
    // BANK, Wild level, jackpot, history and difficulty progress.
    if (lxaAccount) {
      try { const result = await lxaRequest('reset-new-game', { id: lxaAccount.id }); lxaAccount = result.account; lxaStore(); } catch (error) { setMsg(error.message || T118('resetFail')); return; }
    }
    localStorage.removeItem(STORAGE_KEY);
    gameState = game.initialState();
    persist();
    render(Array.from({ length: game.LINE_COUNT }, () => target.slice()));
    $('.win-board')?.classList.remove('show');
    $('#gross').textContent = euro(0); $('#before').textContent = euro(250); $('#message').textContent = T118('resetDone', euro(250));
    renderGameV79();
  };
  reportBalance();
  renderGameV79();
  renderLeaderboard();
  // V366: the guest status line (GUEST · RUNDA · DIFICULTATE) now lives in
  // #leaderboardRank too, set by renderGameV79() above. updateStaticCopy()
  // (called by applyLanguage(), which can run before gameState exists, e.g.
  // the very first page-load call at the top of this file) no longer
  // touches that element, so a language switch needs its own re-render
  // here - same monkey-patch pattern as the applyLanguage wraps above.
  const v366ApplyLanguage = applyLanguage;
  applyLanguage = () => { v366ApplyLanguage(); renderGameV79(); };
})();

/* V159: move .quick-info (JACKPOT MISSION / WILD BANK explainer cards) so it
   sits right before .bottom-grid (LETZTE RUNDEN / AUSZAHLUNGSLOGIK) instead of
   at the very end of the page, per user request. Plain DOM move, once. */
(() => {
  const info = document.querySelector('.quick-info');
  const bottomGrid = document.querySelector('.bottom-grid');
  if (info && bottomGrid && bottomGrid.parentNode) {
    bottomGrid.parentNode.insertBefore(info, bottomGrid);
  }
})();

/* V109: concise player rules and the legal demo notice follow the active UI language. */
(() => {
  const infoCopy = {
    de: { mission: 'JACKPOT MISSION', missionText: 'Erreiche <b>5 verschiedene Linien mit 10/10</b>. Nach <b>5/5</b> beginnt die Mission erneut.', bank: 'WILD BANK', bankText: 'Geld aus der BANK unterstützt WILD-Upgrades.' },
    ro: { mission: 'MISIUNE JACKPOT', missionText: 'Completează <b>5 linii diferite la 10/10</b>. După <b>5/5</b>, misiunea începe din nou.', bank: 'WILD BANK', bankText: 'Banii din BANK contribuie la upgrade-ul WILD.' },
    en: { mission: 'JACKPOT MISSION', missionText: 'Complete <b>5 different lines at 10/10</b>. After <b>5/5</b>, the mission starts again.', bank: 'WILD BANK', bankText: 'Money in BANK contributes to WILD upgrades.' }
  };
  const previousApplyLanguage = applyLanguage;
  applyLanguage = () => {
    previousApplyLanguage();
    const copy = infoCopy[lang] || infoCopy.de;
    const panels = document.querySelectorAll('.quick-info > div');
    if (panels[0]) { panels[0].querySelector('strong').textContent = copy.mission; panels[0].querySelector('span').innerHTML = copy.missionText; }
    if (panels[1]) { panels[1].querySelector('strong').textContent = copy.bank; panels[1].querySelector('span').innerHTML = copy.bankText; }
    const footer = document.querySelector('footer');
    if (footer) footer.textContent = t[lang].footer;
    window.__renderLastWinV116?.();
    // V118: every dynamic block follows the language switch immediately.
    try { renderLeaderboard(); } catch {}
  };
  applyLanguage();
})();
// The local V84 renderer owns credits, BANK and Wild inventory.
lxaSaveState=async()=>{if(lxaAccount){try{const result=await lxaRequest('set-difficulty',{id:lxaAccount.id,difficulty:chance+1,token:lxaToken});if(result.account){lxaAccount=result.account;lxaStore()}}catch{}}};
const lxaRenderV76=render;render=function(grid){lxaRenderV76(grid);document.querySelectorAll('.wild-symbol img').forEach(image=>{image.title=`BONUS WILD · ${window.__wildChancePct||50}%`});};

/* V152: chance-control now lives statically in index.html right after
   win-board. Do NOT move it via JS anymore — a prior version of this IIFE
   forced it back down next to .quick-info on every language switch, which
   is why the GEWINNCHANCE slider kept reappearing at the bottom no matter
   what else was tried. Only keep the footer pinned last. */
(() => {
  const placeFooterLast = () => {
    // V159: .quick-info no longer sits right before <footer> (it now lives
    // above .bottom-grid), so pin footer as the last child of <main> instead
    // of "after .quick-info" — otherwise footer would jump back to the
    // middle of the page on every language switch.
    const footer = document.querySelector('footer'), main = document.querySelector('main.machine');
    if (footer && main && main.lastElementChild !== footer) main.appendChild(footer);
  };
  const previousApplyLanguageV111 = applyLanguage;
  applyLanguage = () => { previousApplyLanguageV111(); placeFooterLast(); };
  placeFooterLast();
  applyLanguage();
})();

















/* V133 removed (2026-09-30, user request): this used to float the lock
   (+ Ko-fi gif) and, since V325, the language + account buttons too, into
   a fixed top-right corner clone once the header scrolled out of view on
   phones (desktop never did this - see the old V309 note). User wants all
   three to just stay put in the header row, always, on every device -
   never detach/float. Removing the whole mechanism (not just disabling the
   phone branch) means the elements simply render at their normal static
   CSS position all the time, which is exactly that. */

// V314: install-app (PWA "Add to Home Screen") button removed entirely —
// it wasn't firing/working reliably and only got in the way of the other
// floating elements. Idea + original code preserved in
// INSTALL_BUTTON_IDEA.txt if this should be revisited later.

// Scroll lock that holds in every browser: wheel/touch are blocked above; on top of that the scroll position
// is pinned (scrollbar drag, middle-click autoscroll, find-in-page...) and scroll keys are swallowed.
(function pinScrollWhenLocked() {
  let lockY = 0;
  const locked = () => document.body.classList.contains('scroll-locked') && window.matchMedia('(pointer:coarse)').matches;
  new MutationObserver(() => { if (locked()) lockY = window.scrollY; }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('scroll', () => { if (locked() && Math.abs(window.scrollY - lockY) > 0.5) window.scrollTo(0, lockY); }, { passive: true });
  document.addEventListener('keydown', event => {
    if (!locked()) return;
    const tag = event.target && event.target.tagName;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
    if (['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'].includes(event.key) || (event.key === ' ' && tag !== 'BUTTON')) event.preventDefault();
  });
})();
try{ lxaWatchVersion(); }catch(e){ /* the update notice is optional */ }
