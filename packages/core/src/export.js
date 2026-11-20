// Ready-made text from a session (Roadmap Phase 8): a PR description, a commit message, or a
// note for the day. Built only from the record (prompts, files, lessons, analysis, test runs),
// with no model call, so the same session always gives the same text.
import { buildTodo, testRuns } from "./todo.js";

const L = (lang, hi, en) => (lang === "hi" ? hi : en);
const firstLine = (s) => String(s ?? "").split("\n").find((l) => l.trim())?.trim() ?? "";
const firstSentence = (s) => { const l = firstLine(s); const m = /^(.+?[.!?])(\s|$)/.exec(l); return m ? m[1] : l; };
const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Turns worth exporting: finished, with a snapshot, and not our own /vibe-explainer commands. */
export function exportableTurns(turns) {
  return turns.filter((x) => x.turn && x.turn.status !== "open" && x.turn.after && !String(x.turn.prompt ?? "").startsWith("/vibe-explainer"));
}

function filesOf(turns) {
  const m = new Map();
  for (const x of turns) for (const f of x.turn.files ?? []) {
    const cur = m.get(f.path) ?? { path: f.path, status: f.status, add: 0, del: 0 };
    cur.add += f.add ?? 0; cur.del += f.del ?? 0;
    if (cur.status === "added" && f.status === "deleted") m.delete(f.path); else { if (cur.status !== "added") cur.status = f.status; m.set(f.path, cur); }
  }
  return [...m.values()].sort((a, b) => a.path.localeCompare(b.path));
}
const what = (x) => x.lesson?.title || firstLine(x.turn.prompt);

/**
 * @param {"pr"|"commit"|"note"} kind
 * @param {{project: string, turns: {turn: object, events: object[], lesson?: object|null, analysis?: object|null}[]}} data
 * @param {"hi"|"en"} lang
 * @returns {string}
 */
export function buildExport(kind, { project = "project", turns = [] }, lang = "en") {
  const ts = exportableTurns(turns);
  if (!ts.length) return L(lang, "Is session mein abhi koi poora hua prompt nahi hai.", "This session has no finished prompt yet.");
  const files = filesOf(ts);
  const runs = ts.flatMap((x) => testRuns(x.events).map((e) => ({ n: x.turn.n, cmd: e.target, ok: e.ok !== false })));

  if (kind === "commit") {
    const subject = cut(what(ts.at(-1)), 72);
    const body = [
      ...ts.map((x) => `- ${what(x)}`),
      "",
      `${L(lang, "Files", "Files")}: ${files.map((f) => f.path).join(", ") || "-"}`,
    ];
    const open = ts.flatMap((x) => buildTodo(x)).filter((i) => i.risk >= 2);
    if (!runs.length) body.push(L(lang, "Tests: is session mein koi test nahi chala.", "Tests: none ran in this session."));
    else body.push(`Tests: ${runs.map((r) => `${r.cmd} (${r.ok ? "pass" : "fail"})`).join("; ")}`);
    if (open.length) body.push(L(lang, `Baaki: ${open.length} baat check karni hai.`, `Open: ${open.length} thing${open.length > 1 ? "s" : ""} to check.`));
    return `${subject}\n\n${body.join("\n")}\n`;
  }

  if (kind === "pr") {
    const out = [`## ${L(lang, "Kya badla", "What changed")}`];
    for (const x of ts) out.push(`- ${what(x)}${x.lesson?.summary ? `\n  ${firstSentence(x.lesson.summary)}` : ""}`);
    out.push("", `## ${L(lang, "Files", "Files")}`);
    for (const f of files) out.push(`- \`${f.path}\` ${f.status} (+${f.add} −${f.del})`);
    out.push("", `## ${L(lang, "Dhyan dene wali baatein", "Things to check")}`);
    const checks = [];
    for (const x of ts) for (const i of buildTodo(x)) {
      if (i.kind === "check") continue;
      const d = typeof i.d === "string" ? firstLine(i.d) : "";
      checks.push(`- ${i.t[lang] ?? i.t.en}${d ? ` (${d})` : ""}`);
    }
    out.push(...(checks.length ? [...new Set(checks)] : [L(lang, "- Kuch khula nahi hai.", "- Nothing open.")]));
    out.push("", "## Tests");
    out.push(...(runs.length ? runs.map((r) => `- \`${r.cmd}\`: ${r.ok ? L(lang, "pass hua", "passed") : L(lang, "fail hua", "failed")}`) : [L(lang, "- Is session mein koi test command nahi chali.", "- No test command ran in this session.")]));
    return `${out.join("\n")}\n`;
  }

  // note
  const day = new Date(Date.parse(ts[0].turn.startedAt) || Date.now()).toISOString().slice(0, 10);
  const out = [L(lang, `${day}, ${project} pe:`, `${day} on ${project}:`)];
  for (const x of ts) out.push(`• ${firstLine(x.turn.prompt)}${x.lesson?.after ? ` → ${firstLine(x.lesson.after)}` : ""}`);
  const seen = new Set(), concepts = [];
  for (const c of ts.flatMap((x) => x.lesson?.concepts ?? [])) {
    const k = String(c.name).trim().toLowerCase();
    if (!seen.has(k)) { seen.add(k); concepts.push(c.name); }
  }
  if (concepts.length) out.push("", `${L(lang, "Naye concepts", "New concepts")}: ${concepts.join(", ")}`);
  out.push("", `${ts.length} ${L(lang, "prompts", ts.length > 1 ? "prompts" : "prompt")}, ${files.length} files, ${runs.length ? `${runs.filter((r) => r.ok).length}/${runs.length} ${L(lang, "test runs pass", "test runs passed")}` : L(lang, "koi test nahi chala", "no tests ran")}.`);
  return `${out.join("\n")}\n`;
}
