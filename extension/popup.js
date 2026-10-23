const $ = (id) => document.getElementById(id);
const send = (type, extra) => chrome.runtime.sendMessage({ type, ...extra });
let state = null,
  tick = null;

function render() {
  if (!state) return;
  $("status").textContent = state.suspended
    ? "Protezione sospesa per 15 minuti."
    : state.until > Date.now()
      ? "Siti bloccati. " + (state.scheduled ? "Fascia programmata attiva." : "Sessione di studio attiva.")
      : "Nessun blocco attivo. Gli orari salvati restano programmati.";
  $("stop").disabled = !state.until || state.strict;
  $("strict-note").hidden = !state.strict;

  const left = state.adultPendingOff ? Math.max(0, Math.ceil((state.adultPendingOff - Date.now()) / 1000)) : 0;
  $("adult-status").innerHTML = !state.adult
    ? '<span class="off">Non bloccati.</span>'
    : left
      ? `<span class="on">Bloccati.</span> Si spegne tra ${left} secondi.`
      : '<span class="on">Bloccati.</span>';
  $("adult-actions").innerHTML = !state.adult
    ? '<button class="primary" data-act="ADULT_ON">Riattiva il blocco</button>'
    : left
      ? '<button class="primary" data-act="ADULT_CANCEL">Annulla, tienilo acceso</button>'
      : '<button data-act="ADULT_OFF">Spegni il blocco</button>';

  $("ads-status").innerHTML = state.ads ? '<span class="on">Bloccata.</span>' : '<span class="off">Non bloccata.</span>';
  $("ads-toggle").textContent = state.ads ? "Mostra la pubblicità" : "Blocca la pubblicità";
  $("ads-toggle").className = state.ads ? "" : "primary";

  clearTimeout(tick);
  if (left) tick = setTimeout(left <= 1 ? load : render, 1000);
}
async function load() {
  state = await send("PING");
  render();
}
async function act(type, extra) {
  state = await send(type, extra);
  render();
}
$("stop").onclick = async () => {
  const r = await send("SUSPEND");
  if (r && r.ok === false) $("status").textContent = r.error;
  else load();
};
$("adult-actions").onclick = (e) => e.target.dataset.act && act(e.target.dataset.act);
$("ads-toggle").onclick = () => act("ADS_SET", { on: !state.ads });
load();
