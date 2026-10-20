# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Developers who run LLM applications or coding agents, self-hosting DriftGuard on their own machines or servers. They open the dashboard when an agent seems stuck or token costs creep up, and they also check it routinely. Confirmed by the owner as "developer on-call".

## Product Purpose
DriftGuard is observability for LLM applications and AI agents. It names the tool that is blocking an agent, totals the tokens wasted on failed or redundant attempts, and scores ordinary LLM traffic for drift (prompt and context bloat, falling retrieval relevance, falling response quality). Success is the developer knowing what is wrong and what to do about it quickly.

## Positioning
It names the blocking tool, counts the wasted tokens, and recommends an action. It observes and recommends; it never changes prompts, models or providers, and it does not intercept closed agents such as GitHub Copilot. Confirmed by the owner.

## Operating Context
A FastAPI server with a React dashboard, backed by SQLite or PostgreSQL (Redis when scaled out), started with one command or `docker compose up`. Data arrives from an SDK, drop-in adapters, MCP instrumentation and a Claude Code hook. Views: Overview, Agent Diagnosis, Logs, Events, Alerts, Analytics, Policy, SDK integration and Project settings. Alerts are pushed live to the dashboard, Slack or any webhook.

## Capabilities and Constraints
- Two kinds of data: telemetry events (drift scoring) and agent events (diagnosis, alerts, logs).
- Per-project policy thresholds, environments (prod, staging, dev, test) and API keys.
- Inputs and outputs are stored only if a project opts in.
- Terminology to preserve: blocking tool, wasted tokens, agent event, recommendation, normalized telemetry, project, environment.
- Open: whether the product name or logo mark may change is undecided.

## Brand Commitments
Name: DriftGuard. Voice: precise and plain, no marketing language. The honest-boundary wording must be preserved; the UI must never imply it observes private agent sessions or silently changes providers.

## Evidence on Hand
Real README, docs (concepts, architecture, dashboard guide, design-system.md), a showcase seeder with a week of sample data, and a dashboard screenshot at docs/images/dashboard-overview.png. No customer logos, testimonials or benchmarks exist; none may be invented.

## Product Principles
- Explain, then act: the dashboard exists to support the decision, not to decorate data.
- Honest boundaries: show only what was reported, and mark missing data as not reported rather than zero.
- Developer-first: integration takes minutes and works with any LLM provider.
- Drift is the subject: the product is about change against a baseline, and the interface should reflect that.

## Accessibility & Inclusion
Keep the existing groundwork: skip link, severity shown with icon plus text (never colour alone), keyboard-openable rows, live regions for updates and reduced-motion support. Text contrast should reach 4.5:1.
