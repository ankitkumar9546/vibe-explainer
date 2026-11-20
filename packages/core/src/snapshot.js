// Snapshot + diff (Roadmap Phase 2).
// Every project gets its own SHADOW git repo under ~/.vibe-explainer/shadow/<projectId>.git.
// The project folder is only read (as the work tree). Nothing is ever written into the
// project's own .git: no objects, refs, index or config (Rules 1).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/** Heavy or private folders that are never worth snapshotting, on top of the project's .gitignore. */
export const DEFAULT_EXCLUDES = [
  ".git/", "node_modules/", ".venv/", "venv/", "__pycache__/", "dist/", "build/", ".next/", ".nuxt/",
  ".turbo/", ".cache/", "coverage/", "target/", ".gradle/", ".idea/", "*.log",
];

const ID = {
  GIT_AUTHOR_NAME: "vibe-explainer", GIT_AUTHOR_EMAIL: "vibe-explainer@localhost",
  GIT_COMMITTER_NAME: "vibe-explainer", GIT_COMMITTER_EMAIL: "vibe-explainer@localhost",
};

export class SnapshotError extends Error {}

export function shadowDir(home, projectId) {
  return path.join(home, "shadow", `${projectId}.git`);
}

function git(gitDir, workTree, args, opts = {}) {
  const env = { ...process.env, ...ID, GIT_DIR: gitDir, GIT_WORK_TREE: workTree, GIT_INDEX_FILE: path.join(gitDir, "index"), GIT_TERMINAL_PROMPT: "0" };
  // Never let the user's own repo or global hooks leak in.
  delete env.GIT_OBJECT_DIRECTORY; delete env.GIT_ALTERNATE_OBJECT_DIRECTORIES;
  try {
    return execFileSync("git", ["-c", "core.autocrlf=false", "-c", "core.safecrlf=false", "-c", "core.quotepath=false", ...args], {
      cwd: workTree, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], ...opts,
    });
  } catch (err) {
    throw new SnapshotError(`git ${args[0]} failed: ${String(err.stderr || err.message).trim()}`);
  }
}

/** Create the shadow repo once and keep its excludes in step with the project's own. */
export function ensureShadow(home, projectId, workTree) {
  const dir = shadowDir(home, projectId);
  if (!fs.existsSync(path.join(dir, "HEAD"))) {
    fs.mkdirSync(dir, { recursive: true });
    execFileSync("git", ["init", "--bare", "--quiet", dir], { stdio: "ignore" });
  }
  // Project's private excludes (.git/info/exclude) are honoured too; .gitignore files are read from the work tree by git itself.
  let own = "";
  try { own = fs.readFileSync(path.join(workTree, ".git", "info", "exclude"), "utf8"); } catch { /* not a git project */ }
  fs.mkdirSync(path.join(dir, "info"), { recursive: true });
  fs.writeFileSync(path.join(dir, "info", "exclude"), `${DEFAULT_EXCLUDES.join("\n")}\n${own}`);
  return dir;
}

/** Simple cross-process lock so two sessions in one project don't share the index at once. */
function withLock(dir, fn) {
  const lock = path.join(dir, "vibe.lock");
  const deadline = Date.now() + 15000;
  for (;;) {
    try { fs.mkdirSync(lock); break; } catch {
      try { if (Date.now() - fs.statSync(lock).mtimeMs > 60000) fs.rmSync(lock, { recursive: true, force: true }); } catch { /* raced */ }
      if (Date.now() > deadline) throw new SnapshotError("snapshot lock busy");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  try { return fn(); } finally { fs.rmSync(lock, { recursive: true, force: true }); }
}

/**
 * Snapshot the project's working tree (respecting .gitignore).
 * @returns {{commit: string, tree: string}}
 */
export function takeSnapshot({ home, projectId, workTree, ref, message = "snapshot" }) {
  const dir = ensureShadow(home, projectId, workTree);
  return withLock(dir, () => {
    git(dir, workTree, ["add", "--all", "--", "."]);
    const tree = git(dir, workTree, ["write-tree"]).trim();
    const commit = git(dir, workTree, ["commit-tree", tree, "-m", message]).trim();
    if (ref) git(dir, workTree, ["update-ref", ref, commit]);
    return { commit, tree };
  });
}

/**
 * Diff two snapshots.
 * @returns {{patch: string, files: {path: string, oldPath?: string, status: string, add: number|null, del: number|null}[]}}
 */
export function diffSnapshots({ home, projectId, workTree, from, to }) {
  const dir = shadowDir(home, projectId);
  const patch = git(dir, workTree, ["diff", "--no-color", "--find-renames", "--no-ext-diff", "--ignore-cr-at-eol", from, to]);
  const status = git(dir, workTree, ["diff", "--name-status", "--find-renames", "--ignore-cr-at-eol", "-z", from, to]).split("\0").filter(Boolean);
  const nums = git(dir, workTree, ["diff", "--numstat", "--find-renames", "--ignore-cr-at-eol", "-z", from, to]);
  const counts = new Map();
  // numstat -z: "add\tdel\tpath\0" or for renames "add\tdel\t\0old\0new\0"
  const parts = nums.split("\0");
  for (let i = 0; i < parts.length; i++) {
    const m = /^(\d+|-)\t(\d+|-)\t(.*)$/.exec(parts[i]);
    if (!m) continue;
    let p = m[3];
    if (p === "") { p = parts[i + 2]; i += 2; }
    counts.set(p, { add: m[1] === "-" ? null : +m[1], del: m[2] === "-" ? null : +m[2] });
  }
  const files = [];
  for (let i = 0; i < status.length; i++) {
    const code = status[i];
    const kind = { A: "added", M: "modified", D: "deleted", R: "renamed", C: "copied", T: "type-changed" }[code[0]] ?? "modified";
    if (code[0] === "R" || code[0] === "C") {
      const oldPath = status[++i], p = status[++i];
      files.push({ path: p, oldPath, status: kind, ...(counts.get(p) ?? { add: null, del: null }) });
    } else {
      const p = status[++i];
      files.push({ path: p, status: kind, ...(counts.get(p) ?? { add: null, del: null }) });
    }
  }
  // A file whose only change is line endings (CRLF vs LF) is not a change for a reader.
  return { patch, files: files.filter((f) => !(f.status === "modified" && f.add === 0 && f.del === 0)) };
}

export function refFor(sessionId, turn, which) {
  return `refs/vibe-explainer/${sessionId}/${turn}-${which}`;
}
