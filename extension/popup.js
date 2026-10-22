async function render() {
  const state = await chrome.runtime.sendMessage({ type: "PING" });
  document.getElementById("status").textContent = state.suspended
    ? "Protezione sospesa per 15 minuti."
    : state.until > Date.now()
      ? "Siti bloccati. " +
        (state.scheduled
          ? "Fascia programmata attiva."
          : "Sessione focus attiva.")
      : "Nessun blocco attivo. Gli orari salvati restano programmati.";
  document.getElementById("stop").disabled = !state.until;
}
document.getElementById("stop").onclick = async () => {
  await chrome.runtime.sendMessage({ type: "SUSPEND" });
  render();
};
render();
