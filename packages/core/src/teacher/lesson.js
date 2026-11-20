// The lesson contract (docs/DataFormat.md §3): the prompt that asks for it, and its validator.

const LANG = { hi: "Hinglish (Hindi in Roman script mixed with English, as Indian developers speak)", en: "simple English" };
const LEVEL = {
  beg: "a beginner who is new to coding: short sentences, everyday analogies, explain every technical word",
  dev: "a working developer: precise, technical, no hand-holding",
};

export function buildPrompt(ctx, { level = "beg", lang = "hi" } = {}) {
  return `You are a patient teacher. An AI coding agent just did some work for a user. Explain that work to ${LEVEL[level] ?? LEVEL.beg}. Write every text field in ${LANG[lang] ?? LANG.hi}. Keep code, file names and commands exactly as they are.

Rules:
- Use ONLY the evidence below. Never invent files, functions, commands or results. If something cannot be known from the evidence, say so.
- Claims: take each factual claim in the agent's FINAL REPLY (for example "tests pass", "added X", "it sends an email") and check it against the STEPS and the DIFF. status "backed" = the evidence shows it; "none" = the evidence shows it did not happen (for example no test command ran); "unverified" = it may be true but the evidence cannot show it. "at" = the second (from the STEPS times) of the best evidence, or null.
- Asks: split the USER PROMPT into what was asked; mark each "done", "part" or "no" with evidence.
- Impact: what else could be affected by the changed code (other callers, behaviour changes, missing error handling). risk 1 = low, 2 = medium, 3 = high. "prompt" = a short instruction the user could paste to the agent to fix it, or "" when nothing needs fixing.
- Errors: commands that FAILED during the turn, what the error means in plain words, and how the agent fixed it (or that it did not).
- decision: if the agent's thinking shows it chose between approaches, describe the options; otherwise null.
- quiz: 2 or 3 questions about THIS change, each with 3 options and the index of the right one.
- Answer with ONE JSON object and nothing else. No markdown fences.

JSON shape:
{"title": string, "summary": string,
 "asks": [{"text": string, "status": "done"|"part"|"no", "evidence": string}],
 "why": string, "how": [string], "before": string, "after": string,
 "decision": null | {"question": string, "options": [{"text": string, "chosen": boolean, "why": string}], "quote": string},
 "errors": [{"at": number|null, "command": string, "simple": string, "fix": string}],
 "notes": [{"file": string, "text": string}],
 "claims": [{"text": string, "status": "backed"|"unverified"|"none", "evidence": string, "at": number|null}],
 "impact": [{"where": string, "risk": 1|2|3, "title": string, "why": string, "fix": string, "prompt": string}],
 "concepts": [{"name": string, "explain": string}],
 "quiz": [{"q": string, "options": [string, string, string], "answer": 0|1|2, "explain": string}],
 "manualTest": {"steps": [string], "expect": string}}

=== USER PROMPT ===
${ctx.prompt}

=== STEPS (time from the start of the turn, tool, target) ===
${ctx.steps || "(no tool calls)"}

=== AGENT THINKING ===
${ctx.thinking || "(not available)"}

=== AGENT MESSAGES DURING THE TURN ===
${ctx.replies || "(none)"}

=== AGENT FINAL REPLY ===
${ctx.finalReply || "(not available)"}

=== FILES CHANGED ===
${ctx.files.map((f) => `${f.status} ${f.path} +${f.add ?? "?"} -${f.del ?? "?"}`).join("\n") || "(none)"}

=== DIFF ===
${ctx.diff || "(no changes)"}
`;
}

/** Pull the first complete JSON object out of a model answer. */
export function extractJson(text) {
  if (typeof text !== "string") throw new Error("empty answer");
  const s = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = s.indexOf("{");
  if (start < 0) throw new Error("no JSON object in the answer");
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === "\"") inStr = false; continue; }
    if (c === "\"") inStr = true; else if (c === "{") depth++; else if (c === "}" && --depth === 0) return JSON.parse(s.slice(start, i + 1));
  }
  throw new Error("the JSON object in the answer is not complete");
}

const isStr = (v) => typeof v === "string";
const isArr = Array.isArray;

/** @returns {string[]} problems; empty = valid */
export function validateLesson(l) {
  const p = [];
  if (!l || typeof l !== "object") return ["not an object"];
  for (const k of ["title", "summary", "why", "before", "after"]) if (!isStr(l[k])) p.push(`${k} must be a string`);
  for (const k of ["asks", "how", "errors", "notes", "claims", "impact", "concepts", "quiz"]) if (!isArr(l[k])) p.push(`${k} must be an array`);
  if (isArr(l.asks)) l.asks.forEach((a, i) => { if (!isStr(a?.text) || !["done", "part", "no"].includes(a?.status)) p.push(`asks[${i}] needs text and status done|part|no`); });
  if (isArr(l.claims)) l.claims.forEach((c, i) => { if (!isStr(c?.text) || !["backed", "unverified", "none"].includes(c?.status)) p.push(`claims[${i}] needs text and status backed|unverified|none`); });
  if (isArr(l.impact)) l.impact.forEach((m, i) => { if (!isStr(m?.title) || ![1, 2, 3].includes(m?.risk)) p.push(`impact[${i}] needs title and risk 1|2|3`); });
  if (isArr(l.quiz)) l.quiz.forEach((q, i) => {
    if (!isStr(q?.q) || !isArr(q?.options) || q.options.length < 2 || !Number.isInteger(q?.answer) || q.answer < 0 || q.answer >= q.options.length) p.push(`quiz[${i}] needs q, options and a valid answer index`);
  });
  if (l.decision != null && (!isStr(l.decision.question) || !isArr(l.decision.options))) p.push("decision must be null or {question, options}");
  if (l.manualTest != null && (!isArr(l.manualTest.steps) || !isStr(l.manualTest.expect))) p.push("manualTest needs steps and expect");
  return p;
}
