// Turn lifecycle around the snapshots: "before" when a prompt arrives, "after" + diff when it stops.
import fs from "node:fs";
import path from "node:path";
import { readJson, writeJson } from "./store.js";
import { takeSnapshot, diffSnapshots, refFor } from "./snapshot.js";

function turnFile(store, projectId, sessionId, n) {
  return path.join(store.turnDir(projectId, sessionId, n), "turn.json");
}

function patchTurn(store, projectId, sessionId, n, fields) {
  const file = turnFile(store, projectId, sessionId, n);
  const cur = readJson(file, { v: 1, n });
  writeJson(file, { ...cur, ...fields });
}

/** Called synchronously by the UserPromptSubmit hook, before the agent touches anything. */
export function snapshotBefore(store, { projectId, sessionId, turn, cwd, now = new Date().toISOString() }) {
  try {
    const snap = takeSnapshot({ home: store.home, projectId, workTree: cwd, ref: refFor(sessionId, turn, "before"), message: `turn ${turn} before` });
    patchTurn(store, projectId, sessionId, turn, { before: { commit: snap.commit, at: now } });
    return snap;
  } catch (err) {
    patchTurn(store, projectId, sessionId, turn, { snapshotError: String(err.message ?? err) });
    return null;
  }
}

/**
 * Called after Stop (in a detached process): "after" snapshot, diff.patch, file list.
 * @returns {object|null} the updated turn record
 */
export function finishTurn(store, { projectId, sessionId, turn, now = new Date().toISOString() }) {
  const session = readJson(path.join(store.sessionDir(projectId, sessionId), "session.json"));
  const file = turnFile(store, projectId, sessionId, turn);
  const cur = readJson(file);
  if (!session || !cur) return null;
  try {
    const after = takeSnapshot({ home: store.home, projectId, workTree: session.cwd, ref: refFor(sessionId, turn, "after"), message: `turn ${turn} after` });
    const fields = { after: { commit: after.commit, at: now } };
    if (cur.before?.commit) {
      const { patch, files } = diffSnapshots({ home: store.home, projectId, workTree: session.cwd, from: cur.before.commit, to: after.commit });
      fs.writeFileSync(path.join(store.turnDir(projectId, sessionId, turn), "diff.patch"), patch);
      fields.files = files;
      fields.snapshotError = undefined; // a successful retry clears an old error
    } else {
      fields.snapshotError = cur.snapshotError ?? "no before snapshot for this turn";
    }
    patchTurn(store, projectId, sessionId, turn, fields);
  } catch (err) {
    patchTurn(store, projectId, sessionId, turn, { snapshotError: String(err.message ?? err) });
  }
  return readJson(file);
}
