// Gira nella pagina di YouTube (world MAIN), prima dei suoi script.
// Toglie dalle risposte del lettore le parti che programmano gli annunci, così il video parte senza.
// YouTube cambia spesso: se smette di funzionare, youtube-skip.js salta comunque gli annunci.
(() => {
  const AD_KEYS = ["adPlacements", "adSlots", "playerAds", "adBreakHeartbeatParams"];
  function prune(obj) {
    if (!obj || typeof obj !== "object") return obj;
    for (const key of AD_KEYS) if (key in obj) delete obj[key];
    if (obj.playerResponse) prune(obj.playerResponse);
    return obj;
  }
  // Risposte lette con JSON.parse (navigazione interna di YouTube)
  const parse = JSON.parse;
  JSON.parse = function (...args) {
    return prune(parse.apply(this, args));
  };
  // Risposte lette con fetch → response.json()
  const json = Response.prototype.json;
  Response.prototype.json = function (...args) {
    return json.apply(this, args).then(prune);
  };
  // Dati iniziali scritti nella pagina al primo caricamento
  for (const name of ["ytInitialPlayerResponse", "ytInitialData"]) {
    let value;
    try {
      Object.defineProperty(window, name, {
        configurable: true,
        get: () => value,
        set: (v) => (value = prune(v)),
      });
    } catch {}
  }
})();
