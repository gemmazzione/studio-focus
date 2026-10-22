# Studio — guida per Claude Code

## Avvio rapido

Progetto web statico. Serve Node.js 18 o superiore. Non ci sono dipendenze da installare.

- `npm run dev` avvia http://127.0.0.1:5187.
- `npm run check` controlla sintassi e test dell'estensione.
- `npm run package:source` aggiorna lo ZIP scaricabile.

## File da modificare

- `dist/index.html`: struttura e testi italiani.
- `dist/style.css`: layout di base, responsive e accessibilità.
- `dist/premium.css`: identità carbone/rame e animazioni. Caricato dopo style.css.
- `dist/app.js`: timer, sessioni, richiamo attivo, ripassi, dati locali e collegamento estensione.
- `dist/experience.js`: Web Audio, volume, preferenze sonore e animazioni.
- `extension/`: estensione Manifest V3 per Chrome ed Edge.

## Regole di prodotto

Conservare compatibilità con localStorage `studio.v1` e `studio.sound.v1`. Non cancellare i dati quando si cambia grafica. Mai dichiarare social bloccati senza conferma e scadenza dall'estensione. Non promettere blocco di app native o telefono. Audio sbloccato da un gesto utente; browser, scheda sospesa o chiusa possono impedire l'avviso. Rispettare prefers-reduced-motion, etichette, contrasto, focus tastiera e dimensioni mobili.

Il protocollo estensione è PING, START {domains,until}, STOP. Non ampliare le origini autorizzate senza motivo. Se cambia dominio di hosting, aggiornare ALLOWED in background.js e externally_connectable in manifest.json.

## Verifica

Provare avvio, pausa/ripresa, ricarica, passaggio alla verifica, salvataggio, pausa e ripasso. Provare i tre suoni tramite Ascolta l'avviso. Il suono scatta solo alla scadenza naturale di studio o pausa, non quando si termina in anticipo. I test in check.cjs simulano le API Chrome: non sostituiscono una verifica con l'estensione installata.

## Pubblicazione

Il codice funziona su qualunque hosting statico, caricando il contenuto di dist. Questo repository contiene una configurazione Sites in .openai/hosting.json per il sito esistente. Modificare i file localmente NON aggiorna automaticamente il sito online. Per aggiornare Sites usare il flusso autorizzato del plugin Sites da Codex; non creare un secondo sito e non inserire token nei file. In alternativa pubblicare su altro hosting statico e aggiornare le origini dell'estensione.

## Design

App per studiare, non landing promozionale. Fondo carbone, accento rame, Bricolage Grotesque e Manrope. Animazione cinetica legata al focus, niente glassmorphism, gradienti decorativi, schede ripetitive o statistiche inventate. Mantenere la navigazione e la funzione principali riconoscibili.
