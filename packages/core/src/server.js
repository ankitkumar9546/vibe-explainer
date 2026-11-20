// Local console server (Roadmap Phase 4). Binds to 127.0.0.1 only; every API call needs the token.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { readJson } from "./store.js";
import { ensureAnalysis } from "./analyzer/index.js";
import { buildTodo } from "./todo.js";
import { buildExport } from "./export.js";
import { learningRecord, readQuiz, saveQuiz } from "./learning.js";
import { askSession, checkExplanation } from "./teacher/chat.js";
import { detectCommands, sandboxSettings, allowSandbox, runInSandbox, removeSandbox, sandboxFile, applyEdit, snapshotFile, sweepSandboxes, safeRel } from "./sandbox.js";
import { makePlayground, editTake, diffText } from "./teacher/playground.js";
import { shadowGit } from "./snapshot.js";

const PREVIEWABLE = ["index.html", "public/index.html", "src/index.html"];

/** Read a small JSON request body. */
function readBody(req, limit = 32 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error("body too large"), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch { reject(Object.assign(new Error("bad JSON"), { code: 400 })); } });
    req.on("error", reject);
  });
}

/** Everything the console and the exports need about one turn. */
function turnData(store, projectId, sessionId, n) {
  const dir = store.turnDir(projectId, sessionId, n);
  const turn = readJson(path.join(dir, "turn.json"));
  if (!turn) return null;
  return { turn, events: store.readEvents(projectId, sessionId).filter((e) => e.turn === n), lesson: readJson(path.join(dir, "lesson.json")), analysis: readJson(path.join(dir, "analysis.json")) };
}

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json" };

function send(res, code, body, type = "application/json") {
  const data = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" });
  res.end(data);
}

function listProjects(store) {
  const dir = path.join(store.home, "projects");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).map((id) => {
    const p = readJson(path.join(dir, id, "project.json"));
    if (!p) return null;
    const sessions = store.listSessions(id);
    return { ...p, sessions: sessions.length, lastActive: sessions.at(-1)?.startedAt ?? p.createdAt };
  }).filter(Boolean).sort((a, b) => String(b.lastActive).localeCompare(String(a.lastActive)));
}

function turnsOf(store, projectId, sessionId) {
  const n = store.currentTurn(projectId, sessionId);
  const out = [];
  for (let i = 1; i <= n; i++) {
    const dir = store.turnDir(projectId, sessionId, i);
    const t = readJson(path.join(dir, "turn.json"));
    if (!t) continue;
    const lesson = readJson(path.join(dir, "lesson.json"));
    out.push({ ...t, hasLesson: !!lesson, lessonTitle: lesson?.title ?? null, claimsNone: lesson ? lesson.claims.filter((c) => c.status === "none").length : 0 });
  }
  return out;
}

/**
 * @param {import("./store.js").Store} store
 * @param {{staticDir: string, port?: number, token?: string, onExplain?: (ids: object, opts: object) => Promise<any>, online?: () => boolean, fetchFn?: Function}} opts
 * @returns {Promise<{server: http.Server, port: number, token: string, url: string, close: () => Promise<void>}>}
 */
export function startServer(store, { staticDir, port = 4321, token = crypto.randomBytes(18).toString("hex"), onExplain, autoTeach, online = () => false, fetchFn, makeTeacher } = {}) {
  const asking = new Set(); // sessions with a chat question in flight
  const running = new Set(); // projects with a sandbox run in flight
  const kept = new Map(); // projectId -> the sandbox kept for "your version" in the preview
  const previewToken = crypto.randomBytes(18).toString("hex"); // separate from the API token: preview pages never see that one
  const busy = new Set(); // turns being taught right now

  // mode auto: while the console is open, teach finished turns that have no lesson yet, one at a time.
  let autoTimer = null;
  if (onExplain && autoTeach) {
    autoTimer = setInterval(() => {
      const o = autoTeach(); if (!o || busy.size) return;
      const dayAgo = Date.now() - 24 * 3600 * 1000;
      for (const p of listProjects(store)) {
        for (const s of store.listSessions(p.id).filter((x) => Date.parse(x.startedAt) > dayAgo)) {
          const t = turnsOf(store, p.id, s.id).find((x) => x.status === "closed" && x.after && !x.hasLesson);
          if (!t) continue;
          const key = `${p.id}/${s.id}/${t.n}`; busy.add(key);
          Promise.resolve(onExplain({ projectId: p.id, sessionId: s.id, turn: t.n }, o)).catch(() => {}).finally(() => busy.delete(key));
          return;
        }
      }
    }, 4000);
    autoTimer.unref?.();
  }
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      // DNS-rebinding guard: only our own host names.
      const host = String(req.headers.host ?? "");
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return send(res, 403, { error: "bad host" });

      if (url.pathname.startsWith("/preview/")) {
        // /preview/<previewToken>/<projectId>/<commit | sandbox id>/<path>
        const [, , tok, pid, ref, ...rest] = url.pathname.split("/");
        if (typeof tok !== "string" || tok.length !== previewToken.length || !crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(previewToken))) return send(res, 401, "token required", "text/plain");
        if (!/^[0-9a-f]{12}$/.test(pid ?? "")) return send(res, 400, "bad project", "text/plain");
        let rel; try { rel = safeRel(decodeURIComponent(rest.join("/")) || "index.html"); } catch { return send(res, 400, "bad path", "text/plain"); }
        let body = null;
        if (/^[0-9a-f]{40}$/.test(ref ?? "")) { try { body = shadowGit(store.home, pid, ["show", `${ref}:${rel}`], { encoding: "buffer", maxBuffer: 16 * 1024 * 1024 }); } catch { body = null; } }
        else body = sandboxFile(store, pid, String(ref), rel);
        if (!body) return send(res, 404, "not found", "text/plain");
        res.writeHead(200, {
          "content-type": TYPES[path.extname(rel)] ?? (/\.(png|jpe?g|gif|webp|ico)$/i.test(rel) ? `image/${path.extname(rel).slice(1).replace("jpg", "jpeg")}` : "application/octet-stream"),
          "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
          // the sandboxed page has an opaque origin, so its own module scripts need this; the path already carries the preview token
          "access-control-allow-origin": "*",
          // an opaque origin: the previewed page can run its own scripts, but can't reach the API
          "content-security-policy": "sandbox allow-scripts allow-forms; default-src 'self' 'unsafe-inline' data: blob:; connect-src 'none'",
        });
        return res.end(body);
      }
      if (!url.pathname.startsWith("/api/")) {
        const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
        const file = path.resolve(staticDir, rel);
        if (!file.startsWith(path.resolve(staticDir) + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, "not found", "text/plain");
        return send(res, 200, fs.readFileSync(file), TYPES[path.extname(file)] ?? "application/octet-stream");
      }

      const given = url.searchParams.get("t") ?? req.headers["x-vx-token"];
      if (typeof given !== "string" || given.length !== token.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(token))) {
        return send(res, 401, { error: "token required" });
      }
      if (req.method === "POST") {
        // a page from another origin (or a previewed project page) can't send these
        const origin = req.headers.origin;
        if (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) return send(res, 403, { error: "bad origin" });
        if (!/^application\/json\b/.test(String(req.headers["content-type"] ?? ""))) return send(res, 415, { error: "JSON only" });
      }
      const q = (k) => url.searchParams.get(k);
      const projectId = q("project"), sessionId = q("session"), turn = Number(q("turn"));
      if (projectId && !/^[0-9a-f]{12}$/.test(projectId)) return send(res, 400, { error: "bad project" });
      if (sessionId && !/^[A-Za-z0-9._-]{1,80}$/.test(sessionId)) return send(res, 400, { error: "bad session" });

      switch (url.pathname) {
        case "/api/projects": return send(res, 200, listProjects(store));
        case "/api/sessions": return send(res, 200, store.listSessions(projectId).map((s) => ({ ...s, turns: store.currentTurn(projectId, s.id) })));
        case "/api/session": {
          const session = readJson(path.join(store.sessionDir(projectId, sessionId), "session.json"));
          if (!session) return send(res, 404, { error: "no such session" });
          return send(res, 200, { session, turns: turnsOf(store, projectId, sessionId) });
        }
        case "/api/turn": {
          const dir = store.turnDir(projectId, sessionId, turn);
          const t = readJson(path.join(dir, "turn.json"));
          if (!t) return send(res, 404, { error: "no such turn" });
          const ids = { projectId, sessionId, turn };
          let diff = ""; try { diff = fs.readFileSync(path.join(dir, "diff.patch"), "utf8"); } catch { /* not yet */ }
          let analysis = null;
          if (t.after) { try { analysis = await ensureAnalysis(store, { projectId, sessionId, turn }, { online: !!online(), fetchFn }); } catch { /* shown as missing */ } }
          return send(res, 200, {
            turn: { ...t, teaching: busy.has(`${projectId}/${sessionId}/${turn}`) },
            events: store.readEvents(projectId, sessionId).filter((e) => e.turn === turn),
            diff, analysis, lesson: readJson(path.join(dir, "lesson.json")),
            quiz: readQuiz(store, ids),
            todo: buildTodo({ turn: t, events: store.readEvents(projectId, sessionId).filter((e) => e.turn === turn), lesson: readJson(path.join(dir, "lesson.json")), analysis }),
          });
        }
        case "/api/export": {
          const kind = ["pr", "commit", "note"].includes(q("kind")) ? q("kind") : "pr", lang = q("lang") === "hi" ? "hi" : "en";
          const project = readJson(path.join(store.projectDir(projectId), "project.json"));
          if (!project) return send(res, 404, { error: "no such project" });
          const turns = [];
          for (let n = 1; n <= store.currentTurn(projectId, sessionId); n++) { const d = turnData(store, projectId, sessionId, n); if (d) turns.push(d); }
          return send(res, 200, { kind, lang, text: buildExport(kind, { project: project.name, turns }, lang) });
        }
        case "/api/record": {
          if (!readJson(path.join(store.projectDir(projectId), "project.json"))) return send(res, 404, { error: "no such project" });
          return send(res, 200, learningRecord(store, projectId));
        }
        case "/api/quiz": {
          if (req.method !== "POST") return send(res, 405, { error: "POST only" });
          const body = await readBody(req);
          const r = saveQuiz(store, { projectId, sessionId, turn }, { question: Number(body.question), answer: Number(body.answer), reset: body.reset === true });
          return send(res, r.ok ? 200 : 400, r);
        }
        case "/api/sandbox": {
          const t = readJson(path.join(store.turnDir(projectId, sessionId, turn), "turn.json"));
          if (!t) return send(res, 404, { error: "no such turn" });
          const settings = sandboxSettings(store, projectId);
          const commit = t.after?.commit, before = t.before?.commit;
          const has = (c) => (c ? PREVIEWABLE.find((p) => snapshotFile(store.home, projectId, c, p) != null) ?? null : null);
          const files = (t.files ?? []).filter((x) => x.status !== "deleted").map((x) => x.path);
          return send(res, 200, {
            settings, detected: commit ? detectCommands(store.home, projectId, commit) : {},
            playground: readJson(path.join(store.turnDir(projectId, sessionId, turn), "playground.json")),
            files, commit, before,
            preview: { token: previewToken, before: has(before), after: has(commit), mine: kept.get(projectId) ?? null },
          });
        }
        case "/api/file": {
          const t = readJson(path.join(store.turnDir(projectId, sessionId, turn), "turn.json"));
          const commit = q("which") === "before" ? t?.before?.commit : t?.after?.commit;
          if (!commit) return send(res, 404, { error: "no snapshot" });
          let rel; try { rel = safeRel(q("path")); } catch { return send(res, 400, { error: "bad path" }); }
          const text = snapshotFile(store.home, projectId, commit, rel);
          return text == null ? send(res, 404, { error: "no such file" }) : send(res, 200, { path: rel, text });
        }
        case "/api/sandbox/allow": {
          if (req.method !== "POST") return send(res, 405, { error: "POST only" });
          const body = await readBody(req);
          return send(res, 200, allowSandbox(store, projectId, body.commands ?? {}));
        }
        case "/api/sandbox/run":
        case "/api/sandbox/playground":
        case "/api/sandbox/apply":
        case "/api/sandbox/discard": {
          if (req.method !== "POST") return send(res, 405, { error: "POST only" });
          const body = await readBody(req);
          const tdir = store.turnDir(projectId, sessionId, turn);
          const t = readJson(path.join(tdir, "turn.json"));
          const session = readJson(path.join(store.sessionDir(projectId, sessionId), "session.json"));
          if (!t?.after?.commit || !session) return send(res, 404, { error: "no snapshot for this prompt" });
          const commit = t.after.commit;
          if (url.pathname === "/api/sandbox/discard") {
            const id = kept.get(projectId);
            if (id) { try { removeSandbox(store, projectId, id); } catch { /* already gone */ } kept.delete(projectId); }
            return send(res, 200, { ok: true });
          }
          if (url.pathname === "/api/sandbox/apply") {
            if (body.confirm !== true) return send(res, 400, { ok: false, error: "needs confirm: true" });
            try { const r = applyEdit(store, { projectId, projectDir: session.cwd, commit, path: body.path, content: String(body.content ?? "") }); return send(res, r.ok ? 200 : 409, r); }
            catch (err) { return send(res, 400, { ok: false, error: String(err.message) }); }
          }
          if (running.has(projectId)) return send(res, 429, { ok: false, error: "one sandbox job at a time" });
          running.add(projectId);
          try {
            if (url.pathname === "/api/sandbox/playground") {
              if (!makeTeacher) return send(res, 501, { ok: false, error: "the teacher is not available" });
              const r = await makePlayground(store, { projectId, sessionId, turn }, { teacher: makeTeacher(), lang: body.lang === "en" ? "en" : "hi", testCommand: sandboxSettings(store, projectId).commands?.test ?? detectCommands(store.home, projectId, commit).test ?? null });
              return send(res, r.ok ? 200 : 502, r);
            }
            const settings = sandboxSettings(store, projectId);
            if (!settings.allowed) return send(res, 403, { ok: false, error: "sandbox runs are not allowed for this project yet" });
            const edits = {};
            let label = body.kind;
            if (body.kind === "whatif") {
              const w = readJson(path.join(tdir, "playground.json"))?.whatIf?.[Number(body.index)];
              const src = w && snapshotFile(store.home, projectId, commit, w.file);
              if (!w || src == null || !src.includes(w.find)) return send(res, 400, { ok: false, error: "that what-if no longer matches the code" });
              edits[w.file] = src.replace(w.find, () => w.replace);
            } else if (body.kind === "challenge") {
              const c = readJson(path.join(tdir, "playground.json"))?.challenge;
              if (!c) return send(res, 400, { ok: false, error: "no challenge for this prompt" });
              edits[c.file] = String(body.content ?? "");
              if (c.test) edits[c.test.file] = c.test.content;
            } else if (body.kind === "edit" || body.kind === "ai") {
              if (body.kind === "edit") edits[safeRel(body.path)] = String(body.content ?? "");
            } else return send(res, 400, { ok: false, error: "kind must be edit, ai, whatif or challenge" });
            const keep = body.kind === "edit";
            const r = await runInSandbox(store, { projectId, commit, edits, projectDir: session.cwd, commands: settings.commands, keep });
            if (keep) { const old = kept.get(projectId); if (old && old !== r.id) { try { removeSandbox(store, projectId, old); } catch { /* gone */ } } kept.set(projectId, r.id); }
            sweepSandboxes(store, projectId);
            const out = { ok: true, kind: label, id: keep ? r.id : null, results: r.results };
            if (body.kind === "edit") {
              const before = snapshotFile(store.home, projectId, commit, safeRel(body.path)) ?? "";
              out.diff = diffText(before, String(body.content ?? ""));
              if (makeTeacher && out.diff) {
                const take = await editTake(store, { projectId, sessionId, turn }, { teacher: makeTeacher(), lang: body.lang === "en" ? "en" : "hi", path: body.path, before, after: String(body.content ?? ""), results: r.results });
                out.take = take;
              }
            }
            return send(res, 200, out);
          } catch (err) {
            return send(res, 400, { ok: false, error: String(err.message ?? err) });
          } finally { running.delete(projectId); }
        }
        case "/api/chat":
        case "/api/explain-back": {
          if (req.method !== "POST") return send(res, 405, { error: "POST only" });
          if (!makeTeacher) return send(res, 501, { error: "the teacher is not available" });
          const body = await readBody(req);
          const lang = body.lang === "en" ? "en" : "hi", key = `${projectId}/${sessionId}`;
          if (asking.has(key)) return send(res, 429, { error: "one question at a time" });
          asking.add(key);
          try {
            const teacher = makeTeacher();
            const r = url.pathname === "/api/chat"
              ? await askSession(store, { projectId, sessionId }, { teacher, lang, question: String(body.question ?? ""), focusTurn: Number(body.turn) || null,
                  history: Array.isArray(body.history) ? body.history.filter((m) => m && typeof m.t === "string").map((m) => ({ who: m.who === "me" ? "me" : "ai", t: m.t.slice(0, 2000) })) : [],
                  line: body.line && typeof body.line.text === "string" ? { file: String(body.line.file ?? "").slice(0, 300), text: body.line.text.slice(0, 500) } : null })
              : await checkExplanation(store, { projectId, sessionId, turn }, { teacher, lang, text: String(body.text ?? "") });
            return send(res, r.ok ? 200 : 502, r);
          } finally { asking.delete(key); }
        }
        case "/api/explain": {
          if (req.method !== "POST") return send(res, 405, { error: "POST only" });
          if (!onExplain) return send(res, 501, { error: "teaching is not available" });
          const key = `${projectId}/${sessionId}/${turn}`;
          if (busy.has(key)) return send(res, 202, { started: false, busy: true });
          busy.add(key);
          const level = q("level") === "dev" ? "dev" : "beg", lang = q("lang") === "en" ? "en" : "hi";
          Promise.resolve(onExplain({ projectId, sessionId, turn }, { level, lang })).catch(() => {}).finally(() => busy.delete(key));
          return send(res, 202, { started: true });
        }
        case "/api/stream": {
          // Server-sent events: new events in the session + turn file changes, by polling (works on every OS).
          res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
          const evFile = path.join(store.sessionDir(projectId, sessionId), "events.jsonl");
          let size = Number(q("from") ?? 0) || 0, carry = "", sig = "";
          const tick = () => {
            try {
              const st = fs.existsSync(evFile) ? fs.statSync(evFile) : null;
              if (st && st.size > size) {
                const fd = fs.openSync(evFile, "r"); const buf = Buffer.alloc(st.size - size);
                fs.readSync(fd, buf, 0, buf.length, size); fs.closeSync(fd); size = st.size;
                const text = carry + buf.toString("utf8"); const lines = text.split("\n"); carry = lines.pop();
                for (const l of lines) if (l.trim()) res.write(`event: ev\ndata: ${l}\n\n`);
              }
              const turns = turnsOf(store, projectId, sessionId);
              const now = JSON.stringify(turns.map((t) => [t.n, t.status, !!t.after, t.hasLesson, busy.has(`${projectId}/${sessionId}/${t.n}`)]));
              if (now !== sig) { sig = now; res.write(`event: turns\ndata: ${JSON.stringify(turns)}\n\n`); }
            } catch { /* keep the stream alive */ }
          };
          tick();
          const timer = setInterval(tick, 500);
          const ping = setInterval(() => res.write(": ping\n\n"), 15000);
          req.on("close", () => { clearInterval(timer); clearInterval(ping); });
          return;
        }
        default: return send(res, 404, { error: "unknown endpoint" });
      }
    } catch (err) {
      if (err.code === 400 || err.code === 413) return send(res, err.code, { error: err.message });
      return send(res, 500, { error: String(err.message ?? err) });
    }
  });

  return new Promise((resolve, reject) => {
    const tryListen = (p, left) => {
      server.once("error", (err) => {
        if (err.code === "EADDRINUSE" && left > 0) tryListen(p + 1, left - 1); else reject(err);
      });
      server.listen(p, "127.0.0.1", () => {
        const actual = server.address().port;
        resolve({ server, port: actual, token, url: `http://127.0.0.1:${actual}/?t=${token}`, close: () => new Promise((r) => { clearInterval(autoTimer); server.closeAllConnections?.(); server.close(() => r()); }) });
      });
    };
    tryListen(port, port === 0 ? 0 : 10);
  });
}
