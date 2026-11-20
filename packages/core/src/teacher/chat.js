// "Ask this session" and "explain it in your own words" (Roadmap Phase 8).
// Both send the teacher the RECORD of the session (prompts, steps, files, lessons, analysis and
// the diff of the prompt in focus), masked, and ask it to answer from that record only.
import fs from "node:fs";
import path from "node:path";
import { readJson } from "../store.js";
import { maskSecrets, maskEnvFilesInPatch } from "./mask.js";
import { stepLines } from "./context.js";
import { analysisText } from "../analyzer/index.js";
import { extractJson } from "./lesson.js";

export const CHAT_BUDGET = { total: 60000, perTurnSteps: 3000, perTurnAnalysis: 2500, focusDiff: 20000, question: 2000, history: 4000 };
const LANG = { hi: "Hinglish (Hindi in Roman script mixed with English)", en: "simple English" };
const clip = (s, n) => (s.length > n ? `${s.slice(0, n)}\n…[cut ${s.length - n} chars]` : s);

/** Plain-text record of a session for the teacher, newest turns kept when it is too long. */
export function sessionRecord(store, { projectId, sessionId, focusTurn = null }) {
  const sdir = store.sessionDir(projectId, sessionId);
  const session = readJson(path.join(sdir, "session.json"));
  if (!session) throw new Error(`session ${sessionId} not found`);
  const events = store.readEvents(projectId, sessionId);
  const blocks = [];
  for (let n = 1; n <= store.currentTurn(projectId, sessionId); n++) {
    const dir = store.turnDir(projectId, sessionId, n);
    const t = readJson(path.join(dir, "turn.json"));
    if (!t || String(t.prompt ?? "").startsWith("/vibe-explainer")) continue;
    const lesson = readJson(path.join(dir, "lesson.json"));
    const analysis = readJson(path.join(dir, "analysis.json"));
    const parts = [`### TURN ${n} (${t.status})`, `USER PROMPT: ${t.prompt ?? ""}`];
    parts.push(`FILES: ${(t.files ?? []).map((f) => `${f.status} ${f.path} +${f.add ?? "?"} -${f.del ?? "?"}`).join("; ") || "(none)"}`);
    parts.push(`STEPS:\n${clip(stepLines(events.filter((e) => e.turn === n), t.startedAt), CHAT_BUDGET.perTurnSteps) || "(none)"}`);
    if (analysis) parts.push(`STATIC ANALYSIS:\n${clip(analysisText(analysis), CHAT_BUDGET.perTurnAnalysis) || "(nothing found)"}`);
    if (lesson) {
      parts.push(`LESSON: ${lesson.title}. ${lesson.summary}`);
      if (lesson.claims?.length) parts.push(`CLAIMS CHECKED: ${lesson.claims.map((c) => `[${c.status}] ${c.text}`).join(" | ")}`);
      if (lesson.impact?.length) parts.push(`IMPACT: ${lesson.impact.map((m) => `(risk ${m.risk}) ${m.title} @ ${m.where}`).join(" | ")}`);
    }
    if (n === focusTurn) {
      let diff = ""; try { diff = fs.readFileSync(path.join(dir, "diff.patch"), "utf8"); } catch { /* none */ }
      parts.push(`DIFF OF THIS TURN:\n${clip(maskEnvFilesInPatch(diff), CHAT_BUDGET.focusDiff) || "(no changes)"}`);
    }
    blocks.push(parts.join("\n"));
  }
  // Keep the newest turns (and always the focus turn) inside the budget.
  let out = [], size = 0;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const isFocus = focusTurn != null && blocks[i].startsWith(`### TURN ${focusTurn} `);
    if (size + blocks[i].length > CHAT_BUDGET.total && !isFocus) { out.unshift(`### (${i + 1} older turn${i ? "s" : ""} left out)`); break; }
    out.unshift(blocks[i]); size += blocks[i].length;
  }
  return maskSecrets(out.join("\n\n"));
}

export function chatPrompt(record, { question, history = [], lang = "hi", focusTurn = null, line = null }) {
  const hist = clip(history.slice(-6).map((m) => `${m.who === "me" ? "USER" : "YOU"}: ${m.t}`).join("\n"), CHAT_BUDGET.history);
  return `You answer questions about a coding session that an AI agent did for a user. The user is learning to code.
Answer in ${LANG[lang] ?? LANG.hi}, in at most 8 short sentences. Keep code, file names and commands exactly as they are, in backticks.

Rules:
- Use ONLY the RECORD below. Never invent files, functions, commands, test results or line numbers.
- Name the turn and file (and line, when the record has it) for every fact you use, like "turn 2, \`src/auth.js\`".
- If the record does not show the answer, say so plainly ("the record doesn't show that") and say what would show it.
- Never claim tests passed unless a test command in STEPS shows it.
- Plain text only. No JSON, no headings. Call the STATIC ANALYSIS "the code scan"; never name the record's section labels.
${focusTurn ? `- The user is looking at turn ${focusTurn}.` : ""}${line ? `\n- The question is about this line of turn ${focusTurn}'s diff, in \`${line.file}\`: ${line.text}` : ""}

=== RECORD ===
${record}

=== CONVERSATION SO FAR ===
${hist || "(none)"}

=== QUESTION ===
${clip(maskSecrets(String(question ?? "")), CHAT_BUDGET.question)}
`;
}

/** @returns {Promise<{ok: boolean, answer?: string, error?: string}>} */
export async function askSession(store, ids, { teacher, question, history = [], lang = "hi", focusTurn = null, line = null }) {
  if (!String(question ?? "").trim()) return { ok: false, error: "empty question" };
  try {
    const record = sessionRecord(store, { ...ids, focusTurn });
    const answer = String(await teacher.ask(chatPrompt(record, { question, history, lang, focusTurn, line }))).trim();
    return answer ? { ok: true, answer: maskSecrets(answer) } : { ok: false, error: "empty answer" };
  } catch (err) { return { ok: false, error: String(err.message ?? err).slice(0, 300) }; }
}

/** The learner's own explanation of a turn, checked against the record. */
export async function checkExplanation(store, ids, { teacher, text, lang = "hi" }) {
  if (String(text ?? "").trim().length < 10) return { ok: false, error: "too short" };
  try {
    const record = sessionRecord(store, { projectId: ids.projectId, sessionId: ids.sessionId, focusTurn: ids.turn });
    const prompt = `A learner explained, in their own words, what an AI agent changed in turn ${ids.turn} of this coding session. Check it against the RECORD only. Be kind and specific.
Reply with ONE JSON object and nothing else: {"verdict": "good"|"partly"|"off", "feedback": string, "missed": [string]}
- verdict: "good" = right in substance; "partly" = some right, something important missing or wrong; "off" = mostly wrong.
- feedback: 2 to 4 short sentences in ${LANG[lang] ?? LANG.hi}: what they got right, then what to fix. Keep code in backticks.
- missed: up to 3 short points from the record they left out (same language).

=== RECORD ===
${record}

=== LEARNER'S EXPLANATION ===
${clip(maskSecrets(String(text)), 3000)}
`;
    let last = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const j = extractJson(await teacher.ask(attempt ? `${prompt}\nYour previous answer was not valid JSON (${last}). Answer with the JSON object only.` : prompt));
        if (["good", "partly", "off"].includes(j.verdict) && typeof j.feedback === "string") {
          return { ok: true, verdict: j.verdict, feedback: maskSecrets(j.feedback), missed: Array.isArray(j.missed) ? j.missed.filter((m) => typeof m === "string").slice(0, 3) : [] };
        }
        last = "missing verdict or feedback";
      } catch (err) { last = String(err.message ?? err); }
    }
    return { ok: false, error: last };
  } catch (err) { return { ok: false, error: String(err.message ?? err).slice(0, 300) }; }
}
