// The analyzer (Roadmap Phase 6): which functions a turn changed, who calls them (impact and
// wiring), which packages came or went, and risky patterns in the added lines.
// It reads only the shadow repo's "before" and "after" snapshots, never the live project.
import fs from "node:fs";
import path from "node:path";
import { readJson, writeJson, FORMAT_VERSION } from "../store.js";
import { shadowGit } from "../snapshot.js";
import { findSymbols, enclosing, display, importsOf, callsIn, langOf } from "./symbols.js";
import { scanAdded, TESTY } from "./security.js";
import { diffPackages, enrichPackages, isManifest } from "./packages.js";

export const LIMITS = { files: 60, symbols: 30, callersPerSymbol: 40, callerFiles: 40, callees: 8 };
const CODE_GLOBS = ["*.js", "*.jsx", "*.mjs", "*.cjs", "*.ts", "*.tsx", "*.mts", "*.cts", "*.vue", "*.svelte", "*.py", "*.pyw"];
// Method names this common match half the project; only `.name(` counts for them.
const COMMON = new Set(["get", "set", "add", "run", "init", "render", "update", "delete", "remove", "create", "load", "save", "start", "stop", "close", "open", "send", "call", "apply", "bind", "toString", "map", "filter", "find", "push", "then", "main", "handle", "process", "parse", "test", "setup", "constructor", "__init__"]);

/** Unified diff → per file: added lines (new numbering) and deleted lines (old numbering). */
export function parsePatch(text) {
  const files = []; let f = null, oldN = 0, newN = 0;
  for (const line of String(text ?? "").split("\n")) {
    if (line.startsWith("diff --git ")) { f = { path: line.replace(/^diff --git a\/.* b\//, ""), added: [], deleted: [] }; files.push(f); continue; }
    if (!f) continue;
    if (line.startsWith("+++ b/")) { f.path = line.slice(6); continue; }
    if (line.startsWith("--- ") || line.startsWith("+++ ")) continue;
    if (line.startsWith("@@")) { const m = /@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(line); oldN = +m[1]; newN = +m[2]; continue; }
    if (line.startsWith("+")) f.added.push({ line: newN++, text: line.slice(1).replace(/\r$/, "") });
    else if (line.startsWith("-")) f.deleted.push(oldN++);
    else if (line.startsWith(" ")) { oldN++; newN++; }
  }
  return files;
}

function makeReader(home, projectId) {
  const cache = new Map();
  return (commit, file) => {
    const k = `${commit}:${file}`;
    if (!cache.has(k)) {
      let v = null;
      try { v = shadowGit(home, projectId, ["show", `${commit}:${file}`], { maxBuffer: 8 * 1024 * 1024 }); } catch { /* not in that snapshot */ }
      cache.set(k, v);
    }
    return cache.get(k);
  };
}

const keyOf = (s) => `${s.kind === "method" ? `${s.owner}.` : ""}${s.name}`;
const overlaps = (lines, a, b) => lines.some((n) => n >= a && n <= b);

function grepCallers(home, projectId, commit, sym) {
  let out = "";
  try {
    out = shadowGit(home, projectId, ["grep", "-n", "-w", "-I", "-F", "--null", "-e", sym.name, commit, "--", ...CODE_GLOBS]);
  } catch { return []; } // exit 1 = no match
  const hits = [];
  for (const row of out.split("\n")) {
    if (!row) continue;
    const [pfx, ln, ...rest] = row.split("\0");
    const file = pfx.slice(commit.length + 1), line = Number(ln), text = rest.join("\0");
    if (file === sym.file && line >= sym.start && line <= sym.start + 1) continue; // its own definition line
    if (/^\s*(\/\/|#|\*|\/\*)/.test(text)) continue; // comments
    const isImport = /^\s*(import\b|from\s+[\w.]+\s+import\b|export\s*\{[^}]*\}\s*from\b)|\brequire\s*\(/.test(text);
    const isCall = new RegExp(`(?:^|[^\\w$])${sym.name.replace(/\$/g, "\\$")}\\s*\\(`).test(text);
    const isDef = new RegExp(`\\b(?:function|def|class)\\s+${sym.name.replace(/\$/g, "\\$")}\\b`).test(text);
    if (isDef) continue;
    if ((sym.kind === "method" || COMMON.has(sym.name)) && !new RegExp(`\\.${sym.name}\\s*\\(`).test(text) && !isImport) continue;
    hits.push({ file, line, text: text.trim().slice(0, 160), kind: isImport ? "import" : isCall ? "call" : "mention" });
    if (hits.length >= LIMITS.callersPerSymbol) break;
  }
  return hits;
}

function riskOf(s) {
  const reasons = [];
  const others = s.callers.filter((c) => c.kind !== "import");
  const used = others.length > 0;
  let risk = 1;
  if (s.change === "added") reasons.push("new");
  if (s.change === "removed") {
    if (used) { risk = 3; reasons.push("removed-still-used"); } else reasons.push("removed-unused");
  }
  if (s.change === "modified") {
    if (used) { risk = 2; reasons.push("used-elsewhere"); }
    if (s.signatureChanged) { reasons.push("signature-changed"); if (used) risk = s.tested ? 2 : 3; }
    if (others.length >= 5) { reasons.push("many-callers"); if (!s.tested) risk = 3; }
  }
  if (s.exported && s.change !== "added") reasons.push("exported");
  if (s.change !== "added" && used) reasons.push(s.tested ? "tested" : "no-tests");
  return { risk, reasons };
}

/**
 * Analyse one finished turn. Synchronous and offline: package facts are added by ensureAnalysis.
 * @returns {object|null} the analysis, or null when the turn has no before/after snapshots
 */
export function analyzeTurn(store, { projectId, sessionId, turn }, { now = () => new Date().toISOString() } = {}) {
  const t0 = Date.now();
  const tdir = store.turnDir(projectId, sessionId, turn);
  const t = readJson(path.join(tdir, "turn.json"));
  if (!t?.after?.commit || !t?.before?.commit) return null;
  const A = t.before.commit, B = t.after.commit, home = store.home;
  const read = makeReader(home, projectId);
  let patch = ""; try { patch = fs.readFileSync(path.join(tdir, "diff.patch"), "utf8"); } catch { /* empty turn */ }
  const parsed = new Map(parsePatch(patch).map((f) => [f.path, f]));
  const files = (t.files ?? []).slice(0, LIMITS.files);
  const limits = { filesCut: (t.files ?? []).length > LIMITS.files };

  // 1. symbols that were added, modified or removed
  const symbols = [];
  for (const f of files) {
    if (!langOf(f.path)) continue;
    const before = f.status === "added" ? null : read(A, f.oldPath ?? f.path);
    const after = f.status === "deleted" ? null : read(B, f.path);
    const p = parsed.get(f.path) ?? { added: [], deleted: [] };
    const addedLines = p.added.map((a) => a.line);
    const sa = findSymbols(f.path, before), sb = findSymbols(f.path, after);
    const mapA = new Map(sa.map((s) => [keyOf(s), s])), mapB = new Map(sb.map((s) => [keyOf(s), s]));
    const touched = [];
    for (const s of sb) {
      const old = mapA.get(keyOf(s));
      if (!old) touched.push({ ...s, change: "added" });
      else if (overlaps(addedLines, s.start, s.end) || overlaps(p.deleted, old.start, old.end)) {
        touched.push({ ...s, change: "modified", signatureChanged: old.params !== s.params, paramsBefore: old.params });
      }
    }
    for (const s of sa) if (!mapB.has(keyOf(s))) touched.push({ ...s, change: "removed" });
    // A class whose change is inside one of its methods: report the method, not the whole class.
    for (const s of touched) {
      if (s.kind === "class" && s.change === "modified" && touched.some((m) => m.kind === "method" && m.owner === s.name)) continue;
      symbols.push({ file: f.path, ...s });
    }
  }
  limits.symbolsCut = symbols.length > LIMITS.symbols;
  const chosen = symbols
    .sort((a, b) => ({ removed: 0, modified: 1, added: 2 }[a.change] - { removed: 0, modified: 1, added: 2 }[b.change]))
    .slice(0, LIMITS.symbols);

  // 2. callers (impact) and callees (wiring), from the "after" snapshot
  const fileSyms = new Map();
  const symsOf = (file) => {
    if (!fileSyms.has(file)) fileSyms.set(file, fileSyms.size < LIMITS.callerFiles ? findSymbols(file, read(B, file)) : []);
    return fileSyms.get(file);
  };
  const changedTests = files.filter((f) => TESTY.test(f.path) && f.status !== "deleted");
  for (const s of chosen) {
    s.callers = grepCallers(home, projectId, B, s).map((c) => {
      const enc = enclosing(symsOf(c.file), c.line);
      return { ...c, in: enc ? display(enc) : null };
    }).filter((c) => !(c.file === s.file && c.in === display(s))); // recursion is not a caller
    s.tested = s.callers.some((c) => TESTY.test(c.file)) || changedTests.some((f) => (read(B, f.path) ?? "").includes(s.name));
    if (s.change !== "removed") {
      const src = read(B, s.file) ?? "";
      const known = new Set([...symsOf(s.file).map((x) => x.name)]);
      const imports = importsOf(s.file, src);
      s.calls = callsIn(src, s.start, s.end).filter((n) => n !== s.name && (known.has(n) || n in imports))
        .slice(0, LIMITS.callees).map((n) => ({ name: n, from: imports[n] ?? null }));
    } else s.calls = [];
    Object.assign(s, riskOf(s));
  }

  // 3. packages
  const manifests = files.filter((f) => isManifest(f.path)).map((f) => ({
    path: f.path, before: f.status === "added" ? null : read(A, f.oldPath ?? f.path), after: f.status === "deleted" ? null : read(B, f.path),
  }));
  const packages = diffPackages(manifests);

  // 4. security patterns in added lines
  const security = scanAdded([...parsed.values()].map((f) => ({ path: f.path, lang: langOf(f.path), added: f.added })), files);

  return {
    v: FORMAT_VERSION, createdAt: now(), after: B, ms: Date.now() - t0,
    symbols: chosen.map(({ file, name, kind, owner, change, start, end, params, paramsBefore, signatureChanged, exported, callers, calls, tested, risk, reasons }) =>
      ({ file, name, kind, owner, change, start, end, params, paramsBefore: signatureChanged ? paramsBefore : undefined, signatureChanged: !!signatureChanged, exported, tested, risk, reasons, callers, calls })),
    packages, security, limits,
  };
}

/**
 * Read analysis.json, (re)computing it when missing or stale, and filling package facts when online.
 * @param {{online?: boolean, fetchFn?: Function}} opts
 */
export async function ensureAnalysis(store, ids, { online = false, fetchFn, now } = {}) {
  const tdir = store.turnDir(ids.projectId, ids.sessionId, ids.turn);
  const t = readJson(path.join(tdir, "turn.json"));
  if (!t?.after?.commit) return null;
  const file = path.join(tdir, "analysis.json");
  let a = readJson(file);
  let dirty = false;
  if (!a || a.after !== t.after.commit) {
    try { a = analyzeTurn(store, ids, now ? { now } : {}); } catch (err) { a = { v: FORMAT_VERSION, after: t.after.commit, error: String(err.message ?? err), symbols: [], packages: [], security: [] }; }
    if (!a) return null;
    dirty = true;
  }
  if (online && a.packages?.some((p) => p.change !== "removed" && !p.facts && !p.factsError)) {
    await enrichPackages(a.packages, fetchFn ? { fetchFn } : {});
    dirty = true;
  }
  if (dirty) writeJson(file, a);
  return a;
}

/** A short plain-text summary of the analysis for the teacher's prompt. */
export function analysisText(a) {
  if (!a) return "";
  const lines = [];
  for (const s of a.symbols ?? []) {
    const users = s.callers.filter((c) => c.kind !== "import");
    lines.push(`${s.change} ${s.kind} ${display(s)} in ${s.file}:${s.start}` +
      (s.signatureChanged ? ` (parameters were "${s.paramsBefore ?? ""}", now "${s.params ?? ""}")` : "") +
      ` | risk ${s.risk} (${s.reasons.join(", ")})` +
      (users.length ? ` | used by: ${users.slice(0, 8).map((c) => `${c.file}:${c.line}${c.in ? ` in ${c.in}` : ""}`).join("; ")}${users.length > 8 ? ` and ${users.length - 8} more` : ""}` : " | no other code uses it"));
  }
  for (const p of a.packages ?? []) {
    const f = p.facts;
    lines.push(`package ${p.change}: ${p.name} (${p.eco}${p.dev ? ", dev" : ""}) ${p.from ?? ""}${p.from && p.to ? " -> " : ""}${p.to ?? ""}` +
      (f ? ` | licence ${f.license ?? "unknown"}, size ${f.size ?? "?"} bytes, ${f.weeklyDownloads ?? "?"} downloads/week` : ""));
  }
  for (const s of a.security ?? []) lines.push(`security ${s.severity}: ${s.rule} at ${s.file}${s.line ? `:${s.line}` : ""}${s.text ? ` | ${s.text}` : ""}`);
  return lines.join("\n");
}
