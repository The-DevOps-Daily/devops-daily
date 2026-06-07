'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle,
  ChevronRight,
  Cloud,
  FileCode,
  Lightbulb,
  Boxes,
  Pencil,
  RotateCcw,
  Server,
  Trophy,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type FileName = 'main.tf' | 'variables.tf' | 'outputs.tf';

interface ManagedResource {
  address: string;
  type: string;
  name: string;
  attributes: Record<string, string>;
}

interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'success';
  content: string;
  timestamp: Date;
}

interface PlanResult {
  creates: ManagedResource[];
  updates: { resource: ManagedResource; changes: string[] }[];
  deletes: ManagedResource[];
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
    if (type === 'aws_instance') {
      attributes = {
        id: idFor('i-0', name),
        instance_type: readAssign(body, 'instance_type', vars) ?? 't3.micro',
        ami: readAssign(body, 'ami', vars) ?? 'ami-unknown',
        public_ip: ipFor(name),
      };
    } else if (type === 'aws_s3_bucket') {
      const bucket = readAssign(body, 'bucket', vars) ?? `${name}-bucket`;
      attributes = { id: bucket, bucket, region: vars.region ?? 'us-east-1' };
    } else if (type === 'aws_security_group') {
      attributes = {
        id: idFor('sg-0', name),
        name: readAssign(body, 'name', vars) ?? name,
        vpc_id: 'vpc-04e9f2a1',
      };
    } else {
      attributes = { id: `${type.replace(/^aws_/, '')}-${fnv(name).slice(0, 8)}` };
    }

    resources.push({ address, type, name, attributes });
  }

  return { resources, errors };
}

function diffPlan(desired: ManagedResource[], current: ManagedResource[]): PlanResult {
  const currentByAddress = new Map(current.map((resource) => [resource.address, resource]));
  const desiredByAddress = new Map(desired.map((resource) => [resource.address, resource]));

  const creates: ManagedResource[] = [];
  const updates: { resource: ManagedResource; changes: string[] }[] = [];
  const deletes: ManagedResource[] = [];

  for (const resource of desired) {
    const existing = currentByAddress.get(resource.address);
    if (!existing) {
      creates.push(resource);
      continue;
    }
    const changes: string[] = [];
    for (const [key, value] of Object.entries(resource.attributes)) {
      if (key === 'id' || key === 'public_ip') continue;
      if (existing.attributes[key] !== value) {
        changes.push(`${key}: "${existing.attributes[key] ?? ''}" => "${value}"`);
      }
    }
    if (changes.length > 0) {
      updates.push({ resource, changes });
    }
  }

  for (const resource of current) {
    if (!desiredByAddress.has(resource.address)) {
      deletes.push(resource);
    }
  }

  return { creates, updates, deletes };
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
          'terraform plan compares your configuration against state and prints the actions it would take. The + symbol means create, ~ means change in place, and - means destroy. Nothing is applied yet.',
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
          'terraform apply creates the resources and records them in state. In real projects you review the plan before approving. -auto-approve skips the interactive prompt, which is common in CI.',
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
          'Apply reconciles state with your configuration. Many resources update in place; some force a replacement, which a real plan would mark with -/+.',
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

  const [completedCommands, setCompletedCommands] = useState<Set<string>>(new Set());
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [currentCommandIndex, setCurrentCommandIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentLesson = LESSONS[currentLessonIndex];
  const currentCommand = currentLesson?.commands[currentCommandIndex];
  const completedCount = completedCommands.size;
  const progressPercentage = Math.round((completedCount / TOTAL_COMMANDS) * 100);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalHistory]);

  const pushLines = useCallback((lines: TerminalLine[]) => {
    setTerminalHistory((prev) => [...prev, ...lines]);
  }, []);

  const out = (content: string): TerminalLine => ({ type: 'output', content, timestamp: new Date() });
  const err = (content: string): TerminalLine => ({ type: 'error', content, timestamp: new Date() });
  const ok = (content: string): TerminalLine => ({ type: 'success', content, timestamp: new Date() });

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
    if (plan.creates.length === 0 && plan.updates.length === 0 && plan.deletes.length === 0) {
      lines.push(out('No changes. Your infrastructure matches the configuration.'));
      return lines;
    }
    lines.push(out('Terraform will perform the following actions:'));
    lines.push(out(''));
    plan.creates.forEach((resource) => {
      lines.push(out(`  # ${resource.address} will be created`));
      lines.push(out(`  + resource "${resource.type}" "${resource.name}" {`));
      Object.entries(resource.attributes).forEach(([key, value]) => {
        lines.push(out(`      + ${key} = "${value}"`));
      });
      lines.push(out('    }'));
    });
    plan.updates.forEach(({ resource, changes }) => {
      lines.push(out(`  # ${resource.address} will be updated in place`));
      lines.push(out(`  ~ resource "${resource.type}" "${resource.name}" {`));
      changes.forEach((change) => lines.push(out(`      ~ ${change}`)));
      lines.push(out('    }'));
    });
    plan.deletes.forEach((resource) => {
      lines.push(out(`  # ${resource.address} will be destroyed`));
      lines.push(out(`  - resource "${resource.type}" "${resource.name}"`));
    });
    lines.push(out(''));
    lines.push(
      ok(
        `Plan: ${plan.creates.length} to add, ${plan.updates.length} to change, ${plan.deletes.length} to destroy.`
      )
    );
    return lines;
  };

  const runCommand = useCallback(
    (raw: string) => {
      const command = normalize(raw);
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
          out('  terraform apply -auto-approve  Create or update resources'),
          out('  terraform state list           List resources in state'),
          out('  terraform state show <addr>    Show one resource in detail'),
          out('  terraform output [name]        Print output values'),
          out('  terraform destroy -auto-approve  Destroy all resources'),
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
        advanceLesson(command);
        return;
      }

      if (sub === 'apply') {
        if (parsed.errors.length > 0) {
          pushLines(parsed.errors.map((message) => err(`Error: ${message}`)));
          return;
        }
        const plan = diffPlan(parsed.resources, state);
        if (plan.creates.length === 0 && plan.updates.length === 0 && plan.deletes.length === 0) {
          pushLines([
            out('No changes. Your infrastructure matches the configuration.'),
            ok('Apply complete! Resources: 0 added, 0 changed, 0 destroyed.'),
          ]);
          advanceLesson(command);
          return;
        }
        const lines: TerminalLine[] = [];
        plan.creates.forEach((resource) => {
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
        lines.push(
          ok(
            `Apply complete! Resources: ${plan.creates.length} added, ${plan.updates.length} changed, ${plan.deletes.length} destroyed.`
          )
        );
        const newState = parsed.resources;
        const outputs = computeOutputs(newState);
        if (Object.keys(outputs).length > 0) {
          lines.push(out(''));
          lines.push(out('Outputs:'));
          Object.entries(outputs).forEach(([key, value]) => lines.push(out(`${key} = "${value}"`)));
        }
        setState(newState);
        setHasApplied(true);
        setLastPlan(null);
        pushLines(lines);
        advanceLesson(command);
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
        const count = state.length;
        const lines = state
          .slice()
          .reverse()
          .map((resource) => out(`${resource.address}: Destroying... [id=${resource.attributes.id}]`));
        lines.push(out(''));
        lines.push(ok(`Destroy complete! Resources: ${count} destroyed.`));
        setState([]);
        setLastPlan(null);
        pushLines(lines);
        advanceLesson(command);
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
    [advanceLesson, files, hasApplied, initialized, pushLines, state]
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!inputValue.trim()) return;
    runCommand(inputValue);
    setInputValue('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (commandHistory.length === 0) return;
      const nextIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
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
    setCurrentLessonIndex(index);
    setCurrentCommandIndex(0);
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
    setCompletedCommands(new Set());
    setCurrentLessonIndex(0);
    setCurrentCommandIndex(0);
    setShowHint(false);
  };

  const planSummary = useMemo(() => {
    if (lastPlan) {
      return {
        adds: lastPlan.creates.length,
        changes: lastPlan.updates.length,
        destroys: lastPlan.deletes.length,
        label: 'last plan',
      };
    }
    return { adds: 0, changes: 0, destroys: 0, label: hasApplied ? 'applied' : 'no plan yet' };
  }, [lastPlan, hasApplied]);

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="mb-5 text-center">
        <div className="mb-3 flex items-center justify-center gap-2.5">
          <FileCode className="h-8 w-8 text-primary" strokeWidth={1.5} />
          <h2 className="text-2xl font-bold md:text-3xl">Terraform Basics Lab</h2>
        </div>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground">
          Learn Terraform by doing. Read and edit the HCL on the left, run init, plan, apply, and
          destroy in the terminal, and watch state change on the right. Edit the config and plan
          again to see Terraform detect the difference. Nothing is provisioned for real.
        </p>
      </div>

      <Card className="mb-4">
        <CardContent className="px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <span className="font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">
                {completedCount}/{TOTAL_COMMANDS} steps
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {LESSONS.map((lesson, index) => {
                const lessonDone = lesson.commands.every((_, commandIndex) =>
                  completedCommands.has(`${lesson.id}-${commandIndex}`)
                );
                return (
                  <button
                    key={lesson.id}
                    onClick={() => jumpToLesson(index)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors',
                      index === currentLessonIndex
                        ? 'border-primary/60 bg-primary/10'
                        : 'border-transparent hover:bg-muted'
                    )}
                  >
                    {lessonDone ? (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    {lesson.title}
                  </button>
                );
              })}
              <Button variant="outline" size="sm" onClick={resetLab} className="ml-1 h-7">
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Reset
              </Button>
            </div>
          </div>
          <Progress value={progressPercentage} className="h-2.5" />
          {currentCommand ? (
            <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm">
                    <span className="font-medium">{currentLesson.title}:</span>{' '}
                    {currentCommand.instruction}
                  </p>
                  {showHint && (
                    <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
                      Hint: {currentCommand.hint}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHint((value) => !value)}
                className="h-7 text-muted-foreground"
              >
                <Lightbulb className="mr-1 h-3.5 w-3.5" />
                {showHint ? 'Hide hint' : 'Hint'}
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-sm font-medium text-emerald-600">
              Lab complete. Edit the config and experiment freely, or reset to run through it again.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px]">
        {/* Config files (editable) */}
        <Card className="overflow-hidden border-border bg-[#171717]">
          <CardHeader className="flex flex-row items-center gap-1 border-b border-border/60 bg-[#262626] p-0">
            {FILE_ORDER.map((file) => (
              <button
                key={file}
                onClick={() => setActiveFile(file)}
                className={cn(
                  'border-r border-border/60 px-3 py-2 font-mono text-xs transition-colors',
                  activeFile === file
                    ? 'bg-[#171717] text-primary'
                    : 'text-muted-foreground hover:text-slate-200'
                )}
              >
                {file}
              </button>
            ))}
            <button
              onClick={() => setEditing((value) => !value)}
              className="ml-auto flex items-center gap-1 px-3 py-2 font-mono text-xs text-muted-foreground hover:text-slate-200"
              title="Toggle editing"
            >
              <Pencil className="h-3.5 w-3.5" />
              {editing ? 'done' : 'edit'}
            </button>
          </CardHeader>
          <CardContent className="p-0">
            {editing ? (
              <textarea
                value={files[activeFile]}
                onChange={(event) =>
                  setFiles((prev) => ({ ...prev, [activeFile]: event.target.value }))
                }
                spellCheck={false}
                className="h-[28rem] w-full resize-none bg-[#171717] p-3 font-mono text-[12px] leading-relaxed text-slate-200 outline-none sm:text-[13px]"
                aria-label={`Edit ${activeFile}`}
              />
            ) : (
              <pre className="h-[28rem] overflow-auto p-3 font-mono text-[12px] leading-relaxed text-slate-300 sm:text-[13px]">
                {files[activeFile]}
              </pre>
            )}
          </CardContent>
        </Card>

        {/* Terminal */}
        <Card className="border-border bg-[#171717]">
          <CardHeader className="border-b border-border/60 bg-[#262626] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                </div>
                <span className="ml-2 text-sm text-muted-foreground">terraform-lab ~/infra</span>
              </div>
              <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                <span>{initialized ? 'initialized' : 'not initialized'}</span>
                <span>{state.length} resources</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div
              ref={terminalRef}
              onClick={() => inputRef.current?.focus()}
              className="h-[28rem] cursor-text overflow-y-auto p-3 font-mono text-[12px] sm:text-[13px]"
            >
              {terminalHistory.length === 0 && (
                <div className="mb-4 text-green-400">
                  <p>Welcome to the Terraform Basics Lab.</p>
                  <p className="mt-2 text-muted-foreground">
                    Type &quot;help&quot; for commands, or follow the current task. Start with{' '}
                    <span className="text-primary">terraform init</span>.
                  </p>
                </div>
              )}

              {terminalHistory.map((line, index) => (
                <div
                  key={`${line.timestamp.getTime()}-${index}`}
                  className={cn(
                    'mb-0.5',
                    line.type === 'input' && 'text-white',
                    line.type === 'output' && 'text-slate-300',
                    line.type === 'error' && 'text-red-400',
                    line.type === 'success' &&
                      'my-2 rounded border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-300'
                  )}
                >
                  {line.type === 'input' && <span className="text-green-400">$ </span>}
                  <span className="whitespace-pre-wrap break-words">{line.content}</span>
                </div>
              ))}

              <form onSubmit={handleSubmit} className="flex items-center">
                <span className="text-green-400">$ </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={handleKeyDown}
                  className="ml-1 flex-1 bg-transparent text-white caret-green-400 outline-none"
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="off"
                  placeholder="terraform init"
                  aria-label="Terraform command input"
                />
              </form>
            </div>
          </CardContent>
        </Card>

        {/* Plan + state */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileCode className="h-5 w-5" />
                Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-emerald-500">+{planSummary.adds}</span>
                <span className="text-amber-500">~{planSummary.changes}</span>
                <span className="text-red-500">-{planSummary.destroys}</span>
                <Badge variant="secondary" className="ml-auto">
                  {planSummary.label}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-5 w-5" />
                State
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {state.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No resources yet. Run <code className="text-primary">terraform apply</code> to
                  create them.
                </p>
              ) : (
                <div className="max-h-[20rem] space-y-2 overflow-y-auto">
                  {state.map((resource) => (
                    <div key={resource.address} className="rounded-md border bg-muted/30 p-2.5">
                      <p className="font-mono text-xs text-primary">{resource.address}</p>
                      <div className="mt-1.5 space-y-0.5">
                        {Object.entries(resource.attributes).map(([key, value]) => (
                          <p key={key} className="font-mono text-[11px] text-muted-foreground">
                            {key} = {value}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
