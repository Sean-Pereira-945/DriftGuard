# The Python package

`driftguard-tokepi` is the DriftGuard Python package on PyPI. This page is the
map of what it gives you and how to use each part. For the concepts behind the
numbers see [How DriftGuard works](concepts.md); for the HTTP layer underneath
the SDK see the [API reference](api.md).

> **Install name vs. import name.** You install `driftguard-tokepi` but import
> `driftguard` — the distribution name and the Python package name differ
> because `driftguard` was already taken on PyPI.

## Install

```bash
pip install driftguard-tokepi              # the SDK: depends only on httpx
pip install "driftguard-tokepi[server]"    # also run the server yourself
```

| Extra | Adds | For |
| --- | --- | --- |
| *(none)* | `httpx` | Sending telemetry and agent events from your app |
| `server` | FastAPI, uvicorn, SQLAlchemy, … | Hosting the DriftGuard server + dashboard |
| `postgres` | `psycopg` | Running the server on PostgreSQL |
| `redis` | `redis` | Rate limits and realtime shared across workers |
| `all` | server + postgres + redis | A full self-hosted deployment |

The import name is always `driftguard`:

```python
import driftguard
print(driftguard.__version__)   # 0.5.0
```

## What's in the package

| You want to… | Use | Needs a server? |
| --- | --- | --- |
| Send LLM telemetry (tokens, scores, latency) | `DriftGuardClient.capture_metrics` → `sync_metrics` | Yes, to sync |
| Instrument an agent's tools | `@driftguard_tool` + `AgentContext`, or an adapter | Yes, to sync |
| Observe a framework agent | LangChain / OpenAI Agents / Claude Agent SDK adapters | Yes, to sync |
| Observe any MCP client, no code | `driftguard-mcp-proxy` command | Yes |
| Score drift in-process, offline | `check_drift`, or `evaluate_drift` | No |
| Run the server + dashboard | `driftguard-server` command | — |

Everything that talks to a server needs two things: a **running DriftGuard
server** (`base_url`) and a **project API key** (`dg_live_…`, created in the
dashboard). See [Getting started](quickstart.md) to stand one up.

## The SDK client

`DriftGuardClient` captures events into an in-memory queue and syncs them to the
server in batches. A failed sync keeps its events queued.

```python
from driftguard import DriftGuardClient

client = DriftGuardClient(
    api_key="dg_live_...",            # the project's key, never an LLM provider key
    project_id="my-app",
    base_url="http://127.0.0.1:8000",
    environment="prod",               # prod | staging | dev | test
)
```

### LLM telemetry

Capture one event per model request, then sync. Every metric is optional.

```python
client.capture_metrics(
    prompt_tokens=1800,
    context_length=5200,
    retrieval_score=0.72,     # 0–1, how relevant the retrieved context was
    response_quality=0.88,    # 0–1, your evaluator's score of the answer
    latency_ms=940,           # how long the request took
)
client.sync_metrics()         # or sync_metrics_async() to not block
```

The server scores each event against the project policy (severity, risk score,
root cause, recommendation) and a critical event raises a drift alert. See
[Measuring retrieval score and response quality](scoring-guide.md) for how to
produce the two scores.

### Scoring drift offline

`check_drift` scores the most recently captured metrics against the active
policy **without a server** — useful for a local gate before you spend tokens.

```python
client.fetch_policy()                 # optional: pull the project's thresholds
client.capture_metrics(prompt_tokens=9000, retrieval_score=0.3)
result = client.check_drift()         # {"severity", "risk_score", "violations", ...}
if result["severity"] == "critical":
    ...                               # fall back, trim context, alert, etc.
```

The same scoring is available as pure functions: `evaluate_drift(metrics,
policy)` and `recommend_mitigation(metrics, policy)`, with the shipped
thresholds in `DEFAULT_POLICY`.

### Agent tool calls

Wrap an agent run in `AgentContext` and decorate its tools. Each call becomes
one agent event with its attempt number, duration, outcome, and any LLM tokens
recorded since the previous tool — which is what the failed-tool diagnosis and
the blocked-task alerts are built from.

```python
from driftguard.adapters import AgentContext, driftguard_tool

@driftguard_tool("run_tests")
def run_tests(path): ...

with AgentContext(client, task_id="fix-login-bug", auto_sync=True) as run:
    response = llm.messages.create(...)
    run.record_llm_usage(response)    # tokens attach to the next tool call
    run_tests("tests/")               # recorded automatically
```

Outside an `AgentContext` the decorated tool runs unchanged. You can also record
events by hand with `client.capture_agent_event(...)` and non-tool activity with
`AgentContext.record_activity("prompt", ...)`.

### Content previews

By default only metrics and outcomes are sent. Pass `capture_content=True` to
also send tool arguments, results and prompt text as previews (capped at 2,000
characters). The server stores them only for projects that turn on content
storage, and scrubs secrets and PII first.

## Framework adapters

If your agent runs on a framework, skip the decorator and plug an adapter into
the framework's own hooks. Each records one agent event per tool call and
attributes model tokens, reusing the same pipeline. None of the frameworks is a
dependency — install whichever you use. Full examples are in
[Agent integration](agent-integration.md#framework-adapters-langchain-openai-agents-claude-agent-sdk).

| Framework | Adapter | Wire it in |
| --- | --- | --- |
| LangChain / LangGraph | `DriftGuardCallbackHandler` | `config={"callbacks": [handler]}` |
| OpenAI Agents SDK | `DriftGuardRunHooks` | `Runner.run(agent, ..., hooks=hooks)` |
| Claude Agent SDK | `DriftGuardClaudeAgentHooks` | `ClaudeAgentOptions(hooks=recorder.options_hooks())` |

```python
from driftguard.adapters import DriftGuardCallbackHandler

handler = DriftGuardCallbackHandler(client, task_id="answer-question")
agent_executor.invoke({"input": "..."}, config={"callbacks": [handler]})
client.sync_agent_events()
```

## The MCP gateway (a command, no code)

For a closed agent that speaks MCP over stdio (Claude Desktop, an IDE), put the
`driftguard-mcp-proxy` command in front of its server. It forwards every
JSON-RPC message unchanged and records each `tools/call`, so the agent needs no
code change. Point your MCP client at the proxy and move the server command
after `--`:

```bash
driftguard-mcp-proxy --config .driftguard/mcp.json -- npx -y @modelcontextprotocol/server-git
```

Details and the config file in
[Agent integration](agent-integration.md#the-mcp-gateway-no-code-any-mcp-client).

## The server

Installing the `server` extra adds the `driftguard-server` command, which runs
the API and the dashboard with uvicorn:

```bash
pip install "driftguard-tokepi[server]"
driftguard-server --port 8000
```

Without the extra, `driftguard-server` tells you to install it. For Docker,
PostgreSQL, TLS and scaling, see [Deployment](deployment.md).

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
`driftguard-server` (with the `server` extra).

## Where to go next

- [Getting started](quickstart.md) — stand up a server and get a project key.
- [Agent integration](agent-integration.md) — every integration in depth.
- [API reference](api.md) — the HTTP endpoints the SDK calls.
- [Measuring scores](scoring-guide.md) — producing retrieval and quality scores.
