#!/usr/bin/env node
// vibe-explainer command line. Commands so far: hook, init, status.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { recordHook, Store, homeDir, projectIdFor, snapshotBefore, finishTurn, takeSnapshot, readJson, writeJson, loadConfig, setConfig, teachTurn, claudeTeacher, startServer, shadowDir, ensureAnalysis, buildExport, startWatch } from "../../core/src/index.js";
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

/** --name value */
const flagOf = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
/** First argument that is not a flag or a flag's value. */
const dirArg = () => path.resolve(args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && !["--json", "--offline", "--no-browser", "--detach", "--remove"].includes(args[i - 1]))) ?? process.cwd());

/** The turn named by --session/--turn, or the newest finished prompt across sessions. */
function pickTurn(store, dir) {
  const projectId = projectIdFor(dir);
  const sessions = store.listSessions(projectId);
  if (!sessions.length) { console.error(`Nothing recorded yet for ${dir}. Install the plugin (or run "vibe-explainer init" there) and use Claude Code first.`); process.exit(1); }
  let session = flagOf("session") ? sessions.find((x) => x.id === flagOf("session")) : null;
  let turn = Number(flagOf("turn")) || 0;
  if (!session || !turn) {
    // Our own /vibe-explainer:… commands don't count (running /explain starts a session of its own).
    search: for (const x of session ? [session] : sessions.slice().reverse()) {
      for (let n = turn || store.currentTurn(projectId, x.id); n >= 1; n--) {
        const t = readJson(path.join(store.turnDir(projectId, x.id, n), "turn.json"));
        if (t?.after && !String(t.prompt ?? "").startsWith("/vibe-explainer")) { session = x; turn = n; break search; }
        if (turn) break;
      }
    }
  }
  if (!session || !turn) { console.error("No finished prompt with a diff yet. Ask the agent something first, then try again."); process.exit(1); }
  return { projectId, sessionId: session.id, turn };
}

const HELP = `vibe-explainer: see what your AI coding agent did, explained.

  vibe-explainer init [dir]          add recording hooks to a project (Claude Code)
  vibe-explainer init [dir] --remove take them out again
  vibe-explainer status [dir]        show what has been recorded for a project
  vibe-explainer explain [dir]       write the lesson for the latest finished prompt
        [--turn N] [--session ID] [--level beg|dev] [--lang hi|en]
  vibe-explainer analyze [dir]       callers, packages and security notes for the latest prompt
        [--turn N] [--session ID] [--json] [--offline]
  vibe-explainer export [dir] --kind pr|commit|note [--session ID] [--lang hi|en]
                                     ready-made text from the newest session
  vibe-explainer config [set KEY VALUE]   teacher, mode (manual|auto), level, lang, model, registry (on|off)
  vibe-explainer open [dir] [--port N] [--no-browser] [--detach]   open the console in your browser
  vibe-explainer watch [dir] [--agent NAME] [--quiet SECONDS]
                                     record an agent with no hooks (Cursor, Copilot…) by watching files
  vibe-explainer hook                (used by Claude Code; reads a hook payload on stdin)
`;

switch (cmd) {
  case "hook": {
    // Rule 2: never block or fail the agent. Always exit 0.
    try {
      const raw = readStdin();
      const payload = raw.trim() ? JSON.parse(raw) : null;
      // First session in a project (plugin installs have no `init`): warm the shadow repo in the
      // background so the first prompt's "before" snapshot is quick.
      if (payload?.hook_event_name === "SessionStart" && payload.cwd && process.env.VIBE_EXPLAINER_INTERNAL !== "1") {
        const store = new Store();
        if (!fs.existsSync(path.join(shadowDir(store.home, projectIdFor(payload.cwd)), "HEAD"))) {
          spawn(process.execPath, [BIN, "baseline", payload.cwd], { detached: true, stdio: "ignore", windowsHide: true, env: process.env }).unref();
        }
      }
      if (payload) recordHook(payload, {
        onTurnOpened: (ctx) => snapshotBefore(ctx.store, ctx),
        onTurnClosed: (ctx) => {
          // "after" snapshot + diff run right here: the agent has finished, and a detached child
          // is not safe on Windows (Claude Code ends its child processes when it exits).
          const t = finishTurn(ctx.store, ctx);
          // Auto lessons take a minute. Detach them where that is reliable; on Windows the open
          // console (vibe-explainer open) does it instead.
          if (t?.after && process.platform !== "win32" && loadConfig(ctx.store.home).mode === "auto") {
            spawn(process.execPath, [BIN, "explain", ctx.cwd, "--session", ctx.sessionId, "--turn", String(ctx.turn)], {
              detached: true, stdio: "ignore", env: process.env,
            }).unref();
          }
        },
      });
    } catch (err) { logError(err); }
    process.exit(0);
  }
  case "finish-turn": {
    const [projectId, sessionId, turn] = args;
    // Manual repair: redo the "after" snapshot and diff for a turn.
    try { finishTurn(new Store(), { projectId, sessionId, turn: Number(turn) }); }
    catch (err) { logError(err); }
    process.exit(0);
  }
  case "explain": {
    const flag = flagOf;
    const store = new Store();
    const cfg = loadConfig(store.home);
    const ids = pickTurn(store, dirArg());
    const session = { id: ids.sessionId }, turn = ids.turn, projectId = ids.projectId;
    const level = flag("level") ?? cfg.level, lang = flag("lang") ?? cfg.lang;
    console.log(`Teaching turn ${turn} of session ${session.id} (${level}, ${lang}) with ${cfg.teacher}…`);
    const t0 = Date.now();
    const res = await teachTurn(store, { projectId, sessionId: session.id, turn }, { teacher: claudeTeacher({ home: store.home, model: cfg.model || undefined }), level, lang, online: cfg.registry === "on" });
    if (!res.ok) { console.error(`Lesson failed: ${res.error}`); process.exit(1); }
    const l = res.lesson;
    console.log(`\n${l.title}\n${l.summary}\n`);
    for (const c of l.claims) console.log(`  [${c.status}] ${c.text}`);
    console.log(`\n${l.impact.length} impact notes, ${l.quiz.length} quiz questions. Saved: ${res.file} (${Math.round((Date.now() - t0) / 1000)}s)`);
    break;
  }
  case "analyze": {
    const store = new Store();
    const ids = pickTurn(store, dirArg());
    const a = await ensureAnalysis(store, ids, { online: !args.includes("--offline") && loadConfig(store.home).registry === "on" });
    if (!a) { console.error("This prompt has no before/after snapshot to analyse."); process.exit(1); }
    if (args.includes("--json")) { console.log(JSON.stringify(a, null, 2)); break; }
    console.log(`Turn ${ids.turn} of session ${ids.sessionId} (${a.ms ?? "?"} ms)`);
    for (const x of a.symbols) {
      const users = x.callers.filter((c) => c.kind !== "import");
      console.log(`
  [risk ${x.risk}] ${x.change} ${x.kind} ${x.owner ? x.owner + "." : ""}${x.name}  ${x.file}:${x.start}${x.signatureChanged ? `  (${x.paramsBefore ?? ""}) -> (${x.params ?? ""})` : ""}`);
      console.log(`      ${x.reasons.join(", ")}`);
      for (const c of users.slice(0, 10)) console.log(`      used at ${c.file}:${c.line}${c.in ? ` in ${c.in}` : ""}`);
      if (users.length > 10) console.log(`      … and ${users.length - 10} more`);
    }
    for (const p of a.packages) {
      const f = p.facts;
      console.log(`
  package ${p.change}: ${p.name} ${p.from ?? ""}${p.from && p.to ? " -> " : ""}${p.to ?? ""}${p.dev ? " (dev)" : ""}` +
        (f ? `
      licence ${f.license ?? "?"}, ${f.size != null ? Math.round(f.size / 1024) + " KB" : "size ?"}, ${f.weeklyDownloads ?? "?"} downloads/week` : p.factsError ? `
      (lookup failed: ${p.factsError})` : ""));
    }
    for (const x of a.security) console.log(`\n  security [${x.severity}] ${x.rule}  ${x.file}${x.line ? ":" + x.line : ""}${x.text ? `\n      ${x.text}` : ""}`);
    if (!a.symbols.length && !a.packages.length && !a.security.length) console.log("  Nothing to report: no functions, packages or risky patterns changed.");
    break;
  }
  case "export": {
    const store = new Store();
    const dir = dirArg(), projectId = projectIdFor(dir);
    const sessions = store.listSessions(projectId);
    // The newest session with a real prompt in it (running /vibe-explainer:… opens a session of its own).
    const real = (x) => { for (let n = 1; n <= store.currentTurn(projectId, x.id); n++) { const t = readJson(path.join(store.turnDir(projectId, x.id, n), "turn.json")); if (t && !String(t.prompt ?? "").startsWith("/vibe-explainer")) return true; } return false; };
    const session = flagOf("session") ? sessions.find((x) => x.id === flagOf("session")) : sessions.slice().reverse().find(real);
    if (!session) { console.error(`Nothing recorded yet for ${dir}.`); process.exit(1); }
    const turns = [];
    for (let n = 1; n <= store.currentTurn(projectId, session.id); n++) {
      const tdir = store.turnDir(projectId, session.id, n);
      const turn = readJson(path.join(tdir, "turn.json")); if (!turn) continue;
      turns.push({ turn, events: store.readEvents(projectId, session.id).filter((e) => e.turn === n), lesson: readJson(path.join(tdir, "lesson.json")), analysis: readJson(path.join(tdir, "analysis.json")) });
    }
    const kind = ["pr", "commit", "note"].includes(flagOf("kind")) ? flagOf("kind") : "pr";
    process.stdout.write(buildExport(kind, { project: path.basename(dir), turns }, flagOf("lang") ?? loadConfig(store.home).lang));
    break;
  }
  case "watch": {
    const store = new Store();
    const dir = dirArg();
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) { console.error(`No such folder: ${dir}`); process.exit(1); }
    const agent = flagOf("agent") ?? "agent";
    const quietMs = Math.max(2, Number(flagOf("quiet")) || 8) * 1000;
    const cfg = loadConfig(store.home);
    let teaching = Promise.resolve();
    const w = startWatch(store, {
      dir, agent, quietMs,
      onChange: (rel) => process.stdout.write(`  changed ${rel}\n`),
      onTurn: (info) => {
        const sum = info.files.map((f) => `${f.path} +${f.add ?? "?"} -${f.del ?? "?"}`).join(", ");
        console.log(`turn ${info.turn}: ${info.files.length} file${info.files.length === 1 ? "" : "s"} (${sum})`);
        if (loadConfig(store.home).mode === "auto") {
          teaching = teaching.then(() => teachTurn(store, info, { teacher: claudeTeacher({ home: store.home, model: cfg.model || undefined }), level: cfg.level, lang: cfg.lang, online: cfg.registry === "on" }))
            .then((r) => console.log(r.ok ? `  lesson ready for turn ${info.turn}` : `  lesson failed: ${r.error}`)).catch(() => {});
        }
      },
    });
    console.log(`Watching ${dir} for ${agent} (session ${w.sessionId}).
A prompt ends after ${quietMs / 1000}s with no changes. Type what you asked the agent and press Enter to name the prompt; an empty line ends it now. Ctrl+C stops.`);
    process.stdin.setEncoding("utf8");
    let buf = "";
    process.stdin.on("data", (d) => {
      buf += d; let i;
      while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) { w.label(line); console.log("  (prompt noted)"); } else w.flush(); }
    });
    const end = async () => { w.stop(); await teaching; console.log("Stopped. Open the console with: vibe-explainer open"); process.exit(0); };
    process.on("SIGINT", end); process.on("SIGTERM", end);
    process.stdin.on("end", () => { /* no terminal: keep watching until a signal */ });
    await new Promise(() => {});
    break;
  }
  case "baseline": {
    try {
      const dir = path.resolve(args[0] ?? process.cwd());
      const store = new Store();
      takeSnapshot({ home: store.home, projectId: store.ensureProject(dir, new Date().toISOString()), workTree: dir, ref: "refs/vibe-explainer/baseline", message: "baseline" });
    } catch (err) { logError(err); }
    process.exit(0);
  }
  case "open": {
    const flag = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
    const store = new Store();
    const cfg = loadConfig(store.home);
    const dir = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1] === "--port"));
    const serverFile = path.join(store.home, "server.json");
    const withProject = (u) => (dir ? `${u}&project=${projectIdFor(path.resolve(dir))}` : u);
    const openBrowser = (u) => {
      if (args.includes("--no-browser")) return;
      const opener = process.platform === "win32" ? ["cmd", ["/c", "start", "", u]] : process.platform === "darwin" ? ["open", [u]] : ["xdg-open", [u]];
      try { spawn(opener[0], opener[1], { stdio: "ignore", detached: true, windowsHide: true }).unref(); } catch { /* print only */ }
    };
    const alive = async (info) => {
      if (!info?.port || !info?.token) return false;
      try {
        const r = await fetch(`http://127.0.0.1:${info.port}/api/projects?t=${info.token}`, { signal: AbortSignal.timeout(800) });
        return r.ok;
      } catch { return false; }
    };
    // One console per machine: reuse a running one.
    const running = readJson(serverFile);
    if (await alive(running)) {
      const u = withProject(running.url);
      console.log(`vibe-explainer console (already running): ${u}`);
      openBrowser(u);
      break;
    }
    if (args.includes("--detach")) {
      // Start the server as its own process and come back with its address (used by /console).
      spawn(process.execPath, [BIN, "open", ...(dir ? [dir] : []), "--no-browser", "--port", String(Number(flag("port")) || 4321)], { detached: true, stdio: "ignore", windowsHide: true }).unref();
      const until = Date.now() + 8000;
      let info = null;
      while (Date.now() < until) {
        await new Promise((r) => setTimeout(r, 250));
        const cur = readJson(serverFile);
        if (cur && cur.pid !== running?.pid && await alive(cur)) { info = cur; break; }
      }
      if (!info) { console.error("The console did not start. Try: vibe-explainer open"); process.exit(1); }
      const u = withProject(info.url);
      console.log(`vibe-explainer console: ${u}`);
      openBrowser(u);
      break;
    }
    const staticDir = path.resolve(path.dirname(BIN), "..", "..", "console");
    const srv = await startServer(store, {
      staticDir, port: Number(flag("port")) || 4321,
      onExplain: (ids, o) => teachTurn(store, ids, { teacher: claudeTeacher({ home: store.home, model: cfg.model || undefined }), level: o.level, lang: o.lang, online: loadConfig(store.home).registry === "on" }),
      online: () => loadConfig(store.home).registry === "on",
      makeTeacher: () => claudeTeacher({ home: store.home, model: loadConfig(store.home).model || undefined, timeoutMs: 180000 }),
      autoTeach: () => loadConfig(store.home).mode === "auto" ? { level: loadConfig(store.home).level, lang: loadConfig(store.home).lang } : null,
    });
    writeJson(serverFile, { port: srv.port, token: srv.token, pid: process.pid, url: srv.url, startedAt: new Date().toISOString() });
    const cleanup = () => { try { if (readJson(serverFile)?.pid === process.pid) fs.rmSync(serverFile); } catch { /* gone */ } };
    process.on("exit", cleanup);
    for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(0));
    const url = withProject(srv.url);
    console.log(`vibe-explainer console: ${url}\nOnly this computer can open it. Press Ctrl+C to stop.`);
    openBrowser(url);
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
