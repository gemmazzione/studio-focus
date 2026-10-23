(function (root) {
  "use strict";
  const fail = () => {
    throw Error(
      "Backup non valido o non compatibile. Nessun dato è stato modificato.",
    );
  };
  const str = (v, max = 10000) =>
    typeof v === "string" && v.length <= max ? v : fail();
  const num = (v, max = 1e14) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max
      ? v
      : fail();
  const id = (v) => (/^[a-zA-Z0-9_-]{1,128}$/.test(str(v, 128)) ? v : fail());
  const arr = (v, fn, max = 20000) =>
    Array.isArray(v) && v.length <= max ? v.map(fn) : fail();
  const grade = (v) => (["hard", "medium", "easy"].includes(v) ? v : fail());
  const day = (v) =>
    /^\d{4}-\d{2}-\d{2}$/.test(str(v, 10)) &&
    !isNaN(new Date(v + "T12:00:00").getTime()) &&
    localDay(new Date(v + "T12:00:00")) === v
      ? v
      : fail();
  const domain = (v) =>
    /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(str(v, 253)) &&
    !v.endsWith("chatgpt.site") &&
    !v.endsWith("github.io") &&
    !v.endsWith("samueleruggeri.altervista.org")
      ? v
      : fail();
  function validateSchedule(s) {
    const time = (v) =>
      /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(str(v, 5)) ? v : fail();
    const days = arr(
      s.days,
      (d) => (Number.isInteger(d) && d >= 0 && d <= 6 ? d : fail()),
      7,
    );
    if (!days.length || s.start === s.end || typeof s.enabled !== "boolean")
      fail();
    return {
      id: id(s.id),
      days: [...new Set(days)],
      start: time(s.start),
      end: time(s.end),
      enabled: s.enabled,
    };
  }
  function validateBackup(raw) {
    const d =
      raw?.format === "studio.backup"
        ? [3, 4].includes(raw.version)
          ? raw.data
          : fail()
        : raw;
    if (!d || typeof d !== "object" || !d.settings) fail();
    const sessions = arr(d.sessions, (s) => ({
      id: id(s.id),
      at: num(s.at),
      subject: str(s.subject, 80),
      goal: str(s.goal, 220),
      answer: str(s.answer),
      correction: str(s.correction || ""),
      rating: grade(s.rating),
      seconds: num(s.seconds, 604800),
      reviewId: s.reviewId ? id(s.reviewId) : null,
    }));
    const reviews = arr(d.reviews, (r) => ({
      id: id(r.id),
      subject: str(r.subject, 80),
      goal: str(r.goal, 220),
      interval: num(r.interval, 180),
      count: num(r.count || 0, 100000),
      rating: grade(r.rating),
      due: r.due == null ? null : num(r.due),
    }));
    const thoughts = arr(d.thoughts, (t) => ({
      id: id(t.id),
      text: str(t.text, 300),
    }));
    const settings = {
      domains: arr(d.settings.domains, domain, 100),
      blockBreak: !!d.settings.blockBreak,
      extensionId: "",
    };
    const s = d.study || {};
    const study = {
      exams: arr(
        s.exams || [],
        (e) => ({
          id: id(e.id),
          subject: str(e.subject, 80),
          date: day(e.date),
          minutes: num(e.minutes, 480),
          // I piani creati prima della v5 avevano sempre i ripassi
          reviews: e.reviews == null ? true : !!e.reviews,
          days: arr(
            e.days,
            (v) => (Number.isInteger(v) && v >= 0 && v <= 6 ? v : fail()),
            7,
          ),
          topics: arr(
            e.topics,
            (t) => ({
              id: id(t.id),
              text: str(t.text, 220),
              minutes: num(t.minutes, 10000),
              done: !!t.done,
              doneAt: t.doneAt == null ? null : num(t.doneAt),
              note: t.note == null ? "" : str(t.note, 5000),
            }),
            1000,
          ),
        }),
        100,
      ),
      cards: arr(s.cards || [], (c) => ({
        id: id(c.id),
        subject: str(c.subject, 80),
        question: str(c.question, 1000),
        solution: str(c.solution),
        due: c.due == null ? null : num(c.due),
        interval: num(c.interval, 180),
        count: num(c.count || 0, 100000),
        examId: c.examId ? id(c.examId) : null,
        topicId: c.topicId ? id(c.topicId) : null,
      })),
      errors: arr(s.errors || [], (e) => ({
        id: id(e.id),
        sourceId: id(e.sourceId),
        subject: str(e.subject, 80),
        question: str(e.question, 1000),
        solution: str(e.solution),
        due: e.due == null ? null : num(e.due),
        interval: num(e.interval || 1, 180),
        count: num(e.count || 0, 100000),
        resolved: !!e.resolved,
      })),
      schedules: arr(s.schedules || [], validateSchedule, 30),
      logs: arr(s.logs || [], (l) => ({
        id: id(l.id),
        at: num(l.at),
        itemId: id(l.itemId),
        kind: ["card", "error"].includes(l.kind) ? l.kind : fail(),
        answer: str(l.answer),
        rating: grade(l.rating),
        subject: l.subject == null ? null : str(l.subject, 80),
        question: l.question == null ? null : str(l.question, 1000),
        solution: l.solution == null ? null : str(l.solution),
      })),
      seenSessions: arr(s.seenSessions || [], id),
      agendaEvents: arr(
        s.agendaEvents || [],
        (e) => ({
          id: id(e.id),
          subject: str(e.subject, 80),
          title: str(e.title, 220),
          date: day(e.date),
          time:
            e.time === ""
              ? ""
              : /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(str(e.time, 5))
                ? e.time
                : fail(),
          minutes: num(e.minutes, 480),
          type: ["study", "break", "commitment"].includes(e.type)
            ? e.type
            : fail(),
          done: !!e.done,
        }),
        2000,
      ),
      agendaOverrides: arr(
        s.agendaOverrides || [],
        (e) => ({
          id: id(e.id),
          date: day(e.date),
          time:
            e.time === ""
              ? ""
              : /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(str(e.time, 5))
                ? e.time
                : fail(),
          done: !!e.done,
        }),
        10000,
      ),
      goals: {
        weekly: {
          minutes: num(s.goals?.weekly?.minutes || 0, 10000),
          sessions: num(s.goals?.weekly?.sessions || 0, 500),
          recalls: num(s.goals?.weekly?.recalls || 0, 5000),
        },
        items: arr(
          s.goals?.items || [],
          (g) => ({
            id: id(g.id),
            text: str(g.text, 220),
            due: g.due ? day(g.due) : null,
            done: !!g.done,
            doneAt: g.doneAt == null ? null : num(g.doneAt),
          }),
          500,
        ),
      },
      examRuns: arr(
        s.examRuns || [],
        (r) => ({
          id: id(r.id),
          at: num(r.at),
          subject: str(r.subject, 80),
          total: num(r.total, 1000),
          score: num(r.score, 1000),
          seconds: num(r.seconds, 86400),
        }),
        500,
      ),
      achievements: Object.fromEntries(
        Object.entries(s.achievements || {}).map(([key, value]) => {
          if (!/^[a-z0-9-]{1,40}$/.test(key)) fail();
          return [key, num(value)];
        }),
      ),
      drafts: Object.fromEntries(
        Object.entries(s.drafts || {}).map(([key, value]) => {
          if (!/^[a-zA-Z0-9:_-]{1,200}$/.test(key)) fail();
          return [key, typeof value === "boolean" ? value : str(value, 20000)];
        }),
      ),
    };
    for (const list of [
      sessions,
      reviews,
      thoughts,
      study.exams,
      study.cards,
      study.errors,
      study.schedules,
      study.logs,
      study.agendaEvents,
      study.agendaOverrides,
      study.goals.items,
      study.examRuns,
    ])
      if (new Set(list.map((x) => x.id)).size !== list.length) fail();
    let sound = null;
    if (raw?.sound) {
      const p = raw.sound;
      if (
        typeof p.enabled !== "boolean" ||
        !["bell", "pulse", "wood"].includes(p.kind)
      )
        fail();
      sound = { enabled: p.enabled, kind: p.kind, volume: num(p.volume, 100) };
    }
    return {
      data: { sessions, reviews, thoughts, settings, active: null, study },
      sound,
    };
  }
  function localDay(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function plan(exam, now = new Date()) {
    const start = new Date(now);
    start.setHours(12, 0, 0, 0);
    const end = new Date(exam.date + "T12:00:00");
    const dates = [];
    for (
      let d = new Date(start), i = 0;
      d < end && i < 730;
      d.setDate(d.getDate() + 1), i++
    )
      if (exam.days.includes(d.getDay())) dates.push(localDay(d));
    const pending = exam.topics
      .filter((t) => !t.done)
      .map((t) => ({ ...t, left: t.minutes }));
    const total = pending.reduce((n, t) => n + t.minutes, 0),
      capacity = dates.length * exam.minutes;
    const daily = Math.min(
      exam.minutes,
      Math.ceil(total / Math.max(1, dates.length - 1)),
    );
    const rows = [];
    let index = 0;
    for (const date of dates) {
      let left = daily;
      const tasks = [];
      while (left > 0 && index < pending.length) {
        const t = pending[index],
          minutes = Math.min(left, t.left, 90);
        if (minutes > 0)
          tasks.push({ topicId: t.id, text: t.text, minutes, kind: "study" });
        left -= minutes;
        t.left -= minutes;
        if (t.left <= 0) index++;
      }
      if (tasks.length) rows.push({ date, tasks });
    }
    let reviewMissed = 0;
    // Ripassi nel piano solo se l’utente li ha chiesti (exam.reviews)
    for (const topic of exam.reviews === false ? [] : exam.topics) {
      const remainder = pending.find((t) => t.id === topic.id);
      if (!topic.done && remainder?.left > 0) continue;
      const studyDays = rows.filter((r) =>
        r.tasks.some((t) => t.topicId === topic.id && t.kind === "study"),
      );
      const last = studyDays.length
        ? studyDays[studyDays.length - 1].date
        : localDay(new Date(topic.doneAt || now));
      const earliest = new Date(last + "T12:00:00");
      earliest.setDate(earliest.getDate() + 1);
      const reviewMinutes = Math.min(
        exam.minutes,
        15,
        Math.max(5, Math.ceil(topic.minutes * 0.1)),
      );
      const date = dates.find(
        (date) =>
          date >= localDay(earliest) &&
          (rows
            .find((r) => r.date === date)
            ?.tasks.reduce((n, t) => n + t.minutes, 0) || 0) +
            reviewMinutes <=
            exam.minutes,
      );
      if (!date) {
        reviewMissed++;
        continue;
      }
      let row = rows.find((r) => r.date === date);
      if (!row) {
        row = { date, tasks: [] };
        rows.push(row);
      }
      row.tasks.push({
        topicId: topic.id,
        text: topic.text,
        minutes: reviewMinutes,
        kind: "review",
      });
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    return {
      rows,
      reviewMissed,
      total,
      capacity,
      overflow: Math.max(0, total - capacity),
      expired: end <= start,
    };
  }
  function nextInterval(previous, rating) {
    return rating === "hard"
      ? 1
      : Math.min(
          180,
          Math.max(
            2,
            Math.round((previous || 1) * (rating === "easy" ? 2.5 : 1.5)),
          ),
        );
  }
  // Unione per ID: gli elementi di old restano, da incoming arrivano solo quelli nuovi.
  function mergeData(old, incoming) {
    const merged = {
      ...old,
      active: null,
      settings: {
        ...old.settings,
        ...incoming.settings,
        extensionId: old.settings.extensionId,
      },
      study: {},
    };
    for (const key of ["sessions", "reviews", "thoughts"]) {
      const map = new Map(old[key].map((x) => [x.id, x]));
      for (const x of incoming[key]) if (!map.has(x.id)) map.set(x.id, x);
      merged[key] = [...map.values()];
    }
    for (const key of [
      "exams",
      "cards",
      "errors",
      "schedules",
      "logs",
      "agendaEvents",
      "agendaOverrides",
    ]) {
      const map = new Map(old.study[key].map((x) => [x.id, x]));
      for (const x of incoming.study[key]) if (!map.has(x.id)) map.set(x.id, x);
      merged.study[key] = [...map.values()];
    }
    merged.study.drafts = { ...incoming.study.drafts, ...old.study.drafts };
    const og = old.study.goals || { weekly: {}, items: [] },
      ig = incoming.study.goals || { weekly: {}, items: [] },
      goalMap = new Map(og.items.map((x) => [x.id, x]));
    for (const x of ig.items) if (!goalMap.has(x.id)) goalMap.set(x.id, x);
    merged.study.goals = {
      weekly: Object.values(og.weekly).some(Boolean) ? og.weekly : ig.weekly,
      items: [...goalMap.values()],
    };
    const runs = new Map((old.study.examRuns || []).map((x) => [x.id, x]));
    for (const x of incoming.study.examRuns || []) if (!runs.has(x.id)) runs.set(x.id, x);
    merged.study.examRuns = [...runs.values()];
    // Traguardi: vale la data di sblocco più vecchia
    merged.study.achievements = { ...(incoming.study.achievements || {}) };
    for (const [key, at] of Object.entries(old.study.achievements || {}))
      merged.study.achievements[key] = Math.min(at, merged.study.achievements[key] ?? at);
    merged.study.seenSessions = [
      ...new Set([...old.study.seenSessions, ...incoming.study.seenSessions]),
    ];
    if (merged.study.schedules.length > 30)
      throw Error("L’unione supera il limite di 30 fasce orarie.");
    return merged;
  }
  // Un elemento è da ripassare solo se ha una data scelta e la data è arrivata
  const isDue = (item, now = Date.now()) => item.due != null && item.due <= now;
  // Data del prossimo ripasso dalla scelta del modulo: giorni, "date" con data, 0 = nessuno
  function nextDue(choice, dateValue, now = Date.now()) {
    if (choice === "date") {
      const t = new Date(dateValue + "T09:00:00").getTime();
      return Number.isFinite(t) && t > now ? t : null;
    }
    const days = Number(choice);
    return days > 0 ? now + days * 86400000 : null;
  }
  const api = {
    validateBackup,
    isDue,
    nextDue,
    mergeData,
    validateSchedule,
    plan,
    localDay,
    nextInterval,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.StudyCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
