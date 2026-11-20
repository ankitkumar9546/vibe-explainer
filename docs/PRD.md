# vibe-explainer: Product Requirements

> Working name. Status: approved for build on 2026-11-20.
> The idea, the mockup rounds and the reasons behind each choice are in `docs/PLAN.md`.

## 1. Problem

People write code with AI agents (Claude Code, Cursor, Codex and others). The code arrives,
but the understanding does not. After a session the developer often cannot say:

- what the agent did, and in what order;
- what changed in the code, and why;
- what the change can break;
- whether the agent's final claims ("tests pass", "it's done") are true.

Beginners suffer most: they ship code they cannot explain, and learn nothing from it.

## 2. Product

A local console that records every step an AI coding agent takes and explains it the way a
teacher would: in plain language, visually, and checked against evidence.

It runs on the user's own machine. It is open source. It is not sold.

## 3. Users

| User | Situation | What they need |
|---|---|---|
| **New developer / student** (primary) | Builds with an AI agent, does not fully understand the result | A guided lesson for each prompt, a quiz, words explained, something to try by hand |
| **Working developer** | Reviews what the agent did before keeping it | Fast facts: timeline, diff, impact, claims checked, a to-do list |

The same console serves both through a **Beginner / Developer** switch. Text is available in
**Hinglish** and **English**.

## 4. Goals and non-goals

**Goals**
1. After any session, the user can explain the change in their own words.
2. The user never has to trust the agent's word: every claim is checked against the record.
3. Nothing leaves the user's machine except what the user's chosen teacher model receives.
4. One command to install. Useful within two minutes.

**Non-goals**
- Not a code editor or an agent. It never writes to the user's project on its own.
- Not a cloud service. There is no server of ours, no account, no telemetry.
- Not a replacement for code review tools or CI.

## 5. Features

Each feature lists where it shows in the console. The mockup is `docs/mockup/console.html`.

### 5.1 Record (no UI of its own)
- Record every prompt, tool call (read, edit, write, command) and reply, with time.
- Snapshot the code before and after each prompt without touching the user's git.

### 5.2 Per prompt ("turn") summary
- **Health card**: one verdict: *Safe to keep*, *Check first* or *Risky*, with the reasons.
- **What you asked for**: the prompt split into asks, each marked done / partly / not done, with evidence.
- **Claims check**: each claim in the agent's final reply is marked *backed*, *can't verify* or *no evidence*. A claim with no evidence shows as a red alert with **Run the tests** and **Copy fix prompt**.
- **Timeline**: a thin strip of every step. It opens into four channels: Thinking, Read, Edit and Run. Click any moment to see what happened then.

### 5.3 Beginner mode: a guided lesson in six steps
1. **What happened**: summary, why, how it works, before vs after, **why the agent chose this way**, and **errors on the way** (with how they were fixed).
2. **What changed**: each file's diff, with a plain-words note beside each part. **Click any line to ask what it does.** Each part has **Edit and see**.
3. **Watch out**: impact (what else uses the changed code, and how risky that is), **fix prompts** to copy, **packages and security**, and a **wiring map**.
4. **Try it yourself** (playground, in a sandbox):
   - *Change it and see*: edit the code, run lint and tests in the sandbox, read the teacher's take, compare with the agent's version. Then apply to the project (with confirmation), turn the edit into a prompt, or throw it away.
   - *What happens if…?*: guess first, then see the real result.
   - *Your turn*: a small challenge with tests, three hints, then the solution.
   - *Before vs after, on screen*: the app before the agent, after it, and after your edit.
5. **To-do**: a tick list built from unbacked claims, risks and security notes, plus manual test steps and what you should see.
6. **Quiz**: concepts, questions, and "explain it in your own words".

### 5.4 Developer mode
The same content as tabs: Live, Logs, Changes, Wiring, Impact, Playground, To-do, Learn.

### 5.5 Across the session
- **Learning record**: every concept met, marked *Solid*, *Needs revision* or *No quiz yet*, with a revision quiz.
- **Export**: PR description, commit message, "today's note".
- **Project map**: main areas of the project and what today's session touched.
- **Ask this session**: a chat that answers from the session record.
- **Glossary**: technical words explained when you hover over them.
- **Light and dark theme**: follows the system the first time, then remembers the user's choice.

## 6. Where it runs

| Source | How it records | What it gets |
|---|---|---|
| Claude Code | Plugin: hooks + transcript | Everything (prompts, thinking, every tool call) |
| Any other agent (Cursor, Codex, Copilot…) | `npx vibe-explainer watch`: file watcher + git snapshots | What changed, not why |
| Any MCP-capable app | MCP server | Questions about past sessions |

**Teacher model**: `claude -p` by default (the user's own Claude plan, no API key). It can be
switched to Ollama (fully local), Gemini or an OpenAI key.

## 7. Requirements that hold everywhere

| # | Requirement |
|---|---|
| R1 | Never write to the user's branch, index, commits or files without an explicit click and a confirmation. |
| R2 | A hook must never block or slow the agent: it returns in under 100 ms and always exits 0. One exception: the prompt hook takes the "before" snapshot synchronously, so it is guaranteed to come before any edit. This takes a few hundred ms. |
| R3 | The teacher's own `claude -p` run must not be recorded (no loop). |
| R4 | Secrets (`.env`, keys, tokens) are masked before anything goes to a teacher model. |
| R5 | All data lives under `~/.vibe-explainer/` (override: `VIBE_EXPLAINER_HOME`). Nothing is written into the user's project. |
| R6 | Works on Windows, macOS and Linux. No native compile step. |
| R7 | Teacher work has an `auto` and a `manual` mode, so the user controls how much of their model usage it spends. |
| R8 | Every claim the console makes about the code is traceable to a recorded event or the diff. |

## 8. Success

- A new user installs and sees their first lesson within 2 minutes.
- On 10 recorded real sessions, a reviewer rates 8+ lessons "correct and understandable".
- Zero cases of the tool changing the user's project unasked.
- The public repo has a working live demo (GitHub Pages) that needs no install.

## 9. Open decisions (Ankit)

| # | Decision | Default until decided |
|---|---|---|
| 1 | Final name | `vibe-explainer` |
| 2 | Licence | MIT (proposed). No `LICENSE` file is added until he agrees |
| 3 | When the repo goes public | After Phase 5 (first demo) |
| 4 | npm account for publishing | Needed by Phase 12 |
