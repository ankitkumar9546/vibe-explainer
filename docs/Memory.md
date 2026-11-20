# Memory

What has actually been built, newest first. Update this before ending a session.

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
