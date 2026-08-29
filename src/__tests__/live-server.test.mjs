import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import { createBridge } from "../bridge.mjs";
import { DEFAULT_MCP_URL } from "../constants.mjs";
import { probe } from "../doctor.mjs";

/**
 * Hits the REAL public endpoint. Opt-in with `SKYACCESS_MCP_LIVE=1`
 * (`pnpm --filter skyaccess-mcp test:live`).
 *
 * ⛔ Deliberately NOT part of the CI gate. `.github/test-baseline.json` holds this
 * package at 0 failures, and a suite that depends on DNS, the internet and a
 * 30-req/min rate limit would turn any of those into a red release gate that has
 * nothing to say about the code. The file still sits inside the vitest `include`
 * so `scripts/ci/verify-vitest-include.mjs` can see it; it reports as skipped.
 */
const LIVE = process.env.SKYACCESS_MCP_LIVE === "1";

const EXPECTED_TOOLS = [
  "search_empty_legs",
  "get_flight",
  "booking_handoff",
  "get_charter_estimate",
  "request_booking",
];

describe.skipIf(!LIVE)("live SkyAccess MCP endpoint", () => {
  it("serves exactly the five public tools over the doctor path", { timeout: 30_000 }, async () => {
    const report = await probe({ url: DEFAULT_MCP_URL });
    expect(report.serverInfo?.name).toBe("SkyAccess");
    expect(report.tools.sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it("serves the same five tools THROUGH THE BRIDGE over stdio", { timeout: 30_000 }, async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const chunks = [];
    stdout.on("data", (c) => chunks.push(c.toString("utf8")));

    const bridge = createBridge({ url: DEFAULT_MCP_URL, stdin, stdout, stderr });
    stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "skyaccess-mcp live test", version: "0.1.0" },
        },
      })}\n`,
    );
    stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);
    stdin.end();
    await bridge.done;

    const messages = chunks
      .join("")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    const list = messages.find((m) => m.id === 2);
    expect(list, `no tools/list reply; got ${JSON.stringify(messages)}`).toBeDefined();
    expect(list.result.tools.map((t) => t.name).sort()).toEqual([...EXPECTED_TOOLS].sort());
  });
});
