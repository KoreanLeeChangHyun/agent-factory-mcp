"""Agent Factory MCP server definition."""

from mcp.server import MCPServer


def create_mcp_server() -> MCPServer:
    """Create an isolated server because its session manager is single-use."""

    return MCPServer("agent-factory")
