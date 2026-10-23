importScripts("scheduler.js");
const ALLOWED = [
  "https://samueleruggeri.altervista.org",
  "https://gemmazzione.github.io",
  "https://studio-focus-sam-221026.samurugge02.chatgpt.site",
];
let queue = Promise.resolve();
// Protezioni sempre attive (non legate alle sessioni): siti per adulti con SafeSearch
// e pubblicità di YouTube. Spegnere il blocco adulti richiede un minuto di attesa.
const ADULT_DELAY = 60000;
const YT_MATCHES = ["https://www.youtube.com/*", "https://m.youtube.com/*", "https://music.youtube.com/*"];
const YT_SCRIPTS = [
  { id: "yt-main", matches: YT_MATCHES, js: ["youtube-main.js"], runAt: "document_start", world: "MAIN" },
  { id: "yt-skip", matches: YT_MATCHES, js: ["youtube-skip.js"], runAt: "document_start" },
];
async function protections(values) {
  let { adultOff = false, adultPendingOff = 0, adsOff = false } = values;
  if (adultPendingOff && adultPendingOff <= Date.now()) {
    adultOff = true;
    adultPendingOff = 0;
    await chrome.storage.local.set({ adultOff, adultPendingOff });
  }
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: [adultOff ? null : "adult", adsOff ? null : "ads"].filter(Boolean),
    disableRulesetIds: [adultOff ? "adult" : null, adsOff ? "ads" : null].filter(Boolean),
  });
  const registered = (await chrome.scripting.getRegisteredContentScripts()).map((s) => s.id);
  if (adsOff) {
    const ids = registered.filter((id) => id.startsWith("yt-"));
    if (ids.length) await chrome.scripting.unregisterContentScripts({ ids });
  } else {
    const missing = YT_SCRIPTS.filter((s) => !registered.includes(s.id));
    if (missing.length) await chrome.scripting.registerContentScripts(missing);
  }
  if (adultPendingOff) await chrome.alarms.create("adult", { when: adultPendingOff });
  return { adult: !adultOff, adultPendingOff, ads: !adsOff };
}
async function reconcile() {
  const values = await chrome.storage.local.get(null);
  if (values.until && values.manualUntil === undefined) {
    values.manualUntil = values.until;
    const previous = await chrome.declarativeNetRequest.getDynamicRules();
    values.manualDomains = previous.flatMap(
      (r) => r.condition?.requestDomains || [],
    );
    await chrome.storage.local.set({
      manualUntil: values.manualUntil,
      manualDomains: values.manualDomains,
    });
  }
  const state = StudioScheduler.state(values);
  const protection = await protections(values);
  const previous = await chrome.declarativeNetRequest.getDynamicRules();
  const addRules = state.domains.map((domain, i) => ({
    id: i + 1,
    priority: 1,
    action: { type: "block" },
    condition: {
      requestDomains: [domain],
      resourceTypes: [
        "main_frame",
        "sub_frame",
        "xmlhttprequest",
        "websocket",
        "media",
        "script",
      ],
    },
  }));
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: previous.map((r) => r.id),
    addRules,
  });
  await chrome.storage.local.set({ until: state.until });
  await chrome.alarms.clear("end");
  if (state.next) await chrome.alarms.create("end", { when: state.next });
  await chrome.action.setBadgeText({
    text: state.domains.length ? "ON" : state.suspended ? "15m" : "",
  });
  await chrome.action.setBadgeBackgroundColor({ color: "#2346c8" });
  return {
    ok: true,
    until: state.until,
    scheduled: state.scheduled,
    suspended: state.suspended,
    version: 2,
    strict: (values.manualUntil || 0) > Date.now(),
    ...protection,
  };
}
async function handle(message) {
  if (message.type === "PING") return reconcile();
  if (message.type === "ADULT_OFF") {
    const { adultOff, adultPendingOff } = await chrome.storage.local.get(null);
    if (!adultOff && !adultPendingOff)
      await chrome.storage.local.set({ adultPendingOff: Date.now() + ADULT_DELAY });
    return reconcile();
  }
  if (message.type === "ADULT_CANCEL" || message.type === "ADULT_ON") {
    await chrome.storage.local.set({ adultOff: false, adultPendingOff: 0 });
    return reconcile();
  }
  if (message.type === "ADS_SET") {
    await chrome.storage.local.set({ adsOff: !message.on });
    return reconcile();
  }
  if (message.type === "STOP") {
    await chrome.storage.local.set({ manualUntil: 0, manualDomains: [] });
    return reconcile();
  }
  if (message.type === "SUSPEND") {
    // Blocco severo: durante una sessione di studio avviata dall’app non si sospende
    const { manualUntil = 0 } = await chrome.storage.local.get(null);
    if (manualUntil > Date.now()) throw Error("Durante una sessione di studio la sospensione non è disponibile.");
    await chrome.storage.local.set({
      manualUntil: 0,
      manualDomains: [],
      suspendUntil: Date.now() + 15 * 60000,
    });
    return reconcile();
  }
  if (message.type === "SET_SCHEDULES") {
    if (
      !StudioScheduler.validSchedules(message.schedules) ||
      !StudioScheduler.validDomains(message.domains)
    )
      throw Error("Orari o domini non validi");
    await chrome.storage.local.set({
      schedules: message.schedules,
      scheduleDomains: [...new Set(message.domains)],
    });
    return reconcile();
  }
  if (message.type === "START") {
    const until = Number(message.until);
    if (
      !Number.isFinite(until) ||
      until <= Date.now() ||
      until > Date.now() + 24 * 3600000 ||
      !StudioScheduler.validDomains(message.domains)
    )
      throw Error("Dati del blocco non validi");
    await chrome.storage.local.set({
      manualUntil: until,
      manualDomains: [...new Set(message.domains)],
    });
    return reconcile();
  }
  throw Error("Richiesta sconosciuta");
}
function enqueue(message, respond) {
  queue = queue
    .catch(() => {})
    .then(() => handle(message))
    .then(respond)
    .catch((e) => respond({ ok: false, error: e.message }));
  return true;
}
chrome.runtime.onMessageExternal.addListener((message, sender, respond) => {
  let origin;
  try {
    origin = new URL(sender.url).origin;
  } catch {
    return false;
  }
  if (
    !ALLOWED.includes(origin) &&
    !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  )
    return false;
  // Sospensione e protezioni si cambiano solo dal pulsante dell'estensione
  if (message.type === "SUSPEND" || /^(ADULT|ADS)_/.test(message.type)) return false;
  return enqueue(message, respond);
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return false;
  return enqueue(message, respond);
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (["end", "health", "adult"].includes(alarm.name))
    queue = queue.catch(() => {}).then(reconcile);
});
async function boot() {
  await chrome.alarms.create("health", { periodInMinutes: 1 });
  return reconcile();
}
chrome.runtime.onStartup.addListener(() => {
  queue = queue.catch(() => {}).then(boot);
});
chrome.runtime.onInstalled.addListener(() => {
  queue = queue.catch(() => {}).then(boot);
});
