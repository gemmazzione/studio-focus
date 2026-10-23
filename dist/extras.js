// Statistiche per materia, calendario dell'anno e note per gli argomenti dei piani d'esame.
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
    if (page === "planning") renderNotes();
  }
  window.addEventListener("studio:features-rendered", renderNotes);
  window.addEventListener("studio:saved", refresh);
  window.addEventListener("hashchange", refresh);
  renderNotes();
  refresh();
})();
