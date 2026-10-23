// Statistiche per materia, calendario dell'anno, domande da un testo,
// modalità esame e note per gli argomenti dei piani d'esame.
(() => {
  "use strict";
  data.study ||= {};
  const S = data.study;
  S.cards ||= [];
  S.logs ||= [];
  S.errors ||= [];
  S.examRuns ||= [];
  const byId = (id) => document.getElementById(id),
    DAY_MS = 86400000,
    localDay = (t) => StudyCore.localDay(new Date(t)),
    norm = (s) => String(s || "").trim().toLocaleLowerCase("it-IT");

  // ==== Progressi: statistiche per materia e calendario dell'anno ==========
  byId("week").insertAdjacentHTML(
    "afterend",
    `<div class="list-toolbar"><h2>Per materia</h2><label class="sr-only" for="stats-range">Periodo</label><select id="stats-range" class="compact-select"><option value="30">Ultimi 30 giorni</option><option value="365">Ultimo anno</option><option value="0">Da sempre</option></select></div><div id="subject-stats" class="subject-stats"></div>
    <h2>Il tuo anno di studio</h2><p id="heatmap-summary" class="hint"></p><div class="heatmap-wrap"><div id="heatmap" class="heatmap" role="img"></div></div><div class="heatmap-legend" aria-hidden="true">Meno <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> Più</div>`,
  );
  byId("stats-range").onchange = renderStats;

  function renderStats() {
    const days = Number(byId("stats-range").value),
      from = days ? Date.now() - days * DAY_MS : 0,
      groups = new Map();
    const group = (subject) => {
      const key = norm(subject) || "senza materia";
      if (!groups.has(key))
        groups.set(key, { name: String(subject || "").trim() || "Senza materia", minutes: 0, sessions: 0, easy: 0, medium: 0, hard: 0 });
      return groups.get(key);
    };
    for (const s of data.sessions) {
      if (s.at < from) continue;
      const g = group(s.subject);
      g.minutes += Math.round((s.seconds || 0) / 60);
      g.sessions++;
      g[s.rating]++;
    }
    for (const l of S.logs) {
      if (l.at < from) continue;
      const card = S.cards.find((c) => c.id === l.itemId) || S.errors.find((e) => e.id === l.itemId);
      group(l.subject || card?.subject)[l.rating]++;
    }
    const list = [...groups.values()].sort((a, b) => b.minutes - a.minutes || b.sessions - a.sessions),
      maxMinutes = Math.max(1, ...list.map((g) => g.minutes));
    byId("subject-stats").innerHTML = list.length
      ? `<div class="stats-head" aria-hidden="true"><span>Materia</span><span>Tempo</span><span>Risposte</span></div>` +
        list
          .map((g) => {
            const answers = g.easy + g.medium + g.hard,
              pct = (n) => (answers ? Math.round((n / answers) * 100) : 0);
            return `<div class="stats-row"><b>${esc(g.name)}</b><div class="stats-time"><div class="goal-bar"><i style="width:${Math.round((g.minutes / maxMinutes) * 100)}%"></i></div><span>${g.minutes} min · ${g.sessions} ${g.sessions === 1 ? "sessione" : "sessioni"}</span></div><div class="stats-answers">${
              answers
                ? `<div class="answer-bar" role="img" aria-label="${pct(g.easy)}% bene, ${pct(g.medium)}% con lacune, ${pct(g.hard)}% da riprendere"><i class="a-easy" style="width:${pct(g.easy)}%"></i><i class="a-medium" style="width:${pct(g.medium)}%"></i><i class="a-hard" style="width:${pct(g.hard)}%"></i></div><span>${pct(g.easy)}% bene · ${pct(g.hard)}% da riprendere · ${answers} risposte</span>`
                : '<span class="meta">Nessuna risposta valutata</span>'
            }</div></div>`;
          })
          .join("")
      : '<p class="empty">Nessuna sessione in questo periodo.</p>';
  }

  function renderHeatmap() {
    const minutes = new Map();
    for (const s of data.sessions) {
      const k = localDay(s.at);
      minutes.set(k, (minutes.get(k) || 0) + Math.round((s.seconds || 0) / 60));
    }
    // 53 settimane fino a oggi, colonne da lunedì a domenica
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 52 * 7);
    const today = localDay(Date.now()),
      cells = [],
      months = [];
    let studied = 0,
      total = 0;
    for (let w = 0; w < 53; w++) {
      for (let d = 0; d < 7; d++) {
        const day = new Date(start);
        day.setDate(start.getDate() + w * 7 + d);
        const key = localDay(day.getTime());
        if (d === 0 && day.getDate() <= 7)
          months.push(`<span style="grid-column:${w + 1}">${day.toLocaleDateString("it-IT", { month: "short" })}</span>`);
        if (key > today) {
          cells.push('<i class="future"></i>');
          continue;
        }
        const m = minutes.get(key) || 0,
          level = m === 0 ? 0 : m < 30 ? 1 : m < 60 ? 2 : m < 120 ? 3 : 4;
        if (m) studied++;
        total += m;
        cells.push(
          `<i class="l${level}" title="${day.toLocaleDateString("it-IT", { day: "numeric", month: "long" })}: ${m ? m + " min" : "nessuno studio"}"></i>`,
        );
      }
    }
    const el = byId("heatmap");
    el.innerHTML = `<div class="heatmap-months">${months.join("")}</div><div class="heatmap-grid">${cells.join("")}</div>`;
    el.setAttribute("aria-label", `Calendario dell’ultimo anno: ${studied} giorni di studio, ${total} minuti in tutto.`);
    byId("heatmap-summary").textContent = studied
      ? `${studied} ${studied === 1 ? "giorno" : "giorni"} di studio nell’ultimo anno, ${Math.round(total / 60)} ore in tutto. Più è scuro il riquadro, più hai studiato quel giorno.`
      : "Qui compare un riquadro per ogni giorno: più è scuro, più hai studiato.";
    const wrap = el.parentElement;
    wrap.scrollLeft = wrap.scrollWidth;
  }

  // ==== Domande: creazione da un testo ======================================
  byId("card-form").insertAdjacentHTML(
    "afterend",
    `<details class="bulk-cards feature-form"><summary>Aggiungi molte domande insieme</summary><form id="bulk-form"><label for="bulk-subject">Materia</label><input id="bulk-subject" required maxlength="80" placeholder="Es. Storia"><label for="bulk-text">Una domanda per riga: domanda | risposta</label><textarea id="bulk-text" rows="7" maxlength="200000" placeholder="Quando cade il muro di Berlino? | Nel 1989&#10;Chi scrisse la Divina Commedia? | Dante Alighieri"></textarea><p id="bulk-preview" class="hint">Le righe senza “|” vengono saltate.</p><button class="primary wide">Crea le domande</button></form></details>`,
  );
  function parseBulk() {
    const lines = byId("bulk-text").value.split("\n").map((l) => l.trim()).filter(Boolean),
      items = [];
    let skipped = 0;
    for (const line of lines) {
      const at = line.indexOf("|");
      const question = at < 0 ? "" : line.slice(0, at).trim(),
        solution = at < 0 ? "" : line.slice(at + 1).trim();
      if (!question || !solution || question.length > 1000 || solution.length > 10000) skipped++;
      else items.push({ question, solution });
    }
    return { items, skipped };
  }
  byId("bulk-text").oninput = () => {
    const { items, skipped } = parseBulk();
    byId("bulk-preview").textContent =
      `${items.length} ${items.length === 1 ? "domanda pronta" : "domande pronte"}` +
      (skipped ? `, ${skipped} ${skipped === 1 ? "riga saltata" : "righe saltate"} (manca “|” o una delle due parti).` : ".");
  };
  byId("bulk-form").onsubmit = (e) => {
    e.preventDefault();
    const subject = byId("bulk-subject").value.trim(),
      { items } = parseBulk();
    if (!subject || !items.length) return notify("Scrivi la materia e almeno una riga “domanda | risposta”.");
    const existing = new Set(S.cards.filter((c) => norm(c.subject) === norm(subject)).map((c) => norm(c.question)));
    const fresh = items.filter((x) => !existing.has(norm(x.question)) && existing.add(norm(x.question)));
    if (S.cards.length + fresh.length > 20000) return notify("Troppe domande: il limite è 20.000.");
    for (const x of fresh)
      S.cards.push({ id: uid(), subject, question: x.question, solution: x.solution, examId: null, topicId: null, due: null, interval: 1, count: 0 });
    save();
    byId("bulk-text").value = "";
    byId("bulk-preview").textContent = "Le righe senza “|” vengono saltate.";
    const doubles = items.length - fresh.length;
    notify(`${fresh.length} ${fresh.length === 1 ? "domanda creata" : "domande create"}` + (doubles ? `, ${doubles} già presenti.` : "."));
  };

  // ==== Domande: modalità esame =============================================
  byId("practice-card").insertAdjacentHTML(
    "afterend",
    `<section class="exam-mode" id="exam-mode"><h2>Modalità esame</h2><p class="hint">Domande a caso, una dopo l’altra, con il tempo che scegli. Rispondi senza appunti, poi guarda la soluzione e valuta tu la risposta. Alla fine vedi il punteggio.</p><form id="exam-setup" class="feature-form"><div class="goal-inputs"><label>Materia<select id="exam-subject-pick"></select></label><label>Domande<select id="exam-count"><option value="5">5</option><option value="10" selected>10</option><option value="20">20</option><option value="0">Tutte</option></select></label><label>Tempo<select id="exam-time"><option value="5">5 minuti</option><option value="10">10 minuti</option><option value="20" selected>20 minuti</option><option value="45">45 minuti</option><option value="0">Senza limite</option></select></label></div><button class="primary">Inizia l’esame</button></form><div id="exam-run" class="exam-run" hidden></div><div id="exam-history"></div></section>`,
  );
  let run = null,
    tick = null;
  function subjects() {
    const map = new Map();
    for (const c of S.cards) {
      const k = norm(c.subject);
      if (!map.has(k)) map.set(k, { name: c.subject, n: 0 });
      map.get(k).n++;
    }
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, "it"));
  }
  function renderExamSetup() {
    const list = subjects(),
      pick = byId("exam-subject-pick"),
      chosen = pick.value;
    pick.innerHTML =
      `<option value="">Tutte le materie (${S.cards.length})</option>` +
      list.map(([k, s]) => `<option value="${esc(k)}">${esc(s.name)} (${s.n})</option>`).join("");
    if ([...pick.options].some((o) => o.value === chosen)) pick.value = chosen;
    byId("exam-setup").hidden = !!run;
    byId("exam-setup").querySelector("button").disabled = !S.cards.length;
    byId("exam-history").innerHTML = S.examRuns.length
      ? `<h3>Ultimi esami</h3><ul class="exam-history">${[...S.examRuns]
          .sort((a, b) => b.at - a.at)
          .slice(0, 8)
          .map(
            (r) =>
              `<li><span>${fmtDate(r.at)} · ${esc(r.subject)}</span><b>${fmtScore(r.score)} su ${r.total} (${Math.round((r.score / r.total) * 100)}%)</b></li>`,
          )
          .join("")}</ul>`
      : S.cards.length
        ? ""
        : '<p class="empty">Scrivi qualche domanda per usare la modalità esame.</p>';
  }
  const fmtScore = (n) => String(n).replace(".", ",");
  const fmtClock = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  byId("exam-setup").onsubmit = (e) => {
    e.preventDefault();
    const subject = byId("exam-subject-pick").value,
      pool = S.cards.filter((c) => !subject || norm(c.subject) === subject),
      count = Number(byId("exam-count").value) || pool.length,
      minutes = Number(byId("exam-time").value);
    if (!pool.length) return notify("Nessuna domanda per questa materia.");
    // Mescola (Fisher-Yates) e prende le prime
    const order = [...pool];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    run = {
      subject: subject ? pool[0].subject : "Tutte le materie",
      cards: order.slice(0, count),
      index: 0,
      answers: [],
      started: Date.now(),
      end: minutes ? Date.now() + minutes * 60000 : 0,
      revealed: false,
    };
    renderExamSetup();
    byId("exam-run").hidden = false;
    clearInterval(tick);
    tick = setInterval(updateClock, 1000);
    showQuestion();
  };
  function updateClock() {
    if (!run || run.done) return;
    const el = byId("exam-clock");
    if (!run.end) {
      if (el) el.textContent = fmtClock(Math.floor((Date.now() - run.started) / 1000));
      return;
    }
    const left = Math.max(0, Math.round((run.end - Date.now()) / 1000));
    if (el) {
      el.textContent = `${fmtClock(left)} rimasti`;
      el.classList.toggle("is-late", left <= 60);
    }
    if (!left) finishExam(true);
  }
  function showQuestion() {
    const card = run.cards[run.index];
    run.revealed = false;
    byId("exam-run").innerHTML = `<div class="exam-top"><span>Domanda ${run.index + 1} di ${run.cards.length}</span><span id="exam-clock" class="exam-clock"></span></div><h3>${esc(card.question)}</h3><label for="exam-answer">La tua risposta, senza appunti</label><textarea id="exam-answer" rows="4" maxlength="10000"></textarea><button type="button" id="exam-reveal" class="primary">Mostra la soluzione</button><div id="exam-feedback" hidden><h3>Soluzione</h3><p class="solution">${esc(card.solution)}</p><p class="hint">Com’era la tua risposta?</p><div class="practice-grades"><button type="button" class="secondary" data-exam-grade="0">Sbagliata</button><button type="button" class="secondary" data-exam-grade="0.5">In parte</button><button type="button" class="primary" data-exam-grade="1">Giusta</button></div></div><button type="button" id="exam-stop" class="text-button">Termina l’esame adesso</button>`;
    updateClock();
    byId("exam-answer").focus();
    byId("exam-reveal").onclick = () => {
      run.revealed = true;
      byId("exam-reveal").hidden = true;
      byId("exam-feedback").hidden = false;
      byId("exam-feedback").querySelector("[data-exam-grade='1']").focus();
    };
    byId("exam-stop").onclick = () => {
      if (confirm("Terminare l’esame? Le domande senza risposta contano come sbagliate.")) finishExam(false);
    };
    byId("exam-feedback").onclick = (e) => {
      const grade = e.target.dataset.examGrade;
      if (grade == null) return;
      run.answers.push({ card, answer: byId("exam-answer").value.trim(), points: Number(grade) });
      run.index++;
      if (run.index < run.cards.length) showQuestion();
      else finishExam(false);
    };
  }
  function finishExam(timeUp) {
    if (!run || run.done) return;
    run.done = true;
    clearInterval(tick);
    const now = Date.now(),
      score = run.answers.reduce((n, a) => n + a.points, 0),
      total = run.cards.length,
      seconds = Math.round((now - run.started) / 1000);
    // Ogni risposta valutata diventa un tentativo, come nella pratica normale
    for (const a of run.answers) {
      const rating = a.points === 1 ? "easy" : a.points === 0.5 ? "medium" : "hard";
      S.logs.push({ id: uid(), at: now, itemId: a.card.id, kind: "card", subject: a.card.subject, question: a.card.question, solution: a.card.solution, answer: a.answer || "(nessuna risposta scritta)", rating });
      a.card.count = (a.card.count || 0) + 1;
      if (rating === "hard") {
        let error = S.errors.find((x) => x.sourceId === a.card.id);
        if (!error) {
          error = { id: uid(), sourceId: a.card.id, subject: a.card.subject, question: a.card.question, solution: a.card.solution, due: null, interval: 1, count: 0 };
          S.errors.push(error);
        }
        error.resolved = false;
      }
    }
    S.examRuns.push({ id: uid(), at: now, subject: run.subject, total, score, seconds: Math.min(seconds, 86400) });
    if (S.examRuns.length > 500) S.examRuns.splice(0, S.examRuns.length - 500);
    save();
    const missed = run.answers.filter((a) => a.points < 1).map((a) => a.card).concat(run.cards.slice(run.answers.length));
    run.missed = missed;
    const pct = Math.round((score / total) * 100);
    byId("exam-run").innerHTML = `<h3>${timeUp ? "Tempo scaduto. " : ""}Punteggio: ${fmtScore(score)} su ${total} (${pct}%)</h3><p class="hint">Tempo: ${fmtClock(seconds)}. ${run.answers.length < total ? `${total - run.answers.length} domande senza risposta contano come sbagliate. ` : ""}Le risposte sono salvate nei Tentativi.</p><ul class="exam-review">${run.cards
      .map((c, i) => {
        const a = run.answers[i],
          label = !a ? "Senza risposta" : a.points === 1 ? "Giusta" : a.points === 0.5 ? "In parte" : "Sbagliata";
        return `<li class="${a?.points === 1 ? "is-right" : "is-wrong"}"><span>${esc(c.question)}</span><b>${label}</b></li>`;
      })
      .join("")}</ul>${
      missed.length
        ? `<label for="exam-missed-when">Ripasso per le ${missed.length} domande sbagliate, in parte o senza risposta</label><div class="goal-row"><select id="exam-missed-when"><option value="1">Domani</option><option value="3">Tra 3 giorni</option><option value="7">Tra una settimana</option></select><button type="button" id="exam-schedule" class="secondary">Programma il ripasso</button></div>`
        : ""
    }<div class="actions"><button type="button" id="exam-close" class="primary">Chiudi</button></div>`;
    if (missed.length)
      byId("exam-schedule").onclick = () => {
        const due = StudyCore.nextDue(byId("exam-missed-when").value, "");
        for (const c of run.missed) c.due = due;
        save();
        notify(`Ripasso programmato il ${fmtDate(due)} per ${run.missed.length} domande.`);
        byId("exam-schedule").disabled = true;
      };
    byId("exam-close").onclick = () => {
      run = null;
      byId("exam-run").hidden = true;
      renderExamSetup();
      byId("exam-setup").querySelector("button").focus();
    };
    if (timeUp) notify(`Tempo scaduto: ${fmtScore(score)} su ${total}.`);
  }

  // ==== Piano esami: note per argomento =====================================
  const openNotes = new Set();
  function renderNotes() {
    for (const input of document.querySelectorAll("#exam-list [data-topic]")) {
      const exam = (S.exams || []).find((e) => e.id === input.dataset.exam),
        topic = exam?.topics.find((t) => t.id === input.dataset.topic);
      if (!topic) continue;
      const label = input.closest("label");
      if (label.parentElement.querySelector(`[data-note-for="${topic.id}"]`)) continue;
      let anchor = label;
      while (anchor.nextElementSibling?.matches(".topic-quiz")) anchor = anchor.nextElementSibling;
      anchor.insertAdjacentHTML(
        "afterend",
        `<details class="topic-note" data-note-for="${esc(topic.id)}" ${openNotes.has(topic.id) ? "open" : ""}><summary>${topic.note ? "Note" : "Aggiungi una nota"}</summary><label class="sr-only" for="note-${esc(topic.id)}">Note su ${esc(topic.text)}</label><textarea id="note-${esc(topic.id)}" rows="3" maxlength="5000" data-note-exam="${esc(exam.id)}" data-note-topic="${esc(topic.id)}" placeholder="Formule, pagine del libro, dubbi da chiedere…">${esc(topic.note || "")}</textarea><p class="hint">Si salva quando esci dal campo.</p></details>`,
      );
    }
  }
  byId("exam-list").addEventListener("toggle", (e) => {
    const id = e.target.dataset?.noteFor;
    if (id) e.target.open ? openNotes.add(id) : openNotes.delete(id);
  }, true);
  // Salva all'uscita dal campo: salvare a ogni tasto ricostruirebbe la lista mentre scrivi
  byId("exam-list").addEventListener("change", (e) => {
    const t = e.target;
    if (!t.dataset.noteTopic) return;
    const topic = S.exams.find((x) => x.id === t.dataset.noteExam)?.topics.find((x) => x.id === t.dataset.noteTopic);
    if (!topic) return;
    topic.note = t.value.slice(0, 5000);
    save();
  });

  function refresh() {
    const page = location.hash.slice(1);
    if (page === "progress") {
      renderStats();
      renderHeatmap();
    }
    if (page === "cards" && !run) renderExamSetup();
    if (page === "planning") renderNotes();
  }
  window.addEventListener("studio:features-rendered", () => {
    renderNotes();
    if (!run) renderExamSetup();
  });
  window.addEventListener("studio:saved", refresh);
  window.addEventListener("hashchange", refresh);
  renderNotes();
  renderExamSetup();
  refresh();
})();
