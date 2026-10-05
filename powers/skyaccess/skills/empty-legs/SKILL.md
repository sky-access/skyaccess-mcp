---
name: "empty-legs"
description: "Search live private jet empty leg flights, re-check one flight, get a SkyAccess booking link, or get an indicative full charter price with the SkyAccess MCP server. Use when the user asks about private jet flights, empty legs, private jet charter prices or booking a private jet."
license: "MIT"
metadata:
  author: "SkyAccess Inc."
  version: "1.0.2"
---

# SkyAccess private jet empty legs

## Overview

SkyAccess is the world's largest empty leg marketplace by listing volume. This power connects Kiro to the hosted SkyAccess MCP server at `https://mcp.skyaccess.com/mcp`, so the agent can search 5,000+ live empty leg flights from 900+ FAA Part 135 (and international equivalent) certified charter operators, often 25 to 75% below a comparable full charter. It also returns indicative charter price estimates and a booking link the traveler can open.

## Prerequisites Checklist

- [ ] Nothing to install. The server is remote (Streamable HTTP) and runs nothing on your machine.
- [ ] No account, sign-up, API key or OAuth. Leave authentication empty.

## Tools

| Tool | Type | What it does |
|---|---|---|
| `search_empty_legs` | Read-only | Searches live empty leg flights by `origin`, `destination`, `departureDateFrom`, `departureDateTo`, `passengers` and `max_price` (USD), all optional. Returns up to 5 flights with route, departure time, whole-aircraft price, aircraft, seats, `flightId` and a booking link. |
| `get_flight` | Read-only | Re-reads one flight by `flightId`, or says it is no longer available. |
| `booking_handoff` | Read-only | Returns the SkyAccess booking page link for a `flightId`. It creates, holds or changes nothing; the traveler reviews and books on the page. |
| `get_charter_estimate` | Read-only | Returns an indicative USD price range per aircraft category, with flight time, for a charter from `origin` to `destination` (optional `passengers` and `aircraftCategory`). |
| `request_booking` | Write | Sends the traveler's name, email and trip details to SkyAccess so a specialist can reply by email. It takes no payment and creates no booking. |

## Step-by-Step Guide

### 1. Search

Call `search_empty_legs` with whatever the user gave: a city or airport code for `origin` and `destination`, a date window, the number of passengers and a price ceiling. Every field is optional. Inventory changes all the time, so search again rather than reusing old results.

### 2. Present the results

- Prices are for the whole aircraft, in USD. Taxes and fees are shown at checkout.
- A flight with `price: null` has no published price; SkyAccess shows it as "Contact for price".
- Show route, departure time, aircraft, seats and price for each flight, and keep the `flightId` for follow-up calls.

### 3. Re-check before the user commits

Call `get_flight` with the `flightId` to confirm the leg is still published before sharing a link.

### 4. Hand off to book

Call `booking_handoff` and give the traveler the link. The traveler reviews and books on the SkyAccess page.

## Common Workflows

### Workflow: find an empty leg

**Goal:** a short list of flights on a route.

1. `search_empty_legs` with `origin`, `destination` and `passengers`.
2. Present up to 5 flights with whole-aircraft prices.
3. `booking_handoff` for the flight the user picks.

### Workflow: price a full charter

**Goal:** a ballpark figure for a route with no matching empty leg.

1. `get_charter_estimate` with `origin`, `destination` and optional `passengers` or `aircraftCategory`.
2. Present the range as indicative, not a quote.

### Workflow: ask SkyAccess to follow up

**Goal:** the traveler wants a specialist to contact them.

1. Confirm the traveler asked SkyAccess to contact them and gave a name and email.
2. Call `request_booking` once with those details and the trip.
3. Tell the traveler a SkyAccess specialist will reply by email. Nothing is booked or charged.

## Troubleshooting

### Error: "No published empty leg flight matches that id."

**Cause:** the flight was booked, withdrawn or has departed, or the id is wrong.
**Solution:** run `search_empty_legs` again.

### Error: "Estimate temporarily unavailable. Please try again."

**Cause:** the same message is returned when a place name is not recognised.
**Solution:** retry with a major city name or an airport code such as `KTEB`.

### Error: HTTP 429, JSON-RPC error -32029

**Cause:** a rate limit was reached (30 tool calls per 60 seconds per client IP; 10 `request_booking` calls per hour).
**Solution:** wait the number of seconds in the `RateLimit-Reset` header, then retry.

## Best Practices

- Use the four read-only tools freely; they send only search terms.
- Never call `request_booking` unless the traveler asked SkyAccess to contact them.
- Describe prices as whole-aircraft prices with taxes and fees shown at checkout.
- Treat `get_charter_estimate` results as an indicative range, not a quote.

## Support and privacy

- Support: contact@skyaccess.com or https://github.com/sky-access/skyaccess-mcp/issues
- Privacy policy: https://skyaccess.com/privacy#connector
- Terms of service: https://skyaccess.com/terms
