# DriftGuard research

This folder holds two pieces of research code. It is kept for reference and
reproducibility.

1. **The baseline study** (October 2026). A simulation that measures the product's
   own detection rules: how often each one catches a real drop, how often it
   cries wolf, and what checking continuously costs. Read the results in
   [BASELINE_STUDY.md](BASELINE_STUDY.md).
2. **The Phase 1 prototypes** (June 2026). A synthetic feature-drift model and a
   benchmark against simple statistical baselines.

The `driftguard` product package does not import anything from here. The baseline
study goes the other way: it imports `driftguard.baseline` so that it tests the
code the product actually ships, not a copy.

| Module | Purpose |
| --- | --- |
| `baseline_study.py` | Simulates floors against the baseline comparison: one decision per window, noise sensitivity, continuous checking, and slow decline. Seeded and reproducible. |
| `data.py` | Generates synthetic three-feature datasets with a known drift onset. |
| `detector.py` | Mean-shift drift score with per-feature attribution. |
| `benchmark.py` | Compares the detector against mean-shift and variance-shift baselines. |
| `experiment.py` | Runs single scenarios or the full benchmark matrix. |
| `reporting.py` | Formats results as a Markdown table and a research summary. |
| `demo_api.py` | Tiny FastAPI app exposing `/dataset` and `/drift` for demos. |

## Running

```bash
pip install -e ".[research,dev]"
pytest research/tests
python -m research.baseline_study        # prints the baseline study's tables
python -c "from research.experiment import run_experiment_suite; from research.reporting import format_benchmark_markdown; print(format_benchmark_markdown(run_experiment_suite()['results']))"
uvicorn research.demo_api:app --port 8001
```

The baseline study is seeded, so it prints the same tables every time. The Phase 1
datasets use unseeded random numbers, so their scores vary between runs.

## What each part can and can't show

**The baseline study** compares detectors against a known truth, so it reports
detection rates, false-alarm rates and delays. It assumes Gaussian, independent
events with equal spread, and it only simulates response quality. Its limits are
listed at the end of [BASELINE_STUDY.md](BASELINE_STUDY.md).

**The Phase 1 benchmark** prints each detector's raw score for a dataset and calls
the largest the "winner". Raw scores from different detectors are on different
scales, so that ranking says which number is bigger, not which detector is better.
It has no false-alarm or delay measure and no repeated trials. Treat it as a demo
of the feature-drift idea, not as evidence that one detector beats another. The
baseline study is the evaluation to cite.
