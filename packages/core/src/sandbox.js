// The playground's sandbox (Roadmap Phase 9). A sandbox is a fresh folder filled from a
// shadow-repo snapshot (never from the live project), plus the learner's edits. The project's
// own commands (test, lint) run there only after the user allowed them for that project.
// Nothing here writes to the user's project, except applyEdit() after an explicit confirm.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { readJson, writeJson } from "./store.js";
import { shadowDir, shadowGit } from "./snapshot.js";

/** Dependency folders that are linked (not copied) into a sandbox so tests can run. */
export const DEP_DIRS = ["node_modules", ".venv", "venv"];
export const RUN_TIMEOUT_MS = 120000;

export const sandboxRoot = (home, projectId) => path.join(home, "sandbox", projectId);

/** Safe relative path inside a folder, or throws. */
export function safeRel(p) {
  const rel = String(p ?? "").replace(/\\/g, "/").replace(/^\.\/+/, "");
  if (!rel || rel.startsWith("/") || /^[a-zA-Z]:/.test(rel) || rel.split("/").some((s) => s === ".." || s === "" || s === ".git")) throw new Error(`bad path: ${p}`);
  return rel;
}

/** A file from a snapshot commit, or null. */
export function snapshotFile(home, projectId, commit, rel) {
  try { return shadowGit(home, projectId, ["show", `${commit}:${safeRel(rel)}`], { maxBuffer: 16 * 1024 * 1024 }); } catch { return null; }
}

/** Commands we would run, read from the snapshot: package.json scripts, or pytest. */
export function detectCommands(home, projectId, commit) {
  const out = {};
  const pkg = (() => { try { return JSON.parse(snapshotFile(home, projectId, commit, "package.json") ?? "null"); } catch { return null; } })();
  if (pkg?.scripts?.test && !/no test specified/.test(pkg.scripts.test)) out.test = "npm test";
  if (pkg?.scripts?.lint) out.lint = "npm run lint";
  if (!out.test) {
    let files = "";
    try { files = shadowGit(home, projectId, ["ls-tree", "-r", "--name-only", commit]); } catch { /* empty */ }
    if (/(^|\n)(tests?\/[^\n]*\.py|[^\n]*test_[^\n/]*\.py)(\n|$)/.test(files)) out.test = "python -m pytest -q";
  }
  return out;
}

/** The project's sandbox permission: { allowed, commands } in project.json. */
export function sandboxSettings(store, projectId) {
  return readJson(path.join(store.projectDir(projectId), "project.json"))?.sandbox ?? { allowed: false, commands: {} };
}
export function allowSandbox(store, projectId, commands) {
  const file = path.join(store.projectDir(projectId), "project.json");
  const p = readJson(file);
  if (!p) throw new Error("no such project");
  const clean = {};
  for (const k of ["test", "lint"]) if (typeof commands?.[k] === "string" && commands[k].trim()) clean[k] = commands[k].trim().slice(0, 300);
  p.sandbox = { allowed: true, commands: clean, allowedAt: new Date().toISOString() };
  writeJson(file, p);
  return p.sandbox;
}

/**
 * Make a sandbox folder from a snapshot, with edits (path → content) written on top.
 * @returns {{id: string, dir: string, links: string[]}}
 */
export function prepareSandbox(store, { projectId, commit, edits = {}, projectDir = null }) {
  const root = sandboxRoot(store.home, projectId);
  fs.mkdirSync(root, { recursive: true });
  const id = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
  const dir = path.join(root, id);
  fs.mkdirSync(dir);
  const index = path.join(root, `${id}.index`);
  const gitDir = shadowDir(store.home, projectId);
  const env = { ...process.env, GIT_DIR: gitDir, GIT_WORK_TREE: dir, GIT_INDEX_FILE: index };
  try {
    execFileSync("git", ["-c", "core.autocrlf=false", "read-tree", commit], { env, cwd: dir, stdio: ["ignore", "ignore", "pipe"] });
    execFileSync("git", ["-c", "core.autocrlf=false", "checkout-index", "-a", "-f"], { env, cwd: dir, stdio: ["ignore", "ignore", "pipe"] });
  } finally { fs.rmSync(index, { force: true }); }
  for (const [p, content] of Object.entries(edits)) {
    const rel = safeRel(p), file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, String(content));
  }
  const links = [];
  if (projectDir) {
    for (const d of DEP_DIRS) {
      const src = path.join(projectDir, d), dst = path.join(dir, d);
      if (fs.existsSync(src) && !fs.existsSync(dst)) {
        try { fs.symlinkSync(src, dst, process.platform === "win32" ? "junction" : "dir"); links.push(dst); } catch { /* run without it */ }
      }
    }
  }
  writeJson(path.join(root, `${id}.json`), { id, commit, links, createdAt: new Date().toISOString() });
  return { id, dir, links };
}

/** Remove a sandbox. Links to the user's dependency folders are unlinked FIRST, never followed. */
export function removeSandbox(store, projectId, id) {
  const root = sandboxRoot(store.home, projectId);
  if (!/^[a-z0-9]+-[0-9a-f]{6}$/.test(id)) throw new Error("bad sandbox id");
  const dir = path.join(root, id), meta = readJson(path.join(root, `${id}.json`), { links: [] });
  for (const d of DEP_DIRS) {
    const p = path.join(dir, d);
    let st; try { st = fs.lstatSync(p); } catch { continue; }
    if (st.isSymbolicLink() || meta.links.includes(p)) {
      try { fs.unlinkSync(p); } catch { fs.rmdirSync(p); } // a junction on Windows
    }
  }
  for (const d of DEP_DIRS) { try { if (fs.lstatSync(path.join(dir, d)).isSymbolicLink()) throw new Error("a dependency link is still in place; not removing the sandbox"); } catch (e) { if (e.code !== "ENOENT") throw e; } }
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(path.join(root, `${id}.json`), { force: true });
}

/** Remove sandboxes older than maxAgeMs (default a day). */
export function sweepSandboxes(store, projectId, maxAgeMs = 24 * 3600 * 1000) {
  const root = sandboxRoot(store.home, projectId);
  if (!fs.existsSync(root)) return 0;
  let n = 0;
  for (const f of fs.readdirSync(root).filter((x) => x.endsWith(".json"))) {
    const meta = readJson(path.join(root, f));
    if (meta && Date.now() - Date.parse(meta.createdAt) > maxAgeMs) { try { removeSandbox(store, projectId, meta.id); n++; } catch { /* keep */ } }
  }
  return n;
}

function killTree(child) {
  if (process.platform === "win32") { try { execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ } }
  else { try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); } }
}

/** Run one shell command in the sandbox. Output is cut to its last 8000 characters. */
export function runCommand(dir, cmd, { timeoutMs = RUN_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const env = { ...process.env, CI: "1", FORCE_COLOR: "0", NO_COLOR: "1", VIBE_EXPLAINER_INTERNAL: "1" };
    delete env.CLAUDECODE;
    delete env.NODE_TEST_CONTEXT; // set when we ourselves run under node --test; it would hide the project's results
    delete env.NODE_OPTIONS;
    const child = spawn(cmd, { cwd: dir, env, shell: true, windowsHide: true, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
    let out = "", timedOut = false;
    const add = (d) => { out += d; if (out.length > 200000) out = out.slice(-100000); };
    child.stdout.on("data", add); child.stderr.on("data", add);
    const timer = setTimeout(() => { timedOut = true; killTree(child); }, timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      const text = out.replace(/\x1b\[[0-9;]*m/g, "");
      resolve({ cmd, code: timedOut ? null : code, ok: !timedOut && code === 0, timedOut, ms: Date.now() - t0, out: text.length > 8000 ? `…${text.slice(-8000)}` : text });
    });
    child.on("error", (err) => { clearTimeout(timer); resolve({ cmd, code: null, ok: false, timedOut: false, ms: Date.now() - t0, out: String(err.message) }); });
  });
}

/**
 * Prepare a sandbox from `commit` + edits, run the allowed commands, and (by default) remove it.
 * @returns {Promise<{id: string, results: {name: string, cmd: string, ok: boolean, code: number|null, out: string, ms: number}[], kept: boolean}>}
 */
export async function runInSandbox(store, { projectId, commit, edits = {}, projectDir = null, commands = {}, keep = false, timeoutMs }) {
  const sb = prepareSandbox(store, { projectId, commit, edits, projectDir });
  const results = [];
  try {
    for (const name of ["lint", "test"]) {
      if (!commands[name]) continue;
      results.push({ name, ...(await runCommand(sb.dir, commands[name], { timeoutMs })) });
    }
  } finally {
    if (!keep) removeSandbox(store, projectId, sb.id);
  }
  return { id: sb.id, results, kept: keep };
}

/** A file served from a kept sandbox (for the preview), or null. */
export function sandboxFile(store, projectId, id, rel) {
  if (!/^[a-z0-9]+-[0-9a-f]{6}$/.test(id)) return null;
  const dir = path.join(sandboxRoot(store.home, projectId), id);
  const file = path.join(dir, safeRel(rel));
  if (!file.startsWith(dir + path.sep) || DEP_DIRS.some((d) => file.startsWith(path.join(dir, d) + path.sep))) return null;
  try { return fs.statSync(file).isFile() ? fs.readFileSync(file) : null; } catch { return null; }
}

/**
 * Write the learner's version of ONE file into the real project. Refuses when the real file is
 * no longer what the agent left (someone changed it since), so nothing is overwritten blindly.
 */
export function applyEdit(store, { projectId, projectDir, commit, path: p, content }) {
  const rel = safeRel(p);
  const file = path.join(projectDir, rel);
  if (!file.startsWith(path.resolve(projectDir) + path.sep)) throw new Error("bad path");
  const expected = snapshotFile(store.home, projectId, commit, rel);
  let current = null; try { current = fs.readFileSync(file, "utf8"); } catch { /* missing */ }
  const norm = (s) => (s == null ? null : s.replace(/\r\n/g, "\n"));
  if (norm(current) !== norm(expected)) return { ok: false, error: "the file changed after the agent finished; not overwriting it" };
  // keep the file's own line endings
  const out = current && current.includes("\r\n") ? String(content).replace(/\r?\n/g, "\r\n") : String(content);
  fs.writeFileSync(file, out);
  return { ok: true, path: rel };
}

