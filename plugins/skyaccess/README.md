# SkyAccess plugin

SkyAccess is the world's largest empty leg marketplace by listing volume. This plugin connects Claude Code, GitHub Copilot CLI and other Agent Plugins clients to the hosted SkyAccess MCP server at https://mcp.skyaccess.com/mcp, so it can search 5,000+ live empty leg flights from 900+ FAA Part 135 (and international equivalent) certified charter operators, often 25 to 75% below a comparable full charter. It also returns indicative charter price estimates and a booking link the traveler can open.

## Install

Claude Code:

```bash
claude plugin marketplace add sky-access/skyaccess-mcp
claude plugin install skyaccess@skyaccess
```

GitHub Copilot CLI:

```bash
copilot plugin marketplace add sky-access/skyaccess-mcp
copilot plugin install skyaccess@skyaccess
```

The plugin ships two manifests with the same content: `.claude-plugin/plugin.json` with `.mcp.json` for Claude Code, and an [Agent Plugins](https://agent-plugins.org) 1.0.0 `plugin.json` with `mcp.json` for GitHub Copilot, VS Code and other Agent Plugins clients.

## What it adds

- The MCP server `skyaccess`: remote, Streamable HTTP, no account, sign-up or API key.
- The skill `empty-legs`, which tells the agent when to use each tool and how to present prices and booking links.

The plugin runs nothing on your machine. It has no hooks, no scripts and no local server.

## Tools

| Tool | Type | What it does |
|---|---|---|
| `search_empty_legs` | Read-only | Searches live empty leg flights by route, dates, passengers and price ceiling. Returns up to 5 flights with whole-aircraft price, aircraft and a booking link. |
| `get_flight` | Read-only | Re-reads one flight by id, or says it is no longer available. |
| `booking_handoff` | Read-only | Returns the SkyAccess booking page link for a flight. The traveler reviews and books on the page. |
| `get_charter_estimate` | Read-only | Returns an indicative USD price range per aircraft category for a full charter. |
| `request_booking` | Write | Sends the traveler's name, email and trip details to SkyAccess so a specialist can reply by email. It takes no payment and creates no booking. |

Prices are for the whole aircraft, in USD. Taxes and fees are shown at checkout.

## What it sends

The four read-only tools send only search terms (route, dates, passengers, price ceiling, flight id) to mcp.skyaccess.com. `request_booking` is the only tool that sends personal data: the traveler's name and email, the trip details and any notes go to SkyAccess so a specialist can reply. The plugin stores nothing.

- Privacy policy: https://skyaccess.com/privacy#connector
- Terms of service: https://skyaccess.com/terms
- Support: contact@skyaccess.com or https://github.com/sky-access/skyaccess-mcp/issues

## License

MIT. See the repository's LICENSE file.
