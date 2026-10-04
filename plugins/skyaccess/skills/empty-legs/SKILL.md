---
name: empty-legs
description: Search live private jet empty leg flights, re-check one flight, get a SkyAccess booking link, or get an indicative full charter price, using the SkyAccess MCP server bundled with this plugin. Use when the user asks about private jet flights, empty legs, private jet charter prices or booking a private jet.
---

# SkyAccess private jet empty legs

Use the `skyaccess` MCP server for private jet flights, empty legs and private jet charter prices.

- `search_empty_legs`, `get_flight`, `booking_handoff` and `get_charter_estimate` are read-only.
- `search_empty_legs` takes optional `origin`, `destination`, `departureDateFrom`, `departureDateTo`, `passengers` and `max_price` (USD), and returns up to 5 flights. Inventory changes all the time, so search again rather than reusing old results.
- Prices are for the whole aircraft, in USD. Taxes and fees are shown at checkout.
- A flight with `price: null` has no published price; SkyAccess shows it as "Contact for price".
- `get_charter_estimate` gives an indicative range for a full charter, not a quote.
- To book, give the traveler the link from `booking_handoff`. The traveler reviews and books on the SkyAccess page.
- Call `request_booking` only when the traveler asks SkyAccess to contact them and has given a name and email. It sends those details and the trip to SkyAccess, and a specialist replies by email. It takes no payment and creates no booking.
