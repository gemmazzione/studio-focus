const fs = require("fs"),
  vm = require("vm"),
  assert = require("assert");
let rules = [],
  values = {},
  external,
  internal,
  alarm;
const chrome = {
  declarativeNetRequest: {
    getDynamicRules: async () => rules,
    updateDynamicRules: async ({ removeRuleIds = [], addRules = [] }) => {
      rules = rules
        .filter((r) => !removeRuleIds.includes(r.id))
        .concat(addRules);
    },
    updateEnabledRulesets: async () => {},
  },
  scripting: {
    getRegisteredContentScripts: async () => [],
    registerContentScripts: async () => {},
    unregisterContentScripts: async () => {},
  },
  storage: {
    local: {
      get: async () => values,
      set: async (v) => Object.assign(values, v),
      remove: async (k) => delete values[k],
    },
  },
  alarms: {
    create: async () => {},
    clear: async () => {},
    onAlarm: { addListener: (f) => (alarm = f) },
  },
  action: {
    setBadgeText: async () => {},
    setBadgeBackgroundColor: async () => {},
  },
  runtime: {
    id: "studio-test",
    onMessage: { addListener: (f) => (internal = f) },
    onMessageExternal: { addListener: (f) => (external = f) },
    onStartup: { addListener: () => {} },
    onInstalled: { addListener: () => {} },
  },
};
vm.runInNewContext(fs.readFileSync("extension/background.js", "utf8"), {
  chrome,
  URL,
  Date,
  Error,
  Number,
  Array,
  Set,
  StudioScheduler: require("./extension/scheduler.js"),
  importScripts: () => {},
});
const send = (
  message,
  url = "https://studio-focus-sam-221026.samurugge02.chatgpt.site/",
) =>
  new Promise((resolve) => {
    const accepted = external(message, { url }, resolve);
    if (!accepted) resolve({ ok: false });
  });
(async () => {
  assert(
    (
      await send({
        type: "START",
        domains: ["instagram.com", "tiktok.com"],
        until: Date.now() + 60000,
      })
    ).ok,
  );
  assert.equal(rules.length, 2);
  assert.equal(rules[0].action.type, "block");
  assert(rules[0].condition.resourceTypes.includes("main_frame"));
  assert(
    !(
      await send({
        type: "START",
        domains: ["bad/host"],
        until: Date.now() + 60000,
      })
    ).ok,
  );
  assert.equal(rules.length, 2);
  assert(!(await send({ type: "STOP" }, "https://other.example/")).ok);
  assert.equal(rules.length, 2);
  assert((await send({ type: "STOP" })).ok);
  assert.equal(rules.length, 0);
  const time = (at) => {
    const d = new Date(at);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  const scheduled = {
    id: "test-schedule",
    days: [0, 1, 2, 3, 4, 5, 6],
    start: time(Date.now() - 60000),
    end: time(Date.now() + 3600000),
    enabled: true,
  };
  assert(
    (
      await send({
        type: "SET_SCHEDULES",
        schedules: [scheduled],
        domains: ["instagram.com"],
      })
    ).ok,
  );
  assert.equal(rules.length, 1, "Active scheduled block applied");
  assert((await send({ type: "STOP" })).ok);
  assert.equal(
    rules.length,
    1,
    "Ending manual focus preserves scheduled block",
  );
  assert(
    !(
      await send({
        type: "SET_SCHEDULES",
        schedules: [{ ...scheduled, start: "99:00" }],
        domains: ["instagram.com"],
      })
    ).ok,
  );
  const suspend = await new Promise((resolve) =>
    internal({ type: "SUSPEND" }, { id: "studio-test" }, resolve),
  );
  assert(suspend.ok);
  assert.equal(rules.length, 0, "Popup suspension overrides all active blocks");
  assert(
    !(await send({ type: "SUSPEND" })).ok,
    "Web page cannot invoke popup-only suspension",
  );
  values.suspendUntil = 0;
  assert((await send({ type: "PING" })).ok);
  assert.equal(rules.length, 1, "Schedule resumes after suspension");
  assert(
    (
      await send({
        type: "SET_SCHEDULES",
        schedules: [],
        domains: ["instagram.com"],
      })
    ).ok,
  );
  assert.equal(
    rules.length,
    0,
    "Removing schedules clears scheduled protection",
  );
  await send({
    type: "START",
    domains: ["instagram.com"],
    until: Date.now() + 60000,
  });
  values.manualUntil = Date.now() - 1;
  assert((await send({ type: "PING" })).ok);
  assert.equal(rules.length, 0);
  console.log(
    "PASS: block rules, domain validation, origin validation, stop, expiry.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
