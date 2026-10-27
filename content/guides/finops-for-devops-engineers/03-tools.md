---
title: 'Essential FinOps Tools for DevOps Teams'
description: 'Native cost tools on AWS, Azure and Google Cloud, FOCUS exports with DuckDB, Infracost, OpenCost and Cloud Custodian, and how to pick the ones you need.'
order: 3
---

**TLDR**: Start with what your cloud already gives you: a cost explorer, budgets, anomaly detection, right-sizing recommendations and a detailed billing export, now available in the FOCUS format on AWS, Azure and Google Cloud. Add Infracost to see the cost of a Terraform change before it merges, OpenCost (or Kubecost) to split Kubernetes node costs by namespace, and Cloud Custodian to find and clean up idle resources on a schedule. Buy a commercial platform when you need multi-cloud allocation rules and dashboards for people who do not write SQL.

Each tool answers a different question at a different moment: before a change merges, while resources run, or after the bill arrives.

```diagram
{
  "type": "graph",
  "columns": [
    [
      { "id": "plan", "label": "Terraform plan", "sub": "pull request", "icon": "branch", "tone": "slate" },
      { "id": "res", "label": "Running resources", "sub": "cloud accounts", "icon": "server", "tone": "slate" },
      { "id": "k8s", "label": "Kubernetes", "sub": "nodes and pods", "icon": "k8s", "tone": "slate" },
      { "id": "bill", "label": "Billing export", "sub": "FOCUS files", "icon": "database", "tone": "slate" }
    ],
    [
      { "id": "infracost", "label": "Infracost", "sub": "cost of the change", "icon": "gear", "tone": "amber", "detail": "Prices the resources in a Terraform change and posts the monthly difference on the pull request (Part 5)." },
      { "id": "c7n", "label": "Cloud Custodian", "sub": "policies on resources", "icon": "shield", "tone": "violet", "detail": "Finds idle, untagged or oversized resources and reports, tags, stops or deletes them on a schedule." },
      { "id": "opencost", "label": "OpenCost", "sub": "cost per namespace", "icon": "pod", "tone": "blue", "detail": "Splits node costs by namespace, workload and label, and compares requests with real usage." },
      { "id": "sql", "label": "DuckDB, Athena, BigQuery", "sub": "SQL on the bill", "icon": "activity", "tone": "green", "detail": "Showback, tag coverage and unit costs from the provider's FOCUS export." }
    ],
    [
      { "id": "review", "label": "Code review", "icon": "check", "tone": "green" },
      { "id": "owners", "label": "Resource owners", "icon": "activity", "tone": "green" },
      { "id": "teams", "label": "Teams and finance", "icon": "globe", "tone": "green" }
    ]
  ],
  "edges": [
    ["plan", "infracost"],
    ["res", "c7n"],
    ["k8s", "opencost"],
    ["bill", "sql"],
    ["infracost", "review", "PR comment"],
    ["c7n", "owners", "report or action"],
    ["opencost", "owners", "right-sizing"],
    ["sql", "teams", "showback"]
  ]
}
```

## Prerequisites

- `focus.duckdb` from [Part 1](/guides/finops-for-devops-engineers/01-principles).
- For Cloud Custodian: Python 3 with `venv`.
- For OpenCost: Docker, [kind](https://kind.sigs.k8s.io/), `kubectl` and Helm, to run it on a local cluster, plus `jq` and `column` to format its API output (`column` comes with util-linux on Linux and with macOS).

## Native Tools on Each Cloud

Every major provider has the same set of built-in tools under different names:

| Job                   | AWS                                      | Azure                                           | Google Cloud                                |
| --------------------- | ---------------------------------------- | ----------------------------------------------- | ------------------------------------------- |
| Explore costs         | Cost Explorer                            | Cost Management cost analysis                   | Cloud Billing reports                       |
| Budgets and alerts    | AWS Budgets                              | Cost Management budgets                         | Cloud Billing budgets                       |
| Anomaly detection     | Cost Anomaly Detection                   | Cost Management anomaly alerts                  | Cloud Billing anomalies                     |
| Right-sizing and idle | Cost Optimization Hub, Compute Optimizer | Azure Advisor                                   | Recommender                                 |
| Detailed billing data | Data Exports (CUR 2.0, FOCUS 1.2) to S3  | Exports (cost and usage, FOCUS) to Blob Storage | Billing export and FOCUS export to BigQuery |
| Estimates             | AWS Pricing Calculator                   | Azure pricing calculator                        | Google Cloud Pricing Calculator             |

Most of this costs nothing, with a few exceptions worth knowing on AWS: the Cost Explorer API charges USD 0.01 per request (scripts that loop over accounts and days add up), hourly and resource-level granularity in Cost Explorer is billed per usage record, and AWS Budgets monitoring is free, but action-enabled budgets beyond the first two cost USD 0.10 a day each and emailed budget reports USD 0.01 each. See the [Cost Explorer](https://aws.amazon.com/aws-cost-management/aws-cost-explorer/pricing/) and [Budgets](https://aws.amazon.com/aws-cost-management/aws-budgets/pricing/) pricing pages.

Three things to turn on in the first week, on any cloud:

1. **Budgets with alerts** for every account, project or subscription, sent to the team that owns it. [Part 4](/guides/finops-for-devops-engineers/04-practical-examples) creates them in Terraform for all three clouds.
2. **Anomaly detection.** On AWS, enabling Cost Explorer sets up an anomaly monitor for all services; add monitors per team or service, created in the management account (tag-based monitors can only be created there), and route the alerts to the owners' channel. Google Cloud's anomaly detection needs no setup, but only works for projects with at least six months of spend history.
3. **The detailed billing export**, in FOCUS format where you can. The consoles are good for questions you already know; the export answers the rest with SQL.

The AWS CLI shows the anomalies AWS found and the monitors that watch for them:

```bash
aws ce get-anomaly-monitors \
  --query 'AnomalyMonitors[].[MonitorName,MonitorType,MonitorDimension]' --output text

aws ce get-anomalies --date-interval StartDate=2026-10-01,EndDate=2026-10-27 \
  --query 'Anomalies[].[AnomalyStartDate,DimensionValue,Impact.TotalImpact]' --output text
```

Each `aws ce` call is one paid API request, so run these by hand or from a daily job, not in a tight loop.

## Billing Exports and FOCUS

The consoles answer the questions their designers expected. For anything else, such as tag coverage, showback with your own allocation rules, or unit costs that join billing data with business metrics, you need the raw billing data:

- **AWS**: create a Data Exports export with the **FOCUS 1.2 with AWS columns** table, delivered to S3 as Parquet and refreshed during the month. Query it with Athena, or with DuckDB straight from S3.
- **Azure**: create a Cost Management export with the **Cost and usage details (FOCUS)** dataset, in CSV or Parquet, to a storage account. Pay-as-you-go (MOSP) billing scopes cannot export FOCUS data.
- **Google Cloud**: enable the FOCUS export to BigQuery, a linked dataset next to the standard billing export (in preview in October 2026).

Because the columns are the same, one query covers every provider. With the sample from Part 1, these are the five largest usage charges by provider, service and service category:

```sql
-- The five largest usage charges by provider, service and service category.
SELECT ProviderName AS provider,
       ServiceName AS service,
       ServiceCategory AS category,
       round(sum(BilledCost), 2) AS billed_usd
FROM focus
WHERE lower(ChargeCategory) = 'usage'
GROUP BY ALL
ORDER BY billed_usd DESC
LIMIT 5;
```

```bash
duckdb focus.duckdb -f focus/top-services.sql
```

```text
┌───────────┬──────────────────────────────┬───────────┬────────────┐
│ provider  │           service            │ category  │ billed_usd │
│  varchar  │           varchar            │  varchar  │   double   │
├───────────┼──────────────────────────────┼───────────┼────────────┤
│ AWS       │ Amazon Elastic Compute Cloud │ Compute   │    1660.03 │
│ Microsoft │ Virtual Machines             │ Compute   │     168.24 │
│ Microsoft │ Azure SQL Database           │ Databases │     149.04 │
│ Microsoft │ SQL Database                 │ Other     │     108.73 │
│ AWS       │ Amazon Elastic Compute Cloud │ Storage   │      96.98 │
└───────────┴──────────────────────────────┴───────────┴────────────┘
```

Amazon EC2 appears twice because FOCUS splits it into compute and storage (EBS volumes are billed under EC2). Look at the third and fourth rows too: the Azure data reports SQL Database under two names and in two categories (`Databases` and `Other`). FOCUS fixes the column names, not the values each provider puts in them, so check the values for the services you report on and map them once in a view, as Part 2 did for tags.

Check one more thing before you point these queries at your own export: the type of the `Tags` column. In the CSV sample it is a JSON string, read with `json_extract_string(Tags, '$.service')`. In AWS's FOCUS 1.2 export it is a `map<string, string>`, so in DuckDB you write `Tags['service']` instead.

## Estimating Before You Deploy: Infracost

[Infracost](https://www.infracost.io/) reads Terraform (also Terragrunt and CloudFormation), prices each resource with the provider's public prices and shows the monthly cost of a change. It is the most common way to put cost into a pull request.

Infracost changed in 2026, and older tutorials no longer match:

- The **current CLI** is version 2 ([infracost/cli](https://github.com/infracost/cli), v2.18.2 on 22 October 2026). You log in with `infracost auth login` (or set `INFRACOST_CLI_AUTHENTICATION_TOKEN` in CI) and run `infracost scan` on a directory.
- **In pull requests**, Infracost recommends its GitHub App; the GitHub Actions alternative is `infracost/actions` v5 (`diff` and `scan`), which runs the `ghcr.io/infracost/ci` image. [Part 5](/guides/finops-for-devops-engineers/05-cicd-integration) sets it up.
- The **older CLI** (`infracost breakdown`, `infracost diff`, `infracost comment`, v0.10.47 on 21 October 2026) still gets releases, and the v3 `setup` action still installs it, but new integrations should use the v2 tools.
- Every option needs an Infracost account. The [free plan](https://www.infracost.io/pricing/) covers 1,000 runs a month; paid plans add guardrails, budgets, custom price books and FinOps policies that block a pull request.

An estimate covers prices that Terraform can see: instance hours, provisioned storage, load balancer hours. Usage-based charges, such as data transfer, requests and log volume, depend on traffic that is not in the code, so treat the estimate as the fixed part of the bill.

## Kubernetes: OpenCost and Kubecost

A Kubernetes bill shows nodes. To know what each team's workloads cost, a tool has to split each node's price by the CPU, memory and storage that pods request or use. Two tools do this:

- **[OpenCost](https://opencost.io/)**, an open source CNCF project (incubating since October 2024). It allocates costs by cluster, node, namespace, controller, pod and label, prices nodes from the AWS, Azure or Google Cloud billing APIs (or from your own prices on premises) and compares requests with usage. Recent releases can run without Prometheus, using a built-in collector.
- **IBM Kubecost**, the commercial product OpenCost came from (IBM acquired Kubecost in 2024). Kubecost 3.0, released in October 2025, replaced its Prometheus dependency with a lighter agent.

This run installs OpenCost on a local kind cluster with two example workloads from the companion repository: `checkout-api` requests 500m CPU and 512 MiB per replica and sits idle, and `report-builder` requests 100m CPU but runs a busy loop with a 400m limit.

```yaml
# checkout-api reserves far more CPU and memory than it uses.
apiVersion: v1
kind: Namespace
metadata:
  name: checkout
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout-api
  namespace: checkout
spec:
  replicas: 2
  selector:
    matchLabels:
      app: checkout-api
  template:
    metadata:
      labels:
        app: checkout-api
    spec:
      containers:
        - name: api
          image: nginx:1.30.6-alpine
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              memory: 512Mi
---
# report-builder uses more CPU than it requests.
apiVersion: v1
kind: Namespace
metadata:
  name: reports
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: report-builder
  namespace: reports
spec:
  replicas: 1
  selector:
    matchLabels:
      app: report-builder
  template:
    metadata:
      labels:
        app: report-builder
    spec:
      containers:
        - name: builder
          image: busybox:1.38.0
          command: ['sh', '-c', 'while true; do :; done']
          resources:
            requests:
              cpu: 100m
              memory: 64Mi
            limits:
              cpu: 400m
              memory: 64Mi
```

The Helm values turn on the collector and turn off the web UI:

```yaml
# OpenCost without Prometheus: the collector data source scrapes the
# cluster itself. Without a cloud provider (kind), OpenCost uses its
# default prices; set customPricing for your own rates.
opencost:
  exporter:
    defaultClusterId: kind-finops
    collectorDataSource:
      enabled: true
      scrapeInterval: 30s
  ui:
    enabled: false
```

Create the cluster, install the chart and the workloads, and forward the API port:

```bash
kind create cluster --config opencost/kind.yaml --wait 180s
```

```terminal
{
  "title": "Install OpenCost",
  "prompt": "$",
  "steps": [
    {
      "cmd": "helm repo add opencost https://opencost.github.io/opencost-helm-chart",
      "output": "\"opencost\" has been added to your repositories"
    },
    {
      "cmd": "helm install opencost opencost/opencost --version 2.5.33 --namespace opencost --create-namespace --values opencost/values.yaml --wait --timeout 5m",
      "output": "NAME: opencost\nLAST DEPLOYED: Tue Oct 27 09:12:04 2026\nNAMESPACE: opencost\nSTATUS: deployed\nREVISION: 1\nDESCRIPTION: Install complete\nTEST SUITE: None"
    },
    {
      "cmd": "kubectl apply -f opencost/workloads.yaml",
      "output": "namespace/checkout created\ndeployment.apps/checkout-api created\nnamespace/reports created\ndeployment.apps/report-builder created"
    },
    {
      "cmd": "kubectl get pods -n opencost",
      "output": "NAME                        READY   STATUS    RESTARTS   AGE\nopencost-74f98f8784-pqngx   1/1     Running   0          18s"
    },
    {
      "cmd": "kubectl -n opencost port-forward service/opencost 9003:9003 > /dev/null 2>&1 &"
    }
  ]
}
```

Give the collector some time to gather data. After about 20 minutes, ask the allocation API for the last hour per namespace, and turn the JSON into a table with `jq`:

```bash
curl -s 'http://localhost:9003/allocation?window=1h&aggregate=namespace&accumulate=true' | jq -r '["NAMESPACE", "MINUTES", "CPU_REQ", "CPU_USED", "RAM_REQ_MIB", "RAM_USED_MIB", "COST_USD"], (.data[0][] | [.name, .minutes, .cpuCoreRequestAverage, (.cpuCoreUsageAverage * 1000 | round / 1000), (.ramByteRequestAverage / 1048576 | round), (.ramByteUsageAverage / 1048576 | round), .totalCost]) | @tsv' | column -t
```

```text
NAMESPACE           MINUTES   CPU_REQ  CPU_USED  RAM_REQ_MIB  RAM_USED_MIB  COST_USD
checkout            19.5      1        0         1024         9             0.01165
kube-system         19.86667  0.95     0.051     290          419           0.0108
local-path-storage  19.86667  0        0         0            11            0.00002
opencost            19.86667  0.01     0.001     55           60            0.00019
reports             19.5      0.1      0.397     64           0             0.00409
```

The prices are OpenCost's defaults for a cluster without a cloud provider (USD 0.031611 per CPU-hour and USD 0.004237 per GiB-hour of memory, from its `configs/default.json`), so the dollar amounts are tiny; the shares are what matter:

- **`checkout` reserves capacity it does not use.** It requests one CPU and 1,024 MiB and uses almost no CPU and 9 MiB, yet it is the largest line: USD 0.01165 of the USD 0.02675 allocated to these namespaces. (The query leaves out idle node capacity; OpenCost reports it as an `__idle__` line when you add `includeIdle=true`, which you need to reconcile the allocation with the node bill.) OpenCost charges a workload for the larger of what it requests and what it uses, because a request blocks that capacity for everyone else. Lowering the requests is the right-sizing fix.
- **`report-builder` uses about four times its CPU request** (0.397 against 0.1, capped by its 0.4 limit), and its cost follows its usage. The scheduler only reserves 0.1 CPU for it, so on a busy node it competes for CPU it never reserved. Raise its request to what it uses.
- **`kube-system` uses more memory than it requests**, which is common for system pods.

On a real cluster, set the cloud provider integration (or `customPricing` with your node prices) and watch requests against usage per namespace over a few weeks before you change requests.

Delete the cluster when you are done: `kind delete cluster --name finops`.

## Policies on Running Resources: Cloud Custodian

[Cloud Custodian](https://cloudcustodian.io/) (a CNCF incubating project since 2022) runs YAML policies against your cloud accounts. Each policy picks a resource type, filters it and optionally acts: tag, notify, stop or delete. It turns the one-off checks from Part 2 into a scheduled job.

These policies find the leftovers from Part 2 and give instances without an `owner` tag a four-day grace period before they are stopped:

```yaml
policies:
  - name: ebs-unattached
    resource: aws.ebs
    description: EBS volumes that are not attached to any instance.
    filters:
      - State: available

  - name: eip-unassociated
    resource: aws.network-addr
    description: Elastic IP addresses that are allocated but not associated.
    filters:
      - AssociationId: absent

  # Marks running instances without an owner tag once; the stop date is
  # four days after the first run that finds them.
  - name: ec2-missing-owner-mark
    resource: aws.ec2
    description: Running instances without an owner tag get a stop date.
    filters:
      - State.Name: running
      - 'tag:owner': absent
      - 'tag:c7n-missing-owner': absent
    actions:
      - type: mark-for-op
        tag: c7n-missing-owner
        op: stop
        days: 4

  # Stops marked instances whose date has passed and that still have no owner.
  - name: ec2-missing-owner-stop
    resource: aws.ec2
    description: Stops instances whose grace period ended without an owner tag.
    filters:
      - State.Name: running
      - 'tag:owner': absent
      - type: marked-for-op
        tag: c7n-missing-owner
        op: stop
    actions:
      - stop
```

Install it in a virtual environment:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install c7n==0.9.53.0
```

Then check the version and validate the policy file:

```terminal
{
  "title": "Validate the policies",
  "prompt": "$",
  "steps": [
    {
      "cmd": "custodian version",
      "output": "0.9.53"
    },
    {
      "cmd": "custodian validate custodian/cost.yml",
      "output": "2026-10-27 09:11:46,975: custodian.commands:INFO Configuration valid: custodian/cost.yml"
    }
  ]
}
```

A dry run applies the filters and records what matched, but takes no action. Here it ran against [moto](https://github.com/getmoto/moto), a local AWS emulator, seeded with two detached volumes, one unused Elastic IP and one running instance without an `owner` tag (`custodian/seed-moto.py`). Against your account, run the same command with read-only credentials:

```terminal
{
  "title": "Dry run and report",
  "prompt": "$",
  "steps": [
    {
      "cmd": "custodian run --dryrun -s out custodian/cost.yml",
      "output": "2026-10-27 09:11:51,876: custodian.policy:INFO policy:ebs-unattached resource:aws.ebs region:us-east-1 count:2 time:0.13\n2026-10-27 09:11:51,889: custodian.policy:INFO policy:eip-unassociated resource:aws.network-addr region:us-east-1 count:1 time:0.01\n2026-10-27 09:11:51,905: custodian.policy:INFO policy:ec2-missing-owner-mark resource:aws.ec2 region:us-east-1 count:1 time:0.01\n2026-10-27 09:11:51,906: custodian.policy:INFO policy:ec2-missing-owner-stop resource:aws.ec2 region:us-east-1 count:0 time:0.00"
    },
    {
      "cmd": "custodian report -s out custodian/cost.yml -p ebs-unattached --format grid",
      "output": "+-----------------------+-----------------------------+--------+--------------+------------+\n| VolumeId              | Attachments[0].InstanceId   |   Size | VolumeType   | KmsKeyId   |\n+=======================+=============================+========+==============+============+\n| vol-2f3a2c57ab5d1cbf5 |                             |     20 | gp3          |            |\n+-----------------------+-----------------------------+--------+--------------+------------+\n| vol-4b458d2516a5f4c77 |                             |    100 | gp3          |            |\n+-----------------------+-----------------------------+--------+--------------+------------+"
    },
    {
      "cmd": "custodian report -s out custodian/cost.yml -p eip-unassociated --format grid",
      "output": "+----------------------------+----------------+\n| AllocationId               | PublicIp       |\n+============================+================+\n| eipalloc-d8aa29fabdeafb9e1 | 127.109.87.177 |\n+----------------------------+----------------+"
    }
  ]
}
```

The first three policies found what was seeded: two volumes (20 and 100 GB), one address and one instance without an owner. The stop policy found nothing, because a dry run marks nothing. To repeat the run without an AWS account, start moto in the same virtual environment and point the AWS SDK at it:

```bash
pip install 'moto[server]==5.2.4'
moto_server -p 5000 > moto.log 2>&1 &
export AWS_ENDPOINT_URL=http://127.0.0.1:5000 AWS_ACCESS_KEY_ID=testing AWS_SECRET_ACCESS_KEY=testing AWS_DEFAULT_REGION=us-east-1
python custodian/seed-moto.py
```

Run `unset AWS_ENDPOINT_URL AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY` before you point Custodian at a real account. Without `--dryrun`, `ec2-missing-owner-mark` tags the instance with `c7n-missing-owner` and a stop date four days out. It marks each instance only once, because it skips instances that already carry the tag; without that filter, every daily run would push the date back. On a later run, `ec2-missing-owner-stop` stops the instance if the date has passed and it still has no `owner` tag. The gap gives the owner time to add the tag or object.

To run it for real:

- Run it daily from a scheduled CI job or in Custodian's Lambda mode (`mode: periodic`), with an IAM role that can only do what the policies need.
- Start with report-only policies and send the results to the owners (the `notify` action with c7n-mailer, or a ticket). Add actions once the reports are trusted.
- Use `--region all`, or run per Region, so leftovers in a Region nobody looks at are found too.

## Commercial Platforms

When several clouds, many accounts, SaaS bills and finance users who do not write SQL are involved, a commercial platform saves building your own. Common choices include [Vantage](https://www.vantage.sh/), [CloudZero](https://www.cloudzero.com/), Harness Cloud Cost Management, IBM Cloudability, Finout and Flexera. They differ in allocation rules for shared costs, unit cost features, Kubernetes support and how they handle commitments. Run a trial with your own billing export before you choose.

Vantage also runs [instances.vantage.sh](https://instances.vantage.sh/), a free comparison of instance types and prices across AWS, Azure and Google Cloud that is handy for right-sizing decisions.

## Choosing What You Need

Add tools in this order, and only when the previous step stops answering your questions:

1. **Native tools and the FOCUS export** for every team. They cover visibility, budgets and anomalies at no or low cost.
2. **Infracost** when infrastructure changes go through pull requests and nobody can say what a change will cost.
3. **OpenCost or Kubecost** when Kubernetes is a large share of the bill and several teams share clusters.
4. **Cloud Custodian** when the same cleanup comes up in every review and you want it enforced.
5. **A commercial platform** when the reporting and allocation work takes more time than the tool would cost.

For any tool, ask: does it read your provider's billing export (and FOCUS)? Does it understand commitments and credits, or does it only use list prices? Does it fit into pull requests and chat, where engineers already work? And who will look at it every week?

## Summary

- Each cloud has a cost explorer, budgets, anomaly detection, recommendations and a detailed export; turn them on before buying anything.
- AWS, Azure and Google Cloud export FOCUS data, so one SQL query covers all three, but check the values each provider writes.
- Infracost puts the cost of a change in the pull request; its 2026 tools are CLI v2, the GitHub App and the v5 actions.
- OpenCost splits Kubernetes node costs by namespace and shows how much of each request is used.
- Cloud Custodian turns cleanup checks into scheduled, reviewable policies; start with reports and add actions later.

Next, [Part 4](/guides/finops-for-devops-engineers/04-practical-examples) builds the `checkout` service's tags, sizes, budget and anomaly alert in Terraform.

## Keep Learning

- [How to Set Up AWS Cost Explorer and Budgets for Teams](/posts/how-to-set-up-aws-cost-explorer-and-budgets-for-teams)
- [Right-Sizing Kubernetes Resources with VPA and Karpenter](/posts/right-sizing-kubernetes-resources-vpa-karpenter)
- [Kubernetes 1.37 Really Can Flag Unused PVCs, but the Viral YAML Is Wrong](/posts/kubernetes-1-37-unused-pvc-condition)
- [Cloud Cost Optimization Quiz](/quizzes/cloud-cost-optimization-quiz)
