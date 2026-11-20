# vibe-explainer

**See what your AI coding agent did, explained like a teacher.**

You asked an AI agent to write code. It did. But what exactly did it change, why, what can
that break, and is "tests pass" actually true? vibe-explainer records every step the agent
takes and turns it into a lesson you can follow: a timeline, the diff in plain words, the
impact, a check of the agent's claims against the evidence, a hands-on playground, and a quiz.

Everything runs on your machine. Nothing is uploaded except to the teacher model you choose.

> **Status: early development.** Recording works with Claude Code. The console is designed
> (see the [mockup](docs/mockup/console.html)) and being built. Roadmap: [docs/Roadmap.md](docs/Roadmap.md).

## Try the recorder (Claude Code)

```bash
git clone <this repo> && cd vibe-explainer && npm install
node packages/cli/bin/vibe-explainer.js init /path/to/your/project
# use Claude Code in that project as usual, then:
node packages/cli/bin/vibe-explainer.js status /path/to/your/project
```

`init` adds hooks to your project's `.claude/settings.local.json` (personal, not committed).
`init --remove` takes them out. Recordings live in `~/.vibe-explainer/`. Your project's own
`.git` is never written to: before/after snapshots of each prompt live in a separate shadow repo.

Open the console in your browser (live while the agent works):

```bash
node packages/cli/bin/vibe-explainer.js open /path/to/your/project
```

Get a lesson for the last prompt (uses your own `claude` CLI, no API key):

```bash
node packages/cli/bin/vibe-explainer.js explain /path/to/your/project --lang en
node packages/cli/bin/vibe-explainer.js config set mode auto   # teach after every prompt
```

## How it works

Claude Code hooks → recorder → local store → (next phases) git snapshots, code analysis, a
teacher model writes the lesson → a console in your browser. Details:
[Architecture](docs/Architecture.md) · [Product](docs/PRD.md) · [Data format](docs/DataFormat.md) · [Design](docs/Design.md).

## Development

```bash
npm install
npm test
```

Node 20+. No native dependencies. Rules for contributors: [docs/Rules.md](docs/Rules.md).
