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
      <label class="checkbox push-toggle"><input type="checkbox" id="sn-push"><span><b>Avvisami anche con l’app chiusa</b> (notifiche push su questo dispositivo)</span></label>
      <p class="hint" id="sn-push-status"></p>
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

  // --- Notifiche push dal server (anche ad app chiusa) -----------------------------
  const PUSH = "studio.push.v1",
    pushSupported = "serviceWorker" in navigator && "PushManager" in window && window.isSecureContext,
    standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true,
    ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const pushOn = () => {
    try {
      return localStorage.getItem(PUSH) === "on";
    } catch {
      return false;
    }
  };
  async function pushApi(body) {
    const r = await fetch("api/push.php", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Auth-Token": token() },
      body: JSON.stringify(body),
    });
    return { status: r.status, json: await r.json().catch(() => ({})) };
  }
  // La chiave per leggere i messaggi va nella cache: il service worker non legge localStorage
  async function savePushKey(key) {
    const cache = await caches.open("studio-reminder"),
      url = new URL("push-state.json", document.baseURI).href;
    if (key) await cache.put(url, new Response(JSON.stringify({ key }), { headers: { "Content-Type": "application/json" } }));
    else await cache.delete(url);
  }
  const keyBytes = (b64) => Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4)), (c) => c.charCodeAt(0));
  // Iscrive (o aggiorna) questo dispositivo con le preferenze attuali
  async function subscribePush() {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const k = await (await fetch("api/push.php?action=key")).json();
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(k.publicKey) });
    }
    const p = prefs(),
      r = await pushApi({ action: "subscribe", endpoint: sub.endpoint, studying: p.studying, cheers: p.cheers });
    if (r.status !== 200) throw Error(r.json.error || "server");
    await savePushKey(r.json.inboxKey);
  }
  async function unsubscribePush() {
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (sub) {
        if (token()) await pushApi({ action: "unsubscribe", endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      await savePushKey(null);
    } catch {}
  }
  function renderPush(message) {
    const box = byId("sn-push"),
      status = byId("sn-push-status");
    if (!box) return;
    box.checked = pushOn();
    box.disabled = !pushSupported || !token() || (ios && !standalone);
    status.textContent =
      message ||
      (!pushSupported
        ? "Questo browser non supporta le notifiche push."
        : ios && !standalone
          ? "Su iPhone e iPad le notifiche push funzionano solo dall’app aggiunta alla schermata Home (Condividi › Aggiungi alla schermata Home)."
          : !token()
            ? "Serve un account: accedi qui sopra per riceverle."
            : pushOn()
              ? "Attive: ricevi gli avvisi scelti qui sopra anche con l’app chiusa, finché il telefono o il PC è acceso e connesso."
              : "Spente: gli avvisi arrivano solo con l’app aperta.");
  }
  byId("sn-push")?.addEventListener("change", async (e) => {
    e.stopPropagation();
    const on = e.target.checked;
    renderPush(on ? "Attivo le notifiche…" : "Spengo le notifiche…");
    try {
      if (on) {
        if ((await Notification.requestPermission()) !== "granted") throw Error("permission");
        await subscribePush();
      } else await unsubscribePush();
      localStorage.setItem(PUSH, on ? "on" : "off");
      renderPush();
      renderSettings();
      notify(on ? "Notifiche push attive su questo dispositivo." : "Notifiche push spente.");
    } catch (err) {
      localStorage.setItem(PUSH, "off");
      renderPush(err.message === "permission" ? "Permesso negato: riattiva le notifiche dalle impostazioni del browser." : "Non è stato possibile attivarle. Riprova più tardi.");
    }
  });
  // Cambiate le preferenze: il server le deve sapere per decidere cosa mandare
  byId("social-form")?.addEventListener("change", (e) => {
    if (e.target.id !== "sn-push" && pushOn() && token()) subscribePush().catch(() => {});
  });
  window.addEventListener("studio:logout", () => {
    if (pushOn()) {
      unsubscribePush();
      localStorage.setItem(PUSH, "off");
    }
    renderPush();
  });
  // A ogni apertura rinnova l'iscrizione: il browser può averla cambiata, o l'account essere diverso
  if (pushSupported && pushOn() && token()) subscribePush().catch(() => {});
  renderPush();

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
