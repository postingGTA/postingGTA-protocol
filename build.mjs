// Build: src/ -> dist/ (deploy output). Zero config; exits non-zero on any problem.
import { build as esbuild, transform } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const STATES = ["stated", "absent", "unconfirmed"];
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function validateRegister(reg) {
  const errs = [];
  for (const k of ["site", "chain", "ca", "x", "github", "buy", "market-source"]) {
    if (!reg[k]) errs.push(`register: missing record "${k}"`);
    else if (!STATES.includes(reg[k].state)) errs.push(`register: "${k}" has invalid state`);
  }
  if (reg.ca?.state === "stated" && !BASE58.test(reg.ca.value || "")) errs.push("register: stated CA is not a base58 address");
  for (const k of ["x", "github", "buy"]) if (reg[k]?.state === "stated" && !reg[k].url) errs.push(`register: stated "${k}" needs a url`);
  return errs;
}

export async function build({ register, out = join(ROOT, "dist") } = {}) {
  const regPath = register || join(ROOT, "src", "register.json");
  const reg = JSON.parse(readFileSync(regPath, "utf8"));
  const errs = validateRegister(reg);
  if (errs.length) throw new Error(errs.join("\n"));

  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  await esbuild({ entryPoints: [join(ROOT, "src/js/main.js")], bundle: true, minify: true, format: "iife", target: "es2022", outfile: join(out, "app.js"), logLevel: "silent" });

  const tokens = readFileSync(join(ROOT, "src/css/tokens.css"), "utf8");
  const main = readFileSync(join(ROOT, "src/css/main.css"), "utf8");
  const css = await transform(tokens + "\n" + main, { loader: "css", minify: true });
  writeFileSync(join(out, "app.css"), css.code);

  const ink = /--ink:\s*(#[0-9a-fA-F]{6})/.exec(tokens)?.[1];
  if (!ink) throw new Error("tokens.css: --ink not found");
  const json = JSON.stringify(reg).replace(/</g, "\\u003c");
  const html = readFileSync(join(ROOT, "src/index.html"), "utf8").replace("/*REGISTER*/", json).replace("__THEME__", ink);
  writeFileSync(join(out, "index.html"), html);

  // Explicit asset copy: favicon + brand logo files must land in dist/.
  cpSync(join(ROOT, "src/public"), out, { recursive: true });
  for (const f of ["favicon.svg", "brand/logo.png", "brand/mark.png"]) {
    if (!existsSync(join(out, f))) throw new Error(`dist is missing ${f}`);
  }
  return { out, reg };
}

if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  build()
    .then(({ out }) => {
      const files = [];
      const walk = (d) => readdirSync(d).forEach((n) => { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : files.push(p.slice(out.length + 1) + " " + statSync(p).size + "B"); });
      walk(out);
      console.log("built dist/:\n  " + files.join("\n  "));
    })
    .catch((e) => {
      console.error("BUILD FAILED:", e.message);
      process.exit(1);
    });
}
