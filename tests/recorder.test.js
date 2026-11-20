import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { recordHook, Store, projectIdFor, truncate, targetOf } from "@vibe-explainer/core";

function tmpStore() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "vx-home-"));
  return new Store({ home });
}
const project = path.join(os.tmpdir(), "vx-project");
const base = { session_id: "s1", transcript_path: "/t/s1.jsonl", cwd: project };
const env = {}; // never the internal flag
let clock = 0;
const now = () => new Date(Date.UTC(2026, 10, 20, 10, 0, clock++)).toISOString();

function run(store, payload) { return recordHook({ ...base, ...payload }, { store, env, now: now() }); }

test("a full turn becomes the right events, in order", () => {
  const store = tmpStore();
  run(store, { hook_event_name: "SessionStart", source: "startup" });
  run(store, { hook_event_name: "UserPromptSubmit", prompt: "add a forgot password link" });
  run(store, { hook_event_name: "PreToolUse", tool_name: "Read", tool_input: { file_path: "src/LoginPage.jsx" } });
  run(store, { hook_event_name: "PostToolUse", tool_name: "Read", tool_input: { file_path: "src/LoginPage.jsx" }, tool_response: { content: "x" } });
  run(store, { hook_event_name: "PostToolUse", tool_name: "Edit", tool_input: { file_path: "src/auth.js", old_string: "a", new_string: "b" }, tool_response: {} });
  run(store, { hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "npm run lint" }, tool_response: { stdout: "", stderr: "1 error", is_error: true } });
  run(store, { hook_event_name: "Stop" });
  run(store, { hook_event_name: "SessionEnd", reason: "exit" });

  const id = projectIdFor(project);
  const ev = store.readEvents(id, "s1");
  assert.deepEqual(ev.map((e) => e.kind), ["session_start", "prompt", "tool_start", "tool_end", "tool_end", "tool_end", "stop", "session_end"]);
  assert.equal(ev[0].turn, 0);
  assert.ok(ev.slice(1, 7).every((e) => e.turn === 1));
  assert.equal(ev[1].prompt, "add a forgot password link");
  assert.equal(ev[3].target, "src/LoginPage.jsx");
  assert.equal(ev[4].input.new_string, "b");
  assert.equal(ev[5].target, "npm run lint");
  assert.equal(ev[5].ok, false);
  assert.equal(ev[3].ok, true);

  const turn = JSON.parse(fs.readFileSync(path.join(store.turnDir(id, "s1", 1), "turn.json"), "utf8"));
  assert.equal(turn.status, "closed");
  assert.equal(turn.prompt, "add a forgot password link");
  const session = store.listSessions(id)[0];
  assert.equal(session.transcriptPath, "/t/s1.jsonl");
  assert.ok(session.endedAt);
});

test("a second prompt opens turn 2", () => {
  const store = tmpStore();
  run(store, { hook_event_name: "UserPromptSubmit", prompt: "one" });
  run(store, { hook_event_name: "Stop" });
  const e = run(store, { hook_event_name: "UserPromptSubmit", prompt: "two" });
  assert.equal(e.turn, 2);
  const t = run(store, { hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: "a.txt", content: "hi" }, tool_response: {} });
  assert.equal(t.turn, 2);
});

test("our own runs are never recorded (no loop)", () => {
  const store = tmpStore();
  const r = recordHook({ ...base, hook_event_name: "UserPromptSubmit", prompt: "x" }, { store, env: { VIBE_EXPLAINER_INTERNAL: "1" }, now: now() });
  assert.equal(r, null);
  assert.equal(fs.existsSync(path.join(store.home, "projects")), false);
});

test("broken or unknown payloads write nothing", () => {
  const store = tmpStore();
  for (const p of [null, 42, "x", {}, { hook_event_name: "Stop" }, { session_id: "s", hook_event_name: "Notification" }]) {
    assert.equal(recordHook(p, { store, env, now: now() }), null);
  }
  assert.equal(fs.existsSync(path.join(store.home, "projects")), false);
});

test("long strings are cut", () => {
  const big = "a".repeat(5000);
  const out = truncate({ x: big, y: [big], z: 1 });
  assert.ok(out.x.length < 4100 && out.x.endsWith("[cut 1000 chars]"));
  assert.ok(out.y[0].endsWith("[cut 1000 chars]"));
  assert.equal(out.z, 1);
});

test("targets per tool", () => {
  assert.equal(targetOf("Edit", { file_path: "a.js" }), "a.js");
  assert.equal(targetOf("Bash", { command: "ls" }), "ls");
  assert.equal(targetOf("Grep", { pattern: "foo" }), "foo");
  assert.equal(targetOf("WebFetch", { url: "https://x" }), "https://x");
  assert.equal(targetOf("TodoWrite", { todos: [] }), null);
});
