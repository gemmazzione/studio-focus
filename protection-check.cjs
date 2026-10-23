// Test delle protezioni dell'estensione: regole statiche (siti per adulti, SafeSearch,
// pubblicità di YouTube) e comandi del popup, con le API di Chrome simulate.
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const adult = JSON.parse(fs.readFileSync("extension/rules/adult.json", "utf8"));
const ads = JSON.parse(fs.readFileSync("extension/rules/ads.json", "utf8"));
const manifest = JSON.parse(fs.readFileSync("extension/manifest.json", "utf8"));

// Regole: ID unici, domini validi, espressioni che riconoscono gli indirizzi giusti
for (const set of [adult, ads]) assert.strictEqual(new Set(set.map((r) => r.id)).size, set.length);
const domains = adult[0].condition.requestDomains;
assert(domains.length > 100 && domains.every((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)));
assert(domains.includes("pornhub.com") && domains.includes("xvideos.com"));
const regex = (r) => new RegExp(r.condition.regexFilter, "i");
const tld = regex(adult[1]),
  word = regex(adult[2]);
assert(tld.test("https://qualcosa.xxx/") && tld.test("https://sito.porn/video"));
assert(!tld.test("https://www.sussex.ac.uk/") && !tld.test("https://example.com/a.xxx"));
assert(word.test("https://www.freepornsite.net/") && word.test("https://hentaiworld.org"));
assert(!word.test("https://www.wikipedia.org/wiki/Pornografia"), "le pagine che ne parlano non si bloccano");
assert(regex(adult.find((r) => r.id === 10)).test("https://www.google.it/search?q=ciao"));
assert(!regex(adult.find((r) => r.id === 10)).test("https://www.google.com/maps"));
assert.strictEqual(adult.find((r) => r.id === 13).action.requestHeaders[0].header, "YouTube-Restrict");
assert(ads.every((r) => r.action.type === "block"));
assert.deepStrictEqual(ads[0].condition.initiatorDomains, ["youtube.com", "youtube-nocookie.com"]);
assert.deepStrictEqual(
  manifest.declarative_net_request.rule_resources.map((r) => [r.id, r.enabled]),
  [["adult", true], ["ads", true]],
);
for (const f of ["youtube-main.js", "youtube-skip.js", "icon-48.png", "icon-128.png"]) assert(fs.existsSync("extension/" + f), f);
assert(manifest.permissions.includes("scripting"));

// Comandi
let values = {},
  enabled = new Set(["adult", "ads"]),
  scripts = [],
  external,
  internal,
  now = Date.now();
const chrome = {
  declarativeNetRequest: {
    getDynamicRules: async () => [],
    updateDynamicRules: async () => {},
    updateEnabledRulesets: async ({ enableRulesetIds = [], disableRulesetIds = [] }) => {
      enableRulesetIds.forEach((id) => enabled.add(id));
      disableRulesetIds.forEach((id) => enabled.delete(id));
    },
  },
  scripting: {
    getRegisteredContentScripts: async () => scripts.map((id) => ({ id })),
    registerContentScripts: async (list) => scripts.push(...list.map((s) => s.id)),
    unregisterContentScripts: async ({ ids }) => (scripts = scripts.filter((id) => !ids.includes(id))),
  },
  storage: { local: { get: async () => ({ ...values }), set: async (v) => Object.assign(values, v) } },
  alarms: { create: async () => {}, clear: async () => {}, onAlarm: { addListener: () => {} } },
  action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
  runtime: {
    id: "studio-test",
    onMessage: { addListener: (f) => (internal = f) },
    onMessageExternal: { addListener: (f) => (external = f) },
    onStartup: { addListener: () => {} },
    onInstalled: { addListener: () => {} },
  },
};
const FakeDate = class extends Date {
  static now() {
    return now;
  }
};
vm.runInNewContext(fs.readFileSync("extension/background.js", "utf8"), {
  chrome, URL, Date: FakeDate, Error, Number, Array, Set,
  StudioScheduler: require("./extension/scheduler.js"),
  importScripts: () => {},
});
const popup = (message) => new Promise((resolve) => internal(message, { id: "studio-test" }, resolve));
const site = (message) =>
  new Promise((resolve) => {
    if (!external(message, { url: "https://samueleruggeri.altervista.org/" }, resolve)) resolve({ refused: true });
  });

(async () => {
  let s = await popup({ type: "PING" });
  assert(s.adult && s.ads && enabled.has("adult") && enabled.has("ads"));
  assert.deepStrictEqual(scripts.sort(), ["yt-main", "yt-skip"]);

  // Il sito non può spegnere le protezioni
  assert((await site({ type: "ADULT_OFF" })).refused);
  assert((await site({ type: "ADS_SET", on: false })).refused);

  // Spegnere il blocco adulti: resta acceso per un minuto, si può annullare
  s = await popup({ type: "ADULT_OFF" });
  assert(s.adult && s.adultPendingOff === now + 60000);
  now += 30000;
  assert((await popup({ type: "PING" })).adult);
  s = await popup({ type: "ADULT_CANCEL" });
  assert(s.adult && !s.adultPendingOff);
  now += 60000;
  assert((await popup({ type: "PING" })).adult, "annullato: resta acceso");

  await popup({ type: "ADULT_OFF" });
  now += 61000;
  s = await popup({ type: "PING" });
  assert(!s.adult && !enabled.has("adult"));
  s = await popup({ type: "ADULT_ON" });
  assert(s.adult && enabled.has("adult"));

  // Pubblicità di YouTube
  s = await popup({ type: "ADS_SET", on: false });
  assert(!s.ads && !enabled.has("ads") && scripts.length === 0);
  s = await popup({ type: "ADS_SET", on: true });
  assert(s.ads && enabled.has("ads") && scripts.length === 2);

  // Blocco severo: con una sessione di studio attiva la sospensione viene rifiutata
  assert((await site({ type: "START", domains: ["instagram.com"], until: now + 600000 })).strict);
  s = await popup({ type: "SUSPEND" });
  assert(s.ok === false && /sessione di studio/.test(s.error));
  assert(!(values.suspendUntil > now));
  await site({ type: "STOP" });
  s = await popup({ type: "SUSPEND" });
  assert(s.ok && !s.strict);

  console.log("PASS: strict mode during sessions; adult domains and patterns, SafeSearch, YouTube ads, popup-only toggles, one-minute delay.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
