import { readRegister, liveCa, isStated, hrefOf, handleOf } from "./register.js";
import { scanAddresses } from "./gate.js";
import { X_SVG, GH_SVG } from "./icons.js";
import { dedupe, loadTrending, loadOwn } from "./market.js";
import { createBoard, createTicker, createStack } from "./board.js";
import { initReveal, initProgress, initSpotlight, initParallax, initStatement, initKaraoke, buildWall, watchTopHeight } from "./fx.js";

const $ = (id) => document.getElementById(id);
const reg = readRegister();
const ca = liveCa(reg);

// ---- link rule: href only for stated records; handle is derived from the stored url ----
function wireLinks() {
  document.querySelectorAll("[data-record]").forEach((a) => {
    const rec = reg[a.dataset.record];
    const href = hrefOf(rec);
    if (a.classList.contains("soc")) a.innerHTML = a.dataset.record === "x" ? X_SVG : GH_SVG;
    if (href) {
      a.setAttribute("href", href);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
      a.removeAttribute("aria-disabled");
      a.classList.remove("soon", "inert");
      a.removeAttribute("data-tip");
      const h = handleOf(rec);
      if (h && a.classList.contains("soc")) a.setAttribute("title", h);
    } else {
      a.removeAttribute("href");
      a.setAttribute("aria-disabled", "true");
      a.classList.add("inert");
      if (a.classList.contains("soc")) a.setAttribute("title", "Not available yet");
    }
  });
}

// ---- CA slot: inert until a CA is stated ----
function wireCa() {
  const bar = $("caBar");
  const btn = $("caBtn");
  const text = $("caText");
  const label = $("caCopy");
  if (ca) {
    bar.dataset.state = "stated";
    text.textContent = ca;
    label.textContent = "Copy";
    btn.disabled = false;
    btn.removeAttribute("aria-disabled");
    btn.setAttribute("aria-label", "Copy the contract address");
    btn.addEventListener("click", async () => {
      let ok = false;
      try {
        await navigator.clipboard.writeText(ca);
        ok = true;
      } catch {
        const t = document.createElement("textarea");
        t.value = ca;
        t.style.position = "fixed";
        t.style.opacity = "0";
        document.body.appendChild(t);
        t.select();
        try { ok = document.execCommand("copy"); } catch { ok = false; }
        t.remove();
      }
      label.textContent = ok ? "Copied" : "Press Ctrl+C";
      btn.toggleAttribute("data-copied", ok);
      clearTimeout(btn._t);
      btn._t = setTimeout(() => {
        label.textContent = "Copy";
        btn.removeAttribute("data-copied");
      }, 1600);
    });
  } else {
    bar.dataset.state = reg.ca.state === "unconfirmed" ? "unconfirmed" : "absent";
    text.textContent = reg.ca.state === "unconfirmed" ? "Contract address awaiting confirmation" : "Contract address not announced yet";
  }
}

// ---- market: follows the market-source record only ----
function startMarket() {
  const src = reg["market-source"];
  const board = createBoard($("rows"), $("boardNote"));
  const ticker = createTicker($("tickerTrack"));
  const stack = createStack($("stack"));
  const pill = $("statusPill");
  const pillText = $("statusText");
  const setStatus = (s, t) => {
    pill.dataset.state = s;
    pillText.textContent = t;
  };
  const state = { trending: null, own: null, tErr: false, oErr: false, loadedOnce: false };

  const skeletons = () => Array.from({ length: src?.top || 10 }, (_, i) => ({ kind: "skel", key: "sk:" + i }));
  const dashRows = () => Array.from({ length: src?.top || 10 }, (_, i) => ({ kind: "err", key: "err:" + i, symbol: "—", name: "Source unreachable" }));
  const ownRow = () => {
    if (ca && state.own) return { ...state.own, own: true };
    return { kind: "ph", key: "own:ph", own: true, symbol: "POSTING", name: ca ? "Loading $POSTING" : "PostingGTA · launching soon" };
  };

  function render() {
    let rows;
    let note = "";
    if (!isStated(src)) {
      rows = [ownRow(), ...dashRows()];
      note = "Market source is not confirmed. Nothing to show.";
    } else if (state.trending) {
      rows = [ownRow(), ...dedupe(state.trending, ca)];
      if (state.tErr) note = "Refresh failed. Showing the last good data and retrying.";
    } else if (state.tErr) {
      rows = [ownRow(), ...dashRows()];
      note = "Market feed unreachable. Retrying with backoff.";
    } else rows = [ownRow(), ...skeletons()];
    if (ca && state.oErr && !state.own) note = note || "Own token feed unreachable. Retrying.";
    board.render(rows, note);
    const live = rows.filter((r) => !r.kind && r.symbol);
    if (live.length) {
      ticker.render(live);
      stack.render(live.filter((r) => !r.own));
    }
  }

  let timer = 0;
  let busy = false;
  async function tick() {
    clearTimeout(timer);
    timer = setTimeout(tick, src.pollMs || 60000);
    if (busy) return;
    busy = true;
    if (!state.loadedOnce) setStatus("connecting", "Connecting");
    const jobs = [
      loadTrending(src).then((rows) => ((state.trending = rows), (state.tErr = false))).catch(() => (state.tErr = true)).finally(render),
    ];
    if (ca) jobs.push(loadOwn(src, ca, { onPartial: (r) => ((state.own = r), render()) }).then((r) => ((state.own = r), (state.oErr = false))).catch(() => (state.oErr = true)).finally(render));
    await Promise.allSettled(jobs);
    busy = false;
    state.loadedOnce = true;
    if (state.tErr) setStatus("retry", state.trending ? "Reconnecting" : "Feed offline");
    else setStatus("live", "Live");
  }

  render();
  if (!isStated(src)) return setStatus("retry", "Source unconfirmed");
  tick();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearTimeout(timer);
    else tick();
  });
}

function gateScan() {
  const unknown = scanAddresses(document.body.textContent, reg);
  document.body.dataset.gate = unknown.length ? "warn" : "ok";
  if (unknown.length) console.warn("[gate] address-shaped strings missing from stated registry:", unknown);
}

wireLinks();
wireCa();
watchTopHeight();
buildWall();
initProgress();
initSpotlight();
initParallax();
initStatement();
initKaraoke();
initReveal();
startMarket();
gateScan();
