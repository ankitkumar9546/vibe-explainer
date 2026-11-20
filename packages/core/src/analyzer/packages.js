// Dependencies a turn added, removed or changed, and public facts about them (Roadmap Phase 6).
// Facts come from the npm registry / PyPI only when online lookups are on (config `registry`).

const NPM_FIELDS = [["dependencies", false], ["devDependencies", true], ["optionalDependencies", false], ["peerDependencies", false]];

function npmDeps(text) {
  let j; try { j = JSON.parse(text); } catch { return null; }
  const out = new Map();
  for (const [field, dev] of NPM_FIELDS) for (const [n, v] of Object.entries(j?.[field] ?? {})) out.set(n, { version: String(v), dev });
  return out;
}

function pyDeps(text) {
  const out = new Map();
  for (const raw of String(text).split("\n")) {
    const l = raw.replace(/#.*/, "").trim();
    if (!l || l.startsWith("-")) continue;
    const m = /^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]*\])?\s*(.*)$/.exec(l);
    if (m) out.set(m[1].toLowerCase(), { version: m[2].trim() || "*", dev: false });
  }
  return out;
}

const MANIFESTS = [
  { re: /(^|\/)package\.json$/, eco: "npm", parse: npmDeps },
  { re: /(^|\/)requirements[\w.-]*\.txt$/i, eco: "pypi", parse: pyDeps },
];

/**
 * @param {{path: string, before: string|null, after: string|null}[]} manifests changed manifest files with their contents
 * @returns {{eco: string, name: string, change: "added"|"removed"|"changed", from: string|null, to: string|null, dev: boolean, manifest: string}[]}
 */
export function diffPackages(manifests) {
  const out = [];
  for (const f of manifests) {
    const kind = MANIFESTS.find((m) => m.re.test(f.path));
    if (!kind) continue;
    const a = f.before != null ? kind.parse(f.before) : new Map();
    const b = f.after != null ? kind.parse(f.after) : new Map();
    if (!a || !b) continue; // unreadable JSON half-way through an edit
    for (const [name, v] of b) {
      const old = a.get(name);
      if (!old) out.push({ eco: kind.eco, name, change: "added", from: null, to: v.version, dev: v.dev, manifest: f.path });
      else if (old.version !== v.version) out.push({ eco: kind.eco, name, change: "changed", from: old.version, to: v.version, dev: v.dev, manifest: f.path });
    }
    for (const [name, v] of a) if (!b.has(name)) out.push({ eco: kind.eco, name, change: "removed", from: v.version, to: null, dev: v.dev, manifest: f.path });
  }
  return out;
}

export const isManifest = (p) => MANIFESTS.some((m) => m.re.test(p));

const exact = (spec) => (/^\d+\.\d+\.\d+[\w.+-]*$/.test(spec ?? "") ? spec : /^[\^~=]=?\s*(\d+\.\d+\.\d+[\w.+-]*)$/.exec(spec ?? "")?.[1] ?? null);

async function getJson(fetchFn, url, ms) {
  const r = await fetchFn(url, { signal: AbortSignal.timeout(ms), headers: { accept: "application/json", "user-agent": "vibe-explainer" } });
  if (!r.ok) throw new Error(`${r.status} from ${new URL(url).host}`);
  return r.json();
}

/**
 * Public facts for one package: licence, size, weekly downloads, description.
 * @returns {Promise<{license: string|null, size: number|null, weeklyDownloads: number|null, description: string|null, version: string|null}>}
 */
export async function packageFacts(p, { fetchFn = globalThis.fetch, timeoutMs = 5000 } = {}) {
  const name = encodeURIComponent(p.name).replace(/^%40/, "@");
  if (p.eco === "npm") {
    const ver = exact(p.to) ?? "latest";
    const [meta, dl] = await Promise.allSettled([
      getJson(fetchFn, `https://registry.npmjs.org/${name}/${encodeURIComponent(ver)}`, timeoutMs),
      getJson(fetchFn, `https://api.npmjs.org/downloads/point/last-week/${name}`, timeoutMs),
    ]);
    if (meta.status === "rejected") throw meta.reason;
    const m = meta.value;
    const lic = typeof m.license === "string" ? m.license : m.license?.type ?? null;
    return { license: lic, size: m.dist?.unpackedSize ?? null, weeklyDownloads: dl.status === "fulfilled" ? dl.value.downloads ?? null : null, description: m.description ?? null, version: m.version ?? null };
  }
  if (p.eco === "pypi") {
    const j = await getJson(fetchFn, `https://pypi.org/pypi/${name}/json`, timeoutMs);
    const files = j.urls ?? [];
    const wheel = files.find((u) => u.packagetype === "bdist_wheel") ?? files[0];
    const info = j.info ?? {};
    const lic = info.license_expression || (info.license && info.license.length < 60 ? info.license : null)
      || (info.classifiers ?? []).find((c) => c.startsWith("License ::"))?.split("::").pop().trim() || null;
    return { license: lic, size: wheel?.size ?? null, weeklyDownloads: null, description: info.summary ?? null, version: info.version ?? null };
  }
  throw new Error(`unknown ecosystem ${p.eco}`);
}

/** Fill `facts` (or `factsError`) on every added or changed package. Mutates and returns the list. */
export async function enrichPackages(list, opts = {}) {
  await Promise.all(list.filter((p) => p.change !== "removed" && !p.facts).map(async (p) => {
    try { p.facts = await packageFacts(p, opts); delete p.factsError; } catch (err) { p.factsError = String(err.message ?? err).slice(0, 200); }
  }));
  return list;
}
