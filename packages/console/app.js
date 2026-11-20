// vibe-explainer console (Roadmap Phases 4 and 6): real data from the local server.
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
  lang: pref("vx-lang", STATIC ? "en" : "hi"), level: pref("vx-level", "beg"), tab: ["live", "logs", "changes", "wiring", "impact", "learn"].includes(params.get("tab")) ? params.get("tab") : "live",
  projects: [], project: params.get("project"), sessions: [], session: params.get("session"),
  turns: [], turn: null, data: null, cur: 0, follow: true, stripOpen: params.get("tl") === "open", file: 0, quiz: {}, copied: null, wireSel: null,
};

const UI = {
  project: { hi: "Project", en: "Project" }, session: { hi: "Session", en: "Session" },
  turnsHead: { hi: "Prompts (is session ke)", en: "Prompts in this session" },
  chSoch: { hi: "Soch", en: "Thinking" }, chRead: { hi: "Padha", en: "Read" }, chEdit: { hi: "Badla", en: "Edit" }, chRun: { hi: "Chalaya", en: "Run" },
  tabs: { live: { hi: "Live", en: "Live" }, logs: { hi: "Logs", en: "Logs" }, changes: { hi: "Changes", en: "Changes" }, wiring: { hi: "Wiring", en: "Wiring" }, impact: { hi: "Impact", en: "Impact" }, learn: { hi: "Seekho", en: "Learn" } },
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
async function api(pathname, q = {}, method = "GET") {
  if (STATIC) {
    DB ??= await (await fetch(STATIC)).json();
    const k = (...a) => a.join("/");
    switch (pathname) {
      case "/api/projects": return DB.projects;
      case "/api/sessions": return DB.sessions[q.project] ?? [];
      case "/api/session": return DB.session[k(q.project, q.session)];
      case "/api/turn": return structuredClone(DB.turn[k(q.project, q.session, q.turn)]);
      default: throw new Error("not available in the demo");
    }
  }
  const u = new URL(pathname, location.origin);
  u.searchParams.set("t", TOKEN);
  for (const [k, v] of Object.entries(q)) if (v != null) u.searchParams.set(k, v);
  const r = await fetch(u, { method });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
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
    return `<button class="turn" data-turn="${t.n}" aria-current="${t.n === S.turn}"><span class="n">${pad(t.n)}</span><span class="p">${esc(t.prompt)}</span><span class="meta">${meta}</span></button>`;
  }).join("");
}

function strip() {
  const sec = $("#strip");
  if (!S.data) { sec.hidden = true; return; }
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
  if (!S.data) { H.innerHTML = ""; return; }
  const t = S.data.turn, ev = S.data.events.filter((e) => e.kind === "tool_end").length;
  H.innerHTML = `<h1 class="prompt">${esc(t.prompt)}</h1>
    <div class="prompt-meta num">${t.status === "open" ? `<span class="livetag">● ${T(UI.now)}</span> · ` : ""}${ev} ${T(UI.steps)} · ${(t.files ?? []).length} ${T(UI.files)} · ${Math.round(duration())}${T(UI.sec)}</div>`;
}

function nav() {
  if (!S.data) { $("#nav").innerHTML = ""; return; }
  const tabs = ["live", "logs", "changes", "wiring", "impact", "learn"], ic = { live: "t-live", logs: "t-logs", changes: "t-changes", wiring: "t-wiring", impact: "t-impact", learn: "t-seekho" };
  $("#nav").innerHTML = `<div class="tabs" role="tablist">${tabs.map((k) => `<button role="tab" data-tab="${k}" aria-selected="${S.tab === k}"><svg class="i"><use href="#${ic[k]}"/></svg><span>${T(UI.tabs[k])}</span></button>`).join("")}</div>`;
}

function content() {
  const C = $("#content");
  if (!TOKEN) { C.innerHTML = `<div class="empty">${code(T(UI.noToken))}</div>`; return; }
  if (!S.projects.length) { C.innerHTML = `<div class="empty">${code(T(UI.noData))}</div>`; return; }
  if (!S.data) { C.innerHTML = `<div class="empty">${T(UI.noTurns)}</div>`; return; }
  C.innerHTML = `<div class="panel">${{ live, logs, changes, wiring, impact, learn }[S.tab]()}</div>`;
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
    <div class="diffwrap"><div>${f.binary ? `<div class="empty">binary</div>` : f.hunks.map((h) => `<div class="code"><div class="hh">${esc(h.head)}</div>${h.lines.map(([s, txt, n]) =>
      `<div class="${s === "+" ? "add" : s === "-" ? "del" : ""}"><span class="ln num">${s === "-" ? "" : n}</span><span class="sg">${s === " " ? " " : s === "-" ? "−" : "+"}</span><span>${esc(txt) || " "}</span></div>`).join("")}</div>`).join("")}</div>
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
  const qs = S.quiz[`${S.session}/${S.turn}`] ?? {};
  const ic = { done: "i-ok", part: "i-half", no: "i-bad", backed: "i-ok", unverified: "i-unk", none: "i-bad" };
  const P = (k) => `<span class="ic"><svg class="i"><use href="#${ic[k]}"/></svg></span>`;
  const rl = { 1: { hi: "Kam", en: "Low" }, 2: { hi: "Beech", en: "Medium" }, 3: { hi: "Zyada", en: "High" } };
  return `<article class="lesson">
    <section class="card hero"><h5>${T(UI.lWhat)}</h5><p class="big">${code(l.title)}</p><p class="muted" style="margin-top:8px">${code(l.summary)}</p></section>
    ${l.asks?.length ? `<section class="card"><h5>${T(UI.asked)}</h5><ul class="rows">${l.asks.map((a) => `<li class="s-${esc(a.status)}">${P(a.status)}<div><b>${code(a.text)}</b><small>${code(a.evidence)}</small></div></li>`).join("")}</ul></section>` : ""}
    ${l.claims?.length ? `<section class="card"><h5>${T(UI.claims)}</h5><ul class="rows">${l.claims.map((c) => `<li class="s-${esc(c.status)}">${P(c.status)}<div><b>${code(c.text)}</b><small>${T(UI.st[c.status])} · ${code(c.evidence)}${Number.isFinite(c.at) ? ` · <a data-jump="${c.at}">${T(UI.showTl)} → ${mmss(c.at)}</a>` : ""}</small></div></li>`).join("")}</ul></section>` : ""}
    <section class="card"><h5>${T(UI.lWhy)}</h5><p>${code(l.why)}</p></section>
    ${l.how?.length ? `<section class="card"><h5>${T(UI.lHow)}</h5><div class="steps">${l.how.map((s, i) => `<p>${i + 1}. ${code(s)}</p>`).join("")}</div></section>` : ""}
    <section class="card"><h5>${T(UI.lBA)}</h5><div class="ba"><div><b>${T(UI.before)}</b>${code(l.before)}</div><div><b>${T(UI.after)}</b>${code(l.after)}</div></div></section>
    ${l.decision ? `<section class="card"><h5>${T(UI.decision)}</h5><p><b>${code(l.decision.question)}</b></p><ul class="rows">${l.decision.options.map((o) => `<li class="s-${o.chosen ? "done" : "part"}">${P(o.chosen ? "done" : "part")}<div><b>${code(o.text)}</b><small>${code(o.why)}</small></div></li>`).join("")}</ul>${l.decision.quote ? `<p class="muted" style="margin-top:10px"><i>${code(l.decision.quote)}</i></p>` : ""}</section>` : ""}
    ${l.errors?.length ? `<section class="card"><h5>${T(UI.errors)}</h5><ul class="rows">${l.errors.map((e) => `<li class="s-none">${P("none")}<div><b><code>${esc(e.command)}</code></b><small>${code(e.simple)}</small><small>${code(e.fix)}</small></div></li>`).join("")}</ul></section>` : ""}
    ${l.impact?.length ? `<section class="card"><h5>${T(UI.impact)}</h5><ul class="rows impact">${l.impact.map((m, i) => `<li><div><b>${code(m.title)}<span class="meter l${m.risk}"><i></i><i></i><i></i></span> <small style="display:inline">${T(rl[m.risk])}</small></b><small><code>${esc(m.where)}</code></small><p>${code(m.why)}</p><p class="muted">${code(m.fix)}</p>
      ${m.prompt ? `<div class="fixprompt"><b style="color:var(--action)">${T(UI.fix)}</b><p>${esc(m.prompt)}</p><button class="ghost sm" data-copy="${i}">${S.copied === String(i) ? T(UI.copied) : `<svg class="i"><use href="#i-copy"/></svg>${T(UI.copy)}`}</button></div>` : ""}</div></li>`).join("")}</ul></section>` : ""}
    ${l.concepts?.length ? `<section class="card"><h5>${T(UI.concepts)}</h5><div class="concepts">${l.concepts.map((c) => `<details><summary><svg class="i"><use href="#i-chev"/></svg><code>${esc(c.name)}</code></summary><div>${code(c.explain)}</div></details>`).join("")}</div></section>` : ""}
    ${l.quiz?.length ? `<section class="card"><h5>${T(UI.quiz)}</h5>${l.quiz.map((q, i) => { const ans = qs[i]; return `<div class="q"><p>${i + 1}. ${code(q.q)}</p><div class="opts">${q.options.map((o, j) => `<button data-q="${i}" data-o="${j}" class="${ans == null ? "" : j === q.answer ? "right" : j === ans ? "wrong" : ""}" ${ans != null ? "disabled" : ""}>${code(o)}</button>`).join("")}</div>${ans != null ? `<div class="qexp">${code(q.explain)}</div>` : ""}</div>`; }).join("")}</section>` : ""}
    ${l.manualTest?.steps?.length ? `<section class="card manual"><h5>${T(UI.manual)}</h5><ol>${l.manualTest.steps.map((s) => `<li>${code(s)}</li>`).join("")}</ol><div class="expect"><b>${T(UI.expect)}</b><br>${code(l.manualTest.expect)}</div></section>` : ""}
    <p class="muted" style="font-size:13px">${T(UI.lessonMeta)}: ${esc(l.teacher)} · ${esc(l.level)}/${esc(l.lang)} · ${esc(new Date(l.createdAt).toLocaleString())}</p>
  </article>`;
}

function all() { labels(); pickers(); rail(); head(); strip(); nav(); content(); }

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
      head(); strip(); if (S.tab === "live" || S.tab === "logs") content();
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
  const b = e.target.closest("button,a"); if (!b) return;
  if (b.dataset.lang) { S.lang = b.dataset.lang; save("vx-lang", S.lang); all(); }
  else if (b.dataset.level) { S.level = b.dataset.level; save("vx-level", S.level); labels(); }
  else if (b.id === "themeBtn") { const r = document.documentElement; r.dataset.theme = r.dataset.theme === "dark" ? "light" : "dark"; save("vx-theme", r.dataset.theme); }
  else if (b.dataset.turn) { S.turn = +b.dataset.turn; S.follow = S.turn === S.turns.at(-1)?.n; S.file = 0; S.wireSel = null; await loadTurn(); }
  else if (b.dataset.tab) { S.tab = b.dataset.tab; nav(); content(); }
  else if (b.dataset.file) { S.file = +b.dataset.file; content(); }
  else if (b.id === "tlToggle") { S.stripOpen = !S.stripOpen; strip(); }
  else if (b.id === "followBtn") { S.follow = true; S.cur = duration(); strip(); content(); }
  else if (b.dataset.jump) { S.cur = +b.dataset.jump; S.follow = false; S.stripOpen = true; S.tab = "live"; all(); }
  else if (b.dataset.q) { (S.quiz[`${S.session}/${S.turn}`] ??= {})[+b.dataset.q] = +b.dataset.o; content(); }
  else if (b.dataset.copy) {
    const k = b.dataset.copy, text = k.startsWith("an") ? impactItems()[+k.slice(2)]?.prompt : S.data.lesson.impact[+k]?.prompt;
    try { await navigator.clipboard.writeText(text ?? ""); } catch { /* clipboard blocked */ }
    S.copied = k; content(); setTimeout(() => { S.copied = null; content(); }, 1600);
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
document.addEventListener("change", async (e) => {
  if (e.target.id === "projectSel") { S.project = e.target.value; S.session = null; await loadSessions(); }
  if (e.target.id === "sessionSel") { S.session = e.target.value; await loadSession(); }
});
(function scrub() {
  const tr = $("#trace"); let drag = false;
  const set = (ev) => {
    if (!S.data) return;
    const r = tr.getBoundingClientRect(), dur = duration();
    S.cur = Math.max(0, Math.min(dur, ((ev.clientX - r.left) / r.width) * dur));
    S.follow = S.data.turn.status === "open" && S.cur >= dur - 0.5;
    if (S.tab !== "live" && S.tab !== "logs") { S.tab = "live"; nav(); }
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
