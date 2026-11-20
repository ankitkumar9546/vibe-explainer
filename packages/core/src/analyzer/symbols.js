// Find functions, classes and methods in a source file, with their line ranges (Roadmap Phase 6).
// No parser dependency: a small scanner for JS/TS and Python is enough to map diff lines to
// symbols and to find callers. It errs on the side of "unknown" rather than wrong.

export const LANGS = {
  js: /\.(?:[cm]?jsx?|tsx?|mts|cts|vue|svelte)$/i,
  py: /\.pyw?$/i,
};

export function langOf(file) {
  for (const [k, re] of Object.entries(LANGS)) if (re.test(file)) return k;
  return null;
}

const KEYWORDS = new Set(["if", "for", "while", "switch", "catch", "function", "return", "with", "else", "do", "try", "new", "typeof", "await", "super", "constructor"]);
const ID = "[A-Za-z_$][\\w$]*";

/** Index of the char after the brace that closes the one at `open` (string/comment aware). */
function matchBrace(src, open) {
  let depth = 0;
  const stack = []; // template literal nesting: depth at which a `${` started
  for (let i = open; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (c === "/" && n === "/") { i = src.indexOf("\n", i); if (i < 0) return src.length; continue; }
    if (c === "/" && n === "*") { i = src.indexOf("*/", i + 2); if (i < 0) return src.length; i++; continue; }
    if (c === "'" || c === "\"") { for (i++; i < src.length && src[i] !== c && src[i] !== "\n"; i++) if (src[i] === "\\") i++; continue; }
    if (c === "`") {
      for (i++; i < src.length; i++) {
        if (src[i] === "\\") { i++; continue; }
        if (src[i] === "`") break;
        if (src[i] === "$" && src[i + 1] === "{") { stack.push(depth); depth++; i++; break; }
      }
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (stack.length && depth === stack.at(-1)) {
        stack.pop(); // back inside a template literal: skip to its end or the next `${`
        for (i++; i < src.length; i++) {
          if (src[i] === "\\") { i++; continue; }
          if (src[i] === "`") break;
          if (src[i] === "$" && src[i + 1] === "{") { stack.push(depth); depth++; i++; break; }
        }
        continue;
      }
      if (depth === 0) return i + 1;
    }
  }
  return src.length;
}

function lineStarts(src) {
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === "\n") starts.push(i + 1);
  return starts;
}
/** End of an arrow function's expression body: the first ";" or "," at depth 0, or a line break that does not continue. */
function exprEnd(src, from) {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === "\"" || c === "`") { for (i++; i < src.length && src[i] !== c; i++) if (src[i] === "\\") i++; continue; }
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) { if (--depth < 0) return i; }
    else if (depth === 0 && (c === ";" || c === ",")) return i;
    else if (depth === 0 && c === "\n" && /\S/.test(src.slice(from, i)) && !/^\s*[.?:+\-*/&|]/.test(src.slice(i + 1, i + 40))) return i;
  }
  return src.length;
}

function lineAt(starts, pos) {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; }
  return lo + 1;
}

/** Text of the parameter list starting at the "(" at `pos`, whitespace squashed. */
function paramsAt(src, pos) {
  if (src[pos] !== "(") return null;
  let depth = 0;
  for (let i = pos; i < src.length && i < pos + 2000; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")" && --depth === 0) return src.slice(pos + 1, i).replace(/\s+/g, " ").trim();
  }
  return null;
}

function jsSymbols(src) {
  const starts = lineStarts(src), out = [];
  const pats = [
    // function name(  / export default async function* name(
    { re: new RegExp(`^[ \\t]*(export[ \\t]+(?:default[ \\t]+)?)?(?:async[ \\t]+)?function[ \\t]*\\*?[ \\t]*(${ID})[ \\t]*(?:<[^>\\n]*>)?[ \\t]*\\(`, "gm"), kind: "function" },
    // const name = (...) => / async x => / function (
    { re: new RegExp(`^[ \\t]*(export[ \\t]+)?(?:const|let|var)[ \\t]+(${ID})[ \\t]*(?::[^=\\n]+)?=[ \\t]*(?:async[ \\t]*)?(?:function\\b[^(\\n]*\\(|\\(|${ID}[ \\t]*=>)`, "gm"), kind: "function", arrow: true },
    // exports.name = function / module.exports.name = (
    { re: new RegExp(`^[ \\t]*()(?:module\\.)?exports\\.(${ID})[ \\t]*=[ \\t]*(?:async[ \\t]*)?(?:function\\b[^(\\n]*\\(|\\(|${ID}[ \\t]*=>)`, "gm"), kind: "function", arrow: true, exported: true },
    // class Name
    { re: new RegExp(`^[ \\t]*(export[ \\t]+(?:default[ \\t]+)?)?(?:abstract[ \\t]+)?class[ \\t]+(${ID})`, "gm"), kind: "class" },
  ];
  for (const p of pats) {
    for (const m of src.matchAll(p.re)) {
      const name = m[2], at = m.index + m[0].length;
      let paren = src.lastIndexOf("(", at);
      if (paren < m.index) paren = -1;
      if (p.arrow) {
        // must really be a function: "=>" or "function" before the body starts
        const rest = src.slice(m.index, m.index + 600);
        if (!/=>|function\b/.test(rest.split(/\n\s*\n/)[0])) continue;
      }
      let bodyOpen = -1;
      if (p.kind === "class") bodyOpen = src.indexOf("{", at);
      else {
        // skip the parameter list, then find "{" (or an expression body for arrows)
        let i = paren >= 0 ? paren : m.index + m[0].indexOf("=", m[0].indexOf(name) + name.length) + 1;
        if (paren >= 0) { let d = 0; for (; i < src.length; i++) { if (src[i] === "(") d++; else if (src[i] === ")" && --d === 0) { i++; break; } } }
        const tail = src.slice(i, i + 400);
        const arrowAt = tail.indexOf("=>"), braceAt = tail.indexOf("{");
        if (p.arrow && arrowAt >= 0 && (braceAt < 0 || /^\s*[^{\s]/.test(tail.slice(arrowAt + 2)))) {
          const end = exprEnd(src, i + arrowAt + 2);
          out.push(mk(name, p.kind, m, lineAt(starts, m.index + m[0].search(/\S/)), lineAt(starts, end), paren >= 0 ? paramsAt(src, paren) : null, p));
          continue;
        }
        bodyOpen = braceAt >= 0 ? i + braceAt : -1;
      }
      if (bodyOpen < 0) continue;
      const end = matchBrace(src, bodyOpen);
      out.push(mk(name, p.kind, m, lineAt(starts, m.index + m[0].search(/\S/)), lineAt(starts, end - 1), paren >= 0 ? paramsAt(src, paren) : null, p));
    }
  }
  // methods: inside class bodies only
  for (const cls of out.filter((s) => s.kind === "class")) {
    const from = starts[cls.start - 1], to = starts[cls.end] ?? src.length;
    const body = src.slice(from, to);
    const re = new RegExp(`^[ \\t]+(?:(?:static|async|get|set|public|private|protected|readonly|override)[ \\t]+)*\\*?[ \\t]*(#?${ID})[ \\t]*(?:<[^>\\n]*>)?[ \\t]*\\(`, "gm");
    for (const m of body.matchAll(re)) {
      const name = m[1];
      if (KEYWORDS.has(name) && name !== "constructor") continue;
      const abs = from + m.index, paren = from + m.index + m[0].length - 1;
      let i = paren, d = 0;
      for (; i < src.length; i++) { if (src[i] === "(") d++; else if (src[i] === ")" && --d === 0) { i++; break; } }
      const tail = src.slice(i, i + 200);
      const b = /^\s*(?::[^{;]+)?\{/.exec(tail);
      if (!b) continue; // a call statement, not a definition
      const start = lineAt(starts, abs + m[0].search(/\S/));
      if (start === cls.start) continue;
      const end = lineAt(starts, matchBrace(src, i + b[0].length - 1) - 1);
      out.push({ name: name.replace(/^#/, ""), kind: "method", owner: cls.name, start, end, params: paramsAt(src, paren), exported: cls.exported });
    }
  }
  return dedupe(out, src);
}

function mk(name, kind, m, start, end, params, p) {
  return { name, kind, start, end, params, exported: !!(p.exported || (m[1] && /export/.test(m[1]))) };
}

function dedupe(list, src) {
  const seen = new Set(), out = [];
  for (const s of list.sort((a, b) => a.start - b.start || b.end - a.end)) {
    const k = `${s.owner ?? ""}.${s.name}@${s.start}`;
    if (seen.has(k)) continue; seen.add(k); out.push(s);
  }
  // module.exports = { a, b } / export { a, b }
  const named = new Set();
  for (const m of src.matchAll(/(?:module\.exports\s*=|export)\s*\{([^}]*)\}/g)) for (const n of m[1].split(",")) named.add(n.trim().split(/\s+as\s+|\s*:\s*/)[0]);
  for (const s of out) if (named.has(s.name)) s.exported = true;
  for (const s of out) if (s.owner) s.exported = !!out.find((c) => c.kind === "class" && c.name === s.owner)?.exported;
  return out;
}

function pySymbols(src) {
  const lines = src.split("\n"), out = [];
  const indentOf = (l) => /^[ \t]*/.exec(l)[0].replace(/\t/g, "    ").length;
  const classes = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^([ \t]*)(?:async[ \t]+)?(def|class)[ \t]+([A-Za-z_]\w*)[ \t]*(\(|:)?/.exec(lines[i]);
    if (!m) continue;
    const ind = indentOf(lines[i]);
    let end = i;
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (!l.trim() || /^\s*#/.test(l)) continue;
      if (indentOf(l) <= ind) break;
      end = j;
    }
    let params = null;
    if (m[2] === "def") {
      const from = lines.slice(i, i + 20).join("\n"), open = from.indexOf("(");
      if (open >= 0) params = paramsAt(from, open);
    }
    while (classes.length && classes.at(-1).ind >= ind) classes.pop();
    const owner = classes.at(-1);
    const sym = { name: m[3], kind: m[2] === "class" ? "class" : owner ? "method" : "function", start: i + 1, end: end + 1, params, exported: !m[3].startsWith("_") };
    if (owner) sym.owner = owner.name;
    out.push(sym);
    if (m[2] === "class") classes.push({ name: m[3], ind });
  }
  return out;
}

/**
 * @param {string} file path (for the language)
 * @param {string} src file content
 * @returns {{name: string, kind: "function"|"class"|"method", owner?: string, start: number, end: number, params: string|null, exported: boolean}[]}
 */
export function findSymbols(file, src) {
  const lang = langOf(file);
  if (!lang || typeof src !== "string" || src.length > 1_000_000) return [];
  try { return lang === "py" ? pySymbols(src) : jsSymbols(src); } catch { return []; }
}

/** The innermost symbol that contains `line`. */
export function enclosing(symbols, line) {
  let best = null;
  for (const s of symbols) if (s.start <= line && line <= s.end && (!best || s.end - s.start < best.end - best.start)) best = s;
  return best;
}

export const display = (s) => (s.owner ? `${s.owner}.${s.name}` : s.name);

/** Names this file imports: { localName: modulePath }. */
export function importsOf(file, src) {
  const lang = langOf(file), out = {};
  if (!lang || typeof src !== "string") return out;
  if (lang === "js") {
    for (const m of src.matchAll(/import\s+([^'"]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
      const [, what, mod] = m;
      for (const b of what.matchAll(/\{([^}]*)\}/g)) for (const n of b[1].split(",")) { const nm = n.trim().split(/\s+as\s+/).pop(); if (nm) out[nm] = mod; }
      const def = /^([A-Za-z_$][\w$]*)/.exec(what.trim()); if (def) out[def[1]] = mod;
    }
    for (const m of src.matchAll(/(?:const|let|var)\s+\{([^}]*)\}\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g)) for (const n of m[1].split(",")) { const nm = n.trim().split(/\s*:\s*/).pop(); if (nm) out[nm] = m[2]; }
    for (const m of src.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g)) out[m[1]] = m[2];
  } else {
    for (const m of src.matchAll(/^\s*from\s+([\w.]+)\s+import\s+\(?([^)\n]+)\)?/gm)) for (const n of m[2].split(",")) { const nm = n.trim().split(/\s+as\s+/).pop(); if (nm && nm !== "*") out[nm] = m[1]; }
  }
  return out;
}

/** Names called inside lines [start, end] of src: identifiers directly followed by "(". */
export function callsIn(src, start, end) {
  const body = src.split("\n").slice(start - 1, end).join("\n").replace(/\/\/.*$|#.*$/gm, "");
  const out = new Set();
  for (const m of body.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) if (!KEYWORDS.has(m[1]) && !/^(def|class|print|len|require|import|async)$/.test(m[1])) out.add(m[1]);
  return [...out];
}
