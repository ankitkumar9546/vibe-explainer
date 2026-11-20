# Roadmap

Dependency-ordered. **A phase is done when its checks pass, not when the code is written.**
Work on one phase at a time.

| # | Phase | Checks (all must pass) | Status |
|---|---|---|---|
| 0 | **Repo setup**: npm workspaces, `node --test`, CI on Windows/macOS/Linux, README, docs | `npm test` passes locally. CI is green on all 3 OSes (needs the GitHub repo) | **done 11-20** (CI green on Windows, macOS and Linux) |
| 1 | **Recorder**: `vibe-explainer hook` + `init`, events in the store | (a) Fixture tests: every hook kind becomes the right event. (b) A real Claude Code session with `init`-installed hooks writes the prompt, each tool call and `stop` in order. (c) A hook with `VIBE_EXPLAINER_INTERNAL=1` writes nothing. (d) A broken payload exits 0 and writes nothing | **done 11-20** (a–d pass; b checked with real `claude -p`) |
| 2 | **Snapshot + diff** | Diff of a real turn matches `git diff`. `git status`, the index and the branch are identical before and after. Works in a folder with no git | **done 11-20** (real `claude -p` edit: diff = `git diff`, `.git` byte-identical; no-git + `.gitignore` + CRLF covered by tests) |
| 3 | **Teacher** (`claude -p` adapter, schema validation, secret masking, no loop) | One real turn produces a valid `lesson.json`. The teacher run creates no session in the store. A planted fake key never reaches the prompt | **done 11-20** (real `claude -p` lesson in 45s, Hinglish, claims checked; store sessions 2→2; planted keys masked, tested) |
| 4 | **Console v1**: server + Live, Logs, Changes, Learn (dev tabs), from real data | A real session shows live in the browser. The token is required. Light and dark both render | **done 11-20** (real `claude -p` streamed live within 0.5 s per step; 401/403 tests; light and dark captured with real data) |
| 5 | **Plugin**: hooks, `/explain`, `/console`, skill | A fresh project installs with 2 commands and records a session | **done 11-20** (`claude plugin validate` passes; real `claude --plugin-dir` run in a fresh project recorded + diffed with no `init`; `/vibe-explainer:explain` produced a lesson; `open --detach` start + reuse). The 2-command marketplace install itself needs the repo reachable (private now) |
| — | **First demo**: README GIF, GitHub Pages demo from a real session, repo public | A stranger runs it in 2 minutes | **done 11-20**: repo public, live demo at https://ankitkumar9546.github.io/vibe-explainer/ (deployed by `pages.yml`, checked: page, data and fonts all return 200 and render). The "stranger in 2 minutes" install path is now open, but no stranger has tried it yet |
| 6 | **Analyzer**: tree-sitter, wiring, impact, packages, security scan | A changed function shows its callers. A new dependency shows size and licence. A planted secret is flagged | |
| 7 | **Guided lesson**: 6 steps, health, asks, claims, quiz, glossary, Hinglish/English | Matches the mockup on desktop and mobile, in both themes | |
| 8 | **To-do + chat + learning record + export** | To-do items come only from evidence. Chat answers from the session. Export text is correct | |
| 9 | **Playground**: sandbox, edit-and-see, what-if, challenge, before/after preview | The user's tree is unchanged after any playground action unless "Apply" was confirmed | |
| 10 | **`watch`** for other agents | A Cursor edit produces a turn with a diff and a lesson | |
| 11 | **Teacher adapters**: Ollama, Gemini, OpenAI | Same `lesson.json` shape from each | |
| 12 | **MCP server** | An MCP client answers "what changed yesterday" from the store | |
| 13 | **Release**: npm publish, tagged releases, launch posts | `git tag` → npm + GitHub release, automatically | |
