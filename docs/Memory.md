# Memory

What has actually been built, newest first. Update this before ending a session.

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
