// Teacher adapter: the user's own Claude Code (`claude -p`), so no API key is needed.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

function run(cmd, args, { input, cwd, env, timeoutMs, shell }) {
  return new Promise((resolve, reject) => {
    let child;
    try { child = spawn(cmd, args, { cwd, env, shell, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }); }
    catch (err) { reject(err); return; }
    let out = "", errOut = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error(`teacher timed out after ${timeoutMs / 1000}s`)); }, timeoutMs);
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { errOut += d; });
    child.on("error", (err) => { clearTimeout(timer); reject(err); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`claude exited with ${code}: ${(errOut || out).trim().slice(0, 500)}`));
    });
    child.stdin.end(input);
  });
}

/**
 * @param {{home: string, model?: string, timeoutMs?: number, command?: string}} opts
 */
export function claudeTeacher({ home, model, timeoutMs = 240000, command = "claude" } = {}) {
  // An empty folder, so the project's CLAUDE.md, settings and hooks are not loaded.
  const cwd = path.join(home, "tmp", "teacher");
  return {
    name: "claude",
    async ask(prompt) {
      fs.mkdirSync(cwd, { recursive: true });
      // Rules 3: our own run must never be recorded, and must not look nested.
      const env = { ...process.env, VIBE_EXPLAINER_INTERNAL: "1" };
      delete env.CLAUDECODE; delete env.CLAUDE_CODE_ENTRYPOINT;
      const args = ["-p", "--output-format", "json", "--max-turns", "1"];
      if (model) args.push("--model", model);
      let raw;
      try {
        raw = await run(command, args, { input: prompt, cwd, env, timeoutMs, shell: false });
      } catch (err) {
        if (err.code !== "ENOENT" || process.platform !== "win32") throw err;
        raw = await run(`${command}.cmd`, args, { input: prompt, cwd, env, timeoutMs, shell: true }); // npm-installed claude on Windows
      }
      let res;
      try { res = JSON.parse(raw); } catch { return raw; }
      if (res.is_error) throw new Error(`claude: ${String(res.result ?? res.subtype).slice(0, 300)}`);
      return String(res.result ?? "");
    },
  };
}
