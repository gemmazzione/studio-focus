(function (root) {
  const C =
    typeof module !== "undefined" && module.exports
      ? require("./study-core.js")
      : root.StudyCore;
  function weekStart(date = new Date(), offset = 0) {
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
    return C.localDay(d);
  }
  function addDays(date, n) {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + n);
    return C.localDay(d);
  }
  function build(data, now = new Date()) {
    const S = data.study || {},
      today = C.localDay(now),
      events = [],
      overrides = new Map((S.agendaOverrides || []).map((x) => [x.id, x]));
    for (const exam of S.exams || [])
      for (const row of C.plan(exam, now).rows)
        row.tasks.forEach((t, i) =>
          events.push({
            id: `p_${exam.id}_${t.topicId}_${t.kind}_${row.date}_${i}`,
            source: "plan",
            examId: exam.id,
            topicId: t.topicId,
            kind: t.kind,
            subject: exam.subject,
            title: t.text,
            minutes: t.minutes,
            date: row.date,
            time: "",
            done: false,
          }),
        );
    for (const [source, list, minutes] of [
      ["card", S.cards || [], 5],
      ["error", (S.errors || []).filter((x) => !x.resolved), 10],
      ["review", data.reviews || [], 15],
    ])
      for (const item of list) {
        if (item.due == null) continue; // senza data scelta non entra nel programma
        const dueDate = C.localDay(new Date(item.due));
        events.push({
          id: `${source}_${item.id}_${item.due}`,
          source,
          itemId: item.id,
          kind: "review",
          subject: item.subject,
          title: item.question || item.goal,
          minutes,
          date: dueDate < today ? today : dueDate,
          originalDate: dueDate,
          time: "",
          done: false,
        });
      }
    for (const e of S.agendaEvents || [])
      events.push({
        ...e,
        source: "custom",
        kind: e.type === "study" ? "study" : e.type,
      });
    for (const event of events) {
      const override = overrides.get(event.id);
      if (override) {
        event.date = override.date;
        event.time = override.time || "";
        if (["plan", "custom"].includes(event.source))
          event.done = override.done;
      }
      event.overdue = event.date < today && !event.done;
    }
    return events.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.time || "99:99").localeCompare(b.time || "99:99") ||
        { error: 0, card: 1, review: 2, plan: 3, custom: 4 }[a.source] -
          { error: 0, card: 1, review: 2, plan: 3, custom: 4 }[b.source],
    );
  }
  function conflicts(events, event) {
    if (!event.time) return [];
    const minute = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
    const start = minute(event.time);
    return events.filter(
      (x) =>
        x.id !== event.id &&
        x.date === event.date &&
        x.time &&
        !x.done &&
        minute(x.time) < start + event.minutes &&
        minute(x.time) + x.minutes > start,
    );
  }
  function preserveTopics(previous, rows) {
    return rows.map((row) => {
      const old = previous.find((t) => t.id === row.id);
      return {
        ...row,
        done: !!row.done,
        doneAt: row.done ? old?.doneAt || Date.now() : null,
      };
    });
  }
  const api = { weekStart, addDays, build, conflicts, preserveTopics };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AgendaCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
