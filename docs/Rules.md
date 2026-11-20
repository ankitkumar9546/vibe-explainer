# Rules

Non-negotiable. They protect the user's code and trust.

1. **Never touch the user's project unasked.** Do not write to their files, index, branch or commits. The only path is a playground "Apply" that the user confirms (PRD R1).
2. **Hooks never hurt the agent.** Return fast and always exit 0. Do heavy work in a detached process (R2).
3. **No recording loops.** Anything the tool itself runs (`claude -p`, sandbox commands) sets `VIBE_EXPLAINER_INTERNAL=1` (R3).
4. **Mask secrets before any model sees them** (R4).
5. **Data only under `~/.vibe-explainer/`** (R5).
6. **No native builds.** Use pure JS or WASM only (R6).
7. **Change `docs/DataFormat.md` in the same commit as any change to an event, file or lesson field.**
8. **One phase at a time** (`docs/Roadmap.md`). A phase is done when its checks pass.
9. **Never create an empty placeholder file.** Create a file when you put working code in it.
10. **Update `docs/Memory.md` before ending a session.**
11. **The console never claims what the record cannot show.** Unknown is shown as unknown.
12. **Build only what Ankit picked.** No unasked features or sections.
