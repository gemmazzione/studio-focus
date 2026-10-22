const assert = require("assert"),
  C = require("./dist/study-core.js"),
  Scheduler = require("./extension/scheduler.js");
const exam = {
  date: "2026-10-30",
  minutes: 60,
  days: [1, 2, 3, 4, 5],
  topics: [
    { id: "a", text: "Derivate", minutes: 90, done: false },
    { id: "b", text: "Integrali", minutes: 120, done: false },
  ],
};
let p = C.plan(exam, new Date("2026-10-23T12:00:00"));
assert.equal(p.total, 210);
assert.equal(
  p.rows
    .flatMap((r) => r.tasks)
    .filter((t) => t.kind === "study")
    .reduce((n, t) => n + t.minutes, 0),
  210,
);
assert(p.rows.every((r) => r.tasks.reduce((n, t) => n + t.minutes, 0) <= 60));
assert(p.rows.every((r) => r.date < "2026-10-30"));
assert(
  p.rows.some((r) => r.tasks.some((t) => t.kind === "review")),
  "Plan includes later recall blocks",
);
for (const row of p.rows)
  for (const task of row.tasks.filter((t) => t.kind === "review"))
    assert(
      p.rows
        .filter((r) =>
          r.tasks.some((t) => t.topicId === task.topicId && t.kind === "study"),
        )
        .every((r) => r.date < row.date),
      "Review comes after study",
    );
p = C.plan({ ...exam, minutes: 10 }, new Date("2026-10-23T12:00:00"));
assert(p.overflow > 0);
p = C.plan({ ...exam, days: [] }, new Date("2026-10-23T12:00:00"));
assert.equal(p.overflow, 210);
assert.equal(C.nextInterval(6, "hard"), 1);
assert.equal(C.nextInterval(6, "easy"), 15);
const original = {
  sessions: [],
  reviews: [],
  thoughts: [],
  settings: { domains: ["instagram.com"], blockBreak: true, extensionId: "x" },
  active: { phase: "focus" },
};
const restored = C.validateBackup(original);
assert.equal(restored.data.active, null);
assert.equal(restored.data.settings.extensionId, "");
assert.deepEqual(restored.data.study.cards, []);
assert.throws(() =>
  C.validateBackup({
    ...original,
    thoughts: [{ id: '" onclick="evil', text: "x" }],
  }),
);
assert.throws(() =>
  C.validateBackup({
    ...original,
    settings: { domains: ["https://instagram.com"], blockBreak: true },
  }),
);
assert.throws(() =>
  C.validateBackup({ format: "studio.backup", version: 99, data: original }),
);
assert.throws(() =>
  C.validateBackup({ ...original, sessions: [{ id: "ok", at: NaN }] }),
);
const schedule = {
  id: "one",
  days: [5],
  start: "23:00",
  end: "01:00",
  enabled: true,
};
assert(Scheduler.validSchedules([schedule]));
let at = new Date("2026-10-24T00:30:00").getTime();
let state = Scheduler.state(
  { schedules: [schedule], scheduleDomains: ["instagram.com"] },
  at,
);
assert(state.scheduled);
assert.deepEqual(state.domains, ["instagram.com"]);
assert.equal(new Date(state.until).getHours(), 1);
state = Scheduler.state(
  {
    schedules: [schedule],
    scheduleDomains: ["instagram.com"],
    manualUntil: at + 60000,
    manualDomains: ["tiktok.com"],
  },
  at,
);
assert.equal(state.domains.length, 2);
state = Scheduler.state(
  {
    schedules: [schedule],
    scheduleDomains: ["instagram.com"],
    suspendUntil: at + 60000,
  },
  at,
);
assert.equal(state.domains.length, 0);
assert(state.next > at);
assert(!Scheduler.validSchedules([{ ...schedule, start: "25:00" }]));
assert(!Scheduler.validSchedules([{ ...schedule, end: "23:00" }]));
assert(!Scheduler.validDomains(["chatgpt.site"]));
console.log(
  "PASS: exam capacity/distribution, legacy backups, unsafe imports, intervals, overnight schedules, overlap, suspension.",
);
