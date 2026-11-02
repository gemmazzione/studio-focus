// Gira nella pagina di YouTube (world MAIN), prima dei suoi script.
// Toglie dalle risposte del lettore gli annunci e il messaggio "i blocchi degli annunci violano…",
// così il video parte senza pubblicità e senza avviso.
// Non si bloccano richieste di rete: le richieste pubblicitarie fallite sono proprio ciò che
// YouTube controlla per accorgersi degli ad blocker. Le funzioni sostituite sono Proxy delle
// originali, quindi ai controlli di YouTube risultano ancora "native".
(() => {
  const AD_KEYS = ["adPlacements", "adSlots", "playerAds", "adBreakHeartbeatParams"];
  const ENFORCEMENT = ["bkaEnforcementMessageViewModel", "enforcementMessageViewModel"];
  function prune(obj) {
    if (!obj || typeof obj !== "object") return obj;
    for (const key of AD_KEYS) if (key in obj) delete obj[key];
    const renderers = obj.auxiliaryUi?.messageRenderers;
    if (renderers) for (const key of ENFORCEMENT) delete renderers[key];
    if (obj.playerResponse) prune(obj.playerResponse);
    // Popup di avviso arrivati nelle risposte di navigazione
    if (Array.isArray(obj.onResponseReceivedEndpoints))
      obj.onResponseReceivedEndpoints = obj.onResponseReceivedEndpoints.filter(
        (e) => !JSON.stringify(e?.openPopupAction || {}).includes("nforcementMessageViewModel"),
      );
    return obj;
  }
  // Risposte lette con JSON.parse (navigazione interna, XHR)
  JSON.parse = new Proxy(JSON.parse, {
    apply: (target, self, args) => prune(Reflect.apply(target, self, args)),
  });
  // Risposte lette con fetch → response.json()
  Response.prototype.json = new Proxy(Response.prototype.json, {
    apply: (target, self, args) => Reflect.apply(target, self, args).then(prune),
  });
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
