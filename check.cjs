const fs = require("fs"),
  vm = require("vm"),
  assert = require("assert");
let rules = [],
  values = {},
  external,
  alarm;
const chrome = {
  declarativeNetRequest: {
    getDynamicRules: async () => rules,
    updateDynamicRules: async ({ removeRuleIds = [], addRules = [] }) => {
      rules = rules
        .filter((r) => !removeRuleIds.includes(r.id))
        .concat(addRules);
    },
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
  await send({
    type: "START",
    domains: ["instagram.com"],
    until: Date.now() + 60000,
  });
  values.until = Date.now() - 1;
  assert((await send({ type: "PING" })).ok);
  assert.equal(rules.length, 0);
  console.log(
    "PASS: block rules, domain validation, origin validation, stop, expiry.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
