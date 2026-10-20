# Design System: DriftGuard

**Project:** DriftGuard
**Purpose:** An observability console for monitoring LLM quality, detecting prompt and retrieval drift, diagnosing failed agent tools, and reducing wasted tokens.
**Implementation:** `frontend/` (React + Tailwind). Tokens live in `frontend/src/index.css`. The product context is in [PRODUCT.md](../PRODUCT.md).

## 1. The idea: a signal box panel

DriftGuard looks like a railway signal box's illuminated track diagram. Every agent task is a train on a track. The tool that blocks it is the section held at a red signal. Drift is distance from a baseline, so the baseline is engraved on every instrument and every chart.

Three rules follow from that.

- **Colour is quarantined.** A healthy screen is ivory ink on dark enamel. Lamp colours (red, amber, green) appear only where something deviates, and always with an icon and a word. If the whole page is lit, nothing stands out.
- **Show the baseline.** A reading is drawn against its policy floor or limit, so "how far from normal" is visible without reading a number.
- **Plates, not cards.** Labels read like engraved plates. Instruments sit in one strip divided by rules instead of a grid of identical boxes.

The room it is for: a developer at a second monitor, often late, glancing to learn whether the line is clear. That is why the canvas is dark, and why the first thing on the page is one lamp and one word.

The UI represents real product capabilities. Do not imply that DriftGuard observes private Copilot sessions or silently changes model providers. Use precise language such as "normalized telemetry," "agent event," "blocking tool," "wasted tokens," and "recommendation."

## 2. Colour

### Surfaces (true black, panels lifted a shade)

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#000000` | Page background |
| `sidebar` | `#030504` | Navigation rail |
| `panel` | `#080d0b` | Panels, tables, drawers |
| `raised` | `#101915` | Selected rows, hovered surfaces |
| `input` | `#040706` | Selects, inputs, code blocks |
| `hairline` / `hairline-strong` | `#1e2d27` / `#324a40` | Rules and borders |

### Text

| Token | Value | Use |
| --- | --- | --- |
| `ink` | `#fffbea` | Titles, primary values (warm ivory) |
| `body` | `#e4dec8` | Body copy |
| `muted` | `#aebab1` | Supporting text |
| `faint` | `#8a988f` | Placeholders and disabled text |

Muted and faint text keep at least 4.5:1 against the panel and canvas.

### The route and the lamps

- **Route ivory (`#fff2b8`):** The lit track. Used for the primary action, the current selection, focus rings, links, and the main chart series. It is not a status colour.
- **Critical (`#ff5a47`):** Blocked tasks, critical alerts, failed tools. Critical lamps glow slowly.
- **Warning (`#ffc83d`):** Degraded readings and warning alerts.
- **Stable (`#34e89a`):** Healthy state and the retrieval series.
- **Steel (`#86d4ff`):** Recovered tasks.
- **Violet (`#c4b2ff`):** The second score series on charts only.

Pair every lamp colour with text, an icon, or a pattern. Past-the-baseline spans are hatched, so they read without colour.

## 3. Typography

- **Barlow** (400–700): interface and body text, 15px base.
- **Barlow Condensed** (500–700): page and panel titles, the status word, and large figures. Plate labels use it in uppercase with 0.08em tracking. Condensed numerals carry the hierarchy: a figure is set at 40–52px on an instrument.
- **JetBrains Mono** (400–700): task IDs, tool names, token counts, timestamps, API keys, code, and chart axes. Use it for data and code, not as decoration.
- Page titles are 38px, panel titles 22px. Table and helper text are 13–14px. Nothing is set below 12px.

## 4. Components

### Status plate

The top of the Overview. A lamp and one word (`Critical`, `Warning`, `Stable`, `No data`) at the left, the reason in one sentence beside it, and one button at the right. The most urgent task's track sits beneath, divided by a rule.

### Track diagram

A task drawn as a track. Each tool is a block section: a 6px rail, a row of sleepers, the tool name in mono. The blocking section is lit red under a red signal lamp and says how many failures in a row. The track continues past the last section in a dim rail. Sections are listed in the order the tools were first used.

### Instrument strip and baseline gauge

Four readings in one panel, separated by hairlines, not four cards. A gauge is a track with a tick at each policy limit, a hatched span past the baseline, and a diamond marker for the reading. The marker is ivory when fine, amber or red when it breaches. Each gauge has a plain-language `aria-label`. Less important readings sit in a collapsed **All readings** list.

### Buttons

Square-ish corners (4px), 40px minimum height. The primary action is a push-button in ivory with dark text. Secondary actions use panel surfaces with a hairline. Icon-only buttons need an accessible label and tooltip.

### Navigation

Fixed 248px rail. Items are grouped by a rule into **Monitor** (Overview, Agent Diagnosis, Logs, Events, Alerts, Analytics) and **Configure** (Policy, SDK Integration, Project Settings). The active item has a raised surface and an ivory marker. The alert count is a small plate, amber or red, whose screen-reader text says whether any alert is critical. Disabled items stay readable and say why in a tooltip. On mobile the rail collapses into a labeled menu.

### Filters

The header names its filters in text, **Env** and **Range**, beside the selects. **Reset filters** appears when either differs from the default. Filters live in the address bar so any view can be shared.

### Charts

Series: ivory for prompt tokens, green for retrieval, violet (dashed) for quality. Dashed lines mark the policy limit and both floors, and the span under the lower floor is hatched. Every chart keeps an HTML legend and offers its data as a table.

### Tables

Dark panel surface, hairline rows, sticky plate-label headers, mono right-aligned numerals. Status cells always carry an icon and a word. Rows open a drawer from the keyboard.

### Alerts

A lamp, severity badge, source badge, age, message, and tokens at stake. Rows carry a checkbox for bulk **Resolve** and **Reopen**. Resolved alerts show a dim lamp.

### Inputs and policy controls

Labels are visible. Errors appear after a field is left, or on save. Each policy field says what it flags in the loaded data, and the save bar summarises every change and warns when coverage drops.

### Overlays

Drawers for detail so list context survives. Modals only for focused actions, such as creating a project or the shortcut list. A near-black scrim, a panel surface, 6px corners, and a visible close button.

## 5. Layout

- Fixed desktop sidebar, main content capped near 1600px.
- The Overview reads in this order: status plate and track, instrument strip, all readings, charts, root causes and alerts. Below tablet width it stacks to one column.
- Use an 8px rhythm: 16–20px panel padding, 24px between sections.
- Keep filters in the global header, where they are always reachable.
- Charts, instruments, tables and nav rows have stable dimensions, so live data doesn't shift the page.
- Tables scroll horizontally on narrow screens. Refresh, Test Telemetry and the filters stay reachable on mobile.
- There is no decorative background. The page is plain enamel; the only patterns are sleepers on a track and the hatch that marks a breach.

## 6. Motion

Motion conveys state. Transitions are 150–200ms with an exponential ease-out. Panels rise a few pixels on load. The one ambient motion is a critical lamp glowing slowly, and the live-connection pulse. Everything stops under `prefers-reduced-motion`.

## 7. Accessibility and state

- Visible 2px ivory focus ring on every control.
- Severity is never colour alone: lamp, icon, and word. Past-baseline spans are hatched.
- Skip link, semantic headings, landmarks, live regions for refresh, and accessible names for icon-only controls. Gauges and the track expose text equivalents.
- Alerts tabs use arrow keys, Home and End. Rows open from the keyboard. Single-key shortcuts are documented under `?`, and are off while typing.
- Filters and selections can be reached without a pointer, and chart data is available as a table.
- Define loading, empty, error, stale and success states for every data view. Missing values read "Not reported by this source", never zero.

## 8. Product language

Use concise, factual language:

- "Operational Overview"
- "Telemetry & Drift Timeline"
- "Drift Risk Breakdown"
- "Open Alerts"
- "Agent Task Diagnosis"
- "Blocking tool"
- "Wasted tokens"
- "Tokens at stake" (an estimate over open alerts, distinct from wasted tokens)
- "Recommendation"
- "Test Telemetry"
- "SDK Integration"

Avoid marketing phrases and claims that DriftGuard intercepts private agent sessions.
