// Security scan of the lines a turn ADDED (Roadmap Phase 6). Patterns, not proof:
// each finding says "look at this line", and the console explains why.
import { maskSecrets } from "../teacher/mask.js";

const TESTY = /(^|\/)(tests?|__tests__|spec|fixtures?)\/|\.(test|spec)\.[a-z]+$|(^|\/)test_[^/]+\.py$/i;
const ENV_FILE = /(^|\/)\.env(\.(?!example$|sample$|template$|dist$)[\w-]+)?$/i;

/** rule id → { severity, test(line, lang) } */
export const RULES = {
  "secret":            { severity: "high",   test: (l) => maskSecrets(l) !== l },
  "eval":              { severity: "high",   test: (l, lang) => /(?<![\w$.])eval\s*\(|new\s+Function\s*\(/.test(l) || (lang === "py" && /(?<![\w.])exec\s*\(/.test(l)) },
  "shell-injection":   { severity: "high",   test: (l, lang) => (lang === "js" && /\b(?:exec|execSync|spawn|spawnSync)\s*\(\s*(?:`[^`]*\$\{|['"][^'"]*['"]\s*\+)/.test(l)) || (lang === "py" && /shell\s*=\s*True|\bos\.system\s*\(/.test(l)) },
  "tls-off":           { severity: "high",   test: (l) => /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0|verify\s*=\s*False\b/.test(l) },
  "unsafe-deserialize":{ severity: "high",   test: (l, lang) => lang === "py" && (/\bpickle\.loads?\s*\(/.test(l) || /\byaml\.load\s*\((?![^)]*Loader)/.test(l)) },
  "sql-concat":        { severity: "medium", test: (l) => /\b(?:select\s[^'"`]*\bfrom|insert\s+into|update\s+\w+\s+set|delete\s+from)\b/i.test(l) && /\$\{|['"`]\s*\+\s*[\w$]|\bf["'][^"']*\{|%\s*\(|\.format\(/.test(l) },
  "html-injection":    { severity: "medium", test: (l) => /\.(?:innerHTML|outerHTML)\s*\+?=(?!=)|insertAdjacentHTML\s*\(|dangerouslySetInnerHTML|document\.write\s*\(|\bv-html\s*=|\|\s*safe\b|mark_safe\s*\(/.test(l) },
  "error-leak":        { severity: "medium", test: (l) => /\bres\.(?:send|json|end|write)\s*\(\s*(?:err|error|e)(?:\.stack|\.message)?\s*\)|\.(?:stack)\b[^;]*\bres\.|\bres\.[a-z]+\([^)]*\.stack\b|traceback\.format_exc\s*\(\s*\)\s*(?:,|\))/.test(l) },
  "cors-any":          { severity: "low",    test: (l) => /Access-Control-Allow-Origin['"]?\s*[,:]\s*['"]\*['"]|\bcors\(\s*\)|allow_origins\s*=\s*\[\s*['"]\*['"]/.test(l) },
  "weak-hash":         { severity: "low",    test: (l) => /createHash\(\s*['"](?:md5|sha1)['"]|hashlib\.(?:md5|sha1)\s*\(/.test(l) },
};

const SEV = { high: 3, medium: 2, low: 1 };

/**
 * @param {{path: string, lang: string|null, added: {line: number, text: string}[]}[]} files
 * @param {{path: string, status: string}[]} changed turn.files
 * @returns {{rule: string, severity: "high"|"medium"|"low", file: string, line: number|null, text: string, inTest: boolean}[]}
 */
export function scanAdded(files, changed = []) {
  const out = [];
  for (const f of changed) {
    if (ENV_FILE.test(f.path) && f.status !== "deleted") out.push({ rule: "env-file", severity: "high", file: f.path, line: null, text: "", inTest: false });
  }
  for (const f of files) {
    if (ENV_FILE.test(f.path)) continue; // already reported as a whole file, values stay hidden
    const inTest = TESTY.test(f.path);
    for (const { line, text } of f.added) {
      if (text.length > 2000) continue; // minified or generated
      for (const [rule, r] of Object.entries(RULES)) {
        if (!r.test(text, f.lang)) continue;
        out.push({ rule, severity: inTest && rule === "secret" ? "medium" : r.severity, file: f.path, line, text: maskSecrets(text.trim()).slice(0, 200), inTest });
      }
    }
  }
  return out.sort((a, b) => SEV[b.severity] - SEV[a.severity]).slice(0, 100);
}

export { TESTY };
