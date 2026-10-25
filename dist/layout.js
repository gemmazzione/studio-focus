// Interfaccia semplificata: cinque voci di menu (Studia, Settimana, Progressi, Lobby, Impostazioni).
// Caricato per ultimo: sposta le sezioni create dagli altri script nelle pagine unite,
// aggiunge l'editor dell'avatar e il tutorial passo passo per l'estensione.
(() => {
  "use strict";
  const byId = (id) => document.getElementById(id),
    $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const move = (from, to, where = "beforeend") => {
    if (from && to) to.insertAdjacentElement(where, from);
  };

  // --- Menu -------------------------------------------------------------------
  // Icone semplici: su telefono il menu diventa una barra in basso
  const ICONS = {
    focus: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
    week: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    progress: '<path d="M4 20V11M10 20V5M16 20v-7M22 20H2"/>',
    lobby: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-4 3-6 7-6s7 2 7 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c3 0 5 2 5 5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  };
  document.querySelector("aside nav").innerHTML = [
    ["focus", "Studia"],
    ["week", "Settimana"],
    ["progress", "Progressi"],
    ["lobby", "Lobby"],
    ["settings", "Impostazioni"],
  ]
    .map(
      ([page, label]) =>
        `<a href="#${page}" data-page="${page}"><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[page]}</svg><span>${label}</span></a>`,
    )
    .join("");

  // --- Progressi = Progressi + Obiettivi ----------------------------------------
  const progress = byId("page-progress"),
    goals = byId("page-goals"),
    progressHeading = progress.querySelector(".heading");
  progressHeading.innerHTML =
    "<h1>Progressi</h1><p>Il tuo livello, la settimana, gli obiettivi, i traguardi e tutto quello che hai studiato.</p>";
  if (goals) {
    const parts = $$(":scope > :not(.heading)", goals);
    parts.reverse().forEach((el) => move(el, progressHeading, "afterend"));
    goals.remove();
  }

  // --- Impostazioni = Account e app + Avatar + Blocco siti + Dati + Metodo ---------
  const settings = byId("page-settings"),
    account = byId("page-account"),
    method = byId("page-method");
  const blockParts = $$(":scope > :not(.heading)", settings);
  settings.innerHTML = `<div class="heading"><h1>Impostazioni</h1><p>Account, avatar, app sul telefono, blocco dei siti e i tuoi dati.</p></div>
    <div class="settings-jump" role="navigation" aria-label="Sezioni"><a href="#set-account">Account</a><a href="#set-avatar">Avatar</a><a href="#set-block">Blocco siti</a><a href="#set-data">I tuoi dati</a><a href="#set-method">Il metodo</a></div>
    <section class="settings-block" id="set-account"><h2 class="settings-title">Account</h2></section>
    <section class="settings-block" id="set-avatar"><h2 class="settings-title">Il tuo avatar</h2></section>
    <section class="settings-block" id="set-block"><h2 class="settings-title">Blocco siti</h2><p class="hint">Scegli i siti da bloccare mentre studi. Serve l’estensione per Chrome o Edge: il tutorial qui sotto ti guida passo passo.</p></section>
    <section class="settings-block" id="set-data"><h2 class="settings-title">I tuoi dati</h2></section>
    <section class="settings-block" id="set-method"><details><summary class="settings-title">Il metodo: da dove vengono le scelte dell’app</summary></details></section>`;
  if (account) {
    $$(":scope > :not(.heading)", account).forEach((el) => move(el, byId("set-account")));
    account.remove();
  }
  blockParts.forEach((el) => move(el, byId("set-block")));
  // Esporta, importa e ripristina i dati
  const exportButton = byId("export");
  move(exportButton, byId("set-data"));
  $$(".backup-section", document).forEach((el) => move(el, byId("set-data")));
  const exportHint = byId("history")?.nextElementSibling;
  if (exportHint && /Esportali/.test(exportHint.textContent)) move(exportHint, byId("set-data"));
  if (method) {
    $$(":scope > :not(.heading)", method).forEach((el) => move(el, byId("set-method").querySelector("details")));
    method.remove();
  }
  // In Impostazioni i link interni portano alle sezioni senza cambiare pagina
  settings.querySelector(".settings-jump").addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    e.preventDefault();
    byId(a.getAttribute("href").slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // --- Pagina Studia più leggera ------------------------------------------------
  // Suono: riquadro apribile
  const sound = document.querySelector(".sound-panel");
  if (sound) {
    const details = document.createElement("details");
    details.className = "sound-details";
    details.innerHTML = '<summary><span>Suono di fine sessione</span><span id="sound-summary" class="meta"></span></summary>';
    sound.before(details);
    details.append(sound);
    const summary = () => {
      byId("sound-summary").textContent = byId("sound-enabled").checked
        ? `${byId("sound-kind").selectedOptions[0].textContent} · ${byId("sound-volume").value}%`
        : "spento";
    };
    ["sound-enabled", "sound-kind", "sound-volume"].forEach((id) => byId(id).addEventListener("input", summary));
    byId("sound-enabled").addEventListener("change", summary);
    summary();
  }
  // Correzioni dopo la verifica: facoltative, in un riquadro apribile
  const correction = byId("correction");
  if (correction) {
    const label = document.querySelector('label[for="correction"]'),
      details = document.createElement("details");
    details.className = "correction-details";
    details.innerHTML = "<summary>Aggiungi cosa mancava o era sbagliato (facoltativo)</summary>";
    label.before(details);
    details.append(label, correction);
  }

  // --- Avatar -----------------------------------------------------------------------
  const A = window.StudioAvatar;
  const myName = () => {
    try {
      return JSON.parse(localStorage.getItem("studio.sync.v1"))?.username || "";
    } catch {
      return "";
    }
  };
  const current = () => A.normalize(data.study.avatar, myName());
  byId("set-avatar").insertAdjacentHTML(
    "beforeend",
    `<div class="avatar-editor"><div class="avatar-preview" id="avatar-preview"></div><div class="avatar-parts" id="avatar-parts"></div></div>
    <div class="actions"><button type="button" class="secondary" id="avatar-random">Casuale</button></div>
    <p class="hint">Si salva da solo. Gli altri lo vedono nella lobby, nelle lobby private e nel tuo profilo.</p>`,
  );
  function renderAvatarEditor() {
    const a = current();
    byId("avatar-preview").innerHTML = A.svg(a, 112, myName());
    byId("avatar-parts").innerHTML = A.KEYS.map((k) => {
      const part = A.PARTS[k],
        isColor = part.options[0].startsWith("#");
      return `<div class="avatar-part"><span class="avatar-label">${part.label}</span>${
        isColor
          ? `<div class="swatches" role="radiogroup" aria-label="${part.label}">${part.options
              .map((c, i) => `<button type="button" role="radio" aria-checked="${a[k] === i}" aria-label="${part.label} ${i + 1}" class="swatch ${a[k] === i ? "is-on" : ""}" style="background:${c}" data-part="${k}" data-value="${i}"></button>`)
              .join("")}</div>`
          : `<div class="stepper"><button type="button" class="secondary" data-part="${k}" data-step="-1" aria-label="${part.label} precedente">‹</button><span>${part.options[a[k]]}</span><button type="button" class="secondary" data-part="${k}" data-step="1" aria-label="${part.label} successivo">›</button></div>`
      }</div>`;
    }).join("");
  }
  function setAvatar(next) {
    data.study.avatar = next;
    save();
  }
  byId("avatar-parts").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-part]");
    if (!b) return;
    const a = current(),
      k = b.dataset.part,
      n = A.PARTS[k].options.length;
    a[k] = b.dataset.value != null ? Number(b.dataset.value) : (a[k] + Number(b.dataset.step) + n) % n;
    setAvatar(a);
    byId("avatar-parts").querySelector(`[data-part="${k}"]${b.dataset.value != null ? `[data-value="${a[k]}"]` : `[data-step="${b.dataset.step}"]`}`)?.focus();
  });
  byId("avatar-random").onclick = () => setAvatar(A.random());

  // Avatar nella scheda giocatore
  const player = byId("player");
  if (player) {
    player.insertAdjacentHTML("afterbegin", '<span class="player-avatar" id="player-avatar"></span>');
    byId("player-level").classList.add("on-avatar");
    byId("player-avatar").append(byId("player-level"));
  }
  function renderMyAvatar() {
    const box = byId("player-avatar");
    if (!box) return;
    const badge = byId("player-level");
    box.innerHTML = A.svg(current(), 42, myName());
    box.append(badge);
  }

  // --- Tutorial dell'estensione -------------------------------------------------------
  const edge = /Edg\//.test(navigator.userAgent),
    chromium = !!window.chrome || edge,
    extPage = edge ? "edge://extensions" : "chrome://extensions",
    TUTORIAL = "studio.tutorial.v1";
  const STEPS = [
    {
      title: "Scarica l’estensione",
      body: `<p>È un file ZIP piccolo, con tutto quello che serve.</p><a class="primary" href="studio-extension.zip" download>Scarica l’estensione</a>`,
      mock: '<div class="mock-file">studio-extension.zip</div>',
    },
    {
      title: "Estrai lo ZIP in una cartella da tenere",
      body: "<p>Apri la cartella <b>Download</b>, fai clic destro sul file e scegli <b>Estrai tutto</b>. Sposta la cartella estratta in un posto dove non la cancelli, per esempio <b>Documenti</b>: il browser la legge sempre da lì.</p>",
      mock: '<div class="mock-file is-folder">studio-extension</div>',
    },
    {
      title: "Apri la pagina delle estensioni",
      body: `<p>Per sicurezza i siti non possono aprirla da soli: copia l’indirizzo, incollalo nella barra degli indirizzi e premi Invio.</p><div class="copy-row"><code>${extPage}</code><button type="button" class="secondary" id="copy-ext-page">Copia</button></div>`,
      mock: `<div class="mock-browser"><div class="mock-bar">${extPage}</div></div>`,
    },
    {
      title: "Attiva la Modalità sviluppatore",
      body: edge
        ? "<p>In Edge l’interruttore <b>Modalità sviluppatore</b> è nel menu a sinistra, in basso.</p>"
        : "<p>In Chrome l’interruttore <b>Modalità sviluppatore</b> è in alto a destra.</p>",
      mock: `<div class="mock-browser"><div class="mock-bar">${extPage}</div><div class="mock-row"><span>Estensioni</span><span class="mock-toggle">Modalità sviluppatore <i></i></span></div></div>`,
    },
    {
      title: "Carica la cartella",
      body: "<p>Premi <b>Carica estensione non pacchettizzata</b> e scegli la cartella <b>studio-extension</b> (quella che contiene <code>manifest.json</code>). Compare la scheda <b>Studio — blocco distrazioni</b>.</p><p class=\"hint\">Se vuoi, fissa l’icona: clic sul pezzo di puzzle accanto alla barra degli indirizzi e poi sulla puntina accanto a Studio.</p>",
      mock: '<div class="mock-browser"><div class="mock-row"><span class="mock-button">Carica estensione non pacchettizzata</span></div><div class="mock-card"><b>Studio — blocco distrazioni</b><small>ID: abcdefghijklmnopabcdefghijklmnop</small></div></div>',
    },
    {
      title: "Collega l’estensione all’app",
      body: "<p>Nella scheda di Studio copia l’<b>ID</b> (32 lettere sotto il nome), incollalo qui sotto e premi <b>Verifica collegamento</b>.</p><div id=\"tutorial-connect\"></div>",
      mock: '<div class="mock-browser"><div class="mock-card"><b>Studio — blocco distrazioni</b><small class="is-marked">ID: abcdefghijklmnopabcdefghijklmnop</small></div></div>',
    },
  ];
  const instructions = document.querySelector("#set-block .instructions");
  let step = 0;
  try {
    step = Math.min(STEPS.length - 1, Math.max(0, Number(localStorage.getItem(TUTORIAL)) || 0));
  } catch {}
  if (instructions) {
    // Il tutorial occupa tutta la larghezza, sotto la scelta dei siti
    instructions.closest(".settings-grid")?.after(instructions);
    // Campo ID, pulsante e messaggio restano quelli di app.js: li sposto nell'ultimo passo
    const keep = [document.querySelector('label[for="extension-id"]'), byId("extension-id"), byId("connect"), byId("connection-message")];
    const limits = instructions.querySelector(".hint");
    instructions.innerHTML = `<h2>Installa e collega l’estensione</h2>${
      chromium ? "" : '<p class="notice">L’estensione funziona solo con <b>Google Chrome</b> o <b>Microsoft Edge</b> sul computer. Apri questa pagina con uno dei due per installarla.</p>'
    }<div class="tutorial" id="tutorial"><ol class="tutorial-dots" id="tutorial-dots"></ol><div class="tutorial-step" id="tutorial-step"></div><div class="tutorial-nav"><button type="button" class="secondary" id="tutorial-prev">Indietro</button><span id="tutorial-count" class="meta"></span><button type="button" class="primary" id="tutorial-next">Avanti</button></div></div><div class="tutorial-done" id="tutorial-done" hidden><p><b>Estensione collegata.</b> Durante le sessioni i siti scelti vengono bloccati.</p><button type="button" class="text-button" id="tutorial-again">Rivedi il tutorial</button></div>`;
    const holder = document.createElement("div");
    holder.className = "tutorial-keep";
    keep.forEach((el) => el && holder.append(el));
    if (limits) instructions.append(limits);
    const renderStep = () => {
      const s = STEPS[step];
      byId("tutorial-step").innerHTML = `<div class="tutorial-text"><h3 tabindex="-1">${step + 1}. ${s.title}</h3>${s.body}</div><div class="tutorial-mock" aria-hidden="true">${s.mock}</div>`;
      byId("tutorial-dots").innerHTML = STEPS.map((x, i) => `<li class="${i < step ? "is-done" : i === step ? "is-on" : ""}"><button type="button" data-step="${i}" aria-label="Passo ${i + 1}: ${x.title}">${i < step ? "✓" : i + 1}</button></li>`).join("");
      byId("tutorial-count").textContent = `Passo ${step + 1} di ${STEPS.length}`;
      byId("tutorial-prev").disabled = step === 0;
      byId("tutorial-next").hidden = step === STEPS.length - 1;
      if (step === STEPS.length - 1) byId("tutorial-connect").append(holder);
      byId("copy-ext-page")?.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(extPage);
          notify("Indirizzo copiato. Incollalo nella barra degli indirizzi.");
        } catch {
          notify(`Scrivi ${extPage} nella barra degli indirizzi.`);
        }
      });
      try {
        localStorage.setItem(TUTORIAL, String(step));
      } catch {}
    };
    const go = (n) => {
      step = Math.min(STEPS.length - 1, Math.max(0, n));
      renderStep();
      byId("tutorial-step").querySelector("h3").focus?.();
    };
    byId("tutorial-prev").onclick = () => go(step - 1);
    byId("tutorial-next").onclick = () => go(step + 1);
    byId("tutorial-dots").onclick = (e) => e.target.dataset.step != null && go(Number(e.target.dataset.step));
    byId("tutorial-again").onclick = () => {
      byId("tutorial").hidden = false;
      byId("tutorial-done").hidden = true;
      go(0);
    };
    // Collegamento riuscito: tutorial chiuso, resta il riepilogo
    window.addEventListener("studio:connected", () => {
      byId("tutorial").hidden = true;
      byId("tutorial-done").hidden = false;
      byId("tutorial-done").append(holder);
    });
    renderStep();
  }

  // --- Aggiornamenti ------------------------------------------------------------------
  window.addEventListener("studio:saved", () => {
    renderMyAvatar();
    if (!byId("page-settings").hidden) renderAvatarEditor();
  });
  window.addEventListener("hashchange", () => {
    if (location.hash === "#settings") renderAvatarEditor();
  });
  renderMyAvatar();
  renderAvatarEditor();
})();
