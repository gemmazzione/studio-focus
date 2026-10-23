// App installabile (service worker + pulsante di installazione) e promemoria dei ripassi:
// avviso nella pagina, numero sull'icona dell'app e notifica all'ora scelta.
// Le notifiche partono quando l'app è aperta; con l'app installata su Chrome/Edge
// anche in background, quando il browser lo permette (non a orario preciso).
(() => {
  "use strict";
  const byId = (id) => document.getElementById(id),
    SETTINGS = "studio.reminder.v1",
    BANNER = "studio.banner.v1",
    REMINDER_CACHE = "studio-reminder",
    REMINDER_URL = new URL("reminder-state.json", document.baseURI).href;
  const supportsSW = "serviceWorker" in navigator && window.isSecureContext;
  const standalone = () =>
    matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let installPrompt = null;

  function readSettings() {
    try {
      return { enabled: false, time: "18:00", ...JSON.parse(localStorage.getItem(SETTINGS)) };
    } catch {
      return { enabled: false, time: "18:00" };
    }
  }
  let settings = readSettings();

  // Date dei ripassi con una data scelta: sessioni, domande ed errori non risolti
  // Le pagine dei ripassi sono state tolte: il promemoria segue solo l'obiettivo settimanale
  const dueTimes = () => [];
  const dueNow = () => dueTimes().filter((t) => t <= Date.now()).length;
  // Minuti fatti e obiettivo della settimana (da lunedì), per l'avviso "sei indietro"
  function weekly() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const from = start.getTime();
    return {
      weekStart: from,
      target: data.study?.goals?.weekly?.minutes || 0,
      done: data.sessions
        .filter((s) => s.at >= from)
        .reduce((n, s) => n + Math.round((s.seconds || 0) / 60), 0),
    };
  }
  // Da giovedì in poi: indietro se i minuti sono sotto la quota prevista fino a oggi
  function behind(w = weekly()) {
    const day = (new Date().getDay() + 6) % 7;
    return w.target > 0 && day >= 3 && w.done < Math.round((w.target * (day + 1)) / 7);
  }

  // --- Service worker -----------------------------------------------------
  if (supportsSW)
    navigator.serviceWorker.register("sw.js").catch(() => {});

  async function writeReminderState() {
    if (!("caches" in window)) return;
    try {
      const cache = await caches.open(REMINDER_CACHE),
        old = await cache.match(REMINDER_URL),
        lastShown = old ? (await old.json()).lastShown : null;
      await cache.put(
        REMINDER_URL,
        new Response(JSON.stringify({ ...settings, dues: dueTimes(), weekly: weekly(), lastShown }), {
          headers: { "Content-Type": "application/json" },
        }),
      );
    } catch {}
  }
  async function askWorkerToCheck() {
    if (!supportsSW || !settings.enabled) return;
    const reg = await navigator.serviceWorker.getRegistration();
    reg?.active?.postMessage("check-reminder");
  }
  async function registerPeriodic() {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (!reg.periodicSync) return;
      if (settings.enabled)
        await reg.periodicSync.register("studio-reminder", { minInterval: 6 * 3600000 });
      else await reg.periodicSync.unregister("studio-reminder");
    } catch {}
  }

  // --- Avviso nella pagina e numero sull'icona ----------------------------
  document
    .querySelector("main > header")
    .insertAdjacentHTML(
      "afterend",
      '<div id="due-banner" class="due-banner" role="status" hidden><span id="due-banner-text"></span><a href="#focus">Inizia una sessione</a><button type="button" class="text-button" id="due-banner-close">Più tardi</button></div>',
    );
  function renderBanner() {
    const n = dueNow(),
      w = weekly(),
      late = behind(w),
      today = StudyCore.localDay(new Date()),
      page = location.hash.slice(1),
      hide =
        (!n && !late) ||
        data.active ||
        page === "focus" ||
        localStorage.getItem(BANNER) === today;
    byId("due-banner").hidden = !!hide;
    if (!hide)
      byId("due-banner-text").textContent =
        [
          n ? (n === 1 ? "Hai 1 ripasso in scadenza." : `Hai ${n} ripassi in scadenza.`) : "",
          late ? `Obiettivo della settimana: ${w.done} di ${w.target} minuti, sei un po’ indietro.` : "",
        ]
          .filter(Boolean)
          .join(" ");
    if ("setAppBadge" in navigator)
      (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
  }
  byId("due-banner-close").onclick = () => {
    localStorage.setItem(BANNER, StudyCore.localDay(new Date()));
    renderBanner();
  };

  // --- Sezione "App e promemoria" nella pagina Account ---------------------
  byId("account-body").insertAdjacentHTML(
    "afterend",
    `<section class="pwa-section"><h2>Installa l’app</h2><div id="install-body"></div></section>
    <section class="pwa-section"><h2>Promemoria</h2><p class="hint">Una notifica al giorno, all’ora che scegli, quando da giovedì sei indietro con i minuti dell’obiettivo settimanale (si imposta in Obiettivi). Vale solo per questo dispositivo.</p><form id="reminder-form" class="feature-form"><label class="checkbox"><input id="reminder-enabled" type="checkbox">Avvisami se sono indietro con l’obiettivo settimanale</label><label for="reminder-time">Dopo le ore</label><input id="reminder-time" type="time" required><div class="actions"><button class="primary">Salva promemoria</button><button type="button" id="reminder-test" class="secondary">Prova la notifica</button></div><p id="reminder-status" class="hint" role="status"></p></form></section>`,
  );
  function renderInstall() {
    const box = byId("install-body");
    if (standalone()) {
      box.innerHTML = '<p class="hint">Stai già usando l’app installata.</p>';
    } else if (installPrompt) {
      box.innerHTML =
        '<p class="hint">Si apre in una finestra sua, senza la barra del browser, e funziona anche senza internet.</p><button type="button" id="install-now" class="primary">Installa Studio</button>';
      byId("install-now").onclick = install;
    } else if (ios) {
      box.innerHTML =
        '<p class="hint">Su iPhone e iPad apri il sito con Safari, tocca il pulsante Condividi e scegli <b>Aggiungi alla schermata Home</b>. Le notifiche funzionano solo dall’app aggiunta alla Home.</p>';
    } else {
      box.innerHTML =
        '<p class="hint">Su Chrome ed Edge usa l’icona di installazione nella barra degli indirizzi, oppure il menu ⋮ → <b>Installa app</b> (su Android: <b>Aggiungi a schermata Home</b>). Con Firefox su PC non si può installare: le altre funzioni restano uguali.</p>';
    }
    const side = byId("install-side");
    if (side) side.hidden = !installPrompt || standalone();
  }
  async function install() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice.catch(() => null);
    installPrompt = null;
    renderInstall();
    if (choice?.outcome === "accepted") notify("Studio è stato installato.");
  }
  byId("sync-note").insertAdjacentHTML(
    "beforebegin",
    '<button type="button" id="install-side" class="install-side" hidden>Installa l’app</button>',
  );
  byId("install-side").onclick = install;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installPrompt = e;
    renderInstall();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    renderInstall();
  });

  function reminderStatus() {
    const status = byId("reminder-status");
    if (!("Notification" in window) || !supportsSW)
      return (status.textContent = ios
        ? "Su iPhone le notifiche funzionano solo dall’app aggiunta alla schermata Home."
        : "Questo browser non supporta le notifiche. Resta l’avviso nella pagina.");
    if (Notification.permission === "denied")
      return (status.textContent =
        "Le notifiche sono bloccate per questo sito. Riattivale dalle impostazioni del browser (icona a sinistra dell’indirizzo).");
    status.textContent = settings.enabled
      ? `Attivo. ${standalone() ? "Con l’app installata il browser può avvisarti anche a finestra chiusa, ma non a un orario preciso." : "Arriva quando la pagina è aperta: installa l’app per riceverlo anche a finestra chiusa (Chrome ed Edge)."}`
      : "Disattivato.";
  }
  function renderReminder() {
    byId("reminder-enabled").checked = settings.enabled;
    byId("reminder-time").value = settings.time;
    reminderStatus();
  }
  async function permission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "default") await Notification.requestPermission();
    return Notification.permission === "granted";
  }
  byId("reminder-form").onsubmit = async (e) => {
    e.preventDefault();
    const enabled = byId("reminder-enabled").checked;
    if (enabled && !(await permission())) {
      settings.enabled = false;
      renderReminder();
      return;
    }
    settings = { enabled, time: byId("reminder-time").value || "18:00" };
    localStorage.setItem(SETTINGS, JSON.stringify(settings));
    await writeReminderState();
    registerPeriodic();
    askWorkerToCheck();
    renderReminder();
    notify(enabled ? `Promemoria attivo dopo le ${settings.time}.` : "Promemoria disattivato.");
  };
  byId("reminder-test").onclick = async () => {
    if (!supportsSW || !(await permission())) return reminderStatus();
    const reg = await navigator.serviceWorker.ready,
      n = dueNow();
    reg.showNotification("Obiettivo della settimana", {
      body: `Prova riuscita. Questa settimana: ${weekly().done} minuti di studio.`,
      icon: "icons/icon-192.png",
      tag: "studio-test",
      data: { url: "./#focus" },
    });
  };

  function refresh() {
    renderBanner();
    writeReminderState();
  }
  window.addEventListener("studio:saved", refresh);
  window.addEventListener("hashchange", renderBanner);
  renderInstall();
  renderReminder();
  refresh();
  askWorkerToCheck();
  setInterval(() => {
    renderBanner();
    askWorkerToCheck();
  }, 60000);
})();
