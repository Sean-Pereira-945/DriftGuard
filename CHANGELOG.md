# Changelog

All notable changes to DriftGuard are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[semantic versioning](https://semver.org/) (pre-1.0: minor versions may break).

## [Unreleased]

## [0.5.0] - 2026-11-11

First release published to PyPI. It contains the 0.4.0 foundation and
everything built on top of it: the activity log, the signal box dashboard
redesign, the analytics (baseline comparison, spread, latency), the MCP gateway,
and the framework adapters.

### Changed
- **`driftguard-server` fails gracefully without the server extra.** Running it
  from a base `pip install driftguard-tokepi` now prints `pip install "driftguard-tokepi[server]"`
  instead of a `ModuleNotFoundError` traceback. Importing `driftguard.server` is
  lazy, so the entry point and the `driftguard-mcp-proxy` command never pull in
  FastAPI.

### Added
- **Framework adapters for LangChain, the OpenAI Agents SDK and the Claude Agent
  SDK.** `DriftGuardCallbackHandler` (a LangChain/LangGraph callback handler),
  `DriftGuardRunHooks` (OpenAI Agents SDK run hooks) and
  `DriftGuardClaudeAgentHooks` (Claude Agent SDK tool hooks) each record one
  agent event per tool call — with its duration and outcome — and attribute each
  model turn's tokens to the next tool, reusing `AgentContext`. Each plugs into
  the framework's own hook mechanism in one or two lines. None of the frameworks
  is a dependency: each adapter subclasses its framework's base when installed
  and still works for testing without it. 10 new tests.
- **Latency as a first-class metric.** Telemetry accepts `latency_ms`, a new
  `latency_limit_ms` policy rule (default 10,000 ms) flags requests slower than
  the limit, and the reading flows through the summary (`averages.latency_ms`,
  `violation_rates.latency_limit_ms`), the Overview's All readings, the Drift
  Risk Breakdown, the Policy page and its impact preview, and the Test Telemetry
  form. A slow request adds 0.15 to its risk score — enough to tip a borderline
  event into `warning`, never enough to flag a fast one, and an event that
  reports no latency is never flagged. The SDK already forwards it
  (`capture_metrics(latency_ms=...)`). Existing databases gain the two columns on
  startup. 9 new backend tests and a frontend preview test.
- **MCP gateway (`driftguard-mcp-proxy`).** A stdio proxy that sits between any
  MCP client and a downstream MCP server, forwards every JSON-RPC message
  unchanged, and records each `tools/call` as a DriftGuard agent event with its
  duration and outcome — so closed agents that speak MCP can be observed with no
  code change. One session's calls group under one task, so a retried failing
  tool is flagged as blocked. Config comes from flags, `DRIFTGUARD_*` env vars or
  a JSON file (the same keys as the Claude Code integration). It logs only to
  stderr, passes a message it can't parse through untouched, and resolves the
  server command on `PATH` (including `.cmd` wrappers on Windows). New
  `driftguard.gateway` package, 13 tests.
- **View filters in the address.** Alerts keeps its tab and severity in the
  address (`#/alerts?tab=resolved&severity=critical`) and Logs keeps its search,
  kind, outcome and task (`#/logs?q=pytest&outcome=failed`), so a filtered list
  can be linked. Defaults are left out and the values go when you leave the view.
  Back and forward move between them, and a link to another view carries only
  the global filters.
- **Plate panels.** The Overview's timeline, Drift Risk Breakdown, Top Root
  Causes and Open Alerts are named with engraved plate labels over a sleeper
  rule, the same idiom as the instruments, instead of a plain title over a
  hairline. `Panel` gains `variant="plate"`.
- **Bulk resolve and reopen in one request.** `PATCH /projects/{id}/alerts` takes
  `{"ids": [...], "resolved": bool}` for up to 500 alerts and returns the alerts
  now in that state plus any ids that weren't the project's. Ids from other
  projects are never touched. Each changed alert is still pushed on the
  WebSocket. The Alerts view's selection actions use it, so resolving a hundred
  alerts is one round trip. 3 new tests.
- **Frontend unit tests.** The dashboard gains Vitest with jsdom: 33 tests over
  hash routing and shareable links, the keyboard shortcuts (including the `g`
  timeout, typing, modifiers and dialogs), input validation, which scores a
  source reports, the baseline wording, and the Policy impact preview, whose
  maths moved from the view into `lib/policyPreview.ts`. `npm test` runs in CI
  before the build.
- **Demo slides.** `docs/demo.md` links a nine-card deck that follows the running
  order, built from the current screenshots.
- **`startup.bat`** for Windows development: creates the environment on first
  run, starts the API on port 8000 against the local SQLite file and the Vite dev
  server on port 5173 with hot reload. `demo.bat` stays the one-click demo.
- **Claude Code templates** (`integrations/claude_code/templates/`): a
  `driftguard.json` and a `settings.local.json` with all six hooks, ready to copy
  into another repository's `.claude/` folder. Three placeholders to fill in; no
  key is shipped.
- **Signal box redesign of the dashboard.** The Overview now leads with one
  status plate, then a track diagram of the most urgent task, then four
  instruments.
  - The status plate shows one lamp and one word (`Critical`, `Warning`,
    `Stable` or `No data`), the diagnosis sentence, the recommendation and a
    single action.
  - The track draws each tool a task used as a block section, with the
    blocking tool held at a red signal. It also appears on Agent Diagnosis and
    in the task drawer.
  - Open alerts, mean risk score, response quality and tool failure rate sit in
    one strip. Gauges draw each reading against its policy floor or limit.
    Everything else is under a collapsed **All readings**.
  - The timeline draws the prompt-token limit and both score floors as dashed
    lines, hatches the span below the floors, and offers its data as a table.
- **Baseline comparison and sample-size guard.** `GET /projects/{id}/summary`
  gains `baseline`: the window's mean retrieval score, response quality and risk
  score against the same length of time just before it (at least 24 hours).
  - A change counts only when it is at least 3 standard errors wide (a Welch
    two-sample z-test) and at least 0.05 in size.
  - With under 10 events on either side it says "too few events to compare"
    instead of giving a verdict. "All time" has no comparison.
  - The Overview shows it under Mean risk score, Response quality and Mean
    retrieval score, and adds a "Worse than usual" line to the status plate. It is
    advice only: it raises no alert and doesn't change the status.
  - `driftguard/baseline.py` holds the maths, with 14 new tests.
- **Response quality for Claude Code, from outcome checks.** When a turn runs tests,
  a linter, a type check or a build, the hook scores the turn's last model call 1.0
  if the last check passed and 0.0 if it failed. Turns that run no check get no
  score, so the average is over checked turns only. Pass or fail also reads the
  output for what failing runs print, because a pipe into `tail` hides the exit code,
  and a command that never started is ignored. The basis is in the event's metadata.
  `"quality_from_checks": false` turns it off. There is deliberately **no retrieval
  score** for Claude Code: it has no retrieval step, and scoring empty searches would
  raise false degradation warnings. 54 new tests.
- **Scores a source never sends are left off the dashboard.** The Overview drops the
  Response quality instrument (three instruments instead of four), the Mean retrieval
  score reading, the matching Drift Risk Breakdown row, and the timeline's line, axis
  and legend entry, and All readings says what was left out. A score counts as sent if
  it appears in the window or the period before. Scores sent for only some events are
  drawn as dots, not joined by a line. The Policy preview counts only events that
  carry the reading ("8 of 25") and says when none do.
- **Spread behind each average.** `GET /projects/{id}/summary` gains `spread`:
  the median and the 10th and 90th percentiles of each metric, from the latest
  5,000 readings in the window. The Overview shows them under Mean risk score,
  Response quality and Mean retrieval score, with the share of events under the
  floor, so an average can't hide a split. It appears from 10 events. 6 new tests.
- **Restore defaults on Policy.** A button fills every field with the thresholds a
  new project starts with, for you to review and save. It is backed by a new
  `GET /projects/{id}/policy/defaults` (session or key), so the defaults live only
  on the server. 2 new tests.
- **Attempt timeline in the task drawer.** One row per tool call on a shared time
  axis, with each bar ending when the attempt was recorded and running back by its
  duration. A retry loop shows as a bunch of red bars. It shows the latest 40
  attempts and has a text summary.
- **Delete account from the dashboard.** Project Settings has a "Your account"
  panel. Deleting lists the projects that will go, and asks for your email and
  password. A wrong password deletes nothing. It uses the existing
  `DELETE /auth/me`.
- **Keyboard shortcuts.** `g` then `o` `d` `l` `e` `a` `n` `p` `s` `t` jumps
  between views, `/` focuses the search box, `r` refreshes and `?` lists them.
  They are off while typing or with a dialog open.
- **Shareable links.** The address carries the view, the project and both
  filters (`#/alerts?env=prod&range=7d&project=showcase`). Opening a link
  applies them. **Reset filters** appears when a filter is not at its default.
- **Bulk resolve and reopen** on Alerts, with select-all. The Alerts tabs now
  respond to arrow keys, Home and End, and the new-alert form opens from a
  **New alert** button.
- **Policy impact preview.** Each threshold says how many of the loaded events
  or tasks it flags, before and after your edit. Fields validate as you leave
  them. The save bar lists every change and warns when coverage drops.
- **Logs view** in the dashboard: the full history of agent activity, newest
  first.
  - Server-side search, plus kind and outcome filters.
  - Live updates, with a pause button.
  - A detail drawer, including "show only this task".
  - CSV and JSON export.
- **Agent event kinds.** `kind` accepts `tool_call` (the default), `llm_call`,
  `prompt`, `response`, `session_start` and `session_end`. Non-tool kinds don't
  need `tool_name` or `status`, and are ignored by the diagnosis and agent alerts.
- **Opt-in content storage.**
  - Agent events accept `input` and `output` previews.
  - The server stores them only when the project's new `capture_content`
    setting is on. It's off by default.
  - Stored content is scrubbed, cut to 2,000 characters, and pruned by retention.
- `PATCH /projects/{id}` changes a project's name or `capture_content`.
- **Overview agent activity.** `GET /projects/{id}/summary` gains
  `agent_activity`, computed from the same rows as Logs: tool calls, failures,
  failure rate, tasks, finished turns, tokens used and average tool duration. The
  Overview shows these as a row of cards. Retrieval and quality cards say "Not
  reported by this source" when the telemetry has no such score.
- `GET /projects/{id}/agent-events` gains `kind`, `tool_name`, `agent_name`,
  `outcome`, `q` (search) and `before_id` (paging).
- `GET /projects/{id}/agent-events/export?format=csv|json` downloads up to 10,000
  filtered events.
- The WebSocket sends `{"type": "activity", "count": n}` after agent events are
  ingested. Agent Diagnosis and Logs use it to refresh live.
- **SDK.**
  - `DriftGuardClient(capture_content=True)` sends content previews. Without it,
    `input` and `output` are removed before events are queued.
  - With it on, `@driftguard_tool` and the MCP adapter send tool arguments and
    results.
  - `AgentContext.record_activity(kind, ...)` logs prompts, model calls and
    other non-tool activity.

- `examples/seed_showcase.py` fills a project with a week of varied sample data
  for every dashboard view, using only its API key.
- **Claude Code integration** (`integrations/claude_code/`): a hook script
  that reports a Claude Code session to DriftGuard with no code changes.
  - Each prompt becomes a task, and each tool call a `tool_call` event.
  - Failures come from `PostToolUseFailure`.
  - Prompts, turn endings and session start/end appear in Logs.
  - Tool calls get their duration, model and tokens from the session
    transcript. Cached context isn't counted, and each model call is counted
    once. A later tool call from the same model call shows 0.
  - Each turn is reported once, when Claude stops, as one `response`. It holds
    the prompt, the answer, the turn's duration and the tokens of all its model
    calls.
  - Session start and end are opt-in (`"session_events": true`).
  - Each finished turn sends LLM telemetry, one event per model call, with new
    input tokens and the full context size. Turn it off with
    `"send_telemetry": false`.
  - A turn whose start isn't in the hook state falls back to the last prompt you
    typed. It skips messages Claude Code inserts, and ignores starts older than
    6 hours.
  - It uses only the standard library, gives up after 2 seconds, never fails
    Claude Code, and logs problems to `.claude/driftguard-hook.log`.

### Changed
- **New look.** The dashboard moves from a pure-black graphite console to a dark
  black enamel panel with ivory type. Colour now appears only where
  something deviates (red, amber, green lamps, each with an icon and a word).
  Fonts are Barlow, Barlow Condensed and JetBrains Mono, replacing Space
  Grotesk and Plus Jakarta Sans. The logo is the text "DriftGuard" alone, with no
  symbol, and the browser-tab icon is a plain "D". The decorative background grid
  is removed.
- **True-black canvas and brighter colours.** The page background is pure black
  with panels lifted a shade, ivory text and the route colour are brighter, and
  the red, amber, green and steel lamp colours are more luminous.
- The Logs kind filter now offers only Tool call, Prompt and Response. Model
  call, Session start and Session end are no longer listed there, though rows of
  those kinds still appear under All activity.
- **Themed dropdowns.** Every select uses a themed control. In Chrome and Edge
  the open list is a black panel with a hairline border, a highlighted row and a
  check mark on the chosen item. Other browsers keep their own list in the same
  colours.
- **Layout fixes from the design review.** The track diagram's sections share the
  full width. Agent Diagnosis gains a gauge of the longest run of failures in a
  row against the block threshold. Top Root Causes moves under Drift Risk
  Breakdown and Open Alerts runs full width, so there are no empty gaps. On a
  phone the chart legend is one scrolling line, Test Telemetry is an icon, and the
  filter row wraps.
- The baseline line says **No clear change** instead of "Steady", and every verdict
  shows the events it rests on, for example "(89 events now, 93 before)". Under 30
  events on a side it adds that a small drop could be missed. The research study
  found a real 0.09 drop is detected only about a third of the time at 10 events,
  so "steady" over-claimed.
- Disabled navigation, placeholder and footer text now meets 4.5:1 contrast.
  The header selects have visible labels (**Env**, **Range**), and the
  **Updated** time shows from tablet width up. The sidebar groups its nine
  views into Monitor and Configure.
- The Overview moves Total events, Tokens at stake, retrieval score and the
  agent counts into a collapsed **All readings** list. The "Active Alerts"
  panel is now **Open Alerts**, and the Alerts panel title follows the tab.
- Agent Diagnosis shows three headline instruments, with the other counts
  under **All counts**.
- The dashboard's Refresh button also reloads the project list, and the list
  reloads when you return to the tab. A project created through the API or a
  script no longer needs a page reload to appear.
- Existing databases gain `projects.capture_content` and
  `agent_events.kind`/`input_text`/`output_text` automatically on startup.
  Existing agent events become `tool_call` events.

### Documentation
- **Research: the baseline study** (`research/baseline_study.py`,
  `research/BASELINE_STUDY.md`). A seeded simulation of the product's own rules,
  fixed floors against the baseline comparison, with known truth. It reports
  detection rates, false alarms and delays for one decision per window, for
  noisier data, for checking after every event, and for slow decline, with 11
  tests. Findings: the two rules fail in opposite places so both stay; the
  10-event guard works but "Steady" over-claims at low counts; and a 3-sigma
  check repeated at every event raises false alarms in 5 percent of streams, which
  needs a rule of several checks in a row before anything alerts. The research
  README now explains what each part can and can't show.
- **New guide: Measuring retrieval score and response quality**
  (`docs/scoring-guide.md`). How to calculate each score, what to do when a source
  has no evaluator (and why a proxy from telemetry is only a rough signal),
  choosing the floors from your own data, how the scores become alerts, and what
  the numbers can't tell you. The Logs Details column and its troubleshooting row
  now explain that a dash means content storage is off.
- **Documentation refresh.** The architecture diagram is restyled to the new
  look (SVG and PNG) and notes the dashboard's shortcuts and shared links. The
  dashboard guide, demo outline, setup guides and architecture page use the new
  names (**Env**, **Range**, instruments, track), and every screenshot is
  retaken with a full week of data, plus new ones for Policy and the shortcut
  sheet. `docs/development.md` lists the design files.
- **`PRODUCT.md`** records the product's users, purpose, positioning and
  constraints for design work.
- **Design system** (`docs/design-system.md`) rewritten for the signal box
  look. The **dashboard guide** covers the new Overview, shortcuts, shared
  links, bulk actions and the policy preview, and its screenshots are
  retaken.
- **`SETUP.md`**: a step-by-step guide for teammates, from a fresh laptop to
  a running DriftGuard with sample data, on Windows, macOS and Linux.
- **Getting started** (`docs/quickstart.md`) rewritten: three ways to run it
  (`demo.bat`, from source, Docker), four ways to send data (sample data, live
  demo, Claude Code, SDK), and a troubleshooting table.
- New **How DriftGuard works** (`docs/concepts.md`): the problem, the two kinds
  of events, a glossary, scoring and diagnosis with worked examples, and a
  60-second summary.
- **Architecture diagram** as an image (`docs/images/architecture.svg`, plus a
  PNG for slides), and new diagrams of the dashboard and of the telemetry, agent
  event and Claude Code hook flows. Also a server module table and a
  view-to-endpoint table.
- **Dashboard guide** rewritten with screenshots and a table for every card and
  column, plus a map of which source fills which view.
- The demo guide gains a 15-minute presentation outline. The README gains a
  "Start here" table, the diagram and a screenshot.

## [0.4.0] - unreleased

A rebuild of the foundation. v0.3 described several features as done that
didn't work: authentication, PostgreSQL, live alerts, and retention. This
release implements them, with tests.

### Security
- **Removed the unauthenticated `default` account.** v0.3 let any request with
  no token act as a shared account, so anyone could list, read, and change
  those projects.
- **Real authentication.** Email and password accounts, with passwords hashed by
  scrypt. `POST /auth/register`, `/auth/login`, `/auth/logout`, `GET /auth/me`,
  and `DELETE /auth/me`. v0.3's `POST /auth/session?account_id=` handed out a
  token to anyone who knew an account ID.
- Sessions are revocable. Each JWT's `jti` is stored, so logout and account
  deletion invalidate it.
- **Project API keys are hashed**, shown once, and can be rotated
  (`POST /projects/{id}/api-key`). Existing plaintext keys are hashed on first
  start. Keys now have a `dg_live_` prefix.
- **Fixed project takeover.** v0.3 used `INSERT OR REPLACE`, so creating a
  project with another account's ID overwrote it. Creating an existing ID now
  returns `409`.
- A project API key can no longer change policy. Policy changes, deletion, key
  rotation, and alert changes need the owner's session.
- The WebSocket requires a session token or API key, sent as a subprotocol so
  it stays out of URL access logs.
- Production refuses to start without a strong `DRIFTGUARD_SECRET_KEY`.
- Rate limits: separate limits for login (per IP), the API (per session or
  key, 300/min), and ingestion (per key). The
  Redis limiter is atomic and uses wall-clock time; v0.3 used
  `time.monotonic()`, which isn't comparable across processes.
- Scrubbing now covers API keys and tokens (OpenAI, Anthropic, GitHub, AWS,
  Google, Slack, bearer, private keys). Card numbers need a valid Luhn checksum,
  so ordinary long numbers are no longer redacted.
- Security headers on every response, and HSTS in production.
- Upgraded to FastAPI 0.14x and Starlette 1.x. Starlette 0.38 had published
  advisories.

### Added
- `driftguard.server`: an app factory (`create_app`) and a working
  `driftguard-server` command. The old entry point pointed at an ASGI object and
  couldn't run.
- **Automatic alerts.**
  - Critical telemetry raises a `drift` alert, at most one per root cause per
    cooldown.
  - A blocked agent task raises one `agent` alert. Its wasted-token figure keeps
    updating, and the alert resolves itself when the task recovers.
  - Alerts have `id`, `source`, `task_id`, `root_cause`, and
    `resolved`/`resolved_at`.
  - `PATCH /projects/{id}/alerts/{alert_id}` resolves or reopens an alert.
- **Server-side scoring.** Each ingested event stores `risk_score`, `severity`,
  `root_cause`, and `recommendation`.
- **Batch ingestion:** `POST /events/{id}/batch` and
  `POST /agent-events/{id}/batch`, up to 500 events each.
- Events accept `occurred_at` and `metadata`. Agent events accept `input_hash`.
- `GET /projects/{id}/summary` rewritten: SQL aggregates, `violation_rates`,
  `events_by_severity`, `top_root_causes`, and open-alert totals.
- `GET /projects/{id}/agent-events` with a `task_id` filter. Event lists page
  with `before_id`.
- Realtime alerts at `WS /ws/projects/{id}` with an `action` field (`created`,
  `resolved`, `reopened`), fanned out across workers through Redis.
- Slack and generic webhook notifications, delivered on a background thread.
- A scheduled retention job (`DRIFTGUARD_RETENTION_DAYS`). It prunes telemetry,
  agent events, resolved alerts, and expired sessions. v0.3 had the code but
  never ran it.
- **Agent diagnosis v2.**
  - Per-task results in `tasks`.
  - Recovery detection: a later success of the same tool.
  - Policy settings `blocked_after_failures` and `retry_window_minutes`.
  - Redundant-call detection.
  - Recommendations based on the error type.
- **Adapters.**
  - `@driftguard_tool` supports async functions. `AgentContext` uses
    contextvars and supports `async with` and `auto_sync`.
  - `record_llm_usage()` attributes model tokens to tool calls.
  - `usage_from_response()` reads OpenAI, Anthropic, and Gemini responses.
  - `MCPMiddleware.instrument_session()` wraps an MCP `ClientSession`.
  - Inputs are fingerprinted automatically.
- **SDK.**
  - Batched sync; failed batches stay queued in order (v0.3 could drop or
    duplicate events).
  - A bounded queue and client-side `occurred_at` timestamps.
  - An optional `project_id` default, plus `flush()` and
    `sync_agent_events_async()`.
- **Dashboard** moved into `frontend/` from the separate `Design-` repo,
  rebranded to DriftGuard, and rebuilt against the real API.
- Schema setup is safe when several workers start at once (a PostgreSQL
  advisory lock; retried on SQLite).
- The server closes its database connection pool on shutdown.
- Docker: a multi-stage, non-root image that bundles the dashboard, with a
  healthcheck. Compose uses healthchecks, and Postgres and Redis are no longer
  exposed on the host.
- CI: ruff, pytest on Python 3.10–3.13, the full server suite on PostgreSQL 16
  and Redis 7, the dashboard build, and security scans that fail on findings.
  Releases check that the wheel bundles the dashboard.
- `examples/live_demo.py` and [docs/demo.md](docs/demo.md): a step-by-step live
  demo covering drift, a blocked agent, and automatic recovery.
  `demo.bat` starts the whole demo on Windows in one step.
- Docs: new API reference, architecture, configuration, deployment,
  development, and roadmap pages. `DESIGN.md` moved to `docs/design-system.md`. All existing docs were rewritten to match the
  code. A `LICENSE` file was added (MIT, as `pyproject.toml` already declared).

### Changed
- **Package extras.** `pip install driftguard` now installs only `httpx`. The
  server needs `driftguard[server]`; add `[postgres]` and `[redis]` as needed,
  or `[all]`. NumPy and pandas are no longer dependencies.
- **Persistence rewritten** on SQLAlchemy Core. PostgreSQL works; v0.3 used
  SQLite-only SQL and silently fell back to a local SQLite file. There are no
  in-memory caches, so it's safe with several workers. Filtering happens in SQL.
- `recommend_mitigation` and `check_drift` use the project policy's thresholds;
  v0.3 compared against hardcoded values.
- Root cause text: "trajectory quality degradation" is now "response quality
  degradation".
- The policy returns `blocked_after_failures` as an integer (`3`, not `3.0`),
  matching what `PUT /projects/{id}/policy` accepts.
- `.env.example` lists every server variable, including the `driftguard-server`
  defaults `DRIFTGUARD_HOST`, `PORT` and `DRIFTGUARD_WORKERS`.
- Configuration uses `DRIFTGUARD_*` names. `JWT_SECRET`, `API_SECRET`, and
  `RATE_LIMIT_PER_MINUTE` still work but are deprecated.
- The research prototypes (`data`, `detector`, `benchmark`, `experiment`,
  `reporting`, and the demo API) moved to `research/`.

### Removed / breaking
- These routes are gone:
  - `POST /accounts` → use `/auth/register`
  - `POST /auth/session` → use `/auth/login`
  - `GET /accounts/me` → use `/auth/me`
  - `POST /alerts` → use `POST /projects/{id}/alerts`
  - `GET /alerts/{id}` → use `GET /projects/{id}/alerts`
  - `GET /events/{id}` → use `GET /projects/{id}/events`
  - `/projects/{id}/metrics` and `/projects/{id}/dashboard` → use
    `/projects/{id}/summary`
  - `WS /ws/alerts/{id}` → use `WS /ws/projects/{id}`
- `driftguard.routes`, `driftguard.service`, `driftguard.middleware`,
  `driftguard.config`, `driftguard.workers`, and `driftguard.notifications` moved
  under `driftguard.server`. `driftguard.analytics` and
  `driftguard.dashboard_data` were removed; `/summary` replaces them.
- `driftguard.compute_drift_scores` was removed from the public API. It was the
  synthetic research detector and now lives in `research.detector`. Use
  `driftguard.evaluate_drift` for LLM telemetry.
- `capture_metrics` no longer adds a `project` key to the payload.
- `requirements.txt` was removed; `pyproject.toml` is the single source of
  dependencies.
- The legacy static dashboard (`static/dashboard.js`, `styles.css`) and the
  1,200-line embedded HTML dashboard in `api.py` were removed.

## [0.3.0] - 2026-08

- The SDK client, FastAPI server, project API keys, agent event ingestion, and
  the first blocking-tool diagnosis.
