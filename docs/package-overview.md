# What the package offers

`driftguard-tokepi` is the DriftGuard Python package on PyPI. This page is about
**what it gives you**. For wiring it into a project see
[Using the package](package-usage.md); for the web UI see
[Using the dashboard](using-the-dashboard.md).

> **Install name vs. import name.** You install `driftguard-tokepi` but import
> `driftguard` — the distribution name and the Python package name differ
> because `driftguard` was already taken on PyPI.

## In one sentence

DriftGuard watches two things about an LLM app or agent — **how healthy its model
calls are** and **where its tools get stuck** — names the cause, counts the
wasted tokens, and shows it on a dashboard.

## The two signals it captures

| Signal | What it is | Produced by |
| --- | --- | --- |
| **LLM telemetry** | One record per model call: tokens, context length, latency, and optional retrieval and quality scores | `capture_metrics` |
| **Agent tool calls** | One record per tool call: which tool, the attempt number, duration, success or failure | `@driftguard_tool`, an adapter, or the MCP gateway |

You send whichever fits what you're building — or both.

## What's in the package

| Part | Import / command | What it's for |
| --- | --- | --- |
| **SDK client** | `from driftguard import DriftGuardClient` | Capture telemetry and agent events and sync them to the server |
| **Local scoring** | `evaluate_drift`, `recommend_mitigation`, `DEFAULT_POLICY` | Score a metric payload in-process, with no server |
| **Agent instrumentation** | `from driftguard.adapters import AgentContext, driftguard_tool` | Turn your tool functions into agent events |
| **Framework adapters** | `DriftGuardCallbackHandler`, `DriftGuardRunHooks`, `DriftGuardClaudeAgentHooks` | Observe LangChain, the OpenAI Agents SDK, or the Claude Agent SDK with no tool changes |
| **MCP gateway** | `driftguard-mcp-proxy` command | Observe any MCP client's tool calls with no code change |
| **Server + dashboard** | `driftguard-server` command (`[server]` extra) | Host DriftGuard yourself |

The base install depends only on `httpx`. Everything that talks to a server
needs a **running DriftGuard server** and a **project API key** (`dg_live_…`).

## What you get out of it

Once data flows, the dashboard (and the HTTP API under it) give you:

| View | Answers |
| --- | --- |
| **Overview** | Is anything wrong right now? One status lamp, the most urgent stuck task, and instruments (risk, quality, latency, tool-failure rate) against your policy floors. |
| **Agent Diagnosis** | Which tool is my agent stuck on? The blocking tool, the wasted tokens, and each retry on a timeline. |
| **Alerts** | What needs attention? Critical drift and blocked tasks raise alerts automatically; agent alerts resolve themselves when the task recovers. Delivered to Slack and webhooks too. |
| **Events / Analytics** | How was each call scored, and how are the numbers trending — including a "worse than usual" comparison with the period before. |
| **Logs** | The full, searchable history of what your agents did. |
| **Policy** | The thresholds — token limits, score floors, latency limit — that define "too much" or "too low" for your app. |

Plus an **in-process gate** with no server round-trip: `client.check_drift()`
scores your latest metrics against the active policy so you can fall back before
spending tokens.

## What it does and doesn't do

- Tokens, latency and tool outcomes are captured for you. **Retrieval and quality
  scores are yours to supply** — from an evaluator or a proxy. See
  [Measuring scores](scoring-guide.md).
- The SDK only queues and sends. You need a running server and a key to see
  anything on the dashboard.
- It **observes and recommends**. It never changes your prompts or providers, and
  it can't read a closed agent's private session
  ([what it can't observe](agent-integration.md#what-driftguard-cannot-observe)).

## Next

- [Using the package](package-usage.md) — install it and wire it in.
- [Using the dashboard](using-the-dashboard.md) — read and operate the UI.
- [API reference](api.md) — the HTTP endpoints the SDK calls.
