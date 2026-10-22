"use strict";
(() => {
  const C = StudyCore,
    byId = (id) => document.getElementById(id),
    uid = () => crypto.randomUUID(),
    E = esc;
  data.study ||= {};
  const S = data.study;
  for (const key of [
    "exams",
    "cards",
    "errors",
    "schedules",
    "logs",
    "seenSessions",
  ])
    if (!Array.isArray(S[key])) S[key] = [];
  let current = null,
    feedbackOpen = false,
    imported = null,
    saving = false;
  const dayNames = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
  function page(id, title, subtitle, body) {
    const section = document.createElement("section");
    section.id = `page-${id}`;
    section.className = "page";
    section.hidden = true;
    section.innerHTML = `<div class="heading"><h1>${title}</h1><p>${subtitle}</p></div>${body}`;
    document.querySelector(".source-strip").before(section);
  }
  page(
    "planning",
    "Il prossimo esame.<br><em>Un passo al giorno.</em>",
    "Distribuisci il lavoro sul tempo che hai davvero.",
    `<div class="feature-grid"><form id="exam-form" class="feature-form"><h2>Prepara il piano</h2><label for="exam-subject">Materia dell’esame</label><input id="exam-subject" required maxlength="80" placeholder="Es. Matematica"><div class="duration-row"><label>Data dell’esame<input id="exam-date" type="date" required></label><label>Minuti al giorno<input id="exam-minutes" type="number" min="5" max="480" value="60" required></label></div><fieldset><legend>Giorni disponibili</legend><div class="day-picks">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label><input type="checkbox" name="exam-day" value="${d}" ${d > 0 && d < 6 ? "checked" : ""}>${dayNames[d]}</label>`).join("")}</div></fieldset><label for="exam-topics">Argomenti e minuti stimati</label><textarea id="exam-topics" rows="5" required maxlength="20000" placeholder="Derivate | 90&#10;Integrali | 120&#10;Esercizi di riepilogo | 60"></textarea><p class="hint">Un argomento per riga. Dopo | indica i minuti; se li ometti usiamo 60. Il giorno dell’esame è escluso.</p><button class="primary wide">Crea il piano</button><p id="exam-message" role="status"></p></form><div id="exam-list"></div></div>`,
  );
  page(
    "cards",
    "Prima di guardare.<br><em>Prova a ricordare.</em>",
    "Domande tue, risposte a memoria e ripassi distribuiti.",
    `<div class="feature-grid"><form id="card-form" class="feature-form"><h2>Una nuova domanda</h2><label for="card-subject">Materia della domanda</label><input id="card-subject" maxlength="80" required placeholder="Es. Biologia"><label for="card-question">Domanda</label><textarea id="card-question" rows="3" required maxlength="1000" placeholder="Come funziona la fotosintesi?"></textarea><label for="card-solution">Risposta di riferimento</label><textarea id="card-solution" rows="5" required maxlength="10000" placeholder="La soluzione da mostrare dopo il tuo tentativo…"></textarea><button class="primary wide">Salva domanda</button></form><div><div class="list-toolbar"><h2>Le tue domande</h2><label><input id="cards-due-only" type="checkbox">Solo da ripassare</label></div><div id="card-list"></div></div></div><section id="practice-card" class="practice" hidden></section>`,
  );
  page(
    "errors",
    "Gli errori indicano<br><em>da dove ripartire.</em>",
    "Qui arrivano correzioni delle sessioni e domande da riprendere.",
    `<p class="hint">Una risposta difficile o una correzione crea un elemento. Dopo il tentativo confronta la soluzione e valuta il ricordo: nessuna correzione automatica.</p><div class="list-toolbar"><h2>Da riprovare</h2><label><input id="errors-all" type="checkbox">Mostra anche risolti</label></div><div id="error-list"></div><section id="practice-error" class="practice" hidden></section>`,
  );
  byId("page-settings").insertAdjacentHTML(
    "beforeend",
    `<section class="schedule-section"><h2>Proteggi gli orari di studio</h2><p>Programma fasce settimanali nel fuso orario del PC. Se la fine è prima dell’inizio, la fascia termina il giorno dopo.</p><p class="hint">Richiede l’estensione Studio 2.0: <a href="studio-extension.zip" download>scarica l’aggiornamento</a>, sostituisci i file nella cartella installata e premi Ricarica nella pagina delle estensioni. Il browser deve essere aperto. Chiudere questa pagina non annulla gli orari.</p><form id="schedule-form" class="feature-form"><fieldset><legend>Giorni di inizio della fascia</legend><div class="day-picks">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label><input type="checkbox" name="schedule-day" value="${d}" ${d > 0 && d < 6 ? "checked" : ""}>${dayNames[d]}</label>`).join("")}</div></fieldset><div class="duration-row"><label>Inizio<input id="schedule-start" type="time" value="09:00" required></label><label>Fine<input id="schedule-end" type="time" value="11:00" required></label></div><button class="primary" type="submit">Aggiungi fascia</button></form><div id="schedule-list"></div><button id="schedule-sync" class="secondary">Invia orari all’estensione</button><p id="schedule-status" role="status">Collega l’estensione per rendere effettivi gli orari.</p></section>`,
  );
  byId("page-progress").insertAdjacentHTML(
    "beforeend",
    `<section class="backup-section"><h2>Porta con te il tuo studio</h2><p>Il backup comprende sessioni, piani, domande, errori, orari e preferenze audio. Il ripristino si può fare anche in un altro browser.</p><label for="backup-file">Importa un backup JSON</label><input id="backup-file" type="file" accept=".json,application/json"><div id="backup-preview" hidden><p id="backup-summary"></p><label for="backup-mode">Come importare</label><select id="backup-mode"><option value="merge">Unisci ai dati attuali (conserva gli elementi già presenti)</option><option value="replace">Sostituisci i dati attuali</option></select><button id="backup-confirm" class="primary">Conferma importazione</button><button id="backup-cancel" class="secondary">Annulla</button></div><p id="backup-message" role="status"></p><button id="backup-undo" class="secondary" hidden>Ripristina i dati precedenti all’importazione</button><p class="hint">Prima di importare salviamo una copia locale dei dati attuali. Una sessione in corso deve essere conclusa prima del ripristino. L’ID dell’estensione di questo browser viene mantenuto.</p></section>`,
  );
  byId("exam-date").min = C.localDay(new Date());
  function commit() {
    save();
    renderFeatures();
  }
  function collectErrors() {
    const seen = new Set(S.seenSessions);
    let changed = false;
    for (const s of data.sessions) {
      if (seen.has(s.id)) continue;
      S.seenSessions.push(s.id);
      if (s.correction?.trim() || s.rating === "hard") {
        S.errors.push({
          id: uid(),
          sourceId: s.id,
          subject: s.subject,
          question: s.goal,
          solution:
            s.correction?.trim() ||
            "Riprendi il materiale di studio e verifica la risposta prima di valutarti.",
          due: Date.now(),
          interval: 1,
          count: 0,
          resolved: false,
        });
      }
      changed = true;
    }
    return changed;
  }
  function renderFeatures() {
    byId("exam-list").innerHTML = S.exams.length
      ? S.exams
          .map((e) => {
            const p = C.plan(e),
              done = e.topics.filter((t) => t.done).length;
            return `<article class="exam-entry"><div class="entry-top"><h2>${E(e.subject)}</h2><button class="text-button" data-delete-exam="${E(e.id)}">Elimina piano</button></div><p class="meta">Esame ${E(fmtDate(new Date(e.date + "T12:00:00").getTime()))} · ${done}/${e.topics.length} argomenti completati</p>${p.overflow ? `<p class="notice">Mancano ${p.overflow} minuti rispetto alla disponibilità. Aumenta il tempo o riduci gli argomenti creando un nuovo piano.</p>` : ""}${p.reviewMissed && !p.expired ? `<p class="hint">${p.reviewMissed} ripassi non trovano spazio dopo lo studio prima dell’esame. Anticipa gli argomenti o rivedi la disponibilità.</p>` : ""}${p.expired ? '<p class="notice">La data è arrivata. Puoi continuare a segnare gli argomenti completati o creare un nuovo piano.</p>' : ""}<details><summary>Argomenti e completamento</summary>${e.topics.map((t) => `<label class="topic-check"><input type="checkbox" data-topic="${E(t.id)}" data-exam="${E(e.id)}" ${t.done ? "checked" : ""}>${E(t.text)} <span>${t.minutes} min stimati</span></label>`).join("")}</details><div class="plan-days">${p.rows.map((row) => `<div class="plan-day"><h3>${E(fmtDate(new Date(row.date + "T12:00:00").getTime()))}</h3>${row.tasks.map((t) => `<div class="plan-task"><span>${t.kind === "review" ? "Ripasso · " : ""}${E(t.text)} <small>${t.minutes} min</small></span><button class="secondary" data-plan-start="${E(e.id)}" data-plan-topic="${E(t.topicId)}" data-plan-minutes="${t.minutes}" data-plan-kind="${t.kind}">Studia</button></div>`).join("")}</div>`).join("") || '<p class="hint">Nessun blocco da pianificare. Controlla giorni disponibili, data e argomenti completati.</p>'}</div></article>`;
          })
          .join("")
      : '<p class="empty">Il prossimo esame inizia da un piano realistico. Aggiungi materia, data e argomenti.</p>';
    const cards = S.cards
      .filter((c) => !byId("cards-due-only").checked || c.due <= Date.now())
      .sort((a, b) => a.due - b.due);
    byId("card-list").innerHTML = cards.length
      ? cards
          .map(
            (c) =>
              `<article class="entry"><div class="meta">${E(c.subject)} · ${c.due <= Date.now() ? "Da ripassare" : `Prossimo ripasso ${E(fmtDate(c.due))}`}</div><h3>${E(c.question)}</h3><button class="secondary" data-practice="card" data-item="${E(c.id)}">Rispondi senza guardare</button><button class="text-button" data-delete-card="${E(c.id)}">Elimina domanda</button></article>`,
          )
          .join("")
      : '<p class="empty">Nessuna domanda in questa selezione. Crea la prima o disattiva il filtro.</p>';
    const errors = S.errors
      .filter((e) => byId("errors-all").checked || !e.resolved)
      .sort((a, b) => a.resolved - b.resolved || a.due - b.due);
    byId("error-count").textContent = S.errors.filter(
      (e) => !e.resolved && e.due <= Date.now(),
    ).length;
    byId("error-list").innerHTML = errors.length
      ? errors
          .map(
            (e) =>
              `<article class="entry"><div class="meta">${E(e.subject)} · ${e.resolved ? "Risolto" : e.due <= Date.now() ? "Da riprovare" : `Ripasso ${E(fmtDate(e.due))}`}</div><h3>${E(e.question)}</h3><button class="secondary" data-practice="error" data-item="${E(e.id)}">Riprova senza appunti</button><button class="text-button" data-resolve="${E(e.id)}">${e.resolved ? "Riapri" : "Segna risolto"}</button></article>`,
          )
          .join("")
      : '<p class="empty">Nessun errore da riprendere. Le correzioni e le risposte difficili compariranno qui.</p>';
    byId("schedule-list").innerHTML =
      S.schedules
        .map(
          (s) =>
            `<div class="schedule-row"><label><input type="checkbox" data-schedule-toggle="${E(s.id)}" ${s.enabled ? "checked" : ""}>${s.days.map((d) => dayNames[d]).join(", ")} · ${s.start}–${s.end}${s.end < s.start ? " (+1 giorno)" : ""}</label><button class="text-button" data-schedule-delete="${E(s.id)}">Elimina fascia</button></div>`,
        )
        .join("") || '<p class="hint">Nessuna fascia programmata.</p>';
  }
  function start(subject, goal, five = false, plannedMinutes = null) {
    if (data.active) {
      notify("Concludi la sessione attuale prima di iniziarne un’altra.");
      location.hash = "focus";
      return;
    }
    location.hash = "focus";
    byId("subject").value = subject || byId("subject").value;
    byId("goal").value = goal || byId("goal").value;
    if (five) byId("duration").value = "5";
    if (plannedMinutes && plannedMinutes > 0 && plannedMinutes <= 90) {
      const value = String(plannedMinutes);
      if (
        ![...byId("duration").options].some((option) => option.value === value)
      )
        byId("duration").add(
          new Option(`${plannedMinutes} minuti · dal piano`, value),
        );
      byId("duration").value = value;
    }
    if (!byId("subject").value.trim() || !byId("goal").value.trim()) {
      notify(
        "Scegli materia e un piccolo obiettivo, poi premi Inizia a studiare.",
      );
      byId(!byId("subject").value.trim() ? "subject" : "goal").focus();
      return;
    }
    byId("setup").requestSubmit();
  }
  byId("five-minute").onclick = () => start(null, null, true);
  function immersive(on) {
    document.body.classList.toggle("immersive", on);
    byId("exit-immersive").hidden = !on;
    if (on) {
      location.hash = "focus";
      byId("exit-immersive").focus();
    } else byId(data.active ? "session-immersive" : "immersive").focus();
  }
  byId("immersive").onclick = byId("session-immersive").onclick = () =>
    immersive(true);
  byId("exit-immersive").onclick = () => immersive(false);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("immersive"))
      immersive(false);
  });
  byId("exam-form").onsubmit = (e) => {
    e.preventDefault();
    const subject = byId("exam-subject").value.trim(),
      date = byId("exam-date").value,
      minutes = Number(byId("exam-minutes").value),
      days = [...document.querySelectorAll('[name="exam-day"]:checked')].map(
        (x) => Number(x.value),
      );
    const raw = byId("exam-topics")
      .value.split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (
      !subject ||
      !days.length ||
      date <= C.localDay(new Date()) ||
      raw.length > 1000 ||
      minutes < 5 ||
      minutes > 480
    )
      return notify(
        "Scegli una data futura, almeno un giorno e da 5 a 480 minuti disponibili.",
      );
    const topics = [];
    for (const line of raw) {
      const parts = line.split("|"),
        text = parts[0].trim(),
        mins = parts.length === 1 ? 60 : Number(parts[1].trim());
      if (
        !text ||
        text.length > 220 ||
        !Number.isInteger(mins) ||
        mins < 5 ||
        mins > 10000 ||
        parts.length > 2
      )
        return notify(
          "Controlla gli argomenti: nome | minuti interi (da 5 a 10000).",
        );
      topics.push({ id: uid(), text, minutes: mins, done: false });
    }
    if (!topics.length) return;
    S.exams.push({ id: uid(), subject, date, minutes, days, topics });
    commit();
    byId("exam-form").reset();
    byId("exam-message").textContent =
      "Piano creato. Spunta un argomento quando lo hai davvero completato.";
  };
  byId("card-form").onsubmit = (e) => {
    e.preventDefault();
    const subject = byId("card-subject").value.trim(),
      question = byId("card-question").value.trim(),
      solution = byId("card-solution").value.trim();
    if (!subject || !question || !solution) return;
    S.cards.push({
      id: uid(),
      subject,
      question,
      solution,
      due: Date.now(),
      interval: 1,
      count: 0,
    });
    commit();
    byId("card-form").reset();
    notify("Domanda salvata e pronta per il richiamo.");
  };
  function practice(kind, id) {
    const item = (kind === "card" ? S.cards : S.errors).find(
      (x) => x.id === id,
    );
    if (!item) return;
    current = { kind, id };
    feedbackOpen = false;
    document.querySelectorAll(".practice").forEach((x) => {
      x.hidden = true;
      x.replaceChildren();
    });
    const panel = byId(kind === "card" ? "practice-card" : "practice-error");
    panel.hidden = false;
    panel.innerHTML = `<h2>${E(item.subject)}</h2><h3>${E(item.question)}</h3><label for="practice-answer">Il tuo tentativo, senza appunti</label><textarea id="practice-answer" rows="5" maxlength="10000" placeholder="Prova a rispondere prima di controllare…"></textarea><button id="reveal-answer" class="primary">Mostra la risposta di riferimento</button><div id="practice-feedback" hidden><h3>Confronta la risposta</h3><p class="solution">${E(item.solution)}</p><p class="hint">Controlla sul materiale se la soluzione di riferimento è incompleta. La valutazione è tua.</p><div class="practice-grades"><button class="secondary" data-grade="hard">Da riprendere</button><button class="secondary" data-grade="medium">Qualche lacuna</button><button class="primary" data-grade="easy">Ricordo autonomo</button></div></div><button id="practice-close" class="text-button">Chiudi esercizio</button>`;
    byId("reveal-answer").onclick = () => {
      if (!byId("practice-answer").value.trim())
        return notify("Scrivi prima un tentativo, anche incompleto.");
      feedbackOpen = true;
      byId("practice-feedback").hidden = false;
      byId("reveal-answer").hidden = true;
      byId("practice-feedback").tabIndex = -1;
      byId("practice-feedback").focus();
    };
    byId("practice-close").onclick = () => {
      panel.hidden = true;
      const closed = current;
      current = null;
      restorePracticeFocus(closed);
    };
    byId("practice-answer").focus();
    panel.scrollIntoView({
      block: "center",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }
  function restorePracticeFocus(previous) {
    const target =
      previous &&
      document.querySelector(
        `[data-practice="${previous.kind}"][data-item="${previous.id}"]`,
      );
    if (target) target.focus();
    else {
      const heading = byId(
        previous?.kind === "card" ? "page-cards" : "page-errors",
      ).querySelector("h1");
      heading.tabIndex = -1;
      heading.focus();
    }
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const d = b.dataset;
    if (d.planStart) {
      const exam = S.exams.find((x) => x.id === d.planStart),
        topic = exam?.topics.find((x) => x.id === d.planTopic);
      if (topic)
        start(
          exam.subject,
          ((d.planKind === "review" ? "Ripasso: " : "") + topic.text).slice(
            0,
            220,
          ),
          false,
          Number(d.planMinutes),
        );
    }
    if (d.deleteExam) {
      if (
        confirm(
          "Eliminare questo piano? Sessioni e ripassi resteranno nel diario.",
        )
      ) {
        S.exams = S.exams.filter((x) => x.id !== d.deleteExam);
        commit();
      }
    }
    if (d.deleteCard) {
      if (confirm("Eliminare questa domanda?")) {
        S.cards = S.cards.filter((x) => x.id !== d.deleteCard);
        if (current?.id === d.deleteCard) {
          byId("practice-card").hidden = true;
          current = null;
        }
        commit();
      }
    }
    if (d.practice) practice(d.practice, d.item);
    if (d.resolve) {
      const x = S.errors.find((x) => x.id === d.resolve);
      x.resolved = !x.resolved;
      if (!x.resolved) x.due = Date.now();
      commit();
    }
    if (d.grade && current && feedbackOpen) {
      const item = (current.kind === "card" ? S.cards : S.errors).find(
        (x) => x.id === current.id,
      );
      if (!item) return;
      const answer = byId("practice-answer").value.trim(),
        rating = d.grade;
      item.interval = C.nextInterval(item.interval, rating);
      item.count++;
      item.due = Date.now() + item.interval * DAY;
      S.logs.push({
        id: uid(),
        at: Date.now(),
        itemId: item.id,
        kind: current.kind,
        answer,
        rating,
      });
      if (current.kind === "card" && rating === "hard") {
        let error = S.errors.find((x) => x.sourceId === item.id);
        if (!error) {
          error = {
            id: uid(),
            sourceId: item.id,
            subject: item.subject,
            question: item.question,
            solution: item.solution,
            interval: 1,
            count: 0,
          };
          S.errors.push(error);
        }
        error.due = Date.now();
        error.resolved = false;
      }
      if (current.kind === "error") item.resolved = rating === "easy";
      document.querySelectorAll(".practice").forEach((x) => (x.hidden = true));
      const completed = current;
      current = null;
      commit();
      restorePracticeFocus(completed);
      notify(`Tentativo salvato. Prossimo ripasso: ${fmtDate(item.due)}.`);
    }
    if (d.scheduleDelete) {
      S.schedules = S.schedules.filter((x) => x.id !== d.scheduleDelete);
      commit();
      syncSchedules();
    }
  });
  document.addEventListener("change", (e) => {
    const d = e.target.dataset;
    if (d.topic) {
      const t = S.exams
        .find((x) => x.id === d.exam)
        ?.topics.find((x) => x.id === d.topic);
      if (t) {
        t.done = e.target.checked;
        t.doneAt = t.done ? Date.now() : null;
        commit();
      }
    }
    if (d.scheduleToggle) {
      const s = S.schedules.find((x) => x.id === d.scheduleToggle);
      if (s) {
        s.enabled = e.target.checked;
        commit();
        syncSchedules();
      }
    }
  });
  byId("cards-due-only").onchange = byId("errors-all").onchange =
    renderFeatures;
  async function syncSchedules() {
    if (!connected) {
      byId("schedule-status").textContent =
        "Orari salvati su questo browser. Collega l’estensione 2.0 e premi Invia orari.";
      return;
    }
    try {
      const response = await ext({
        type: "SET_SCHEDULES",
        schedules: S.schedules,
        domains: data.settings.domains,
      });
      blockUntil = response.until || 0;
      byId("schedule-status").textContent =
        "Orari sincronizzati con l’estensione. Restano attivi anche chiudendo questa pagina.";
      updateBlockStatus();
    } catch {
      byId("schedule-status").textContent =
        "Sincronizzazione non riuscita. Aggiorna l’estensione alla versione 2.0 e riprova.";
    }
  }
  byId("schedule-form").onsubmit = (e) => {
    e.preventDefault();
    try {
      if (S.schedules.length >= 30) throw Error();
      const schedule = C.validateSchedule({
        id: uid(),
        days: [
          ...document.querySelectorAll('[name="schedule-day"]:checked'),
        ].map((x) => Number(x.value)),
        start: byId("schedule-start").value,
        end: byId("schedule-end").value,
        enabled: true,
      });
      S.schedules.push(schedule);
      commit();
      syncSchedules();
    } catch {
      notify("Scegli almeno un giorno e due orari diversi. Massimo 30 fasce.");
    }
  };
  byId("schedule-sync").onclick = syncSchedules;
  window.addEventListener("studio:connected", (e) => {
    if (e.detail.version >= 2) syncSchedules();
  });
  byId("save-settings").addEventListener("click", () => {
    if (S.schedules.length) syncSchedules();
  });
  function backup() {
    let sound = null;
    try {
      sound = JSON.parse(localStorage.getItem("studio.sound.v1"));
    } catch {}
    return {
      format: "studio.backup",
      version: 3,
      exportedAt: new Date().toISOString(),
      data,
      sound,
    };
  }
  byId("export").onclick = () => {
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(backup(), null, 2)], {
          type: "application/json",
        }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = `studio-backup-${C.localDay(new Date())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  byId("backup-file").onchange = async () => {
    imported = null;
    byId("backup-preview").hidden = true;
    const file = byId("backup-file").files[0];
    if (!file) return;
    try {
      if (file.size > 15 * 1024 * 1024) throw Error("Il backup supera 15 MB.");
      imported = C.validateBackup(JSON.parse(await file.text()));
      const d = imported.data;
      byId("backup-summary").textContent =
        `File valido: ${d.sessions.length} sessioni, ${d.study.exams.length} piani, ${d.study.cards.length} domande, ${d.study.errors.length} errori. Controlla la modalità e conferma.`;
      byId("backup-preview").hidden = false;
      byId("backup-message").textContent = "Nessuna modifica applicata.";
    } catch (error) {
      byId("backup-message").textContent = error.message || "File non valido.";
    }
  };
  byId("backup-cancel").onclick = () => {
    imported = null;
    byId("backup-file").value = "";
    byId("backup-preview").hidden = true;
  };
  function merge(old, incoming) {
    const merged = {
      ...old,
      active: null,
      settings: {
        ...old.settings,
        ...incoming.settings,
        extensionId: old.settings.extensionId,
      },
      study: {},
    };
    for (const key of ["sessions", "reviews", "thoughts"]) {
      const map = new Map(old[key].map((x) => [x.id, x]));
      for (const x of incoming[key]) if (!map.has(x.id)) map.set(x.id, x);
      merged[key] = [...map.values()];
    }
    for (const key of ["exams", "cards", "errors", "schedules", "logs"]) {
      const map = new Map(old.study[key].map((x) => [x.id, x]));
      for (const x of incoming.study[key]) if (!map.has(x.id)) map.set(x.id, x);
      merged.study[key] = [...map.values()];
    }
    merged.study.seenSessions = [
      ...new Set([...old.study.seenSessions, ...incoming.study.seenSessions]),
    ];
    if (merged.study.schedules.length > 30)
      throw Error("L’unione supera il limite di 30 fasce orarie.");
    return merged;
  }
  function applyRestore(next, sound) {
    const previous = localStorage.getItem(KEY),
      audio = localStorage.getItem("studio.sound.v1");
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      if (sound) localStorage.setItem("studio.sound.v1", JSON.stringify(sound));
    } catch (error) {
      if (previous !== null) localStorage.setItem(KEY, previous);
      if (audio !== null) localStorage.setItem("studio.sound.v1", audio);
      throw error;
    }
    location.hash = "progress";
    location.reload();
  }
  byId("backup-confirm").onclick = () => {
    if (!imported) return;
    if (data.active)
      return notify("Concludi la sessione in corso prima di importare.");
    try {
      const next =
        byId("backup-mode").value === "merge"
          ? merge(data, imported.data)
          : {
              ...imported.data,
              settings: {
                ...imported.data.settings,
                extensionId: data.settings.extensionId,
              },
            };
      localStorage.setItem("studio.pre-import", JSON.stringify(backup()));
      applyRestore(next, imported.sound);
    } catch (error) {
      byId("backup-message").textContent =
        `Importazione annullata: ${error.message}`;
    }
  };
  byId("backup-undo").hidden = !localStorage.getItem("studio.pre-import");
  byId("backup-undo").onclick = () => {
    if (data.active)
      return notify("Concludi la sessione in corso prima di ripristinare.");
    try {
      const previous = C.validateBackup(
        JSON.parse(localStorage.getItem("studio.pre-import")),
      );
      previous.data.settings.extensionId = data.settings.extensionId;
      applyRestore(previous.data, previous.sound);
    } catch {
      notify("La copia precedente non è disponibile o non è valida.");
    }
  };
  window.addEventListener("hashchange", renderFeatures);
  window.addEventListener("studio:saved", () => {
    if (saving) return;
    saving = true;
    if (collectErrors()) save();
    renderFeatures();
    saving = false;
  });
  const continueButton = document.createElement("button");
  continueButton.type = "button";
  continueButton.className = "secondary";
  continueButton.id = "continue-focus";
  continueButton.textContent = "Continua altri 25 minuti";
  byId("recall").prepend(continueButton);
  function updateContinue() {
    continueButton.hidden = !(
      data.active?.phase === "recall" && data.active.total === 5 * 60000
    );
  }
  continueButton.onclick = () => {
    const a = data.active;
    if (!a || a.phase !== "recall") return;
    a.accumulatedSeconds = a.seconds || 0;
    a.seconds = 0;
    a.phase = "focus";
    a.running = true;
    a.total = 25 * 60000;
    a.remaining = a.total;
    a.end = Date.now() + a.total;
    save();
    syncBlock();
    render();
  };
  window.addEventListener("studio:saved", updateContinue);
  updateContinue();
  setInterval(async () => {
    if (!connected) return;
    try {
      const status = await ext({ type: "PING" });
      blockUntil = status.until || 0;
      updateBlockStatus();
    } catch {
      connected = false;
      updateBlockStatus();
    }
  }, 30000);
  if (collectErrors()) save();
  renderFeatures();
  route();
  if (connected) syncSchedules();
})();
