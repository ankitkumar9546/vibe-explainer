---
name: explain-session
description: Use when the user asks what you (the agent) changed or did in this project, why, what it can break, or whether your claims are true, and the vibe-explainer plugin is recording. It answers from the recorded evidence (events, diffs, lessons), not from memory.
---

# Explain this session from the record

vibe-explainer records this project's sessions under `~/.vibe-explainer/` (or `$VIBE_EXPLAINER_HOME`):

```
projects/<projectId>/sessions/<sessionId>/
  events.jsonl                 one JSON event per line: prompt, tool_start, tool_end, stop
  turns/<n>/turn.json          prompt, status, files changed (+/- lines)
  turns/<n>/diff.patch         what the prompt changed
  turns/<n>/lesson.json        the teacher's lesson, if one was written
```

How to answer:
1. Find the project: its `project.json` has `path` equal to the current working directory.
2. Take the newest session (by `session.json` `startedAt`) unless the user names another, and the turn they ask about (the latest by default).
3. Answer from `diff.patch` and `events.jsonl`. If `lesson.json` exists, use its `claims` and `impact` too.
4. Be honest about evidence:
   - If something isn't in the record, say "the record doesn't show that".
   - Never say tests passed unless a `tool_end` event shows a test command that succeeded.
5. Point to `/vibe-explainer:explain` for a full lesson and `/vibe-explainer:console` for the visual view.

Keep answers short and plain. If the user writes in Hinglish, answer in Hinglish.
