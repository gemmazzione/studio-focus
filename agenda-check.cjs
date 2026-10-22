const assert = require("assert"),
  C = require("./dist/study-core.js"),
  A = require("./dist/agenda-core.js");
assert.equal(A.weekStart(new Date("2026-10-25T12:00:00")), "2026-10-19");
assert.equal(A.weekStart(new Date("2026-10-26T12:00:00")), "2026-10-26");
assert.equal(A.addDays("2026-10-24", 2), "2026-10-26");
assert.equal(A.addDays("2026-12-31", 1), "2027-01-01");
const now = new Date("2026-10-23T12:00:00"),
  d = {
    sessions: [],
    reviews: [],
    thoughts: [],
    active: null,
    settings: { domains: ["instagram.com"], blockBreak: true },
    study: {
      exams: [],
      cards: [
        {
          id: "c1",
          subject: "Bio",
          question: "Dove?",
          solution: "Qui",
          due: new Date("2026-10-20T12:00:00").getTime(),
          interval: 1,
          count: 0,
        },
      ],
      errors: [],
      schedules: [],
      logs: [],
      seenSessions: [],
      agendaEvents: [
        {
          id: "e1",
          subject: "Math",
          title: "Esercizi",
          date: "2026-10-23",
          time: "09:00",
          minutes: 40,
          type: "study",
          done: false,
        },
      ],
      agendaOverrides: [],
      drafts: { "card-form:card-question": "Domanda da finire" },
    },
  };
let events = A.build(d, now);
assert.equal(events.find((e) => e.source === "card").date, "2026-10-23");
assert.equal(
  events.find((e) => e.source === "card").originalDate,
  "2026-10-20",
);
const cardId = events.find((e) => e.source === "card").id;
d.study.agendaOverrides.push({
  id: cardId,
  date: "2026-10-26",
  time: "10:00",
  done: false,
});
events = A.build(d, now);
assert.equal(events.find((e) => e.source === "card").date, "2026-10-26");
assert.equal(
  A.conflicts(events, {
    id: "another",
    date: "2026-10-23",
    time: "09:20",
    minutes: 30,
  }).length,
  1,
);
assert.equal(
  A.conflicts(events, {
    id: "another",
    date: "2026-10-23",
    time: "09:40",
    minutes: 30,
  }).length,
  0,
);
d.study.cards[0].due = new Date("2026-10-27T12:00:00").getTime();
assert.equal(
  A.build(d, now).find((e) => e.source === "card").date,
  "2026-10-27",
  "Old move does not affect next retrieval cycle",
);
const updated = A.preserveTopics(
  [{ id: "t1", done: true, doneAt: 123 }],
  [
    { id: "t1", text: "Renamed", minutes: 90, done: true },
    { id: "t2", text: "New", minutes: 60, done: false },
  ],
);
assert.equal(updated[0].id, "t1");
assert.equal(updated[0].doneAt, 123);
assert.equal(updated[1].doneAt, null);
d.study.logs.push({
  id: "log",
  at: 123,
  itemId: "c1",
  kind: "card",
  answer: "Answer",
  rating: "easy",
  subject: "Bio",
  question: "Old question",
  solution: "Old solution",
});
d.study.cards[0].examId = "exam";
d.study.cards[0].topicId = "topic";
const imported = C.validateBackup({
  format: "studio.backup",
  version: 4,
  data: d,
});
assert.equal(
  imported.data.study.drafts["card-form:card-question"],
  "Domanda da finire",
);
assert.equal(imported.data.study.agendaEvents.length, 1);
assert.equal(imported.data.study.logs[0].solution, "Old solution");
assert.equal(imported.data.study.cards[0].topicId, "topic");
assert.equal(
  C.validateBackup({ format: "studio.backup", version: 3, data: d }).data
    .sessions.length,
  0,
);
assert.throws(() =>
  C.validateBackup({
    ...d,
    study: {
      ...d.study,
      agendaEvents: [{ ...d.study.agendaEvents[0], time: "29:00" }],
    },
  }),
);
console.log(
  "PASS: Monday weeks, DST-safe days, overdue queue, move isolation, overlaps, topic identity, v3/v4 backup roundtrip, drafts and history snapshots.",
);
