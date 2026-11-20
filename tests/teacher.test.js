import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Store, recordHook, snapshotBefore, finishTurn, projectIdFor, readJson, maskSecrets, maskEnvFilesInPatch, extractJson, validateLesson, teachTurn, buildContext } from "@vibe-explainer/core";

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const w = (dir, f, s) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), s); };

const GOOD = {
  title: "Added add()", summary: "s", why: "w", before: "b", after: "a",
  asks: [{ text: "add add()", status: "done", evidence: "diff" }], how: ["x"], decision: null, errors: [], notes: [],
  claims: [{ text: "tests pass", status: "none", evidence: "no test ran", at: null }],
  impact: [{ where: "app.js", risk: 1, title: "new export", why: "w", fix: "none", prompt: "" }],
  concepts: [{ name: "function", explain: "e" }],
  quiz: [{ q: "q?", options: ["a", "b", "c"], answer: 1, explain: "e" }],
  manualTest: { steps: ["run"], expect: "works" },
};

/** A recorded turn with a diff and a transcript, like Claude Code would leave. */
function recordedTurn({ secret = false } = {}) {
  const home = tmp("vx-home-"), proj = tmp("vx-proj-");
  w(proj, "app.js", "export const a = 1;\n");
  const transcript = path.join(home, "t.jsonl");
  const store = new Store({ home });
  const opts = { store, env: {}, onTurnOpened: (c) => snapshotBefore(c.store, c), onTurnClosed: (c) => finishTurn(c.store, c) };
  const base = { session_id: "s1", cwd: proj, transcript_path: transcript };
  recordHook({ ...base, hook_event_name: "UserPromptSubmit", prompt: "add an add function" }, opts);
  w(proj, "app.js", "export const a = 1;\nexport function add(x, y) { return x + y; }\n");
  if (secret) w(proj, ".env", "API_KEY=sk-ant-THISISAFAKEKEY1234567890\n");
  if (secret) w(proj, "cfg.js", 'const token = "ghp_abcdefghijklmnopqrstuvwxyz0123456789";\n');
  recordHook({ ...base, hook_event_name: "PostToolUse", tool_name: "Edit", tool_input: { file_path: "app.js" }, tool_response: {} }, opts);
  const now = new Date().toISOString();
  fs.writeFileSync(transcript, [
    { type: "assistant", timestamp: now, message: { content: [{ type: "thinking", thinking: "I will add a function." }] } },
    { type: "assistant", timestamp: now, message: { content: [{ type: "text", text: "Done. Added add() and tests pass." }] } },
  ].map((r) => JSON.stringify(r)).join("\n"));
  recordHook({ ...base, hook_event_name: "Stop" }, opts);
  return { store, ids: { projectId: projectIdFor(proj), sessionId: "s1", turn: 1 } };
}

test("secrets are masked", () => {
  const s = maskSecrets('key sk-ant-abcdefghijklmnop12345 and ghp_abcdefghijklmnopqrstuvwxyz0123 and password = "hunter2hunter" and db postgres://u:p@h/db');
  assert.doesNotMatch(s, /sk-ant-abc|ghp_abc|hunter2|postgres:\/\/u/);
  assert.match(maskSecrets("apiKey: process.env.KEY"), /process\.env\.KEY/, "references to env vars are not secrets");
  const patch = "diff --git a/.env b/.env\n--- a/.env\n+++ b/.env\n+DB_PASS=whatever123\n diff --git a/x.js b/x.js";
  assert.doesNotMatch(maskEnvFilesInPatch(patch), /whatever123/);
});

test("JSON is pulled out of a chatty answer, and lessons are validated", () => {
  assert.deepEqual(extractJson('Sure!\n```json\n{"a": {"b": "}"}}\n```'), { a: { b: "}" } });
  assert.throws(() => extractJson("no json here"));
  assert.deepEqual(validateLesson(GOOD), []);
  assert.ok(validateLesson({ ...GOOD, claims: [{ text: "x", status: "maybe" }] }).length);
  assert.ok(validateLesson({ ...GOOD, quiz: [{ q: "q", options: ["a"], answer: 3 }] }).length);
});

test("context has the prompt, steps, diff and the agent's own words", () => {
  const { store, ids } = recordedTurn();
  const ctx = buildContext(store, ids);
  assert.equal(ctx.prompt, "add an add function");
  assert.match(ctx.steps, /Edit app\.js/);
  assert.match(ctx.diff, /\+export function add/);
  assert.match(ctx.thinking, /I will add a function/);
  assert.match(ctx.finalReply, /tests pass/);
});

test("teachTurn writes a valid lesson and marks the turn ready", async () => {
  const { store, ids } = recordedTurn();
  let asked = "";
  const res = await teachTurn(store, ids, { teacher: { name: "fake", ask: async (p) => { asked = p; return "Here you go: " + JSON.stringify(GOOD); } } });
  assert.equal(res.ok, true);
  const lesson = readJson(res.file);
  assert.equal(lesson.teacher, "fake");
  assert.equal(lesson.claims[0].status, "none");
  assert.equal(readJson(path.join(store.turnDir(ids.projectId, "s1", 1), "turn.json")).status, "ready");
  assert.match(asked, /=== AGENT FINAL REPLY ===\n[^\n]*tests pass/);
});

test("a bad answer is retried once with the problems, then fails cleanly", async () => {
  const { store, ids } = recordedTurn();
  const prompts = [];
  const flaky = { name: "fake", ask: async (p) => { prompts.push(p); return prompts.length === 1 ? '{"title": 1}' : JSON.stringify(GOOD); } };
  assert.equal((await teachTurn(store, ids, { teacher: flaky })).ok, true);
  assert.match(prompts[1], /could not be used: .*title must be a string/);

  const broken = { name: "fake", ask: async () => "I refuse" };
  const r = await teachTurn(store, ids, { teacher: broken });
  assert.equal(r.ok, false);
  const turn = readJson(path.join(store.turnDir(ids.projectId, "s1", 1), "turn.json"));
  assert.equal(turn.status, "failed");
  assert.match(turn.lessonError, /no JSON/);
});

test("a planted secret never reaches the teacher", async () => {
  const { store, ids } = recordedTurn({ secret: true });
  let asked = "";
  await teachTurn(store, ids, { teacher: { name: "fake", ask: async (p) => { asked = p; return JSON.stringify(GOOD); } } });
  assert.match(asked, /\.env/, "the .env file is still mentioned");
  assert.doesNotMatch(asked, /THISISAFAKEKEY|ghp_abcdefghij/);
});
