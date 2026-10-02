<img src="assets/icon.png" alt="SkyAccess" width="72" height="72">

# SkyAccess MCP server

SkyAccess is the world's largest empty leg marketplace by listing volume. This free, public MCP server lets any AI assistant search 5,000+ live empty leg flights from 900+ FAA Part 135 (and international equivalent) certified charter operators, often 25 to 75% below a comparable full charter. It also returns indicative charter price estimates and a booking link the traveler can open.

Use the hosted endpoint. Nothing needs to be installed.

```text
https://mcp.skyaccess.com/mcp
```

## Connection details

| | |
|---|---|
| Endpoint | `https://mcp.skyaccess.com/mcp` |
| Authentication | None. The server is free and anonymous: no account, sign-up, API key or OAuth. |
| Transport | Streamable HTTP, `POST` only, stateless. No `Mcp-Session-Id` is issued, so every request stands alone. `GET` returns `405` by design. |
| Required headers | `Content-Type: application/json`. `Accept` can be the MCP spec value `application/json, text/event-stream`, `application/json` alone, `*/*`, or left out. An `Accept` value that does not list `application/json` and is not just `*/*` (for example `text/html` or `text/event-stream` alone) returns `406`. |
| Response format | With `Accept: application/json, text/event-stream`, each reply is one Server-Sent Events message: `event: message`, then `data:` followed by the JSON-RPC response. With `application/json` alone, `*/*` or no `Accept` header, each reply is plain JSON (`Content-Type: application/json`). |
| Protocol version | `2025-06-18`. `2025-11-25`, `2025-03-26` and `2024-11-05` are also negotiated. |
| Rate limits | Tool calls: 30 requests per 60 seconds per client IP. Connection setup is not counted. `request_booking`: 10 charter enquiries per hour per client IP. See [Rate limits](#rate-limits). |
| Coverage | Global inventory, most of it in the United States. Prices and estimates are in USD. |
| Payments | None. No tool takes a payment or has a payment field. |
| Support | contact@skyaccess.com |
| Privacy policy | https://skyaccess.com/privacy#connector |
| Terms of service | https://skyaccess.com/terms |

## Connect from an MCP client

Any client that supports remote MCP servers over Streamable HTTP can use the endpoint directly. Leave authentication empty.

- **Claude (claude.ai and Claude Desktop):** Settings, Connectors, Add custom connector, then paste `https://mcp.skyaccess.com/mcp`.
- **Claude Code:**

  ```bash
  claude mcp add --transport http skyaccess https://mcp.skyaccess.com/mcp
  ```

- **Cursor:** add this to `~/.cursor/mcp.json`:

  ```json
  { "mcpServers": { "skyaccess": { "url": "https://mcp.skyaccess.com/mcp" } } }
  ```

- **Clients that only speak stdio** (for example Claude Desktop's `claude_desktop_config.json` file): use the bridge in this repository. See [Local installer and stdio bridge](#local-installer-and-stdio-bridge-npm-package-coming-soon).

## Try it with curl

List the tools:

```bash
curl -sS https://mcp.skyaccess.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Search empty legs (read-only):

```bash
curl -sS https://mcp.skyaccess.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_empty_legs","arguments":{"origin":"Los Angeles","destination":"Las Vegas","passengers":4}}}'
```

The server is stateless, so both commands work without an `initialize` handshake. MCP clients still send one, and the server answers it normally.

## Tools

| Tool | Type | What it does |
|---|---|---|
| `search_empty_legs` | Read-only | Searches live empty leg flights by `origin`, `destination`, `departureDateFrom`, `departureDateTo`, `passengers` and `max_price` (USD), all optional. Returns up to 5 flights with route, departure time, whole-aircraft price (taxes and fees shown at checkout), aircraft, seats, amenities, `flightId` and a booking link. |
| `get_flight` | Read-only | Re-reads one flight by `flightId`, or says it is no longer available. |
| `booking_handoff` | Read-only | Returns the SkyAccess booking page link for a `flightId`. It creates, holds or changes nothing; the traveler reviews and books on the page. |
| `get_charter_estimate` | Read-only | Returns an indicative USD price range per aircraft category, with flight time, for a charter from `origin` to `destination` (optional `passengers` and `aircraftCategory`). |
| `request_booking` | **Write** | Sends the traveler's name, email and trip details (`origin`, `destination`, `departureDate`, `passengers`, optional `notes`) to SkyAccess. A SkyAccess specialist follows up by email shortly to confirm availability and price. It takes no payment and creates no booking. |

A flight with `price: null` has no published price (SkyAccess shows it as "Contact for price"). Such flights can appear even when `max_price` is set, because their price is unknown.

Every tool carries MCP annotations: the four read-only tools set `readOnlyHint: true`, and `request_booking` sets `readOnlyHint: false`.

## Example prompts

1. "Find me a private jet from Los Angeles to Las Vegas this week for 4 people." (`search_empty_legs`)
2. "Are there any cheap private jet flights from Miami to the Bahamas?" (`search_empty_legs`)
3. "Show me empty legs from Teterboro to Palm Beach and give me the booking link for the cheapest one." (`search_empty_legs`, then `booking_handoff`)
4. "How much would it cost to charter a private jet from Teterboro to Aspen for 6 people?" (`get_charter_estimate`)
5. "What private jet deals are leaving Dallas this weekend?" (`search_empty_legs`)
6. "Roughly what does a private jet from New York to London cost for 8 passengers?" (`get_charter_estimate`)

Inventory changes all the time, so the flights returned differ from run to run.

## Data and privacy

The four read-only tools need no personal data. `request_booking` is the only tool that sends personal data: the name and email the traveler gives, plus the trip details and any notes, go to SkyAccess so a specialist can reply. Call it only when the traveler asks SkyAccess to contact them.

How SkyAccess handles this data: https://skyaccess.com/privacy#connector

## Rate limits

Current limits, per client IP:

- **Tool calls: 30 requests per 60 seconds.** Each request that carries a `tools/call` counts once. Connection setup is not counted: `initialize`, `notifications/initialized`, `notifications/cancelled`, `tools/list`, `ping`, and the `GET` an MCP client sends to open the optional SSE stream (answered `405`). A typical client turn (connect, list tools, call one tool) therefore spends 1 request. Any other method counts, and so does a setup request that is over 8 KB, chunked or compressed, or a batch that repeats a setup method. Counted tool-call responses carry `RateLimit-Policy: 30;w=60`, `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset` headers (a `request_booking` response carries the hourly limit's values instead); setup responses carry none.
- **10 charter enquiries per hour.** Only requests that call `request_booking` count toward this limit.
- **Per request:** a JSON-RPC batch may carry at most 4 tool calls, and at most 1 `request_booking` call. Larger batches return `400`.

Over a limit, the server answers HTTP `429` with JSON-RPC error code `-32029`. The `RateLimit-Reset` header gives the seconds until the window resets; retry after that.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `406 Not Acceptable` | The `Accept` header does not list `application/json` and is not just `*/*` (for example `text/html` or `text/event-stream` alone). Send `Accept: application/json, text/event-stream`, `application/json` or `*/*`, or leave `Accept` out. |
| `429`, JSON-RPC error `-32029` | A rate limit was reached. "Max 30 requests per minute" is the tool-call limit (connection setup does not count toward it); "Max 10 booking submissions per hour" is the `request_booking` limit. Wait `RateLimit-Reset` seconds, then retry. |
| `405` | The request was a `GET`. Send JSON-RPC over `POST`. MCP clients send one `GET` to open an optional SSE stream and read the `405` as "no stream offered"; that is expected and does not count toward the rate limit. |
| `400` "Only one request_booking call is allowed per request" or "At most 4 tool calls are allowed per request" | Split the JSON-RPC batch into smaller requests. |
| "No published empty leg flight matches that id." | The flight is no longer published (booked, withdrawn or departed), or the id is wrong. Run `search_empty_legs` again. |
| `get_charter_estimate` answers "Estimate temporarily unavailable. Please try again." | The same message is returned when a place name is not recognised. Retry with a major city name or an airport code such as `KTEB`. |

## Local installer and stdio bridge (npm package coming soon)

The `skyaccess-mcp` npm package is not published yet, so `npx skyaccess-mcp` does not work today. Use the hosted endpoint above. Once published, the package will:

1. Write the SkyAccess entry into the config of supported MCP clients found on the machine (Cursor and the Claude Desktop config file), so nobody has to hand-edit JSON.
2. Provide a stdio to HTTP bridge for clients that cannot take a URL.

### Run it from a clone today

The connectivity check and the bridge already work from a clone of this repository. They need Node 20 or later and no dependencies:

```bash
git clone https://github.com/sky-access/skyaccess-mcp.git
cd skyaccess-mcp
node bin/skyaccess-mcp.mjs doctor
```

`doctor` checks the endpoint and lists its tools. It exits non-zero if the endpoint is unreachable or returns no tools.

To use the bridge with a stdio-only client such as Claude Desktop's `claude_desktop_config.json`, point it at the absolute path of your clone:

```json
{
  "mcpServers": {
    "skyaccess": {
      "command": "node",
      "args": ["/absolute/path/to/skyaccess-mcp/bin/skyaccess-mcp.mjs", "bridge"]
    }
  }
}
```

Do not run the installer itself (`node bin/skyaccess-mcp.mjs` with no command) from a clone yet. The Claude Desktop entry it writes starts the bridge through `npx -y skyaccess-mcp`, which fails until the package is published.

### Commands once the package is published

These are not available yet:

```bash
npx skyaccess-mcp              # register with every supported client found on this machine
npx skyaccess-mcp --dry-run    # show what would be written, write nothing
npx skyaccess-mcp doctor       # check the endpoint and list its tools
npx skyaccess-mcp bridge       # the stdio to HTTP bridge (clients spawn this)
```

Options: `--url <url>`, `--client <cursor|claude-desktop>`, `--dry-run`, `--help`.

### How the installer treats your config files

- It only writes to a client whose own directory already exists, so it never creates `~/.cursor` on a machine without Cursor.
- It keeps every other key in the file, so your other MCP servers stay as they are.
- It leaves a config that does not parse as JSON untouched and reports it; it never overwrites one.
- It backs up an existing SkyAccess entry to `<config>.skyaccess-backup` before replacing it.

### Design notes

- **No runtime dependencies**, so there is no transitive supply chain to audit. Plain ESM with no build step: what ships is what is in `src/`.
- The bridge writes **only** JSON-RPC to stdout, one message per line, and sends every diagnostic to stderr. A stray stdout write would corrupt the protocol.
- A notification answered with `202` produces no stdout line, because a reply the client never asked for is a protocol violation.
- A failed HTTP hop for a request becomes a JSON-RPC error with the same `id`, so the client fails fast instead of waiting forever.

## Development

```bash
npm install          # installs vitest, the only dev dependency
npm test             # offline suite against a real local HTTP server, no network
npm run test:live    # opt-in live suite against https://mcp.skyaccess.com/mcp
```

The live suite only sends `initialize` and `tools/list`. It is kept out of `npm test` because it depends on DNS and the public internet, neither of which says anything about whether the code is correct.

## License

MIT. See [LICENSE](LICENSE).
