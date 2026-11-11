# Using the package

How to wire `driftguard-tokepi` into a project. For what it provides see
[What the package offers](package-overview.md); for the web UI see
[Using the dashboard](using-the-dashboard.md).

> You install `driftguard-tokepi` but import `driftguard` — the names differ
> because `driftguard` was taken on PyPI.

## Before you start: a server and a key

The SDK reports *to* a DriftGuard server, so you need one running and a project
API key. The quickest local option:

```bash
pip install "driftguard-tokepi[server]"
driftguard-server --port 8000
```

Open http://127.0.0.1:8000, create an account, create a **project**, and copy
its API key (`dg_live_…`). Full options — Docker, from source — are in
[Getting started](quickstart.md). In a team, one person hosts the server and
everyone else just needs its URL and a key.

## Install

```bash
pip install driftguard-tokepi              # the SDK: depends only on httpx
pip install "driftguard-tokepi[server]"    # also run the server yourself
```

| Extra | Adds | For |
| --- | --- | --- |
| *(none)* | `httpx` | Sending telemetry and agent events from your app |
| `server` | FastAPI, uvicorn, SQLAlchemy, … | Hosting the server + dashboard |
| `postgres` | `psycopg` | Running the server on PostgreSQL |
| `redis` | `redis` | Rate limits and realtime shared across workers |
| `all` | server + postgres + redis | A full self-hosted deployment |

## Make a client

Create one client when your app starts.

```python
from driftguard import DriftGuardClient

dg = DriftGuardClient(
    api_key="dg_live_...",            # the project's key, never an LLM provider key
    project_id="my-app",
    base_url="http://127.0.0.1:8000",
    environment="prod",               # prod | staging | dev | test
)
```

## Send LLM telemetry

After each model call, record what happened, then sync. Every metric is
optional, and `sync_metrics_async` doesn't block your request.

```python
answer = call_my_llm(prompt)          # your code

dg.capture_metrics(
    prompt_tokens=usage.input_tokens,
    context_length=len(assembled_context),
    latency_ms=elapsed_ms,
    retrieval_score=0.72,     # 0–1, how relevant the retrieved context was
    response_quality=0.88,    # 0–1, your evaluator's score of the answer
)
dg.sync_metrics_async()
```

Tokens and latency you already have; the two **scores are yours to produce** —
see [Measuring retrieval score and response quality](scoring-guide.md). Send
none of the scores and you still get token, latency and drift tracking.

## Trace an agent's tools

Wrap the run in `AgentContext` and decorate the tools. Each call becomes one
agent event with its attempt number, duration, outcome, and any LLM tokens
recorded since the previous tool — which is what the failed-tool diagnosis and
blocked-task alerts are built from.

```python
from driftguard.adapters import AgentContext, driftguard_tool

@driftguard_tool("run_tests")
def run_tests(path): ...

with AgentContext(dg, task_id="fix-login-bug", auto_sync=True) as run:
    resp = llm.create(...)
    run.record_llm_usage(resp)    # tokens attach to the next tool call
    run_tests("tests/")           # recorded automatically
```

Outside an `AgentContext` the decorated tool runs unchanged. You can also record
events by hand with `dg.capture_agent_event(...)` and non-tool activity with
`run.record_activity("prompt", ...)`.

## On a framework? Use an adapter

Skip the decorator and plug an adapter into the framework's own hooks. Each
records one agent event per tool call and attributes model tokens. None of the
frameworks is a dependency — install whichever you use. Full examples in
[Agent integration](agent-integration.md#framework-adapters-langchain-openai-agents-claude-agent-sdk).

| Framework | Adapter | Wire it in |
| --- | --- | --- |
| LangChain / LangGraph | `DriftGuardCallbackHandler` | `config={"callbacks": [handler]}` |
| OpenAI Agents SDK | `DriftGuardRunHooks` | `Runner.run(agent, ..., hooks=hooks)` |
| Claude Agent SDK | `DriftGuardClaudeAgentHooks` | `ClaudeAgentOptions(hooks=recorder.options_hooks())` |

```python
from driftguard.adapters import DriftGuardCallbackHandler

handler = DriftGuardCallbackHandler(dg, task_id="answer-question")
agent_executor.invoke({"input": "..."}, config={"callbacks": [handler]})
dg.sync_agent_events()
```

## Watch a closed agent: the MCP gateway

For an agent you can't edit that speaks MCP over stdio (Claude Desktop, an IDE),
put the `driftguard-mcp-proxy` command in front of its server. It forwards every
message and records each `tools/call`:

```bash
driftguard-mcp-proxy --config .driftguard/mcp.json -- npx -y @modelcontextprotocol/server-git
```

Details and the config file in
[Agent integration](agent-integration.md#the-mcp-gateway-no-code-any-mcp-client).

## Gate a request offline

`check_drift` scores the most recently captured metrics against the active
policy **without a server** — a cheap local gate before you spend tokens.

```python
dg.fetch_policy()                       # once: pull your thresholds
dg.capture_metrics(prompt_tokens=9000, retrieval_score=0.3)
if dg.check_drift()["severity"] == "critical":
    answer = fall_back()                # smaller model, trim context, etc.
```

The same scoring is available as pure functions: `evaluate_drift(metrics,
policy)` and `recommend_mitigation(metrics, policy)`, with `DEFAULT_POLICY`.

## Sending content previews

By default only metrics and outcomes are sent. Pass `capture_content=True` to
also send tool arguments, results and prompt text as previews (capped at 2,000
characters). The server stores them only for projects that turn content storage
on, and scrubs secrets and PII first.

## Public API at a glance

```python
from driftguard import (
    DriftGuardClient,          # capture + sync + offline check_drift
    evaluate_drift,            # pure scoring of one metric payload
    recommend_mitigation,      # pure mitigation advice
    DEFAULT_POLICY,            # the shipped thresholds
    analyze_agent_events,      # group tool calls into task diagnoses
)
from driftguard.adapters import (
    AgentContext, driftguard_tool,   # instrument your own tools
    MCPMiddleware,                    # record raw MCP JSON-RPC
    DriftGuardCallbackHandler,        # LangChain / LangGraph
    DriftGuardRunHooks,               # OpenAI Agents SDK
    DriftGuardClaudeAgentHooks,       # Claude Agent SDK
)
```

Commands installed on the PATH: `driftguard-mcp-proxy` (always) and
`driftguard-server` (with the `server` extra). Without the extra,
`driftguard-server` tells you to install it.

## Running the server

```bash
pip install "driftguard-tokepi[server]"
driftguard-server --port 8000
```

The dashboard is pre-built into the package, so there's no Node build — the
server serves it at the root. For Docker, PostgreSQL, TLS and scaling, see
[Deployment](deployment.md).

## Next

- [Using the dashboard](using-the-dashboard.md) — read and operate the UI.
- [Agent integration](agent-integration.md) — every integration in depth.
- [API reference](api.md) — the HTTP endpoints the SDK calls.
