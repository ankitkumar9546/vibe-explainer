// API keys for "your own model" (Phase 11b). Kept ONLY on this computer, in
// ~/.vibe-explainer/keys.json, readable by the current user alone. An environment variable
// (GEMINI_API_KEY, OPENAI_API_KEY) always wins over a saved key. A key is never sent anywhere
// except its own provider, never logged, and never shown back in full.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const KEY_PROVIDERS = { gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"], openai: ["OPENAI_API_KEY"] };
const file = (home) => path.join(home, "keys.json");

function readKeys(home) {
  try { return JSON.parse(fs.readFileSync(file(home), "utf8")); } catch { return {}; }
}

/** Only the owner may read the file: chmod 600, and on Windows an ACL with just this user. */
function lockDown(f) {
  try { fs.chmodSync(f, 0o600); } catch { /* best effort */ }
  if (process.platform === "win32") {
    const who = process.env.USERNAME ? `${process.env.USERDOMAIN ? `${process.env.USERDOMAIN}\\` : ""}${process.env.USERNAME}` : null;
    if (who) { try { execFileSync("icacls", [f, "/inheritance:r", "/grant:r", `${who}:F`], { stdio: "ignore", windowsHide: true }); } catch { /* best effort */ } }
  }
}

export function setKey(home, provider, value) {
  if (!KEY_PROVIDERS[provider]) throw new Error(`keys are for: ${Object.keys(KEY_PROVIDERS).join(", ")}`);
  const v = String(value ?? "").trim();
  if (!v || /\s/.test(v) || v.length > 512) throw new Error("that doesn't look like an API key");
  const keys = readKeys(home);
  keys[provider] = v;
  fs.mkdirSync(home, { recursive: true });
  const f = file(home), tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(keys, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, f);
  lockDown(f);
}

export function clearKey(home, provider) {
  const keys = readKeys(home);
  if (!(provider in keys)) return;
  delete keys[provider];
  if (Object.keys(keys).length) { fs.writeFileSync(file(home), JSON.stringify(keys, null, 2), { mode: 0o600 }); lockDown(file(home)); }
  else fs.rmSync(file(home), { force: true });
}

/** The key to use: environment first, then the saved one. */
export function getKey(home, provider, env = process.env) {
  for (const name of KEY_PROVIDERS[provider] ?? []) if (env[name]) return env[name];
  return readKeys(home)[provider] ?? null;
}

/** What the console may show: where the key comes from and its last 4 characters. */
export function keyStatus(home, provider, env = process.env) {
  for (const name of KEY_PROVIDERS[provider] ?? []) if (env[name]) return { source: "env", name, hint: `…${env[name].slice(-4)}` };
  const k = readKeys(home)[provider];
  return k ? { source: "saved", hint: `…${k.slice(-4)}` } : null;
}
