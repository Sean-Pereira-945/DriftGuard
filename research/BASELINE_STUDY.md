# Floors against the baseline comparison: a simulation study

This is the research behind the dashboard's two ways of saying "quality has a
problem". It measures them on synthetic data where the truth is known. Reproduce
every table here with:

```bash
python -m research.baseline_study     # about 15 seconds, fully seeded
pytest research/tests/test_baseline_study.py
```

## The question

The product can flag a drop in a 0 to 1 reading (here, response quality) in two
ways:

- **The floor.** The window's mean is below a fixed line (default 0.80).
- **The baseline comparison.** The window's mean is meaningfully lower than the
  period before it. It uses `driftguard.baseline.compare`: a Welch z-test that
  needs at least 3 standard errors and a change of at least 0.05, and refuses to
  judge with fewer than 10 events on either side.

When does each one catch a real problem, when does it cry wolf, and what does
checking continuously cost?

## Method and assumptions

- Per-event quality is normally distributed around a mean, clipped to [0, 1].
  The default spread (standard deviation) is 0.08.
- Events are independent, and the spread is the same in both periods.
- Each trial draws a baseline window and a current window of the same size. 2,000
  trials per cell for the single-window study (1,000 for the noise table), 300 streams for the streaming one,
  200 for the slow-decline one. All seeded.
- "A real drop" means the true mean fell by at least 0.05.
- The code is `research/baseline_study.py`. The detector under test is the
  product's own `compare`, not a copy.

## 1. One decision per window

Share of trials in which each rule raised a flag. "Too few" is how often the
baseline comparison refused to judge.

| Scenario | Real drop? | Events per window | Floor flags | Baseline flags | Baseline says too few |
| --- | :-: | ---: | ---: | ---: | ---: |
| steady_healthy | no | 5 | 0.1% | 0% | 100% |
| steady_healthy | no | 10 | 0% | 0.2% | 0% |
| steady_healthy | no | 30 | 0% | 0.4% | 0% |
| steady_healthy | no | 100 | 0% | 0% | 0% |
| steady_low | no | 5 | 100% | 0% | 100% |
| steady_low | no | 10 | 100% | 0.2% | 0% |
| steady_low | no | 30 | 100% | 0.2% | 0% |
| steady_low | no | 100 | 100% | 0% | 0% |
| small_dip | no | 5 | 0.4% | 0% | 100% |
| small_dip | no | 10 | 0% | 3.5% | 0% |
| small_dip | no | 30 | 0% | 6.5% | 0% |
| small_dip | no | 100 | 0% | 0.9% | 0% |
| hidden_decline | yes | 5 | 5.1% | 0% | 100% |
| hidden_decline | yes | 10 | 0.7% | 35.9% | 0% |
| hidden_decline | yes | 30 | 0% | 90.7% | 0% |
| hidden_decline | yes | 100 | 0% | 100% | 0% |
| large_drop | yes | 5 | 100% | 0% | 100% |
| large_drop | yes | 10 | 100% | 100% | 0% |
| large_drop | yes | 30 | 100% | 100% | 0% |
| large_drop | yes | 100 | 100% | 100% | 0% |
| improvement | no | 5 | 0.3% | 0% | 100% |
| improvement | no | 10 | 0% | 0% | 0% |
| improvement | no | 30 | 0% | 0% | 0% |
| improvement | no | 100 | 0% | 0% | 0% |

What it shows:

- **They fail in opposite places.** The floor never sees `hidden_decline` (a 0.09
  fall from 0.95 to 0.86, still above 0.80): it flags 0 to 5 percent at every size. The
  baseline catches it 36 percent of the time with 10 events per window, 91 percent
  with 30 and every time with 100.
- **The floor can't tell "bad" from "changed".** In `steady_low` nothing changes
  but the project always sits under 0.80, so the floor flags it 100 percent of the
  time. The baseline stays quiet (0.2 percent at most).
- **The baseline stays quiet when nothing changed or quality rose.** It flagged at
  most 0.4 percent of trials in `steady_healthy`, `steady_low` and `improvement`.
- **The guard works, and it costs something.** With 5 events per window the
  baseline refuses every time, so it misses `large_drop` entirely there. The floor
  catches it every time, at every size. From 10 events the baseline catches
  `large_drop` 100 percent of the time.
- **A change too small to matter still gets flagged sometimes.** `small_dip` is a
  real 0.03 fall, below the 0.05 rule. Noise adds to it often enough that the
  baseline flags 3.5 percent of trials at 10 events and 6.5 percent at 30. The
  rule bounds the false alarms; it doesn't eliminate them.
- **"Enough events to judge" is not "enough to detect".** At 10 events per window
  the baseline finds a 0.09 decline only 36 percent of the time. A quiet result
  with few events does not mean nothing changed.

## 2. Noisier data

The same decision at 30 events per window, for different spreads.

| Spread (sd) | Scenario | Real drop? | Floor flags | Baseline flags |
| ---: | --- | :-: | ---: | ---: |
| 0.05 | steady_healthy | no | 0% | 0% |
| 0.05 | steady_low | no | 100% | 0% |
| 0.05 | small_dip | no | 0% | 5.5% |
| 0.05 | hidden_decline | yes | 0% | 100% |
| 0.05 | large_drop | yes | 100% | 100% |
| 0.05 | improvement | no | 0% | 0% |
| 0.08 | steady_healthy | no | 0% | 0.2% |
| 0.08 | steady_low | no | 100% | 0.2% |
| 0.08 | small_dip | no | 0% | 7.0% |
| 0.08 | hidden_decline | yes | 0% | 88.7% |
| 0.08 | large_drop | yes | 100% | 100% |
| 0.08 | improvement | no | 0% | 0% |
| 0.15 | steady_healthy | no | 0% | 0.4% |
| 0.15 | steady_low | no | 100% | 0.2% |
| 0.15 | small_dip | no | 0.1% | 1.9% |
| 0.15 | hidden_decline | yes | 2.2% | 21.9% |
| 0.15 | large_drop | yes | 100% | 100% |
| 0.15 | improvement | no | 0% | 0% |

The baseline's power depends heavily on spread. `hidden_decline` is caught
every time at a spread of 0.05, 89 percent of the time at 0.08, and only 22
percent of the time at 0.15. Real quality scores from a grader are often noisier
than 0.08, so expect to need more events.

## 3. Checking continuously

If the comparison runs after every event (as an alert would), every check is a
fresh chance to fire on noise. Here quality is 0.92, then drops by the amount
shown at event 200. Each check compares the latest 30 events with the 30 before,
and an alarm needs `k` checks in a row. The 0.00 row is the control: nothing
dropped, so any alarm is false.

| Drop at onset | Checks in a row needed | Streams with a false alarm | Streams detected | Median delay (events) |
| ---: | ---: | ---: | ---: | ---: |
| 0.00 | 1 | 4.7% | 9.7% | 94 |
| 0.00 | 3 | 2.3% | 2.3% | 80 |
| 0.00 | 5 | 1.0% | 1.0% | 82 |
| 0.05 | 1 | 6.0% | 58.7% | 25 |
| 0.05 | 3 | 2.7% | 40.7% | 28 |
| 0.05 | 5 | 1.7% | 29.7% | 29 |
| 0.10 | 1 | 5.0% | 98.7% | 19 |
| 0.10 | 3 | 2.3% | 97.7% | 21 |
| 0.10 | 5 | 1.0% | 96.3% | 23 |
| 0.20 | 1 | 6.0% | 100% | 11 |
| 0.20 | 3 | 3.0% | 100% | 13 |
| 0.20 | 5 | 1.7% | 100% | 16 |
| 0.30 | 1 | 6.3% | 100% | 9 |
| 0.30 | 3 | 2.3% | 100% | 11 |
| 0.30 | 5 | 1.3% | 100% | 13 |

- **A single check is safe, a stream of checks is not.** In section 1, a single check
  fired on noise 0.4 percent of the time or less. Checked at every event over about 170
  events, 4.7 to 6.3 percent of streams raised a false alarm.
- **Requiring checks in a row fixes most of it.** With 3 in a row the false-alarm
  share falls to 2.3 to 3.0 percent, and with 5 in a row to 1.0 to 1.7 percent.
- **The price is small for real drops and large for tiny ones.** For a 0.10 drop
  the median delay rises from 19 to 21 to 23 events and detection stays at 96 to
  99 percent. For a 0.05 drop detection falls from 59 to 41 to 30 percent.

## 4. Slow decline

Quality falls by 0.30 evenly over the ramp length. The baseline only sees how much
quality fell within one window's length, so a slow ramp might hide from it. The
floor compares with a fixed line, so it can't be hidden that way. The last column
is a control: the same duration with no fall at all.

| Ramp length (events) | Fall per 30 events | Floor detected | Floor median delay | Baseline detected | Baseline median delay | Baseline false alarm with no fall |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 50 | 0.180 | 100% | 35 | 100% | 25 | 6.0% |
| 100 | 0.090 | 100% | 55 | 100% | 35 | 9.0% |
| 200 | 0.045 | 100% | 93 | 100% | 60 | 8.5% |
| 400 | 0.022 | 100% | 166 | 94.5% | 120 | 21.5% |
| 800 | 0.011 | 100% | 304 | 90.0% | 292 | 35.0% |
| 1600 | 0.006 | 100% | 568 | 85.0% | 496 | 52.5% |

- **At moderate speeds the baseline is not blind, and it is faster.** For falls of
  0.045 or more per 30 events it detects every time, 10 to 33 events before the
  floor, with a false-alarm rate of 6 to 9 percent.
- **At slow speeds its "detections" can't be trusted.** From a ramp of 400
  events the false-alarm control climbs to 21.5, 35 and 52.5 percent. A sizeable share
  of the "detected" figures of 94.5, 90 and 85 percent is therefore noise firing
  during a long watch, not the decline.
- **The floor never misses a decline that reaches it, but it is late.** It detects
  100 percent of every ramp, with delays from 35 to 568 events. Here the decline
  starts at 0.92 and needs to fall below 0.80 first.

## What this means for the product

1. **Keep both rules.** They fail in different places: the floor misses declines
   above the line and flags a steadily low project forever, while the baseline
   abstains with few events and can fire on noise when checked continuously.
2. **The 10-event guard is doing its job, but "Steady" over-claims at low counts.**
   At 10 events a real 0.09 decline reads "steady" about two times in three. The
   wording "No clear change" is more honest, and the sample size should sit next
   to it.
3. **If the baseline ever raises alerts, don't alert on a single check.** Require
   at least 3 checks in a row and add a cooldown. A sequential method designed for
   repeated checking (CUSUM or EWMA) is the better long-term answer than a
   3-sigma test.
4. **Spread matters more than the thresholds.** Show a measure of spread, and
   tell people when the data is too noisy to detect anything small.

## Limits of this study

- Everything is synthetic, Gaussian, independent and equal-variance. Real quality
  scores are often bounded, skewed or on a 1 to 5 scale, and events from one
  session are not independent. Both push false alarms up.
- Only response quality was simulated. Retrieval and risk behave the same under
  the same test but have their own spread, and risk has a ceiling at 1.0.
- Windows were the same size on both sides. The product's windows are the same
  length in time, so their event counts can differ.
- Gradual and abrupt change were tested, but not a change in variance, seasonal
  patterns, or several metrics moving together.
- A clean result here says the rule behaves as designed. It does not say it fits
  your traffic. Check it against a few weeks of your own data before relying on it.
