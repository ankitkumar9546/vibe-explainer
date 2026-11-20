# Data format

The contract between the recorder, the store, the teacher and the console.
**Change a field here first, then in code, in the same commit.** Every file carries a `v` (version).

## 1. Layout on disk

```
~/.vibe-explainer/                      (or $VIBE_EXPLAINER_HOME)
├── config.json
└── projects/<projectId>/
    ├── project.json                    { v, id, path, name, createdAt }
    └── sessions/<sessionId>/
        ├── session.json                { v, id, source, projectId, cwd, transcriptPath, startedAt, endedAt? }
        ├── events.jsonl                one event per line (section 2)
        └── turns/<n>/                  n = 1, 2, 3…
            ├── turn.json               { v, n, prompt, startedAt, endedAt?, before?, after?, status }
            ├── diff.patch              Phase 2
            ├── analysis.json           Phase 6
            └── lesson.json             Phase 3 (section 3)
```

- `projectId`: the first 12 hex characters of `sha256(absolute project path, lower-cased on Windows)`.
- `sessionId`: Claude Code's `session_id`, or `w-<timestamp>` for `watch` sessions.
- `turn.status`: `open` | `closed` | `analysing` | `ready` | `failed`.
- `turn.before` / `turn.after`: `{ commit, at }`, the shadow-repo commit of the work tree (Phase 2).
- `turn.files`: `[{ path, oldPath?, status: added|modified|deleted|renamed|copied|type-changed, add, del }]`. `add`/`del` are `null` for binary files. Line-ending-only changes are left out.
- `turn.snapshotError`: present when a snapshot or diff failed (for example, git is not installed). The turn is still recorded.
- `diff.patch`: unified diff from `before` to `after` (`--find-renames --ignore-cr-at-eol`).
- Shadow repos: `~/.vibe-explainer/shadow/<projectId>.git`, refs `refs/vibe-explainer/<session>/<turn>-<before|after>` and `refs/vibe-explainer/baseline`.

## 2. Event (`events.jsonl`)

```json
{ "v": 1, "ts": "2026-11-20T10:15:02.120Z", "session": "abc", "turn": 3, "kind": "tool_end",
  "tool": "Edit", "target": "src/api/auth.js", "input": { }, "result": { }, "ms": 812 }
```

| kind | From | Extra fields |
|---|---|---|
| `session_start` | SessionStart | `source` (startup, resume, …), `cwd`, `transcriptPath` |
| `prompt` | UserPromptSubmit | `prompt` (text) |
| `tool_start` | PreToolUse | `tool`, `target`, `input` |
| `tool_end` | PostToolUse | `tool`, `target`, `input`, `result`, `ok` |
| `stop` | Stop | none |
| `session_end` | SessionEnd | `reason` |

Rules:
- `target` is the most useful single string for the tool: a file path for Read/Edit/Write, the command for Bash, the pattern for Grep/Glob, otherwise `null`.
- `input` and `result` are kept but **truncated**: any string longer than 4,000 characters is cut, and marked with `"…[cut N chars]"`.
- Edit events keep `old_string` and `new_string` (also truncated). These are the raw material for the live diff.
- `ok` is `false` when the tool reported an error.
- `turn` is `0` before the first prompt.

## 3. Lesson (`lesson.json`), written by the teacher

```json
{
  "v": 1,
  "level": "beg", "lang": "hi",
  "title": "…", "summary": "…",
  "asks":      [{ "text": "…", "status": "done|part|no", "evidence": "…" }],
  "why": "…",
  "how":       ["step 1", "step 2"],
  "before": "…", "after": "…",
  "decision":  { "question": "…", "options": [{ "text": "…", "chosen": true, "why": "…" }], "quote": "…" },
  "errors":    [{ "at": 32, "command": "…", "simple": "…", "fix": "…" }],
  "notes":     [{ "file": "…", "hunk": 0, "text": "…" }],
  "claims":    [{ "text": "…", "status": "backed|unverified|none", "evidence": "…", "at": 24 }],
  "impact":    [{ "where": "…", "risk": 1, "title": "…", "why": "…", "fix": "…", "prompt": "…" }],
  "concepts":  [{ "name": "…", "explain": "…" }],
  "quiz":      [{ "q": "…", "options": ["…"], "answer": 1, "explain": "…" }],
  "whatIf":    [{ "q": "…", "options": ["…"], "answer": 1, "patch": "…", "explain": "…" }],
  "challenge": { "task": "…", "starter": "…", "tests": "…", "hints": ["…"], "solution": "…" },
  "manualTest":{ "steps": ["…"], "expect": "…" }
}
```

**As built in Phase 3** (v1): the teacher writes `title, summary, asks, why, how, before, after, decision, errors, notes[{file, text}], claims, impact, concepts, quiz, manualTest`, and the tool adds `v, level, lang, teacher, createdAt`. `whatIf` and `challenge` come with the playground (Phase 9). Claim `at` and error `at` are seconds from the turn's start. `turn.lessonError` holds the reason when a lesson failed. Settings live in `~/.vibe-explainer/config.json`: `{ teacher, mode: manual|auto, level: beg|dev, lang: hi|en, model, registry: on|off }`.

## 3b. Quiz answers (`turns/<n>/quiz.json`), Phase 8

```json
{ "v": 1, "answers": { "0": 1, "1": 0 }, "history": [{ "answers": { "0": 2 }, "until": "…" }], "updatedAt": "…" }
```

- `answers`: question index → chosen option. The first answer to a question counts.
- A revision quiz moves the answers into `history` (up to 10 entries) and starts again.

## 4. Analysis (`analysis.json`), written by the analyzer (Phase 6)

```json
{
  "v": 1, "createdAt": "…", "after": "<after commit>", "ms": 271,
  "symbols": [{
    "file": "src/auth.js", "name": "login", "kind": "function|class|method", "owner": "(methods only) Store",
    "change": "added|modified|removed", "start": 3, "end": 7,
    "params": "email, password", "paramsBefore": "(only when signatureChanged) email", "signatureChanged": true,
    "exported": true, "tested": false, "risk": 3,
    "reasons": ["used-elsewhere", "signature-changed", "exported", "no-tests"],
    "callers": [{ "file": "src/pages/LoginPage.js", "line": 4, "text": "…", "kind": "call|import|mention", "in": "onLoginSubmit" }],
    "calls": [{ "name": "post", "from": "./http.js" }]
  }],
  "packages": [{ "eco": "npm|pypi", "name": "zod", "change": "added|removed|changed", "from": null, "to": "^3.23.8", "dev": false, "manifest": "package.json",
                 "facts": { "license": "MIT", "size": 666000, "weeklyDownloads": 475488459, "description": "…", "version": "3.25.76" }, "factsError": "…" }],
  "security": [{ "rule": "secret", "severity": "high|medium|low", "file": "server.js", "line": 2, "text": "(masked line)", "inTest": false }],
  "limits": { "filesCut": false, "symbolsCut": false }
}
```

- `after` ties the file to the snapshot it was made from. A different `turn.after.commit` means it is stale, and it is recomputed.
- `reasons`: `new`, `removed-still-used`, `removed-unused`, `used-elsewhere`, `signature-changed`, `many-callers`, `exported`, `no-tests`, `tested`.
- `facts` is missing when lookups are off or haven't run yet; `factsError` says why a lookup failed. Sizes are bytes (npm: unpacked; PyPI: the wheel).
- `security.text` is always masked; `env-file` findings carry no text at all.
- Limits: 60 files, 30 symbols, 40 callers per symbol.
- Setting: `registry: on|off` in `config.json` (default `on`).

`health` and `todo` are not written by the teacher. The console computes them from `claims`,
`impact`, the analysis and the events, so they are always consistent with the evidence.
