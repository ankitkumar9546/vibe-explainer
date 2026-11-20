# AGENTS.md: vibe-explainer

Instructions for any AI tool or new contributor.

## Read these first, in this order
1. `docs/Memory.md`: what has been built and the state right now.
2. `docs/Roadmap.md`: the next phase and its checks.
3. `docs/Rules.md`: non-negotiable.
4. `docs/DataFormat.md`: read it before touching events, files or lessons.
5. `docs/Architecture.md`, `docs/PRD.md`, `docs/Design.md` (and `docs/mockup/console.html`), as needed.

`docs/PLAN.md` is the original idea write-up, in Hinglish, kept as history.

## Layout
```
packages/core      recorder, store (later: snapshot, analyzer, teacher, sandbox, server)
packages/cli       the vibe-explainer command (bin/vibe-explainer.js)
tests/             node:test suites (npm test)
docs/              planning docs and the approved console mockup
```

## Working rules
- ES modules, Node 20+, no build step for core/cli, no native dependencies.
- `npm test` must pass before a commit. Verify a phase against real Claude Code, not just fixtures.
- Recording is tested with `VIBE_EXPLAINER_HOME` pointing at a temp folder, never the user's real store.
- Update `docs/Memory.md` before ending a session.
