from typing import Any

from dify_plugin import ToolProvider


class SkyAccessProvider(ToolProvider):
    def _validate_credentials(self, credentials: dict[str, Any]) -> None:
        # The SkyAccess MCP server is public: no account, API key or credential is needed.
        return None
