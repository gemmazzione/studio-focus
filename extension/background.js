const ALLOWED = "https://studio-focus-sam-221026.samurugge02.chatgpt.site";
let queue = Promise.resolve();
async function stop() {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: rules.map((r) => r.id),
  });
  await chrome.storage.local.remove("until");
  await chrome.alarms.clear("end");
  await chrome.action.setBadgeText({ text: "" });
}
async function expire() {
  const { until } = await chrome.storage.local.get("until");
  if (!until || until <= Date.now()) await stop();
  else await chrome.alarms.create("end", { when: until });
}
chrome.runtime.onMessageExternal.addListener((message, sender, respond) => {
  let origin;
  try {
    origin = new URL(sender.url).origin;
  } catch {
    return false;
  }
  if (
    origin !== ALLOWED &&
    !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  )
    return false;
  queue = queue
    .catch(() => {})
    .then(async () => {
      if (message.type === "PING") {
        await expire();
        const state = await chrome.storage.local.get("until");
        respond({ ok: true, until: state.until || 0 });
        return;
      }
      if (message.type === "STOP") {
        await stop();
        respond({ ok: true });
        return;
      }
      if (message.type !== "START") throw Error("Richiesta sconosciuta");
      const until = Number(message.until),
        domains = message.domains;
      if (
        !Number.isFinite(until) ||
        until <= Date.now() ||
        until > Date.now() + 24 * 3600000 ||
        !Array.isArray(domains) ||
        domains.length > 100 ||
        !domains.every(
          (s) =>
            typeof s === "string" &&
            /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(s) &&
            !s.endsWith("chatgpt.site"),
        )
      )
        throw Error("Dati del blocco non validi");
      const old = await chrome.declarativeNetRequest.getDynamicRules();
      const rules = [...new Set(domains)].map((d, i) => ({
        id: i + 1,
        priority: 1,
        action: { type: "block" },
        condition: {
          requestDomains: [d],
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
        removeRuleIds: old.map((r) => r.id),
        addRules: rules,
      });
      await chrome.storage.local.set({ until });
      await chrome.alarms.create("end", { when: until });
      await chrome.action.setBadgeText({ text: "ON" });
      await chrome.action.setBadgeBackgroundColor({ color: "#315c48" });
      respond({ ok: true, until });
    })
    .catch((e) => respond({ ok: false, error: e.message }));
  return true;
});
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "end") {
    queue = queue.catch(() => {}).then(expire);
  }
});
chrome.runtime.onStartup.addListener(() => {
  queue = queue.catch(() => {}).then(expire);
});
chrome.runtime.onInstalled.addListener(() => {
  queue = queue.catch(() => {}).then(expire);
});
