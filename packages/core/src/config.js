// User settings: ~/.vibe-explainer/config.json
import path from "node:path";
import { readJson, writeJson } from "./store.js";

export const DEFAULTS = Object.freeze({
  teacher: "claude",   // claude | (later) ollama | gemini | openai
  mode: "manual",      // manual: lessons only on `explain`; auto: after every turn (uses model quota)
  level: "beg",        // beg | dev
  lang: "hi",          // hi (Hinglish) | en
  model: "",           // optional model name for the teacher
});

const ALLOWED = { teacher: ["claude"], mode: ["manual", "auto"], level: ["beg", "dev"], lang: ["hi", "en"] };

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
