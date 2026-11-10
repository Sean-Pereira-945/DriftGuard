# Status and roadmap

This page replaces the older `phases.md` and `PROJECT_HANDOFF.md`. An item is
marked done only when its code path is wired up and covered by tests. The dates
are for planning only; they aren't commitments.

## Product principles

- **Installable, not a repo artifact.** `pip install driftguard` gives you a
  dependency-light SDK. The server is one command or one `docker compose up`.
- **Explain, then act.** The value is in naming the blocking tool, counting the
  wasted tokens, and saying what to do. The dashboard exists to support that
  decision, not to decorate data.
- **Honest boundaries.** DriftGuard sees only what an SDK call, adapter, or
  gateway reports. It doesn't intercept private agent sessions, such as GitHub
  Copilot's, and it never changes prompts or providers on its own.
- **Developer-first.** Integrating should take minutes and work with any LLM
  provider.

## Done

### Phase 1: research foundation (June 2026)
- [x] Synthetic feature-drift model, benchmark against baselines, experiment
  runner, and Markdown reporting. These now live in `research/`.
- [x] **Baseline study (October 2026):** a seeded simulation of floors against the
  baseline comparison, with detection rates, false alarms and delays
  (`research/BASELINE_STUDY.md`).

### Phase 2: SaaS core and SDK (July 2026)
- [x] SDK client with local drift checks and server sync
- [x] FastAPI server with projects, ingestion, alerts, and policy

### Phase 3: agent tool-loop observability (August 2026)
- [x] Agent event schema and ingestion
- [x] Blocking-tool diagnosis and wasted-token accounting

### Phase 4 and 5 foundation rebuild, v0.4.0 (September 2026)
- [x] **Real authentication.** Email and password accounts with scrypt hashing,
  revocable sessions, and hashed project API keys with rotation. The shared
  unauthenticated `default` account is removed, and project-ID takeover is fixed.
- [x] **PostgreSQL that works.** A SQLAlchemy Core layer that CI tests on SQLite
  and PostgreSQL 16, with automatic additive migrations from v0.3.
- [x] **Redis** for rate limits shared across workers (atomic script) and for
  realtime alert fan-out.
- [x] **Live alerts.** WebSocket push that actually works, plus Slack and generic
  webhooks sent off the request path.
- [x] **Automatic alerts.** Critical drift raises alerts with a cooldown. Blocked
  agent tasks raise one alert per task, which stays updated and resolves itself
  when the task recovers.
- [x] **Better diagnosis.** Per-task status (blocked, failing, recovered,
  healthy), recovery detection, a configurable retry window and block
  threshold, redundant-call detection via `input_hash`, and error-specific
  recommendations.
- [x] **Adapters.** `@driftguard_tool` for sync and async code with
  `AgentContext` built on contextvars; token attribution from OpenAI, Anthropic,
  and Gemini responses; MCP session instrumentation and JSON-RPC interception.
- [x] **SDK.** Batched sync that keeps failed batches queued, a bounded queue,
  client-side timestamps, and policy-aware mitigation.
- [x] **Data handling.** A scheduled retention job and scrubbing of credentials
  and PII before storage.
- [x] **Packaging.** An httpx-only SDK with `[server]`, `[postgres]`, `[redis]`,
  and `[research]` extras; a working `driftguard-server` command; a
  multi-stage non-root Docker image; and a compose file.
- [x] **CI.** Lint, a Python 3.10–3.13 matrix, PostgreSQL and Redis tests, the
  dashboard build, and security scans that fail on findings.
- [x] **Dashboard** rebuilt against the real API under the DriftGuard brand:
  sign-in, live alerts, agent diagnosis, and no mock data.

### Activity log (merged as PR #9, not yet released)
- [x] **Logs view**: every agent activity newest first, with server-side search,
  kind and outcome filters, live updates, a detail drawer, and CSV/JSON export.
- [x] **Event kinds** beyond tool calls: model calls, prompts, responses and
  sessions. The diagnosis still uses tool calls only.
- [x] **Opt-in content storage** per project, with a matching SDK switch
  (`capture_content`). Content is scrubbed, capped at 2,000 characters, and
  removed by retention.
- [x] **Claude Code integration** through hooks: real sessions appear in Logs
  and Agent Diagnosis, and a command Claude keeps retrying is flagged as blocked.

### Dashboard redesign (October 2026, branch `feature/signal-box-redesign`, not merged)
These are checked by the type check, the build, the design detector and browser
runs. The pure logic under `frontend/src/lib/` has unit tests since November
2026; the views do not.

- [x] **Signal box look.** A dark enamel panel where colour appears only where
  state deviates. `PRODUCT.md` and `DESIGN.md` record the product and the design.
- [x] **Overview rebuilt** around a status plate, a track diagram of the most
  urgent task, and four instruments drawn against their policy floors.
- [x] **Drift made visible** on the timeline (limit, floors, a hatched breach
  span, a table view).
- [x] **Operator efficiency.** Keyboard shortcuts, shareable links that carry
  the view, project and filters, bulk resolve and reopen, arrow-key tabs.
- [x] **Policy impact preview**, inline validation and a change summary.
- [x] **Account deletion** from Project Settings, with the email and password to confirm.
- [x] **Attempt timeline** in the task drawer: tool calls on a shared time axis, so a
  retry loop is visible at a glance.
- [x] **Response quality for Claude Code from outcome checks** (did the turn's tests,
  lint, type check or build pass), with no retrieval score, and scores a source never
  sends left off the dashboard.
- [x] **Restore defaults** on Policy, from a new `GET /projects/{id}/policy/defaults`.
- [x] Redesign review fixes: a track that fills its width, a failures-in-a-row
  gauge on Agent Diagnosis, no gaps below the Overview's charts, and a readable
  phone layout.
- [x] The median, the weak end and the share under the floor beneath each average,
  so a mean can't hide a split.
- [x] The baseline line reads "No clear change" and shows its sample size, after the
  [baseline study](../research/BASELINE_STUDY.md) found "steady" over-claimed.
- [x] **Baseline comparison.** Mean retrieval, quality and risk against the period
  before the window, with a minimum sample of 10 events and a z-test, shown on the
  Overview as advice.
- [x] Contrast, visible filter labels and grouped navigation.
- [x] **Plate panels** (November 2026): the Overview's timeline, risk breakdown, root
  causes and open alerts are named with engraved plate labels over a sleeper rule,
  closing the last open item from the redesign review.
- [x] **View filters in the address** (November 2026): the Alerts tab and severity,
  and the Logs search, kind, outcome and task, so a filtered list can be linked.
- [x] **Bulk alerts endpoint** (`PATCH /projects/{id}/alerts`, November 2026): the
  dashboard's Resolve and Reopen on a selection send one request instead of one
  per alert.
- [x] **Frontend unit tests** (Vitest, November 2026): routing and shareable links,
  keyboard shortcuts, validation, reported scores, baseline wording and the Policy
  impact preview. `npm test` runs in CI before the build.

## Next

### Analytics
- [ ] Alert on a sustained drop from the baseline, with a rolling baseline and a
  control-chart rule, instead of showing advice only. The study says to require at
  least 3 checks in a row plus a cooldown, and to consider a sequential method
  (CUSUM or EWMA), because a 3-sigma check repeated at every event raises false
  alarms in about 5 percent of streams.
- [ ] A breakdown by model and route so a drift can be pinned to one cause. This
  needs those fields stored on telemetry events.
- [ ] Weights and thresholds that can be fitted to labelled data, and exposed in
  Policy.
- [ ] More outcome signals for Claude Code beyond passing checks (the user didn't
  repeat or undo the request).

### Dashboard
- [ ] Saved views.
- [ ] A server-side impact preview for Policy that replays stored history instead
  of the loaded events.

### Integrations
- [x] A standalone **MCP gateway** (`driftguard-mcp-proxy`, November 2026) that
  sits between any MCP client and its servers over stdio, forwarding every
  message and recording each `tools/call`. The most direct way to observe closed
  agents that support MCP.
- [ ] Framework adapters: LangChain/LangGraph callbacks, the OpenAI Agents SDK,
  and the Claude Agent SDK hooks.
- [ ] A JavaScript/TypeScript SDK.
- [ ] A VS Code extension that reports on tools it controls and on MCP traffic.
  It can't read Copilot's private session; see
  [agent-integration.md](agent-integration.md#what-driftguard-cannot-observe).

### Product
- [ ] Add model turns to the attempt timeline. It shows a task's tool calls today.
- [ ] Per-project notification settings (webhooks, email) instead of global
  environment variables.
- [ ] Latency as a first-class metric: ingest `latency_ms` and add a policy rule.
- [ ] Provider pricing profiles, to show wasted tokens as cost.
- [ ] Teams: several users per account, with roles.

### Operations
- [ ] Alembic migrations once the schema needs destructive changes.
- [ ] Integration with an external secret store (Vault, AWS Secrets Manager).
- [ ] Helm chart.
- [ ] OpenTelemetry export of events and alerts.
- [ ] Password reset and email verification. These need an outbound email
  provider.
