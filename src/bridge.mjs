/**
 * stdio <-> Streamable-HTTP bridge.
 *
 * WHY THIS EXISTS AT ALL (checked 2026-08-28, see README):
 * Cursor, Claude Code and the Claude Connectors UI all speak remote MCP natively,
 * so for those the installer just writes a URL and this file never runs. But
 * `claude_desktop_config.json` validates STDIO servers only — `command`/`args`,
 * no `url` — so a Claude Desktop user who wants SkyAccess in their config file,
 * and every other stdio-only client, needs something local to talk to. That is
 * this: newline-delimited JSON-RPC on stdin/stdout, one HTTP POST per message.
 *
 * ⛔ stdout carries the protocol. Nothing may be written to it except JSON-RPC,
 * one message per line. All diagnostics go to stderr.
 */

import { DEFAULT_PROTOCOL_VERSION } from "./constants.mjs";
import { HttpTransportError, postMessage } from "./http-transport.mjs";

/** JSON-RPC "Internal error" — what we report when the HTTP hop fails. */
const INTERNAL_ERROR = -32603;
/** JSON-RPC "Parse error" — a stdin line that was not JSON. */
const PARSE_ERROR = -32700;

/**
 * A message is a REQUEST (and therefore owed a response) only when it carries
 * both an `id` and a `method`. A bare `id` is a response travelling the other
 * way; a bare `method` is a notification. Getting this wrong either invents
 * replies to notifications or lets a real request hang.
 */
function requestId(message) {
  if (message === null || typeof message !== "object" || Array.isArray(message)) return undefined;
  if (message.id === undefined || message.id === null) return undefined;
  if (typeof message.method !== "string") return undefined;
  return message.id;
}

/**
 * Build the bridge. Streams are injected so tests can drive it end to end
 * without spawning a process.
 *
 * @param {object} options
 * @param {string} options.url
 * @param {NodeJS.ReadableStream} options.stdin
 * @param {NodeJS.WritableStream} options.stdout
 * @param {NodeJS.WritableStream} [options.stderr]
 * @param {typeof fetch} [options.fetchImpl]
 */
export function createBridge({ url, stdin, stdout, stderr = process.stderr, fetchImpl = fetch }) {
  let sessionId = null;
  let protocolVersion = null;
  let buffer = "";
  /** Resolves once `initialize` has come back, so nothing races the session id. */
  let gate = Promise.resolve();
  const inFlight = new Set();

  const write = (payload) => {
    // Re-serialise rather than forwarding the raw payload: an SSE `data` field
    // may legitimately be split across lines, and a newline inside a stdout
    // message would be read by the client as a message boundary.
    stdout.write(`${collapse(payload)}\n`);
  };

  const note = (text) => {
    stderr.write(`[skyaccess-mcp] ${text}\n`);
  };

  async function forward(message) {
    const id = requestId(message);
    try {
      const result = await postMessage({
        url,
        message,
        sessionId,
        protocolVersion: protocolVersion ?? DEFAULT_PROTOCOL_VERSION,
        fetchImpl,
        onPayload: write,
      });
      if (result.sessionId) sessionId = result.sessionId;
      // Adopt whatever the server says it negotiated, so later requests carry
      // the agreed version rather than the one we guessed.
      if (message?.method === "initialize") {
        for (const payload of result.payloads) {
          const negotiated = readProtocolVersion(payload);
          if (negotiated) protocolVersion = negotiated;
        }
      }
    } catch (error) {
      const detail = error instanceof HttpTransportError ? error.message : String(error?.message ?? error);
      note(detail);
      // Only a request may be answered. Replying to a notification would inject
      // a message the client never asked for and can only confuse it.
      if (id !== undefined) {
        write(JSON.stringify({ jsonrpc: "2.0", id, error: { code: INTERNAL_ERROR, message: detail } }));
      }
    }
  }

  function dispatch(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      note(`ignoring a line that is not JSON: ${line.slice(0, 120)}`);
      write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: PARSE_ERROR, message: "Parse error" },
        }),
      );
      return;
    }

    // `initialize` must complete before anything else goes out, or a concurrent
    // request can be sent without the session id the server just issued.
    const task = message?.method === "initialize" ? forward(message) : gate.then(() => forward(message));
    if (message?.method === "initialize") gate = task.catch(() => {});
    track(task);
  }

  function track(task) {
    inFlight.add(task);
    task.finally(() => inFlight.delete(task));
  }

  function onData(chunk) {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line) dispatch(line);
    }
  }

  /** Resolves when stdin has ended AND every in-flight POST has settled. */
  const done = new Promise((resolve) => {
    stdin.setEncoding?.("utf8");
    stdin.on("data", (chunk) => onData(typeof chunk === "string" ? chunk : chunk.toString("utf8")));
    stdin.on("end", async () => {
      const trailing = buffer.trim();
      buffer = "";
      if (trailing) dispatch(trailing);
      // Each settled task can enqueue nothing new, but a task awaiting the gate
      // joins the set only once the gate resolves — so drain until it is empty.
      while (inFlight.size > 0) await Promise.allSettled([...inFlight]);
      resolve();
    });
  });

  return { done };
}

/** Collapse a multi-line JSON payload onto one line without reparsing it. */
function collapse(payload) {
  if (!payload.includes("\n")) return payload;
  try {
    return JSON.stringify(JSON.parse(payload));
  } catch {
    return payload.replace(/\n/g, " ");
  }
}

function readProtocolVersion(payload) {
  try {
    const parsed = JSON.parse(payload);
    const version = parsed?.result?.protocolVersion;
    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
}
