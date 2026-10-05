from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from utils.skyaccess_mcp import run_tool


class BookingHandoffTool(Tool):
    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        flight_id = str(tool_parameters.get("flight_id") or "").strip()
        if not flight_id:
            yield self.create_text_message("flight_id is required.")
            return
        yield from run_tool(self, "booking_handoff", {"flightId": flight_id})
