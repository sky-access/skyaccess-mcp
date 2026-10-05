---
name: empty-legs
description: Search 5,000+ live private jet empty leg flights, re-check one flight, get a SkyAccess booking link, or get an indicative full charter price, using the free SkyAccess MCP server at https://mcp.skyaccess.com/mcp (no account or API key). Use when the user asks about private jet flights, empty legs, private jet charter prices or booking a private jet.
---

# SkyAccess private jet empty legs

SkyAccess (https://skyaccess.com) is the world's largest empty leg marketplace by listing volume. Its public MCP server searches 5,000+ live empty leg flights from 900+ FAA Part 135 (and international equivalent) certified charter operators, often 25 to 75% below a comparable full charter. It also returns indicative charter price estimates and a booking link the traveler can open.

## Connect

If the SkyAccess tools (`search_empty_legs`, `get_flight`, `booking_handoff`, `get_charter_estimate`, `request_booking`) are already available, for example through the SkyAccess Claude Code plugin, skip this section.

Otherwise, ask the user before changing their MCP configuration, then add the hosted server. It is a remote Streamable HTTP endpoint with no authentication, and nothing runs on the user's machine:

- Claude Code: `claude mcp add --transport http skyaccess https://mcp.skyaccess.com/mcp`
- VS Code (GitHub Copilot): `code --add-mcp '{"name":"skyaccess","type":"http","url":"https://mcp.skyaccess.com/mcp"}'`
- Gemini CLI: `gemini extensions install https://github.com/sky-access/skyaccess-mcp`
- Cursor: add `{ "mcpServers": { "skyaccess": { "url": "https://mcp.skyaccess.com/mcp" } } }` to `~/.cursor/mcp.json`
- Any other MCP client: add a remote server with the URL `https://mcp.skyaccess.com/mcp` and leave authentication empty.

A newly added server can need a client restart before its tools appear.

If the agent cannot add an MCP server but can run shell commands, call the endpoint over HTTP. The server is stateless, so no `initialize` handshake is needed, and `Accept: application/json` returns plain JSON:

```bash
curl -sS https://mcp.skyaccess.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_empty_legs","arguments":{"origin":"Los Angeles","destination":"Las Vegas","passengers":4}}}'
```

Send `{"jsonrpc":"2.0","id":1,"method":"tools/list"}` the same way to read every tool's input schema.

## Use the tools

- `search_empty_legs`, `get_flight`, `booking_handoff` and `get_charter_estimate` are read-only.
- `search_empty_legs` takes optional `origin`, `destination`, `departureDateFrom`, `departureDateTo`, `passengers` and `max_price` (USD), and returns up to 5 flights. Inventory changes all the time, so search again rather than reusing old results.
- Call `get_flight` with a `flightId` to confirm a leg is still published before sharing a link.
- Prices are for the whole aircraft, in USD. Taxes and fees are shown at checkout.
- A flight with `price: null` has no published price; SkyAccess shows it as "Contact for price".
- `get_charter_estimate` takes `origin`, `destination` and optional `passengers` and `aircraftCategory`, and gives an indicative range for a full charter, not a quote.
- To book, give the traveler the link from `booking_handoff`. The traveler reviews and books on the SkyAccess page.
- Call `request_booking` only when the traveler asks SkyAccess to contact them and has given a name and email. It sends those details and the trip to SkyAccess, and a specialist replies by email. It takes no payment and creates no booking.
- Tool calls are limited to 30 per 60 seconds per client IP. On HTTP 429, wait the number of seconds in the `RateLimit-Reset` header, then retry.

Support: contact@skyaccess.com. Privacy: https://skyaccess.com/privacy#connector. Terms: https://skyaccess.com/terms.
