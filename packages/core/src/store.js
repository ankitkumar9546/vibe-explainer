// Store: everything lives under ~/.vibe-explainer (or $VIBE_EXPLAINER_HOME).
// Layout and fields: docs/DataFormat.md.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

export const FORMAT_VERSION = 1;

/** @param {NodeJS.ProcessEnv} [env] */
export function homeDir(env = process.env) {
  return env.VIBE_EXPLAINER_HOME ? path.resolve(env.VIBE_EXPLAINER_HOME) : path.join(os.homedir(), ".vibe-explainer");
}

/** Stable id for a project folder: first 12 hex chars of sha256(abs path). */
export function projectIdFor(projectPath) {
  let p = path.resolve(projectPath);
  if (process.platform === "win32") p = p.toLowerCase();
  return crypto.createHash("sha256").update(p).digest("hex").slice(0, 12);
}

/** Session ids come from the agent; keep them safe as folder names. */
export function safeId(id) {
  return String(id).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "unknown";
}

export function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

export class Store {
  /** @param {{home?: string}} [opts] */
  constructor(opts = {}) {
    this.home = opts.home ?? homeDir();
  }

  projectDir(projectId) { return path.join(this.home, "projects", projectId); }
  sessionDir(projectId, sessionId) { return path.join(this.projectDir(projectId), "sessions", safeId(sessionId)); }
  turnDir(projectId, sessionId, n) { return path.join(this.sessionDir(projectId, sessionId), "turns", String(n)); }

  /** Create project.json once. */
  ensureProject(projectPath, now) {
    const id = projectIdFor(projectPath);
    const file = path.join(this.projectDir(id), "project.json");
    if (!fs.existsSync(file)) {
      writeJson(file, { v: FORMAT_VERSION, id, path: path.resolve(projectPath), name: path.basename(path.resolve(projectPath)), createdAt: now });
    }
    return id;
  }

  /** Create or update session.json; returns the session record. */
  ensureSession(projectId, sessionId, fields, now) {
    const file = path.join(this.sessionDir(projectId, sessionId), "session.json");
    const cur = readJson(file);
    if (!cur) {
      const rec = { v: FORMAT_VERSION, id: String(sessionId), projectId, startedAt: now, ...fields };
      writeJson(file, rec);
      return rec;
    }
    const changed = Object.entries(fields).some(([k, v]) => v != null && cur[k] !== v);
    if (changed) {
      const rec = { ...cur, ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v != null)) };
      writeJson(file, rec);
      return rec;
    }
    return cur;
  }

  /** Current turn number for a session (0 before the first prompt). */
  currentTurn(projectId, sessionId) {
    return readJson(path.join(this.sessionDir(projectId, sessionId), "state.json"), { turn: 0 }).turn;
  }

  openTurn(projectId, sessionId, prompt, now) {
    const n = this.currentTurn(projectId, sessionId) + 1;
    writeJson(path.join(this.sessionDir(projectId, sessionId), "state.json"), { turn: n });
    writeJson(path.join(this.turnDir(projectId, sessionId, n), "turn.json"), { v: FORMAT_VERSION, n, prompt, startedAt: now, status: "open" });
    return n;
  }

  closeTurn(projectId, sessionId, n, now) {
    if (!n) return;
    const file = path.join(this.turnDir(projectId, sessionId, n), "turn.json");
    const cur = readJson(file);
    if (cur && cur.status === "open") writeJson(file, { ...cur, endedAt: now, status: "closed" });
  }

  appendEvent(projectId, sessionId, event) {
    const file = path.join(this.sessionDir(projectId, sessionId), "events.jsonl");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(event) + "\n");
  }

  readEvents(projectId, sessionId) {
    const file = path.join(this.sessionDir(projectId, sessionId), "events.jsonl");
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  }

  listSessions(projectId) {
    const dir = path.join(this.projectDir(projectId), "sessions");
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .map((id) => readJson(path.join(dir, id, "session.json")))
      .filter(Boolean)
      .sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));
  }
}
