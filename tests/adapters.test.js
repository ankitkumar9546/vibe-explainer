import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import {
  Store, recordHook, snapshotBefore, finishTurn, projectIdFor, readJson, teachTurn, validateLesson,
  makeTeacher, ollamaTeacher, geminiTeacher, openaiTeacher, setConfig, loadConfig,
} from "@vibe-explainer/core";

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

const LESSON = {
  title: "add() checks its inputs", summary: "s", asks: [{ text: "check inputs", status: "done", evidence: "diff" }], why: "w", how: ["h"],
  before: "b", after: "a", decision: null, errors: [], notes: [], claims: [], impact: [{ where: "calc.js", risk: 1, title: "t", why: "w", fix: "f", prompt: "" }],
  concepts: [{ name: "TypeError", explain: "e" }], quiz: [{ q: "q", options: ["a", "b", "c"], answer: 0, explain: "e" }], manualTest: { steps: ["s"], expect: "e" },
};

function turn() {
  const home = tmp("vx-home-"), proj = tmp("vx-ad-");
  fs.writeFileSync(path.join(proj, "calc.js"), "export const add = (a, b) => a + b;\n");
  const store = new Store({ home });
  const opts = { store, env: {}, onTurnOpened: (c) => snapshotBefore(c.store, c), onTurnClosed: (c) => finishTurn(c.store, c) };
  recordHook({ session_id: "s", cwd: proj, hook_event_name: "UserPromptSubmit", prompt: "check inputs" }, opts);
  fs.writeFileSync(path.join(proj, "calc.js"), "export const add = (a, b) => { if (typeof a !== 'number') throw new TypeError('x'); return a + b; };\n");
  recordHook({ session_id: "s", cwd: proj, hook_event_name: "Stop" }, opts);
  return { store, home, ids: { projectId: projectIdFor(proj), sessionId: "s", turn: 1 } };
}

/** A fetch that records the request and answers like the provider would. */
function fakeFetch(answer, status = 200) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    return { ok: status < 300, status, text: async () => JSON.stringify(answer) };
  };
  return { fn, calls };
}

const lessonText = "Here you go:\n```json\n" + JSON.stringify(LESSON) + "\n```";
const shapes = {
  gemini: { candidates: [{ content: { parts: [{ text: lessonText.slice(0, 40) }, { text: lessonText.slice(40) }] }, finishReason: "STOP" }] },
  openai: { choices: [{ message: { role: "assistant", content: lessonText }, finish_reason: "stop" }] },
};

test("every teacher gives the same lesson.json shape", async () => {
  const keys = [];
  // Ollama, end to end over real HTTP
  const srv = http.createServer((req, res) => {
    let b = ""; req.on("data", (d) => { b += d; }); req.on("end", () => {
      const body = JSON.parse(b);
      assert.equal(req.url, "/api/chat"); assert.equal(body.stream, false); assert.match(body.messages[0].content, /=== DIFF ===/);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ model: body.model, message: { role: "assistant", content: lessonText }, done: true }));
    });
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  try {
    const teachers = {
      ollama: ollamaTeacher({ model: "tiny", url: `http://127.0.0.1:${srv.address().port}` }),
      gemini: geminiTeacher({ model: "g", env: { GEMINI_API_KEY: "k1" }, fetchFn: fakeFetch(shapes.gemini).fn }),
      openai: openaiTeacher({ model: "o", env: { OPENAI_API_KEY: "k2" }, fetchFn: fakeFetch(shapes.openai).fn }),
    };
    for (const [name, teacher] of Object.entries(teachers)) {
      const { store, ids } = turn();
      const r = await teachTurn(store, ids, { teacher, lang: "en" });
      assert.equal(r.ok, true, `${name}: ${r.error}`);
      const l = readJson(path.join(store.turnDir(ids.projectId, ids.sessionId, 1), "lesson.json"));
      assert.deepEqual(validateLesson(l), [], name);
      assert.equal(l.teacher, { ollama: "ollama:tiny", gemini: "gemini:g", openai: "openai:o" }[name]);
      keys.push(Object.keys(l).sort().join(","));
    }
  } finally { srv.close(); }
  assert.equal(new Set(keys).size, 1, "same fields from each teacher");
});

test("requests go where each provider expects, with the key only in a header", async () => {
  const g = fakeFetch(shapes.gemini);
  await geminiTeacher({ model: "gemini-x", env: { GEMINI_API_KEY: "secret-g" }, fetchFn: g.fn }).ask("hello");
  assert.equal(g.calls[0].url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent");
  assert.equal(g.calls[0].headers["x-goog-api-key"], "secret-g");
  assert.ok(!g.calls[0].url.includes("secret-g"), "the key is never in the URL");
  assert.deepEqual(g.calls[0].body.contents, [{ role: "user", parts: [{ text: "hello" }] }]);

  const o = fakeFetch(shapes.openai);
  await openaiTeacher({ model: "m", env: { OPENAI_API_KEY: "secret-o" }, fetchFn: o.fn, baseUrl: "https://openrouter.example/api/v1/" }).ask("hi");
  assert.equal(o.calls[0].url, "https://openrouter.example/api/v1/chat/completions");
  assert.equal(o.calls[0].headers.authorization, "Bearer secret-o");
  assert.deepEqual(o.calls[0].body.messages, [{ role: "user", content: "hi" }]);

  const local = fakeFetch(shapes.openai);
  await openaiTeacher({ env: {}, baseUrl: "http://localhost:1234/v1", fetchFn: local.fn }).ask("x");
  assert.equal(local.calls[0].headers.authorization, undefined, "a local server needs no key");
});

test("clear errors: no key, a refused key, an unreachable Ollama; a failed lesson says why", async () => {
  await assert.rejects(geminiTeacher({ env: {} }).ask("x"), /set GEMINI_API_KEY/);
  await assert.rejects(openaiTeacher({ env: {} }).ask("x"), /set OPENAI_API_KEY/);
  await assert.rejects(openaiTeacher({ env: { OPENAI_API_KEY: "bad" }, fetchFn: fakeFetch({ error: { message: "Incorrect API key provided" } }, 401).fn }).ask("x"), /answered 401: Incorrect API key provided/);
  await assert.rejects(ollamaTeacher({ url: "http://127.0.0.1:9", timeoutMs: 3000 }).ask("x"), /Ollama \(.*\) is not reachable/);
  await assert.rejects(geminiTeacher({ env: { GEMINI_API_KEY: "k" }, fetchFn: fakeFetch({ candidates: [], promptFeedback: { blockReason: "SAFETY" } }).fn }).ask("x"), /blocked: SAFETY/);
  const { store, ids } = turn();
  const r = await teachTurn(store, ids, { teacher: geminiTeacher({ env: {} }) });
  assert.equal(r.ok, false);
  assert.match(readJson(path.join(store.turnDir(ids.projectId, "s", 1), "turn.json")).lessonError, /GEMINI_API_KEY/);
});

test("config picks the teacher; keys can't be stored in it", () => {
  const home = tmp("vx-home-");
  assert.equal(makeTeacher(loadConfig(home), { home }).name, "claude");
  setConfig(home, "teacher", "ollama"); setConfig(home, "model", "llama3.2");
  assert.equal(makeTeacher(loadConfig(home), { home }).name, "ollama:llama3.2");
  setConfig(home, "teacher", "openai"); setConfig(home, "model", "");
  assert.equal(makeTeacher(loadConfig(home), { home }).name, "openai:gpt-4.1-mini");
  assert.throws(() => setConfig(home, "teacher", "bard"), /teacher must be one of/);
  assert.throws(() => setConfig(home, "openaiApiKey", "sk-x"), /unknown setting/);
  assert.ok(!fs.readFileSync(path.join(home, "config.json"), "utf8").includes("sk-"));
});
