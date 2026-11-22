// Teacher adapters (Roadmap Phase 11). Every teacher is { name, ask(prompt) -> Promise<string> },
// so the lesson, chat, playground and explain-back code never knows which model answered.
// API keys come ONLY from environment variables; they are never written to config.json.
import { claudeTeacher } from "./claude.js";

export const TEACHERS = ["claude", "ollama", "gemini", "openai"];
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

/**
 * The teacher the user chose in config.json.
 * @param {{teacher?: string, model?: string, ollamaUrl?: string, openaiBaseUrl?: string}} cfg
 * @param {{home: string, env?: object, fetchFn?: Function, timeoutMs?: number}} opts
 */
export function makeTeacher(cfg, { home, env = process.env, fetchFn, timeoutMs } = {}) {
  const model = cfg.model || undefined;
  const extra = { ...(fetchFn ? { fetchFn } : {}), ...(timeoutMs ? { timeoutMs } : {}) };
  switch (cfg.teacher ?? "claude") {
    case "claude": return claudeTeacher({ home, model, ...(timeoutMs ? { timeoutMs } : {}) });
    case "ollama": return ollamaTeacher({ model, url: cfg.ollamaUrl || undefined, ...extra });
    case "gemini": return geminiTeacher({ model, env, ...extra });
    case "openai": return openaiTeacher({ model, env, baseUrl: cfg.openaiBaseUrl || undefined, ...extra });
    default: throw new Error(`unknown teacher "${cfg.teacher}". Teachers: ${TEACHERS.join(", ")}`);
  }
}
