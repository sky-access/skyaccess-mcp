import { describe, expect, it } from "vitest";

import { HttpTransportError, postMessage } from "../http-transport.mjs";

/**
 * These use a hand-built Response-alike rather than a socket, because each one
 * pins a decision about what we do with the RESPONSE METADATA — status, headers,
 * content-type — which a real server would make it awkward to vary precisely.
 * The end-to-end path over a real socket is covered in bridge.test.mjs.
 */
function fakeResponse({ status = 200, headers = {}, body = "", onText } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: onText ?? (async () => body),
  };
}

const fetchReturning = (response) => async () => response;

describe("postMessage", () => {
  it("never reads the body of a 202", async () => {
    // A 202 is the "accepted, nothing follows" reply to a notification. Reading
    // it is not merely wasteful: against a real server there is no body stream to
    // read, so a read can hang the bridge on a message that is already finished.
    let readBody = false;
    const response = fakeResponse({
      status: 202,
      onText: async () => {
        readBody = true;
        return "";
      },
    });

    const result = await postMessage({
      url: "http://x/mcp",
      message: { jsonrpc: "2.0", method: "notifications/initialized" },
      fetchImpl: fetchReturning(response),
    });

    expect(readBody).toBe(false);
    expect(result.payloads).toEqual([]);
    expect(result.status).toBe(202);
  });

  it("sends both accept types, or a strict server answers 406", async () => {
    let sent;
    await postMessage({
      url: "http://x/mcp",
      message: { jsonrpc: "2.0", id: 1, method: "ping" },
      fetchImpl: async (_url, init) => {
        sent = init.headers;
        return fakeResponse({ headers: { "content-type": "application/json" }, body: "{}" });
      },
    });
    expect(sent.accept).toBe("application/json, text/event-stream");
  });

  it("parses a plain application/json body as one message", async () => {
    const result = await postMessage({
      url: "http://x/mcp",
      message: { jsonrpc: "2.0", id: 1, method: "ping" },
      fetchImpl: fetchReturning(
        fakeResponse({ headers: { "content-type": "application/json" }, body: '{"id":1}' }),
      ),
    });
    expect(result.payloads).toEqual(['{"id":1}']);
  });

  it("throws an HttpTransportError carrying the status on a non-2xx", async () => {
    const failing = postMessage({
      url: "http://x/mcp",
      message: { jsonrpc: "2.0", id: 1, method: "ping" },
      fetchImpl: fetchReturning(fakeResponse({ status: 503, body: "upstream down" })),
    });
    await expect(failing).rejects.toBeInstanceOf(HttpTransportError);
    await expect(failing).rejects.toThrow("503");
  });

  it("omits the session header entirely when there is no session yet", async () => {
    // Sending an empty Mcp-Session-Id is not the same as sending none; a server
    // is entitled to reject the empty one as an unknown session.
    let sent;
    await postMessage({
      url: "http://x/mcp",
      message: { jsonrpc: "2.0", id: 1, method: "initialize" },
      fetchImpl: async (_url, init) => {
        sent = init.headers;
        return fakeResponse({ headers: { "content-type": "application/json" }, body: "{}" });
      },
    });
    expect("mcp-session-id" in sent).toBe(false);
  });
});
