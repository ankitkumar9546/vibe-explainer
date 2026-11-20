import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  Store, recordHook, snapshotBefore, finishTurn, projectIdFor, readJson,
  findSymbols, ensureAnalysis, analysisText, scanAdded, diffPackages, packageFacts, buildContext,
} from "@vibe-explainer/core";

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const w = (dir, f, s) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), s); };

/** Run one fake agent turn: `edit()` changes the project between the prompt and Stop. */
function turn(store, proj, sessionId, edit) {
  const opts = { store, env: {}, onTurnOpened: (ctx) => snapshotBefore(ctx.store, ctx), onTurnClosed: (ctx) => finishTurn(ctx.store, ctx) };
  const base = { session_id: sessionId, cwd: proj };
  recordHook({ ...base, hook_event_name: "UserPromptSubmit", prompt: "do it" }, opts);
  edit();
  recordHook({ ...base, hook_event_name: "Stop" }, opts);
  return { projectId: projectIdFor(proj), sessionId, turn: store.currentTurn(projectIdFor(proj), sessionId) };
}

test("symbols: JS functions, arrows, classes and methods, with line ranges and parameters", () => {
  const src = [
    "import { http } from './http.js';",        // 1
    "export async function login(email, pass) {", // 2
    "  const r = await http.post(`/a/${email}`);", // 3
    "  if (!r.ok) { throw new Error('}'); }",     // 4
    "  return r;",                               // 5
    "}",                                         // 6
    "const fmt = (x) => x + 1;",                 // 7
    "export const twice = x => x * 2",           // 8
    "export class Store {",                      // 9
    "  async save(note) {",                      // 10
    "    return note;",                          // 11
    "  }",                                       // 12
    "}",                                         // 13
  ].join("\n");
  const s = Object.fromEntries(findSymbols("a.js", src).map((x) => [x.owner ? `${x.owner}.${x.name}` : x.name, x]));
  assert.deepEqual([s.login.start, s.login.end, s.login.params, s.login.exported], [2, 6, "email, pass", true]);
  assert.deepEqual([s.fmt.start, s.fmt.end, s.fmt.exported], [7, 7, false]);
  assert.deepEqual([s.twice.start, s.twice.end], [8, 8]);
  assert.deepEqual([s.Store.start, s.Store.end, s.Store.kind], [9, 13, "class"]);
  assert.deepEqual([s["Store.save"].start, s["Store.save"].end, s["Store.save"].kind, s["Store.save"].exported], [10, 12, "method", true]);
});

test("symbols: Python functions, classes and methods by indentation", () => {
  const src = "class A:\n    def run(self, x):\n        return helper(x)\n\ndef helper(y, z=1):\n    # note\n    return y\n\ndef _private():\n    pass\n";
  const s = Object.fromEntries(findSymbols("m.py", src).map((x) => [x.owner ? `${x.owner}.${x.name}` : x.name, x]));
  assert.deepEqual([s.A.start, s.A.end], [1, 3]);
  assert.deepEqual([s["A.run"].start, s["A.run"].end, s["A.run"].params], [2, 3, "self, x"]);
  assert.deepEqual([s.helper.start, s.helper.end, s.helper.params], [5, 7, "y, z=1"]);
  assert.equal(s._private.exported, false);
});

test("a changed function shows its callers; a removed one that is still called is high risk", () => {
  const home = tmp("vx-home-"), proj = tmp("vx-an-");
  w(proj, "src/auth.js", "export function login(email) {\n  return email;\n}\n\nexport function logout() {\n  return true;\n}\n");
  w(proj, "src/pages/Login.js", "import { login } from '../auth.js';\nexport function LoginPage() {\n  return login('a@b');\n}\n");
  w(proj, "src/pages/Signup.js", "import { login, logout } from '../auth.js';\nexport function SignupPage() {\n  logout();\n  return login('c@d');\n}\n");
  w(proj, "src/other.js", "// login is mentioned in a comment only\nexport const x = 1;\n");
  const store = new Store({ home });
  turn(store, proj, "s1", () => {}); // warm-up turn
  const ids = turn(store, proj, "s1", () => {
    w(proj, "src/auth.js", "export function login(email, password) {\n  if (!password) throw new Error('no password');\n  return email;\n}\n");
  });
  return ensureAnalysis(store, ids).then((a) => {
    const by = Object.fromEntries(a.symbols.map((s) => [s.name, s]));
    assert.equal(by.login.change, "modified");
    assert.equal(by.login.signatureChanged, true);
    assert.equal(by.login.paramsBefore, "email");
    const calls = by.login.callers.filter((c) => c.kind === "call").map((c) => `${c.file}:${c.line}:${c.in}`).sort();
    assert.deepEqual(calls, ["src/pages/Login.js:3:LoginPage", "src/pages/Signup.js:4:SignupPage"]);
    assert.ok(by.login.callers.some((c) => c.kind === "import"));
    assert.ok(!by.login.callers.some((c) => c.file === "src/other.js"), "comments are not callers");
    assert.equal(by.login.risk, 3, "parameters changed, two untested callers");
    assert.ok(by.login.reasons.includes("signature-changed") && by.login.reasons.includes("no-tests"));
    assert.equal(by.logout.change, "removed");
    assert.equal(by.logout.risk, 3);
    assert.deepEqual(by.logout.reasons.slice(0, 1), ["removed-still-used"]);
    // written next to the turn, and reused while the snapshot is the same
    const file = path.join(store.turnDir(ids.projectId, ids.sessionId, ids.turn), "analysis.json");
    assert.equal(readJson(file).after, a.after);
    assert.match(analysisText(a), /modified function login in src\/auth\.js:1 \(parameters were "email", now "email, password"\)/);
    assert.match(buildContext(store, ids).analysis, /used by: src\/pages\/Login\.js:3 in LoginPage/);
  });
});

test("Python: a changed method is found and its tested caller lowers the risk", async () => {
  const home = tmp("vx-home-"), proj = tmp("vx-py-");
  w(proj, "app/store.py", "class Store:\n    def save(self, note):\n        return note\n");
  w(proj, "app/api.py", "from app.store import Store\n\ndef create(n):\n    return Store().save(n)\n");
  w(proj, "tests/test_store.py", "from app.store import Store\n\ndef test_save():\n    assert Store().save(1) == 1\n");
  const store = new Store({ home });
  const ids = turn(store, proj, "p", () => w(proj, "app/store.py", "class Store:\n    def save(self, note, *, tag=None):\n        return note\n"));
  const a = await ensureAnalysis(store, ids);
  const save = a.symbols.find((s) => s.name === "save");
  assert.equal(save.kind, "method");
  assert.equal(save.owner, "Store");
  assert.equal(save.signatureChanged, true);
  assert.deepEqual(save.callers.filter((c) => c.kind === "call").map((c) => c.in).sort(), ["create", "test_save"]);
  assert.equal(save.tested, true);
  assert.equal(save.risk, 2);
  assert.ok(!a.symbols.some((s) => s.name === "Store"), "the class is not reported when only its method changed");
});

test("a new dependency is listed with its licence, size and downloads", async () => {
  const home = tmp("vx-home-"), proj = tmp("vx-pkg-");
  w(proj, "package.json", JSON.stringify({ name: "x", dependencies: { react: "^18.0.0", lodash: "4.17.20" } }, null, 2));
  w(proj, "requirements.txt", "requests==2.31.0\n");
  const store = new Store({ home });
  const ids = turn(store, proj, "k", () => {
    w(proj, "package.json", JSON.stringify({ name: "x", dependencies: { react: "^18.0.0", nanoid: "^5.0.9" }, devDependencies: { vitest: "^2.1.0" } }, null, 2));
    w(proj, "requirements.txt", "requests==2.32.3\nflask>=3\n");
  });
  const seen = [];
  const fetchFn = async (url) => {
    seen.push(url);
    const body = url.includes("downloads") ? { downloads: 123456 }
      : url.includes("pypi.org") ? { info: { license_expression: "BSD-3-Clause", summary: "web", version: "3.1.0" }, urls: [{ packagetype: "bdist_wheel", size: 100000 }] }
      : { license: "MIT", version: "5.0.9", description: "ids", dist: { unpackedSize: 12345 } };
    return { ok: true, json: async () => body };
  };
  const a = await ensureAnalysis(store, ids, { online: true, fetchFn });
  const by = Object.fromEntries(a.packages.map((p) => [`${p.eco}:${p.name}`, p]));
  assert.deepEqual(Object.keys(by).sort(), ["npm:lodash", "npm:nanoid", "npm:vitest", "pypi:flask", "pypi:requests"]);
  assert.equal(by["npm:nanoid"].change, "added");
  assert.deepEqual([by["npm:nanoid"].facts.license, by["npm:nanoid"].facts.size, by["npm:nanoid"].facts.weeklyDownloads], ["MIT", 12345, 123456]);
  assert.equal(by["npm:vitest"].dev, true);
  assert.equal(by["npm:lodash"].change, "removed");
  assert.equal(by["npm:lodash"].facts, undefined, "removed packages are not looked up");
  assert.deepEqual([by["pypi:requests"].change, by["pypi:requests"].from, by["pypi:requests"].to], ["changed", "==2.31.0", "==2.32.3"]);
  assert.equal(by["pypi:flask"].facts.license, "BSD-3-Clause");
  assert.ok(seen.includes("https://registry.npmjs.org/nanoid/5.0.9"), "an exact version is looked up when the range names one");
  // offline (the default) never fetches
  const ids2 = turn(store, proj, "k", () => w(proj, "package.json", JSON.stringify({ name: "x", dependencies: { react: "^18.0.0", nanoid: "^5.0.9", zod: "^3" } })));
  const before = seen.length;
  const b = await ensureAnalysis(store, ids2);
  assert.equal(seen.length, before);
  assert.equal(b.packages.find((p) => p.name === "zod").facts, undefined);
});

test("diffPackages ignores a package.json that is half-written", () => {
  assert.deepEqual(diffPackages([{ path: "package.json", before: "{\"dependencies\":{}}", after: "{\"dependencies\":{" }]), []);
});

test("packageFacts reports a registry error instead of guessing", async () => {
  await assert.rejects(packageFacts({ eco: "npm", name: "nope", to: "1.0.0" }, { fetchFn: async () => ({ ok: false, status: 404 }) }), /404/);
});

test("a planted secret is flagged (and masked), along with other risky patterns", async () => {
  const home = tmp("vx-home-"), proj = tmp("vx-sec-");
  w(proj, "server.js", "const app = 1;\n");
  const store = new Store({ home });
  const fake = "sk-ant-" + "api03-" + "A".repeat(40);
  const ids = turn(store, proj, "z", () => {
    w(proj, "server.js", [
      "const app = 1;",
      `const KEY = "${fake}";`,
      "app.get('/n', (req, res) => { el.innerHTML = req.query.q; });",
      "app.use((err, req, res, next) => res.send(err.stack));",
      "db.query(`SELECT * FROM notes WHERE id = ${req.params.id}`);",
      "eval(code);",
      "",
    ].join("\n"));
    w(proj, ".env", "API_TOKEN=hunter2hunter2\n");
  });
  const a = await ensureAnalysis(store, ids);
  const rules = a.security.map((s) => `${s.rule}:${s.line ?? "-"}`).sort();
  assert.deepEqual(rules, ["env-file:-", "error-leak:4", "eval:6", "html-injection:3", "secret:2", "sql-concat:5"]);
  const secret = a.security.find((s) => s.rule === "secret");
  assert.equal(secret.severity, "high");
  assert.ok(!secret.text.includes(fake), "the key itself is never stored in the analysis");
  assert.ok(!JSON.stringify(a).includes("hunter2"), ".env values are never stored");
});

test("scanAdded: a key inside a test file is still reported, at a lower severity", () => {
  const out = scanAdded([{ path: "tests/a.test.js", lang: "js", added: [{ line: 3, text: "const k = 'ghp_" + "x".repeat(30) + "';" }] }]);
  assert.deepEqual(out.map((o) => [o.rule, o.severity, o.inTest]), [["secret", "medium", true]]);
});
