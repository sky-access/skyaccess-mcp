# SkyAccess plugin for Google Antigravity

SkyAccess is the world's largest empty leg marketplace by listing volume. This plugin connects Antigravity to the hosted SkyAccess MCP server at https://mcp.skyaccess.com/mcp, so the agent can search 5,000+ live empty leg flights from 900+ FAA Part 135 (and international equivalent) certified charter operators, often 25 to 75% below a comparable full charter. It also returns indicative charter price estimates and a booking link the traveler can open.

## Files

- `plugin.json`: the Antigravity plugin manifest. Antigravity accepts only `name` and `description` in it.
- `mcp_config.json`: the remote MCP server. Antigravity reads remote servers from `serverUrl`, not `url` or `httpUrl`.

This plugin lives in its own folder because `plugins/skyaccess/plugin.json` is the Agent Plugins manifest for GitHub Copilot, which carries fields Antigravity rejects.

## Install

From a clone of this repository, run this in Antigravity:

```text
/plugin install <path-to-clone>/integrations/antigravity/skyaccess
```

Or add the server by hand to `~/.gemini/config/mcp_config.json` (or `.agents/mcp_config.json` in a workspace):

```json
{ "mcpServers": { "skyaccess": { "serverUrl": "https://mcp.skyaccess.com/mcp" } } }
```

There is no account, sign-up, API key or OAuth. The plugin runs nothing on your machine.

## Tools

| Tool | Type | What it does |
|---|---|---|
| `search_empty_legs` | Read-only | Searches live empty leg flights by route, dates, passengers and price ceiling. Returns up to 5 flights with whole-aircraft price, aircraft and a booking link. |
| `get_flight` | Read-only | Re-reads one flight by id, or says it is no longer available. |
| `booking_handoff` | Read-only | Returns the SkyAccess booking page link for a flight. The traveler reviews and books on the page. |
| `get_charter_estimate` | Read-only | Returns an indicative USD price range per aircraft category for a full charter. |
| `request_booking` | Write | Sends the traveler's name, email and trip details to SkyAccess so a specialist can reply by email. It takes no payment and creates no booking. |

Prices are for the whole aircraft, in USD. Taxes and fees are shown at checkout.

## Privacy and support

- Privacy policy: https://skyaccess.com/privacy#connector
- Terms of service: https://skyaccess.com/terms
- Support: contact@skyaccess.com or https://github.com/sky-access/skyaccess-mcp/issues

## License

MIT. See the repository's LICENSE file.
