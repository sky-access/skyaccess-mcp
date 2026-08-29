/**
 * Shared constants for the `skyaccess-mcp` installer/bridge.
 *
 * `mcp.skyaccess.com` is the vanity host and it resolves (verified 2026-08-28);
 * `api.skyaccess.com/mcp` is the same server behind its API hostname and is the
 * fallback documented in apps/web/app/llms.txt/route.ts. Both answer `initialize`.
 */

/** The public, anonymous SkyAccess MCP endpoint. Overridable with --url. */
export const DEFAULT_MCP_URL = "https://mcp.skyaccess.com/mcp";

/** The key we write into a client's `mcpServers` map. */
export const SERVER_KEY = "skyaccess";

/** Published npm name — what an MCP client will `npx` to reach the bridge. */
export const PACKAGE_NAME = "skyaccess-mcp";

/**
 * Protocol version we advertise on the first request, before a server has told
 * us what it negotiated. The spec says a client that has not yet initialized
 * SHOULD send the version it intends to use.
 */
export const DEFAULT_PROTOCOL_VERSION = "2025-06-18";
