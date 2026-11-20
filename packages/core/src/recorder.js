// Recorder: one Claude Code hook payload in, one normalized event out.
// Event shape: docs/DataFormat.md §2. Rules: never throw, stay fast, skip our own runs.
import { Store, FORMAT_VERSION, homeDir } from "./store.js";

export const MAX_STRING = 4000;

const KIND = {
  SessionStart: "session_start",
  UserPromptSubmit: "prompt",
  PreToolUse: "tool_start",
  PostToolUse: "tool_end",
  Stop: "stop",
  SessionEnd: "session_end",
};

/** Cut long strings anywhere inside a value, so one huge tool output can't bloat the log. */
export function truncate(value, max = MAX_STRING, depth = 0) {
  if (typeof value === "string") {
    return value.length > max ? `${value.slice(0, max)}…[cut ${value.length - max} chars]` : value;
  }
  if (depth > 6 || value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 200).map((v) => truncate(v, max, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = truncate(v, max, depth + 1);
  return out;
}

/** The single most useful string for a tool call. */
export function targetOf(tool, input) {
  if (!input || typeof input !== "object") return null;
  const t = input.file_path ?? input.notebook_path ?? input.path;
  if (typeof t === "string" && /^(Read|Edit|MultiEdit|Write|NotebookEdit)$/.test(tool)) return t;
  if (tool === "Bash" || tool === "PowerShell") return typeof input.command === "string" ? input.command : null;
  if (tool === "Grep" || tool === "Glob") return input.pattern ?? null;
  if (tool === "WebFetch") return input.url ?? null;
  if (tool === "WebSearch") return input.query ?? null;
  if (tool === "Task" || tool === "Agent") return input.description ?? null;
  return typeof t === "string" ? t : null;
}

function toolOk(response) {
  if (response == null) return true;
  if (typeof response === "object") {
    if (response.is_error === true || response.isError === true) return false;
    if (response.success === false) return false;
    if (typeof response.error === "string" && response.error) return false;
  }
  return true;
}

/**
 * Record one hook payload.
 * @param {any} payload  JSON from Claude Code (stdin)
 * @param {{store?: Store, env?: NodeJS.ProcessEnv, now?: string}} [opts]
 * @returns {object|null} the event written, or null when nothing was recorded
 */
export function recordHook(payload, opts = {}) {
  const env = opts.env ?? process.env;
  if (env.VIBE_EXPLAINER_INTERNAL === "1") return null; // our own runs (teacher, sandbox)
  if (!payload || typeof payload !== "object") return null;
  const kind = KIND[payload.hook_event_name];
  if (!kind || !payload.session_id) return null;

  const store = opts.store ?? new Store({ home: homeDir(env) });
  const now = opts.now ?? new Date().toISOString();
  const cwd = typeof payload.cwd === "string" && payload.cwd ? payload.cwd : process.cwd();
  const sessionId = String(payload.session_id);

  const projectId = store.ensureProject(cwd, now);
  store.ensureSession(projectId, sessionId, {
    source: "claude-code",
    cwd,
    transcriptPath: typeof payload.transcript_path === "string" ? payload.transcript_path : undefined,
  }, now);

  let turn = store.currentTurn(projectId, sessionId);
  const event = { v: FORMAT_VERSION, ts: now, session: sessionId, turn, kind };

  switch (kind) {
    case "session_start":
      event.source = payload.source ?? null;
      event.cwd = cwd;
      event.transcriptPath = payload.transcript_path ?? null;
      break;
    case "prompt":
      turn = store.openTurn(projectId, sessionId, truncate(String(payload.prompt ?? "")), now);
      event.turn = turn;
      event.prompt = truncate(String(payload.prompt ?? ""));
      break;
    case "tool_start":
    case "tool_end": {
      const tool = String(payload.tool_name ?? "unknown");
      event.tool = tool;
      event.target = truncate(targetOf(tool, payload.tool_input));
      event.input = truncate(payload.tool_input ?? null);
      if (kind === "tool_end") {
        event.result = truncate(payload.tool_response ?? null);
        event.ok = toolOk(payload.tool_response);
      }
      break;
    }
    case "stop":
      store.closeTurn(projectId, sessionId, turn, now);
      break;
    case "session_end":
      event.reason = payload.reason ?? null;
      store.ensureSession(projectId, sessionId, { endedAt: now }, now);
      break;
  }

  store.appendEvent(projectId, sessionId, event);
  return event;
}
