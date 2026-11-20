# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Mockup: a single static HTML file (confirmed 2026-11-19). The real console is planned as Vite + TypeScript served by a local Node server (docs/PLAN.md section 3.5).

## Users

Primary: new developers and students who get code written by an AI coding agent (Claude Code first, then Cursor, Codex, others) but do not fully understand what the agent changed. They open the console during or after a session to understand it. Experienced developers are served by the Developer level switch, not by a separate design.

## Product Purpose

A local console that records every step an AI coding agent takes and explains it like a teacher: what is happening now, what it did, what changed, how the code is wired, what the change can affect, and a lesson with a quiz. Success: after a session the user can explain the change in their own words.

## Positioning

It teaches instead of only logging. It checks the agent's claims against what actually happened ("the AI said tests pass, but no test ran in this turn"). Explanations in Hindi or English, at Beginner or Developer level.

## Operating Context

Runs on localhost next to the user's editor and terminal, often open while the agent works. Data comes from Claude Code hooks and transcripts, or git snapshots for other tools. Teacher model defaults to `claude -p`.

## Capabilities and Constraints

- Everything stays on the user's PC; no server of ours.
- Never touches the user's git branch, index or commits.
- Tabs: Overview, Live, Logs, Changes, Wiring, Impact, Seekho.
- Toggles: Hindi / English, Beginner / Developer.
- Undecided: final name (vibe-explainer is a working name), licence, when the first demo goes public.

## Brand Commitments

None yet. Working name only.

## Evidence on Hand

None. No users, sessions, or benchmarks exist yet; mockup content is sample data and must be labelled as such.

## Product Principles

1. Understanding over logging: every view should answer "what does this mean for me".
2. Show evidence, not just the AI's word.
3. Plain language first, the raw detail one click away.
4. Local and safe by default.
