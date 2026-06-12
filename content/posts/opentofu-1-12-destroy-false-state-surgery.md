---
title: 'OpenTofu 1.12: destroy = false Retires the tofu state rm Ritual'
excerpt: 'OpenTofu 1.12 lets a resource declare that it should be forgotten instead of destroyed, makes prevent_destroy dynamic, and quietly ends the manual providers lock step. Here is what each change does, plus the footguns the release notes will not warn you about.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-06-12'
publishedAt: '2026-06-12T15:00:00Z'
updatedAt: '2026-06-12T15:00:00Z'
readingTime: '8 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - opentofu
  - terraform
  - infrastructure-as-code
  - state-management
  - devops
---

Every team running OpenTofu or Terraform at scale has a version of the same ritual. A database needs to leave this workspace's management without being deleted: maybe it is being handed to another team, maybe it is migrating to a different state file, maybe someone is splitting a monolithic root module. So an engineer opens a terminal, runs `tofu state rm aws_db_instance.main`, pastes the output into a Slack thread as proof, and everyone quietly hopes the config edit that should accompany it lands before the next plan tries to recreate the thing.

[OpenTofu 1.12](https://opentofu.org/blog/opentofu-1-12-0/) (released May 14) is the first release that treats this workflow as something the language should handle instead of the operator. It is a short changelog with unusually high practical density, so this is a feature-by-feature read with the failure modes included.

## destroy = false: forget instead of destroy

The new lifecycle meta-argument:

```hcl
resource "aws_db_instance" "main" {
  # ...

  lifecycle {
    destroy = false
  }
}
```

A resource carrying `destroy = false` is never destroyed by OpenTofu. In every situation that would normally delete the remote object, OpenTofu instead *forgets* it: the entry is removed from state, and the real infrastructure stays untouched. That applies in three places:

- **Removing the resource from configuration.** Delete the block, run plan, and the object leaves state without leaving the cloud. This is the `state rm` replacement, except it goes through plan and review like everything else.
- **Replacement.** If a change forces replacement, the old instance is forgotten rather than destroyed, and a new one is created per the current config. Useful when the old object must survive for a cutover; surprising if you expected replacement to clean up after itself.
- **`tofu destroy`.** The marked resource is forgotten, everything else is destroyed, and the command exits with a non-zero status code to signal that some resources were not fully removed.

Three behaviors here deserve more attention than the release notes give them.

First, **the setting is persisted in state**. Once applied, OpenTofu will not plan that resource's destruction until you explicitly flip it back. The protection follows the resource, not the current copy of the config, which is the safe choice and also the one that will confuse whoever investigates "why won't this delete" eight months from now.

Second, **it takes precedence over `prevent_destroy`**. If both are set, `destroy = false` wins: instead of erroring on a destroy attempt, the resource is silently forgotten. The two arguments express different intents (never let this die vs. this is not mine to kill), and you should pick one deliberately rather than stacking them.

Third, **the non-zero exit from `tofu destroy` will break pipelines that treat destroy as pass/fail**. Ephemeral environment teardown jobs are the obvious case: the destroy succeeded by design, the marked resource was meant to survive, and your CI goes red anyway. If you adopt `destroy = false` in anything an automation destroys, that job needs to distinguish "failed" from "completed with forgotten resources" from day one.

And the footgun the docs do warn about, repeated here because someone will hit it: once forgotten, the object is invisible to OpenTofu. Add the same resource block back later and plan will try to *create* it, which fails (or worse, half-succeeds) because the object still exists remotely. The forget-then-re-add path goes through `tofu import`, same as any other unmanaged object.

One limitation: `destroy` only accepts a constant boolean. Which is interesting, because its sibling just lost that restriction.

## prevent_destroy is dynamic now

Since the beginning, `prevent_destroy` demanded a hardcoded literal. The classic consequence: shared modules either shipped two variants (one strict, one not) or left protection off and hoped. As of 1.12:

```hcl
lifecycle {
  prevent_destroy = var.environment == "production"
}
```

The argument can reference symbols in the same module, so a single database module can refuse destruction in production and allow it in ephemeral environments, decided by the caller. Terraform still requires the static literal, so this is also one of the clearest divergence points between the two projects to date: not a new block, but a restriction removed from a fifteen-year-old one.

Worth knowing before you parameterize everything: protection that depends on a variable is protection that can be turned off by changing an input, possibly far from the module, possibly by automation. For the resources where `prevent_destroy` was doing real work as a last line of defense, a hardcoded `true` is still the stronger statement. The dynamic form is for the wide middle ground where the old static rule forced you to choose between duplicate modules and no guardrail at all.

## The smaller changes that touch your CI anyway

**Provider checksums complete themselves.** `tofu init` now writes a full set of checksums for all platforms into the dependency lock file, using both `zh:` and `h1:` hashes, without the separate `tofu providers lock` step that teams bolted into their workflows (and that anyone with a mixed macOS/Linux team learned the hard way). Two operational notes: the first `init` after upgrading rewrites your lock file with the added `h1:` hashes, so expect a one-time noisy diff and merge it deliberately; and if a renovate-style bot regenerates lock files, its next PR will carry that churn too.

**`-json-into=FILENAME`** gives you machine-readable output and human-readable output from the same run: JSON streams to the file (named pipes work, so `/dev/fd/N` tricks are on the table), while the terminal keeps the normal rendering. The previous choice was one or the other, which is why so many pipelines run plan twice or pipe JSON through a prettifier. One run, both audiences.

**Deprecations:** WinRM support for provisioners is deprecated with removal planned for 1.13 (the few teams still bootstrapping Windows hosts through provisioners should start the SSH or image-baking migration now), and official 32-bit builds (`386`, `arm`) begin phasing out with warnings expected in 1.13.

## Where this leaves the Terraform comparison

We keep a longer [OpenTofu vs Terraform migration guide](https://devops-daily.com/posts/opentofu-2026-switch-from-terraform) that covers licensing and ecosystem, so just the delta here: 1.11 brought ephemeral values and the `enabled` meta-argument, and 1.12 adds config-driven forgetting, dynamic destroy protection, and lock files that maintain themselves. The pattern across the last two releases is consistent: OpenTofu is spending its development budget on the unglamorous state-and-lifecycle operations that fill real teams' runbooks, and the fork stopped being a drop-in clone a while ago.

If you adopt one thing from 1.12 this quarter, make it `destroy = false` on the resources your team currently protects with tribal knowledge and a pinned Slack message. State surgery through code review beats state surgery through terminal history every time someone new joins the on-call rotation.
