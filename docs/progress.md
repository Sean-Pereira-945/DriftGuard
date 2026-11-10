# Progress report

Last updated: 2026-11-10.

For the full list of changes, see [CHANGELOG.md](../CHANGELOG.md). For the
long-term plan, see [roadmap.md](roadmap.md).

## Where things stand

| Work | Branch | State |
| --- | --- | --- |
| 0.4.0 foundation rebuild | `refactor/foundation` | Merged into `main` (PR #8) |
| Logs view, event kinds, content storage, Claude Code hook, showcase seeder, docs rewrite | `feature/logs` | Merged into `main` (PR #9) |
| Team setup guide (`SETUP.md`) | `docs/team-setup` | Pushed. One commit ahead of `main`, no PR yet. |
| Dashboard redesign and analytics: signal box look, shortcuts, shared links, policy preview, baseline comparison, scoring guide, research study, and the two rounds of follow-ups below | `feature/signal-box-redesign` | On top of `docs/team-setup`, so it carries the setup guide too. Pushed to GitHub; see "Follow-ups round 2" for the PR. |

The sections below keep the 0.4.0 record, then cover each later piece of work.
The newest, the dashboard redesign, has its own section near the end.

## 0.4.0 foundation rebuild (September 2026)

Date finished: 2026-09-30. Merged into `main` as PR #8.

## Finished and verified

| Area | What was done | How it was verified |
| --- | --- | --- |
| Repo organisation | Research code moved to `research/`; server code moved to `driftguard/server/`; the frontend moved from `.frontend_source/` into `frontend/`. Dead code removed: the old static dashboard, the embedded HTML dashboard, `analytics.py`, `dashboard_data.py`, `requirements.txt`. | Every test suite passes |
| SDK | httpx-only; batched sync that keeps failed batches queued; bounded queue; client timestamps; policy-aware `check_drift` | `tests/test_client.py`, plus an end-to-end run against a real server |
| Agent diagnosis | Per-task status: blocked, failing, recovered, healthy. Configurable retry window and block threshold. Redundant-call detection and error-specific advice. | `tests/test_agent_analysis.py` |
| Adapters | Async `@driftguard_tool`, `AgentContext` on contextvars, LLM token attribution, MCP session wrapper | `tests/test_adapters.py` |
| Auth and security | Email/password accounts, revocable sessions, hashed and rotatable API keys, no shared `default` account, project-takeover fix, per-session rate limits, WebSocket auth via subprotocol, secret and PII scrubbing | `test_auth.py`, `test_projects.py`, `test_realtime.py`, bandit clean, pip-audit clean, npm audit clean |
| Persistence | SQLAlchemy Core on SQLite and PostgreSQL; automatic migration from 0.3; startup safe with several workers | Full suite on PostgreSQL 16; v0.3 upgrade test; concurrent-startup test |
| Alerts | Automatic drift and agent alerts; auto-resolve on recovery; Slack and webhook delivery; live WebSocket push, shared across workers through Redis | `test_dashboard.py`, `test_realtime.py`, `test_redis.py` (real Redis) |
| Retention | Scheduled pruning at startup and on an interval | `test_retention.py` |
| Dashboard | Rebuilt against the real API and rebranded DriftGuard (no mock data), dark design system, sign-in, every view from the brief | `npm run lint`/`build` pass; 18-step headless browser run; screenshots reviewed |
| Packaging and deploy | Extras (`server`, `postgres`, `redis`, `all`), working `driftguard-server`, wheel bundles the dashboard, multi-stage non-root Docker image, compose with healthchecks | Wheel contents checked; `docker compose up` on a clean volume came up healthy with 2 workers and no errors |
| CI | New `ci.yml` (lint, Python 3.10–3.13, Postgres + Redis, dashboard build); `security.yml` fails on findings; `release.yml` checks tag and wheel | Written but **not run on GitHub yet** |
| Live demo | `examples/live_demo.py` plays drift, a blocked agent and recovery step by step; guide in `docs/demo.md` | Run end to end against the local server: agent alert fired and auto-resolved, drift alert raised |
| Docs | New pages: api, architecture, configuration, deployment, development, dashboard, agent-integration, quickstart, roadmap, design-system; README and CHANGELOG | Code examples checked against a running server |

Last test run: **135 passed** on SQLite, and **129 passed** on PostgreSQL + Redis.
Lint, bandit, pip-audit and `npm audit` are all clean.

### Fixed after the first review pass
These came from the dashboard agent's feedback and from testing the compose stack:
- API rate limits are now per session or API key (300/min), not per IP, so
  users behind one NAT don't share a budget.
- `blocked_after_failures` is returned as an integer.
- WebSocket alert messages carry `action` (`created`, `resolved`, `reopened`);
  the dashboard only notifies on `created`.
- Schema setup no longer crashes a worker when several start at once (found on
  a fresh `docker compose up`).
- The server releases its database pool on shutdown.

### Docs audit
- Every route in the app is documented in `api.md`, and every documented route
  exists (checked automatically).
- Every environment variable the server reads is in `configuration.md` and
  `.env.example`.
- All relative links in the docs resolve.

## After 0.4.0: Logs (October 2026, merged as PR #9)

Built on its own branch off `refactor/foundation`, so it stayed out of the 0.4.0
PR. Details are in the CHANGELOG under *Unreleased*.

| Area | What was done | How it was verified |
| --- | --- | --- |
| Server | Event kinds, opt-in content storage, `PATCH /projects/{id}`, activity filters, search, paging, CSV/JSON export, a live `activity` message | `tests/test_activity_log.py` (10 tests); full suite **167 passed, 2 skipped** on SQLite, re-run on 2026-10-20 after the dashboard redesign (the redesign changes no Python). It was 140 on PostgreSQL 16 + Redis 7 before the hook work, and hasn't been re-run there since. |
| SDK | `capture_content`, `record_activity`, content previews from the decorator and MCP adapter | 3 new tests in `tests/test_adapters.py` |
| Dashboard | Logs view; content-storage switch in Project Settings; Agent Diagnosis refreshes live | Type-check and build pass; 12-step headless browser run (filters, search, drawer, live update, pause, export, settings switch, phone width) with no console errors |
| Upgrade | Existing databases gain the new columns on startup | A copy of the local demo database upgraded cleanly, and old events became `tool_call` |

**Fixed in the 0.4.0 branch while building this:** the Python `lib/` rule in
`.gitignore` also matched `frontend/src/lib/`, so that folder was missing from
the first push and a fresh clone couldn't build the dashboard. The rule is now
anchored (`/lib/`), and the folder is committed and pushed to
`refactor/foundation`. A clean clone of that branch was checked: it installs,
type-checks and builds.

### Claude Code integration (same PR, connected on this machine)

| What | How it was verified |
| --- | --- |
| `integrations/claude_code/driftguard_hook.py` maps hook events to DriftGuard events | `tests/test_claude_code_hook.py` (19 tests: turns, transcript tokens and durations, telemetry, and an end-to-end run that blocks a task) |
| Hooked into this repo through `.claude/settings.local.json`, sending to the local server's **Claude Code** project | Live: this Claude Code session's own tool calls arrived. Three deliberately failing `ls` commands, plus one real failure, marked the task blocked and raised a critical agent alert |

The config with the key (`.claude/driftguard.json`), the hook state and the log
are gitignored. Content storage is off on the server for the **Claude Code**
project. The hook is allowed to send content, so turning on the switch in Project
Settings is enough to start storing it. Duration, model and tokens are read from the session
transcript, because hooks don't report them.

## Documentation and team setup (branch `docs/team-setup`)

| What | Status |
| --- | --- |
| **Getting started** (`docs/quickstart.md`) rewritten: three ways to run it, four ways to send data, a troubleshooting table | Merged with PR #9 |
| **How DriftGuard works** (`docs/concepts.md`), the architecture diagram as an image, and a dashboard guide with screenshots | Merged with PR #9 |
| **`SETUP.md`**: a step-by-step guide from a fresh laptop to a running DriftGuard with sample data, on Windows, macOS and Linux | Pushed on `docs/team-setup`. Not merged. |
| **Scoring guide (`docs/scoring-guide.md`)**: how to calculate retrieval score and response quality, proxies for telemetry-only sources like Claude Code, choosing floors, and the limits of the analytics | On `feature/signal-box-redesign` |
| **Showcase seeder** (`examples/seed_showcase.py`): a week of varied sample data so every view has something to show | Merged with PR #9 |
| **Documentation refresh (2026-10-20):** the architecture diagram (SVG and PNG) restyled to the new look, all dashboard screenshots retaken from a seeded project with a week of data, new Policy and shortcut screenshots, and the dashboard guide, demo outline, setup guides, architecture page and development guide brought in line with the redesign | On `feature/signal-box-redesign` |

## Dashboard redesign (branch `feature/signal-box-redesign`, 2026-10-20)

Started from a design critique of the dashboard (score 25 out of 40) and the
owner's brief to go bolder on all five issues it found. Nothing in the server,
the SDK or the API changed. This is dashboard, docs and design-context work only.
Details are in the CHANGELOG under *Unreleased*.

### What was changed

| Area | What was done |
| --- | --- |
| Design context | New `PRODUCT.md` (users, purpose, positioning, constraints), `DESIGN.md` and `.impeccable/design.json` (tokens and components, written from the built code), a recorded direction contract, and the critique snapshot in `.impeccable/critique/`. The design-system doc was rewritten. |
| Look | The graphite console became a true-black enamel panel with ivory type and brighter lamp colours, in the idiom of a railway signal box. Colour appears only where state deviates, as red, amber or green lamps that always carry an icon and a word. Fonts are Barlow, Barlow Condensed and JetBrains Mono. New mark. The decorative grid is gone. |
| Overview | Now leads with a status plate (one lamp, one word, the diagnosis, the recommendation, one action), a track diagram of the most urgent task, and four instruments with baseline gauges. Total events, tokens at stake, retrieval score and the agent counts moved into a collapsed **All readings**. |
| Agent Diagnosis | Three headline instruments plus a collapsed **All counts**, replacing six equal cards. The track diagram appears under the most urgent task and in the task drawer. |
| Drift made visible | The timeline draws the prompt-token limit and both score floors, hatches the span under the floors, and has a table view. Gauges show how far a reading is from its floor. |
| Operators | Keyboard shortcuts (`g` then a letter, `/`, `r`, `?`) with a shortcut sheet. The view, project and filters live in the address, so links can be shared, and **Reset filters** appears when needed. Alerts gained bulk resolve and reopen, arrow-key tabs, and a **New alert** button. |
| Policy | Fields validate as you leave them. Each shows how many of the loaded events or tasks it flags, before and after your edit. The save bar lists every change and warns when coverage drops. |
| Accessibility and clarity | Disabled, placeholder and footer text raised to 4.5:1 by design. The header filters have visible labels. The sidebar groups its views into Monitor and Configure. The **Updated** time shows from tablet width. |
| Docs | Dashboard guide, design system, frontend README and CHANGELOG updated, and the six dashboard screenshots retaken. |

Ideas from the critique that the work **dropped on purpose:** sparklines on
cards (the design brief treats them as filler, so drift is shown against
baselines instead), and renaming "Tokens at stake" (the docs define it as a
different quantity from "Wasted tokens", so it stays).

### How it was verified

| Check | Result |
| --- | --- |
| `npm run lint` and `npm run build` | Pass |
| Design detector over the views, components and charts | Zero findings |
| Python test suite | 167 passed, 2 skipped when the redesign shipped (181 after the baseline comparison below) |
| Headless Chrome against a throwaway database filled with the showcase seeder | Overview, Agent Diagnosis, Logs, Alerts, Policy (including an edited, invalid state) and the shortcut sheet at 1440 px wide, plus the Overview, Alerts and Policy at 390 px. No page errors; one mobile run logged two 429 responses because the test script signed in repeatedly and hit the server rate limit. `g` then `p` navigated, and a link with `?env=prod&range=7d` applied its filters. |
| Policy preview counts | Checked against the events API: 44 of 111 for both floors. The seeder degrades retrieval and quality together. |
| Finish review by a fresh agent, two rounds | Disposition **fix** after round one. Round two scored 4 fixes resolved and 4 partial, and found one regression (a label overprinting a tick), which was fixed afterwards. |

**Not verified:** clicking **Resolve** on a selection, the arrow-key tab
behaviour and the **New alert** form were reviewed in code and screenshots but
not exercised end to end in a browser. Contrast was set from token values, not
measured with a tool. Reduced-motion and a screen reader were not tested. The
dashboard was only seen with sample data. The frontend still has no unit tests.

### Research update (same branch)

The research folder gained a simulation study of the product's detection rules.
The code is `research/baseline_study.py` and the write-up is
[`research/BASELINE_STUDY.md`](../research/BASELINE_STUDY.md). It is seeded and
reproducible, and 11 new tests in `research/tests/test_baseline_study.py` pin its
main findings. The research suite is now **19 passed**. Lint and format are clean
across the repo. The Phase 1 prototypes are unchanged, and the research README now
says plainly that their benchmark ranks raw scores and isn't a detection
evaluation.

### Baseline comparison (same branch, added afterwards)

| What | How it was verified |
| --- | --- |
| `driftguard/baseline.py` and a `baseline` field on the summary: each window's mean retrieval score, response quality and risk score against the period before it, with a minimum sample of 10 events on each side | 14 new tests (`tests/test_baseline.py`): the guard, direction, a tiny-but-certain shift, zero variance, a hand-checked z-score, and the summary endpoint for 24 h, 15 m, all-time and empty projects. Full suite **181 passed, 2 skipped**. Lint and format clean. |
| Overview shows the comparison under the readings, and a "Worse than usual" line on the status plate | Checked in headless Chrome on the seeded project: Last 24 hours flagged retrieval (z −3.7) and quality (z −6.7) as worse and risk as steady (z 2.2). Last 7 days said there was nothing earlier to compare. |

It is advice only. It raises no alert and doesn't change the status, and it
treats events as independent and mixes all models and routes together.

### Dashboard follow-ups (same branch, after the first push)

Six small features, each checked in a real browser against seeded data and
committed on its own. The Python suite is now **200 passed, 2 skipped**.

| # | What | How it was checked |
| --- | --- | --- |
| 1 | The baseline line says **No clear change** and shows the events behind every verdict, with a warning under 30 events | Screenshots with large and small samples |
| 2 | Review fixes: a track that fills its width, a failures-in-a-row gauge on Agent Diagnosis, no gaps below the Overview charts, a readable phone layout | Desktop and 390 px screenshots |
| 3 | The median, the weak end and the share under the floor beneath each average (`spread` on the summary) | 6 new tests, plus a screenshot where the mean was 0.79, the median 0.81 and half the events were under the floor |
| 4 | **Restore defaults** on Policy, from a new `GET /projects/{id}/policy/defaults` | 2 new tests, plus a browser run: change the policy, restore, save, confirm through the API |
| 5 | An attempt timeline in the task drawer | Screenshot of a blocked task with three failed attempts |
| 6 | **Delete account** from Project Settings | Browser run on a throwaway account: wrong password deletes nothing, the right one deletes, signs out, and the login then fails |
| 7 | **Response quality for Claude Code from outcome checks**, no retrieval score, and unreported scores left off the dashboard | 54 new hook tests, a check of the live hook against this session's own commands (which exposed a shell-syntax-error case, now ignored), and two seeded Claude Code-style projects in the browser: one with checked turns, one with none |

**Not done, and why:** alerting on a sustained drop from the baseline. It changes
what raises an alert and what gets sent to Slack and webhooks, and needs a new
alert source and a small state table. The study's design is to require at least 3
checks in a row plus a cooldown. It is left for an explicit decision.

### Review items, and what was done about them

- **Track diagram sparse for a one-tool task.** Fixed: sections now share the full
  width, so a task with one tool fills the track with its red section.
- **Agent Diagnosis instruments had no gauges.** Fixed for the headline reading:
  **Blocked tasks** now carries a gauge of the longest run of failures in a row
  against the block threshold from Policy. The other instruments are counts, so
  they have no baseline to draw.
- **Empty space below the Overview's charts.** Fixed: Top Root Causes now sits under
  Drift Risk Breakdown, beside the timeline, and Open Alerts runs full width.
- **Phone layout.** Fixed: the chart legend is one scrolling line instead of
  three, **Test Telemetry** is an icon on a phone, and the filter row wraps so the
  Range select stays readable.
- **Still open:** the panels below the Overview's first screen are still plain
  bordered boxes rather than plates, which is a matter of taste.

## Follow-ups round 2 (2026-11-10)

The open items from the progress report and the roadmap that didn't change
what raises an alert. Each is its own commit with its docs and CHANGELOG entry.

| # | What | How it was checked |
| --- | --- | --- |
| 1 | `startup.bat` (dev: API + Vite with hot reload) and the Claude Code hook templates committed and documented; the template path and key are placeholders | Read through; no key or machine path in the committed files |
| 2 | **Frontend unit tests**: Vitest + jsdom, 36 tests over routing and shareable links, the keyboard shortcuts, validation, reported scores, baseline wording and the Policy preview (its maths moved to `lib/policyPreview.ts`). `npm test` runs in CI before the build | `npm test`, `npm run lint`, `npm run build` all pass; one test bleed (Testing Library not unmounting between tests) found and fixed by enabling Vitest globals |
| 3 | **Bulk alerts endpoint** `PATCH /projects/{id}/alerts` (`ids`, `resolved`), one statement, ids from other projects reported as `missing`; the Alerts view's selection actions use it | 3 new tests (resolve, reopen, cross-project, validation, key refused); exercised in the browser, see below |
| 4 | **View filters in the address**: Alerts `tab` and `severity`, Logs `q`, `kind`, `outcome`, `task`, through a new `useViewParam` hook that reads on mount, writes on change (defaults left out) and clears on unmount | 3 hook tests; a `#/logs?q=…&outcome=failed` link and `#/alerts?tab=resolved` opened filtered in the browser |
| 5 | **Plate panels**: `Panel variant="plate"` (plate label over a sleeper rule) on the Overview's timeline, risk breakdown, root causes and open alerts, closing the last open review item | Screenshots at 1440 and 390 px |

Python suite: **257 passed, 2 skipped**. Lint and format clean.

### Verification run

A fresh agent ran a written playbook against a throwaway database on port
8010 and reported pass or fail per step with evidence. Its scripts drove
headless Chrome over the DevTools Protocol.

| Check | Result |
| --- | --- |
| `ruff check`, `ruff format --check`, bandit | Clean. Bandit notes that the eight `# nosec` comments in `driftguard/policy.py` no longer suppress anything. |
| pip-audit | 17 advisories in three transitive packages of the local environment (certifi, filelock, opentelemetry-api), none in the project's own dependencies. The local environment was upgraded and is clean; CI installs fresh and gets the fixed versions. |
| Python suite | 257 passed, 2 skipped |
| `npm run lint`, `npm test`, `npm run build` | Pass; 36 tests at the time of the run, 38 after the fixes below |
| Server on a throwaway SQLite file; account registered once; `seed_showcase.py` and `live_demo.py --no-pause` | Seeder: 421 telemetry events, 30 agent events, 8 tasks, 5 alerts. Live demo: drift alert raised, `fix-login-bug` blocked then recovered, its agent alert resolved itself. |
| Bulk endpoint through the API | Two of three resolved in one call, a foreign id reported as missing, an empty list is 422, an API key is 401, `policy/defaults` is 200 |
| Browser, 1440 px: Overview, Agent Diagnosis, Logs opened from `#/logs?q=…&outcome=failed`, Alerts bulk resolve of two (confirmed through the API), `#/alerts?tab=resolved` on a fresh load, the `?` sheet, Policy | Pass. Zero console errors, zero failed requests, no rate limiting. The plate labels render on the four lower Overview panels. |
| Browser, 390 px: Overview and Alerts | No horizontal scroll |

**Found and fixed afterwards:** a view's filters were read from the address only
when the view mounted, so back and forward (or editing the address) left the
screen behind; and the sidebar's link targets carried a Logs search into other
views' links. Both have tests now, and the browser-run commit is before the fix,
so the fix was checked with the unit tests and the build only.

**Seen once, cause unknown:** in one of three bulk-resolve runs the Open list
and the badge kept the two resolved alerts for at least 3 seconds after the
success notification, although the API had them resolved; the other two runs
refreshed within a second. Reloading shows the right list.

**Cosmetic, left as is:** at 1440 px the header wraps to two rows on views with
a vertical scrollbar; a tool failure rate past the gauge's 25% end is labelled
"off scale"; on a phone each alert row stacks its checkbox, lamp and button on
their own lines. The asyncio `ConnectionResetError` the server logs when a
browser drops a connection mid-reload is Windows noise, not DriftGuard.

### Demo

`demo.bat` and `docs/demo.md` are unchanged. The deck is linked under
"Slides" in [demo.md](demo.md). The Overview screenshot in `docs/images/` was
retaken from the verification run (account `verify@driftguard.local`).

## What still needs to be done

### Before merging (owner decisions or quick tasks)
1. **Merge the pending branch.** `feature/signal-box-redesign` carries the
   setup guide, the redesign and both rounds of follow-ups. PR #11 (https://github.com/Sean-Pereira-945/DriftGuard/pull/11) is open against `main`.
   Review the screenshots in `docs/images/` and the Actions run before merging.
2. **Repo name.** Done: the GitHub repo is now `DriftGuard`. The clone commands in
   `SETUP.md` and `docs/quickstart.md`, and the URLs in `pyproject.toml`, use the
   new name. GitHub redirects the old `tokepi` address.
3. **LICENSE.** An MIT `LICENSE` file was added to match what `pyproject.toml`
   already declared. Confirm that's the licence you want.
4. **PyPI trusted publishing.** Set up the `pypi` environment in GitHub before
   tagging `v0.4.0`.
5. **Your local `.env` needs a decision.**
   - **Database:** its `DATABASE_URL` points at a remote PostgreSQL database.
     The first 0.4 start migrates that database in place: it adds columns and
     replaces plaintext API keys with hashes, which can't be undone. Back it up
     before pointing 0.4 at it, or keep using a local SQLite file for
     development.
   - **Variable names:** it uses `API_SECRET` and `RATE_LIMIT_PER_MINUTE`. Those
     still work but log deprecation warnings. Rename them to
     `DRIFTGUARD_SECRET_KEY` and `DRIFTGUARD_RATE_LIMIT_PER_MINUTE`.

## Running it locally right now

Double-click `demo.bat`, or start the server by hand against the local
database `driftguard-local.db` (gitignored), overriding the `.env` database:

```bash
DATABASE_URL=sqlite:///./driftguard-local.db .venv/Scripts/driftguard-server.exe --port 8000
```

It was seeded with demo data: 40 telemetry events, and three agent tasks (one
blocked, one recovered, one healthy). Sign in with `demo@driftguard.local` /
`driftguard-demo`. These credentials are for this local file only; delete the
file to start clean.

### Giving a demo
On Windows, double-click `demo.bat`: it starts the server, opens the dashboard
and runs the script. Or run it by hand:
Run `python examples/live_demo.py --email demo@driftguard.local --password driftguard-demo`
against the running server and select the **Live Demo** project. The full
walkthrough and talking points are in [demo.md](demo.md).

### Next for the dashboard (from the redesign review)
1. **Look at it with real data.** Run it against your own project and a task that
   uses several tools, and confirm the track and the instruments read well.
2. **Exercise the remaining controls in a browser.** Arrow-key tabs and the New
   alert form with a keyboard only, and a screen reader pass. Bulk resolve was
   exercised in round 2.
3. **Re-run `/impeccable critique`** on `frontend/src` to see the score move from
   25, and use `/impeccable polish` for the finishing pass.
4. **Update Impeccable** from v4.4.0 to v4.7.0 with `npx impeccable update`.
5. **Retake the screenshots** in `docs/images/` after any visual change.

### Open request
- **Role-based agents** (critic, designer and developer, each with restricted
  tools, coordinating on changes). Not started: the first step was cancelled.
  Waiting on whether you want it.

### Small follow-ups found during the work
- The frontend's pure logic under `src/lib/` has unit tests; the views still
  rely on the type check, the build and browser runs.
- The Policy preview counts only the events already loaded (up to 500) for the
  current filters. It doesn't replay stored history on the server.
- Policy has **Restore defaults** (it loads the defaults for you to review and save).
  There is still no one-step reset on the server: restoring is a `PUT` of the
  values from `GET /projects/{id}/policy/defaults`.
- The open-alerts badge counts only alerts inside the current time and
  environment filter; there's no unfiltered count endpoint.
- The test client prints a Starlette deprecation warning about `httpx`. It's
  harmless.
- Password reset and email verification need an email provider.

### Next features (from [roadmap.md](roadmap.md))
- Standalone MCP gateway, so closed agents that support MCP can be observed
- LangChain/LangGraph, OpenAI Agents SDK, and Claude Agent SDK adapters; a JS/TS SDK
- Trace waterfall view, per-project notification settings, latency metric,
  cost from provider pricing
- Teams and roles, Alembic migrations, secret-store integration, Helm chart,
  OpenTelemetry export
