# Studio

Uno spazio personale per obiettivi, focus, richiamo attivo e ripassi distribuiti.

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
