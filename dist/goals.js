// Obiettivi settimanali, obiettivi personali, traguardi e frasi motivazionali.
// I traguardi si calcolano dai dati reali (sessioni, tentativi, piani);
// in data.study.achievements resta solo la data di sblocco, per l'avviso e la cronologia.
(() => {
  "use strict";
  data.study ||= {};
  const S = data.study;
  S.goals ||= { weekly: { minutes: 0, sessions: 0, recalls: 0 }, items: [] };
  S.goals.weekly ||= { minutes: 0, sessions: 0, recalls: 0 };
  S.goals.items ||= [];
  const byId = (id) => document.getElementById(id);

  const PHRASES = [
    "Non serve aver voglia. Serve cominciare: la voglia arriva dopo.",
    "Un’ora fatta bene vale più di tre passate a guardare il libro.",
    "Quello che oggi ti sembra difficile, tra un mese sarà la base.",
    "Sbagliare adesso costa poco. All’esame costa di più.",
    "Ogni volta che ricordi senza guardare, il ricordo si rafforza.",
    "Cinque minuti sono pochi. Bastano per iniziare.",
    "Non devi finire tutto oggi. Devi fare il pezzo di oggi.",
    "Meglio poco ogni giorno che tutto la sera prima.",
    "Capire una cosa vuol dire saperla spiegare a qualcun altro.",
    "Un errore trovato oggi è un errore in meno all’esame.",
    "Hai già fatto cose difficili. Anche questa si può fare.",
    "La concentrazione si allena: un po’ di più ogni giorno.",
    "Non confrontarti con gli altri. Confrontati con te di una settimana fa.",
    "Quando non sai da dove partire, parti dalla cosa più piccola.",
    "Anche la pausa fa parte del lavoro.",
    "La motivazione va e viene. L’abitudine resta.",
    "Una domanda a cui non sai rispondere è il punto da cui ripartire.",
    "Non è tempo perso se alla fine sai qualcosa che prima non sapevi.",
    "Fai oggi quello per cui domani ti ringrazierai.",
    "Il primo passo non deve essere perfetto. Deve solo esserci.",
    "Più lo spieghi con parole tue, più ti resta in testa.",
    "Anche i giorni storti contano, se ti siedi lo stesso.",
    "Un argomento alla volta. Il resto aspetta il suo turno.",
    "Studiare non è rileggere tante volte. È provare a ricordare.",
    "La fatica di adesso è tempo risparmiato dopo.",
    "Se oggi va male, domani riparti da dove sei arrivato. Non da zero.",
    "Ogni sessione finita è la prova che ce la fai.",
    "Meglio una pagina capita che dieci sottolineate.",
    "Il telefono può aspettare. Questa ora no.",
    "Non devi sentirti pronto. Devi solo aprire il libro.",
  ];

  // --- Calcoli sui dati ---------------------------------------------------
  const minutesOf = (s) => Math.round((s.seconds || 0) / 60);
  const dayKey = (t) => StudyCore.localDay(new Date(t));
  function weekStart(t = Date.now()) {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  }
  function weekStats(start) {
    const end = start + 7 * 86400000,
      inWeek = (t) => t >= start && t < end,
      sessions = data.sessions.filter((s) => inWeek(s.at));
    return {
      minutes: sessions.reduce((n, s) => n + minutesOf(s), 0),
      sessions: sessions.length,
      recalls:
        sessions.filter((s) => s.reviewId).length +
        (S.logs || []).filter((l) => inWeek(l.at)).length,
    };
  }
  function streaks() {
    const days = [...new Set(data.sessions.map((s) => dayKey(s.at)))].sort();
    let best = 0,
      run = 0,
      prev = null;
    for (const d of days) {
      const t = new Date(d + "T12:00:00");
      t.setDate(t.getDate() - 1);
      run = prev === StudyCore.localDay(t) ? run + 1 : 1;
      best = Math.max(best, run);
      prev = d;
    }
    // La serie attuale resta valida finché non è passato un giorno intero senza studio
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const current = prev === dayKey(Date.now()) || prev === StudyCore.localDay(y) ? run : 0;
    return { best, current };
  }
  function weeksAtGoal() {
    const target = S.goals.weekly.minutes;
    if (!target || !data.sessions.length) return 0;
    const first = weekStart(Math.min(...data.sessions.map((s) => s.at)));
    let n = 0;
    for (let w = first; w <= Date.now(); w += 7 * 86400000)
      if (weekStats(w).minutes >= target) n++;
    return n;
  }
  // Statistiche di ogni settimana dalla prima sessione a oggi
  function allWeeks() {
    if (!data.sessions.length) return [];
    const list = [];
    for (let w = weekStart(Math.min(...data.sessions.map((s) => s.at))); w <= Date.now(); w += 7 * 86400000) {
      const st = weekStats(w),
        days = new Set(data.sessions.filter((s) => s.at >= w && s.at < w + 7 * 86400000).map((s) => dayKey(s.at)));
      list.push({ start: w, ...st, days: days.size });
    }
    return list;
  }
  function dayMinutes() {
    const m = new Map();
    for (const s of data.sessions) m.set(dayKey(s.at), (m.get(dayKey(s.at)) || 0) + minutesOf(s));
    return m;
  }
  function totals() {
    const exams = S.exams || [],
      weeks = allWeeks(),
      flags = S.flags || {},
      byDay = dayMinutes();
    // Sabato e domenica dello stesso fine settimana
    const weekend = [...byDay.keys()].some((k) => {
      const d = new Date(k + "T12:00:00");
      if (d.getDay() !== 6) return false;
      d.setDate(d.getDate() + 1);
      return byDay.has(StudyCore.localDay(d));
    });
    return {
      bestDay: Math.max(0, ...byDay.values()),
      longSessions: data.sessions.filter((s) => minutesOf(s) >= 40).length,
      fullWeek: Math.max(0, ...weeks.map((w) => w.days)),
      betterWeeks: weeks.filter((w, i) => i > 0 && weeks[i - 1].minutes > 0 && w.minutes > weeks[i - 1].minutes).length,
      weekend: weekend ? 1 : 0,
      group: flags.group ? 1 : 0,
      together: flags.together ? 1 : 0,
      sessions: data.sessions.length,
      minutes: data.sessions.reduce((n, s) => n + minutesOf(s), 0),
      longest: Math.max(0, ...data.sessions.map(minutesOf)),
      streak: streaks().best,
      recalls: data.sessions.filter((s) => s.reviewId).length + (S.logs || []).length,
      cards: (S.cards || []).length,
      resolved: (S.errors || []).filter((e) => e.resolved).length,
      topics: exams.reduce((n, e) => n + e.topics.filter((t) => t.done).length, 0),
      plans: exams.filter((e) => e.topics.length && e.topics.every((t) => t.done)).length,
      weeks: weeksAtGoal(),
      goals: S.goals.items.filter((g) => g.done).length,
      early: data.sessions.some((s) => new Date(s.at).getHours() < 8) ? 1 : 0,
      late: data.sessions.some((s) => new Date(s.at).getHours() >= 23) ? 1 : 0,
    };
  }

  // [id, nome, descrizione, valore, soglia, unità]
  const ACHIEVEMENTS = [
    ["sessioni-1", "Si parte", "Completa la prima sessione.", "sessions", 1],
    ["sessioni-10", "Dieci sessioni", "Completa 10 sessioni.", "sessions", 10],
    ["sessioni-50", "Cinquanta sessioni", "Completa 50 sessioni.", "sessions", 50],
    ["sessioni-100", "Cento sessioni", "Completa 100 sessioni.", "sessions", 100],
    ["sessioni-250", "Duecentocinquanta sessioni", "Completa 250 sessioni.", "sessions", 250],
    ["ore-1", "La prima ora", "Studia 60 minuti in tutto.", "minutes", 60, "min"],
    ["ore-10", "Dieci ore", "Studia 10 ore in tutto.", "minutes", 600, "min"],
    ["ore-50", "Cinquanta ore", "Studia 50 ore in tutto.", "minutes", 3000, "min"],
    ["ore-100", "Cento ore", "Studia 100 ore in tutto.", "minutes", 6000, "min"],
    ["ore-250", "Duecentocinquanta ore", "Studia 250 ore in tutto.", "minutes", 15000, "min"],
    ["lunghe-10", "Dieci sessioni lunghe", "Completa 10 sessioni da almeno 40 minuti.", "longSessions", 10],
    ["giornata", "Giornata intensa", "Studia 4 ore in un solo giorno.", "bestDay", 240, "min"],
    ["maratona", "Maratona", "Completa una sessione da 90 minuti.", "longest", 90, "min"],
    ["serie-3", "Tre giorni di fila", "Studia per 3 giorni consecutivi.", "streak", 3, "giorni"],
    ["serie-7", "Una settimana di fila", "Studia per 7 giorni consecutivi.", "streak", 7, "giorni"],
    ["serie-14", "Due settimane di fila", "Studia per 14 giorni consecutivi.", "streak", 14, "giorni"],
    ["serie-30", "Un mese di fila", "Studia per 30 giorni consecutivi.", "streak", 30, "giorni"],
    ["settimana-1", "Settimana a obiettivo", "Raggiungi i minuti dell’obiettivo settimanale.", "weeks", 1],
    ["settimana-4", "Quattro settimane", "Raggiungi l’obiettivo settimanale in 4 settimane.", "weeks", 4],
    ["settimana-12", "Tre mesi a obiettivo", "Raggiungi l’obiettivo settimanale in 12 settimane.", "weeks", 12],
    ["giorni-5", "Cinque giorni su sette", "Studia in 5 giorni diversi della stessa settimana.", "fullWeek", 5, "giorni"],
    ["giorni-7", "Tutti i giorni", "Studia in tutti i 7 giorni della stessa settimana.", "fullWeek", 7, "giorni"],
    ["crescita-1", "Meglio della settimana prima", "Studia più minuti della settimana precedente.", "betterWeeks", 1],
    ["crescita-5", "Sempre in crescita", "Supera la settimana precedente per 5 volte.", "betterWeeks", 5],
    ["weekend", "Anche nel fine settimana", "Studia sia il sabato sia la domenica dello stesso fine settimana.", "weekend", 1],
    ["gruppo", "In compagnia", "Crea una lobby privata o entra in una.", "group", 1],
    ["insieme", "Studio insieme", "Studia mentre qualcuno delle tue lobby private sta studiando.", "together", 1],
    ["obiettivi-1", "Obiettivo raggiunto", "Completa un tuo obiettivo.", "goals", 1],
    ["obiettivi-10", "Dieci obiettivi", "Completa 10 tuoi obiettivi.", "goals", 10],
    ["mattino", "Prima delle otto", "Finisci una sessione prima delle 8 del mattino.", "early", 1],
    ["notte", "Dopo le undici", "Finisci una sessione dopo le 23.", "late", 1],
  ].map(([id, name, text, key, target, unit = ""]) => ({ id, name, text, key, target, unit }));
  window.StudioAchievements = ACHIEVEMENTS; // per i profili della lobby

  // Registra i traguardi raggiunti. Al primo avvio li segna in silenzio.
  function checkAchievements() {
    const first = !S.achievements;
    S.achievements ||= {};
    const t = totals(),
      fresh = ACHIEVEMENTS.filter((a) => !S.achievements[a.id] && t[a.key] >= a.target);
    if (!fresh.length) return first && save();
    for (const a of fresh) S.achievements[a.id] = Date.now();
    save();
    // In ritardo, per non coprire il messaggio dell'azione appena fatta
    if (!first)
      setTimeout(
        () =>
          notify(
            `Traguardo raggiunto: ${fresh[0].name}` +
              (fresh.length > 1 ? ` e altri ${fresh.length - 1}.` : "."),
          ),
        2500,
      );
  }

  // --- Pagina Obiettivi -----------------------------------------------------
  const section = document.createElement("section");
  section.id = "page-goals";
  section.className = "page";
  section.hidden = true;
  section.innerHTML = `<div class="heading"><h1>Obiettivi</h1><p>Scegli quanto studiare a settimana, scrivi i tuoi obiettivi e guarda i traguardi che hai sbloccato.</p></div>
  <section class="goals-week"><div class="list-toolbar"><h2>Questa settimana</h2><span id="goals-streak" class="meta"></span></div><div id="week-goals"></div>
  <details class="goal-settings"><summary>Cambia gli obiettivi della settimana</summary><form id="weekly-form" class="feature-form"><div class="goal-inputs"><label>Minuti di studio<input id="goal-minutes" type="number" min="0" max="10000" step="10"></label><label>Sessioni<input id="goal-sessions" type="number" min="0" max="500"></label></div><p class="hint">Lascia 0 per non usare un obiettivo. La settimana va da lunedì a domenica.</p><button class="primary">Salva obiettivi</button></form></details></section>
  <section class="goals-list"><h2>I tuoi obiettivi</h2><form id="goal-form" class="goal-form"><label for="goal-text">Nuovo obiettivo</label><div class="goal-row"><input id="goal-text" required maxlength="220" placeholder="Es. Finire gli esercizi del capitolo 4"><label class="sr-only" for="goal-due">Entro il</label><input id="goal-due" type="date" aria-label="Entro il (facoltativo)"><button class="primary">Aggiungi</button></div><p class="hint">La data è facoltativa.</p></form><ul id="goal-items" class="goal-items"></ul></section>
  <section class="goals-achievements"><div class="list-toolbar"><h2>Traguardi</h2><span id="achievement-count" class="meta"></span></div><ul id="achievement-list" class="achievement-list"></ul></section>`;
  document.querySelector(".source-strip").before(section);

  function bar(value, target) {
    const pct = Math.min(100, Math.round((value / target) * 100));
    return `<div class="goal-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${Math.min(value, target)}"><i style="width:${pct}%"></i></div>`;
  }
  function renderGoals() {
    const w = S.goals.weekly,
      now = weekStats(weekStart()),
      rows = [
        ["minutes", "Minuti di studio"],
        ["sessions", "Sessioni"],
      ].filter(([k]) => w[k] > 0);
    byId("week-goals").innerHTML = rows.length
      ? rows
          .map(
            ([k, label]) =>
              `<div class="goal-progress ${now[k] >= w[k] ? "is-met" : ""}"><div><span>${label}</span><b>${now[k]} / ${w[k]}</b></div>${bar(now[k], w[k])}</div>`,
          )
          .join("")
      : `<p class="empty">Nessun obiettivo per la settimana. Questa settimana hai studiato ${now.minutes} minuti in ${now.sessions} sessioni.</p>`;
    const st = streaks();
    byId("goals-streak").textContent = st.current
      ? `${st.current} ${st.current === 1 ? "giorno" : "giorni"} di fila`
      : "";
    byId("goal-minutes").value = w.minutes;
    byId("goal-sessions").value = w.sessions;

    const today = StudyCore.localDay(new Date()),
      items = [...S.goals.items].sort(
        (a, b) => a.done - b.done || (a.due || "9999").localeCompare(b.due || "9999"),
      );
    byId("goal-items").innerHTML = items.length
      ? items
          .map(
            (g) =>
              `<li class="${g.done ? "is-done" : ""}"><label class="checkbox"><input type="checkbox" data-goal-done="${g.id}" ${g.done ? "checked" : ""}><span>${esc(g.text)}</span></label><span class="meta ${!g.done && g.due && g.due < today ? "is-late" : ""}">${
                g.done
                  ? `Fatto il ${fmtDate(g.doneAt)}`
                  : g.due
                    ? `${g.due < today ? "Scaduto il" : "Entro il"} ${fmtDate(new Date(g.due + "T12:00:00").getTime())}`
                    : ""
              }</span><button class="text-button" data-goal-delete="${g.id}" aria-label="Elimina obiettivo">Elimina</button></li>`,
          )
          .join("")
      : '<li class="empty">Nessun obiettivo. Scrivine uno concreto, che puoi spuntare quando l’hai fatto.</li>';

    const t = totals(),
      got = S.achievements || {},
      unlocked = ACHIEVEMENTS.filter((a) => got[a.id]).length;
    byId("achievement-count").textContent = `${unlocked} su ${ACHIEVEMENTS.length}`;
    byId("achievement-list").innerHTML = ACHIEVEMENTS.map((a) => {
      const done = !!got[a.id],
        value = Math.min(t[a.key], a.target);
      return `<li class="achievement ${done ? "is-unlocked" : ""}"><span class="badge" aria-hidden="true">${done ? "✓" : ""}</span><div><h3>${a.name}</h3><p>${a.text}</p>${
        done
          ? `<p class="meta">Sbloccato il ${fmtDate(got[a.id])}</p>`
          : a.target > 1
            ? `${bar(value, a.target)}<p class="meta">${value} / ${a.target}${a.unit ? " " + a.unit : ""}</p>`
            : '<p class="meta">Da sbloccare</p>'
      }</div></li>`;
    }).join("");
  }

  byId("weekly-form").onsubmit = (e) => {
    e.preventDefault();
    const n = (id, max) => Math.min(max, Math.max(0, Math.round(Number(byId(id).value) || 0)));
    S.goals.weekly = {
      minutes: n("goal-minutes", 10000),
      sessions: n("goal-sessions", 500),
      recalls: S.goals.weekly.recalls || 0,
    };
    save();
    e.target.closest("details").open = false;
    notify("Obiettivi della settimana salvati.");
  };
  byId("goal-form").onsubmit = (e) => {
    e.preventDefault();
    const text = byId("goal-text").value.trim();
    if (!text) return;
    if (S.goals.items.length >= 500) return notify("Hai raggiunto il limite di 500 obiettivi.");
    S.goals.items.push({ id: uid(), text, due: byId("goal-due").value || null, done: false, doneAt: null });
    e.target.reset();
    save();
    byId("goal-text").focus();
  };
  byId("goal-items").onchange = (e) => {
    const g = S.goals.items.find((x) => x.id === e.target.dataset.goalDone);
    if (!g) return;
    g.done = e.target.checked;
    g.doneAt = g.done ? Date.now() : null;
    save();
    if (g.done) notify(PHRASES[Math.floor(Math.random() * PHRASES.length)]);
  };
  byId("goal-items").onclick = (e) => {
    const id = e.target.closest("[data-goal-delete]")?.dataset.goalDelete;
    if (id && confirm("Eliminare questo obiettivo?")) {
      S.goals.items = S.goals.items.filter((x) => x.id !== id);
      save();
    }
  };

  // --- Riepilogo della settimana scorsa ------------------------------------
  const RECAP = "studio.recap.v1";
  const WEEKDAYS = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  function recap() {
    const start = weekStart() - 7 * 86400000,
      end = start + 7 * 86400000;
    if (!data.sessions.some((x) => x.at < end)) return null; // nessuno storico da raccontare
    const last = weekStats(start),
      before = weekStats(start - 7 * 86400000),
      inWeek = data.sessions.filter((x) => x.at >= start && x.at < end),
      days = new Map(),
      subjects = new Map();
    for (const x of inWeek) {
      days.set(dayKey(x.at), (days.get(dayKey(x.at)) || 0) + minutesOf(x));
      const k = x.subject.trim().toLocaleLowerCase("it-IT");
      const cur = subjects.get(k) || { name: x.subject.trim(), minutes: 0 };
      cur.minutes += minutesOf(x);
      subjects.set(k, cur);
    }
    const best = [...days.entries()].sort((a, b) => b[1] - a[1])[0],
      top = [...subjects.values()].sort((a, b) => b.minutes - a.minutes)[0],
      fmt = (t) => new Date(t).toLocaleDateString("it-IT", { day: "numeric", month: "long" });
    return {
      start,
      range: `${fmt(start)} – ${fmt(end - 86400000)}`,
      ...last,
      days: days.size,
      before: before.minutes,
      best: best ? { day: WEEKDAYS[new Date(best[0] + "T12:00:00").getDay()], minutes: best[1] } : null,
      top: subjects.size > 1 ? top : null,
      target: S.goals.weekly.minutes,
    };
  }
  function recapHTML(r) {
    if (!r.minutes)
      return `<p>La settimana scorsa (${r.range}) non hai registrato sessioni. Questa settimana riparti con una sessione corta: anche 25 minuti contano.</p>`;
    const diff = r.before ? Math.round(((r.minutes - r.before) / r.before) * 100) : null;
    const lines = [
      `<b>${r.minutes} minuti</b> in ${r.sessions} ${r.sessions === 1 ? "sessione" : "sessioni"}, ${r.days} ${r.days === 1 ? "giorno" : "giorni"} di studio su 7.`,
      diff == null
        ? "La settimana prima non avevi studiato: ottimo inizio."
        : diff > 0
          ? `${diff}% in più della settimana prima (${r.before} min).`
          : diff < 0
            ? `${-diff}% in meno della settimana prima (${r.before} min). Questa settimana puoi recuperare.`
            : `Come la settimana prima (${r.before} min).`,
      r.best ? `Giorno migliore: ${r.best.day}, ${r.best.minutes} min.` : "",
      r.top ? `Materia più studiata: ${esc(r.top.name)} (${r.top.minutes} min).` : "",
      r.target
        ? r.minutes >= r.target
          ? `Obiettivo settimanale raggiunto (${r.target} min).`
          : `Obiettivo settimanale: mancavano ${r.target - r.minutes} minuti.`
        : "",
    ].filter(Boolean);
    return `<ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>`;
  }
  byId("page-focus")
    .querySelector(".heading")
    .insertAdjacentHTML(
      "afterend",
      '<section id="recap-card" class="recap-card" hidden><div class="list-toolbar"><h2 id="recap-title">La tua settimana</h2><button type="button" id="recap-close" class="text-button">Chiudi</button></div><div id="recap-body"></div></section>',
    );
  byId("week-goals").closest("section").insertAdjacentHTML(
    "beforebegin",
    '<section class="goals-recap" id="goals-recap" hidden><h2>La settimana scorsa</h2><div id="goals-recap-body"></div></section>',
  );
  function renderRecap() {
    const r = recap();
    let seen = null;
    try {
      seen = Number(localStorage.getItem(RECAP));
    } catch {}
    // Dal lunedì la scheda compare nella pagina Sessione finché non la chiudi
    const showCard = !!r && seen !== r.start && !data.active;
    byId("recap-card").hidden = !showCard;
    if (showCard) {
      byId("recap-title").textContent = `La tua settimana, ${r.range}`;
      byId("recap-body").innerHTML = recapHTML(r);
    }
    byId("goals-recap").hidden = !r;
    if (r) byId("goals-recap-body").innerHTML = `<p class="meta">${r.range}</p>${recapHTML(r)}`;
  }
  byId("recap-close").onclick = () => {
    const r = recap();
    try {
      if (r) localStorage.setItem(RECAP, String(r.start));
    } catch {}
    renderRecap();
  };

  // --- Sessione: frase del giorno e obiettivo della settimana ----------------
  let phrase = Math.floor(Date.now() / 86400000) % PHRASES.length;
  byId("page-focus")
    .querySelector(".heading")
    .insertAdjacentHTML(
      "beforeend",
      '<figure class="quote"><blockquote id="quote-text"></blockquote><button type="button" id="quote-next" class="text-button">Un’altra frase</button></figure>',
    );
  const showPhrase = () => (byId("quote-text").textContent = PHRASES[phrase]);
  byId("quote-next").onclick = () => {
    phrase = (phrase + 1) % PHRASES.length;
    showPhrase();
  };
  showPhrase();
  byId("daily-sessions")
    .closest(".ruled")
    .insertAdjacentHTML(
      "afterend",
      '<div class="ruled" id="weekly-row" hidden><span>Obiettivo della settimana</span><b id="weekly-value"></b></div>',
    );
  function renderDaily() {
    const target = S.goals.weekly.minutes;
    byId("weekly-row").hidden = !target;
    if (target) byId("weekly-value").textContent = `${weekStats(weekStart()).minutes} / ${target} min`;
  }

  function refresh() {
    renderDaily();
    renderRecap();
    if (location.hash === "#goals") renderGoals();
  }
  window.addEventListener("studio:saved", () => {
    checkAchievements();
    refresh();
  });
  window.addEventListener("hashchange", refresh);
  checkAchievements();
  refresh();
})();
