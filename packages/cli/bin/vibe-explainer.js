#!/usr/bin/env node
// vibe-explainer command line. Commands so far: hook, init, status.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { recordHook, Store, homeDir, projectIdFor } from "@vibe-explainer/core";
import { initProject } from "../src/init.js";

const BIN = fileURLToPath(import.meta.url);
const [, , cmd, ...args] = process.argv;

function readStdin() {
  try { return fs.readFileSync(0, "utf8"); } catch { return ""; }
}

function logError(err) {
  try {
    const file = path.join(homeDir(), "errors.log");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${new Date().toISOString()} ${err?.stack ?? err}\n`);
  } catch { /* never fail a hook */ }
}

const HELP = `vibe-explainer: see what your AI coding agent did, explained.

  vibe-explainer init [dir]          add recording hooks to a project (Claude Code)
  vibe-explainer init [dir] --remove take them out again
  vibe-explainer status [dir]        show what has been recorded for a project
  vibe-explainer hook                (used by Claude Code; reads a hook payload on stdin)
`;

switch (cmd) {
  case "hook": {
    // Rule 2: never block or fail the agent. Always exit 0.
    try {
      const raw = readStdin();
      if (raw.trim()) recordHook(JSON.parse(raw));
    } catch (err) { logError(err); }
    process.exit(0);
  }
  case "init": {
    const remove = args.includes("--remove");
    const dir = args.find((a) => !a.startsWith("--")) ?? process.cwd();
    try {
      const file = initProject(dir, { binPath: BIN, remove });
      console.log(remove ? `Removed vibe-explainer hooks from ${file}` : `Recording hooks added to ${file}\nStart Claude Code in ${path.resolve(dir)} and send a prompt.`);
    } catch (err) { console.error(String(err.message ?? err)); process.exit(1); }
    break;
  }
  case "status": {
    const dir = path.resolve(args[0] ?? process.cwd());
    const store = new Store();
    const id = projectIdFor(dir);
    const sessions = store.listSessions(id);
    console.log(`Store: ${store.home}\nProject: ${dir} (${id})\nSessions: ${sessions.length}`);
    for (const s of sessions) {
      const ev = store.readEvents(id, s.id);
      const prompts = ev.filter((e) => e.kind === "prompt").length;
      const tools = ev.filter((e) => e.kind === "tool_end").length;
      console.log(`  ${s.startedAt}  ${s.id}  ${prompts} prompts, ${tools} tool calls, ${ev.length} events`);
    }
    break;
  }
  default:
    console.log(HELP);
    if (cmd && cmd !== "help" && cmd !== "--help") process.exit(1);
}
