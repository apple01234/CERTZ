// A party seat belongs to one tab; account/save storage remains shared across tabs.
let clientId = "";
export function relayClientId(): string {
  if (clientId) return clientId;
  try { clientId = window.sessionStorage.getItem("sertz.relay.cid") || ""; } catch { /* storage disabled */ }
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(clientId)) {
    clientId = `r${crypto.randomUUID().replaceAll("-", "")}`;
    try { window.sessionStorage.setItem("sertz.relay.cid", clientId); } catch { /* memory session */ }
  }
  return clientId;
}

// MQTT client IDs must also differ for duplicated tabs and during page reload overlap.
export function presenceSessionId(): string {
  return `sz${crypto.randomUUID().replaceAll("-", "").slice(0, 28)}`;
}
