// vibe-explainer console (Roadmap Phases 4 and 6–9): real data from the local server.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const code = (s) => String(s ?? "").split("`").map((p, i) => (i % 2 ? `<code>${esc(p)}</code>` : esc(p))).join("");
const pad = (n) => String(n).padStart(2, "0");
const mmss = (s) => `${pad(Math.floor(Math.max(0, s) / 60))}:${pad(Math.round(Math.max(0, s)) % 60)}`;

const params = new URLSearchParams(location.search);
// Static demo (GitHub Pages): the page sets window.VX_STATIC to a JSON export of real sessions.
const STATIC = window.VX_STATIC || null;
const TOKEN = params.get("t") || (STATIC ? "demo" : "");
const pref = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

const S = {
  lang: ["hi", "en"].includes(params.get("lang")) ? params.get("lang") : pref("vx-lang", STATIC ? "en" : "hi"), level: pref("vx-level", "beg"), tab: ["live", "logs", "changes", "wiring", "impact", "play", "todo", "learn"].includes(params.get("tab")) ? params.get("tab") : "live",
  projects: [], project: params.get("project"), sessions: [], session: params.get("session"),
  turns: [], turn: null, data: null, cur: 0, follow: true, stripOpen: params.get("tl") === "open", file: 0, quiz: {}, copied: null, wireSel: null,
};

const UI = {
  project: { hi: "Project", en: "Project" }, session: { hi: "Session", en: "Session" },
  turnsHead: { hi: "Prompts (is session ke)", en: "Prompts in this session" },
  chSoch: { hi: "Soch", en: "Thinking" }, chRead: { hi: "Padha", en: "Read" }, chEdit: { hi: "Badla", en: "Edit" }, chRun: { hi: "Chalaya", en: "Run" },
  tabs: { live: { hi: "Live", en: "Live" }, logs: { hi: "Logs", en: "Logs" }, changes: { hi: "Changes", en: "Changes" }, wiring: { hi: "Wiring", en: "Wiring" }, impact: { hi: "Impact", en: "Impact" }, play: { hi: "Playground", en: "Playground" }, todo: { hi: "To-do", en: "To-do" }, learn: { hi: "Seekho", en: "Learn" } },
  rec: { hi: "Recording", en: "Recording" }, now: { hi: "Abhi", en: "Now" },
  steps: { hi: "kadam", en: "steps" }, files: { hi: "files", en: "files" }, sec: { hi: "sec", en: "s" },
  tl: { hi: "Timeline", en: "Timeline" }, at: { hi: "is pal", en: "at" }, openTl: { hi: "Poori timeline kholo", en: "Open full timeline" }, closeTl: { hi: "Chhoti karo", en: "Collapse" }, follow: { hi: "Live pe wapas", en: "Back to live" },
  noToken: { hi: "Is page ko `vibe-explainer open` se kholo. Usme ek token hota hai jiske bina data nahi milta.", en: "Open this page with `vibe-explainer open`. It carries a token; without it no data is shown." },
  noData: { hi: "Abhi kuch record nahi hua. Apne project mein `vibe-explainer init` chalao, phir Claude Code use karo.", en: "Nothing recorded yet. Run `vibe-explainer init` in your project, then use Claude Code." },
  noTurns: { hi: "Is session mein abhi koi prompt nahi.", en: "No prompts in this session yet." },
  pending: { hi: "Diff ban raha hai…", en: "Making the diff…" }, noChanges: { hi: "Is prompt mein koi file nahi badli.", en: "No file changed in this prompt." },
  colTime: { hi: "Samay", en: "Time" }, colTool: { hi: "Tool", en: "Tool" }, colTarget: { hi: "Kis pe", en: "Target" }, colResult: { hi: "Nateeja", en: "Result" }, details: { hi: "Poora", en: "Full" },
  plain: { hi: "Saral bhaasha mein", en: "In plain words" }, devNote: { hi: "Developer note", en: "Developer note" },
  lWhat: { hi: "Kya hua", en: "What happened" }, lWhy: { hi: "Kyun", en: "Why" }, lHow: { hi: "Kaise kaam karta hai", en: "How it works" }, lBA: { hi: "Pehle vs ab", en: "Before vs after" }, before: { hi: "Pehle", en: "Before" }, after: { hi: "Ab", en: "After" },
  asked: { hi: "Tumne kya maanga tha", en: "What you asked for" }, claims: { hi: "AI ke daawe vs record", en: "The AI's claims vs the record" }, errors: { hi: "Raaste mein error", en: "Errors on the way" }, decision: { hi: "AI ne ye raasta kyun chuna", en: "Why the AI chose this way" },
  impact: { hi: "Dhyan do", en: "Watch out" }, concepts: { hi: "Naye concepts", en: "New concepts" }, quiz: { hi: "Chhota quiz", en: "Quick quiz" }, manual: { hi: "Khud test karo", en: "Test it yourself" }, expect: { hi: "Kya dikhna chahiye", en: "What you should see" },
  copy: { hi: "Copy", en: "Copy" }, copied: { hi: "Copy ho gaya", en: "Copied" }, fix: { hi: "AI ko ye bhejo", en: "Send this to the AI" },
  showTl: { hi: "Timeline pe dekho", en: "Show on timeline" },
  st: { backed: { hi: "Saboot hai", en: "Backed" }, unverified: { hi: "Check nahi ho saka", en: "Can't verify" }, none: { hi: "Saboot nahi", en: "No evidence" }, done: { hi: "Hua", en: "Done" }, part: { hi: "Aadha", en: "Partly" }, no: { hi: "Nahi hua", en: "Not done" } },
  teachTitle: { hi: "Is prompt ka lesson abhi nahi bana", en: "No lesson for this prompt yet" },
  teachNote: { hi: "Lesson tumhare apne `claude` se banta hai (lagbhag 1 minute), aur tumhare Claude plan ki thodi usage leta hai. Code ke secrets pehle chhupaye jaate hain.", en: "The lesson is written by your own `claude` (about a minute) and uses a little of your Claude plan. Secrets are masked first." },
  teachBtn: { hi: "Lesson banao", en: "Write the lesson" }, teaching: { hi: "Teacher likh raha hai…", en: "The teacher is writing…" }, teachFail: { hi: "Lesson nahi ban paaya:", en: "The lesson failed:" }, retry: { hi: "Dobara try karo", en: "Try again" },
  waitTurn: { hi: "Prompt khatam hone ke baad lesson ban sakta hai.", en: "A lesson can be written once the prompt finishes." },
  lessonMeta: { hi: "Teacher", en: "Teacher" },
};
const T = (o) => (o && typeof o === "object" ? (o[S.lang] ?? o.hi) : o ?? "");

/* ---------- API ---------- */
let DB = null;
async function api(pathname, q = {}, method = "GET", body = null) {
  if (STATIC) {
    DB ??= await (await fetch(STATIC)).json();
    const k = (...a) => a.join("/");
    switch (pathname) {
      case "/api/projects": return DB.projects;
      case "/api/sessions": return DB.sessions[q.project] ?? [];
      case "/api/session": return DB.session[k(q.project, q.session)];
      case "/api/turn": return structuredClone(DB.turn[k(q.project, q.session, q.turn)]);
      case "/api/export": return { text: DB.export?.[k(q.project, q.session)]?.[q.kind]?.[q.lang] ?? "" };
      case "/api/record": return structuredClone(DB.record?.[q.project] ?? { facts: { prompts: 0, files: 0, noEvidence: 0, solid: 0, concepts: 0 }, concepts: [] });
      default: throw new Error("not available in the demo");
    }
  }
  const u = new URL(pathname, location.origin);
  u.searchParams.set("t", TOKEN);
  for (const [k, v] of Object.entries(q)) if (v != null) u.searchParams.set(k, v);
  // every POST is JSON: the server refuses anything else (a cross-origin page can't send it without asking)
  const r = await fetch(u, method === "POST" ? { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) } : { method });
  const j = await r.json().catch(() => null);
  if (!r.ok && !(j && "ok" in j)) throw new Error(j?.error ?? `${r.status}`);
  return j;
}

/* ---------- helpers on events ---------- */
const CH = (tool) => /^(Read|Grep|Glob|WebFetch|WebSearch|LS|NotebookRead)$/.test(tool) ? "read"
  : /^(Edit|MultiEdit|Write|NotebookEdit)$/.test(tool) ? "edit" : /^(Bash|PowerShell)$/.test(tool) ? "run" : "soch";
const secsOf = (ts) => (Date.parse(ts) - Date.parse(S.data.turn.startedAt)) / 1000;
function relPath(p) {
  const cwd = (S.sessions.find((s) => s.id === S.session)?.cwd ?? "").replace(/\\/g, "/");
  const n = String(p ?? "").replace(/\\/g, "/");
  return cwd && n.toLowerCase().startsWith(cwd.toLowerCase() + "/") ? n.slice(cwd.length + 1) : n;
}
/** Pair tool_start/tool_end into steps with a duration. */
function steps() {
  const ev = S.data?.events ?? [], out = [], open = [];
  for (const e of ev) {
    if (e.kind === "prompt") out.push({ kind: "prompt", t: secsOf(e.ts), len: 0.8, text: e.prompt });
    else if (e.kind === "tool_start") open.push(e);
    else if (e.kind === "tool_end") {
      const i = open.findIndex((s) => s.tool === e.tool && s.target === e.target);
      const st = i >= 0 ? open.splice(i, 1)[0] : e;
      out.push({ kind: "tool", t: secsOf(st.ts), len: Math.max(0.6, secsOf(e.ts) - secsOf(st.ts)), tool: e.tool, target: e.target, ok: e.ok !== false, ev: e });
    } else if (e.kind === "stop") out.push({ kind: "stop", t: secsOf(e.ts), len: 0.8 });
  }
  for (const st of open) out.push({ kind: "tool", t: secsOf(st.ts), len: 0.8, tool: st.tool, target: st.target, ok: true, running: true, ev: st });
  return out.sort((a, b) => a.t - b.t);
}
const duration = () => {
  const t = S.data?.turn; if (!t) return 1;
  const end = t.endedAt ? Date.parse(t.endedAt) : Date.now();
  return Math.max(1, (end - Date.parse(t.startedAt)) / 1000);
};
function label(s) {
  if (s.kind === "prompt") return S.lang === "hi" ? "Prompt mila" : "Prompt received";
  if (s.kind === "stop") return S.lang === "hi" ? "AI ne kaam khatam kiya" : "The AI finished";
  const verbs = { read: { hi: "Padha", en: "Read" }, edit: { hi: "Badla", en: "Changed" }, run: { hi: "Chalaya", en: "Ran" }, soch: { hi: "Use kiya", en: "Used" } };
  const v = T(verbs[CH(s.tool)]);
  return `${v} (${s.tool})`;
}
const icon = (k) => `<svg class="i"><use href="#i-${{ read: "read", edit: "edit", run: "run", soch: "soch", prompt: "prompt", stop: "msg" }[k] ?? "soch"}"/></svg>`;

/* ---------- render ---------- */
function labels() {
  document.documentElement.lang = S.lang === "hi" ? "hi-Latn" : "en";
  document.querySelectorAll("[data-i]").forEach((el) => { el.textContent = T(UI[el.dataset.i]); });
  document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === S.lang));
  document.querySelectorAll("[data-level]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.level === S.level));
}

function pickers() {
  $("#projectSel").innerHTML = S.projects.map((p) => `<option value="${esc(p.id)}" ${p.id === S.project ? "selected" : ""}>${esc(p.name)}</option>`).join("");
  $("#sessionSel").innerHTML = S.sessions.slice().reverse().map((s) => `<option value="${esc(s.id)}" ${s.id === S.session ? "selected" : ""}>${esc(new Date(s.startedAt).toLocaleString())} · ${s.turns}</option>`).join("");
  const live = S.turns.some((t) => t.status === "open");
  $("#rec").classList.toggle("off", !live);
  $("#recText").textContent = T(UI.rec);
}

function rail() {
  $("#turns").innerHTML = S.turns.map((t) => {
    const files = (t.files ?? []).length;
    const meta = t.status === "open"
      ? `<span class="dot"></span>${T(UI.now)}`
      : `${t.endedAt ? Math.round((Date.parse(t.endedAt) - Date.parse(t.startedAt)) / 1000) : "?"}${T(UI.sec)} · ${files} ${T(UI.files)}${t.claimsNone ? ` <span class="flag">${t.claimsNone} ${T(UI.st.none).toLowerCase()}</span>` : ""}${t.hasLesson ? ` <span class="tag ok">${S.lang === "hi" ? "lesson" : "lesson"}</span>` : ""}`;
    return `<button class="turn" data-turn="${t.n}" aria-current="${S.view === "turn" && t.n === S.turn}"><span class="n">${pad(t.n)}</span><span class="p">${esc(t.prompt)}</span><span class="meta">${meta}</span></button>`;
  }).join("");
}

function strip() {
  const sec = $("#strip");
  if (!S.data || S.view === "record") { sec.hidden = true; return; }
  sec.hidden = false; sec.classList.toggle("mini", !S.stripOpen);
  const dur = duration(), row = { soch: 0, read: 1, edit: 2, run: 3 };
  const tr = $("#trace");
  let h = "";
  const step = dur <= 20 ? 5 : dur <= 60 ? 10 : dur <= 180 ? 30 : 60;
  for (let s = step; s < dur; s += step) h += `<span class="vline" style="left:${(s / dur) * 100}%"></span>`;
  for (const s of steps()) {
    const ch = s.kind === "tool" ? CH(s.tool) : "soch";
    const left = Math.min(98.5, (s.t / dur) * 100), width = Math.min(100 - left, (Math.max(s.len, 0.6) / dur) * 100);
    h += `<span class="tick ${ch} ${s.ok === false ? "bad" : ""} ${s.t > S.cur ? "future" : ""}" style="left:${left}%;width:${width}%;top:${row[ch] * 32}px" title="${esc(mmss(s.t) + " " + label(s) + " " + relPath(s.target ?? ""))}"></span>`;
  }
  for (const c of S.data.lesson?.claims ?? []) if (Number.isFinite(c.at)) h += `<span class="pin ${esc(c.status)}" style="left:${(c.at / dur) * 100}%" title="${esc(c.text)}"></span>`;
  const live = S.data.turn.status === "open" && S.follow;
  h += `<span class="cursor ${live ? "live" : ""}" style="left:${(Math.min(S.cur, dur) / dur) * 100}%"></span>`;
  tr.innerHTML = h;
  tr.setAttribute("aria-valuemax", Math.round(dur)); tr.setAttribute("aria-valuenow", Math.round(S.cur)); tr.setAttribute("aria-valuetext", mmss(S.cur));
  let marks = ""; for (let s = 0; s <= dur - step / 3; s += step) marks += `<span style="left:${(s / dur) * 100}%">${mmss(s)}</span>`;
  $("#scale").innerHTML = marks;
  const showFollow = S.data.turn.status === "open" && !S.follow;
  $("#stripTitle").innerHTML = `<span class="tlname">${T(UI.tl)}</span><span class="num">${T(UI.at)}: ${mmss(S.cur)}</span><span class="grow"></span>${showFollow ? `<button class="primary sm" id="followBtn">${T(UI.follow)}</button>` : ""}<button class="ghost sm" id="tlToggle">${S.stripOpen ? T(UI.closeTl) : T(UI.openTl)}</button>`;
}

function head() {
  const H = $("#head");
  if (!S.data || S.view === "record") { H.innerHTML = ""; return; }
  const t = S.data.turn, ev = S.data.events.filter((e) => e.kind === "tool_end").length;
  H.innerHTML = `<h1 class="prompt">${esc(t.prompt)}</h1>
    <div class="prompt-meta num">${t.status === "open" ? `<span class="livetag">● ${T(UI.now)}</span> · ` : ""}${ev} ${T(UI.steps)} · ${(t.files ?? []).length} ${T(UI.files)} · ${Math.round(duration())}${T(UI.sec)}</div>
    ${summaryCard()}${claimBanner()}`;
}

function nav() {
  if (!S.data || S.view === "record") { $("#nav").innerHTML = ""; return; }
  if (guided()) { $("#nav").innerHTML = stepperNav(); return; }
  const tabs = ["live", "logs", "changes", "wiring", "impact", "play", "todo", "learn"], ic = { live: "t-live", logs: "t-logs", changes: "t-changes", wiring: "t-wiring", impact: "t-impact", play: "i-run", todo: "t-todo", learn: "t-seekho" };
  $("#nav").innerHTML = `<div class="tabs" role="tablist">${tabs.map((k) => `<button role="tab" data-tab="${k}" aria-selected="${S.tab === k}"><svg class="i"><use href="#${ic[k]}"/></svg><span>${T(UI.tabs[k])}</span></button>`).join("")}</div>`;
}

function content() {
  const C = $("#content");
  if (!TOKEN) { C.innerHTML = `<div class="empty">${code(T(UI.noToken))}</div>`; return; }
  if (!S.projects.length) { C.innerHTML = `<div class="empty">${code(T(UI.noData))}</div>`; return; }
  if (S.view === "record") { C.innerHTML = `<div class="panel">${recordView()}</div>`; return; }
  if (!S.data) { C.innerHTML = `<div class="empty">${T(UI.noTurns)}</div>`; return; }
  C.innerHTML = `<div class="panel">${guided() ? guidedBody() : { live, logs, changes, wiring, impact, play: playView, todo: todoView, learn }[S.tab]()}</div>`;
}

function live() {
  const st = steps(); let a = null;
  for (const s of st) if (s.t <= S.cur + 0.01) a = s;
  if (!a) return `<div class="empty">${S.lang === "hi" ? "Timeline pe handle aage le jao." : "Move the handle along the timeline."}</div>`;
  const ch = a.kind === "tool" ? CH(a.tool) : a.kind;
  const why = a.kind === "tool" && !a.ok ? (S.lang === "hi" ? "Ye kadam fail hua. Poora output Logs mein hai." : "This step failed. The full output is in Logs.")
    : ch === "read" ? (S.lang === "hi" ? "Badalne se pehle AI ne ye padha, taaki samjhe abhi code kaisa hai." : "The AI read this before changing anything.")
    : ch === "edit" ? (S.lang === "hi" ? "Changes tab mein iska diff hai." : "The Changes tab has this diff.")
    : ch === "run" ? (S.lang === "hi" ? "Command ka output Logs mein hai." : "The command's output is in Logs.") : "";
  return `<div class="now ch-${ch} ${a.ok === false ? "bad" : ""}"><span class="t">${mmss(a.t)}</span>
      <div class="what">${icon(ch)} ${esc(label(a))}${a.target ? ` <code>${esc(relPath(a.target))}</code>` : ""}${a.kind === "prompt" ? `<br><span class="muted">${esc(a.text)}</span>` : ""}</div>
      <div class="why">${why}</div></div>
    <ul class="feed">${st.map((s) => { const c = s.kind === "tool" ? CH(s.tool) : s.kind; return `<li class="ev-${c} ${s.t > S.cur + 0.01 ? "future" : ""} ${s === a ? "at" : ""}"><span class="t">${mmss(s.t)}</span><span class="ic">${icon(c)}</span>
      <span class="tx">${esc(label(s))}${s.target ? ` <code>${esc(relPath(s.target))}</code>` : ""}${s.ok === false ? ` <span class="fail">✗</span>` : ""}${s.running ? ` <span class="spin dark"></span>` : ""}</span></li>`; }).join("")}</ul>`;
}

function shortJson(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  const r = v.stdout != null || v.stderr != null ? [v.stdout, v.stderr].filter(Boolean).join("\n") : JSON.stringify(v, null, 2);
  return r.length > 6000 ? r.slice(0, 6000) + "\n…" : r;
}
function logs() {
  const rows = steps().filter((s) => s.kind === "tool");
  return `<div class="logwrap"><table class="log"><thead><tr><th>${T(UI.colTime)}</th><th>${T(UI.colTool)}</th><th>${T(UI.colTarget)}</th><th>${T(UI.colResult)}</th></tr></thead><tbody>
    ${rows.map((s) => `<tr><td class="t">${mmss(s.t)}</td><td class="tool tool-${CH(s.tool)}"><span>${esc(s.tool)}</span></td><td class="target"><code>${esc(relPath(s.target ?? ""))}</code></td>
      <td>${s.running ? `<span class="spin dark"></span>` : s.ok ? `<span class="res-ok">ok</span>` : `<span class="res-x">${S.lang === "hi" ? "fail" : "failed"}</span>`}
      ${s.ev?.result != null || s.ev?.input != null ? `<details><summary><svg class="i"><use href="#i-chev"/></svg>${T(UI.details)}</summary><pre>${esc(shortJson(s.ev.input))}</pre>${s.ev.result != null ? `<pre>${esc(shortJson(s.ev.result))}</pre>` : ""}</details>` : ""}</td></tr>`).join("")}
  </tbody></table></div>`;
}

/** Split a unified diff into files and hunks. */
function parseDiff(text) {
  const files = []; let f = null, h = null, oldN = 0, newN = 0;
  for (const line of String(text).split("\n")) {
    if (line.startsWith("diff --git ")) { f = { path: line.replace(/^diff --git a\/.* b\//, ""), hunks: [], status: "modified" }; files.push(f); h = null; continue; }
    if (!f) continue;
    if (line.startsWith("new file")) f.status = "added";
    else if (line.startsWith("deleted file")) f.status = "deleted";
    else if (line.startsWith("rename from ")) f.status = "renamed";
    else if (line.startsWith("Binary files")) f.binary = true;
    else if (line.startsWith("@@")) { const m = /@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(line); oldN = +m[1]; newN = +m[2]; h = { head: line, lines: [] }; f.hunks.push(h); }
    else if (h && !line.startsWith("\\")) {
      const s = line[0]; if (s === "+") h.lines.push(["+", line.slice(1), newN++]); else if (s === "-") h.lines.push(["-", line.slice(1), oldN++]); else if (s === " ") { h.lines.push([" ", line.slice(1), newN++]); oldN++; }
    }
  }
  return files;
}
function changes() {
  const t = S.data.turn;
  if (!t.after) return `<div class="empty">${t.snapshotError ? esc(t.snapshotError) : t.status === "open" ? (S.lang === "hi" ? "AI abhi kaam kar raha hai. Prompt khatam hote hi diff yahan aayega." : "The AI is working. The diff shows up when the prompt ends.") : T(UI.pending)}</div>`;
  const files = parseDiff(S.data.diff);
  if (!files.length) return `<div class="empty">${T(UI.noChanges)}</div>`;
  const fi = Math.min(S.file, files.length - 1), f = files[fi];
  const meta = (t.files ?? []).find((x) => x.path === f.path) ?? {};
  const notes = (S.data.lesson?.notes ?? []).filter((n) => relPath(n.file).replace(/\\/g, "/").endsWith(f.path) || f.path.endsWith(relPath(n.file)));
  return `<div class="files">${files.map((g, i) => { const m = (t.files ?? []).find((x) => x.path === g.path) ?? {}; return `<button data-file="${i}" aria-pressed="${i === fi}">${esc(g.path.split("/").pop())}<span class="c num">+${m.add ?? "?"} −${m.del ?? "?"}</span></button>`; }).join("")}</div>
    <div class="fhead"><code>${esc(f.path)}</code><span class="badge ${f.status}">${esc(f.status)}</span><span class="muted num">+${meta.add ?? "?"} −${meta.del ?? "?"}</span></div>
    <p class="hint"><svg class="i"><use href="#i-ask"/></svg>${T(P8.askHint)}</p>
    <div class="diffwrap"><div>${f.binary ? `<div class="empty">binary</div>` : f.hunks.map((h, hi) => `<div class="code"><div class="hh">${esc(h.head)}</div>${h.lines.map(([s, txt, n], li) => { const k = `${fi}:${hi}:${li}`, can = txt.trim().length > 0;
      return `<div class="${s === "+" ? "add" : s === "-" ? "del" : ""} ${can ? "line" : ""} ${S.ask === k ? "asked" : ""}" ${can ? `data-ask="${k}" data-path="${esc(f.path)}" tabindex="0"` : ""}><span class="ln num">${s === "-" ? "" : n}</span><span class="sg">${s === " " ? " " : s === "-" ? "−" : "+"}</span><span>${esc(txt) || " "}</span>${can ? `<span class="askbtn" aria-hidden="true">?</span>` : ""}</div>${askBox(k)}`; }).join("")}</div>`).join("")}</div>
    <div class="notes">${notes.length ? notes.map((n) => `<div class="note"><b>${S.data.lesson.level === "dev" ? T(UI.devNote) : T(UI.plain)}</b>${code(n.text)}</div>`).join("") : `<div class="note muted">${S.data.lesson ? "" : (S.lang === "hi" ? "Lesson banne ke baad yahan har badlaav ka saral samjhaana aayega (Seekho tab)." : "Once the lesson is written, plain-words notes appear here (Learn tab).")}</div>`}</div></div>`;
}

/* ---------- analyzer: wiring + impact (Phase 6) ---------- */
const AN = {
  wait: { hi: "Ye prompt khatam hone ke baad banega.", en: "This is worked out when the prompt ends." },
  none: { hi: "Is prompt mein koi function ya class nahi badli (JS/TS/Python files dekhi jaati hain).", en: "No function or class changed in this prompt (JS/TS and Python files are read)." },
  legendOld: { hi: "pehle se tha", en: "already there" }, legendChanged: { hi: "badla", en: "changed" }, legendNew: { hi: "naya", en: "new" }, legendRisk: { hi: "dhyan do", en: "watch this" },
  wireHint: { hi: "Kisi dabbe pe click karo: wo kisse juda hai, wahi dikhega.", en: "Click a box to see only what it connects to." },
  calls: { hi: "isko call karta hai", en: "calls it" },
  risk: { 1: { hi: "Kam", en: "Low" }, 2: { hi: "Beech", en: "Medium" }, 3: { hi: "Zyada", en: "High" } },
  todo: { hi: "Kya karo:", en: "What to do:" }, users: { hi: "Kahan use hota hai", en: "Where it is used" },
  fix: { hi: "AI ko ye bhejo", en: "Send this to the AI" }, copy: { hi: "Copy", en: "Copy" }, copied: { hi: "Copy ho gaya", en: "Copied" },
  noImpact: { hi: "Is prompt ke badlaav se baaki code pe koi asar nahi dikha: badle hue functions ko kahin aur se call nahi kiya jaata.", en: "Nothing else in the code seems affected: no other code calls the functions that changed." },
  secHead: { hi: "Packages aur security", en: "Packages and security" },
  noPkg: { hi: "Is prompt mein koi package nahi aaya ya gaya.", en: "No package was added or removed in this prompt." },
  pkgWhat: { hi: "Kya karta hai", en: "What it does" }, pkgSize: { hi: "Size", en: "Size" }, pkgLic: { hi: "Licence", en: "Licence" }, pkgDl: { hi: "Downloads/hafta", en: "Downloads/week" },
  pkgFine: { hi: "Theek lagta hai", en: "Looks fine" }, pkgCheck: { hi: "Ek baar dekh lo", en: "Have a look" },
  pkgOff: { hi: "Online jaankari band hai (`vibe-explainer config set registry on`).", en: "Online lookups are off (`vibe-explainer config set registry on`)." },
  pkgFail: { hi: "Jaankari nahi mil paayi:", en: "Couldn't look it up:" },
  removed: { hi: "hataya", en: "removed" }, changedV: { hi: "version badla", en: "version changed" }, dev: { hi: "sirf development", en: "dev only" },
  okSecret: { hi: "Naye code mein koi password ya key nahi mili", en: "No password or key in the new code" },
  okPatterns: { hi: "Naye code mein koi khatarnak pattern nahi mila (eval, shell, HTML, SQL)", en: "No risky pattern in the new code (eval, shell, HTML, SQL)" },
  scanned: { hi: "Sirf is prompt mein jode gaye lines check hui. Ye pattern hain, saboot nahi: line khud padho.", en: "Only the lines added in this prompt are checked. These are patterns, not proof: read the line yourself." },
  meta: { hi: "Code padh ke nikala (AI ne nahi)", en: "Found by reading the code (not by the AI)" },
};
const RULE = {
  "secret": { t: { hi: "Code mein ek key ya password", en: "A key or password in the code" }, d: { hi: "Ye line ek asli secret jaisi dikhti hai. Code mein secret rakhoge to git ke saath sab tak pahunch jaata hai. Isko `.env` file mein rakho aur code mein `process.env` se padho.", en: "This line looks like a real secret. Secrets in code travel with git to everyone. Keep it in a `.env` file and read it with `process.env`." } },
  "env-file": { t: { hi: "`.env` file project mein hai, par `.gitignore` mein nahi", en: "A `.env` file that `.gitignore` does not cover" }, d: { hi: "Is file mein aksar passwords hote hain. `.gitignore` mein `.env` jodo, taaki ye git mein na jaaye. (Iski values yahan nahi dikhayi jaati.)", en: "This file usually holds passwords. Add `.env` to `.gitignore` so it never goes into git. (Its values are never shown here.)" } },
  "eval": { t: { hi: "`eval` ya `new Function`", en: "`eval` or `new Function`" }, d: { hi: "Ye text ko code bana ke chala deta hai. Agar text user se aaya, to wo kuch bhi chala sakta hai.", en: "This runs text as code. If the text comes from a user, they can run anything." } },
  "shell-injection": { t: { hi: "Command mein joda hua text", en: "Text glued into a shell command" }, d: { hi: "Command banate waqt bahar ka text joda gaya hai. Usme `; rm -rf` jaisa kuch ho to wo bhi chal jaayega. Arguments ko alag list mein do.", en: "Outside text is glued into a command. Something like `; rm -rf` in it would run too. Pass arguments as a separate list." } },
  "tls-off": { t: { hi: "HTTPS ki jaanch band ki gayi", en: "HTTPS checks turned off" }, d: { hi: "Isse beech mein koi bhi nakli server ban ke data padh sakta hai. Sirf local testing ke liye theek hai.", en: "Anyone in between can pose as the server and read the data. Only acceptable for local testing." } },
  "unsafe-deserialize": { t: { hi: "Data ko unsafe tareeke se padha", en: "Data loaded in an unsafe way" }, d: { hi: "`pickle` ya `yaml.load` bahar ke data se code chala sakte hain. `json` ya `yaml.safe_load` use karo.", en: "`pickle` and `yaml.load` can run code hidden in the data. Use `json` or `yaml.safe_load`." } },
  "sql-concat": { t: { hi: "SQL mein seedha joda hua value", en: "A value glued into SQL" }, d: { hi: "Isse SQL injection ho sakta hai. Value ko `?` ya `$1` jaise placeholder se bhejo.", en: "This allows SQL injection. Pass the value through a placeholder like `?` or `$1`." } },
  "html-injection": { t: { hi: "HTML seedha page mein daala", en: "HTML written straight into the page" }, d: { hi: "Agar ye text user se aaya, to usme `<script>` bhi chal sakta hai (XSS). Sirf text dikhana ho to `textContent` use karo.", en: "If this text comes from a user, a `<script>` inside it can run (XSS). Use `textContent` when you only show text." } },
  "error-leak": { t: { hi: "Error ki andar ki details user ko", en: "Internal error details sent to the user" }, d: { hi: "Stack trace se server ke andar ki baatein dikh jaati hain. User ko chhota message do, details sirf log mein rakho.", en: "A stack trace shows how the server works inside. Send a short message; keep details in the log." } },
  "cors-any": { t: { hi: "Har website ko API access", en: "Every website may call this API" }, d: { hi: "`*` ka matlab koi bhi site is API ko browser se call kar sakti hai. Sirf apni site ka address do.", en: "`*` lets any site call this API from a browser. Name your own site instead." } },
  "weak-hash": { t: { hi: "Purana hash (md5/sha1)", en: "An old hash (md5/sha1)" }, d: { hi: "Passwords ya security ke liye ye kamzor hain. Password ke liye `bcrypt`/`argon2`, baaki ke liye `sha256`.", en: "Too weak for passwords or security. Use `bcrypt`/`argon2` for passwords, `sha256` otherwise." } },
};
const REASON = {
  "new": { hi: "Is prompt mein naya bana.", en: "New in this prompt." },
  "removed-still-used": { hi: "Function hata diya gaya, par code abhi bhi isko call karta hai: ye jagah ab toot sakti hain.", en: "It was removed, but code still calls it: those places can now break." },
  "removed-unused": { hi: "Hata diya gaya, aur koi isko use nahi karta tha.", en: "It was removed, and nothing used it." },
  "used-elsewhere": { hi: "Doosre code se call hota hai, to unka nateeja bhi badal sakta hai.", en: "Other code calls it, so their results can change too." },
  "signature-changed": { hi: "Iske parameters badle. Purane tareeke se call karne wali jagah galat value bhej sakti hain.", en: "Its parameters changed. Places that call it the old way may pass the wrong values." },
  "many-callers": { hi: "Bahut jagah use hota hai.", en: "Many places use it." },
  "exported": { hi: "Ye file ke bahar bhi diya (export) gaya hai.", en: "It is exported, so other files can use it." },
  "no-tests": { hi: "Koi test isko call nahi karta, to galti apne aap nahi pakdi jaayegi.", en: "No test calls it, so a mistake won't be caught automatically." },
  "tested": { hi: "Ek test isko call karta hai. Tests chala ke dekh lo.", en: "A test calls it. Run the tests to check." },
};
const fnName = (s) => `${s.owner ? `${s.owner}.` : ""}${s.name}${s.kind === "class" ? "" : "()"}`;
const fmtSize = (b) => (b == null ? "?" : b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const fmtNum = (n) => (n == null ? "?" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));
const PERMISSIVE = /^(MIT|ISC|BSD|Apache|0BSD|Unlicense|CC0|Python|PSF|Zlib|BlueOak|MPL)/i;
const usersOf = (s) => s.callers.filter((c) => c.kind !== "import");

function anWait() {
  const t = S.data.turn;
  if (!t.after) return `<div class="empty">${t.snapshotError ? esc(t.snapshotError) : T(AN.wait)}</div>`;
  if (!S.data.analysis) return `<div class="empty">${T(UI.pending)}</div>`;
  if (S.data.analysis.error) return `<div class="empty">${esc(S.data.analysis.error)}</div>`;
  return null;
}

/** Boxes and arrows: callers → changed code → what it calls. */
function wiring() {
  const w = anWait(); if (w) return w;
  const a = S.data.analysis;
  const syms = a.symbols.slice().sort((x, y) => y.risk - x.risk).slice(0, 8);
  if (!syms.length) return `<div class="empty">${T(AN.none)}</div>`;
  const nodes = new Map(), edges = [], col = [[], [], []], info = {};
  const add = (id, c, n) => { if (!nodes.has(id)) { nodes.set(id, { id, ...n }); col[c].push(id); } return nodes.get(id); };
  for (const s of syms) {
    const id = `s:${s.file}:${fnName(s)}`;
    add(id, 1, { label: fnName(s), k: s.file.split("/").pop(), st: s.risk >= 3 || s.change === "removed" ? "risk" : s.change === "added" ? "new" : "changed", sym: s });
  }
  let hidden = 0;
  for (const s of syms) {
    const to = `s:${s.file}:${fnName(s)}`;
    for (const c of usersOf(s)) {
      const changed = syms.find((x) => x.file === c.file && c.in && fnName(x).replace(/\(\)$/, "") === c.in);
      const from = changed ? `s:${changed.file}:${fnName(changed)}` : `c:${c.file}:${c.in ?? ""}`;
      if (!changed) {
        if (!nodes.has(from) && col[0].length >= 8) { hidden++; continue; }
        const n = add(from, 0, { label: c.in ? `${c.in}()` : c.file.split("/").pop(), k: c.in ? c.file.split("/").pop() : (S.lang === "hi" ? "file ke upar" : "top of file"), st: "old", uses: [] });
        n.uses.push({ s, c });
      }
      if (from !== to && !edges.some(([x, y]) => x === from && y === to)) edges.push([from, to, s.change === "added" ? "new" : ""]);
    }
    for (const k of s.calls ?? []) {
      const known = syms.find((x) => x.name === k.name);
      const id = known ? `s:${known.file}:${fnName(known)}` : `k:${k.name}`;
      if (!known) { if (!nodes.has(id) && col[2].length >= 6) { hidden++; continue; } add(id, 2, { label: `${k.name}()`, k: k.from ?? s.file.split("/").pop(), st: "old", by: [] }).by.push(s); }
      if (id !== to && !edges.some(([x, y]) => x === to && y === id)) edges.push([to, id, s.change === "added" ? "new" : ""]);
    }
  }
  const nw = 220, nh = 50, xs = [30, 330, 630];
  const used = [0, 1, 2].filter((c) => col[c].length);
  used.forEach((c, i) => col[c].forEach((id, j) => Object.assign(nodes.get(id), { x: xs[i], y: 20 + j * 74 })));
  for (const n of nodes.values()) {
    if (n.sym) {
      const s = n.sym, u = usersOf(s);
      const what = { added: { hi: "Is prompt mein naya bana.", en: "New in this prompt." }, modified: { hi: "Is prompt mein badla.", en: "Changed in this prompt." }, removed: { hi: "Is prompt mein hataya gaya.", en: "Removed in this prompt." } }[s.change];
      info[n.id] = `${T(what)} ${u.length ? (S.lang === "hi" ? `${u.length} jagah se call hota hai.` : `Called from ${u.length} place${u.length > 1 ? "s" : ""}.`) : (S.lang === "hi" ? "Koi aur isko call nahi karta." : "Nothing else calls it.")} <code>${esc(s.file)}:${s.start}</code>`;
    } else if (n.uses) {
      info[n.id] = `${S.lang === "hi" ? "Is prompt mein nahi badla, par badle hue code ko use karta hai:" : "Not changed in this prompt, but it uses changed code:"} ${n.uses.map(({ s, c }) => `<code>${esc(fnName(s))}</code> (<code>${esc(c.file)}:${c.line}</code>)`).join(", ")}`;
    } else {
      info[n.id] = `${n.by.map((s) => `<code>${esc(fnName(s))}</code>`).join(", ")} ${S.lang === "hi" ? "isko call karta hai. Ye khud nahi badla." : `call${n.by.length > 1 ? "" : "s"} this. It did not change itself.`}`;
    }
  }
  const all = [...nodes.values()];
  const linked = (id) => !S.wireSel || id === S.wireSel || edges.some(([x, y]) => (x === S.wireSel && y === id) || (y === S.wireSel && x === id));
  const maxX = Math.max(...all.map((n) => n.x)) + nw + 30, maxY = Math.max(...all.map((n) => n.y)) + nh + 20;
  const trunc = (t, n) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
  const ed = edges.map(([p, q, k]) => {
    const A = nodes.get(p), B = nodes.get(q);
    let x1 = A.x + nw, y1 = A.y + nh / 2, x2 = B.x, y2 = B.y + nh / 2;
    let d;
    if (B.x === A.x) { x1 = A.x + nw / 2; x2 = B.x + nw / 2; y1 = A.y + (B.y > A.y ? nh : 0); y2 = B.y + (B.y > A.y ? 0 : nh); d = `M${x1},${y1} L${x2},${y2 + (B.y > A.y ? -4 : 4)}`; }
    else if (B.x < A.x) { x1 = A.x; x2 = B.x + nw; d = `M${x1},${y1} C${x1 - 50},${y1} ${x2 + 50},${y2} ${x2 + 4},${y2}`; }
    else d = `M${x1},${y1} C${x1 + 50},${y1} ${x2 - 50},${y2} ${x2 - 4},${y2}`;
    const dim = S.wireSel && !(p === S.wireSel || q === S.wireSel);
    return `<path class="edge ${k} ${dim ? "dim" : ""}" d="${d}" marker-end="url(#${k === "new" ? "arN" : "ar"})"/>`;
  }).join("");
  const nd = all.map((n) => `<g class="node ${n.st} ${linked(n.id) ? "" : "dim"}" data-node="${esc(n.id)}" tabindex="0" role="button" aria-pressed="${S.wireSel === n.id}" aria-label="${esc(n.label)}">
     <rect x="${n.x}" y="${n.y}" width="${nw}" height="${nh}" rx="12"/>
     <text x="${n.x + 14}" y="${n.y + 22}">${esc(trunc(n.label, 22))}</text><text class="k" x="${n.x + 14}" y="${n.y + 39}">${esc(trunc(n.k, 30))}</text><title>${esc(n.label)}</title></g>`).join("");
  const dark = document.documentElement.dataset.theme === "dark";
  const sel = S.wireSel && nodes.get(S.wireSel);
  return `<div class="wire"><svg viewBox="0 0 ${maxX} ${maxY}" width="${maxX}" height="${maxY}" role="img" aria-label="Wiring">
      <defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L8,4 L0,8z" fill="${dark ? "#5A4C7E" : "#C9B8AA"}"/></marker>
      <marker id="arN" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L8,4 L0,8z" fill="#5BAA7E"/></marker></defs>
      ${ed}${nd}</svg></div>
    <div class="legend"><span><i></i>${T(AN.legendOld)}</span><span><i class="c"></i>${T(AN.legendChanged)}</span><span><i class="n"></i>${T(AN.legendNew)}</span><span><i class="r"></i>${T(AN.legendRisk)}</span></div>
    ${hidden || a.symbols.length > syms.length ? `<p class="wire-more">${S.lang === "hi" ? "Jagah ke liye kuch dabbe chhupaye gaye. Poori list Impact tab mein hai." : "Some boxes are left out to fit. The full list is on the Impact tab."}</p>` : ""}
    <p class="wire-info">${sel ? `<b><code>${esc(sel.label)}</code></b> · ${info[sel.id]}` : `<span class="muted">${T(AN.wireHint)}</span>`}</p>`;
}

/** Impact items from the analysis: risky changes first, each with its evidence and a prompt to fix it. */
function impactItems() {
  const a = S.data?.analysis; if (!a?.symbols) return [];
  return a.symbols.filter((s) => s.change !== "added" || s.risk >= 2).sort((x, y) => y.risk - x.risk).map((s) => {
    const u = usersOf(s), n = u.length, f = `\`${fnName(s)}\``;
    const hi = S.lang === "hi";
    const title = s.change === "removed" ? (n ? (hi ? `${f} hata diya, par ${n} jagah abhi bhi use hota hai` : `${f} was removed, but ${n} place${n > 1 ? "s" : ""} still use it`) : (hi ? `${f} hata diya` : `${f} was removed`))
      : s.signatureChanged ? (hi ? `${f} ke parameters badle` : `${f} takes different parameters now`)
      : n ? (hi ? `${f} badla, ${n} jagah use hota hai` : `${f} changed; ${n} place${n > 1 ? "s" : ""} use it`)
      : (hi ? `${f} badla, koi aur isko use nahi karta` : `${f} changed; nothing else uses it`);
    const todo = [];
    if (s.reasons.includes("removed-still-used")) todo.push(hi ? "Ya to function wapas lao, ya neeche wali har jagah se uska use hatao." : "Bring the function back, or remove its use from every place below.");
    if (s.reasons.includes("signature-changed") && n) todo.push(hi ? `Neeche wali har jagah dekho ki wo naye parameters (${s.params ?? ""}) bhejti hai.` : `Check that every place below passes the new parameters (${s.params ?? ""}).`);
    if (s.reasons.includes("no-tests")) todo.push(hi ? "Iske liye ek chhota test likhwao." : "Ask for a small test that calls it.");
    if (s.reasons.includes("tested")) todo.push(hi ? "Tests chalao." : "Run the tests.");
    if (!todo.length) todo.push(hi ? "Kuch nahi, bas jaan lo." : "Nothing; just be aware of it.");
    const where = u.slice(0, 12).map((c) => `${c.file}:${c.line}`).join(", ");
    const prompt = s.risk < 2 ? "" : s.change === "removed"
      ? (hi ? `\`${s.file}\` se \`${fnName(s)}\` hata diya gaya, par ye abhi bhi in jagahon pe use hota hai: ${where}. Har jagah theek karo (ya function wapas lao), phir tests chalao.` : `\`${fnName(s)}\` was removed from \`${s.file}\`, but these places still use it: ${where}. Fix each one (or bring the function back), then run the tests.`)
      : s.signatureChanged
      ? (hi ? `\`${s.file}\` mein \`${fnName(s)}\` ke parameters (${s.paramsBefore ?? ""}) se (${s.params ?? ""}) ho gaye. In sab callers ko check karke update karo: ${where}.${s.tested ? "" : " Phir ek test likho jo naye parameters check kare."} Tests chalao.` : `In \`${s.file}\`, \`${fnName(s)}\` changed its parameters from (${s.paramsBefore ?? ""}) to (${s.params ?? ""}). Check and update every caller: ${where}.${s.tested ? "" : " Then add a test for the new parameters."} Run the tests.`)
      : (hi ? `\`${s.file}\` mein \`${fnName(s)}\` badla hai. Ye jagah isko use karti hain: ${where}. Check karo ki inka behaviour sahi hai${s.tested ? "" : ", aur ek test likho"}.` : `\`${fnName(s)}\` in \`${s.file}\` changed. These places use it: ${where}. Check they still behave correctly${s.tested ? "" : ", and add a test"}.`);
    return { s, title, users: u, todo, prompt };
  });
}

function impact() {
  const w = anWait(); if (w) return w;
  const items = impactItems();
  const list = items.length ? `<ul class="ilist">${items.map((it, i) => `<li><div class="rlevel">${T(AN.risk[it.s.risk])}<span class="meter l${it.s.risk}"><i></i><i></i><i></i></span></div>
      <div><h5>${code(it.title)}</h5><div class="where">${esc(it.s.file)}:${it.s.start}</div>
        <ul class="why">${it.s.reasons.map((r) => (REASON[r] ? `<li>${T(REASON[r])}</li>` : "")).join("")}</ul>
        <div class="fix"><b>${T(AN.todo)}</b> ${it.todo.map(esc).join(" ")}</div>
        ${it.users.length ? `<details><summary><svg class="i"><use href="#i-chev"/></svg>${T(AN.users)} (${it.users.length})</summary><ul class="users">${it.users.map((c) => `<li><code>${esc(c.file)}:${c.line}</code>${c.in ? ` · <b>${esc(c.in)}()</b>` : ""}<br><span class="muted">${esc(c.text)}</span></li>`).join("")}</ul></details>` : ""}
        ${it.prompt ? `<div class="fixprompt"><div class="fp-head"><svg class="i"><use href="#i-msg"/></svg>${T(AN.fix)}</div><p>${code(it.prompt)}</p>
          <button class="ghost sm" data-copy="an${i}">${S.copied === `an${i}` ? T(AN.copied) : `<svg class="i"><use href="#i-copy"/></svg>${T(AN.copy)}`}</button></div>` : ""}
      </div></li>`).join("")}</ul>`
    : `<div class="empty">${S.data.analysis.symbols.length ? T(AN.noImpact) : T(AN.none)}</div>`;
  return `${list}${securityCard()}<p class="anmeta">${T(AN.meta)}${S.data.analysis.ms != null ? ` · ${S.data.analysis.ms} ms` : ""}</p>`;
}

function securityCard() {
  const a = S.data.analysis, pk = a.packages ?? [], sec = a.security ?? [];
  const pkgs = pk.length ? pk.map((p) => {
    const f = p.facts;
    if (p.change === "removed") return `<div class="pkg gone"><div class="pkgtop"><svg class="i"><use href="#i-pkg"/></svg><code>${esc(p.name)}@${esc(p.from)}</code><span class="badge">${T(AN.removed)}</span></div></div>`;
    const fine = f && PERMISSIVE.test(f.license ?? "") && (f.weeklyDownloads == null || f.weeklyDownloads >= 1000);
    const stamp = f ? `<span class="stampx ${fine ? "ok" : "unk"}"><svg class="i"><use href="#${fine ? "i-ok" : "i-unk"}"/></svg>${T(fine ? AN.pkgFine : AN.pkgCheck)}</span>` : "";
    return `<div class="pkg"><div class="pkgtop"><svg class="i"><use href="#i-pkg"/></svg><code>${esc(p.name)}@${esc(p.to)}</code>${p.change === "changed" ? `<span class="badge">${T(AN.changedV)}: ${esc(p.from)}</span>` : ""}${p.dev ? `<span class="badge">${T(AN.dev)}</span>` : ""}${stamp}</div>
      ${f ? `<dl><div><dt>${T(AN.pkgWhat)}</dt><dd>${esc(f.description ?? "?")}</dd></div><div><dt>${T(AN.pkgSize)}</dt><dd>${fmtSize(f.size)}</dd></div><div><dt>${T(AN.pkgLic)}</dt><dd>${esc(f.license ?? "?")}</dd></div><div><dt>${T(AN.pkgDl)}</dt><dd>${p.eco === "npm" ? fmtNum(f.weeklyDownloads) : "—"}</dd></div></dl>`
        : `<p class="muted" style="margin:8px 0 0;font-size:14px">${p.factsError ? `${T(AN.pkgFail)} ${esc(p.factsError)}` : code(T(AN.pkgOff))}</p>`}</div>`;
  }).join("") : `<p class="muted nopkg"><svg class="i"><use href="#i-pkg"/></svg>${T(AN.noPkg)}</p>`;
  const hasSecret = sec.some((x) => x.rule === "secret" || x.rule === "env-file");
  const checks = [
    ...sec.map((x) => `<li class="c-${x.severity === "high" ? "bad" : "warn"}"><span class="cic"><svg class="i"><use href="#t-impact"/></svg></span><div><b>${code(T(RULE[x.rule]?.t ?? x.rule))}</b><p>${code(T(RULE[x.rule]?.d ?? ""))}</p><code class="where">${esc(x.file)}${x.line ? `:${x.line}` : ""}${x.text ? `  ${esc(x.text)}` : ""}</code></div></li>`),
    hasSecret ? "" : `<li class="c-ok"><span class="cic"><svg class="i"><use href="#i-ok"/></svg></span><div><b>${T(AN.okSecret)}</b></div></li>`,
    sec.some((x) => x.rule !== "secret" && x.rule !== "env-file") ? "" : `<li class="c-ok"><span class="cic"><svg class="i"><use href="#i-ok"/></svg></span><div><b>${T(AN.okPatterns)}</b></div></li>`,
  ].join("");
  return `<h3 class="subhead">${T(AN.secHead)}</h3><section class="card seccard">${pkgs}<ul class="checks">${checks}</ul><p class="muted" style="font-size:13px;margin:12px 0 0">${T(AN.scanned)}</p></section>`;
}

/* ---------- guided lesson (Phase 7): steps, health, asks, claims, glossary ---------- */
const G = {
  steps: [{ hi: "Kya hua", en: "What happened" }, { hi: "Kya badla", en: "What changed" }, { hi: "Dhyan do", en: "Watch out" }, { hi: "Khud try karo", en: "Try it" }, { hi: "Ab kya karo", en: "To-do" }, { hi: "Quiz", en: "Quiz" }],
  back: { hi: "Peeche", en: "Back" }, next: { hi: "Aage", en: "Next" }, finish: { hi: "Lesson poora", en: "Finish lesson" }, doneMsg: { hi: "Shabaash! Ye lesson poora ho gaya.", en: "Nice! This lesson is done." },
  timelineChip: { hi: "Timeline pe", en: "On the timeline" }, backToLesson: { hi: "Lesson pe wapas", en: "Back to the lesson" },
  liveNow: { hi: "Abhi live", en: "Live now" }, lessonChip: { hi: "Lesson", en: "Lesson" },
  liveBeg: { hi: "AI abhi kaam kar raha hai. Neeche har kadam aate hi dikhega. Lesson prompt khatam hone ke baad banega.", en: "The AI is working. Each step appears below as it happens. The lesson is written once the prompt ends." },
  noLessonBeg: { hi: "Lesson banne tak neeche diff dekh sakte ho.", en: "Until the lesson is written, the diff is below." },
  claimsOk: { hi: "daawe record se match karte hain", en: "claims match the record" }, claimsMix: { hi: "daawe check kiye", en: "claims checked" },
  allClaims: { hi: "Saare daawe", en: "All claims" }, hideClaims: { hi: "Chhupao", en: "Hide" },
  badLine: { hi: "AI ne kaha", en: "The AI said" }, badBut: { hi: "par record mein iska saboot nahi hai.", en: "but the record has no evidence for it." },
  copyFix: { hi: "Fix prompt copy karo", en: "Copy fix prompt" },
  hOk: { hi: "Rakh sakte ho", en: "Safe to keep" }, hCheck: { hi: "Pehle check karo", en: "Check first" }, hRisk: { hi: "Risky", en: "Risky" }, hWip: { hi: "AI kaam kar raha hai", en: "AI is working" },
  decHead: { hi: "AI ne ye raasta kyun chuna", en: "Why the AI chose this way" }, chosen: { hi: "Chuna", en: "Chosen" }, notChosen: { hi: "Nahi chuna", en: "Not chosen" },
  errHead: { hi: "Raaste mein ek error aaya", en: "An error on the way" }, errSimple: { hi: "Simple bhaasha mein", en: "In plain words" }, errFix: { hi: "AI ne kya kiya", en: "What the AI did" },
  watchNone: { hi: "Teacher ko is badlaav se koi khatra nahi dikha.", en: "The teacher saw no risk in this change." },
  wiringHead: { hi: "Kaun kisse juda hai", en: "What connects to what" },
  conceptsHead: { hi: "Is lesson ke concepts", en: "Concepts in this lesson" },
};
const CLAIM_ST = { backed: ["ok", "i-ok"], unverified: ["unk", "i-unk"], none: ["bad", "i-bad"] };
const doneKey = () => `${S.session}/${S.turn}`;
const loadDone = () => { try { return JSON.parse(localStorage.getItem("vx-done") || "{}"); } catch { return {}; } };
S.done = loadDone();
S.step = Math.max(0, Math.min(5, Number(params.get("step")) || 0)); S.bView = null; S.claimsOpen = false;
if (["beg", "dev"].includes(params.get("level"))) S.level = params.get("level");

/* Glossary: everyday words built in, plus the lesson's own concepts (those win). */
const GLOSS = {
  "function": { hi: "Code ka ek naam wala tukda jo kaam karta hai; naam se bulao to chalta hai.", en: "A named piece of code that does a job; call it by name to run it." },
  "parameter": { hi: "Function ko di jaane wali value ka naam, jaise login(email) mein email.", en: "The name for a value a function receives, like email in login(email)." },
  "argument": { hi: "Function bulaate waqt di gayi asli value.", en: "The actual value you pass when calling a function." },
  "variable": { hi: "Ek naam wala dabba jisme value rakhte hain.", en: "A named box that holds a value." },
  "import": { hi: "Doosri file ya package se cheez apni file mein laana.", en: "Bringing something from another file or package into this one." },
  "export": { hi: "File ki cheez ko doosri files ke liye khula rakhna.", en: "Making something in a file available to other files." },
  "module": { hi: "Code ki ek file ya hissa jo apni cheezein export karta hai.", en: "A file or unit of code that exports things." },
  "async": { hi: "Aisa function jo kisi cheez ka intezaar kar sakta hai, jaise server ka jawab.", en: "A function that can wait for something, like a server reply." },
  "await": { hi: "Jawab aane tak yahin ruko, phir aage badho.", en: "Wait here for the reply, then carry on." },
  "promise": { hi: "Ek wada ki value baad mein aayegi (ya error).", en: "A promise that a value (or an error) will arrive later." },
  "test": { hi: "Chhota code jo check karta hai ki asli code sahi kaam karta hai.", en: "Small code that checks the real code works." },
  "tests": { hi: "Chhote programs jo check karte hain ki code sahi kaam karta hai.", en: "Small programs that check the code works." },
  "assert": { hi: "Test mein shart: ye sach hona chahiye, warna test fail.", en: "A check inside a test: this must be true, or the test fails." },
  "throw": { hi: "Error 'phenkna': kaam rok ke batana ki kuch galat hai.", en: "Raising an error: stop and say something is wrong." },
  "exception": { hi: "Chalte program mein aaya error jo pakda ja sakta hai.", en: "An error raised while running, which can be caught." },
  "try/catch": { hi: "Error aaye to program girne ke bajaye use pakad ke sambhaal lo.", en: "Catch an error and handle it instead of crashing." },
  "API": { hi: "Do programs ke beech baat karne ka tay tareeka.", en: "An agreed way for two programs to talk." },
  "request": { hi: "App ka server ko bheja gaya sandesh.", en: "A message the app sends to the server." },
  "response": { hi: "Server ka wapas bheja jawab.", en: "The server's reply." },
  "server": { hi: "Doosra computer jo app ki requests sunta hai aur jawab deta hai.", en: "Another computer that receives the app's requests and replies." },
  "endpoint": { hi: "Server ka ek address jahan request bhejte hain, jaise /api/login.", en: "A server address you send requests to, like /api/login." },
  "JSON": { hi: "Data likhne ka text format: { \"naam\": \"value\" }.", en: "A text format for data: { \"name\": \"value\" }." },
  "database": { hi: "Data ko pakka rakhne ki jagah.", en: "A place that stores data permanently." },
  "package": { hi: "Doosron ka likha code jo project mein install karke use karte hain.", en: "Code written by others that you install and use in your project." },
  "dependency": { hi: "Wo package jiske bina project nahi chalta.", en: "A package the project needs in order to run." },
  "diff": { hi: "Pehle aur ab ke code ka fark: + naya, − hataya.", en: "The difference between old and new code: + added, − removed." },
  "commit": { hi: "Git mein code ki ek save ki hui tasveer.", en: "A saved snapshot of the code in git." },
  "component": { hi: "UI ka ek tukda jise baar-baar use kar sakte ho.", en: "A reusable piece of UI." },
  "hook": { hi: "React mein dobara use hone wala logic ka tukda (naam 'use' se shuru).", en: "A reusable piece of React logic (its name starts with 'use')." },
  "route": { hi: "Ek address (jaise /reset) aur us pe khulne wala page.", en: "An address (like /reset) and the page it opens." },
  "string": { hi: "Text wali value, jaise \"hello\".", en: "A text value, like \"hello\"." },
  "array": { hi: "Values ki list, jaise [1, 2, 3].", en: "A list of values, like [1, 2, 3]." },
  "object": { hi: "Naam-value jodon ka dabba, jaise { id: 1 }.", en: "A box of name-value pairs, like { id: 1 }." },
  "class": { hi: "Ek saancha jisse milte-julte objects bante hain.", en: "A template for making similar objects." },
  "method": { hi: "Kisi object ya class ka function.", en: "A function that belongs to an object or class." },
  "callback": { hi: "Function jo doosre function ko diya jaata hai, baad mein chalne ke liye.", en: "A function handed to another function to run later." },
  "validation": { hi: "Check karna ki di gayi value sahi hai, jaise khaali na ho.", en: "Checking a value is acceptable, for example not empty." },
  "localStorage": { hi: "Browser ki chhoti tijori jisme data page band karne ke baad bhi rehta hai.", en: "The browser's small store that keeps data after the page closes." },
  "token": { hi: "Ek secret text jo batata hai ki tum kaun ho (login ke baad milta hai).", en: "A secret string that proves who you are (given after login)." },
  "regex": { hi: "Text mein pattern dhoondhne ka chhota formula.", en: "A short formula for finding patterns in text." },
  "lint": { hi: "Ek tool jo code ki galtiyan aur gandagi pakadta hai, chalaye bina.", en: "A tool that spots mistakes and mess in code without running it." },
  "status": { hi: "Server ke jawab ka number: 200 = theek, 401 = login galat, 500 = server mein gadbad.", en: "The reply's number: 200 = OK, 401 = bad login, 500 = server problem." },
  "npm": { hi: "JavaScript packages install karne ka tool.", en: "The tool that installs JavaScript packages." },
};
let glossCache = null;
function glossary() {
  const l = S.data?.lesson, key = `${doneKey()}/${S.lang}/${l?.createdAt ?? ""}`;
  if (glossCache?.key === key) return glossCache;
  const map = new Map();
  for (const [k, v] of Object.entries(GLOSS)) map.set(k.toLowerCase(), { word: k, def: T(v) });
  for (const c of l?.concepts ?? []) {
    const name = String(c.name ?? "").replace(/[`()]/g, "").trim();
    if (name && name.length <= 40 && !/\s{2,}/.test(name)) map.set(name.toLowerCase(), { word: name, def: String(c.explain ?? "").replace(/`/g, "") });
  }
  const words = [...map.values()].map((m) => m.word).sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"));
  glossCache = { key, map, re: words.length ? new RegExp(`(^|[^A-Za-z0-9_$/.-])(${words.join("|")})(?![A-Za-z0-9_$])`, "gi") : null };
  return glossCache;
}
/** Text with `code` spans and glossary terms (each term underlined once per call). */
function gl(text) {
  const { map, re } = glossary(); const seen = new Set();
  return String(text ?? "").split("`").map((p, i) => {
    if (i % 2) return `<code>${esc(p)}</code>`;
    const e = esc(p);
    if (!re) return e;
    return e.replace(re, (m, pre, w) => {
      const g = map.get(w.toLowerCase()); if (!g || seen.has(g.word.toLowerCase())) return m;
      seen.add(g.word.toLowerCase());
      return `${pre}<span class="term" tabindex="0" data-def="${esc(g.def)}">${w}</span>`;
    });
  }).join("");
}

/** The verdict at the top: from tests run, claims, impact and security, never from the AI's own words. */
function health() {
  const t = S.data.turn, l = S.data.lesson, a = S.data.analysis;
  if (t.status === "open") return { k: "wip", why: [{ hi: "Prompt khatam hone pe faisla aayega", en: "The verdict comes when the prompt ends" }] };
  const why = []; let k = "ok";
  const runs = S.data.events.filter((e) => e.kind === "tool_end" && /^(Bash|PowerShell)$/.test(e.tool) && /\b(test|tests|pytest|vitest|jest|mocha)\b/i.test(e.target ?? ""));
  const files = (t.files ?? []).length;
  if (runs.length) {
    if (runs.at(-1).ok === false) { why.push({ hi: "Aakhri test run fail hua", en: "The last test run failed" }); k = "check"; }
    else why.push({ hi: "Tests chale aur pass hue", en: "Tests ran and passed" });
  } else if (files) { why.push({ hi: "Is prompt mein koi test nahi chala", en: "No test ran in this prompt" }); k = "check"; }
  const none = (l?.claims ?? []).filter((c) => c.status === "none").length;
  if (none) { why.push({ hi: `${none} daawa bina saboot`, en: `${none} claim${none > 1 ? "s" : ""} without evidence` }); k = "check"; }
  const imp = l ? l.impact.map((m) => m.risk) : (a?.symbols ?? []).filter((s) => s.change !== "added").map((s) => s.risk);
  const risky = imp.filter((r) => r >= 2).length;
  if (risky) { why.push({ hi: `${risky} jagah risk (Beech ya zyada)`, en: `${risky} medium-or-higher risk${risky > 1 ? "s" : ""}` }); k = "check"; }
  const sec = (a?.security ?? []).length, high = (a?.security ?? []).filter((x) => x.severity === "high").length;
  if (sec) { why.push({ hi: `${sec} security baat dhyan dene layak`, en: `${sec} security note${sec > 1 ? "s" : ""}` }); if (high) k = "check"; }
  if (imp.some((r) => r >= 3) || high) k = "risk";
  if (k === "ok" && !why.length) why.push({ hi: "Koi risk ya adhoora daawa nahi", en: "No risks or open claims" });
  return { k, why };
}

function summaryCard() {
  const h = health(), asks = S.data.lesson?.asks ?? [];
  const hl = { ok: G.hOk, check: G.hCheck, risk: G.hRisk, wip: G.hWip }[h.k];
  const hic = { ok: "i-ok", check: "t-impact", risk: "i-bad", wip: "t-live" }[h.k];
  const aic = { done: "i-ok", part: "i-half", no: "i-bad" };
  return `<section class="summary ${asks.length ? "" : "solo"}">
    <div class="health h-${h.k}"><div class="hv"><svg class="i"><use href="#${hic}"/></svg>${T(hl)}</div><ul>${h.why.map((w) => `<li>${esc(T(w))}</li>`).join("")}</ul></div>
    ${asks.length ? `<div class="asks"><h4>${T(UI.asked)}</h4><ul>${asks.map((a) => `<li class="a-${esc(a.status)}"><span class="aic"><svg class="i"><use href="#${aic[a.status] ?? "i-unk"}"/></svg></span><div><b>${gl(a.text)}</b><small>${gl(a.evidence)}</small></div></li>`).join("")}</ul></div>` : ""}
  </section>`;
}

function claimFixPrompt(c) {
  return S.lang === "hi"
    ? `Tumne kaha: "${c.text}". Par record mein iska saboot nahi hai (${c.evidence}). Isko sach mein karke dikhao, ya bata do ki ye nahi hua.`
    : `You said: "${c.text}". The record has no evidence for it (${c.evidence}). Please actually do it and show the result, or say that it didn't happen.`;
}
function claimBanner() {
  const cl = S.data.lesson?.claims ?? []; if (!cl.length) return "";
  const n = { backed: 0, unverified: 0, none: 0 }; cl.forEach((c) => { n[c.status] = (n[c.status] ?? 0) + 1; });
  const bad = cl.find((c) => c.status === "none");
  const toggle = `<button class="ghost sm" id="claimsToggle">${S.claimsOpen ? T(G.hideClaims) : `${T(G.allClaims)} (${cl.length})`}</button>`;
  const pill = (k, cls, ic) => (n[k] ? `<span class="stampx ${cls}"><svg class="i"><use href="#${ic}"/></svg>${n[k]}</span>` : "");
  const counts = `<span class="cpills">${pill("backed", "ok", "i-ok")}${pill("unverified", "unk", "i-unk")}${pill("none", "bad", "i-bad")}</span>`;
  const html = bad
    ? `<div class="alert"><div class="alert-top"><span class="alert-ic"><svg class="i"><use href="#i-bad"/></svg></span>
        <p>${T(G.badLine)} <q>${esc(bad.text)}</q> ${T(G.badBut)} <span class="muted">${code(bad.evidence)}</span></p></div>
        <div class="alert-actions"><button class="ghost sm" data-copy="claimfix">${S.copied === "claimfix" ? `<svg class="i"><use href="#i-ok"/></svg>${T(UI.copied)}` : `<svg class="i"><use href="#i-copy"/></svg>${T(G.copyFix)}`}</button>${counts}${toggle}</div></div>`
    : `<div class="cbar ${n.unverified ? "mix" : "good"}"><svg class="i"><use href="#i-ok"/></svg><span><b>${n.backed}/${cl.length}</b> ${T(n.unverified ? G.claimsMix : G.claimsOk)}</span>${counts}${toggle}</div>`;
  return html + (S.claimsOpen ? findings() : "");
}
function findings() {
  return `<section class="findings"><div class="claimrow">${S.data.lesson.claims.map((c, i) => {
    const [cls, ic] = CLAIM_ST[c.status] ?? CLAIM_ST.unverified;
    return `<div class="claim ${esc(c.status)}"><span class="stampx ${cls}"><svg class="i"><use href="#${ic}"/></svg>${T(UI.st[c.status])}</span>
      <div><span class="k">${pad(i + 1)}</span><q>${esc(c.text)}</q></div>
      <div class="ev">${code(c.evidence)}${Number.isFinite(c.at) ? `<br><a data-jump="${c.at}">${T(UI.showTl)} → ${mmss(c.at)}</a>` : ""}</div></div>`;
  }).join("")}</div></section>`;
}

/* the steps */
function stepWhat() {
  const l = S.data.lesson;
  const errs = (l.errors ?? []).map((e) => `<section class="card errcard"><h5>${T(G.errHead)}</h5>
      <div class="errline"><code>${esc(e.command)}</code><span class="res-x">${S.lang === "hi" ? "fail" : "failed"}</span>${Number.isFinite(e.at) ? `<a data-jump="${e.at}">${T(UI.showTl)} → ${mmss(e.at)}</a>` : ""}</div>
      <div class="errbox"><b>${T(G.errSimple)}</b><p>${gl(e.simple)}</p><b>${T(G.errFix)}</b><p>${gl(e.fix)}</p></div></section>`).join("");
  const d = l.decision;
  return `<article class="lesson">
    <section class="card hero"><h5>${T(UI.lWhat)}</h5><p class="big">${code(l.title)}</p><p style="margin-top:8px">${gl(l.summary)}</p></section>
    <section class="card"><h5>${T(UI.lWhy)}</h5><p>${gl(l.why)}</p></section>
    ${l.how?.length ? `<section class="card"><h5>${T(UI.lHow)}</h5><div class="steps">${l.how.map((s, i) => `<p>${i + 1}. ${gl(s)}</p>`).join("")}</div></section>` : ""}
    <section class="card"><h5>${T(UI.lBA)}</h5><div class="ba"><div><b>${T(UI.before)}</b>${gl(l.before)}</div><div><b>${T(UI.after)}</b>${gl(l.after)}</div></div></section>
    ${d ? `<section class="card decision"><h5>${T(G.decHead)}</h5><p class="dq">${gl(d.question)}</p>
      <div class="dopts">${d.options.map((o) => `<div class="dopt ${o.chosen ? "pick" : ""}"><span class="dtag">${o.chosen ? `<svg class="i"><use href="#i-ok"/></svg>${T(G.chosen)}` : T(G.notChosen)}</span><b>${code(o.text)}</b><p>${gl(o.why)}</p></div>`).join("")}</div>
      ${d.quote ? `<p class="dquote">${code(d.quote)}</p>` : ""}</section>` : ""}
    ${errs}
  </article>`;
}
function lessonImpact() {
  const l = S.data.lesson;
  if (!l.impact.length) return `<div class="empty">${T(G.watchNone)}</div>`;
  return `<ul class="ilist">${l.impact.slice().sort((a, b) => b.risk - a.risk).map((m) => {
    const i = l.impact.indexOf(m);
    return `<li><div class="rlevel">${T(AN.risk[m.risk])}<span class="meter l${m.risk}"><i></i><i></i><i></i></span></div>
      <div><h5>${gl(m.title)}</h5>${m.where ? `<div class="where">${esc(m.where)}</div>` : ""}<div>${gl(m.why)}</div>${m.fix ? `<div class="fix"><b>${T(AN.todo)}</b> ${gl(m.fix)}</div>` : ""}
      ${m.prompt ? `<div class="fixprompt"><div class="fp-head"><svg class="i"><use href="#i-msg"/></svg>${T(AN.fix)}</div><p>${code(m.prompt)}</p>
        <button class="ghost sm" data-copy="li${i}">${S.copied === `li${i}` ? T(AN.copied) : `<svg class="i"><use href="#i-copy"/></svg>${T(AN.copy)}`}</button></div>` : ""}</div></li>`;
  }).join("")}</ul>`;
}
function stepWatch() {
  const a = S.data.analysis;
  return `<div class="watch">${lessonImpact()}${a && !a.error ? `${securityCard()}<h3 class="subhead">${T(G.wiringHead)}</h3>${wiring()}` : ""}</div>`;
}
function stepQuiz() {
  const l = S.data.lesson, qs = S.quiz[doneKey()] ?? {};
  const right = Object.entries(qs).filter(([i, v]) => l.quiz[i]?.answer === v).length;
  return `<article class="lesson">
    ${l.concepts?.length ? `<section class="card"><h5>${T(G.conceptsHead)}</h5><div class="concepts">${l.concepts.map((c) => `<details><summary><svg class="i"><use href="#i-chev"/></svg><code>${esc(c.name)}</code></summary><div>${gl(c.explain)}</div></details>`).join("")}</div></section>` : ""}
    ${l.quiz?.length ? `<section class="card quiz"><h5>${T(UI.quiz)}</h5>${l.quiz.map((q, i) => { const ans = qs[i]; return `<div class="q"><p>${i + 1}. ${code(q.q)}</p><div class="opts">${q.options.map((o, j) => `<button data-q="${i}" data-o="${j}" class="${ans == null ? "" : j === q.answer ? "right" : j === ans ? "wrong" : ""}" ${ans != null ? "disabled" : ""}>${code(o)}</button>`).join("")}</div>${ans != null ? `<div class="qexp">${gl(q.explain)}</div>` : ""}</div>`; }).join("")}
      <div class="score num">${S.lang === "hi" ? "Sahi" : "Correct"}: ${right} / ${l.quiz.length}</div></section>` : ""}
    ${explainBack()}
  </article>`;
}
const STEPS = [stepWhat, () => changes(), stepWatch, () => playView(), () => todoView(), stepQuiz];
const guided = () => S.level === "beg";
const lessonReady = () => S.data?.turn.status !== "open" && !!S.data?.lesson;

function stepperNav() {
  if (!lessonReady()) {
    const open = S.data.turn.status === "open";
    return `<div class="stepper"><button class="stepchip on" aria-current="step"><span class="sn"><svg class="i"><use href="#${open ? "t-live" : "t-seekho"}"/></svg></span><span>${T(open ? G.liveNow : G.lessonChip)}</span></button></div>`;
  }
  const done = !!S.done[doneKey()], last = STEPS.length - 1;
  const chips = G.steps.map((s, i) => {
    const st = S.bView ? "" : i === S.step ? "on" : i < S.step || done ? "done" : "";
    return `<button class="stepchip ${st}" data-step="${i}" ${st === "on" ? 'aria-current="step"' : ""}><span class="sn">${(i < S.step || done) && i !== S.step ? '<svg class="i"><use href="#i-ok"/></svg>' : i + 1}</span><span>${T(s)}</span></button>`;
  }).join("");
  return `<div class="stepper">${chips}${S.bView ? `<button class="stepchip on" aria-current="step"><span class="sn"><svg class="i"><use href="#t-live"/></svg></span><span>${T(G.timelineChip)}</span></button>` : ""}<span class="bar"><i style="width:${S.bView ? 0 : ((done ? last : S.step) / last) * 100}%"></i></span></div>`;
}
function guidedBody() {
  const t = S.data.turn;
  if (t.status === "open") return `<p class="hint">${T(G.liveBeg)}</p>${live()}`;
  if (!S.data.lesson) return `${learn()}<p class="hint" style="margin-top:22px">${T(G.noLessonBeg)}</p>${changes()}`;
  if (S.bView === "live") return `<button class="ghost" id="backLesson">← ${T(G.backToLesson)}</button><div style="margin-top:14px">${live()}</div>`;
  const last = S.step === STEPS.length - 1, done = !!S.done[doneKey()];
  return `${STEPS[S.step]()}
    <div class="stepnav">${S.step > 0 ? `<button class="ghost" data-go="${S.step - 1}">← ${T(G.back)}</button>` : "<span></span>"}
    ${last ? `<button class="primary" id="finishBtn">${done ? `<svg class="i"><use href="#i-ok"/></svg> ${T(G.doneMsg)}` : T(G.finish)}</button>` : `<button class="primary" data-go="${S.step + 1}">${T(G.next)}: ${T(G.steps[S.step + 1])} →</button>`}</div>`;
}

/* ---------- Phase 8: to-do, chat, ask a line, explain back, learning record, export ---------- */
const P8 = {
  todoHead: { hi: "Ab kya karo", en: "What to do next" }, todoDone: { hi: "ho gaye", en: "done" },
  todoNone: { hi: "Record mein kuch khula nahi hai. Bas neeche wala test khud karke dekh lo.", en: "Nothing open in the record. Just try the test below yourself." },
  todoWait: { hi: "To-do list prompt khatam hone pe banegi.", en: "The to-do list is made when the prompt ends." },
  todoFrom: { tests: { hi: "tests", en: "tests" }, claim: { hi: "AI ka daawa", en: "AI claim" }, check: { hi: "khud dekho", en: "check yourself" }, ask: { hi: "tumhari maang", en: "your ask" }, impact: { hi: "impact", en: "impact" }, security: { hi: "security", en: "security" } },
  copyFix: { hi: "Fix prompt copy karo", en: "Copy fix prompt" },
  chatBtn: { hi: "Session se poochho", en: "Ask this session" }, chatHead: { hi: "Is session ke baare mein poochho", en: "Ask about this session" },
  chatPh: { hi: "Jaise: login mein kya badla?", en: "e.g. what changed in login?" }, chatSend: { hi: "Bhejo", en: "Send" },
  chatNote: { hi: "Jawab tumhare apne `claude` se aata hai, sirf is session ke record se (lagbhag 20 second, thodi plan usage).", en: "Answers come from your own `claude`, using only this session's record (about 20 seconds, a little plan usage)." },
  chatThinking: { hi: "Teacher record padh raha hai…", en: "The teacher is reading the record…" },
  chatDemo: { hi: "Demo mein sawaal nahi poochh sakte: iske liye tool apne computer pe chalana hota hai.", en: "Questions don't work in the demo: they need the tool running on your computer." },
  chatQs: [
    { hi: "Is prompt mein kya badla?", en: "What changed in this prompt?" },
    { hi: "Isse kya toot sakta hai?", en: "What could this break?" },
    { hi: "Kya tests chale?", en: "Did the tests run?" },
    { hi: "Kya ye code safe hai?", en: "Is this code safe?" },
  ],
  askHint: { hi: "Kisi bhi line pe click karke poochho: ye kya hai?", en: "Click any line to ask: what is this?" },
  askQ: { hi: "Ye line kya karti hai?", en: "What does this line do?" },
  ebHead: { hi: "Apne shabdon mein samjhao", en: "Explain it in your own words" },
  ebPh: { hi: "Is prompt mein kya badla aur kyun? 2-3 line likho…", en: "What changed in this prompt, and why? Write 2-3 lines…" },
  ebBtn: { hi: "Check karo", en: "Check it" }, ebBusy: { hi: "Teacher check kar raha hai…", en: "The teacher is checking…" },
  ebV: { good: { hi: "Sahi samjhe!", en: "You got it!" }, partly: { hi: "Aadha sahi", en: "Partly right" }, off: { hi: "Dobara dekho", en: "Have another look" } },
  ebMissed: { hi: "Ye reh gaya:", en: "You left out:" },
  record: { hi: "Seekhne ka record aur export", en: "Learning record & export" },
  progHead: { hi: "Mera seekhne ka record", en: "My learning record" },
  progLede: { hi: "Har lesson ke concepts yahan jama hote hain. Quiz ke jawab se pata chalta hai kya pakka hua.", en: "Concepts from every lesson collect here. Your quiz answers decide what is solid." },
  fPrompts: { hi: "prompts", en: "prompts" }, fFiles: { hi: "files badli", en: "files changed" }, fFlags: { hi: "daawe bina saboot", en: "claims without evidence" }, fSolid: { hi: "concepts pakke", en: "concepts solid" },
  st: { solid: { hi: "Pakka", en: "Solid" }, weak: { hi: "Revision chahiye", en: "Needs revision" }, new: { hi: "Abhi quiz nahi diya", en: "No quiz yet" } },
  revise: { hi: "Revision quiz shuru karo", en: "Start a revision quiz" },
  noConcepts: { hi: "Abhi koi lesson nahi bana. Lesson banne ke baad concepts yahan aayenge.", en: "No lessons yet. Concepts appear here once lessons are written." },
  exportHead: { hi: "Export karo", en: "Export" },
  exportLede: { hi: "Is session ka tayyar text: PR mein daalo, commit karo, ya apne notes mein rakho. Ye record se banta hai, AI se nahi.", en: "Ready-made text from this session: paste it into a PR, a commit or your notes. It is built from the record, not by the AI." },
  ex: { pr: { hi: "PR description", en: "PR description" }, commit: { hi: "Commit message", en: "Commit message" }, note: { hi: "Aaj ka note", en: "Today's note" } },
};
const loadJ = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch { return {}; } };
const saveJ = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
S.todoDone = loadJ("vx-todo"); S.view = "turn"; S.chats = {}; S.chatOpen = false; S.chatBusy = false;
S.ask = null; S.askAns = {}; S.eb = {}; S.record = null; S.exp = null; S.expText = "";

function todoView() {
  const t = S.data.turn, items = S.data.todo ?? [];
  if (t.status === "open") return `<div class="empty">${T(P8.todoWait)}</div>`;
  const key = (it) => `${doneKey()}:${it.id}`;
  const done = items.filter((it) => S.todoDone[key(it)]).length;
  const m = S.data.lesson?.manualTest;
  return `<section class="card todo"><div class="todohead"><h5>${T(P8.todoHead)}</h5>${items.length ? `<span class="tcount num">${done}/${items.length} ${T(P8.todoDone)}</span>` : ""}</div>
    ${items.length ? `<span class="tbar"><i style="width:${(done / items.length) * 100}%"></i></span>` : ""}
    <ul class="tlist">${items.length ? items.map((it) => { const on = !!S.todoDone[key(it)], title = it.kind === "security" ? T(RULE[it.rule]?.t ?? it.rule) : T(it.t);
      return `<li class="${on ? "on" : ""}"><button class="tcheck" data-todo="${esc(key(it))}" aria-pressed="${on}" aria-label="${esc(title)}">${on ? '<svg class="i"><use href="#i-ok"/></svg>' : ""}</button>
        <div><span class="badge">${T(P8.todoFrom[it.kind])}</span><br><b>${gl(title)}</b>${it.d ? `<p>${code(T(it.d))}</p>` : ""}
        ${it.prompt ? `<button class="ghost sm" data-copy="td:${esc(it.id)}">${S.copied === `td:${it.id}` ? `<svg class="i"><use href="#i-ok"/></svg>${T(UI.copied)}` : `<svg class="i"><use href="#i-copy"/></svg>${T(P8.copyFix)}`}</button>` : ""}</div></li>`; }).join("")
      : `<li class="none">${T(P8.todoNone)}</li>`}</ul></section>
    ${m?.steps?.length ? `<section class="card manual" style="margin-top:14px"><h5>${T(UI.manual)}</h5><ol>${m.steps.map((s) => `<li>${gl(s)}</li>`).join("")}</ol><div class="expect"><b>${T(UI.expect)}</b><br>${gl(m.expect)}</div></section>` : ""}`;
}

/* explain it back (inside the Quiz step) */
function explainBack() {
  const e = S.eb[doneKey()] ?? {};
  return `<section class="card explain-back"><h5>${T(P8.ebHead)}</h5>
    ${STATIC ? `<p class="muted">${T(P8.chatDemo)}</p>` : `<textarea id="eb" placeholder="${esc(T(P8.ebPh))}">${esc(e.text ?? "")}</textarea>
    <button class="primary" id="ebBtn" ${e.busy || (e.text ?? "").trim().length < 10 ? "disabled" : ""}>${e.busy ? `<span class="spin"></span>${T(P8.ebBusy)}` : T(P8.ebBtn)}</button>
    ${e.res ? (e.res.ok ? `<div class="ebres ${esc(e.res.verdict)}"><b>${T(P8.ebV[e.res.verdict])}</b><p>${code(e.res.feedback)}</p>${e.res.missed?.length ? `<p><b>${T(P8.ebMissed)}</b></p><ul>${e.res.missed.map((x) => `<li>${code(x)}</li>`).join("")}</ul>` : ""}</div>` : `<p class="err">${esc(e.res.error)}</p>`) : ""}`}
  </section>`;
}

/* ask about a line of the diff */
function askBox(k) {
  const a = S.askAns[k];
  if (S.ask !== k || !a) return "";
  return `<div class="askans"><div class="askq"><svg class="i"><use href="#i-ask"/></svg><b>${T(P8.askQ)}</b></div>
    <p>${a.busy ? `<span class="spin dark"></span> ${T(P8.chatThinking)}` : a.error ? `<span class="err">${esc(a.error)}</span>` : code(a.text)}</p></div>`;
}
async function askLine(k, file, text) {
  if (S.ask === k) { S.ask = null; content(); return; }
  S.ask = k;
  if (!S.askAns[k] || S.askAns[k].error) {
    if (STATIC) S.askAns[k] = { error: T(P8.chatDemo) };
    else {
      S.askAns[k] = { busy: true }; content();
      try {
        const r = await api("/api/chat", { project: S.project, session: S.session }, "POST", { question: T(P8.askQ), lang: S.lang, turn: S.turn, line: { file, text } });
        S.askAns[k] = r.ok ? { text: r.answer } : { error: r.error };
      } catch (err) { S.askAns[k] = { error: String(err.message) }; }
    }
  }
  content();
}

/* chat */
function chatRender() {
  const fab = $("#chatFab"), p = $("#chatPanel");
  const show = !!S.data && S.view === "turn";
  fab.hidden = !show || S.chatOpen; p.hidden = !show || !S.chatOpen;
  fab.querySelector("span").textContent = T(P8.chatBtn);
  if (p.hidden) return;
  const log = S.chats[S.session] ?? [];
  p.innerHTML = `<div class="chathead"><b>${T(P8.chatHead)}</b><button class="iconbtn" id="chatClose" aria-label="Close"><svg class="i"><use href="#i-close"/></svg></button></div>
    <div class="chatlog" id="chatLog">${log.length ? log.map((m) => `<div class="msg ${m.who} ${m.err ? "err" : ""}">${m.who === "ai" ? code(m.t) : esc(m.t)}</div>`).join("") : `<p class="muted">${code(T(STATIC ? P8.chatDemo : P8.chatNote))}</p>`}
      ${S.chatBusy ? `<div class="msg ai"><span class="spin dark"></span> ${T(P8.chatThinking)}</div>` : ""}</div>
    ${STATIC ? "" : `<div class="chips">${P8.chatQs.map((c, i) => `<button class="chip" data-chatq="${i}" ${S.chatBusy ? "disabled" : ""}>${esc(T(c))}</button>`).join("")}</div>
    <form class="chatform" id="chatForm"><input id="chatIn" placeholder="${esc(T(P8.chatPh))}" aria-label="${esc(T(P8.chatPh))}" ${S.chatBusy ? "disabled" : ""}><button class="primary sm" type="submit" ${S.chatBusy ? "disabled" : ""}>${T(P8.chatSend)}</button></form>`}`;
  const el = $("#chatLog"); if (el) el.scrollTop = el.scrollHeight;
}
async function chatAsk(q) {
  if (S.chatBusy || STATIC) return;
  const sid = S.session, log = (S.chats[sid] ??= []);
  const history = log.filter((m) => !m.err).slice(-6);
  log.push({ who: "me", t: q }); S.chatBusy = true; chatRender();
  try {
    const r = await api("/api/chat", { project: S.project, session: sid }, "POST", { question: q, history, lang: S.lang, turn: S.turn });
    log.push(r.ok ? { who: "ai", t: r.answer } : { who: "ai", t: r.error, err: true });
  } catch (err) { log.push({ who: "ai", t: String(err.message), err: true }); }
  S.chatBusy = false; chatRender();
  setTimeout(() => $("#chatIn")?.focus(), 30);
}

/* learning record + export */
async function openRecord() {
  S.view = "record"; S.exp = null; S.expText = ""; all();
  try { S.record = await api("/api/record", { project: S.project }); } catch (err) { S.record = { error: String(err.message) }; }
  if (S.view === "record") content();
}
function recordView() {
  const r = S.record;
  if (!r) return `<div class="empty"><span class="spin dark"></span></div>`;
  if (r.error) return `<div class="empty">${esc(r.error)}</div>`;
  const f = r.facts, cs = r.concepts;
  const weak = cs.find((c) => c.status === "weak") ?? cs.find((c) => c.status === "new");
  return `<h1 class="prompt">${T(P8.progHead)}</h1><p class="lede muted">${T(P8.progLede)}</p>
    <div class="facts"><div><b>${f.prompts}</b><span>${T(P8.fPrompts)}</span></div><div><b>${f.files}</b><span>${T(P8.fFiles)}</span></div><div><b>${f.noEvidence}</b><span>${T(P8.fFlags)}</span></div><div><b>${f.solid}/${f.concepts}</b><span>${T(P8.fSolid)}</span></div></div>
    <section class="card prog">${cs.length ? `<div class="clist">${cs.map((c) => `<span class="cchip ${esc(c.status)}" title="${esc(c.explain)}"><code>${esc(c.name)}</code><span>${T(P8.st[c.status])}</span><small>${pad(c.turn)}</small></span>`).join("")}</div>
      ${weak && !STATIC ? `<button class="primary" data-revise="${esc(weak.sessionId)}/${weak.turn}"><svg class="i"><use href="#t-seekho"/></svg>${T(P8.revise)}</button>` : ""}` : `<p class="muted">${T(P8.noConcepts)}</p>`}</section>
    <h2 class="sechead">${T(P8.exportHead)}</h2><p class="muted">${T(P8.exportLede)}</p>
    <div class="exbtns">${["pr", "commit", "note"].map((k) => `<button class="${S.exp === k ? "primary" : "ghost"}" data-exp="${k}">${T(P8.ex[k])}</button>`).join("")}</div>
    ${S.exp ? `<div class="exbox"><pre>${esc(S.expText)}</pre><button class="primary sm" data-copy="exp">${S.copied === "exp" ? `<svg class="i"><use href="#i-ok"/></svg>${T(UI.copied)}` : `<svg class="i"><use href="#i-copy"/></svg>${T(UI.copy)}`}</button></div>` : ""}`;
}
async function showExport(kind) {
  if (S.exp === kind) { S.exp = null; content(); return; }
  S.exp = kind; S.expText = "…"; content();
  try { S.expText = (await api("/api/export", { project: S.project, session: S.session, kind, lang: S.lang })).text; } catch (err) { S.expText = String(err.message); }
  content();
}

UI.record = P8.record;

/* ---------- Phase 9: playground (sandbox edit, what-if, challenge, before/after preview) ---------- */
const PG = {
  safe: { hi: "Sandbox: ye ek alag copy hai, tumhara asli code nahi badlega.", en: "Sandbox: this is a separate copy; your real code does not change." },
  wait: { hi: "Playground prompt khatam hone pe khulega.", en: "The playground opens when the prompt ends." },
  demo: { hi: "Playground ke liye tool apne computer pe chalana hota hai: ye project ka code ek sandbox mein chalata hai.", en: "The playground needs the tool on your computer: it runs the project's code in a sandbox." },
  allowHead: { hi: "Pehle ijaazat", en: "Permission first" },
  allowLede: { hi: "Playground project ke apne commands (tests, lint) ek alag copy mein chalata hai. Ye AI ka likha code chalayega, isliye pehle tum dekh lo ki kaunse commands chalenge:", en: "The playground runs the project's own commands (tests, lint) in a separate copy. That runs the AI's code, so check which commands will run:" },
  allowBtn: { hi: "Is project ke liye sandbox runs allow karo", en: "Allow sandbox runs for this project" },
  noCmd: { hi: "Koi test command nahi mili. Upar likh sakte ho (jaise `npm test`), ya khaali chhodo: tab sirf teacher ki raay milegi.", en: "No test command found. Type one above (like `npm test`), or leave it empty: then you only get the teacher's take." },
  aHead: { hi: "1. Badal ke dekho", en: "1. Change it and see" },
  aLede: { hi: "AI ki likhi file badlo, phir sandbox mein chalao. Asli tests ka nateeja aur teacher ki raay milegi.", en: "Change a file the AI wrote, then run it in the sandbox. You get the real test result and the teacher's take." },
  pick: { hi: "Kaunsi file", en: "Which file" },
  run: { hi: "Sandbox mein chalao", en: "Run in sandbox" }, running: { hi: "Sandbox mein chal raha hai…", en: "Running in the sandbox…" },
  reset: { hi: "Wapas AI wala code", en: "Back to the AI's code" },
  raay: { hi: "Teacher ki raay", en: "Teacher's take" }, imp: { hi: "Isse kya affect hoga", en: "What this affects" },
  noRun: { hi: "Koi command nahi chali (is project ke liye koi test command set nahi hai).", en: "No command ran (no test command is set for this project)." },
  cmp: { hi: "AI ka version vs tumhara", en: "The AI's version vs yours" }, aiv: { hi: "AI ka", en: "AI's" }, mine: { hi: "Tumhara", en: "Yours" },
  apply: { hi: "Mere project mein lagao", en: "Apply to my project" }, toPrompt: { hi: "AI ko prompt bana ke do", en: "Turn into a prompt for the AI" }, discard: { hi: "Sirf seekhne ke liye tha", en: "Just for learning" },
  applyConfirm: { hi: "Ye badlaav tumhare asli project ki is file mein jaayega. Pakka?", en: "This change goes into this file of your real project. Sure?" }, yes: { hi: "Haan, lagao", en: "Yes, apply" }, no: { hi: "Ruko", en: "Wait" },
  applied: { hi: "Lag gaya. Tumhare project ki file badal gayi; git mein dikhega.", en: "Applied. The file in your project changed; git will show it." },
  discarded: { hi: "Sandbox saaf kar diya. Asli code waisa hi hai.", en: "Sandbox cleared. Your real code is untouched." },
  bHead: { hi: "2. Kya hoga agar…?", en: "2. What happens if…?" }, bLede: { hi: "Pehle andaaza lagao, phir sandbox mein asli nateeja dekho.", en: "Guess first, then see the real result in the sandbox." },
  make: { hi: "Sawaal aur challenge banwao", en: "Make the questions and challenge" }, making: { hi: "Teacher bana raha hai… (lagbhag 1 minute)", en: "The teacher is making them… (about a minute)" },
  makeNote: { hi: "Teacher tumhare apne `claude` se ye banata hai (thodi plan usage).", en: "The teacher makes these with your own `claude` (a little plan usage)." },
  check: { hi: "Sandbox mein chala ke dekho", en: "Run it in the sandbox" }, right: { hi: "Teacher ka andaaza bhi yahi tha!", en: "The teacher guessed the same!" }, wrong: { hi: "Teacher ne kuch aur socha tha", en: "The teacher expected something else" },
  change: { hi: "Badlaav", en: "The change" }, realOut: { hi: "Asli nateeja", en: "The real result" }, pass: { hi: "sab pass", en: "all passed" }, fail: { hi: "fail", en: "failed" },
  cHead: { hi: "3. Ab tum karo", en: "3. Your turn" }, cCheck: { hi: "Check karo", en: "Check" }, cHint: { hi: "Hint lo", en: "Get a hint" }, cSol: { hi: "Solution dikhao", en: "Show the solution" },
  cPass: { hi: "Shabaash! Tests pass ho gaye.", en: "Nice! The tests pass." }, cNot: { hi: "Abhi nahi", en: "Not yet" }, cNoTest: { hi: "Is challenge ke liye test nahi hai; teacher ka solution dekh ke milao.", en: "This challenge has no test; compare with the teacher's solution." },
  dHead: { hi: "4. Pehle vs ab, screen pe", en: "4. Before vs after, on screen" }, dLede: { hi: "Project ka page sandbox mein khulta hai. Click karke dekho.", en: "The project's page opens in a sandbox. Click around." },
  vBefore: { hi: "AI se pehle", en: "Before the AI" }, vAfter: { hi: "AI ke baad", en: "After the AI" }, vMine: { hi: "Tumhare edit ke baad", en: "After your edit" },
  vNone: { hi: "Pehle upar 'Badal ke dekho' mein apna version chalao.", en: "Run your version under 'Change it and see' first." },
};
const pgKey = () => doneKey();
S.pgs = {};
const pgState = () => (S.pgs[pgKey()] ??= { info: null, file: null, code: {}, orig: {}, run: null, running: false, act: null, pred: {}, predRes: {}, ch: { code: null, hints: 0, res: null, sol: false }, view: "after", busy: null, err: null });

function clientDiff(a, b) {
  const A = a.split("\n"), B = b.split("\n"), n = A.length, m = B.length;
  if (n * m > 2_000_000) return [...A.map((t) => ["-", t]), ...B.map((t) => ["+", t])];
  const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) { if (A[i] === B[j]) { out.push([" ", A[i]]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) out.push(["-", A[i++]]); else out.push(["+", B[j++]]); }
  while (i < n) out.push(["-", A[i++]]); while (j < m) out.push(["+", B[j++]]);
  // keep the changes with two lines around them
  const keep = new Set(); out.forEach(([s], k) => { if (s !== " ") for (let x = k - 2; x <= k + 2; x++) keep.add(x); });
  return out.filter((_, k) => keep.has(k));
}
const codeLines = (lines) => lines.map(([s, t]) => `<div class="${s === "+" ? "add" : s === "-" ? "del" : ""}"><span class="sg">${s === "+" ? "+" : s === "-" ? "−" : " "}</span><span>${esc(t) || " "}</span></div>`).join("");
/** The useful part of a command's output: on failure the lines that say what failed, else the last lines. */
function outputGist(r) {
  const lines = r.out.trim().split("\n");
  if (!r.ok) {
    const keyLines = lines.filter((l) => /^\s*(✖|✗|×|not ok|FAIL|FAILED|E\s|[A-Za-z]*Error\b|AssertionError|actual:|expected:|Expected|Received|\d+ (failed|failing))/.test(l) && !/^\s*✖ failing tests:/.test(l));
    if (keyLines.length) return [...new Set(keyLines)].slice(0, 12).join("\n");
  }
  return lines.slice(-12).join("\n");
}
const resultBlocks = (results) => results.length
  ? `<div class="pgchecks">${results.map((r) => `<div class="${r.ok ? "okc" : "badc"}"><b>${esc(r.name)} · <code>${esc(r.cmd)}</code> · ${r.timedOut ? "timeout" : r.ok ? T(PG.pass) : `${T(PG.fail)} (exit ${r.code})`}</b><pre>${esc(outputGist(r))}</pre><details><summary>${S.lang === "hi" ? "Poora output" : "Full output"}</summary><pre>${esc(r.out.trim())}</pre></details></div>`).join("")}</div>`
  : `<p class="note2">${T(PG.noRun)}</p>`;

async function pgLoad(force = false) {
  const st = pgState();
  if (st.info && !force) return;
  try {
    st.info = await api("/api/sandbox", { project: S.project, session: S.session, turn: S.turn });
    st.file ??= st.info.files.find((f) => /\.(?:[cm]?[jt]sx?|py|vue|svelte|html|css)$/i.test(f)) ?? st.info.files[0] ?? null;
    if (st.file) await pgFile(st.file);
    const c = st.info.playground?.challenge;
    if (c && st.ch.code == null) { await pgFile(c.file); st.ch.code = st.orig[c.file] ?? ""; }
  } catch (err) { st.err = String(err.message); }
  content();
}
async function pgFile(p) {
  const st = pgState();
  if (st.orig[p] != null) return;
  try { st.orig[p] = (await api("/api/file", { project: S.project, session: S.session, turn: S.turn, path: p })).text; } catch { st.orig[p] = ""; }
}
async function pgPost(pathname, body) {
  return api(pathname, { project: S.project, session: S.session, turn: S.turn }, "POST", body);
}

function playView() {
  const t = S.data.turn;
  if (t.status === "open") return `<div class="empty">${T(PG.wait)}</div>`;
  if (STATIC) return `<div class="empty">${T(PG.demo)}</div>`;
  const st = pgState();
  if (!st.info) { if (!st.err) pgLoad(); return st.err ? `<div class="empty">${esc(st.err)}</div>` : `<div class="empty"><span class="spin dark"></span></div>`; }
  const info = st.info, allowed = info.settings.allowed;
  const parts = [`<p class="sandbox big"><svg class="i"><use href="#i-shield"/></svg>${T(PG.safe)}</p>`];

  if (!allowed) {
    const d = info.detected;
    parts.push(`<section class="card pg pgallow"><h5>${T(PG.allowHead)}</h5><p class="muted">${T(PG.allowLede)}</p>
      <label>test <input id="cmdTest" value="${esc(d.test ?? "")}" placeholder="npm test"></label>
      <label>lint <input id="cmdLint" value="${esc(d.lint ?? "")}" placeholder="npm run lint"></label>
      ${!d.test ? `<p class="note2">${code(T(PG.noCmd))}</p>` : ""}
      <div class="pgactions"><button class="primary sm" id="pgAllow"><svg class="i"><use href="#i-ok"/></svg>${T(PG.allowBtn)}</button></div></section>`);
  }

  /* A: edit and see */
  if (st.file) {
    const ed = st.code[st.file] ?? st.orig[st.file] ?? "";
    const r = st.run && st.run.file === st.file ? st.run : null;
    const vk = { good: ["ok", "i-ok"], warn: ["unk", "t-impact"], bad: ["bad", "i-bad"] };
    let A = `<section class="card pg"><h5>${T(PG.aHead)}</h5><p class="muted">${T(PG.aLede)}</p>
      <div class="pgbar"><label>${T(PG.pick)} <select id="pgPick">${info.files.map((f) => `<option value="${esc(f)}" ${f === st.file ? "selected" : ""}>${esc(f)}</option>`).join("")}</select></label></div>
      <textarea class="editor" id="pgCode" spellcheck="false" aria-label="Code">${esc(ed)}</textarea>
      <div class="pgactions"><button class="primary sm" id="pgRun" ${st.running || !allowed ? "disabled" : ""}>${st.running === "edit" ? `<span class="spin"></span>${T(PG.running)}` : `<svg class="i"><use href="#i-run"/></svg>${T(PG.run)}`}</button>
        <button class="ghost sm" id="pgReset">${T(PG.reset)}</button></div>`;
    if (r) {
      const tk = r.take?.ok ? r.take : null;
      A += `<div class="pgres">${r.error ? `<p class="err">${esc(r.error)}</p>` : `
        ${tk ? `<div class="raay"><span class="stampx ${vk[tk.verdict][0]}"><svg class="i"><use href="#${vk[tk.verdict][1]}"/></svg>${T(PG.raay)}</span><p>${code(tk.take)}</p></div>` : r.take?.error ? `<p class="err">${esc(r.take.error)}</p>` : ""}
        ${resultBlocks(r.results)}
        ${tk?.affects ? `<p class="pgimp"><b>${T(PG.imp)}:</b> ${code(tk.affects)}</p>` : ""}
        ${r.diffLines.length ? `<div class="cmp"><b>${T(PG.cmp)}</b><div class="cmpgrid"><div><small>${T(PG.aiv)}</small><div class="code mini">${codeLines(r.diffLines.filter(([s]) => s !== "+"))}</div></div><div><small>${T(PG.mine)}</small><div class="code mini">${codeLines(r.diffLines.filter(([s]) => s !== "-"))}</div></div></div></div>
        <div class="pgactions">${st.act === "confirm" ? `<span class="confirm">${T(PG.applyConfirm)} <code>${esc(r.file)}</code></span><button class="primary sm" id="pgApplyYes">${T(PG.yes)}</button><button class="ghost sm" id="pgApplyNo">${T(PG.no)}</button>`
          : `<button class="primary sm" id="pgApply" ${st.act === "applied" ? "disabled" : ""}><svg class="i"><use href="#i-ok"/></svg>${T(PG.apply)}</button><button class="ghost sm" data-copy="pgprompt">${S.copied === "pgprompt" ? `<svg class="i"><use href="#i-ok"/></svg>${T(UI.copied)}` : `<svg class="i"><use href="#i-copy"/></svg>${T(PG.toPrompt)}`}</button><button class="ghost sm" id="pgDiscard">${T(PG.discard)}</button>`}</div>` : ""}
        ${st.act === "applied" ? `<p class="note2">${T(PG.applied)}</p>` : st.act === "discarded" ? `<p class="note2">${T(PG.discarded)}</p>` : st.act?.error ? `<p class="err">${esc(st.act.error)}</p>` : ""}`}</div>`;
    } else if (st.act === "discarded") A += `<p class="note2">${T(PG.discarded)}</p>`;
    parts.push(A + "</section>");
  }

  /* B + C need the teacher's playground.json */
  const p = info.playground;
  if (!p) {
    parts.push(`<section class="card pg"><h5>${T(PG.bHead)} · ${T(PG.cHead)}</h5><p class="muted">${code(T(PG.makeNote))}</p>
      ${st.err2 ? `<p class="err">${esc(st.err2)}</p>` : ""}<div class="pgactions"><button class="primary sm" id="pgMake" ${st.busy ? "disabled" : ""}>${st.busy === "make" ? `<span class="spin"></span>${T(PG.making)}` : `<svg class="i"><use href="#i-spark"/></svg>${T(PG.make)}`}</button></div></section>`);
  } else {
    if (p.whatIf?.length) parts.push(`<section class="card pg"><h5>${T(PG.bHead)}</h5><p class="muted">${T(PG.bLede)}</p>${p.whatIf.map((w, i) => {
      const pick = st.pred[i], res = st.predRes[i];
      return `<div class="pred"><p class="pq">${code(w.q)}</p>
        <div class="code mini">${codeLines([...w.find.replace(/\n$/, "").split("\n").map((l) => ["-", l]), ...(w.replace ? w.replace.replace(/\n$/, "").split("\n").map((l) => ["+", l]) : [])])}</div>
        <div class="opts">${w.options.map((o, j) => `<button data-pred="${i}:${j}" class="${res && !res.busy ? (j === w.answer ? "right" : j === pick ? "wrong" : "") : j === pick ? "picked" : ""}" ${res && !res.busy ? "disabled" : ""}>${code(o)}</button>`).join("")}</div>
        ${!res || res.busy ? `<button class="primary sm" data-predrun="${i}" ${pick == null || !allowed || st.running ? "disabled" : ""}>${res?.busy ? `<span class="spin"></span>${T(PG.running)}` : `<svg class="i"><use href="#i-run"/></svg>${T(PG.check)}`}</button>`
          : `<div class="predres ${pick === w.answer ? "good" : "meh"}"><b>${pick === w.answer ? T(PG.right) : T(PG.wrong)}</b><p>${code(w.explain)}</p><p><b>${T(PG.realOut)}:</b></p>${res.error ? `<p class="err">${esc(res.error)}</p>` : resultBlocks(res.results)}</div>`}</div>`;
    }).join("")}</section>`);
    const c = p.challenge;
    if (c) {
      const res = st.ch.res;
      parts.push(`<section class="card pg challenge"><h5>${T(PG.cHead)}</h5><p class="task">${code(c.task)} <code>${esc(c.file)}</code></p>
        <textarea class="editor" id="chCode" spellcheck="false" aria-label="Challenge code">${esc(st.ch.code ?? "")}</textarea>
        <div class="pgactions"><button class="primary sm" id="chCheck" ${!allowed || st.running ? "disabled" : ""}>${st.running === "challenge" ? `<span class="spin"></span>${T(PG.running)}` : `<svg class="i"><use href="#i-ok"/></svg>${T(PG.cCheck)}`}</button>
          ${st.ch.hints < (c.hints ?? []).length ? `<button class="ghost sm" id="chHint"><svg class="i"><use href="#i-unk"/></svg>${T(PG.cHint)} (${st.ch.hints}/${c.hints.length})</button>` : `<button class="ghost sm" id="chSol">${T(PG.cSol)}</button>`}</div>
        ${st.ch.hints ? `<ol class="hints">${c.hints.slice(0, st.ch.hints).map((h) => `<li>${code(h)}</li>`).join("")}</ol>` : ""}
        ${st.ch.sol ? `<div class="code mini">${codeLines(String(c.solution).split("\n").map((l) => [" ", l]))}</div>` : ""}
        ${res ? `<div class="predres ${res.ok ? "good" : "meh"}"><b>${res.ok ? T(PG.cPass) : T(PG.cNot)}</b>${c.test ? "" : `<p>${T(PG.cNoTest)}</p>`}${res.error ? `<p class="err">${esc(res.error)}</p>` : resultBlocks(res.results)}</div>` : ""}</section>`);
    }
  }

  /* D: preview, for projects with a static page */
  const pv = info.preview;
  if (pv.after || pv.before) {
    const v = st.view;
    const src = v === "before" ? (pv.before && `${info.before}/${pv.before}`) : v === "mine" ? (pv.mine && `${pv.mine}/${pv.after ?? pv.before}`) : (pv.after && `${info.commit}/${pv.after}`);
    parts.push(`<section class="card pg"><h5>${T(PG.dHead)}</h5><p class="muted">${T(PG.dLede)}</p>
      <div class="pvtabs">${[["before", PG.vBefore], ["after", PG.vAfter], ["mine", PG.vMine]].map(([k, l]) => `<button data-pvview="${k}" aria-pressed="${v === k}">${T(l)}</button>`).join("")}</div>
      <div class="browser"><div class="bbar"><i></i><i></i><i></i><span>${esc(src ? src.split("/").slice(1).join("/") : "")}</span></div>
      ${src ? `<iframe title="preview" sandbox="allow-scripts allow-forms" referrerpolicy="no-referrer" src="/preview/${esc(pv.token)}/${esc(S.project)}/${esc(src)}"></iframe>` : `<div class="bbody"><div class="pvempty">${T(PG.vNone)}</div></div>`}</div></section>`);
  }
  return `<div class="pgwrap">${parts.join("")}</div>`;
}

function pgPromptText() {
  const st = pgState(), r = st.run; if (!r) return "";
  const d = r.diffLines.filter(([s]) => s !== " ").map(([s, t]) => `${s === "+" ? "+ " : "- "}${t}`).join("\n");
  return `${S.lang === "hi" ? `Maine sandbox mein \`${r.file}\` mein ye badlaav try kiya. Isko project mein lagao, phir tests chalao:` : `I tried this change to \`${r.file}\` in a sandbox. Apply it to the project, then run the tests:`}\n\n${d}`;
}

async function pgClick(b) {
  const st = pgState();
  if (b.id === "pgAllow") {
    try { st.info.settings = await pgPost("/api/sandbox/allow", { commands: { test: $("#cmdTest").value, lint: $("#cmdLint").value } }); } catch (err) { st.err = String(err.message); }
    content(); return true;
  }
  if (b.id === "pgRun") {
    const file = st.file, text = $("#pgCode").value; st.code[file] = text;
    st.running = "edit"; st.act = null; content();
    try {
      const r = await pgPost("/api/sandbox/run", { kind: "edit", path: file, content: text, lang: S.lang });
      st.run = r.ok ? { ...r, file, diffLines: clientDiff(st.orig[file] ?? "", text) } : { file, error: r.error, diffLines: [] };
      if (r.id) st.info.preview.mine = r.id;
    } catch (err) { st.run = { file, error: String(err.message), diffLines: [] }; }
    st.running = false; content(); return true;
  }
  if (b.id === "pgReset") { delete st.code[st.file]; st.run = null; st.act = null; content(); return true; }
  if (b.id === "pgApply") { st.act = "confirm"; content(); return true; }
  if (b.id === "pgApplyNo") { st.act = null; content(); return true; }
  if (b.id === "pgApplyYes") {
    try { const r = await pgPost("/api/sandbox/apply", { path: st.run.file, content: st.code[st.run.file], confirm: true }); st.act = r.ok ? "applied" : { error: r.error }; }
    catch (err) { st.act = { error: String(err.message) }; }
    content(); return true;
  }
  if (b.id === "pgDiscard") {
    try { await pgPost("/api/sandbox/discard", {}); } catch { /* nothing kept */ }
    delete st.code[st.run.file]; st.run = null; st.act = "discarded"; st.info.preview.mine = null; content(); return true;
  }
  if (b.id === "pgMake") {
    st.busy = "make"; st.err2 = null; content();
    try { const r = await pgPost("/api/sandbox/playground", { lang: S.lang }); if (r.ok) { st.info = null; st.busy = null; await pgLoad(true); return true; } st.err2 = r.error; }
    catch (err) { st.err2 = String(err.message); }
    st.busy = null; content(); return true;
  }
  if (b.dataset.pred) { const [i, j] = b.dataset.pred.split(":").map(Number); st.pred[i] = j; content(); return true; }
  if (b.dataset.predrun) {
    const i = +b.dataset.predrun; st.predRes[i] = { busy: true }; st.running = "whatif"; content();
    try { const r = await pgPost("/api/sandbox/run", { kind: "whatif", index: i }); st.predRes[i] = r.ok ? r : { error: r.error }; } catch (err) { st.predRes[i] = { error: String(err.message) }; }
    st.running = false; content(); return true;
  }
  if (b.id === "chCheck") {
    st.ch.code = $("#chCode").value; st.running = "challenge"; content();
    try { const r = await pgPost("/api/sandbox/run", { kind: "challenge", content: st.ch.code }); st.ch.res = r.ok ? { ...r, ok: r.results.length > 0 && r.results.every((x) => x.ok) } : { ok: false, error: r.error }; }
    catch (err) { st.ch.res = { ok: false, error: String(err.message) }; }
    st.running = false; content(); return true;
  }
  if (b.id === "chHint") { st.ch.code = $("#chCode")?.value ?? st.ch.code; st.ch.hints++; content(); return true; }
  if (b.id === "chSol") { st.ch.code = $("#chCode")?.value ?? st.ch.code; st.ch.sol = true; content(); return true; }
  if (b.dataset.pvview) { st.view = b.dataset.pvview; content(); return true; }
  return false;
}


function learn() {
  const t = S.data.turn, l = S.data.lesson;
  if (!l) {
    if (t.status === "open") return `<div class="empty">${T(UI.waitTurn)}</div>`;
    if (STATIC) return `<div class="empty">${S.lang === "hi" ? "Is demo mein is prompt ka lesson nahi hai." : "This demo has no lesson for this prompt."}</div>`;
    if (t.status === "analysing" || t.teaching) return `<div class="card teachbox"><h5>${T(UI.teaching)}</h5><span class="spin dark"></span><p class="muted">${code(T(UI.teachNote))}</p></div>`;
    return `<div class="card teachbox"><h5>${T(UI.teachTitle)}</h5><p class="muted">${code(T(UI.teachNote))}</p>
      ${t.status === "failed" && t.lessonError ? `<p class="err">${T(UI.teachFail)} ${esc(t.lessonError)}</p>` : ""}
      <button class="primary" id="teachBtn"><svg class="i"><use href="#i-spark"/></svg>${t.status === "failed" ? T(UI.retry) : T(UI.teachBtn)}</button></div>`;
  }
  return `${stepWhat()}<h3 class="subhead">${T(UI.impact)}</h3>${lessonImpact()}<div style="margin-top:14px">${stepQuiz()}</div>
    <p class="muted" style="font-size:13px">${T(UI.lessonMeta)}: ${esc(l.teacher)} · ${esc(l.level)}/${esc(l.lang)} · ${esc(new Date(l.createdAt).toLocaleString())}</p>`;
}

function all() { labels(); pickers(); rail(); head(); strip(); nav(); content(); chatRender(); $("#recBtn").setAttribute("aria-current", S.view === "record"); }

/* ---------- data flow ---------- */
let stream = null;
async function loadProjects() {
  S.projects = await api("/api/projects");
  if (!S.projects.find((p) => p.id === S.project)) S.project = S.projects[0]?.id ?? null;
  if (S.project) await loadSessions();
}
async function loadSessions() {
  S.sessions = await api("/api/sessions", { project: S.project });
  if (!S.sessions.find((s) => s.id === S.session)) S.session = S.sessions.at(-1)?.id ?? null;
  if (S.session) await loadSession();
}
async function loadSession() {
  const r = await api("/api/session", { project: S.project, session: S.session });
  S.turns = r.turns;
  const asked = Number(params.get("turn"));
  S.turn = S.turns.find((t) => t.n === asked)?.n ?? S.turns.at(-1)?.n ?? null; S.follow = true;
  await loadTurn();
  openStream();
}
async function loadTurn() {
  if (!S.turn) { S.data = null; all(); return; }
  S.data = await api("/api/turn", { project: S.project, session: S.session, turn: S.turn });
  if (!STATIC && S.data?.quiz) S.quiz[`${S.session}/${S.turn}`] = { ...S.data.quiz };
  if (S.follow || S.cur > duration()) S.cur = duration();
  all();
}
function openStream() {
  if (stream) stream.close();
  if (params.get("nostream") === "1" || STATIC) return; // screenshots and the static demo
  const u = new URL("/api/stream", location.origin);
  u.searchParams.set("t", TOKEN); u.searchParams.set("project", S.project); u.searchParams.set("session", S.session);
  stream = new EventSource(u);
  stream.addEventListener("ev", (m) => {
    const e = JSON.parse(m.data);
    if (S.data && e.turn === S.turn && !S.data.events.some((x) => x.ts === e.ts && x.kind === e.kind && x.tool === e.tool)) {
      S.data.events.push(e);
      if (S.follow) S.cur = duration();
      head(); strip(); if (guided() ? S.data.turn.status === "open" || S.bView === "live" : S.tab === "live" || S.tab === "logs") content();
    }
  });
  stream.addEventListener("turns", async (m) => {
    const turns = JSON.parse(m.data);
    const newest = turns.at(-1)?.n;
    const jump = S.follow && newest && newest !== S.turn && S.turn === S.turns.at(-1)?.n;
    const mine = turns.find((t) => t.n === S.turn), old = S.turns.find((t) => t.n === S.turn);
    S.turns = turns; pickers(); rail();
    if (jump) { S.turn = newest; S.tab = "live"; await loadTurn(); }
    else if (mine && old && (mine.status !== old.status || !!mine.after !== !!old.after || mine.hasLesson !== old.hasLesson)) await loadTurn();
  });
}

/* ---------- events ---------- */
document.addEventListener("click", async (e) => {
  const line = e.target.closest("[data-ask]");
  if (line && !e.target.closest("button,a")) { await askLine(line.dataset.ask, line.dataset.path ?? "", line.querySelector("span:nth-child(3)")?.textContent ?? ""); return; }
  const b = e.target.closest("button,a"); if (!b) return;
  if (S.data && !STATIC && await pgClick(b)) return;
  if (b.id === "recBtn") { await openRecord(); return; }
  if (b.id === "chatFab") { S.chatOpen = true; chatRender(); setTimeout(() => $("#chatIn")?.focus(), 30); return; }
  if (b.id === "chatClose") { S.chatOpen = false; chatRender(); return; }
  if (b.dataset.chatq) { await chatAsk(T(P8.chatQs[+b.dataset.chatq])); return; }
  if (b.dataset.todo) { S.todoDone[b.dataset.todo] = !S.todoDone[b.dataset.todo]; if (!S.todoDone[b.dataset.todo]) delete S.todoDone[b.dataset.todo]; saveJ("vx-todo", S.todoDone); content(); return; }
  if (b.dataset.exp) { await showExport(b.dataset.exp); return; }
  if (b.dataset.revise) {
    const [sid, n] = b.dataset.revise.split("/");
    try { await api("/api/quiz", { project: S.project, session: sid, turn: n }, "POST", { reset: true }); } catch { /* the step still opens */ }
    S.view = "turn"; S.level = "beg"; S.step = 5; S.bView = null;
    if (sid !== S.session) { S.session = sid; S.sessions = await api("/api/sessions", { project: S.project }); const r = await api("/api/session", { project: S.project, session: sid }); S.turns = r.turns; openStream(); }
    S.turn = +n; S.follow = false; await loadTurn(); return;
  }
  if (b.id === "ebBtn") {
    const k = doneKey(), e2 = (S.eb[k] ??= {}); e2.busy = true; e2.res = null; content();
    try { e2.res = await api("/api/explain-back", { project: S.project, session: S.session, turn: S.turn }, "POST", { text: e2.text, lang: S.lang }); } catch (err) { e2.res = { ok: false, error: String(err.message) }; }
    e2.busy = false; content(); return;
  }
  if (b.dataset.lang) { S.lang = b.dataset.lang; save("vx-lang", S.lang); all(); }
  else if (b.dataset.level) { S.level = b.dataset.level; save("vx-level", S.level); S.bView = null; all(); }
  else if (b.dataset.step || b.dataset.go) { S.step = +(b.dataset.step ?? b.dataset.go); S.bView = null; nav(); content(); $("#nav").scrollIntoView({ block: "start", behavior: "smooth" }); }
  else if (b.id === "finishBtn") { S.done[doneKey()] = true; try { localStorage.setItem("vx-done", JSON.stringify(S.done)); } catch { /* private mode */ } nav(); content(); }
  else if (b.id === "claimsToggle") { S.claimsOpen = !S.claimsOpen; head(); }
  else if (b.id === "backLesson") { S.bView = null; nav(); content(); }
  else if (b.id === "themeBtn") { const r = document.documentElement; r.dataset.theme = r.dataset.theme === "dark" ? "light" : "dark"; save("vx-theme", r.dataset.theme); }
  else if (b.dataset.turn) { S.view = "turn"; S.ask = null; S.turn = +b.dataset.turn; S.follow = S.turn === S.turns.at(-1)?.n; S.file = 0; S.wireSel = null; S.step = 0; S.bView = null; S.claimsOpen = false; await loadTurn(); }
  else if (b.dataset.tab) { S.tab = b.dataset.tab; nav(); content(); }
  else if (b.dataset.file) { S.file = +b.dataset.file; content(); }
  else if (b.id === "tlToggle") { S.stripOpen = !S.stripOpen; strip(); }
  else if (b.id === "followBtn") { S.follow = true; S.cur = duration(); strip(); content(); }
  else if (b.dataset.jump) { S.cur = +b.dataset.jump; S.follow = false; S.stripOpen = true; if (guided()) S.bView = "live"; else S.tab = "live"; all(); }
  else if (b.dataset.q) {
    const qs = (S.quiz[`${S.session}/${S.turn}`] ??= {}); if (b.dataset.q in qs) return;
    qs[+b.dataset.q] = +b.dataset.o; content();
    if (!STATIC) api("/api/quiz", { project: S.project, session: S.session, turn: S.turn }, "POST", { question: +b.dataset.q, answer: +b.dataset.o }).catch(() => {});
  }
  else if (b.dataset.copy) {
    const k = b.dataset.copy, text = k === "pgprompt" ? pgPromptText() : k === "exp" ? S.expText : k.startsWith("td:") ? T((S.data.todo ?? []).find((it) => it.id === k.slice(3))?.prompt) : k === "claimfix" ? claimFixPrompt(S.data.lesson.claims.find((c) => c.status === "none")) : k.startsWith("an") ? impactItems()[+k.slice(2)]?.prompt : S.data.lesson.impact[+k.slice(2)]?.prompt;
    try { await navigator.clipboard.writeText(text ?? ""); } catch { /* clipboard blocked */ }
    S.copied = k; head(); content(); setTimeout(() => { S.copied = null; head(); content(); }, 1600);
  }
  else if (b.id === "teachBtn") {
    b.disabled = true;
    try { await api("/api/explain", { project: S.project, session: S.session, turn: S.turn, level: S.level, lang: S.lang }, "POST"); S.data.turn.teaching = true; content(); }
    catch { b.disabled = false; }
  }
});
function pickNode(e) {
  const g = e.target.closest?.("[data-node]"); if (!g) return;
  S.wireSel = S.wireSel === g.dataset.node ? null : g.dataset.node; content();
  if (S.wireSel) document.querySelector(`[data-node="${CSS.escape(S.wireSel)}"]`)?.focus();
}
document.addEventListener("click", (e) => { if (S.tab === "wiring") pickNode(e); });
document.addEventListener("keydown", (e) => { if (S.tab === "wiring" && (e.key === "Enter" || e.key === " ") && e.target.closest?.("[data-node]")) { e.preventDefault(); pickNode(e); } });
document.addEventListener("input", (e) => {
  if (e.target.id === "pgCode") pgState().code[pgState().file] = e.target.value;
  if (e.target.id === "chCode") pgState().ch.code = e.target.value;
  if (e.target.id === "eb") { const x = (S.eb[doneKey()] ??= {}); x.text = e.target.value; const btn = $("#ebBtn"); if (btn && !x.busy) btn.disabled = x.text.trim().length < 10; }
});
document.addEventListener("submit", (e) => {
  if (e.target.id === "chatForm") { e.preventDefault(); const v = $("#chatIn").value.trim(); if (v) chatAsk(v); }
});
document.addEventListener("keydown", (e) => {
  const line = e.target.closest?.("[data-ask]");
  if (line && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); line.click(); }
});
document.addEventListener("change", async (e) => {
  if (e.target.id === "pgPick") { const st = pgState(); st.file = e.target.value; await pgFile(st.file); content(); return; }
  if (e.target.id === "projectSel") { S.project = e.target.value; S.session = null; S.view = "turn"; await loadSessions(); }
  if (e.target.id === "sessionSel") { S.session = e.target.value; S.view = "turn"; await loadSession(); }
});
(function scrub() {
  const tr = $("#trace"); let drag = false;
  const set = (ev) => {
    if (!S.data) return;
    const r = tr.getBoundingClientRect(), dur = duration();
    S.cur = Math.max(0, Math.min(dur, ((ev.clientX - r.left) / r.width) * dur));
    S.follow = S.data.turn.status === "open" && S.cur >= dur - 0.5;
    if (guided()) { if (lessonReady() && S.bView !== "live") { S.bView = "live"; nav(); } }
    else if (S.tab !== "live" && S.tab !== "logs") { S.tab = "live"; nav(); }
    strip(); content();
  };
  tr.addEventListener("pointerdown", (ev) => { drag = true; tr.classList.add("drag"); tr.setPointerCapture(ev.pointerId); set(ev); });
  tr.addEventListener("pointermove", (ev) => { if (drag) set(ev); });
  tr.addEventListener("pointerup", () => { drag = false; tr.classList.remove("drag"); });
  tr.addEventListener("keydown", (ev) => {
    if (!S.data || (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight")) return;
    ev.preventDefault(); S.follow = false; S.cur = Math.max(0, Math.min(duration(), S.cur + (ev.key === "ArrowRight" ? 1 : -1))); strip(); content();
  });
})();
// keep a running turn's clock moving
setInterval(() => { if (S.data?.turn.status === "open") { if (S.follow) S.cur = duration(); head(); strip(); } }, 1000);

labels();
if (STATIC) {
  const tag = document.createElement("a");
  tag.className = "demotag"; tag.href = "https://github.com/ankitkumar9546/vibe-explainer";
  tag.textContent = S.lang === "hi" ? "Demo · asli recorded session" : "Demo · a real recorded session";
  document.querySelector(".mark").after(tag);
}
if (!TOKEN) content();
else loadProjects().then(all).catch((err) => { $("#content").innerHTML = `<div class="empty">${esc(String(err.message))}</div>`; });
