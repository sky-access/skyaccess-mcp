/**
 * Incremental Server-Sent Events parser, scoped to what MCP's Streamable HTTP
 * transport actually emits.
 *
 * The SkyAccess server answers a POST with `Content-Type: text/event-stream` and
 * frames each JSON-RPC message as one event:
 *
 *     event: message
 *     data: {"result":{...},"jsonrpc":"2.0","id":1}
 *
 * Written by hand rather than pulled from npm on purpose: this package must stay
 * dependency-free so `npx skyaccess-mcp` is a single small download with no
 * transitive supply chain, and the subset of SSE in play here is small.
 */

/**
 * Feed chunks in, get completed `data` payloads out.
 *
 * Per the SSE spec an event is dispatched on a blank line, `:` starts a comment,
 * a single leading space after the colon is stripped, and repeated `data` fields
 * are joined with newlines. Events with no `data` field dispatch nothing.
 */
export class SseParser {
  #buffer = "";
  #data = [];
  #sawData = false;

  /**
   * @param {string} chunk
   * @returns {string[]} payloads completed by this chunk, in order
   */
  push(chunk) {
    this.#buffer += chunk;
    const out = [];
    // Normalise CRLF/CR to LF so line splitting is uniform, per the spec's
    // "the stream must be decoded line by line" rules.
    this.#buffer = this.#buffer.replace(/\r\n|\r/g, "\n");

    let index;
    while ((index = this.#buffer.indexOf("\n")) !== -1) {
      const line = this.#buffer.slice(0, index);
      this.#buffer = this.#buffer.slice(index + 1);
      const payload = this.#line(line);
      if (payload !== null) out.push(payload);
    }
    return out;
  }

  /**
   * Dispatch whatever is still pending at end of stream.
   *
   * The spec says a final event with no trailing blank line is DISCARDED. We
   * dispatch it anyway: a discarded response is indistinguishable to the MCP
   * client from a server that never answered, so it hangs forever. Being lenient
   * here can only turn a hang into a reply. Covered by a test.
   *
   * @returns {string[]}
   */
  flush() {
    const out = [];
    if (this.#buffer.length > 0) {
      const payload = this.#line(this.#buffer);
      this.#buffer = "";
      if (payload !== null) out.push(payload);
    }
    const tail = this.#dispatch();
    if (tail !== null) out.push(tail);
    return out;
  }

  /** @returns {string | null} a payload if this line ended an event */
  #line(line) {
    if (line === "") return this.#dispatch();
    if (line.startsWith(":")) return null; // comment / keep-alive

    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "data") {
      this.#data.push(value);
      this.#sawData = true;
    }
    // `event:`, `id:` and `retry:` carry nothing this bridge needs: MCP puts the
    // whole JSON-RPC message in `data`, and resumability is not implemented here.
    return null;
  }

  /** @returns {string | null} */
  #dispatch() {
    if (!this.#sawData) {
      this.#data = [];
      return null;
    }
    const payload = this.#data.join("\n");
    this.#data = [];
    this.#sawData = false;
    return payload;
  }
}

/**
 * Convenience wrapper for a complete, already-buffered SSE body.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function parseSseBody(text) {
  const parser = new SseParser();
  return [...parser.push(text), ...parser.flush()];
}
