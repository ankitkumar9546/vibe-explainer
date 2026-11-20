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

`health` and `todo` are not written by the teacher. The console computes them from `claims`,
`impact`, the analysis and the events, so they are always consistent with the evidence.
