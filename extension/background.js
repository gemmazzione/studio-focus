importScripts("scheduler.js");
const ALLOWED = [
  "https://gemmazzione.github.io",
  "https://studio-focus-sam-221026.samurugge02.chatgpt.site",
];
let queue = Promise.resolve();
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
  await chrome.action.setBadgeBackgroundColor({ color: "#ad7654" });
  return {
    ok: true,
    until: state.until,
    scheduled: state.scheduled,
    suspended: state.suspended,
    version: 2,
  };
}
async function handle(message) {
  if (message.type === "PING") return reconcile();
  if (message.type === "STOP") {
    await chrome.storage.local.set({ manualUntil: 0, manualDomains: [] });
    return reconcile();
  }
  if (message.type === "SUSPEND") {
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
  if (message.type === "SUSPEND") return false;
  return enqueue(message, respond);
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return false;
  return enqueue(message, respond);
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (["end", "health"].includes(alarm.name))
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
