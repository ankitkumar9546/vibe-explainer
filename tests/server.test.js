import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { Store, recordHook, snapshotBefore, finishTurn, projectIdFor, startServer } from "@vibe-explainer/core";

const STATIC = fileURLToPath(new URL("../packages/console", import.meta.url));
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

function get(port, p, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path: p, headers: { host: `127.0.0.1:${port}`, ...headers } }, (res) => {
      let body = ""; res.on("data", (d) => { body += d; }); res.on("end", () => resolve({ status: res.statusCode, body, type: res.headers["content-type"] }));
    });
    req.on("error", reject);
  });
}

function setup() {
  const home = tmp("vx-home-"), proj = tmp("vx-proj-");
  fs.writeFileSync(path.join(proj, "a.txt"), "1\n");
  const store = new Store({ home });
  const opts = { store, env: {}, onTurnOpened: (c) => snapshotBefore(c.store, c), onTurnClosed: (c) => finishTurn(c.store, c) };
  const base = { session_id: "s1", cwd: proj };
  recordHook({ ...base, hook_event_name: "UserPromptSubmit", prompt: "change a" }, opts);
  fs.writeFileSync(path.join(proj, "a.txt"), "1\n2\n");
  recordHook({ ...base, hook_event_name: "PostToolUse", tool_name: "Edit", tool_input: { file_path: path.join(proj, "a.txt") }, tool_response: {} }, opts);
  recordHook({ ...base, hook_event_name: "Stop" }, opts);
  return { store, proj, base, opts, projectId: projectIdFor(proj) };
}

test("the API needs the token, refuses other hosts, and serves real data", async () => {
  const { store, projectId } = setup();
  const srv = await startServer(store, { staticDir: STATIC, port: 0, token: "x".repeat(36) });
  try {
    const t = "x".repeat(36);
    assert.equal((await get(srv.port, "/api/projects")).status, 401);
    assert.equal((await get(srv.port, "/api/projects?t=wrong")).status, 401);
    assert.equal((await get(srv.port, `/api/projects?t=${t}`, { host: "evil.example:80" })).status, 403);
    const projects = JSON.parse((await get(srv.port, `/api/projects?t=${t}`)).body);
    assert.equal(projects[0].id, projectId);
    const turn = JSON.parse((await get(srv.port, `/api/turn?t=${t}&project=${projectId}&session=s1&turn=1`)).body);
    assert.equal(turn.turn.prompt, "change a");
    assert.match(turn.diff, /^\+2$/m);
    assert.equal(turn.events.filter((e) => e.kind === "tool_end").length, 1);
    assert.equal(turn.lesson, null);
    assert.equal((await get(srv.port, `/api/turn?t=${t}&project=../../etc&session=s1&turn=1`)).status, 400);
    // static files need no token but can't escape the folder
    const page = await get(srv.port, "/");
    assert.equal(page.status, 200); assert.match(page.type, /text\/html/);
    assert.equal((await get(srv.port, "/..%2f..%2fpackage.json")).status, 404);
  } finally { await srv.close(); }
});

test("the stream sends new events as they are recorded", async () => {
  const { store, projectId, base, opts } = setup();
  const t = "y".repeat(36);
  const srv = await startServer(store, { staticDir: STATIC, port: 0, token: t });
  try {
    const got = await new Promise((resolve, reject) => {
      const req = http.get({ host: "127.0.0.1", port: srv.port, path: `/api/stream?t=${t}&project=${projectId}&session=s1`, headers: { host: `127.0.0.1:${srv.port}` } }, (res) => {
        let buf = "";
        res.on("data", (d) => {
          buf += d;
          if (/"prompt":"second"/.test(buf)) { req.destroy(); resolve(buf); }
        });
      });
      req.on("error", (e) => { if (e.code !== "ECONNRESET") reject(e); });
      setTimeout(() => recordHook({ ...base, hook_event_name: "UserPromptSubmit", prompt: "second" }, opts), 300);
      setTimeout(() => { req.destroy(); reject(new Error("no event in time")); }, 5000);
    });
    assert.match(got, /event: turns/);
    assert.match(got, /event: ev\ndata: .*"prompt":"second"/);
  } finally { await srv.close(); }
});
