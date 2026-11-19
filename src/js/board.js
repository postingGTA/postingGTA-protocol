// DOM rendering for the market board, ticker and stack. Keyed rows, count-up and flash on change.
import { fmtPrice, fmtCompact, fmtPct } from "./format.js";

export const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const BRAND_MARK = "brand/mark.png";
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const hashTone = (s) => {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return "t" + (h % 4);
};

// Logo: candidate image urls in order, then (own token only) the brand mark, then a letter tile.
export function makeLogo(cands, symbol, { brand = false, forceBrand = false } = {}) {
  const box = el("span", "lg");
  const list = forceBrand ? [] : [...cands];
  let i = 0;
  let brandDone = false;
  const tile = () => {
    box.className = "lg tile " + hashTone(symbol || "?");
    box.replaceChildren(document.createTextNode((symbol || "?").trim().charAt(0).toUpperCase() || "?"));
  };
  const next = () => {
    if (i < list.length) return put(list[i++], false);
    if ((brand || forceBrand) && !brandDone) {
      brandDone = true;
      return put(BRAND_MARK, true);
    }
    tile();
  };
  const put = (src, isBrand) => {
    box.className = "lg" + (isBrand ? " brand" : "");
    const img = new Image();
    img.alt = "";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.onerror = next;
    img.src = src;
    box.replaceChildren(img);
  };
  next();
  return box;
}

// Count-up with flash on change. Reduced motion: instant.
export function setNum(cell, value, fmt, { signed = false } = {}) {
  const prev = cell._v;
  if (value == null) {
    cancelAnimationFrame(cell._raf);
    cell.textContent = "—";
    cell._v = null;
    cell.classList.remove("up", "dn");
    return;
  }
  if (prev === value) return;
  cell._v = value;
  if (signed) {
    cell.classList.toggle("up", value > 0);
    cell.classList.toggle("dn", value < 0);
  }
  if (still()) {
    cell.textContent = fmt(value);
    return;
  }
  const from = prev == null ? 0 : prev;
  const dur = prev == null ? 900 : 600;
  const t0 = performance.now();
  cancelAnimationFrame(cell._raf);
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    cell.textContent = fmt(p >= 1 ? value : from + (value - from) * e);
    if (p < 1) cell._raf = requestAnimationFrame(step);
  };
  cell._raf = requestAnimationFrame(step);
  if (prev != null) {
    const cls = value > prev ? "flash-up" : "flash-down";
    cell.classList.remove("flash-up", "flash-down");
    void cell.offsetWidth;
    cell.classList.add(cls);
    clearTimeout(cell._ft);
    cell._ft = setTimeout(() => cell.classList.remove(cls), 950);
  }
}

function buildRow() {
  const r = el("div", "row spot");
  r.setAttribute("role", "row");
  r.innerHTML =
    '<span class="n"></span><span class="tok"><span class="slot"></span><span class="nm"><b class="sym"></b><small class="name"></small></span></span>' +
    '<span class="c price"></span><span class="c chg"></span><span class="c vol"></span><span class="c liq"></span>';
  return r;
}
function buildSkel() {
  const r = el("div", "row skel");
  r.innerHTML =
    '<span class="n"></span><span class="tok"><span class="lg"></span><span class="nm"><i class="sk"></i></span></span>' +
    '<span class="c price"><i class="sk w2"></i></span><span class="c chg"><i class="sk w2"></i></span><span class="c vol"><i class="sk w2"></i></span><span class="c liq"><i class="sk w2"></i></span>';
  return r;
}

export function createBoard(rowsEl, noteEl) {
  const nodes = new Map();
  let firstLive = true;

  function fillRow(node, row, n) {
    node.querySelector(".n").textContent = String(n);
    if (row.kind === "ph" || row.kind === "err") {
      const sym = row.symbol ?? "—";
      node.querySelector(".sym").textContent = sym;
      node.querySelector(".name").textContent = row.name ?? "";
      for (const c of ["price", "chg", "vol", "liq"]) {
        const cell = node.querySelector("." + c);
        cell.textContent = row.kind === "ph" ? "· · · · ·" : "—";
        cell._v = undefined;
      }
      return;
    }
    const sym = node.querySelector(".sym");
    const name = node.querySelector(".name");
    sym.textContent = row.symbol || (row.address ? row.address.slice(0, 4) + "…" : "—");
    name.textContent = row.name || "";
    const sig = row.img.join("|");
    if (node._sig !== sig) {
      node._sig = sig;
      node.querySelector(".tok").replaceChild(makeLogo(row.img, row.symbol || row.address, { brand: row.own }), node.querySelector(".tok").firstChild);
    }
    setNum(node.querySelector(".price"), row.price, fmtPrice);
    setNum(node.querySelector(".chg"), row.chg, fmtPct, { signed: true });
    setNum(node.querySelector(".vol"), row.vol, fmtCompact);
    setNum(node.querySelector(".liq"), row.liq, fmtCompact);
  }

  function render(rows, note) {
    const seen = new Set();
    let stagger = 0;
    rows.forEach((row, i) => {
      seen.add(row.key);
      let node = nodes.get(row.key);
      const fresh = !node;
      if (fresh) {
        if (row.kind === "skel") node = buildSkel();
        else {
          node = buildRow();
          node.querySelector(".slot").replaceWith(el("span", "lg"));
          if (row.kind === "ph") node.querySelector(".tok").replaceChild(makeLogo([], row.symbol, { forceBrand: true }), node.querySelector(".tok").firstChild);
          if (!still()) node.classList.add("live");
        }
        nodes.set(row.key, node);
      }
      if (row.kind !== "skel") {
        node.classList.toggle("own", !!row.own);
        node.classList.toggle("ph", row.kind === "ph");
        if (row.kind === "skel") return;
        fillRow(node, row, i + 1);
      } else node.querySelector(".n").textContent = String(i + 1);
      if (rowsEl.children[i] !== node) rowsEl.insertBefore(node, rowsEl.children[i] || null);
      if (fresh && node.classList.contains("live")) {
        node.style.transitionDelay = (firstLive ? stagger++ * 55 : 0) + "ms";
        requestAnimationFrame(() => requestAnimationFrame(() => node.classList.add("in")));
      }
    });
    for (const [k, node] of nodes) {
      if (!seen.has(k)) {
        node.remove();
        nodes.delete(k);
      }
    }
    if (rows.some((r) => r.kind !== "skel" && r.kind !== "ph" && r.kind !== "err")) firstLive = false;
    noteEl.hidden = !note;
    noteEl.textContent = note || "";
  }
  return { render };
}

// Ticker: same live data, built once per key set, updated in place after that.
export function createTicker(track) {
  let sig = "";
  const skeleton = () => {
    track.replaceChildren();
    for (let s = 0; s < 2; s++) {
      const set = el("div", "tk-set");
      if (s) set.setAttribute("aria-hidden", "true");
      for (let i = 0; i < 8; i++) {
        const t = el("div", "tk sk");
        t.appendChild(el("i"));
        set.appendChild(t);
      }
      track.appendChild(set);
    }
  };
  skeleton();
  function item(r) {
    const t = el("div", "tk");
    t.append(makeLogo(r.img, r.symbol || r.address), el("span", "sy"), el("span", "px"), el("span", "ch"));
    t.firstChild.style.width = t.firstChild.style.height = "22px";
    return t;
  }
  function paint(t, r) {
    t.querySelector(".sy").textContent = r.symbol || "—";
    t.querySelector(".px").textContent = fmtPrice(r.price);
    const ch = t.querySelector(".ch");
    ch.textContent = fmtPct(r.chg);
    ch.className = "ch " + (r.chg > 0 ? "up" : r.chg < 0 ? "dn" : "");
  }
  return {
    render(rows) {
      const list = rows.filter((r) => r.symbol);
      if (!list.length) return;
      const s = list.map((r) => r.key).join();
      if (s !== sig) {
        sig = s;
        track.replaceChildren();
        for (let c = 0; c < 2; c++) {
          const set = el("div", "tk-set");
          if (c) set.setAttribute("aria-hidden", "true");
          list.forEach((r) => set.appendChild(item(r)));
          track.appendChild(set);
        }
      }
      track.querySelectorAll(".tk-set").forEach((set) => set.querySelectorAll(".tk").forEach((t, i) => paint(t, list[i])));
    },
  };
}

// Stack of floating cards (rotates every 2.8 s unless hovered, hidden or reduced motion).
export function createStack(box) {
  const SHOW = 4;
  let notes = [];
  let head = 0;
  let sig = "";
  let timer = 0;
  let hover = false;
  const place = () => {
    const n = notes.length;
    const h = box.clientHeight;
    const dx = box.clientWidth < 520 ? 0 : -14;
    notes.forEach((nt, i) => {
      const k = (i - head + n) % n;
      const shown = k < SHOW;
      nt.style.zIndex = String(20 - k);
      nt.style.opacity = shown ? String(1 - k * 0.2) : "0";
      nt.style.transform = `translate(${k * dx}px, ${h - 92 - (shown ? k : SHOW) * 88}px) scale(${1 - k * 0.035})`;
    });
  };
  const skeleton = () => {
    notes = [];
    box.replaceChildren();
    for (let i = 0; i < SHOW; i++) {
      const n = el("div", "note sk");
      n.innerHTML = '<span class="lg"></span><div class="b"><div class="t"></div><div class="d"></div></div>';
      box.appendChild(n);
      notes.push(n);
    }
    place();
  };
  skeleton();
  addEventListener("resize", () => notes.length && place());
  box.addEventListener("mouseenter", () => (hover = true));
  box.addEventListener("mouseleave", () => (hover = false));
  return {
    render(rows) {
      const list = rows.filter((r) => r.symbol).slice(0, 6);
      if (list.length < 2) return;
      const s = list.map((r) => r.key).join();
      if (s !== sig) {
        sig = s;
        box.replaceChildren();
        notes = list.map((r) => {
          const n = el("div", "note");
          n.append(makeLogo(r.img, r.symbol), el("div", "b"), el("div", "end"));
          n.querySelector(".b").append(el("div", "t"), el("div", "d"));
          box.appendChild(n);
          return n;
        });
        head = 0;
        place();
        clearInterval(timer);
        if (!still() && list.length > 1)
          timer = setInterval(() => {
            if (!hover && !document.hidden) {
              head = (head - 1 + notes.length) % notes.length;
              place();
            }
          }, 2800);
      }
      notes.forEach((n, i) => {
        const r = list[i];
        n.querySelector(".t").textContent = r.symbol + (r.name ? " · " + r.name : "");
        n.querySelector(".d").textContent = fmtPrice(r.price) + "  ·  vol " + fmtCompact(r.vol);
        const e = n.querySelector(".end");
        e.textContent = fmtPct(r.chg);
        e.className = "end " + (r.chg > 0 ? "up" : r.chg < 0 ? "dn" : "");
      });
    },
  };
}
