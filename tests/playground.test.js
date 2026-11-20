import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  Store, recordHook, snapshotBefore, finishTurn, projectIdFor, readJson, writeJson, startServer,
  prepareSandbox, removeSandbox, runInSandbox, detectCommands, applyEdit, safeRel, makePlayground, validatePlayground, lineDiff, diffText,
} from "@vibe-explainer/core";

const STATIC = fileURLToPath(new URL("../packages/console", import.meta.url));
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const w = (dir, f, s) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), s); };

/** Hash of every file under a folder (paths + bytes). */
function fingerprint(dir) {
  const h = crypto.createHash("sha256");
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else { h.update(path.relative(dir, p)); h.update(fs.readFileSync(p)); }
    }
  };
  walk(dir);
  return h.digest("hex");
}

/** A tiny node project with a real test, and one recorded turn that changed add(). */
function project() {
  const home = tmp("vx-home-"), proj = tmp("vx-pg-");
  w(proj, "package.json", JSON.stringify({ name: "calc", type: "module", scripts: { test: "node --test" } }));
  w(proj, "calc.js", "export function add(a, b) {\n  return a + b;\n}\n");
  w(proj, "calc.test.js", "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from './calc.js';\ntest('add', () => assert.equal(add(2, 3), 5));\n");
  w(proj, "index.html", "<h1>calc v1</h1>\n");
  w(proj, "node_modules/dep/index.js", "module.exports = 1;\n"); // stands in for installed packages
  const store = new Store({ home });
  const opts = { store, env: {}, onTurnOpened: (c) => snapshotBefore(c.store, c), onTurnClosed: (c) => finishTurn(c.store, c) };
  const base = { session_id: "s1", cwd: proj };
  recordHook({ ...base, hook_event_name: "UserPromptSubmit", prompt: "make add check numbers" }, opts);
  w(proj, "calc.js", "export function add(a, b) {\n  if (typeof a !== 'number' || typeof b !== 'number') throw new TypeError('numbers only');\n  return a + b;\n}\n");
  w(proj, "index.html", "<h1>calc v2</h1>\n");
  recordHook({ ...base, hook_event_name: "Stop" }, opts);
  const projectId = projectIdFor(proj);
  const t = readJson(path.join(store.turnDir(projectId, "s1", 1), "turn.json"));
  return { home, proj, store, projectId, commit: t.after.commit, before: t.before.commit, ids: { projectId, sessionId: "s1", turn: 1 } };
}

test("safeRel refuses paths that leave the folder", () => {
  for (const bad of ["../x", "/etc/passwd", "C:/x", "a/../../b", ".git/config", ""]) assert.throws(() => safeRel(bad), /bad path/, bad);
  assert.equal(safeRel("./src\\a.js"), "src/a.js");
});

test("detectCommands reads package.json scripts from the snapshot", () => {
  const { home, projectId, commit } = project();
  assert.deepEqual(detectCommands(home, projectId, commit), { test: "npm test" });
});

test("a sandbox is the snapshot plus edits, with dependency links that are removed first", () => {
  const { store, proj, projectId, commit } = project();
  const before = fingerprint(proj);
  const sb = prepareSandbox(store, { projectId, commit, edits: { "calc.js": "changed\n" }, projectDir: proj });
  assert.equal(fs.readFileSync(path.join(sb.dir, "calc.js"), "utf8"), "changed\n");
  assert.match(fs.readFileSync(path.join(sb.dir, "calc.test.js"), "utf8"), /add\(2, 3\)/);
  assert.equal(fs.readFileSync(path.join(sb.dir, "node_modules/dep/index.js"), "utf8"), "module.exports = 1;\n", "dependencies are reachable");
  assert.throws(() => prepareSandbox(store, { projectId, commit, edits: { "../escape.js": "x" } }), /bad path/);
  removeSandbox(store, projectId, sb.id);
  assert.equal(fs.existsSync(sb.dir), false);
  assert.equal(fs.readFileSync(path.join(proj, "node_modules/dep/index.js"), "utf8"), "module.exports = 1;\n", "removing a sandbox never touches the real node_modules");
  assert.equal(fingerprint(proj), before);
});

test("runInSandbox runs the real tests on the edited copy; the project stays byte-identical", async () => {
  const { store, proj, projectId, commit } = project();
  const before = fingerprint(proj);
  const good = await runInSandbox(store, { projectId, commit, projectDir: proj, commands: { test: "npm test" } });
  assert.equal(good.results[0].ok, true, good.results[0].out);
  const broken = await runInSandbox(store, { projectId, commit, projectDir: proj, commands: { test: "npm test" }, edits: { "calc.js": "export function add(a, b) {\n  return a - b;\n}\n" } });
  assert.equal(broken.results[0].ok, false);
  assert.match(broken.results[0].out, /fail/i);
  assert.equal(fingerprint(proj), before, "no playground run may change the user's tree");
  assert.deepEqual(fs.readdirSync(path.join(store.home, "sandbox", projectId)), [], "sandboxes are cleaned up");
});

test("applyEdit writes one file only when the real file is still the agent's version", () => {
  const { store, proj, projectId, commit } = project();
  const next = "export function add(a, b) {\n  return Number(a) + Number(b);\n}\n";
  assert.equal(applyEdit(store, { projectId, projectDir: proj, commit, path: "calc.js", content: next }).ok, true);
  assert.equal(fs.readFileSync(path.join(proj, "calc.js"), "utf8"), next);
  // the file has changed since the snapshot now, so a second apply is refused
  const r = applyEdit(store, { projectId, projectDir: proj, commit, path: "calc.js", content: "x" });
  assert.equal(r.ok, false);
  assert.match(r.error, /changed after the agent finished/);
  assert.equal(fs.readFileSync(path.join(proj, "calc.js"), "utf8"), next);
});

test("lineDiff and diffText show only what changed", () => {
  assert.deepEqual(lineDiff("a\nb\nc", "a\nB\nc"), [[" ", "a"], ["-", "b"], ["+", "B"], [" ", "c"]]);
  assert.equal(diffText("1\n2\n3\n4\n5\n6\n7", "1\n2\n3\nX\n5\n6\n7", 1), "  3\n- 4\n+ X\n  5");
});

test("playground: what-ifs must quote the real code exactly once, with one retry", async () => {
  const { store, ids } = project();
  const files = [{ path: "calc.js", content: "if (x) return 1;\nreturn 2;\n" }];
  assert.deepEqual(validatePlayground({ whatIf: [{ q: "q", options: ["a", "b"], answer: 0, file: "calc.js", find: "return 2;", replace: "return 3;" }], challenge: null }, files), []);
  assert.match(validatePlayground({ whatIf: [{ q: "q", options: ["a", "b"], answer: 0, file: "calc.js", find: "return", replace: "" }], challenge: null }, files)[0], /exactly once/);
  const good = { whatIf: [{ q: "What if the type check goes?", options: ["a", "b", "c"], answer: 1, file: "calc.js", find: "  if (typeof a !== 'number' || typeof b !== 'number') throw new TypeError('numbers only');\n", replace: "", explain: "e" }],
    challenge: { task: "Allow numeric strings", file: "calc.js", hints: ["h1", "h2", "h3"], solution: "Number(a)", test: { file: "challenge.test.js", content: "// t" } } };
  const answers = [JSON.stringify({ whatIf: [{ ...good.whatIf[0], find: "not in the file" }], challenge: good.challenge }), JSON.stringify(good)];
  const r = await makePlayground(store, ids, { teacher: { name: "fake", ask: async () => answers.shift() }, lang: "en" });
  assert.equal(r.ok, true, r.error);
  assert.equal(readJson(path.join(store.turnDir(ids.projectId, "s1", 1), "playground.json")).whatIf.length, 1);
});

function call(port, method, p, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: p, method, headers: { host: `127.0.0.1:${port}`, "content-type": "application/json", ...headers } }, (res) => {
      let b = Buffer.alloc(0); res.on("data", (d) => { b = Buffer.concat([b, d]); }); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text: b.toString("utf8"), json: (() => { try { return JSON.parse(b); } catch { return null; } })() }));
    });
    req.on("error", reject);
    req.end(body == null ? undefined : JSON.stringify(body));
  });
}

test("server: runs need permission, every action leaves the project untouched until a confirmed apply", async () => {
  const { store, proj, ids, projectId, commit, before: beforeCommit } = project();
  const fp = fingerprint(proj);
  writeJson(path.join(store.turnDir(projectId, "s1", 1), "playground.json"), { whatIf: [{ q: "q", options: ["a", "b", "c"], answer: 1, file: "calc.js", find: "return a + b;", replace: "return a - b;", explain: "e" }],
    challenge: { task: "t", file: "calc.js", hints: [], solution: "s", test: { file: "challenge.test.js", content: "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { add } from './calc.js';\ntest('strings', () => assert.equal(add('2', '3'), 5));\n" } } });
  const teacher = { name: "fake", ask: async () => '{"verdict":"bad","take":"Now it subtracts.","affects":"calc.test.js"}' };
  const t = "z".repeat(36), q = `t=${t}&project=${projectId}&session=s1&turn=1`;
  const srv = await startServer(store, { staticDir: STATIC, port: 0, token: t, makeTeacher: () => teacher });
  try {
    const info = (await call(srv.port, "GET", `/api/sandbox?${q}`)).json;
    assert.deepEqual([info.settings.allowed, info.detected.test, info.preview.after, info.preview.before], [false, "npm test", "index.html", "index.html"]);
    assert.equal((await call(srv.port, "POST", `/api/sandbox/run?${q}`, { kind: "ai" })).status, 403, "no runs before the user allows them");
    assert.equal((await call(srv.port, "POST", `/api/sandbox/allow?${q}`, { commands: { test: "npm test" } }, { "content-type": "text/plain" })).status, 415, "JSON only");
    assert.equal((await call(srv.port, "POST", `/api/sandbox/allow?${q}`, { commands: { test: "npm test" } }, { origin: "http://evil.example" })).status, 403, "same origin only");
    assert.equal((await call(srv.port, "POST", `/api/sandbox/allow?${q}`, { commands: { test: "npm test" } })).json.allowed, true);

    const edit = (await call(srv.port, "POST", `/api/sandbox/run?${q}`, { kind: "edit", path: "calc.js", content: "export function add(a, b) {\n  return a - b;\n}\n", lang: "en" })).json;
    assert.equal(edit.results[0].ok, false);
    assert.match(edit.diff, /\+   return a - b;/);
    assert.deepEqual(edit.take, { ok: true, verdict: "bad", take: "Now it subtracts.", affects: "calc.test.js" });
    const whatif = (await call(srv.port, "POST", `/api/sandbox/run?${q}`, { kind: "whatif", index: 0 })).json;
    assert.equal(whatif.results[0].ok, false, "removing + makes the test fail");
    const ch1 = (await call(srv.port, "POST", `/api/sandbox/run?${q}`, { kind: "challenge", content: "export function add(a, b) {\n  return a + b;\n}\n" })).json;
    assert.equal(ch1.results[0].ok, false, "'2'+'3' is '23', so the challenge test fails");
    const ch2 = (await call(srv.port, "POST", `/api/sandbox/run?${q}`, { kind: "challenge", content: "export function add(a, b) {\n  return Number(a) + Number(b);\n}\n" })).json;
    assert.equal(ch2.results[0].ok, true, ch2.results[0].out);

    // preview: before, after and "your version", on its own token
    assert.equal((await call(srv.port, "GET", `/preview/${info.preview.token}/${projectId}/${beforeCommit}/index.html`)).text, "<h1>calc v1</h1>\n");
    const after = await call(srv.port, "GET", `/preview/${info.preview.token}/${projectId}/${commit}/index.html`);
    assert.equal(after.text, "<h1>calc v2</h1>\n");
    assert.match(after.headers["content-security-policy"], /sandbox allow-scripts/);
    assert.equal((await call(srv.port, "GET", `/preview/${t}/${projectId}/${commit}/index.html`)).status, 401, "the API token is not a preview token");
    assert.equal((await call(srv.port, "GET", `/preview/${info.preview.token}/${projectId}/${edit.id}/calc.js`)).text, "export function add(a, b) {\n  return a - b;\n}\n");
    assert.equal((await call(srv.port, "GET", `/preview/${info.preview.token}/${projectId}/${edit.id}/node_modules/dep/index.js`)).status, 404, "dependency links are never served");

    assert.equal((await call(srv.port, "POST", `/api/sandbox/apply?${q}`, { path: "calc.js", content: "nope" })).status, 400, "apply needs confirm");
    assert.equal(fingerprint(proj), fp, "edit, what-if, challenge, preview and an unconfirmed apply changed nothing");
    assert.equal((await call(srv.port, "POST", `/api/sandbox/discard?${q}`, {})).json.ok, true);

    const fixed = "export function add(a, b) {\n  return Number(a) + Number(b);\n}\n";
    assert.equal((await call(srv.port, "POST", `/api/sandbox/apply?${q}`, { path: "calc.js", content: fixed, confirm: true })).json.ok, true);
    assert.equal(fs.readFileSync(path.join(proj, "calc.js"), "utf8"), fixed);
    assert.deepEqual(fs.readdirSync(path.join(store.home, "sandbox", projectId)), []);
  } finally { await srv.close(); }
});
