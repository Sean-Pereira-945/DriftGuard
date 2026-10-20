---
version: 1
slug: "frontend-src-app-tsx"
primary_target: "frontend/src/App.tsx"
related_targets: []
---

# Surface brief: DriftGuard dashboard

Scope: the whole authenticated dashboard (frontend/src). Mode: Operate. Replacement of the incumbent graphite-console look, per the owner's "go bolder overall".

Audience and task: a developer on-call watching agents and LLM apps; finds what is blocked, why, and what to do. Constraints: honest-boundary wording, existing term set, accessibility groundwork preserved (PRODUCT.md).

Chosen direction: Signal Box Panel (railway illuminated track diagram). Memorable moment: the current task drawn as a track with its blocking tool held at a red signal.

Unresolved: none.

## Direction contract

THESIS: Every agent task is a train on a track diagram and the blocking tool is the section held at red. Drift is distance from a baseline, drawn as a gauge with the floor engraved on it. Refuses the grid of equal KPI cards over a dark console.

OWN-WORLD: Dark green-black enamel panel (not pure black), ivory engraved lettering, hairline track rules. Colour is quarantined: healthy views are ink on enamel, and lamp colours (red, amber, green) appear only where state deviates, as lit lamps with icon and text. Barlow for text, Barlow Condensed for plate labels and poster-scale figures, JetBrains Mono for data. Components are rebuilt as plates, lamps, gauges and block sections.

STORY: The visitor sees in one glance whether the line is clear or blocked, which tool holds it, how many tokens were wasted, and the recommended action. Then they check four instruments against their floors, and only then the detail.

FIRST VIEWPORT: A wide status plate across the top: a large lamp and state word at left, the diagnosis sentence and recommendation beside it, the open-diagnosis action at right. Directly beneath, a track diagram of the most urgent task, tools as block sections in first-used order, the blocking section lit red with its failure count. Below that, one instrument strip of four cells with baseline gauges. The remaining metrics sit in a collapsed list.

FORM: Railway signal-box track diagram, position 4 of 7 on my ordered list, seed key a3ed5276.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
