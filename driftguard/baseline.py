"""Compare a metric over the current window with the period just before it.

A fixed floor says "below a line". It cannot say "worse than usual". This module
adds the second question: is the average in the current window meaningfully
different from the average in the window before it?

It also holds the sample-size guard. With fewer than :data:`MIN_SAMPLE` readings
on either side the answer is ``insufficient``, never a verdict.

The test is a two-sample z-test on the means (Welch's form, which doesn't assume
equal variances). A shift counts only when it is both statistically large
(``|z| >= Z_THRESHOLD``) and large enough to matter (``|delta| >= MIN_EFFECT``),
because with enough events a tiny shift is always "significant".
"""

from __future__ import annotations

import math
from collections.abc import Mapping
from typing import Any

# Readings needed on each side before any comparison is made.
MIN_SAMPLE = 10
# How many standard errors apart the two means must be.
Z_THRESHOLD = 3.0
# The smallest change in a 0 to 1 metric worth reporting.
MIN_EFFECT = 0.05
# The shortest baseline: a 15 minute window is compared with the 24 hours before it.
MIN_BASELINE_HOURS = 24
# For these metrics a rise is bad. For the others a fall is bad.
HIGHER_IS_WORSE = frozenset({"risk_score"})
METRICS = ("retrieval_score", "response_quality", "risk_score")
_Z_CAP = 99.0


def _variance(n: int, mean: float, mean_sq: float) -> float:
    """Sample variance from the count, the mean and the mean of squares."""
    if n < 2:
        return 0.0
    return max(0.0, mean_sq - mean * mean) * n / (n - 1)


def _round(value: float | None, digits: int = 4) -> float | None:
    return None if value is None else round(float(value), digits)


def compare(metric: str, current: Mapping[str, Any], baseline: Mapping[str, Any]) -> dict[str, Any]:
    """Compare one metric between two windows.

    ``current`` and ``baseline`` each hold ``n`` (readings with a value), ``mean``
    and ``mean_sq`` (the mean of the squared readings). The result's ``status`` is:

    - ``insufficient``: too few readings on at least one side;
    - ``steady``: no meaningful change;
    - ``worse`` or ``better``: a meaningful change, judged by the metric's direction.
    """
    n_cur = int(current.get("n") or 0)
    n_base = int(baseline.get("n") or 0)
    mean_cur = current.get("mean")
    mean_base = baseline.get("mean")
    result: dict[str, Any] = {
        "current": _round(mean_cur) if n_cur else None,
        "baseline": _round(mean_base) if n_base else None,
        "n_current": n_cur,
        "n_baseline": n_base,
        "delta": None,
        "z": None,
        "status": "insufficient",
    }
    if n_cur < MIN_SAMPLE or n_base < MIN_SAMPLE or mean_cur is None or mean_base is None:
        return result

    delta = float(mean_cur) - float(mean_base)
    var_cur = _variance(n_cur, float(mean_cur), float(current.get("mean_sq") or 0.0))
    var_base = _variance(n_base, float(mean_base), float(baseline.get("mean_sq") or 0.0))
    standard_error = math.sqrt(var_cur / n_cur + var_base / n_base)
    if standard_error == 0:
        z = 0.0 if delta == 0 else math.copysign(_Z_CAP, delta)
    else:
        z = max(-_Z_CAP, min(_Z_CAP, delta / standard_error))

    meaningful = abs(z) >= Z_THRESHOLD and abs(delta) >= MIN_EFFECT
    if not meaningful:
        status = "steady"
    else:
        worse = delta > 0 if metric in HIGHER_IS_WORSE else delta < 0
        status = "worse" if worse else "better"
    result.update({"delta": _round(delta), "z": round(z, 2), "status": status})
    return result
