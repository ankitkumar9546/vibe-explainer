// Teacher adapters (Roadmap Phase 11). Every teacher is { name, ask(prompt) -> Promise<string> },
// so the lesson, chat, playground and explain-back code never knows which model answered.
// API keys come ONLY from environment variables; they are never written to config.json.
import fs from "node:fs";
import path from "node:path";
import { claudeTeacher } from "./claude.js";
import { agentCliTeacher, hasCommand } from "./agentcli.js";
import { getKey } from "../keys.js";

/** "agent" = the CLI of whichever agent made the session (the default). */
export const TEACHERS = ["agent", "claude", "codex", "gemini-cli", "cursor", "ollama", "gemini", "openai"];
/** Defaults when `config model` is empty. Any model the provider serves can be set instead. */
export const DEFAULT_MODELS = { ollama: "qwen2.5-coder:7b", gemini: "gemini-2.5-flash", openai: "gpt-4.1-mini" };

class TeacherError extends Error {}

async function postJson(fetchFn, url, body, { headers = {}, timeoutMs, what }) {
  let r;
  try {
    r = await fetchFn(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (err?.name === "TimeoutError") throw new TeacherError(`${what} timed out after ${timeoutMs / 1000}s`);
    throw new TeacherError(`${what} is not reachable (${err?.cause?.code ?? err?.message ?? err})`);
  }
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch { /* not JSON */ }
  if (!r.ok) {
    const msg = j?.error?.message ?? j?.error ?? text.slice(0, 300);
    throw new TeacherError(`${what} answered ${r.status}: ${String(typeof msg === "string" ? msg : JSON.stringify(msg)).slice(0, 300)}`);
  }
  if (!j) throw new TeacherError(`${what} did not answer with JSON`);
  return j;
}

/** Ollama on this computer (or another one you point it to). Free, offline. */
export function ollamaTeacher({ model = DEFAULT_MODELS.ollama, url = "http://127.0.0.1:11434", timeoutMs = 300000, fetchFn = globalThis.fetch } = {}) {
  return {
    name: `ollama:${model}`,
    async ask(prompt) {
      const j = await postJson(fetchFn, `${url.replace(/\/+$/, "")}/api/chat`, {
        model, stream: false,
        messages: [{ role: "user", content: prompt }],
        // lessons are long and the prompt carries a diff: a small default context would cut it
        options: { temperature: 0.2, num_ctx: 32768 },
      }, { timeoutMs, what: `Ollama (${model})` });
      const out = j?.message?.content;
      if (typeof out !== "string" || !out.trim()) throw new TeacherError(`Ollama (${model}) gave an empty answer`);
      return out;
    },
  };
}

/** Google Gemini. Needs GEMINI_API_KEY (or GOOGLE_API_KEY) in the environment. */
export function geminiTeacher({ model = DEFAULT_MODELS.gemini, env = process.env, timeoutMs = 240000, fetchFn = globalThis.fetch, baseUrl = "https://generativelanguage.googleapis.com" } = {}) {
  const key = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
  return {
    name: `gemini:${model}`,
    async ask(prompt) {
      if (!key) throw new TeacherError("Gemini needs an API key: set GEMINI_API_KEY in your environment (it is never saved by vibe-explainer)");
      const j = await postJson(fetchFn, `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
      }, { headers: { "x-goog-api-key": key }, timeoutMs, what: `Gemini (${model})` });
      const c = j?.candidates?.[0];
      const out = (c?.content?.parts ?? []).map((p) => p.text ?? "").join("");
      if (!out.trim()) throw new TeacherError(`Gemini (${model}) gave no text${c?.finishReason ? ` (finishReason ${c.finishReason})` : j?.promptFeedback?.blockReason ? ` (blocked: ${j.promptFeedback.blockReason})` : ""}`);
      return out;
    },
  };
}

/**
 * OpenAI, or any server that speaks its chat-completions API (set `openaiBaseUrl`: LM Studio,
 * OpenRouter, vLLM…). Needs OPENAI_API_KEY, except for a local server that doesn't check it.
 */
export function openaiTeacher({ model = DEFAULT_MODELS.openai, env = process.env, baseUrl = "https://api.openai.com/v1", timeoutMs = 240000, fetchFn = globalThis.fetch } = {}) {
  const key = env.OPENAI_API_KEY;
  const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(`${baseUrl}/`);
  return {
    name: `openai:${model}`,
    async ask(prompt) {
      if (!key && !local) throw new TeacherError("OpenAI needs an API key: set OPENAI_API_KEY in your environment (it is never saved by vibe-explainer)");
      const j = await postJson(fetchFn, `${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        model, temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }, { headers: key ? { authorization: `Bearer ${key}` } : {}, timeoutMs, what: `OpenAI-compatible API (${model})` });
      const out = j?.choices?.[0]?.message?.content;
      if (typeof out !== "string" || !out.trim()) throw new TeacherError(`OpenAI (${model}) gave an empty answer${j?.choices?.[0]?.finish_reason ? ` (${j.choices[0].finish_reason})` : ""}`);
      return out;
    },
  };
}

/** The agent CLI each teacher kind needs on PATH. */
export const CLI_OF = { claude: "claude", codex: "codex", "gemini-cli": "gemini", cursor: "cursor-agent" };

/** Which of the agent CLIs are installed. */
export function availableClis(has = hasCommand) {
  return Object.fromEntries(Object.entries(CLI_OF).map(([k, cmd]) => [k, has(cmd)]));
}

/**
 * "The same AI you code with": the CLI of the agent that made the session, if it is installed;
 * else claude; else none. `hint` is the session's { source, agent }.
 * @returns {{kind: string|null, wanted: string, fallback: boolean}}
 */
export function resolveAgentTeacher(hint = {}, has = hasCommand) {
  const a = `${hint?.source === "claude-code" ? "claude" : ""} ${hint?.agent ?? ""}`.toLowerCase();
  const wanted = /claude/.test(a) ? "claude" : /cursor/.test(a) ? "cursor" : /codex/.test(a) ? "codex" : /gemini/.test(a) ? "gemini-cli" : "claude";
  if (has(CLI_OF[wanted])) return { kind: wanted, wanted, fallback: false };
  if (wanted !== "claude" && has("claude")) return { kind: "claude", wanted, fallback: true };
  return { kind: null, wanted, fallback: true };
}

/**
 * The teacher the user chose in config.json ("agent" = the session's own agent, the default).
 * @param {{teacher?: string, model?: string, ollamaUrl?: string, openaiBaseUrl?: string}} cfg
 * @param {{home: string, env?: object, fetchFn?: Function, timeoutMs?: number, hint?: {source?: string, agent?: string}, has?: Function}} opts
 */
export function makeTeacher(cfg, { home, env = process.env, fetchFn, timeoutMs, hint, has = hasCommand } = {}) {
  const extra = { ...(fetchFn ? { fetchFn } : {}), ...(timeoutMs ? { timeoutMs } : {}) };
  let kind = cfg.teacher ?? "agent", model = cfg.model || undefined, via = null;
  if (kind === "agent") {
    const r = resolveAgentTeacher(hint, has);
    if (!r.kind) {
      return { name: "none", via: "agent", ask: async () => { throw new Error(`No teacher found: the ${r.wanted} CLI isn't installed, and neither is claude. Choose your own model in the console's ⚙ settings (or: vibe-explainer config set teacher ollama).`); } };
    }
    kind = r.kind; model = undefined; via = r.fallback ? `agent (${r.wanted} not installed, so ${r.kind})` : "agent";
  }
  // a key saved in ~/.vibe-explainer/keys.json counts like an environment variable (the env wins)
  const withKey = (p, name) => { const k = home ? getKey(home, p, env) : null; return k ? { ...env, [name]: k } : env; };
  let t;
  switch (kind) {
    case "claude": t = claudeTeacher({ home, model, ...(timeoutMs ? { timeoutMs } : {}) }); break;
    case "codex": case "gemini-cli": case "cursor": t = agentCliTeacher(kind, { home, model, ...(timeoutMs ? { timeoutMs } : {}) }); break;
    case "ollama": t = ollamaTeacher({ model, url: cfg.ollamaUrl || undefined, ...extra }); break;
    case "gemini": t = geminiTeacher({ model, env: withKey("gemini", "GEMINI_API_KEY"), ...extra }); break;
    case "openai": t = openaiTeacher({ model, env: withKey("openai", "OPENAI_API_KEY"), baseUrl: cfg.openaiBaseUrl || undefined, ...extra }); break;
    default: throw new Error(`unknown teacher "${cfg.teacher}". Teachers: ${TEACHERS.join(", ")}`);
  }
  if (via) t.via = via;
  return t;
}

/** makeTeacher for one session: reads the session's agent so "agent" mode can follow it. */
export function teacherForSession(store, cfg, ids, opts = {}) {
  let hint = {};
  try { hint = JSON.parse(fs.readFileSync(path.join(store.sessionDir(ids.projectId, ids.sessionId), "session.json"), "utf8")); } catch { /* no session: claude */ }
  return makeTeacher(cfg, { home: store.home, ...opts, hint: { source: hint.source, agent: hint.agent } });
}
