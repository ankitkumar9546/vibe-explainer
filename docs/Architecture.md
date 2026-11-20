# Architecture

## 1. Shape

```
 Claude Code ──hooks──┐
 transcript .jsonl ───┤
                      ▼
 any agent ──watch──► CORE ───────────────────────────────► CONSOLE (browser, localhost:4321)
                      │  recorder → store → snapshot                ▲
                      │  analyzer → teacher → lesson.json           │ HTTP + SSE
                      │  sandbox (playground)                       │
                      └──────────────── server ─────────────────────┘
 MCP app ◄──── mcp ───┘
```

One core package does all the work. The entry points (Claude Code plugin, `watch`, MCP) are
thin ways into it.

## 2. Packages (npm workspaces)

| Path | What | Depends on |
|---|---|---|
| `packages/core` | recorder, store, snapshot, analyzer, teacher, sandbox, server | Node built-ins only where possible |
| `packages/cli` | the `vibe-explainer` command: `hook`, `init`, `open`, `watch`, `explain`, `config` | core |
| `packages/console` | the browser UI (built from the approved mockup) | none at runtime |
| `packages/mcp` | MCP server (Phase 12) | core, `@modelcontextprotocol/sdk` |
| `plugin/` | Claude Code plugin: hooks, slash commands, skill | cli |

Language: JavaScript (ES modules) with JSDoc types. There is no build step for core and cli,
so a hook starts fast and runs anywhere Node 20+ runs. The console is built with Vite.

## 3. Components

### 3.1 Recorder (`core/src/recorder.js`)
- Input: one hook payload (JSON on stdin) from Claude Code.
- Output: one normalized event appended to the session's `events.jsonl` (format: `docs/DataFormat.md`).
- Rules: it never throws to the caller, never takes longer than about 100 ms, and does nothing when `VIBE_EXPLAINER_INTERNAL=1` is set.
- `UserPromptSubmit` opens a new turn. `Stop` closes it and queues the heavier work (snapshot "after", analysis, teaching) in a detached child process, so the agent is never kept waiting.

### 3.2 Store (`core/src/store.js`)
- Root: `~/.vibe-explainer/`, or `VIBE_EXPLAINER_HOME`.
- `projects/<projectId>/sessions/<sessionId>/…`, where `projectId` is a short hash of the project's absolute path.
- Append-only JSONL for events, plain JSON for everything else. There is no database.

### 3.3 Snapshot (`core/src/snapshot.js`), Phase 2
- Before and after each turn, copy the working tree into a git tree object using a **temporary index file** (`GIT_INDEX_FILE`), so the user's index is never touched.
- `git write-tree` then `git commit-tree`, stored under `refs/vibe-explainer/<session>/<turn>-<before|after>`.
- Projects without git get a shadow repo: `~/.vibe-explainer/shadow/<projectId>` with `--work-tree` pointing at the project.
- The diff is `git diff <before> <after>`, honouring `.gitignore`.

### 3.4 Analyzer (`core/src/analyzer/`), Phase 6
- `web-tree-sitter` (WASM) parses changed files: functions, classes, imports, calls.
- Maps diff hunks to symbols, then finds callers and importers (the impact).
- A simple risk score: number of callers, whether tests cover the symbol, whether it is exported.
- Package diff: added or removed dependencies, with size, licence and weekly downloads from the npm registry (only when online, and the user can turn it off).
- Security scan of the diff: secret patterns, `eval`, `innerHTML`, raw error passthrough.

### 3.5 Teacher (`core/src/teacher/`), Phase 3
- Adapters: `claude` (`claude -p`, default), `ollama`, `gemini`, `openai`.
- Input: prompt, events, diff, analysis, level and language. Secrets are masked first (R4).
- Output: strict JSON (`lesson.json`, schema in `docs/DataFormat.md`), validated. On invalid output it retries once, then marks the lesson as failed with the reason.
- Always runs with `VIBE_EXPLAINER_INTERNAL=1` (R3).
- Big diffs: summarise each file first, then write one lesson over the summaries.

### 3.6 Sandbox (`core/src/sandbox.js`), Phase 9
- A git worktree under `~/.vibe-explainer/sandbox/<projectId>`, checked out at the turn's "after" snapshot.
- Runs the project's lint and test commands there (taken from `package.json` scripts and confirmed by the user once).
- "Apply to my project" writes a patch to the real tree only after the user confirms in the UI (R1).

### 3.7 Server (`core/src/server.js`), Phase 4
- `node:http` on `127.0.0.1:4321`, bound to localhost only.
- JSON endpoints for sessions, turns, events, diffs, lessons; one SSE stream for live events.
- Serves the built console.
- A random token in the URL, shown by `vibe-explainer open`, so other local pages cannot read the data.

## 4. Claude Code integration

Hooks used: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `SessionEnd`.
Each one runs `vibe-explainer hook`, which reads the JSON payload on stdin.

| Phase | How hooks are installed |
|---|---|
| 1 to 4 | `vibe-explainer init` writes them into the project's `.claude/settings.local.json`, which is personal and not committed |
| 5 on | The plugin ships them in `hooks/hooks.json`. Install is `/plugin marketplace add …` then `/plugin install vibe-explainer` |

The transcript path arrives in every payload (`transcript_path`). The recorder stores it. The
teacher reads the agent's thinking and final reply from it.

## 5. Data flow for one turn

1. `UserPromptSubmit`: append the `prompt` event, open turn *n*, take the "before" snapshot (Phase 2).
2. `PreToolUse` / `PostToolUse`: append tool events (live in the console over SSE).
3. `Stop`: append `stop`, then spawn a detached `vibe-explainer finish-turn`:
   take the "after" snapshot, write `diff.patch`, run the analyzer, run the teacher (in `auto` mode), and write `turn.json`, `analysis.json` and `lesson.json`.
4. The console updates when each file appears.

## 6. Security

- Everything binds to localhost and the URL carries a token.
- No network calls except the teacher model the user chose and, if enabled, the npm registry for package facts.
- The tool never runs code from the user's project except inside the sandbox, and only after the user enables sandbox runs.
- Secrets are masked before the teacher sees anything (R4).
