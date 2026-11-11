# Using the dashboard

A task-oriented guide to operating the DriftGuard dashboard: how to get in, find
your way around, and answer the questions you'll actually have. For a reference
that documents **every** view, card and column, see the
[Dashboard guide](dashboard.md). To get data flowing in the first place, see
[Using the package](package-usage.md).

## Open it and sign in

The dashboard is the web UI of a running server — there's nothing separate to
install. Open the server's address (http://127.0.0.1:8000 locally), then:

1. **Create an account** (or sign in). Each account sees only its own projects.
2. **Create a project** with the **+** next to the project picker. Its API key is
   shown **once** — copy it; your app uses it to send data.
3. Pick the project in the header. Empty views tell you how to start sending
   data; once the SDK syncs, they fill in.

## The header: set your scope

Everything on screen is filtered by the header controls:

| Control | What it does |
| --- | --- |
| **Project** | The application you're looking at. |
| **Env** | `All`, `prod`, `staging`, `dev` or `test`. |
| **Range** | 15 minutes to 30 days, or all. Default: last 24 hours. |
| **Live** | The realtime connection. While live, new alerts and activity appear without a refresh, and a new critical alert pops up. |
| **Refresh** | Reloads every view. |
| **Test Telemetry** | Sends one event with the metrics you type (tokens, scores, latency) and shows how the server scored it — handy for trying thresholds. |

The project and filters are remembered in your browser and carried in the
address, so a link reproduces the same view.

## Answering the questions you'll have

| You want to know… | Go to | What to look at |
| --- | --- | --- |
| **Is anything wrong right now?** | **Overview** | The status plate — one lamp and one word (`Critical`/`Warning`/`Stable`). Below it, the most urgent stuck task and the instruments (risk, response quality, latency, tool-failure rate) drawn against your policy floors. A reading past its floor is amber or red. |
| **Which tool is my agent stuck on, and why?** | **Agent Diagnosis** | The blocked task, the tool holding it, how many times it failed in a row, the tokens wasted, and each attempt on a timeline. Open a task for the attempt-by-attempt drawer. |
| **What needs my attention?** | **Alerts** | Open, Resolved and All tabs. Drift alerts carry a root cause and a fix; agent alerts carry the wasted tokens and **resolve themselves** when the task recovers. Select several to resolve or reopen in one go. |
| **How was one call scored?** | **Events** | Each telemetry event with its metrics, severity and the recommended mitigation. **Analytics** shows the same data as trends, with a "worse than usual" comparison to the previous period. |
| **What exactly did my agents do?** | **Logs** | The full history, newest first. Search, and filter by kind (tool call, prompt, response) and outcome. "Show only this task" narrows to one run. Export to CSV or JSON. |
| **What counts as too much / too low?** | **Policy** | The thresholds: token and context limits, retrieval and quality floors, the latency limit, and the agent block threshold. Each field previews how many loaded events it would flag before you save. **Restore defaults** brings back the starting thresholds. |

## Reading a drift or agent alert

An alert tells you three things: **how bad** (a lamp and severity), **what** (the
source — `drift`, `agent`, or `manual` — and a one-line cause), and **the cost**
(tokens at stake). For a drift alert that's the tokens a mitigation would save;
for an agent alert it's the tokens already wasted on the blocked task. Resolving
or reopening applies for everyone on the project.

## Moving around quickly

- Press **`?`** anywhere for the keyboard shortcuts. **`g`** then a letter jumps
  between views (`g o` Overview, `g d` Agent Diagnosis, `g a` Alerts, …), **`/`**
  focuses search, **`r`** refreshes.
- **Copy the address bar** to send someone the same view with the same project
  and filters — for example `#/logs?q=run_tests&outcome=failed` opens Logs
  already filtered.
- **Reset filters** appears whenever a filter isn't at its default.

## One rule to trust the numbers

Every number on the dashboard comes from the API — nothing is estimated or
filled in by the browser. A missing value shows as **—**, and a score a source
never sends (Claude Code has no retrieval step) is left off rather than shown as
zero.

## Next

- [Dashboard guide](dashboard.md) — the full reference for every view.
- [How DriftGuard works](concepts.md) — the scoring and diagnosis behind the numbers.
- [Giving a demo](demo.md) — a five-minute walkthrough script.
