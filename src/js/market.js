// Pure market logic (no DOM). Market follows the market-source record only.
import { num } from "./format.js";
import { fetchJson } from "./fetcher.js";

export const fill = (tpl, address) => tpl.replace("{address}", encodeURIComponent(address));

export function selectPair(pairs) {
  if (!Array.isArray(pairs) || !pairs.length) return null;
  return [...pairs].sort((a, b) => (num(b?.volume?.h24) ?? -1) - (num(a?.volume?.h24) ?? -1))[0];
}
export function pickTrending(boosts, top = 10) {
  if (!Array.isArray(boosts)) return [];
  const best = new Map();
  for (const b of boosts) {
    if (!b || b.chainId !== "solana" || !b.tokenAddress) continue;
    const amt = num(b.totalAmount) ?? 0;
    const cur = best.get(b.tokenAddress);
    if (!cur || amt > cur.amt) best.set(b.tokenAddress, { amt, b });
  }
  return [...best.values()].sort((x, y) => y.amt - x.amt).slice(0, top).map((x) => x.b);
}
export function rowFromPair(address, pair, boost = {}, pump = null) {
  return {
    key: address,
    address,
    symbol: pair?.baseToken?.symbol || pump?.symbol || null,
    name: pair?.baseToken?.name || pump?.name || null,
    price: num(pair?.priceUsd),
    chg: num(pair?.priceChange?.h24),
    vol: num(pair?.volume?.h24),
    liq: num(pair?.liquidity?.usd),
    // logo order: pump.fun image_uri -> DexScreener -> (caller appends brand mark) -> letter tile
    img: [pump?.image_uri, pair?.info?.imageUrl, boost?.icon].filter(Boolean),
  };
}
// Rows 2..: trending with the own token removed (dedup).
export const dedupe = (rows, ca) => (ca ? rows.filter((r) => r.address !== ca) : rows);

export async function loadTrending(src, { fetchImpl } = {}) {
  const boosts = await fetchJson(src.boosts, { fetchImpl });
  const picks = pickTrending(boosts, src.top || 10);
  return Promise.all(
    picks.map(async (b) => {
      try {
        const pairs = await fetchJson(fill(src.tokens, b.tokenAddress), { fetchImpl, retries: 1 });
        return rowFromPair(b.tokenAddress, selectPair(pairs), b);
      } catch {
        return rowFromPair(b.tokenAddress, null, b);
      }
    })
  );
}
export function composeOwn(ca, dexJson, pumpJson) {
  const pairs = (dexJson?.pairs || []).filter((p) => p.chainId === "solana");
  const pair = selectPair(pairs);
  if (!pair && !pumpJson) return null;
  const row = rowFromPair(ca, pair, {}, pumpJson);
  row.key = "own:" + ca;
  return row;
}
// DexScreener and pump.fun run in parallel; whichever lands first is shown at once (onPartial).
export async function loadOwn(src, ca, { fetchImpl, onPartial } = {}) {
  const parts = { dex: null, pump: null };
  const emit = () => {
    const r = composeOwn(ca, parts.dex, parts.pump);
    if (r && onPartial) onPartial(r);
  };
  await Promise.allSettled([
    fetchJson(fill(src.ownDex, ca), { fetchImpl, retries: 2 }).then((v) => ((parts.dex = v), emit())),
    fetchJson(fill(src.ownPump, ca), { fetchImpl, retries: 1 }).then((v) => ((parts.pump = v), emit())),
  ]);
  const row = composeOwn(ca, parts.dex, parts.pump);
  if (!row) throw new Error("own token unreachable");
  return row;
}
