// Pagina Lobby: lobby private (group.js) e profili degli utenti (api/social.php).
// Il profilo di una persona lo vede solo chi è con lei in una lobby privata.
(() => {
  "use strict";
  const byId = (id) => document.getElementById(id),
    DAY = 86400000;
  let status = "";

  const token = () => {
    try {
      return JSON.parse(localStorage.getItem("studio.sync.v1"))?.token || "";
    } catch {
      return "";
    }
  };
  function weekStart(t = Date.now()) {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  }
  async function api(query, body) {
    const res = await fetch(`api/social.php${query ? "?" + query : ""}`, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", "X-Auth-Token": token() },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = {};
    try {
      json = await res.json();
    } catch {}
    return { status: res.status, json };
  }
  const profileName = () => {
    const [page, name] = location.hash.slice(1).split("/");
    return page === "lobby" && name ? decodeURIComponent(name) : "";
  };
  const lvl = (xp) => `<span class="lvl-chip" title="Livello">Lv ${StudyCore.levelFor(xp || 0).level}</span>`;
  const statusText = (u) =>
    u.studyingFor != null ? `sta studiando da ${u.studyingFor} min` : u.online ? "online" : "offline";

  const section = document.createElement("section");
  section.id = "page-lobby";
  section.className = "page";
  section.hidden = true;
  section.innerHTML =
    '<div class="heading"><h1>Lobby</h1><p>Studia insieme ai tuoi amici: nelle lobby vedi chi è online e chi sta studiando. Apri un profilo per vedere quanto e cosa ha studiato e i traguardi.</p></div><div id="lobby-main"><section class="lobby-section"><h2>Le tue lobby</h2><div id="group-body"></div></section><section class="lobby-section lobby-join"><h2>Crea o entra in una lobby</h2><p class="hint">Crea una lobby e manda il codice d’invito agli amici, oppure entra con il codice che ti hanno mandato.</p><div id="group-forms"></div></section></div><div id="lobby-profile" hidden></div>';
  document.querySelector(".source-strip").before(section);

  // --- Profilo --------------------------------------------------------------
  function stats(sessions) {
    const days = new Map(),
      subjects = new Map(),
      week = weekStart();
    let minutes = 0,
      weekMinutes = 0;
    for (const s of sessions) {
      const k = StudyCore.localDay(new Date(s.at));
      days.set(k, (days.get(k) || 0) + s.minutes);
      minutes += s.minutes;
      if (s.at >= week) weekMinutes += s.minutes;
      const key = s.subject.trim().toLocaleLowerCase("it-IT") || "senza materia";
      const g = subjects.get(key) || { name: s.subject.trim() || "Senza materia", minutes: 0, sessions: 0 };
      g.minutes += s.minutes;
      g.sessions++;
      subjects.set(key, g);
    }
    // Giorni di fila fino a oggi (o fino a ieri, se oggi non ha ancora studiato)
    let streak = 0;
    const d = new Date();
    if (!days.has(StudyCore.localDay(d))) d.setDate(d.getDate() - 1);
    while (days.has(StudyCore.localDay(d))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return { minutes, weekMinutes, days: days.size, streak, subjects: [...subjects.values()].sort((a, b) => b.minutes - a.minutes) };
  }
  async function loadProfile(name) {
    const box = byId("lobby-profile");
    box.innerHTML = '<p class="hint">Carico il profilo…</p>';
    if (!token()) return (box.innerHTML = '<p class="empty">Per vedere i profili serve un account. <a href="#account">Accedi</a>.</p>');
    try {
      const r = await api(`action=profile&user=${encodeURIComponent(name)}`);
      if (r.status !== 200) {
        box.innerHTML = `<p class="empty">${r.status === 404 ? "Questo profilo non esiste o non è visibile: lo vede solo chi è con questa persona in una lobby." : "Il server non risponde. Riprova più tardi."}</p><p><a href="#lobby">← Torna alla lobby</a></p>`;
        return;
      }
      renderProfile(r.json);
    } catch {
      box.innerHTML = '<p class="empty">La lobby funziona solo sul sito AlterVista, con un account.</p>';
    }
  }
  function renderProfile(p) {
    const st = stats(p.sessions),
      all = window.StudioAchievements || [],
      got = p.achievements || {},
      unlocked = all.filter((a) => got[a.id]).sort((a, b) => got[b.id] - got[a.id]),
      maxSubject = Math.max(1, ...st.subjects.map((s) => s.minutes)),
      since = new Date(p.since).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }),
      level = StudyCore.levelFor(StudyCore.xpFor(st.minutes, p.sessions.length, Object.keys(got).length)),
      hours = st.minutes >= 120 ? `${(Math.round(st.minutes / 6) / 10).toLocaleString("it-IT")} ore` : `${st.minutes} min`;
    byId("lobby-profile").innerHTML = `<p><a href="#lobby">← Torna alla lobby</a></p>
      <div class="profile-head"><span class="profile-avatar">${StudioAvatar.svg(p.avatar, 88, p.username)}<span class="lvl-badge on-avatar">${level.level}</span></span><div><h2>${esc(p.username)}${p.isMe ? " (tu)" : ""}</h2><p class="meta">Livello ${level.level} · ${level.title} · ${level.xp.toLocaleString("it-IT")} XP</p><div class="xp-bar"><i style="width:${Math.round((level.into / level.needed) * 100)}%"></i></div></div><span class="${p.studyingFor != null ? "live-text" : "meta"}">${p.studyingFor != null ? '<i class="live-dot" aria-hidden="true"></i>' : ""}${statusText(p)}</span></div>
      <p class="meta">Su Studio dal ${since}${p.isMe && !p.public ? " · il tuo profilo lo vede solo chi è con te in una lobby" : ""}</p>
      <div class="summary-strip profile-strip"><div><strong>${hours}</strong><span>studiate in tutto</span></div><div><strong>${p.sessions.length}</strong><span>sessioni</span></div><div><strong>${st.days}</strong><span>giorni di studio</span></div><div><strong>${st.streak}</strong><span>giorni di fila</span></div><div><strong>${st.weekMinutes}</strong><span>min questa settimana</span></div></div>
      <h3>Cosa studia</h3>${
        st.subjects.length
          ? `<ul class="profile-subjects">${st.subjects
              .slice(0, 10)
              .map((s) => `<li><b>${esc(s.name)}</b><div class="goal-bar"><i style="width:${Math.round((s.minutes / maxSubject) * 100)}%"></i></div><span>${s.minutes} min · ${s.sessions} ${s.sessions === 1 ? "sessione" : "sessioni"}</span></li>`)
              .join("")}</ul>`
          : '<p class="empty">Ancora nessuna sessione.</p>'
      }
      <h3>Ultime sessioni</h3>${
        p.sessions.length
          ? `<ul class="profile-sessions">${p.sessions
              .slice(0, 12)
              .map((s) => `<li><span class="meta">${fmtDate(s.at)}</span><span><b>${esc(s.subject)}</b> — ${esc(s.goal)}</span><span class="meta">${s.minutes} min</span></li>`)
              .join("")}</ul>`
          : '<p class="empty">Ancora nessuna sessione.</p>'
      }
      <div class="list-toolbar"><h3>Traguardi</h3><span class="meta">${unlocked.length} su ${all.length}</span></div>${
        unlocked.length
          ? `<ul class="achievement-list">${unlocked
              .map((a) => `<li class="achievement tier-${a.tier} is-unlocked"><span class="badge" aria-hidden="true">★</span><div><h3>${a.name}</h3><p>${a.text}</p><p class="meta">Sbloccato il ${fmtDate(got[a.id])}</p></div></li>`)
              .join("")}</ul>`
          : '<p class="empty">Nessun traguardo sbloccato per ora.</p>'
      }`;
  }

  // --- Navigazione ----------------------------------------------------------
  function onPage() {
    if (location.hash.slice(1).split("/")[0] !== "lobby") return;
    const name = profileName();
    byId("lobby-main").hidden = !!name;
    byId("lobby-profile").hidden = !name;
    if (name) loadProfile(name);
  }
  window.addEventListener("hashchange", onPage);
  onPage();

  // --- Sono online / sto studiando -------------------------------------------
  // Un segnale al minuto con l'app aperta; subito quando la sessione parte, va in pausa o finisce.
  const focusing = () => !!data.active && data.active.phase === "focus" && data.active.running;
  let lastState = null;
  async function ping(force) {
    if (!token() || status === "unavailable") return;
    const state = focusing() ? "studying" : "online";
    if (!force && state === lastState) return;
    const a = data.active,
      remaining = focusing() ? Math.max(0, Math.round((a.end - Date.now()) / 1000)) : 0,
      elapsed = focusing() ? Math.max(0, Math.round((a.total - (a.end - Date.now())) / 1000)) : 0;
    try {
      const r = await api("", { action: "ping", remaining: Math.min(remaining, 21600), elapsed: Math.min(elapsed, 21600) });
      if (r.status === 200) {
        lastState = state;
        if (r.json.cheers?.length) window.dispatchEvent(new CustomEvent("studio:cheers", { detail: r.json.cheers }));
      }
      else if (r.status === 404) status = "unavailable";
    } catch {}
  }
  window.addEventListener("studio:saved", () => ping(false));
  // Anche con la scheda in secondo piano: così arrivano gli incoraggiamenti e risulti online
  setInterval(() => ping(true), 60000);
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && ping(true));
  ping(true);
})();
