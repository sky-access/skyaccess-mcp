# SkyAccess

Search private jet empty leg flights, get charter price estimates and booking links from [SkyAccess](https://skyaccess.com) inside Dify Agent, Chatflow and Workflow apps.

**Author:** skyaccess
**Version:** 0.0.1
**Type:** tool
**Source:** https://github.com/sky-access/skyaccess-mcp (plugin source in `integrations/dify`)
**Contact:** contact@skyaccess.com

## Overview

SkyAccess is the world's largest empty leg marketplace by listing volume. Search 5,000+ live empty leg flights, get charter price estimates and booking links. No account or API key.

Empty legs are private jet repositioning flights, often 25 to 75% below a comparable full charter. Flights on SkyAccess are operated by 900+ FAA Part 135 (and international equivalent) certified charter operators.

This plugin wraps the read-only tools of the SkyAccess public MCP server.

## Tools

| Tool | What it does |
| ---- | ------------ |
| Search Empty Legs | Finds empty leg flights by origin, destination, departure date range, passenger count and an optional price ceiling. Returns up to 5 flights with route, departure time, whole-aircraft price, aircraft type, available seats, flight id and booking link. |
| Get Flight | Re-reads one flight by its flight id, including amenities, as currently published. |
| Get Booking Link | Returns the SkyAccess booking page link for a flight, to hand to the traveller. |
| Get Charter Estimate | Returns an indicative minimum and maximum USD price range for a charter route, by aircraft category and passenger count. |

All four tools are read-only. A booking link opens the SkyAccess booking page; nothing is booked or held until the traveller completes the booking there.

## Setup

1. In Dify, open **Plugins**, then **Explore Marketplace**, and search for **SkyAccess**.
2. Click **Install**.
3. There is nothing to configure. No authorization step is needed.

## Usage

**Agent apps:** add the SkyAccess tools to the agent, then ask things like:

- "Find empty legs from Los Angeles to Las Vegas next weekend for 4 passengers."
- "What would a midsize jet charter from Teterboro to Palm Beach cost?"
- "Give me the booking link for flight <flight id>."

**Workflow and Chatflow apps:** add a Tool node, choose SkyAccess and the tool you need, and map your inputs (for example origin, destination and dates) to the tool parameters. Each tool returns text and, where available, a JSON object for downstream nodes.

Prices are whole-aircraft prices in USD. Taxes and fees are shown separately on SkyAccess before booking. A flight with no published price is shown as "Contact for price". Charter estimates are indicative ranges, not quotes.

## Credentials

None. The SkyAccess MCP server is public. No account, API key, token or other credential is required, and the plugin sends none.

## Connection requirements

The plugin connects over HTTPS to one fixed endpoint, `https://mcp.skyaccess.com/mcp` (the SkyAccess public MCP server, streamable HTTP transport). The endpoint is not user-configurable. Self-hosted Dify instances need outbound network access to `mcp.skyaccess.com` on port 443. Requests time out after 30 seconds.

## Connecting the MCP server directly

Dify versions with built-in MCP support can also add the server by URL: **Tools**, then **MCP**, then **Add MCP Server (HTTP)**, with the URL `https://mcp.skyaccess.com/mcp`.

## Privacy

See [PRIVACY.md](PRIVACY.md) and the SkyAccess privacy policy at https://skyaccess.com/privacy#connector. Terms: https://skyaccess.com/terms.

## Support

Email contact@skyaccess.com or open an issue at https://github.com/sky-access/skyaccess-mcp/issues.
