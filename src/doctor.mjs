/**
 * `npx skyaccess-mcp doctor` — initialize + tools/list against the endpoint and
 * report what came back.
 *
 * This is the check a user runs when a client says "server failed to start", and
 * it is also the shape the live test drives, so a green test and a green doctor
 * exercise the same path.
 */

import { DEFAULT_MCP_URL, DEFAULT_PROTOCOL_VERSION } from "./constants.mjs";
import { postMessage } from "./http-transport.mjs";

/**
 * @param {object} [options]
 * @param {string} [options.url]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {Promise<{ serverInfo: object | null, protocolVersion: string | null, tools: string[] }>}
 */
export async function probe({ url = DEFAULT_MCP_URL, fetchImpl = fetch } = {}) {
  const init = await postMessage({
    url,
    fetchImpl,
    protocolVersion: DEFAULT_PROTOCOL_VERSION,
    message: {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: DEFAULT_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "skyaccess-mcp doctor", version: "0.1.0" },
      },
    },
  });

  const initResult = firstResult(init.payloads);
  const protocolVersion = initResult?.protocolVersion ?? null;

  const list = await postMessage({
    url,
    fetchImpl,
    sessionId: init.sessionId,
    protocolVersion: protocolVersion ?? DEFAULT_PROTOCOL_VERSION,
    message: { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
  });

  const listResult = firstResult(list.payloads);
  const tools = Array.isArray(listResult?.tools)
    ? listResult.tools.map((tool) => tool?.name).filter((name) => typeof name === "string")
    : [];

  return { serverInfo: initResult?.serverInfo ?? null, protocolVersion, tools };
}

/** First payload that carried a JSON-RPC `result`, ignoring notifications. */
function firstResult(payloads) {
  for (const payload of payloads) {
    try {
      const parsed = JSON.parse(payload);
      if (parsed?.result !== undefined) return parsed.result;
    } catch {
      // A non-JSON frame is not a result; keep looking rather than throwing.
    }
  }
  return null;
}

/** @param {Awaited<ReturnType<typeof probe>>} report */
export function formatProbe(report, url) {
  return [
    "",
    `  endpoint          ${url}`,
    `  server            ${report.serverInfo?.name ?? "?"} ${report.serverInfo?.version ?? ""}`.trimEnd(),
    `  protocol          ${report.protocolVersion ?? "?"}`,
    `  tools (${report.tools.length})`,
    ...report.tools.map((name) => `    - ${name}`),
    "",
  ];
}
