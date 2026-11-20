// Teach one turn: context → prompt → model → validated lesson.json (docs/DataFormat.md §3).
import path from "node:path";
import { readJson, writeJson, FORMAT_VERSION } from "../store.js";
import { buildContext } from "./context.js";
import { buildPrompt, extractJson, validateLesson } from "./lesson.js";
import { ensureAnalysis } from "../analyzer/index.js";

/**
 * @param {import("../store.js").Store} store
 * @param {{projectId: string, sessionId: string, turn: number}} ids
 * @param {{teacher: {name: string, ask: (prompt: string) => Promise<string>}, level?: string, lang?: string, online?: boolean, now?: () => string}} opts
 * @returns {Promise<{ok: boolean, lesson?: object, error?: string, file?: string}>}
 */
export async function teachTurn(store, ids, { teacher, level = "beg", lang = "hi", online = false, now = () => new Date().toISOString() }) {
  const tdir = store.turnDir(ids.projectId, ids.sessionId, ids.turn);
  const turnFile = path.join(tdir, "turn.json");
  const mark = (fields) => writeJson(turnFile, { ...readJson(turnFile, {}), ...fields });
  mark({ status: "analysing" });

  // The lesson builds on the analysis (callers, packages, security), so make sure it exists.
  try { await ensureAnalysis(store, ids, { online }); } catch { /* a lesson without analysis is still useful */ }

  let prompt;
  try { prompt = buildPrompt(buildContext(store, ids), { level, lang }); }
  catch (err) { mark({ status: "failed", lessonError: String(err.message ?? err) }); return { ok: false, error: String(err.message ?? err) }; }

  let lastProblem = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const ask = attempt === 1 ? prompt
      : `${prompt}\n\nYour previous answer could not be used: ${lastProblem}\nAnswer again with ONE corrected JSON object only.`;
    let lesson;
    try {
      lesson = extractJson(await teacher.ask(ask));
    } catch (err) { lastProblem = String(err.message ?? err); continue; }
    const problems = validateLesson(lesson);
    if (problems.length) { lastProblem = problems.slice(0, 8).join("; "); continue; }
    const file = path.join(tdir, "lesson.json");
    writeJson(file, { v: FORMAT_VERSION, level, lang, teacher: teacher.name, createdAt: now(), ...lesson });
    mark({ status: "ready", lessonError: undefined });
    return { ok: true, lesson, file };
  }
  mark({ status: "failed", lessonError: lastProblem });
  return { ok: false, error: lastProblem };
}
