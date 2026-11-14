---
title: "Who's On Call for the AI Agent? A Production Runbook"
excerpt: 'An agent that can call production tools is a service with an incident path, not a clever prompt. Assign an owner, page only for harm in progress, test a kill switch, scope its identity, and keep enough evidence to explain every action.'
category:
  name: 'DevOps'
  slug: 'devops'
date: '2026-11-12'
publishedAt: '2026-11-12T15:00:00Z'
updatedAt: '2026-11-12T15:00:00Z'
readingTime: '12 min read'
author:
  name: 'DevOps Daily Team'
  slug: 'devops-daily-team'
featured: false
tags:
  - DevOps
  - AI Agents
  - On-Call
  - Incident Response
  - Security
  - Observability
---

An AI agent that opens pull requests, queries a database, restarts a service, or sends email is already a production service. At 3 a.m., the question is not whether its prompt was well written. It is who can stop it, which identity it used, and how to tell what it did. This runbook gives that service the same operational basics as any other: ownership, a page policy, controls that still work when the model does not, and an audit trail that answers an incident question quickly.

## TLDR

- Put every production agent in the service catalog with an owning team, a primary on-call rotation, an escalation path, and named owners for its prompt, tools, and credentials.
- Page for harm that is happening now: an action loop, spend burning above budget, writes outside their window, permission-denied spikes, an aging approval queue, or failed tasks. Ticket slow trends such as evaluation, latency, and cost drift.
- Make the kill switch independent of the model. The tool runner checks it before every call, credentials can be revoked, the gateway applies a cap, and network egress is the final containment layer.
- Give the agent its own short-lived, read-scoped identity. A read-only database role helps, but does not limit query duration or call frequency.
- Record every tool action outside the agent's writable storage. During an incident, preserve that record before deciding whether to resume.

## Prerequisites

- A service catalog and an on-call system with a primary and escalation target.
- A tool runner or gateway where you can enforce policy before an external action starts.
- Metrics, centralized logs, and a protected audit-log destination.
- An identity system that can issue a distinct identity for each agent.

## Give the agent an owner before it gets a tool

Treat an agent as a service, not as a feature hidden inside another service. Create a catalog entry that names its purpose, environments, repository, dashboards, runbook, primary rotation, and escalation path. A stale record is worse than a missing one when responders need to find the right team, which is why the catalog itself needs ownership and review. Our [service-catalog drift check](/posts/service-catalog-drift) shows how easily ownership records can stop matching reality.

Split accountability by control surface. One team may own the agent's prompt, model choice, and configuration. The team that owns each target system owns the tool contract and allowed actions. The identity or platform team owns credential issuance, revocation, and the gateway policy. The catalog entry should name all three, but it must name one accountable service owner who receives the page and drives the incident.

Write the escalation rule down with the service, not in a chat thread. The primary responder acknowledges and contains the agent. If the incident touches a target service, page that service's owner. Escalate to security when credentials, untrusted instructions, or data exposure are involved. The rotation and its escalation policy should have the same attention as any other production service. See the [on-call rotation and escalation guide](/posts/on-call-rotation-escalation-policy-guide) for the people and paging side of that setup.

## Page on harm now, ticket slow drift

The page rule is simple: wake someone only when waiting makes the outcome worse. A tool loop can create more actions in the next minute. A spend burn rate can exhaust a budget this hour. A week-over-week latency change needs investigation, but it does not usually need an immediate phone call.

| Signal         | Page when                                                                              | Ticket when                                    |
| -------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Tool actions   | Action rate is far above the service's baseline, or identical calls repeat             | A gradual change in the action mix             |
| Spend          | The hourly burn rate crosses the incident budget                                       | Cost trends upward across days or releases     |
| Writes         | A successful write occurs outside an approved window                                   | The normal write volume slowly grows           |
| Access         | Permission-denied errors spike, which can indicate drift or a prompt-injection attempt | A single expected denial or a policy cleanup   |
| Human approval | The oldest approval has exceeded the response promise                                  | Approval volume trends higher                  |
| Task outcome   | Failure rate crosses the service's error budget                                        | Evaluation score or latency gradually declines |

The following names and thresholds are **examples owned by this runbook**, not Prometheus, OpenTelemetry, or vendor metric names. Pick thresholds from your own normal traffic and give every rule an owner. The counter functions use a range vector, and each alert has a `for:` duration. Note what `for:` does: it requires the expression to stay true across evaluations, so it filters flapping rate rules, but an event rule such as a single forbidden write stays true for as long as the event sits inside its range window. That is intended for the write and spend rules: one forbidden write is worth a page.

```yaml
groups:
  - name: agent-production
    rules:
      - alert: AgentActionRateHigh
        expr: sum by (agent_id) (rate(agent_tool_calls_total{outcome="success"}[5m])) > 20
        for: 10m
        labels: { severity: page }
        annotations:
          summary: 'Agent action rate is above its configured baseline'

      # The runner increments this when the same tool + argument fingerprint
      # repeats inside its window. The fingerprint stays out of the label set.
      - alert: AgentRepeatedToolCallLoop
        expr: sum by (agent_id, tool) (rate(agent_repeated_tool_calls_total[5m])) > 0.2
        for: 5m
        labels: { severity: page }
        annotations:
          summary: 'Repeated tool-call rate indicates a loop'

      - alert: AgentHourlySpendBudgetExceeded
        expr: sum by (agent_id) (increase(agent_spend_usd_total[1h])) > 25
        for: 5m
        labels: { severity: page }
        annotations:
          summary: 'Agent spend exceeded the hourly incident budget'

      - alert: AgentWriteOutsideWindow
        expr: sum by (agent_id, tool) (increase(agent_tool_calls_total{action="write",allowed_window="false",outcome="success"}[5m])) > 0
        for: 1m
        labels: { severity: page }
        annotations:
          summary: 'Agent completed a write outside its allowed window'

      - alert: AgentPermissionDeniedSpike
        expr: sum by (agent_id) (rate(agent_tool_calls_total{outcome="permission_denied"}[5m])) > 1
        for: 10m
        labels: { severity: page }
        annotations:
          summary: 'Agent permission denials are spiking'

      - alert: AgentApprovalQueueOld
        expr: max by (agent_id) (agent_approval_queue_oldest_seconds) > 300
        for: 5m
        labels: { severity: page }
        annotations:
          summary: 'An agent approval has waited more than five minutes'

      - alert: AgentTaskFailureRateHigh
        expr: sum by (agent_id) (rate(agent_tasks_total{outcome="failure"}[10m])) / sum by (agent_id) (rate(agent_tasks_total[10m])) > 0.20
        for: 15m
        labels: { severity: page }
        annotations:
          summary: 'Agent task failure rate is above 20 percent'
```

For the ticket queue, record evaluation score, latency percentiles, cost per completed task, and denied requests over a longer window. They tell you where to improve the service without training people to ignore their pager.

For traces, OpenTelemetry's GenAI conventions define `invoke_agent` and `execute_tool` operations and tool-call attributes. They now live in their own [semantic-conventions-genai](https://github.com/open-telemetry/semantic-conventions-genai) repository, and the [registry page](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/) lists those operation values at **Development** stability, so version your dashboards against them. The same registry notes that `gen_ai.tool.call.arguments` may contain sensitive information. Keep raw arguments out of metric labels: a per-call value in a label is a cardinality problem as well as a leak.

## Build a kill switch that the model cannot bypass

The model must not decide whether it is paused. Enforce a stop before every tool call in the runner that executes the call. Then give responders independent layers in case one control is unavailable.

```diagram
{
  "type": "flow",
  "nodes": [
    { "label": "Tool runner flag", "sub": "Checked before every call", "icon": "shield", "tone": "red" },
    { "label": "Credential revoke", "sub": "Identity can no longer authenticate", "icon": "lock", "tone": "amber" },
    { "label": "Gateway cap", "sub": "Rate and budget stop", "icon": "activity", "tone": "violet" },
    { "label": "Egress deny", "sub": "Last network containment layer", "icon": "net", "tone": "slate" }
  ]
}
```

Any on-call engineer may pull the switch, with no approval. That rule prevents a debate from extending an incident. "Pause" means calls that have not yet passed the runner's check are refused. A call that passed the check a moment before the switch can still start or finish, which is why credential revocation and egress deny exist as the next layers for immediate containment at the target. Pausing does not mean that the runner discards the current run, conversation, pending approval, or audit records. Keep that state inspectable so responders can see what the agent was about to do.

This short wrapper uses Redis as the control store. The switch is the existence of a key, so there is no value format to get wrong, and an unreachable or slow store stops the call instead of allowing it. Treat the store as a security control: connect over TLS, and give the runner an ACL user that can only read the pause keys, while responders use a separate user that can set and delete them ([Redis ACLs](https://redis.io/docs/latest/operate/oss_and_stack/management/security/acl/)). Put the same check in every execution path, including retries and asynchronous workers.

```python
import os

from redis import Redis
from redis.exceptions import RedisError

# rediss:// URL with the runner's read-only ACL user. Short connect and read
# timeouts: a hung control store must fail closed quickly.
control = Redis.from_url(
    os.environ["AGENT_CONTROL_REDIS_URL"],
    socket_timeout=0.5,
    socket_connect_timeout=0.5,
)


class AgentPaused(RuntimeError):
    pass


def run_tool(agent_id: str, tool_name: str, arguments: dict, call_tool):
    try:
        paused = control.exists(f"agent:{agent_id}:paused")
    except RedisError as error:
        # A broken control plane must not permit an external action.
        raise AgentPaused("kill-switch state is unavailable") from error

    if paused:
        raise AgentPaused(f"{agent_id} is paused; refusing {tool_name}")

    return call_tool(tool_name, arguments)
```

Pulling the switch is then one command that any responder can run, as the incident-control ACL user. Deleting the key is the deliberate resume step, and it belongs in the incident record with who ran it and why:

```bash
# Pause (any on-call engineer)
redis-cli --tls -h agent-control --user incident-control --askpass \
  SET agent:deploy-agent-prod:paused "paged-by-oncall $(date -u +%FT%TZ)"

# Resume (service owner, after the review in step 7 of the runbook below)
redis-cli --tls -h agent-control --user incident-control --askpass \
  DEL agent:deploy-agent-prod:paused
```

Test all four layers in a monthly game day. Start a harmless, repeatable test action, pause the agent while it is active, revoke its identity, exhaust a test gateway budget, and verify that egress policy blocks the target. Record time to containment and any action that escaped after the first stop signal. A kill switch that only exists in documentation is not a control.

## Scope the identity, then bound the work

Give each agent one identity. Do not hand an agent a human's long-lived token, and do not let several agents share a broad service identity. Use a read-scoped role for discovery work, short-lived credentials, and a separate path where a human approves a write before a runner obtains a write-capable identity.

For AWS, the runner can obtain a 15-minute role session with `AssumeRole`. The [AWS STS API reference](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html) documents a `DurationSeconds` minimum of 900 seconds and a maximum controlled by the role's maximum session duration, which may be from one to twelve hours. The command deliberately requests the 900-second minimum.

```bash
aws sts assume-role \
  --role-arn arn:aws:iam::123456789012:role/AgentReadInventory \
  --role-session-name agent-inventory-run-20261112 \
  --duration-seconds 900 \
  --output json
```

The role policy below allows only an example inventory task. The calling workload must separately be trusted to assume this role. A write action should not add write verbs here. Route it to an approval service that records an approver, checks the change, and issues a different, time-limited identity only after approval.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadInventoryOnly",
      "Effect": "Allow",
      "Action": ["ec2:DescribeInstances", "cloudwatch:GetMetricData"],
      "Resource": "*"
    }
  ]
}
```

For a database, use a distinct read-only role, a connection limit, a `statement_timeout`, and a gateway rate limit. Our [read-only role probes](/posts/neon-read-only-role-agent-probes) showed why the role alone is not enough: a 15-second agent read on the primary made an `ALTER TABLE` wait more than 11 seconds, and the app's inserts queued behind it, even though the agent never wrote anything. Sending agent reads to a read replica kept the primary clear in that test. The same probes found that nothing in the role bounds how often the agent repeats a legal read, and that the agent's session could run `SET statement_timeout = 0`. So enforce the timeout and the rate cap in the tool runner or gateway, where the agent cannot change them.

This is the practical answer to Excessive Agency, which the [2026 OWASP Top 10 for LLM Applications](https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/) ranks third ([announcement](https://genai.owasp.org/2026/09/01/owasp-genai-security-project-unveils-2026-top-10-for-llm-applications-new-agent-control-standard-and-sponsors-as-community-tops-30000-members/)). A model can be wrong or manipulated. The identity and policy boundary should still limit what reaches a real system.

## Keep an audit trail outside the agent's reach

Log every attempted tool call as a structured event. Include the run ID, agent identity, credential or role, tool, redacted arguments, result, approver when one exists, timestamp, and trace ID. Store it in append-only storage with a retention period set by your security and compliance requirements. The agent's own workspace, database, or object-store prefix is not an acceptable sole copy because an agent with write access could alter the evidence.

```json
{
  "timestamp": "2026-11-12T02:18:44Z",
  "run_id": "run_01JCG7",
  "agent_id": "deploy-agent-prod",
  "credential": "arn:aws:sts::123456789012:assumed-role/AgentReadInventory/agent-inventory-run-20261112",
  "tool": "ec2.describe_instances",
  "arguments": { "region": "eu-west-1", "filters": "[REDACTED]" },
  "result": "success",
  "approver": null,
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736"
}
```

To answer "what did the agent do between 02:10 and 02:40?", query the protected JSONL archive, not the model transcript:

```bash
jq -r '
  select(
    .agent_id == "deploy-agent-prod" and
    .timestamp >= "2026-11-12T02:10:00Z" and
    .timestamp < "2026-11-12T02:40:00Z"
  ) |
  [.timestamp, .run_id, .tool, .result, .trace_id] | @tsv
' agent-audit.jsonl
```

Redact secrets before an event leaves the runner. In our [prompt-injection test of an ops agent](/posts/prompt-injection-ops-agent-measured), a check outside the model stopped every forbidden action, but the agent still copied secrets into its own reports, so redaction belongs in code, not in the prompt. Store a stable argument fingerprint for loop detection, but do not put raw prompts, credentials, tokens, or user data into an alert label. Use the trace ID to join the audit event to the request and tool spans.

## First 15 minutes: copy this runbook

Put the following template beside the service catalog entry. Fill in the actual dashboard, credential-revocation command, audit location, and escalation targets before the agent goes live.

```text
AI AGENT INCIDENT: FIRST 15 MINUTES

Service: <agent service name>
Primary on-call: <rotation>
Escalation: <service owner>, <security contact>, <target-system owner>

1. Acknowledge the page and start an incident record. Record the run ID, alert,
   responder, and current time.
2. Pull the kill switch. Confirm the tool runner refuses a test call and note the
   last tool action accepted after the pause time.
3. Revoke or disable the agent credential. Apply the gateway rate or budget cap.
   Use egress deny if actions may still reach an external target.
4. Preserve the agent run state, approval queue, traces, and append-only audit
   events. Do not delete the run or ask the agent to explain itself.
5. Assess blast radius from the audit trail: actions, targets, credential used,
   successful writes, denied calls, spend, and affected data or services.
6. Communicate status, containment time, known impact, and next update time to
   the owning team and target-system owner. Escalate security when appropriate.
7. Resume only after the owner identifies the trigger, corrects the control gap,
   tests it in a safe environment, and explicitly records the decision.
```

## Summary

The best time to settle ownership and containment authority is before the first tool call. Once the agent is a cataloged service with a real pager, a tested stop path, scoped credentials, and a protected action record, responders can handle its failures as operational work instead of improvising around a model.
