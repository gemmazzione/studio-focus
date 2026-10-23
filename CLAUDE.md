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

Il piano riserva, quando possibile, l'ultimo giorno disponibile ai ripassi. Ogni argomento ha un breve richiamo in un giorno successivo al termine dello studio; l'intervallo di un giorno e la durata del 10% (5–15 minuti) sono euristiche modificabili, non un protocollo scientificamente ottimale. Un avviso segnala i ripassi che non trovano spazio. I blocchi del piano non attestano completamento: spetta allo studente spuntare l'argomento.

## Verifica

Provare avvio, pausa/ripresa, ricarica, passaggio alla verifica, salvataggio, pausa e ripasso. Provare i tre suoni tramite Prova il suono. Il suono scatta solo alla scadenza naturale di studio o pausa, non quando si termina in anticipo. I test in check.cjs simulano le API Chrome: non sostituiscono una verifica con l'estensione installata.

## Pubblicazione

Il sito principale è su AlterVista: https://samueleruggeri.altervista.org/studiofocus/ (FTP di `dist`, `.github/workflows/deploy.yml`, secrets FTP_SERVER/FTP_USERNAME/FTP_PASSWORD e variabile FTP_SERVER_DIR). Una copia è su GitHub Pages: https://gemmazzione.github.io/studio-focus/ (`.github/workflows/pages.yml`). Ogni push su `main` esegue `npm run check` e aggiorna entrambi; se i test falliscono, nessuno dei due viene aggiornato. L’estensione accetta messaggi da AlterVista, da `https://gemmazzione.github.io`, dal vecchio dominio chatgpt.site e da localhost: se cambia dominio, aggiornare ALLOWED in `extension/background.js` e externally_connectable in `extension/manifest.json`, poi `npm run package:source`.

## Design

App per studiare, non landing promozionale. Tema “Quaderno”: carta bianca, inchiostro blu-nero, penna blu (`--green`, nome storico) per azioni e avanzamento, penna rossa (`--warm`) solo per errori e scadenze. La quadrettatura con il margine rosso compare solo dove si scrive: pannello della sessione ed esercizi. Un solo font, Schibsted Grotesk. Tema scuro automatico con prefers-color-scheme. Titoli di pagina semplici (il nome della sezione), sottotitoli che dicono cosa fa la pagina: niente slogan, frasi motivazionali o titoli su due righe con parola colorata.
