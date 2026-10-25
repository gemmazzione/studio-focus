// Studiare insieme: avvisi quando un compagno di lobby inizia a studiare o ti incoraggia,
// pulsanti "Incoraggia" e "Studia insieme", e su telefono schermo acceso e vibrazione.
// Gli avvisi arrivano con l'app aperta (anche in secondo piano): non ci sono notifiche push dal server.
(() => {
  "use strict";
  const byId = (id) => document.getElementById(id),
    KEY = "studio.social.v1",
    token = () => {
      try {
        return JSON.parse(localStorage.getItem("studio.sync.v1"))?.token || "";
      } catch {
        return "";
      }
    };
  function prefs() {
    try {
      return { studying: true, cheers: true, awake: true, ...JSON.parse(localStorage.getItem(KEY)) };
    } catch {
      return { studying: true, cheers: true, awake: true };
    }
  }
  const savePrefs = (p) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {}
  };

  // Con la pagina davanti basta il messaggio in basso; in secondo piano serve la notifica del sistema
  async function tell(title, body, tag) {
    if (document.visibilityState === "visible") return notify(`${title} ${body}`);
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.getRegistration?.();
    const options = { body, icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag, data: { url: "./#focus" } };
    if (reg) reg.showNotification(title, options);
    else new Notification(title, options);
  }
  window.addEventListener("studio:friend-studying", (e) => {
    if (!prefs().studying) return;
    const o = e.detail;
    tell(`${o.name} ha iniziato a studiare.`, o.left ? `Finisce tra ${o.left} minuti: puoi studiare insieme.` : "Apri Studio per unirti.", "friend-" + o.name);
  });
  window.addEventListener("studio:cheers", (e) => {
    if (!prefs().cheers) return;
    const names = [...new Set(e.detail.map((c) => c.from))];
    tell(names.length === 1 ? `${names[0]} ti incoraggia!` : `${names.join(", ")} ti incoraggiano!`, "Forza, continua così.", "cheer");
    if (navigator.vibrate) navigator.vibrate(120);
  });

  // --- Incoraggia e Studia insieme ------------------------------------------------
  document.addEventListener("click", async (e) => {
    const cheer = e.target.closest("[data-cheer]"),
      join = e.target.closest("[data-join]");
    if (cheer) {
      cheer.disabled = true;
      try {
        const r = await fetch("api/social.php", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Auth-Token": token() },
          body: JSON.stringify({ action: "cheer", to: cheer.dataset.cheer }),
        });
        notify(
          r.status === 200
            ? `Incoraggiamento inviato a ${cheer.dataset.cheer}.`
            : r.status === 429
              ? `Hai incoraggiato ${cheer.dataset.cheer} da poco: riprova tra un minuto.`
              : "Non è stato possibile inviarlo. Riprova.",
        );
      } catch {
        notify("Il server non risponde. Riprova.");
      }
      setTimeout(() => (cheer.disabled = false), 60000);
    }
    if (join) {
      if (data.active) return notify("Hai già una sessione in corso.");
      const minutes = Math.min(180, Number(join.dataset.join)),
        select = byId("duration");
      // Durata uguale al tempo che manca all'amico: finite insieme
      select.querySelector("[data-together]")?.remove();
      select.insertAdjacentHTML("afterbegin", `<option value="${minutes}" data-together>${minutes} minuti, insieme a ${esc(join.dataset.joinName)}</option>`);
      select.value = String(minutes);
      location.hash = "focus";
      setTimeout(() => byId(byId("subject").value ? "goal" : "subject").focus(), 50);
      notify(`Scrivi materia e obiettivo e premi Avvia: finirete insieme a ${join.dataset.joinName}.`);
    }
  });

  // --- Impostazioni ---------------------------------------------------------------------
  const anchor = byId("reminder-form")?.closest("section");
  anchor?.insertAdjacentHTML(
    "afterend",
    `<section class="pwa-section" id="social-notify"><h2>Avvisi dalle lobby e dal telefono</h2>
    <form class="feature-form" id="social-form">
      <label class="checkbox"><input type="checkbox" id="sn-studying">Quando qualcuno delle mie lobby inizia a studiare</label>
      <label class="checkbox"><input type="checkbox" id="sn-cheers">Quando qualcuno mi incoraggia</label>
      <label class="checkbox"><input type="checkbox" id="sn-awake">Tieni lo schermo acceso durante la sessione (telefono e tablet)</label>
      <p class="hint" id="sn-status"></p>
      <button type="button" class="secondary" id="sn-permission" hidden>Attiva le notifiche di sistema</button>
    </form></section>`,
  );
  function renderSettings() {
    if (!byId("social-form")) return;
    const p = prefs();
    byId("sn-studying").checked = p.studying;
    byId("sn-cheers").checked = p.cheers;
    byId("sn-awake").checked = p.awake;
    const perm = "Notification" in window ? Notification.permission : "unsupported";
    byId("sn-permission").hidden = perm !== "default";
    byId("sn-status").textContent =
      perm === "granted"
        ? "Con l’app aperta, anche in secondo piano, ricevi la notifica. Con l’app chiusa gli avvisi non arrivano."
        : perm === "denied"
          ? "Le notifiche sono bloccate nelle impostazioni del browser: vedrai gli avvisi solo dentro l’app."
          : perm === "unsupported"
            ? "Questo browser non supporta le notifiche: vedrai gli avvisi solo dentro l’app."
            : "Per ora vedi gli avvisi solo dentro l’app. Attiva le notifiche per riceverli anche quando l’app è in secondo piano.";
  }
  byId("social-form")?.addEventListener("change", () => {
    savePrefs({ studying: byId("sn-studying").checked, cheers: byId("sn-cheers").checked, awake: byId("sn-awake").checked });
    keepAwake();
  });
  byId("sn-permission")?.addEventListener("click", async () => {
    await Notification.requestPermission();
    renderSettings();
  });
  renderSettings();

  // --- Telefono: schermo acceso e vibrazione -----------------------------------------------
  let lock = null;
  async function keepAwake() {
    const want = prefs().awake && !!data.active?.running && document.visibilityState === "visible";
    try {
      if (want && !lock && "wakeLock" in navigator) {
        lock = await navigator.wakeLock.request("screen");
        lock.addEventListener("release", () => (lock = null));
      } else if (!want && lock) {
        await lock.release();
        lock = null;
      }
    } catch {
      lock = null; // batteria scarica o permesso negato: niente di grave
    }
  }
  window.addEventListener("studio:saved", keepAwake);
  document.addEventListener("visibilitychange", keepAwake);
  window.addEventListener("studio:alarm", () => navigator.vibrate?.([300, 150, 300, 150, 300]));
  keepAwake();
})();
