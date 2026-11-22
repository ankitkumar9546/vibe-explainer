# Launch posts (drafts)

Drafts for the first release (0.1.0). Post them after `npm install -g vibe-explainer` works, and
read each one again on the day: change anything that no longer matches the README.

Links used below:
- Repo: https://github.com/ankitkumar9546/vibe-explainer
- Live demo: https://ankitkumar9546.github.io/vibe-explainer/
- GIF: `docs/media/demo.gif` (attach it where the platform allows images)

---

## LinkedIn

I built an open-source tool for a problem I kept running into: an AI coding agent changes 12 files, says "done, tests pass", and I press accept without really knowing what happened.

**vibe-explainer** records everything the agent does in your project and explains it like a teacher:

→ a timeline of every step it took
→ the diff in plain words, and which other code calls what it changed
→ its claims checked against the evidence: did the tests actually run?
→ a to-do of what still needs checking, built from evidence only
→ a playground to change the AI's code and run your tests on a separate copy
→ a short quiz, in English or Hinglish

It works with Claude Code as a plugin, and with Cursor, Copilot or Aider through a file watcher. By default the teacher is the same AI you already code with; you can switch to Ollama, Gemini or an OpenAI-style API. Everything stays on your machine.

There's a live demo of a real recorded session, with nothing to install: https://ankitkumar9546.github.io/vibe-explainer/

Code (MIT): https://github.com/ankitkumar9546/vibe-explainer

Feedback welcome, especially from people learning to code with AI agents.

#opensource #ai #developertools #claudecode

---

## X / Twitter (thread)

1/ I built vibe-explainer: it records what your AI coding agent did and explains it like a teacher.

Timeline, the diff in plain words, who calls the code that changed, and "tests pass" checked against what actually ran.

Live demo, nothing to install: https://ankitkumar9546.github.io/vibe-explainer/

2/ Works with Claude Code as a plugin. Cursor, Copilot and Aider through `vibe-explainer watch`.

The teacher is the same AI you code with by default. Or Ollama, Gemini or any OpenAI-style API. Everything stays on your machine.

3/ Also: a playground to change the AI's code and run your tests on a copy, a to-do built from evidence, and an MCP server so you can ask "what changed yesterday?"

`npm install -g vibe-explainer`
https://github.com/ankitkumar9546/vibe-explainer

---

## Reddit (r/ClaudeAI)

**Title:** I built a Claude Code plugin that explains what Claude changed, like a teacher (open source)

When Claude Code finishes a big prompt, I often don't know what it actually did. So I built vibe-explainer. It records every prompt, tool call and file change through hooks, and then gives you:

- the diff in plain words, plus which functions changed and who calls them;
- Claude's claims ("tests pass") checked against what actually ran;
- a to-do of what still needs checking;
- a playground to tweak the change and run your tests on a separate copy;
- a short quiz (English or Hinglish).

The lesson is written by `claude -p` with your own login, so there is no API key. Your project's `.git` is never touched: snapshots go to a separate shadow repo under `~/.vibe-explainer`.

Install:
```
/plugin marketplace add ankitkumar9546/vibe-explainer
/plugin install vibe-explainer@vibe-explainer
```

Demo of a real session: https://ankitkumar9546.github.io/vibe-explainer/
Repo: https://github.com/ankitkumar9546/vibe-explainer

It's early. I'd love to hear what breaks.

---

## Show HN

**Title:** Show HN: vibe-explainer – see what your AI coding agent changed, explained like a teacher

**First comment:**

I use AI coding agents a lot, and I noticed I was accepting changes I couldn't explain. vibe-explainer records what the agent does (Claude Code through hooks; other agents through a file watcher) and builds a lesson from the evidence.

How it works:
- A shadow git repo snapshots the code before and after each prompt. Your own `.git` is never written to.
- A small analyzer with no dependencies finds the changed functions, their callers (via `git grep` on the snapshot), new packages and risky patterns.
- The teacher model writes the lesson only from that record. Claims like "tests pass" are marked backed or unbacked by what actually ran.
- The local console has a playground. It runs your tests on a separate copy of the changed code, and writes to your files only when you press Apply and confirm.

By default the teacher is the agent's own CLI (`claude -p`, `codex exec`, `gemini -p`, `cursor-agent`), so it needs no extra key. Ollama is supported for fully local use.

Node 22+, MIT. Demo: https://ankitkumar9546.github.io/vibe-explainer/
