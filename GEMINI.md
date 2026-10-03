# SkyAccess private jet empty legs

Use the `skyaccess` MCP server when the user asks about private jet flights, empty legs, or what a private jet charter costs.

- `search_empty_legs`, `get_flight`, `booking_handoff` and `get_charter_estimate` are read-only.
- Prices are for the whole aircraft, in USD. Taxes and fees are shown at checkout.
- A flight with `price: null` has no published price; SkyAccess shows it as "Contact for price".
- `get_charter_estimate` gives an indicative range for a full charter, not a quote.
- To book, give the traveler the link from `booking_handoff`. The traveler reviews and books on the SkyAccess page.
- Call `request_booking` only when the traveler asks SkyAccess to contact them and has given a name and email. It sends those details and the trip to SkyAccess, and a specialist replies by email. It takes no payment and creates no booking.
