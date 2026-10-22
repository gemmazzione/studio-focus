---
name: Studio — Carbon & Copper
colors:
  paper: '#141716'
  surface: '#1c201e'
  rail: '#101311'
  ink: '#f1f0e9'
  secondary: '#adb5ae'
  accent: '#efad87'
  accentInk: '#241e19'
  line: '#353c37'
typography:
  heading:
    fontFamily: Bricolage Grotesque, sans-serif
    fontWeight: 500
  body:
    fontFamily: Manrope, sans-serif
    fontSize: 14px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
rounded:
  panel: 4px
  control: 4px
---
# Studio — Carbon & Copper

Operate mode. Redesign explicitly requested: premium graphics, animations and sound, preserving workflows and stored data. Dark surfaces suit evening PC study; copper isolates actions and elapsed time. Bricolage Grotesque is the display voice; Manrope keeps forms legible. No decorative gradients, glass or stock imagery.

## Composition
220px navigation rail, generous working canvas, large two-line task statement. Main work surface beside quieter utilities: audio controls, daily data, thought parking. Mobile stacks the canvas and scrolls navigation horizontally. No fabricated progress.

## Motion
48 discrete strokes form a slowly shifting kinetic ribbon. Focus changes rhythm and color; pause freezes it. Page transitions combine a small vertical movement and blur. Timer completion briefly lights the work surface edge. Hidden pages pause animation. Reduced-motion disables animations and transitions. Motion never controls data or timer state.

## Components
Flat lightly rounded inputs; copper primary action with dark text; outlined secondary actions. Audio toggle, sound select, volume, preview and status. Tabular timer with real progress line. Actual extension expiry governs social blocking status. Visible copper keyboard focus. Preserve explicit empty, error and paused states.

## Typography
Body 14px; supporting copy 12–13px; headings 15–18px; learning goals 22–25px; page title 38–65px; functional timer 76–130px. Uppercase phase labels are 11px.

## Implementation
style.css supplies existing layout and accessibility; premium.css replaces visual tokens and responsive composition. experience.js adds Web Audio and motion separately from study state. Code is formatted, framework-free and documented for Claude Code. Fonts load from Google Fonts with local fallbacks.
