---
name: DriftGuard
description: A signal-box panel for on-call developers: agent tasks drawn as a track diagram, the blocking tool held at red.
colors:
  enamel: "#0c1412"
  enamel-sidebar: "#09100e"
  enamel-panel: "#111c19"
  enamel-raised: "#182621"
  enamel-input: "#0a110f"
  hairline: "#243630"
  hairline-strong: "#355046"
  hairline-hover: "#4a6a5d"
  ink: "#f3eedd"
  body: "#dad5c1"
  muted: "#a3afa6"
  faint: "#839189"
  route: "#ece4c6"
  lamp-red: "#ff6350"
  lamp-amber: "#f4b63f"
  lamp-green: "#3fcb84"
  steel: "#8db9d1"
  violet: "#b7a5e9"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "52px"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "normal"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "38px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "0.01em"
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "0.01em"
  body:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Barlow Condensed, Arial Narrow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.08em"
  data:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  lamp: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.route}"
    textColor: "{colors.enamel}"
    rounded: "{rounded.sm}"
    height: "40px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "#ffffff"
  button-secondary:
    backgroundColor: "{colors.enamel-panel}"
    textColor: "{colors.body}"
    rounded: "{rounded.sm}"
    height: "40px"
    padding: "0 14px"
  button-secondary-hover:
    backgroundColor: "{colors.enamel-raised}"
  button-danger:
    textColor: "{colors.lamp-red}"
    rounded: "{rounded.sm}"
    height: "40px"
    padding: "0 14px"
  button-ghost:
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    height: "40px"
    padding: "0 14px"
  panel:
    backgroundColor: "{colors.enamel-panel}"
    rounded: "{rounded.md}"
    padding: "20px"
  input:
    backgroundColor: "{colors.enamel-input}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 12px"
  badge:
    textColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    height: "24px"
    padding: "0 8px"
  nav-item-active:
    backgroundColor: "{colors.enamel-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "40px"
    padding: "0 12px"
  lamp:
    backgroundColor: "{colors.lamp-red}"
    rounded: "{rounded.lamp}"
    size: "16px"
---

# Design System: DriftGuard

## Overview

**Creative North Star: "The Signal Box Panel"**

DriftGuard is drawn as the illuminated track diagram in a railway signal box. Each agent task is a train on a line, tools are block sections, and the tool that holds the line is the section lit red. Drift is distance from a baseline, drawn as a gauge with the floor engraved on it. The surface is a dark green-black enamel panel with ivory engraved lettering and hairline rules, never pure black and never a grid of equal KPI cards.

Colour is quarantined. A healthy view is ink on enamel; the lamp colours (red, amber, green) appear only where state deviates, and always as a lit lamp with an icon and a word. Density is that of an operator's desk: compact, ruled, legible at a glance, with poster-scale condensed figures for the numbers that matter.

**Key Characteristics:**
- Enamel panel surfaces separated by 1px hairline rules, not by shadow or fill contrast.
- Ivory "route" colour carries selection, the primary action, focus and the lit track.
- Lamps, never decorative colour, carry state; state is never colour alone (icon, word, hatch).
- Engraved plate labels (condensed, uppercase, open tracking) name every instrument.
- Instruments sit in one ruled strip, not in separate cards.

## Colors

A near-monochrome green-black enamel and ivory palette with three lamp colours held in reserve.

### Primary
- **Route Ivory** (#ece4c6): the lit route. Primary button fill, active nav marker, focus outline, caret, checkbox accent, healthy track section and gauge marker.

### Secondary
- **Lamp Red** (#ff6350): critical state and the blocking section only: lamps, danger buttons, error text, the hatched "past the floor" band.
- **Lamp Amber** (#f4b63f): warning state only.
- **Lamp Green** (#3fcb84): stable or live state only (including the live-connection pulse).

### Tertiary
- **Steel** (#8db9d1) and **Signal Violet** (#b7a5e9): categorical badge tones and chart series for non-state information. Used sparingly.

### Neutral
- **Enamel** (#0c1412): page canvas. **Enamel Sidebar** (#09100e): the darker nav rail. **Enamel Panel** (#111c19): every panel surface. **Enamel Raised** (#182621): active nav, tooltips, toasts, select options. **Enamel Input** (#0a110f): inset field wells.
- **Hairline** (#243630), **Hairline Strong** (#355046), **Hairline Hover** (#4a6a5d): panel rules, control borders, hover borders.
- **Ink** (#f3eedd): headings and key figures. **Body** (#dad5c1): running text. **Muted** (#a3afa6): secondary text and plate labels. **Faint** (#839189): placeholders, disabled nav, idle lamp.

### Named Rules
**The Quarantine Rule.** Lamp red, amber and green mean a state. They never decorate, and a healthy screen has none of them lit.
**The Never-Colour-Alone Rule.** Every lamp state is also written in words with an icon, and out-of-limit spans are hatched.

## Typography

**Display Font:** Barlow Condensed (with Arial Narrow, system sans)
**Body Font:** Barlow (with system sans)
**Label/Mono Font:** JetBrains Mono for data; plate labels use Barlow Condensed.

**Character:** Condensed engraved signage over a humanist grotesque, with monospace for every identifier, count and error string, so data reads as instrument output.

### Hierarchy
- **Display** (600, 52px, 1.05): instrument figures in Barlow Condensed, tabular numerals.
- **Headline** (700, 38px, 1.15): page titles (h1).
- **Title** (600, 22px, 1.15): panel headings (h2); track-diagram failure counts use 20px.
- **Body** (400, 15px, 1.5): running text; secondary 14px and 13px help text in Muted.
- **Label** (600, 13px, 0.08em, uppercase): the `plate-label` for metric names and field groups.
- **Data** (JetBrains Mono 12-15px): task ids, tool names, errors, mono inputs.

### Named Rules
**The Engraved Label Rule.** Names of instruments and field groups are plate labels: condensed, uppercase, 0.08em tracking, Muted. Nothing else is set that way.
**The Tabular Rule.** Every number that changes is set with tabular numerals.

## Layout

A fixed 248px sidebar rail at large widths (an off-canvas drawer below `lg`), beside a main column capped at 1600px with 16/24/32px side gutters by breakpoint and 24/32px vertical padding. The first viewport reads top to bottom: a wide status plate, a track diagram of the most urgent task, one four-cell instrument strip, then collapsed detail. Instrument strips split into 2 columns at `sm` and 4 (or 3) at `lg`, divided by hairline rules. Spacing follows a 4px base: 8px and 12px gaps inside controls, 16px and 20px panel padding, 24px between page header and content. Track sections run at least 220px wide and scroll horizontally in a focusable region.

## Elevation & Depth

Flat by default. Depth is tonal and ruled: canvas, then panel, then raised, each edged by a hairline. Shadows appear only for things that float above the panel: tooltips and toasts (`shadow-xl` at 60% black), modals and the slide-over (`shadow-2xl` black), over a 70% black scrim. State glow is the lamp's own light: a critical lamp glows once (`box-shadow: 0 0 14px 2px rgb(255 99 80 / 0.55)` over 1.6s), and the live indicator pulses green on a 2s loop.

### Named Rules
**The Flat Plate Rule.** Resting panels carry no shadow. If it is not floating, it is ruled, not lifted.

## Shapes

Small, machined corners: 4px (`rounded-sm`) on buttons, badges, nav items and tabs; 6px (`rounded-md`) on panels, inputs and tooltips; 8px (`rounded-lg`) only on mobile sheet tops. Lamps are full circles with a 2px black ring. Gauge markers are 11px diamonds (a rotated square). The sleeper rule (1px ticks every 10px, Hairline Strong) and the red diagonal hatch (135deg, 2px on 4px off) are the two recurring textures.

## Components

### Buttons
- **Shape:** 4px corners, 1px border, 40px tall (32px small).
- **Primary:** Route Ivory fill, Enamel text, semibold; hover turns white.
- **Secondary:** Enamel Panel fill, Body text, Hairline Strong border; hover raises to Enamel Raised.
- **Danger:** Lamp Red text on 10% red, 50% red border. **Ghost:** Muted text, transparent; hover Ink on 5% white.
- **Focus:** 2px Route outline, 2px offset. Busy buttons show a spinner and `aria-busy`. Transition 150ms.

### Panels / Containers
- **Corner Style:** 6px. **Background:** Enamel Panel with a 1px Hairline border. **Header:** title in Title style, hairline underline, actions at right. **Padding:** 16px (20px from `sm`). Enter with a 200ms 4px rise.

### Inputs / Fields
- **Style:** Enamel Input well, Hairline Strong border, 6px corners, 40px tall, Ink text, Faint placeholder; labels 13px semibold Body above, help 13px Muted below.
- **Focus:** border turns Route plus a 2px Route outline. **Error:** border Lamp Red at 70%, message in Lamp Red. **Disabled:** 60% opacity.

### Navigation
- Grouped list in the Enamel Sidebar rail, 40px items, 15px medium, Muted. Active item sits on Enamel Raised with Ink text and a 4px Route bar on its left edge. Alert counts are small mono badges, red when any is critical, otherwise amber. Disabled items go Faint.

### Badges
- 24px tall, 4px corners, 13px semibold, 1px border and a 10% tint of the tone with an optional 14px icon. Tones: green, amber, red, route, steel, violet, neutral.

### Lamp
- A lit circle in three sizes (10, 16, 28px) with a 2px black ring. Red, amber, green or Faint for idle. Decorative: the state is always written beside it.

### Track Diagram (signature)
- A figure per task: tool block sections in first-used order, each an 8px Route bar over a sleeper rule, a flag post above the blocking one, the tool name in mono, and the failure count in Lamp Red condensed type. The blocking section's bar is Lamp Red. A Hairline Strong stub continues the line past the last section.

### Baseline Gauge and Instrument Strip (signature)
- A 1px track with engraved ticks (Body, with Muted labels) for the policy floor or limits, an 11px diamond marker for the reading (Route, amber or red by tone), and a red hatched band over the span past the floor. Instruments pair a plate label, a 52px condensed figure, the gauge and a Muted note, inside one ruled strip.

## Do's and Don'ts

### Do:
- **Do** keep healthy views as Ink and Route on Enamel, and let lamp colour appear only where state deviates.
- **Do** pair every lamp or red/amber/green tone with an icon and a word.
- **Do** separate surfaces with 1px Hairline rules and tonal steps (canvas, panel, raised).
- **Do** set instrument names as plate labels and large readings as condensed tabular figures.
- **Do** keep a visible 2px Route focus outline and honour `prefers-reduced-motion`.
- **Do** set identifiers, tool names and error strings in JetBrains Mono.

### Don't:
- **Don't** build a grid of equal KPI cards over a dark console; group readings in a ruled instrument strip.
- **Don't** use pure black, or lamp colours as decoration or chart fill for non-state data.
- **Don't** convey state by colour alone.
- **Don't** add resting shadows to panels, or corners larger than 8px.
- **Don't** introduce another accent beside Route Ivory for actions.
