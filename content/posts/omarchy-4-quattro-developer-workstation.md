---
title: 'Omarchy 4 Makes the Linux Desktop Feel Like a Product, Finally'
excerpt: 'DHH''s Arch-based distro shipped its biggest release in August: a full desktop shell rewrite, sub-minute installs, dual boot, and coding agents treated as system citizens. With an $8M foundation behind it and hardware vendors paying attention, Omarchy is the most serious run at the developer workstation in years.'
category:
  name: 'Linux'
  slug: 'linux'
date: '2026-09-01'
publishedAt: '2026-09-01T09:00:00Z'
updatedAt: '2026-09-01T09:00:00Z'
readingTime: '10 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - Linux
  - Omarchy
  - workstation
  - AI
  - tooling
---

"The year of the Linux desktop" has been a punchline for two decades, and the punchline always had the same explanation: nobody with product taste and staying power ever owned the whole experience. Distros assembled parts; nobody curated them. That is exactly the gap [Omarchy](https://omarchy.org) was built to fill, and with August's 4.0 release, "Quattro", it is getting hard to keep laughing at the old joke.

Omarchy is David Heinemeier Hansson's opinionated, Arch-based Linux for developers: Hyprland tiling, one keyboard-driven workflow, every default chosen on purpose. What started in 2025 as one famous developer ricing his laptop in public has turned into something with real institutional weight, and Quattro (shipped August 14) is the release where that shows.

## TLDR

- **Quattro rewrote the entire desktop shell in Quickshell**: bar, launcher, menus, notifications, lock screen, one coherent, themed, scriptable process instead of a federation of independent tools, running under 300 MB.
- **The ISO dropped under 6 GB** (more than a gigabyte smaller) and installs got 30%+ faster; sub-minute installs are possible on fast hardware. **Dual boot with Windows** (with full LUKS encryption) finally landed.
- **Coding agents are system citizens**: nine pre-wired (Claude Code, Codex, Gemini CLI, Copilot CLI and more), a system-wide default you pick once, agent status in the top bar, and crash diagnosis that routes to your agent.
- **The Omacom Foundation launched with $8M** from eight patrons including Tobi Lütke, Patrick Collison, Michael Dell, Jack Dorsey and Matthew Prince, since grown past $10M. Hardware vendors are engaging, with Framework support among the reported wins.
- The same simplicity philosophy extends naturally to the server side, which is where the rest of your stack gets to stay boring too.

## Prerequisites

None to read this. To try Omarchy: a spare machine or partition, comfort with the idea of a tiling window manager, and about a minute of installation, apparently.

## The shell rewrite is the headline

Pre-4.0 Omarchy was, under the hood, what every polished Linux setup is: a carefully configured federation. Waybar here, a launcher there, a notification daemon, each themed into agreement but still separate programs around the Hyprland compositor.

Quattro replaces the federation with a single long-running shell built on [Quickshell](https://quickshell.org/) (a Qt Quick toolkit for building desktop components): bar, launcher, menus, notifications, on-screen displays, control panels, lock screen and polkit agent in one coherent, IPC-scriptable process with a plugin architecture, running in under 300 MB.

If you have ever maintained a hand-rolled tiling setup, you know why this matters. The federation approach means every theme change touches five config formats and every component upgrade can break the seams. One process, one theme system (expanded from 8 to 24 palette colors in this release), one scripting surface: this is the difference between a collection of dotfiles and an actual product. It is also, notably, the kind of consolidation only a project with a single opinionated owner ships, because every component it replaced has its own community that would have voted no.

## Installs measured in seconds, and dual boot at last

The whole install story got the product treatment too: the ISO shrank by over a gigabyte to under 6 GB, installation sped up more than 30%, and on fast hardware a full install lands in under a minute. For a distro whose pitch includes "reinstalling is cheap, your config is code", making the install nearly free is not vanity, it is the philosophy made concrete.

Quattro also added the feature whose absence kept many people at the door: **dual boot**. A free-space install alongside Windows, with full LUKS disk encryption, so trying Omarchy no longer means sacrificing a machine to it. (You shrink the Windows partition and disable BitLocker first; the full-disk path still wipes the drive it is pointed at.) For the "I would try it but I need my Windows partition" crowd, the excuse is gone.

## Agents as system citizens

Here is the part most relevant to how development actually changed in the last two years. Every OS treats coding agents as apps you happen to run in a terminal. Omarchy 4 treats them as part of the system: nine agents pre-wired as lazy-loaded launchers (Claude Code, OpenAI Codex, OpenCode, Gemini CLI, GitHub Copilot CLI, Crush, Grok CLI, Pi, Oh My Pi), a system-wide default you set once (`omarchy default agent claude`), and then the OS routes agent-shaped work accordingly.

The details are where it gets genuinely clever: agent state lives in the top bar (including plan limits and token burn), a multiplexer tracks whether agents are idle, working, blocked or done, and when something on the system crashes, Omarchy can hand the diagnosis to your default agent, with a built-in skill that knows how to reconfigure the OS itself. That last one is quietly a big idea: the operating system shipping first-party context for the AI that maintains it.

Agree or not with every choice, this is the first OS-level answer to a question every developer now has: where do agents live in my environment? Everyone else is leaving it to terminal multiplexers and muscle memory.

## Money, governance, and hardware taking it seriously

The reason to take Omarchy seriously as more than a famous developer's dotfiles is what happened around the software in August. DHH launched the **Omacom Foundation** with $8 million from eight founding patrons, and the list reads like a who's-who with skin in the developer-tools game: Tobi Lütke (Shopify), Patrick Collison (Stripe), Michael Dell, Jack Dorsey, Matthew Prince (Cloudflare), Brendan Iribe, Jason Fried, and DHH himself, with funding since passing $10 million as more patrons joined. The foundation holds the trademarks, funds infrastructure, and, importantly, supports the upstream open-source projects Omarchy depends on, Hyprland and Quickshell included.

Hardware is responding too: Framework has been reported as officially supporting Omarchy, and work has surfaced on tuning for current Dell machines. A Linux desktop with a taste dictator, a war chest, upstream funding, and OEM attention is a combination the ecosystem has simply never had before.

## Where the servers fit

One more observation, because this is a DevOps site: Omarchy's appeal is a philosophy, not just a theme pack. Fewer moving parts, defaults chosen by someone with taste, tools you can hold in your head. Developers who feel that pull on their workstation tend to want the same thing one layer up, which is why this crowd so often pairs a setup like Omarchy with deliberately simple infrastructure: a few droplets on DigitalOcean, Docker Compose, boring DNS, rather than a hyperscaler console with four hundred services. (It is the same instinct we leaned on when we [self-hosted a PaaS on DigitalOcean with Coolify](https://devops-daily.com/posts/coolify-self-hosted-paas-digitalocean): own your tools, keep the stack legible.) DHH's crusade against accidental complexity does not stop at the desktop, and neither should yours.

## Should you try it?

If you live in a terminal, like keyboard-driven everything, and have wanted a Linux desktop that feels decided rather than assembled: yes, and Quattro is the right moment, because dual boot removed the commitment problem and the sub-minute install removed the time problem. If you need mainstream desktop conventions or hate tiling, it is deliberately not for you, and Omarchy would be the first to say so; opinionated software earns its coherence by not negotiating.

Either way, it is worth watching. The Linux desktop's chronic problem was never capability, it was curation, and for the first time in a long time someone with taste, money, and an audience is doing the curating in public, shipping monthly, and dragging hardware vendors along. The old joke needed retiring anyway.
