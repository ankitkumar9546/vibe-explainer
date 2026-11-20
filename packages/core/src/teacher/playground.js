// Teacher parts of the playground (Roadmap Phase 9): what-if questions and a challenge for a
// turn (playground.json), and a short take on a learner's own edit after it ran in the sandbox.
// Every code change the teacher proposes is a find/replace on a real file of the "after"
// snapshot, checked to match exactly once, so the sandbox can run it as it is.
import path from "node:path";
import { readJson, writeJson, FORMAT_VERSION } from "../store.js";
import { maskSecrets } from "./mask.js";
import { extractJson } from "./lesson.js";
import { snapshotFile, safeRel } from "../sandbox.js";

const LANG = { hi: "Hinglish (Hindi in Roman script mixed with English)", en: "simple English" };
const CODE = /\.(?:[cm]?[jt]sx?|vue|svelte|py|go|rs|java|kt|rb|php|cs|html|css)$/i;

/** Line diff (LCS). Returns [[" "|"-"|"+", text]]. Falls back to whole-block replace when huge. */
export function lineDiff(a, b) {
  const A = String(a).split("\n"), B = String(b).split("\n"), n = A.length, m = B.length;
  if (n * m > 4_000_000) return [...A.map((t) => ["-", t]), ...B.map((t) => ["+", t])];
  const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) { if (A[i] === B[j]) { out.push([" ", A[i]]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) out.push(["-", A[i++]]); else out.push(["+", B[j++]]); }
  while (i < n) out.push(["-", A[i++]]); while (j < m) out.push(["+", B[j++]]);
  return out;
}
/** The changed lines with a little context, as unified-diff-like text. */
export function diffText(a, b, ctx = 2) {
  const d = lineDiff(a, b), keep = new Set();
  d.forEach(([s], k) => { if (s !== " ") for (let x = k - ctx; x <= k + ctx; x++) keep.add(x); });
  const out = []; let last = -2;
  d.forEach(([s, t], k) => { if (!keep.has(k)) return; if (k !== last + 1 && out.length) out.push("…"); out.push(`${s === " " ? " " : s} ${t}`); last = k; });
  return out.join("\n");
}

const countOf = (hay, needle) => { let n = 0, i = 0; while ((i = hay.indexOf(needle, i)) >= 0) { n++; i += needle.length; } return n; };

function turnFiles(store, ids) {
  const tdir = store.turnDir(ids.projectId, ids.sessionId, ids.turn);
  const t = readJson(path.join(tdir, "turn.json"));
  if (!t?.after?.commit) throw new Error("this prompt has no snapshot yet");
  const files = (t.files ?? []).filter((f) => f.status !== "deleted" && CODE.test(f.path)).slice(0, 6)
    .map((f) => ({ path: f.path, content: snapshotFile(store.home, ids.projectId, t.after.commit, f.path) ?? "" }))
    .filter((f) => f.content && f.content.length < 40000);
  return { t, tdir, files };
}

/** Problems with a playground answer (empty = usable). */
export function validatePlayground(p, files) {
  const probs = [];
  const byPath = new Map(files.map((f) => [f.path, f.content]));
  if (!p || typeof p !== "object") return ["not an object"];
  if (!Array.isArray(p.whatIf)) probs.push("whatIf must be an array");
  for (const [i, w] of (p.whatIf ?? []).entries()) {
    if (typeof w?.q !== "string" || !Array.isArray(w.options) || w.options.length < 2 || !Number.isInteger(w.answer) || w.answer < 0 || w.answer >= w.options.length) { probs.push(`whatIf[${i}] needs q, options, answer`); continue; }
    const src = byPath.get(w.file);
    if (src == null) probs.push(`whatIf[${i}].file must be one of: ${[...byPath.keys()].join(", ")}`);
    else if (typeof w.find !== "string" || !w.find || countOf(src, w.find) !== 1) probs.push(`whatIf[${i}].find must appear exactly once in ${w.file}, copied character for character`);
    if (typeof w.replace !== "string") probs.push(`whatIf[${i}].replace must be a string`);
  }
  const c = p.challenge;
  if (c != null) {
    if (typeof c.task !== "string" || !byPath.has(c.file) || !Array.isArray(c.hints) || typeof c.solution !== "string") probs.push("challenge needs task, file (a changed file), hints and solution");
    if (c.test != null) { try { safeRel(c.test.file); } catch { probs.push("challenge.test.file must be a relative path"); } if (typeof c.test?.content !== "string") probs.push("challenge.test.content must be a string"); }
  }
  return probs;
}

/**
 * Write turns/<n>/playground.json: { whatIf: [...], challenge }.
 * @returns {Promise<{ok: boolean, playground?: object, error?: string}>}
 */
export async function makePlayground(store, ids, { teacher, lang = "hi", testCommand = null, now = () => new Date().toISOString() }) {
  let ctx;
  try { ctx = turnFiles(store, ids); } catch (err) { return { ok: false, error: String(err.message) }; }
  if (!ctx.files.length) return { ok: false, error: "no code file changed in this prompt" };
  const lesson = readJson(path.join(ctx.tdir, "lesson.json"));
  const prompt = `You make a hands-on playground for a learner, about ONE change an AI agent made. Write every text field in ${LANG[lang] ?? LANG.hi}. Keep code exactly as it is.

Make:
1. "whatIf": exactly 2 questions of the form "What happens if we change X?". Each one is a small, real edit of the code below, given as {"file", "find", "replace"}: "find" is text copied CHARACTER FOR CHARACTER from that file (whitespace included) that appears exactly ONCE in it; "replace" is what goes there instead. Pick edits that teach something about THIS change (remove a check, swap an argument, drop an await...). Give 3 answer options, the index of the one you expect, and "explain" (2-3 sentences: why).
2. "challenge": one small task the learner does by editing ONE of these files ("file"), with 3 "hints" (gentle first, then concrete) and a "solution" (the code they need, short). If the project's tests can check it${testCommand ? ` (the test command is \`${testCommand}\`)` : ""}, add "test": {"file": "<new test file path>", "content": "<a small test that passes only when the task is done>"}; otherwise "test": null.

Answer with ONE JSON object and nothing else:
{"whatIf": [{"q": string, "options": [string, string, string], "answer": 0|1|2, "file": string, "find": string, "replace": string, "explain": string}],
 "challenge": {"task": string, "file": string, "hints": [string, string, string], "solution": string, "test": null | {"file": string, "content": string}}}

=== WHAT THE AGENT DID ===
${maskSecrets(lesson ? `${lesson.title}. ${lesson.summary}` : String(ctx.t.prompt ?? ""))}

${ctx.files.map((f) => `=== FILE ${f.path} (after the change) ===\n${maskSecrets(f.content)}`).join("\n\n")}
`;
  let last = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    let p;
    try { p = extractJson(await teacher.ask(attempt ? `${prompt}\nYour previous answer could not be used: ${last}\nAnswer again with ONE corrected JSON object only.` : prompt)); }
    catch (err) { last = String(err.message ?? err); continue; }
    // keep the what-ifs that work; drop only the broken ones on the second try
    let probs = validatePlayground(p, ctx.files);
    if (probs.length && attempt === 1 && Array.isArray(p?.whatIf)) {
      p.whatIf = p.whatIf.filter((w) => validatePlayground({ whatIf: [w], challenge: null }, ctx.files).length === 0);
      if (p.challenge && validatePlayground({ whatIf: [], challenge: p.challenge }, ctx.files).length) p.challenge = null;
      probs = p.whatIf.length || p.challenge ? [] : probs;
    }
    if (probs.length) { last = probs.slice(0, 6).join("; "); continue; }
    const out = { v: FORMAT_VERSION, lang, teacher: teacher.name, createdAt: now(), after: ctx.t.after.commit, whatIf: p.whatIf ?? [], challenge: p.challenge ?? null };
    writeJson(path.join(ctx.tdir, "playground.json"), out);
    return { ok: true, playground: out };
  }
  return { ok: false, error: last };
}

/** The teacher's short take on the learner's own edit, given what the sandbox showed. */
export async function editTake(store, ids, { teacher, lang = "hi", path: p, before, after, results = [] }) {
  const lesson = readJson(path.join(store.turnDir(ids.projectId, ids.sessionId, ids.turn), "lesson.json"));
  const prompt = `A learner changed code that an AI agent wrote, and ran it in a sandbox. Tell them what their change does. Write in ${LANG[lang] ?? LANG.hi}, kindly and concretely. Keep code in backticks.
Use ONLY the evidence below: their diff and the real command output. Never claim a result the output does not show.
Answer with ONE JSON object: {"verdict": "good"|"warn"|"bad", "take": string (2-4 sentences: what the change does and why the output looks like it does), "affects": string (one sentence: what else in the project this touches, or "" if nothing)}.
- "bad" = it breaks something (an error, a failing test), "warn" = it runs but is risky or changes behaviour, "good" = fine.

=== THE AGENT'S CHANGE (context) ===
${maskSecrets(lesson ? `${lesson.title}. ${lesson.summary}` : "")}

=== THE LEARNER'S EDIT of ${p} (− = the agent's line, + = theirs) ===
${maskSecrets(diffText(before, after)) || "(no change)"}

=== SANDBOX OUTPUT ===
${results.map((r) => `$ ${r.cmd}  → ${r.timedOut ? "TIMED OUT" : `exit ${r.code}`}\n${maskSecrets(r.out.slice(-3000))}`).join("\n\n") || "(no commands were run)"}
`;
  let last = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const j = extractJson(await teacher.ask(attempt ? `${prompt}\nYour previous answer was not valid (${last}). Answer with the JSON object only.` : prompt));
      if (["good", "warn", "bad"].includes(j.verdict) && typeof j.take === "string") return { ok: true, verdict: j.verdict, take: maskSecrets(j.take), affects: typeof j.affects === "string" ? maskSecrets(j.affects) : "" };
      last = "missing verdict or take";
    } catch (err) { last = String(err.message ?? err); }
  }
  return { ok: false, error: last };
}
