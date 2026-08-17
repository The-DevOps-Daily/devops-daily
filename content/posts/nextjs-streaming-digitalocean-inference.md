---
title: 'Streaming LLM Responses in Next.js: 1.3s to First Token, Not 15.7s'
excerpt: 'The same model, the same prompt, and the same DigitalOcean endpoint. One version shows the first words in 1.3 seconds, the other shows a blank screen for nearly 16. The difference is entirely in your route handler.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-08-17'
publishedAt: '2026-08-17T09:00:00Z'
updatedAt: '2026-08-17T09:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Next.js
  - DigitalOcean
  - AI
  - Streaming
  - TypeScript
---

Here is a bug that never shows up in your error tracker. You wire an LLM into a Next.js app, it works, you ship it, and users think the feature is broken because nothing happens for fifteen seconds. Nothing failed. The response is simply not arriving until it is complete.

We measured it against DigitalOcean's Inference Engine. Same model, same prompt, one flag different:

- `stream: false`: **15,706 ms** before a single character appears
- `stream: true`: **1,265 ms** to the first token

Twelve times faster to something on screen, for a one-word change. Except the flag is the easy part. The part that quietly undoes it is the route handler in the middle, and there are three ways to write one that turns the second number back into the first.

This post builds the proxy that does not, measures what it costs, and documents two things about DigitalOcean's endpoint that will waste your afternoon if nobody tells you. The working app is on GitHub.

```github
https://github.com/The-DevOps-Daily/do-inference-nextjs
```

## TLDR

- Streaming changes **time to first token** from 15.7s to 1.3s. It does not make generation faster: total time is roughly the same either way.
- A route handler that does `await upstream.json()` throws the entire benefit away. Pipe, do not await.
- Piping through a Next.js route handler costs about **120 ms**. That is the real overhead, measured.
- SSE frames split across network reads. Parse naively and you silently drop whichever token straddles the boundary.
- `/v1/models` lists 76 models. Several return **403, not available for your subscription tier**.
- Reasoning models have slow first tokens anyway. `qwen3-32b` took **7.9s** to say anything, streaming or not.

## Prerequisites

- Node 20+ and a Next.js 15 or 16 app using the App Router
- A DigitalOcean model access key, from **GradientAI Platform → Model access keys**
- Comfort with `fetch`, `ReadableStream` and async iteration

## What streaming actually buys you

First, the measurement, because the reason to stream is not the reason people usually give.

Median of three runs against `openai-gpt-oss-120b`, one prompt, on 17 August 2026:

```chart
{
  "type": "bar",
  "title": "Time to first token, same model and prompt",
  "unit": "ms",
  "caption": "DigitalOcean Inference Engine, openai-gpt-oss-120b, median of 3 runs, 17 August 2026. Total generation time was ~15s in both cases.",
  "rows": [
    { "label": "stream: false", "value": 15706, "series": "blocking" },
    { "label": "stream: true, direct", "value": 1265, "series": "streaming" },
    { "label": "stream: true, via route handler", "value": 1388, "series": "streaming" }
  ],
  "series": [
    { "name": "blocking", "color": "#ef4444" },
    { "name": "streaming", "color": "#10b981" }
  ]
}
```

Note what did **not** change. Total generation time was about the same in both modes. Streaming does not make the model faster. It changes when the user finds out it is working, and that is the entire user-visible difference between a feature that feels broken and one that feels fast.

That distinction matters when someone asks you to "make the AI faster". Often they do not want more tokens per second, they want the blank screen to stop.

## The route handler that quietly ruins it

The obvious implementation is the one that fails:

```ts
// app/api/chat/route.ts  DO NOT SHIP THIS
export async function POST(req: Request) {
  const { messages } = await req.json();

  const upstream = await fetch('https://inference.do-ai.run/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.DO_INFERENCE_KEY}` },
    body: JSON.stringify({ model: 'openai-gpt-oss-120b', messages, stream: true }),
  });

  // Here is the bug. `stream: true` is set, and it makes no difference at all.
  const data = await upstream.text();
  return new Response(data);
}
```

`stream: true` is set. The upstream really does send tokens as they are produced. And `await upstream.text()` waits for every one of them before your handler returns anything. You have asked for a stream and then reassembled it into a blocking call.

This is easy to miss because it works. Tests pass, the response is correct, and the only symptom is that the app feels slow, which nobody logs.

## The proxy that preserves it

The fix is to return a `ReadableStream` that forwards chunks as they arrive:

```ts
const decoder = new TextDecoder();
const encoder = new TextEncoder();
let buffer = '';

const body = new ReadableStream<Uint8Array>({
  async start(controller) {
    const reader = upstream.body!.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { text, rest, done: finished } = parseSSE(buffer);
        buffer = rest;

        if (text) controller.enqueue(encoder.encode(text));
        if (finished) break;
      }
    } finally {
      await reader.cancel().catch(() => {});
      controller.close();
    }
  },
  cancel() {
    // The browser went away: tab closed, navigated, or hit stop.
    upstream.body?.cancel().catch(() => {});
  },
});

return new Response(body, {
  headers: {
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Accel-Buffering': 'no',
    'Cache-Control': 'no-cache, no-transform',
  },
});
```

Measured, this costs about **120 ms** against calling DigitalOcean directly: 1,388 ms versus 1,265 ms to first token. That is the honest price of having a server in the middle, and it is worth paying, because the alternative is shipping your API key to the browser.

:::warning
`X-Accel-Buffering: no` is not decoration. Put nginx, a CDN, or most reverse proxies in front of a streaming response and the default behaviour is to buffer it and forward it complete. Your app streams perfectly in development and blocks in production, which is the worst possible place to discover it.
:::

## The bug you will not notice until it is in production

Chunks from the network do not align to line boundaries. One `reader.read()` can hand you this:

```text
data: {"choices":[{"delta":{"content":"abc"}}]}
data: {"choices":[{"delta":{"con
```

That second frame is cut in half. Parse the buffer line by line and throw away what is left, and the token in the incomplete frame vanishes. The output is still fluent, still plausible, and missing a word every few hundred. Nothing errors.

The fix is to keep the remainder and prepend it to the next read:

```ts
export function parseSSE(buffer: string) {
  let text = '';
  let done = false;
  const lines = buffer.split('\n');
  // The last element may be a partial line. Hold it back for the next read.
  const rest = lines.pop() ?? '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') { done = true; continue; }
    try {
      const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string') text += delta;
    } catch { /* incomplete frame */ }
  }
  return { text, rest, done };
}
```

`lines.pop()` is the entire fix, and it is worth a test, because this is the kind of bug that survives code review:

```ts
it('holds back a partial line instead of losing it', () => {
  const whole =
    'data: {"choices":[{"delta":{"content":"abc"}}]}\n' +
    'data: {"choices":[{"delta":{"con';

  const first = parseSSE(whole);
  expect(first.text).toBe('abc');

  // Feeding the remainder back recovers the token that was split.
  const second = parseSSE(first.rest + 'tent":"def"}}]}\n');
  expect(second.text).toBe('def');
});
```

## Cancellation is a billing feature

When a user hits stop or closes the tab, the model keeps generating unless you tell it not to. You pay for those tokens and nobody reads them.

Next.js gives you `req.signal`, which fires when the client disconnects. Forward it:

```ts
export async function POST(req: Request) {
  const body = await req.json();
  // req.signal aborts when the browser goes away. Passing it upstream is what
  // actually stops the generation, and the bill.
  return streamChat(body, process.env.DO_INFERENCE_KEY ?? '', req.signal);
}
```

On the client, an `AbortController` gives you a working stop button:

```tsx
const abort = useRef<AbortController | null>(null);

async function run() {
  abort.current = new AbortController();
  const res = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ messages }),
    signal: abort.current.signal,
  });
  // ...read the stream
}

<button onClick={() => abort.current?.abort()}>Stop</button>
```

Without the `cancel()` handler on the `ReadableStream` shown earlier, aborting the browser request leaves the upstream connection open and generating. The stop button looks like it works and changes nothing on your invoice.

## Use the Node runtime, not edge

It is tempting to put a streaming route on the edge runtime. Do not, for long generations:

```ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
```

Edge functions have shorter maximum durations, and a fifteen second generation that occasionally runs to forty will be cut off mid-sentence. `force-dynamic` matters too: a cached AI response is not a performance win, it is a bug where every user gets the first user's answer.

## Two things about DigitalOcean's endpoint

**The model list is not the list you can call.** `GET /v1/models` returns 76 entries. Several of them, including the Claude family, answer with:

```json
{ "error": { "message": "this model is not available for your subscription tier" } }
```

That is a 403 at request time, not a filtered list. If you are building a model picker from that endpoint, validate against your tier or your users will pick models that cannot run.

**Reasoning models break the streaming promise.** The headline number in this post is `openai-gpt-oss-120b` at 1.3s to first token. Running the identical test against `alibaba-qwen3-32b`:

| model | first token (streaming) | total |
| --- | --- | --- |
| `openai-gpt-oss-120b` | 1,265 ms | 15,435 ms |
| `alibaba-qwen3-32b` | **7,864 ms** | 13,353 ms |

Both were streaming. The reasoning model spends the first eight seconds thinking before it emits anything, so the user still gets a blank screen, just a shorter one. Streaming cannot help with silence at the source.

If time to first token is what you care about, the model choice matters more than the streaming flag. Test the model you intend to ship, not the one in the tutorial.

## The whole thing, working

The repository has the complete app: the proxy, the route handler, a client that renders tokens as they arrive and displays its own measured time to first token, and the tests including the split-frame case.

```bash
git clone https://github.com/The-DevOps-Daily/do-inference-nextjs
cd do-inference-nextjs
cp .env.example .env.local   # add DO_INFERENCE_KEY
npm install && npm run dev
```

## FAQ

**Does streaming reduce total generation time?**
No. In our runs total time was roughly the same with and without it. What changes is when the first token arrives, which is what users experience as speed.

**Can I skip the route handler and call DigitalOcean from the browser?**
Only if you are happy publishing your API key. The 120 ms the proxy costs is the price of keeping the credential server side, and it is a bargain.

**Why plain text rather than SSE to the browser?**
Because the browser side gets simpler: `reader.read()` and append. Use SSE to the client if you need to interleave metadata such as token counts or tool calls in the same channel.

**Does this work with the Vercel AI SDK?**
Yes, and the SDK handles the parsing and cancellation shown here. This post builds it by hand because the failure modes are much easier to recognise once you have seen what the SDK is doing for you.

**Is this specific to DigitalOcean?**
The endpoint is OpenAI-compatible, so the same handler works against any provider with that shape. The two gotchas at the end are DigitalOcean-specific; the streaming mechanics are not.
