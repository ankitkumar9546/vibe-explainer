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

### 3.3 Snapshot (`core/src/snapshot.js`, `core/src/turns.js`), Phase 2 (built 11-20)
- **Every project gets a shadow repo**: `~/.vibe-explainer/shadow/<projectId>.git` (bare), used with `GIT_WORK_TREE=<project>`. This applies to git projects too. The project's own `.git` is never written to: no objects, refs, index or config. That is stronger than a temporary index inside the user's repo, which was the first plan.
- Excludes: the project's `.gitignore` files (git reads them from the work tree), its `.git/info/exclude` (copied in), and a default list (`node_modules/`, `dist/`, `.venv/` …).
- The shadow repo keeps its own index, so after the first full pass a snapshot only rehashes the files that changed. `init` takes a baseline snapshot to warm it (about 240 ms on a small project).
- Snapshot: `git add --all` → `write-tree` → `commit-tree`, stored at `refs/vibe-explainer/<session>/<turn>-<before|after>`. A lock (`vibe.lock`) keeps two sessions from sharing the index at the same time.
- "before" is taken **synchronously** in the `UserPromptSubmit` hook, so it is guaranteed to happen before the agent edits anything. This is the one exception to the 100 ms hook budget (PRD R2). "after" plus the diff run in a detached `finish-turn` process after `Stop`.
- Diff: `git diff --find-renames --ignore-cr-at-eol`. Files whose only change is line endings are dropped, to match what `git diff` shows the user.

### 3.4 Analyzer (`core/src/analyzer/`), Phase 6
- `web-tree-sitter` (WASM) parses changed files: functions, classes, imports, calls.
- Maps diff hunks to symbols, then finds callers and importers (the impact).
- A simple risk score: number of callers, whether tests cover the symbol, whether it is exported.
- Package diff: added or removed dependencies, with size, licence and weekly downloads from the npm registry (only when online, and the user can turn it off).
- Security scan of the diff: secret patterns, `eval`, `innerHTML`, raw error passthrough.

### 3.5 Teacher (`core/src/teacher/`), Phase 3 (built 11-20)
Files: `mask.js` (secrets), `context.js` (prompt, step lines, diff, and the agent's thinking and replies from the transcript, within size budgets), `lesson.js` (prompt, JSON extraction, validator), `claude.js` (adapter), `teach.js` (orchestration).
- The `claude` adapter runs `claude -p --output-format json --max-turns 1` in an empty folder (`~/.vibe-explainer/tmp/teacher`), so the project's CLAUDE.md, settings and hooks don't load. The prompt goes in on stdin. `CLAUDECODE` is cleared and `VIBE_EXPLAINER_INTERNAL=1` is set.
- Modes (`vibe-explainer config set mode manual|auto`): `manual` (the default) only teaches on `vibe-explainer explain`; `auto` teaches inside `finish-turn` after every prompt.
- Turn status goes `analysing` → `ready`, or `failed` with `turn.lessonError`.

Original design notes:
- Adapters: `claude` (`claude -p`, default), `ollama`, `gemini`, `openai`.
- Input: prompt, events, diff, analysis, level and language. Secrets are masked first (R4).
- Output: strict JSON (`lesson.json`, schema in `docs/DataFormat.md`), validated. On invalid output it retries once, then marks the lesson as failed with the reason.
- Always runs with `VIBE_EXPLAINER_INTERNAL=1` (R3).
- Big diffs: summarise each file first, then write one lesson over the summaries.

### 3.6 Sandbox (`core/src/sandbox.js`), Phase 9
- A git worktree under `~/.vibe-explainer/sandbox/<projectId>`, checked out at the turn's "after" snapshot.
- Runs the project's lint and test commands there (taken from `package.json` scripts and confirmed by the user once).
- "Apply to my project" writes a patch to the real tree only after the user confirms in the UI (R1).

### 3.7 Server + console (`core/src/server.js`, `packages/console/`), Phase 4 (built 11-20)
- **The console has no build step**: plain `index.html`, `app.css` and `app.js` (ES module), with self-hosted fonts (`fonts/`, SIL OFL, fetched by `scripts/fetch-fonts.mjs`). Vite was the plan, but it isn't needed yet.
- Endpoints: `/api/projects`, `/api/sessions`, `/api/session`, `/api/turn` (turn + events + diff + lesson), `POST /api/explain`, and `/api/stream` (SSE: `ev` per new event, `turns` when any turn changes; it polls every 500 ms).
- Guards: binds to `127.0.0.1` only, a 36-hex token on every API call (timing-safe compare), a `Host` header allow-list (DNS rebinding), id format checks, and static files confined to the console folder.
- `vibe-explainer open [dir] [--port] [--no-browser]` starts it and opens the browser. When `mode=auto`, the open server also teaches finished turns, one at a time.
- Screenshot helpers: `?tab=…&theme=…&nostream=1&turn=N&tl=open`.
- **Static demo mode** (GitHub Pages): when the page sets `window.VX_STATIC` to a JSON file, `api()` reads that file instead of the server, and there is no stream, no "write lesson" and no token. The UI defaults to English and shows a "Demo" tag.
  - `scripts/build-demo.mjs --home --project` exports real sessions to `demo/demo-data.json`. It scrubs absolute paths to `~/demo-project`, drops transcript paths, and **refuses to build** if the user's name or home folder is still anywhere.
  - `scripts/assemble-site.mjs` builds `site/` from the console plus that data, and the `pages.yml` workflow deploys it (skipped while the repo is private).
  - `scripts/serve-static.mjs` previews the site locally.

**Change found in the real check (11-20):** on Windows, Claude Code ends its child processes when it exits, which cut a detached `finish-turn` short. So the "after" snapshot and the diff now run **synchronously in the Stop hook** (0.39 s measured). Auto lessons are detached only on macOS and Linux. On Windows the open console teaches them.

Original design notes:
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

**The plugin as built (Phase 5, 11-20):**
- The repo root is both the marketplace and the plugin. `.claude-plugin/marketplace.json` lists the plugin with `source: "./"`, and `.claude-plugin/plugin.json` points at `plugin/hooks/hooks.json`, `plugin/commands/` and `plugin/skills/`.
- When the plugin is installed, Claude Code copies the repo without running `npm install`. So the CLI imports core by **relative path** (`../../core/src/index.js`) and there are no runtime dependencies.
- Hooks run `node "${CLAUDE_PLUGIN_ROOT}/packages/cli/bin/vibe-explainer.js" hook`. The timeout is 30 s for UserPromptSubmit and Stop (the snapshots) and 10 s for the rest.
- With no `init`, `SessionStart` starts a detached `baseline` snapshot the first time it sees a project.
- Commands:
  - `/vibe-explainer:explain [--lang --level --turn]` runs `explain` through `!` bash. Don't use `$(…)`: Claude Code's permission check refuses it.
  - `/vibe-explainer:console` runs `open . --detach`. That reuses a running console via `~/.vibe-explainer/server.json`, or starts one and waits for it.
- Skill `explain-session`: answers "what did you change" from the store, not from memory.
- `explain` picks the newest finished prompt **across sessions**, skipping `/vibe-explainer…` prompts, because `/explain` opens a session of its own.
- Try it without installing: `claude --plugin-dir <repo>`. Validate it: `claude plugin validate .`

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
