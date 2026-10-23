// Gruppi di studio (pagina Obiettivi): obiettivo settimanale di minuti condiviso con amici.
// Serve l'account (api/group.php). Gli altri membri vedono solo nome utente,
// minuti e sessioni della settimana, presi dai dati sincronizzati.
(() => {
  "use strict";
  const byId = (id) => document.getElementById(id);
  let groups = null,
    status = "",
    timer = null;

  const token = () => {
    try {
      return JSON.parse(localStorage.getItem("studio.sync.v1"))?.token || "";
    } catch {
      return "";
    }
  };
  function weekStart() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  }
  async function api(method, body) {
    const res = await fetch(`api/group.php${method === "GET" ? `?week=${weekStart()}` : ""}`, {
      method,
      headers: { "Content-Type": "application/json", "X-Auth-Token": token() },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = {};
    try {
      json = await res.json();
    } catch {}
    return { status: res.status, json };
  }
  const messages = {
    name_missing: "Dai un nome al gruppo.",
    goal_invalid: "L’obiettivo deve essere un numero di minuti tra 0 e 100.000.",
    too_many_groups: "Puoi far parte al massimo di 10 gruppi.",
    group_not_found: "Nessun gruppo con questo codice. Controlla di averlo copiato bene.",
    group_full: "Il gruppo è pieno: al massimo 20 persone.",
    not_owner: "Solo chi ha creato il gruppo può cambiare l’obiettivo.",
  };

  document
    .querySelector("#page-goals .goals-achievements")
    .insertAdjacentHTML(
      "beforebegin",
      '<section class="goals-group"><h2>Gruppo di studio</h2><p class="hint">Studiate insieme verso un obiettivo di minuti a settimana. Nel gruppo si vedono solo nome utente, minuti e sessioni della settimana di ciascuno: risposte, domande e appunti restano privati.</p><div id="group-body"></div></section>',
    );

  async function load() {
    if (!token()) {
      groups = null;
      return render();
    }
    try {
      const r = await api("GET");
      if (r.status === 200) {
        groups = r.json.groups;
        status = "";
      } else if (r.status === 401) {
        groups = null;
        status = "L’accesso è scaduto: accedi di nuovo dalla pagina Account e app.";
      } else {
        groups = null;
        status = r.status === 404 || r.status === 503 ? "unavailable" : "Il server non risponde. Riprovo tra poco.";
      }
    } catch {
      status = "unavailable";
    }
    render();
  }

  function render() {
    const box = byId("group-body");
    // Non ricostruire i moduli mentre si scrive (aggiornamento ogni minuto)
    if (box.contains(document.activeElement) && document.activeElement.matches("input")) return;
    if (status === "unavailable") {
      box.innerHTML =
        '<p class="empty">I gruppi funzionano solo sul sito <a href="https://samueleruggeri.altervista.org/studiofocus/#goals">samueleruggeri.altervista.org/studiofocus</a>, con un account.</p>';
      return;
    }
    if (!token()) {
      box.innerHTML = '<p class="empty">Per creare un gruppo o entrarci serve un account. <a href="#account">Accedi o crea un account</a>.</p>';
      return;
    }
    if (!groups) {
      box.innerHTML = `<p class="hint">${status ? esc(status) : "Carico i gruppi…"}</p>`;
      return;
    }
    const list = groups
      .map((g) => {
        const total = g.members.reduce((n, m) => n + m.minutes, 0),
          pct = g.goalMinutes ? Math.min(100, Math.round((total / g.goalMinutes) * 100)) : 0,
          top = Math.max(1, ...g.members.map((m) => m.minutes));
        return `<article class="group-card"><div class="entry-top"><h3>${esc(g.name)}</h3><span class="meta">${g.members.length} ${g.members.length === 1 ? "persona" : "persone"}</span></div>
        <p class="group-code">Codice d’invito: <b>${esc(g.code)}</b> <button type="button" class="text-button" data-copy-code="${esc(g.code)}">Copia</button></p>
        ${
          g.goalMinutes
            ? `<div class="goal-progress ${total >= g.goalMinutes ? "is-met" : ""}"><div><span>Obiettivo del gruppo questa settimana</span><b>${total} / ${g.goalMinutes} min</b></div><div class="goal-bar"><i style="width:${pct}%"></i></div></div>`
            : `<p class="hint">Nessun obiettivo di gruppo. Questa settimana insieme: ${total} minuti.</p>`
        }
        <ul class="group-members">${[...g.members]
          .sort((a, b) => b.minutes - a.minutes)
          .map(
            (m) =>
              `<li class="${m.isMe ? "is-me" : ""}"><span>${esc(m.username)}${m.isMe ? " (tu)" : ""}${m.isOwner ? ' <small>ha creato il gruppo</small>' : ""}</span><div class="goal-bar"><i style="width:${Math.round((m.minutes / top) * 100)}%"></i></div><b>${m.minutes} min · ${m.sessions} ${m.sessions === 1 ? "sessione" : "sessioni"}</b></li>`,
          )
          .join("")}</ul>
        <div class="group-actions">${
          g.isOwner
            ? `<form class="group-goal" data-group-goal="${g.id}"><label for="goal-${g.id}">Minuti a settimana per il gruppo</label><div class="goal-row"><input id="goal-${g.id}" type="number" min="0" max="100000" step="30" value="${g.goalMinutes}"><button class="secondary">Cambia obiettivo</button></div></form>`
            : ""
        }<button type="button" class="text-button" data-leave-group="${g.id}">Esci dal gruppo</button></div></article>`;
      })
      .join("");
    box.innerHTML = `${list || '<p class="empty">Non fai ancora parte di un gruppo. Creane uno e manda il codice ai tuoi amici, oppure entra con il loro codice.</p>'}
      <p class="hint">I minuti degli altri si aggiornano quando la loro app si sincronizza.</p>
      <div class="group-forms"><form id="group-create" class="feature-form"><h3>Crea un gruppo</h3><label for="group-name">Nome del gruppo</label><input id="group-name" required maxlength="60" placeholder="Es. Maturità 5B"><label for="group-goal">Minuti a settimana per tutto il gruppo</label><input id="group-goal" type="number" min="0" max="100000" step="30" value="600"><button class="primary wide">Crea gruppo</button></form>
      <form id="group-join" class="feature-form"><h3>Entra in un gruppo</h3><label for="group-code">Codice d’invito</label><input id="group-code" required maxlength="12" autocomplete="off" spellcheck="false" placeholder="8 caratteri"><button class="secondary wide">Entra</button><p id="group-message" role="status" class="hint">${esc(status)}</p></form></div>`;
  }

  async function act(body, done) {
    try {
      const r = await api("POST", body);
      if (r.status !== 200) {
        status = messages[r.json.error] || "Il server non risponde. Riprova più tardi.";
        render();
        return;
      }
      status = "";
      if (done) notify(done(r.json));
      await load();
    } catch {
      status = "Il server non risponde. Controlla la connessione.";
      render();
    }
  }
  byId("group-body").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.id === "group-create")
      act(
        { action: "create", name: byId("group-name").value, goalMinutes: Math.max(0, Math.round(Number(byId("group-goal").value) || 0)) },
        (j) => `Gruppo creato. Codice d’invito: ${j.code}`,
      );
    if (f.id === "group-join")
      act({ action: "join", code: byId("group-code").value }, (j) => (j.already ? "Fai già parte di questo gruppo." : "Sei entrato nel gruppo."));
    if (f.dataset.groupGoal)
      act(
        { action: "goal", groupId: Number(f.dataset.groupGoal), goalMinutes: Math.max(0, Math.round(Number(f.querySelector("input").value) || 0)) },
        () => "Obiettivo del gruppo aggiornato.",
      );
  });
  byId("group-body").addEventListener("click", async (e) => {
    const code = e.target.dataset.copyCode,
      leave = e.target.dataset.leaveGroup;
    if (code) {
      try {
        await navigator.clipboard.writeText(code);
        notify("Codice copiato. Mandalo a chi vuoi invitare.");
      } catch {
        notify(`Codice d’invito: ${code}`);
      }
    }
    if (leave && confirm("Uscire dal gruppo? Potrai rientrare con il codice."))
      act({ action: "leave", groupId: Number(leave) }, () => "Sei uscito dal gruppo.");
  });

  function onPage() {
    clearInterval(timer);
    if (location.hash !== "#goals") return;
    load();
    timer = setInterval(load, 60000);
  }
  window.addEventListener("hashchange", onPage);
  onPage();
})();
