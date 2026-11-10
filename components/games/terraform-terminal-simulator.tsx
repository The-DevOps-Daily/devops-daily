'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { BookOpen, Cloud, FileCode, Boxes, Pencil, RotateCcw, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MotionConfig } from 'framer-motion';
import {
  SimComplete,
  SimFrame,
  SimLabBar,
  SimLabLayout,
  SimLabLessons,
  SimLabPanel,
  SimTerminal,
  labLines,
  labStats,
  lessonsSummary,
  useSimLab,
  type SimLabState,
} from '@/components/games/sim';
import { cn } from '@/lib/utils';

// The file editor sits above the terminal, so both share the lab's height (as in the git lab).
const EDITOR_HEIGHT = 'h-40 lg:h-[clamp(9rem,calc(50dvh-13rem),12rem)]';
const TERMINAL_HEIGHT =
  'h-[clamp(11rem,calc(100dvh-36rem),20rem)] lg:h-[clamp(12rem,calc(50dvh-8rem),24rem)]';

type FileName = 'main.tf' | 'variables.tf' | 'outputs.tf';

interface ManagedResource {
  address: string;
  type: string;
  name: string;
  attributes: Record<string, string>;
  /** Attributes the provider only learns once the resource exists, shown as (known after apply). */
  computed: string[];
}

interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'success';
  content: string;
  timestamp: Date;
}

interface PlanResult {
  creates: ManagedResource[];
  updates: { resource: ManagedResource; changes: string[] }[];
  replaces: { resource: ManagedResource; previous: ManagedResource; changes: string[] }[];
  deletes: ManagedResource[];
}

interface PendingConfirm {
  kind: 'apply' | 'destroy';
  command: string;
  plan: PlanResult;
  resources: ManagedResource[];
}

interface LessonCommand {
  instruction: string;
  hint: string;
  expectedCommand: string[];
  explanation: string;
}

interface Lesson {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  commands: LessonCommand[];
}

const FILE_ORDER: FileName[] = ['main.tf', 'variables.tf', 'outputs.tf'];

const DEFAULT_FILES: Record<FileName, string> = {
  'main.tf': `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

resource "aws_security_group" "web" {
  name        = "web-sg"
  description = "Allow HTTP and SSH"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "web" {
  ami                    = "ami-0c55b159cbfafe1f0"
  instance_type          = var.instance_type
  vpc_security_group_ids = [aws_security_group.web.id]

  tags = {
    Name = "\${var.project}-web"
  }
}

resource "aws_s3_bucket" "assets" {
  bucket = "\${var.project}-assets"
}`,
  'variables.tf': `variable "region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance size"
  type        = string
  default     = "t3.micro"
}

variable "project" {
  description = "Project name used to tag resources"
  type        = string
  default     = "devops-daily"
}`,
  'outputs.tf': `output "instance_id" {
  value = aws_instance.web.id
}

output "instance_public_ip" {
  value = aws_instance.web.public_ip
}

output "bucket_name" {
  value = aws_s3_bucket.assets.bucket
}`,
};

function fnv(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function idFor(prefix: string, name: string): string {
  return `${prefix}${fnv(prefix + name)}${fnv(name)}`.slice(0, prefix.length + 17);
}

function ipFor(name: string): string {
  const h = fnv('ip' + name);
  const a = parseInt(h.slice(0, 2), 16);
  const b = parseInt(h.slice(2, 4), 16);
  const c = parseInt(h.slice(4, 6), 16);
  return `54.${a}.${b}.${c}`;
}

function bracesBalanced(src: string): boolean {
  let depth = 0;
  for (const char of src) {
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

function parseVariableDefaults(variablesSrc: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const blockRegex = /variable\s+"([\w-]+)"\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(variablesSrc)) !== null) {
    const name = match[1];
    const body = match[2];
    const defaultMatch = body.match(/default\s*=\s*"([^"]*)"/);
    vars[name] = defaultMatch ? defaultMatch[1] : '';
  }
  return vars;
}

function resolveScalar(raw: string, vars: Record<string, string>): string {
  const value = raw.trim().replace(/,$/, '');
  if (value.startsWith('var.')) {
    return vars[value.slice(4)] ?? '';
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\$\{var\.([\w-]+)\}/g, (_, name) => vars[name] ?? '');
  }
  return value;
}

function readAssign(body: string, key: string, vars: Record<string, string>): string | undefined {
  const match = body.match(new RegExp(`(?:^|\\n)\\s*${key}\\s*=\\s*([^\\n]+)`));
  if (!match) return undefined;
  return resolveScalar(match[1], vars);
}

interface ParsedConfig {
  resources: ManagedResource[];
  errors: string[];
}

function parseConfig(files: Record<FileName, string>): ParsedConfig {
  const errors: string[] = [];
  const main = files['main.tf'];

  if (!bracesBalanced(main)) {
    errors.push('main.tf has unbalanced braces. Check that every { has a matching }.');
    return { resources: [], errors };
  }

  const vars = parseVariableDefaults(files['variables.tf']);
  const resources: ManagedResource[] = [];

  const header = /resource\s+"([\w-]+)"\s+"([\w-]+)"\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = header.exec(main)) !== null) {
    const type = match[1];
    const name = match[2];
    // Extract the block body by matching braces from the opening brace.
    let depth = 1;
    let i = header.lastIndex;
    const start = i;
    while (i < main.length && depth > 0) {
      if (main[i] === '{') depth += 1;
      if (main[i] === '}') depth -= 1;
      i += 1;
    }
    const body = main.slice(start, i - 1);
    const address = `${type}.${name}`;

    let attributes: Record<string, string>;
    let computed = ['id'];
    if (type === 'aws_instance') {
      const ami = readAssign(body, 'ami', vars) ?? 'ami-unknown';
      // A new AMI means a new instance, so the id and IP change with it.
      attributes = {
        id: idFor('i-0', name + ami),
        instance_type: readAssign(body, 'instance_type', vars) ?? 't3.micro',
        ami,
        public_ip: ipFor(name + ami),
      };
      computed = ['id', 'public_ip'];
    } else if (type === 'aws_s3_bucket') {
      const bucket = readAssign(body, 'bucket', vars) ?? `${name}-bucket`;
      attributes = { id: bucket, bucket, region: vars.region ?? 'us-east-1' };
    } else if (type === 'aws_security_group') {
      const groupName = readAssign(body, 'name', vars) ?? name;
      const description = readAssign(body, 'description', vars) ?? 'Managed by Terraform';
      // Without vpc_id the group lands in the default VPC, which AWS picks.
      const vpcId = readAssign(body, 'vpc_id', vars);
      attributes = {
        id: idFor('sg-0', name + groupName + description + (vpcId ?? '')),
        name: groupName,
        description,
        vpc_id: vpcId ?? 'vpc-04e9f2a1',
      };
      if (vpcId === undefined) computed = ['id', 'vpc_id'];
    } else {
      attributes = { id: `${type.replace(/^aws_/, '')}-${fnv(name).slice(0, 8)}` };
    }

    resources.push({ address, type, name, attributes, computed });
  }

  return { resources, errors };
}

// Arguments that cannot change on an existing resource. Changing one makes
// Terraform destroy and recreate the resource, shown as -/+ in the plan.
const FORCES_REPLACEMENT: Record<string, string[]> = {
  aws_instance: ['ami'],
  aws_s3_bucket: ['bucket'],
  aws_security_group: ['name', 'description', 'vpc_id'],
};

function diffPlan(desired: ManagedResource[], current: ManagedResource[]): PlanResult {
  const currentByAddress = new Map(current.map((resource) => [resource.address, resource]));
  const desiredByAddress = new Map(desired.map((resource) => [resource.address, resource]));

  const creates: ManagedResource[] = [];
  const updates: PlanResult['updates'] = [];
  const replaces: PlanResult['replaces'] = [];
  const deletes: ManagedResource[] = [];

  for (const resource of desired) {
    const existing = currentByAddress.get(resource.address);
    if (!existing) {
      creates.push(resource);
      continue;
    }
    const computed = resource.computed;
    const forcesReplacement = FORCES_REPLACEMENT[resource.type] ?? [];
    const changes: string[] = [];
    let replace = false;
    for (const [key, value] of Object.entries(resource.attributes)) {
      if (computed.includes(key)) continue;
      if (existing.attributes[key] !== value) {
        const forces = forcesReplacement.includes(key);
        replace = replace || forces;
        changes.push(
          `${key} = "${existing.attributes[key] ?? ''}" -> "${value}"${forces ? ' # forces replacement' : ''}`
        );
      }
    }
    if (replace) {
      computed.forEach((key) =>
        changes.push(`${key} = "${existing.attributes[key] ?? ''}" -> (known after apply)`)
      );
      replaces.push({ resource, previous: existing, changes });
    } else if (changes.length > 0) {
      updates.push({ resource, changes });
    }
  }

  for (const resource of current) {
    if (!desiredByAddress.has(resource.address)) {
      deletes.push(resource);
    }
  }

  return { creates, updates, replaces, deletes };
}

/** A replacement counts once as an add and once as a destroy, like the real summary. */
function planCounts(plan: PlanResult) {
  return {
    add: plan.creates.length + plan.replaces.length,
    change: plan.updates.length,
    destroy: plan.deletes.length + plan.replaces.length,
  };
}

function planIsEmpty(plan: PlanResult): boolean {
  const counts = planCounts(plan);
  return counts.add + counts.change + counts.destroy === 0;
}

const LESSONS: Lesson[] = [
  {
    id: 'init',
    title: 'Initialize',
    description: 'Download the AWS provider and prepare the directory.',
    icon: <Boxes className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Initialize the working directory so Terraform installs the AWS provider.',
        hint: 'The command is terraform init.',
        expectedCommand: ['terraform init'],
        explanation:
          'terraform init reads required_providers, downloads the AWS plugin, and creates the .terraform directory and lock file. Run it once per project and again whenever providers or modules change.',
      },
      {
        instruction: 'Check that the configuration is internally valid.',
        hint: 'Use terraform validate.',
        expectedCommand: ['terraform validate'],
        explanation:
          'terraform validate checks syntax and references without touching real infrastructure. It is fast and safe to run in CI before plan.',
      },
    ],
  },
  {
    id: 'plan',
    title: 'Plan',
    description: 'Preview what Terraform will create before it touches anything.',
    icon: <FileCode className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Generate an execution plan to see what will be created.',
        hint: 'Run terraform plan.',
        expectedCommand: ['terraform plan'],
        explanation:
          'terraform plan compares your configuration against state and prints the actions it would take. The + symbol means create, ~ means change in place, - means destroy, and -/+ means destroy and recreate. Values like the instance id show as (known after apply). Nothing is applied yet.',
      },
    ],
  },
  {
    id: 'apply',
    title: 'Apply',
    description: 'Create the resources and write them to state.',
    icon: <Cloud className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Apply the plan to create the resources.',
        hint: 'Run terraform apply -auto-approve.',
        expectedCommand: ['terraform apply -auto-approve', 'terraform apply'],
        explanation:
          'terraform apply prints the plan and waits until you type yes, then creates the resources and records them in state. -auto-approve skips that prompt, which is common in CI.',
      },
    ],
  },
  {
    id: 'change',
    title: 'Make a change',
    description: 'Edit the config and watch plan detect the difference.',
    icon: <Pencil className="h-5 w-5" />,
    commands: [
      {
        instruction:
          'Edit variables.tf and change instance_type (try t3.small), then run terraform plan to preview the in-place update.',
        hint: 'Click the variables.tf tab, change the default, then run terraform plan.',
        expectedCommand: ['terraform plan'],
        explanation:
          'Because the value in your config no longer matches state, Terraform shows a ~ update in place. This is how you preview drift between what you want and what exists.',
      },
      {
        instruction: 'Apply the change you just previewed.',
        hint: 'Run terraform apply -auto-approve.',
        expectedCommand: ['terraform apply -auto-approve', 'terraform apply'],
        explanation:
          'Apply reconciles state with your configuration. Many arguments update in place; some, like ami on an instance, force a replacement, which plan marks with -/+ and # forces replacement. Try changing the ami to see it.',
      },
    ],
  },
  {
    id: 'inspect',
    title: 'Inspect state',
    description: 'List managed resources and read the outputs.',
    icon: <Server className="h-5 w-5" />,
    commands: [
      {
        instruction: 'List every resource Terraform now manages.',
        hint: 'Run terraform state list.',
        expectedCommand: ['terraform state list'],
        explanation:
          'terraform state list prints the address of every resource in state. Addresses like aws_instance.web are how you target, move, or remove specific resources.',
      },
      {
        instruction: 'Print the output values, such as the instance IP and bucket name.',
        hint: 'Run terraform output.',
        expectedCommand: ['terraform output'],
        explanation:
          'Outputs expose useful values from your resources. Other tools and CI steps read them with terraform output -json.',
      },
    ],
  },
  {
    id: 'destroy',
    title: 'Tear down',
    description: 'Destroy everything so nothing keeps costing money.',
    icon: <RotateCcw className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Destroy all managed resources to clean up.',
        hint: 'Run terraform destroy -auto-approve.',
        expectedCommand: ['terraform destroy -auto-approve', 'terraform destroy'],
        explanation:
          'terraform destroy removes the resources it created and empties state. Always tear down throwaway environments so you do not pay for idle infrastructure.',
      },
    ],
  },
];

const TOTAL_COMMANDS = LESSONS.reduce((sum, lesson) => sum + lesson.commands.length, 0);

function normalize(command: string): string {
  return command.trim().replace(/\s+/g, ' ');
}

function computeOutputs(state: ManagedResource[]): Record<string, string> {
  const outputs: Record<string, string> = {};
  const instance = state.find((resource) => resource.type === 'aws_instance');
  const bucket = state.find((resource) => resource.type === 'aws_s3_bucket');
  if (instance) {
    outputs.instance_id = instance.attributes.id;
    outputs.instance_public_ip = instance.attributes.public_ip;
  }
  if (bucket) {
    outputs.bucket_name = bucket.attributes.bucket;
  }
  return outputs;
}

export default function TerraformTerminalSimulator() {
  const [files, setFiles] = useState<Record<FileName, string>>(DEFAULT_FILES);
  const [activeFile, setActiveFile] = useState<FileName>('main.tf');
  const [editing, setEditing] = useState(false);

  const [terminalHistory, setTerminalHistory] = useState<TerminalLine[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [initialized, setInitialized] = useState(false);
  const [state, setState] = useState<ManagedResource[]>([]);
  const [hasApplied, setHasApplied] = useState(false);
  const [lastPlan, setLastPlan] = useState<PlanResult | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const [completedCommands, setCompletedCommands] = useState<Set<string>>(new Set());
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [currentCommandIndex, setCurrentCommandIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const inputRef = useMemo(() => ({ current: null as HTMLInputElement | null }), []);

  const currentLesson = LESSONS[currentLessonIndex];
  const currentCommand = currentLesson?.commands[currentCommandIndex];
  const completedCount = completedCommands.size;
  const isComplete = completedCount === TOTAL_COMMANDS;

  const pushLines = useCallback((lines: TerminalLine[]) => {
    setTerminalHistory((prev) => [...prev, ...lines]);
  }, []);

  const out = (content: string): TerminalLine => ({
    type: 'output',
    content,
    timestamp: new Date(),
  });
  const err = (content: string): TerminalLine => ({
    type: 'error',
    content,
    timestamp: new Date(),
  });
  const ok = (content: string): TerminalLine => ({
    type: 'success',
    content,
    timestamp: new Date(),
  });

  const advanceLesson = useCallback(
    (command: string) => {
      if (!currentCommand) return;
      const normalizedInput = normalize(command);
      const matches = currentCommand.expectedCommand.some(
        (expected) => normalize(expected) === normalizedInput
      );
      if (!matches) return;

      const key = `${currentLesson.id}-${currentCommandIndex}`;
      setCompletedCommands((prev) => {
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        return next;
      });

      if (currentCommandIndex < currentLesson.commands.length - 1) {
        setCurrentCommandIndex((value) => value + 1);
      } else if (currentLessonIndex < LESSONS.length - 1) {
        setCurrentLessonIndex((value) => value + 1);
        setCurrentCommandIndex(0);
      }
      setShowHint(false);
    },
    [currentCommand, currentCommandIndex, currentLesson, currentLessonIndex]
  );

  const planToLines = (plan: PlanResult): TerminalLine[] => {
    const lines: TerminalLine[] = [];
    if (planIsEmpty(plan)) {
      lines.push(out('No changes. Your infrastructure matches the configuration.'));
      return lines;
    }
    lines.push(out('Terraform will perform the following actions:'));
    lines.push(out(''));
    plan.creates.forEach((resource) => {
      const computed = resource.computed;
      lines.push(out(`  # ${resource.address} will be created`));
      lines.push(out(`  + resource "${resource.type}" "${resource.name}" {`));
      Object.entries(resource.attributes).forEach(([key, value]) => {
        lines.push(
          out(`      + ${key} = ${computed.includes(key) ? '(known after apply)' : `"${value}"`}`)
        );
      });
      lines.push(out('    }'));
    });
    plan.updates.forEach(({ resource, changes }) => {
      lines.push(out(`  # ${resource.address} will be updated in-place`));
      lines.push(out(`  ~ resource "${resource.type}" "${resource.name}" {`));
      changes.forEach((change) => lines.push(out(`      ~ ${change}`)));
      lines.push(out('    }'));
    });
    plan.replaces.forEach(({ resource, changes }) => {
      lines.push(out(`  # ${resource.address} must be replaced`));
      lines.push(out(`-/+ resource "${resource.type}" "${resource.name}" {`));
      changes.forEach((change) => lines.push(out(`      ~ ${change}`)));
      lines.push(out('    }'));
    });
    plan.deletes.forEach((resource) => {
      lines.push(out(`  # ${resource.address} will be destroyed`));
      lines.push(out(`  - resource "${resource.type}" "${resource.name}"`));
    });
    lines.push(out(''));
    const counts = planCounts(plan);
    lines.push(
      ok(`Plan: ${counts.add} to add, ${counts.change} to change, ${counts.destroy} to destroy.`)
    );
    return lines;
  };

  const runCommand = useCallback(
    (raw: string) => {
      const command = normalize(raw);

      const applyChanges = ({ command: applied, plan, resources }: PendingConfirm) => {
        const lines: TerminalLine[] = [];
        plan.replaces.forEach(({ previous }) => {
          lines.push(out(`${previous.address}: Destroying... [id=${previous.attributes.id}]`));
          lines.push(out(`${previous.address}: Destruction complete`));
        });
        [...plan.creates, ...plan.replaces.map(({ resource }) => resource)].forEach((resource) => {
          lines.push(out(`${resource.address}: Creating...`));
          lines.push(out(`${resource.address}: Creation complete [id=${resource.attributes.id}]`));
        });
        plan.updates.forEach(({ resource }) => {
          lines.push(out(`${resource.address}: Modifying... [id=${resource.attributes.id}]`));
          lines.push(out(`${resource.address}: Modifications complete`));
        });
        plan.deletes.forEach((resource) => {
          lines.push(out(`${resource.address}: Destroying... [id=${resource.attributes.id}]`));
          lines.push(out(`${resource.address}: Destruction complete`));
        });
        lines.push(out(''));
        const counts = planCounts(plan);
        lines.push(
          ok(
            `Apply complete! Resources: ${counts.add} added, ${counts.change} changed, ${counts.destroy} destroyed.`
          )
        );
        const outputs = computeOutputs(resources);
        if (Object.keys(outputs).length > 0) {
          lines.push(out(''));
          lines.push(out('Outputs:'));
          Object.entries(outputs).forEach(([key, value]) => lines.push(out(`${key} = "${value}"`)));
        }
        setState(resources);
        setHasApplied(true);
        setLastPlan(null);
        pushLines(lines);
        advanceLesson(applied);
      };

      const destroyAll = ({ command: destroyed, plan }: PendingConfirm) => {
        const lines = plan.deletes
          .slice()
          .reverse()
          .map((resource) =>
            out(`${resource.address}: Destroying... [id=${resource.attributes.id}]`)
          );
        lines.push(out(''));
        lines.push(ok(`Destroy complete! Resources: ${plan.deletes.length} destroyed.`));
        setState([]);
        setLastPlan(null);
        pushLines(lines);
        advanceLesson(destroyed);
      };

      // apply and destroy wait at "Enter a value:" and only go ahead on "yes".
      if (pendingConfirm) {
        setPendingConfirm(null);
        pushLines([out(`  Enter a value: ${raw.trim()}`), out('')]);
        if (command !== 'yes') {
          pushLines([
            err(pendingConfirm.kind === 'apply' ? 'Apply cancelled.' : 'Destroy cancelled.'),
          ]);
          return;
        }
        if (pendingConfirm.kind === 'apply') applyChanges(pendingConfirm);
        else destroyAll(pendingConfirm);
        return;
      }

      if (!command) return;

      pushLines([{ type: 'input', content: raw.trim(), timestamp: new Date() }]);
      setCommandHistory((prev) => [...prev, raw.trim()]);
      setHistoryIndex(-1);

      const args = command.split(' ');

      if (command === 'help') {
        pushLines([
          out('Available commands:'),
          out('  terraform version              Show the Terraform version'),
          out('  terraform init                 Install providers, prepare the directory'),
          out('  terraform validate             Check the configuration is valid'),
          out('  terraform fmt                  Format the configuration files'),
          out('  terraform providers            Show the providers the config requires'),
          out('  terraform plan                 Preview changes without applying'),
          out('  terraform apply                Show the plan, then type yes to apply'),
          out('  terraform apply -auto-approve  Apply without the yes prompt'),
          out('  terraform state list           List resources in state'),
          out('  terraform state show <addr>    Show one resource in detail'),
          out('  terraform output [name]        Print output values'),
          out('  terraform destroy              Destroy all resources (asks for yes)'),
          out('  clear                          Clear the terminal'),
          out('Tip: edit the .tf files, then run plan to see the diff.'),
        ]);
        return;
      }

      if (command === 'clear') {
        setTerminalHistory([]);
        return;
      }

      if (args[0] !== 'terraform') {
        pushLines([err(`command not found: ${args[0]}. Try "terraform plan" or "help".`)]);
        return;
      }

      const sub = args[1];
      const parsed = parseConfig(files);

      if (sub === 'version') {
        pushLines([out('Terraform v1.13.0'), out('on linux_amd64')]);
        return;
      }

      if (sub === 'init') {
        setInitialized(true);
        pushLines([
          out('Initializing the backend...'),
          out('Initializing provider plugins...'),
          out('- Finding hashicorp/aws versions matching "~> 5.0"...'),
          out('- Installing hashicorp/aws v5.62.0...'),
          ok('Terraform has been successfully initialized!'),
        ]);
        advanceLesson(command);
        return;
      }

      if (sub === 'providers') {
        pushLines([
          out('Providers required by configuration:'),
          out('.'),
          out('└── provider[registry.terraform.io/hashicorp/aws] ~> 5.0'),
        ]);
        return;
      }

      if (sub === 'fmt') {
        pushLines([out('All configuration files are already formatted.')]);
        return;
      }

      if (!initialized && (sub === 'validate' || sub === 'plan' || sub === 'apply')) {
        pushLines([
          err('Error: this directory is not initialized.'),
          err('Run "terraform init" before any plan or apply.'),
        ]);
        return;
      }

      if (sub === 'validate') {
        if (parsed.errors.length > 0) {
          pushLines(parsed.errors.map((message) => err(`Error: ${message}`)));
          return;
        }
        pushLines([ok('Success! The configuration is valid.')]);
        advanceLesson(command);
        return;
      }

      if (sub === 'plan') {
        if (parsed.errors.length > 0) {
          pushLines(parsed.errors.map((message) => err(`Error: ${message}`)));
          return;
        }
        const plan = diffPlan(parsed.resources, state);
        setLastPlan(plan);
        pushLines(planToLines(plan));
        if (!(currentLesson.id === 'change' && currentCommandIndex === 0 && planIsEmpty(plan))) {
          advanceLesson(command);
        }
        return;
      }

      if (sub === 'apply') {
        if (parsed.errors.length > 0) {
          pushLines(parsed.errors.map((message) => err(`Error: ${message}`)));
          return;
        }
        const plan = diffPlan(parsed.resources, state);
        if (planIsEmpty(plan)) {
          pushLines([
            out('No changes. Your infrastructure matches the configuration.'),
            ok('Apply complete! Resources: 0 added, 0 changed, 0 destroyed.'),
          ]);
          advanceLesson(command);
          return;
        }
        const pending: PendingConfirm = {
          kind: 'apply',
          command,
          plan,
          resources: parsed.resources,
        };
        setLastPlan(plan);
        pushLines(planToLines(plan));
        if (args.includes('-auto-approve')) {
          pushLines([out('')]);
          applyChanges(pending);
          return;
        }
        pushLines([
          out(''),
          out('Do you want to perform these actions?'),
          out('  Terraform will perform the actions described above.'),
          out("  Only 'yes' will be accepted to approve."),
        ]);
        setPendingConfirm(pending);
        return;
      }

      if (sub === 'destroy') {
        if (state.length === 0) {
          pushLines([
            out('No resources to destroy. State is empty.'),
            ok('Destroy complete! Resources: 0 destroyed.'),
          ]);
          return;
        }
        const plan = diffPlan([], state);
        const pending: PendingConfirm = { kind: 'destroy', command, plan, resources: [] };
        pushLines(planToLines(plan));
        if (args.includes('-auto-approve')) {
          pushLines([out('')]);
          destroyAll(pending);
          return;
        }
        pushLines([
          out(''),
          out('Do you really want to destroy all resources?'),
          out('  Terraform will destroy all your managed infrastructure, as shown above.'),
          out("  There is no undo. Only 'yes' will be accepted to confirm."),
        ]);
        setPendingConfirm(pending);
        return;
      }

      if (sub === 'state' && args[2] === 'list') {
        if (state.length === 0) {
          pushLines([out('No resources in state. Run "terraform apply" first.')]);
          return;
        }
        pushLines(state.map((resource) => out(resource.address)));
        advanceLesson(command);
        return;
      }

      if (sub === 'state' && args[2] === 'show') {
        const address = args[3];
        const resource = state.find((item) => item.address === address);
        if (!resource) {
          pushLines([err(`No resource "${address ?? ''}" in state. Try "terraform state list".`)]);
          return;
        }
        const lines: TerminalLine[] = [out(`# ${resource.address}:`)];
        lines.push(out(`resource "${resource.type}" "${resource.name}" {`));
        Object.entries(resource.attributes).forEach(([key, value]) =>
          lines.push(out(`    ${key} = "${value}"`))
        );
        lines.push(out('}'));
        pushLines(lines);
        return;
      }

      if (sub === 'output') {
        if (!hasApplied || state.length === 0) {
          pushLines([err('No outputs found. Run "terraform apply" first.')]);
          return;
        }
        const outputs = computeOutputs(state);
        const requested = args[2];
        if (requested) {
          if (outputs[requested] === undefined) {
            pushLines([err(`Output "${requested}" not found.`)]);
            return;
          }
          pushLines([out(`"${outputs[requested]}"`)]);
          return;
        }
        pushLines(Object.entries(outputs).map(([key, value]) => out(`${key} = "${value}"`)));
        advanceLesson(command);
        return;
      }

      pushLines([err(`Terraform has no command named "${sub ?? ''}". Run "help" for the list.`)]);
    },
    [
      advanceLesson,
      currentCommandIndex,
      currentLesson.id,
      files,
      hasApplied,
      initialized,
      pendingConfirm,
      pushLines,
      state,
    ]
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (commandHistory.length === 0) return;
      const nextIndex =
        historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInputValue(commandHistory[nextIndex]);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (historyIndex === -1) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= commandHistory.length) {
        setHistoryIndex(-1);
        setInputValue('');
      } else {
        setHistoryIndex(nextIndex);
        setInputValue(commandHistory[nextIndex]);
      }
    }
  };

  const jumpToLesson = (index: number) => {
    const nextCommandIndex = LESSONS[index].commands.findIndex(
      (_, commandIndex) => !completedCommands.has(`${LESSONS[index].id}-${commandIndex}`)
    );
    setCurrentLessonIndex(index);
    setCurrentCommandIndex(nextCommandIndex === -1 ? 0 : nextCommandIndex);
    setShowHint(false);
  };

  const resetLab = () => {
    setFiles(DEFAULT_FILES);
    setActiveFile('main.tf');
    setEditing(false);
    setTerminalHistory([]);
    setInputValue('');
    setCommandHistory([]);
    setHistoryIndex(-1);
    setInitialized(false);
    setState([]);
    setHasApplied(false);
    setLastPlan(null);
    setPendingConfirm(null);
    setCompletedCommands(new Set());
    setCurrentLessonIndex(0);
    setCurrentCommandIndex(0);
    setShowHint(false);
  };

  const planSummary = useMemo(() => {
    if (lastPlan) {
      const counts = planCounts(lastPlan);
      return {
        adds: counts.add,
        changes: counts.change,
        destroys: counts.destroy,
        label: 'last plan',
      };
    }
    return { adds: 0, changes: 0, destroys: 0, label: hasApplied ? 'applied' : 'no plan yet' };
  }, [lastPlan, hasApplied]);

  const lab: SimLabState = {
    currentLessonIndex,
    currentCommandIndex,
    completedCount,
    totalCommands: TOTAL_COMMANDS,
    isComplete,
    isCommandDone: (l, c) => completedCommands.has(`${LESSONS[l].id}-${c}`),
    showHint,
    setShowHint,
    setInputValue,
    inputRef,
    jumpToLesson,
    resetProgress: resetLab,
  };
  const ui = useSimLab(lab);

  return (
    <MotionConfig reducedMotion="user">
      <SimFrame>
        <SimLabBar
          title="Terraform Terminal Simulator"
          icon={FileCode}
          lessons={LESSONS}
          lab={lab}
          ui={ui}
          task={currentCommand?.instruction}
          hint={currentCommand?.hint}
          showMe={currentCommand?.expectedCommand[0]}
        />

        {ui.showComplete ? (
          <SimComplete
            title="Lab complete"
            summary="You ran init, validate, plan and apply, changed a variable and applied the update, read state and outputs, and destroyed what you built."
            stats={labStats(lab, LESSONS, ui, { showMe: true })}
            actions={
              <Button type="button" variant="outline" onClick={ui.keepExploring}>
                Keep exploring
              </Button>
            }
            onPlayAgain={ui.startOver}
            playAgainLabel="Start over"
          />
        ) : (
          <SimLabLayout
            terminal={
              <div className="space-y-2">
                <section
                  aria-label="Terraform files"
                  className="overflow-hidden rounded-lg border border-terminal-border bg-terminal text-terminal-foreground"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-terminal-border bg-terminal-bar px-2 py-1.5">
                    <div className="flex min-w-0 flex-wrap gap-1" role="tablist" aria-label="Files">
                      {FILE_ORDER.map((file) => (
                        <button
                          key={file}
                          type="button"
                          role="tab"
                          aria-selected={activeFile === file}
                          onClick={() => setActiveFile(file)}
                          className={cn(
                            'h-10 rounded px-2 font-mono text-xs transition-colors lg:h-8',
                            activeFile === file
                              ? 'bg-terminal text-terminal-input'
                              : 'text-terminal-muted hover:text-terminal-input'
                          )}
                        >
                          {file}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditing((value) => !value)}
                      aria-pressed={editing}
                      className="inline-flex h-10 items-center gap-1.5 rounded-md px-2.5 font-mono text-xs text-terminal-muted hover:text-terminal-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-8"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      {editing ? 'Done' : 'Edit'}
                    </button>
                  </div>
                  {editing ? (
                    <textarea
                      value={files[activeFile]}
                      onChange={(event) =>
                        setFiles((prev) => ({ ...prev, [activeFile]: event.target.value }))
                      }
                      spellCheck={false}
                      className={cn(
                        EDITOR_HEIGHT,
                        'w-full resize-none bg-terminal p-3 font-mono text-xs leading-relaxed text-terminal-input caret-terminal-prompt outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
                      )}
                      aria-label={`Edit ${activeFile}`}
                    />
                  ) : (
                    <pre
                      className={cn(
                        EDITOR_HEIGHT,
                        'overflow-auto p-3 font-mono text-xs leading-relaxed text-terminal-foreground'
                      )}
                    >
                      {files[activeFile]}
                    </pre>
                  )}
                </section>
                <SimTerminal
                  label="terraform"
                  status={initialized ? 'initialized' : 'not initialized'}
                  prompt={pendingConfirm ? 'Enter a value:' : '$'}
                  linePrompt="$"
                  lines={labLines(terminalHistory, [
                    { type: 'success', content: 'Welcome to the Terraform terminal.' },
                    {
                      type: 'muted',
                      content:
                        'Type "help", or follow the current task. Start with terraform init.',
                    },
                  ])}
                  value={inputValue}
                  onChange={setInputValue}
                  onSubmit={(value) => {
                    if (!value.trim()) return;
                    runCommand(value);
                    setInputValue('');
                  }}
                  onKeyDown={handleKeyDown}
                  inputRef={inputRef}
                  placeholder="terraform init"
                  autoFocus
                  heightClassName={TERMINAL_HEIGHT}
                />
              </div>
            }
            aside={
              <>
                <SimLabPanel title="Plan" icon={FileCode} summary={planSummary.label}>
                  <div className="space-y-2 font-mono text-xs">
                    <div className="flex gap-3">
                      <span className="text-correct-foreground">+{planSummary.adds}</span>
                      <span className="text-partial-foreground">~{planSummary.changes}</span>
                      <span className="text-wrong-foreground">-{planSummary.destroys}</span>
                    </div>
                    {lastPlan && (
                      <div className="max-h-48 overflow-auto whitespace-pre-wrap text-muted-foreground">
                        {planToLines(lastPlan).map((line, index) => (
                          <p key={index}>{line.content || ' '}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </SimLabPanel>
                <SimLabPanel title="State" icon={Server} summary={`${state.length} resources`}>
                  {state.length === 0 ? (
                    <p className="text-xs font-mono text-muted-foreground">
                      No resources in state.
                    </p>
                  ) : (
                    <div className="space-y-2 text-xs font-mono">
                      {state.map((resource) => (
                        <div
                          key={resource.address}
                          className="rounded-md border border-border bg-muted/30 p-2"
                        >
                          <p className="text-primary">{resource.address}</p>
                          {Object.entries(resource.attributes).map(([key, value]) => (
                            <p key={key} className="text-muted-foreground">
                              {key} = {value}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </SimLabPanel>
                <SimLabPanel title="Lessons" icon={BookOpen} summary={lessonsSummary(LESSONS, lab)}>
                  <SimLabLessons lessons={LESSONS} lab={lab} ui={ui} />
                </SimLabPanel>
              </>
            }
          />
        )}
      </SimFrame>
    </MotionConfig>
  );
}
