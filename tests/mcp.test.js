import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Store, recordHook, snapshotBefore, finishTurn, writeJson } from "@vibe-explainer/core";
import { handle } from "../packages/mcp/src/server.js";
import { timeWindow } from "../packages/mcp/src/tools.js";

const BIN = fileURLToPath(new URL("../packages/mcp/bin/vibe-explainer-mcp.js", import.meta.url));
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const local = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

/** Two projects: one prompt "yesterday", one "today", one last week (local times). */
function store() {
  const home = tmp("vx-home-"), s = new Store({ home });
  const turn = (proj, sid, prompt, when, edit) => {
    const now = when.toISOString();
    const opts = { store: s, env: {}, now, onTurnOpened: (c) => snapshotBefore(c.store, c), onTurnClosed: (c) => finishTurn(c.store, c) };
    recordHook({ session_id: sid, cwd: proj, hook_event_name: "UserPromptSubmit", prompt }, opts);
    edit();
    recordHook({ session_id: sid, cwd: proj, hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "npm test" }, tool_response: { stdout: "ok" } }, opts);
    recordHook({ session_id: sid, cwd: proj, hook_event_name: "Stop" }, opts);
  };
  const a = tmp("vx-shop-"), b = tmp("vx-blog-");
  fs.writeFileSync(path.join(a, "cart.js"), "export const total = (xs) => xs.length;\n");
  fs.writeFileSync(path.join(b, "post.md"), "# hi\n");
  turn(a, "s-old", "rename cart helpers", local(2026, 11, 14, 10), () => fs.writeFileSync(path.join(a, "cart.js"), "export const count = (xs) => xs.length;\n"));
  turn(a, "s-yday", "make total() add up prices", local(2026, 11, 21, 15, 30), () => fs.writeFileSync(path.join(a, "cart.js"), "export const total = (xs) => xs.reduce((s, x) => s + x.price, 0); // sk-ant-api03-" + "Q".repeat(40) + "\n"));
  turn(b, "s-today", "write the first post", local(2026, 11, 22, 9), () => fs.writeFileSync(path.join(b, "post.md"), "# hi\nfirst post\n"));
  const pidA = fs.readdirSync(path.join(home, "projects")).find((id) => JSON.parse(fs.readFileSync(path.join(home, "projects", id, "project.json"))).path === path.resolve(a));
  writeJson(path.join(s.turnDir(pidA, "s-yday", 1), "lesson.json"), { title: "total() now sums prices", summary: "It adds x.price.", claims: [{ text: "tests pass", status: "backed", evidence: "npm test ok" }], impact: [{ where: "checkout.js", risk: 3, title: "Old callers pass numbers", why: "w" }], asks: [], quiz: [], concepts: [] });
  return { s, home, a, b };
}
const NOW = local(2026, 11, 22, 12);
const call = async (s, name, args) => (await handle(s, { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name, arguments: args } }, { now: () => NOW })).result;

test("time windows use the user's local day", () => {
  const y = timeWindow({ since: "yesterday" }, NOW);
  assert.deepEqual([y.from.getTime(), y.to.getTime()], [local(2026, 11, 21).getTime(), local(2026, 11, 22).getTime()]);
  assert.equal(timeWindow({ since: "2026-11-14" }, NOW).to.getTime(), local(2026, 11, 15).getTime());
  assert.equal(timeWindow({ since: "last_24_hours" }, NOW).from.getTime(), NOW.getTime() - 24 * 3600 * 1000);
  assert.throws(() => timeWindow({ since: "last tuesday-ish" }, NOW), /since: use today, yesterday/);
});

test("protocol: initialize, tools/list, notifications, unknown methods", async () => {
  const s = new Store({ home: tmp("vx-home-") });
  const h = (m) => handle(s, { jsonrpc: "2.0", ...m });
  const init = await h({ id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } });
  assert.equal(init.result.protocolVersion, "2025-03-26");
  assert.equal((await h({ id: 1, method: "initialize", params: { protocolVersion: "1999-01-01" } })).result.protocolVersion, "2025-06-18");
  assert.equal(await h({ method: "notifications/initialized" }), null);
  const tools = (await h({ id: 2, method: "tools/list" })).result.tools;
  assert.deepEqual(tools.map((t) => t.name), ["recent_changes", "get_turn", "search", "open_todos", "list_projects"]);
  assert.ok(tools.every((t) => t.annotations.readOnlyHint && t.inputSchema.type === "object"));
  assert.equal((await h({ id: 3, method: "resources/list" })).error.code, -32601);
  assert.equal((await h({ id: 4, method: "tools/call", params: { name: "rm_rf" } })).error.code, -32602);
});

test("recent_changes('yesterday') lists exactly yesterday's prompt, with files, lesson, tests and risk", async () => {
  const { s } = store();
  const r = (await call(s, "recent_changes", { since: "yesterday" }));
  assert.equal(r.isError, false);
  const turns = r.structuredContent.turns;
  assert.deepEqual(turns.map((t) => t.prompt), ["make total() add up prices"]);
  assert.deepEqual([turns[0].files, turns[0].lesson, turns[0].tests, turns[0].risk], [["M cart.js +1 −1"], "total() now sums prices", "npm test: passed", "high"]);
  assert.match(r.content[0].text, /^Changes from 2026-11-21 00:00 to 2026-11-22 00:00 .*: 1 prompt in 1 project\(s\)\./);
  assert.equal((await call(s, "recent_changes", { since: "today" })).structuredContent.turns[0].prompt, "write the first post");
  assert.equal((await call(s, "recent_changes", { since: "last_30_days" })).structuredContent.turns.length, 3);
  assert.match((await call(s, "recent_changes", { project: "nope" })).content[0].text, /no recorded project matches "nope"/);
});

test("get_turn, search and open_todos; secrets never leave", async () => {
  const { s, a } = store();
  const [hit] = (await call(s, "search", { query: "prices" })).structuredContent.turns;
  const t = (await call(s, "get_turn", { project: a, session: hit.session.slice(0, 4), turn: hit.turn }));
  assert.equal(t.isError, false);
  assert.match(t.content[0].text, /## Lesson\ntotal\(\) now sums prices/);
  assert.match(t.content[0].text, /## Diff[\s\S]*\+export const total/);
  assert.ok(!t.content[0].text.includes("Q".repeat(40)), "the planted key is masked");
  const todos = (await call(s, "open_todos", { since: "last_30_days" })).structuredContent.items;
  assert.ok(todos.some((i) => i.item === "Old callers pass numbers" && i.risk === 3));
  assert.ok(todos.some((i) => i.item === "security: secret"));
  assert.match((await call(s, "list_projects", {})).content[0].text, /vx-shop-.* · 2 sessions/);
});

test("the stdio server answers a real client process line by line", async () => {
  const { home } = store();
  const p = spawn(process.execPath, [BIN], { env: { ...process.env, VIBE_EXPLAINER_HOME: home }, stdio: ["pipe", "pipe", "pipe"] });
  let out = "";
  p.stdout.on("data", (d) => { out += d; });
  const send = (m) => p.stdin.write(`${JSON.stringify(m)}\n`);
  send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } } });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "recent_changes", arguments: { since: "2026-11-01", until: "2026-11-30" } } });
  p.stdin.write("not json\n");
  p.stdin.end();
  await new Promise((r) => p.on("close", r));
  const lines = out.trim().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.id), [1, 2, null], "one line per answer, nothing else on stdout");
  assert.equal(lines[1].result.structuredContent.turns.length, 3);
  assert.equal(lines[2].error.code, -32700);
});
