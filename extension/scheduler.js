(function (root) {
  function validDomains(domains) {
    return (
      Array.isArray(domains) &&
      domains.length <= 100 &&
      domains.every(
        (s) =>
          typeof s === "string" &&
          /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(s) &&
          !s.endsWith("chatgpt.site"),
      )
    );
  }
  function validSchedules(schedules) {
    return (
      Array.isArray(schedules) &&
      schedules.length <= 30 &&
      schedules.every(
        (s) =>
          s &&
          typeof s.id === "string" &&
          /^[a-zA-Z0-9_-]{1,128}$/.test(s.id) &&
          typeof s.enabled === "boolean" &&
          Array.isArray(s.days) &&
          s.days.length > 0 &&
          s.days.length <= 7 &&
          s.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
          /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s.start) &&
          /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s.end) &&
          s.start !== s.end,
      )
    );
  }
  function windows(schedules, now = Date.now()) {
    const result = [];
    for (const s of schedules || []) {
      if (!s.enabled) continue;
      for (let offset = -1; offset <= 8; offset++) {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() + offset);
        if (!s.days.includes(start.getDay())) continue;
        const [h, m] = s.start.split(":").map(Number),
          [eh, em] = s.end.split(":").map(Number);
        start.setHours(h, m, 0, 0);
        const end = new Date(start);
        end.setHours(eh, em, 0, 0);
        if (s.end < s.start) end.setDate(end.getDate() + 1);
        result.push({ start: start.getTime(), end: end.getTime() });
      }
    }
    return result;
  }
  function state(values, now = Date.now()) {
    const slots = windows(values.schedules, now),
      manual = values.manualUntil > now,
      active = slots.filter((w) => w.start <= now && w.end > now),
      suspended = values.suspendUntil > now;
    const domains = suspended
      ? []
      : [
          ...new Set([
            ...(manual ? values.manualDomains || [] : []),
            ...(active.length ? values.scheduleDomains || [] : []),
          ]),
        ];
    const boundaries = slots
      .flatMap((w) => [w.start, w.end])
      .filter((t) => t > now);
    if (manual) boundaries.push(values.manualUntil);
    if (suspended) boundaries.push(values.suspendUntil);
    return {
      domains,
      until: domains.length
        ? Math.max(manual ? values.manualUntil : 0, ...active.map((w) => w.end))
        : 0,
      next: boundaries.length ? Math.min(...boundaries) : 0,
      scheduled: !!active.length,
      suspended,
    };
  }
  const api = { validDomains, validSchedules, windows, state };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.StudioScheduler = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
