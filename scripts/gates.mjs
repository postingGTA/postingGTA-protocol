// Gates: static checks on dist/ plus DOM runs of the built bundle for every CA branch.
// Mutation anchors read the current register record at runtime; no anchor assumes a state.
import { JSDOM } from "jsdom";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "../build.mjs";
import { scanAddresses } from "../src/js/gate.js";
import { fmtPrice } from "../src/js/format.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, ".tmp");
const results = [];
const gate = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? "  -> " + detail : ""}`);
};
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const walk = (d, skip = []) => {
  const out = [];
  for (const n of readdirSync(d)) {
    if (skip.includes(n)) continue;
    const p = join(d, n);
    statSync(p).isDirectory() ? out.push(...walk(p, skip)) : out.push(p);
  }
  return out;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- static gates (on the deploy output dist/) ----------------
const baseReg = JSON.parse(read("src/register.json"));
const built = await build();
const dist = built.out;
const html = readFileSync(join(dist, "index.html"), "utf8");
console.log(`\n== static gates (current ca.state = ${baseReg.ca.state}) ==`);

gate("deploy output is dist/ with index.html, app.js, app.css", ["index.html", "app.js", "app.css"].every((f) => existsSync(join(dist, f))));
const png = (p) => { const b = readFileSync(join(dist, p)); return b.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20), ct: b[25] } : null; };
const logo = existsSync(join(dist, "brand/logo.png")) && png("brand/logo.png");
const mark = existsSync(join(dist, "brand/mark.png")) && png("brand/mark.png");
gate("logo file copied into dist/brand/logo.png (PNG, RGBA colourtype 6)", logo && logo.ct === 6, JSON.stringify(logo));
gate("mark file copied into dist/brand/mark.png (PNG, RGBA colourtype 6)", mark && mark.ct === 6, JSON.stringify(mark));
const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => m[1]).filter((u) => !/^(https?:|mailto:|data:)/.test(u));
gate("every local src/href in index.html is relative and resolves inside dist/", refs.every((u) => !u.startsWith("/") && existsSync(join(dist, u))), refs.filter((u) => u.startsWith("/") || !existsSync(join(dist, u))).join());
gate("index.html references brand/logo.png with the correct relative path", /src="brand\/logo\.png"/.test(html));
gate("app.js references brand/mark.png (placeholder row logo)", readFileSync(join(dist, "app.js"), "utf8").includes("brand/mark.png"));
const fav = readFileSync(join(dist, "favicon.svg"), "utf8");
gate("favicon.svg is 32x32 and traced from pixel grid (rect runs)", /viewBox="0 0 32 32"/.test(fav) && (fav.match(/<rect /g) || []).length > 50);
gate("index.html links the favicon", /rel="icon"[^>]*href="favicon\.svg"/.test(html));

const srcFiles = walk(join(ROOT, "src")).filter((f) => [".css", ".js", ".html"].includes(extname(f)));
const hexOutside = srcFiles.filter((f) => !f.endsWith("tokens.css")).filter((f) => /#[0-9a-fA-F]{3,8}\b(?![\w-])/.test(readFileSync(f, "utf8").replace(/url\("data:[^"]*"\)/g, "")) || /\brgba?\(\s*\d/.test(readFileSync(f, "utf8")));
gate("colour literals live in tokens.css only", hexOutside.length === 0, hexOutside.join());
gate("no ch units in css", !/\d\s?ch\b/.test(read("src/css/main.css")));
const cssMain = read("src/css/main.css");
gate("prefers-reduced-motion block kills all animation + own pulse", /prefers-reduced-motion: reduce\)[\s\S]*animation: none !important[\s\S]*\.row\.own \{ animation: none; \}/.test(cssMain));
gate("own row: border-left 2px accent, ownPulse keyframes, mint token", /\.row\.own \{[^}]*border-left: 2px solid var\(--color-accent\)[^}]*ownPulse/.test(cssMain) && /@keyframes ownPulse/.test(cssMain) && /--mint: #00ffcc/.test(read("src/css/tokens.css")));
gate("tap targets: soc, ca button, buttons are >= 44px", /\.soc \{ width: 44px; height: 44px/.test(cssMain) && /\.ca-val \{[^}]*min-height: 44px/.test(cssMain) && /\.btn \{[^}]*min-height: 44px/.test(cssMain));

const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ");
const jsSrc = walk(join(ROOT, "src/js")).map((f) => readFileSync(f, "utf8")).join("\n");
const dateRx = /\b(19|20)\d{2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d|\bas of\b|\bchecked\b|\bupdated\b|\b\d{1,2}:\d{2}\b/i;
gate("no dates, timestamps, 'as of', 'checked' or clock strings in page text", !dateRx.test(text), (text.match(dateRx) || [""])[0]);
gate("no Date APIs or locale date formatting in src/js", !/\bnew Date\b|Date\.now|toLocale(Date|Time)String|getFullYear|Intl\.DateTimeFormat/.test(jsSrc));
const scanText = text + " " + JSON.stringify(baseReg);
gate("address scanner: no address-shaped string outside the stated registry (CA exempt)", scanAddresses(scanText, baseReg).length === 0, scanAddresses(scanText, baseReg).join());
const hex0x = "0x" + "ab12".repeat(10);
gate("0x hex is not blanket-rejected: passes only when stated, flagged otherwise", scanAddresses(hex0x, baseReg).length === 1 && scanAddresses(hex0x, { ...baseReg, evm: { state: "stated", address: hex0x } }).length === 0);
gate("scanner CA exemption works for a stated CA", scanAddresses("Po5tGTA" + "A".repeat(37), { ...baseReg, ca: { state: "stated", value: "Po5tGTA" + "A".repeat(37) } }).length === 0);
const bannedRepo = [".claude", "CLAUDE.md"].filter((n) => existsSync(join(ROOT, n)));
const aiRx = /claude|anthropic|co-authored-by|generated with|chatgpt|openai/i;
const repoText = walk(ROOT, ["node_modules", ".tmp", "dist", "BRAND", "REFERENCE", ".git", "package-lock.json", "public"]).filter((f) => [".md", ".json", ".js", ".mjs", ".css", ".html", ".py", ".svg", ""].includes(extname(f)) || f.endsWith("LICENSE")).filter((f) => !f.endsWith("gates.mjs") && aiRx.test(readFileSync(f, "utf8")));
gate("repo hygiene: no CLAUDE.md, no .claude/, no AI attribution", bannedRepo.length === 0 && repoText.length === 0, [...bannedRepo, ...repoText].join());
gate("README.md, docs/whitepaper.md, LICENSE exist (MIT, POSTINGGTA, 2026)", existsSync(join(ROOT, "README.md")) && existsSync(join(ROOT, "docs/whitepaper.md")) && /MIT License/.test(read("LICENSE")) && /POSTINGGTA, 2026/.test(read("LICENSE")));
gate("X icon is the official X path; GitHub icon is the Octicon mark-github path", jsSrc.includes("M18.244 2.25h3.308") && jsSrc.includes("M8 0c4.42 0 8 3.58 8 8a8.013"));

// animation audit: every @keyframes is applied somewhere (CSS animation or JS-toggled class) and reduced motion kills animation
const kfNames = [...cssMain.matchAll(/@keyframes (\w+)/g)].map((m) => m[1]);
const unused = kfNames.filter((n) => !new RegExp("animation:[^;}]*\\b" + n + "\\b").test(cssMain));
gate(`animation audit: all ${kfNames.length} @keyframes are applied to an element`, unused.length === 0, unused.join());
const rm = cssMain.slice(cssMain.lastIndexOf("@media (prefers-reduced-motion"));
gate("animation audit: reduced-motion kills animation/transition on every element and pseudo", /\*, \*::before, \*::after \{ animation: none !important; transition: none !important/.test(rm));
const headerHtml = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
gate("exactly one X icon in nav, linking to the stored X url", (headerHtml.match(/data-record="x"/g) || []).length === 1 && (headerHtml.match(/data-record="github"/g) || []).length === 1);

// ---------------- DOM gates: every CA branch ----------------
const TEST_CA = "Po5tGTA" + "A".repeat(37);
const addr = (i) => "Tok" + String(i).padStart(2, "A") + "A".repeat(39);
const GH = "https://github.com/postinggta/site";
const pairFor = (i, vol, sym) => ({ chainId: "solana", baseToken: { symbol: sym || "T" + i, name: "Token " + i }, priceUsd: String(0.5 + i), priceChange: { h24: i % 2 ? 5.5 : -3.2 }, volume: { h24: vol }, liquidity: { usd: 1000 * i }, info: { imageUrl: `https://img.test/dex${i}.png` } });

function makeFetch(log, { dexFail = false, pumpFail = false, boostFail = false } = {}) {
  const json = (v) => Promise.resolve({ ok: true, status: 200, json: async () => v });
  return (url) => {
    log.push(url);
    if (url.includes("token-boosts")) {
      if (boostFail) return Promise.resolve({ ok: false, status: 503, json: async () => ({}) });
      const b = Array.from({ length: 11 }, (_, i) => ({ chainId: "solana", tokenAddress: addr(i), totalAmount: 100 - i, icon: `https://img.test/b${i}.png` }));
      b.push({ chainId: "solana", tokenAddress: TEST_CA, totalAmount: 500 }, { chainId: "ethereum", tokenAddress: "0x" + "1".repeat(40), totalAmount: 9999 }, { chainId: "solana", tokenAddress: addr(0), totalAmount: 5 });
      return json(b);
    }
    if (url.includes("/tokens/v1/solana/")) {
      const a = decodeURIComponent(url.split("/").pop());
      if (a === TEST_CA) return json([pairFor(77, 10, "DUPE")]);
      const i = Number(a.slice(3, 5).replace(/A/g, "")) || 0;
      return json([pairFor(i, 10, "LOW" + i), pairFor(i, 900 + i, "T" + i)]);
    }
    if (url.includes("/latest/dex/tokens/")) return dexFail ? Promise.reject(new Error("dex down")) : sleep(40).then(() => json({ pairs: [pairFor(1, 10, "SMALL"), pairFor(3, 99999, "POSTING"), { ...pairFor(4, 1e9, "ETHPAIR"), chainId: "ethereum" }] }));
    if (url.includes("frontend-api.pump.fun")) return pumpFail ? Promise.resolve({ ok: false, status: 404, json: async () => ({}) }) : json({ symbol: "PUMPSYM", name: "PostingGTA", image_uri: "https://img.test/pump.png" });
    return Promise.reject(new Error("unexpected " + url));
  };
}

async function runDom(dir, { reduced = true, fetchOpts = {}, click = false, waitOwn = false } = {}) {
  const dom = new JSDOM(readFileSync(join(dir, "index.html"), "utf8"), { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" });
  const w = dom.window;
  const log = [];
  const copied = [];
  w.matchMedia = (q) => ({ matches: reduced && /reduce/.test(q), addEventListener() {}, removeEventListener() {} });
  w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.ResizeObserver = class { observe() {} disconnect() {} };
  w.fetch = makeFetch(log, fetchOpts);
  Object.defineProperty(w.navigator, "clipboard", { value: { writeText: async (t) => copied.push(t) }, configurable: true });
  const errors = [];
  w.addEventListener("error", (e) => errors.push(e.message));
  w.eval(readFileSync(join(dir, "app.js"), "utf8"));
  const ready = () => w.document.querySelectorAll("#rows .row:not(.skel):not(.ph)").length >= (waitOwn ? 4 : 3) && (!waitOwn || !w.document.querySelector("#rows .row.own.ph"));
  for (let i = 0; i < 120 && !ready(); i++) await sleep(50);
  await sleep(150);
  let clicked = null;
  const btn = w.document.getElementById("caBtn");
  if (click) { btn.click(); await sleep(30); clicked = w.document.getElementById("caCopy").textContent; }
  return { w, d: w.document, log, copied, errors, clicked };
}
const rowsOf = (d) => [...d.querySelectorAll("#rows .row")];
const syms = (d) => rowsOf(d).map((r) => r.querySelector(".sym")?.textContent);

console.log("\n== DOM gates per CA branch ==");
mkdirSync(TMP, { recursive: true });
const branches = ["absent", "stated", "unconfirmed"];
const trendingSeen = {};
const trendingUrls = {};
for (const state of branches) {
  const reg = structuredClone(baseReg);
  reg.ca = state === "stated" ? { state, value: TEST_CA } : { state, value: null };
  if (state === "stated") reg.github = { state: "stated", url: GH };
  const regFile = join(TMP, `register-${state}.json`);
  writeFileSync(regFile, JSON.stringify(reg));
  const out = join(TMP, "dist-" + state);
  await build({ register: regFile, out });
  const L = `[${state}]`;
  // anchors read the record that was just built, not a hard-coded state
  const rec = JSON.parse(readFileSync(join(out, "index.html"), "utf8").match(/id="register">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, "<"));
  const stated = rec.ca.state === "stated";
  const { d, log, copied, errors, clicked } = await runDom(out, { click: true, waitOwn: stated });
  const bar = d.getElementById("caBar");
  const btn = d.getElementById("caBtn");
  const row1 = rowsOf(d)[0];

  gate(`${L} no script errors`, errors.length === 0, errors.join());
  gate(`${L} CA bar data-state mirrors the record`, bar.dataset.state === rec.ca.state);
  gate(`${L} CA slot ${stated ? "shows full address" : "stays inert placeholder"}`, stated ? d.getElementById("caText").textContent === rec.ca.value : !btn.hasAttribute("aria-label") && btn.disabled && !/[1-9A-HJ-NP-Za-km-z]{32,}/.test(d.getElementById("caText").textContent));
  gate(`${L} CA click-to-copy ${stated ? "copies and shows feedback" : "does nothing"}`, stated ? copied[0] === rec.ca.value && clicked === "Copied" : copied.length === 0 && clicked === "");
  gate(`${L} CA slot is the first thing in the page (top, always visible)`, d.body.querySelector("#topwrap") === d.body.children[1] && !!d.querySelector("#topwrap #caBar"));
  const soc = [...d.querySelectorAll("#social .soc")];
  gate(`${L} both social icons present, icon-only (svg, no text)`, soc.length === 2 && soc.every((a) => a.querySelector("svg") && a.textContent.trim() === ""));
  const x = d.getElementById("socX");
  const gh = d.getElementById("socGh");
  gate(`${L} X link: href stored from record, handle derived`, rec.x.state === "stated" ? x.getAttribute("href") === rec.x.url && x.title === "@postingGTA" : !x.hasAttribute("href"));
  gate(`${L} GitHub icon follows its record (inert when not stated, no href)`, rec.github.state === "stated" ? gh.getAttribute("href") === rec.github.url : !gh.hasAttribute("href") && gh.getAttribute("aria-disabled") === "true");
  gate(`${L} buy button inert without a stated record`, rec.buy.state === "stated" || !d.getElementById("buyTop").hasAttribute("href"));
  gate(`${L} row #1 is the own-token row (class own)`, row1 && row1.classList.contains("own") && row1.querySelector(".n").textContent === "1");
  if (stated) {
    const lg = row1.querySelector(".lg img");
    gate(`${L} own row uses best-volume pair of solana pairs (POSTING, not SMALL/ETHPAIR)`, row1.querySelector(".sym").textContent === "POSTING" && row1.querySelector(".price").textContent === fmtPrice(3.5));
    gate(`${L} own logo prefers pump.fun image_uri`, lg && lg.src === "https://img.test/pump.png");
    gate(`${L} dexscreener and pump.fun both requested for own token`, log.some((u) => u.includes("/latest/dex/tokens/" + TEST_CA)) && log.some((u) => u.includes("frontend-api.pump.fun/coins/" + TEST_CA)));
    gate(`${L} dedup: own token removed from trending rows`, !syms(d).slice(1).includes("DUPE") && rowsOf(d).length === 10);
    gate(`${L} own row not a placeholder (real figures, no dots)`, !row1.classList.contains("ph") && !/·/.test(row1.querySelector(".vol").textContent));
  } else {
    const img = row1.querySelector(".lg img");
    gate(`${L} placeholder row #1 shows BRAND LOGO (not letter tile)`, row1.classList.contains("ph") && img && /brand\/mark\.png$/.test(img.getAttribute("src")) && !row1.querySelector(".lg.tile"));
    gate(`${L} placeholder data cells are dots, non-clickable`, ["price", "chg", "vol", "liq"].every((c) => row1.querySelector("." + c).textContent === "· · · · ·") && !row1.querySelector("a,button"));
    gate(`${L} no own-token requests without a CA`, !log.some((u) => u.includes("/latest/dex/tokens/") || u.includes("pump.fun")));
  }
  const trend = syms(d).slice(1);
  trendingSeen[state] = trend.filter((s) => s !== "DUPE");
  trendingUrls[state] = log.filter((u) => !u.includes("/latest/dex/tokens/") && !u.includes("pump.fun") && !u.includes(TEST_CA));
  gate(`${L} trending rows are the top 10 solana by totalAmount (eth excluded, deduped)`, trend.length >= 9 && !trend.includes("ETHPAIR") && trend.filter((s) => s !== "DUPE").every((s) => /^T\d+$/.test(s)), trend.join());
  gate(`${L} trending picks the highest-volume pair per token`, !trend.some((s) => s.startsWith("LOW")));
  gate(`${L} gate scanner reports ok (CA exempt)`, d.body.dataset.gate === "ok");
  gate(`${L} no visible dates in rendered DOM`, !dateRx.test(d.body.textContent.replace(/\d{1,2}(\.\d+)?%/g, "")), (d.body.textContent.match(dateRx) || [""])[0]);
}
gate("market is independent of CA state (same trending rows in all branches)", branches.every((s) => JSON.stringify(trendingSeen[s].slice(0, 9)) === JSON.stringify(trendingSeen.absent.slice(0, 9))), JSON.stringify(trendingSeen));
gate("market source requests identical across CA branches", branches.every((s) => JSON.stringify(trendingUrls[s]) === JSON.stringify(trendingUrls.absent)));

console.log("\n== failure + parallelism gates (stated branch) ==");
const sd = join(TMP, "dist-stated");
{
  const r = await runDom(sd, { fetchOpts: { dexFail: true }, waitOwn: true });
  gate("pump.fun renders own row when DexScreener fails (never blocked)", rowsOf(r.d)[0].querySelector(".sym").textContent === "PUMPSYM" && rowsOf(r.d)[0].classList.contains("own"));
}
{
  const r = await runDom(sd, { fetchOpts: { pumpFail: true }, waitOwn: true });
  const row = rowsOf(r.d)[0];
  gate("DexScreener renders own row when pump.fun fails (logo falls to dex image)", row.querySelector(".sym").textContent === "POSTING" && row.querySelector(".lg img")?.src === "https://img.test/dex3.png");
}
{
  const r = await runDom(join(TMP, "dist-absent"), { fetchOpts: { boostFail: true } });
  gate("source down: dashes and an error note, no crash", r.errors.length === 0 && !r.d.getElementById("boardNote").hidden && rowsOf(r.d).slice(1).every((x) => x.querySelector(".price").textContent === "—"), r.errors.join());
  gate("source down: pill reports offline", /offline|Reconnecting/i.test(r.d.getElementById("statusText").textContent));
}
{
  const r = await runDom(sd, { reduced: false });
  gate("motion path (reduced-motion off) runs without errors", r.errors.length === 0 && rowsOf(r.d).length >= 10, r.errors.join() + " rows=" + rowsOf(r.d).length);
}

rmSync(TMP, { recursive: true, force: true });
const failed = results.filter((r) => !r.ok);
console.log(`\nGATES: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
