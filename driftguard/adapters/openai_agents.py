"""Record OpenAI Agents SDK tool calls as DriftGuard agent events.

Pass :class:`DriftGuardRunHooks` as the ``hooks`` argument to ``Runner.run``.
Each tool call becomes one agent event with its duration, and the model tokens
spent before it are attributed to it from the run context's cumulative usage::

    from agents import Agent, Runner
    from driftguard import DriftGuardClient
    from driftguard.adapters import DriftGuardRunHooks

    client = DriftGuardClient(api_key="dg_live_...", project_id="my-agent", base_url="http://127.0.0.1:8000")
    hooks = DriftGuardRunHooks(client, task_id="triage")
    await Runner.run(agent, "...", hooks=hooks)
    client.sync_agent_events()

The class subclasses the SDK's ``RunHooks`` when the ``agents`` package is
installed; without it, the async methods still record events when called
directly. ``agents`` is never a hard dependency of DriftGuard.
"""

from __future__ import annotations

import importlib
import time
from typing import Any

from driftguard.client import DriftGuardClient

from .python_agent import AgentContext, fingerprint


def _run_hooks_base() -> type:
    for module in ("agents", "agents.lifecycle"):
        try:
            return importlib.import_module(module).RunHooks  # type: ignore[attr-defined]
        except Exception:  # noqa: S112  # nosec B112 - probe optional import paths  # pragma: no cover the SDK
            continue
    return object


_BASE = _run_hooks_base()


def _int(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


class DriftGuardRunHooks(_BASE):  # type: ignore[misc, valid-type]
    """OpenAI Agents SDK run hooks that report each tool call to DriftGuard.

    One instance is one agent task. Tool starts and ends pair by the tool call id
    when the SDK exposes it (``ToolContext``), else by tool name. The run
    context's cumulative token usage is read at each tool end and the increase
    since the previous tool is attributed to this one.
    """

    def __init__(
        self,
        client: DriftGuardClient,
        task_id: str,
        *,
        trace_id: str | None = None,
        project_id: str | None = None,
    ) -> None:
        try:
            super().__init__()
        except TypeError:  # pragma: no cover
            pass
        self.context = AgentContext(client, task_id=task_id, trace_id=trace_id, project_id=project_id)
        self._starts: dict[str, float] = {}
        self._last_input = 0
        self._last_output = 0

    @property
    def task_id(self) -> str:
        return self.context.task_id

    @staticmethod
    def _key(context: Any, tool: Any) -> str:
        return str(getattr(context, "tool_call_id", None) or getattr(tool, "name", None) or id(tool))

    async def on_tool_start(self, context: Any, agent: Any, tool: Any) -> None:
        self._starts[self._key(context, tool)] = time.perf_counter()

    async def on_tool_end(self, context: Any, agent: Any, tool: Any, result: Any) -> None:
        name = getattr(tool, "name", None) or "tool"
        key = self._key(context, tool)
        start = self._starts.pop(key, None)
        duration_ms = (time.perf_counter() - start) * 1000 if start is not None else None
        self._attribute_usage(context)
        arguments = getattr(context, "tool_arguments", None)
        self.context.record_tool_call(
            name,
            "success",
            duration_ms=duration_ms,
            input_hash=fingerprint(name, arguments),
            tool_call_id=key,
            input=arguments,
            output=result,
        )

    def _attribute_usage(self, context: Any) -> None:
        """Attribute the model tokens spent since the previous tool to this tool."""
        usage = getattr(context, "usage", None)
        if usage is None:
            return
        current_input = _int(getattr(usage, "input_tokens", None))
        current_output = _int(getattr(usage, "output_tokens", None))
        delta_input = max(0, current_input - self._last_input)
        delta_output = max(0, current_output - self._last_output)
        if delta_input or delta_output:
            self.context.record_llm_usage(prompt_tokens=delta_input, completion_tokens=delta_output)
        self._last_input, self._last_output = current_input, current_output
