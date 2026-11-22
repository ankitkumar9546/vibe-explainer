// User settings: ~/.vibe-explainer/config.json
import path from "node:path";
import { readJson, writeJson } from "./store.js";

export const DEFAULTS = Object.freeze({
  teacher: "agent",    // agent = the CLI of the agent you code with (default) | claude | codex | gemini-cli | cursor | ollama | gemini | openai
  mode: "manual",      // manual: lessons only on `explain`; auto: after every turn (uses model quota)
  level: "beg",        // beg | dev
  lang: "hi",          // hi (Hinglish) | en
  model: "",           // optional model name for the teacher (empty = the adapter's default)
  ollamaUrl: "",       // empty = http://127.0.0.1:11434
  openaiBaseUrl: "",   // empty = https://api.openai.com/v1; or LM Studio, OpenRouter…
  registry: "on",      // on: look up new packages on npm / PyPI (licence, size, downloads); off: never go online for that
});

const ALLOWED = { teacher: ["agent", "claude", "codex", "gemini-cli", "cursor", "ollama", "gemini", "openai"], mode: ["manual", "auto"], level: ["beg", "dev"], lang: ["hi", "en"], registry: ["on", "off"] };

export function loadConfig(home) {
  return { ...DEFAULTS, ...readJson(path.join(home, "config.json"), {}) };
}

export function setConfig(home, key, value) {
  if (!(key in DEFAULTS)) throw new Error(`unknown setting "${key}". Settings: ${Object.keys(DEFAULTS).join(", ")}`);
  if (ALLOWED[key] && !ALLOWED[key].includes(value)) throw new Error(`${key} must be one of: ${ALLOWED[key].join(", ")}`);
  const next = { ...readJson(path.join(home, "config.json"), {}), [key]: value };
  writeJson(path.join(home, "config.json"), next);
  return { ...DEFAULTS, ...next };
}
