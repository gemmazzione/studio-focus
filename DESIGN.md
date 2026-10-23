---
name: Studio — Quaderno
colors:
  paper: '#f7f8fa'
  surface: '#ffffff'
  ink: '#18213a'
  muted: '#59627a'
  penBlue: '#2346c8'
  penRed: '#b8322a'
  grid: '#e5eaf3'
  line: '#dde2ea'
typography:
  family: Schibsted Grotesk, system-ui, sans-serif
  body: 15px
rounded:
  control: 6px
---
# Studio — Quaderno

Il riferimento è il quaderno a quadretti di scuola: pagina bianca, penna blu per scrivere, penna rossa per correggere. Tutti i token sono in `dist/premium.css` (`:root`), con una variante scura sotto `prefers-color-scheme: dark`.

## Regole

- La quadrettatura con il margine rosso è riservata alle superfici dove si studia o si scrive: il pannello della sessione e il pannello degli esercizi. Il resto è carta bianca con bordi sottili.
- Blu solo per azioni, voce attiva della navigazione, materia della sessione e barra del tempo. Rosso solo per errori e avvisi.
- Un solo font, Schibsted Grotesk, con pesi 400–700. Il timer usa cifre tabellari.
- Titoli: il nome della sezione. Sottotitolo: cosa si fa nella pagina, in una frase. Niente slogan.
- Animazione: solo una breve dissolvenza al cambio pagina e il bordo blu a fine timer. Rispettare prefers-reduced-motion.

## Layout

Barra laterale da 216px con la navigazione; sotto gli 800px diventa una barra in alto, fissa, che scorre in orizzontale. Pagina Sessione: pannello quaderno a sinistra, colonna con suono, riepilogo di oggi e “Da fare dopo” a destra; sotto i 900px la colonna va sotto. La settimana ha 7 colonne su desktop, 4, 2 e infine 1 su telefono.
