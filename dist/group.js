// Lobby private (pagina Lobby, api/group.php): stanze con codice d'invito dove i membri
// vedono chi è online, chi sta studiando e i minuti della settimana; obiettivo di minuti facoltativo.
// Nella pagina Sessione il riquadro "Studiano adesso" mostra i membri in sessione.
// Risposte, domande e appunti non escono mai.
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
    name_missing: "Dai un nome alla lobby.",
    goal_invalid: "L’obiettivo deve essere un numero di minuti tra 0 e 100.000.",
    too_many_groups: "Puoi far parte al massimo di 10 lobby.",
    group_not_found: "Nessuna lobby con questo codice. Controlla di averlo copiato bene.",
    group_full: "La lobby è piena: al massimo 20 persone.",
    not_owner: "Solo chi ha creato la lobby può cambiare l’obiettivo.",
  };

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
        rememberFlags();
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
    renderLive();
  }

  const STATE_ORDER = (m) => (m.studyingFor != null ? 0 : m.online ? 1 : 2);
  function memberStatus(m) {
    if (m.studyingFor != null) return `<span class="live-text">sta studiando da ${m.studyingFor} min</span>`;
    return m.online ? '<span class="online-text">online</span>' : '<span class="meta">offline</span>';
  }
  function render() {
    renderForms();
    const box = byId("group-body");
    // Non ricostruire i moduli mentre si scrive (aggiornamento periodico)
    if (box.contains(document.activeElement) && document.activeElement.matches("input")) return;
    if (status === "unavailable") {
      box.innerHTML =
        '<p class="empty">Le lobby funzionano solo sul sito <a href="https://samueleruggeri.altervista.org/studiofocus/#lobby">samueleruggeri.altervista.org/studiofocus</a>, con un account.</p>';
      return;
    }
    if (!token()) {
      box.innerHTML = '<p class="empty">Per creare una lobby o entrarci serve un account. <a href="#account">Accedi o crea un account</a>.</p>';
      return;
    }
    if (!groups) {
      box.innerHTML = `<p class="hint">${status ? esc(status) : "Carico le lobby…"}</p>`;
      return;
    }
    const list = groups
      .map((g) => {
        const total = g.members.reduce((n, m) => n + m.minutes, 0),
          pct = g.goalMinutes ? Math.min(100, Math.round((total / g.goalMinutes) * 100)) : 0,
          online = g.members.filter((m) => m.online || m.studyingFor != null).length,
          studying = g.members.filter((m) => m.studyingFor != null).length;
        return `<article class="group-card"><div class="entry-top"><h3>${esc(g.name)}</h3><span class="meta">${g.members.length} ${g.members.length === 1 ? "persona" : "persone"} · ${online} online · ${studying} in studio</span></div>
        <p class="group-code">Codice d’invito: <b>${esc(g.code)}</b> <button type="button" class="text-button" data-copy-code="${esc(g.code)}">Copia</button></p>
        <ul class="group-members">${[...g.members]
          .sort((a, b) => STATE_ORDER(a) - STATE_ORDER(b) || b.minutes - a.minutes)
          .map(
            (m) =>
              `<li class="${m.isMe ? "is-me" : ""}"><span><i class="live-dot ${m.studyingFor != null ? "" : m.online ? "is-online" : "is-offline"}" aria-hidden="true"></i>${StudioAvatar.svg(m.avatar, 30, m.username)}<a href="#lobby/${encodeURIComponent(m.username)}">${esc(m.username)}</a> <span class="lvl-chip">Lv ${StudyCore.levelFor(m.xp || 0).level}</span>${m.isMe ? " (tu)" : ""}${m.isOwner ? ' <small>ha creato la lobby</small>' : ""}</span>${memberStatus(m)}<b>${m.minutes} min questa settimana</b></li>`,
          )
          .join("")}</ul>
        ${
          g.goalMinutes
            ? `<div class="goal-progress ${total >= g.goalMinutes ? "is-met" : ""}"><div><span>Obiettivo della lobby questa settimana</span><b>${total} / ${g.goalMinutes} min</b></div><div class="goal-bar"><i style="width:${pct}%"></i></div></div>`
            : ""
        }
        <div class="group-actions">${
          g.isOwner
            ? `<form class="group-goal" data-group-goal="${g.id}"><label for="goal-${g.id}">Obiettivo di minuti a settimana (0 = nessuno)</label><div class="goal-row"><input id="goal-${g.id}" type="number" min="0" max="100000" step="30" value="${g.goalMinutes}"><button class="secondary">Salva</button></div></form>`
            : ""
        }<button type="button" class="text-button" data-leave-group="${g.id}">Esci dalla lobby</button></div></article>`;
      })
      .join("");
    box.innerHTML = list || '<p class="empty">Non sei ancora in nessuna lobby. Creane una o entra con un codice qui sotto.</p>';
  }
  // I moduli stanno nella loro sezione e si disegnano una volta sola, così l'aggiornamento periodico non cancella quello che scrivi
  function renderForms() {
    const forms = byId("group-forms");
    forms.closest("section").hidden = !token() || status === "unavailable";
    if (byId("group-create")) {
      byId("group-message").textContent = status;
      return;
    }
    forms.innerHTML = `<div class="group-forms"><form id="group-create" class="feature-form"><h3>Crea una lobby</h3><label for="group-name">Nome</label><input id="group-name" required maxlength="60" placeholder="Es. Maturità 5B"><label for="group-goal">Obiettivo di minuti a settimana (facoltativo)</label><input id="group-goal" type="number" min="0" max="100000" step="30" value="0"><button class="primary wide">Crea lobby</button></form>
      <form id="group-join" class="feature-form"><h3>Entra con un codice</h3><label for="group-code">Codice d’invito</label><input id="group-code" required maxlength="12" autocomplete="off" spellcheck="false" placeholder="8 caratteri"><button class="secondary wide">Entra</button></form></div><p id="group-message" role="status" class="hint">${esc(status)}</p>`;
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
  byId("lobby-main").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.id === "group-create")
      act(
        { action: "create", name: byId("group-name").value, goalMinutes: Math.max(0, Math.round(Number(byId("group-goal").value) || 0)) },
        (j) => `Lobby creata. Codice d’invito: ${j.code}`,
      );
    if (f.id === "group-join")
      act({ action: "join", code: byId("group-code").value }, (j) => (j.already ? "Sei già in questa lobby." : "Sei entrato nella lobby."));
    if (f.dataset.groupGoal)
      act(
        { action: "goal", groupId: Number(f.dataset.groupGoal), goalMinutes: Math.max(0, Math.round(Number(f.querySelector("input").value) || 0)) },
        () => "Obiettivo della lobby aggiornato.",
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
    if (leave && confirm("Uscire dalla lobby? Potrai rientrare con il codice."))
      act({ action: "leave", groupId: Number(leave) }, () => "Sei uscito dalla lobby.");
  });

  // --- Chi sta studiando adesso -------------------------------------------
  document
    .querySelector(".right-column .daily")
    .insertAdjacentHTML("afterend", '<section id="live-group" class="live-group" hidden><h2>Studiano adesso</h2><ul id="live-list"></ul></section>');
  function others() {
    const seen = new Map();
    for (const g of groups || [])
      for (const m of g.members)
        if (!m.isMe && m.studyingFor != null && !seen.has(m.username)) seen.set(m.username, m.studyingFor);
    return [...seen.entries()].sort((a, b) => b[1] - a[1]);
  }
  function renderLive() {
    const box = byId("live-group");
    if (!groups?.length) return (box.hidden = true);
    box.hidden = false;
    const list = others();
    byId("live-list").innerHTML = list.length
      ? list.map(([name, min]) => `<li><i class="live-dot" aria-hidden="true"></i><a href="#lobby/${encodeURIComponent(name)}"><b>${esc(name)}</b></a> <span>da ${min} min</span></li>`).join("")
      : '<li class="hint">Nelle tue lobby nessuno sta studiando in questo momento.</li>';
  }
  // Traguardi legati alle lobby private (letti da goals.js tramite data.study.flags)
  function rememberFlags() {
    const S = data.study,
      f = (S.flags ||= {});
    let changed = false;
    if (groups?.length && !f.group) changed = f.group = Date.now();
    if (focusing() && others().length && !f.together) changed = f.together = Date.now();
    if (changed) save();
  }

  // Il segnale "sto studiando" lo manda lobby.js (api/social.php)
  const focusing = () => !!data.active && data.active.phase === "focus" && data.active.running;
  function onPage() {
    clearInterval(timer);
    const [page, profile] = (location.hash.slice(1) || "focus").split("/");
    if ((page !== "lobby" || profile) && page !== "focus") return;
    load();
    timer = setInterval(load, 30000);
  }
  window.addEventListener("hashchange", onPage);
  onPage();
})();
