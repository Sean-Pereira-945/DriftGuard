"""Record LangChain / LangGraph tool calls as DriftGuard agent events.

Pass :class:`DriftGuardCallbackHandler` in the ``callbacks`` list of any
LangChain or LangGraph call. Each tool run becomes one agent event with its
duration and outcome, and token usage from each model turn is attributed to the
next tool, exactly as the decorator and MCP adapters do::

    from driftguard import DriftGuardClient
    from driftguard.adapters import DriftGuardCallbackHandler

    client = DriftGuardClient(api_key="dg_live_...", project_id="my-agent", base_url="http://127.0.0.1:8000")
    handler = DriftGuardCallbackHandler(client, task_id="answer-question")
    agent_executor.invoke({"input": "..."}, config={"callbacks": [handler]})
    client.sync_agent_events()

The handler subclasses LangChain's ``BaseCallbackHandler`` when LangChain is
installed, so LangChain accepts it; without LangChain it still records events
when its methods are called directly. The ``langchain`` package is never a hard
dependency of DriftGuard.
"""

from __future__ import annotations

import importlib
import time
from typing import Any

from driftguard.client import DriftGuardClient

from .python_agent import AgentContext, fingerprint


def _callback_base() -> type:
    for module, name in (
        ("langchain_core.callbacks.base", "BaseCallbackHandler"),
        ("langchain.callbacks.base", "BaseCallbackHandler"),
    ):
        try:
            return getattr(importlib.import_module(module), name)
        except Exception:  # noqa: S112  # nosec B112 - probe optional import paths  # pragma: no cover langchain
            continue
    return object


_BASE = _callback_base()


def _get(obj: Any, name: str) -> Any:
    if isinstance(obj, dict):
        return obj.get(name)
    return getattr(obj, name, None)


def langchain_tokens(response: Any) -> dict[str, int]:
    """Pull prompt/completion tokens from a LangChain ``LLMResult`` (or a dict like one)."""
    out = _get(response, "llm_output")
    if isinstance(out, dict):
        usage = out.get("token_usage") or out.get("usage") or {}
        if usage:
            return {
                "prompt_tokens": int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0),
                "completion_tokens": int(usage.get("completion_tokens") or usage.get("output_tokens") or 0),
            }
    for row in _get(response, "generations") or []:
        for generation in row:
            meta = _get(_get(generation, "message"), "usage_metadata")
            if meta:
                return {
                    "prompt_tokens": int(_get(meta, "input_tokens") or 0),
                    "completion_tokens": int(_get(meta, "output_tokens") or 0),
                }
    return {}


class DriftGuardCallbackHandler(_BASE):  # type: ignore[misc, valid-type]
    """A LangChain callback handler that reports tool calls and token usage.

    One handler is one agent task. Tool starts and ends are paired by LangChain's
    ``run_id`` so each event carries the tool's real duration.
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
        except TypeError:  # pragma: no cover - BaseCallbackHandler takes no args
            pass
        self.context = AgentContext(client, task_id=task_id, trace_id=trace_id, project_id=project_id)
        self._pending: dict[str, dict[str, Any]] = {}

    @property
    def task_id(self) -> str:
        return self.context.task_id

    def on_tool_start(
        self, serialized: dict[str, Any] | None, input_str: str, *, run_id: Any = None, **kwargs: Any
    ) -> None:
        name = (serialized or {}).get("name") or kwargs.get("name") or "tool"
        self._pending[str(run_id)] = {
            "name": name,
            "input": kwargs.get("inputs", input_str),
            "start": time.perf_counter(),
        }

    def on_tool_end(self, output: Any, *, run_id: Any = None, **kwargs: Any) -> None:
        pending = self._pending.pop(str(run_id), None)
        name = pending["name"] if pending else "tool"
        tool_input = pending["input"] if pending else None
        self.context.record_tool_call(
            name,
            "success",
            duration_ms=self._elapsed(pending),
            input_hash=fingerprint(name, tool_input),
            tool_call_id=str(run_id) if run_id is not None else None,
            input=tool_input,
            output=output,
        )

    def on_tool_error(self, error: BaseException, *, run_id: Any = None, **kwargs: Any) -> None:
        pending = self._pending.pop(str(run_id), None)
        name = pending["name"] if pending else "tool"
        tool_input = pending["input"] if pending else None
        self.context.record_tool_call(
            name,
            "failed",
            error=error,
            duration_ms=self._elapsed(pending),
            input_hash=fingerprint(name, tool_input),
            tool_call_id=str(run_id) if run_id is not None else None,
            input=tool_input,
        )

    def on_llm_end(self, response: Any, *, run_id: Any = None, **kwargs: Any) -> None:
        tokens = langchain_tokens(response)
        if tokens:
            self.context.record_llm_usage(
                prompt_tokens=tokens["prompt_tokens"], completion_tokens=tokens["completion_tokens"]
            )

    @staticmethod
    def _elapsed(pending: dict[str, Any] | None) -> float | None:
        return (time.perf_counter() - pending["start"]) * 1000 if pending else None
