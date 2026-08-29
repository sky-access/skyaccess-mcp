import { describe, expect, it } from "vitest";

import { parseSseBody, SseParser } from "../sse.mjs";

describe("SseParser", () => {
  it("extracts the data payload from the frame shape the server actually sends", () => {
    // Byte-for-byte the shape captured from https://mcp.skyaccess.com/mcp.
    const body = 'event: message\ndata: {"result":{"tools":[]},"jsonrpc":"2.0","id":2}\n\n';
    expect(parseSseBody(body)).toEqual(['{"result":{"tools":[]},"jsonrpc":"2.0","id":2}']);
  });

  it("joins repeated data fields with a newline rather than concatenating them", () => {
    expect(parseSseBody("data: {\ndata: }\n\n")).toEqual(["{\n}"]);
  });

  it("ignores comment lines used as keep-alives", () => {
    expect(parseSseBody(': ping\ndata: {"a":1}\n\n')).toEqual(['{"a":1}']);
  });

  it("dispatches an event that never got its trailing blank line", () => {
    // The spec says discard. We do not: a discarded response is a client hang.
    expect(parseSseBody('data: {"id":1}\n')).toEqual(['{"id":1}']);
  });

  it("emits nothing for an event that carried no data field", () => {
    expect(parseSseBody("event: ping\n\n")).toEqual([]);
  });

  it("reassembles a payload split across chunk boundaries", () => {
    const parser = new SseParser();
    expect(parser.push('data: {"jso')).toEqual([]);
    expect(parser.push('nrpc":"2.0"}')).toEqual([]);
    expect(parser.push("\n\n")).toEqual(['{"jsonrpc":"2.0"}']);
  });

  it("handles CRLF line endings", () => {
    expect(parseSseBody('event: message\r\ndata: {"a":1}\r\n\r\n')).toEqual(['{"a":1}']);
  });

  it("separates two events in one chunk", () => {
    expect(parseSseBody('data: {"id":1}\n\ndata: {"id":2}\n\n')).toEqual([
      '{"id":1}',
      '{"id":2}',
    ]);
  });
});
