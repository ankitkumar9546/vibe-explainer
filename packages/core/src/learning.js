// The learning record (Roadmap Phase 8): concepts from every lesson in a project, and how the
// quiz went for each. Quiz answers are kept next to the lesson in turns/<n>/quiz.json.
import path from "node:path";
import { readJson, writeJson, FORMAT_VERSION } from "./store.js";

const quizFile = (store, { projectId, sessionId, turn }) => path.join(store.turnDir(projectId, sessionId, turn), "quiz.json");

export function readQuiz(store, ids) {
  return readJson(quizFile(store, ids), null)?.answers ?? {};
}

/**
 * Record one quiz answer (the first answer counts, as in the console), or clear them for a revision.
 * @returns {{ok: boolean, answers?: object, error?: string}}
 */
export function saveQuiz(store, ids, { question, answer, reset = false, now = () => new Date().toISOString() }) {
  const lesson = readJson(path.join(store.turnDir(ids.projectId, ids.sessionId, ids.turn), "lesson.json"));
  if (!lesson) return { ok: false, error: "no lesson for this turn" };
  const file = quizFile(store, ids);
  const cur = readJson(file, { v: FORMAT_VERSION, answers: {}, history: [] });
  if (reset) {
    cur.history = [...(cur.history ?? []), { answers: cur.answers, until: now() }].slice(-10);
    cur.answers = {};
  } else {
    const q = lesson.quiz?.[question];
    if (!q || !Number.isInteger(answer) || answer < 0 || answer >= q.options.length) return { ok: false, error: "no such question or option" };
    if (!(question in cur.answers)) cur.answers[question] = answer;
  }
  cur.updatedAt = now();
  writeJson(file, cur);
  return { ok: true, answers: cur.answers };
}

/** solid = every quiz question answered right; weak = any wrong; new = not finished. */
export function quizStatus(lesson, answers) {
  const qs = lesson?.quiz ?? [];
  if (!qs.length) return "new";
  if (Object.entries(answers).some(([i, a]) => qs[i] && qs[i].answer !== a)) return "weak";
  return qs.every((q, i) => answers[i] === q.answer) ? "solid" : "new";
}

/**
 * @returns {{facts: {prompts: number, lessons: number, files: number, noEvidence: number, solid: number, concepts: number}, concepts: {name: string, explain: string, sessionId: string, turn: number, status: string, at: string}[], turns: {sessionId: string, turn: number, title: string, status: string, at: string}[]}}
 */
export function learningRecord(store, projectId) {
  const concepts = new Map(), turns = [], files = new Set();
  let prompts = 0, lessons = 0, noEvidence = 0;
  for (const s of store.listSessions(projectId)) {
    for (let n = 1; n <= store.currentTurn(projectId, s.id); n++) {
      const dir = store.turnDir(projectId, s.id, n);
      const t = readJson(path.join(dir, "turn.json"));
      if (!t || t.status === "open" || String(t.prompt ?? "").startsWith("/vibe-explainer")) continue;
      prompts++;
      for (const f of t.files ?? []) files.add(f.path);
      const lesson = readJson(path.join(dir, "lesson.json"));
      if (!lesson) continue;
      lessons++;
      noEvidence += (lesson.claims ?? []).filter((c) => c.status === "none").length;
      const status = quizStatus(lesson, readQuiz(store, { projectId, sessionId: s.id, turn: n }));
      turns.push({ sessionId: s.id, turn: n, title: lesson.title, status, at: t.startedAt });
      for (const c of lesson.concepts ?? []) {
        const key = String(c.name).trim().toLowerCase();
        // the newest lesson that teaches a concept decides its status
        concepts.set(key, { name: c.name, explain: c.explain, sessionId: s.id, turn: n, status, at: t.startedAt });
      }
    }
  }
  const list = [...concepts.values()].sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return {
    facts: { prompts, lessons, files: files.size, noEvidence, solid: list.filter((c) => c.status === "solid").length, concepts: list.length },
    concepts: list, turns,
  };
}
