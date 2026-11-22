// A Model Context Protocol server over stdio (Roadmap Phase 12), with no dependencies:
// newline-delimited JSON-RPC 2.0, as the MCP stdio transport specifies. Read-only tools only.
// stdout carries protocol messages ONLY; anything else goes to stderr.
import { createInterface } from "node:readline";
import { TOOLS, callTool } from "./tools.js";

export const SUPPORTED = ["2025-06-18", "2025-03-26", "2024-11-05"];
export const SERVER_INFO = { name: "vibe-explainer", title: "vibe-explainer: what your AI agent changed", version: "0.1.0" };

/** Handle one JSON-RPC message; returns the response object, or null for a notification. */
export async function handle(store, msg, { now = () => new Date() } = {}) {
  const reply = (result) => ({ jsonrpc: "2.0", id: msg.id, result });
  const fail = (code, message) => ({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message } });
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return fail(-32600, "invalid request");
  const isNote = msg.id === undefined || msg.id === null;
  switch (msg.method) {
    case "initialize": {
      const asked = msg.params?.protocolVersion;
      return reply({
        protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: "Answers questions about what AI coding agents changed, from vibe-explainer's local record: use recent_changes for 'what changed yesterday/today/this week', get_turn for one prompt's details, search to find a prompt, open_todos for what still needs checking. Everything is read-only.",
      });
    }
    case "ping": return isNote ? null : reply({});
    case "tools/list": return reply({ tools: TOOLS });
    case "tools/call": {
      const { name, arguments: args = {} } = msg.params ?? {};
      if (!TOOLS.some((t) => t.name === name)) return fail(-32602, `unknown tool: ${name}`);
      try {
        const r = await callTool(store, name, args, now());
        return reply({ content: [{ type: "text", text: r.text }], structuredContent: r.data, isError: false });
      } catch (err) {
        return reply({ content: [{ type: "text", text: String(err.message ?? err) }], isError: true });
      }
    }
    default:
      if (isNote) return null; // notifications/initialized, notifications/cancelled, …
      return fail(-32601, `method not found: ${msg.method}`);
  }
}

/** Serve on stdin/stdout until stdin closes. */
export function serveStdio(store, { input = process.stdin, output = process.stdout } = {}) {
  const rl = createInterface({ input, crlfDelay: Infinity });
  let queue = Promise.resolve(); // answer in order, one at a time
  rl.on("line", (line) => { queue = queue.then(() => onLine(line)); });
  const onLine = async (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { output.write(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } })}\n`); return; }
    const batch = Array.isArray(msg) ? msg : [msg];
    for (const m of batch) {
      let res;
      try { res = await handle(store, m); } catch (err) { res = { jsonrpc: "2.0", id: m?.id ?? null, error: { code: -32603, message: String(err.message ?? err) } }; }
      if (res) output.write(`${JSON.stringify(res)}\n`);
    }
  };
  return new Promise((resolve) => rl.on("close", () => queue.then(resolve)));
}
