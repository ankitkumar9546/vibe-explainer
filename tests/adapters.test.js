import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import {
  Store, recordHook, snapshotBefore, finishTurn, projectIdFor, readJson, teachTurn, validateLesson,
  makeTeacher, ollamaTeacher, geminiTeacher, openaiTeacher, setConfig, loadConfig,
  resolveAgentTeacher, agentCliTeacher, setKey, clearKey, getKey, keyStatus, startServer,
} from "@vibe-explainer/core";
import { fileURLToPath } from "node:url";

const STATIC = fileURLToPath(new URL("../packages/console", import.meta.url));
/** A fake "is this CLI installed" check. */
const only = (...cmds) => (c) => cmds.includes(c);

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
  assert.equal(loadConfig(home).teacher, "agent", "the default follows the agent");
  assert.equal(makeTeacher(loadConfig(home), { home, has: only("claude") }).name, "claude");
  setConfig(home, "teacher", "ollama"); setConfig(home, "model", "llama3.2");
  assert.equal(makeTeacher(loadConfig(home), { home }).name, "ollama:llama3.2");
  setConfig(home, "teacher", "openai"); setConfig(home, "model", "");
  assert.equal(makeTeacher(loadConfig(home), { home }).name, "openai:gpt-4.1-mini");
  assert.throws(() => setConfig(home, "teacher", "bard"), /teacher must be one of/);
  assert.throws(() => setConfig(home, "openaiApiKey", "sk-x"), /unknown setting/);
  assert.ok(!fs.readFileSync(path.join(home, "config.json"), "utf8").includes("sk-"));
});

test("'the same AI you code with' follows the session's agent, and falls back to claude", async () => {
  assert.deepEqual(resolveAgentTeacher({ source: "claude-code" }, only("claude")), { kind: "claude", wanted: "claude", fallback: false });
  assert.deepEqual(resolveAgentTeacher({ source: "watch", agent: "Cursor" }, only("claude", "cursor-agent")), { kind: "cursor", wanted: "cursor", fallback: false });
  assert.deepEqual(resolveAgentTeacher({ source: "watch", agent: "codex" }, only("claude", "codex")).kind, "codex");
  assert.deepEqual(resolveAgentTeacher({ source: "watch", agent: "gemini" }, only("gemini")).kind, "gemini-cli");
  assert.deepEqual(resolveAgentTeacher({ source: "watch", agent: "cursor" }, only("claude")), { kind: "claude", wanted: "cursor", fallback: true });
  const home = tmp("vx-home-");
  const t = makeTeacher({ teacher: "agent" }, { home, hint: { source: "watch", agent: "cursor" }, has: only("claude") });
  assert.equal(t.name, "claude"); assert.match(t.via, /cursor not installed, so claude/);
  const none = makeTeacher({ teacher: "agent" }, { home, hint: { source: "watch", agent: "aider" }, has: only() });
  assert.equal(none.name, "none");
  await assert.rejects(none.ask("x"), /Choose your own model in the console's ⚙ settings/);
});

test("agent CLIs: the prompt goes on stdin, codex's last message is read from its file", async () => {
  const home = tmp("vx-home-"), calls = [];
  const run = async (cmd, args, o) => {
    calls.push({ cmd, args, input: o.input, internal: o.env.VIBE_EXPLAINER_INTERNAL });
    const i = args.indexOf("--output-last-message");
    if (i >= 0) { fs.writeFileSync(args[i + 1], "from codex"); return "codex logs, not the answer"; }
    return cmd === "gemini" ? "from gemini" : "";
  };
  assert.equal(await agentCliTeacher("codex", { home, run }).ask("P1"), "from codex");
  assert.deepEqual(calls[0].args.slice(0, 4), ["exec", "--skip-git-repo-check", "--sandbox", "read-only"]);
  assert.equal(calls[0].input, "P1"); assert.equal(calls[0].internal, "1");
  assert.equal(fs.readdirSync(path.join(home, "tmp", "teacher")).length, 0, "the answer file is removed");
  assert.equal(await agentCliTeacher("gemini-cli", { home, run, model: "gemini-x" }).ask("P2"), "from gemini");
  assert.deepEqual(calls[1].args, ["-m", "gemini-x"]);
  await assert.rejects(agentCliTeacher("cursor", { home, run }).ask("P3"), /Cursor gave an empty answer/);
  assert.deepEqual(calls[2].args.slice(0, 3), ["-p", "--output-format", "text"]);
});

test("keys: saved only on this computer, the environment wins, shown only as the last 4 characters", () => {
  const home = tmp("vx-home-");
  assert.throws(() => setKey(home, "gemini", "has spaces in it"), /doesn't look like an API key/);
  setKey(home, "gemini", "AIzaFAKE-1234-abcd");
  assert.equal(getKey(home, "gemini", {}), "AIzaFAKE-1234-abcd");
  assert.equal(getKey(home, "gemini", { GEMINI_API_KEY: "from-env" }), "from-env");
  assert.deepEqual(keyStatus(home, "gemini", {}), { source: "saved", hint: "…abcd" });
  assert.deepEqual(keyStatus(home, "openai", {}), null);
  assert.ok(!fs.readFileSync(path.join(home, "config.json"), { flag: "a+" }).toString().includes("AIza"), "never in config.json");
  if (process.platform !== "win32") assert.equal(fs.statSync(path.join(home, "keys.json")).mode & 0o077, 0, "owner-only file");
  // the saved key reaches the adapter
  const t = makeTeacher({ teacher: "gemini" }, { home, env: {}, fetchFn: async (url, init) => { assert.equal(init.headers["x-goog-api-key"], "AIzaFAKE-1234-abcd"); return { ok: true, status: 200, text: async () => JSON.stringify(shapes.gemini) }; } });
  return t.ask("x").then(() => { clearKey(home, "gemini"); assert.equal(getKey(home, "gemini", {}), null); assert.equal(fs.existsSync(path.join(home, "keys.json")), false); });
});

test("server: settings save the teacher and a key, never return the key, and test the connection", async () => {
  const home = tmp("vx-home-"), store = new Store({ home });
  const tok = "s".repeat(36);
  const srv = await startServer(store, { staticDir: STATIC, port: 0, token: tok, makeTeacher: () => ({ name: "fake:1", via: null, ask: async () => "OK" }) });
  const call = (method, p, body) => fetch(`http://127.0.0.1:${srv.port}${p}${p.includes("?") ? "&" : "?"}t=${tok}`, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());
  try {
    const s0 = await call("GET", "/api/settings");
    assert.equal(s0.teacher, "agent"); assert.ok("claude" in s0.available); assert.deepEqual(s0.keys, { gemini: null, openai: null });
    const s1 = await call("POST", "/api/settings", { teacher: "openai", model: "gpt-x", openaiBaseUrl: "https://openrouter.example/api/v1", key: { provider: "openai", value: "sk-or-FAKE-9876wxyz" } });
    assert.deepEqual([s1.teacher, s1.model, s1.openaiBaseUrl, s1.keys.openai.hint], ["openai", "gpt-x", "https://openrouter.example/api/v1", "…wxyz"]);
    assert.ok(!JSON.stringify(s1).includes("sk-or-FAKE"), "the key is never sent back");
    assert.equal((await call("POST", "/api/settings", { teacher: "bard" })).ok, false);
    assert.equal((await call("POST", "/api/settings", { key: { provider: "openai", clear: true } })).keys.openai, null);
    const test1 = await call("POST", "/api/settings/test", {});
    assert.deepEqual([test1.ok, test1.teacher, test1.reply], [true, "fake:1", "OK"]);
  } finally { await srv.close(); }
});
