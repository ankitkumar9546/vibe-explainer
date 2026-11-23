# Memory

What has actually been built, newest first. Update this before ending a session.

## 2026-11-23: v0.1.0 released

- Tag `v0.1.0` → `release.yml` → **vibe-explainer@0.1.0 on npm** (provenance) and the GitHub release with the tarball and CHANGELOG notes. README now installs from npm (`npm install -g vibe-explainer`, MCP via `npx -y vibe-explainer mcp`).
- Two failures fixed on the way: `npm publish dist/vibe-explainer-0.1.0.tgz` was read as a GitHub `user/repo` (now `./dist/…`); the first token lacked the 2FA bypass and npm asked for an OTP (EOTP). Ankit made a new granular token with the bypass and replaced the `NPM_TOKEN` secret; the run was re-run, no new tag.
- npm now holds a brand-new package as a **staged release**: the registry showed only a `0.0.0-stage` placeholder until it was approved; then `latest` became 0.1.0.
- Checked from npm: `npm install -g vibe-explainer@0.1.0` into a scratch prefix on D:, then `--version`, `vibe-explainer-mcp` initialize, and `open` serving the console.
- A token was once pasted into chat; Ankit was told to delete it on npm (all old tokens deleted when the new one was made).
- **Next, by Ankit:** the launch posts in `docs/Launch.md`.

## 2026-11-22 (night): Phase 13, release (built; first tag waits)

- Ankit kept the name **vibe-explainer**; on npm, `vibe-explainer` and the `@vibe-explainer` names were all free (404) on 11-22.
- **One npm package, not four:** the packages import each other by relative path, so `scripts/pack-npm.mjs` stages `packages/` as it is into `dist/npm` (gitignored), checks every relative import stays inside, and writes the manifest (bins `vibe-explainer`, `vibe-explainer-mcp`; no dependencies).
- Version in one place, `packages/core/src/version.js` (0.1.0). `vibe-explainer --version` added. `CHANGELOG.md` started. `release.yml`: tag `v*` → tests → tag check → `npm publish --provenance` → GitHub release with the tarball and the CHANGELOG section.
- `docs/Launch.md`: drafts for LinkedIn, X, r/ClaudeAI and Show HN.
- **Checked:** `npm test` 69/69 (new `release.test.js`: one version everywhere, tag check, staged package self-contained and its two commands run). `npm publish --dry-run`: 51 files, 428 kB packed (372 kB of it fonts). The tarball installed with `npm install -g --prefix` on D:, then `--version`, `open` serving the console, `vibe-explainer-mcp` answering, `init` writing hooks that point at the installed copy, and a real `claude -p` turn recorded through them (`M a.txt +1 -0`).
- **Waits on Ankit:** an npm account (2FA on), a granular access token that can publish, saved as the repo secret `NPM_TOKEN`. Then: README gets the npm install line, tag `v0.1.0`, push; the workflow publishes. The launch posts go out after that, by him.

## 2026-11-22 (evening): Phase 12, MCP server

- `packages/mcp`: a hand-written stdio MCP server, with no SDK because plugin installs have no `npm install`. Tools: `recent_changes`, `get_turn`, `search`, `open_todos`, `list_projects`. It is declared in `plugin.json` `mcpServers` and available as `vibe-explainer mcp`. `claude plugin validate` passes.
- **Checked:**
  - `npm test`: 66/66. New tests: local-day windows (yesterday, a date, last_24_hours); the protocol handshake, notifications and errors; `recent_changes('yesterday')` returns exactly yesterday's prompt; get_turn, search and open_todos; a planted key masked; a real stdio child answering line by line, with nothing else on stdout.
  - Real: `claude -p` as the MCP client on a store merged from the Phase 6, 9 and 10 scratch projects. "What did my AI coding agents change yesterday?" was answered in Hinglish, per project, in 16 s, including an `innerHTML` security note found on demand.
- Bug found by the tests, then fixed: `since: "2026-11-14"` was turned into `2026_11_14` before the date check.
- **Next:** Phase 13, release (npm publish, tagged releases, launch posts). It needs Ankit: the final name, and an npm account.

## 2026-11-22 (later): Phase 11b, choose the AI (Ankit's ask)

- Ankit wanted an option: by default the same AI you code with, or your own model. He chose:
  - keys **saved locally**;
  - **Cursor, Codex and Gemini CLI** as agent teachers, besides claude.
- Built:
  - `teacher: agent` is the new default. It resolves per session (`resolveAgentTeacher`, `teacherForSession`) and falls back to claude.
  - `teacher/agentcli.js`: codex, gemini-cli, cursor.
  - `keys.js`: `keys.json` is owner-only; the environment wins; only the last 4 characters are shown.
  - `/api/settings` and `/settings/test`.
  - CLI `key gemini|openai [--remove]`, which reads the key from stdin so it stays out of shell history.
  - The ⚙ panel in the console.
- **Checked:**
  - `npm test`: 61/61. New tests cover agent resolution and fallback; the CLI calls (prompt on stdin; codex's last-message file); keys (env wins, hint only, removed file); and settings never returning a key.
  - Driven in Edge over CDP: "the same AI" resolved to claude for a watch session, and **Test answered OK from the real claude (7.4 s)**. Own model → OpenAI-style at 127.0.0.1:9 with a fake key: it saved as "…wxyz", Test showed "not reachable", the key was removed and the file deleted. `icacls` on keys.json shows only `MORTIS\Ankit:(F)`.
  - Fixed on the way: the ⚙ icon looked like the theme's sun; a long provider name widened the page to 519 px on a phone; a failed test didn't name the teacher.
- **Not checked:** codex, gemini and cursor-agent themselves (none is installed here).

## 2026-11-22: Phase 11, teacher adapters

- `core/src/teacher/adapters.js`: `ollamaTeacher`, `geminiTeacher`, `openaiTeacher` (works with any OpenAI-compatible base URL) and `makeTeacher(config)`. The CLI and server now go through `makeTeacher` everywhere: lessons, chat, explain-back, playground and watch.
- Config: `teacher claude|ollama|gemini|openai`, `ollamaUrl`, `openaiBaseUrl`. Keys come only from the environment.
- The console's notes name the teacher and its cost (`/api/session` returns `teacher`).
- **Checked:**
  - `npm test`: 57/57. Each adapter, given its provider's response shape (Ollama over a real local HTTP server), produces the same validated lesson fields.
  - Request URL, header and body per provider; the key is never in the URL; a local OpenAI-compatible server is allowed without a key.
  - Clear errors for: no key, a 401, Ollama unreachable, Gemini blocked.
  - From the CLI: "Ollama (qwen2.5-coder:7b) is not reachable (ECONNREFUSED)" and "Gemini needs an API key: set GEMINI_API_KEY…".
- **Not checked:** a real model answering. Ollama is NOT installed on this machine: its folder is on PATH but `ollama.exe` is missing. There are no Gemini or OpenAI keys. Waiting on Ankit to install Ollama on D: or provide a key.
- **Next:** Phase 12, the MCP server.

## 2026-11-21 (late night): Phase 10, watch

- `core/src/watch.js` `startWatch()` and the CLI `watch [dir] --agent --quiet`. Turns come from bursts of file changes. Before = the previous snapshot. A typed line names the prompt, and an empty line ends the turn now. Temp and ignored paths are skipped, and an unchanged tree is dropped.
- The teacher prompt, to-do and health know a watch turn can't see commands. The console shows `file_change` as Edit steps.
- **Checked:**
  - `npm test`: 53/53. New tests: a turn from changes with the typed prompt; same bytes or ignored paths make no turn; turn 2 diffs from turn 1; a real `fs.watch` run; the teacher and to-do rules.
  - Real: no Cursor/Codex/Copilot CLI is on this machine, so the outside agent was `claude -p` **without** the plugin or hooks. `watch` recorded its edit as turn 1. The first try showed `calc.py.tmp.12796.…` atomic-save files: now filtered, and each file is shown once per turn. The lesson: "The record does not show whether the tests were run." Console health: "Watch can't see whether tests ran".
- **Ankit to try:** a real Cursor session with `watch`.
- **Next:** Phase 11, teacher adapters (Ollama, Gemini, OpenAI).

## 2026-11-21 (night): Phase 9, playground

- `core/src/sandbox.js` (sandbox from a snapshot, dependency links, runs, apply guard) and `core/src/teacher/playground.js` (what-if + challenge, edit take, line diff). Server: `/api/sandbox`, `/api/file`, `/api/sandbox/{allow,run,playground,apply,discard}`, `/preview/…`.
- **Changed from the plan:** a sandbox is a folder filled from the shadow repo, not a git worktree. Junction removal is careful: unlink first, then check, then delete (memory: a worktree with a junction once wiped a real `node_modules`).
- **New guard for every POST:** JSON content-type and a same-origin check. The console now always sends JSON.
- The guided lesson has the mockup's **6 steps**: What happened, What changed, Watch out, **Try it**, To-do, Quiz. Developer tabs gain Playground.
- Real check (scratch project `vx-p9`: notes.js + a test + index.html). A real `claude -p` added `deleteNote` and a Delete button. Its test commands were blocked, so the agent never ran the tests. Then, driven in headless Edge over CDP:
  - Allow → editing `deleteNote` to drop the guard → real `npm test` failed (`actual: true, expected: false`), and the teacher explained `splice(-1, 1)`.
  - The apply confirm was shown, then cancelled. "Just for learning" cleared the sandbox.
  - "Make the questions": 2 what-ifs; one run for real (the test failed, as the teacher expected).
  - The challenge (`updateNote`) came with the teacher's test, which failed on the untouched file.
  - The preview showed before (no Delete), after (Delete) and yours.
  - **The project's hash was identical before and after.** All the sandboxes were cleaned up.
- **Found and fixed on the way:**
  - The sandbox's `node --test` inherited `NODE_TEST_CONTEXT` from our own test runner and reported a pass.
  - Module scripts in the opaque-origin preview needed `access-control-allow-origin`.
  - The output gist now shows the lines that failed, not the stack trace.
  - Six step chips and the record button now fit at 390 px.
- `npm test`: 49/49.
- Not done: the playground in the static demo (it needs the local tool, and says so). The what-ifs are written in the language that was active when they were made.
- **Next:** Phase 10, `watch` for other agents.

## 2026-11-21 (evening): Phase 8, to-do + chat + learning record + export

- New core modules: `todo.js`, `export.js`, `learning.js`, `teacher/chat.js`.
- New endpoints: `/api/export`, `/api/record`, `POST /api/quiz`, `POST /api/chat`, `POST /api/explain-back`. `/api/turn` now also returns `todo` and `quiz`.
- CLI: `export --kind pr|commit|note`.
- Console:
  - The guided lesson has **5 steps**: To-do sits before Quiz, and the manual test moved into To-do.
  - Developer tabs gain To-do.
  - Chat panel; click a diff line to ask about it; "Explain it in your own words" in Quiz; "Learning record & export" in the rail.
- **Bug fixed from Phase 7.** The glossary's regex escape was `"\\function learn() {"` instead of `"\\$&"`: a `String.replace` `$&` slip in the patch script. Plain words worked, but `try/catch` and `.json` terms would not. The patch scripts now use function replacements.
- Also fixed: the timeline strip ignored `hidden` (its `display:grid` won), and on phones the chat button covered "Next".
- Demo data now carries `todo` per turn, the three exports in both languages, and the learning record with every concept at "new". Visitors' quiz answers are not shared.
- **Checked:**
  - `npm test`: 41/41. The 10 new tests cover: to-do sources one by one; exact PR/commit/note text; quiz save, first-answer rule and reset; record statuses; masked chat record; explain-back retry; the server endpoints.
  - Driven in headless Edge over the DevTools protocol (`scratchpad/cdp.mjs`), with real clicks against the real server and the real `claude` on the Phase 6 scratch turn:
    - **Ask-a-line**, in Hinglish. It named `LoginPage.js:4` and `SignupPage.js:6` from the code scan.
    - **Chat** ("What could this break?"), grounded in the record with file and line.
    - **Explain-back**: "Partly right", and it listed zod and the two pages as missed.
    - To-do tick, PR and commit exports, and the record after a wrong quiz answer ("Needs revision").
  - Light and dark, 1440 px and 390 px.
  - Static demo: chat shows the demo note; record and day-note export work.
- **Next:** Phase 9, the playground.

## 2026-11-21 (later): Phase 7, guided lesson

- Beginner level = the mockup's guided lesson: a stepper with **4 steps** (What happened, What changed, Watch out, Quiz). The mockup has 6. "Try it" (playground) comes with Phase 9 and "To-do" with Phase 8. Until then the manual test sits at the end of Quiz.
- Header for both levels:
  - **Health** from evidence only: test runs and their result, claims with no evidence, risk from the lesson's impact (or the analysis when there is no lesson), and security findings.
  - **What you asked for.**
  - **Claims bar.** It turns into a red alert when a claim has "no evidence", with a generated fix prompt to copy.
- Watch out = the lesson's impact items (risk meter, where, why, what to do, fix prompt) + packages and security + the wiring map.
- Glossary: built-in words + the lesson's concepts, as dotted-underline tooltips. Code is never touched.
- Developer level keeps the tabs. Learn now reuses the step renderers. Asks and claims moved up into the header.
- Not built (needs a teacher round-trip, so Phase 8): the mockup's "explain it in your own words" box and "ask about a line".
- **Checked** on the real Phase 6 lesson (scratch store):
  - Steps 1–4 in light and dark at 1440 px. At 390 px, 4 chips sit in the bottom bar.
  - The no-evidence alert: one claim was set to "none" in a scratch copy, then restored.
  - The no-lesson view: write button + diff.
  - Developer → Learn.
  - The static demo opens in guided mode ("Safe to keep": its tests ran and passed).
- `npm test`: 31/31. There are no console unit tests; the console is checked by screenshots.
- **Next:** Phase 8, to-do + chat + learning record + export.

## 2026-11-21: Phase 6, analyzer

- `core/src/analyzer/`: `symbols.js`, `security.js`, `packages.js`, `index.js`. It writes `analysis.json` per turn (DataFormat §4), lazily, the first time the console, `explain` or `analyze` asks.
- **Changed from the plan: no tree-sitter.** The plugin install has no `npm install`, so WASM grammars would have to live in git. A brace/indent scanner for JS/TS and Python is enough for line ranges, and callers come from `git grep` on the shadow repo's "after" snapshot (Architecture §3.4).
- New: `vibe-explainer analyze [dir] [--json] [--offline]` and the setting `registry on|off` (default on: npm and PyPI lookups for added packages, sending only the package name).
- Console: **Wiring** and **Impact** tabs, built from the mockup's round 3 and round 6 styles. Impact has risk, reasons, "where it is used", a copyable fix prompt, then "Packages and security".
- The teacher gets the analysis as a STATIC ANALYSIS section and starts its impact list from it.
- The demo data now carries the analysis. The site is rebuilt.
- **Checked:**
  - `npm test`: 31/31 pass. The 9 new tests cover: JS/Python symbols; a changed function's callers; a removed function still called is risk 3; a Python method with a tested caller is risk 2; packages with a stubbed registry; a planted key flagged and masked; `.env` values never stored.
  - **Real `claude -p --plugin-dir` turn** in a scratch project: "login() takes a password, add zod". `analyze` found `login` modified `(email) -> (email, password)`, risk 3, used by `LoginPage.js:4` (onLoginSubmit) and `SignupPage.js:6` (onSignupSubmit). `zod` came back MIT, 651 KB, 475M downloads/week from the live registry, in 271 ms plus the lookup.
  - A real lesson on that turn (36 s) listed both pages as risk 3 impact items, by file and line.
  - Screenshots: Wiring and Impact in light and dark, at 1440 px and at 390 px (the bottom tab bar fits 6 tabs; the map scrolls inside its card). Demo site: Wiring and Impact render from the static data.
- **Next:** Phase 7, the guided lesson (6 steps, health, glossary).

## 2026-11-20 (night): public + live demo

- Ankit made the repo **public** and set Pages to GitHub Actions. My own attempt to change the visibility was blocked by the permission system, so he ran it himself.
- Checked before going public:
  - Commits use the GitHub noreply email.
  - No secrets in any file. The only key-like strings are the fake ones in the tests.
  - The demo data has no name and no email.
- The `pages.yml` run (workflow_dispatch) deployed. **Live demo: https://ankitkumar9546.github.io/vibe-explainer/**. `index.html`, `demo-data.json`, `app.js` and the fonts all return 200, and a screenshot of the live page shows the real lesson.
- **Next:** Phase 6, the analyzer (wiring, impact, packages, security scan).

## 2026-11-20 (late night): first demo built

- **Demo session (real):** a small `notes` project (`createNote`, `getNote`, `listNotes`, one node test) was made in scratch.
  - Two real `claude -p --plugin-dir` prompts in one session: (1) title validation, tests added and run; (2) `deleteNote(id)` with tests.
  - Real English lessons for both. Turn 1 got 10 claims (9 backed, 1 unverified). Turn 2 got 8 claims (7 backed, 1 unverified). The agent ran the tests both times, so "tests pass" is backed.
- `demo/demo-data.json` (49 KB): scrubbed, with no name, AppData or scratchpad path. The build refuses to run if one remains.
- Static console mode, `assemble-site`, `serve-static` and the `pages.yml` workflow, which is skipped while the repo is private.
- `docs/media/demo.gif` (302 KB, 6 frames: Live and timeline, Changes, Learn, claims, dark Changes, dark Learn), plus stills. The README shows the GIF and links the Pages demo.
- **Checked:**
  - The site served locally renders in English (the default for the demo) in light and dark.
  - Mobile at a true 390 px (iframe method) has no overflow.
- **Waits on Ankit:** making the repo public. That turns on Pages (Settings → Pages → Source: GitHub Actions) and lets strangers use the marketplace install.

## 2026-11-20 (late): Phase 5, Claude Code plugin

- `.claude-plugin/plugin.json` and `marketplace.json` are at the repo root (source `./`). The plugin's parts live in `plugin/`: `hooks/hooks.json`, `commands/explain.md`, `commands/console.md` and `skills/explain-session/SKILL.md`.
- The CLI now imports core by relative path, so an installed copy needs no `npm install`.
- New CLI pieces:
  - `baseline` (started detached by `SessionStart` the first time a project is seen).
  - `open --detach`, plus reuse of a running console through `~/.vibe-explainer/server.json`.
  - `explain` searches across sessions and skips `/vibe-explainer…` prompts.
- **Found in the real check, then fixed:**
  - The `!` command with `"$(pwd)"` was refused by Claude Code's permission check ("quoted text can't be checked"). The commands now use no `$(…)`.
  - `/explain` opens its own session, so `explain` used to look only at that new, empty session.
- **Checked:**
  - `claude plugin validate .`: passes, with optional warnings left (no icon; CLAUDE.md at the root is for contributors).
  - A real `claude -p --plugin-dir D:\vibe-explainer` run in a fresh git project with no `init` recorded 8 events, and the diff was `greet.py +4 −0`.
  - A real `/vibe-explainer:explain --lang en` wrote the lesson, and Claude showed the claims (4 backed, 1 unverified).
  - `open --detach` started the console, and a second call reused it.
  - `npm test`: 22/22 pass.
- **Not checked yet:** the 2-command marketplace install from GitHub. The repo is private, so it works only for Ankit's account. It goes public on his yes.
- **Next:** the first demo. README GIF, a GitHub Pages demo from a real session, and the repo going public (Ankit decides).

## 2026-11-20 (night): Phase 4, console v1

- **Server** (`core/src/server.js`): localhost only, token, Host allow-list, JSON API, SSE stream, `POST /api/explain`, and auto-teach while open (`mode=auto`).
- **Console** (`packages/console/`, no build step): it follows the approved design (`docs/Design.md`).
  - Header: project and session pickers, REC pill, theme switch, Hinglish/English, Beginner/Developer.
  - Prompt rail on the left.
  - Timeline (thin, opens to four channels, drag to scrub, claim pins).
  - Tabs: Live, Logs, Changes (diff with line numbers, plus the lesson's notes beside it) and Seekho. Seekho renders the full lesson: asks, claims with timeline jumps, why, how, before/after, decision, errors, impact with copyable fix prompts, concepts, quiz and manual test, plus a "Lesson banao" button.
  - The fonts are self-hosted.
- CLI: `vibe-explainer open [dir] [--port N] [--no-browser]`.
- **Bug found by the real check, then fixed:**
  - What happened: on Windows a detached `finish-turn` was killed when `claude -p` exited, so the "after" snapshot failed (`update-ref`).
  - Fix: "after" and the diff now run synchronously in the Stop hook, which took 0.39 s measured.
  - A successful retry also clears an old `snapshotError`.
  - The manual `finish-turn` repair compares against the files as they are now, so a late repair includes any later changes.
- **Checked:**
  - `npm test`: 22/22 pass (adds the server's token, host, path and stream tests).
  - Real `claude -p` runs with the console open. Every step arrived over the stream within about 0.5 s, and then "closed +diff".
  - Screenshots with real data: Seekho in light, Changes and Logs in dark, Live in light.
- **Next:** Phase 5, the Claude Code plugin (hooks, `/explain`, `/console`, skill). Then the first demo, and the repo goes public on Ankit's yes.

## 2026-11-20 (evening): GitHub, CI, Phase 3 teacher

- **GitHub:** `ankitkumar9546/vibe-explainer`, **private** until the Phase 5 demo and Ankit's yes. Ankit asked that every commit be pushed.
- **CI:** the first run was green on Windows, macOS and Linux. It now tests Node 22 and 24 (Node 20 has reached end of life), with actions v5. The packages require Node `>=22`.
- **Phase 3, teacher:** `core/src/teacher/` has `mask`, `context`, `lesson`, `claude` and `teach`, plus `core/src/config.js`. The CLI has `explain [dir] [--turn --session --level --lang]` and `config [set k v]`. Mode defaults to `manual` (Ankit's Claude usage). `auto` teaches in `finish-turn`.
- **Checked:**
  - `npm test`: 20/20 pass, covering masking, JSON extraction and validation, the context with transcript words, the retry-then-fail path, and a planted key never reaching the teacher.
  - A real `explain` on the recorded "add add()" turn wrote a valid lesson in 45 s, in Hinglish, with 6 claims checked (5 backed, 1 unverified), 2 impact notes and 3 quiz questions.
  - The teacher run was not recorded (session count 2 before and after).
- **Note:** that turn's `diff.patch` was written before the CRLF fix, so the lesson mentions a `}` line. The teacher correctly called it a possible line-ending difference.
- **Next:** Phase 4, Console v1 (server + Live, Logs, Changes, Learn from real data).

## 2026-11-20 (later): Phase 2, snapshot + diff; MIT licence

- Ankit chose the **MIT** licence (`LICENSE`, © 2026 Ankit Kumar).
- **Design change (recorded in Architecture §3.3):** snapshots live in a per-project **shadow bare repo** (`~/.vibe-explainer/shadow/<projectId>.git`) with the project as the work tree, for git projects too. The project's `.git` is never written. The first plan was a temporary index inside the user's repo; dropped because it still writes objects and refs into their repo.
- `core/src/snapshot.js`: `takeSnapshot`, `diffSnapshots` (with `--ignore-cr-at-eol`, line-ending-only files dropped), a lock, default excludes, and the project's `.git/info/exclude` copied in.
- `core/src/turns.js`: `snapshotBefore` (synchronous, in the prompt hook) and `finishTurn` ("after" + `diff.patch` + `turn.files`).
- Recorder: `onTurnOpened` / `onTurnClosed` callbacks. The CLI starts a detached `vibe-explainer finish-turn <projectId> <session> <turn>` after Stop.
- `init` takes a baseline snapshot (239 ms on the test project). `status` shows each turn's files.
- **Checked:**
  - `npm test`: 14/14 pass.
  - Real `claude -p` in a git project: "add an add() function" → `turn.files` = `app.js +4 −0`, and `diff.patch` matches `git diff`.
  - The project's `.git` was byte-identical before and after, and `git status` was unchanged apart from the agent's own edit.
  - The first run showed a CRLF-only line as changed; that was fixed and re-checked on the same turn.
- **Next:** Phase 3, the teacher (`claude -p` adapter, schema, secret masking, no loop).

## 2026-11-20: docs, Phase 0, Phase 1

**Decided with Ankit (in chat):**
- The product is open source, for his portfolio and job search, and is not sold.
- Primary users are new developers and students.
- The look is "Friendly learning app, calm" (`docs/Design.md`). Rejected: "Flight Recorder" (grey paper), and the first, more vibrant version of the learning-app look.
- Features: everything in `docs/PRD.md` §5. Every one was picked by him from proposed options, across mockup rounds 3 to 6.
- Folder: `D:\vibe-explainer`, its own git repo, separate from ZXEVO.

**Built:**
- Docs: PRD, Architecture, DataFormat, Design, Roadmap, Rules, AGENTS.md, README.
- Phase 0: npm workspaces (`packages/core`, `packages/cli`), `node --test`, and a CI workflow for 3 OSes × Node 20/22. CI hasn't run yet because there is no GitHub repo.
- Phase 1, the recorder: `vibe-explainer hook | init [--remove] | status`.
  - `recordHook()` turns six Claude Code hook kinds into events (`docs/DataFormat.md` §2), and opens and closes turns.
  - Long strings are cut at 4,000 characters.
  - The `VIBE_EXPLAINER_INTERNAL=1` guard is in place.
  - The hook always exits 0, and logs errors to `~/.vibe-explainer/errors.log`.

**Checked:**
- `npm test`: 9/9 pass.
- Real Claude Code. `claude -p` ran in a scratch project after `init`, with `VIBE_EXPLAINER_HOME` set to a scratch folder. It recorded session_start → prompt → Write start/end → Read start/end → stop → session_end, all in turn 1, and the turn closed. No errors were logged. Tool start to end took about 140 ms, including the tool itself.

**Open (Ankit):**
- Name.
- Licence (MIT proposed; there is no LICENSE file yet).
- Creating the GitHub repo, and when it goes public.
- An npm account, needed later.

**Next:** Phase 2, snapshot + diff (`docs/Roadmap.md`).
