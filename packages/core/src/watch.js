// `vibe-explainer watch` (Roadmap Phase 10): record agents that have no hooks (Cursor, Windsurf,
// Copilot, Aider, a human...) by watching the project folder. A turn starts at the first change
// after a quiet spell and ends once the folder has been quiet for `quietMs`. Its "before" is the
// previous snapshot (the baseline at start, then each turn's "after"), so nothing is missed.
import fs from "node:fs";
import path from "node:path";
import { FORMAT_VERSION, readJson, writeJson } from "./store.js";
import { takeSnapshot, DEFAULT_EXCLUDES } from "./snapshot.js";
import { finishTurn } from "./turns.js";

const SKIP = new RegExp(`(^|/)(${DEFAULT_EXCLUDES.filter((x) => x.endsWith("/")).map((x) => x.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(/|$)|(^|/)\\.vibe-explainer(/|$)|~$|\\.sw[px]$|\\.tmp(\\.[\\w.-]*)?$|___jb_(tmp|old)___$|\\.crswap$|(^|/)\\.DS_Store$`);
// ↑ editor and agent temp files: vim swaps, atomic-save "x.js.tmp.1234.abcd", JetBrains, Chrome's .crswap

/** Paths the watcher reacts to: no git internals, dependency or build folders, or editor temp files. */
export function watchedPath(rel) {
  const p = String(rel ?? "").replace(/\\/g, "/");
  return !!p && !SKIP.test(p);
}

/**
 * Start watching. Returns controls; call stop() to finish any pending turn and stop.
 * @param {import("./store.js").Store} store
 * @param {{dir: string, agent?: string, quietMs?: number, sessionId?: string, now?: () => string,
 *          onTurn?: (info: {projectId: string, sessionId: string, turn: number, files: object[]}) => void,
 *          onChange?: (rel: string) => void, watchFn?: typeof fs.watch}} opts
 */
export function startWatch(store, { dir, agent = "agent", quietMs = 8000, sessionId, now = () => new Date().toISOString(), onTurn, onChange, watchFn = fs.watch }) {
  const cwd = path.resolve(dir);
  const t0 = now();
  const projectId = store.ensureProject(cwd, t0);
  const sid = sessionId ?? `w-${t0.replace(/[-:.TZ]/g, "").slice(0, 14)}`;
  store.ensureSession(projectId, sid, { source: "watch", agent, cwd }, t0);
  store.appendEvent(projectId, sid, { v: FORMAT_VERSION, ts: t0, session: sid, turn: 0, kind: "session_start", source: "watch", cwd, agent });

  // The baseline: the folder as it is when watching starts.
  let last = takeSnapshot({ home: store.home, projectId, workTree: cwd, ref: `refs/vibe-explainer/${sid}/0-after`, message: "watch baseline" });
  let pending = null; // { firstTs, lastTs, changes: Map<rel, ts> }
  let label = null, timer = null, busy = false, stopped = false;

  const flush = () => {
    clearTimeout(timer); timer = null;
    if (!pending || busy) return null;
    const batch = pending; pending = null; busy = true;
    try {
      // Only real changes make a turn: an editor saving the same bytes leaves the tree as it was.
      const probe = takeSnapshot({ home: store.home, projectId, workTree: cwd, message: "watch probe" });
      if (probe.tree === last.tree) return null;
      const prompt = label ?? `(no prompt recorded: changes by ${agent})`; label = null;
      const n = store.openTurn(projectId, sid, prompt, batch.firstTs);
      const tfile = path.join(store.turnDir(projectId, sid, n), "turn.json");
      writeJson(tfile, { ...readJson(tfile), before: { commit: last.commit, at: batch.firstTs }, source: "watch", agent });
      store.appendEvent(projectId, sid, { v: FORMAT_VERSION, ts: batch.firstTs, session: sid, turn: n, kind: "prompt", prompt, agent });
      for (const [rel, ts] of [...batch.changes.entries()].sort((a, b) => a[1].localeCompare(b[1]))) {
        store.appendEvent(projectId, sid, { v: FORMAT_VERSION, ts, session: sid, turn: n, kind: "file_change", target: rel });
      }
      store.appendEvent(projectId, sid, { v: FORMAT_VERSION, ts: batch.lastTs, session: sid, turn: n, kind: "stop" });
      store.closeTurn(projectId, sid, n, batch.lastTs);
      const t = finishTurn(store, { projectId, sessionId: sid, turn: n, now: batch.lastTs });
      if (t?.after?.commit) last = { commit: t.after.commit, tree: probe.tree };
      const info = { projectId, sessionId: sid, turn: n, files: t?.files ?? [] };
      try { onTurn?.(info); } catch { /* the caller's problem */ }
      return info;
    } finally { busy = false; if (pending && !stopped) timer = setTimeout(flush, quietMs); }
  };

  const onEvent = (_type, filename) => {
    if (stopped || !filename) return;
    const rel = String(filename).replace(/\\/g, "/");
    if (!watchedPath(rel)) return;
    const ts = now();
    pending ??= { firstTs: ts, lastTs: ts, changes: new Map() };
    pending.lastTs = ts;
    if (!pending.changes.has(rel)) {
      pending.changes.set(rel, ts);
      try { onChange?.(rel); } catch { /* ignore */ } // once per file per prompt
    }
    clearTimeout(timer);
    timer = setTimeout(flush, quietMs);
  };

  const watcher = watchFn(cwd, { recursive: true }, onEvent);
  watcher.on?.("error", () => { /* a deleted sub-folder can end a watch on some OSes; flush keeps the data */ });

  return {
    projectId, sessionId: sid,
    /** Name the turn in progress (or the next one) with what the user asked. */
    label(text) { const s = String(text ?? "").trim(); if (s) label = s.slice(0, 4000); },
    /** Close the pending turn now (the user pressed Enter, or a test). */
    flush,
    /** Feed one change by hand (tests, or platforms without recursive watch). */
    change: onEvent,
    stop() {
      if (stopped) return null;
      const info = flush();
      stopped = true; clearTimeout(timer); watcher.close?.();
      const ts = now();
      store.appendEvent(projectId, sid, { v: FORMAT_VERSION, ts, session: sid, turn: store.currentTurn(projectId, sid), kind: "session_end", reason: "watch stopped" });
      store.ensureSession(projectId, sid, { endedAt: ts }, ts);
      return info;
    },
  };
}
