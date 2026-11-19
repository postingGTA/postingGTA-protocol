// Motion layer: spring reveal, parallax, progress, spotlight, statement, karaoke, hero wall.
import { springStep, settled } from "./spring.js";
import { still } from "./board.js";

const $ = (id) => document.getElementById(id);
const RISE = 28;

export function initReveal() {
  const items = [...document.querySelectorAll(".reveal")];
  if (still() || !("IntersectionObserver" in window)) {
    items.forEach((e) => (e.style.opacity = "1"));
    return;
  }
  const active = new Set();
  let raf = 0;
  let last = 0;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    let steps = Math.max(1, Math.round(dt * 120));
    for (const s of active) {
      if (now < s.t0) continue;
      for (let i = 0; i < steps; i++) springStep(s, 0);
      if (settled(s, 0)) {
        s.el.style.transform = "";
        s.el.style.opacity = "1";
        active.delete(s);
      } else {
        s.el.style.transform = `translate3d(0, ${s.x.toFixed(2)}px, 0)`;
        s.el.style.opacity = String(Math.max(0, Math.min(1, 1 - s.x / RISE)));
      }
    }
    raf = active.size ? requestAnimationFrame(frame) : 0;
  };
  const io = new IntersectionObserver(
    (entries) => {
      const hit = entries.filter((e) => e.isIntersecting);
      hit.forEach((e, i) => {
        io.unobserve(e.target);
        active.add({ el: e.target, x: RISE, v: 0, t0: performance.now() + i * 80 });
        e.target.style.transform = `translate3d(0, ${RISE}px, 0)`;
      });
      if (hit.length && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    },
    { rootMargin: "0px 0px -8% 0px" }
  );
  items.forEach((e) => io.observe(e));
}

export function initProgress() {
  const bar = $("progress").firstElementChild;
  const on = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
  };
  addEventListener("scroll", on, { passive: true });
  addEventListener("resize", on);
  on();
}

export function initSpotlight() {
  document.addEventListener(
    "pointermove",
    (e) => {
      const t = e.target.closest?.(".spot");
      if (!t) return;
      const r = t.getBoundingClientRect();
      t.style.setProperty("--mx", e.clientX - r.left + "px");
      t.style.setProperty("--my", e.clientY - r.top + "px");
    },
    { passive: true }
  );
}

export function initParallax() {
  const hero = $("hero");
  if (still()) return;
  const layers = [...hero.querySelectorAll("[data-depth]")];
  const cur = { x: 0, y: 0 };
  const tgt = { x: 0, y: 0 };
  let visible = true;
  let raf = 0;
  const paint = () => {
    cur.x += (tgt.x - cur.x) * 0.08;
    cur.y += (tgt.y - cur.y) * 0.08;
    const sy = Math.min(scrollY, innerHeight);
    for (const l of layers) {
      const d = parseFloat(l.dataset.depth);
      l.style.transform = `translate3d(${(-cur.x * d * 40).toFixed(2)}px, ${(-cur.y * d * 40 + sy * d * 0.3).toFixed(2)}px, 0)`;
    }
    raf = visible ? requestAnimationFrame(paint) : 0;
  };
  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    tgt.x = (e.clientX - r.left) / r.width - 0.5;
    tgt.y = (e.clientY - r.top) / r.height - 0.5;
  });
  hero.addEventListener("pointerleave", () => ((tgt.x = 0), (tgt.y = 0)));
  new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(paint);
  }).observe(hero);
  raf = requestAnimationFrame(paint);
}

export function initStatement() {
  const st = $("statement");
  const HOT = new Set(["$POSTING.", "scoreboard", "receipts."]);
  st.innerHTML = st.textContent.trim().split(/\s+/).map((w) => `<span class="w${HOT.has(w) ? " hot" : ""}">${w.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span> `).join("");
  const words = [...st.querySelectorAll(".w")];
  const light = () => {
    const r = st.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)));
    const n = Math.round(p * words.length);
    words.forEach((w, i) => w.classList.toggle("lit", i < n));
  };
  addEventListener("scroll", light, { passive: true });
  light();
}

export function initKaraoke() {
  const LINES = [["NO", "RAMP,", "NO", "FEAR"], ["TOOK", "THE", "BRIDGE"], ["THEY", "LOST", "US"]];
  const caps = $("caps");
  const score = $("scoreN");
  if (still()) {
    caps.innerHTML = LINES[0].map((w) => `<span>${w}</span>`).join("");
    return;
  }
  let li = 0;
  let wi = 0;
  const tick = () => {
    if (wi === 0) caps.innerHTML = LINES[li].map((w) => `<span>${w}</span>`).join("");
    [...caps.children].forEach((s, i) => s.classList.toggle("on", i === wi));
    wi++;
    if (wi >= caps.children.length) {
      wi = 0;
      li = (li + 1) % LINES.length;
      setTimeout(tick, 620);
      return;
    }
    setTimeout(tick, 300);
  };
  tick();
  setInterval(() => (score.textContent = 88 + Math.floor(Math.random() * 10)), 2600);
}

// Hero wall: tiles drawn in code, drifting in four columns.
export function buildWall() {
  const CAPS = ["Moment finder · scoring", "Caption lab · word by word", "Cross-post · three feeds", "Board · live movers"];
  const wall = $("wall");
  const grid = document.createElement("div");
  grid.className = "vgrid";
  for (let c = 0; c < 4; c++) {
    const col = document.createElement("div");
    col.className = "vcol c" + (c + 1);
    const track = document.createElement("div");
    track.className = "vtrack";
    for (let i = 0; i < 6; i++) {
      const k = (c + i) % 4;
      const f = document.createElement("figure");
      f.className = "vt k" + k;
      f.innerHTML = `<div class="art"></div><figcaption>${CAPS[k]}</figcaption>`;
      track.appendChild(f);
    }
    col.appendChild(track);
    grid.appendChild(col);
  }
  wall.appendChild(grid);
}

export function watchTopHeight() {
  const top = $("topwrap");
  const set = () => document.documentElement.style.setProperty("--top-h", top.offsetHeight + "px");
  set();
  const solid = () => top.classList.toggle("solid", scrollY > innerHeight * 0.6);
  addEventListener("scroll", solid, { passive: true });
  solid();
  if ("ResizeObserver" in window) new ResizeObserver(set).observe(top);
  addEventListener("resize", set);
}
