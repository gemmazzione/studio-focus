async function render() {
  const { until } = await chrome.storage.local.get("until");
  const active = until > Date.now();
  document.getElementById("status").textContent = active
    ? "Siti bloccati fino alle " +
      new Date(until).toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Nessun blocco attivo.";
  document.getElementById("stop").disabled = !active;
}
document.getElementById("stop").onclick = async () => {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: rules.map((r) => r.id),
  });
  await chrome.storage.local.remove("until");
  await chrome.alarms.clear("end");
  await chrome.action.setBadgeText({ text: "" });
  render();
};
render();
