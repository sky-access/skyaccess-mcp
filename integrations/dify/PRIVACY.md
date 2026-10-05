# Privacy Policy: SkyAccess Dify Plugin

Last updated: 2026-10-04

## Summary

The SkyAccess plugin does not collect, store or log any user data itself. It does not ask for names, email addresses, phone numbers or any credentials.

## What is sent

When a tool runs, the plugin sends that tool's inputs to the SkyAccess public MCP server at `https://mcp.skyaccess.com/mcp` over HTTPS and returns the response to Dify. The inputs are:

- Search Empty Legs: origin, destination, departure date range, passenger count and optional price ceiling
- Get Flight and Get Booking Link: a SkyAccess flight id
- Get Charter Estimate: origin, destination, passenger count and optional aircraft category

As with any web request, the server also receives standard connection information such as the requesting IP address.

## What the plugin does not do

- It keeps no local database, file cache or analytics.
- It does not request or send personal data fields.
- It does not share data with any third party other than SkyAccess, the service it connects to.

## How SkyAccess handles requests

SkyAccess processes requests to its MCP server under the SkyAccess privacy policy: https://skyaccess.com/privacy#connector. Terms of service: https://skyaccess.com/terms.

## Contact

contact@skyaccess.com
