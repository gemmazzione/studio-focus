# Studio — guida per Claude Code

## Avvio rapido

Progetto web statico. Serve Node.js 18 o superiore. Non ci sono dipendenze da installare.

- `npm run dev` avvia http://127.0.0.1:5187.
- `npm run check` controlla sintassi e test dell'estensione.
- `npm run package:source` ricrea `dist/studio-extension.zip` e `dist/studio-source.zip`. Va lanciato dopo ogni modifica a `extension/`.

## File da modificare

- `dist/agenda.js`, `dist/agenda-core.js`, `dist/agenda.css`: Oggi, programma settimanale, modifica dei piani, collegamenti delle domande, cronologia e bozze. `agenda-core.js` espone funzioni pure testate da `agenda-check.cjs`.

- `dist/index.html`: struttura e testi italiani.
- `dist/style.css`: layout di base, responsive e accessibilità.
- `dist/premium.css`: tema “Quaderno” (token colore chiaro/scuro, font, composizione). Caricato dopo style.css: i colori si cambiano dai token in `:root`.
- `dist/app.js`: timer, sessioni, richiamo attivo, ripassi, dati locali e collegamento estensione.
- `dist/experience.js`: Web Audio, volume, preferenze sonore e animazioni.
- `extension/`: estensione Manifest V3 per Chrome ed Edge.
- `dist/features.js` e `dist/features.css`: piani esame, domande, errori, avvio breve, modalità immersiva, importazione e fasce social.
- `dist/study-core.js`: pianificazione, validazione dei backup e intervalli di ripasso; utilizzabile anche da Node per i test.
- `extension/scheduler.js`: fasce settimanali, attraversamento della mezzanotte e composizione con le sessioni manuali.

## Nuove funzioni (v3)

## Estensione v4

`data.study.agendaEvents` contiene gli impegni manuali; `agendaOverrides` i giorni/orari e il completamento personale dei blocchi derivati. La coda delle domande usa ID comprensivi della scadenza per non trascinare gli spostamenti nei cicli di ripasso successivi. “Fatto” nell'agenda non certifica apprendimento né spunta un argomento del piano. La settimana usa date locali a mezzogiorno e parte dal lunedì.

Le domande conservano examId e topicId; gli argomenti mantengono ID quando vengono rinominati. La rimozione di un argomento libera il collegamento senza eliminare la domanda. I nuovi log salvano subject/question/solution come snapshot. Gli import v3 restano supportati e gli export sono v4.

Le bozze stanno in `data.study.drafts` e si scrivono senza evento studio:saved per evitare ricostruzioni dei moduli mentre si digita. `studio:before-restore` sospende la scrittura delle bozze prima della ricarica di un backup: NON rimuovere questa guardia, altrimenti pagehide sovrascrive i dati ripristinati. `studio:practice-open` e `studio:practice-graded` gestiscono bozze dei tentativi. `studio:features-rendered` notifica le viste collegate. I moduli dinamici devono conservare label e focus.

I dati aggiuntivi sono in `data.study` dentro `studio.v1`: exams/cards/errors/schedules/logs/seenSessions. I backup v3 includono anche audio, con validazione prima del ripristino, unione per ID o sostituzione e copia pre-importazione in studio.pre-import. Il ripristino non riavvia sessioni vecchie e conserva l'ID dell'estensione del browser attuale.

`studio:saved` collega il diario alla raccolta degli errori e aggiorna le viste. Non inviare questo evento in cicli senza guardia. Il completamento di un argomento d'esame è esplicito; il tempo del timer non prova l'apprendimento. Le sessioni pianificate rispettano i minuti previsti, con blocchi al massimo di 90 minuti. Il richiamo di domande è autovalutato e la soluzione resta nascosta fino a un tentativo.

L'estensione 2.0 riceve SET_SCHEDULES oltre a PING/START/STOP. STOP rimuove soltanto il blocco manuale; gli orari salvati restano efficaci. SUSPEND è riservato alla pagina popup dell'estensione e sospende per 15 minuti. Riconciliazione serializzata, allarmi ai confini delle fasce e controllo periodico. Non promettere blocco quando il browser è chiuso o il PC sospeso.

## Regole di prodotto

Conservare compatibilità con localStorage `studio.v1` e `studio.sound.v1`. Non cancellare i dati quando si cambia grafica. Mai dichiarare social bloccati senza conferma e scadenza dall'estensione. Non promettere blocco di app native o telefono. Audio sbloccato da un gesto utente; browser, scheda sospesa o chiusa possono impedire l'avviso. Rispettare prefers-reduced-motion, etichette, contrasto, focus tastiera e dimensioni mobili.

Il protocollo estensione è PING, START {domains,until}, STOP. Non ampliare le origini autorizzate senza motivo. Se cambia dominio di hosting, aggiornare ALLOWED in background.js e externally_connectable in manifest.json.

I ripassi NON si programmano da soli (richiesta esplicita dell'utente, v5): dopo una sessione (`#review-when`) o una domanda (`#practice-next`) l'utente sceglie se e quando ripassare; `due: null` significa senza data e l'elemento non entra in Oggi né nei contatori. Usare `StudyCore.isDue` e `StudyCore.nextDue`, mai `x.due <= now` (null vale 0). I ripassi nei piani d'esame sono un'opzione (`exam.reviews`, spenta per i piani nuovi, accesa per quelli vecchi). Con l'opzione attiva il piano riserva, quando possibile, l'ultimo giorno disponibile ai ripassi. Ogni argomento ha un breve richiamo in un giorno successivo al termine dello studio; l'intervallo di un giorno e la durata del 10% (5–15 minuti) sono euristiche modificabili, non un protocollo scientificamente ottimale. Un avviso segnala i ripassi che non trovano spazio. I blocchi del piano non attestano completamento: spetta allo studente spuntare l'argomento.

## Verifica

Provare avvio, pausa/ripresa, ricarica, passaggio alla verifica, salvataggio, pausa e ripasso. Provare i tre suoni tramite Prova il suono. Il suono scatta solo alla scadenza naturale di studio o pausa, non quando si termina in anticipo. I test in check.cjs simulano le API Chrome: non sostituiscono una verifica con l'estensione installata.

## Pubblicazione

Il sito principale è su AlterVista: https://samueleruggeri.altervista.org/studiofocus/ (FTP di `dist`, `.github/workflows/deploy.yml`, secrets FTP_SERVER/FTP_USERNAME/FTP_PASSWORD e variabile FTP_SERVER_DIR). Una copia è su GitHub Pages: https://gemmazzione.github.io/studio-focus/ (`.github/workflows/pages.yml`). Ogni push su `main` esegue `npm run check` e aggiorna entrambi; se i test falliscono, nessuno dei due viene aggiornato. L’estensione accetta messaggi da AlterVista, da `https://gemmazzione.github.io`, dal vecchio dominio chatgpt.site e da localhost: se cambia dominio, aggiornare ALLOWED in `extension/background.js` e externally_connectable in `extension/manifest.json`, poi `npm run package:source`.

## Design

App per studiare, non landing promozionale. Tema “Quaderno”: carta bianca, inchiostro blu-nero, penna blu (`--green`, nome storico) per azioni e avanzamento, penna rossa (`--warm`) solo per errori e scadenze. La quadrettatura con il margine rosso compare solo dove si scrive: pannello della sessione ed esercizi. Un solo font, Schibsted Grotesk. Tema scuro automatico con prefers-color-scheme. Titoli di pagina semplici (il nome della sezione), sottotitoli che dicono cosa fa la pagina: niente slogan nei titoli né titoli su due righe con parola colorata. Le frasi motivazionali (richieste dall'utente) stanno solo in `PHRASES` di `dist/goals.js`: frase del giorno sotto il titolo di Sessione e messaggio quando si completa un obiettivo. Frasi originali, concrete e senza autori inventati.

## Account e sincronizzazione

`dist/sync.js` aggiunge la pagina Account e sincronizza i dati con l'API PHP in `dist/api/` (stessa struttura di Scacchi da Zero, tabelle con prefisso `stf_` nel database condiviso my_samueleruggeri). Il server tiene per ogni utente un documento studio.backup v4 con numero di revisione; `progress.php` risponde 409 se un altro dispositivo ha salvato nel frattempo. In quel caso il client unisce con `StudyCore.mergeData` (unione per ID, vincono gli elementi locali) e reinvia. Non si sincronizzano sessione in corso, ID dell'estensione e bozze. Con una sessione attiva i dati in arrivo vengono rimandati alla fine della sessione. Lo stato della sincronizzazione è in localStorage `studio.sync.v1` (token, revisione, hash dell'ultimo invio).

`dist/api/config.php` NON va nel repository: lo crea la Action dalle variabili DB_NAME e DB_USER (e dal secret facoltativo DB_PASSWORD). Prova locale con SQLite: `npm run dev:php` (http://localhost:5188). Con `npm run dev` o su GitHub Pages non c'è PHP e la pagina Account lo dice.

## Obiettivi e traguardi

`dist/goals.js` aggiunge la pagina Obiettivi: obiettivi settimanali (`data.study.goals.weekly`: minuti, sessioni, tentativi; 0 = non usato, settimana da lunedì), obiettivi personali (`goals.items`, data facoltativa) e traguardi. I traguardi sono in `ACHIEVEMENTS` e si calcolano dai dati reali; in `data.study.achievements` resta solo `{id: data di sblocco}`. Al primo avvio i traguardi già raggiunti si segnano senza avviso. I nuovi campi sono validati in `validateBackup` e uniti in `mergeData`, quindi passano per backup e sincronizzazione.

## App installabile e promemoria

`dist/manifest.webmanifest`, `dist/sw.js` e `dist/pwa.js` rendono l'app installabile (PWA). Il service worker usa "prima la rete" con `cache: "no-cache"`: online arrivano sempre i file nuovi, offline si usa l'ultima copia. `api/` e gli ZIP non passano dalla cache. Se aggiungi un file JS o CSS, mettilo anche in `SHELL` di `sw.js` (e aumenta `CACHE` se cambia l'elenco). Icone generate da `npm run icons` (`scripts/make-icons.cjs`).

Promemoria dei ripassi (`pwa.js`): avviso nella pagina quando ci sono ripassi scaduti, numero sull'icona (`setAppBadge`) e notifica una volta al giorno dopo l'ora scelta. Le impostazioni sono per dispositivo (`studio.reminder.v1`, non sincronizzate). La pagina copia le date dei ripassi nella cache `studio-reminder` (`reminder-state.json`) perché il service worker non legge localStorage. La notifica parte quando l'app è aperta (controllo ogni minuto) o, con l'app installata su Chrome/Edge, dal Periodic Background Sync, che il browser esegue quando vuole: non promettere orari precisi né notifiche a browser chiuso. Su iPhone le notifiche funzionano solo dall'app aggiunta alla Home. Non ci sono notifiche push dal server. Test: `reminder-check.cjs`.

## Statistiche, esame, note e gruppi (v6)

`dist/extras.js`: in Progressi statistiche per materia (materie unite ignorando maiuscole; tempo dalle sessioni, risposte da sessioni e tentativi) e calendario delle ultime 53 settimane (livelli 0, <30, <60, <120, ≥120 minuti). In Domande: creazione da testo ("domanda | risposta" per riga, doppioni della stessa materia saltati) e modalità esame (domande a caso, tempo facoltativo, punteggio giusta 1 / in parte 0,5 / sbagliata 0). Ogni risposta d'esame diventa un tentativo in `logs`, le sbagliate entrano negli errori senza data; i risultati stanno in `data.study.examRuns`. Il ripasso delle domande sbagliate si programma solo se l'utente lo sceglie. Nel piano esami ogni argomento ha `note` (max 5000), salvata all'evento change e conservata da `AgendaCore.preserveTopics`.

`dist/group.js` + `dist/api/group.php`: gruppi di studio (tabelle `stf_groups`, `stf_group_members`, max 20 persone, max 10 gruppi a testa, codice d'invito di 8 caratteri). Gli altri membri vedono solo nome utente, minuti e sessioni della settimana, calcolati sul server dai dati sincronizzati di ciascuno. Se esce chi ha creato il gruppo, passa al membro più vecchio; l'ultimo che esce lo cancella. Solo chi ha creato il gruppo cambia l'obiettivo.

Il promemoria (`pwa.js`, `sw.js`) avvisa anche quando, da giovedì, i minuti della settimana sono sotto la quota prevista fino a oggi (`target × giorni passati / 7`).

## Interfaccia semplificata (v7)

Su richiesta dell'utente sono state tolte dal menu e dal routing le pagine Oggi, Domande, Ripasso errori, Ripassi e Tentativi, con la creazione da testo e la modalità esame. Le sezioni HTML restano nel DOM nascoste perché features.js e agenda.js le usano ancora; i dati (`reviews`, `cards`, `errors`, `logs`, `examRuns`) restano nel salvataggio, nei backup e nella sincronizzazione: NON cancellarli. Dopo una sessione non si crea più un ripasso. La Settimana mostra solo piani e impegni (`build` in agenda.js filtra card/error/review). Il promemoria segue solo l'obiettivo settimanale. Poi è stato tolto anche Piano esami (con le note per argomento e i traguardi dei piani); `exams` resta nei dati. La Settimana mostra solo gli impegni personali (`source === "custom"`). Menu attuale: Sessione, Settimana, Progressi, Obiettivi, Blocco siti, Metodo, Account e app.

## Estensione 2.1: siti per adulti e pubblicità di YouTube

Due ruleset statici sempre accesi: `extension/rules/adult.json` (elenco di siti, domini .xxx/.porn/.sex/.adult, "porn"/"hentai" nel nome del sito, SafeSearch su Google/Bing/DuckDuckGo con queryTransform, header `YouTube-Restrict: Moderate`) e `extension/rules/ads.json` (spazi pubblicitari Google richiesti da YouTube). Si rigenerano con `npm run rules` da `scripts/make-adult-rules.cjs`. Gli annunci nei video li tolgono `youtube-main.js` (world MAIN: toglie adPlacements/playerAds/adSlots dalle risposte) e `youtube-skip.js` (nasconde riquadri, porta alla fine e salta l'annuncio), registrati con chrome.scripting. Solo il popup può spegnerli (ADULT_OFF / ADULT_CANCEL / ADULT_ON / ADS_SET); il sito viene rifiutato. ADULT_OFF diventa effettivo dopo 60 secondi. Test: `protection-check.cjs`. Non promettere un blocco completo: nessun elenco lo è e YouTube cambia spesso.

## v8: riepilogo, gruppo dal vivo, blocco severo, nuovi traguardi

- Riepilogo della settimana (`goals.js`, `recap()`): scheda nella pagina Sessione dal lunedì finché non la chiudi (`studio.recap.v1` = inizio della settimana già vista, per dispositivo) e blocco fisso "La settimana scorsa" in Obiettivi. Confronto con la settimana precedente, giorno migliore, materia più studiata, obiettivo.
- Gruppo dal vivo (`group.js`, `api/group.php` action `presence`, tabella `stf_presence`): l'app invia solo secondi rimanenti e trascorsi quando il timer di studio è in corso (ogni minuto e a ogni save), "off" in pausa o a fine sessione. Mai materia od obiettivo. Ora del server per evitare orologi sbagliati. Nella pagina Sessione il riquadro "Studiano adesso" mostra gli altri membri in sessione.
- Traguardi: 31. Quelli non ricavabili dai dati usano `data.study.flags` (`group`, `together`), validato e unito come gli altri campi.
- Estensione 2.2, blocco severo: SUSPEND rifiutato se c'è una sessione manuale attiva (`manualUntil > now`); `strict` nello stato. Le fasce programmate restano sospendibili.

## v9: lobby e profili

`dist/lobby.js` + `dist/api/social.php` (tabelle `stf_online`, `stf_profiles`, `stf_presence`). Pagina Lobby (`#lobby`; `#lobby/<nome>` apre un profilo, il router usa la parte prima di "/"). Si entra nella lobby con un pulsante (`visibility`, spento di base): da lì nome, stato e profilo sono visibili a tutti gli utenti con account; i compagni di gruppo si vedono sempre. Online = segnale `ping` negli ultimi 3 minuti (uno al minuto con l'app aperta, subito a inizio, pausa e fine sessione); in studio = `stf_presence` attiva. Il profilo manda solo data, minuti, materia e obiettivo delle sessioni (max 3000) e le date dei traguardi: MAI risposte, correzioni o valutazioni. I nomi dei traguardi vengono da `window.StudioAchievements` (goals.js). group.js non manda più il segnale di presenza: lo fa lobby.js.

## v10: lobby private

I "gruppi" sono diventati **lobby private** e stanno nella pagina Lobby (non più in Obiettivi). Stesso backend (`api/group.php`, tabelle `stf_groups`/`stf_group_members`, codice d'invito, max 20 persone, max 10 a testa), obiettivo di minuti facoltativo (0 = nessuno). I membri vedono sempre gli altri come in studio / online / offline (`online` = `stf_online` negli ultimi 3 minuti) senza entrare nella lobby pubblica. La lobby pubblica (`social.php?action=lobby`) mostra solo chi ci è entrato. `lobby.js` va caricato prima di `group.js` (crea `#group-body`).

## v11: stile a livelli

`dist/game.js` + `dist/game.css`. XP = 1 per minuto + 10 per sessione + 50 per traguardo (`StudyCore.xpFor`, uguale in PHP `xp_from` in `_lib.php`). Livello n da 100·(n−1)·n/2 XP (`StudyCore.levelFor`), titolo nuovo ogni 3 livelli (`StudyCore.TITLES`). Gli XP non si salvano: si ricalcolano dai dati, quindi valgono anche per lo storico e restano uguali su tutti i dispositivi. Scheda giocatore nella barra laterale, "+XP" e schermata di livello dopo i salvataggi (raggruppati in 400 ms), punti in palio durante la sessione, "Il tuo livello" in Obiettivi. Medaglie: in ogni serie la soglia più bassa è bronzo, la seconda argento, le altre oro; i traguardi singoli sono d'argento. Livello accanto ai nomi nella lobby, nelle lobby private e nei profili (`xp` dal server). Oro `--xp` solo per punti e livelli. Il primo `route()` viene ripetuto a DOMContentLoaded perché Obiettivi e Lobby sono create da altri script.

## v12: avatar, menu a 5 voci, tutorial dell'estensione

- `dist/avatar.js` (`StudioAvatar`): avatar SVG da 7 parti numeriche in `data.study.avatar` (validato in study-core, `avatar_from` in `_lib.php` per lobby, lobby private e profili). Senza avatar salvato se ne ricava uno fisso dal nome utente. Editor in Impostazioni.
- `dist/layout.js` (caricato per ultimo) costruisce il menu Studia, Settimana, Progressi, Lobby, Impostazioni. Sposta il contenuto di Obiettivi dentro Progressi e quello di Account e app, Metodo, backup ed esportazione dentro Impostazioni (`#page-settings`), poi rimuove `page-goals`, `page-account`, `page-method`. I vecchi indirizzi `#goals`, `#account`, `#method` sono alias in `route()`. Gli script che controllano la pagina attiva devono usare i nomi nuovi (es. goals.js disegna su `#progress`).
- Pagina Studia: suono e correzioni sono riquadri apribili; lo stato delle bozze è nascosto.
- Tutorial dell'estensione in 6 passi (Impostazioni › Blocco siti), con testi diversi per Chrome ed Edge (`edge://extensions`). Il campo ID, il pulsante e il messaggio restano quelli di app.js, spostati nell'ultimo passo; con `studio:connected` il tutorial si chiude. Passo raggiunto in `studio.tutorial.v1`.

## v13: niente lobby pubblica

Tolta la lobby pubblica (richiesta dell'utente). La pagina Lobby ha due sezioni separate: "Le tue lobby" (`#group-body`, aggiornata ogni 30 s) e "Crea o entra in una lobby" (`#group-forms`, disegnata una volta sola perché l'aggiornamento non cancelli quello che si scrive). Profili visibili solo a chi è nella stessa lobby (`visible_ids` in social.php). Le azioni `lobby` e `visibility` di social.php restano solo per compatibilità e non sono più usate dall'app.
