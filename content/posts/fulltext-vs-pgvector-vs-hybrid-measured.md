---
title: 'Full-Text vs pgvector vs Hybrid Search, Measured'
excerpt: 'We put keyword search, pgvector and hybrid retrieval over the same 3,814 passages with 200 hand-written queries and pooled relevance judgments. The overall winner turned out to be the least useful number in the whole benchmark.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-09-21'
publishedAt: '2026-09-21T09:00:00Z'
updatedAt: '2026-09-21T09:00:00Z'
readingTime: '19 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Postgres
  - Neon
  - Search
  - pgvector
  - Benchmarking
  - DevOps
---

Somebody on your team wants to add search. There are three obvious answers and a lot of confident writing about which one is right.

Use Postgres full-text search, it is already there. Use pgvector, keyword search cannot understand what people mean. Use both, hybrid is the state of the art.

We ran all three over the same corpus, with the same queries, on the same database, and measured them. The result that mattered was not which one won. It was that **the overall ranking is close to meaningless**, because two of the three are good at opposite halves of the traffic, and which one "wins" a published comparison mostly tells you what that author's queries looked like.

Everything here is reproducible:

```github
https://github.com/The-DevOps-Daily/postgres-search-benchmark
```

## TLDR

- **The single biggest quality win costs one line and has nothing to do with vectors.** Postgres `websearch_to_tsquery` joins terms with AND. Switching to OR took recall@10 from **0.388 to 0.681**, the largest and most certain effect we measured.
- **BM25 beats `ts_rank` on identical candidates**, +0.057 recall, and that difference survives a bootstrap. Same tokenizer, same stop words, same rows, different ranking function.
- **pgvector and BM25 are a dead heat overall: +0.002 recall.** They are not equivalent. They tie because vector wins questions **0.896 to 0.645** and loses jargon **0.490 to 0.869**.
- **Hybrid was the only configuration with no bad shape**, and its lead over each single method still is not statistically certain at 171 judged queries.
- **The decisive cost is latency, and it is not the index.** BM25 answers in 3.3ms end to end. pgvector takes 574ms, because 581ms of that is the API call that turns the query into a vector.
- **The method changed the answer more than the method under test did.** Our chunker, our query parser and our judge each moved the result by more than the gap between the three search approaches.

## Prerequisites

- Postgres 14 or later. Everything here ran on Postgres 18 on a Neon branch.
- `pgvector` for the semantic leg. `lakebase_text` for BM25, which is what Neon ships.
- An embedding model. We used `gte-large-en-v1.5` at 1024 dimensions through DigitalOcean's inference API.
- A willingness to judge your own results. This is the part that makes it real, and it is the part everyone skips.

## What is actually being compared

Five configurations over one table, so nothing differs except the index and the ranking.

```diagram
{
  "type": "graph",
  "columns": [
    [{ "id": "q", "label": "Query", "icon": "globe", "tone": "slate" }],
    [
      { "id": "lex", "label": "tsvector", "sub": "AND or OR", "icon": "database", "tone": "green" },
      { "id": "emb", "label": "Embedding API", "sub": "581ms", "icon": "cloud", "tone": "red" }
    ],
    [
      { "id": "rank1", "label": "ts_rank", "icon": "activity", "tone": "green" },
      { "id": "bm", "label": "BM25", "sub": "lakebase_text", "icon": "activity", "tone": "green" },
      { "id": "hnsw", "label": "HNSW", "sub": "pgvector", "icon": "activity", "tone": "violet" }
    ],
    [{ "id": "rrf", "label": "RRF", "sub": "fuse the ranks", "icon": "branch", "tone": "amber" }]
  ],
  "edges": [
    ["q", "lex"], ["q", "emb"],
    ["lex", "rank1"], ["lex", "bm"], ["emb", "hnsw"],
    ["bm", "rrf"], ["hnsw", "rrf"]
  ]
}
```

| name | what it is |
| --- | --- |
| `ts_and` | `tsvector` with `websearch_to_tsquery`. Terms joined with AND. The default. |
| `ts_or` | The same, terms joined with OR. |
| `bm25` | `lakebase_text`, BM25 over that same `tsvector`, same OR candidates. |
| `vector` | `pgvector`, HNSW, cosine distance. |
| `hybrid` | Reciprocal rank fusion of `bm25` and `vector`. k=60, untuned. |

One thing to understand before the results, because it makes one comparison unusually clean. **`lakebase_text` is not a separate search engine.** It indexes the `tsvector` Postgres already built:

```sql
CREATE INDEX passages_bm25 ON passages USING lakebase_bm25 (tsv tsvector_bm25_ops);

SELECT id, tsv <@> to_bm25query(to_tsvector('english', $1), 'passages_bm25'::regclass) AS score
FROM passages
WHERE tsv @@ websearch_to_tsquery('english', $2)
ORDER BY score ASC
LIMIT 10;
```

Same tokenizer, same stemmer, same stop words as the line above it in the table. Only the scoring changes. So `ts_or` against `bm25` isolates ranking quality with everything else held still, which almost never happens in a benchmark.

:::warning
Two things will catch you. The `<@>` operator returns a **negative** score, so best-first is `ORDER BY ... ASC`. And `to_bm25query` takes a **tsvector**, not a tsquery, because BM25 scores a bag of terms. Passing a tsquery is a type error rather than a silent downgrade, which is the good outcome.
:::

## The corpus, and why chunking decides more than you think

556 published posts, chunked into **3,814 passages**, median 129 words.

The chunker is in the repo and its rules are written down, because chunking quietly decides a search benchmark's result and almost nobody publishes theirs.

Our first version split on headings only. Median passage: **66 words**. That is not a neutral mistake. In a 66 word passage a single rare term dominates the score, so short passages hand an advantage to lexical search before a query is run. Merging consecutive short sections up to a 120 word target moved the median to 129 and the p90 to 196, which is the middle of the normal passage range rather than the bottom of it.

If you take one thing from this post and skip the rest: **when you read a search comparison, look for the chunk size before you look at the result.** If it is not stated, the result is not interpretable.

## The 200 queries

Written by hand, from the list of post titles, before any passage was read.

The obvious shortcut is to have a model read a passage and write a query for it, then treat that passage as the correct answer. It is fast, it scales, and it decides the outcome: the generated query is a paraphrase of the text it came from, and paraphrase is exactly what an embedding is built to match. Do that, and pgvector wins before the first query runs.

Each query carries a shape, and the shape turned out to be the whole story:

- **`exact`**: a phrase the document almost certainly contains. `tar exclude directory`.
- **`question`**: how a person types, in words the document may not use. *how do I stop a port being stuck in use on linux*.
- **`concept`**: a description of a problem with no shared vocabulary guaranteed. *my disk keeps filling up with container layers nobody uses*.
- **`jargon`**: short tokens, acronyms, symbol names. `targetPort vs port`, `CVE-2026-32193`.

50 of each. Of the 200, **171 had at least one passage that answered them**; the other 29 are excluded from every number below and listed in the repo. A query nothing can answer measures the corpus, not the retriever, and leaving it in drags every strategy toward zero by the same amount, which reads as agreement.

## The judging

Every strategy's top ten went into one pool per query, sorted by id. That pool was graded 0 (not relevant), 1 (related), 2 (answers it). The judge never learned which strategy retrieved what, or how anything ranked.

**The judge was a model, and that is a real limitation rather than a footnote.** So we tested it. Fifty judgments were pulled at random and regraded by a human who could not see the model's grades:

```
exact grade agreement                70%
agreement on "does this answer it"   90%
```

The 90% is the number that matters, because that is the decision recall@10 is built on.

More important is the bias check. An LLM judge is reasonably suspected of preferring passages that sit near the query in embedding space, and that is precisely what the vector leg returns. If true, the vector result would be inflated. Split by which strategy found the passage:

```
                 agreement   judge too generous   judge too harsh
lexical only        94%              0                   1
vector side only    89%              0                   2
found by both       86%              0                   2
```

The judge was **harsher than the human everywhere and more generous nowhere**, mean grade 0.64 against 0.90. So every recall number here is probably a slight underestimate, uniformly, and there is no sign of the bias that would have undermined the headline.

## Results

Recall@10 across 171 queries.

```chart
{
  "type": "bar",
  "title": "recall@10 overall, 171 judged queries",
  "caption": "Higher is better. ts_and returned nothing at all for 71 of the 171 queries.",
  "rows": [
    { "label": "ts_and (default)", "value": 0.388, "series": "lexical" },
    { "label": "ts_or", "value": 0.681, "series": "lexical" },
    { "label": "lakebase BM25", "value": 0.738, "series": "lexical" },
    { "label": "pgvector", "value": 0.740, "series": "vector" },
    { "label": "hybrid (RRF)", "value": 0.781, "series": "hybrid" }
  ],
  "series": [
    { "name": "lexical", "color": "#10b981" },
    { "name": "vector", "color": "#8b5cf6" },
    { "name": "hybrid", "color": "#f59e0b" }
  ]
}
```

Read that top row again. **`websearch_to_tsquery` returned zero rows for 71 of 171 queries.** Not bad results. No results.

It joins terms with AND, so a seven word question asks one 129 word passage to contain all seven stems. For conceptual queries it found nothing at all, 38 times out of 43.

This is the single most consequential line in the benchmark and it is a configuration, not a property of full-text search:

```sql
-- returns nothing for most natural questions
websearch_to_tsquery('english', 'my disk keeps filling up with container layers')

-- 2,702 of 3,814 passages match, and now BM25 has something to rank
websearch_to_tsquery('english', 'my OR disk OR keeps OR filling OR up OR with OR container OR layers')
```

BM25 is a **ranking** function. Pairing it with an AND filter throws away the documents it exists to sort.

### The result that actually matters

Here is the same data broken down by query shape, and this is the post:

```chart
{
  "type": "bar",
  "title": "recall@10 by query shape",
  "caption": "The overall averages hide a swing of 0.38 between BM25 and pgvector, in both directions.",
  "rows": [
    { "label": "exact", "value": 0.947, "series": "BM25" },
    { "label": "exact", "value": 0.940, "series": "pgvector" },
    { "label": "exact", "value": 0.931, "series": "hybrid" },
    { "label": "question", "value": 0.645, "series": "BM25" },
    { "label": "question", "value": 0.896, "series": "pgvector" },
    { "label": "question", "value": 0.811, "series": "hybrid" },
    { "label": "concept", "value": 0.512, "series": "BM25" },
    { "label": "concept", "value": 0.571, "series": "pgvector" },
    { "label": "concept", "value": 0.608, "series": "hybrid" },
    { "label": "jargon", "value": 0.869, "series": "BM25" },
    { "label": "jargon", "value": 0.490, "series": "pgvector" },
    { "label": "jargon", "value": 0.760, "series": "hybrid" }
  ],
  "series": [
    { "name": "BM25", "color": "#10b981" },
    { "name": "pgvector", "color": "#8b5cf6" },
    { "name": "hybrid", "color": "#f59e0b" }
  ]
}
```

BM25 and pgvector differ by **+0.002 recall overall**. They are not similar. They tie because they fail in opposite directions:

- **On questions, pgvector wins 0.896 to 0.645.** The words in the question are not the words in the document, which is the case embeddings exist for.
- **On jargon, pgvector loses 0.490 to 0.869.** This is the finding we did not expect, and in hindsight it is obvious. An embedding represents a token by what it resembles. For `CVE-2026-32193` or `targetPort vs port` or `initContainer`, resemblance is exactly wrong: the token **is** the query, and there is nothing useful nearby in vector space. BM25 treats a rare term as rare, which is the correct behaviour when someone types an identifier.

So the overall column tells you almost nothing about your application. It tells you the mix of query shapes in *our* query set. Change the mix and the winner changes, without a single line of SQL changing.

## What the statistics actually support

Every comparison above, as a paired bootstrap over the 171 queries, 20,000 resamples:

```terminal
{
  "title": "paired bootstrap, recall@10",
  "prompt": "$",
  "steps": [
    { "comment": "mean difference, then the 95% confidence interval on that difference" },
    { "cmd": "node scripts/bootstrap.mjs",
      "output": "171 queries, 200000 resamples, paired on query\n\nts_or   - ts_and    +0.293   [+0.241, +0.345]   real\nbm25    - ts_or     +0.057   [+0.022, +0.094]   real\nhybrid  - bm25      +0.043   [-0.002, +0.086]   cannot tell\nhybrid  - vector    +0.040   [-0.003, +0.085]   cannot tell\nvector  - bm25      +0.002   [-0.066, +0.069]   cannot tell" }
  ]
}
```

Two differences survive. **Fixing the query parser**, which is free. And **BM25 over `ts_rank` on identical candidates**, which costs one extension and a 1.9 MB index.

Three do not. Hybrid's lead over both single methods is right at the edge and does not clear it. pgvector against BM25 is a coin flip.

:::important
We started with 40 queries. At that size the smallest gap detectable at 80% power was **0.096 recall**, and the gaps being argued about are 0.002 to 0.043. The benchmark could not have seen them. Going to 200 queries is what turned "BM25 beats ts_rank" from a hunch into a result.

If a search comparison reports a winner on a few dozen queries without an interval, it has not measured what it claims to have measured. Ours could not either, until we fixed it.
:::

## The cost side, where the differences are not subtle

Quality is close. Cost is not.

```chart
{
  "type": "bar",
  "title": "End-to-end query latency, p50, milliseconds",
  "unit": "ms",
  "caption": "Measured from a VM in Frankfurt against a Neon branch in Frankfurt. Vector and hybrid include the call that embeds the query, because a real request cannot skip it.",
  "rows": [
    { "label": "lakebase BM25", "value": 3.3, "series": "lexical" },
    { "label": "ts_or", "value": 11.5, "series": "lexical" },
    { "label": "pgvector", "value": 574.1, "series": "vector" },
    { "label": "hybrid", "value": 586.0, "series": "hybrid" }
  ],
  "series": [
    { "name": "lexical", "color": "#10b981" },
    { "name": "vector", "color": "#8b5cf6" },
    { "name": "hybrid", "color": "#f59e0b" }
  ]
}
```

The index is not the problem. Inside the database, pgvector answers in **19.0ms** against BM25's 3.4ms, which nobody would care about.

The problem is that you cannot search until you have a vector, and getting one is a network round trip to a model:

```
query embedding call      p50 581ms     p95 968ms
```

**That is 176 times the entire BM25 query.** It is also the number that most vector search benchmarks leave out, because it is not a database number and the chart looks better without it.

You can make it smaller. Run the model locally, use a smaller one, cache repeated queries, overlap the call with something else. All of those are real, and all of them are work you are signing up for that the BM25 path does not have.

And the storage, for the same 3.3 MB of text:

| | size |
| --- | --- |
| the text itself | 3,302 kB |
| `tsvector` column | 3,662 kB |
| GIN index | 1,872 kB |
| BM25 index | 1,944 kB |
| embedding column | 15 MB |
| **HNSW index** | **30 MB** |
| **total relation** | **65 MB** |

The lexical path costs about 10 MB. Adding vector search takes the same corpus to 65 MB, and the HNSW index alone is **nine times the size of the text it indexes**. Index build times: GIN 0.2s, BM25 0.1s, HNSW 1.6s. Embedding the corpus took 252.8 seconds and 834,822 tokens, which is cents, once, until you change model and pay it again.

## What we got wrong, twice

Both of these were caught by checking the method rather than the results, and both had already produced a publishable-looking chart.

**The judge was reading half the passages.** We truncated each passage to 900 characters to keep the judging prompt small. The median pooled passage is 912 characters, so **52% of the pool was graded on partial text**, and the ones cut were the long ones. Fixing it moved 14% of the grades and reversed which of hybrid and pgvector came out ahead.

**The latency figure was a sum of two medians.** We took the median database time, added the median embedding time, and called the total a p50. The median of a sum is not the sum of the medians, and it is worse for p95. Timing the whole request as one block was the fix.

**And the bootstrap had a broken random number generator.** The textbook `seed * 1103515245 + 12345` is written for 32 bit integer arithmetic. In JavaScript that multiply lands above 2^53 and silently loses precision. It moved the interval on the closest pair by 0.005, which was exactly the difference between reporting "hybrid beats BM25" and reporting "cannot tell". It was caught by running the same bootstrap in another language and noticing the two disagreed.

None of those three is exotic. All three produced numbers that looked entirely reasonable on a chart.

## What to actually do

1. **Fix your query parser before anything else.** If you are on `websearch_to_tsquery` or `plainto_tsquery` with default AND semantics, you are throwing away most of your recall for free. This is the largest, cheapest and most certain win in the whole benchmark.

2. **Then look at BM25, if your database has it.** Over identical candidates it beat `ts_rank` by a margin that survives a bootstrap, for a 1.9 MB index and no new infrastructure.

3. **Count your query shapes before you buy a vector database.** Go and read 100 real queries from your logs. If most are identifiers, error strings and product names, pgvector will lose to BM25 on your traffic and cost you 570ms a request to do it. If most are sentences, it will win handily.

4. **Price the embedding call, not the index scan.** For a search box in front of a person, 574ms is the feature. For an agent doing retrieval in a background job, it is free. Same technology, opposite decision.

5. **If you cannot tell, hybrid is the defensible choice**, not because it won, but because it was the only configuration with no shape it was bad at. Covering every shape is a reasonable thing to buy when you do not know your traffic.

## What this does not tell you

One corpus, of technical English, in one domain, with a consistent house style. 171 judged queries. One embedding model.

The shape effect is the part we would expect to generalise, because it follows from what the methods are, not from what our corpus happens to contain. The exact numbers are ours.

And the shape mix in the query set is a choice we made: 50 of each. Real traffic is never evenly split, and the overall column would move if we weighted it like a real application. That is the point of the shape table, and the reason to go and count your own.

## Summary

Three search approaches over one corpus, judged properly, and the ranking between them is the least useful output of the exercise.

The parser default costs more recall than the choice of search method. BM25 is a genuine and cheap improvement on `ts_rank`. pgvector and BM25 tie overall while being good at opposite things, which means the tie is an artefact of our query mix and would not survive yours. Hybrid has no weak shape and no proven lead.

The costs, unlike the quality, are not close: 3.3ms against 574ms, and 10 MB against 65 MB.

The repository runs the whole thing on a Neon branch, and the second command tells you whether the first one means anything.
