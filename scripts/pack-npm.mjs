#!/usr/bin/env node
// Build the one npm package, `vibe-explainer`, in dist/npm (Roadmap Phase 13).
//
// The packages import each other by relative path (../../core/src/index.js), so the npm package
// keeps the repo's packages/ layout instead of being four separate packages. It has no dependencies.
//
//   node scripts/pack-npm.mjs                  stage dist/npm
//   node scripts/pack-npm.mjs --check-tag v0.1.0   fail unless the tag is v + VERSION
//   node scripts/pack-npm.mjs --notes v0.1.0       print that version's CHANGELOG section
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VERSION } from "../packages/core/src/version.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** What goes into the package, relative to the repo root. Directories are copied whole. */
export const CONTENTS = [
  "packages/core/src",
  "packages/cli/bin",
  "packages/cli/src",
  "packages/console",
  "packages/mcp/src",
  "packages/mcp/bin",
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
];

export const BINS = {
  "vibe-explainer": "packages/cli/bin/vibe-explainer.js",
  "vibe-explainer-mcp": "packages/mcp/bin/vibe-explainer-mcp.js",
};

export function manifest() {
  return {
    name: "vibe-explainer",
    version: VERSION,
    description: "See what your AI coding agent did, explained like a teacher: timeline, diff in plain words, impact, claims checked against evidence, quiz. Runs on your machine.",
    type: "module",
    bin: BINS,
    engines: { node: ">=22" },
    license: "MIT",
    author: "Ankit Kumar",
    homepage: "https://github.com/ankitkumar9546/vibe-explainer#readme",
    repository: { type: "git", url: "git+https://github.com/ankitkumar9546/vibe-explainer.git" },
    bugs: { url: "https://github.com/ankitkumar9546/vibe-explainer/issues" },
    keywords: ["claude-code", "ai-agent", "explain", "diff", "teacher", "learning", "mcp", "cursor", "hinglish"],
  };
}

/** Every relative import in the staged .js files must resolve inside the package. */
export function brokenImports(dir) {
  const bad = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".js")) {
        const src = fs.readFileSync(p, "utf8");
        for (const m of src.matchAll(/(?:from|import)\s*\(?\s*"(\.{1,2}\/[^"]+)"/g)) {
          const target = path.resolve(path.dirname(p), m[1]);
          if (!target.startsWith(dir + path.sep) || !fs.existsSync(target)) bad.push(`${path.relative(dir, p)} → ${m[1]}`);
        }
      }
    }
  };
  walk(dir);
  return bad;
}

/** Stage the package in outDir (wiped first). Returns the list of files. */
export function stage(outDir = path.join(ROOT, "dist", "npm")) {
  outDir = path.resolve(outDir);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const rel of CONTENTS) fs.cpSync(path.join(ROOT, rel), path.join(outDir, rel), { recursive: true });
  fs.writeFileSync(path.join(outDir, "package.json"), `${JSON.stringify(manifest(), null, 2)}\n`);
  for (const bin of Object.values(BINS)) if (!fs.existsSync(path.join(outDir, bin))) throw new Error(`missing bin: ${bin}`);
  const bad = brokenImports(outDir);
  if (bad.length) throw new Error(`imports that leave the package:\n  ${bad.join("\n  ")}`);
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else files.push(path.relative(outDir, p).replace(/\\/g, "/")); } };
  walk(outDir);
  return { dir: outDir, files };
}

/** The CHANGELOG section for a version ("## 0.1.0 …" up to the next "## "). */
export function releaseNotes(version = VERSION, changelog = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8")) {
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^## \\[?${version.replace(/\./g, "\\.")}\\]?(\\s|$)`).test(l));
  if (start < 0) throw new Error(`CHANGELOG.md has no section for ${version}`);
  const end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  return lines.slice(start + 1, end < 0 ? undefined : end).join("\n").trim();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [flag, value] = process.argv.slice(2);
  try {
    if (flag === "--check-tag") {
      if (value !== `v${VERSION}`) throw new Error(`tag ${value} does not match version ${VERSION} (packages/core/src/version.js)`);
      console.log(`tag ${value} matches`);
    } else if (flag === "--notes") {
      console.log(releaseNotes(String(value ?? "").replace(/^v/, "") || VERSION));
    } else {
      releaseNotes(); // a release without notes is a mistake: fail before anything is published
      const { dir, files } = stage();
      console.log(`staged vibe-explainer@${VERSION} in ${path.relative(process.cwd(), dir) || dir}: ${files.length} files`);
    }
  } catch (err) {
    console.error(String(err.message ?? err));
    process.exit(1);
  }
}
