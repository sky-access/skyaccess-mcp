# skyaccess-mcp

One command to add the SkyAccess private-jet MCP server to your AI client.

```bash
npx skyaccess-mcp
```

The server is public, anonymous, and read-mostly. It serves five tools:

| Tool                   | Does                                                     |
| ---------------------- | -------------------------------------------------------- |
| `search_empty_legs`    | Find discounted empty-leg flights by route, date, pax    |
| `get_flight`           | Re-read one leg by id                                    |
| `booking_handoff`      | Get the customer-facing booking link for a leg           |
| `get_charter_estimate` | Indicative price range for a charter route               |
| `request_booking`      | Submit a charter enquiry (**the only tool that writes**) |

Endpoint: `https://mcp.skyaccess.com/mcp`

## Do you even need this package?

Often not, and that is the honest answer. Checked against vendor docs on 2026-08-28:

| Client                                      | Supports a remote URL natively? | What you actually do                                           |
| ------------------------------------------- | ------------------------------- | -------------------------------------------------------------- |
| **Claude.ai / Claude Desktop** (Connectors) | Yes                             | Settings → Connectors → Add custom connector → paste the URL   |
| **Claude Code**                             | Yes                             | `claude mcp add --transport http --scope user skyaccess <url>` |
| **Cursor**                                  | Yes                             | a `{ "url": ... }` entry in `~/.cursor/mcp.json`               |
| **`claude_desktop_config.json`**            | **No — stdio only**             | needs a local process, i.e. the bridge in this package         |

So this package does two things and nothing more:

1. **Writes the config** for clients that take a remote URL, so you do not have to hand-edit JSON.
2. **Ships a stdio↔HTTP bridge** for the one path that genuinely cannot take a URL —
   Claude Desktop's config file, and any other stdio-only client.

If you would rather paste a URL into a settings pane, do that. Nothing here is required.

## Commands

```bash
npx skyaccess-mcp              # register with every supported client found on this machine
npx skyaccess-mcp --dry-run    # show what would be written, write nothing
npx skyaccess-mcp doctor       # check the endpoint and list its tools
npx skyaccess-mcp bridge       # the stdio<->HTTP bridge (clients spawn this; not for humans)
```

Options: `--url <url>`, `--client <cursor|claude-desktop>`, `--dry-run`, `--help`.

`doctor` exits non-zero if the endpoint is unreachable or returns no tools, so it is usable in a
script.

## What gets written

**Cursor** — `~/.cursor/mcp.json`, remote, no local process:

```json
{ "mcpServers": { "skyaccess": { "url": "https://mcp.skyaccess.com/mcp" } } }
```

**Claude Desktop config file** — stdio, because that file rejects a `url`:

```json
{
  "mcpServers": {
    "skyaccess": {
      "command": "npx",
      "args": ["-y", "skyaccess-mcp", "bridge", "--url", "https://mcp.skyaccess.com/mcp"]
    }
  }
}
```

Safety rules the installer follows:

- A client is only written to if its own directory already exists — running this will not create
  `~/.cursor` on a machine with no Cursor.
- Every other key in the file is preserved; your other MCP servers survive verbatim.
- A config that does not parse as JSON is **left untouched** and reported, never overwritten.
- An existing entry is backed up to `<config>.skyaccess-backup` before it is replaced.

## Design notes

- **Zero runtime dependencies.** `npx` downloads exactly this package and nothing else, so there
  is no transitive supply chain to audit for a one-shot installer. Node 20+ only.
- **Plain ESM, no build step.** What is published is what is in `src/`.
- The bridge writes **only** JSON-RPC to stdout, one message per line; every diagnostic goes to
  stderr. A stray stdout write corrupts the protocol.
- A notification answered with `202` produces no stdout line — synthesising a reply the client
  never asked for is a protocol violation.
- A failed HTTP hop for a request is turned into a JSON-RPC error carrying the same `id`, so the
  client fails fast instead of hanging forever.

## Tests

```bash
pnpm --filter skyaccess-mcp test        # offline: real local http server, no network
pnpm --filter skyaccess-mcp test:live   # hits https://mcp.skyaccess.com/mcp
```

The live suite is opt-in (`SKYACCESS_MCP_LIVE=1`) and deliberately outside the CI gate: it
depends on DNS, the public internet and a 30-req/min rate limit, none of which say anything about
whether this code is correct.

## Publishing

⚠️ **Not published yet.** `registry.npmjs.org/skyaccess-mcp` is a 404 and the name is unclaimed.
This is also the first non-private package in this monorepo — everything else is `private: true`.

To publish (requires an npm account with rights to the name):

```bash
cd packages/skyaccess-mcp
npm publish --access public     # publishConfig.access is already set to public
```

Then verify the real path a user takes:

```bash
npx -y skyaccess-mcp@latest doctor
```
