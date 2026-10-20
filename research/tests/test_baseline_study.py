import pytest

pytest.importorskip("numpy")

from research.baseline_study import (
    SCENARIOS,
    baseline_status,
    floor_flags,
    format_gradual,
    format_single_window,
    format_streaming,
    gradual_study,
    single_window_study,
    streaming_study,
)


@pytest.fixture(scope="module")
def single():
    rows = single_window_study(trials=300, seed=3)
    return {(r["scenario"], r["n"]): r for r in rows}


def test_every_scenario_and_size_is_reported(single):
    assert {name for name, _ in single} == {s.name for s in SCENARIOS}
    assert {n for _, n in single} == {5, 10, 30, 100}


def test_the_floor_misses_a_decline_that_stays_above_it(single):
    row = single[("hidden_decline", 30)]
    assert row["floor_flag_rate"] < 0.05
    assert row["baseline_flag_rate"] > 0.8


def test_the_floor_flags_a_steadily_low_project_but_the_baseline_does_not(single):
    for n in (10, 30, 100):
        row = single[("steady_low", n)]
        assert row["floor_flag_rate"] == 1.0
        assert row["baseline_flag_rate"] < 0.05


def test_the_baseline_stays_quiet_when_nothing_changed_or_quality_rose(single):
    for scenario in ("steady_healthy", "steady_low", "improvement"):
        for n in (10, 30, 100):
            assert single[(scenario, n)]["baseline_flag_rate"] < 0.05


def test_the_guard_refuses_a_verdict_under_ten_events(single):
    for scenario in SCENARIOS:
        row = single[(scenario.name, 5)]
        assert row["baseline_insufficient_rate"] == 1.0
        assert row["baseline_flag_rate"] == 0.0


def test_a_large_drop_is_caught_by_both_from_ten_events_but_only_the_floor_at_five(single):
    assert single[("large_drop", 5)]["floor_flag_rate"] == 1.0
    assert single[("large_drop", 5)]["baseline_flag_rate"] == 0.0
    assert single[("large_drop", 10)]["baseline_flag_rate"] > 0.95


def test_the_study_is_reproducible():
    first = single_window_study(trials=40, seed=9)
    second = single_window_study(trials=40, seed=9)
    assert first == second


def test_primitives_agree_with_the_product():
    import numpy as np

    low = np.full(30, 0.5) + np.linspace(-0.01, 0.01, 30)
    high = np.full(30, 0.9) + np.linspace(-0.01, 0.01, 30)
    assert floor_flags(low) is True
    assert floor_flags(high) is False
    assert baseline_status(low, high) == "worse"
    assert baseline_status(high, low) == "better"
    assert baseline_status(low[:5], high[:5]) == "insufficient"


def test_requiring_more_checks_in_a_row_cuts_false_alarms():
    rows = streaming_study(trials=60, drops=(0.0, 0.3), consecutive=(1, 5), seed=5)
    by = {(r["drop"], r["k"]): r for r in rows}
    assert by[(0.0, 5)]["false_alarm_trials"] <= by[(0.0, 1)]["false_alarm_trials"]
    assert by[(0.3, 1)]["detected"] > 0.95
    assert by[(0.3, 5)]["detected"] > 0.95
    assert by[(0.3, 5)]["median_delay"] >= by[(0.3, 1)]["median_delay"]


def test_a_slow_decline_is_always_caught_by_the_floor_and_the_control_measures_noise():
    rows = gradual_study(trials=40, ramp_lengths=(100, 400), seed=2)
    by = {r["ramp"]: r for r in rows}
    assert all(r["floor_detected"] == 1.0 for r in rows)
    assert by[100]["baseline_detected"] > 0.9
    # Over a longer run the rule fires on noise more often, which the control shows.
    assert by[400]["baseline_false_alarm"] >= by[100]["baseline_false_alarm"]


def test_tables_are_markdown():
    single_rows = single_window_study(trials=10, seed=1)
    stream_rows = streaming_study(trials=5, drops=(0.1,), consecutive=(1,), seed=1)
    slow_rows = gradual_study(trials=5, ramp_lengths=(50,), seed=1)
    for table in (format_single_window(single_rows), format_streaming(stream_rows), format_gradual(slow_rows)):
        lines = table.splitlines()
        assert lines[0].startswith("| ") and lines[1].startswith("| ---")
        assert len({line.count("|") for line in lines}) == 1
