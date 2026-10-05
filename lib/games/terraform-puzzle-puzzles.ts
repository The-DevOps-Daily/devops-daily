// Puzzles for the Terraform State Puzzle.
//
// Every transcript was recorded with Terraform v1.15.8 (linux_arm64) on 2026-10-06.
// The runs used local stand-ins: terraform_data for most resources, local_file for
// the deleted alarm, and an http backend with lock endpoints for the lock puzzles.
// To read like AWS, resource types and names, IDs, timestamps and the lock holder
// are relabelled, and the attribute lines inside resource bodies are the story's
// attributes, trimmed to the few that matter. Resource headers, action symbols,
// the "(because ...)", "(imported from ...)" and "# Warning" notes, warnings,
// errors, prompts, progress lines and Plan: summaries are what Terraform printed.
// The note about the -out option that follows every plan is left out.
//
// AWS facts the stories rely on (terraform-provider-aws, internal/service/rds):
// storage_encrypted is ForceNew on aws_db_instance, and the importer sets
// skip_final_snapshot = true and delete_automated_backups = true.

import { lines as L, type Puzzle, type Transcript } from './terraform-puzzle-engine';

function apply(id: string, plan: string, progress: string[], trimmed = true): Transcript {
  return {
    id,
    title: 'Apply',
    command: 'terraform apply',
    note: 'Starts at the end of the plan, which is the same as the plan above.',
    lines: [
      plan,
      '',
      'Do you want to perform these actions?',
      '  Terraform will perform the actions described above.',
      "  Only 'yes' will be accepted to approve.",
      '',
      '  Enter a value: yes',
      '',
      ...progress,
    ],
    trimmed,
  };
}

const NO_CHANGES = L(`
No changes. Your infrastructure matches the configuration.

Terraform has compared your real infrastructure against your configuration
and found no differences, so no changes are needed.
`);

const SYMBOLS = L(`
Terraform used the selected providers to generate the following execution
plan. Resource actions are indicated with the following symbols:
`);

// 1. Wrong workspace ---------------------------------------------------------

const WS_PLAN = [
  ...SYMBOLS,
  ...L(`
  + create

Terraform will perform the following actions:

  # aws_db_instance.primary will be created
  + resource "aws_db_instance" "primary" {
      + engine         = "postgres"
      + id             = (known after apply)
      + identifier     = "acme-prod-db"
      + instance_class = "db.t4g.large"
    }

  # aws_ecs_service.api will be created
  + resource "aws_ecs_service" "api" {
      + desired_count = 3
      + id            = (known after apply)
      + name          = "api"
    }

  # aws_lb.api will be created
  + resource "aws_lb" "api" {
      + dns_name           = (known after apply)
      + id                 = (known after apply)
      + load_balancer_type = "application"
      + name               = "api"
      + subnets            = (known after apply)
    }

  # aws_subnet.private["eu-west-1a"] will be created
  + resource "aws_subnet" "private" {
      + availability_zone = "eu-west-1a"
      + cidr_block        = "10.20.0.0/20"
      + id                = (known after apply)
      + vpc_id            = (known after apply)
    }

  # aws_subnet.private["eu-west-1b"] will be created
  + resource "aws_subnet" "private" {
      + availability_zone = "eu-west-1b"
      + cidr_block        = "10.20.16.0/20"
      + id                = (known after apply)
      + vpc_id            = (known after apply)
    }

  # aws_vpc.main will be created
  + resource "aws_vpc" "main" {
      + cidr_block = "10.20.0.0/16"
      + id         = (known after apply)
    }

Plan: 6 to add, 0 to change, 0 to destroy.
`),
];

const wrongWorkspace: Puzzle = {
  id: 'wrong-workspace',
  title: 'Plan wants to build production again',
  difficulty: 'Easy',
  story:
    'You cloned the platform repo on a new laptop this morning and ran terraform init. Now terraform plan wants to create all of production, which is up and serving traffic. The team keeps one workspace per environment in the S3 backend, and CI selects the right one itself.',
  goal: 'Get a plan against the real production state that shows no changes, without touching AWS.',
  files: [
    {
      name: 'backend.tf',
      lines: L(`
terraform {
  backend "s3" {
    bucket       = "acme-terraform-state"
    key          = "platform/terraform.tfstate"
    region       = "eu-west-1"
    use_lockfile = true
  }
}
`),
    },
    {
      name: 'main.tf',
      lines: L(`
# Trimmed to the arguments that matter here.
resource "aws_vpc" "main" {
  cidr_block = "10.20.0.0/16"
}

resource "aws_subnet" "private" {
  for_each = {
    "eu-west-1a" = "10.20.0.0/20"
    "eu-west-1b" = "10.20.16.0/20"
  }
  vpc_id            = aws_vpc.main.id
  availability_zone = each.key
  cidr_block        = each.value
}

resource "aws_lb" "api" {
  name               = "api"
  load_balancer_type = "application"
  subnets            = [for s in aws_subnet.private : s.id]
}

resource "aws_ecs_service" "api" {
  name          = "api"
  desired_count = 3
}

resource "aws_db_instance" "primary" {
  identifier     = "acme-prod-db"
  engine         = "postgres"
  instance_class = "db.t4g.large"
}
`),
    },
  ],
  evidence: [{ id: 'plan', title: 'Plan', command: 'terraform plan', lines: WS_PLAN }],
  inspects: [
    {
      id: 'ws-show',
      label: 'Which workspace am I in?',
      transcript: {
        id: 'ws-show',
        title: 'Workspace',
        command: 'terraform workspace show',
        lines: ['default'],
      },
    },
    {
      id: 'ws-list',
      label: 'Which workspaces exist?',
      transcript: {
        id: 'ws-list',
        title: 'Workspaces',
        command: 'terraform workspace list',
        lines: ['* default', '  prod', '  staging'],
      },
    },
    {
      id: 'prod-state',
      label: 'What does the prod workspace hold?',
      transcript: {
        id: 'prod-state',
        title: 'prod state',
        command: 'TF_WORKSPACE=prod terraform state list',
        lines: L(`
aws_db_instance.primary
aws_ecs_service.api
aws_lb.api
aws_subnet.private["eu-west-1a"]
aws_subnet.private["eu-west-1b"]
aws_vpc.main
`),
      },
    },
  ],
  stateLabel: 'State (workspace "default")',
  bindings: [
    { code: 'aws_db_instance.primary', object: 'acme-prod-db (in prod state)', action: 'create' },
    { code: 'aws_vpc.main', object: 'vpc-0a1b2c3d (in prod state)', action: 'create' },
  ],
  options: [
    {
      id: 'apply',
      label: 'Apply it. The plan is just the code.',
      code: ['terraform apply'],
      outcome: {
        verdict: 'unsafe',
        summary: 'Terraform tries to build a second production next to the real one.',
        explanation:
          'This state is empty, so Terraform believes none of it exists. Some creates fail because a name is taken, such as the database identifier, others succeed, and you are left with a half-built copy of production that no one meant to make. A plan that wants to create everything for a running system almost always means you are reading the wrong state.',
        transcripts: [
          apply('apply', 'Plan: 6 to add, 0 to change, 0 to destroy.', [
            'aws_vpc.main: Creating...',
            'aws_ecs_service.api: Creating...',
            'aws_db_instance.primary: Creating...',
          ]),
        ],
        bindings: [
          {
            code: 'aws_db_instance.primary',
            object: 'a new acme-prod-db (name taken)',
            action: 'create',
          },
          { code: 'aws_vpc.main', object: 'a second VPC', action: 'create' },
        ],
      },
    },
    {
      id: 'import',
      label: 'Import every production resource into this state',
      code: [
        'terraform import aws_db_instance.primary acme-prod-db',
        'terraform import aws_vpc.main vpc-0a1b2c3d',
        '# ...and the other four',
      ],
      outcome: {
        verdict: 'unsafe',
        summary: 'Two states, default and prod, now both manage the same production objects.',
        explanation:
          'Import never checks whether another state already tracks an object. Now a destroy or a replacement planned from either workspace deletes real production resources, and the two states drift apart every time one of them is applied. Each real object should belong to exactly one state.',
        transcripts: [
          {
            id: 'import',
            title: 'Import',
            command: 'terraform import aws_db_instance.primary acme-prod-db',
            lines: L(`
aws_db_instance.primary: Importing from ID "acme-prod-db"...
aws_db_instance.primary: Import prepared!
  Prepared aws_db_instance for import
aws_db_instance.primary: Refreshing state... [id=acme-prod-db]

Import successful!

The resources that were imported are shown above. These resources are now in
your Terraform state and will henceforth be managed by Terraform.
`),
          },
        ],
        bindings: [
          {
            code: 'aws_db_instance.primary',
            state: 'aws_db_instance.primary',
            object: 'acme-prod-db, also in prod state',
            action: 'conflict',
          },
        ],
      },
    },
    {
      id: 'ws-new',
      label: 'Create the prod workspace',
      code: ['terraform workspace new prod'],
      outcome: {
        verdict: 'incomplete',
        summary: 'Terraform refuses: the workspace already exists.',
        explanation:
          'The prod workspace is already there, with production in it. You do not need a new one; you need to select it. Nothing changed, which is the good news.',
        transcripts: [
          {
            id: 'ws-new',
            title: 'New workspace',
            command: 'terraform workspace new prod',
            lines: ['Workspace "prod" already exists'],
          },
        ],
      },
    },
    {
      id: 'select',
      label: 'Switch to the prod workspace and plan again',
      code: ['terraform workspace select prod', 'terraform plan'],
      outcome: {
        verdict: 'best',
        summary: 'No changes: this is the state CI uses.',
        explanation:
          'Workspaces keep separate states for the same code. The selected workspace is stored in .terraform/environment, which is not committed, so a fresh clone starts in default. Selecting a workspace only changes which state Terraform reads: it does not pick AWS credentials or a .tfvars file, so use the same ones CI does. On a new machine, run terraform workspace show before anything else.',
        transcripts: [
          {
            id: 'select',
            title: 'Select and plan',
            command: 'terraform workspace select prod && terraform plan',
            lines: [
              'Switched to workspace "prod".',
              ...L(`
aws_vpc.main: Refreshing state... [id=vpc-0a1b2c3d]
aws_ecs_service.api: Refreshing state... [id=arn:aws:ecs:eu-west-1:111122223333:service/prod/api]
aws_db_instance.primary: Refreshing state... [id=db-K7Q2M4ZJXH3B5VN6PL0RT8YWUE]
aws_subnet.private["eu-west-1b"]: Refreshing state... [id=subnet-0b2c3d4e]
aws_subnet.private["eu-west-1a"]: Refreshing state... [id=subnet-0a1b2c3d]
aws_lb.api: Refreshing state... [id=arn:aws:elasticloadbalancing:eu-west-1:111122223333:loadbalancer/app/api/50dc6c495c0c9188]
`),
              '',
              ...NO_CHANGES,
            ],
          },
        ],
        bindings: [
          {
            code: 'aws_db_instance.primary',
            state: 'aws_db_instance.primary',
            object: 'acme-prod-db',
            action: 'none',
          },
          { code: 'aws_vpc.main', state: 'aws_vpc.main', object: 'vpc-0a1b2c3d', action: 'none' },
        ],
      },
    },
  ],
  hint: 'To Terraform, an empty state looks exactly like an empty AWS account. Which state is this plan reading?',
  lesson:
    'A plan that wants to create everything for a running system means Terraform is reading the wrong state. Check the workspace and backend before you change anything.',
  docs: [
    {
      title: 'Workspaces',
      href: 'https://developer.hashicorp.com/terraform/language/state/workspaces',
    },
    {
      title: 'terraform workspace select',
      href: 'https://developer.hashicorp.com/terraform/cli/commands/workspace/select',
    },
  ],
};

// 2. Rename ------------------------------------------------------------------

const DB_MAIN_DESTROY = L(`
  # aws_db_instance.main will be destroyed
  # (because aws_db_instance.main is not in configuration)
  - resource "aws_db_instance" "main" {
      - allocated_storage   = 100 -> null
      - engine              = "postgres" -> null
      - id                  = "db-K7Q2M4ZJXH3B5VN6PL0RT8YWUE" -> null
      - identifier          = "acme-prod-db" -> null
      - instance_class      = "db.t4g.large" -> null
      - skip_final_snapshot = true -> null
    }
`);

const rename: Puzzle = {
  id: 'rename',
  title: 'The tidy-up rename',
  difficulty: 'Easy',
  minVersion: '1.1',
  story:
    "A teammate's pull request renames the production database resource from main to primary, to follow the naming guide. Nothing else changed. CI posted this plan on the pull request.",
  goal: 'Merge the rename without touching the database: the plan must not destroy or create anything.',
  files: [
    {
      name: 'database.tf',
      lines: L(`
resource "aws_db_instance" "primary" {
  identifier          = "acme-prod-db"
  engine              = "postgres"
  instance_class      = "db.t4g.large"
  allocated_storage   = 100
  skip_final_snapshot = true
}
`),
    },
  ],
  evidence: [
    {
      id: 'plan',
      title: 'Plan',
      command: 'terraform plan',
      lines: [
        'aws_db_instance.main: Refreshing state... [id=db-K7Q2M4ZJXH3B5VN6PL0RT8YWUE]',
        '',
        ...SYMBOLS,
        '  + create',
        '  - destroy',
        '',
        'Terraform will perform the following actions:',
        '',
        ...DB_MAIN_DESTROY,
        ...L(`

  # aws_db_instance.primary will be created
  + resource "aws_db_instance" "primary" {
      + allocated_storage   = 100
      + engine              = "postgres"
      + id                  = (known after apply)
      + identifier          = "acme-prod-db"
      + instance_class      = "db.t4g.large"
      + skip_final_snapshot = true
    }

Plan: 1 to add, 0 to change, 1 to destroy.
`),
      ],
    },
  ],
  inspects: [
    {
      id: 'state-list',
      label: 'What is in the state?',
      transcript: {
        id: 'state-list',
        title: 'State',
        command: 'terraform state list',
        lines: ['aws_db_instance.main'],
      },
    },
    {
      id: 'diff',
      label: 'What did the pull request change?',
      transcript: {
        id: 'diff',
        title: 'Diff',
        command: 'git diff',
        lines: L(`
diff --git a/database.tf b/database.tf
index d118a4b..f725222 100644
--- a/database.tf
+++ b/database.tf
@@ -1,4 +1,4 @@
-resource "aws_db_instance" "main" {
+resource "aws_db_instance" "primary" {
   identifier          = "acme-prod-db"
   engine              = "postgres"
   instance_class      = "db.t4g.large"
`),
      },
    },
  ],
  bindings: [
    { state: 'aws_db_instance.main', object: 'acme-prod-db', action: 'destroy' },
    { code: 'aws_db_instance.primary', object: 'a new, empty instance', action: 'create' },
  ],
  options: [
    {
      id: 'apply',
      label: 'Apply it. Only the name changed.',
      code: ['terraform apply'],
      outcome: {
        verdict: 'unsafe',
        summary: 'Terraform deletes acme-prod-db and creates a new, empty database.',
        explanation:
          'Terraform tracks objects by address. To Terraform, aws_db_instance.main left the code and a new aws_db_instance.primary arrived, so it deletes one and creates the other. With skip_final_snapshot = true there is no final snapshot, and the automated backups go with the instance. The two actions are independent, so the create can also fail while the old identifier is still in use. Turn on deletion_protection for databases you care about.',
        transcripts: [
          apply('apply', 'Plan: 1 to add, 0 to change, 1 to destroy.', [
            'aws_db_instance.main: Destroying... [id=db-K7Q2M4ZJXH3B5VN6PL0RT8YWUE]',
          ]),
        ],
      },
    },
    {
      id: 'moved',
      label: 'Add a moved block',
      code: ['moved {', '  from = aws_db_instance.main', '  to   = aws_db_instance.primary', '}'],
      outcome: {
        verdict: 'best',
        summary:
          'Plan: 0 to add, 0 to change, 0 to destroy. The state entry is renamed when you apply.',
        explanation:
          'A moved block tells Terraform that the object at the old address now lives at the new one, so it renames the state entry instead of replacing anything. It is code, so it is reviewed in the pull request, and every state that uses this configuration picks it up on its next apply. The same works for moving a resource into a module: to = module.database.aws_db_instance.this. Keep the block until every state has applied it (Terraform 1.1 and later).',
        transcripts: [
          {
            id: 'moved',
            title: 'Plan with moved',
            command: 'terraform plan',
            lines: L(`
aws_db_instance.primary: Refreshing state... [id=db-K7Q2M4ZJXH3B5VN6PL0RT8YWUE]

Terraform will perform the following actions:

  # aws_db_instance.main has moved to aws_db_instance.primary
    resource "aws_db_instance" "primary" {
        id                  = "db-K7Q2M4ZJXH3B5VN6PL0RT8YWUE"
        # (5 unchanged attributes hidden)
    }

Plan: 0 to add, 0 to change, 0 to destroy.
`),
          },
        ],
        bindings: [
          {
            code: 'aws_db_instance.primary',
            state: 'main → primary',
            object: 'acme-prod-db',
            action: 'move',
          },
        ],
      },
    },
    {
      id: 'state-mv',
      label: 'Rename it in the state',
      code: ['terraform state mv aws_db_instance.main aws_db_instance.primary'],
      outcome: {
        verdict: 'works',
        summary: 'The state entry is renamed and the next plan shows no changes.',
        explanation:
          'This works, but it changes the state immediately, outside the plan and review flow, and the pull request does not show it. Every other state that uses this code, such as staging, needs the same command at the right moment. If you do use it, preview with -dry-run first. A moved block does the same job as part of a normal reviewed plan.',
        transcripts: [
          {
            id: 'state-mv',
            title: 'State move',
            command: 'terraform state mv aws_db_instance.main aws_db_instance.primary',
            lines: L(`
Move "aws_db_instance.main" to "aws_db_instance.primary"
Successfully moved 1 object(s).
`),
          },
          {
            id: 'state-mv-plan',
            title: 'Plan after',
            command: 'terraform plan',
            lines: [
              'aws_db_instance.primary: Refreshing state... [id=db-K7Q2M4ZJXH3B5VN6PL0RT8YWUE]',
              '',
              ...NO_CHANGES,
            ],
          },
        ],
        bindings: [
          {
            code: 'aws_db_instance.primary',
            state: 'aws_db_instance.primary',
            object: 'acme-prod-db',
            action: 'none',
          },
        ],
      },
    },
    {
      id: 'import',
      label: 'Import the database at the new address',
      code: ['import {', '  to = aws_db_instance.primary', '  id = "acme-prod-db"', '}'],
      outcome: {
        verdict: 'unsafe',
        summary: 'Plan: 1 to import, 0 to add, 0 to change, 1 to destroy.',
        explanation:
          'Importing does not move ownership. Now two addresses point at acme-prod-db, and main, which is no longer in the code, is still set to be destroyed. Destroying main deletes the very database that primary just imported.',
        transcripts: [
          {
            id: 'import',
            title: 'Plan with import',
            command: 'terraform plan',
            lines: [
              'aws_db_instance.primary: Preparing import... [id=acme-prod-db]',
              'aws_db_instance.primary: Refreshing state... [id=acme-prod-db]',
              'aws_db_instance.main: Refreshing state... [id=db-K7Q2M4ZJXH3B5VN6PL0RT8YWUE]',
              '',
              ...SYMBOLS,
              '  - destroy',
              '',
              'Terraform will perform the following actions:',
              '',
              ...DB_MAIN_DESTROY,
              ...L(`

  # aws_db_instance.primary will be imported
    resource "aws_db_instance" "primary" {
        id                  = "db-K7Q2M4ZJXH3B5VN6PL0RT8YWUE"
        # (5 unchanged attributes hidden)
    }

Plan: 1 to import, 0 to add, 0 to change, 1 to destroy.
`),
            ],
          },
        ],
        bindings: [
          {
            code: 'aws_db_instance.primary',
            state: 'aws_db_instance.primary',
            object: 'acme-prod-db',
            action: 'import',
          },
          {
            state: 'aws_db_instance.main',
            object: 'acme-prod-db (the same one)',
            action: 'destroy',
          },
        ],
      },
    },
  ],
  hint: 'Terraform tracks objects by address. How do you tell it that the address changed, not the object?',
  lesson:
    'Renaming a resource is a destroy and a create unless you tell Terraform it moved. A moved block does that in code, so the rename is reviewed with everything else.',
  docs: [
    {
      title: 'Refactor modules and resources with moved blocks',
      href: 'https://developer.hashicorp.com/terraform/language/modules/develop/refactoring',
    },
    {
      title: 'terraform state mv',
      href: 'https://developer.hashicorp.com/terraform/cli/commands/state/mv',
    },
  ],
};

// 3. Deleted alarm -----------------------------------------------------------

const ALARM_CREATE = L(`
  # aws_cloudwatch_metric_alarm.queue_depth will be created
  + resource "aws_cloudwatch_metric_alarm" "queue_depth" {
      + alarm_name          = "orders-queue-depth"
      + arn                 = (known after apply)
      + comparison_operator = "GreaterThanThreshold"
      + id                  = (known after apply)
      + metric_name         = "ApproximateNumberOfMessagesVisible"
      + namespace           = "AWS/SQS"
      + threshold           = 1000
    }
`);

const ALARM_REFRESH = [
  'aws_cloudwatch_metric_alarm.queue_depth: Refreshing state... [id=orders-queue-depth]',
  'aws_cloudwatch_metric_alarm.api_5xx: Refreshing state... [id=api-5xx]',
];

function alarmPlan(refresh: string[]): string[] {
  return [
    ...refresh,
    '',
    ...SYMBOLS,
    '  + create',
    '',
    'Terraform will perform the following actions:',
    '',
    ...ALARM_CREATE,
    '',
    'Plan: 1 to add, 0 to change, 0 to destroy.',
  ];
}

const REFRESH_ONLY_REPORT = L(`
Note: Objects have changed outside of Terraform

Terraform detected the following changes made outside of Terraform since the
last "terraform apply" which may have affected this plan:

  # aws_cloudwatch_metric_alarm.queue_depth has been deleted
  - resource "aws_cloudwatch_metric_alarm" "queue_depth" {
      - alarm_name          = "orders-queue-depth" -> null
      - arn                 = "arn:aws:cloudwatch:eu-west-1:111122223333:alarm:orders-queue-depth" -> null
      - comparison_operator = "GreaterThanThreshold" -> null
      - id                  = "orders-queue-depth" -> null
      - metric_name         = "ApproximateNumberOfMessagesVisible" -> null
      - namespace           = "AWS/SQS" -> null
      - threshold           = 1000 -> null
    }


This is a refresh-only plan, so Terraform will not take any actions to undo
these. If you were expecting these changes then you can apply this plan to
record the updated values in the Terraform state without changing any remote
objects.
`);

const deletedAlarm: Puzzle = {
  id: 'deleted-alarm',
  title: 'The alarm someone deleted',
  difficulty: 'Medium',
  story:
    'At 03:10 the on-call engineer deleted the orders-queue-depth alarm in the CloudWatch console: it paged every night for a queue that drains itself. In the morning the team agreed that the alarm stays gone. The code still declares it.',
  goal: "Make Terraform agree with the team's decision, so no plan recreates the alarm.",
  files: [
    {
      name: 'alarms.tf',
      lines: L(`
resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "api-5xx"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  statistic           = "Sum"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 50
  period              = 60
  evaluation_periods  = 2
  alarm_actions       = ["arn:aws:sns:eu-west-1:111122223333:oncall"]
}

resource "aws_cloudwatch_metric_alarm" "queue_depth" {
  alarm_name          = "orders-queue-depth"
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  statistic           = "Maximum"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 1000
  period              = 300
  evaluation_periods  = 1
  alarm_actions       = ["arn:aws:sns:eu-west-1:111122223333:oncall"]
}
`),
    },
  ],
  evidence: [
    { id: 'plan', title: 'Plan', command: 'terraform plan', lines: alarmPlan(ALARM_REFRESH) },
  ],
  inspects: [
    {
      id: 'refresh-only',
      label: 'What changed outside Terraform?',
      transcript: {
        id: 'refresh-only',
        title: 'Refresh-only plan',
        command: 'terraform plan -refresh-only',
        lines: [...ALARM_REFRESH, '', ...REFRESH_ONLY_REPORT],
      },
    },
    {
      id: 'state-list',
      label: 'What is in the state?',
      transcript: {
        id: 'state-list',
        title: 'State',
        command: 'terraform state list',
        lines: ['aws_cloudwatch_metric_alarm.api_5xx', 'aws_cloudwatch_metric_alarm.queue_depth'],
      },
    },
  ],
  bindings: [
    {
      code: 'aws_cloudwatch_metric_alarm.queue_depth',
      state: 'aws_cloudwatch_metric_alarm.queue_depth',
      object: 'deleted at 03:10',
      action: 'create',
    },
    {
      code: 'aws_cloudwatch_metric_alarm.api_5xx',
      state: 'aws_cloudwatch_metric_alarm.api_5xx',
      object: 'api-5xx',
      action: 'none',
    },
  ],
  options: [
    {
      id: 'apply',
      label: 'Apply the plan',
      code: ['terraform apply'],
      outcome: {
        verdict: 'unsafe',
        summary: 'Terraform recreates the alarm the team deleted. It pages again tonight.',
        explanation:
          'The code still declares the alarm, so Terraform does its job and puts it back. Applying is the right move when a console change was a mistake. Here it undoes a decision the team made on purpose.',
        transcripts: [
          apply(
            'apply',
            'Plan: 1 to add, 0 to change, 0 to destroy.',
            [
              'aws_cloudwatch_metric_alarm.queue_depth: Creating...',
              'aws_cloudwatch_metric_alarm.queue_depth: Creation complete after 0s [id=orders-queue-depth]',
              '',
              'Apply complete! Resources: 1 added, 0 changed, 0 destroyed.',
            ],
            false
          ),
        ],
        bindings: [
          {
            code: 'aws_cloudwatch_metric_alarm.queue_depth',
            state: 'aws_cloudwatch_metric_alarm.queue_depth',
            object: 'orders-queue-depth, back again',
            action: 'create',
          },
        ],
      },
    },
    {
      id: 'refresh-only',
      label: 'Accept the change into the state',
      code: ['terraform apply -refresh-only'],
      outcome: {
        verdict: 'incomplete',
        summary: 'The state forgets the alarm, but the next plan still wants to create it.',
        explanation:
          'apply -refresh-only writes what Terraform found into the state: here, that the alarm is gone. It never changes the code, and the code still declares the alarm, so the next normal plan creates it again. A fine first step, but not the fix.',
        transcripts: [
          {
            id: 'refresh-only-apply',
            title: 'Refresh-only apply',
            command: 'terraform apply -refresh-only',
            note: 'Starts after the same "has been deleted" report as terraform plan -refresh-only.',
            lines: [
              ...L(`
This is a refresh-only plan, so Terraform will not take any actions to undo
these. If you were expecting these changes then you can apply this plan to
record the updated values in the Terraform state without changing any remote
objects.

Would you like to update the Terraform state to reflect these detected changes?
  Terraform will write these changes to the state without modifying any real infrastructure.
  There is no undo. Only 'yes' will be accepted to confirm.

  Enter a value: yes


Apply complete! Resources: 0 added, 0 changed, 0 destroyed.
`),
            ],
          },
          {
            id: 'refresh-only-plan',
            title: 'Next plan',
            command: 'terraform plan',
            lines: alarmPlan([
              'aws_cloudwatch_metric_alarm.api_5xx: Refreshing state... [id=api-5xx]',
            ]),
          },
        ],
        bindings: [
          { code: 'aws_cloudwatch_metric_alarm.queue_depth', object: 'none', action: 'create' },
        ],
      },
    },
    {
      id: 'ignore',
      label: 'Tell Terraform to ignore the alarm',
      code: [
        'resource "aws_cloudwatch_metric_alarm" "queue_depth" {',
        '  # ...',
        '  lifecycle {',
        '    ignore_changes = all',
        '  }',
        '}',
      ],
      outcome: {
        verdict: 'incomplete',
        summary: 'The plan still creates the alarm.',
        explanation:
          'ignore_changes tells Terraform to ignore differences in the arguments of an object that exists. It does nothing for an object that is missing, so applying this plan would still recreate the alarm, and the code would now hide future changes to it too.',
        transcripts: [
          {
            id: 'ignore-plan',
            title: 'Plan',
            command: 'terraform plan',
            lines: alarmPlan(ALARM_REFRESH),
          },
        ],
        bindings: [
          {
            code: 'aws_cloudwatch_metric_alarm.queue_depth',
            state: 'aws_cloudwatch_metric_alarm.queue_depth',
            object: 'deleted at 03:10',
            action: 'create',
          },
        ],
      },
    },
    {
      id: 'delete-block',
      label: 'Delete the alarm from the code',
      code: ['# remove the aws_cloudwatch_metric_alarm.queue_depth block', 'terraform plan'],
      outcome: {
        verdict: 'best',
        summary: 'No changes. One apply drops the alarm from the state.',
        explanation:
          'The code is where the team records decisions. With the block gone, the refresh finds that the alarm is already deleted, so there is nothing to do; one apply records that in the state. When you suspect drift, start with terraform plan -refresh-only: it shows what changed outside Terraform without proposing to undo it.',
        transcripts: [
          {
            id: 'delete-plan',
            title: 'Plan',
            command: 'terraform plan',
            lines: [
              'aws_cloudwatch_metric_alarm.api_5xx: Refreshing state... [id=api-5xx]',
              'aws_cloudwatch_metric_alarm.queue_depth: Refreshing state... [id=orders-queue-depth]',
              '',
              ...NO_CHANGES,
            ],
          },
          {
            id: 'delete-apply',
            title: 'Apply and state',
            command: 'terraform apply && terraform state list',
            note: 'Starts after the same "No changes" report.',
            lines: [
              'Apply complete! Resources: 0 added, 0 changed, 0 destroyed.',
              'aws_cloudwatch_metric_alarm.api_5xx',
            ],
          },
        ],
        bindings: [
          {
            state: 'aws_cloudwatch_metric_alarm.queue_depth',
            object: 'already deleted',
            action: 'forget',
          },
        ],
      },
    },
  ],
  hint: 'Which one decides what the next plan does: the state or the code?',
  lesson:
    'Drift can be settled in two directions: apply the code to undo it, or change the code to keep it. Refresh-only updates the state; the code still decides the next plan.',
  docs: [
    {
      title: 'Manage resource drift',
      href: 'https://developer.hashicorp.com/terraform/tutorials/state/resource-drift',
    },
    {
      title: 'Planning modes: refresh-only',
      href: 'https://developer.hashicorp.com/terraform/cli/commands/plan#planning-modes',
    },
    {
      title: 'The lifecycle meta-argument',
      href: 'https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle',
    },
  ],
};

// 4. Hand over the audit logs ------------------------------------------------

const AUDIT_DESTROY_PLAN = L(`
aws_cloudwatch_log_group.audit: Refreshing state... [id=/acme/audit]
aws_cloudwatch_log_group.app: Refreshing state... [id=/acme/app]

Terraform used the selected providers to generate the following execution
plan. Resource actions are indicated with the following symbols:
  - destroy

Terraform will perform the following actions:

  # aws_cloudwatch_log_group.audit will be destroyed
  # (because aws_cloudwatch_log_group.audit is not in configuration)
  - resource "aws_cloudwatch_log_group" "audit" {
      - arn               = "arn:aws:logs:eu-west-1:111122223333:log-group:/acme/audit" -> null
      - id                = "/acme/audit" -> null
      - name              = "/acme/audit" -> null
      - retention_in_days = 400 -> null
    }

Plan: 0 to add, 0 to change, 1 to destroy.
`);

const handOver: Puzzle = {
  id: 'hand-over',
  title: 'Hand over the audit logs',
  difficulty: 'Medium',
  minVersion: '1.7',
  story:
    'The platform team now owns audit logging and will manage the /acme/audit log group from their own Terraform config. It holds 400 days of audit logs that compliance needs. Your job is to stop managing it from this config.',
  goal: 'Remove the log group from this config and state. The log group and its logs must stay in AWS.',
  files: [
    {
      name: 'logging.tf',
      lines: L(`
resource "aws_cloudwatch_log_group" "app" {
  name              = "/acme/app"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "audit" {
  name              = "/acme/audit"
  retention_in_days = 400

  lifecycle {
    prevent_destroy = true
  }
}
`),
    },
  ],
  evidence: [
    {
      id: 'state-list',
      title: 'State',
      command: 'terraform state list',
      lines: ['aws_cloudwatch_log_group.app', 'aws_cloudwatch_log_group.audit'],
    },
  ],
  notes: [
    {
      source: 'Platform team, in the team channel',
      lines: [
        'We will add an import block for /acme/audit to our config as soon as you have released it.',
        'Please do not delete it: compliance needs those 400 days of logs.',
      ],
    },
  ],
  inspects: [],
  bindings: [
    {
      code: 'aws_cloudwatch_log_group.audit',
      state: 'aws_cloudwatch_log_group.audit',
      object: '/acme/audit (400 days of logs)',
      action: 'none',
    },
  ],
  options: [
    {
      id: 'delete-block',
      label: 'Delete the resource block. Its prevent_destroy keeps the log group safe.',
      code: ['# remove the aws_cloudwatch_log_group.audit block', 'terraform plan'],
      outcome: {
        verdict: 'unsafe',
        summary: 'Plan: 0 to add, 0 to change, 1 to destroy.',
        explanation:
          'prevent_destroy is part of the resource block. Delete the block and the protection goes with it, so the plan deletes the log group, and deleting a log group deletes every log event in it.',
        transcripts: [
          {
            id: 'delete-plan',
            title: 'Plan',
            command: 'terraform plan',
            lines: AUDIT_DESTROY_PLAN,
          },
        ],
        bindings: [
          {
            state: 'aws_cloudwatch_log_group.audit',
            object: '/acme/audit (400 days of logs)',
            action: 'destroy',
          },
        ],
      },
    },
    {
      id: 'removed-default',
      label: 'Replace the resource block with a removed block',
      code: ['removed {', '  from = aws_cloudwatch_log_group.audit', '}'],
      outcome: {
        verdict: 'unsafe',
        summary: 'Plan: 0 to add, 0 to change, 1 to destroy.',
        explanation:
          'A removed block destroys the object by default. Without lifecycle { destroy = false } it means "delete this, then forget it", which is the same plan as deleting the block.',
        transcripts: [
          {
            id: 'removed-plan',
            title: 'Plan',
            command: 'terraform plan',
            lines: AUDIT_DESTROY_PLAN,
          },
        ],
        bindings: [
          {
            state: 'aws_cloudwatch_log_group.audit',
            object: '/acme/audit (400 days of logs)',
            action: 'destroy',
          },
        ],
      },
    },
    {
      id: 'removed-keep',
      label: 'Replace it with a removed block that keeps the object',
      code: [
        'removed {',
        '  from = aws_cloudwatch_log_group.audit',
        '',
        '  lifecycle {',
        '    destroy = false',
        '  }',
        '}',
      ],
      outcome: {
        verdict: 'best',
        summary:
          'Plan: 0 to add, 0 to change, 0 to destroy, with a warning that the log group will no longer be managed.',
        explanation:
          'Terraform 1.7 added the removed block. With destroy = false, applying the plan drops the log group from this state and leaves it in AWS, and the change is reviewed like any other. To finish the hand-over: make sure nobody else is applying, apply this, then let the platform team adopt it with an import block and check their plan shows only the import.',
        transcripts: [
          {
            id: 'removed-keep-plan',
            title: 'Plan',
            command: 'terraform plan',
            lines: L(`
aws_cloudwatch_log_group.app: Refreshing state... [id=/acme/app]

Terraform used the selected providers to generate the following execution
plan. Resource actions are indicated with the following symbols:

Terraform will perform the following actions:

 # aws_cloudwatch_log_group.audit will no longer be managed by Terraform, but will not be destroyed
 # (destroy = false is set in the configuration)
 . resource "aws_cloudwatch_log_group" "audit" {
        id                = "/acme/audit"
        name              = "/acme/audit"
        # (2 unchanged attributes hidden)
    }

Plan: 0 to add, 0 to change, 0 to destroy.

Warning: Some objects will no longer be managed by Terraform

If you apply this plan, Terraform will discard its tracking information for
the following objects, but it will not delete them:
 - aws_cloudwatch_log_group.audit

After applying this plan, Terraform will no longer manage these objects. You
will need to import them into Terraform to manage them again.
`),
          },
        ],
        bindings: [
          {
            state: 'aws_cloudwatch_log_group.audit',
            object: '/acme/audit (kept)',
            action: 'forget',
          },
        ],
      },
    },
    {
      id: 'state-rm',
      label: 'Remove it from the state, then delete the block',
      code: [
        'terraform state rm aws_cloudwatch_log_group.audit',
        '# then remove the resource block',
      ],
      outcome: {
        verdict: 'works',
        summary: 'Removed from the state; the next plan shows no changes.',
        explanation:
          'This works, but it edits the state immediately, outside the plan and review flow. If anyone plans while the block is still in the code, Terraform proposes to create the log group again. Each affected state needs the command, and -dry-run shows what it would remove. The removed block does the same through a reviewed plan.',
        transcripts: [
          {
            id: 'state-rm',
            title: 'State remove',
            command: 'terraform state rm aws_cloudwatch_log_group.audit',
            lines: L(`
Removed aws_cloudwatch_log_group.audit
Successfully removed 1 resource instance(s).
`),
          },
          {
            id: 'state-rm-plan',
            title: 'Plan after',
            command: 'terraform plan',
            lines: [
              'aws_cloudwatch_log_group.app: Refreshing state... [id=/acme/app]',
              '',
              ...NO_CHANGES,
            ],
          },
        ],
        bindings: [{ object: '/acme/audit (kept)', action: 'untracked' }],
      },
    },
  ],
  hint: 'You want Terraform to forget the object, not delete it. Is there a way to say that in code?',
  lesson:
    'Deleting a resource block means "destroy it". To stop managing something and keep it, use a removed block with destroy = false (Terraform 1.7 and later).',
  docs: [
    {
      title: 'Remove a resource from state (removed block)',
      href: 'https://developer.hashicorp.com/terraform/language/resources/syntax#removing-resources',
    },
    {
      title: 'terraform state rm',
      href: 'https://developer.hashicorp.com/terraform/cli/commands/state/rm',
    },
    {
      title: 'The lifecycle meta-argument',
      href: 'https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle',
    },
  ],
};

// 5. Stale lock --------------------------------------------------------------

const LOCK_ERROR = L(`
Error: Error acquiring the state lock

Error message: HTTP remote state already locked:
ID=24cc7f13-e56e-9850-f666-84387523f370
Lock Info:
  ID:        24cc7f13-e56e-9850-f666-84387523f370
  Path:
  Operation: OperationTypeApply
  Who:       root@runner-xq7zk2m9-project-42-concurrent-0
  Version:   1.15.8
  Created:   2026-10-06 13:21:58.104471522 +0000 UTC
  Info:


Terraform acquires a state lock to protect the state from being written
by multiple users at the same time. Please resolve the issue above and try
again. For most commands, you can disable locking with the "-lock=false"
flag, but this is not recommended.
`);

const CACHE_CREATE = L(`
  # aws_elasticache_replication_group.sessions will be created
  + resource "aws_elasticache_replication_group" "sessions" {
      + arn                  = (known after apply)
      + description          = "Session store"
      + engine               = "valkey"
      + id                   = (known after apply)
      + node_type            = "cache.t4g.medium"
      + num_cache_clusters   = 2
      + replication_group_id = "sessions"
      + subnet_group_name    = "sessions"
    }
`);

const CACHE_PLAN = [
  'aws_elasticache_subnet_group.sessions: Refreshing state... [id=sessions]',
  '',
  ...SYMBOLS,
  '  + create',
  '',
  'Terraform will perform the following actions:',
  '',
  ...CACHE_CREATE,
  '',
  'Plan: 1 to add, 0 to change, 0 to destroy.',
];

const CACHE_TF = L(`
resource "aws_elasticache_subnet_group" "sessions" {
  name       = "sessions"
  subnet_ids = var.private_subnet_ids
}

resource "aws_elasticache_replication_group" "sessions" {
  replication_group_id = "sessions"
  description          = "Session store"
  engine               = "valkey"
  node_type            = "cache.t4g.medium"
  num_cache_clusters   = 2
  subnet_group_name    = aws_elasticache_subnet_group.sessions.name
}
`);

const staleLock: Puzzle = {
  id: 'stale-lock',
  title: 'The lock that will not go away',
  difficulty: 'Medium',
  story:
    "Every terraform plan against production fails with a lock error. The state lives in GitLab-managed Terraform state, which is an HTTP backend. Pipeline #4812 was applying a new sessions cache when its runner's spot VM was reclaimed, about 40 minutes ago.",
  goal: 'Clear the lock safely, so the team can plan and apply again.',
  files: [
    {
      name: 'backend.tf',
      lines: L(`
terraform {
  backend "http" {
    address        = "https://gitlab.example.com/api/v4/projects/42/terraform/state/prod"
    lock_address   = "https://gitlab.example.com/api/v4/projects/42/terraform/state/prod/lock"
    lock_method    = "POST"
    unlock_address = "https://gitlab.example.com/api/v4/projects/42/terraform/state/prod/lock"
    unlock_method  = "DELETE"
  }
}
`),
    },
    { name: 'cache.tf', lines: CACHE_TF },
  ],
  evidence: [{ id: 'plan', title: 'Plan', command: 'terraform plan', lines: LOCK_ERROR }],
  inspects: [
    {
      id: 'job',
      label: 'Look at pipeline #4812, which holds the lock',
      note: {
        source: 'GitLab: pipeline #4812, job apply:prod',
        lines: [
          'Status: failed (runner system failure) at 13:24 UTC.',
          'Runner runner-xq7zk2m9 has been offline since 13:24 UTC: its spot VM was reclaimed.',
          'Last log line: aws_elasticache_replication_group.sessions: Still creating... [02m10s elapsed]',
        ],
      },
    },
    {
      id: 'running',
      label: 'Check for other Terraform runs against prod',
      note: {
        source: 'GitLab running pipelines, and the team channel',
        lines: [
          'No pipeline or job is running for the prod environment.',
          'Pipeline #4815 (your merge) failed at terraform plan with this same lock error.',
          'Team channel: nobody is running Terraform against prod by hand.',
        ],
      },
    },
  ],
  bindings: [],
  options: [
    {
      id: 'force-unlock',
      label: 'Force-unlock with the lock ID',
      code: ['terraform force-unlock 24cc7f13-e56e-9850-f666-84387523f370'],
      requires: ['job', 'running'],
      outcome: {
        verdict: 'best',
        summary: 'The lock is gone. The next plan still wants to create the cache.',
        explanation:
          'force-unlock removes the lock record only; it does not touch the state or any infrastructure. It is safe once you know the holder is dead and nothing else is about to write. Use the exact ID from the error. Then plan before anything else: the killed apply was creating the cache, and the next puzzle is what that left behind.',
        transcripts: [
          {
            id: 'force-unlock',
            title: 'Force-unlock',
            command: 'terraform force-unlock 24cc7f13-e56e-9850-f666-84387523f370',
            lines: L(`
Do you really want to force-unlock?
  Terraform will remove the lock on the remote state.
  This will allow local Terraform commands to modify this state, even though it
  may still be in use. Only 'yes' will be accepted to confirm.

  Enter a value: yes

Terraform state has been successfully unlocked!

The state has been unlocked, and Terraform commands should now be able to
obtain a new lock on the remote state.
`),
          },
          { id: 'after-plan', title: 'Plan after', command: 'terraform plan', lines: CACHE_PLAN },
        ],
      },
      unchecked: {
        verdict: 'unsafe',
        summary:
          'It unlocked, but you did not confirm that pipeline #4812 is dead and that nothing else is running.',
        explanation:
          'The lock age and the error do not tell you that the holder is dead. If that apply had still been running, two writers would now share one state and one would overwrite the other. Check the job and any other runs first, then unlock.',
      },
    },
    {
      id: 'lock-false',
      label: 'Skip the lock and apply',
      code: ['terraform apply -lock=false'],
      outcome: {
        verdict: 'unsafe',
        summary: 'Your apply runs without the lock, and the stale lock still blocks everyone else.',
        explanation:
          '-lock=false skips taking the lock; it does not clear it. If any other run were alive, you would both write the same state. Even when nobody else is running, the team is still locked out after you finish. Never apply with -lock=false.',
        transcripts: [
          {
            id: 'lock-false-apply',
            title: 'Apply without lock',
            command: 'terraform apply -lock=false',
            lines: [
              ...CACHE_PLAN,
              '',
              'Do you want to perform these actions?',
              '  Terraform will perform the actions described above.',
              "  Only 'yes' will be accepted to approve.",
              '',
              '  Enter a value: ',
            ],
            trimmed: true,
          },
          {
            id: 'lock-false-next',
            title: "A teammate's plan",
            command: 'terraform plan',
            lines: LOCK_ERROR.slice(0, 4),
            trimmed: true,
          },
        ],
      },
    },
    {
      id: 'timeout',
      label: 'Wait for the lock',
      code: ['terraform plan -lock-timeout=10m'],
      outcome: {
        verdict: 'incomplete',
        summary: 'Terraform waits ten minutes, then fails with the same error.',
        explanation:
          '-lock-timeout keeps retrying to take the lock for a while. It is the right tool when another run is about to finish, but this lock belongs to a run that is gone, so nobody will ever release it.',
        transcripts: [
          {
            id: 'timeout',
            title: 'Plan with timeout',
            command: 'terraform plan -lock-timeout=10m',
            note: 'The first line appears at once. The error appears when the ten minutes run out.',
            lines: ['Acquiring state lock. This may take a few moments...', '', ...LOCK_ERROR],
          },
        ],
      },
    },
  ],
  hint: "Before you remove someone else's lock, what do you need to know about them?",
  lesson:
    'Clear a stale lock with terraform force-unlock and the lock ID, but only after you have confirmed that the run holding it is dead and nothing else is running.',
  docs: [
    {
      title: 'terraform force-unlock',
      href: 'https://developer.hashicorp.com/terraform/cli/commands/force-unlock',
    },
    {
      title: 'State locking',
      href: 'https://developer.hashicorp.com/terraform/language/state/locking',
    },
  ],
};

// 6. What the killed apply left behind ---------------------------------------

const killedApply: Puzzle = {
  id: 'killed-apply',
  title: 'What the killed apply left behind',
  difficulty: 'Medium',
  minVersion: '1.5',
  story:
    'The lock is cleared. The plan says the sessions cache still has to be created, but the ElastiCache console shows a sessions replication group, created at 13:22 by the CI role. Pipeline #4812 started creating it, then its runner died before Terraform could record it in the state.',
  goal: 'Bring the existing cache under Terraform without creating a second one.',
  files: [{ name: 'cache.tf', lines: CACHE_TF }],
  evidence: [{ id: 'plan', title: 'Plan', command: 'terraform plan', lines: CACHE_PLAN }],
  inspects: [
    {
      id: 'state-list',
      label: 'What is in the state?',
      transcript: {
        id: 'state-list',
        title: 'State',
        command: 'terraform state list',
        lines: ['aws_elasticache_subnet_group.sessions'],
      },
    },
    {
      id: 'console',
      label: 'Look for the cache in AWS',
      note: {
        source: 'AWS console: ElastiCache and CloudTrail',
        lines: [
          'Replication group sessions: Valkey, cache.t4g.medium, 2 nodes, status available.',
          'Created 2026-10-06 13:22 UTC. CloudTrail: CreateReplicationGroup by role gitlab-ci-terraform.',
        ],
      },
    },
  ],
  bindings: [
    {
      code: 'aws_elasticache_replication_group.sessions',
      object: 'sessions (exists, not in state)',
      action: 'create',
    },
    {
      code: 'aws_elasticache_subnet_group.sessions',
      state: 'aws_elasticache_subnet_group.sessions',
      object: 'sessions subnet group',
      action: 'none',
    },
  ],
  options: [
    {
      id: 'apply',
      label: 'Apply. The plan finishes what the pipeline started.',
      code: ['terraform apply'],
      outcome: {
        verdict: 'unsafe',
        summary:
          'Terraform tries to create the cache again. AWS rejects it because the ID sessions is taken.',
        explanation:
          'Terraform only knows about objects in its state. Here the create fails because replication group IDs are unique. A resource without a unique name, such as an EC2 instance, would simply be created twice, and you would pay for both.',
        transcripts: [
          apply('apply', 'Plan: 1 to add, 0 to change, 0 to destroy.', [
            'aws_elasticache_replication_group.sessions: Creating...',
          ]),
        ],
      },
    },
    {
      id: 'refresh-only',
      label: 'Refresh the state so Terraform finds the cache',
      code: ['terraform apply -refresh-only'],
      outcome: {
        verdict: 'incomplete',
        summary: 'No changes found. The next plan still wants to create the cache.',
        explanation:
          'A refresh re-reads the objects that are already in the state. It never searches AWS for objects the state does not know about, so it cannot find the cache.',
        transcripts: [
          {
            id: 'refresh-only',
            title: 'Refresh-only apply',
            command: 'terraform apply -refresh-only',
            lines: L(`
aws_elasticache_subnet_group.sessions: Refreshing state... [id=sessions]

No changes. Your infrastructure still matches the configuration.

Terraform has checked that the real remote objects still match the result of
your most recent changes, and found no differences.

Apply complete! Resources: 0 added, 0 changed, 0 destroyed.
`),
          },
          { id: 'refresh-plan', title: 'Next plan', command: 'terraform plan', lines: CACHE_PLAN },
        ],
      },
    },
    {
      id: 'import',
      label: 'Adopt it with an import block',
      code: [
        'import {',
        '  to = aws_elasticache_replication_group.sessions',
        '  id = "sessions"',
        '}',
      ],
      outcome: {
        verdict: 'best',
        summary: 'Plan: 1 to import, 0 to add, 0 to change, 0 to destroy.',
        explanation:
          'An import block adopts the existing object as part of a reviewed plan (Terraform 1.5 and later). Check that the plan shows only the import: if it shows an update or a replacement, make the code match the real cache first. After any killed apply, compare what the job was creating with what exists, and import anything the state is missing.',
        transcripts: [
          {
            id: 'import-plan',
            title: 'Plan with import',
            command: 'terraform plan',
            lines: L(`
aws_elasticache_replication_group.sessions: Preparing import... [id=sessions]
aws_elasticache_replication_group.sessions: Refreshing state... [id=sessions]
aws_elasticache_subnet_group.sessions: Refreshing state... [id=sessions]

Terraform will perform the following actions:

  # aws_elasticache_replication_group.sessions will be imported
    resource "aws_elasticache_replication_group" "sessions" {
        id                   = "sessions"
        # (7 unchanged attributes hidden)
    }

Plan: 1 to import, 0 to add, 0 to change, 0 to destroy.
`),
          },
        ],
        bindings: [
          {
            code: 'aws_elasticache_replication_group.sessions',
            state: 'aws_elasticache_replication_group.sessions',
            object: 'sessions',
            action: 'import',
          },
        ],
      },
    },
    {
      id: 'delete-block',
      label: 'Delete the cache from the code',
      code: ['# remove the aws_elasticache_replication_group.sessions block'],
      outcome: {
        verdict: 'incomplete',
        summary: 'No changes, but the cache keeps running, unmanaged and billed.',
        explanation:
          'Removing the block hides the problem. The cache still exists and costs money, no Terraform tracks it, and the feature that needed it is gone from the code.',
        transcripts: [
          {
            id: 'delete-plan',
            title: 'Plan',
            command: 'terraform plan',
            lines: [
              'aws_elasticache_subnet_group.sessions: Refreshing state... [id=sessions]',
              '',
              ...NO_CHANGES,
            ],
          },
        ],
        bindings: [{ object: 'sessions (running, unmanaged)', action: 'untracked' }],
      },
    },
  ],
  hint: 'Terraform cannot see objects that are not in its state. How do you hand it one that already exists?',
  lesson:
    'An apply that is killed can leave real objects that the state does not know about. A refresh will not find them; adopt them with an import block.',
  docs: [
    {
      title: 'Import existing resources (import block)',
      href: 'https://developer.hashicorp.com/terraform/language/import',
    },
    {
      title: 'Planning modes: refresh-only',
      href: 'https://developer.hashicorp.com/terraform/cli/commands/plan#planning-modes',
    },
  ],
};

// 7. Adopt the hand-made database --------------------------------------------

const LEGACY_REPLACE_BODY = L(`
  # aws_db_instance.legacy_reports must be replaced
  # (imported from "legacy-reports")
  # Warning: this will destroy the imported resource
-/+ resource "aws_db_instance" "legacy_reports" {
      ~ arn                 = "arn:aws:rds:eu-west-1:111122223333:db:legacy-reports" -> (known after apply)
      ~ id                  = "db-3XN8V2TQ5LRA7MZK4HWB6YCJ0E" -> (known after apply)
      ~ storage_encrypted   = false -> true # forces replacement
        # (5 unchanged attributes hidden)
    }
`);

const LEGACY_IMPORT_HEAD = [
  'aws_db_instance.legacy_reports: Preparing import... [id=legacy-reports]',
  'aws_db_instance.legacy_reports: Refreshing state... [id=legacy-reports]',
  '',
  ...SYMBOLS,
  '-/+ destroy and then create replacement',
  '',
];

const adoptDatabase: Puzzle = {
  id: 'adopt-database',
  title: 'Adopt the hand-made database',
  difficulty: 'Hard',
  minVersion: '1.5',
  story:
    'The legacy-reports PostgreSQL database was created by hand in the console in 2022. Your pull request adopts it with an import block. You generated the resource block with terraform plan -generate-config-out, trimmed it, and then switched on storage_encrypted, because the company standard says every database is encrypted. CI posted this plan.',
  goal: 'Adopt legacy-reports into Terraform with a plan that does not replace it.',
  files: [
    {
      name: 'reports.tf',
      lines: L(`
import {
  to = aws_db_instance.legacy_reports
  id = "legacy-reports"
}

# Generated with -generate-config-out and trimmed.
# storage_encrypted switched on to match the company standard.
resource "aws_db_instance" "legacy_reports" {
  identifier          = "legacy-reports"
  engine              = "postgres"
  instance_class      = "db.t4g.medium"
  allocated_storage   = 200
  storage_encrypted   = true
  skip_final_snapshot = true
}
`),
    },
  ],
  evidence: [
    {
      id: 'plan',
      title: 'Plan',
      command: 'terraform plan',
      lines: [
        ...LEGACY_IMPORT_HEAD,
        'Terraform will perform the following actions:',
        '',
        ...LEGACY_REPLACE_BODY,
        '',
        'Plan: 1 to import, 1 to add, 0 to change, 1 to destroy.',
      ],
    },
  ],
  inspects: [
    {
      id: 'console',
      label: 'Look at the database in AWS',
      note: {
        source: 'AWS console: RDS, legacy-reports',
        lines: [
          'PostgreSQL 16, db.t4g.medium, 200 GiB.',
          'Encryption: not enabled.',
          'Created 2022-03-14 in the console.',
        ],
      },
    },
    {
      id: 'encrypt',
      label: 'Can RDS encrypt an existing database?',
      note: {
        source: 'Amazon RDS documentation',
        lines: [
          'You can only turn on encryption when you create a DB instance.',
          'For an existing one: take a snapshot, copy it with encryption, restore a new instance from the copy, and move the application to it.',
        ],
      },
    },
  ],
  stateLabel: 'State (after import)',
  bindings: [
    {
      code: 'aws_db_instance.legacy_reports',
      state: 'aws_db_instance.legacy_reports',
      object: 'legacy-reports (not encrypted)',
      action: 'replace',
    },
  ],
  options: [
    {
      id: 'apply',
      label: 'Apply. It says import, so the data is safe.',
      code: ['terraform apply'],
      outcome: {
        verdict: 'unsafe',
        summary:
          'Terraform imports legacy-reports, deletes it, and creates an empty encrypted database in its place.',
        explanation:
          'Import first, then replace, is still a replacement. The AWS provider cannot read skip_final_snapshot or delete_automated_backups from AWS, so its importer sets both to true, and the generated config kept skip_final_snapshot = true. The delete takes no final snapshot and removes the automated backups.',
        transcripts: [
          apply('apply', 'Plan: 1 to import, 1 to add, 0 to change, 1 to destroy.', [
            'aws_db_instance.legacy_reports: Importing... [id=legacy-reports]',
            'aws_db_instance.legacy_reports: Import complete [id=legacy-reports]',
            'aws_db_instance.legacy_reports: Destroying... [id=db-3XN8V2TQ5LRA7MZK4HWB6YCJ0E]',
          ]),
        ],
      },
    },
    {
      id: 'cli-import',
      label: 'Use terraform import on the command line instead',
      code: [
        '# remove the import block, then:',
        'terraform import aws_db_instance.legacy_reports legacy-reports',
      ],
      outcome: {
        verdict: 'incomplete',
        summary: 'The database is in the state, but the next plan still replaces it.',
        explanation:
          'The command imports at once, without showing a plan first. Nothing is destroyed yet, but the mismatch is still in the code, so the next plan replaces the database. Import is only half the job: the code must match the real object too.',
        transcripts: [
          {
            id: 'cli-import',
            title: 'Import',
            command: 'terraform import aws_db_instance.legacy_reports legacy-reports',
            lines: L(`
aws_db_instance.legacy_reports: Importing from ID "legacy-reports"...
aws_db_instance.legacy_reports: Import prepared!
  Prepared aws_db_instance for import
aws_db_instance.legacy_reports: Refreshing state... [id=legacy-reports]

Import successful!

The resources that were imported are shown above. These resources are now in
your Terraform state and will henceforth be managed by Terraform.
`),
          },
          {
            id: 'cli-import-plan',
            title: 'Next plan',
            command: 'terraform plan',
            lines: [
              'aws_db_instance.legacy_reports: Refreshing state... [id=db-3XN8V2TQ5LRA7MZK4HWB6YCJ0E]',
              '',
              ...SYMBOLS,
              '-/+ destroy and then create replacement',
              '',
              'Terraform will perform the following actions:',
              '',
              ...L(`
  # aws_db_instance.legacy_reports must be replaced
-/+ resource "aws_db_instance" "legacy_reports" {
      ~ arn                 = "arn:aws:rds:eu-west-1:111122223333:db:legacy-reports" -> (known after apply)
      ~ id                  = "db-3XN8V2TQ5LRA7MZK4HWB6YCJ0E" -> (known after apply)
      ~ storage_encrypted   = false -> true # forces replacement
        # (5 unchanged attributes hidden)
    }

Plan: 1 to add, 0 to change, 1 to destroy.
`),
            ],
          },
        ],
      },
    },
    {
      id: 'match',
      label: 'Make the code match the real database',
      code: ['  storage_encrypted   = false # encrypt later, on purpose'],
      outcome: {
        verdict: 'best',
        summary: 'Plan: 1 to import, 0 to add, 0 to change, 0 to destroy.',
        explanation:
          'Adopt first, change later. The code must describe the database as it is, so the import plan shows only the import. Every mismatched argument counts, not just this one. Encryption then becomes its own planned change: snapshot, encrypted copy, restore, move the application. -generate-config-out writes config for import blocks that have no resource block yet; it does not fix a block you already have.',
        transcripts: [
          {
            id: 'match-plan',
            title: 'Plan',
            command: 'terraform plan',
            lines: L(`
aws_db_instance.legacy_reports: Preparing import... [id=legacy-reports]
aws_db_instance.legacy_reports: Refreshing state... [id=legacy-reports]

Terraform will perform the following actions:

  # aws_db_instance.legacy_reports will be imported
    resource "aws_db_instance" "legacy_reports" {
        id                  = "db-3XN8V2TQ5LRA7MZK4HWB6YCJ0E"
        # (7 unchanged attributes hidden)
    }

Plan: 1 to import, 0 to add, 0 to change, 0 to destroy.
`),
          },
        ],
        bindings: [
          {
            code: 'aws_db_instance.legacy_reports',
            state: 'aws_db_instance.legacy_reports',
            object: 'legacy-reports',
            action: 'import',
          },
        ],
      },
    },
    {
      id: 'prevent-destroy',
      label: 'Add prevent_destroy so it cannot be deleted',
      code: ['  lifecycle {', '    prevent_destroy = true', '  }'],
      outcome: {
        verdict: 'incomplete',
        summary: 'The plan fails with "Instance cannot be destroyed". Safe, but not adopted.',
        explanation:
          'prevent_destroy is a useful guard on a database like this, and here it does its job: Terraform refuses a plan that would destroy it. But the import does not happen either. The mismatch in the code is still the problem to fix.',
        transcripts: [
          {
            id: 'prevent-plan',
            title: 'Plan',
            command: 'terraform plan',
            lines: [
              ...LEGACY_IMPORT_HEAD,
              'Terraform planned the following actions, but then encountered a problem:',
              '',
              ...LEGACY_REPLACE_BODY,
              '',
              'Plan: 1 to import, 1 to add, 0 to change, 1 to destroy.',
              '',
              ...L(`
Error: Instance cannot be destroyed

  on reports.tf line 8:
   8: resource "aws_db_instance" "legacy_reports" {

Resource aws_db_instance.legacy_reports has lifecycle.prevent_destroy set,
but the plan calls for this resource to be destroyed. To avoid this error and
continue with the plan, either disable lifecycle.prevent_destroy or reduce
the scope of the plan using the -target option.
`),
            ],
          },
        ],
      },
    },
  ],
  hint: 'Read the line that says "forces replacement". Should the code describe the database you want, or the one that exists?',
  lesson:
    'Importing a resource only adopts it if the code matches the real object. Make the import plan show nothing but the import, then make changes on purpose.',
  docs: [
    {
      title: 'Import existing resources (import block)',
      href: 'https://developer.hashicorp.com/terraform/language/import',
    },
    {
      title: 'Generate configuration for imported resources',
      href: 'https://developer.hashicorp.com/terraform/language/import/generating-configuration',
    },
    {
      title: 'Encrypting Amazon RDS resources',
      href: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.Encryption.html',
    },
  ],
};

// 8. Retire staging, keep prod -----------------------------------------------

function bucketDestroy(index: string, env: string, because: string): string[] {
  return L(`
  # aws_s3_bucket.env${index} will be destroyed
  # (because ${because})
  - resource "aws_s3_bucket" "env" {
      - arn           = "arn:aws:s3:::acme-corp-assets-${env}" -> null
      - bucket        = "acme-corp-assets-${env}" -> null
      - force_destroy = true -> null
      - id            = "acme-corp-assets-${env}" -> null
    }
`);
}

function bucketCreate(index: string, env: string): string[] {
  return L(`
  # aws_s3_bucket.env${index} will be created
  + resource "aws_s3_bucket" "env" {
      + arn           = (known after apply)
      + bucket        = "acme-corp-assets-${env}"
      + force_destroy = true
      + id            = (known after apply)
    }
`);
}

const FOR_EACH_CODE = [
  'variable "envs" {',
  '  type    = set(string)',
  '  default = ["dev", "prod"]',
  '}',
  '',
  'resource "aws_s3_bucket" "env" {',
  '  for_each      = var.envs',
  '  bucket        = "acme-corp-assets-${each.value}"',
  '  force_destroy = true',
  '}',
];

const retireStaging: Puzzle = {
  id: 'retire-staging',
  title: 'Retire staging, keep prod',
  difficulty: 'Hard',
  minVersion: '1.1',
  story:
    'The asset buckets are made with count over a list of environments. Staging is being retired, so your pull request removes "staging" from the list. The staging bucket can go; dev and prod must not change. CI posted this plan.',
  goal: 'Delete only the staging bucket. Dev and prod stay exactly as they are.',
  files: [
    {
      name: 'buckets.tf',
      lines: L(`
variable "envs" {
  type    = list(string)
  default = ["dev", "prod"] # was ["dev", "staging", "prod"]
}

resource "aws_s3_bucket" "env" {
  count         = length(var.envs)
  bucket        = "acme-corp-assets-\${var.envs[count.index]}"
  force_destroy = true
}
`),
    },
  ],
  evidence: [
    {
      id: 'plan',
      title: 'Plan',
      command: 'terraform plan',
      lines: [
        ...L(`
aws_s3_bucket.env[1]: Refreshing state... [id=acme-corp-assets-staging]
aws_s3_bucket.env[2]: Refreshing state... [id=acme-corp-assets-prod]
aws_s3_bucket.env[0]: Refreshing state... [id=acme-corp-assets-dev]
`),
        '',
        ...SYMBOLS,
        '  - destroy',
        '-/+ destroy and then create replacement',
        '',
        'Terraform will perform the following actions:',
        '',
        ...L(`
  # aws_s3_bucket.env[1] must be replaced
-/+ resource "aws_s3_bucket" "env" {
      ~ arn           = "arn:aws:s3:::acme-corp-assets-staging" -> (known after apply)
      ~ bucket        = "acme-corp-assets-staging" -> "acme-corp-assets-prod" # forces replacement
      ~ id            = "acme-corp-assets-staging" -> (known after apply)
        # (1 unchanged attribute hidden)
    }
`),
        '',
        ...bucketDestroy('[2]', 'prod', 'index [2] is out of range for count'),
        '',
        'Plan: 1 to add, 0 to change, 2 to destroy.',
      ],
    },
  ],
  inspects: [
    {
      id: 'state-list',
      label: 'What is in the state?',
      transcript: {
        id: 'state-list',
        title: 'State',
        command: 'terraform state list',
        lines: ['aws_s3_bucket.env[0]', 'aws_s3_bucket.env[1]', 'aws_s3_bucket.env[2]'],
      },
    },
  ],
  bindings: [
    {
      code: 'aws_s3_bucket.env[0]',
      state: 'aws_s3_bucket.env[0]',
      object: 'acme-corp-assets-dev',
      action: 'none',
    },
    {
      code: 'aws_s3_bucket.env[1]',
      state: 'aws_s3_bucket.env[1]',
      object: 'acme-corp-assets-staging',
      action: 'replace',
    },
    { state: 'aws_s3_bucket.env[2]', object: 'acme-corp-assets-prod', action: 'destroy' },
  ],
  options: [
    {
      id: 'apply',
      label: 'Apply. Staging is the one being removed.',
      code: ['terraform apply'],
      outcome: {
        verdict: 'unsafe',
        summary:
          'Terraform deletes the prod bucket and everything in it, then deletes staging and recreates an empty prod bucket.',
        explanation:
          'With count, instances are numbered by position. Removing "staging" moves "prod" from index 2 to index 1, so index 2 goes away (the prod bucket) and index 1 changes its bucket name, which forces a replacement. force_destroy = true lets Terraform empty a bucket before deleting it, so nothing stops it.',
        transcripts: [
          apply('apply', 'Plan: 1 to add, 0 to change, 2 to destroy.', [
            'aws_s3_bucket.env[2]: Destroying... [id=acme-corp-assets-prod]',
          ]),
        ],
      },
    },
    {
      id: 'for-each',
      label: 'Switch to for_each so instances are keyed by name',
      code: FOR_EACH_CODE,
      outcome: {
        verdict: 'unsafe',
        summary: 'Plan: 2 to add, 0 to change, 3 to destroy. Every bucket is replaced.',
        explanation:
          'for_each is the right shape, but the state still holds env[0], env[1] and env[2], and nothing tells Terraform that env[0] is now env["dev"]. To Terraform those are new addresses, so it destroys all three buckets and creates two empty ones.',
        transcripts: [
          {
            id: 'for-each-plan',
            title: 'Plan',
            command: 'terraform plan',
            lines: [
              ...SYMBOLS,
              '  + create',
              '  - destroy',
              '',
              'Terraform will perform the following actions:',
              '',
              ...bucketDestroy('[0]', 'dev', 'resource does not use count'),
              '',
              ...bucketDestroy('[1]', 'staging', 'resource does not use count'),
              '',
              ...bucketDestroy('[2]', 'prod', 'resource does not use count'),
              '',
              ...bucketCreate('["dev"]', 'dev'),
              '',
              ...bucketCreate('["prod"]', 'prod'),
              '',
              'Plan: 2 to add, 0 to change, 3 to destroy.',
            ],
          },
        ],
        bindings: [
          { state: 'aws_s3_bucket.env[0]', object: 'acme-corp-assets-dev', action: 'destroy' },
          { state: 'aws_s3_bucket.env[1]', object: 'acme-corp-assets-staging', action: 'destroy' },
          { state: 'aws_s3_bucket.env[2]', object: 'acme-corp-assets-prod', action: 'destroy' },
          { code: 'aws_s3_bucket.env["dev"]', object: 'a new, empty bucket', action: 'create' },
          { code: 'aws_s3_bucket.env["prod"]', object: 'a new, empty bucket', action: 'create' },
        ],
      },
    },
    {
      id: 'for-each-moved',
      label: 'Switch to for_each and add moved blocks',
      code: [
        ...FOR_EACH_CODE,
        '',
        'moved {',
        '  from = aws_s3_bucket.env[0]',
        '  to   = aws_s3_bucket.env["dev"]',
        '}',
        '',
        'moved {',
        '  from = aws_s3_bucket.env[2]',
        '  to   = aws_s3_bucket.env["prod"]',
        '}',
      ],
      outcome: {
        verdict: 'best',
        summary: 'Plan: 0 to add, 0 to change, 1 to destroy. Only staging goes.',
        explanation:
          'The moved blocks map each numbered instance to its new key, so dev and prod keep their buckets, and env[1], which has no new home, is the staging bucket you meant to delete. With for_each, removing a key later only ever touches that key. Use for_each with stable keys for anything you may remove from the middle of a list.',
        transcripts: [
          {
            id: 'moved-plan',
            title: 'Plan',
            command: 'terraform plan',
            lines: [
              ...L(`
aws_s3_bucket.env["dev"]: Refreshing state... [id=acme-corp-assets-dev]
aws_s3_bucket.env[1]: Refreshing state... [id=acme-corp-assets-staging]
aws_s3_bucket.env["prod"]: Refreshing state... [id=acme-corp-assets-prod]
`),
              '',
              ...SYMBOLS,
              '  - destroy',
              '',
              'Terraform will perform the following actions:',
              '',
              ...bucketDestroy('[1]', 'staging', 'resource does not use count'),
              ...L(`

  # aws_s3_bucket.env[0] has moved to aws_s3_bucket.env["dev"]
    resource "aws_s3_bucket" "env" {
        id            = "acme-corp-assets-dev"
        # (3 unchanged attributes hidden)
    }

  # aws_s3_bucket.env[2] has moved to aws_s3_bucket.env["prod"]
    resource "aws_s3_bucket" "env" {
        id            = "acme-corp-assets-prod"
        # (3 unchanged attributes hidden)
    }

Plan: 0 to add, 0 to change, 1 to destroy.
`),
            ],
          },
        ],
        bindings: [
          {
            code: 'aws_s3_bucket.env["dev"]',
            state: 'env[0] → env["dev"]',
            object: 'acme-corp-assets-dev',
            action: 'move',
          },
          { state: 'aws_s3_bucket.env[1]', object: 'acme-corp-assets-staging', action: 'destroy' },
          {
            code: 'aws_s3_bucket.env["prod"]',
            state: 'env[2] → env["prod"]',
            object: 'acme-corp-assets-prod',
            action: 'move',
          },
        ],
      },
    },
    {
      id: 'state-rm',
      label: 'Remove the staging instance from the state',
      code: ["terraform state rm 'aws_s3_bucket.env[1]'"],
      outcome: {
        verdict: 'unsafe',
        summary:
          'Plan: 1 to add, 0 to change, 1 to destroy. Prod is still deleted, and staging is left behind.',
        explanation:
          'Forgetting env[1] does not change the numbering. The code still wants prod at index 1, so Terraform plans a new bucket there, with a name that is already taken, and still deletes env[2], the real prod bucket. The staging bucket is no longer tracked by anything.',
        transcripts: [
          {
            id: 'state-rm',
            title: 'State remove',
            command: "terraform state rm 'aws_s3_bucket.env[1]'",
            lines: L(`
Removed aws_s3_bucket.env[1]
Successfully removed 1 resource instance(s).
`),
          },
          {
            id: 'state-rm-plan',
            title: 'Plan after',
            command: 'terraform plan',
            lines: [
              ...SYMBOLS,
              '  + create',
              '  - destroy',
              '',
              'Terraform will perform the following actions:',
              '',
              ...bucketCreate('[1]', 'prod'),
              '',
              ...bucketDestroy('[2]', 'prod', 'index [2] is out of range for count'),
              '',
              'Plan: 1 to add, 0 to change, 1 to destroy.',
            ],
          },
        ],
        bindings: [
          {
            code: 'aws_s3_bucket.env[1]',
            object: 'a new prod bucket (name taken)',
            action: 'create',
          },
          { state: 'aws_s3_bucket.env[2]', object: 'acme-corp-assets-prod', action: 'destroy' },
          { object: 'acme-corp-assets-staging', action: 'untracked' },
        ],
      },
    },
  ],
  hint: 'With count, an instance is known by its position in the list. What happens to "prod" when "staging" is removed?',
  lesson:
    'Removing an item from the middle of a count list shifts every index after it. Use for_each with stable keys, and moved blocks to get there without replacing anything.',
  docs: [
    {
      title: 'The for_each meta-argument',
      href: 'https://developer.hashicorp.com/terraform/language/meta-arguments/for_each',
    },
    {
      title: 'Refactor with moved blocks',
      href: 'https://developer.hashicorp.com/terraform/language/modules/develop/refactoring',
    },
  ],
};

export const PUZZLES: Puzzle[] = [
  wrongWorkspace,
  rename,
  deletedAlarm,
  handOver,
  staleLock,
  killedApply,
  adoptDatabase,
  retireStaging,
];

export const TERRAFORM_VERSION = '1.15.8';

export function getPuzzle(id: string): Puzzle {
  const p = PUZZLES.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown puzzle ${id}`);
  return p;
}
