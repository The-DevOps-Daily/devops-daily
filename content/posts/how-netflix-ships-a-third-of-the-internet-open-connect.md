---
title: 'How Netflix Ships a Third of the Internet: The CDN They Had to Build'
excerpt: 'At its 2015 peak Netflix was 37% of North American downstream traffic, and almost none of it came from a commercial CDN. Open Connect is a cache hierarchy built on one asymmetry: Netflix knows tonight what people will watch tomorrow. Here is how the appliances, the nightly fill, the BGP steering and the 800 Gb/s FreeBSD boxes fit together, a runnable comparison of push fill against pull-through caching, and what it teaches anyone running a cache.'
category:
  name: 'Networking'
  slug: 'networking'
date: '2026-09-08'
publishedAt: '2026-09-08T09:00:00Z'
updatedAt: '2026-09-08T09:00:00Z'
readingTime: '18 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Networking
  - System Design
  - CDN
  - Caching
  - FreeBSD
  - Scalability
---

In December 2015, Sandvine's Global Internet Phenomena report put Netflix at 37.05% of all downstream bytes on North American fixed networks at peak. Add YouTube and the two of them were 55% of the evening internet. The title of this post is that number. Separately, Sandvine's 2018 report measured Netflix at about 15% of global downstream traffic, with video as a whole at 58%.

Almost none of those bytes travel through a commercial CDN. They come from Netflix's own network, Open Connect: as of December 2022, 18,000 servers in 6,000 locations across 175 countries, most of them sitting inside ISP networks on hardware Netflix gives away. Open Connect is a different kind of cache, built around one fact that a general-purpose CDN cannot have: Netflix knows its whole catalog, and it can predict, per region and per file, what people will watch tomorrow night.

This post walks through why the commercial model stopped fitting, what an Open Connect Appliance is, how a client gets steered to one, how the nightly fill works, and how a single FreeBSD box got to 400 and then nearly 800 Gb/s of TLS video. In the middle there is a small simulation you can run that shows the real difference between push fill and pull-through caching, and it is not the number most people expect. At the end: what all this teaches you about the caches you already run.

## TL;DR

- Netflix started Open Connect in 2011 for two reasons it states plainly: to work with ISPs directly as its traffic became a large share of theirs, and because a proactive, directed cache is far more efficient upstream than a demand-driven one.
- The unit is the Open Connect Appliance (OCA): a 2U FreeBSD server with up to 120 TB of flash serving about 200 Gbps, provided free to qualifying ISPs, or placed at internet exchanges and peered settlement-free.
- OCAs cache encoded media files (video, audio, subtitles, images) and nothing else. Steering lives in AWS: appliances report health, learned BGP routes and the files they hold; the control plane hands the client a URL to a specific appliance.
- Most on-demand content updates are downloaded during configured off-peak fill windows, ranked by predicted popularity per region and per file. Switching from title-level to file-level ranking in 2016 gave the same caching efficiency with half the storage.
- Fill escalates from peers in the same cluster, to appliances outside it, to S3 as a last resort. Netflix measures two things: caching efficiency and content churn.
- In our simulation, push fill beat a pull-through LRU cache on hit rate by a few points. The dramatic difference was elsewhere: the demand cache wrote 230 TB a day to a 2.2 TB disk during peak, the fill approach wrote between 130 and 240 GB a night, all of it off-peak.
- Serving 400 Gb/s of TLS from one server is a memory-bandwidth problem, not a CPU problem. NUMA-aware placement and NIC TLS offload were the fixes, and the 2022 talk showed close to 800 Gb/s.

## Prerequisites

Nothing to install for the reading. To run the simulation you need Python 3 and nothing else. It helps to know what an HTTP cache hit is and to have heard of BGP, the protocol networks use to tell each other which addresses they can reach.

## 2011: the numbers that broke the rental model

Netflix launched streaming in 2007 on third-party CDNs, and its own account of the period is generous to them: the commercial networks "were doing a great job delivering Netflix content." The commercial networks fitted a different shape of workload.

A conventional CDN, as most customers run it, is a pull-through cache. A viewer near an edge node asks for a file, the node does not have it, so it fetches from an upstream tier or the origin, stores a copy and serves it. The cache fills itself from demand. That is the right default when you do not know what will be requested, which is the situation for almost every CDN customer, and most CDNs also offer prefetch or pre-warm features for those who do. Run purely on demand, it has one built-in cost: misses happen when people are watching, so upstream traffic peaks exactly when the network is busiest, and every miss is a disk write on a machine that is also trying to read as fast as it can.

Netflix's 2011 numbers made that shape expensive in two directions at once. Its traffic was becoming a significant fraction of the total load on consumer ISPs, which meant the ISPs needed a direct relationship rather than a CDN vendor in between. And Netflix had knowledge the CDN could not use: a finite catalog, viewing history for every member, release schedules, marketing plans. In Netflix's own words from the Open Connect overview, a caching solution customized for its traffic could be "proactive" and "directed" rather than demand-driven, "reducing the overall demand on upstream network capacity by several orders of magnitude."

So Open Connect began in 2011 and was announced in 2012. By the 2016 anniversary post, Netflix said about 90% of its traffic globally was delivered over direct connections between Open Connect and ISPs, and that the appliance footprint had reached nearly 1,000 locations. The 2022 decade post gives the 18,000 servers and 6,000 locations, and adds an estimate aimed squarely at ISPs: Netflix reckons the program helped ISPs avoid $1.25 billion in spending in 2021, on transit, peering and network expansion they did not have to buy.

## The appliance

The Open Connect Appliance is the whole physical footprint of the system. Netflix publishes the current designs on its Open Connect site, and the two lines are deliberately narrow:

| | Storage appliance | Global appliance |
| --- | --- | --- |
| Form factor | 2U | 2U |
| Raw storage | up to 120 TB | up to 60 TB |
| Operational throughput | about 200 Gbps | about 80 Gbps |
| Peak power | about 400 W | about 250 W |
| Intended for | large ISPs and exchange points | smaller ISPs and emerging markets |

Both run FreeBSD with NGINX serving files over HTTP and HTTPS, and the BIRD routing daemon speaking BGP to the ISP's router. The parts list is ordinary server hardware: AMD processors, Mellanox and Broadcom network controllers, Kioxia or Micron SSDs. Netflix contributes its kernel work back to FreeBSD, which is why the details in the 400 Gb/s section below are public.

An OCA does exactly two things. It reports to the control plane in AWS: health, the BGP routes it has learned from the router it peers with, and which files it has on disk. And it serves files when a client asks. It holds no member data, no viewing history, no DRM keys. That narrowness limits the sensitive data that sits at the edge, and it means an appliance can be replaced by shipping a new box, which Netflix does at no cost to the partner when one degrades.

Appliances are deployed in two ways. Netflix installs them at internet exchange points in its significant markets and connects them to the ISPs present there through settlement-free peering, public or private. And it ships them, free of charge, to qualifying ISPs, who provide rack space, power and connectivity and install them inside their own networks. An embedded appliance has the same capabilities as one at an exchange. The ISP decides which of its customers are routed to it. Netflix says it partners with over a thousand ISPs on embedded deployments and runs appliances in more than 60 data centers of its own besides.

## Steering: the control plane hands out URLs

Because the appliances hold no state about members, the interesting decisions all happen in AWS, where the rest of Netflix runs. The playback flow from the overview document:

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "OCA reports", "sub": "health, BGP routes, files on disk", "icon": "server", "tone": "slate" },
    { "label": "Play request", "sub": "client asks AWS for a title", "icon": "globe", "tone": "blue" },
    { "label": "Playback service", "sub": "auth, licensing, which files", "icon": "gear", "tone": "violet" },
    { "label": "Steering service", "sub": "picks OCAs, builds URLs", "icon": "branch", "tone": "amber" },
    { "label": "Client streams", "sub": "HTTPS from the chosen OCA", "icon": "box", "tone": "green" }
  ]
}
```

Step by step:

1. Appliances periodically report health, the routes they have learned, and file availability to the cache control services in AWS.
2. A client device asks the Netflix application in AWS to play a title.
3. The playback services check authorization and licensing, then work out which specific files this device needs given its capabilities and current network conditions. A 4K TV on fibre and a phone on a weak cell connection need different encodes.
4. The steering service uses the cache control data to pick appliances that hold those files, are healthy, and are network-close to the client. It generates URLs pointing at those appliances.
5. The playback services hand the URLs to the client, and the client fetches the video directly from the appliance.

Two details matter more than they look. First, "network-close" is computed from BGP. The appliance reports which prefixes it has learned from the ISP's router, so the control plane knows that a client in a given address block sits behind that appliance. The ISP shapes this by what it announces. Second, the client gets a URL to one specific appliance, not a hostname that resolves to "the nearest edge." Failover is the client's job: it has a list and moves down it.

## Fill: the night shift

This is the part that makes Open Connect a different kind of cache. Netflix describes it in a 2016 engineering post titled "Netflix and Fill."

A new title arrives from the content operations pipeline: quality control, encoding into every bitrate and audio profile, packaging. The finished files land in Amazon S3, which is the origin. Once the title is flagged ready, the Open Connect systems take over.

The control plane does not push files at appliances. It computes, for each appliance, a manifest: the list of files it should hold, derived from the popularity ranking for that appliance's region and the storage it has. Appliances are grouped into manifest clusters, across which the control plane spreads a configured number of copies of each title, and manifest clusters are grouped into fill clusters that share a content region and a popularity feed. Each appliance then fetches what its manifest says it is missing, during its configured fill window, which the ISP and Netflix set to the ISP's off-peak hours.

Where it fetches from is a ranked escalation, and the ranking is the cost model of the whole network made explicit:

```diagram
{
  "type": "graph",
  "columns": [
    [ { "id": "oca", "label": "Appliance", "sub": "needs a file from its manifest", "icon": "server", "tone": "blue" } ],
    [
      { "id": "peer", "label": "Peer fill", "sub": "same cluster or subnet", "icon": "server", "tone": "green", "detail": "First choice: another appliance in the same manifest cluster or the same subnet. Traffic never leaves the site." },
      { "id": "tier", "label": "Tier fill", "sub": "outside the manifest cluster", "icon": "net", "tone": "amber", "detail": "Second choice: an appliance outside the manifest cluster, as far away as the escalation policy allows." },
      { "id": "origin", "label": "Cache fill", "sub": "direct from S3", "icon": "cloud", "tone": "red", "detail": "Last resort: download from the origin in AWS. This is the expensive path the escalation policy tries to avoid." }
    ],
    [ { "id": "disk", "label": "On disk", "sub": "ready to serve", "icon": "check", "tone": "green" } ]
  ],
  "edges": [ ["oca","peer","1"], ["oca","tier","2"], ["oca","origin","3"], ["peer","disk"], ["tier","disk"], ["origin","disk"] ]
}
```

Peer fill first: another appliance in the same manifest cluster or on the same subnet, so the copy moves across a rack or a campus. Tier fill second: an appliance outside the manifest cluster. Cache fill last: a direct download from S3. A fill escalation policy per appliance says how many hops away it may go and when it is allowed to escalate to the wider network or the origin.

To keep most appliances from ever needing the last option, the control plane elects a small number of appliances as masters for each title. Masters get a relaxed escalation policy, fetch the title from wherever they must, and then the non-masters pull it from them locally. Masters cut the number of long-distance fetches down to the configured few; everything else fills locally. When enough appliances hold the title, it is considered live for serving.

The 2016 post gives one more reason for doing all this at night that is easy to miss: disk efficiency. An appliance that is serving at 200 Gbps is reading flash as fast as it can. Writing new content at the same time means read/write contention on the same devices. Doing the writes in a window when reads are low reduces that contention. The demand-driven cache cannot make that choice, because its writes are its misses and its misses happen at peak.

### Predicting what to fill

The manifests are only as good as the popularity ranking behind them, and Netflix wrote about that separately in "Content Popularity for Open Connect." The post is candid about the tradeoffs.

Popularity is computed regionally, on the assumption that members in the same country share tastes. It was originally computed per title, which kept all of a title's files (every bitrate, every audio track) together on one appliance. That is simple, and it wastes space: the popular 1080p encode and the rarely watched 240p one get the same treatment. In 2016 most clusters moved to file-level ranking, and the result is one of the best single numbers in the whole story: "we were able to achieve the same caching efficiency with 50% of storage."

Prediction is not "tomorrow looks like today." Netflix smooths several days of history to predict the next day, which damps out one-night spikes. New titles have no history, so forecasts are adjusted for marketing intensity, and for some launches a human pins the title high in the ranking. There is a launch tomorrow; the model does not need to discover that.

The two metrics Netflix optimizes are worth writing down, because they are the right two for any cache:

- **Caching efficiency**: bytes served by a cluster divided by total bytes served to that cluster's traffic segment. This is a byte hit ratio, not a request hit ratio, and the distinction matters when files range from megabytes to tens of gigabytes.
- **Content churn**: how much content has to change on the appliances each day. Churn is fill traffic, and fill traffic is what the ISP and Netflix pay for. A ranking that chases every fluctuation buys a little efficiency with a lot of churn.

## Push fill versus pull-through, measured

The claims above are qualitative, so we wrote a small simulation to see what push fill buys and where. One appliance, one region, a catalog with Zipf-distributed popularity (a few files get most plays, a long tail gets few), popularity that drifts a little each day, and a disk that holds 3% of the catalog by bytes. Three strategies share the same requests:

- **demand**: a pull-through LRU cache. Every miss fetches upstream during peak and writes to disk.
- **fill**: nightly push of the highest-scoring files, scored from smoothed history, onto the whole disk. A miss is served upstream and not cached.
- **hybrid**: fill on 90% of the disk, a small LRU on the remaining 10% for surprises.

Here is the script. It is about 80 lines and has no dependencies.

```python
"""Proactive fill vs demand-driven caching on a Zipf catalog."""

import random
from collections import OrderedDict

random.seed(7)
TITLES = 20_000            # files in the catalog
DISK_SHARE = 0.03          # appliance holds 3% of the catalog by bytes
REQUESTS_PER_DAY = 200_000
DAYS = 7
ZIPF_S = 1.1
DRIFT = 0.02               # 400 random rank swaps per day at this setting

sizes = [random.choice([1, 2, 4, 8]) for _ in range(TITLES)]   # GB per file
cap_gb = int(sum(sizes) * DISK_SHARE)
weights = [1 / (r + 1) ** ZIPF_S for r in range(TITLES)]
order = list(range(TITLES))                       # order[rank] = title id

def draw_day():
    picks = random.choices(range(TITLES), weights=weights, k=REQUESTS_PER_DAY)
    return [order[r] for r in picks]

def drift():
    for _ in range(int(TITLES * DRIFT)):
        i, j = random.randrange(TITLES), random.randrange(TITLES)
        order[i], order[j] = order[j], order[i]

class LRU:
    def __init__(self, cap):
        self.cap, self.used, self.d = cap, 0, OrderedDict()
    def get(self, t):
        if t in self.d:
            self.d.move_to_end(t); return True
        while self.used + sizes[t] > self.cap and self.d:
            old, _ = self.d.popitem(last=False); self.used -= sizes[old]
        self.d[t] = 1; self.used += sizes[t]
        return False

demand = LRU(cap_gb)
fill_set, hyb_set, score, hybrid = set(), set(), {}, None
HYBRID_SHARE = 0.10   # hybrid keeps 10% of the disk as an LRU for surprises
print(f"catalog {sum(sizes)/1000:.0f} TB, appliance disk {cap_gb/1000:.1f} TB "
      f"({DISK_SHARE:.0%} of catalog), {REQUESTS_PER_DAY} plays/day")
print(f"{'day':>3} | {'demand: hit%':>12} {'peak up GB':>10} {'peak disk-write GB':>18} | "
      f"{'fill: hit%':>10} {'peak up GB':>10} {'offpeak fill GB':>15} | {'hybrid hit%':>11}")
for day in range(1, DAYS + 1):
    reqs = draw_day()
    # nightly fill: rank by smoothed history, pack the disk with the top files.
    # pure fill gets the whole disk; hybrid keeps HYBRID_SHARE of it for an LRU.
    ranked = sorted(score.items(), key=lambda kv: -kv[1])
    def manifest(capacity):
        chosen, used = set(), 0
        for t, _ in ranked:
            if used + sizes[t] <= capacity:
                chosen.add(t); used += sizes[t]
        return chosen
    new_set = manifest(cap_gb)
    fill_gb = sum(sizes[t] for t in new_set - fill_set)
    fill_set = new_set
    fill_cap = int(cap_gb * (1 - HYBRID_SHARE))
    hyb_set = manifest(fill_cap)
    if hybrid is None: hybrid = LRU(cap_gb - fill_cap)
    d_hit = d_up = f_hit = f_up = h_hit = 0
    today = {}
    for t in reqs:
        today[t] = today.get(t, 0) + 1
        if demand.get(t): d_hit += 1
        else: d_up += sizes[t]           # fetched upstream and written to disk, at peak
        if t in fill_set: f_hit += 1
        else: f_up += sizes[t]           # pure fill: a miss is just served upstream
        if t in hyb_set or hybrid.get(t): h_hit += 1
    # smooth several days of history instead of trusting yesterday alone
    for t in set(score) | set(today):
        score[t] = 0.6 * score.get(t, 0) + 0.4 * today.get(t, 0)
    print(f"{day:>3} | {100*d_hit/len(reqs):>11.1f}% {d_up:>10,} {d_up:>18,} | "
          f"{100*f_hit/len(reqs):>9.1f}% {f_up:>10,} {fill_gb:>15,} | {100*h_hit/len(reqs):>10.1f}%")
    drift()
```

And the run, exactly as it came out:

```terminal
{
  "title": "fill_vs_demand.py",
  "prompt": "$",
  "steps": [
    {
      "cmd": "python3 fill_vs_demand.py",
      "output": "catalog 75 TB, appliance disk 2.2 TB (3% of catalog), 200000 plays/day\nday | demand: hit% peak up GB peak disk-write GB | fill: hit% peak up GB offpeak fill GB | hybrid hit%\n  1 |        69.0%    230,086            230,086 |       0.0%    700,416               0 |       44.7%\n  2 |        69.1%    230,354            230,354 |      75.3%    180,872           2,246 |       75.4%\n  3 |        68.8%    231,124            231,124 |      70.7%    223,307             237 |       75.3%\n  4 |        68.9%    231,971            231,971 |      73.2%    197,922             145 |       75.3%\n  5 |        69.2%    229,480            229,480 |      73.9%    182,207             148 |       76.0%\n  6 |        69.0%    230,497            230,497 |      75.3%    181,123             134 |       75.4%\n  7 |        69.2%    228,980            228,980 |      73.7%    184,465             145 |       75.4%"
    }
  ]
}
```

Read it in two passes.

The hit rate is the smaller story. Once the fill has a night of history behind it, push fill lands between 70 and 75% and the hybrid around 75%, against 69% for the LRU. These are request-hit percentages for a synthetic workload: the gap is a few points, not orders of magnitude. Day one is the honest cost of push: with no history there is nothing to fill, and the pure fill strategy serves everything upstream until the first window.

The disk-write column is the larger story. The LRU wrote 230 TB a day to a 2.2 TB disk, every byte of it during peak, because a pull-through cache writes on every miss. The fill strategy wrote about 2 TB on its first real night and between 130 and 240 GB a night after that, all of it inside the off-peak window, because smoothed scores plus a slowly drifting catalog mean the manifest barely changes. That is the churn metric, and it is the difference between an appliance that is fighting itself all evening and one that is reading flash undisturbed. It is also the difference between fill traffic that costs an ISP something and fill traffic that rides idle capacity at 3 AM.

The model is deliberately small. There is one appliance rather than a cluster with files hashed across members, popularity is synthetic, and the LRU is a plain one rather than a smarter admission policy. Change the constants and the numbers move. What does not change is where the writes happen: the model moves the cache's disk writes off peak, while uncached requests still generate peak upstream traffic under every strategy.

## 400 Gb/s from one box, then 800

The appliance table above says "about 200 Gbps." Where that number comes from, and how it doubled and then doubled again, is documented in two talks by Drew Gallatin of Netflix at EuroBSDCon 2021 and 2022, and it is the best public account of what limits a modern server.

By 2020 a Netflix appliance served 200 Gb/s of TLS-encrypted video. The 2021 target was 400 Gb/s from a similar machine: an AMD EPYC 7502P with 32 cores, 256 GB of DDR4-3200 across eight channels for roughly 150 GB/s of memory bandwidth, two Mellanox ConnectX-6 Dx cards each with two 100 GbE ports, and 18 WD SN720 NVMe drives of 2 TB. The serving path is `sendfile(2)`: the kernel reads a file from NVMe into memory and hands it to the NIC without a copy into userspace. TLS is done in the kernel too, kTLS, with the handshake in userspace and the bulk encryption below it.

The arithmetic that decides everything: 400 Gb/s is 50 GB/s. With software kTLS, each byte crosses memory four times: disk to memory, memory to CPU for encryption, CPU back to memory, memory to NIC. That is about 200 GB/s of memory bandwidth to serve 400 Gb/s, on a machine that has 150. The CPU is not the bottleneck. The memory bus is.

Two changes got there. The first was NUMA. The EPYC package is four NUMA domains connected by an internal fabric with roughly 47 GB/s per link. If a file is read by a drive attached to one domain, encrypted by a core in another, and transmitted by a NIC in a third, the bulk data crosses that fabric several times and congests it. Gallatin's slides walk through the options: run the box as a single node and get about 150 GB/s of usable bandwidth, or run four nodes and get about 175 GB/s, provided connections, kTLS workers, TCP pacers and disk reads are pinned so that as much work as possible stays in the domain where the NIC lives. The imperfect reality, with NICs on only two of the four domains and drives unevenly spread, came out at about 1.25 fabric crossings per byte on average.

The second change was NIC kTLS offload. The ConnectX-6 Dx can encrypt TLS 1.2 and 1.3 records itself, in-line, as data flows out. The kernel still owns the session and passes the keys down; the NIC does the AES-GCM. That removes the CPU round trip from the data path, which "cuts memory BW requirements in half," to about 100 GB/s for 400 Gb/s. The catch is that the NIC keeps crypto state inside a TLS record, so a retransmitted TCP segment forces it to re-read the whole record from host memory. Netflix handles that by moving lossy connections back to software TLS: in the 2021 slides, a threshold of 1% retransmitted bytes moved about a third of connections off the NIC and cost roughly 30 Gb/s of stable throughput, from 380 down to 350.

The 2022 talk, "The other FreeBSD optimizations used by Netflix," covered the remaining work and showed a single server serving close to 800 Gb/s. The lesson for anyone sizing a server is uncomfortable but useful: for a streaming workload, count memory bandwidth and PCIe lanes before you count cores, and count how many times each byte moves.

## What Netflix's cache teaches about yours

You will not build Open Connect. Almost nobody has the two things it rests on, a finite catalog and traffic large enough that ISPs want you in their racks. The design decisions transfer anyway.

**Decide whether your working set is knowable.** A general web cache cannot predict tomorrow. A product catalog, a set of container images, a model registry, a game's asset bundles: these are finite and their popularity is measurable. If you can compute a manifest, you can prefetch, and you can move the fetch off the busy hours.

**Measure byte hit ratio and churn as two numbers.** A request hit ratio hides large-object misses. Churn is the price of the hit ratio: refill bandwidth and disk writes. A cache tuned only on hit ratio will chase noise. Netflix smooths several days of history to avoid churn that buys nothing.

**Separate filling from serving in time.** If you can afford a window, writes belong in it. Even a plain nginx cache can be warmed by a job at 4 AM against a list of the top objects, and that job can read yesterday's access log to build the list. Read/write contention on the same disks is a real cost and it shows up as tail latency.

**Put the copy where the link is expensive.** Netflix embeds appliances in ISPs because the ISP's transit link is the costly hop. Your equivalent might be a per-region cache in front of a cross-region S3 bucket, or a pull-through registry in the build cluster. Find the link with the bill attached and put the cache on the far side of it.

**Escalate fetches in cost order, and elect a leader.** Peer, then tier, then origin, with a few elected masters per object doing the expensive fetch and the rest copying locally, is a pattern that fits container image distribution, dataset shards and CI caches. Without it, a cold cache stampedes the origin.

**Keep the edge stateless, keep the truth in one place.** An OCA holds files and reports facts. Every decision, and every record of which node has what, lives in a control plane with a real database behind it. If you build even a modest version of this, the manifest and the placement decisions want a transactional store with a history you can query.

**Count the times a byte moves.** The 400 Gb/s story is a reminder that a server's ceiling is often memory bandwidth, and that "zero copy" is a claim to verify, not a feature to assume. Before you buy a bigger CPU for a data-moving service, measure the bus.

## When the rented CDN is still the right answer

For most workloads, the demand-driven model is correct because the demand is unknowable, and the commercial CDNs have spent two decades making pull-through caching fast. The market Netflix left in 2012 is also more varied than it was: Cloudflare, Fastly, Bunny.net, CacheFly and Gcore all sell demand-driven caching and differ on price, programmable edges, video features and regional presence. What distinguishes them from Open Connect is exactly the property this post is about. They cache what you asked for after you asked for it. If your working set is small and hot, that is fine. If it is large and predictable, ask whether the vendor offers prefetch or push, because that is the feature that turns their network into something closer to Netflix's.

## Sources

- Sandvine, Global Internet Phenomena Report, December 2015 (Netflix at 37.05% of North American peak downstream) and October 2018 (Netflix at 15% of global downstream, video at 58%).
- Netflix, "How Netflix Works With ISPs Around the Globe to Deliver a Great Viewing Experience," March 2016.
- Netflix, "Open Connect: Celebrating a Decade of Smooth and Efficient Streaming," December 2022.
- Netflix Open Connect, "Open Connect Overview" (PDF) and the appliance and program pages at openconnect.netflix.com.
- Netflix Technology Blog, "Netflix and Fill," 2016, and "Content Popularity for Open Connect," 2017.
- Drew Gallatin, "Serving Netflix Video at 400Gb/s on FreeBSD," EuroBSDCon 2021, and "The 'other' FreeBSD optimizations used by Netflix to serve video at 800Gb/s from a single server," EuroBSDCon 2022, both on papers.freebsd.org.
