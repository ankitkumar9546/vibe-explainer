// To-do items for one turn (Roadmap Phase 8). Every item comes from evidence in the record:
// a claim the record does not back, a failed or missing test run, an ask that was not done,
// an impact risk, or a security finding. Nothing is invented; an empty list is a fine answer.

const TEST_CMD = /\b(test|tests|pytest|vitest|jest|mocha|unittest|go test|cargo test)\b/i;
const CODE_FILE = /\.(?:[cm]?[jt]sx?|vue|svelte|py|go|rs|java|kt|rb|php|cs|swift|c|cc|cpp|h)$/i;

const bi = (hi, en) => ({ hi, en });
const tail = (s, n = 400) => { const t = String(s ?? "").trim(); return t.length > n ? `…${t.slice(-n)}` : t; };

/** The test commands the agent ran in this turn, oldest first. */
export function testRuns(events = []) {
  return events.filter((e) => e.kind === "tool_end" && /^(Bash|PowerShell)$/.test(e.tool) && TEST_CMD.test(e.target ?? ""));
}

/**
 * @param {{turn: object, events: object[], lesson?: object|null, analysis?: object|null}} d
 * @returns {{id: string, kind: "claim"|"check"|"tests"|"ask"|"impact"|"security", t: {hi: string, en: string}, d: string|{hi: string, en: string}|null, prompt: {hi: string, en: string}|null, risk: number}[]}
 */
export function buildTodo({ turn, events = [], lesson = null, analysis = null }) {
  if (!turn || turn.status === "open") return [];
  const items = [];
  const runs = testRuns(events);
  const codeChanged = (turn.files ?? []).some((f) => CODE_FILE.test(f.path) && f.status !== "deleted");

  // Tests: a failed last run, or code changed and no test ran at all.
  const last = runs.at(-1);
  if (last && last.ok === false) {
    const out = typeof last.result === "string" ? last.result : [last.result?.stdout, last.result?.stderr].filter(Boolean).join("\n");
    items.push({ id: "tests-failed", kind: "tests", risk: 3,
      t: bi("Fail hue tests theek karo", "Fix the failing tests"),
      d: `\`${last.target}\`${out ? `\n${tail(out)}` : ""}`,
      prompt: bi(`\`${last.target}\` fail hua. Kya fail hua wo padho, code theek karo (tests ko kamzor mat karo), aur tests dobara chalao.`, `\`${last.target}\` failed. Read what failed, fix the code (don't weaken the tests), and run them again.`) });
  } else if (!runs.length && codeChanged) {
    items.push({ id: "tests-none", kind: "tests", risk: 2,
      t: bi("Tests chalao", "Run the tests"),
      d: bi("Is prompt mein code badla, par koi test command nahi chali.", "Code changed in this prompt, but no test command ran."),
      prompt: bi("Project ke tests chalao aur jo fail ho use theek karo. Agar badle hue code ka test nahi hai to ek chhota test likho.", "Run the project's tests and fix whatever fails. If the changed code has no test, add a small one.") });
  }

  // Claims the record does not back.
  for (const [i, c] of (lesson?.claims ?? []).entries()) {
    if (c.status === "none") items.push({ id: `claim-${i}`, kind: "claim", risk: 3,
      t: bi(`Saboot nahi: "${c.text}"`, `No evidence: "${c.text}"`), d: c.evidence ?? "",
      prompt: bi(`Tumne kaha: "${c.text}". Par record mein iska saboot nahi hai (${c.evidence}). Isko sach mein karke dikhao, ya bata do ki ye nahi hua.`, `You said: "${c.text}". The record has no evidence for it (${c.evidence}). Please actually do it and show the result, or say that it didn't happen.`) });
    else if (c.status === "unverified") items.push({ id: `check-${i}`, kind: "check", risk: 1,
      t: bi(`Khud check karo: "${c.text}"`, `Check it yourself: "${c.text}"`), d: c.evidence ?? "", prompt: null });
  }

  // Asks that were not (fully) done.
  for (const [i, a] of (lesson?.asks ?? []).entries()) {
    if (a.status === "no" || a.status === "part") items.push({ id: `ask-${i}`, kind: "ask", risk: 2,
      t: bi(`${a.status === "no" ? "Nahi hua" : "Aadha hua"}: ${a.text}`, `${a.status === "no" ? "Not done" : "Partly done"}: ${a.text}`), d: a.evidence ?? "",
      prompt: bi(`Maine maanga tha: "${a.text}". Record ke hisaab se ye ${a.status === "no" ? "nahi hua" : "poora nahi hua"} (${a.evidence}). Isko poora karo.`, `I asked for: "${a.text}". The record shows it was ${a.status === "no" ? "not done" : "only partly done"} (${a.evidence}). Please finish it.`) });
  }

  // Impact: the lesson's items when there is a lesson, otherwise the analysis.
  if (lesson) {
    for (const [i, m] of (lesson.impact ?? []).entries()) {
      if (m.risk >= 2) items.push({ id: `impact-${i}`, kind: "impact", risk: m.risk, t: bi(m.title, m.title), d: [m.where, m.fix].filter(Boolean).join(" · "), prompt: m.prompt ? bi(m.prompt, m.prompt) : null });
    }
  } else {
    for (const s of analysis?.symbols ?? []) {
      if (s.risk < 2) continue;
      const where = s.callers.filter((c) => c.kind !== "import").slice(0, 8).map((c) => `${c.file}:${c.line}`).join(", ");
      const name = `${s.owner ? `${s.owner}.` : ""}${s.name}()`;
      items.push({ id: `sym-${s.file}-${name}`, kind: "impact", risk: s.risk,
        t: bi(`\`${name}\` badla, isko use karne wali jagah check karo`, `\`${name}\` changed: check the code that uses it`), d: where ? `${s.file}:${s.start} → ${where}` : `${s.file}:${s.start}`,
        prompt: bi(`\`${s.file}\` mein \`${name}\` badla hai. Ye jagah isko use karti hain: ${where}. Check karo ki ye sahi kaam karti hain, aur tests chalao.`, `\`${name}\` in \`${s.file}\` changed. These places use it: ${where}. Check they still work, and run the tests.`) });
    }
  }

  // Security findings.
  for (const [i, x] of (analysis?.security ?? []).entries()) {
    if (x.severity === "low") continue;
    items.push({ id: `sec-${i}`, kind: "security", risk: x.severity === "high" ? 3 : 2, t: bi(x.rule, x.rule), d: `${x.file}${x.line ? `:${x.line}` : ""}${x.text ? ` ${x.text}` : ""}`, prompt: null, rule: x.rule });
  }
  return items.sort((a, b) => b.risk - a.risk);
}
