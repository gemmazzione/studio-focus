# Studio

Uno spazio personale per obiettivi, focus, richiamo attivo e ripassi distribuiti.

## Funzioni aggiunte

- Piano esami: data, argomenti con stima in minuti, giorni disponibili e piano giornaliero di studio e richiamo successivo. Avviso se il tempo non basta; completamento argomenti esplicito. Le durate dei ripassi sono suggerimenti pratici, modificabili tramite le stime del piano.
- Domande: tentativo senza appunti, soluzione nascosta, autovalutazione e ripasso futuro.
- Errori: raccolta di correzioni e risposte difficili, nuovi tentativi e stato risolto/da riprendere.
- Avvio da 5 minuti con scelta di continuare per altri 25.
- Modalità immersiva con uscita tramite pulsante o Esc.
- Backup JSON completo, importazione con unione o sostituzione e ripristino della copia precedente. Compatibile anche con i vecchi export.
- Fasce social settimanali, anche oltre mezzanotte, con estensione 2.0. Gli orari funzionano con la pagina chiusa, purché il browser sia aperto e il PC attivo.

Per aggiornare un'estensione già installata, scarica lo ZIP dall'app, sostituisci i file nella stessa cartella e premi Ricarica in chrome://extensions o edge://extensions. Poi collega e invia gli orari dalla sezione Blocco social.

## Modificare con Claude Code

Apri questa cartella in Claude Code, oppure apri un terminale qui ed esegui `claude`. Claude legge CLAUDE.md e può modificare tutti i sorgenti. Esempio: «Leggi CLAUDE.md, avvia l'app e modifica la schermata focus mantenendo i dati esistenti».

Non occorrono API a pagamento o dipendenze per avviare l'app. Occorre Node.js 18+. Esegui `npm run dev` e apri http://127.0.0.1:5187. Ferma con Ctrl+C. `npm run check` esegue le verifiche disponibili.

## Audio

Campana morbida, tre note o tocco di legno; volume e disattivazione salvati nel browser. Premi Ascolta l'avviso per provarlo. Audio sintetizzato localmente con Web Audio, senza file o servizi esterni. Il browser richiede un'interazione per abilitare l'audio. Se la pagina viene sospesa o chiusa, l'allarme non è garantito: non è una sveglia di sistema.

## Social

L'estensione inclusa blocca i domini scelti nel browser in cui è installata. Vedi extension/LEGGIMI.txt. Permessi e limiti sono spiegati nell'app. Nessun blocco di programmi Windows o del telefono.

## Dati e distribuzione

Sessioni e risposte sono in localStorage. Sito online, localhost e browser diversi hanno archivi distinti. L'esportazione JSON è disponibile nei progressi. I font sono caricati da Google Fonts; in assenza di rete vengono usati i font di riserva.

I sorgenti sono file statici e non dipendono da Codex. Le modifiche locali non si pubblicano da sole: carica dist su un hosting statico oppure usa il flusso Sites in Codex per aggiornare l'URL attuale. Un cambio di dominio richiede aggiornare le origini consentite dell'estensione.
