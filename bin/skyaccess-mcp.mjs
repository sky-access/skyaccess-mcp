#!/usr/bin/env node
import { run } from "../src/cli.mjs";

run(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    process.stderr.write(`[skyaccess-mcp] ${error?.stack ?? error}\n`);
    process.exitCode = 1;
  },
);
