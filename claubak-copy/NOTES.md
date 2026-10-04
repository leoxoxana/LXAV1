# ClauBack / LXAV1 — memorie + istoric versiuni LXAV1

Acest folder e arhiva mea de lucru pentru proiectul LXAV1 (C:\Users\leon4\Desktop\LXAV1), construit după același model ca `ClauBack\NOTES.md` + `ClauBack\CONTEXT\*`
de la Drollyv3 (acelea rămân neatinse, sunt doar inspirație/istoric).

## Cum e organizat
- `CONTEXT\` = cele 4 documente de reluare (rescrise de la zero pe 2026-10-03, la commit c82da19):
  - `CONTEXT.md`      — starea curentă, ce s-a făcut recent, ce rămâne deschis, pașii următori, predarea către cloud. CITEȘTE-L PRIMUL la reluare.
  - `MEMORY.md`      — cunoștințe permanente verificate: regulile userului, regulile jocului, conturi/Firebase/configurare, deploy, sistemul CSS, PWA, unelte, greșeli, ce NU e verificat.
  - `ARCHITECTURE.md`— cum e construită aplicația (fișiere, motor, server, flux de spin, conturi, UI, persistență). Se deschid doar secțiunile relevante.
  - `CHANGELOG.md`   — jurnal pe modificări, cele mai noi primele (cu hash-uri de commit).
- `FULL_<data>_<commit>\` = copie completă a proiectului (fără node_modules/.git) ca punct de revenire independent de git. NU conține și nu trebuie să conțină `.env.local` (secrete).
- `vN\` = fișierele atinse la o modificare, cu structura relativă față de rădăcina LXAV1, plus `README.md`. Numărătoarea pornește de la v1 pentru LXAV1 (Drollyv3 a ajuns la v29).
- `PROMPTS\` = prompturile de lucru: `UNIVERSAL_PROMPT.md` (CEL PRINCIPAL: merge în orice chat/model/sesiune, locală sau cloud, cu sau fără unelte; are setări TASK/MODE/SCOPE/LANG/DETAILS și fișa proiectului
  inclusă), plus `MASTER_AUDIT_v2.md` (audit complet) și `MASTER_AUDIT_LITE.md` (o pagină). Oglindite în repo: `docs-context\prompts\`.
- Aceleași 4 documente sunt oglindite în repo, în `docs-context\` (le citește și o sesiune cloud). Actualizează-le pe amândouă și fă commit.

## Reguli de lucru
- Înainte de orice: citesc `CONTEXT\CONTEXT.md` + `CONTEXT\MEMORY.md`, apoi `git status` / `git log -5` / `git rev-list --count origin/main..HEAD`.
- După o modificare reală: (1) verific măsurat (Edge headless/CDP incl. standalone real, Jest, lint), (2) commit local cu trailer, (3) salvez fișierele atinse în `vN` + README,
  (4) actualizez CHANGELOG.md, CONTEXT.md și, dacă am aflat ceva permanent, MEMORY.md, (5) oglindesc cele 4 documente în `docs-context\`. Backup-urile sunt aprobate dinainte.
- NU dau deploy și NU fac push pe GitHub (doar userul rulează `vercel --prod`); termin cu „rulează vercel --prod din folderul LXAV1".
- Răspunsuri scurte, numerotate, în română. Spun sincer ce nu am putut verifica (iPhone/Android real etc.).
- Nu rescriu fișiere UTF-8 cu PowerShell Get-Content/Set-Content (strică diacriticele și €) — Python cu `encoding='utf-8', newline=''` sau Edit.
- După teste cu Edge headless șterg folderele `edgeprof_*` din scratchpad (au umplut odată discul C:).

## Istoric versiuni
- FULL_2026-10-03_116ffd8 (2026-10-03): copie completă (66 fișiere, 17,5 MB, fără .env.local) la HEAD 116ffd8, înainte de rundele de după. Redundantă cu istoricul git; păstrată doar ca rezervă offline.
- v1 (commit 6617547): miza se poate schimba în timpul AUTO (se aplică runda următoare, cu aceleași plafoane). renderer.js + index.html (v=400).
- v2 (commit 0cf92c8): același spațiu (6 px) sub header în browser, PWA și PC. layout-fix.css (v=432).
- v3 (commit 4b47b47): suprapunere diagnostic `?debug=1` pentru SPIN. renderer.js v=401, spin-button.js v=8.
- v4 (commit a74b4cc): PWA fără ceață violet deasupra literelor LXA. layout-fix.css (v=433).
- v5 (commit 37fae14): iconițe Android comprimate (fără ?v), card Jackpot Mission mai aerisit, erori de spin vizibile sub SPIN (de/ro/en). layout-fix v=434, renderer v=402, spin-button v=9.
- v6 (commit 9acb861 + merge 239c766): audit — citiri Firebase fail-closed, IP real pe Vercel, .vercelignore, litere + GIF Ko-fi mai mici, aria pe slider, eticheta „WILD xN - %” scoasă (renderer v=403). 63 teste.
- v7 (commit 32bf9e7): ID-uri de cont atomice (contor Firebase meta/lastAccountId) + Permissions-Policy/COOP în vercel.json. 64 teste.
- v8 (commit 4f748aa): login persistent (sesiuni per dispozitiv, hash), logout real, fără login cu ID+nume, GELD autentificat, AUTO așteaptă 800 ms la schimbarea mizei. renderer v=404. 76 teste + 21 verificări end-to-end.
- v9 (commit 90d32ac): accesibilitate - inel de focus vizibil la tastatura, nume de zone in de/ro/en; audit DEEP runda 3 (greutate 1,7 MB, LCP 484 ms, offline OK). renderer v=405, layout-fix v=435.
- v10 (commit 210872f): comutator RTP conectat/deconectat in Admin Panel + model exact al RTP-ului total (linii + WILD + jackpot), validat prin simulari. game-engine v=377, renderer v=406, layout-fix v=436. 89 teste.
- v11: reguli Firebase salvate (database.rules.json), deploy live verificat (renderer v=406). Setari RTP productie: 130/110/95 in mod linii.
- v12 (commit c138f58): fara rotunjiri - motorul pentru oaspeti plateste cu zecimale ca serverul; acelasi RTP la orice miza. game-engine v=378. 91 teste.
- Starea de la ultima scriere: codul = commit c82da19, publicat pe GitHub de user (origin/main = c82da19); după el doar commit-uri de documente (a02275e și următoarele), posibil nepublicate.
  Nimic după 116ffd8 nu e confirmat deployat. Branch-uri făcute de sesiuni cloud pe GitHub: main-hsvmm0 (îmbinat local, se poate șterge), claude/project-thread-n4n2yo (vechi, NU îl îmbina).
- (următoarea modificare reală → v7)
- v13 (commit 40b7cc0): popup admin cu scroll (portrait + landscape), miza centrata pe +/-, buton SPIN restilizat in starea STOP, steag 2.5 px mai jos, Ko-fi sub lacat. renderer v=407, layout-fix v=437. 91 teste.
- v14 (commit 1f747fb): buton SPIN v2 - fara suma pe buton, cuvant mai mare si centrat, icoana, clipire aurie la profit / puls rece la pierdere cu plata, stare fara bani. spin-button v=10, renderer v=408, layout-fix v=438. 91 teste.
- v15 (commit 7af0380): buton SPIN v3 - explozie aurie 2.2 s la profit, coral 1.1 s la plata sub miza, inel de rezultat pana la urmatorul SPIN, icoane play / dublu play / stop. spin-button v=11, layout-fix v=439. 91 teste.
- v16 (commit eff2d16): lacat + Ko-fi plutitor pe aceeasi coloana ca in antet, spatiu 4 px in ambele stari, fara salt orizontal la derulare. layout-fix v=440.
- v17 (commit 6f48557): rezultatul pe buton SPIN prin culoarea cuvantului + icoanei (auriu profit / roz-rosu plata sub miza) in loc de inel; STOP neschimbat. layout-fix v=441.
- v18 (commit 93af522): culoarea rezultatului pe SPIN din prima clipa; AUTO face pauza 1 s dupa profit. renderer v=409, layout-fix v=442.
- v19 (commit 9573c34): rocada antet - lacatul + Ko-fi schimba locul cu steagul fara suprapunere, apoi aluneca in colt; ID ramane pe loc. layout-fix v=443.
- v20 (commit 94595bd): cuvant SPIN verde (mint #3dffa8) la profit + animatia aurie puternica fara transparenta. layout-fix v=444.
- v21 (commit 4649848): antet - inapoi la look-ul vechi (ID + steag aluneca) cu 'dock reveal': lacat + Ko-fi se estompeaza pe loc si coboara in coloana din antet dupa ce steagul a urcat; fara rocada. layout-fix v=446.
- v22 (commit 401af75): antet dock legat de pozitia de scroll (lacat+Ko-fi se estompeaza, ID+steag aluneca, perechea urca in colt) - fara salturi. layout-fix v=450.
- v23 (commit 30d493f): antet - revenire la comportamentul original (ID+steag aluneca, lacat+Ko-fi mereu vizibile) + lacatul deasupra steagului (z-index). Experimentele v16, v19, v21, v22 anulate. layout-fix v=452.
- v24 (commit 9f96b1d): antet - rotatie [lacat][ID][steag] fara suprapunere, lacatul mereu vizibil; apoi dock in colt. layout-fix v=453. Varianta anterioara (original + lacat deasupra steagului) = v23.
- v25 (commit 02859b3): antet - ordinea ramane mereu [ID][steag][lacat]; lacatul + Ko-fi isi pastreaza coloana, urmaresc pagina si raman sus (sticky). Fara alunecare, fara rocade. layout-fix v=455.
- v26 (commit 548071d): antet - lacat + Ko-fi sticky in coloana lor; ID + steag aluneca in locul lacatului doar la momentul sigur (fara suprapunere). layout-fix v=456. Variante de rezerva: v23, v25.
- v27 (commit 5a39649): TEST antet - alunecare la 20 px de scroll (in jos), revenire cand steagul e la 20 px deasupra zonei lacatului, 0.30 s. Suprapunere steag-lacat ~18 px de scroll la coborare. Varianta sigura = v26. layout-fix v=457.
- v28 (commit ee7a503): antet - alunecare declansata geometric (steagul urcat la 65% din inaltimea lui sub varful lacatului), 0.45 s in / 0.18 s inapoi, revenire cand steagul e la 20 px deasupra lacatului. Varianta fara suprapunere = v26. layout-fix v=458.
- v29 (commit afbb303): antet - alunecarea depinde doar de pozitia steagului (fara memoria directiei): aceeasi pozitie = acelasi rezultat. Suprapunere steag-lacat ~20 px de scroll in ambele sensuri. layout-fix v=459.
- v30 (commit e715a02): antet - alunecarea cu 5 px mai tarziu (SLIDE_LATER 5); alunecare la 24-30 px de scroll. layout-fix v=460.
- v31 (commit 6dabb86): lacat + Ko-fi plutitori inapoi la marginea cardurilor (lacat 2 / 4 / 17 / 29 px de marginea dreapta), cu deplasare lina legata de scroll pana la pin. layout-fix v=461.
- v32 (commit 7219599): tot randul de iconuri aliniat cu cardurile (emoji lacat la 1 px in interiorul marginii cardurilor) si la repaus si la plutire; fara derivare laterala. layout-fix v=463.
- v33 (commit 54116ea): aplicatia instalata - 10 px mai mult spatiu deasupra bannerului LXA; lacatul plutitor sub bara de stare (safeTop masurat live, nu din cache). layout-fix v=464.
- v34 (commit 6d8f012): fum roz-mov in spatele bannerului LXA pe ecrane portrait inguste (<=500 px), la fel ca pe landscape; scrim mai usor in aplicatia instalata. layout-fix v=470.
- v35 (commit bf2f6b8): lumina din spatele bannerului centrata pe logo-ul vizibil (nu pe cutia imaginii); partea dreapta nu se mai pierde. layout-fix v=471.
- v36 (commit 2a61078): header adaptiv pe toate ecranele, lumina bannerului centrata pe logo (geometrie reala), coloanele LINIA 1-5 = coloanele sumelor 5-25 EUR, popup propriu pentru RESET (nu mai e confirm() nativ), pozitia in clasament nu mai e '#-'. layout-fix v=473, renderer v=410. 93 teste.
- v37 (commit 453f465): randul ID/steag/lacat la 60% din inaltimea logo-ului, liniile orizontale (rails) trec prin randul de icoane, primul card la 6 px sub logo pe orice ecran; lacatul se fixeaza la min(14 px + inset, pozitia randului). layout-fix v=477.
- v38 (commit d3c72a2): notificare 'versiune noua disponibila' pentru taburi/aplicatii deschise; actualizarea antetului la fiecare cadru dupa load/rotire/resize + try/catch; linie de diagnostic in ?debug=1; verificat in WebKit real (Playwright). layout-fix v=478, renderer v=411.
- v39 (commit f8dd0ef): sesiuni - cererea unui dispozitiv nu mai sterge sesiunea creata de alt dispozitiv (bug 'delogat cand ies si intru'); MAX_SESSIONS 25; 97 teste.
- v40 (commit e363ba0): sesiunea se restaureaza doar cu tokenul (fara cache/id), cerere storage.persist, jurnal 'de ce am fost delogat' (?debug=1), parola se scrie direct in panoul KONTO (fara logout); 99 teste. renderer v=412, layout-fix v=479.
- v41 (commit bf2b8b0): diagnostic de autentificare in aplicatia instalata: 5 atingeri pe titlul KONTO arata blocul (fara ?debug=1). renderer v=413, layout-fix v=480.
- v42 (commit de5e081): parola ramane salvata pe dispozitiv (lxa-safe-v1, decizia proprietarului) + cookie httpOnly lxa_sid care readuce sesiunea chiar daca telefonul sterge localStorage (optiunea C); 106 teste. renderer v=414.
- 2026-10-03: CONFIRMAT de proprietar ca ramane logat si parola apare (v39-v42 live, origin/main = local la 8a58a46). Daca apare iar delogare: apasa de 5 ori pe titlul KONTO (aplicatie) sau ?debug=1 (tab) si citeste jurnalul 'auth'. Sonda live cu cookie: foloseste curl.exe, nu Invoke-WebRequest (arunca antetul Cookie).
- v43 (commit 2d64fa3): logout fara internet se termina la urmatoarea pornire (cookie-ul nu mai readuce sesiunea); renderer v=415. Ramase deschise (decizii ale proprietarului): Android Install app (model telefon + browser), conturi de test Firebase de sters, CSP unsafe-inline, contrast, cursa la nume, imagini nefolosite.
- v44 (commits 35c9f09, 5a6be8b): cursa la nume inchisa (rezervare atomica meta/names), CSP script-src 'self' (3 scripturi inline mutate in header-fit.js, boot-wild-preload.js, sw-register.js, ?v=1 - creste-l cand le editezi). Ramase: contrast 3 etichete mici, Android Install app, conturi de test Firebase.
- v45 (commits 1c768c2, 99c2ef9): player radio compact deasupra barei Ko-fi (api/radio: Radio Browser, doar RO HTTPS MP3/AAC, verificat real, cache memorie + Firebase meta/radio, cron zilnic); 196 stream-uri romanesti functionale, minim 23 pe categorie, fara stratini; reparata notificarea falsa 'versiune noua' (regresie CSP). Teste Edge: foloseste --disable-extensions (profilurile noi isi instaleaza extensii si se reincarca).
- v46 (commits 4cc3c0a, d7062f7): radio v2 (â® â­, favorite, recente, ðŸŽ², cronometru de somn, eco, reconectare, stationile cazute memorate 24h, linie de stare), fiecare statie in max 2 categorii, RADIO_HIDE (env Vercel), functiile Vercel in fra1 (baza de date e in europe-west1). 129 teste; e2e_radio 18/18 + e2e_radio2 20/20. radio.js v=3, layout-fix v=483.
- v47 (commits 99c9bf8, 91873f1): stiluri de manele (trap/tehno, vechi, noi, etno, folclor) ca filtre in MANELE; 'trapanele' NU exista ca tag in Radio Browser (0 statii) deci stilul se deduce din taguri/nume; statii doar-HTTP recuperate prin varianta HTTPS (ex. Trapanele Radio); cuvinte fixate verificate primele; a doua sansa pentru verificari esuate sub incarcare. 138 teste; e2e_radio3 13/13. radio.js v=4, layout-fix v=484.
- v48 (commit 14a35ec): MANELE in ordinea gustului proprietarului: trap/tehno primele, manele noi, restul, folclor+etno la urma; nimic sters; butoanele de folclor/etno scoase; flacara fire icon = top popularitate (semnal de la server). radio.js v=5.
- v49 (commit dc37d61): MANELE arata TOATE statiile de manele care merg (~70 in loc de 36): limite proprii, manele explicit pastrat mereu in categorie, 5 trepte (trap/tehno/electro/house/minimal/club, noi, manele, doar-petrecere, folclor+etno la urma). Electro/minimal/tehno manele NU exista in director (0 statii). Site-ul live rula inca lista veche v46 (Radio Folclor era #6). Discul C: s-a umplut din profile Edge de test (curatate, scripturile folosesc acum robocopy).
- 2026-10-04: DISC C: era la 0 GB din resturile testelor (profile Edge de test, scoped_dir*, fisiere .tmp de extensii Cr24, cache npm); curatat 10,6 GB (liber 16,95 GB). Scripturile de test: --disable-extensions, curatare cu robocopy, opresc DOAR Edge-ul de test (cu --remote-debugging-port), nu pe cel al utilizatorului. Detalii in memoria 'disk-full-test-profiles'.
- v50 (commit 8d57da2): lista de radio se reconstruieste singura dupa fiecare deploy (versiune = hash al builder-ului), CDN 300 s, cache pe telefon v2. Live: lista veche (39 manele) era servita din cache dupa deploy; am rebuilt pe productie cu /api/radio?refresh=1 -> 68 manele.
- v51 (commit 39a1919): clasamentul se reface din conturile reale (fara randuri orfane / nume vechi / scoruri vechi), loc = pozitia in lista afisata, PLATZ nu mai cade pe #- dupa spin, criteriul scris sub lista (NETTO total pe nivel); panou LINIEN: titlu magenta, NETTO + BRUTTO pe un rand. renderer v=418, layout-fix v=486.
- v52 (commits cf3c565 + 83c8343): radio: proba dubla server+telefon, re-verificare la 3 ore, rapoarte anonime (automat + buton steag) in Firebase radioReports, ADMIN > rapoarte statii (test / ascunde / sterge) cu lista ascunse in meta/radioHide; meniul ADMIN grupat pe categorii (JOC / JUCATORI & CLASAMENT / RADIO). renderer v=421, layout-fix v=488, radio.js v=8.
- v53 (commit 59bcf69): radio fara bara de stiluri; radiolize.com blocat (Marketescu nu merge pe telefonul lui); rapoartele retin codecul. renderer v=422, layout-fix v=489, radio.js v=9.
- v54 (commit bad267e): MANELE pastreaza maxim 5 statii populara/folclor/etno/petrecere-only (cele mai ascultate), ultimele, fara emoji; flacara doar pe manele; ADMIN > RADIO un rand pe statie cu contor, ASCUNSA + butoane Ascunde/Arata. renderer v=423, layout-fix v=490.
- v55 (commit 054be5e): zoom iOS: toate campurile >= 16px (32 din 66 erau sub), antetul inghetat cat timp pagina e marita cu 2 degete, fara zoom la dublu-tap, listele nu trag pagina. - v56 (commit 07692da): radio 12 categorii (MANELE ETNO RAP HOUSE TECHNO DANCE POP ROCK CHILL RETRO GLOBAL TOP) 3x4; ADMIN > RADIO: tab Statii (muta orice statie in orice categorie, ascunde/arata, cauta); steaua jucatorilor alimenteaza TOP (un contor pe statie). radio.js v=10, admin-radio.js v=1, renderer v=424, layout-fix v=493.
- v57 (commit 695365b): lacat + zoom: meta viewport nu mai e rescris, cu pagina marita lacatul lasa degetele sa miste / micsoreze; ADMIN > RADIO doar emoji (🔍 📂 ↩ 🙈 👁️ 🗑️), 10 chipuri emoji pentru mutare, tab Statii cu TOATE statiile; panoul trezeste singur construirea listei dupa deploy; PLATZ nu mai ramane # in AUTO; fara hover lipit pe iOS. renderer v=426, layout-fix v=495, radio.js v=11, admin-radio.js v=3.
- v57b (commit 9dbd750): meta viewport minimum-scale=1: pagina nu se mai poate micsora sub marimea normala (lacatul si Ko-fi pluteau in afara site-ului).
- v57c (commit 1a3e30e): ADMIN > RADIO: butonul de sters rapoarte e acum ✅ (rezolvat, fara dialog); dialogul de confirmare era SUB panoul admin (z 3000 < 5000), acum 6000 cu fundal usor. renderer v=427, layout-fix v=496.
