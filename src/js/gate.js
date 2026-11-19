// Gate warning: find address-shaped strings and match them against the stated registry.
// 0x hex is never rejected outright; it only passes if a stated record holds it.
// The CA record is exempt from the scan.
const HEX = /\b0x[0-9a-fA-F]{40}\b/g;
const B58 = /(?<![1-9A-HJ-NP-Za-km-z])[1-9A-HJ-NP-Za-km-z]{32,44}(?![1-9A-HJ-NP-Za-km-z])/g;

export function statedValues(reg) {
  const out = new Set();
  for (const rec of Object.values(reg)) {
    if (!rec || rec.state !== "stated") continue;
    for (const v of Object.values(rec)) if (typeof v === "string") out.add(v);
  }
  return out;
}
export function scanAddresses(text, reg) {
  const known = statedValues(reg);
  const caExempt = reg.ca && reg.ca.state === "stated" && reg.ca.value ? reg.ca.value : null;
  const found = new Set();
  for (const m of text.match(HEX) || []) found.add(m);
  const rest = text.replace(HEX, " ");
  for (const m of rest.match(B58) || []) if (/\d/.test(m) && /[A-Za-z]/.test(m)) found.add(m);
  return [...found].filter((a) => a !== caExempt && !known.has(a));
}
