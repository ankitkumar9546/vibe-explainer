import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Store, startWatch, watchedPath, readJson, buildContext, buildPrompt, buildTodo } from "@vibe-explainer/core";

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const w = (dir, f, s) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), s); };
const fakeWatch = () => ({ close() {}, on() {} });

test("watchedPath skips git, dependency, build and editor temp paths", () => {
  for (const p of ["src/a.js", "README.md", "app/views/x.html"]) assert.equal(watchedPath(p), true, p);
  for (const p of [".git/index", "node_modules/x/y.js", "dist/a.js", "src/__pycache__/a.pyc", "a.js~", ".a.js.swp", "calc.py.tmp.12796.b7c5b099a088", "x.js___jb_tmp___", ""]) assert.equal(watchedPath(p), false, p);
});

test("changes become a turn: before = the baseline, diff, file events, and the typed prompt", () => {
  const home = tmp("vx-home-"), proj = tmp("vx-watch-");
  w(proj, "notes.js", "export const notes = [];\n");
  const store = new Store({ home });
  let t = 0; const now = () => new Date(Date.UTC(2026, 10, 21, 10, 0, t++)).toISOString();
  const turns = [];
  const wt = startWatch(store, { dir: proj, agent: "cursor", quietMs: 60000, now, watchFn: fakeWatch, onTurn: (i) => turns.push(i) });

  w(proj, "notes.js", "export const notes = [];\nexport function add(n) { notes.push(n); }\n");
  wt.change("change", "notes.js");
  w(proj, "README.md", "# notes\n");
  wt.change("rename", "README.md");
  wt.change("change", "node_modules/x/index.js"); // ignored
  wt.label("Add an add() helper and a README");
  const info = wt.flush();

  assert.equal(info.turn, 1);
  assert.deepEqual(info.files.map((f) => `${f.status} ${f.path}`).sort(), ["added README.md", "modified notes.js"]);
  const dir = store.turnDir(wt.projectId, wt.sessionId, 1);
  const turn = readJson(path.join(dir, "turn.json"));
  assert.deepEqual([turn.status, turn.source, turn.agent, turn.prompt], ["closed", "watch", "cursor", "Add an add() helper and a README"]);
  assert.ok(turn.before.commit && turn.after.commit);
  assert.match(fs.readFileSync(path.join(dir, "diff.patch"), "utf8"), /^\+export function add\(n\)/m);
  const ev = store.readEvents(wt.projectId, wt.sessionId).filter((e) => e.turn === 1).map((e) => `${e.kind}:${e.target ?? ""}`);
  assert.deepEqual(ev, ["prompt:", "file_change:notes.js", "file_change:README.md", "stop:"]);
  assert.equal(readJson(path.join(store.sessionDir(wt.projectId, wt.sessionId), "session.json")).source, "watch");
  assert.equal(turns.length, 1);

  // the teacher is told what watch can and can't see; the to-do doesn't guess about tests
  const ctx = buildContext(store, { projectId: wt.projectId, sessionId: wt.sessionId, turn: 1 });
  assert.match(ctx.steps, /file changed notes\.js/);
  assert.match(buildPrompt(ctx, { lang: "en" }), /recorded by WATCHING THE FILES while cursor worked/);
  assert.deepEqual(buildTodo({ turn, events: [], lesson: null, analysis: null }), []);
  wt.stop();
});

test("saving the same bytes, or touching only ignored files, makes no turn; the next turn shows only its own change", () => {
  const home = tmp("vx-home-"), proj = tmp("vx-watch2-");
  w(proj, "a.js", "1\n");
  const store = new Store({ home });
  const wt = startWatch(store, { dir: proj, quietMs: 60000, watchFn: fakeWatch });
  w(proj, "a.js", "1\n"); wt.change("change", "a.js");
  assert.equal(wt.flush(), null, "same content: no turn");
  w(proj, "node_modules/big/x.js", "x"); wt.change("change", "node_modules/big/x.js");
  assert.equal(wt.flush(), null, "ignored path: no turn");
  w(proj, "a.js", "1\n2\n"); wt.change("change", "a.js");
  assert.equal(wt.flush().turn, 1);
  w(proj, "b.js", "b\n"); wt.change("rename", "b.js");
  const second = wt.flush();
  assert.deepEqual(second.files.map((f) => f.path), ["b.js"], "turn 2 starts from turn 1's after");
  assert.match(readJson(path.join(store.turnDir(wt.projectId, wt.sessionId, 2), "turn.json")).prompt, /no prompt recorded: changes by agent/);
  wt.stop();
});

test("a real fs.watch picks up an edit and closes the turn after the quiet time", async () => {
  const home = tmp("vx-home-"), proj = tmp("vx-watch3-");
  w(proj, "x.py", "print(1)\n");
  const store = new Store({ home });
  let resolveTurn; const got = new Promise((r) => { resolveTurn = r; });
  const wt = startWatch(store, { dir: proj, agent: "aider", quietMs: 400, onTurn: resolveTurn });
  await new Promise((r) => setTimeout(r, 200));
  w(proj, "x.py", "print(2)\n");
  const info = await Promise.race([got, new Promise((_, rej) => setTimeout(() => rej(new Error("no turn within 8s")), 8000))]);
  assert.deepEqual(info.files.map((f) => [f.path, f.add, f.del]), [["x.py", 1, 1]]);
  wt.stop();
});
