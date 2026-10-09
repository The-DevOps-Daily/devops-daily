---
title: 'Queue or Log? Kafka, RabbitMQ and NATS All Do Both Now'
excerpt: 'Kafka has queues, RabbitMQ has streams, and NATS JetStream does both, so the broker is no longer the choice. We ran replay, a poison message, extra consumers and a retry through six setups. Two settings decided every result. We also found that RabbitMQ 4.3 quietly stops dead-lettering poison messages for consumers that nack.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-10-09'
publishedAt: '2026-10-09T09:00:00Z'
updatedAt: '2026-10-09T09:00:00Z'
readingTime: '16 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Kafka
  - RabbitMQ
  - NATS
  - Messaging
  - Event Streaming
  - System Design
  - DevOps
---

"Do we need a queue or a log?" used to mean "RabbitMQ or Kafka?" That is no longer true. Apache Kafka 4.2, released in February, made [share groups](https://kafka.apache.org/blog/2026/02/17/apache-kafka-4.2.0-release-announcement/) production ready. A share group is a queue on a Kafka topic: many consumers read the same partition, and each record is acknowledged on its own. RabbitMQ has had [streams](https://www.rabbitmq.com/docs/streams) since 3.9, which are append-only logs that consumers read from an offset. NATS JetStream lets you choose, per stream, whether a message is deleted when it is acknowledged or kept until a limit.

So all three brokers can be both. We wanted to know what that means in practice, so we ran the same four failure cases against six setups on Kafka 4.3.1, RabbitMQ 4.3.6 and NATS 2.15.0:

- replay after a bad deploy
- one poison message
- more consumers than partitions
- the order of events after a retry

Two settings explained every result, whatever the broker: does the storage keep a message after it is handled, and does the consumer acknowledge each message or keep an offset?

Two results surprised us:

- **RabbitMQ:** since RabbitMQ 4.3, a quorum queue's delivery limit ignores `basic.nack`. With `x-delivery-limit` set to 5 and a dead letter queue, a poison message was retried more than 6,000 times in 45 seconds. The same code on RabbitMQ 4.2.9 dead-lettered it after 6 deliveries. If your consumers nack, upgrading to 4.3 turns off your poison message handling.
- **Kafka:** a share group with six consumers gave work to only three of them, because each consumer takes whole producer batches.

## TLDR

- Choose two things, not a broker. **Storage:** does it keep messages after they are handled? **Consumption:** per-message acknowledgements, or an offset?
- **Replay** worked on every setup whose storage keeps messages, including setups with per-message acks: a Kafka share group and a NATS limits stream. It returned nothing on a RabbitMQ quorum queue and a NATS work-queue stream.
- **Poison messages:**
  - The two offset readers stopped at the poison message: 10 of 100 messages handled.
  - The Kafka share group and both NATS setups gave up on it after 5 deliveries and handled the other 99.
  - The RabbitMQ 4.3 quorum queue gave up only when the consumer used `basic.reject`. With `basic.nack` it looped. On RabbitMQ 4.2.9, both calls dead-lettered the message.
- **More consumers than partitions:**
  - The consumer group used 3 of 6 consumers, one per partition.
  - The share group also used only 3, until the producer sent one record per batch. Then all 6 got work.
  - Each consumer of a RabbitMQ stream read all 120 messages.
- **Order after a retry:**
  - The offset readers kept per-key order in 5 of 5 runs.
  - The per-message-ack setups lost it whenever more than one message was in flight.
  - The Kafka share group lost it even with `max.poll.records=1`.

## Prerequisites

- Docker, and Python 3.10 or later
- Basic familiarity with consumer groups and acknowledgements
- Optional: the demo repository, which runs every experiment in this post:

```github
The-DevOps-Daily/queue-or-log
```

## Two choices, not one

A "queue" and a "log" each bundle two separate decisions. Pull them apart and the six setups we tested fit in one table:

| Setup                            | Storage keeps handled messages | Consumer tracks                      |
| -------------------------------- | ------------------------------ | ------------------------------------ |
| Kafka consumer group             | yes                            | one offset per partition             |
| Kafka share group                | yes                            | each record: accept, release, reject |
| RabbitMQ quorum queue            | no                             | each message: ack, nack, reject      |
| RabbitMQ stream                  | yes                            | one offset                           |
| NATS JetStream work-queue stream | no                             | each message: ack, nak               |
| NATS JetStream limits stream     | yes                            | each message: ack, nak               |

**Storage** decides what happens after a message is handled. A quorum queue and a work-queue stream delete it. A Kafka topic, a RabbitMQ stream and a NATS limits stream keep it until retention removes it.

**Consumption** decides what a consumer remembers. An offset reader remembers a single position: everything before it is done. A per-message reader remembers each message's state, so one message can fail while the next one succeeds.

The fourth combination, storage that deletes handled messages read with an offset, does not exist. Kafka offers two of the three useful combinations, RabbitMQ offers two through its two queue types, and NATS offers all three: its ordered consumers read without acknowledgements, like an offset reader, but we did not test them.

On a failure, each setup used its own mechanism, set up the way its documentation recommends:

- The share group released the record.
- The quorum queue got a `basic.nack`, and in a second run a `basic.reject`.
- NATS got a `nak`.
- The two offset readers went back to the failed offset and tried again. An offset reader has no broker-side way to set one message aside: if it moves past a message, that message counts as done.

The brokers ran as single nodes on a Raspberry Pi 4. The results describe behaviour, not throughput, and every number comes from the JSON files in the repository's `runs/` directory.

```terminal
{
  "title": "the brokers under test",
  "prompt": "$",
  "steps": [
    { "cmd": "docker exec qol-kafka /opt/kafka/bin/kafka-topics.sh --version", "output": "4.3.1" },
    { "cmd": "docker exec qol-kafka /opt/kafka/bin/kafka-features.sh --bootstrap-server localhost:9092 describe | grep share", "output": "Feature: share.version                             SupportedMinVersion: 0                SupportedMaxVersion: 1                FinalizedVersionLevel: 1                Epoch: 7146" },
    { "cmd": "docker exec qol-rabbit rabbitmqctl version", "output": "4.3.6" },
    { "cmd": "docker exec qol-nats nats-server --version", "output": "nats-server: v2.15.0" }
  ]
}
```

Share groups need no extra setup on Kafka 4.3: `share.version` is finalized at level 1 on a new cluster.

## Experiment 1: replay after a bad deploy

The scenario is common. A consumer shipped with a bug and handled 1,000 messages wrong, so after the fix you want those 1,000 messages again. Each setup handled 1,000 messages and acknowledged them all. Then we tried to read them a second time, in whatever way the setup allows.

| Setup                  | How we tried to read again                                                   | Messages read again |
| ---------------------- | ---------------------------------------------------------------------------- | ------------------- |
| Kafka consumer group   | `kafka-consumer-groups.sh --reset-offsets --to-earliest`                     | 1,000               |
| Kafka share group      | same group again, then `kafka-share-groups.sh --reset-offsets --to-earliest` | 0, then 1,000       |
| RabbitMQ quorum queue  | consume again                                                                | 0                   |
| RabbitMQ stream        | a new consumer with `x-stream-offset: first`                                 | 1,000               |
| NATS work-queue stream | a new consumer (the stream held 0 messages)                                  | 0                   |
| NATS limits stream     | a new durable consumer with `deliver_policy: all`                            | 1,000               |

Replay followed storage, not consumption. The share group and the NATS limits stream hand out work one message at a time, like a queue, and both replayed all 1,000, because the messages were still on disk. The quorum queue and the work-queue stream deleted each message when it was acknowledged, so after the first pass there was nothing to replay.

That changes the old advice. "Use Kafka if you might need to replay" was really "use storage that keeps messages". With share groups, you can have queue-style workers and keep the replay. The cost is the retention you pay for. The reset also has a rule: `kafka-share-groups.sh --reset-offsets` refuses to run while the group has active members, so you stop the workers first.

## Experiment 2: one poison message

One message out of 100, number 10, made the handler fail every time. Each setup had 45 seconds and used its own failure path.

| Setup                                                             | Other messages handled (of 99) | Attempts on the poison message | Where it ended                            |
| ----------------------------------------------------------------- | ------------------------------ | ------------------------------ | ----------------------------------------- |
| Kafka consumer group                                              | 10 (0 to 9), then stuck        | 89                             | still the next offset                     |
| Kafka share group                                                 | 99                             | 5                              | archived by the group, still in the topic |
| RabbitMQ quorum queue, defaults, `basic.nack`                     | 99                             | 5,383                          | still in the queue                        |
| RabbitMQ quorum queue, limit 5, dead letter queue, `basic.nack`   | 99                             | 6,064                          | still in the queue                        |
| RabbitMQ quorum queue, limit 5, dead letter queue, `basic.reject` | 99                             | 6                              | in the dead letter queue                  |
| RabbitMQ stream                                                   | 10 (0 to 9), then stuck        | 928                            | still the next offset                     |
| NATS work-queue stream, `max_deliver` 5                           | 99                             | 5                              | left in the stream                        |
| NATS limits stream, `max_deliver` 5                               | 99                             | 5                              | left in the stream                        |

The two offset readers handled messages 0 to 9 and then stopped. Nothing behind the poison message moved for the rest of the 45 seconds, while the reader retried it 89 times (Kafka) and 928 times (RabbitMQ stream). This is not a broker bug. An offset reader has exactly two options: retry in place and block the partition, or skip the message and lose it unless your code writes it somewhere first. Kafka's dead letter topics today, such as the ones in Kafka Connect and Spring Kafka, are client or framework code making that second choice.

The share group did what a queue should do. It delivered the poison message 5 times, which is the default `share.delivery.count.limit`, then archived it and handled the other 99. Archived means no member of that share group gets it again. The record is not deleted: after the run, a plain consumer read offset 10 and got the poison message back. Kafka 4.3 does not copy it anywhere for you, though. [KIP-1191](https://cwiki.apache.org/confluence/display/KAFKA/KIP-1191:+Dead-letter+queues+for+share+groups), accepted in January, adds a dead-letter topic for share groups and is planned for Kafka 4.4, which was in release candidates when we ran these tests.

NATS behaved the same way. After 5 deliveries, the consumer stopped delivering the message and the server published one `$JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES` advisory, which we caught by subscribing during the run. The message stayed in the stream in both cases: in the work-queue stream it was the only one left, and in the limits stream all 100 remained.

### RabbitMQ 4.3: nack no longer counts

The quorum queue rows are the ones to check in your own code. Quorum queues have had a delivery limit of 20 by default since RabbitMQ 4.0, and we set `x-delivery-limit` to 5 with a dead letter queue. With a consumer that failed with `basic.nack(requeue=True)`, the poison message never reached the dead letter queue. It was retried 6,064 times in 45 seconds, about 135 times a second, and was still in the queue when the test ended. The same queue with `basic.reject(requeue=True)` dead-lettered it after 6 deliveries, which is the first delivery plus 5 redeliveries:

```terminal
{
  "title": "2_poison.py (excerpt of the recorded output)",
  "prompt": "$",
  "autoplay": false,
  "steps": [
    { "cmd": "../.venv/bin/python 2_poison.py", "output": "    \"rabbitmq quorum queue (limit 5 + dead letter, basic.nack)\": {\n      \"others_handled\": 99,\n      \"poison_attempts\": 6064,\n      \"seconds\": 45.0,\n      \"dead_letter_count\": 0,\n      \"dead_letter_body\": null,\n      \"messages_left\": 1,\n      \"poison_ends\": \"still in the queue, retried in a loop\"\n    },\n    \"rabbitmq quorum queue (limit 5 + dead letter, basic.reject)\": {\n      \"others_handled\": 99,\n      \"poison_attempts\": 6,\n      \"seconds\": 4.1,\n      \"dead_letter_count\": 1,\n      \"dead_letter_body\": \"10\",\n      \"messages_left\": 0,\n      \"poison_ends\": \"in the dead letter queue\"\n    }," }
  ]
}
```

This is new, and it is documented. The [RabbitMQ 4.3 release post](https://www.rabbitmq.com/blog/2026/04/23/rabbitmq-4.3-release) from April 23 says: "Up to RabbitMQ 4.2, every requeued message incremented its `delivery-count` by 1, regardless of the reason." From 4.3, the queue keeps two counters. `acquired-count` goes up on every requeue. `delivery-count`, which the limit is checked against, goes up only on a failed delivery, and a `basic.nack` does not count as one. In the post's words: "messages returned _without_ marking the attempt as a failure no longer count toward the limit."

We ran the same test, limit 5 and a dead letter queue, on both versions:

| RabbitMQ | `basic.nack`                                     | `basic.reject`                 |
| -------- | ------------------------------------------------ | ------------------------------ |
| 4.2.9    | dead-lettered after 6 attempts                   | dead-lettered after 6 attempts |
| 4.3.6    | 3,839 attempts in 30 seconds, still in the queue | dead-lettered after 6 attempts |

So a consumer that nacks failed messages, which is common because only `basic.nack` can return several messages at once, handled poison messages correctly on 4.2 and loops on them after an upgrade to 4.3. Check which call your consumer or framework makes:

```python
# Counts towards x-delivery-limit, so the message is dead-lettered
# (or dropped, without a DLX) once the limit is reached.
channel.basic_reject(delivery_tag, requeue=True)

# From RabbitMQ 4.3 this does NOT count: the same poison message
# comes straight back, forever. Up to 4.2 it counted.
channel.basic_nack(delivery_tag, requeue=True)
```

:::warning
A consumer that nacks a poison message in a loop holds a CPU core and floods your logs with errors, but the queue depth looks normal. The messages behind it still flow, so throughput graphs look healthy too. Watch the redelivery rate as well as the queue depth.
:::

## Experiment 3: more consumers than partitions

120 messages, each taking 50 ms to handle, spread over a Kafka topic with 3 partitions. A single consumer needs about 6 seconds and six consumers about 1. We ran six consumers on each setup.

```chart
{
  "type": "bar",
  "title": "Consumers that got work, out of six",
  "caption": "120 messages of 50 ms each. The Kafka topics had 3 partitions. Each RabbitMQ stream consumer read all 120 messages, so its six busy consumers did the same work six times. Recorded in runs/3_parallel.json.",
  "rows": [
    { "label": "Kafka consumer group", "value": 3, "series": "Offset" },
    { "label": "Kafka share group", "value": 3, "series": "Per-message ack" },
    { "label": "Share group, max.poll.records=1", "value": 3, "series": "Per-message ack" },
    { "label": "Share group, one record per batch", "value": 6, "series": "Per-message ack" },
    { "label": "RabbitMQ quorum queue", "value": 6, "series": "Per-message ack" },
    { "label": "NATS work-queue stream", "value": 6, "series": "Per-message ack" },
    { "label": "NATS limits stream", "value": 6, "series": "Per-message ack" }
  ],
  "series": [
    { "name": "Offset", "color": "#94a3b8" },
    { "name": "Per-message ack", "color": "#f59e0b" }
  ]
}
```

| Setup                                            | Messages per consumer  | First to last handle |
| ------------------------------------------------ | ---------------------- | -------------------- |
| Kafka consumer group                             | 0, 0, 40, 40, 40, 0    | 2.1 s                |
| Kafka share group, defaults                      | 40, 40, 0, 0, 0, 40    | 6.0 s                |
| Kafka share group, `max.poll.records=1`          | 0, 40, 0, 0, 40, 40    | 7.1 s                |
| Kafka share group, one record per producer batch | 21, 19, 20, 19, 20, 21 | 1.3 s                |
| RabbitMQ quorum queue, prefetch 1                | 20 each                | 1.1 s                |
| RabbitMQ stream                                  | 120 each (720 handles) | 6.1 s                |
| NATS work-queue stream                           | 20 each                | 1.1 s                |
| NATS limits stream                               | 20 each                | 1.1 s                |

The consumer group result is the one everybody knows: one partition goes to one member, so three of the six members sat idle.

The share group result is the surprise. Share groups exist so that more consumers than partitions can share the work, and here they did not. Three members got all 40 records of a partition each, and three got nothing. Setting `max.poll.records` to 1 changed nothing.

The cause is how a share group hands out records. In the default acquire mode, `batch_optimized`, a member acquires whole producer batches, and `max.poll.records` is only a soft cap. Our producer batched records the way producers normally do, so each partition's 40 records sat in a single batch, and whichever member fetched first took the lot. When we produced every record as its own batch, the six members split the work almost evenly: 19 to 21 each, done in 1.3 seconds.

Jack Vanlightly's [series on share group parallelism](https://jack-vanlightly.com/blog/2026/5/27/kafka-share-groups-and-parallelizing-consumption-part-2-producer-batches-and-shareacquiremode) explains this in depth, along with the other acquire mode, `record_limit` ([KIP-1206](https://cwiki.apache.org/confluence/display/KAFKA/KIP-1206:+Strict+max+fetch+records+in+share+fetch)). That mode makes `max.poll.records` a strict cap. We could not test it: librdkafka 2.15, which the Python client uses, refuses `share.acquire.mode` with "No such configuration property". His follow-up post also warns about [fetch waits with record_limit](https://jack-vanlightly.com/blog/2026/6/24/kafka-share-groups-pathological-fetch-waits-with-recordlimit). The practical lesson: with small backlogs and normal producer batching, a share group spreads work much less evenly than its name suggests.

The RabbitMQ stream result is a different thing again. Every consumer of a stream reads every message, the way each Kafka consumer group gets its own copy of a topic. Six consumers meant 720 handles of 120 messages. To split a stream's work you need super streams, which are partitioned streams with a single active consumer per partition, and we did not test those.

The quorum queue and both NATS setups spread the work evenly with no tuning: 20 messages per consumer, done in about 1.1 seconds.

## Experiment 4: order after a retry

Ten events for one account, `e1` to `e10`, which must apply in order, like balance updates. The handler fails the first time it sees `e3` and succeeds after that. A single consumer reads, so any reordering comes from the retry path alone. Retry timing varies, so every setup ran five times.

| Setup                                                     | Runs in order | What happened                     |
| --------------------------------------------------------- | ------------- | --------------------------------- |
| Kafka consumer group                                      | 5 of 5        | `e3` retried in place             |
| RabbitMQ stream                                           | 5 of 5        | `e3` retried in place             |
| Kafka share group, defaults                               | 0 of 5        | `e3` handled last                 |
| Kafka share group, `max.poll.records=1`                   | 0 of 5        | `e3` handled last                 |
| RabbitMQ quorum queue, prefetch 10                        | 0 of 5        | `e3` handled last                 |
| RabbitMQ quorum queue, prefetch 1                         | 5 of 5        | `e3` came straight back           |
| NATS (both stream types), fetch 10                        | 0 of 5        | `e3` handled last                 |
| NATS (both stream types), fetch 1, `max_ack_pending` 1000 | 2 of 5        | a race: `e3` after `e4` in 3 runs |
| NATS (both stream types), fetch 1, `max_ack_pending` 1    | 5 of 5        | `e3` came straight back           |

The offset readers kept order every time, because they cannot do anything else: they retry the failed event before they read the next one.

The per-message-ack setups lost order whenever more than one message was in flight. The failed event went back to the broker while the consumer already held the next seven, so `e3` was applied after `e10`. They kept order only when exactly one message could be in flight: prefetch 1 on RabbitMQ, or `max_ack_pending` 1 on NATS. NATS with one message per fetch but many allowed in flight was a race. Redeliveries usually go out before new messages, but not always: in 3 of 5 runs, `e4` got in first.

The share group lost order even with `max.poll.records=1`, for the same reason as in experiment 3: the member acquired all ten records as one producer batch. With `e3` released back to the group, the member had already accepted `e4` to `e10`.

"One message in flight" has a price. It is exactly what an offset reader does on one partition. You get order, and you lose the parallelism that made you choose a queue. For per-key order with parallel workers, you need what a log gives you: route each key to a single place, one partition or one queue per key range, and keep one message in flight per key.

## Picking a setup

The experiments reduce to a few questions. Work through them in order:

1. **Will anyone need this message again after it is handled?** That includes a replay after a bug, a new consumer next month, or rebuilding a read model. If yes, use storage that keeps messages: a Kafka topic, a RabbitMQ stream or a NATS limits stream. This is a storage choice, so you can still hand out work one message at a time, with a share group or a NATS consumer.
2. **Does order per key matter?** If yes, read with offsets, partitioned by key, or limit each key to one message in flight. Accept that a poison message then blocks its partition until code skips it. Decide in advance where skipped messages go.
3. **Is each message an independent task?** If yes, use per-message acknowledgements. You get retries, a delivery limit, a place for poison messages and parallelism beyond the partition count. Then check the two defaults that caught us:
   - **RabbitMQ 4.3 and later:** fail with `basic.reject`, not `basic.nack`, or the delivery limit never fires.
   - **Kafka share groups:** expect producer batches, not records, to be the unit of work, unless your client supports `record_limit`.

For the broker-by-broker settings:

```tabs
{
  "title": "Poison message settings that worked in our runs",
  "tabs": [
    { "label": "RabbitMQ", "lang": "python", "code": "# Quorum queue with a delivery limit and a dead letter queue\nchannel.queue_declare('orders', durable=True, arguments={\n    'x-queue-type': 'quorum',\n    'x-delivery-limit': 5,\n    'x-dead-letter-exchange': '',\n    'x-dead-letter-routing-key': 'orders.dead',\n})\n\n# On failure: reject, not nack, so the delivery counts\nchannel.basic_reject(method.delivery_tag, requeue=True)" },
    { "label": "Kafka share group", "lang": "bash", "code": "# Delivery attempts before a record is archived (default 5)\nkafka-configs.sh --bootstrap-server localhost:9092 --alter \\\n  --entity-type groups --entity-name orders-workers \\\n  --add-config share.delivery.count.limit=5\n\n# In the consumer: release to retry, reject to give up now\n# consumer.acknowledge(msg, AcknowledgeType.RELEASE)\n# consumer.acknowledge(msg, AcknowledgeType.REJECT)" },
    { "label": "NATS JetStream", "lang": "python", "code": "# Pull consumer that gives up after 5 deliveries\nawait js.add_consumer('ORDERS', ConsumerConfig(\n    durable_name='workers',\n    ack_policy=AckPolicy.EXPLICIT,\n    max_deliver=5,\n    ack_wait=30,\n))\n\n# Then subscribe to the advisory to collect what was given up on:\n# $JS.EVENT.ADVISORY.CONSUMER.MAX_DELIVERIES.ORDERS.workers" }
  ]
}
```

## What we could not conclude

- **Throughput and latency at scale.** These are single-node brokers on a Pi. The results show what each setup does on a failure, not how fast it does it.
- **Share groups in `record_limit` mode.** The Python client cannot set `share.acquire.mode`. The Java client can, and that mode should spread small backlogs more evenly. We did not measure it.
- **RabbitMQ super streams, and Kafka's coming share group dead-letter topics.** Both would change parts of the tables above, and neither was in our setup.
- **Clients other than the three we used:** confluent-kafka 2.15.1, whose share consumer is still marked Preview, pika 1.3.2 and nats-py 2.16.0. A client that calls `basic.reject` for you will not hit the RabbitMQ loop.

## Summary

The broker you run no longer decides whether you have a queue or a log. Each of these three does both. What decides the behaviour is a pair of settings that teams rarely write down: whether storage keeps a handled message, and whether consumers acknowledge messages one by one or keep an offset. Replay follows the first. Poison handling, parallelism and ordering follow the second.

Before you pick, write down which of the four failures you can live with. Then test the two settings that surprised us: since RabbitMQ 4.3, `basic.nack` does not count towards the delivery limit, and a Kafka share group hands out batches, not records. The scripts are in [the repository](https://github.com/The-DevOps-Daily/queue-or-log), and each experiment runs in a few minutes against your own versions. For what happens when a worker dies halfway through a job, see [running a background job that must not be lost](/posts/running-a-background-job-that-must-not-be-lost). For when Kafka itself is the wrong tool, see [6 Apache Kafka use cases](/posts/kafka-use-cases).
