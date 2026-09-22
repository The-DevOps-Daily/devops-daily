---
title: 'Your Semantic Cache Answers the Question Next Door'
excerpt: 'We put a semantic cache in front of an ops assistant on DigitalOcean Serverless Inference and replayed 288 hand-labelled questions through six embedding models. At the threshold that cut the bill by about 30 percent, about one hit in three was the answer to a different question. Someone asking how to undo a pushed commit got the instructions for an unpushed one.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-09-24'
publishedAt: '2026-09-24T09:00:00Z'
updatedAt: '2026-09-24T09:00:00Z'
readingTime: '14 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - AI
  - Caching
  - Embeddings
  - DigitalOcean
  - LLM
---

We replayed 288 questions to an ops assistant through a semantic cache. At a similarity threshold of 0.80 with `bge-m3`, the cache answered **32 percent** of them from memory and cut the average response time from 8.7 seconds to 6.6. It also answered **about one hit in three with the answer to a different question**.

Someone asked how to undo a commit they had already pushed to main. The cache had seen "how do I undo my last commit that I have not pushed yet", decided the two were the same question, and served the answer for a local commit: `git reset --soft HEAD~1`. For a commit already on main the right answer is `git revert`; resetting it and pushing the result means force-pushing over history other people have pulled.

Raising the threshold does not fix it. Between 0.88 and 0.92 the few hits left were more often wrong than right. Across six embedding models and thresholds from 0.50 to 0.99 in steps of 0.01, the best any of them managed with no wrong answers at all was a **0.7 percent** hit rate. For four of the others, the only thresholds that never served a wrong answer never served anything, and one model served a wrong answer even at 0.99.

This post covers how we measured it, why no threshold separates the two kinds of question, what the fix everyone reaches for actually does, and where a semantic cache is genuinely safe.

```github
The-DevOps-Daily/semantic-cache-wrong-answers
```

## TLDR

- **The setup.** 24 pairs of ops questions that read almost the same and need different answers: restart versus reload nginx, the staging versus the production password, a memory limit versus a memory request. Six phrasings each, 288 questions, labelled by construction, so a wrong hit is a fact and not a judge model's opinion.
- **The cache.** Embed the question, find the nearest one already answered, serve its answer if the cosine similarity clears a threshold. Six embedding models on [DigitalOcean Serverless Inference](https://www.digitalocean.com/products/inference-engine), 50 thresholds, 20 orderings of the questions.
- **At 0.80 with bge-m3:** 32 percent hit rate, 62 right hits and 30 wrong ones on average per run of 288 questions.
- **From 0.88 to 0.92:** more of the remaining hits were wrong than right.
- **The same threshold is not the same setting on another model.** At 0.80, `e5-large-v2` answered 88 percent of questions from the cache and 65 percent of those hits were wrong.
- **What it saved:** on `gpt-oss-120b` at published prices, $0.25 per 1,000 questions without a cache and $0.18 with one at 0.80. The average got faster; the slowest 5 percent barely moved.
- **Where it is likely safe:** near-verbatim repeats. Most of them scored higher against their original than any near-miss pair did, so a threshold set from your own near-misses should catch them. We did not replay them through the cache.

- **The obvious fix works, and costs more than it saves.** A small model checking each hit before it was served cut wrong answers to under one per run on average, at every threshold. It also left the cache no faster than having no cache, and more expensive at every threshold tested.

## Prerequisites

- Node.js 20 or later. The harness has no dependencies.
- A DigitalOcean Serverless Inference key. The [docs](https://docs.digitalocean.com/products/ai-platform/) cover creating one.
- Patience for the embedding stage: 288 questions times six models, one request each, under a per-minute rate limit. The simulation stages after that cost no inference at all.

## How a semantic cache decides

An exact-match cache only helps when the same text arrives twice, perhaps after normalising case and punctuation. A semantic cache is meant to help when the same _question_ arrives in different words:

1. Turn the incoming question into an embedding.
2. Find the most similar question already answered.
3. If the similarity is above a threshold, return that question's stored answer.
4. Otherwise ask the model, and store the new question and answer.

The threshold is the only thing deciding whether two questions are "the same". It is one number, compared against one similarity score, and it has to work for every question the assistant will ever get. That is the part worth testing.

## The questions

Operations questions come in near-miss pairs all the time. The words barely change and the right answer changes completely, often in the direction that breaks something.

| Pair                                             | Why the answer differs                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| restart nginx / reload nginx                     | A restart stops the process and can drop connections; a reload applies config gracefully |
| rotate the staging password / the production one | Same operation, different blast radius and procedure                                     |
| memory limit / memory request                    | A limit causes OOM kills; a request affects scheduling                                   |
| delete a pod / delete a deployment               | A pod its deployment owns comes back; the deployment does not                            |
| undo a pushed commit / an unpushed one           | Revert is safe on shared history; reset rewrites it                                      |
| `terraform state rm` / destroy one resource      | One forgets the resource, the other deletes it                                           |
| clear one Redis database / all of them           | `FLUSHDB` versus `FLUSHALL`                                                              |
| cordon a node / drain it                         | One stops new pods; the other evicts the running ones                                    |

There are 24 pairs like these, each side written six different ways, from "How do I restart nginx?" to "How can I bounce the nginx process completely?". Two questions count as sharing an answer if they are listed under the same intent, and a hit counts as wrong when the stored answer was written for the other intent of the pair, or for an unrelated one. No model grades it.

**This is a stress test, not an estimate of how often a production cache is wrong.** Every question's near-miss partner is in the stream, there are no exact repeats, and the paraphrases were written to vary their wording while the near-miss pairs keep theirs. All of that makes it hard on a cache on purpose. How many near-misses your own traffic contains is something only your logs can tell you. What this measures is what the cache does when they turn up.

## Why one threshold cannot separate them

Here are two kinds of question pair, scored by `bge-m3`. The green curve is every pair that needs the same answer. The red dashed curve is every designated near-miss pair: the partners that read almost the same and need different answers. Unrelated pairs, the other 96 percent of the 41,328 possible, are left out.

```chart
{"type": "cdf", "title": "How alike two questions look to bge-m3", "caption": "Cosine similarity, bge-m3. Same answer: all 720 pairs of paraphrases. Different answer: all 864 designated near-miss pairs, such as restart vs reload nginx. Unrelated pairs are not shown.", "series": [{"name": "Same answer (paraphrases)", "samples": [0.357, 0.368, 0.382, 0.433, 0.444, 0.448, 0.45, 0.459, 0.469, 0.473, 0.475, 0.483, 0.484, 0.485, 0.493, 0.496, 0.497, 0.502, 0.502, 0.504, 0.505, 0.508, 0.513, 0.517, 0.519, 0.52, 0.522, 0.523, 0.525, 0.527, 0.529, 0.535, 0.535, 0.538, 0.539, 0.541, 0.544, 0.545, 0.545, 0.554, 0.555, 0.555, 0.557, 0.557, 0.559, 0.56, 0.56, 0.563, 0.566, 0.567, 0.568, 0.568, 0.57, 0.57, 0.571, 0.571, 0.574, 0.574, 0.576, 0.576, 0.576, 0.578, 0.578, 0.58, 0.582, 0.582, 0.583, 0.583, 0.584, 0.584, 0.585, 0.585, 0.586, 0.586, 0.586, 0.587, 0.587, 0.587, 0.588, 0.589, 0.589, 0.591, 0.592, 0.593, 0.594, 0.595, 0.595, 0.597, 0.597, 0.6, 0.6, 0.6, 0.602, 0.602, 0.603, 0.604, 0.604, 0.605, 0.606, 0.606, 0.608, 0.609, 0.609, 0.61, 0.61, 0.611, 0.615, 0.615, 0.616, 0.616, 0.617, 0.617, 0.617, 0.617, 0.618, 0.619, 0.619, 0.619, 0.619, 0.619, 0.619, 0.62, 0.62, 0.621, 0.621, 0.621, 0.622, 0.622, 0.623, 0.623, 0.623, 0.624, 0.624, 0.625, 0.625, 0.626, 0.627, 0.627, 0.629, 0.629, 0.631, 0.631, 0.632, 0.632, 0.632, 0.632, 0.632, 0.633, 0.633, 0.634, 0.634, 0.634, 0.634, 0.634, 0.635, 0.635, 0.636, 0.636, 0.637, 0.637, 0.637, 0.637, 0.638, 0.638, 0.638, 0.64, 0.64, 0.641, 0.641, 0.641, 0.642, 0.642, 0.643, 0.643, 0.643, 0.643, 0.644, 0.645, 0.645, 0.645, 0.648, 0.648, 0.648, 0.649, 0.649, 0.65, 0.651, 0.651, 0.653, 0.653, 0.653, 0.653, 0.654, 0.654, 0.654, 0.655, 0.656, 0.656, 0.656, 0.656, 0.656, 0.657, 0.657, 0.658, 0.659, 0.659, 0.659, 0.661, 0.662, 0.662, 0.663, 0.665, 0.665, 0.665, 0.666, 0.666, 0.666, 0.667, 0.668, 0.668, 0.668, 0.669, 0.669, 0.67, 0.67, 0.671, 0.672, 0.672, 0.672, 0.673, 0.674, 0.674, 0.674, 0.674, 0.675, 0.677, 0.678, 0.678, 0.679, 0.679, 0.679, 0.679, 0.68, 0.68, 0.68, 0.68, 0.681, 0.681, 0.681, 0.683, 0.683, 0.683, 0.684, 0.685, 0.685, 0.685, 0.685, 0.685, 0.686, 0.686, 0.686, 0.686, 0.687, 0.687, 0.687, 0.688, 0.688, 0.688, 0.689, 0.689, 0.689, 0.69, 0.69, 0.69, 0.691, 0.692, 0.692, 0.693, 0.694, 0.694, 0.694, 0.695, 0.695, 0.695, 0.696, 0.696, 0.696, 0.696, 0.696, 0.697, 0.697, 0.697, 0.697, 0.698, 0.699, 0.699, 0.699, 0.699, 0.7, 0.7, 0.7, 0.7, 0.701, 0.702, 0.702, 0.703, 0.703, 0.703, 0.704, 0.704, 0.705, 0.706, 0.706, 0.707, 0.707, 0.707, 0.708, 0.708, 0.709, 0.709, 0.709, 0.709, 0.71, 0.71, 0.71, 0.71, 0.71, 0.71, 0.71, 0.711, 0.712, 0.712, 0.713, 0.714, 0.714, 0.715, 0.715, 0.716, 0.716, 0.716, 0.717, 0.717, 0.718, 0.718, 0.718, 0.718, 0.718, 0.719, 0.72, 0.72, 0.721, 0.721, 0.721, 0.721, 0.721, 0.721, 0.721, 0.722, 0.722, 0.722, 0.723, 0.723, 0.724, 0.724, 0.725, 0.725, 0.725, 0.726, 0.726, 0.726, 0.728, 0.729, 0.729, 0.729, 0.729, 0.729, 0.73, 0.73, 0.73, 0.73, 0.73, 0.731, 0.731, 0.731, 0.731, 0.731, 0.732, 0.732, 0.732, 0.733, 0.733, 0.733, 0.733, 0.733, 0.733, 0.733, 0.734, 0.734, 0.735, 0.735, 0.735, 0.736, 0.736, 0.736, 0.737, 0.737, 0.738, 0.738, 0.738, 0.738, 0.739, 0.739, 0.74, 0.74, 0.74, 0.741, 0.741, 0.742, 0.742, 0.742, 0.742, 0.742, 0.742, 0.742, 0.743, 0.743, 0.743, 0.743, 0.744, 0.744, 0.744, 0.744, 0.744, 0.744, 0.745, 0.745, 0.746, 0.746, 0.746, 0.747, 0.747, 0.747, 0.748, 0.748, 0.748, 0.748, 0.749, 0.749, 0.749, 0.749, 0.75, 0.75, 0.75, 0.75, 0.751, 0.751, 0.751, 0.751, 0.751, 0.751, 0.751, 0.751, 0.751, 0.752, 0.753, 0.753, 0.753, 0.753, 0.754, 0.754, 0.754, 0.755, 0.755, 0.755, 0.755, 0.756, 0.756, 0.757, 0.757, 0.758, 0.758, 0.758, 0.758, 0.758, 0.758, 0.758, 0.759, 0.759, 0.759, 0.759, 0.76, 0.76, 0.76, 0.761, 0.761, 0.761, 0.762, 0.762, 0.763, 0.763, 0.763, 0.763, 0.764, 0.764, 0.764, 0.765, 0.765, 0.765, 0.765, 0.766, 0.766, 0.767, 0.767, 0.767, 0.768, 0.769, 0.769, 0.769, 0.769, 0.77, 0.771, 0.772, 0.772, 0.773, 0.773, 0.773, 0.777, 0.777, 0.777, 0.777, 0.777, 0.778, 0.779, 0.779, 0.78, 0.78, 0.781, 0.781, 0.781, 0.781, 0.782, 0.782, 0.782, 0.782, 0.783, 0.784, 0.784, 0.784, 0.785, 0.785, 0.785, 0.785, 0.785, 0.785, 0.786, 0.786, 0.788, 0.788, 0.788, 0.788, 0.788, 0.789, 0.789, 0.789, 0.789, 0.79, 0.79, 0.791, 0.791, 0.791, 0.792, 0.792, 0.792, 0.793, 0.793, 0.794, 0.794, 0.794, 0.794, 0.795, 0.795, 0.795, 0.795, 0.796, 0.796, 0.796, 0.796, 0.797, 0.798, 0.798, 0.799, 0.799, 0.8, 0.8, 0.801, 0.802, 0.802, 0.802, 0.803, 0.805, 0.805, 0.805, 0.806, 0.807, 0.807, 0.807, 0.807, 0.807, 0.807, 0.808, 0.808, 0.809, 0.81, 0.81, 0.81, 0.811, 0.811, 0.811, 0.812, 0.813, 0.813, 0.813, 0.815, 0.815, 0.815, 0.816, 0.816, 0.817, 0.817, 0.817, 0.818, 0.819, 0.819, 0.822, 0.822, 0.822, 0.822, 0.822, 0.823, 0.823, 0.823, 0.823, 0.824, 0.826, 0.826, 0.826, 0.826, 0.827, 0.827, 0.827, 0.828, 0.828, 0.829, 0.829, 0.83, 0.831, 0.832, 0.833, 0.834, 0.835, 0.836, 0.838, 0.839, 0.84, 0.841, 0.841, 0.841, 0.841, 0.842, 0.843, 0.844, 0.846, 0.847, 0.849, 0.852, 0.852, 0.853, 0.854, 0.855, 0.856, 0.857, 0.859, 0.86, 0.86, 0.86, 0.861, 0.863, 0.865, 0.866, 0.866, 0.866, 0.869, 0.869, 0.869, 0.869, 0.869, 0.87, 0.87, 0.871, 0.872, 0.873, 0.875, 0.875, 0.878, 0.88, 0.88, 0.88, 0.881, 0.883, 0.883, 0.884, 0.889, 0.89, 0.892, 0.893, 0.895, 0.901, 0.923, 0.925, 0.939], "color": "#10b981"}, {"name": "Different answer (near-miss pairs)", "samples": [0.372, 0.375, 0.398, 0.409, 0.412, 0.413, 0.429, 0.43, 0.434, 0.435, 0.441, 0.444, 0.447, 0.452, 0.453, 0.454, 0.454, 0.454, 0.455, 0.459, 0.462, 0.463, 0.466, 0.466, 0.467, 0.467, 0.469, 0.47, 0.471, 0.471, 0.472, 0.472, 0.473, 0.475, 0.476, 0.477, 0.477, 0.479, 0.479, 0.48, 0.48, 0.48, 0.48, 0.481, 0.481, 0.481, 0.482, 0.482, 0.483, 0.483, 0.484, 0.486, 0.486, 0.487, 0.487, 0.487, 0.488, 0.489, 0.489, 0.49, 0.49, 0.491, 0.492, 0.493, 0.493, 0.493, 0.494, 0.495, 0.496, 0.496, 0.496, 0.498, 0.499, 0.499, 0.499, 0.502, 0.503, 0.504, 0.504, 0.504, 0.505, 0.506, 0.506, 0.507, 0.508, 0.508, 0.508, 0.508, 0.509, 0.509, 0.509, 0.509, 0.51, 0.511, 0.512, 0.515, 0.516, 0.516, 0.516, 0.517, 0.517, 0.519, 0.52, 0.52, 0.52, 0.521, 0.522, 0.523, 0.525, 0.525, 0.526, 0.527, 0.528, 0.529, 0.529, 0.529, 0.53, 0.53, 0.531, 0.531, 0.532, 0.532, 0.533, 0.534, 0.534, 0.534, 0.534, 0.538, 0.538, 0.538, 0.539, 0.539, 0.54, 0.541, 0.542, 0.542, 0.543, 0.543, 0.544, 0.545, 0.546, 0.546, 0.546, 0.546, 0.547, 0.547, 0.548, 0.548, 0.549, 0.55, 0.55, 0.551, 0.551, 0.552, 0.552, 0.552, 0.552, 0.552, 0.552, 0.554, 0.554, 0.555, 0.556, 0.556, 0.557, 0.557, 0.558, 0.559, 0.559, 0.561, 0.562, 0.562, 0.562, 0.562, 0.562, 0.563, 0.563, 0.563, 0.564, 0.564, 0.564, 0.565, 0.565, 0.566, 0.567, 0.567, 0.567, 0.567, 0.568, 0.568, 0.568, 0.569, 0.569, 0.57, 0.57, 0.57, 0.571, 0.571, 0.571, 0.572, 0.573, 0.573, 0.573, 0.574, 0.574, 0.574, 0.574, 0.574, 0.575, 0.576, 0.576, 0.576, 0.576, 0.577, 0.577, 0.577, 0.578, 0.578, 0.578, 0.578, 0.579, 0.581, 0.582, 0.582, 0.583, 0.583, 0.583, 0.583, 0.584, 0.584, 0.584, 0.585, 0.585, 0.585, 0.585, 0.585, 0.585, 0.586, 0.586, 0.586, 0.587, 0.587, 0.587, 0.588, 0.588, 0.588, 0.588, 0.588, 0.59, 0.59, 0.591, 0.591, 0.591, 0.591, 0.591, 0.592, 0.592, 0.592, 0.592, 0.592, 0.593, 0.593, 0.594, 0.595, 0.596, 0.596, 0.596, 0.597, 0.597, 0.598, 0.598, 0.598, 0.598, 0.598, 0.6, 0.6, 0.601, 0.601, 0.601, 0.602, 0.602, 0.602, 0.603, 0.603, 0.603, 0.603, 0.603, 0.604, 0.604, 0.604, 0.605, 0.605, 0.605, 0.605, 0.605, 0.606, 0.606, 0.607, 0.608, 0.608, 0.608, 0.608, 0.608, 0.608, 0.609, 0.609, 0.609, 0.609, 0.61, 0.61, 0.61, 0.61, 0.611, 0.611, 0.611, 0.611, 0.611, 0.612, 0.612, 0.612, 0.613, 0.613, 0.613, 0.613, 0.614, 0.614, 0.614, 0.615, 0.615, 0.616, 0.616, 0.616, 0.616, 0.617, 0.617, 0.618, 0.618, 0.618, 0.618, 0.619, 0.62, 0.62, 0.62, 0.621, 0.621, 0.621, 0.621, 0.621, 0.621, 0.622, 0.622, 0.623, 0.624, 0.624, 0.624, 0.625, 0.625, 0.625, 0.626, 0.626, 0.627, 0.627, 0.627, 0.628, 0.629, 0.629, 0.63, 0.63, 0.63, 0.631, 0.631, 0.631, 0.631, 0.631, 0.632, 0.632, 0.633, 0.633, 0.633, 0.633, 0.633, 0.633, 0.634, 0.634, 0.634, 0.634, 0.634, 0.634, 0.635, 0.635, 0.635, 0.635, 0.636, 0.636, 0.636, 0.636, 0.636, 0.636, 0.637, 0.637, 0.637, 0.637, 0.638, 0.638, 0.638, 0.638, 0.638, 0.638, 0.639, 0.64, 0.64, 0.64, 0.64, 0.64, 0.641, 0.641, 0.641, 0.642, 0.642, 0.642, 0.642, 0.642, 0.642, 0.642, 0.644, 0.644, 0.644, 0.644, 0.644, 0.645, 0.645, 0.645, 0.646, 0.646, 0.646, 0.646, 0.647, 0.647, 0.648, 0.648, 0.648, 0.648, 0.648, 0.649, 0.65, 0.65, 0.65, 0.65, 0.65, 0.651, 0.651, 0.651, 0.651, 0.651, 0.652, 0.652, 0.653, 0.653, 0.653, 0.653, 0.654, 0.654, 0.654, 0.654, 0.654, 0.654, 0.654, 0.655, 0.655, 0.655, 0.656, 0.656, 0.656, 0.656, 0.657, 0.657, 0.657, 0.657, 0.658, 0.658, 0.658, 0.658, 0.658, 0.659, 0.659, 0.66, 0.661, 0.661, 0.661, 0.662, 0.662, 0.662, 0.662, 0.662, 0.662, 0.663, 0.663, 0.664, 0.664, 0.665, 0.665, 0.665, 0.666, 0.666, 0.667, 0.667, 0.667, 0.668, 0.668, 0.669, 0.669, 0.669, 0.669, 0.669, 0.669, 0.67, 0.67, 0.671, 0.672, 0.672, 0.673, 0.673, 0.674, 0.674, 0.675, 0.675, 0.675, 0.675, 0.675, 0.676, 0.676, 0.676, 0.677, 0.677, 0.677, 0.677, 0.677, 0.677, 0.678, 0.679, 0.68, 0.68, 0.681, 0.681, 0.682, 0.682, 0.682, 0.682, 0.682, 0.683, 0.683, 0.684, 0.684, 0.684, 0.685, 0.685, 0.686, 0.687, 0.687, 0.688, 0.688, 0.688, 0.689, 0.689, 0.689, 0.689, 0.689, 0.689, 0.689, 0.689, 0.689, 0.69, 0.69, 0.69, 0.69, 0.691, 0.692, 0.692, 0.692, 0.693, 0.693, 0.694, 0.694, 0.695, 0.695, 0.697, 0.697, 0.697, 0.698, 0.698, 0.698, 0.698, 0.698, 0.699, 0.699, 0.7, 0.701, 0.701, 0.701, 0.701, 0.701, 0.702, 0.702, 0.702, 0.702, 0.703, 0.703, 0.703, 0.705, 0.705, 0.706, 0.706, 0.706, 0.706, 0.707, 0.707, 0.707, 0.707, 0.708, 0.708, 0.708, 0.709, 0.709, 0.71, 0.71, 0.71, 0.71, 0.71, 0.71, 0.711, 0.711, 0.712, 0.712, 0.712, 0.712, 0.712, 0.713, 0.713, 0.714, 0.714, 0.714, 0.714, 0.715, 0.715, 0.715, 0.715, 0.715, 0.716, 0.716, 0.716, 0.717, 0.718, 0.718, 0.718, 0.718, 0.718, 0.718, 0.719, 0.719, 0.719, 0.72, 0.72, 0.721, 0.721, 0.722, 0.722, 0.722, 0.724, 0.725, 0.726, 0.726, 0.726, 0.727, 0.727, 0.727, 0.727, 0.728, 0.728, 0.729, 0.73, 0.73, 0.731, 0.731, 0.731, 0.731, 0.732, 0.732, 0.733, 0.733, 0.733, 0.734, 0.735, 0.735, 0.736, 0.737, 0.737, 0.737, 0.737, 0.737, 0.738, 0.738, 0.738, 0.738, 0.738, 0.738, 0.739, 0.739, 0.74, 0.74, 0.741, 0.741, 0.741, 0.741, 0.742, 0.742, 0.744, 0.744, 0.745, 0.745, 0.746, 0.746, 0.746, 0.747, 0.748, 0.749, 0.749, 0.749, 0.751, 0.751, 0.752, 0.753, 0.754, 0.755, 0.756, 0.756, 0.756, 0.756, 0.756, 0.757, 0.758, 0.758, 0.758, 0.759, 0.759, 0.76, 0.76, 0.76, 0.761, 0.761, 0.763, 0.764, 0.764, 0.764, 0.765, 0.765, 0.765, 0.765, 0.766, 0.766, 0.766, 0.768, 0.768, 0.77, 0.77, 0.77, 0.771, 0.771, 0.772, 0.772, 0.772, 0.773, 0.774, 0.777, 0.777, 0.778, 0.778, 0.778, 0.778, 0.779, 0.78, 0.78, 0.78, 0.78, 0.78, 0.781, 0.784, 0.784, 0.785, 0.786, 0.786, 0.787, 0.787, 0.789, 0.789, 0.791, 0.791, 0.791, 0.795, 0.795, 0.796, 0.796, 0.797, 0.798, 0.8, 0.803, 0.803, 0.805, 0.806, 0.806, 0.806, 0.807, 0.808, 0.81, 0.81, 0.811, 0.814, 0.815, 0.817, 0.817, 0.817, 0.823, 0.824, 0.824, 0.824, 0.824, 0.826, 0.828, 0.83, 0.831, 0.834, 0.835, 0.835, 0.835, 0.841, 0.843, 0.844, 0.847, 0.848, 0.852, 0.854, 0.855, 0.857, 0.857, 0.86, 0.861, 0.861, 0.862, 0.867, 0.888, 0.888, 0.892, 0.898, 0.898, 0.9, 0.901, 0.903, 0.904, 0.908, 0.909, 0.919, 0.923, 0.927, 0.928, 0.932], "color": "#ef4444", "dash": "6 4"}]}
```

A threshold is a single vertical line through both curves. A real cache only compares a new question against what it has stored, so this is not a hit rate. But it shows the problem: no line sits to the right of the whole red curve without also sitting to the right of almost all of the green one. The two overlap across nearly their whole range.

The overlap was large for every model we tried:

| Embedding model              | Median, same answer | Median, near-miss | Most similar near-miss | Near-miss pairs above the median paraphrase |
| ---------------------------- | ------------------- | ----------------- | ---------------------- | ------------------------------------------- |
| `bge-m3`                     | 0.723               | 0.646             | 0.932                  | 22.8%                                       |
| `gte-large-en-v1.5`          | 0.771               | 0.707             | 0.958                  | 27.1%                                       |
| `qwen3-embedding-0.6b`       | 0.756               | 0.685             | 0.949                  | 22.6%                                       |
| `multi-qa-mpnet-base-dot-v1` | 0.684               | 0.577             | 0.927                  | 23.5%                                       |
| `e5-large-v2`                | 0.861               | 0.837             | 0.982                  | 36.2%                                       |
| `all-mini-lm-l6-v2`          | 0.849               | 0.795             | 0.991                  | 36.2%                                       |

For at least one near-miss pair in five, the two questions that need _different_ answers look more alike to the embedding model than a typical pair of questions that need the _same_ one. Embedding models are trained to put questions about the same topic close together, and near-miss pairs are exactly that: the same topic, one word apart.

## The sweep

We replayed the 288 questions through the cache at every threshold from 0.50 to 0.99, in 20 different random orders. The order matters, because which phrasing arrives first decides what the cache stores and what later questions get matched against. Each threshold gets its own replay, since a question that hits at 0.80 is not stored, while the same question at 0.90 misses and is.

```chart
{"type": "line", "title": "Right and wrong cache hits for bge-m3, by threshold", "caption": "Mean per run of 288 questions, over 20 orderings. A wrong hit is a stored answer served for a question with a different intended answer.", "x": ["0.70", "0.71", "0.72", "0.73", "0.74", "0.75", "0.76", "0.77", "0.78", "0.79", "0.80", "0.81", "0.82", "0.83", "0.84", "0.85", "0.86", "0.87", "0.88", "0.89", "0.90", "0.91", "0.92", "0.93", "0.94", "0.95"], "series": [{"name": "Right hits", "data": [117.3, 117.8, 114.9, 109.9, 105.3, 98.9, 90.2, 86.1, 80.7, 72.7, 62.2, 58.6, 50.4, 40.9, 35.5, 27.4, 22.1, 16.9, 10.2, 6.8, 4, 3, 3, 1, 0, 0], "color": "#10b981"}, {"name": "Wrong hits", "data": [76.1, 71.2, 65.8, 61.9, 55.9, 53.1, 47.6, 41.7, 38.6, 35.0, 29.9, 28.6, 26.1, 21.6, 20, 16.4, 15.1, 12.7, 13.5, 13.3, 10, 5, 4, 1, 0, 0], "color": "#ef4444"}]}
```

At the low end the cache hits often and is wrong often. As the threshold rises, right hits fall away faster than wrong ones, because the near-miss pairs share their wording and the paraphrases, on purpose, do not. From 0.88 to 0.92, the few hits that remained were more often wrong than right. At 0.93 there was one of each, and above that none at all.

**The same number means something different on each model.** At 0.80:

| Embedding model              | Hit rate | Right hits | Wrong hits | Share of hits that were right |
| ---------------------------- | -------- | ---------- | ---------- | ----------------------------- |
| `bge-m3`                     | 32.0%    | 62.2       | 29.9       | 68%                           |
| `gte-large-en-v1.5`          | 52.7%    | 100.8      | 50.9       | 66%                           |
| `qwen3-embedding-0.6b`       | 44.8%    | 83.4       | 45.7       | 65%                           |
| `multi-qa-mpnet-base-dot-v1` | 28.1%    | 56.6       | 24.4       | 70%                           |
| `e5-large-v2`                | 88.0%    | 88.8       | 164.6      | 35%                           |
| `all-mini-lm-l6-v2`          | 76.5%    | 93.4       | 126.9      | 42%                           |

A threshold is only meaningful next to the model that produced the scores. Advice like "use 0.85" without naming the embedding model is not advice.

## What a wrong hit looks like

This is `npm run show-wrong-answers`, which replays one ordering and prints every question that was answered with another question's answer:

````terminal
{
  "title": "EMBED_MODEL=bge-m3 THRESHOLD=0.85 npm run show-wrong-answers",
  "autoplay": false,
  "steps": [
    {
      "comment": "two of the 18 wrong answers in this run, excerpted"
    },
    {
      "cmd": "EMBED_MODEL=bge-m3 THRESHOLD=0.85 npm run show-wrong-answers",
      "output": "bge-m3, threshold 0.85, ordering 0: 46 hits, 18 wrong\n\nasked     How do I undo a commit that I already pushed to main?\nmatched   How do I undo my last commit that I have not pushed yet?   (similarity 0.861, its near-miss partner)\nserved    ```bash\n      # Undo the last local commit but keep the changes staged\n      git reset --soft HEAD~1\n      # Undo the last local commit and keep the changes in your working tree (unstaged)\n\nasked     Reload nginx configuration on Ubuntu\nmatched   Restart nginx on Ubuntu   (similarity 0.854, its near-miss partner)\nserved    ```bash\n      # Restart using systemd (Ubuntu 16.04+)\n      sudo systemctl restart nginx\n      # Verify it’s running"
    }
  ]
}
````

For 12 of the pairs we marked which answer does more damage when it is served for the other question. Those labels are judgment calls and they are in the repo so anyone can argue with them. At 0.90 on `bge-m3`, which is a high setting for that model:

```text
bge-m3 at 0.90: 10.0 near-miss wrong answers per run, 2.5 of them the more destructive answer
    asked rotate-db-password-production  got rotate-db-password-staging     in 17 of 20 runs (21 times)
    asked cdn-purge-one                  got cdn-purge-all                  in 12 of 20 runs (12 times)
    asked ssh-rotate-user-key            got ssh-rotate-host-key            in 10 of 20 runs (10 times)
    asked docker-stop                    got docker-kill                    in 6 of 20 runs (6 times)
```

Someone asking how to rotate the **production** database password got the answer written for **staging** in 17 of the 20 runs. The recorded answers show why that matters: none of the six staging answers mentions avoiding downtime, and three of the six production answers do.

## What it actually saves

Every question now pays for an embedding call, hit or miss. Every miss still pays for the full answer. These figures are built from API timings and token counts measured on DigitalOcean one question at a time, then replayed through the cache; they are not timings from a deployed cache:

|                               | Mean per question | p50    | p95     | Cost per 1,000 questions |
| ----------------------------- | ----------------- | ------ | ------- | ------------------------ |
| No cache                      | 8.66 s            | 8.33 s | 14.53 s | $0.2534                  |
| bge-m3 at 0.70                | 3.48 s            | 0.53 s | 13.14 s | $0.0871                  |
| bge-m3 at 0.80                | 6.56 s            | 7.03 s | 14.54 s | $0.1775                  |
| bge-m3 at 0.90                | 8.74 s            | 8.69 s | 15.05 s | $0.2414                  |
| bge-m3 at 0.95 (nothing hits) | 9.17 s            | 8.89 s | 15.05 s | $0.2537                  |

Three things stand out.

**The money is small.** On `gpt-oss-120b` at DigitalOcean's [published prices](https://docs.digitalocean.com/products/ai-platform/details/pricing/), answering 1,000 of these questions costs about 25 cents. At 0.80 the cache saves 7.6 cents of that, and serves about 104 wrong answers per 1,000 questions to do it. Embedding every question cost a fraction of a cent across the whole run; the cache's overhead is time, not money.

**The average improves, the tail barely does.** A miss now costs an embedding call plus the answer. At 0.80, p95 was about 14.5 seconds with the cache and without it. It falls only at lower thresholds: at 0.70, p95 was 13.1 seconds, and 39 percent of the hits were wrong.

**A cache that never hits is pure overhead.** At 0.95 and above, nothing hit and every question paid about half a second extra for its embedding.

## The fix everyone reaches for

If the embedding cannot tell restart from reload, ask a model that can. Before serving a hit, send both questions to a small, cheap model with one instruction: would exactly the same answer be correct for both? Serve the hit only if it says yes.

We ran that with `gpt-oss-20b` as the verifier, in front of `bge-m3`, over the same 20 orderings. Every candidate hit was checked; 1,162 distinct question pairs in all.

| Threshold | Without verifier: hit rate | Wrong | With verifier: hit rate | Wrong | Right hits it rejected | Mean per question | Cost per 1,000 |
| --------- | -------------------------- | ----- | ----------------------- | ----- | ---------------------- | ----------------- | -------------- |
| 0.70      | 67.2%                      | 76.1  | 40.1%                   | 0.3   | 29.6                   | 8.57 s            | $0.2773        |
| 0.75      | 52.8%                      | 53.1  | 32.0%                   | 0.5   | 21.9                   | 8.59 s            | $0.2679        |
| 0.80      | 32.0%                      | 29.9  | 21.2%                   | 0.5   | 9.9                    | 8.70 s            | $0.2577        |
| 0.85      | 15.2%                      | 16.4  | 9.8%                    | 0.5   | 3.0                    | 8.91 s            | $0.2540        |
| 0.90      | 4.9%                       | 10.0  | 1.2%                    | 0.5   | 1.0                    | 9.22 s            | $0.2569        |
| no cache  |                            |       |                         |       |                        | 8.66 s            | $0.2534        |

**It works.** Wrong answers dropped from as many as 76 per run to under one on average, and never more than two in any run, at every threshold we tried. At 0.70 the verified cache still served 40 percent of questions from memory. The only two pairs it let through were both memory request against memory limit. It erred the other way far more: it turned down 146 of the 701 genuine paraphrase pairs it was shown, which is where the lost hits went.

**And it defeats the point.** The mean response time with the verifier, 8.6 seconds at 0.70, is the same as with no cache at all. Each check took 3.2 seconds at the median, and it runs on every candidate hit, including the ones it then rejects, which also pay for a fresh answer. The cost went up too: $0.28 per 1,000 questions at 0.70, against $0.25 with no cache.

The reason is in the token counts. The verifier replies with one word, `same` or `different`, and is billed for a median of **283 completion tokens** to produce it, because it is a reasoning model and reasons first. The answers it was saving had a median of 324. At the smaller model's lower price, a median check still cost about 57 percent of a median answer, and it runs more often than there are hits to save.

A small non-reasoning model could be faster and cheaper per check. We did not test one, and it would have to be just as reliable on exactly the pairs where the embedding models failed.

## Where a semantic cache is safe

The corpus above is built from real paraphrases: different words, same question. Real traffic also contains plenty of near-verbatim repeats, the same question again with trivial differences. We made one of those for every question: lower case, no question mark, and sometimes a prefix such as "hey," or "quick one:", and compared how similar each question is to its own repeat against how similar the near-miss pairs get.

| Embedding model              | Lowest-scoring repeat | Most similar near-miss | Repeats scoring above every near-miss |
| ---------------------------- | --------------------- | ---------------------- | ------------------------------------- |
| `bge-m3`                     | 0.856                 | 0.932                  | 244 of 288                            |
| `gte-large-en-v1.5`          | 0.882                 | 0.958                  | 258 of 288                            |
| `qwen3-embedding-0.6b`       | 0.848                 | 0.949                  | 210 of 288                            |
| `multi-qa-mpnet-base-dot-v1` | 0.866                 | 0.927                  | 274 of 288                            |
| `e5-large-v2`                | 0.945                 | 0.982                  | 186 of 288                            |
| `all-mini-lm-l6-v2`          | 0.924                 | 0.991                  | 225 of 288                            |

For every model, most trivial repeats scored higher against their own original than any near-miss pair in the corpus scored against each other. That suggests a threshold set just above your worst near-miss would catch most such repeats without serving a near-miss. We did not replay the repeats through the cache, and a repeat could still score higher against some other question, so treat it as a likely saving rather than a measured one. It is also much closer to an exact-match cache than to the semantic one people have in mind. Case, punctuation and a greeting are exactly what a normalised exact-match key would catch, with no embedding call. Normalisation has risks of its own and we did not measure that comparison, but it is the baseline a semantic cache has to beat for this kind of repeat. And the high threshold only works if you have measured your own near-miss pairs to find where "just above" is.

## What we could not conclude

- **How often near-misses happen in real traffic.** This corpus puts every question's near-miss partner in the stream, which is a deliberately difficult case for a cache. The hit rates and wrong-answer counts depend on how repetitive your traffic is and how many near-misses it contains, and only your own logs can say.
- **Whether every counted wrong answer was actually wrong.** Hits are scored against our intent labels, not by reading each answer, and the labels are not perfect. "Empty Redis database 2 only" sits in the same intent as "clear only the current database", though it needs one more command. We read the damaging examples in this post by hand; we did not grade all of them.
- **Other cache designs.** This is one global cosine threshold over the question alone, with nearest-neighbour lookup. Partitioning the cache by environment or resource, or only caching some kinds of answer, would behave differently, and we did not test them.
- **Anything beyond ops questions in English.** 24 pairs, one domain, one language.
- **How much of this is the embedding models and how much is the corpus.** We wrote the paraphrases to vary their wording and the near-miss pairs to share theirs. A corpus with closer paraphrases could give higher hit rates; we did not test one.
- **Statistical intervals.** The 20 orderings are replays of one fixed set of questions, not independent samples, so the ranges we report are spread across orderings, not confidence intervals.
- **Vector database latency.** The in-memory search measured 1 to 3 ms. A vector store across the network would add its own round trip, which we did not measure.
- **Whether a wrong answer would have been acted on.** We counted wrong answers served, not wrong actions taken.

## What we would do

1. **Build your own near-miss set before you pick a threshold.** Write down the questions your users ask that differ by one word and need different answers. Score them with your embedding model. Your threshold has to sit above the most similar of those pairs, and that number is specific to the model and to your domain.
2. **Treat a threshold as a property of a model.** Changing the embedding model without re-measuring changes what the cache does, sometimes from mostly right to mostly wrong at the same setting.
3. **Keep answers that act on things out of the cache.** An explanation of what a readiness probe is can be served twice. A command to run against production should not come from a question that merely looked similar.
4. **Put the key facts in the key.** The expensive mistakes here were a word apart: staging or production, one database or all of them, pushed or not. If the environment, the resource and the verb are part of the cache key, the similarity search never gets the chance to confuse them.
5. **Measure the whole trip.** The embedding call is paid on every question, and it makes every miss slower. Count it before deciding the cache saves anything.
6. **If you add a verifier, price it.** Checking each hit with a model made the cache correct here, but no faster and dearer than no cache, because the verifier reasoned its way to a one-word answer. Measure it on your own near-miss pairs and count its tokens before you ship it.

The harness, the 288 labelled questions, every embedding and answer, and the scripts that reproduce every number here are in the repo.
