"""Tests for the LangChain, OpenAI Agents SDK and Claude Agent SDK adapters.

The frameworks themselves aren't installed, so these drive each adapter's
callbacks with faithful fakes of what each framework passes, and check the
DriftGuard agent events that come out.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

from driftguard.adapters import (
    DriftGuardCallbackHandler,
    DriftGuardClaudeAgentHooks,
    DriftGuardRunHooks,
)
from driftguard.adapters.langchain import langchain_tokens
from driftguard.client import DriftGuardClient


def make_client(capture_content: bool = False) -> DriftGuardClient:
    return DriftGuardClient(api_key="k", project_id="p", environment="test", capture_content=capture_content)


# --------------------------------------------------------------------- LangChain


def test_langchain_records_a_tool_success_with_duration():
    client = make_client()
    handler = DriftGuardCallbackHandler(client, task_id="qa")
    handler.on_tool_start({"name": "search"}, "query text", run_id="r1")
    handler.on_tool_end("3 results", run_id="r1")
    (event,) = client.agent_events
    assert event["tool_name"] == "search"
    assert event["status"] == "success"
    assert event["attempt"] == 1
    assert event["duration_ms"] >= 0
    assert event["tool_call_id"] == "r1"


def test_langchain_records_a_tool_error():
    client = make_client()
    handler = DriftGuardCallbackHandler(client, task_id="qa")
    handler.on_tool_start({"name": "fetch"}, "", run_id="r2")
    handler.on_tool_error(ValueError("boom"), run_id="r2")
    (event,) = client.agent_events
    assert event["status"] == "failed"
    assert event["error_type"] == "ValueError"
    assert event["error_message"] == "boom"


def test_langchain_attributes_llm_tokens_to_the_next_tool():
    client = make_client()
    handler = DriftGuardCallbackHandler(client, task_id="qa")
    # An LLMResult-shaped object: tokens live in llm_output.token_usage.
    response = SimpleNamespace(
        llm_output={"token_usage": {"prompt_tokens": 120, "completion_tokens": 30}}, generations=[]
    )
    handler.on_llm_end(response, run_id="llm1")
    handler.on_tool_start({"name": "run"}, "", run_id="r3")
    handler.on_tool_end("ok", run_id="r3")
    (event,) = client.agent_events
    assert event["prompt_tokens"] == 120
    assert event["completion_tokens"] == 30
    assert event["total_tokens"] == 150


def test_langchain_tokens_reads_usage_metadata_on_messages():
    response = SimpleNamespace(
        llm_output=None,
        generations=[
            [SimpleNamespace(message=SimpleNamespace(usage_metadata={"input_tokens": 5, "output_tokens": 7}))]
        ],
    )
    assert langchain_tokens(response) == {"prompt_tokens": 5, "completion_tokens": 7}
    assert langchain_tokens(SimpleNamespace(llm_output=None, generations=[])) == {}


def test_langchain_content_only_with_capture_on():
    off = make_client()
    DriftGuardCallbackHandler(off, task_id="t").on_tool_end("secret", run_id="x")
    assert "output" not in off.agent_events[0]
    on = make_client(capture_content=True)
    handler = DriftGuardCallbackHandler(on, task_id="t")
    handler.on_tool_start({"name": "search"}, "the query", run_id="y")
    handler.on_tool_end("the answer", run_id="y")
    assert on.agent_events[0]["output"] == "the answer"
    assert on.agent_events[0]["input"] == "the query"


# ------------------------------------------------------------- OpenAI Agents SDK


def test_openai_agents_records_tool_calls_and_attributes_usage():
    client = make_client()
    hooks = DriftGuardRunHooks(client, task_id="triage")
    tool = SimpleNamespace(name="lookup")
    # The run context carries cumulative usage and (optionally) the tool call id.
    context = SimpleNamespace(usage=SimpleNamespace(input_tokens=0, output_tokens=0), tool_call_id="call_1")

    async def run() -> None:
        await hooks.on_tool_start(context, None, tool)
        context.usage.input_tokens = 200
        context.usage.output_tokens = 40
        await hooks.on_tool_end(context, None, tool, "result")

    asyncio.run(run())
    (event,) = client.agent_events
    assert event["tool_name"] == "lookup"
    assert event["status"] == "success"
    assert event["tool_call_id"] == "call_1"
    assert event["prompt_tokens"] == 200 and event["completion_tokens"] == 40
    assert event["duration_ms"] >= 0


def test_openai_agents_attributes_only_the_delta_since_the_last_tool():
    client = make_client()
    hooks = DriftGuardRunHooks(client, task_id="triage")
    tool = SimpleNamespace(name="step")
    usage = SimpleNamespace(input_tokens=0, output_tokens=0)

    async def run() -> None:
        ctx = SimpleNamespace(usage=usage, tool_call_id="a")
        await hooks.on_tool_start(ctx, None, tool)
        usage.input_tokens, usage.output_tokens = 100, 10
        await hooks.on_tool_end(ctx, None, tool, "r1")
        ctx2 = SimpleNamespace(usage=usage, tool_call_id="b")
        await hooks.on_tool_start(ctx2, None, tool)
        usage.input_tokens, usage.output_tokens = 160, 25  # +60 / +15 since the last tool
        await hooks.on_tool_end(ctx2, None, tool, "r2")

    asyncio.run(run())
    first, second = client.agent_events
    assert (first["prompt_tokens"], first["completion_tokens"]) == (100, 10)
    assert (second["prompt_tokens"], second["completion_tokens"]) == (60, 15)
    assert second["attempt"] == 2  # same tool name, second attempt


# ------------------------------------------------------------- Claude Agent SDK


def test_claude_agent_records_success_and_failure():
    client = make_client()
    hooks = DriftGuardClaudeAgentHooks(client, task_id="build")

    async def run() -> None:
        await hooks.pre_tool_use({"tool_name": "Bash", "tool_input": {"command": "ls"}}, "u1")
        await hooks.post_tool_use(
            {"tool_name": "Bash", "tool_input": {"command": "ls"}, "tool_response": {"stdout": "a\nb"}}, "u1"
        )
        await hooks.pre_tool_use({"tool_name": "Bash", "tool_input": {"command": "nope"}}, "u2")
        await hooks.post_tool_use(
            {
                "tool_name": "Bash",
                "tool_input": {"command": "nope"},
                "tool_response": {"is_error": True, "error": "not found"},
            },
            "u2",
        )

    asyncio.run(run())
    ok, failed = client.agent_events
    assert ok["tool_name"] == "Bash" and ok["status"] == "success" and ok["tool_call_id"] == "u1"
    assert failed["status"] == "failed" and failed["attempt"] == 2
    assert failed["error_message"] == "not found"
    assert ok["duration_ms"] >= 0


def test_claude_agent_defaults_tool_name_and_handles_missing_start():
    client = make_client()
    hooks = DriftGuardClaudeAgentHooks(client, task_id="t")

    async def run() -> None:
        # PostToolUse without a matching PreToolUse: still recorded, no duration.
        await hooks.post_tool_use({"tool_response": "done"}, None)

    asyncio.run(run())
    (event,) = client.agent_events
    assert event["tool_name"] == "tool"
    assert event["status"] == "success"
    assert "duration_ms" not in event


def test_adapters_are_importable_without_their_frameworks():
    # None of langchain/agents/claude_agent_sdk are installed in CI; construction must still work.
    client = make_client()
    assert DriftGuardCallbackHandler(client, task_id="t").task_id == "t"
    assert DriftGuardRunHooks(client, task_id="t").task_id == "t"
    assert DriftGuardClaudeAgentHooks(client, task_id="t").task_id == "t"
