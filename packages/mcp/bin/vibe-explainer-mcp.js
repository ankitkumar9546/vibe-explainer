#!/usr/bin/env node
// Start the vibe-explainer MCP server on stdio. Reads ~/.vibe-explainer (or VIBE_EXPLAINER_HOME).
import { Store } from "../../core/src/index.js";
import { serveStdio } from "../src/server.js";

process.on("uncaughtException", (err) => { process.stderr.write(`vibe-explainer mcp: ${err?.stack ?? err}\n`); });
await serveStdio(new Store());
