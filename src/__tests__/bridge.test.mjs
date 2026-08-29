import { createServer } from "node:http";
import { PassThrough } from "node:stream";

import { afterEach, describe, expect, it } from "vitest";

import { createBridge } from "../bridge.mjs";

/**
 * The bridge is tested against a REAL http server rather than a fetch double.
 *
 * The failure modes that matter here are all transport-level — a body streamed
 * in chunks, a 202 with no body at all, a header echoed on the next request — and
 * a hand-rolled fetch stub is exactly the thing that would let those pass while
 * broken. This costs a socket and buys a test that measures the real path.
 */

const FIVE_TOOLS = [
  "search_empty_legs",
  "get_flight",
  "booking_handoff",
  "get_charter_estimate",
  "request_booking",
];

let server;

afterEach(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  server = undefined;
});

/** Start a stub MCP endpoint. `handler(message, req, res)` decides each reply. */
async function startServer(handler) {
  const seen = [];
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const message = JSON.parse(body);
      seen.push({ message, headers: req.headers });
      handler(message, req, res);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { url: `http://127.0.0.1:${server.address().port}/mcp`, seen };
}

/** Reply as the real server does: SSE, one `message` event, chunked. */
function sse(res, payload) {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
  const text = `event: message\ndata: ${JSON.stringify(payload)}\n\n`;
  // Split mid-payload so a parser that assumes one chunk per event fails here.
  const half = Math.floor(text.length / 2);
  res.write(text.slice(0, half));
  res.write(text.slice(half));
  res.end();
}

/** Drive the bridge with `lines` on stdin and collect everything it writes out. */
async function runBridge(url, lines) {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const out = [];
  stdout.on("data", (chunk) => out.push(chunk.toString("utf8")));
  const errors = [];
  stderr.on("data", (chunk) => errors.push(chunk.toString("utf8")));

  const bridge = createBridge({ url, stdin, stdout, stderr });
  for (const line of lines) stdin.write(`${JSON.stringify(line)}\n`);
  stdin.end();
  await bridge.done;

  return {
    messages: out
      .join("")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line)),
    stderr: errors.join(""),
  };
}

describe("createBridge", () => {
  it("carries tools/list through and returns all five SkyAccess tools", async () => {
    const { url } = await startServer((message, _req, res) => {
      if (message.method === "initialize") {
        res.setHeader("mcp-session-id", "sess-1");
        sse(res, { jsonrpc: "2.0", id: message.id, result: { protocolVersion: "2025-06-18" } });
        return;
      }
      sse(res, {
        jsonrpc: "2.0",
        id: message.id,
        result: { tools: FIVE_TOOLS.map((name) => ({ name })) },
      });
    });

    const { messages } = await runBridge(url, [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    ]);

    const list = messages.find((m) => m.id === 2);
    expect(list.result.tools.map((t) => t.name)).toEqual(FIVE_TOOLS);
  });

  it("echoes the session id the server issued on initialize", async () => {
    const { url, seen } = await startServer((message, _req, res) => {
      if (message.method === "initialize") {
        res.setHeader("mcp-session-id", "sess-abc");
        sse(res, { jsonrpc: "2.0", id: message.id, result: { protocolVersion: "2025-06-18" } });
        return;
      }
      sse(res, { jsonrpc: "2.0", id: message.id, result: {} });
    });

    await runBridge(url, [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    ]);

    expect(seen[0].headers["mcp-session-id"]).toBeUndefined();
    expect(seen[1].headers["mcp-session-id"]).toBe("sess-abc");
  });

  it("sends the protocol version the server negotiated, not the one we guessed", async () => {
    const { url, seen } = await startServer((message, _req, res) => {
      if (message.method === "initialize") {
        sse(res, { jsonrpc: "2.0", id: message.id, result: { protocolVersion: "2099-01-01" } });
        return;
      }
      sse(res, { jsonrpc: "2.0", id: message.id, result: {} });
    });

    await runBridge(url, [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    ]);

    expect(seen[1].headers["mcp-protocol-version"]).toBe("2099-01-01");
  });

  it("writes nothing to stdout for a notification answered with 202", async () => {
    const { url } = await startServer((_message, _req, res) => {
      res.writeHead(202).end();
    });

    const { messages } = await runBridge(url, [
      { jsonrpc: "2.0", method: "notifications/initialized" },
    ]);

    // A synthesised reply to a notification is a message the client never asked
    // for; some clients treat an unmatched id as a protocol violation.
    expect(messages).toEqual([]);
  });

  it("answers a failed request with a JSON-RPC error carrying the same id", async () => {
    const { url } = await startServer((_message, _req, res) => {
      res.writeHead(500, { "content-type": "text/plain" }).end("upstream exploded");
    });

    const { messages } = await runBridge(url, [
      { jsonrpc: "2.0", id: 7, method: "tools/list", params: {} },
    ]);

    // Without this the client waits forever on a request that can never arrive.
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe(7);
    expect(messages[0].error.code).toBe(-32603);
    expect(messages[0].error.message).toContain("500");
  });

  it("reports a parse error for a non-JSON line and keeps serving the next one", async () => {
    const { url } = await startServer((message, _req, res) => {
      sse(res, { jsonrpc: "2.0", id: message.id, result: { ok: true } });
    });

    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const out = [];
    stdout.on("data", (chunk) => out.push(chunk.toString("utf8")));

    const bridge = createBridge({ url, stdin, stdout, stderr });
    stdin.write("this is not json\n");
    stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 9, method: "ping" })}\n`);
    stdin.end();
    await bridge.done;

    const messages = out
      .join("")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    expect(messages[0].error.code).toBe(-32700);
    expect(messages[1]).toMatchObject({ id: 9, result: { ok: true } });
  });

  it("handles a final stdin line that has no trailing newline", async () => {
    const { url } = await startServer((message, _req, res) => {
      sse(res, { jsonrpc: "2.0", id: message.id, result: { ok: true } });
    });

    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const out = [];
    stdout.on("data", (chunk) => out.push(chunk.toString("utf8")));

    const bridge = createBridge({ url, stdin, stdout, stderr });
    stdin.end(JSON.stringify({ jsonrpc: "2.0", id: 3, method: "ping" }));
    await bridge.done;

    expect(out.join("")).toContain('"id":3');
  });
});
