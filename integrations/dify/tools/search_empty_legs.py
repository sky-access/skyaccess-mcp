from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from utils.skyaccess_mcp import run_tool, to_float, to_int


class SearchEmptyLegsTool(Tool):
    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        try:
            passengers = to_int(tool_parameters.get("passengers"))
            max_price = to_float(tool_parameters.get("max_price"))
        except (TypeError, ValueError):
            yield self.create_text_message("passengers and max_price must be numbers.")
            return
        if passengers is not None and passengers < 1:
            yield self.create_text_message("passengers must be at least 1.")
            return
        if max_price is not None and max_price <= 0:
            yield self.create_text_message("max_price must be greater than 0.")
            return
        arguments = {
            "origin": tool_parameters.get("origin"),
            "destination": tool_parameters.get("destination"),
            "departureDateFrom": tool_parameters.get("departure_date_from"),
            "departureDateTo": tool_parameters.get("departure_date_to"),
            "passengers": passengers,
            "max_price": max_price,
        }
        yield from run_tool(self, "search_empty_legs", arguments)
