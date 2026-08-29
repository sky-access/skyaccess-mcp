/**
 * The HTTP half of the stdio<->HTTP bridge: one POST per outbound JSON-RPC
 * message, against an MCP Streamable HTTP endpoint.
 *
 * Three response shapes have to be handled and they are easy to conflate:
 *   - `202 Accepted`, empty body — the message was a notification or a response,
 *     so nothing comes back and nothing may be written to stdout.
 *   - `text/event-stream` — one or more JSON-RPC messages, each in an SSE `data`
 *     field. This is what SkyAccess returns for requests.
 *   - `application/json` — a single JSON-RPC message as the whole body.
 */

import { SseParser } from "./sse.mjs";

/** A non-2xx from the endpoint, carrying enough to build a JSON-RPC error. */
export class HttpTransportError extends Error {
  /**
   * @param {number} status
   * @param {string} body
   */
  constructor(status, body) {
    super(`MCP endpoint returned HTTP ${status}${body ? `: ${truncate(body, 400)}` : ""}`);
    this.name = "HttpTransportError";
    this.status = status;
    this.body = body;
  }
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

/**
 * POST one JSON-RPC message (or batch) and surface every message that comes back.
 *
 * @param {object} options
 * @param {string} options.url                   endpoint to POST to
 * @param {unknown} options.message              JSON-RPC message or batch
 * @param {string | null} [options.sessionId]    value for the `Mcp-Session-Id` header
 * @param {string | null} [options.protocolVersion] value for `MCP-Protocol-Version`
 * @param {(payload: string) => void} [options.onPayload] called per message, as it arrives
 * @param {typeof fetch} [options.fetchImpl]     injection seam for tests
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ status: number, sessionId: string | null, payloads: string[] }>}
 */
export async function postMessage({
  url,
  message,
  sessionId = null,
  protocolVersion = null,
  onPayload,
  fetchImpl = fetch,
  signal,
}) {
  const headers = {
    "content-type": "application/json",
    // Both are required: the spec lets the server pick either representation,
    // and omitting `text/event-stream` gets a 406 from strict implementations.
    accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  if (protocolVersion) headers["mcp-protocol-version"] = protocolVersion;

  const response = await fetchImpl(url, {
    method: "POST",
    headers,
    body: JSON.stringify(message),
    signal,
  });

  // Read the header even on an error path: a server may hand back a session on a
  // response we are about to reject, and dropping it desynchronises the session.
  const returnedSessionId = response.headers?.get?.("mcp-session-id") ?? null;

  if (!response.ok) {
    const body = await safeText(response);
    throw new HttpTransportError(response.status, body);
  }

  // 202 is the documented "accepted, nothing to return" for notifications and
  // responses. Reading a body here would block on a stream that never opens.
  if (response.status === 202) {
    return { status: 202, sessionId: returnedSessionId, payloads: [] };
  }

  const contentType = response.headers?.get?.("content-type") ?? "";
  const payloads = [];
  const emit = (payload) => {
    if (payload.trim() === "") return;
    payloads.push(payload);
    onPayload?.(payload);
  };

  if (contentType.includes("text/event-stream")) {
    const parser = new SseParser();
    for await (const chunk of iterateText(response)) {
      for (const payload of parser.push(chunk)) emit(payload);
    }
    for (const payload of parser.flush()) emit(payload);
  } else {
    emit(await safeText(response));
  }

  return { status: response.status, sessionId: returnedSessionId, payloads };
}

async function safeText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

/**
 * Yield the response body as decoded text chunks.
 *
 * `Response.body` is a web ReadableStream under Node's fetch, but a hand-rolled
 * test double may only implement `text()`. Falling back keeps the seam usable
 * without forcing every fixture to build a stream.
 */
async function* iterateText(response) {
  const body = response.body;
  if (!body || typeof body.getReader !== "function") {
    yield await safeText(response);
    return;
  }
  const reader = body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      yield typeof value === "string" ? value : decoder.decode(value, { stream: true });
    }
    const tail = decoder.decode();
    if (tail) yield tail;
  } finally {
    reader.releaseLock?.();
  }
}
