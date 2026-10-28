# logs-to-evals, the spec

Written 2026-10-28 23:10, before anything was measured. What follows
is fixed before the first evaluation run, so the result cannot be tuned toward.

## The claim to test

A test set picked from a production log by `src/lib/select.ts` (scrub, cluster by meaning, spend the
budget on clusters by traffic and by how unhappy their users were, unhappy rows first, then the rows
least like those taken) contains failing examples of more of the log's failure modes than the same
number of rows picked another way.

## The log

`tools/gen-log.ts`, unchanged from the scaffold: support requests in English and Greek, 8 failure
modes each with a trigger and a failure rate, a noisy signal (thumbs down, re-ask, escalation) that
fires on most failures and on some successes, and planted personal data. Synthetic, and said so.

## The numbers

Per log, 5,000 rows, and a budget of 60 cases.

- **Modes found:** the planted modes for which the test set holds at least one row that triggers the
  mode and failed in the log. A regression suite built from logs is worth its failing examples.
- **Modes touched:** the same, counting any row that triggers the mode, failed or not.
- **Near twins:** the share of cases with another case at similarity 0.9 or more.
- **Personal data left:** planted values still present in the selected cases after scrubbing.

Pickers, all given the same scrubbed rows:

1. the selector, as committed in the scaffold;
2. 60 rows at random, 200 draws per log;
3. 60 rows at random from the rows with a signal, 200 draws per log;
4. the selector with the signal removed, to show what the signal is worth.

## Seeds

Development: log seeds 1 to 10, used to make the harness run, never to tune the selector. Evaluation:
log seeds 1001 to 1050, run once with the selector frozen as it was in the scaffold (`CLUSTER_AT`
0.6, unhappiness weight 5). If the selector loses, that is the result, and a changed selector would be
measured on seeds it has never seen.

## The failures to publish

Whatever the evaluation shows, plus what is known now: names have no shape and the scrubber misses
most of them; the embedder lowercases, so a failure caused by capitals is invisible to the clustering;
the generator and the selector have one author.
