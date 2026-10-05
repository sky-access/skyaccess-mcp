from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from utils.skyaccess_mcp import run_tool, to_int

AIRCRAFT_CATEGORIES = {
    "TURBOPROP",
    "VERY_LIGHT_JET",
    "LIGHT_JET",
    "MID_SIZE_JET",
    "SUPER_MID_SIZE_JET",
    "HEAVY_JET",
    "ULTRA_LONG_RANGE",
}


class GetCharterEstimateTool(Tool):
    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        origin = str(tool_parameters.get("origin") or "").strip()
        destination = str(tool_parameters.get("destination") or "").strip()
        if not origin or not destination:
            yield self.create_text_message("origin and destination are required.")
            return
        try:
            passengers = to_int(tool_parameters.get("passengers"))
        except (TypeError, ValueError):
            yield self.create_text_message("passengers must be a number.")
            return
        if passengers is not None and passengers < 1:
            yield self.create_text_message("passengers must be at least 1.")
            return
        category = str(tool_parameters.get("aircraft_category") or "").strip().upper() or None
        if category is not None and category not in AIRCRAFT_CATEGORIES:
            yield self.create_text_message(
                "aircraft_category must be one of: " + ", ".join(sorted(AIRCRAFT_CATEGORIES)) + "."
            )
            return
        arguments = {
            "origin": origin,
            "destination": destination,
            "passengers": passengers,
            "aircraftCategory": category,
        }
        yield from run_tool(self, "get_charter_estimate", arguments)
