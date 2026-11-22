// The one place the version lives. scripts/pack-npm.mjs, the MCP server, `vibe-explainer --version`
// and the release workflow read it; tests/release.test.js keeps .claude-plugin/plugin.json in step.
export const VERSION = "0.1.0";
