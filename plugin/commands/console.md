---
description: Open the vibe-explainer console in the browser (live timeline, diff, lessons)
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/packages/cli/bin/vibe-explainer.js" open . --detach`

Tell the user the console is open in their browser and give them the link above. Two notes for them:
- Only their own computer can open it.
- On Windows it closes when this Claude Code session ends. `vibe-explainer open` in a terminal keeps it running on its own.
