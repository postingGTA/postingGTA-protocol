const SUB = "₀₁₂₃₄₅₆₇₈₉";
export const num = (v) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && isFinite(n) ? n : null;
};
export function fmtPrice(n) {
  if (n == null || !isFinite(n)) return "—";
  if (n >= 1000) return "$" + n.toLocaleString("en", { maximumFractionDigits: 2 });
  if (n >= 1) return "$" + n.toLocaleString("en", { maximumFractionDigits: 3 });
  if (n >= 0.01) return "$" + n.toFixed(4);
  if (n === 0) return "$0";
  const s = n.toFixed(20).slice(2);
  const zeros = s.match(/^0*/)[0].length;
  const digits = s.slice(zeros, zeros + 4).replace(/0+$/, "") || "0";
  if (zeros < 3) return "$0." + "0".repeat(zeros) + digits;
  return "$0.0" + String(zeros).split("").map((d) => SUB[+d]).join("") + digits;
}
export function fmtCompact(n) {
  if (n == null || !isFinite(n)) return "—";
  return "$" + Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
export function fmtPct(n) {
  if (n == null || !isFinite(n)) return "—";
  const a = Math.abs(n);
  const body = a >= 1000 ? Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(a) : a.toFixed(a >= 100 ? 0 : 2);
  return (n > 0 ? "+" : n < 0 ? "−" : "") + body + "%";
}
