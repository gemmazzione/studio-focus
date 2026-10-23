// Avatar: un piccolo personaggio in SVG fatto da parti scelte dall'utente.
// I dati sono solo numeri (data.study.avatar), così il server li può passare agli altri senza rischi.
// Senza avatar salvato se ne ricava uno fisso dal nome utente.
(function (root) {
  "use strict";
  const PARTS = {
    bg: { label: "Sfondo", options: ["#dbe4ff", "#ffe3d3", "#d7f5e3", "#fbe7a1", "#f3d9fa", "#d9f1fb", "#e8e8ee", "#ffd6dc"] },
    skin: { label: "Pelle", options: ["#fde0c8", "#f5c9a3", "#e3a77d", "#c98b5c", "#9c6440", "#6e4429"] },
    hair: { label: "Capelli", options: ["Corti", "Lunghi", "Ricci", "Chignon", "Cresta", "Rasati", "Frangia", "Coda"] },
    hairColor: { label: "Colore capelli", options: ["#2b2118", "#5a3825", "#a0622d", "#e0b25a", "#c9472f", "#9aa3b2", "#3f5bd6", "#d05fa0"] },
    eyes: { label: "Occhi", options: ["Tondi", "Felici", "Occhiali", "Assonnati", "Occhiolino"] },
    mouth: { label: "Bocca", options: ["Sorriso", "Risata", "Neutra", "Stupita"] },
    extra: { label: "Accessorio", options: ["Niente", "Cuffie", "Berretto", "Fiocco", "Matita", "Corona"] },
  };
  const KEYS = Object.keys(PARTS);

  function hash(text) {
    let h = 2166136261;
    for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return h >>> 0;
  }
  // Valori validi, oppure un avatar ricavato dal nome
  function normalize(avatar, name = "") {
    const seed = hash(name || "studio");
    const out = {};
    KEYS.forEach((k, i) => {
      const n = PARTS[k].options.length,
        v = avatar?.[k];
      out[k] = Number.isInteger(v) && v >= 0 && v < n ? v : (seed >>> (i * 3)) % n;
    });
    if (!avatar) out.extra = 0;
    return out;
  }

  function hairShape(style, color) {
    const c = `fill="${color}"`;
    return [
      `<path ${c} d="M17 30c0-11 7-17 15-17s15 6 15 17c-3-5-8-8-15-8s-12 3-15 8z"/>`,
      `<path ${c} d="M15 31c0-12 8-19 17-19s17 7 17 19v15c-2 1-4 1-5 0V30c-3-4-7-6-12-6s-9 2-12 6v16c-1 1-3 1-5 0z"/>`,
      `<g ${c}>${[18, 24, 30, 36, 42, 46, 16].map((x, i) => `<circle cx="${x}" cy="${i === 6 ? 26 : i === 5 ? 24 : 17 + (i % 2) * 2}" r="6"/>`).join("")}</g>`,
      `<path ${c} d="M17 30c0-11 7-17 15-17s15 6 15 17c-3-5-8-8-15-8s-12 3-15 8z"/><circle ${c} cx="32" cy="10" r="6"/>`,
      `<path ${c} d="M28 25c0-8 1-14 4-18 3 4 4 10 4 18z"/><path ${c} d="M19 30c2-4 7-7 13-7s11 3 13 7c-3-2-8-3-13-3s-10 1-13 3z"/>`,
      `<path ${c} opacity=".55" d="M18 29c1-9 7-14 14-14s13 5 14 14c-3-4-8-6-14-6s-11 2-14 6z"/>`,
      `<path ${c} d="M17 32c0-12 7-18 15-18s15 6 15 18c-2-2-4-4-6-4l-3 4-3-4-3 4-3-4-3 4-3-4c-3 0-5 2-6 4z"/>`,
      `<path ${c} d="M17 30c0-11 7-17 15-17s15 6 15 17c-3-5-8-8-15-8s-12 3-15 8z"/><path ${c} d="M45 22c6 3 8 10 6 18-2-6-4-9-8-11z"/>`,
    ][style];
  }
  function eyesShape(style) {
    const ink = "#1f2433";
    return [
      `<circle cx="26" cy="35" r="2.6" fill="${ink}"/><circle cx="38" cy="35" r="2.6" fill="${ink}"/>`,
      `<path d="M23 36q3-4 6 0M35 36q3-4 6 0" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
      `<g fill="none" stroke="${ink}" stroke-width="1.8"><circle cx="26" cy="35" r="5"/><circle cx="38" cy="35" r="5"/><path d="M31 35h2"/></g><circle cx="26" cy="35" r="1.8" fill="${ink}"/><circle cx="38" cy="35" r="1.8" fill="${ink}"/>`,
      `<path d="M23 35h6M35 35h6" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`,
      `<circle cx="26" cy="35" r="2.6" fill="${ink}"/><path d="M35 35q3 3 6 0" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    ][style];
  }
  function mouthShape(style) {
    const ink = "#1f2433";
    return [
      `<path d="M27 43q5 5 10 0" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
      `<path d="M26 42q6 9 12 0z" fill="${ink}"/><path d="M28 43q4 3 8 0" fill="#e86a6a"/>`,
      `<path d="M28 44h8" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`,
      `<ellipse cx="32" cy="44" rx="3" ry="3.6" fill="${ink}"/>`,
    ][style];
  }
  function extraShape(style) {
    return [
      "",
      `<path d="M14 36c0-12 8-21 18-21s18 9 18 21" stroke="#2b2f3a" stroke-width="3.5" fill="none"/><rect x="10" y="32" width="8" height="12" rx="3" fill="#e5534b"/><rect x="46" y="32" width="8" height="12" rx="3" fill="#e5534b"/>`,
      `<path d="M15 27c1-9 8-15 17-15s16 6 17 15z" fill="#2346c8"/><path d="M44 26h11c0 2-2 3-4 3H44z" fill="#2346c8"/><circle cx="32" cy="12" r="2" fill="#2346c8"/>`,
      `<path d="M38 16l7-5v10zM38 16l-7-5v10z" fill="#e5534b"/><circle cx="38" cy="16" r="2.4" fill="#c03a33"/>`,
      `<g transform="rotate(-35 50 22)"><rect x="47" y="8" width="6" height="22" rx="1" fill="#f5c242"/><path d="M47 30h6l-3 6z" fill="#f3d9b5"/><rect x="47" y="6" width="6" height="4" rx="1" fill="#e86a8a"/></g>`,
      `<path d="M20 18l4 6 8-9 8 9 4-6v9H20z" fill="#f5c242" stroke="#d99a00" stroke-width="1"/>`,
    ][style];
  }
  // Un id unico per il ritaglio circolare, perché la stessa pagina mostra molti avatar
  let uid = 0;
  function svg(avatar, size = 40, name = "") {
    const a = normalize(avatar, name),
      id = "av" + ++uid,
      skin = PARTS.skin.options[a.skin],
      hairColor = PARTS.hairColor.options[a.hairColor];
    return `<svg class="avatar" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="Avatar"><defs><clipPath id="${id}"><circle cx="32" cy="32" r="32"/></clipPath></defs><g clip-path="url(#${id})"><rect width="64" height="64" fill="${PARTS.bg.options[a.bg]}"/><path d="M12 64c2-11 10-16 20-16s18 5 20 16z" fill="${hairColor}" opacity=".35"/><path d="M14 64c2-9 9-13 18-13s16 4 18 13z" fill="#5b6b8c"/><rect x="28" y="45" width="8" height="7" fill="${skin}"/><ellipse cx="32" cy="35" rx="14" ry="15" fill="${skin}"/><circle cx="21" cy="40" r="2.4" fill="#f29a9a" opacity=".45"/><circle cx="43" cy="40" r="2.4" fill="#f29a9a" opacity=".45"/>${hairShape(a.hair, hairColor)}${eyesShape(a.eyes)}${mouthShape(a.mouth)}${extraShape(a.extra)}</g></svg>`;
  }
  function random() {
    return Object.fromEntries(KEYS.map((k) => [k, Math.floor(Math.random() * PARTS[k].options.length)]));
  }
  root.StudioAvatar = { PARTS, KEYS, normalize, svg, random };
})(typeof globalThis !== "undefined" ? globalThis : this);
