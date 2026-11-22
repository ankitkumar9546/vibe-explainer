// Teachers that are other coding agents' own CLIs, so the lesson comes from the same AI the user
// codes with, on the user's own login (no API key): Codex, Gemini CLI, Cursor's cursor-agent.
// Each runs once, non-interactively, read-only where the CLI allows it, in an empty folder, with
// the prompt on stdin, and VIBE_EXPLAINER_INTERNAL=1 so nothing it does is recorded.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { runCli } from "./claude.js";

/** How each CLI is called. `out` = "stdout" or a file the CLI writes its last message to. */
export const AGENT_CLIS = {
  codex: { command: "codex", label: "Codex", args: (o) => ["exec", "--skip-git-repo-check", "--sandbox", "read-only", "--color", "never", ...(o.model ? ["-m", o.model] : []), "--output-last-message", o.outFile, "-"], out: "file" },
  "gemini-cli": { command: "gemini", label: "Gemini CLI", args: (o) => [...(o.model ? ["-m", o.model] : [])], out: "stdout" },
  cursor: { command: "cursor-agent", label: "Cursor", args: (o) => ["-p", "--output-format", "text", ...(o.model ? ["--model", o.model] : [])], out: "stdout" },
};

const found = new Map();
/** Is this command on PATH? Cached; `where`/`which`, never runs the tool itself. */
export function hasCommand(cmd) {
  if (found.has(cmd)) return found.get(cmd);
  let ok = false;
  try { execFileSync(process.platform === "win32" ? "where" : "which", [cmd], { stdio: "ignore", timeout: 5000 }); ok = true; } catch { ok = false; }
  found.set(cmd, ok);
  return ok;
}

export function agentCliTeacher(kind, { home, model, timeoutMs = 240000, run = runCli } = {}) {
  const spec = AGENT_CLIS[kind];
  if (!spec) throw new Error(`unknown agent CLI "${kind}"`);
  const cwd = path.join(home, "tmp", "teacher");
  return {
    name: model ? `${kind}:${model}` : kind,
    async ask(prompt) {
      fs.mkdirSync(cwd, { recursive: true });
      const env = { ...process.env, VIBE_EXPLAINER_INTERNAL: "1", NO_COLOR: "1" };
      delete env.CLAUDECODE;
      const outFile = path.join(cwd, `last-${process.pid}-${Date.now()}.txt`);
      const args = spec.args({ model, outFile });
      let raw;
      try {
        try { raw = await run(spec.command, args, { input: prompt, cwd, env, timeoutMs, shell: false }); }
        catch (err) {
          if (err.code !== "ENOENT") throw err;
          if (process.platform !== "win32") throw new Error(`${spec.label} is not installed (no \`${spec.command}\` on PATH)`);
          raw = await run(`${spec.command}.cmd`, args, { input: prompt, cwd, env, timeoutMs, shell: true }); // npm-installed CLIs on Windows
        }
        const text = spec.out === "file" ? (fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8") : "") : raw;
        if (!String(text).trim()) throw new Error(`${spec.label} gave an empty answer`);
        return String(text);
      } finally { fs.rmSync(outFile, { force: true }); }
    },
  };
}
