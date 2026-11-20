// Gather what the teacher needs for one turn: prompt, steps, diff, and the agent's own words.
import fs from "node:fs";
import path from "node:path";
import { readJson } from "../store.js";
import { maskSecrets, maskEnvFilesInPatch } from "./mask.js";
import { analysisText } from "../analyzer/index.js";

export const BUDGET = { diff: 60000, steps: 12000, agent: 12000, analysis: 8000 };

const clip = (s, n) => (s.length > n ? `${s.slice(0, n)}\n…[cut ${s.length - n} chars]` : s);
const secs = (from, to) => Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000));
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** One readable line per tool call, with time from the turn's start. */
export function stepLines(events, startedAt) {
  const lines = [];
  for (const e of events) {
    if (e.kind === "file_change") { lines.push(`${mmss(secs(startedAt, e.ts))} file changed ${e.target ?? ""}`); continue; }
    if (e.kind !== "tool_end") continue;
    const t = mmss(secs(startedAt, e.ts));
    const ok = e.ok === false ? " → FAILED" : "";
    let extra = "";
    if (e.tool === "Bash" || e.tool === "PowerShell") {
      const r = e.result ?? {};
      const out = [r.stdout, r.stderr, typeof r === "string" ? r : ""].filter(Boolean).join("\n").trim();
      if (out) extra = `\n    output: ${clip(out, 600).replace(/\n/g, "\n    ")}`;
    }
    lines.push(`${t} ${e.tool} ${e.target ?? ""}${ok}${extra}`);
  }
  return lines.join("\n");
}

/** The agent's thinking and replies during the turn, from the Claude Code transcript. */
export function agentWords(transcriptPath, startedAt, endedAt) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return { thinking: [], replies: [] };
  const from = Date.parse(startedAt) - 1000, to = endedAt ? Date.parse(endedAt) + 5000 : Infinity;
  const thinking = [], replies = [];
  for (const line of fs.readFileSync(transcriptPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let rec; try { rec = JSON.parse(line); } catch { continue; }
    if (rec.type !== "assistant" || !rec.message) continue;
    const ts = Date.parse(rec.timestamp ?? "");
    if (Number.isFinite(ts) && (ts < from || ts > to)) continue;
    const content = Array.isArray(rec.message.content) ? rec.message.content : [{ type: "text", text: String(rec.message.content ?? "") }];
    for (const c of content) {
      const at = Number.isFinite(ts) ? mmss(secs(startedAt, new Date(ts).toISOString())) : "";
      if (c.type === "thinking" && c.thinking) thinking.push(`${at} ${c.thinking.trim()}`);
      if (c.type === "text" && c.text?.trim()) replies.push(`${at} ${c.text.trim()}`);
    }
  }
  return { thinking, replies };
}

/**
 * @returns {{turn: object, session: object, prompt: string, steps: string, diff: string, files: object[], thinking: string, finalReply: string, replies: string}}
 */
export function buildContext(store, { projectId, sessionId, turn }) {
  const sdir = store.sessionDir(projectId, sessionId);
  const tdir = store.turnDir(projectId, sessionId, turn);
  const session = readJson(path.join(sdir, "session.json"));
  const t = readJson(path.join(tdir, "turn.json"));
  if (!session || !t) throw new Error(`turn ${turn} of session ${sessionId} not found`);
  const events = store.readEvents(projectId, sessionId).filter((e) => e.turn === turn);
  let diff = "";
  try { diff = fs.readFileSync(path.join(tdir, "diff.patch"), "utf8"); } catch { /* no diff yet */ }
  const words = agentWords(session.transcriptPath, t.startedAt, t.endedAt);
  const finalReply = words.replies.at(-1) ?? "";
  return {
    turn: t, session, source: t.source ?? session.source ?? "claude-code", agent: t.agent ?? session.agent ?? null,
    prompt: maskSecrets(t.prompt ?? ""),
    steps: maskSecrets(clip(stepLines(events, t.startedAt), BUDGET.steps)),
    diff: maskSecrets(clip(maskEnvFilesInPatch(diff), BUDGET.diff)),
    files: t.files ?? [],
    thinking: maskSecrets(clip(words.thinking.join("\n"), BUDGET.agent)),
    replies: maskSecrets(clip(words.replies.slice(0, -1).join("\n"), BUDGET.agent / 2)),
    finalReply: maskSecrets(clip(finalReply, 4000)),
    analysis: maskSecrets(clip(analysisText(readJson(path.join(tdir, "analysis.json"))), BUDGET.analysis)),
  };
}
