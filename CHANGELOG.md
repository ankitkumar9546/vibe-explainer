# Changelog

All notable changes. Versions follow [semver](https://semver.org); while it is 0.x, a minor version may change the store format.

## 0.1.1

**`watch` on a real project**
- Tool caches and agents' scratch copies are no longer recorded or snapshotted: `.claude/worktrees/` (Claude Code's subagent worktrees), `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`, `.tox/`, `.astro/`, `.svelte-kit/`, `.parcel-cache/`, `.expo/`, `.wrangler/`.
- Files your `.gitignore` ignores no longer start a turn or keep one open. Before, a cache written every few seconds meant the folder never went quiet, so `watch` never closed a turn.
- `sed -i` temp files (`sedAb12Cd`) are skipped like other editor temp files.
- After upgrading, the first prompt in a project that had one of those folders may show them as deleted once, because its "before" snapshot still held them.

## 0.1.0 (first release)

The first public release: everything an AI coding agent does in your project is recorded on your machine and explained like a teacher.

**Record**
- Claude Code plugin: hooks record every prompt, tool call and stop; `/vibe-explainer:explain` and `/vibe-explainer:console`.
- A shadow git repo snapshots the code before and after each prompt. Your project's own `.git` is never written to, and folders without git work too.
- `vibe-explainer watch` records agents without hooks (Cursor, Copilot, Aider…) by watching the files: each burst of edits becomes a prompt with a diff.

**Explain**
- A guided lesson in six steps: what happened, what changed, watch out, try it, to-do and a quiz. Hinglish or English, beginner or developer level.
- The agent's claims ("tests pass") are checked against what actually ran, and a claim without evidence comes with a prompt to fix it.
- The analyzer, with no dependencies, finds which functions changed and who calls them, which packages came or went (licence and size from npm or PyPI, can be turned off), and risky patterns in the new lines.
- The teacher is, by default, the same AI you code with, through its own CLI and your login (`claude`, `cursor-agent`, `codex`, `gemini`). Ollama, Gemini or any OpenAI-style API can be picked in the console's ⚙, with keys saved only on your computer.

**Console** (`vibe-explainer open`)
- A live timeline, logs, the diff, the wiring map, the impact, packages and security, the lesson, a to-do built from evidence, and your learning record.
- Ask the session a question, click a line of the diff to ask what it does, or explain it back and get checked.
- Playground: change the AI's code and run the project's own tests on a separate copy. Your files change only when you press Apply and confirm.
- Ready-made PR description, commit message and notes.

**Ask from anywhere**
- An MCP server (`vibe-explainer mcp`, also started by the plugin) answers "what changed yesterday?" or "what still needs checking?" from the local record, in any MCP app.

Requires Node.js 22+ and git.
