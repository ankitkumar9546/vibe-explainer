// vibe-explainer console (Roadmap Phase 4): real data from the local server.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const code = (s) => String(s ?? "").split("`").map((p, i) => (i % 2 ? `<code>${esc(p)}</code>` : esc(p))).join("");
const pad = (n) => String(n).padStart(2, "0");
const mmss = (s) => `${pad(Math.floor(Math.max(0, s) / 60))}:${pad(Math.round(Math.max(0, s)) % 60)}`;

const params = new URLSearchParams(location.search);
const TOKEN = params.get("t") || "";
const pref = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

const S = {
  lang: pref("vx-lang", "hi"), level: pref("vx-level", "beg"), tab: ["live", "logs", "changes", "learn"].includes(params.get("tab")) ? params.get("tab") : "live",
  projects: [], project: params.get("project"), sessions: [], session: params.get("session"),
  turns: [], turn: null, data: null, cur: 0, follow: true, stripOpen: false, file: 0, quiz: {}, copied: null,
};

const UI = {
  project: { hi: "Project", en: "Project" }, session: { hi: "Session", en: "Session" },
  turnsHead: { hi: "Prompts (is session ke)", en: "Prompts in this session" },
  chSoch: { hi: "Soch", en: "Thinking" }, chRead: { hi: "Padha", en: "Read" }, chEdit: { hi: "Badla", en: "Edit" }, chRun: { hi: "Chalaya", en: "Run" },
  tabs: { live: { hi: "Live", en: "Live" }, logs: { hi: "Logs", en: "Logs" }, changes: { hi: "Changes", en: "Changes" }, learn: { hi: "Seekho", en: "Learn" } },
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
async function api(pathname, q = {}, method = "GET") {
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
  const tabs = ["live", "logs", "changes", "learn"], ic = { live: "t-live", logs: "t-logs", changes: "t-changes", learn: "t-seekho" };
  $("#nav").innerHTML = `<div class="tabs" role="tablist">${tabs.map((k) => `<button role="tab" data-tab="${k}" aria-selected="${S.tab === k}"><svg class="i"><use href="#${ic[k]}"/></svg><span>${T(UI.tabs[k])}</span></button>`).join("")}</div>`;
}

function content() {
  const C = $("#content");
  if (!TOKEN) { C.innerHTML = `<div class="empty">${code(T(UI.noToken))}</div>`; return; }
  if (!S.projects.length) { C.innerHTML = `<div class="empty">${code(T(UI.noData))}</div>`; return; }
  if (!S.data) { C.innerHTML = `<div class="empty">${T(UI.noTurns)}</div>`; return; }
  C.innerHTML = `<div class="panel">${{ live, logs, changes, learn }[S.tab]()}</div>`;
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

function learn() {
  const t = S.data.turn, l = S.data.lesson;
  if (!l) {
    if (t.status === "open") return `<div class="empty">${T(UI.waitTurn)}</div>`;
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
      ${m.prompt ? `<div class="fixprompt"><b style="color:var(--action)">${T(UI.fix)}</b><p>${esc(m.prompt)}</p><button class="ghost sm" data-copy="${i}">${S.copied === i ? T(UI.copied) : `<svg class="i"><use href="#i-copy"/></svg>${T(UI.copy)}`}</button></div>` : ""}</div></li>`).join("")}</ul></section>` : ""}
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
  S.turn = S.turns.at(-1)?.n ?? null; S.follow = true;
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
  if (params.get("nostream") === "1") return; // for screenshots and static captures
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
  else if (b.dataset.turn) { S.turn = +b.dataset.turn; S.follow = S.turn === S.turns.at(-1)?.n; S.file = 0; await loadTurn(); }
  else if (b.dataset.tab) { S.tab = b.dataset.tab; nav(); content(); }
  else if (b.dataset.file) { S.file = +b.dataset.file; content(); }
  else if (b.id === "tlToggle") { S.stripOpen = !S.stripOpen; strip(); }
  else if (b.id === "followBtn") { S.follow = true; S.cur = duration(); strip(); content(); }
  else if (b.dataset.jump) { S.cur = +b.dataset.jump; S.follow = false; S.stripOpen = true; S.tab = "live"; all(); }
  else if (b.dataset.q) { (S.quiz[`${S.session}/${S.turn}`] ??= {})[+b.dataset.q] = +b.dataset.o; content(); }
  else if (b.dataset.copy) {
    const m = S.data.lesson.impact[+b.dataset.copy];
    try { await navigator.clipboard.writeText(m.prompt); } catch { /* clipboard blocked */ }
    S.copied = +b.dataset.copy; content(); setTimeout(() => { S.copied = null; content(); }, 1600);
  }
  else if (b.id === "teachBtn") {
    b.disabled = true;
    try { await api("/api/explain", { project: S.project, session: S.session, turn: S.turn, level: S.level, lang: S.lang }, "POST"); S.data.turn.teaching = true; content(); }
    catch { b.disabled = false; }
  }
});
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
if (!TOKEN) content();
else loadProjects().then(all).catch((err) => { $("#content").innerHTML = `<div class="empty">${esc(String(err.message))}</div>`; });
