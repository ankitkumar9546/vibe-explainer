// MCP tools (Roadmap Phase 12): read-only questions about the record, answered from the store.
// "What changed yesterday?" → recent_changes({ since: "yesterday" }). Nothing here writes.
import fs from "node:fs";
import path from "node:path";
import { readJson, projectIdFor, maskSecrets, maskEnvFilesInPatch, stepLines, analysisText, buildTodo, ensureAnalysis } from "../../core/src/index.js";

const DAY = 24 * 3600 * 1000;
const pad = (n) => String(n).padStart(2, "0");
const localStamp = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const offset = (d) => { const m = -d.getTimezoneOffset(); return `UTC${m >= 0 ? "+" : "-"}${pad(Math.floor(Math.abs(m) / 60))}:${pad(Math.abs(m) % 60)}`; };
const clip = (s, n) => (s.length > n ? `${s.slice(0, n)}\n…[cut ${s.length - n} chars]` : s);
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * A time window from words people use. Local time.
 * since: today | yesterday | last_24_hours | last_7_days | last_30_days | YYYY-MM-DD | ISO time
 * @returns {{from: Date, to: Date, label: string}}
 */
export function timeWindow({ since = "last_7_days", until } = {}, now = new Date()) {
  const today = startOfDay(now);
  const raw = String(since).trim();
  const word = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : raw.toLowerCase().replace(/[\s-]+/g, "_");
  let from, to = now, label = word;
  if (word === "today") { from = today; }
  else if (word === "yesterday") { from = new Date(today.getTime() - DAY); to = today; }
  else if (/^last_(\d+)_(hours?|days?)$/.test(word)) { const [, n, unit] = /^last_(\d+)_(hours?|days?)$/.exec(word); from = new Date(now.getTime() - Number(n) * (unit.startsWith("hour") ? 3600 * 1000 : DAY)); }
  else if (/^\d{4}-\d{2}-\d{2}$/.test(word)) { const [y, m, d] = word.split("-").map(Number); from = new Date(y, m - 1, d); to = until ? to : new Date(y, m - 1, d + 1); label = word; }
  else if (!Number.isNaN(Date.parse(since))) { from = new Date(since); label = since; }
  else throw new Error(`since: use today, yesterday, last_24_hours, last_7_days, a date like 2026-11-21, or an ISO time (got "${since}")`);
  if (until) {
    const u = String(until).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(u)) { const [y, m, d] = u.split("-").map(Number); to = new Date(y, m - 1, d + 1); }
    else if (!Number.isNaN(Date.parse(u))) to = new Date(u);
    else throw new Error(`until: use a date like 2026-11-21 or an ISO time (got "${until}")`);
  }
  return { from, to, label };
}

export function allProjects(store) {
  const dir = path.join(store.home, "projects");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).map((id) => readJson(path.join(dir, id, "project.json"))).filter(Boolean);
}

/** A project by id, folder path or name; null = every project. */
export function findProjects(store, project) {
  const all = allProjects(store);
  if (!project) return all;
  const q = String(project).trim();
  const byId = all.filter((p) => p.id === q || (fs.existsSync(q) && p.id === projectIdFor(q)));
  if (byId.length) return byId;
  const byName = all.filter((p) => p.name.toLowerCase() === q.toLowerCase() || p.path.toLowerCase() === q.toLowerCase());
  if (byName.length) return byName;
  throw new Error(`no recorded project matches "${project}". Projects: ${all.map((p) => p.name).join(", ") || "(none yet)"}`);
}

/** Every recorded turn, with what the console would show about it. Newest last. */
export function turnsOf(store, projects, { from, to } = {}) {
  const out = [];
  for (const p of projects) {
    for (const s of store.listSessions(p.id)) {
      const events = store.readEvents(p.id, s.id);
      for (let n = 1; n <= store.currentTurn(p.id, s.id); n++) {
        const dir = store.turnDir(p.id, s.id, n);
        const t = readJson(path.join(dir, "turn.json"));
        if (!t || String(t.prompt ?? "").startsWith("/vibe-explainer")) continue;
        const at = Date.parse(t.startedAt);
        if (from && at < from.getTime()) continue;
        if (to && at >= to.getTime()) continue;
        out.push({ project: p, session: s, turn: t, dir, events: events.filter((e) => e.turn === n), lesson: readJson(path.join(dir, "lesson.json")), analysis: readJson(path.join(dir, "analysis.json")) });
      }
    }
  }
  return out.sort((a, b) => String(a.turn.startedAt).localeCompare(String(b.turn.startedAt)));
}

const fileLine = (f) => `${{ added: "A", modified: "M", deleted: "D", renamed: "R" }[f.status] ?? "M"} ${f.path} +${f.add ?? "?"} −${f.del ?? "?"}`;
const RISK = ["", "low", "medium", "high"];

function summary(x) {
  const t = x.turn, l = x.lesson, a = x.analysis;
  const tests = x.events.filter((e) => e.kind === "tool_end" && /^(Bash|PowerShell)$/.test(e.tool) && /\b(test|tests|pytest|vitest|jest)\b/i.test(e.target ?? ""));
  const claims = l?.claims?.length ? Object.entries(l.claims.reduce((m, c) => ({ ...m, [c.status]: (m[c.status] ?? 0) + 1 }), {})).map(([k, v]) => `${v} ${k}`).join(", ") : null;
  const risk = Math.max(0, ...(l?.impact ?? []).map((m) => m.risk), ...(a?.symbols ?? []).map((s) => (s.change === "added" ? 0 : s.risk)));
  return {
    project: x.project.name, projectId: x.project.id, session: x.session.id, turn: t.n, agent: t.agent ?? (x.session.source === "claude-code" ? "claude-code" : x.session.agent ?? x.session.source),
    startedAt: t.startedAt, endedAt: t.endedAt ?? null, status: t.status, prompt: t.prompt,
    files: (t.files ?? []).map(fileLine), lesson: l ? l.title : null, risk: risk ? RISK[risk] : null,
    claims, tests: t.source === "watch" ? "unknown (recorded by watch)" : tests.length ? tests.map((e) => `${e.target}: ${e.ok === false ? "failed" : "passed"}`).join("; ") : "none ran",
    security: (a?.security ?? []).filter((s) => s.severity !== "low").map((s) => `${s.rule} at ${s.file}${s.line ? `:${s.line}` : ""}`),
  };
}

function turnText(s) {
  const time = localStamp(new Date(s.startedAt));
  return [
    `- ${time} · ${s.project} · session ${s.session.slice(0, 8)} · turn ${s.turn}${s.status === "open" ? " (still running)" : ""}${s.agent ? ` · ${s.agent}` : ""}`,
    `  prompt: ${clip(String(s.prompt ?? "").replace(/\s+/g, " "), 300)}`,
    `  files: ${s.files.join(", ") || "none changed"}`,
    s.lesson ? `  lesson: ${s.lesson}` : "  lesson: not written yet",
    `  tests: ${s.tests}${s.risk ? ` · highest risk: ${s.risk}` : ""}${s.claims ? ` · claims: ${s.claims}` : ""}`,
    ...(s.security.length ? [`  security: ${s.security.join("; ")}`] : []),
  ].join("\n");
}

/* ---------------- the tools ---------------- */

export const TOOLS = [
  {
    name: "recent_changes",
    title: "What changed recently",
    description: "What AI coding agents changed in recorded projects during a time window, prompt by prompt: files, lesson title, tests, risk and security notes. Use for 'what changed yesterday / today / this week'. Times are the user's local time.",
    inputSchema: { type: "object", properties: {
      since: { type: "string", description: "today, yesterday, last_24_hours, last_7_days, last_30_days, a date (2026-11-21) or an ISO time. Default last_7_days." },
      until: { type: "string", description: "Optional end: a date or ISO time." },
      project: { type: "string", description: "Optional: a project's folder path, name or id. Default: every project." },
    } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_turn",
    title: "One prompt in detail",
    description: "Everything recorded for one prompt (turn): the prompt, each step, the diff (secrets masked), the lesson (claims checked, impact), callers found by the analyzer, and open to-dos. Get project, session and turn from recent_changes or search.",
    inputSchema: { type: "object", required: ["project", "session", "turn"], properties: {
      project: { type: "string" }, session: { type: "string", description: "Session id (a prefix is fine)." }, turn: { type: "integer", minimum: 1 },
      diff_chars: { type: "integer", description: "How much of the diff to include (default 12000)." },
    } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "search",
    title: "Search the record",
    description: "Find prompts whose text, lesson or changed files match a word or phrase, newest first.",
    inputSchema: { type: "object", required: ["query"], properties: { query: { type: "string" }, project: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 50 } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "open_todos",
    title: "What still needs checking",
    description: "Open to-do items from recent prompts, each from evidence: failed or missing test runs, claims with no evidence, unfinished asks, risky impact, security findings.",
    inputSchema: { type: "object", properties: { since: { type: "string", description: "Default last_7_days." }, project: { type: "string" } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "list_projects",
    title: "Recorded projects",
    description: "Every project vibe-explainer has recorded, with its folder, sessions and when it was last active.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
];

/** Fill in the analysis (callers, security) for turns that don't have it yet. Offline; at most 40. It is a cache in the store. */
async function withAnalysis(store, turns) {
  for (const x of turns.filter((y) => !y.analysis && y.turn.after?.commit).slice(-40)) {
    try { x.analysis = await ensureAnalysis(store, { projectId: x.project.id, sessionId: x.session.id, turn: x.turn.n }); } catch { /* leave it out */ }
  }
  return turns;
}

export async function callTool(store, name, args = {}, now = new Date()) {
  switch (name) {
    case "list_projects": {
      const ps = allProjects(store).map((p) => {
        const ss = store.listSessions(p.id);
        return { name: p.name, id: p.id, path: p.path, sessions: ss.length, lastActive: ss.at(-1)?.startedAt ?? p.createdAt };
      }).sort((a, b) => String(b.lastActive).localeCompare(String(a.lastActive)));
      const text = ps.length ? ps.map((p) => `- ${p.name} (${p.path}) · ${p.sessions} session${p.sessions === 1 ? "" : "s"} · last active ${localStamp(new Date(p.lastActive))}`).join("\n") : "Nothing recorded yet.";
      return { text, data: { projects: ps } };
    }
    case "recent_changes": {
      const w = timeWindow(args, now);
      const turns = (await withAnalysis(store, turnsOf(store, findProjects(store, args.project), w))).map(summary);
      const head = `Changes from ${localStamp(w.from)} to ${localStamp(w.to)} (${offset(now)}): ${turns.length} prompt${turns.length === 1 ? "" : "s"}${turns.length ? ` in ${new Set(turns.map((t) => t.project)).size} project(s)` : ""}.`;
      return { text: [head, ...turns.map(turnText)].join("\n"), data: { from: w.from.toISOString(), to: w.to.toISOString(), turns } };
    }
    case "search": {
      const q = String(args.query ?? "").trim().toLowerCase();
      if (!q) throw new Error("query is empty");
      const hits = turnsOf(store, findProjects(store, args.project)).filter((x) =>
        [x.turn.prompt, x.lesson?.title, x.lesson?.summary, ...(x.turn.files ?? []).map((f) => f.path)].some((v) => String(v ?? "").toLowerCase().includes(q)))
        .reverse().slice(0, Math.min(50, Number(args.limit) || 20)).map(summary);
      return { text: hits.length ? [`${hits.length} match${hits.length === 1 ? "" : "es"} for "${args.query}":`, ...hits.map(turnText)].join("\n") : `Nothing recorded matches "${args.query}".`, data: { turns: hits } };
    }
    case "open_todos": {
      const w = timeWindow({ since: args.since ?? "last_7_days" }, now);
      const rows = [];
      for (const x of await withAnalysis(store, turnsOf(store, findProjects(store, args.project), w))) {
        for (const i of buildTodo({ turn: x.turn, events: x.events, lesson: x.lesson, analysis: x.analysis })) {
          rows.push({ project: x.project.name, session: x.session.id, turn: x.turn.n, risk: i.risk, kind: i.kind, item: i.kind === "security" ? `security: ${i.rule}` : i.t.en, detail: typeof i.d === "string" ? i.d : i.d?.en ?? null, prompt: i.prompt?.en ?? null });
        }
      }
      rows.sort((a, b) => b.risk - a.risk);
      const text = rows.length ? [`${rows.length} open item${rows.length === 1 ? "" : "s"} since ${localStamp(w.from)}:`, ...rows.map((r) => `- [${RISK[r.risk] ?? r.risk}] ${r.project} turn ${r.turn}: ${r.item}${r.detail ? ` (${clip(String(r.detail).replace(/\s+/g, " "), 200)})` : ""}`)].join("\n") : `Nothing open since ${localStamp(w.from)}.`;
      return { text, data: { items: rows } };
    }
    case "get_turn": {
      const [p] = findProjects(store, args.project);
      const s = store.listSessions(p.id).find((x) => x.id === args.session || x.id.startsWith(String(args.session ?? "")));
      if (!s) throw new Error(`no session "${args.session}" in ${p.name}`);
      const x = turnsOf(store, [p]).find((y) => y.session.id === s.id && y.turn.n === Number(args.turn));
      if (!x) throw new Error(`no turn ${args.turn} in session ${s.id}`);
      await withAnalysis(store, [x]);
      let diff = ""; try { diff = fs.readFileSync(path.join(x.dir, "diff.patch"), "utf8"); } catch { /* none */ }
      const l = x.lesson, sm = summary(x);
      const todo = buildTodo({ turn: x.turn, events: x.events, lesson: l, analysis: x.analysis });
      const parts = [turnText(sm), "", "## Steps", stepLines(x.events, x.turn.startedAt) || "(none recorded)"];
      if (l) {
        parts.push("", "## Lesson", `${l.title}. ${l.summary}`);
        if (l.claims?.length) parts.push("Claims vs the record:", ...l.claims.map((c) => `- [${c.status}] ${c.text} (${c.evidence})`));
        if (l.impact?.length) parts.push("Impact:", ...l.impact.map((m) => `- [${RISK[m.risk]}] ${m.title} @ ${m.where}: ${m.why}`));
      }
      if (x.analysis) parts.push("", "## Found in the code", analysisText(x.analysis) || "(nothing)");
      if (todo.length) parts.push("", "## Open to-dos", ...todo.map((i) => `- ${i.kind === "security" ? `security: ${i.rule}` : i.t.en}`));
      parts.push("", "## Diff", clip(maskEnvFilesInPatch(diff), Number(args.diff_chars) || 12000) || "(no changes)");
      return { text: maskSecrets(parts.join("\n")), data: { ...sm, lesson: l ? { title: l.title, summary: l.summary, claims: l.claims, impact: l.impact } : null, todo: todo.map((i) => ({ kind: i.kind, risk: i.risk, item: i.t.en })) } };
    }
    default: throw new Error(`unknown tool "${name}"`);
  }
}
