import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import {
  Store, recordHook, snapshotBefore, finishTurn, projectIdFor, writeJson, startServer,
  buildTodo, buildExport, saveQuiz, readQuiz, learningRecord, sessionRecord, chatPrompt, askSession, checkExplanation,
} from "@vibe-explainer/core";

const STATIC = fileURLToPath(new URL("../packages/console", import.meta.url));
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const T0 = "2026-11-21T10:00:00.000Z";

const turnOf = (over = {}) => ({ v: 1, n: 1, prompt: "add login", status: "closed", startedAt: T0, after: { commit: "b" }, files: [{ path: "src/auth.js", status: "modified", add: 3, del: 1 }], ...over });
const run = (cmd, ok = true, out = "") => ({ kind: "tool_end", tool: "Bash", target: cmd, ok, result: { stdout: out }, ts: T0, turn: 1 });
const lessonOf = (over = {}) => ({
  title: "login() takes a password", summary: "It now needs a password.", why: "w", how: [], before: "b", after: "login(email, password)",
  asks: [{ text: "take a password", status: "done", evidence: "diff" }],
  claims: [{ text: "tests pass", status: "backed", evidence: "npm test ok", at: 3 }],
  impact: [], concepts: [{ name: "parameter", explain: "an input" }],
  quiz: [{ q: "q1", options: ["a", "b", "c"], answer: 1, explain: "e" }, { q: "q2", options: ["a", "b", "c"], answer: 0, explain: "e" }],
  errors: [], notes: [], decision: null, manualTest: null, ...over,
});

test("to-do: a clean, tested turn gives an empty list; an open turn gives nothing", () => {
  assert.deepEqual(buildTodo({ turn: turnOf(), events: [run("npm test")], lesson: lessonOf() }), []);
  assert.deepEqual(buildTodo({ turn: turnOf({ status: "open" }), events: [], lesson: null }), []);
});

test("to-do: every item comes from a piece of evidence", () => {
  const lesson = lessonOf({
    claims: [{ text: "tests pass", status: "none", evidence: "no test command ran" }, { text: "emails are sent", status: "unverified", evidence: "needs the server" }, { text: "added x", status: "backed", evidence: "diff" }],
    asks: [{ text: "take a password", status: "done", evidence: "diff" }, { text: "update the pages", status: "no", evidence: "pages not in FILES" }],
    impact: [{ where: "src/pages/Login.js:4", risk: 3, title: "Login page breaks", why: "old call", fix: "pass it", prompt: "Update Login.js" }, { where: "x", risk: 1, title: "minor", why: "", fix: "", prompt: "" }],
  });
  const analysis = { symbols: [], security: [{ rule: "secret", severity: "high", file: "a.js", line: 2, text: "[masked]" }, { rule: "weak-hash", severity: "low", file: "a.js", line: 9, text: "" }] };
  const items = buildTodo({ turn: turnOf(), events: [], lesson, analysis });
  const ids = items.map((i) => i.id).sort();
  assert.deepEqual(ids, ["ask-1", "check-1", "claim-0", "impact-0", "sec-0", "tests-none"]);
  assert.equal(items[0].risk, 3, "highest risk first");
  assert.match(items.find((i) => i.id === "claim-0").prompt.en, /no evidence for it \(no test command ran\)/);
  assert.equal(items.find((i) => i.id === "impact-0").prompt.en, "Update Login.js");
  assert.equal(items.find((i) => i.id === "check-1").prompt, null, "a claim to check yourself has nothing to send");
});

test("to-do: a failed last test run is an item; docs-only changes don't ask for tests", () => {
  const failed = buildTodo({ turn: turnOf(), events: [run("npm test", false, "1 failing\nexpected 2")], lesson: lessonOf() });
  assert.deepEqual(failed.map((i) => i.id), ["tests-failed"]);
  assert.match(failed[0].d, /npm test[\s\S]*expected 2/);
  assert.deepEqual(buildTodo({ turn: turnOf({ files: [{ path: "README.md", status: "modified", add: 1, del: 0 }] }), events: [], lesson: lessonOf() }), []);
});

test("to-do: without a lesson, risky functions come from the analysis", () => {
  const analysis = { symbols: [{ file: "src/auth.js", name: "login", start: 3, risk: 3, callers: [{ file: "src/p.js", line: 4, kind: "call" }, { file: "src/p.js", line: 1, kind: "import" }] }, { file: "x.js", name: "y", start: 1, risk: 1, callers: [] }], security: [] };
  const items = buildTodo({ turn: turnOf(), events: [run("npm test")], lesson: null, analysis });
  assert.deepEqual(items.map((i) => i.kind), ["impact"]);
  assert.equal(items[0].d, "src/auth.js:3 → src/p.js:4");
});

const two = () => [
  { turn: turnOf({ n: 1, prompt: "add login\nwith a form" }), events: [run("npm test")], lesson: lessonOf() },
  { turn: turnOf({ n: 2, prompt: "/vibe-explainer:explain" }), events: [], lesson: null },
  { turn: turnOf({ n: 3, prompt: "add logout", files: [{ path: "src/auth.js", status: "modified", add: 2, del: 0 }, { path: "src/new.js", status: "added", add: 5, del: 0 }] }), events: [run("npm test", false)], lesson: null },
];

test("export: the PR description lists changes, files, open checks and real test runs", () => {
  const pr = buildExport("pr", { project: "mini", turns: two() }, "en");
  assert.equal(pr, [
    "## What changed",
    "- login() takes a password",
    "  It now needs a password.",
    "- add logout",
    "",
    "## Files",
    "- `src/auth.js` modified (+5 −1)",
    "- `src/new.js` added (+5 −0)",
    "",
    "## Things to check",
    "- Fix the failing tests (`npm test`)",
    "",
    "## Tests",
    "- `npm test`: passed",
    "- `npm test`: failed",
    "",
  ].join("\n"));
  assert.ok(!pr.includes("vibe-explainer"), "our own /vibe-explainer prompts are left out");
});

test("export: commit message and day note", () => {
  const commit = buildExport("commit", { project: "mini", turns: two() }, "en");
  assert.equal(commit.split("\n")[0], "add logout");
  assert.match(commit, /^- login\(\) takes a password\n- add logout\n\nFiles: src\/auth\.js, src\/new\.js\nTests: npm test \(pass\); npm test \(fail\)\nOpen: 1 thing to check\.\n$/m);
  const note = buildExport("note", { project: "mini", turns: two() }, "hi");
  assert.match(note, /^2026-11-21, mini pe:\n• add login → login\(email, password\)\n• add logout\n\nNaye concepts: parameter\n\n2 prompts, 2 files, 1\/2 test runs pass\.\n$/);
  assert.match(buildExport("pr", { project: "mini", turns: [] }, "en"), /no finished prompt/);
});

function storeWithLessons() {
  const home = tmp("vx-home-"), proj = tmp("vx-p8-");
  fs.writeFileSync(path.join(proj, "a.js"), "export const a = 1;\n");
  const store = new Store({ home });
  const opts = { store, env: {}, onTurnOpened: (c) => snapshotBefore(c.store, c), onTurnClosed: (c) => finishTurn(c.store, c) };
  const base = { session_id: "s1", cwd: proj };
  for (const [i, body] of ["export const a = 2; // sk-ant-api03-" + "Z".repeat(40) + "\n", "export const a = 3;\n"].entries()) {
    recordHook({ ...base, hook_event_name: "UserPromptSubmit", prompt: `change a ${i + 1}` }, opts);
    fs.writeFileSync(path.join(proj, "a.js"), body);
    recordHook({ ...base, hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "npm test" }, tool_response: { stdout: "ok" } }, opts);
    recordHook({ ...base, hook_event_name: "Stop" }, opts);
  }
  const projectId = projectIdFor(proj);
  writeJson(path.join(store.turnDir(projectId, "s1", 1), "lesson.json"), lessonOf({ concepts: [{ name: "parameter", explain: "x" }, { name: "export", explain: "y" }] }));
  writeJson(path.join(store.turnDir(projectId, "s1", 2), "lesson.json"), lessonOf({ title: "a is 3", concepts: [{ name: "const", explain: "z" }] }));
  return { store, projectId, proj };
}

test("quiz answers are saved (first answer counts) and decide the learning record", () => {
  const { store, projectId } = storeWithLessons();
  const ids = { projectId, sessionId: "s1", turn: 1 };
  assert.equal(learningRecord(store, projectId).facts.solid, 0);
  assert.deepEqual(saveQuiz(store, ids, { question: 0, answer: 1 }).answers, { 0: 1 });
  saveQuiz(store, ids, { question: 0, answer: 2 }); // ignored: already answered
  saveQuiz(store, ids, { question: 1, answer: 0 });
  assert.deepEqual(readQuiz(store, ids), { 0: 1, 1: 0 });
  saveQuiz(store, { ...ids, turn: 2 }, { question: 0, answer: 0 }); // wrong
  assert.equal(saveQuiz(store, ids, { question: 5, answer: 0 }).ok, false);
  const rec = learningRecord(store, projectId);
  assert.deepEqual(rec.concepts.map((c) => [c.name, c.status]), [["parameter", "solid"], ["export", "solid"], ["const", "weak"]]);
  assert.deepEqual(rec.facts, { prompts: 2, lessons: 2, files: 1, noEvidence: 0, solid: 2, concepts: 3 });
  saveQuiz(store, ids, { reset: true });
  assert.deepEqual(readQuiz(store, ids), {});
  assert.equal(learningRecord(store, projectId).concepts[0].status, "new");
});

test("chat: the record is masked, the focus turn brings its diff, and the answer comes back", async () => {
  const { store, projectId } = storeWithLessons();
  const rec = sessionRecord(store, { projectId, sessionId: "s1", focusTurn: 1 });
  assert.match(rec, /### TURN 1 \(closed\)[\s\S]*DIFF OF THIS TURN/);
  assert.ok(!/DIFF OF THIS TURN[\s\S]*### TURN 2[\s\S]*DIFF OF THIS TURN/.test(rec), "only the focus turn's diff");
  assert.ok(!rec.includes("Z".repeat(40)), "secrets are masked");
  const p = chatPrompt(rec, { question: "did the tests run?", lang: "en", focusTurn: 1, history: [{ who: "me", t: "hi" }] });
  assert.match(p, /=== QUESTION ===\ndid the tests run\?/);
  assert.match(p, /USER: hi/);
  let asked = "";
  const teacher = { name: "fake", ask: async (q) => { asked = q; return "Yes: turn 1 ran `npm test`."; } };
  const r = await askSession(store, { projectId, sessionId: "s1" }, { teacher, question: "did the tests run?", lang: "en", focusTurn: 2 });
  assert.deepEqual(r, { ok: true, answer: "Yes: turn 1 ran `npm test`." });
  assert.match(asked, /The user is looking at turn 2/);
  assert.equal((await askSession(store, { projectId, sessionId: "s1" }, { teacher, question: "  " })).ok, false);
});

test("explain-back: the verdict is validated, with one retry", async () => {
  const { store, projectId } = storeWithLessons();
  const answers = ["not json", '{"verdict":"partly","feedback":"Right file, but `a` is 2 now.","missed":["the value"]}'];
  const teacher = { name: "fake", ask: async () => answers.shift() };
  const r = await checkExplanation(store, { projectId, sessionId: "s1", turn: 1 }, { teacher, text: "It changed a in a.js", lang: "en" });
  assert.deepEqual(r, { ok: true, verdict: "partly", feedback: "Right file, but `a` is 2 now.", missed: ["the value"] });
  assert.equal((await checkExplanation(store, { projectId, sessionId: "s1", turn: 1 }, { teacher, text: "short" })).ok, false);
});

function call(port, method, p, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: p, method, headers: { host: `127.0.0.1:${port}`, "content-type": "application/json" } }, (res) => {
      let b = ""; res.on("data", (d) => { b += d; }); res.on("end", () => resolve({ status: res.statusCode, json: (() => { try { return JSON.parse(b); } catch { return b; } })() }));
    });
    req.on("error", reject);
    req.end(body == null ? undefined : typeof body === "string" ? body : JSON.stringify(body));
  });
}

test("server: to-do in the turn, quiz, export, record and chat endpoints", async () => {
  const { store, projectId } = storeWithLessons();
  const t = "y".repeat(36), q = `t=${t}&project=${projectId}&session=s1`;
  const srv = await startServer(store, { staticDir: STATIC, port: 0, token: t, makeTeacher: () => ({ name: "fake", ask: async (p) => `answer about: ${/=== QUESTION ===\n(.*)/.exec(p)[1]}` }) });
  try {
    const turn = (await call(srv.port, "GET", `/api/turn?${q}&turn=1`)).json;
    assert.deepEqual(turn.todo.map((i) => [i.id, i.rule]), [["sec-0", "secret"]], "turn 1 planted a key; the to-do says so");
    assert.ok(!JSON.stringify(turn.todo).includes("Z".repeat(40)));
    assert.deepEqual(turn.quiz, {});
    assert.equal((await call(srv.port, "POST", `/api/quiz?${q}&turn=1`, { question: 0, answer: 1 })).json.answers[0], 1);
    assert.deepEqual((await call(srv.port, "GET", `/api/turn?${q}&turn=1`)).json.quiz, { 0: 1 });
    assert.equal((await call(srv.port, "GET", `/api/quiz?${q}&turn=1`)).status, 405);
    assert.equal((await call(srv.port, "POST", `/api/quiz?${q}&turn=1`, "{bad")).status, 400);
    const ex = (await call(srv.port, "GET", `/api/export?${q}&kind=commit&lang=en`)).json;
    assert.equal(ex.text.split("\n")[0], "a is 3");
    assert.equal((await call(srv.port, "GET", `/api/record?t=${t}&project=${projectId}`)).json.facts.lessons, 2);
    const chat = await call(srv.port, "POST", `/api/chat?${q}`, { question: "what changed?", lang: "en", turn: 1 });
    assert.deepEqual(chat, { status: 200, json: { ok: true, answer: "answer about: what changed?" } });
    assert.equal((await call(srv.port, "POST", `/api/chat?t=wrong&project=${projectId}&session=s1`, { question: "x" })).status, 401);
  } finally { await srv.close(); }
});
