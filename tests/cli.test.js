import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mergeHooks, initProject, HOOK_EVENTS } from "../packages/cli/src/init.js";
import { Store, projectIdFor } from "@vibe-explainer/core";

const BIN = fileURLToPath(new URL("../packages/cli/bin/vibe-explainer.js", import.meta.url));

test("init adds our hooks and keeps the user's own settings", () => {
  const existing = { permissions: { allow: ["Bash(ls)"] }, hooks: { Stop: [{ hooks: [{ type: "command", command: "say done" }] }] } };
  const out = mergeHooks(existing, "node x/vibe-explainer.js hook");
  assert.deepEqual(out.permissions, existing.permissions);
  for (const ev of HOOK_EVENTS) assert.ok(out.hooks[ev].some((e) => e.hooks[0].command.includes("vibe-explainer")), ev);
  assert.equal(out.hooks.Stop.length, 2);
  assert.equal(out.hooks.PreToolUse[0].matcher, "*");
  // running it twice does not duplicate
  const again = mergeHooks(out, "node x/vibe-explainer.js hook");
  assert.equal(again.hooks.Stop.length, 2);
  // remove takes only ours out
  const removed = mergeHooks(again, null);
  assert.deepEqual(removed.hooks, { Stop: [{ hooks: [{ type: "command", command: "say done" }] }] });
});

test("init refuses a broken settings file and changes nothing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vx-init-"));
  fs.mkdirSync(path.join(dir, ".claude"));
  fs.writeFileSync(path.join(dir, ".claude", "settings.local.json"), "{ broken");
  assert.throws(() => initProject(dir, { binPath: BIN }));
  assert.equal(fs.readFileSync(path.join(dir, ".claude", "settings.local.json"), "utf8"), "{ broken");
});

function hook(payload, home, extraEnv = {}) {
  return spawnSync(process.execPath, [BIN, "hook"], { input: typeof payload === "string" ? payload : JSON.stringify(payload), env: { ...process.env, VIBE_EXPLAINER_HOME: home, VIBE_EXPLAINER_INTERNAL: "", ...extraEnv }, encoding: "utf8" });
}

test("the hook command records, always exits 0, and stays quick", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "vx-home-"));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "vx-proj-"));
  const t0 = Date.now();
  const r = hook({ hook_event_name: "UserPromptSubmit", session_id: "abc", cwd, prompt: "hello" }, home);
  const ms = Date.now() - t0;
  assert.equal(r.status, 0, r.stderr);
  const ev = new Store({ home }).readEvents(projectIdFor(cwd), "abc");
  assert.equal(ev.length, 1);
  assert.equal(ev[0].prompt, "hello");
  assert.ok(ms < 2000, `hook took ${ms}ms`); // generous for CI; real budget is ~100ms of our own work

  assert.equal(hook("{ not json", home).status, 0);
  assert.equal(hook("", home).status, 0);
  const internal = hook({ hook_event_name: "UserPromptSubmit", session_id: "zzz", cwd, prompt: "x" }, home, { VIBE_EXPLAINER_INTERNAL: "1" });
  assert.equal(internal.status, 0);
  assert.equal(new Store({ home }).readEvents(projectIdFor(cwd), "zzz").length, 0);
});
