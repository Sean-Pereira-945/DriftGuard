# Measuring retrieval score and response quality

DriftGuard doesn't compute these two numbers. **Your code does, and sends them**
with each event. DriftGuard then checks them against floors you set, turns the
result into a risk score and a severity, and compares them with the period before
(see [How DriftGuard works](concepts.md#how-a-telemetry-event-is-scored)).

| | Retrieval score | Response quality |
| --- | --- | --- |
| **Question it answers** | Were the documents my app fetched relevant to the question? | Was the answer good? |
| **Range** | 0 to 1, higher is better | 0 to 1, higher is better |
| **Needs** | A search or retrieval step | Some way to grade an answer |
| **Default floor** | 0.50 | 0.80 |
| **Risk added when below the floor** | 0.35 | 0.20 |
| **Recommendation when below the floor** | Trim retrieval results and prioritise high-value documents | Fall back to a lower-cost model for non-critical requests |
| **Leave it out when** | You don't retrieve anything | You have no evaluator |

Leave a value out rather than sending a made-up one. A missing score is shown as
**Not reported by this source** and never counts against you.

## Retrieval score

It should be one number per request that says how relevant the retrieved
documents were. Pick the method that matches what you have.

- **Similarity of the results.** Embed the question and each retrieved chunk,
  take the cosine similarity of each pair, and average them. Clamp negative
  values to 0.
- **A reranker score.** Average the relevance scores a reranker gives the top few
  results.
- **Precision at k.** Only with labelled data: (relevant results among the top k)
  divided by k.

```python
import numpy as np

def retrieval_score(query_vec, chunk_vecs):
    sims = [
        np.dot(query_vec, c) / (np.linalg.norm(query_vec) * np.linalg.norm(c))
        for c in chunk_vecs
    ]
    return float(np.clip(np.mean(sims), 0, 1))
```

Similarity scores from different embedding models sit in different ranges, so a
floor of 0.50 may be too high or too low for yours. Set it from your own data
(see [Choosing the floors](#choosing-the-floors)).

## Response quality

It should be one number per request that says how good the answer was. Pick one,
or average several.

- **A grader model.** Ask a second model to rate the answer from 1 to 5 against a
  short rubric: correct, grounded in the context, complete. Convert with
  `(rating - 1) / 4`, and average the rubric items if you use several.
- **Automatic checks.** The fraction of tests that pass, whether the output has
  the required format, or similarity to a known good answer.
- **Grounding.** The fraction of claims in the answer that the retrieved
  documents support.
- **User feedback.** Thumbs up counts as 1 and thumbs down as 0, averaged over a
  window.

```python
def response_quality(question, answer, context):
    # `judge` is your call to a grader model. It returns ratings from 1 to 5.
    ratings = judge(question, answer, context)  # {"correct": 4, "grounded": 5, "complete": 3}
    return sum((r - 1) / 4 for r in ratings.values()) / len(ratings)
```

Then send both with the request's token counts:

```python
client.capture_metrics(
    prompt_tokens=1200,
    context_length=2500,
    retrieval_score=retrieval_score(query_vec, chunk_vecs),   # leave out without retrieval
    response_quality=response_quality(question, answer, context),  # leave out without an evaluator
)
client.sync_metrics()
```

A grader model costs tokens and adds its own bias, so grade a sample of requests
if volume is high. DriftGuard's averages and comparisons work on whatever you
send.

## When you only have telemetry

Some sources report activity but can't grade anything. **Claude Code** is the
example: its hook sends token counts, tool successes and failures, retries and
durations, but no relevance and no answer grade. DriftGuard leaves the two scores
blank there instead of inventing them.

If you want a number anyway, you can build a **proxy** from what is recorded.
These are suggestions, not something DriftGuard computes today:

- **A quality proxy per turn:**
  `1 − 0.6 × (failed tool calls ÷ tool calls) − 0.4 × (wasted tokens ÷ total tokens)`,
  kept between 0 and 1. A clean turn scores near 1, and a retry loop drops fast.
  A stronger signal is an outcome check, such as whether the last test run in the
  turn passed.
- **A retrieval proxy per turn:** the share of search calls (grep, glob, search
  tools) that returned results, or the share of files read that were later
  edited. Both need tool outputs, so they need content storage on.

Be careful with proxies:

- They measure how **smoothly** the agent worked, not whether the answer was
  right. A turn with no failed tools can still be wrong, and a turn that retries
  because the task is hard can end correct.
- The weights above are arbitrary, so only the trend is meaningful, not the level.
- The default floors were chosen for real evaluator scores. Re-tune them for a
  proxy.

## Choosing the floors

1. Collect a week or more of normal traffic.
2. Look at the spread of the score, not just the mean. A floor near the 5th to
   10th percentile of healthy traffic flags the unusual tail without flagging
   everything.
3. Open **Policy**. Each field shows how many of the loaded events it would
   flag, before and after your edit, so you can see the effect before saving.
4. Lowering a floor flags fewer events, and 0 never flags. A floor that flags
   most of your traffic is too high, and one that flags nothing is too low.

## How the numbers become alerts

Each event is checked against four rules: prompt tokens too high, context too
long, retrieval too low, quality too low. Each broken rule adds its weight to the
risk score (0.25, 0.20, 0.35 and 0.20), capped at 1.0. From 0.40 an event is a
**warning**, and from 0.75 it is **critical**. A critical event raises a drift
alert with its root cause and a recommendation. The full table is in
[How DriftGuard works](concepts.md#how-a-telemetry-event-is-scored).

## What the numbers can and can't tell you

Read the dashboard with these limits in mind.

- **The risk score is a ranking, not a measurement.** Its weights and cut-offs are
  set by judgment, not fitted to data. A risk of 0.60 means "worse than 0.40",
  nothing more.
- **A floor says "below a line", not "worse than usual".** A project whose normal
  quality is 0.70 sits under a floor of 0.80 permanently, while one falling from
  0.99 to 0.85 never crosses it. That is why the Overview also
  [compares the window with the period before it](concepts.md#is-it-worse-than-usual-baseline-comparison).
- **An average hides the spread.** A mean quality of 0.81 can be a steady 0.81, or
  half the answers near 1.0 and half near 0.6. The share of events below the
  floor, in the Drift Risk Breakdown, shows that better than the mean does.
- **Few events make noisy averages.** The comparison refuses to judge with fewer
  than 10 events on either side, and the Overview says when an average rests on
  only a handful.
- **Everything is mixed together.** Different models, routes and task difficulty
  feed one average, so a change in traffic can look like drift. Filter by
  environment, and keep separate projects for very different workloads.
- **The solid facts are the operational ones.** "This tool failed 3 times in a row
  and wasted 13,200 tokens" is observed, not estimated. Claims about quality are
  only as good as the evaluator behind them.

Not built yet, and listed in the [roadmap](roadmap.md): percentiles beside each
mean, a breakdown by model and route, alerts on a sustained drop from the
baseline, and weights that can be fitted to labelled data.
