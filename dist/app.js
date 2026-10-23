"use strict";
const $ = (id) => document.getElementById(id),
  DAY = 86400000,
  KEY = "studio.v1";
const initial = () => ({
  sessions: [],
  reviews: [],
  thoughts: [],
  active: null,
  settings: {
    domains: [
      "instagram.com",
      "tiktok.com",
      "facebook.com",
      "x.com",
      "reddit.com",
    ],
    blockBreak: true,
    extensionId: "",
  },
});
let data;
try {
  data = JSON.parse(localStorage.getItem(KEY)) || initial();
  if (!Array.isArray(data.sessions) || !data.settings) throw Error();
} catch {
  data = initial();
}
let connected = false,
  blockUntil = 0,
  reviewing = null,
  toastTimeout;
const dateKey = (time = Date.now()) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
const fmtDate = (t) =>
  new Date(t).toLocaleDateString("it-IT", { day: "numeric", month: "long" });
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const uid = () => crypto.randomUUID();
function notify(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => ($("toast").hidden = true), 4500);
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent("studio:saved"));
  } catch {
    notify(
      "Spazio di archiviazione esaurito o non disponibile. Esporta i dati prima di chiudere.",
    );
  }
}
function ext(message) {
  return new Promise((resolve, reject) => {
    if (!data.settings.extensionId || !globalThis.chrome?.runtime?.sendMessage)
      return reject(Error("Estensione non disponibile"));
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(Error("Estensione non raggiungibile"));
      }
    }, 4000);
    try {
      chrome.runtime.sendMessage(
        data.settings.extensionId,
        message,
        (response) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          const error = chrome.runtime.lastError;
          if (error || !response?.ok)
            reject(
              Error(
                error?.message ||
                  response?.error ||
                  "Collegamento non riuscito",
              ),
            );
          else resolve(response);
        },
      );
    } catch (e) {
      clearTimeout(timeout);
      reject(e);
    }
  });
}
async function connect(silent = false) {
  try {
    const state = await ext({ type: "PING" });
    blockUntil = state.until || 0;
    connected = true;
    window.dispatchEvent(
      new CustomEvent("studio:connected", { detail: state }),
    );
    $("connection-message").textContent =
      "Estensione collegata. Il blocco è pronto.";
    if (data.active) await syncBlock();
  } catch {
    connected = false;
    $("connection-message").textContent =
      "Estensione non collegata. Verifica installazione e ID nel browser attuale.";
    if (!silent)
      notify("Collegamento non riuscito: controlla l’ID e l’estensione.");
  }
  updateBlockStatus();
}
function updateBlockStatus() {
  const a = data.active;
  const blocks = connected && blockUntil > Date.now() && true;
  $("block-status").innerHTML = connected
    ? blockUntil > Date.now()
      ? "Social bloccati · estensione collegata"
      : "Estensione collegata · blocco pronto"
    : 'Blocco social non collegato · <a href="#settings">Configura</a>';
  $("phase-label").textContent = blocks
    ? "Social bloccati"
    : a?.phase === "break"
      ? "Pausa"
      : a?.phase === "recall"
        ? "Richiamo attivo"
        : "Focus";
}
async function syncBlock() {
  if (!connected) return;
  const a = data.active;
  try {
    if (
      !a ||
      a.phase === "recall" ||
      (a.phase === "break" && !data.settings.blockBreak)
    ) {
      const result = await ext({ type: "STOP" });
      blockUntil = result.until || 0;
      updateBlockStatus();
      return;
    }
    const now = Date.now();
    let until;
    if (a.phase === "focus") {
      const focusEnd = a.running ? a.end : now + a.remaining;
      until =
        focusEnd + (data.settings.blockBreak ? a.breakMinutes * 60000 : 0);
    } else until = a.running ? a.end : now + a.remaining;
    const result = await ext({
      type: "START",
      domains: data.settings.domains,
      until,
    });
    blockUntil = result.until || 0;
    updateBlockStatus();
  } catch {
    connected = false;
    updateBlockStatus();
    notify("Il blocco social non è confermato. Controlla il collegamento.");
  }
}
function elapsed(a) {
  return Math.max(
    0,
    Math.min(a.total, a.total - (a.running ? a.end - Date.now() : a.remaining)),
  );
}
function render() {
  const a = data.active;
  $("setup").hidden = !!a;
  $("session").hidden = !a || a.phase === "recall";
  $("recall").hidden = !a || a.phase !== "recall";
  document.body.classList.toggle("focusing", !!a && a.phase === "focus");
  $("phase-title").textContent = !a
    ? "Nuova sessione"
    : a.phase === "focus"
      ? "Studio in corso"
      : a.phase === "recall"
        ? "Verifica senza appunti"
        : "Pausa";
  if (a) {
    $("session-subject").textContent = a.subject;
    $("session-goal").textContent =
      a.phase === "break"
        ? "Alzati e allontanati dallo schermo."
        : a.goal;
    $("session-hint").textContent =
      a.phase === "break"
        ? "Meglio senza telefono: cammina, bevi qualcosa, guarda fuori."
        : "Se ti viene in mente altro, annotalo in “Da fare dopo” e torna qui.";
    $("pause").textContent = a.running ? "Metti in pausa" : "Riprendi";
    $("finish").textContent =
      a.phase === "break" ? "Concludi la pausa" : "Passa alla verifica";
    $("cancel").hidden = a.phase === "break";
    if (a.phase === "recall") {
      $("answer").value = a.answer || "";
      $("correction").value = a.correction || "";
    }
  }
  updateBlockStatus();
  tick();
  renderLists();
}
function renderLists() {
  const today = dateKey(),
    todaySessions = data.sessions.filter((s) => dateKey(s.at) === today),
    due = data.reviews.filter((r) => r.due <= Date.now());
  $("daily-minutes").textContent = Math.round(
    todaySessions.reduce((t, s) => t + s.seconds, 0) / 60,
  );
  $("daily-sessions").textContent = todaySessions.length;
  $("daily-reviews").textContent = due.length;
  $("due-count").textContent = due.length;
  $("total-minutes").textContent = Math.round(
    data.sessions.reduce((t, s) => t + s.seconds, 0) / 60,
  );
  $("total-sessions").textContent = data.sessions.filter(
    (s) => !s.reviewId,
  ).length;
  $("total-reviews").textContent =
    data.sessions.filter((s) => s.reviewId).length +
    (data.study?.logs?.length || 0);
  $("thought-list").innerHTML = data.thoughts
    .map(
      (t) =>
        `<li><span>${esc(t.text)}</span><button data-remove-thought="${t.id}" aria-label="Elimina pensiero">×</button></li>`,
    )
    .join("");
  $("review-list").innerHTML = data.reviews.length
    ? [...data.reviews]
        .sort((a, b) => a.due - b.due)
        .map(
          (r) =>
            `<article class="entry"><div class="meta">${esc(r.subject)} · ${r.due <= Date.now() ? "Da ripassare" : `Previsto il ${fmtDate(r.due)}`}</div><h3>${esc(r.goal)}</h3><p class="hint">${r.count || 0} ripassi completati · Ultima valutazione: ${ratingLabel(r.rating)}</p><button class="secondary" data-review="${r.id}">Richiama senza appunti</button></article>`,
        )
        .join("")
    : '<p class="empty">Nessun ripasso in programma. Se ne crea uno ogni volta che salvi una sessione.</p>';
  $("history").innerHTML = data.sessions.length
    ? [...data.sessions]
        .reverse()
        .map(
          (s) =>
            `<article class="entry"><div class="meta">${fmtDate(s.at)} · ${esc(s.subject)} · ${Math.round(s.seconds / 60)} min ${s.reviewId ? "· Ripasso" : ""}</div><h3>${esc(s.goal)}</h3><details><summary>Risposta, correzioni e valutazione</summary><p>${esc(s.answer)}</p><p><b>Correzioni:</b> ${esc(s.correction || "Nessuna annotata.")}</p><p>${ratingLabel(s.rating)}</p></details></article>`,
        )
        .join("")
    : '<p class="empty">Ancora nessuna sessione completata.</p>';
  const days = Array.from({ length: 7 }, (_, i) => {
      let d = new Date();
      d.setDate(d.getDate() - 6 + i);
      let mins = data.sessions
        .filter((s) => dateKey(s.at) === dateKey(d.getTime()))
        .reduce((n, s) => n + s.seconds / 60, 0);
      return { d, mins };
    }),
    max = Math.max(1, ...days.map((d) => d.mins));
  $("week").innerHTML = days
    .map(
      ({ d, mins }) =>
        `<div class="day"><span>${Math.round(mins)} min</span><div class="bar" style="height:${Math.max(2, (mins / max) * 95)}px"></div>${d.toLocaleDateString("it-IT", { weekday: "short" })}</div>`,
    )
    .join("");
}
function ratingLabel(r) {
  return r === "hard"
    ? "Da riprendere"
    : r === "easy"
      ? "Ricordo autonomo"
      : "Qualche lacuna";
}
function tick() {
  updateBlockStatus();
  const a = data.active;
  if (!a || a.phase === "recall") return;
  let remaining = a.running ? Math.max(0, a.end - Date.now()) : a.remaining;
  const seconds = Math.ceil(remaining / 1000);
  $("timer").textContent =
    `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  $("time-fill").style.transform =
    `scaleX(${Math.min(1, elapsed(a) / a.total)})`;
  if (a.running && remaining <= 0) {
    window.dispatchEvent(
      new CustomEvent("studio:alarm", { detail: { phase: a.phase } }),
    );
    if (a.phase === "focus") {
      toRecall();
      notify("Sessione terminata. Ora prova a ricordare senza appunti.");
    } else endBreak();
  }
}
function toRecall() {
  const a = data.active;
  if (!a || a.phase !== "focus") return;
  a.seconds = (a.accumulatedSeconds || 0) + Math.round(elapsed(a) / 1000);
  a.phase = "recall";
  a.running = false;
  save();
  syncBlock();
  render();
  $("answer").focus();
}
function endBreak() {
  data.active = null;
  save();
  syncBlock();
  render();
  notify("Pausa finita.");
}
function route() {
  const requested = location.hash.slice(1) || "focus",
    page = [
      "focus",
      "reviews",
      "progress",
      "settings",
      "method",
      "planning",
      "today",
      "week",
      "attempts",
      "cards",
      "errors",
    ].includes(requested)
      ? requested
      : "focus";
  document
    .querySelectorAll(".page")
    .forEach((el) => (el.hidden = el.id !== `page-${page}`));
  document
    .querySelectorAll("nav a")
    .forEach((el) => el.classList.toggle("active", el.dataset.page === page));
  renderLists();
}
$("setup").addEventListener("submit", (e) => {
  e.preventDefault();
  const subject = $("subject").value.trim(),
    goal = $("goal").value.trim();
  if (!subject || !goal)
    return notify("Scrivi materia e obiettivo per iniziare.");
  const total = Number($("duration").value) * 60000;
  data.active = {
    subject,
    goal,
    total,
    remaining: total,
    end: Date.now() + total,
    phase: "focus",
    running: true,
    breakMinutes: Number($("break-duration").value),
  };
  save();
  syncBlock();
  render();
});
$("pause").onclick = () => {
  const a = data.active;
  if (!a) return;
  if (a.running) {
    a.remaining = Math.max(0, a.end - Date.now());
    a.running = false;
  } else {
    a.end = Date.now() + a.remaining;
    a.running = true;
  }
  save();
  syncBlock();
  render();
};
$("finish").onclick = () =>
  data.active?.phase === "break" ? endBreak() : toRecall();
$("cancel").onclick = () => {
  if (!confirm("Interrompere la sessione? Non verrà aggiunta al diario."))
    return;
  data.active = null;
  save();
  syncBlock();
  render();
};
["answer", "correction"].forEach((id) =>
  $(id).addEventListener("input", () => {
    if (data.active?.phase === "recall") {
      data.active[id] = $(id).value;
      save();
    }
  }),
);
$("recall").onsubmit = (e) => {
  e.preventDefault();
  const a = data.active;
  if (!a || a.phase !== "recall") return;
  const answer = $("answer").value.trim();
  if (!answer) return notify("Scrivi un tentativo prima di continuare.");
  const rating = $("rating").value,
    now = Date.now(),
    reviewId = a.reviewId || null;
  data.sessions.push({
    id: uid(),
    at: now,
    subject: a.subject,
    goal: a.goal,
    answer,
    correction: $("correction").value.trim(),
    rating,
    seconds: a.seconds || 0,
    reviewId,
  });
  let review = reviewId ? data.reviews.find((r) => r.id === reviewId) : null;
  if (review) {
    review.interval =
      rating === "hard"
        ? 1
        : Math.min(
            180,
            Math.max(
              2,
              Math.round(review.interval * (rating === "easy" ? 2.5 : 1.5)),
            ),
          );
    review.count = (review.count || 0) + 1;
  } else {
    review = {
      id: uid(),
      subject: a.subject,
      goal: a.goal,
      interval: rating === "hard" ? 1 : rating === "medium" ? 2 : 3,
      count: 0,
    };
    data.reviews.push(review);
  }
  review.rating = rating;
  review.due = now + review.interval * DAY;
  reviewing = null;
  const total = a.breakMinutes * 60000;
  data.active = {
    subject: a.subject,
    goal: a.goal,
    phase: "break",
    running: true,
    total,
    remaining: total,
    end: now + total,
    breakMinutes: a.breakMinutes,
  };
  save();
  syncBlock();
  render();
  notify(`Salvato. Prossimo ripasso: ${fmtDate(review.due)}.`);
};
$("thought-form").onsubmit = (e) => {
  e.preventDefault();
  const text = $("thought").value.trim();
  if (!text) return;
  data.thoughts.push({ id: uid(), text });
  $("thought").value = "";
  save();
  renderLists();
};
$("thought-list").onclick = (e) => {
  const id = e.target.closest("[data-remove-thought]")?.dataset.removeThought;
  if (id) {
    data.thoughts = data.thoughts.filter((t) => t.id !== id);
    save();
    renderLists();
  }
};
$("review-list").onclick = (e) => {
  const id = e.target.closest("[data-review]")?.dataset.review;
  if (!id) return;
  if (data.active)
    return notify(
      "Concludi la sessione in corso prima di iniziare un ripasso.",
    );
  const r = data.reviews.find((r) => r.id === id);
  data.active = {
    subject: r.subject,
    goal: r.goal,
    phase: "recall",
    running: false,
    seconds: 0,
    reviewId: r.id,
    breakMinutes: 5,
  };
  save();
  location.hash = "focus";
  render();
  $("answer").focus();
};
$("domains").value = data.settings.domains.join("\n");
$("block-break").checked = data.settings.blockBreak;
$("extension-id").value = data.settings.extensionId;
$("save-settings").onclick = () => {
  const lines = $("domains")
    .value.split(/\n/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const valid = lines.every(
    (s) =>
      /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(s) &&
      !s.endsWith("chatgpt.site") &&
          !s.endsWith("github.io"),
  );
  if (!valid || lines.length > 100) {
    $("settings-message").textContent =
      "Inserisci fino a 100 domini, come instagram.com, senza https:// o percorsi. Il dominio dell’app è escluso.";
    return;
  }
  data.settings.domains = [...new Set(lines)];
  data.settings.blockBreak = $("block-break").checked;
  save();
  syncBlock();
  $("settings-message").textContent = "Preferenze salvate.";
  updateBlockStatus();
};
$("connect").onclick = async () => {
  const id = $("extension-id").value.trim();
  if (!/^[a-p]{32}$/.test(id)) {
    $("connection-message").textContent =
      "L’ID deve contenere 32 lettere, da a a p.";
    return;
  }
  data.settings.extensionId = id;
  save();
  $("connect").disabled = true;
  await connect();
  $("connect").disabled = false;
};
$("export").onclick = () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `studio-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("today").textContent = new Date().toLocaleDateString("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
window.addEventListener("hashchange", route);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    tick();
    if (data.active) syncBlock();
  }
});
setInterval(tick, 1000);
setInterval(() => {
  if (data.active?.running) syncBlock();
}, 60000);
route();
render();
if (data.settings.extensionId) connect(true);
