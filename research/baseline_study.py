"""How well do fixed floors and the baseline comparison detect a drop in quality?

The product has two ways to say "response quality has a problem":

* a **floor**: the window's mean is below a fixed line (default 0.80), and
* the **baseline comparison** (``driftguard.baseline``): the window's mean is
  meaningfully lower than the period before it (a Welch z-test, at least 3
  standard errors and at least 0.05, with at least 10 events on each side).

This module measures both on synthetic streams where the truth is known, so the
rules' strengths and weak spots are numbers, not opinions. Everything is seeded,
so a run is reproducible.

Assumptions, stated plainly: per-event quality is normally distributed around a
mean, clipped to [0, 1], events are independent, and the spread is the same in
both periods. Real traffic is messier. The sensitivity table varies the spread.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import numpy as np

from driftguard.baseline import MIN_SAMPLE, compare

METRIC = "response_quality"
DEFAULT_FLOOR = 0.80
DEFAULT_SD = 0.08
SAMPLE_SIZES = (5, 10, 30, 100)


@dataclass(frozen=True)
class Scenario:
    """A baseline mean, a current mean, and whether a meaningful drop really happened."""

    name: str
    baseline_mean: float
    current_mean: float
    drifted: bool
    note: str


SCENARIOS = (
    Scenario("steady_healthy", 0.92, 0.92, False, "Nothing changed, well above the floor."),
    Scenario("steady_low", 0.70, 0.70, False, "Nothing changed, but this project always sits under the floor."),
    Scenario("small_dip", 0.92, 0.89, False, "A 0.03 dip: real but too small to matter."),
    Scenario("hidden_decline", 0.95, 0.86, True, "A 0.09 drop that never crosses the floor."),
    Scenario("large_drop", 0.92, 0.65, True, "A 0.27 drop that crosses the floor."),
    Scenario("improvement", 0.70, 0.90, False, "Quality rose. A drop detector should stay quiet."),
)


def _draw(rng: np.random.Generator, mean: float, sd: float, n: int) -> np.ndarray:
    return np.clip(rng.normal(mean, sd, n), 0.0, 1.0)


def _stats(values: np.ndarray) -> dict[str, Any]:
    """The shape ``driftguard.baseline.compare`` takes: count, mean, mean of squares."""
    if values.size == 0:
        return {"n": 0, "mean": None, "mean_sq": None}
    return {"n": int(values.size), "mean": float(values.mean()), "mean_sq": float(np.mean(values * values))}


def floor_flags(current: np.ndarray, floor: float = DEFAULT_FLOOR) -> bool:
    """The floor rule: the window's mean is below the line."""
    return bool(current.size > 0 and current.mean() < floor)


def baseline_status(current: np.ndarray, baseline: np.ndarray) -> str:
    """The product's comparison, applied to two windows of readings."""
    return str(compare(METRIC, _stats(current), _stats(baseline))["status"])


def single_window_study(
    trials: int = 2000, sd: float = DEFAULT_SD, floor: float = DEFAULT_FLOOR, seed: int = 7
) -> list[dict[str, Any]]:
    """One decision per trial: a baseline window and a current window of ``n`` events each."""
    rng = np.random.default_rng(seed)
    rows: list[dict[str, Any]] = []
    for scenario in SCENARIOS:
        for n in SAMPLE_SIZES:
            floor_hits = worse = insufficient = 0
            for _ in range(trials):
                baseline = _draw(rng, scenario.baseline_mean, sd, n)
                current = _draw(rng, scenario.current_mean, sd, n)
                floor_hits += floor_flags(current, floor)
                status = baseline_status(current, baseline)
                worse += status == "worse"
                insufficient += status == "insufficient"
            rows.append(
                {
                    "scenario": scenario.name,
                    "drifted": scenario.drifted,
                    "n": n,
                    "floor_flag_rate": floor_hits / trials,
                    "baseline_flag_rate": worse / trials,
                    "baseline_insufficient_rate": insufficient / trials,
                }
            )
    return rows


def sensitivity_study(trials: int = 1000, n: int = 30, seed: int = 11) -> list[dict[str, Any]]:
    """The same decision at one sample size, for different amounts of spread."""
    rows: list[dict[str, Any]] = []
    for sd in (0.05, 0.08, 0.15):
        for row in single_window_study(trials=trials, sd=sd, seed=seed):
            if row["n"] == n:
                rows.append({**row, "sd": sd})
    return rows


def streaming_study(
    trials: int = 300,
    window: int = 30,
    length: int = 400,
    onset: int = 200,
    sd: float = DEFAULT_SD,
    base: float = 0.92,
    drops: tuple[float, ...] = (0.0, 0.05, 0.10, 0.20, 0.30),
    consecutive: tuple[int, ...] = (1, 3, 5),
    seed: int = 23,
) -> list[dict[str, Any]]:
    """A stream where quality drops at ``onset``, checked after every event.

    Each check compares the latest ``window`` events with the ``window`` before
    them. An alarm needs ``k`` checks in a row to say "worse". Reported per drop
    and per ``k``:

    * ``false_alarm_trials``: share of streams that alarmed before the drop;
    * ``detected``: share of streams that alarmed after the drop;
    * ``median_delay``: median events from the drop to the alarm, among detected.
    """
    rng = np.random.default_rng(seed)
    rows: list[dict[str, Any]] = []
    for drop in drops:
        # Pre-compute the status at every step for each trial once, then apply each k.
        per_trial: list[list[bool]] = []
        for _ in range(trials):
            values = np.concatenate([_draw(rng, base, sd, onset), _draw(rng, base - drop, sd, length - onset)])
            flags = [False] * length
            for i in range(2 * window, length + 1):
                current = values[i - window : i]
                before = values[i - 2 * window : i - window]
                flags[i - 1] = baseline_status(current, before) == "worse"
            per_trial.append(flags)
        for k in consecutive:
            false_alarms = detected = 0
            delays: list[int] = []
            for flags in per_trial:
                run = 0
                first_pre = first_post = None
                for i, flagged in enumerate(flags):
                    run = run + 1 if flagged else 0
                    if run >= k:
                        if i < onset and first_pre is None:
                            first_pre = i
                        if i >= onset and first_post is None:
                            first_post = i
                false_alarms += first_pre is not None
                if first_post is not None:
                    detected += 1
                    delays.append(first_post - onset)
            rows.append(
                {
                    "drop": drop,
                    "k": k,
                    "false_alarm_trials": false_alarms / trials,
                    "detected": detected / trials,
                    "median_delay": float(np.median(delays)) if delays else None,
                }
            )
    return rows


def gradual_study(
    trials: int = 200,
    window: int = 30,
    onset: int = 200,
    total_drop: float = 0.30,
    ramp_lengths: tuple[int, ...] = (50, 100, 200, 400, 800, 1600),
    sd: float = DEFAULT_SD,
    base: float = 0.92,
    floor: float = DEFAULT_FLOOR,
    seed: int = 31,
) -> list[dict[str, Any]]:
    """A slow decline: quality falls by ``total_drop`` evenly over ``ramp_length`` events.

    The baseline comparison looks at two adjacent windows, so it sees only how much
    quality fell **within one window's length**. A slow ramp can fall too little per
    window to count, however far it goes in total. The floor has no such blind spot,
    because it compares with a fixed line. Reported per ramp: how often each rule
    alarmed by the end of the ramp, and the median events from the start of the ramp.
    A control run with no decline over the same duration gives the baseline rule's
    false-alarm rate, because a rule checked at every event for hundreds of events
    will eventually fire on noise, and that must not be counted as detection.
    """
    rng = np.random.default_rng(seed)
    rows: list[dict[str, Any]] = []
    for ramp in ramp_lengths:
        length = onset + ramp + window
        floor_delays: list[int] = []
        baseline_delays: list[int] = []
        null_baseline_hits = 0
        for _ in range(trials):
            means = np.concatenate(
                [
                    np.full(onset, base),
                    base - total_drop * np.arange(1, ramp + 1) / ramp,
                    np.full(window, base - total_drop),
                ]
            )
            values = np.clip(rng.normal(means, sd), 0.0, 1.0)
            floor_hit = baseline_hit = None
            for i in range(onset, length + 1):
                current = values[i - window : i]
                before = values[i - 2 * window : i - window]
                if floor_hit is None and floor_flags(current, floor):
                    floor_hit = i - onset
                if baseline_hit is None and baseline_status(current, before) == "worse":
                    baseline_hit = i - onset
            # The control: the same duration with no decline at all.
            quiet = np.clip(rng.normal(base, sd, length), 0.0, 1.0)
            for i in range(onset, length + 1):
                if baseline_status(quiet[i - window : i], quiet[i - 2 * window : i - window]) == "worse":
                    null_baseline_hits += 1
                    break
            if floor_hit is not None:
                floor_delays.append(floor_hit)
            if baseline_hit is not None:
                baseline_delays.append(baseline_hit)
        rows.append(
            {
                "ramp": ramp,
                "drop_per_window": total_drop * window / ramp,
                "floor_detected": len(floor_delays) / trials,
                "floor_median_delay": float(np.median(floor_delays)) if floor_delays else None,
                "baseline_detected": len(baseline_delays) / trials,
                "baseline_median_delay": float(np.median(baseline_delays)) if baseline_delays else None,
                "baseline_false_alarm": null_baseline_hits / trials,
            }
        )
    return rows


def pct(value: float) -> str:
    return f"{value * 100:.0f}%" if value >= 0.995 or value == 0 else f"{value * 100:.1f}%"


def format_single_window(rows: list[dict[str, Any]]) -> str:
    """A Markdown table of flag rates per scenario and sample size."""
    lines = [
        "| Scenario | Real drop? | Events per window | Floor flags | Baseline flags | Baseline says too few |",
        "| --- | :-: | ---: | ---: | ---: | ---: |",
    ]
    for r in rows:
        lines.append(
            f"| {r['scenario']} | {'yes' if r['drifted'] else 'no'} | {r['n']} | {pct(r['floor_flag_rate'])} | "
            f"{pct(r['baseline_flag_rate'])} | {pct(r['baseline_insufficient_rate'])} |"
        )
    return "\n".join(lines)


def format_sensitivity(rows: list[dict[str, Any]]) -> str:
    lines = [
        "| Spread (sd) | Scenario | Real drop? | Floor flags | Baseline flags |",
        "| ---: | --- | :-: | ---: | ---: |",
    ]
    for r in rows:
        lines.append(
            f"| {r['sd']} | {r['scenario']} | {'yes' if r['drifted'] else 'no'} | {pct(r['floor_flag_rate'])} | "
            f"{pct(r['baseline_flag_rate'])} |"
        )
    return "\n".join(lines)


def format_streaming(rows: list[dict[str, Any]]) -> str:
    lines = [
        "| Drop at onset | Checks in a row needed | Streams with a false alarm | Streams detected | Median delay (events) |",
        "| ---: | ---: | ---: | ---: | ---: |",
    ]
    for r in rows:
        delay = "n/a" if r["median_delay"] is None else f"{r['median_delay']:.0f}"
        lines.append(
            f"| {r['drop']:.2f} | {r['k']} | {pct(r['false_alarm_trials'])} | {pct(r['detected'])} | {delay} |"
        )
    return "\n".join(lines)


def format_gradual(rows: list[dict[str, Any]]) -> str:
    lines = [
        "| Ramp length (events) | Fall per 30 events | Floor detected | Floor median delay | Baseline detected | Baseline median delay | Baseline false alarm with no fall |",
        "| ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for r in rows:
        fd = "n/a" if r["floor_median_delay"] is None else f"{r['floor_median_delay']:.0f}"
        bd = "n/a" if r["baseline_median_delay"] is None else f"{r['baseline_median_delay']:.0f}"
        lines.append(
            f"| {r['ramp']} | {r['drop_per_window']:.3f} | {pct(r['floor_detected'])} | {fd} | "
            f"{pct(r['baseline_detected'])} | {bd} | {pct(r['baseline_false_alarm'])} |"
        )
    return "\n".join(lines)


def run_all(progress: Callable[[str], None] | None = None) -> dict[str, Any]:
    """Run every study and return the rows and the formatted tables."""
    say = progress or (lambda _msg: None)
    say("single-window study")
    single = single_window_study()
    say("sensitivity study")
    sensitivity = sensitivity_study()
    say("streaming study")
    streaming = streaming_study()
    say("gradual-decline study")
    gradual = gradual_study()
    return {
        "min_sample": MIN_SAMPLE,
        "single_window": single,
        "sensitivity": sensitivity,
        "streaming": streaming,
        "gradual": gradual,
        "tables": {
            "single_window": format_single_window(single),
            "sensitivity": format_sensitivity(sensitivity),
            "streaming": format_streaming(streaming),
            "gradual": format_gradual(gradual),
        },
    }


if __name__ == "__main__":
    results = run_all(progress=lambda m: print(f"running {m}...", flush=True))
    for name, table in results["tables"].items():
        print(f"\n## {name}\n\n{table}")
