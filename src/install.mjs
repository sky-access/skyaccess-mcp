/**
 * `npx skyaccess-mcp` — register the SkyAccess MCP server with the clients on
 * this machine, and print the exact step for the ones that cannot be automated.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { getClientTargets, manualSteps, mergeServerEntry } from "./clients.mjs";
import { DEFAULT_MCP_URL, SERVER_KEY } from "./constants.mjs";

/**
 * Decide what to do for every target, without touching the filesystem.
 *
 * Split from the writing so the decision is testable on its own — the part that
 * can silently do the wrong thing is the decision, not the `writeFileSync`.
 *
 * @param {object} [options]
 * @param {string} [options.url]
 * @param {string[]} [options.only]  client ids to force, ignoring detection
 * @param {object} [options.fs]      injection seam: { exists, read }
 * @param {object} [options.targetOptions]
 * @returns {Array<{ target: object, action: string, text?: string, reason?: string }>}
 */
export function planInstall({
  url = DEFAULT_MCP_URL,
  only = [],
  fs = { exists: existsSync, read: (p) => readFileSync(p, "utf8") },
  targetOptions = {},
} = {}) {
  const targets = getClientTargets({ url, ...targetOptions });
  const forced = new Set(only);

  return targets.map((target) => {
    // Detection is "does the client's own directory exist". Without it, running
    // the installer would CREATE ~/.cursor on a machine with no Cursor, leaving
    // config for software that is not there.
    if (!forced.has(target.id) && !fs.exists(target.detectDir)) {
      return { target, action: "skipped", reason: "not installed" };
    }

    const existingText = fs.exists(target.configPath) ? fs.read(target.configPath) : null;
    const merged = mergeServerEntry(existingText, SERVER_KEY, target.entry);
    if (merged.status === "unparseable") {
      return { target, action: "unparseable", reason: "config is not valid JSON — left untouched" };
    }
    return { target, action: merged.status, text: merged.text };
  });
}

/**
 * Execute a plan.
 *
 * @param {ReturnType<typeof planInstall>} plan
 * @param {object} [options]
 * @param {boolean} [options.dryRun]
 * @param {object} [options.fs]
 */
export function applyInstall(plan, { dryRun = false, fs = defaultWriteFs() } = {}) {
  const applied = [];
  for (const step of plan) {
    if (step.text === undefined || dryRun) {
      applied.push(step);
      continue;
    }
    // Back up before the first overwrite. A config file can hold every other MCP
    // server the user has set up; a bad merge with no backup is unrecoverable.
    if (step.action === "updated" && fs.exists(step.target.configPath)) {
      fs.write(`${step.target.configPath}.skyaccess-backup`, fs.read(step.target.configPath));
    }
    fs.mkdir(dirname(step.target.configPath));
    fs.write(step.target.configPath, step.text);
    applied.push(step);
  }
  return applied;
}

function defaultWriteFs() {
  return {
    exists: existsSync,
    read: (p) => readFileSync(p, "utf8"),
    write: (p, text) => writeFileSync(p, text),
    mkdir: (p) => mkdirSync(p, { recursive: true }),
  };
}

/**
 * Human-readable report. Returned as lines so it is assertable in a test rather
 * than only observable by eye.
 *
 * @param {ReturnType<typeof planInstall>} plan
 * @param {object} [options]
 */
export function formatReport(plan, { url = DEFAULT_MCP_URL, dryRun = false } = {}) {
  const lines = [
    "",
    `SkyAccess MCP  ->  ${url}`,
    dryRun ? "  (dry run — nothing was written)" : "",
  ].filter(Boolean);

  for (const step of plan) {
    const how = step.target.transport === "remote" ? "remote URL" : "stdio bridge";
    switch (step.action) {
      case "created":
      case "updated":
        lines.push(`  ✓ ${step.target.label} — ${step.action} ${step.target.configPath} (${how})`);
        break;
      case "unchanged":
        lines.push(`  = ${step.target.label} — already configured (${how})`);
        break;
      case "unparseable":
        lines.push(`  ! ${step.target.label} — ${step.reason}: ${step.target.configPath}`);
        break;
      default:
        lines.push(`  · ${step.target.label} — ${step.reason}`);
    }
  }

  const wrote = plan.some((s) => s.action === "created" || s.action === "updated");
  if (wrote && !dryRun) lines.push("", "  Restart the client to pick this up.");

  lines.push("", "  Clients that register remotely, by command or UI:");
  for (const { label, instruction } of manualSteps(url)) {
    lines.push(`    ${label}:`, `      ${instruction}`);
  }
  lines.push("");
  return lines;
}
