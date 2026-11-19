// Register pattern: every external fact is one record with a state (stated | absent | unconfirmed).
// Only "stated" records may render live; the rest render inert.
export const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function readRegister(doc = document) {
  return JSON.parse(doc.getElementById("register").textContent);
}
export const isStated = (rec) => !!rec && rec.state === "stated";

// The CA is live only if stated AND shaped like a Solana address.
export function liveCa(reg) {
  const r = reg.ca;
  return isStated(r) && typeof r.value === "string" && BASE58.test(r.value) ? r.value : null;
}
// Link rule: store the URL, derive the handle. No URL -> no href.
export function handleOf(rec) {
  if (!isStated(rec) || !rec.url) return null;
  try {
    const seg = new URL(rec.url).pathname.split("/").filter(Boolean)[0];
    return seg ? "@" + seg : null;
  } catch {
    return null;
  }
}
export function hrefOf(rec) {
  if (!isStated(rec) || !rec.url) return null;
  try {
    return new URL(rec.url).href;
  } catch {
    return null;
  }
}
