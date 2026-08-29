/**
 * Argument parsing and command dispatch for `skyaccess-mcp`.
 *
 * Kept separate from `bin/` so `parseArgs` is unit-testable without a process.
 */

import { createBridge } from "./bridge.mjs";
import { DEFAULT_MCP_URL, PACKAGE_NAME } from "./constants.mjs";
import { formatProbe, probe } from "./doctor.mjs";
import { applyInstall, formatReport, planInstall } from "./install.mjs";

const COMMANDS = new Set(["install", "bridge", "doctor", "help"]);

/**
 * @param {string[]} argv  arguments after the node binary and script
 * @returns {{ command: string, url: string, dryRun: boolean, only: string[], error?: string }}
 */
export function parseArgs(argv) {
  const result = { command: "install", url: DEFAULT_MCP_URL, dryRun: false, only: [] };
  let sawCommand = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--url") {
      const value = argv[++i];
      if (!value) return { ...result, error: "--url needs a value" };
      result.url = value;
    } else if (arg.startsWith("--url=")) {
      result.url = arg.slice("--url=".length);
    } else if (arg === "--client") {
      const value = argv[++i];
      if (!value) return { ...result, error: "--client needs a value" };
      result.only.push(value);
    } else if (arg.startsWith("--client=")) {
      result.only.push(arg.slice("--client=".length));
    } else if (arg === "--dry-run") {
      result.dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      result.command = "help";
      sawCommand = true;
    } else if (arg.startsWith("-")) {
      return { ...result, error: `unknown option: ${arg}` };
    } else if (!sawCommand) {
      if (!COMMANDS.has(arg)) return { ...result, error: `unknown command: ${arg}` };
      result.command = arg;
      sawCommand = true;
    } else {
      return { ...result, error: `unexpected argument: ${arg}` };
    }
  }
  return result;
}

export const HELP = `
${PACKAGE_NAME} — add the SkyAccess private-jet MCP server to your AI client.

  npx ${PACKAGE_NAME}                 register with every supported client found here
  npx ${PACKAGE_NAME} doctor          check the server and list its tools
  npx ${PACKAGE_NAME} bridge          run the stdio<->HTTP bridge (clients spawn this)

Options
  --url <url>       endpoint to use (default ${DEFAULT_MCP_URL})
  --client <id>     force a client even if it is not detected (cursor, claude-desktop)
  --dry-run         show what would be written, write nothing
  -h, --help        this text
`;

/**
 * @param {string[]} argv
 * @param {object} [io]
 * @returns {Promise<number>} process exit code
 */
export async function run(argv, io = {}) {
  const { stdout = process.stdout, stderr = process.stderr, stdin = process.stdin } = io;
  const args = parseArgs(argv);

  if (args.error) {
    stderr.write(`${args.error}\n${HELP}`);
    return 2;
  }
  if (args.command === "help") {
    stdout.write(HELP);
    return 0;
  }

  if (args.command === "bridge") {
    // ⛔ Nothing may be written to stdout here but JSON-RPC.
    const bridge = createBridge({ url: args.url, stdin, stdout, stderr });
    await bridge.done;
    return 0;
  }

  if (args.command === "doctor") {
    try {
      const report = await probe({ url: args.url });
      stdout.write(`${formatProbe(report, args.url).join("\n")}\n`);
      // No tools means the endpoint answered but has nothing to offer, which is
      // a failure for our purposes even though every HTTP hop succeeded.
      return report.tools.length > 0 ? 0 : 1;
    } catch (error) {
      stderr.write(`could not reach ${args.url}: ${error?.message ?? error}\n`);
      return 1;
    }
  }

  const plan = planInstall({ url: args.url, only: args.only });
  applyInstall(plan, { dryRun: args.dryRun });
  stdout.write(`${formatReport(plan, { url: args.url, dryRun: args.dryRun }).join("\n")}\n`);
  return 0;
}
