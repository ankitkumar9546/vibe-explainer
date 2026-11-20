// `vibe-explainer init`: add our hooks to a project's .claude/settings.local.json
// (personal, not committed). Used until the plugin exists (Roadmap Phase 5).
import fs from "node:fs";
import path from "node:path";

export const HOOK_EVENTS = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop", "SessionEnd"];
const WITH_MATCHER = new Set(["PreToolUse", "PostToolUse"]);
const MARK = "vibe-explainer";

/** The command Claude Code runs for every hook. */
export function hookCommand(binPath) {
  return `node "${binPath.replace(/\\/g, "/")}" hook`;
}

function isOurs(entry) {
  return Array.isArray(entry?.hooks) && entry.hooks.some((h) => typeof h?.command === "string" && h.command.includes(MARK));
}

/**
 * Merge (or remove) our hooks into a settings object without touching anything else.
 * @param {object} settings  existing settings (may be {})
 * @param {string|null} command  null = remove
 */
export function mergeHooks(settings, command) {
  const out = { ...settings, hooks: { ...(settings.hooks ?? {}) } };
  for (const ev of HOOK_EVENTS) {
    const kept = (out.hooks[ev] ?? []).filter((e) => !isOurs(e));
    if (command) {
      const entry = { hooks: [{ type: "command", command, timeout: 10 }] };
      if (WITH_MATCHER.has(ev)) entry.matcher = "*";
      kept.push(entry);
    }
    if (kept.length) out.hooks[ev] = kept; else delete out.hooks[ev];
  }
  if (!Object.keys(out.hooks).length) delete out.hooks;
  return out;
}

/**
 * @param {string} projectDir
 * @param {{binPath: string, remove?: boolean}} opts
 * @returns {string} the settings file written
 */
export function initProject(projectDir, { binPath, remove = false }) {
  const file = path.join(path.resolve(projectDir), ".claude", "settings.local.json");
  let current = {};
  if (fs.existsSync(file)) {
    try { current = JSON.parse(fs.readFileSync(file, "utf8")); }
    catch { throw new Error(`${file} is not valid JSON; fix it first, nothing was changed.`); }
  }
  const next = mergeHooks(current, remove ? null : hookCommand(binPath));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
  return file;
}
