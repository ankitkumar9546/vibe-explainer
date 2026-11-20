// Mask secrets before anything reaches a teacher model (PRD R4, Rules 4).
// Over-masking is fine; leaking is not.

const PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[masked private key]"],
  [/\bsk-ant-[A-Za-z0-9_-]{10,}/g, "[masked anthropic key]"],
  [/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/g, "[masked openai key]"],
  [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g, "[masked github token]"],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, "[masked github token]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[masked aws key]"],
  [/\bAIza[0-9A-Za-z_-]{30,}\b/g, "[masked google key]"],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, "[masked slack token]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g, "[masked jwt]"],
  [/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s'"`]+/gi, "[masked connection string]"],
];
// key = value / key: value / "key": "value" where the key name says it is secret.
const NAMED = /((?:["']?)[A-Za-z0-9_.-]*(?:api[_-]?key|secret|token|passw(?:or)?d|pwd|private[_-]?key|access[_-]?key|auth)[A-Za-z0-9_.-]*["']?\s*[:=]\s*)(["'`]?)([^\s"'`,;]{6,})(\2)/gi;

/** @param {string} text */
export function maskSecrets(text) {
  if (typeof text !== "string" || !text) return text;
  let out = text;
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep);
  out = out.replace(NAMED, (m, pre, q, val, q2) => /^\[masked/.test(val) || /^(?:process\.env|import\.meta\.env|env\.|os\.environ|\$\{)/.test(val) ? m : `${pre}${q}[masked]${q2}`);
  return out;
}

/** In a unified diff, mask every value inside .env-like files completely. */
export function maskEnvFilesInPatch(patch) {
  if (typeof patch !== "string") return patch;
  let inEnv = false;
  return patch.split("\n").map((line) => {
    if (line.startsWith("diff --git ")) inEnv = /(^|\/)(\.env(\.[\w-]+)?|\.npmrc|\.netrc|credentials(\.json)?|secrets?\.[\w]+)( |$)/i.test(line.replace(/^diff --git a\/\S+ b\//, ""));
    if (inEnv && /^[+\- ]/.test(line) && !/^(\+\+\+|---) /.test(line)) {
      return line.replace(/^([+\- ]\s*[A-Za-z0-9_.-]+\s*[=:]\s*).+$/, "$1[masked]");
    }
    return line;
  }).join("\n");
}
