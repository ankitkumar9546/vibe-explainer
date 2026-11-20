// Serve a folder over http://127.0.0.1:<port> (to check the static demo locally).
// Usage: node scripts/serve-static.mjs [dir=site] [port=4500]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "site");
const port = Number(process.argv[3] ?? 4500);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".gif": "image/gif", ".png": "image/png" };
http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "index.html";
  const file = path.resolve(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`serving ${root} at http://127.0.0.1:${port}/`));
