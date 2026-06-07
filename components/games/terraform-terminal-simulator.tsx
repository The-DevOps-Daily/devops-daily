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

const FILES: Record<FileName, string> = {
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

  ingress {
    from_port   = 22
    to_port     = 22
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

  tags = {
    Name = "\${var.project}-assets"
  }
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
  description = "ID of the web EC2 instance"
  value       = aws_instance.web.id
}

output "instance_public_ip" {
  description = "Public IP of the web instance"
  value       = aws_instance.web.public_ip
}

output "bucket_name" {
  description = "Name of the S3 assets bucket"
  value       = aws_s3_bucket.assets.bucket
}`,
};

const FILE_ORDER: FileName[] = ['main.tf', 'variables.tf', 'outputs.tf'];

// Resources the configuration creates, in dependency order.
const PLANNED_RESOURCES: ManagedResource[] = [
  {
    address: 'aws_security_group.web',
    type: 'aws_security_group',
    name: 'web',
    attributes: { id: 'sg-0a1b2c3d4e5f6a7b8', name: 'web-sg', vpc_id: 'vpc-04e9f2a1' },
  },
  {
    address: 'aws_instance.web',
    type: 'aws_instance',
    name: 'web',
    attributes: {
      id: 'i-0abc123def4567890',
      instance_type: 't3.micro',
      ami: 'ami-0c55b159cbfafe1f0',
      public_ip: '54.210.18.42',
    },
  },
  {
    address: 'aws_s3_bucket.assets',
    type: 'aws_s3_bucket',
    name: 'assets',
    attributes: { id: 'devops-daily-assets', bucket: 'devops-daily-assets', region: 'us-east-1' },
  },
];

const OUTPUTS: Record<string, string> = {
  bucket_name: 'devops-daily-assets',
  instance_id: 'i-0abc123def4567890',
  instance_public_ip: '54.210.18.42',
};

const LESSONS: Lesson[] = [
  {
    id: 'init',
    title: 'Initialize',
    description: 'Download the AWS provider and prepare the working directory.',
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
          'terraform validate checks syntax and references without touching any real infrastructure. It is fast and safe to run in CI before plan.',
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
          'terraform destroy removes the resources it created and empties the state. Always tear down throwaway environments so you do not pay for idle infrastructure.',
      },
    ],
  },
];

const TOTAL_COMMANDS = LESSONS.reduce((sum, lesson) => sum + lesson.commands.length, 0);

function normalize(command: string): string {
  return command.trim().replace(/\s+/g, ' ');
}

export default function TerraformTerminalSimulator() {
  const [activeFile, setActiveFile] = useState<FileName>('main.tf');
  const [terminalHistory, setTerminalHistory] = useState<TerminalLine[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [initialized, setInitialized] = useState(false);
  const [applied, setApplied] = useState(false);
  const [hasPlan, setHasPlan] = useState(false);

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

  const resources = applied ? PLANNED_RESOURCES : [];

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

      // Move to the next command or lesson.
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
          out('  terraform plan                 Preview changes without applying'),
          out('  terraform apply -auto-approve  Create or update resources'),
          out('  terraform state list           List resources in state'),
          out('  terraform show                 Show the current state'),
          out('  terraform output               Print output values'),
          out('  terraform destroy -auto-approve  Destroy all resources'),
          out('  clear                          Clear the terminal'),
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
          out('- Installed hashicorp/aws v5.62.0 (signed by HashiCorp)'),
          ok('Terraform has been successfully initialized!'),
        ]);
        advanceLesson(command);
        return;
      }

      if (sub === 'fmt') {
        if (!initialized) {
          pushLines([out('main.tf'), out('Formatted 1 file.')]);
          advanceLesson(command);
          return;
        }
        pushLines([out('All configuration files are already formatted.')]);
        advanceLesson(command);
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
        pushLines([ok('Success! The configuration is valid.')]);
        advanceLesson(command);
        return;
      }

      if (sub === 'plan') {
        if (applied) {
          pushLines([
            out('No changes. Your infrastructure matches the configuration.'),
            out('Terraform has compared your real resources against your configuration'),
            out('and found no differences, so no changes are needed.'),
          ]);
          advanceLesson(command);
          return;
        }
        setHasPlan(true);
        pushLines([
          out('Terraform will perform the following actions:'),
          out(''),
          out('  # aws_security_group.web will be created'),
          out('  + resource "aws_security_group" "web" {'),
          out('      + name        = "web-sg"'),
          out('      + description = "Allow HTTP and SSH"'),
          out('    }'),
          out('  # aws_instance.web will be created'),
          out('  + resource "aws_instance" "web" {'),
          out('      + ami           = "ami-0c55b159cbfafe1f0"'),
          out('      + instance_type = "t3.micro"'),
          out('    }'),
          out('  # aws_s3_bucket.assets will be created'),
          out('  + resource "aws_s3_bucket" "assets" {'),
          out('      + bucket = "devops-daily-assets"'),
          out('    }'),
          out(''),
          ok('Plan: 3 to add, 0 to change, 0 to destroy.'),
        ]);
        advanceLesson(command);
        return;
      }

      if (sub === 'apply') {
        if (!initialized) {
          pushLines([err('Error: run "terraform init" first.')]);
          return;
        }
        if (applied) {
          pushLines([
            out('No changes. Your infrastructure matches the configuration.'),
            ok('Apply complete! Resources: 0 added, 0 changed, 0 destroyed.'),
          ]);
          advanceLesson(command);
          return;
        }
        setApplied(true);
        setHasPlan(false);
        pushLines([
          out('aws_security_group.web: Creating...'),
          out('aws_security_group.web: Creation complete after 2s [id=sg-0a1b2c3d4e5f6a7b8]'),
          out('aws_instance.web: Creating...'),
          out('aws_instance.web: Still creating... [10s elapsed]'),
          out('aws_instance.web: Creation complete after 12s [id=i-0abc123def4567890]'),
          out('aws_s3_bucket.assets: Creating...'),
          out('aws_s3_bucket.assets: Creation complete after 3s [id=devops-daily-assets]'),
          out(''),
          ok('Apply complete! Resources: 3 added, 0 changed, 0 destroyed.'),
          out(''),
          out('Outputs:'),
          out('bucket_name = "devops-daily-assets"'),
          out('instance_id = "i-0abc123def4567890"'),
          out('instance_public_ip = "54.210.18.42"'),
        ]);
        advanceLesson(command);
        return;
      }

      if (sub === 'destroy') {
        if (!applied) {
          pushLines([
            out('No resources to destroy. State is empty.'),
            ok('Destroy complete! Resources: 0 destroyed.'),
          ]);
          return;
        }
        setApplied(false);
        setHasPlan(false);
        pushLines([
          out('aws_s3_bucket.assets: Destroying... [id=devops-daily-assets]'),
          out('aws_s3_bucket.assets: Destruction complete after 1s'),
          out('aws_instance.web: Destroying... [id=i-0abc123def4567890]'),
          out('aws_instance.web: Destruction complete after 30s'),
          out('aws_security_group.web: Destroying... [id=sg-0a1b2c3d4e5f6a7b8]'),
          out('aws_security_group.web: Destruction complete after 1s'),
          out(''),
          ok('Destroy complete! Resources: 3 destroyed.'),
        ]);
        advanceLesson(command);
        return;
      }

      if (sub === 'state' && args[2] === 'list') {
        if (!applied) {
          pushLines([out('No resources in state. Run "terraform apply" first.')]);
          return;
        }
        pushLines(PLANNED_RESOURCES.map((resource) => out(resource.address)));
        advanceLesson(command);
        return;
      }

      if (sub === 'show') {
        if (!applied) {
          pushLines([out('No state. Run "terraform apply" first.')]);
          return;
        }
        const lines: TerminalLine[] = [];
        PLANNED_RESOURCES.forEach((resource) => {
          lines.push(out(`# ${resource.address}:`));
          lines.push(out(`resource "${resource.type}" "${resource.name}" {`));
          Object.entries(resource.attributes).forEach(([key, value]) => {
            lines.push(out(`    ${key} = "${value}"`));
          });
          lines.push(out('}'));
        });
        pushLines(lines);
        advanceLesson(command);
        return;
      }

      if (sub === 'output') {
        if (!applied) {
          pushLines([err('No outputs found. Run "terraform apply" first.')]);
          return;
        }
        pushLines(
          Object.entries(OUTPUTS).map(([key, value]) => out(`${key} = "${value}"`))
        );
        advanceLesson(command);
        return;
      }

      pushLines([err(`Terraform has no command named "${sub ?? ''}". Run "help" for the list.`)]);
    },
    [advanceLesson, applied, initialized, pushLines]
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
    setTerminalHistory([]);
    setInputValue('');
    setCommandHistory([]);
    setHistoryIndex(-1);
    setInitialized(false);
    setApplied(false);
    setHasPlan(false);
    setCompletedCommands(new Set());
    setCurrentLessonIndex(0);
    setCurrentCommandIndex(0);
    setShowHint(false);
  };

  const planState = useMemo(() => {
    if (applied) return { label: 'No changes', adds: 0, changes: 0, destroys: 0 };
    if (hasPlan) return { label: '3 to add', adds: 3, changes: 0, destroys: 0 };
    return { label: 'Not planned', adds: 0, changes: 0, destroys: 0 };
  }, [applied, hasPlan]);

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="mb-5 text-center">
        <div className="mb-3 flex items-center justify-center gap-2.5">
          <FileCode className="h-8 w-8 text-primary" strokeWidth={1.5} />
          <h2 className="text-2xl font-bold md:text-3xl">Terraform Lab</h2>
        </div>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground">
          Run a real Terraform workflow in a safe browser simulator. Read the HCL config on the left,
          run init, plan, apply, and destroy in the terminal, and watch state fill in on the right.
          Nothing is provisioned for real.
        </p>
      </div>

      {/* Objective + progress bar (kept compact so the three panes fit on one screen) */}
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
              Lab complete. Experiment freely, or reset to run through it again.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Three panes: config | terminal | state. Each scrolls internally. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px]">
        {/* Config files */}
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
          </CardHeader>
          <CardContent className="p-0">
            <pre className="h-[28rem] overflow-auto p-3 font-mono text-[12px] leading-relaxed text-slate-300 sm:text-[13px]">
              {FILES[activeFile]}
            </pre>
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
                <span>{resources.length} resources</span>
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
                  <p>Welcome to the Terraform Lab.</p>
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

        {/* State + plan */}
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
                <span className="text-emerald-500">+{planState.adds}</span>
                <span className="text-amber-500">~{planState.changes}</span>
                <span className="text-red-500">-{planState.destroys}</span>
                <Badge variant="secondary" className="ml-auto">
                  {planState.label}
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
              {resources.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No resources yet. Run <code className="text-primary">terraform apply</code> to
                  create them.
                </p>
              ) : (
                <div className="max-h-[20rem] space-y-2 overflow-y-auto">
                  {resources.map((resource) => (
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
