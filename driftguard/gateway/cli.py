"""The ``driftguard-mcp-proxy`` command.

Usage::

    driftguard-mcp-proxy --config .driftguard/mcp.json -- npx -y @modelcontextprotocol/server-filesystem /data

Everything after ``--`` is the downstream MCP server command. The proxy forwards
its stdio to the MCP client that launched the proxy, and records each
``tools/call`` to DriftGuard. Point your MCP client at this command instead of
the server, keeping the same arguments after ``--``.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys

from driftguard.adapters.mcp import MCPMiddleware
from driftguard.client import DriftGuardClient

from .config import ConfigError, GatewayConfig
from .proxy import MCPGateway


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="driftguard-mcp-proxy",
        description="Proxy an MCP stdio server and record its tool calls to DriftGuard.",
        epilog="Put the downstream server command after -- , e.g. -- npx -y @modelcontextprotocol/server-git",
    )
    parser.add_argument("--config", help="Path to a JSON config file (api_key, project_id, base_url, ...).")
    parser.add_argument("--api-key", help="Project ingestion key (or DRIFTGUARD_API_KEY).")
    parser.add_argument("--project-id", help="Project to report to (or DRIFTGUARD_PROJECT_ID).")
    parser.add_argument("--base-url", help="DriftGuard server URL (default http://127.0.0.1:8000).")
    parser.add_argument("--environment", help="Environment tag on every event (default prod).")
    parser.add_argument("--task-id", help="Task all of this session's tool calls belong to.")
    parser.add_argument("--agent-name", help="Agent name on each event (default: the project id).")
    parser.add_argument(
        "--capture-content",
        action="store_true",
        default=None,
        help="Send tool arguments and results as content previews (stored only if the project opts in).",
    )
    parser.add_argument("--flush-interval", type=float, help="Seconds between background syncs (default 2).")
    parser.add_argument("--no-session-events", action="store_true", help="Don't record session start/end.")
    parser.add_argument(
        "server_command",
        nargs=argparse.REMAINDER,
        help="The downstream MCP server command, after --.",
    )
    return parser


def _server_command(tokens: list[str]) -> list[str]:
    """Strip a leading ``--`` separator from the REMAINDER tokens."""
    if tokens and tokens[0] == "--":
        tokens = tokens[1:]
    return tokens


def main(argv: list[str] | None = None) -> int:
    # Logs go to stderr only: stdout is the MCP channel back to the client.
    logging.basicConfig(
        level=os.environ.get("DRIFTGUARD_LOG_LEVEL", "INFO"),
        stream=sys.stderr,
        format="driftguard-mcp-proxy: %(message)s",
    )
    parser = _build_parser()
    args = parser.parse_args(argv)
    command = _server_command(args.server_command)
    if not command:
        parser.error("No downstream server command given. Put it after -- .")

    try:
        config = GatewayConfig.resolve(
            config_path=args.config,
            api_key=args.api_key,
            project_id=args.project_id,
            base_url=args.base_url,
            environment=args.environment,
            task_id=args.task_id,
            agent_name=args.agent_name,
            capture_content=args.capture_content,
            flush_interval=args.flush_interval,
        )
    except (ConfigError, OSError) as exc:
        parser.error(str(exc))

    task_id = config.task_id or _default_task_id(command)
    client = DriftGuardClient(
        api_key=config.api_key,
        project_id=config.project_id,
        project_name=config.agent_name or config.project_id,
        base_url=config.base_url,
        environment=config.environment,
        capture_content=config.capture_content,
    )
    gateway = MCPGateway(
        command,
        client,
        MCPMiddleware(client, task_id=task_id),
        flush_interval=config.flush_interval,
        session_events=not args.no_session_events,
    )
    try:
        return gateway.run()
    except KeyboardInterrupt:  # pragma: no cover
        return 130


def _default_task_id(command: list[str]) -> str:
    """A readable task id from the server command, e.g. ``mcp:server-filesystem``."""
    for token in command:
        if token.startswith("-"):
            continue
        base = os.path.basename(token)
        if base in {"npx", "uvx", "node", "python", "python3", "uv", "deno", "bun"}:
            continue
        return f"mcp:{base}"
    return f"mcp:{os.path.basename(command[0])}"


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
