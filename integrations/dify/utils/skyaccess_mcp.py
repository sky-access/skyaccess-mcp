"""Minimal client for the SkyAccess public MCP server.

The plugin talks to exactly one fixed HTTPS endpoint, https://mcp.skyaccess.com/mcp,
using the MCP streamable HTTP transport (JSON-RPC 2.0 over POST). The server is
public: no account, API key or other credential is sent. Only the read-only tools
listed in READ_ONLY_TOOLS can be called through this client.
"""

from __future__ import annotations

import itertools
import json
from typing import Any, Generator

# dify_plugin is imported before requests so its gevent patching runs before ssl loads.
from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage
import requests

MCP_ENDPOINT = "https://mcp.skyaccess.com/mcp"
PROTOCOL_VERSION = "2025-06-18"
TIMEOUT_SECONDS = 30
CLIENT_INFO = {"name": "skyaccess-dify-plugin", "version": "0.0.1"}
USER_AGENT = "skyaccess-dify-plugin/0.0.1 (+https://github.com/sky-access/skyaccess-mcp)"

READ_ONLY_TOOLS = frozenset(
    {
        "search_empty_legs",
        "get_flight",
        "booking_handoff",
        "get_charter_estimate",
    }
)


class SkyAccessMCPError(Exception):
    """Raised when the MCP server answers with an error or an unreadable body."""


def _iter_json_payloads(response: requests.Response) -> Generator[Any, None, None]:
    content_type = response.headers.get("Content-Type", "")
    body = response.text
    if "text/event-stream" in content_type:
        data_lines: list[str] = []
        for line in body.splitlines():
            if line.startswith("data:"):
                data_lines.append(line[5:].lstrip())
            elif not line.strip() and data_lines:
                yield from _loads("\n".join(data_lines))
                data_lines = []
        if data_lines:
            yield from _loads("\n".join(data_lines))
    else:
        yield from _loads(body)


def _loads(raw: str) -> Generator[Any, None, None]:
    try:
        payload = json.loads(raw)
    except ValueError:
        return
    if isinstance(payload, list):
        yield from payload
    else:
        yield payload


def _result_for(response: requests.Response, request_id: int) -> dict[str, Any]:
    for item in _iter_json_payloads(response):
        if not isinstance(item, dict) or item.get("id") != request_id:
            continue
        if "error" in item:
            error = item.get("error") or {}
            message = error.get("message") if isinstance(error, dict) else str(error)
            raise SkyAccessMCPError(f"SkyAccess returned an error: {message}")
        result = item.get("result")
        return result if isinstance(result, dict) else {}
    raise SkyAccessMCPError("SkyAccess returned no readable response.")


class SkyAccessMCPClient:
    """One short-lived MCP session per tool invocation."""

    def __init__(self, http: requests.Session | None = None) -> None:
        self._http = http or requests.Session()
        self._ids = itertools.count(1)
        self._session_id: str | None = None
        self._protocol_version: str | None = None

    def _headers(self) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "User-Agent": USER_AGENT,
        }
        if self._protocol_version:
            headers["MCP-Protocol-Version"] = self._protocol_version
        if self._session_id:
            headers["Mcp-Session-Id"] = self._session_id
        return headers

    def _post(self, payload: dict[str, Any]) -> requests.Response:
        response = self._http.post(
            MCP_ENDPOINT,
            json=payload,
            headers=self._headers(),
            timeout=TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response

    def _request(self, method: str, params: dict[str, Any]) -> tuple[requests.Response, dict[str, Any]]:
        request_id = next(self._ids)
        response = self._post({"jsonrpc": "2.0", "id": request_id, "method": method, "params": params})
        return response, _result_for(response, request_id)

    def initialize(self) -> dict[str, Any]:
        response, result = self._request(
            "initialize",
            {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": CLIENT_INFO,
            },
        )
        self._session_id = response.headers.get("Mcp-Session-Id") or None
        self._protocol_version = str(result.get("protocolVersion") or PROTOCOL_VERSION)
        self._post({"jsonrpc": "2.0", "method": "notifications/initialized"})
        return result

    def list_tools(self) -> list[dict[str, Any]]:
        if self._protocol_version is None:
            self.initialize()
        _, result = self._request("tools/list", {})
        tools = result.get("tools")
        return tools if isinstance(tools, list) else []

    def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if name not in READ_ONLY_TOOLS:
            raise SkyAccessMCPError(f"Tool not available in this plugin: {name}")
        if self._protocol_version is None:
            self.initialize()
        _, result = self._request("tools/call", {"name": name, "arguments": arguments})
        return result


def compact(arguments: dict[str, Any]) -> dict[str, Any]:
    """Drop empty optional inputs so the server applies its own defaults."""
    return {key: value for key, value in arguments.items() if value is not None and value != ""}


def to_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    return int(float(value))


def to_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    return float(value)


def run_tool(tool: Tool, name: str, arguments: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
    """Call one SkyAccess MCP tool and relay its content as Dify messages."""
    try:
        result = SkyAccessMCPClient().call_tool(name, compact(arguments))
    except requests.exceptions.Timeout:
        yield tool.create_text_message(
            f"SkyAccess did not respond within {TIMEOUT_SECONDS} seconds. Please try again."
        )
        return
    except requests.exceptions.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else "unknown"
        yield tool.create_text_message(f"SkyAccess request failed with HTTP status {status}.")
        return
    except requests.exceptions.RequestException as exc:
        yield tool.create_text_message(f"Could not reach SkyAccess ({exc.__class__.__name__}).")
        return
    except SkyAccessMCPError as exc:
        yield tool.create_text_message(str(exc))
        return

    texts = [
        str(item.get("text", ""))
        for item in result.get("content") or []
        if isinstance(item, dict) and item.get("type") == "text"
    ]
    for text in texts:
        if text:
            yield tool.create_text_message(text)

    structured = result.get("structuredContent")
    if isinstance(structured, dict):
        yield tool.create_json_message(structured)
        return

    for text in texts:
        try:
            parsed = json.loads(text)
        except ValueError:
            continue
        if isinstance(parsed, dict):
            yield tool.create_json_message(parsed)
        elif isinstance(parsed, list):
            yield tool.create_json_message({"results": parsed})
