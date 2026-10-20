"""Baseline comparison: the maths, the sample-size guard, and the summary field."""

from __future__ import annotations

import math
import statistics
from datetime import datetime, timedelta, timezone

import pytest

from driftguard.baseline import MIN_SAMPLE, compare


def stats(values):
    """The shape the server passes in: count, mean and mean of squares."""
    n = len(values)
    return {"n": n, "mean": sum(values) / n if n else None, "mean_sq": sum(v * v for v in values) / n if n else None}


def spread(centre, count, width=0.02):
    """``count`` readings around ``centre``, so the variance is not zero."""
    return [centre + width * math.sin(i) for i in range(count)]


def test_too_few_readings_gives_no_verdict():
    result = compare("response_quality", stats(spread(0.5, MIN_SAMPLE - 1)), stats(spread(0.95, 50)))
    assert result["status"] == "insufficient"
    assert result["delta"] is None and result["z"] is None
    assert result["n_current"] == MIN_SAMPLE - 1


def test_no_baseline_readings_gives_no_verdict():
    result = compare("response_quality", stats(spread(0.9, 20)), stats([]))
    assert result["status"] == "insufficient"
    assert result["baseline"] is None


def test_a_clear_fall_in_quality_is_worse():
    result = compare("response_quality", stats(spread(0.70, 30)), stats(spread(0.93, 40)))
    assert result["status"] == "worse"
    assert result["delta"] == pytest.approx(-0.23, abs=0.01)
    assert result["z"] < -3


def test_a_rise_in_risk_is_worse_and_a_fall_is_better():
    assert compare("risk_score", stats(spread(0.6, 30)), stats(spread(0.2, 30)))["status"] == "worse"
    assert compare("risk_score", stats(spread(0.1, 30)), stats(spread(0.5, 30)))["status"] == "better"


def test_a_rise_in_quality_is_better():
    assert compare("response_quality", stats(spread(0.95, 30)), stats(spread(0.7, 30)))["status"] == "better"


def test_noise_is_steady():
    cur = spread(0.90, 30, width=0.1)
    base = spread(0.91, 30, width=0.1)
    assert compare("response_quality", stats(cur), stats(base))["status"] == "steady"


def test_a_tiny_shift_is_steady_even_when_it_is_statistically_certain():
    # 2,000 readings each: the 0.02 gap is many standard errors wide but too small to matter.
    cur = spread(0.92, 2000, width=0.01)
    base = spread(0.90, 2000, width=0.01)
    result = compare("response_quality", stats(cur), stats(base))
    assert abs(result["z"]) > 3
    assert result["status"] == "steady"


def test_identical_readings_have_zero_variance_but_do_not_divide_by_zero():
    flat_low = compare("response_quality", stats([0.5] * 20), stats([0.9] * 20))
    assert flat_low["status"] == "worse"
    assert abs(flat_low["z"]) == 99.0
    same = compare("response_quality", stats([0.9] * 20), stats([0.9] * 20))
    assert same["status"] == "steady" and same["z"] == 0.0


def test_z_matches_a_hand_calculation():
    cur = spread(0.70, 30)
    base = spread(0.90, 40)
    expected = (statistics.mean(cur) - statistics.mean(base)) / math.sqrt(
        statistics.variance(cur) / len(cur) + statistics.variance(base) / len(base)
    )
    assert compare("response_quality", stats(cur), stats(base))["z"] == pytest.approx(expected, abs=0.02)


def _send(client, project, count, centre, hours_ago):
    when = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
    for i in range(count):
        body = {
            "prompt_tokens": 1000,
            "context_length": 2000,
            "retrieval_score": 0.9,
            "response_quality": round(centre + 0.02 * math.sin(i), 4),
            "occurred_at": (when + timedelta(minutes=i)).isoformat(),
        }
        response = client.post(f"/events/{project['project_id']}", json=body, headers=project["key_headers"])
        assert response.status_code == 200, response.text


def _summary(client, project, **params):
    response = client.get(f"/projects/{project['project_id']}/summary", params=params, headers=project["key_headers"])
    assert response.status_code == 200, response.text
    return response.json()


def test_summary_flags_a_drop_against_the_previous_period(client, project):
    _send(client, project, 40, 0.93, hours_ago=36)  # the baseline: 24 to 48 hours ago
    _send(client, project, 30, 0.70, hours_ago=3)  # the current 24 hour window
    baseline = _summary(client, project, time_range="24h")["baseline"]
    assert baseline["available"] is True
    assert baseline["window_seconds"] == 24 * 3600
    assert baseline["min_sample"] == MIN_SAMPLE
    quality = baseline["metrics"]["response_quality"]
    assert quality["status"] == "worse"
    assert quality["n_current"] == 30 and quality["n_baseline"] == 40
    assert quality["delta"] < -0.2
    assert baseline["metrics"]["retrieval_score"]["status"] == "steady"


def test_summary_has_no_baseline_for_all_time(client, project):
    _send(client, project, 12, 0.9, hours_ago=2)
    baseline = _summary(client, project, time_range="all")["baseline"]
    assert baseline == {"available": False, "reason": "all_time", "min_sample": MIN_SAMPLE, "metrics": {}}


def test_a_short_window_is_judged_against_the_day_before(client, project):
    _send(client, project, 40, 0.93, hours_ago=10)
    _send(client, project, 12, 0.60, hours_ago=0.1)
    baseline = _summary(client, project, time_range="15m")["baseline"]
    assert baseline["window_seconds"] == 24 * 3600
    assert baseline["metrics"]["response_quality"]["status"] == "worse"


def test_summary_says_insufficient_when_the_window_is_quiet(client, project):
    _send(client, project, 40, 0.93, hours_ago=36)
    _send(client, project, 3, 0.40, hours_ago=2)
    quality = _summary(client, project, time_range="24h")["baseline"]["metrics"]["response_quality"]
    assert quality["status"] == "insufficient"
    assert quality["n_current"] == 3


def test_an_empty_project_has_a_baseline_with_nothing_in_it(client, project):
    baseline = _summary(client, project, time_range="24h")["baseline"]
    assert baseline["available"] is True
    assert all(m["status"] == "insufficient" and m["current"] is None for m in baseline["metrics"].values())
