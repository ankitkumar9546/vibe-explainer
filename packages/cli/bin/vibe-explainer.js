#!/usr/bin/env node
// vibe-explainer command line. Commands so far: hook, init, status.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { recordHook, Store, homeDir, projectIdFor, snapshotBefore, finishTurn, takeSnapshot, readJson, loadConfig, setConfig, teachTurn, claudeTeacher } from "@vibe-explainer/core";
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
  vibe-explainer explain [dir]       write the lesson for the latest finished prompt
        [--turn N] [--session ID] [--level beg|dev] [--lang hi|en]
  vibe-explainer config [set KEY VALUE]   teacher, mode (manual|auto), level, lang, model
  vibe-explainer hook                (used by Claude Code; reads a hook payload on stdin)
`;

switch (cmd) {
  case "hook": {
    // Rule 2: never block or fail the agent. Always exit 0.
    try {
      const raw = readStdin();
      if (raw.trim()) recordHook(JSON.parse(raw), {
        onTurnOpened: (ctx) => snapshotBefore(ctx.store, ctx),
        onTurnClosed: (ctx) => {
          // "after" snapshot + diff run detached so the agent is never kept waiting.
          spawn(process.execPath, [BIN, "finish-turn", ctx.projectId, ctx.sessionId, String(ctx.turn)], {
            detached: true, stdio: "ignore", windowsHide: true, env: process.env,
          }).unref();
        },
      });
    } catch (err) { logError(err); }
    process.exit(0);
  }
  case "finish-turn": {
    const [projectId, sessionId, turn] = args;
    try {
      const store = new Store();
      const t = finishTurn(store, { projectId, sessionId, turn: Number(turn) });
      const cfg = loadConfig(store.home);
      if (t?.after && cfg.mode === "auto") {
        await teachTurn(store, { projectId, sessionId, turn: Number(turn) }, { teacher: claudeTeacher({ home: store.home, model: cfg.model || undefined }), level: cfg.level, lang: cfg.lang });
      }
    } catch (err) { logError(err); }
    process.exit(0);
  }
  case "explain": {
    const flag = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
    const dir = path.resolve(args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--"))) ?? process.cwd());
    const store = new Store();
    const cfg = loadConfig(store.home);
    const projectId = projectIdFor(dir);
    const sessions = store.listSessions(projectId);
    const session = flag("session") ? sessions.find((s) => s.id === flag("session")) : sessions.at(-1);
    if (!session) { console.error(`Nothing recorded yet for ${dir}. Run "vibe-explainer init" there and use Claude Code first.`); process.exit(1); }
    let turn = Number(flag("turn")) || 0;
    if (!turn) {
      for (let n = store.currentTurn(projectId, session.id); n >= 1; n--) {
        if (readJson(path.join(store.turnDir(projectId, session.id, n), "turn.json"))?.after) { turn = n; break; }
      }
    }
    if (!turn) { console.error("No finished turn with a diff yet in the latest session."); process.exit(1); }
    const level = flag("level") ?? cfg.level, lang = flag("lang") ?? cfg.lang;
    console.log(`Teaching turn ${turn} of session ${session.id} (${level}, ${lang}) with ${cfg.teacher}…`);
    const t0 = Date.now();
    const res = await teachTurn(store, { projectId, sessionId: session.id, turn }, { teacher: claudeTeacher({ home: store.home, model: cfg.model || undefined }), level, lang });
    if (!res.ok) { console.error(`Lesson failed: ${res.error}`); process.exit(1); }
    const l = res.lesson;
    console.log(`\n${l.title}\n${l.summary}\n`);
    for (const c of l.claims) console.log(`  [${c.status}] ${c.text}`);
    console.log(`\n${l.impact.length} impact notes, ${l.quiz.length} quiz questions. Saved: ${res.file} (${Math.round((Date.now() - t0) / 1000)}s)`);
    break;
  }
  case "config": {
    const store = new Store();
    try {
      const cfg = args[0] === "set" ? setConfig(store.home, args[1], args[2]) : loadConfig(store.home);
      for (const [k, v] of Object.entries(cfg)) console.log(`${k} = ${v}`);
    } catch (err) { console.error(String(err.message ?? err)); process.exit(1); }
    break;
  }
  case "init": {
    const remove = args.includes("--remove");
    const dir = args.find((a) => !a.startsWith("--")) ?? process.cwd();
    try {
      const file = initProject(dir, { binPath: BIN, remove });
      if (remove) { console.log(`Removed vibe-explainer hooks from ${file}`); break; }
      // Warm the shadow repo now, so the first prompt's "before" snapshot is quick.
      const t0 = Date.now();
      const store = new Store();
      takeSnapshot({ home: store.home, projectId: store.ensureProject(dir, new Date().toISOString()), workTree: path.resolve(dir), ref: "refs/vibe-explainer/baseline", message: "baseline" });
      console.log(`Recording hooks added to ${file}\nBaseline snapshot taken in ${Date.now() - t0} ms.\nStart Claude Code in ${path.resolve(dir)} and send a prompt.`);
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
      for (let n = 1; n <= prompts; n++) {
        const t = readJson(path.join(store.turnDir(id, s.id, n), "turn.json"), {});
        const files = (t.files ?? []).map((f) => `${f.status[0].toUpperCase()} ${f.path} +${f.add ?? "?"} -${f.del ?? "?"}`).join(", ");
        console.log(`    turn ${n} [${t.status}] ${t.snapshotError ? `snapshot error: ${t.snapshotError}` : files || (t.after ? "no file changes" : "diff pending")}`);
      }
    }
    break;
  }
  default:
    console.log(HELP);
    if (cmd && cmd !== "help" && cmd !== "--help") process.exit(1);
}
