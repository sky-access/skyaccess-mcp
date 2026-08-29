import { describe, expect, it } from "vitest";

import { getClientTargets, mergeServerEntry } from "../clients.mjs";
import { parseArgs } from "../cli.mjs";
import { formatReport, planInstall } from "../install.mjs";

const URL_UNDER_TEST = "https://mcp.skyaccess.com/mcp";

/** Minimal fs seam: a map of path -> contents. */
function fakeFs(files) {
  return {
    exists: (p) => Object.prototype.hasOwnProperty.call(files, p),
    read: (p) => files[p],
  };
}

describe("getClientTargets", () => {
  it("gives Cursor a remote url entry and Claude Desktop a stdio bridge entry", () => {
    // This asymmetry IS the product decision: claude_desktop_config.json cannot
    // take a url, Cursor's mcp.json can. Collapsing them breaks one of the two.
    const targets = getClientTargets({
      url: URL_UNDER_TEST,
      platform: "darwin",
      home: "/home/e",
      env: {},
    });

    const cursor = targets.find((t) => t.id === "cursor");
    expect(cursor.configPath).toBe("/home/e/.cursor/mcp.json");
    expect(cursor.entry).toEqual({ url: URL_UNDER_TEST });

    const desktop = targets.find((t) => t.id === "claude-desktop");
    expect(desktop.configPath).toBe(
      "/home/e/Library/Application Support/Claude/claude_desktop_config.json",
    );
    expect(desktop.entry.url).toBeUndefined();
    expect(desktop.entry.command).toBe("npx");
    expect(desktop.entry.args).toEqual(["-y", "skyaccess-mcp", "bridge", "--url", URL_UNDER_TEST]);
  });

  it("uses APPDATA for the Claude Desktop path on Windows", () => {
    const targets = getClientTargets({
      platform: "win32",
      home: "C:\\Users\\e",
      env: { APPDATA: "C:\\Users\\e\\AppData\\Roaming" },
    });
    expect(targets.find((t) => t.id === "claude-desktop").configPath).toContain("AppData");
  });
});

describe("mergeServerEntry", () => {
  it("preserves every other server and top-level key already in the file", () => {
    const existing = JSON.stringify({
      someOtherSetting: true,
      mcpServers: { linear: { url: "https://mcp.linear.app/mcp" } },
    });

    const merged = mergeServerEntry(existing, "skyaccess", { url: URL_UNDER_TEST });
    const doc = JSON.parse(merged.text);

    expect(merged.status).toBe("created");
    expect(doc.someOtherSetting).toBe(true);
    expect(doc.mcpServers.linear).toEqual({ url: "https://mcp.linear.app/mcp" });
    expect(doc.mcpServers.skyaccess).toEqual({ url: URL_UNDER_TEST });
  });

  it("refuses to write over a config it cannot parse", () => {
    // Overwriting here would silently delete every server the user had.
    const merged = mergeServerEntry("{ not json", "skyaccess", { url: URL_UNDER_TEST });
    expect(merged.status).toBe("unparseable");
    expect(merged.text).toBeUndefined();
  });

  it("refuses a top-level JSON array, which is parseable but not a config", () => {
    expect(mergeServerEntry("[]", "skyaccess", { url: URL_UNDER_TEST }).status).toBe("unparseable");
  });

  it("reports unchanged and writes nothing when the entry already matches", () => {
    const existing = JSON.stringify({ mcpServers: { skyaccess: { url: URL_UNDER_TEST } } });
    const merged = mergeServerEntry(existing, "skyaccess", { url: URL_UNDER_TEST });
    expect(merged.status).toBe("unchanged");
    expect(merged.text).toBeUndefined();
  });

  it("reports updated when the entry exists but differs", () => {
    const existing = JSON.stringify({ mcpServers: { skyaccess: { url: "https://old/mcp" } } });
    const merged = mergeServerEntry(existing, "skyaccess", { url: URL_UNDER_TEST });
    expect(merged.status).toBe("updated");
    expect(JSON.parse(merged.text).mcpServers.skyaccess.url).toBe(URL_UNDER_TEST);
  });

  it("creates the document when there is no file yet", () => {
    const merged = mergeServerEntry(null, "skyaccess", { url: URL_UNDER_TEST });
    expect(merged.status).toBe("created");
    expect(JSON.parse(merged.text).mcpServers.skyaccess).toEqual({ url: URL_UNDER_TEST });
  });
});

describe("planInstall", () => {
  const targetOptions = { platform: "darwin", home: "/home/e", env: {} };

  it("skips a client whose directory does not exist rather than creating config for it", () => {
    const plan = planInstall({ url: URL_UNDER_TEST, fs: fakeFs({}), targetOptions });
    expect(plan.every((s) => s.action === "skipped")).toBe(true);
    expect(plan.every((s) => s.text === undefined)).toBe(true);
  });

  it("plans a write for a detected client with no config file yet", () => {
    const plan = planInstall({
      url: URL_UNDER_TEST,
      fs: fakeFs({ "/home/e/.cursor": "" }),
      targetOptions,
    });
    const cursor = plan.find((s) => s.target.id === "cursor");
    expect(cursor.action).toBe("created");
    expect(JSON.parse(cursor.text).mcpServers.skyaccess).toEqual({ url: URL_UNDER_TEST });
  });

  it("honours --client for a client that is not installed", () => {
    const plan = planInstall({
      url: URL_UNDER_TEST,
      only: ["cursor"],
      fs: fakeFs({}),
      targetOptions,
    });
    expect(plan.find((s) => s.target.id === "cursor").action).toBe("created");
    expect(plan.find((s) => s.target.id === "claude-desktop").action).toBe("skipped");
  });
});

describe("formatReport", () => {
  it("always prints the Claude Code and Connectors instructions", () => {
    const lines = formatReport([], { url: URL_UNDER_TEST }).join("\n");
    expect(lines).toContain(
      `claude mcp add --transport http --scope user skyaccess ${URL_UNDER_TEST}`,
    );
    expect(lines).toContain("Add custom connector");
  });
});

describe("parseArgs", () => {
  it("defaults to install against the public endpoint", () => {
    expect(parseArgs([])).toMatchObject({ command: "install", url: URL_UNDER_TEST, dryRun: false });
  });

  it("accepts --url in both forms", () => {
    expect(parseArgs(["--url", "https://x/mcp"]).url).toBe("https://x/mcp");
    expect(parseArgs(["--url=https://y/mcp"]).url).toBe("https://y/mcp");
  });

  it("parses the bridge command with a url, which is what a client spawns", () => {
    expect(parseArgs(["bridge", "--url", "https://x/mcp"])).toMatchObject({
      command: "bridge",
      url: "https://x/mcp",
    });
  });

  it("rejects an unknown command instead of silently installing", () => {
    expect(parseArgs(["frobnicate"]).error).toContain("unknown command");
  });

  it("rejects --url with no value", () => {
    expect(parseArgs(["--url"]).error).toContain("--url");
  });
});
