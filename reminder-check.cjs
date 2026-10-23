// Test del promemoria in sw.js con API del browser simulate.
const fs = require("fs");
const assert = require("assert");
const vm = require("vm");

function load(permission) {
  const store = new Map(),
    shown = [],
    listeners = {};
  const cache = {
    match: async (k) => (store.has(k) ? { json: async () => JSON.parse(store.get(k)) } : undefined),
    put: async (k, res) => store.set(k, res.body),
    addAll: async () => {},
  };
  const ctx = {
    self: {
      addEventListener: (type, fn) => (listeners[type] = fn),
      registration: { scope: "https://x/", showNotification: async (title, o) => shown.push([title, o]) },
      clients: {},
    },
    caches: { open: async () => cache, keys: async () => [] },
    Notification: { permission },
    Response: class {
      constructor(body) {
        this.body = body;
      }
    },
    location: { origin: "https://x" },
    URL,
    fetch: async () => {},
  };
  ctx.self.self = ctx.self;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/dist/sw.js", "utf8") + "\nthis.maybeNotify = maybeNotify;", ctx);
  return { ctx, store, shown };
}
const day = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

(async () => {
  const now = Date.now();
  // Ora già passata, un ripasso scaduto e uno futuro: una notifica, poi più nessuna oggi
  let t = load("granted");
  t.store.set("reminder-state.json", JSON.stringify({ enabled: true, time: "00:00", dues: [now - 1000, now + 86400000], lastShown: null }));
  assert.strictEqual(await t.ctx.maybeNotify(), true);
  assert.match(t.shown[0][1].body, /1 ripasso/);
  assert.strictEqual(JSON.parse(t.store.get("reminder-state.json")).lastShown, day(new Date()));
  assert.strictEqual(await t.ctx.maybeNotify(), false);
  assert.strictEqual(t.shown.length, 1);

  // Ora non ancora arrivata
  t = load("granted");
  t.store.set("reminder-state.json", JSON.stringify({ enabled: true, time: "23:59", dues: [now - 1000], lastShown: null }));
  if (new Date().getHours() * 60 + new Date().getMinutes() < 23 * 60 + 59) assert.strictEqual(await t.ctx.maybeNotify(), false);

  // Disattivato, senza permesso o senza ripassi scaduti: niente
  for (const [perm, state] of [
    ["granted", { enabled: false, time: "00:00", dues: [now - 1000] }],
    ["denied", { enabled: true, time: "00:00", dues: [now - 1000] }],
    ["granted", { enabled: true, time: "00:00", dues: [now + 60000] }],
  ]) {
    t = load(perm);
    t.store.set("reminder-state.json", JSON.stringify(state));
    assert.strictEqual(await t.ctx.maybeNotify(), false);
  }
  // Obiettivo settimanale indietro (solo da giovedì) senza ripassi scaduti
  const ws = new Date();
  ws.setHours(0, 0, 0, 0);
  ws.setDate(ws.getDate() - ((ws.getDay() + 6) % 7));
  const weekday = (new Date().getDay() + 6) % 7;
  t = load("granted");
  t.store.set("reminder-state.json", JSON.stringify({ enabled: true, time: "00:00", dues: [], weekly: { weekStart: ws.getTime(), target: 700, done: 0 }, lastShown: null }));
  assert.strictEqual(await t.ctx.maybeNotify(), weekday >= 3);
  if (weekday >= 3) assert.match(t.shown[0][1].body, /0 di 700 minuti/);
  // Obiettivo raggiunto: nessun avviso
  t = load("granted");
  t.store.set("reminder-state.json", JSON.stringify({ enabled: true, time: "00:00", dues: [], weekly: { weekStart: ws.getTime(), target: 70, done: 70 }, lastShown: null }));
  assert.strictEqual(await t.ctx.maybeNotify(), false);
  console.log("PASS: reminder time, once a day, disabled, permission, nothing due, weekly goal.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
