// Tiny static server for local checks: node scripts/serve.mjs [dir] [port]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
const dir = process.argv[2] || "dist";
const port = Number(process.argv[3] || 4173);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };
createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  if (!p || p.endsWith("/")) p += "index.html";
  try {
    const body = await readFile(join(dir, p));
    res.writeHead(200, { "content-type": types[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}).listen(port, () => console.log(`serving ${dir} on http://localhost:${port}`));
