"""DriftGuard MCP gateway: a stdio proxy that observes Model Context Protocol traffic.

The gateway sits between an MCP client (Claude Desktop, an IDE, any agent that
speaks MCP over stdio) and a downstream MCP server. It forwards every JSON-RPC
message unchanged and records each ``tools/call`` as a DriftGuard agent event, so
closed agents that support MCP can be observed without changing their code.

The entry point is the ``driftguard-mcp-proxy`` command (see
:mod:`driftguard.gateway.cli`). The pieces are reusable on their own:
:class:`~driftguard.gateway.proxy.MessageTap` taps a message stream and
:class:`~driftguard.gateway.proxy.MCPGateway` wires it to a subprocess.
"""

from __future__ import annotations

from .config import GatewayConfig
from .proxy import MCPGateway, MessageTap

__all__ = ["GatewayConfig", "MCPGateway", "MessageTap"]
