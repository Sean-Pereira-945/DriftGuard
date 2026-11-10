"""Tests for the MCP gateway: the message tap, config resolution, and the proxy."""

from __future__ import annotations

import io
import json
import os
import sys

import pytest

from driftguard.adapters.mcp import MCPMiddleware
from driftguard.client import DriftGuardClient
from driftguard.gateway import GatewayConfig, MCPGateway, MessageTap
from driftguard.gateway.config import ConfigError
from driftguard.gateway.proxy import _parse, resolve_command


def make_client() -> DriftGuardClient:
    return DriftGuardClient(api_key="k", project_id="p", environment="test")


def line(obj: dict) -> bytes:
    return (json.dumps(obj) + "\n").encode()


# --------------------------------------------------------------------------- tap


def test_tap_records_a_successful_tool_call_with_duration():
    client = make_client()
    tap = MessageTap(MCPMiddleware(client, task_id="t"))
    tap.on_client_message(line({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "search"}}))
    assert tap.pending_count == 1
    tap.on_server_message(line({"jsonrpc": "2.0", "id": 1, "result": {"content": [{"type": "text", "text": "hit"}]}}))
    assert tap.pending_count == 0
    (event,) = client.agent_events
    assert event["tool_name"] == "search"
    assert event["status"] == "success"
    assert event["duration_ms"] >= 0


def test_tap_records_a_tool_error():
    client = make_client()
    tap = MessageTap(MCPMiddleware(client, task_id="t"))
    tap.on_client_message(line({"id": 2, "method": "tools/call", "params": {"name": "write"}}))
    tap.on_server_message(line({"id": 2, "error": {"code": -32000, "message": "denied"}}))
    (event,) = client.agent_events
    assert event["status"] == "failed"
    assert event["error_message"] == "denied"


def test_tap_ignores_non_tool_calls_and_unpaired_responses():
    client = make_client()
    tap = MessageTap(MCPMiddleware(client, task_id="t"))
    tap.on_client_message(line({"id": 1, "method": "tools/list"}))  # not a tools/call
    tap.on_server_message(line({"id": 99, "result": {}}))  # answer to nothing
    tap.on_client_message(line({"method": "notifications/initialized"}))  # notification, no id
    assert client.agent_events == []
    assert tap.pending_count == 0


def test_tap_survives_garbage_lines():
    client = make_client()
    tap = MessageTap(MCPMiddleware(client, task_id="t"))
    tap.on_client_message(b"not json at all\n")
    tap.on_server_message(b"\xff\xfe binary\n")
    assert client.agent_events == []
    assert _parse(b"{bad") is None


def test_tap_handles_concurrent_and_string_ids():
    client = make_client()
    tap = MessageTap(MCPMiddleware(client, task_id="t"))
    tap.on_client_message(line({"id": "a", "method": "tools/call", "params": {"name": "one"}}))
    tap.on_client_message(line({"id": "b", "method": "tools/call", "params": {"name": "two"}}))
    assert tap.pending_count == 2
    tap.on_server_message(line({"id": "b", "result": {}}))
    tap.on_server_message(line({"id": "a", "result": {}}))
    assert [e["tool_name"] for e in client.agent_events] == ["two", "one"]


# ------------------------------------------------------------------------ config


def test_config_resolution_order(tmp_path):
    cfg_file = tmp_path / "mcp.json"
    cfg_file.write_text(json.dumps({"api_key": "file-key", "project_id": "file-proj", "capture_content": True}))
    # The flag wins over the env, which wins over the file.
    config = GatewayConfig.resolve(
        config_path=cfg_file,
        api_key="flag-key",
        env={"DRIFTGUARD_PROJECT_ID": "env-proj", "DRIFTGUARD_BASE_URL": "http://srv:9/"},
    )
    assert config.api_key == "flag-key"  # flag
    assert config.project_id == "env-proj"  # env over file
    assert config.base_url == "http://srv:9"  # env, trailing slash trimmed
    assert config.capture_content is True  # file


def test_config_requires_key_and_project():
    with pytest.raises(ConfigError, match="API key"):
        GatewayConfig.resolve(project_id="p", env={})
    with pytest.raises(ConfigError, match="project id"):
        GatewayConfig.resolve(api_key="k", env={})


def test_config_rejects_bad_file(tmp_path):
    bad = tmp_path / "bad.json"
    bad.write_text("[]")
    with pytest.raises(ConfigError, match="JSON object"):
        GatewayConfig.resolve(config_path=bad, env={})


# ------------------------------------------------------------------------- proxy


# A tiny cross-platform MCP server that answers every tools/call with a result.
FAKE_SERVER = r"""
import sys, json
for raw in sys.stdin.buffer:
    try:
        msg = json.loads(raw)
    except Exception:
        continue
    if isinstance(msg, dict) and msg.get("method") == "tools/call":
        resp = {"jsonrpc": "2.0", "id": msg.get("id"), "result": {"content": [{"type": "text", "text": "ok"}]}}
        sys.stdout.buffer.write((json.dumps(resp) + "\n").encode())
        sys.stdout.buffer.flush()
"""


def test_proxy_forwards_and_records_against_a_real_subprocess():
    """End to end: a request goes in, the fake server answers, the proxy taps it."""
    client = make_client()
    out = io.BytesIO()
    gateway = MCPGateway(
        [sys.executable, "-c", FAKE_SERVER],
        client,
        MCPMiddleware(client, task_id="session"),
        stdin=io.BytesIO(line({"id": 1, "method": "tools/call", "params": {"name": "ls"}})),
        stdout=out,
        flush_interval=100,
        session_events=True,
    )
    code = gateway.run()
    assert code == 0
    # The server's response was forwarded verbatim to the client stream.
    forwarded = json.loads(out.getvalue().splitlines()[0])
    assert forwarded["id"] == 1 and forwarded["result"]["content"][0]["text"] == "ok"
    kinds = [e.get("kind") for e in client.agent_events]
    assert "session_start" in kinds and "session_end" in kinds
    tool_events = [e for e in client.agent_events if e.get("tool_name") == "ls"]
    assert len(tool_events) == 1 and tool_events[0]["status"] == "success"
    assert tool_events[0]["duration_ms"] >= 0


def test_resolve_command_finds_the_executable_on_path():
    resolved = resolve_command([sys.executable, "-c", "pass"])
    assert os.path.isabs(resolved[0]) and resolved[1:] == ["-c", "pass"]


def test_resolve_command_passes_unknown_commands_through():
    assert resolve_command(["definitely-not-a-real-command-xyz", "arg"]) == [
        "definitely-not-a-real-command-xyz",
        "arg",
    ]


def test_gateway_rejects_empty_command():
    client = make_client()
    with pytest.raises(ValueError, match="command is required"):
        MCPGateway([], client, MCPMiddleware(client, task_id="t"))


def test_cli_default_task_id():
    from driftguard.gateway.cli import _default_task_id, _server_command

    assert _default_task_id(["npx", "-y", "@scope/server-filesystem", "/data"]) == "mcp:server-filesystem"
    assert _default_task_id(["python", "-m", "my_server"]) == "mcp:my_server"
    assert _default_task_id(["./bin/weather-server"]) == "mcp:weather-server"
    assert _server_command(["--", "cat", "x"]) == ["cat", "x"]
    assert _server_command(["cat", "x"]) == ["cat", "x"]
