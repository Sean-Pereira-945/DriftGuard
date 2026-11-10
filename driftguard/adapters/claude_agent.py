"""Record Claude Agent SDK tool calls as DriftGuard agent events, through its hooks.

Build the hooks and pass them in ``ClaudeAgentOptions``::

    from claude_agent_sdk import ClaudeAgentOptions, query
    from driftguard import DriftGuardClient
    from driftguard.adapters import DriftGuardClaudeAgentHooks

    client = DriftGuardClient(api_key="dg_live_...", project_id="my-agent", base_url="http://127.0.0.1:8000")
    recorder = DriftGuardClaudeAgentHooks(client, task_id="build-feature")
    options = ClaudeAgentOptions(hooks=recorder.options_hooks())
    async for message in query(prompt="...", options=options):
        ...
    client.sync_agent_events()

``PreToolUse`` times each tool, and ``PostToolUse`` records it as success or
failure from the tool response. The ``claude_agent_sdk`` package is only needed
by :meth:`options_hooks`; the recorder's callbacks work on their own, so the
mapping is usable and testable without it.
"""

from __future__ import annotations

import time
from typing import Any

from driftguard.client import DriftGuardClient

from .python_agent import AgentContext, fingerprint


def _is_error(response: Any) -> bool:
    """Whether a Claude Agent SDK tool response signals a failure."""
    if isinstance(response, dict):
        if response.get("is_error") or response.get("isError"):
            return True
        if response.get("error") not in (None, "", False):
            return True
    return False


def _error_text(response: Any) -> str:
    if isinstance(response, dict):
        for key in ("error", "message", "content", "stderr"):
            value = response.get(key)
            if value:
                return str(value)
    return "tool returned an error"


class DriftGuardClaudeAgentHooks:
    """Claude Agent SDK hook callbacks that record each tool call for one task."""

    def __init__(
        self,
        client: DriftGuardClient,
        task_id: str,
        *,
        trace_id: str | None = None,
        project_id: str | None = None,
    ) -> None:
        self.context = AgentContext(client, task_id=task_id, trace_id=trace_id, project_id=project_id)
        self._starts: dict[str, float] = {}

    @property
    def task_id(self) -> str:
        return self.context.task_id

    async def pre_tool_use(
        self, input_data: dict[str, Any], tool_use_id: str | None, context: Any = None
    ) -> dict[str, Any]:
        """Note when a tool starts so PostToolUse can record its duration."""
        self._starts[tool_use_id or ""] = time.perf_counter()
        return {}

    async def post_tool_use(
        self, input_data: dict[str, Any], tool_use_id: str | None, context: Any = None
    ) -> dict[str, Any]:
        """Record a finished tool call as a DriftGuard agent event."""
        name = input_data.get("tool_name") or "tool"
        tool_input = input_data.get("tool_input")
        response = input_data.get("tool_response")
        start = self._starts.pop(tool_use_id or "", None)
        duration_ms = (time.perf_counter() - start) * 1000 if start is not None else None
        common = {
            "duration_ms": duration_ms,
            "input_hash": fingerprint(name, tool_input),
            "tool_call_id": tool_use_id,
            "input": tool_input,
        }
        if _is_error(response):
            self.context.record_tool_call(
                name, "failed", error_type="tool_error", error_message=_error_text(response), **common
            )
        else:
            self.context.record_tool_call(name, "success", output=response, **common)
        return {}

    def options_hooks(self, matcher: str | None = None) -> dict[str, list[Any]]:
        """Build the ``hooks`` mapping for ``ClaudeAgentOptions`` (needs ``claude_agent_sdk``)."""
        from claude_agent_sdk import HookMatcher  # noqa: PLC0415 - optional dependency, imported on use

        return {
            "PreToolUse": [HookMatcher(matcher=matcher, hooks=[self.pre_tool_use])],
            "PostToolUse": [HookMatcher(matcher=matcher, hooks=[self.post_tool_use])],
        }
