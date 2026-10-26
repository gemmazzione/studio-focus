// Account e sincronizzazione con l'API PHP (api/). Senza account o senza server
// (GitHub Pages, npm run dev) l'app funziona come prima, solo con localStorage.
// Il server conserva un backup studio.backup v4 per utente, con numero di revisione.
// Non vengono sincronizzati: la sessione in corso, l'ID dell'estensione e le bozze.
(() => {
  "use strict";
  const C = window.StudyCore,
    KEY = "studio.v1",
    SOUND = "studio.sound.v1",
    STATE = "studio.sync.v1",
    byId = (id) => document.getElementById(id);
  let state = readState(),
    available = null,
    busy = false,
    lastError = "";

  function readState() {
    try {
      const s = JSON.parse(localStorage.getItem(STATE));
      return s && s.token ? s : null;
    } catch {
      return null;
    }
  }
  function writeState() {
    if (state) localStorage.setItem(STATE, JSON.stringify(state));
    else localStorage.removeItem(STATE);
  }
  function readJSON(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  }
  // Documento da sincronizzare, ricavato da ciò che è salvato in questo browser
  function localDoc() {
    const d = readJSON(KEY);
    if (!d || !Array.isArray(d.sessions)) return null;
    return {
      format: "studio.backup",
      version: 4,
      data: {
        ...d,
        active: null,
        settings: { ...d.settings, extensionId: "" },
        study: d.study ? { ...d.study, drafts: {} } : d.study,
      },
      sound: readJSON(SOUND),
    };
  }
  function hash(text) {
    let h1 = 0xdeadbeef,
      h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36);
  }
  const docHash = (doc) => (doc ? hash(JSON.stringify(doc)) : "");
  const dirty = () => !!state && docHash(localDoc()) !== state.hash;
  const sessionRunning = () => !!readJSON(KEY)?.active;

  async function api(path, method = "GET", body) {
    const response = await fetch("api/" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(state ? { "X-Auth-Token": state.token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try {
      json = await response.json();
    } catch {}
    return { status: response.status, json: json || {} };
  }

  // Scrive i dati nel browser e ricarica la pagina, come il ripristino di un backup
  function applyLocal(next, sound) {
    const local = readJSON(KEY) || {};
    next.active = null;
    next.settings = { ...next.settings, extensionId: local.settings?.extensionId || "" };
    next.study = { ...next.study, drafts: local.study?.drafts || {} };
    window.dispatchEvent(new CustomEvent("studio:before-restore"));
    localStorage.setItem(KEY, JSON.stringify(next));
    if (sound) localStorage.setItem(SOUND, JSON.stringify(sound));
  }

  async function push() {
    const doc = localDoc();
    if (!doc) return;
    const r = await api("progress.php", "POST", { baseRevision: state.revision, data: doc });
    if (r.status === 200) {
      Object.assign(state, { revision: r.json.revision, hash: docHash(doc), at: Date.now() });
      writeState();
      return;
    }
    if (r.status === 409) return pull(r.json);
    throw r;
  }

  // Confronta con il server: scarica se ci sono novità, unisce se sono cambiati entrambi
  async function pull(remote) {
    if (!remote) {
      const r = await api("progress.php");
      if (r.status !== 200) throw r;
      remote = r.json;
    }
    if (remote.revision === state.revision) {
      if (dirty()) await push();
      return;
    }
    if (!remote.data) {
      // Account nuovo: carica i dati di questo browser
      state.revision = remote.revision;
      return push();
    }
    if (sessionRunning()) {
      lastError = "Ci sono dati nuovi da un altro dispositivo: li scarico a fine sessione.";
      return;
    }
    const server = C.validateBackup(remote.data);
    let next = server.data;
    const changedHere = dirty();
    if (changedHere) {
      const local = C.validateBackup(localDoc());
      next = C.mergeData(local.data, server.data);
    }
    applyLocal(next, server.sound);
    state.revision = remote.revision;
    state.hash = changedHere ? "" : docHash(localDoc());
    state.at = Date.now();
    writeState();
    if (changedHere) await push();
    location.reload();
  }

  async function sync() {
    if (!state || busy || available === false) return;
    busy = true;
    lastError = "";
    try {
      await pull();
    } catch (e) {
      if (e?.status === 401) {
        state = null;
        writeState();
        lastError = "L’accesso è scaduto. Accedi di nuovo per sincronizzare.";
      } else lastError = "Sincronizzazione non riuscita. Riprovo tra poco.";
    }
    busy = false;
    render();
  }

  async function checkServer() {
    try {
      const r = await api("status.php");
      available = r.status === 200 && r.json.database === true;
    } catch {
      available = false;
    }
    render();
  }

  const fmtTime = (t) =>
    new Date(t).toLocaleString("it-IT", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

  function render() {
    const note = byId("sync-note");
    if (note)
      note.textContent = state
        ? `Dati sincronizzati con l’account ${state.username}.`
        : "I dati restano in questo browser.";
    const page = byId("account-body");
    if (!page) return;
    if (available === null) {
      page.innerHTML = '<p class="hint">Controllo il server…</p>';
      return;
    }
    if (available === false) {
      page.innerHTML =
        '<p class="empty">Gli account non sono disponibili su questa copia dell’app. Usa <a href="https://samueleruggeri.altervista.org/studiofocus/#account">samueleruggeri.altervista.org/studiofocus</a>.</p>';
      return;
    }
    if (state) {
      page.innerHTML = `<div class="account-box"><p>Accesso effettuato come <strong>${escape(state.username)}</strong>.</p><p class="hint">${
        state.at ? `Ultima sincronizzazione: ${fmtTime(state.at)}.` : "Non ancora sincronizzato."
      } Le modifiche vengono inviate da sole pochi secondi dopo.</p>${lastError ? `<p class="notice">${escape(lastError)}</p>` : ""}<div class="actions"><button type="button" id="sync-now" class="primary">Sincronizza ora</button><button type="button" id="sync-logout" class="secondary">Esci</button></div><p class="hint">Uscendo, i dati restano anche in questo browser.</p></div>`;
      byId("sync-now").onclick = sync;
      byId("sync-logout").onclick = logout;
      return;
    }
    page.innerHTML = `<form id="account-form" class="feature-form account-box"><h2>Accedi o crea un account</h2><label for="account-user">Nome utente</label><input id="account-user" autocomplete="username" required minlength="3" maxlength="40" pattern="[A-Za-z0-9._\\-]{3,40}" spellcheck="false"><label for="account-pass">Password</label><input id="account-pass" type="password" autocomplete="current-password" required minlength="8"><input id="account-website" class="sr-only" tabindex="-1" autocomplete="off" aria-hidden="true"><p class="hint">Nome utente: lettere, numeri, punto, trattino. Password: almeno 8 caratteri.</p><div class="actions"><button class="primary" value="login">Accedi</button><button class="secondary" value="register">Crea account</button></div><p id="account-message" role="status">${escape(lastError)}</p></form>`;
    byId("account-form").addEventListener("submit", submit);
  }
  function escape(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  const messages = {
    wrong_credentials: "Nome utente o password sbagliati.",
    username_taken: "Questo nome utente è già usato. Scegline un altro.",
    username_invalid: "Il nome utente può contenere solo lettere, numeri, punto e trattino (3–40 caratteri).",
    password_too_short: "La password deve avere almeno 8 caratteri.",
    too_many_signups: "Troppi account creati da questa rete. Riprova tra un’ora.",
    wrong_code: "Codice d’invito sbagliato.",
  };
  async function submit(e) {
    e.preventDefault();
    const mode = e.submitter?.value === "register" ? "register" : "login",
      msg = byId("account-message");
    msg.textContent = mode === "register" ? "Creo l’account…" : "Accesso in corso…";
    try {
      const r = await api(mode + ".php", "POST", {
        username: byId("account-user").value,
        password: byId("account-pass").value,
        website: byId("account-website").value,
      });
      if (r.status !== 200) {
        msg.textContent = messages[r.json.error] || "Il server non risponde. Riprova più tardi.";
        return;
      }
      state = { token: r.json.token, username: r.json.username, revision: 0, hash: "", at: 0 };
      writeState();
      render();
      await sync();
    } catch {
      msg.textContent = "Il server non risponde. Controlla la connessione.";
    }
  }
  async function logout() {
    // Prima di perdere il token: live.js toglie le notifiche push di questo dispositivo
    window.dispatchEvent(new CustomEvent("studio:logout"));
    try {
      await api("logout.php", "POST");
    } catch {}
    state = null;
    writeState();
    render();
  }

  const section = document.createElement("section");
  section.id = "page-account";
  section.className = "page";
  section.hidden = location.hash !== "#account";
  section.innerHTML =
    '<div class="heading"><h1>Account e app</h1><p>Con un account ritrovi sessioni, piani, domande ed errori su ogni dispositivo. Qui installi anche l’app e attivi il promemoria dei ripassi.</p></div><div id="account-body"></div>';
  document.querySelector(".source-strip").before(section);

  render();
  checkServer().then(() => state && sync());
  // Invio automatico pochi secondi dopo ogni modifica
  setInterval(() => {
    if (state && available && !busy && dirty()) sync();
  }, 5000);
  document.addEventListener("visibilitychange", () => {
    // Uscendo dalla scheda invia subito le modifiche; tornando controlla le novità
    if (document.visibilityState === "visible" || dirty()) sync();
  });
})();
