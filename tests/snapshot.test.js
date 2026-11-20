import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { takeSnapshot, diffSnapshots, Store, recordHook, snapshotBefore, finishTurn, projectIdFor, readJson } from "@vibe-explainer/core";

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const w = (dir, f, s) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), s); };
const gitIn = (dir, ...a) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "core.autocrlf=false", ...a], { cwd: dir, encoding: "utf8" });

/** Hash of every file inside a folder (paths + bytes): proves nothing changed. */
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

test("snapshot + diff in a folder with no git", () => {
  const home = tmp("vx-home-"), proj = tmp("vx-nogit-");
  w(proj, "src/auth.js", "export function login() {\n  return 1;\n}\n");
  w(proj, "old.txt", "bye\n");
  const id = projectIdFor(proj);
  const a = takeSnapshot({ home, projectId: id, workTree: proj });
  w(proj, "src/auth.js", "export function login() {\n  return 2;\n}\n\nexport function reset() {}\n");
  w(proj, "src/new.js", "hi\n");
  fs.rmSync(path.join(proj, "old.txt"));
  const b = takeSnapshot({ home, projectId: id, workTree: proj });
  const { patch, files } = diffSnapshots({ home, projectId: id, workTree: proj, from: a.commit, to: b.commit });
  const by = Object.fromEntries(files.map((f) => [f.path, f]));
  assert.equal(by["src/auth.js"].status, "modified");
  assert.deepEqual([by["src/auth.js"].add, by["src/auth.js"].del], [3, 1]);
  assert.equal(by["src/new.js"].status, "added");
  assert.equal(by["old.txt"].status, "deleted");
  assert.match(patch, /\+export function reset\(\) \{\}/);
  assert.equal(fs.existsSync(path.join(proj, ".git")), false, "no .git may appear in the user's folder");
});

test("a git project's own repo is not touched at all, and .gitignore is respected", () => {
  const home = tmp("vx-home-"), proj = tmp("vx-git-");
  gitIn(proj, "init", "-q", "-b", "main");
  w(proj, ".gitignore", "secret.env\n");
  w(proj, "app.js", "one\n");
  gitIn(proj, "add", "-A"); gitIn(proj, "commit", "-q", "-m", "first");
  w(proj, "app.js", "one\ntwo\n");          // unstaged change
  w(proj, "staged.js", "s\n"); gitIn(proj, "add", "staged.js"); // staged change
  w(proj, "secret.env", "KEY=1\n");

  const before = { dotgit: fingerprint(path.join(proj, ".git")), status: gitIn(proj, "status", "--porcelain=v2", "--branch") };
  const id = projectIdFor(proj);
  const a = takeSnapshot({ home, projectId: id, workTree: proj, ref: "refs/vibe-explainer/s/1-before" });
  w(proj, "app.js", "one\ntwo\nthree\n");
  w(proj, "secret.env", "KEY=2\n");
  const b = takeSnapshot({ home, projectId: id, workTree: proj, ref: "refs/vibe-explainer/s/1-after" });
  const { files } = diffSnapshots({ home, projectId: id, workTree: proj, from: a.commit, to: b.commit });

  assert.deepEqual(files.map((f) => f.path), ["app.js"], "ignored secret.env must not show");
  // Undo our own edit to app.js, then the user's repo must be byte-identical to before.
  w(proj, "app.js", "one\ntwo\n");
  assert.equal(fingerprint(path.join(proj, ".git")), before.dotgit, ".git changed");
  assert.equal(gitIn(proj, "status", "--porcelain=v2", "--branch"), before.status, "git status changed");
});

test("a whole turn through the recorder writes before, after, diff.patch and files", () => {
  const home = tmp("vx-home-"), proj = tmp("vx-turn-");
  w(proj, "a.txt", "1\n");
  const store = new Store({ home });
  const opts = { store, env: {}, onTurnOpened: (ctx) => snapshotBefore(ctx.store, ctx), onTurnClosed: (ctx) => finishTurn(ctx.store, ctx) };
  const base = { session_id: "s9", cwd: proj };
  recordHook({ ...base, hook_event_name: "UserPromptSubmit", prompt: "change a" }, opts);
  w(proj, "a.txt", "1\n2\n");
  recordHook({ ...base, hook_event_name: "PostToolUse", tool_name: "Edit", tool_input: { file_path: "a.txt" }, tool_response: {} }, opts);
  recordHook({ ...base, hook_event_name: "Stop" }, opts);

  const dir = store.turnDir(projectIdFor(proj), "s9", 1);
  const turn = readJson(path.join(dir, "turn.json"));
  assert.ok(turn.before?.commit && turn.after?.commit);
  assert.equal(turn.status, "closed");
  assert.deepEqual(turn.files, [{ path: "a.txt", status: "modified", add: 1, del: 0 }]);
  assert.match(fs.readFileSync(path.join(dir, "diff.patch"), "utf8"), /^\+2$/m);
});

test("a second turn only shows its own changes", () => {
  const home = tmp("vx-home-"), proj = tmp("vx-turn2-");
  w(proj, "a.txt", "1\n");
  const store = new Store({ home });
  const opts = { store, env: {}, onTurnOpened: (ctx) => snapshotBefore(ctx.store, ctx), onTurnClosed: (ctx) => finishTurn(ctx.store, ctx) };
  const base = { session_id: "s", cwd: proj };
  recordHook({ ...base, hook_event_name: "UserPromptSubmit", prompt: "1" }, opts);
  w(proj, "a.txt", "1\n2\n");
  recordHook({ ...base, hook_event_name: "Stop" }, opts);
  w(proj, "manual.txt", "user typed this between turns\n");
  recordHook({ ...base, hook_event_name: "UserPromptSubmit", prompt: "2" }, opts);
  w(proj, "b.txt", "b\n");
  recordHook({ ...base, hook_event_name: "Stop" }, opts);
  const t2 = readJson(path.join(store.turnDir(projectIdFor(proj), "s", 2), "turn.json"));
  assert.deepEqual(t2.files.map((f) => f.path), ["b.txt"]);
});

test("a line-ending-only change is not shown as a change", () => {
  const home = tmp("vx-home-"), proj = tmp("vx-crlf-");
  w(proj, "a.js", "x\r\ny\r\n");
  w(proj, "b.js", "1\n");
  const id = projectIdFor(proj);
  const a = takeSnapshot({ home, projectId: id, workTree: proj });
  w(proj, "a.js", "x\ny\n");
  w(proj, "b.js", "1\n2\n");
  const b = takeSnapshot({ home, projectId: id, workTree: proj });
  const { files, patch } = diffSnapshots({ home, projectId: id, workTree: proj, from: a.commit, to: b.commit });
  assert.deepEqual(files.map((f) => f.path), ["b.js"]);
  assert.doesNotMatch(patch, /^-x/m);
});
