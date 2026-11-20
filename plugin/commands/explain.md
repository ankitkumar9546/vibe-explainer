---
description: Explain the last finished prompt like a teacher (writes a lesson with your own claude)
argument-hint: "[--lang hi|en] [--level beg|dev] [--turn N]"
allowed-tools: Bash(node:*)
---

The user wants a lesson for the work you did in this project. Run the vibe-explainer teacher. It takes about a minute and uses the user's own Claude plan:

!`node "${CLAUDE_PLUGIN_ROOT}/packages/cli/bin/vibe-explainer.js" explain $ARGUMENTS`

Show the result to the user as it is. Keep the title, the summary and the list of claims, with each claim's status. Do not add your own claims about the work.
- If any claim is `[none]`, say plainly that the record has no evidence for it.
- Tell them they can see the full lesson (diff, impact, quiz) with `/vibe-explainer:console`.
- If the command failed, show the error and say what it means. The usual cases: nothing recorded yet, or the prompt has not finished.
