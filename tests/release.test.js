import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { VERSION } from "@vibe-explainer/core";
import { SERVER_INFO } from "../packages/mcp/src/server.js";
import { stage, manifest, releaseNotes, brokenImports, BINS } from "../scripts/pack-npm.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PACK = path.join(ROOT, "scripts", "pack-npm.mjs");

test("one version everywhere: core, plugin.json, MCP server, CLI, CHANGELOG", () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, ".claude-plugin", "plugin.json"), "utf8")).version, VERSION);
  assert.equal(SERVER_INFO.version, VERSION);
  const cli = spawnSync(process.execPath, [path.join(ROOT, "packages/cli/bin/vibe-explainer.js"), "--version"], { encoding: "utf8" });
  assert.equal(cli.stdout.trim(), VERSION);
  assert.ok(releaseNotes(VERSION).length > 200, "the CHANGELOG has notes for this version");
});

test("the tag check refuses a tag that is not v + version", () => {
  const ok = spawnSync(process.execPath, [PACK, "--check-tag", `v${VERSION}`], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
  const bad = spawnSync(process.execPath, [PACK, "--check-tag", "v9.9.9"], { encoding: "utf8" });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /does not match version/);
});

test("the staged npm package is self-contained and its commands run", () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "vx-pack-")), "npm");
  const { dir, files } = stage(out);
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  assert.deepEqual(pkg, manifest());
  assert.equal(pkg.name, "vibe-explainer");
  assert.equal(pkg.dependencies, undefined, "no dependencies");
  for (const f of [...Object.values(BINS), "packages/console/index.html", "packages/core/src/index.js", "README.md", "LICENSE", "CHANGELOG.md"]) assert.ok(files.includes(f), f);
  assert.ok(!files.some((f) => /^(tests|docs|demo|plugin|scripts|site)\//.test(f) || f.includes("node_modules")), "nothing from outside the product");
  assert.deepEqual(brokenImports(dir), []);

  const env = { ...process.env, VIBE_EXPLAINER_HOME: fs.mkdtempSync(path.join(os.tmpdir(), "vx-home-")) };
  const v = spawnSync(process.execPath, [path.join(dir, BINS["vibe-explainer"]), "--version"], { encoding: "utf8", env });
  assert.equal(v.stdout.trim(), VERSION);
  const init = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
  const mcp = spawnSync(process.execPath, [path.join(dir, BINS["vibe-explainer-mcp"])], { input: `${init}\n`, encoding: "utf8", env });
  assert.equal(JSON.parse(mcp.stdout.trim()).result.serverInfo.version, VERSION);
});
