"use strict";
(() => {
  const S = data.study,
    C = StudyCore,
    A = AgendaCore,
    $ = (id) => document.getElementById(id),
    E = esc,
    id = () => crypto.randomUUID();
  S.agendaEvents ||= [];
  S.agendaOverrides ||= [];
  S.drafts ||= {};
  let restoring = false,
    weekOffset = 0,
    editingExam = null,
    editingEvent = null,
    moving = null,
    activePractice = null,
    draftTimer;
  const formIds = [
    "setup",
    "exam-form",
    "card-form",
    "schedule-form",
    "week-event-form",
    "exam-editor",
  ];
  const dateLabel = (date) =>
    new Date(date + "T12:00:00").toLocaleDateString("it-IT", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  function addPage(name, title, subtitle, body) {
    const section = document.createElement("section");
    section.id = `page-${name}`;
    section.className = "page";
    section.hidden = true;
    section.innerHTML = `<div class="heading"><h1>${title}</h1><p>${subtitle}</p></div>${body}`;
    document.querySelector(".source-strip").before(section);
  }
  addPage(
    "today",
    "Oggi",
    "Blocchi del piano, domande ed errori in scadenza oggi.",
    `<div id="today-summary" class="agenda-summary"></div><div class="list-toolbar"><h2>Da fare</h2><a href="#week">Apri la settimana</a></div><p class="hint">Errori e domande scadute arrivano qui insieme ai blocchi di oggi. Le durate dei richiami sono stime.</p><div id="today-agenda"></div>`,
  );
  addPage(
    "week",
    "Settimana",
    "Studio, ripassi e impegni da lunedì a domenica.",
    `<div class="week-controls"><div><button id="week-prev" class="secondary" aria-label="Settimana precedente">←</button><button id="week-current" class="secondary">Questa settimana</button><button id="week-next" class="secondary" aria-label="Settimana successiva">→</button></div><h2 id="week-label"></h2></div><p class="hint">I blocchi dei piani si aggiornano con il lavoro rimanente. Con “Sposta” assegni giorno e ora; gli orari del programma non attivano il blocco social, che si configura in Blocco social.</p><div id="week-grid" class="week-grid"></div><p id="week-conflicts" class="notice" hidden></p><div class="week-edit-grid"><form id="week-event-form" class="feature-form"><h2 id="event-form-title">Aggiungi un impegno</h2><label for="event-title">Titolo dell’impegno</label><input id="event-title" required maxlength="220" placeholder="Es. Esercizi, lezione, allenamento"><label for="event-subject">Materia o categoria</label><input id="event-subject" maxlength="80" placeholder="Es. Matematica"><div class="duration-row"><label>Giorno<input id="event-date" type="date" required></label><label>Ora (facoltativa)<input id="event-time" type="time"></label></div><div class="duration-row"><label>Durata in minuti<input id="event-minutes" type="number" min="5" max="480" value="40" required></label><label>Tipo<select id="event-type"><option value="study">Studio</option><option value="commitment">Impegno</option><option value="break">Pausa</option></select></label></div><button class="primary wide" id="event-submit">Aggiungi al programma</button><button class="text-button" type="button" id="event-cancel" hidden>Annulla modifica</button><p id="event-message" role="status"></p></form><form id="move-form" class="feature-form" hidden><h2>Sposta il blocco</h2><p id="move-title"></p><label for="move-date">Nuovo giorno</label><input id="move-date" type="date" required><label for="move-time">Ora (facoltativa)</label><input id="move-time" type="time"><p class="hint">Lo spostamento cambia il programma personale. Le scadenze di ripasso restano visibili nella sezione originale.</p><button class="primary wide">Salva spostamento</button><button class="text-button" type="button" id="move-cancel">Annulla</button><p id="move-message" role="status"></p></form></div>`,
  );
  addPage(
    "attempts",
    "Tentativi",
    "Le risposte date nelle sessioni e nelle domande, dalla più recente.",
    `<div class="history-filters"><label>Materia<select id="attempt-subject"><option value="">Tutte le materie</option></select></label><label>Tipo<select id="attempt-type"><option value="">Tutti i tentativi</option><option value="session">Sessioni</option><option value="card">Domande</option><option value="error">Errori</option></select></label></div><div id="attempt-list"></div>`,
  );
  $("page-planning")
    .querySelector(".heading")
    .insertAdjacentHTML(
      "afterend",
      `<form id="exam-editor" class="feature-form exam-editor" hidden><h2>Modifica il piano</h2><p class="hint">Gli argomenti mantengono identità e completamento. Il lavoro rimanente viene ridistribuito; i blocchi automatici possono cambiare giorno.</p><label for="edit-subject">Materia del piano</label><input id="edit-subject" required maxlength="80"><div class="duration-row"><label>Nuova data dell’esame<input id="edit-date" type="date" required></label><label>Minuti disponibili al giorno<input id="edit-minutes" type="number" min="5" max="480" required></label></div><fieldset><legend>Giorni di studio</legend><div class="day-picks">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label><input type="checkbox" name="edit-day" value="${d}">${["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"][d]}</label>`).join("")}</div></fieldset><label class="checkbox"><input id="edit-reviews" type="checkbox">Aggiungi un breve ripasso per ogni argomento dopo averlo studiato</label><h3>Argomenti</h3><div id="edit-topics"></div><button type="button" id="edit-add-topic" class="secondary">Aggiungi argomento</button><div class="editor-actions"><button class="primary">Salva modifiche al piano</button><button type="button" id="edit-cancel" class="secondary">Annulla</button></div><p id="edit-message" role="status"></p></form>`,
    );
  document
    .querySelector('label[for="card-question"]')
    .insertAdjacentHTML(
      "beforebegin",
      '<label for="card-topic-link">Collega a un argomento (facoltativo)</label><select id="card-topic-link"></select>',
    );
  document
    .querySelector("header")
    .insertAdjacentHTML(
      "afterend",
      '<p id="draft-status" class="draft-status">Le bozze si salvano mentre scrivi.</p>',
    );
  function persistDrafts() {
    clearTimeout(draftTimer);
    if (restoring) return;
    if (editingExam && !$("exam-editor").hidden) {
      S.drafts["exam-editor:rows"] = JSON.stringify(
        [...document.querySelectorAll("[data-edit-topic]")].map((row) => ({
          id: row.dataset.editTopic,
          text: row.querySelector("[data-edit-text]").value,
          minutes: Number(row.querySelector("[data-edit-time]").value) || 0,
          done: row.querySelector("[data-edit-done]").checked,
        })),
      );
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      $("draft-status").textContent = "Bozze salvate su questo browser.";
    } catch {
      $("draft-status").textContent =
        "Bozze non salvate: spazio non disponibile. Esporta i dati.";
    }
  }
  function keyFor(input) {
    const form = input.closest("form");
    if (!form || !formIds.includes(form.id)) return null;
    const field = input.id || (input.name && `${input.name}:${input.value}`);
    return field ? `${form.id}:${field}` : null;
  }
  function restoreForm(form) {
    form.querySelectorAll("input,textarea,select").forEach((input) => {
      const key = keyFor(input);
      if (key && Object.hasOwn(S.drafts, key)) {
        if (input.type === "checkbox") input.checked = !!S.drafts[key];
        else {
          const value = S.drafts[key];
          if (
            input.tagName === "SELECT" &&
            ![...input.options].some((option) => option.value === String(value))
          ) {
            if (
              input.id === "duration" &&
              Number(value) > 0 &&
              Number(value) <= 90
            )
              input.add(
                new Option(
                  `${Number(value)} minuti · dal piano`,
                  String(value),
                ),
              );
            else return;
          }
          input.value = value;
        }
      }
    });
  }
  function clearFormDraft(formId) {
    for (const key of Object.keys(S.drafts))
      if (key.startsWith(formId + ":")) delete S.drafts[key];
    persistDrafts();
  }
  document.addEventListener("input", (e) => {
    const input = e.target;
    if (!input.matches("input,textarea,select") || input.type === "file")
      return;
    if (input.id === "practice-answer" && activePractice) {
      S.drafts[`practice_${activePractice.kind}_${activePractice.id}`] =
        input.value;
    } else {
      const key = keyFor(input);
      if (!key) return;
      S.drafts[key] = input.type === "checkbox" ? input.checked : input.value;
    }
    clearTimeout(draftTimer);
    draftTimer = setTimeout(persistDrafts, 300);
  });
  document.addEventListener("change", (e) => {
    const key = keyFor(e.target);
    if (key) {
      S.drafts[key] =
        e.target.type === "checkbox" ? e.target.checked : e.target.value;
      persistDrafts();
    }
  });
  document.addEventListener("reset", (e) => clearFormDraft(e.target.id));
  window.addEventListener("studio:before-restore", () => {
    restoring = true;
    clearTimeout(draftTimer);
  });
  window.addEventListener("pagehide", persistDrafts);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) persistDrafts();
  });
  window.addEventListener("studio:practice-open", (e) => {
    activePractice = e.detail;
    const draft =
      S.drafts[`practice_${activePractice.kind}_${activePractice.id}`];
    if (typeof draft === "string") $("practice-answer").value = draft;
  });
  window.addEventListener("studio:practice-graded", (e) => {
    delete S.drafts[`practice_${e.detail.kind}_${e.detail.id}`];
    persistDrafts();
  });
  function topicOptions(selected = "") {
    return (
      '<option value="">Nessun argomento collegato</option>' +
      S.exams
        .map(
          (exam) =>
            `<optgroup label="${E(exam.subject)}">${exam.topics.map((t) => `<option value="${E(exam.id + ":" + t.id)}" ${selected === exam.id + ":" + t.id ? "selected" : ""}>${E(t.text)}</option>`).join("")}</optgroup>`,
        )
        .join("")
    );
  }
  function linkedCards(examId, topicId) {
    return S.cards.filter((c) => c.examId === examId && c.topicId === topicId);
  }
  function augment() {
    const chosen =
      $("card-topic-link").value || S.drafts["card-form:card-topic-link"] || "";
    $("card-topic-link").innerHTML = topicOptions(chosen);
    document.querySelectorAll("[data-delete-exam]").forEach((button) => {
      if (button.parentElement.querySelector("[data-edit-exam]")) return;
      button.insertAdjacentHTML(
        "beforebegin",
        `<button class="text-button" data-edit-exam="${E(button.dataset.deleteExam)}">Modifica piano</button>`,
      );
    });
    document.querySelectorAll("[data-topic]").forEach((input) => {
      if (
        input.closest("label").nextElementSibling?.matches("[data-topic-quiz]")
      )
        return;
      const cards = linkedCards(input.dataset.exam, input.dataset.topic);
      if (cards.length)
        input
          .closest("label")
          .insertAdjacentHTML(
            "afterend",
            `<button class="text-button topic-quiz" data-topic-quiz="${E(input.dataset.topic)}" data-quiz-exam="${E(input.dataset.exam)}">Verifica il ricordo · ${cards.length} domande</button>`,
          );
    });
    document.querySelectorAll("[data-delete-card]").forEach((button) => {
      const card = S.cards.find((c) => c.id === button.dataset.deleteCard);
      if (!card || button.parentElement.querySelector("[data-card-link]"))
        return;
      button.insertAdjacentHTML(
        "beforebegin",
        `<label class="card-link-label">Argomento della domanda<select data-card-link="${E(card.id)}">${topicOptions(card.examId && card.topicId ? card.examId + ":" + card.topicId : "")}</select></label>`,
      );
    });
  }
  $("card-topic-link").addEventListener("change", () => {
    const exam = S.exams.find(
      (e) => e.id === $("card-topic-link").value.split(":")[0],
    );
    if (exam) {
      $("card-subject").value = exam.subject;
      S.drafts["card-form:card-subject"] = exam.subject;
      persistDrafts();
    }
  });
  function eventRow(event, compact = false) {
    return `<article class="agenda-event ${event.done ? "event-done" : ""}"><div class="agenda-event-meta">${event.time || "Orario libero"} · ${event.minutes} min${["card", "error", "review"].includes(event.source) ? " stimati" : ""}${event.originalDate && event.originalDate < C.localDay(new Date()) ? " · Scaduto" : ""}</div><h3>${E(event.subject || "Personale")}</h3><p>${E((event.kind === "review" ? "Ripasso · " : "") + event.title)}</p><div class="agenda-event-actions">${!event.done && !(event.source === "custom" && event.type !== "study") ? `<button class="${compact ? "text-button" : "primary"}" data-agenda-start="${E(event.id)}">Inizia</button>` : ""}<button class="text-button" data-agenda-move="${E(event.id)}">Sposta</button>${["plan", "custom"].includes(event.source) ? `<button class="text-button" data-agenda-done="${E(event.id)}">${event.done ? "Riapri" : "Fatto"}</button>` : ""}${event.source === "custom" ? `<button class="text-button" data-event-edit="${E(event.id)}">Modifica</button>` : ""}</div>${event.done ? '<span class="completion-label">Completato nel programma</span>' : ""}</article>`;
  }
  function history() {
    const entries = data.sessions.map((s) => ({
      ...s,
      kind: "session",
      question: s.goal,
      solution: s.correction || "",
      label: s.reviewId ? "Ripasso di sessione" : "Sessione",
    }));
    for (const log of S.logs) {
      const item = (log.kind === "card" ? S.cards : S.errors).find(
        (x) => x.id === log.itemId,
      );
      entries.push({
        ...log,
        subject: log.subject || item?.subject || "Elemento eliminato",
        question: log.question || item?.question || "Tentativo archiviato",
        solution: log.solution ?? item?.solution ?? "",
        label: log.kind === "card" ? "Domanda" : "Errore",
        currentReference: log.solution == null,
      });
    }
    return entries.sort((a, b) => b.at - a.at);
  }
  function renderAgenda() {
    augment();
    const all = A.build(data),
      today = C.localDay(new Date()),
      due = all.filter((e) => !e.done && e.date <= today),
      minutes = due.reduce((n, e) => n + e.minutes, 0);
    $("today-summary").innerHTML =
      `<p><strong>${due.length}</strong> attività da affrontare <span>· ${minutes} minuti stimati</span></p>`;
    $("today-agenda").innerHTML = due.length
      ? due.map((e) => eventRow(e)).join("")
      : '<p class="empty">Per oggi non ci sono attività in programma. Puoi aggiungerne una nella settimana o creare un piano d’esame.</p>';
    const start = A.weekStart(new Date(), weekOffset),
      dates = Array.from({ length: 7 }, (_, i) => A.addDays(start, i));
    $("week-label").textContent =
      `${dateLabel(start)} — ${dateLabel(dates[6])}`;
    $("week-grid").innerHTML = dates
      .map((date) => {
        const entries = all.filter((e) => e.date === date),
          total = entries
            .filter((e) => !e.done)
            .reduce((n, e) => n + e.minutes, 0);
        return `<section class="week-day ${date === today ? "is-today" : ""}"><div class="week-day-heading"><h3>${dateLabel(date)}</h3><span>${total} min</span></div>${entries.map((e) => eventRow(e, true)).join("") || '<p class="week-free">Niente in programma.</p>'}<button class="text-button" data-add-on="${date}">Aggiungi qui</button></section>`;
      })
      .join("");
    const conflicts = all.filter(
      (e) => dates.includes(e.date) && !e.done && A.conflicts(all, e).length,
    );
    $("week-conflicts").hidden = !conflicts.length;
    $("week-conflicts").textContent =
      `Ci sono sovrapposizioni di orario per ${conflicts.length} attività. Usa Sposta per riorganizzarle.`;
    const entries = history(),
      select = $("attempt-subject"),
      selected = select.value;
    select.innerHTML =
      '<option value="">Tutte le materie</option>' +
      [...new Set(entries.map((e) => e.subject))]
        .sort()
        .map(
          (s) =>
            `<option value="${E(s)}" ${s === selected ? "selected" : ""}>${E(s)}</option>`,
        )
        .join("");
    const filtered = entries.filter(
      (e) =>
        (!select.value || e.subject === select.value) &&
        (!$("attempt-type").value || e.kind === $("attempt-type").value),
    );
    $("attempt-list").innerHTML = filtered.length
      ? filtered
          .map(
            (e) =>
              `<article class="entry"><p class="meta">${E(new Date(e.at).toLocaleString("it-IT"))} · ${E(e.subject)} · ${e.label}</p><h3>${E(e.question)}</h3><p class="attempt-grade">${ratingLabel(e.rating)}</p><details><summary>Leggi risposta e riferimento</summary><h4>Il tuo tentativo</h4><p class="solution">${E(e.answer)}</p><h4>${e.kind === "session" ? "Correzioni annotate" : e.currentReference ? "Riferimento attuale" : "Riferimento al momento del tentativo"}</h4><p class="solution">${E(e.solution || "Nessuna annotazione.")}</p></details></article>`,
          )
          .join("")
      : '<p class="empty">Nessun tentativo in questa selezione. Le sessioni e le domande completate compariranno qui.</p>';
  }
  function persist() {
    save();
    StudyActions.refresh();
    renderAgenda();
  }
  function topicRow(topic = { id: id(), text: "", minutes: 60, done: false }) {
    return `<div class="edit-topic-row" data-edit-topic="${E(topic.id)}"><label>Argomento<input id="edit-text-${E(topic.id)}" data-edit-text value="${E(topic.text)}" required maxlength="220"></label><label>Minuti stimati<input id="edit-time-${E(topic.id)}" data-edit-time type="number" min="5" max="10000" value="${topic.minutes}" required></label><label class="topic-check"><input id="edit-done-${E(topic.id)}" data-edit-done type="checkbox" ${topic.done ? "checked" : ""}>Completato</label><button class="text-button" type="button" data-remove-edit-topic="${E(topic.id)}">Rimuovi argomento</button></div>`;
  }
  function openExam(exam) {
    if (
      S.drafts["exam-editor:editingId"] &&
      S.drafts["exam-editor:editingId"] !== exam.id
    )
      clearFormDraft("exam-editor");
    editingExam = exam.id;
    $("exam-editor").hidden = false;
    $("edit-subject").value = exam.subject;
    $("edit-date").value = exam.date;
    $("edit-minutes").value = exam.minutes;
    $("edit-reviews").checked = exam.reviews !== false;
    document
      .querySelectorAll('[name="edit-day"]')
      .forEach((x) => (x.checked = exam.days.includes(Number(x.value))));
    let draftTopics = exam.topics;
    if (S.drafts["exam-editor:editingId"] === exam.id) {
      try {
        const rows = JSON.parse(S.drafts["exam-editor:rows"] || "null");
        if (
          Array.isArray(rows) &&
          rows.length <= 1000 &&
          rows.every(
            (t) =>
              t &&
              /^[a-zA-Z0-9_-]{1,128}$/.test(t.id) &&
              typeof t.text === "string" &&
              t.text.length <= 220 &&
              typeof t.minutes === "number" &&
              Number.isFinite(t.minutes),
          )
        )
          draftTopics = rows;
      } catch {}
    }
    $("edit-topics").innerHTML = draftTopics.map(topicRow).join("");
    S.drafts["exam-editor:editingId"] = exam.id;
    restoreForm($("exam-editor"));
    $("edit-subject").focus();
    $("exam-editor").scrollIntoView({ block: "start" });
  }
  $("edit-add-topic").onclick = () => {
    $("edit-topics").insertAdjacentHTML("beforeend", topicRow());
  };
  $("edit-cancel").onclick = () => {
    editingExam = null;
    $("exam-editor").hidden = true;
    clearFormDraft("exam-editor");
  };
  $("exam-editor").onsubmit = (e) => {
    e.preventDefault();
    const exam = S.exams.find((x) => x.id === editingExam);
    if (!exam) return;
    const subject = $("edit-subject").value.trim(),
      date = $("edit-date").value,
      minutes = Number($("edit-minutes").value),
      days = [...document.querySelectorAll('[name="edit-day"]:checked')].map(
        (x) => Number(x.value),
      );
    const rows = [...document.querySelectorAll("[data-edit-topic]")].map(
      (row) => ({
        id: row.dataset.editTopic,
        text: row.querySelector("[data-edit-text]").value.trim(),
        minutes: Number(row.querySelector("[data-edit-time]").value),
        done: row.querySelector("[data-edit-done]").checked,
      }),
    );
    if (
      !subject ||
      date <= C.localDay(new Date()) ||
      !days.length ||
      !Number.isInteger(minutes) ||
      minutes < 5 ||
      minutes > 480 ||
      !rows.length ||
      rows.some(
        (t) =>
          !t.text ||
          !Number.isInteger(t.minutes) ||
          t.minutes < 5 ||
          t.minutes > 10000,
      )
    )
      return notify(
        "Controlla data futura, giorni, argomenti e minuti interi.",
      );
    const oldSubject = exam.subject;
    exam.subject = subject;
    exam.date = date;
    exam.minutes = minutes;
    exam.days = days;
    exam.reviews = $("edit-reviews").checked;
    exam.topics = A.preserveTopics(exam.topics, rows);
    for (const card of S.cards) {
      if (card.examId === exam.id && card.subject === oldSubject)
        card.subject = subject;
      if (card.examId === exam.id && !rows.some((t) => t.id === card.topicId)) {
        card.examId = null;
        card.topicId = null;
      }
    }
    editingExam = null;
    $("exam-editor").hidden = true;
    clearFormDraft("exam-editor");
    persist();
    notify(
      "Piano aggiornato. Completamento e domande degli argomenti rimasti sono conservati.",
    );
  };
  function openEvent(event) {
    editingEvent = event?.id || null;
    $("event-delete").hidden = !event;
    $("event-form-title").textContent = event
      ? "Modifica impegno"
      : "Aggiungi un impegno";
    $("event-submit").textContent = event
      ? "Salva impegno"
      : "Aggiungi al programma";
    $("event-cancel").hidden = !event;
    if (event) {
      $("event-title").value = event.title;
      $("event-subject").value = event.subject;
      $("event-date").value = event.date;
      $("event-time").value = event.time;
      $("event-minutes").value = event.minutes;
      $("event-type").value = event.type;
    }
    S.drafts["week-event-form:editingId"] = editingEvent || "";
    $("event-title").focus();
  }
  $("event-cancel").onclick = () => {
    editingEvent = null;
    $("event-delete").hidden = true;
    $("week-event-form").reset();
    $("event-cancel").hidden = true;
    $("event-form-title").textContent = "Aggiungi un impegno";
    $("event-submit").textContent = "Aggiungi al programma";
    $("event-date").value = C.localDay(new Date());
  };
  $("event-cancel").insertAdjacentHTML(
    "afterend",
    '<button id="event-delete" class="text-button" type="button" hidden>Elimina impegno</button>',
  );
  $("event-delete").onclick = () => {
    if (!editingEvent || !confirm("Eliminare questo impegno dal programma?"))
      return;
    S.agendaEvents = S.agendaEvents.filter((x) => x.id !== editingEvent);
    S.agendaOverrides = S.agendaOverrides.filter((x) => x.id !== editingEvent);
    $("event-cancel").click();
    persist();
    notify("Impegno eliminato.");
  };
  $("week-event-form").onsubmit = (e) => {
    e.preventDefault();
    const title = $("event-title").value.trim(),
      subject = $("event-subject").value.trim(),
      date = $("event-date").value,
      time = $("event-time").value,
      minutes = Number($("event-minutes").value),
      type = $("event-type").value;
    if (
      !title ||
      !date ||
      !Number.isInteger(minutes) ||
      minutes < 5 ||
      minutes > 480
    )
      return notify("Inserisci titolo, giorno e una durata da 5 a 480 minuti.");
    if (
      time &&
      Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) + minutes > 1440
    )
      return notify("L’impegno supera la mezzanotte: dividilo in due giorni.");
    let event = editingEvent
      ? S.agendaEvents.find((x) => x.id === editingEvent)
      : null;
    if (event) {
      event.done = A.build(data).find((x) => x.id === event.id)?.done || false;
      Object.assign(event, { title, subject, date, time, minutes, type });
      S.agendaOverrides = S.agendaOverrides.filter((x) => x.id !== event.id);
    } else {
      event = {
        id: id(),
        title,
        subject,
        date,
        time,
        minutes,
        type,
        done: false,
      };
      S.agendaEvents.push(event);
    }
    const count = A.conflicts(A.build(data), event).length;
    $("event-cancel").click();
    persist();
    $("event-message").textContent = count
      ? "Impegno salvato. C’è una sovrapposizione di orario: puoi spostarlo."
      : "Impegno salvato nel programma.";
  };
  $("move-form").onsubmit = (e) => {
    e.preventDefault();
    if (!moving) return;
    const date = $("move-date").value,
      time = $("move-time").value;
    if (
      time &&
      Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) + moving.minutes >
        1440
    )
      return notify("Il blocco supera la mezzanotte: scegli un altro orario.");
    let override = S.agendaOverrides.find((x) => x.id === moving.id);
    if (!override) {
      override = { id: moving.id, done: moving.done };
      S.agendaOverrides.push(override);
    }
    Object.assign(override, { date, time });
    const overlaps = A.conflicts(A.build(data), {
      ...moving,
      date,
      time,
    }).length;
    $("move-form").hidden = true;
    moving = null;
    persist();
    notify(
      overlaps
        ? "Blocco spostato, ma l’orario si sovrappone a un’altra attività."
        : "Blocco spostato nel programma.",
    );
  };
  $("move-cancel").onclick = () => {
    $("move-form").hidden = true;
    moving = null;
  };
  $("week-prev").onclick = () => {
    weekOffset--;
    renderAgenda();
  };
  $("week-next").onclick = () => {
    weekOffset++;
    renderAgenda();
  };
  $("week-current").onclick = () => {
    weekOffset = 0;
    renderAgenda();
  };
  $("attempt-subject").onchange = $("attempt-type").onchange = renderAgenda;
  document.addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    const d = button.dataset;
    if (d.editExam) {
      const exam = S.exams.find((x) => x.id === d.editExam);
      if (exam) openExam(exam);
    }
    if (d.deleteExam && !S.exams.some((x) => x.id === d.deleteExam)) {
      for (const card of S.cards)
        if (card.examId === d.deleteExam) {
          card.examId = null;
          card.topicId = null;
        }
      if (editingExam === d.deleteExam) {
        editingExam = null;
        $("exam-editor").hidden = true;
        clearFormDraft("exam-editor");
      }
      persist();
    }
    if (d.removeEditTopic) {
      document
        .querySelector(`[data-edit-topic="${d.removeEditTopic}"]`)
        ?.remove();
    }
    if (d.topicQuiz) {
      const cards = linkedCards(d.quizExam, d.topicQuiz);
      if (cards.length) {
        location.hash = "cards";
        StudyActions.practice(
          "card",
          cards.sort((a, b) => a.due - b.due)[0].id,
        );
      }
    }
    if (d.addOn) {
      location.hash = "week";
      $("event-cancel").click();
      $("event-date").value = d.addOn;
      openEvent(null);
    }
    if (d.eventEdit) {
      const event = A.build(data).find((x) => x.id === d.eventEdit);
      if (event) {
        location.hash = "week";
        openEvent(event);
        $("week-event-form").scrollIntoView({ block: "center" });
      }
    }
    const target = d.agendaStart || d.agendaMove || d.agendaDone;
    if (!target) return;
    const event = A.build(data).find((x) => x.id === target);
    if (!event) return;
    if (d.agendaStart) {
      if (["card", "error"].includes(event.source)) {
        location.hash = event.source === "card" ? "cards" : "errors";
        StudyActions.practice(event.source, event.itemId);
      } else if (event.source === "review") {
        if (data.active)
          return notify("Concludi la sessione attuale prima del ripasso.");
        const review = data.reviews.find((x) => x.id === event.itemId);
        data.active = {
          subject: review.subject,
          goal: review.goal,
          phase: "recall",
          running: false,
          seconds: 0,
          reviewId: review.id,
          breakMinutes: 5,
        };
        save();
        location.hash = "focus";
        render();
        $("answer").focus();
      } else
        StudyActions.start(
          event.subject || "Studio personale",
          ((event.kind === "review" ? "Ripasso: " : "") + event.title).slice(
            0,
            220,
          ),
          false,
          Math.min(90, event.minutes),
        );
    }
    if (d.agendaMove) {
      moving = event;
      location.hash = "week";
      $("move-form").hidden = false;
      $("move-title").textContent = event.title;
      $("move-date").value = event.date;
      $("move-time").value = event.time;
      $("move-date").focus();
      $("move-form").scrollIntoView({ block: "center" });
    }
    if (d.agendaDone) {
      let override = S.agendaOverrides.find((x) => x.id === event.id);
      if (!override) {
        override = {
          id: event.id,
          date: event.date,
          time: event.time,
          done: false,
        };
        S.agendaOverrides.push(override);
      }
      override.done = !event.done;
      persist();
    }
  });
  document.addEventListener("change", (e) => {
    if (!e.target.dataset.cardLink) return;
    const card = S.cards.find((c) => c.id === e.target.dataset.cardLink);
    if (card) {
      [card.examId, card.topicId] = e.target.value
        ? e.target.value.split(":")
        : [null, null];
      persist();
    }
  });
  window.addEventListener("studio:features-rendered", renderAgenda);
  window.addEventListener("hashchange", renderAgenda);
  $("event-date").value = C.localDay(new Date());
  augment();
  for (const formId of formIds) {
    const form = $(formId);
    if (form && formId !== "exam-editor") restoreForm(form);
  }
  const draftExam = S.exams.find(
    (e) => e.id === S.drafts["exam-editor:editingId"],
  );
  if (draftExam) openExam(draftExam);
  const draftEvent = S.agendaEvents.find(
    (e) => e.id === S.drafts["week-event-form:editingId"],
  );
  if (draftEvent) {
    openEvent(A.build(data).find((event) => event.id === draftEvent.id) || draftEvent);
    restoreForm($("week-event-form"));
  }
  renderAgenda();
  route();
})();
