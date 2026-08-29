/**
 * Where each MCP client keeps its server list, and which shape it accepts.
 *
 * The split that matters (verified against vendor docs 2026-08-28):
 *   - Cursor's `~/.cursor/mcp.json` takes a REMOTE entry — `{ "url": ... }` —
 *     so nothing local runs.
 *   - Claude Desktop's `claude_desktop_config.json` takes STDIO ONLY. Remote
 *     servers there go through Settings -> Connectors, which is a UI flow no
 *     installer can write to. So its file entry has to spawn the bridge.
 *
 * Anything we are not certain about is deliberately NOT written; `MANUAL_STEPS`
 * prints the exact instruction instead. Writing a guessed shape into someone's
 * editor config is worse than telling them the one line to paste.
 */

import { homedir } from "node:os";
import { join } from "node:path";

import { DEFAULT_MCP_URL, PACKAGE_NAME } from "./constants.mjs";

/**
 * @typedef {object} ClientTarget
 * @property {string} id
 * @property {string} label
 * @property {"remote" | "stdio"} transport
 * @property {string} configPath
 * @property {string} detectDir  directory whose existence implies the client is installed
 * @property {object} entry      the value to write under `mcpServers[SERVER_KEY]`
 */

/**
 * Resolve every client target for a platform.
 *
 * @param {object} [options]
 * @param {string} [options.url]
 * @param {NodeJS.Platform} [options.platform]
 * @param {string} [options.home]
 * @param {Record<string, string | undefined>} [options.env]
 * @returns {ClientTarget[]}
 */
export function getClientTargets({
  url = DEFAULT_MCP_URL,
  platform = process.platform,
  home = homedir(),
  env = process.env,
} = {}) {
  const targets = [
    {
      id: "cursor",
      label: "Cursor",
      transport: "remote",
      detectDir: join(home, ".cursor"),
      configPath: join(home, ".cursor", "mcp.json"),
      // Cursor speaks Streamable HTTP natively — no local process involved.
      entry: { url },
    },
  ];

  const claudeDir = claudeDesktopDir({ platform, home, env });
  if (claudeDir) {
    targets.push({
      id: "claude-desktop",
      label: "Claude Desktop (config file)",
      transport: "stdio",
      detectDir: claudeDir,
      configPath: join(claudeDir, "claude_desktop_config.json"),
      // `-y` so npx installs without an interactive prompt; a prompt on a stdio
      // server is invisible to the client and reads as a server that never started.
      entry: { command: "npx", args: ["-y", PACKAGE_NAME, "bridge", "--url", url] },
    });
  }

  return targets;
}

function claudeDesktopDir({ platform, home, env }) {
  if (platform === "darwin") return join(home, "Library", "Application Support", "Claude");
  if (platform === "win32") {
    const appData = env.APPDATA;
    return appData ? join(appData, "Claude") : null;
  }
  return join(home, ".config", "Claude");
}

/**
 * Merge our server entry into an existing config document.
 *
 * Refuses to touch a file it cannot parse. A `mcp.json` with a stray comment or
 * a half-finished edit would otherwise be silently replaced by a file containing
 * only our entry, destroying every other server the user had.
 *
 * @param {string | null} existingText  current file contents, or null if absent
 * @param {string} key
 * @param {object} entry
 * @returns {{ status: "created" | "updated" | "unchanged" | "unparseable", text?: string }}
 */
export function mergeServerEntry(existingText, key, entry) {
  if (existingText === null || existingText.trim() === "") {
    return { status: "created", text: render({ mcpServers: { [key]: entry } }) };
  }

  let doc;
  try {
    doc = JSON.parse(existingText);
  } catch {
    return { status: "unparseable" };
  }
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) {
    return { status: "unparseable" };
  }

  const servers = doc.mcpServers;
  const existing =
    servers !== null && typeof servers === "object" && !Array.isArray(servers) ? servers : {};

  if (JSON.stringify(existing[key]) === JSON.stringify(entry)) {
    return { status: "unchanged" };
  }

  // Spread rather than mutate-in-place so every sibling key in the document —
  // other servers, and any unrelated top-level settings — survives verbatim.
  return {
    status: existing[key] === undefined ? "created" : "updated",
    text: render({ ...doc, mcpServers: { ...existing, [key]: entry } }),
  };
}

function render(doc) {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

/**
 * Clients that support remote MCP natively but whose registration is a command
 * or a UI flow, not a file we should be writing.
 *
 * @param {string} url
 */
export function manualSteps(url = DEFAULT_MCP_URL) {
  return [
    {
      label: "Claude Code",
      instruction: `claude mcp add --transport http --scope user skyaccess ${url}`,
    },
    {
      label: "Claude Desktop / claude.ai (Connectors)",
      instruction: `Settings -> Connectors -> Add custom connector -> paste ${url}`,
    },
  ];
}
