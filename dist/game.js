// Livelli e punti esperienza (XP): scheda giocatore nella barra laterale, "+XP" a fine
// sessione, schermata quando si sale di livello e sezione "Il tuo livello" in Obiettivi.
// Gli XP si calcolano dai dati (StudyCore.xpFor), quindi valgono anche per lo storico.
(() => {
  "use strict";
  const byId = (id) => document.getElementById(id),
    reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  function myXP() {
    const minutes = data.sessions.reduce((n, s) => n + Math.round((s.seconds || 0) / 60), 0),
      achievements = Object.keys(data.study?.achievements || {}).length;
    return StudyCore.xpFor(minutes, data.sessions.length, achievements);
  }
  const fmt = (n) => n.toLocaleString("it-IT");

  // --- Scheda giocatore ------------------------------------------------------
  document.querySelector("aside .brand").insertAdjacentHTML(
    "afterend",
    `<a href="#goals" class="player" id="player" aria-label="Il tuo livello">
      <span class="lvl-badge" id="player-level">1</span>
      <span class="player-info"><b id="player-title">Principiante</b><span class="xp-bar"><i id="player-bar"></i></span><small id="player-xp">0 / 100 XP</small></span>
      <span class="xp-float" id="xp-float" aria-hidden="true"></span>
    </a>`,
  );
  // Sezione in Obiettivi
  byId("page-goals")
    .querySelector(".heading")
    .insertAdjacentHTML(
      "afterend",
      `<section class="level-card" aria-labelledby="level-title">
        <span class="lvl-badge big" id="level-badge">1</span>
        <div><p class="meta">Il tuo livello</p><h2 id="level-title">Livello 1 · Principiante</h2>
        <div class="xp-bar big"><i id="level-bar"></i></div>
        <p id="level-xp" class="meta"></p>
        <p class="hint">Guadagni 1 XP per ogni minuto di studio, 10 XP per ogni sessione completata e 50 XP per ogni traguardo. Ogni 3 livelli cambia il titolo.</p>
        <p id="level-next" class="hint"></p></div>
      </section>`,
    );
  // Punti in palio durante la sessione
  byId("time-fill")
    .closest(".time-track")
    .insertAdjacentHTML("afterend", '<p class="xp-stake" id="xp-stake" hidden></p>');

  function renderPlayer() {
    const l = StudyCore.levelFor(myXP()),
      pct = Math.round((l.into / l.needed) * 100);
    byId("player-level").textContent = l.level;
    byId("player-title").textContent = l.title;
    byId("player-bar").style.width = pct + "%";
    byId("player-xp").textContent = `${fmt(l.into)} / ${fmt(l.needed)} XP`;
    byId("player").setAttribute("aria-label", `Livello ${l.level}, ${l.title}: ${l.into} XP su ${l.needed} per il prossimo livello`);
    byId("level-badge").textContent = l.level;
    byId("level-title").textContent = `Livello ${l.level} · ${l.title}`;
    byId("level-bar").style.width = pct + "%";
    byId("level-xp").textContent = `${fmt(l.xp)} XP in tutto · mancano ${fmt(l.end - l.xp)} XP al livello ${l.level + 1}`;
    const nextTitle = StudyCore.TITLES[Math.floor((l.level - 1) / 3) + 1];
    byId("level-next").textContent = nextTitle
      ? `Al livello ${Math.floor((l.level - 1) / 3) * 3 + 4} diventi ${nextTitle}.`
      : "Hai il titolo più alto. Continua a salire di livello.";
    const a = data.active,
      stake = byId("xp-stake");
    stake.hidden = !(a && a.phase === "focus");
    if (!stake.hidden) stake.textContent = `In palio: ${Math.round(a.total / 60000) + 10} XP`;
    return l;
  }

  // --- "+XP" e salita di livello ---------------------------------------------
  let last = renderPlayer(),
    pending = 0,
    timer = null;
  function floatXP(n) {
    const el = byId("xp-float");
    el.textContent = `+${n} XP`;
    el.classList.remove("show");
    void el.offsetWidth; // riavvia l'animazione
    el.classList.add("show");
  }
  function levelUp(l) {
    const confetti = reduced()
      ? ""
      : Array.from({ length: 28 }, (_, i) => `<i style="--x:${Math.round(Math.random() * 100)}%;--d:${(Math.random() * 0.6).toFixed(2)}s;--r:${Math.round(Math.random() * 360)}deg;--c:${i % 4}"></i>`).join("");
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div class="levelup" id="levelup" role="dialog" aria-modal="true" aria-labelledby="levelup-title"><div class="confetti" aria-hidden="true">${confetti}</div><div class="levelup-box"><p class="meta">Nuovo livello</p><span class="lvl-badge huge">${l.level}</span><h2 id="levelup-title">Livello ${l.level}</h2><p>Sei ${l.title}. ${l.level % 3 === 1 ? "Hai un titolo nuovo!" : "Continua così."}</p><button type="button" class="primary" id="levelup-close">Continua</button></div></div>`,
    );
    const close = () => byId("levelup")?.remove();
    byId("levelup-close").onclick = close;
    byId("levelup").onclick = (e) => e.target.id === "levelup" && close();
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") {
        close();
        document.removeEventListener("keydown", esc);
      }
    });
    byId("levelup-close").focus();
  }
  // I salvataggi arrivano a raffica (sessione, poi traguardi): sommo i punti e mostro una volta
  let startLevel = null;
  window.addEventListener("studio:saved", () => {
    const now = renderPlayer();
    if (startLevel === null) startLevel = last.level;
    if (now.xp > last.xp) pending += now.xp - last.xp;
    last = now;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (pending > 0) floatXP(pending);
      const current = StudyCore.levelFor(myXP());
      if (current.level > startLevel) levelUp(current);
      pending = 0;
      startLevel = null;
    }, 400);
  });
  window.addEventListener("hashchange", renderPlayer);
})();
