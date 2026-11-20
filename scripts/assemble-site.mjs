// Assemble the static demo site: the console + demo/demo-data.json → site/ (used locally and by the Pages workflow).
import fs from "node:fs";
import path from "node:path";

const out = path.resolve("site");
const data = path.resolve("demo", "demo-data.json");
if (!fs.existsSync(data)) { console.error("demo/demo-data.json is missing; run scripts/build-demo.mjs first"); process.exit(1); }
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.resolve("packages/console"), out, { recursive: true });
fs.copyFileSync(data, path.join(out, "demo-data.json"));
const html = fs.readFileSync(path.join(out, "index.html"), "utf8")
  .replace("<title>vibe-explainer</title>", "<title>vibe-explainer · demo</title>\n<meta name=\"description\" content=\"A real Claude Code session, recorded and explained by vibe-explainer.\">")
  .replace('<script type="module" src="app.js"></script>', '<script>window.VX_STATIC = "demo-data.json";</script>\n<script type="module" src="app.js"></script>');
fs.writeFileSync(path.join(out, "index.html"), html);
fs.writeFileSync(path.join(out, ".nojekyll"), "");
console.log(`site assembled: ${out}`);
