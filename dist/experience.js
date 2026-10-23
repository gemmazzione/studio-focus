"use strict";
(() => {
  const SOUND_KEY = "studio.sound.v1";
  let prefs = { enabled: true, kind: "bell", volume: 50 };
  try {
    Object.assign(prefs, JSON.parse(localStorage.getItem(SOUND_KEY)) || {});
  } catch {}
  let audio = null;
  const byId = (id) => document.getElementById(id);
  const status = (text) => {
    byId("audio-status").textContent = text;
  };
  byId("sound-enabled").checked = !!prefs.enabled;
  byId("sound-kind").value = ["bell", "pulse", "wood"].includes(prefs.kind)
    ? prefs.kind
    : "bell";
  byId("sound-volume").value = Math.max(
    0,
    Math.min(100, Number(prefs.volume) || 0),
  );
  byId("volume-value").value = byId("sound-volume").value + "%";
  if (!prefs.enabled) status("Avvisi sonori disattivati.");
  function persist() {
    prefs = {
      enabled: byId("sound-enabled").checked,
      kind: byId("sound-kind").value,
      volume: Number(byId("sound-volume").value),
    };
    byId("volume-value").value = prefs.volume + "%";
    try {
      localStorage.setItem(SOUND_KEY, JSON.stringify(prefs));
    } catch {}
    status(
      prefs.enabled
        ? "Suona a fine studio e a fine pausa."
        : "Avvisi sonori disattivati.",
    );
  }
  async function unlock() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw Error("unsupported");
      if (!audio) audio = new Audio();
      if (audio.state !== "running") await audio.resume();
      return audio.state === "running";
    } catch {
      status("Audio non disponibile. Controlla le impostazioni del browser.");
      return false;
    }
  }
  function tone(frequency, start, length, type, volume) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (prefs.kind === "wood")
      oscillator.frequency.exponentialRampToValueAtTime(
        frequency * 0.45,
        start + length,
      );
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, volume),
      start + 0.015,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + length + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  async function ring(test = false) {
    if (!test && !prefs.enabled) return;
    if (!(await unlock())) return;
    const v = Math.max(0, Math.min(1, prefs.volume / 100)) * 0.22;
    const start = audio.currentTime + 0.04;
    if (prefs.kind === "wood")
      [0, 0.26, 0.52].forEach((t) => tone(440, start + t, 0.16, "triangle", v));
    else if (prefs.kind === "pulse")
      [523.25, 659.25, 783.99].forEach((f, i) =>
        tone(f, start + i * 0.24, 0.75, "sine", v),
      );
    else {
      [0, 0.65].forEach((t) => {
        tone(659.25, start + t, 1.8, "sine", v);
        tone(1318.5, start + t, 1.1, "sine", v * 0.25);
      });
    }
    status(
      prefs.volume
        ? test
          ? "Avviso di prova in riproduzione."
          : "Tempo concluso. Un passo avanti."
        : "Volume a zero: alzalo per sentire l’avviso.",
    );
  }
  ["sound-enabled", "sound-kind", "sound-volume"].forEach((id) =>
    byId(id).addEventListener("input", persist),
  );
  byId("sound-test").addEventListener("click", () => ring(true));
  document.addEventListener(
    "pointerdown",
    () => {
      if (prefs.enabled) unlock();
    },
    { once: true },
  );
  document.addEventListener(
    "keydown",
    () => {
      if (prefs.enabled) unlock();
    },
    { once: true },
  );
  byId("setup").addEventListener("submit", () => {
    if (prefs.enabled) unlock();
  });
  window.addEventListener("studio:alarm", () => {
    ring();
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document
        .querySelector(".workpanel")
        .animate(
          [
            { boxShadow: "inset 0 0 0 2px #2346c8" },
            { boxShadow: "inset 0 0 0 1px transparent" },
          ],
          { duration: 1800, iterations: 2 },
        );
    }
  });
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const observer = new MutationObserver(() => {
    document.body.classList.toggle(
      "timer-paused",
      !byId("session").hidden && byId("pause").textContent === "Riprendi",
    );
    if (!byId("recall").hidden) document.title = "Verifica · Studio";
    else if (byId("setup").hidden)
      document.title = `${byId("timer").textContent} · Studio`;
    else document.title = "Studio";
  });
  observer.observe(byId("timer"), { childList: true });
  observer.observe(byId("pause"), { childList: true });
  function enter() {
    if (reduced.matches) return;
    const current = document.querySelector(".page:not([hidden])");
    if (current)
      current.animate(
        [
          { opacity: 0.4 },
          { opacity: 1 },
        ],
        { duration: 180, easing: "ease-out" },
      );
  }
  window.addEventListener("hashchange", enter);
  window.addEventListener("studio:saved", () => {
    queueMicrotask(() => {
      document.title = !byId("recall").hidden
        ? "Richiamo attivo · Studio"
        : byId("setup").hidden
          ? `${byId("timer").textContent} · Studio`
          : "Studio — una cosa alla volta";
    });
  });
  document.addEventListener("visibilitychange", () => {
    document.body.classList.toggle("page-sleeping", document.hidden);
  });
  enter();
})();
