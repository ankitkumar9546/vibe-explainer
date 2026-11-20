// Build the static demo site (GitHub Pages) from real recorded sessions.
// Usage: node scripts/build-demo.mjs --home <store> --project <path>   (writes demo/demo-data.json, then assembles site/)
// Personal data is scrubbed: absolute paths become ~/demo-project, transcript paths are dropped,
// and the build FAILS if the user's name or home folder is still anywhere in the output.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Store, projectIdFor, readJson } from "../packages/core/src/index.js";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const home = path.resolve(arg("home", path.join(os.homedir(), ".vibe-explainer")));
const project = path.resolve(arg("project", ""));
const dataFile = path.resolve("demo", "demo-data.json");
const store = new Store({ home });
const pid = projectIdFor(project);
const meta = readJson(path.join(store.projectDir(pid), "project.json"));
if (!meta) { console.error(`no recordings for ${project} in ${home}`); process.exit(1); }

// Every spelling of the project path (slashes, escaped backslashes, case) → ~/demo-project.
const variants = new Set();
for (const p of [project, meta.path]) {
  for (const s of [p, p.replace(/\\/g, "/"), p.replace(/\\/g, "\\\\"), p.replace(/\//g, "\\")]) { variants.add(s); variants.add(s.toLowerCase()); }
}
const userHome = os.homedir(), userName = path.basename(userHome);
const scrub = (text) => {
  let s = text;
  for (const v of [...variants].sort((a, b) => b.length - a.length)) s = s.split(v).join("~/demo-project");
  for (const v of [userHome, userHome.replace(/\\/g, "/"), userHome.replace(/\\/g, "\\\\")]) s = s.split(v).join("~");
  return s;
};
const clean = (obj) => JSON.parse(scrub(JSON.stringify(obj)));

const db = { projects: [], sessions: {}, session: {}, turn: {} };
const sessions = store.listSessions(pid).filter((s) => store.currentTurn(pid, s.id) > 0);
db.projects.push({ id: pid, name: "demo-project", path: "~/demo-project", createdAt: meta.createdAt, sessions: sessions.length });
db.sessions[pid] = sessions.map((s) => clean({ ...s, transcriptPath: undefined, cwd: "~/demo-project", turns: store.currentTurn(pid, s.id) }));
for (const s of sessions) {
  const turns = [];
  for (let n = 1; n <= store.currentTurn(pid, s.id); n++) {
    const dir = store.turnDir(pid, s.id, n);
    const t = readJson(path.join(dir, "turn.json"));
    if (!t || String(t.prompt).startsWith("/vibe-explainer")) continue;
    const lesson = readJson(path.join(dir, "lesson.json"));
    let diff = ""; try { diff = fs.readFileSync(path.join(dir, "diff.patch"), "utf8"); } catch { /* none */ }
    const events = store.readEvents(pid, s.id).filter((e) => e.turn === n).map((e) => ({ ...e, transcriptPath: undefined }));
    turns.push({ ...t, hasLesson: !!lesson, lessonTitle: lesson?.title ?? null, claimsNone: lesson ? lesson.claims.filter((c) => c.status === "none").length : 0 });
    db.turn[`${pid}/${s.id}/${n}`] = clean({ turn: t, events, diff, lesson });
  }
  db.session[`${pid}/${s.id}`] = clean({ session: { ...s, transcriptPath: undefined, cwd: "~/demo-project" }, turns });
}

const json = JSON.stringify(db);
const leaks = [userName, userHome, userHome.replace(/\\/g, "/")].filter((x) => x && x.length > 2 && json.toLowerCase().includes(x.toLowerCase()));
if (leaks.length) { console.error(`refusing to build: personal data still present (${leaks.join(", ")})`); process.exit(1); }

fs.mkdirSync(path.dirname(dataFile), { recursive: true });
fs.writeFileSync(dataFile, json);
console.log(`demo data: ${dataFile} (${sessions.length} sessions, ${Object.keys(db.turn).length} prompts, ${(json.length / 1024).toFixed(0)} KB)`);
await import("./assemble-site.mjs");
