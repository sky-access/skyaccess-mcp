/**
 * Shared constants for the `skyaccess-mcp` installer/bridge.
 *
 * `https://mcp.skyaccess.com/mcp` is the public, anonymous SkyAccess MCP
 * endpoint and the only URL clients should be configured with.
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
