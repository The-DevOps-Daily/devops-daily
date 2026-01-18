'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Terminal,
  BookOpen,
  CheckCircle,
  ArrowRight,
  RotateCcw,
  Lightbulb,
  Trophy,
  FolderOpen,
  FileText,
  HardDrive,
  User,
  Lock,
  Network,
  Cpu,
  ChevronRight,
} from 'lucide-react';

// Types
interface FileSystemNode {
  type: 'file' | 'directory';
  name: string;
  content?: string;
  children?: Record<string, FileSystemNode>;
  permissions?: string;
  owner?: string;
  size?: number;
}

interface Lesson {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  commands: LessonCommand[];
}

interface LessonCommand {
  instruction: string;
  hint: string;
  expectedCommand: string | string[];
  explanation: string;
  setup?: () => void;
}

interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'success';
  content: string;
  timestamp: Date;
}

// Initial file system
const createInitialFileSystem = (): FileSystemNode => ({
  type: 'directory',
  name: '/',
  permissions: 'drwxr-xr-x',
  owner: 'root',
  children: {
    home: {
      type: 'directory',
      name: 'home',
      permissions: 'drwxr-xr-x',
      owner: 'root',
      children: {
        user: {
          type: 'directory',
          name: 'user',
          permissions: 'drwxr-xr-x',
          owner: 'user',
          children: {
            documents: {
              type: 'directory',
              name: 'documents',
              permissions: 'drwxr-xr-x',
              owner: 'user',
              children: {
                'readme.txt': {
                  type: 'file',
                  name: 'readme.txt',
                  content: 'Welcome to the Linux Terminal Tutorial!\nThis is a sample text file.',
                  permissions: '-rw-r--r--',
                  owner: 'user',
                  size: 72,
                },
                'notes.md': {
                  type: 'file',
                  name: 'notes.md',
                  content: '# My Notes\n\n- Learn Linux basics\n- Practice commands\n- Have fun!',
                  permissions: '-rw-r--r--',
                  owner: 'user',
                  size: 65,
                },
              },
            },
            projects: {
              type: 'directory',
              name: 'projects',
              permissions: 'drwxr-xr-x',
              owner: 'user',
              children: {
                'app.py': {
                  type: 'file',
                  name: 'app.py',
                  content: '#!/usr/bin/env python3\n\nprint("Hello, Linux!")\n',
                  permissions: '-rwxr-xr-x',
                  owner: 'user',
                  size: 52,
                },
                'config.json': {
                  type: 'file',
                  name: 'config.json',
                  content: '{\n  "name": "myapp",\n  "version": "1.0.0"\n}',
                  permissions: '-rw-r--r--',
                  owner: 'user',
                  size: 48,
                },
              },
            },
            '.bashrc': {
              type: 'file',
              name: '.bashrc',
              content: '# Bash configuration\nexport PATH=$PATH:/usr/local/bin\nalias ll="ls -la"',
              permissions: '-rw-r--r--',
              owner: 'user',
              size: 78,
            },
            '.hidden_secret': {
              type: 'file',
              name: '.hidden_secret',
              content: 'You found the hidden file! Great job exploring.',
              permissions: '-rw-------',
              owner: 'user',
              size: 47,
            },
          },
        },
      },
    },
    etc: {
      type: 'directory',
      name: 'etc',
      permissions: 'drwxr-xr-x',
      owner: 'root',
      children: {
        'hostname': {
          type: 'file',
          name: 'hostname',
          content: 'linux-tutorial',
          permissions: '-rw-r--r--',
          owner: 'root',
          size: 14,
        },
        'passwd': {
          type: 'file',
          name: 'passwd',
          content: 'root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000:User:/home/user:/bin/bash',
          permissions: '-rw-r--r--',
          owner: 'root',
          size: 76,
        },
      },
    },
    var: {
      type: 'directory',
      name: 'var',
      permissions: 'drwxr-xr-x',
      owner: 'root',
      children: {
        log: {
          type: 'directory',
          name: 'log',
          permissions: 'drwxr-xr-x',
          owner: 'root',
          children: {
            'syslog': {
              type: 'file',
              name: 'syslog',
              content: 'Jan 18 10:00:00 linux-tutorial kernel: System initialized\nJan 18 10:00:01 linux-tutorial systemd: Started Linux Tutorial',
              permissions: '-rw-r-----',
              owner: 'root',
              size: 120,
            },
          },
        },
      },
    },
    tmp: {
      type: 'directory',
      name: 'tmp',
      permissions: 'drwxrwxrwt',
      owner: 'root',
      children: {},
    },
    usr: {
      type: 'directory',
      name: 'usr',
      permissions: 'drwxr-xr-x',
      owner: 'root',
      children: {
        bin: {
          type: 'directory',
          name: 'bin',
          permissions: 'drwxr-xr-x',
          owner: 'root',
          children: {},
        },
        local: {
          type: 'directory',
          name: 'local',
          permissions: 'drwxr-xr-x',
          owner: 'root',
          children: {},
        },
      },
    },
  },
});

// Lessons data
const LESSONS: Lesson[] = [
  {
    id: 'navigation',
    title: 'Navigation Basics',
    description: 'Learn to navigate the file system',
    icon: <FolderOpen className="h-5 w-5" />,
    commands: [
      {
        instruction: 'First, let\'s see where we are. Print the current working directory.',
        hint: 'Use the "pwd" command (print working directory)',
        expectedCommand: 'pwd',
        explanation: 'The pwd command shows your current location in the file system. Think of it as "Where am I?"',
      },
      {
        instruction: 'Now list the contents of the current directory.',
        hint: 'Use the "ls" command (list)',
        expectedCommand: 'ls',
        explanation: 'The ls command lists files and directories. It\'s one of the most frequently used commands.',
      },
      {
        instruction: 'Let\'s see more details. List with long format to see permissions and sizes.',
        hint: 'Add the -l flag to ls',
        expectedCommand: ['ls -l', 'ls -la', 'ls -al'],
        explanation: 'The -l flag shows detailed information including permissions, owner, size, and modification date.',
      },
      {
        instruction: 'Some files are hidden (start with a dot). Show all files including hidden ones.',
        hint: 'Add the -a flag to ls',
        expectedCommand: ['ls -a', 'ls -la', 'ls -al', 'ls -all'],
        explanation: 'Hidden files in Linux start with a dot (.). The -a flag reveals them. Common examples: .bashrc, .gitignore',
      },
      {
        instruction: 'Navigate into the documents directory.',
        hint: 'Use "cd" followed by the directory name',
        expectedCommand: ['cd documents', 'cd documents/', 'cd ./documents', 'cd ./documents/'],
        explanation: 'The cd command changes your current directory. You can use relative paths (from current location) or absolute paths (from /).',
      },
      {
        instruction: 'Go back to the parent directory.',
        hint: 'Use "cd .." to go up one level',
        expectedCommand: 'cd ..',
        explanation: '".." represents the parent directory, while "." represents the current directory. These are universal in Linux.',
      },
    ],
  },
  {
    id: 'files',
    title: 'File Operations',
    description: 'Create, read, and manage files',
    icon: <FileText className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Read the contents of the readme.txt file in the documents folder.',
        hint: 'Use "cat documents/readme.txt" to display the file contents',
        expectedCommand: ['cat documents/readme.txt', 'cat ./documents/readme.txt'],
        explanation: 'The cat command concatenates and displays file contents. Great for viewing small files.',
      },
      {
        instruction: 'Create a new empty file called "myfile.txt".',
        hint: 'Use "touch myfile.txt" to create an empty file',
        expectedCommand: 'touch myfile.txt',
        explanation: 'The touch command creates empty files or updates timestamps. Often used to create placeholder files.',
      },
      {
        instruction: 'Create a new directory called "backup".',
        hint: 'Use "mkdir backup" to create a new directory',
        expectedCommand: 'mkdir backup',
        explanation: 'mkdir creates new directories. Add -p to create parent directories if they don\'t exist.',
      },
      {
        instruction: 'Copy myfile.txt to the backup directory.',
        hint: 'Use "cp myfile.txt backup/" - cp copies files from source to destination',
        expectedCommand: ['cp myfile.txt backup/', 'cp myfile.txt backup', 'cp myfile.txt ./backup/', 'cp myfile.txt ./backup'],
        explanation: 'The cp command copies files. Use -r to copy directories recursively.',
      },
      {
        instruction: 'Move the original myfile.txt to the documents folder.',
        hint: 'Use "mv myfile.txt documents/" - mv moves (or renames) files',
        expectedCommand: ['mv myfile.txt documents/', 'mv myfile.txt documents', 'mv myfile.txt ./documents/', 'mv myfile.txt ./documents'],
        explanation: 'The mv command moves files or renames them. mv file.txt newname.txt renames the file.',
      },
      {
        instruction: 'Remove the backup directory and its contents.',
        hint: 'Use "rm -r backup" - the -r flag removes directories recursively',
        expectedCommand: ['rm -r backup', 'rm -rf backup', 'rm -r backup/', 'rm -rf backup/'],
        explanation: 'rm removes files. Use -r for directories, -f to force without prompts. Be careful - there\'s no recycle bin!',
      },
    ],
  },
  {
    id: 'viewing',
    title: 'Viewing & Searching',
    description: 'View file contents and search for text',
    icon: <BookOpen className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Display the first 5 lines of /etc/passwd.',
        hint: 'Use "head -n 5 /etc/passwd" (head shows the beginning of files)',
        expectedCommand: ['head -n 5 /etc/passwd', 'head -5 /etc/passwd', 'head -n5 /etc/passwd'],
        explanation: 'head displays the beginning of files. Default is 10 lines, -n specifies how many.',
      },
      {
        instruction: 'Display the last 5 lines of /var/log/syslog.',
        hint: 'Use "tail -n 5 /var/log/syslog" (tail shows the end of files)',
        expectedCommand: ['tail -n 5 /var/log/syslog', 'tail -5 /var/log/syslog', 'tail -n5 /var/log/syslog'],
        explanation: 'tail displays the end of files. Use "tail -f" to follow a file as it grows (great for logs).',
      },
      {
        instruction: 'Search for the word "Linux" in documents/readme.txt.',
        hint: 'Use "grep Linux documents/readme.txt" (grep searches for text in files)',
        expectedCommand: ['grep Linux documents/readme.txt', 'grep "Linux" documents/readme.txt'],
        explanation: 'grep searches for text patterns in files. It\'s incredibly powerful with regular expressions.',
      },
      {
        instruction: 'Count the number of lines in projects/app.py.',
        hint: 'Use "wc -l projects/app.py" (wc = word count, -l = lines)',
        expectedCommand: ['wc -l projects/app.py', 'wc --lines projects/app.py'],
        explanation: 'wc counts lines (-l), words (-w), and characters (-c). Useful for file statistics.',
      },
      {
        instruction: 'Find all .txt files in the current directory and subdirectories.',
        hint: 'Use "find . -name \"*.txt\"" (find searches for files, . = current dir, -name = filename pattern)',
        expectedCommand: ['find . -name "*.txt"', 'find . -name *.txt', 'find . -name "*.txt" -type f'],
        explanation: 'find searches for files by name, type, size, time, and more. Extremely versatile.',
      },
    ],
  },
  {
    id: 'permissions',
    title: 'Permissions & Ownership',
    description: 'Understand and modify file permissions',
    icon: <Lock className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Check the permissions of the projects/app.py file.',
        hint: 'Use "ls -l projects/app.py" to see file details including permissions',
        expectedCommand: ['ls -l projects/app.py', 'ls -la projects/app.py'],
        explanation: 'Permissions show as rwxrwxrwx: r=read, w=write, x=execute for owner/group/others.',
      },
      {
        instruction: 'Make the projects/config.json file readable and writable by everyone.',
        hint: 'Use "chmod 666 projects/config.json" (6=rw for user, 6=rw for group, 6=rw for others)',
        expectedCommand: ['chmod 666 projects/config.json', 'chmod a+rw projects/config.json', 'chmod ugo+rw projects/config.json'],
        explanation: 'chmod changes permissions. 666 = rw-rw-rw-. Numeric: 4=read, 2=write, 1=execute.',
      },
      {
        instruction: 'Remove write permission for others from projects/config.json.',
        hint: 'Use "chmod o-w projects/config.json" (o=others, -w=remove write)',
        expectedCommand: ['chmod o-w projects/config.json', 'chmod 664 projects/config.json'],
        explanation: 'Use + to add permissions, - to remove. u=user, g=group, o=others, a=all.',
      },
      {
        instruction: 'Check who owns the /etc/hostname file.',
        hint: 'Use "ls -l /etc/hostname" - the 3rd column shows the owner',
        expectedCommand: ['ls -l /etc/hostname', 'ls -la /etc/hostname'],
        explanation: 'The owner column shows the user who owns the file. Group ownership is in the next column.',
      },
    ],
  },
  {
    id: 'system',
    title: 'System Information',
    description: 'Explore system resources and processes',
    icon: <Cpu className="h-5 w-5" />,
    commands: [
      {
        instruction: 'Display the current username.',
        hint: 'Simply type "whoami" to see who you are logged in as',
        expectedCommand: 'whoami',
        explanation: 'whoami displays the current logged-in user. Useful in scripts to check user context.',
      },
      {
        instruction: 'Show the system hostname.',
        hint: 'Simply type "hostname" to see the system name',
        expectedCommand: 'hostname',
        explanation: 'hostname shows the system\'s network name. Can also read /etc/hostname.',
      },
      {
        instruction: 'Display disk usage in human-readable format.',
        hint: 'Use "df -h" (df = disk free, -h = human readable like 1G, 500M)',
        expectedCommand: ['df -h', 'df -H', 'df --human-readable'],
        explanation: 'df shows disk space usage. -h makes sizes human-readable (KB, MB, GB).',
      },
      {
        instruction: 'Show memory usage statistics.',
        hint: 'Use "free -h" (free shows RAM usage, -h = human readable)',
        expectedCommand: ['free -h', 'free -m', 'free --human'],
        explanation: 'free displays memory usage including swap. -h for human-readable sizes.',
      },
      {
        instruction: 'Display all environment variables.',
        hint: 'Type "env" or "printenv" to list all environment variables',
        expectedCommand: ['env', 'printenv'],
        explanation: 'Environment variables configure shell behavior. Common ones: PATH, HOME, USER.',
      },
      {
        instruction: 'Print the value of the PATH environment variable.',
        hint: 'Use "echo $PATH" - the $ prefix accesses variable values',
        expectedCommand: ['echo $PATH', 'echo "$PATH"', 'printenv PATH'],
        explanation: 'PATH tells the shell where to find executable programs. Directories are separated by colons.',
      },
    ],
  },
  {
    id: 'pipes',
    title: 'Pipes & Redirection',
    description: 'Connect commands and redirect output',
    icon: <Network className="h-5 w-5" />,
    commands: [
      {
        instruction: 'List all files and pipe to grep to find only .txt files.',
        hint: 'Use "ls | grep .txt" - the | (pipe) sends ls output to grep',
        expectedCommand: ['ls -la | grep .txt', 'ls -la | grep txt', 'ls -l | grep .txt', 'ls | grep .txt', 'ls | grep txt'],
        explanation: 'The pipe (|) sends output from one command as input to another. Powerful for chaining commands.',
      },
      {
        instruction: 'Count the number of files in the current directory using ls and wc.',
        hint: 'Use "ls | wc -l" - pipe ls output to wc (word count) with -l (lines)',
        expectedCommand: ['ls | wc -l', 'ls -1 | wc -l'],
        explanation: 'Combining commands with pipes creates powerful one-liners for data processing.',
      },
      {
        instruction: 'Write "Hello, Linux!" to a new file called hello.txt using echo.',
        hint: 'Use "echo \"Hello, Linux!\" > hello.txt" - the > redirects output to a file',
        expectedCommand: ['echo "Hello, Linux!" > hello.txt', 'echo Hello, Linux! > hello.txt', "echo 'Hello, Linux!' > hello.txt"],
        explanation: '> redirects output to a file (overwrites). >> appends instead of overwriting.',
      },
      {
        instruction: 'Append "Welcome!" to the hello.txt file.',
        hint: 'Use "echo \"Welcome!\" >> hello.txt" - the >> appends without overwriting',
        expectedCommand: ['echo "Welcome!" >> hello.txt', 'echo Welcome! >> hello.txt', "echo 'Welcome!' >> hello.txt"],
        explanation: '>> appends to a file without erasing existing content. Essential for logging.',
      },
      {
        instruction: 'Display the contents of hello.txt and count the words.',
        hint: 'Use "cat hello.txt | wc -w" or simply "wc -w hello.txt"',
        expectedCommand: ['cat hello.txt | wc -w', 'wc -w hello.txt', 'wc -w < hello.txt'],
        explanation: 'You can pipe cat output or use < for input redirection. Both achieve similar results.',
      },
    ],
  },
];

export default function LinuxTerminal() {
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [currentCommandIndex, setCurrentCommandIndex] = useState(0);
  const [terminalHistory, setTerminalHistory] = useState<TerminalLine[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [currentPath, setCurrentPath] = useState('/home/user');
  const [fileSystem, setFileSystem] = useState<FileSystemNode>(createInitialFileSystem);
  const [completedCommands, setCompletedCommands] = useState<Set<string>>(new Set());
  const [showHint, setShowHint] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  const currentLesson = LESSONS[currentLessonIndex];
  const currentCommand = currentLesson?.commands[currentCommandIndex];
  const totalCommands = LESSONS.reduce((sum, lesson) => sum + lesson.commands.length, 0);
  const completedCount = completedCommands.size;
  const progressPercentage = (completedCount / totalCommands) * 100;

  // Scroll to bottom of terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalHistory]);

  // Focus input on mount and click
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Get node at path
  const getNode = useCallback((path: string): FileSystemNode | null => {
    const parts = path.split('/').filter(Boolean);
    let current: FileSystemNode = fileSystem;

    for (const part of parts) {
      if (current.type !== 'directory' || !current.children) return null;
      if (part === '..') {
        // Handle parent directory - this is simplified
        continue;
      }
      if (!current.children[part]) return null;
      current = current.children[part];
    }

    return current;
  }, [fileSystem]);

  // Resolve path
  const resolvePath = useCallback((inputPath: string): string => {
    if (inputPath.startsWith('/')) return inputPath;
    if (inputPath.startsWith('~')) return `/home/user${inputPath.slice(1)}`;

    const parts = currentPath.split('/').filter(Boolean);
    const inputParts = inputPath.split('/').filter(Boolean);

    for (const part of inputParts) {
      if (part === '..') {
        parts.pop();
      } else if (part !== '.') {
        parts.push(part);
      }
    }

    return '/' + parts.join('/');
  }, [currentPath]);

  // Execute command
  const executeCommand = useCallback((cmd: string): string => {
    const trimmed = cmd.trim();
    const parts = trimmed.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    switch (command) {
      case 'pwd':
        return currentPath;

      case 'ls': {
        const showAll = args.includes('-a') || args.includes('-la') || args.includes('-al');
        const showLong = args.includes('-l') || args.includes('-la') || args.includes('-al');
        const targetPath = args.find(a => !a.startsWith('-')) || currentPath;
        const resolved = resolvePath(targetPath);
        const node = getNode(resolved);

        if (!node) return `ls: cannot access '${targetPath}': No such file or directory`;
        if (node.type === 'file') {
          if (showLong) {
            return `${node.permissions} 1 ${node.owner} ${node.owner} ${node.size || 0} Jan 18 10:00 ${node.name}`;
          }
          return node.name;
        }

        const entries = Object.keys(node.children || {});
        const visible = showAll ? entries : entries.filter(e => !e.startsWith('.'));

        if (showLong) {
          const lines = visible.map(name => {
            const child = node.children![name];
            return `${child.permissions} 1 ${child.owner} ${child.owner} ${child.size || 4096} Jan 18 10:00 ${name}`;
          });
          return `total ${visible.length}\n` + lines.join('\n');
        }

        return visible.join('  ');
      }

      case 'cd': {
        const target = args[0] || '/home/user';
        const resolved = resolvePath(target);
        const node = getNode(resolved);

        if (!node) return `cd: ${target}: No such file or directory`;
        if (node.type !== 'directory') return `cd: ${target}: Not a directory`;

        setCurrentPath(resolved);
        return '';
      }

      case 'cat': {
        if (!args[0]) return 'cat: missing operand';
        const resolved = resolvePath(args[0]);
        const node = getNode(resolved);

        if (!node) return `cat: ${args[0]}: No such file or directory`;
        if (node.type === 'directory') return `cat: ${args[0]}: Is a directory`;

        return node.content || '';
      }

      case 'touch': {
        if (!args[0]) return 'touch: missing file operand';
        const fileName = args[0];
        const dirPath = currentPath;
        const dirNode = getNode(dirPath);

        if (dirNode && dirNode.type === 'directory' && dirNode.children) {
          setFileSystem(prev => {
            const newFs = JSON.parse(JSON.stringify(prev));
            const parts = dirPath.split('/').filter(Boolean);
            let current = newFs;
            for (const part of parts) {
              current = current.children[part];
            }
            current.children[fileName] = {
              type: 'file',
              name: fileName,
              content: '',
              permissions: '-rw-r--r--',
              owner: 'user',
              size: 0,
            };
            return newFs;
          });
          return '';
        }
        return `touch: cannot touch '${fileName}': No such file or directory`;
      }

      case 'mkdir': {
        if (!args[0]) return 'mkdir: missing operand';
        const dirName = args[0];
        const parentPath = currentPath;
        const parentNode = getNode(parentPath);

        if (parentNode && parentNode.type === 'directory' && parentNode.children) {
          if (parentNode.children[dirName]) {
            return `mkdir: cannot create directory '${dirName}': File exists`;
          }
          setFileSystem(prev => {
            const newFs = JSON.parse(JSON.stringify(prev));
            const parts = parentPath.split('/').filter(Boolean);
            let current = newFs;
            for (const part of parts) {
              current = current.children[part];
            }
            current.children[dirName] = {
              type: 'directory',
              name: dirName,
              permissions: 'drwxr-xr-x',
              owner: 'user',
              children: {},
            };
            return newFs;
          });
          return '';
        }
        return `mkdir: cannot create directory '${dirName}'`;
      }

      case 'cp': {
        if (args.length < 2) return 'cp: missing destination file operand';
        const source = resolvePath(args[0]);
        let dest = args[1].endsWith('/') ? args[1] : args[1];
        const sourceNode = getNode(source);

        if (!sourceNode) return `cp: cannot stat '${args[0]}': No such file or directory`;
        if (sourceNode.type === 'directory' && !args.includes('-r')) {
          return `cp: -r not specified; omitting directory '${args[0]}'`;
        }

        // Simplified copy
        const destPath = resolvePath(dest.replace(/\/$/, ''));
        const destNode = getNode(destPath);

        if (destNode && destNode.type === 'directory') {
          setFileSystem(prev => {
            const newFs = JSON.parse(JSON.stringify(prev));
            const parts = destPath.split('/').filter(Boolean);
            let current = newFs;
            for (const part of parts) {
              current = current.children[part];
            }
            current.children[sourceNode.name] = JSON.parse(JSON.stringify(sourceNode));
            return newFs;
          });
          return '';
        }
        return '';
      }

      case 'mv': {
        if (args.length < 2) return 'mv: missing destination file operand';
        const source = resolvePath(args[0]);
        const sourceNode = getNode(source);

        if (!sourceNode) return `mv: cannot stat '${args[0]}': No such file or directory`;

        const destPath = resolvePath(args[1].replace(/\/$/, ''));
        const destNode = getNode(destPath);

        // Get source parent
        const sourceParts = source.split('/').filter(Boolean);
        const sourceFileName = sourceParts.pop();
        const sourceParentPath = '/' + sourceParts.join('/');

        if (destNode && destNode.type === 'directory') {
          setFileSystem(prev => {
            const newFs = JSON.parse(JSON.stringify(prev));
            // Add to destination
            const destParts = destPath.split('/').filter(Boolean);
            let destCurrent = newFs;
            for (const part of destParts) {
              destCurrent = destCurrent.children[part];
            }
            destCurrent.children[sourceNode.name] = JSON.parse(JSON.stringify(sourceNode));

            // Remove from source parent
            let srcParent = newFs;
            for (const part of sourceParts) {
              srcParent = srcParent.children[part];
            }
            delete srcParent.children[sourceFileName!];

            return newFs;
          });
          return '';
        }
        return '';
      }

      case 'rm': {
        const recursive = args.includes('-r') || args.includes('-rf');
        const target = args.find(a => !a.startsWith('-'));

        if (!target) return 'rm: missing operand';

        const resolved = resolvePath(target.replace(/\/$/, ''));
        const node = getNode(resolved);

        if (!node) return `rm: cannot remove '${target}': No such file or directory`;
        if (node.type === 'directory' && !recursive) {
          return `rm: cannot remove '${target}': Is a directory`;
        }

        const parts = resolved.split('/').filter(Boolean);
        const fileName = parts.pop();
        const parentPath = '/' + parts.join('/');

        setFileSystem(prev => {
          const newFs = JSON.parse(JSON.stringify(prev));
          let parent = newFs;
          for (const part of parts) {
            parent = parent.children[part];
          }
          delete parent.children[fileName!];
          return newFs;
        });
        return '';
      }

      case 'head': {
        const nFlag = args.find(a => a.startsWith('-n') || a.startsWith('-'));
        const lines = nFlag ? parseInt(nFlag.replace('-n', '').replace('-', '')) || 10 : 10;
        const file = args.find(a => !a.startsWith('-'));

        if (!file) return 'head: missing file operand';
        const resolved = resolvePath(file);
        const node = getNode(resolved);

        if (!node) return `head: cannot open '${file}': No such file or directory`;
        if (node.type === 'directory') return `head: error reading '${file}': Is a directory`;

        const content = node.content || '';
        return content.split('\n').slice(0, lines).join('\n');
      }

      case 'tail': {
        const nFlag = args.find(a => a.startsWith('-n') || a.startsWith('-'));
        const lines = nFlag ? parseInt(nFlag.replace('-n', '').replace('-', '')) || 10 : 10;
        const file = args.find(a => !a.startsWith('-'));

        if (!file) return 'tail: missing file operand';
        const resolved = resolvePath(file);
        const node = getNode(resolved);

        if (!node) return `tail: cannot open '${file}': No such file or directory`;
        if (node.type === 'directory') return `tail: error reading '${file}': Is a directory`;

        const content = node.content || '';
        return content.split('\n').slice(-lines).join('\n');
      }

      case 'grep': {
        const pattern = args[0];
        const file = args[1];

        if (!pattern) return 'grep: missing pattern';
        if (!file) return 'grep: missing file operand';

        const resolved = resolvePath(file);
        const node = getNode(resolved);

        if (!node) return `grep: ${file}: No such file or directory`;
        if (node.type === 'directory') return `grep: ${file}: Is a directory`;

        const content = node.content || '';
        const matches = content.split('\n').filter(line =>
          line.toLowerCase().includes(pattern.replace(/"/g, '').toLowerCase())
        );
        return matches.join('\n') || '';
      }

      case 'wc': {
        const countLines = args.includes('-l') || args.includes('--lines');
        const countWords = args.includes('-w') || args.includes('--words');
        const file = args.find(a => !a.startsWith('-'));

        if (!file) return 'wc: missing file operand';
        const resolved = resolvePath(file);
        const node = getNode(resolved);

        if (!node) return `wc: ${file}: No such file or directory`;
        if (node.type === 'directory') return `wc: ${file}: Is a directory`;

        const content = node.content || '';
        const lines = content.split('\n').length;
        const words = content.split(/\s+/).filter(Boolean).length;
        const chars = content.length;

        if (countLines) return `${lines} ${file}`;
        if (countWords) return `${words} ${file}`;
        return `${lines} ${words} ${chars} ${file}`;
      }

      case 'find': {
        const nameFlag = args.indexOf('-name');
        const pattern = nameFlag !== -1 ? args[nameFlag + 1]?.replace(/"/g, '') : null;
        const startPath = args[0] === '.' ? currentPath : resolvePath(args[0] || '.');

        const results: string[] = [];

        const search = (node: FileSystemNode, path: string) => {
          if (pattern) {
            const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
            if (regex.test(node.name)) {
              results.push(path);
            }
          } else {
            results.push(path);
          }
          if (node.type === 'directory' && node.children) {
            Object.entries(node.children).forEach(([name, child]) => {
              search(child, `${path}/${name}`);
            });
          }
        };

        const startNode = getNode(startPath);
        if (startNode) {
          search(startNode, '.');
        }

        return results.join('\n');
      }

      case 'chmod': {
        const mode = args[0];
        const file = args[1];

        if (!mode || !file) return 'chmod: missing operand';
        const resolved = resolvePath(file);
        const node = getNode(resolved);

        if (!node) return `chmod: cannot access '${file}': No such file or directory`;

        // Update permissions (simplified)
        const parts = resolved.split('/').filter(Boolean);
        const fileName = parts.pop();

        setFileSystem(prev => {
          const newFs = JSON.parse(JSON.stringify(prev));
          let parent = newFs;
          for (const part of parts) {
            parent = parent.children[part];
          }

          // Simple permission update based on numeric mode
          if (/^\d{3}$/.test(mode)) {
            const perms = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
            const [u, g, o] = mode.split('').map(Number);
            const prefix = parent.children[fileName!].type === 'directory' ? 'd' : '-';
            parent.children[fileName!].permissions = prefix + perms[u] + perms[g] + perms[o];
          } else if (mode.includes('o-w')) {
            const current = parent.children[fileName!].permissions || '-rw-rw-rw-';
            parent.children[fileName!].permissions = current.slice(0, -2) + 'r-';
          } else if (mode.includes('a+rw') || mode.includes('ugo+rw')) {
            const prefix = parent.children[fileName!].type === 'directory' ? 'd' : '-';
            parent.children[fileName!].permissions = prefix + 'rw-rw-rw-';
          }

          return newFs;
        });
        return '';
      }

      case 'whoami':
        return 'user';

      case 'hostname':
        return 'linux-tutorial';

      case 'df': {
        if (args.includes('-h') || args.includes('-H') || args.includes('--human-readable')) {
          return `Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        50G   12G   35G  26% /
tmpfs           2.0G     0  2.0G   0% /dev/shm
/dev/sda2       100G   45G   50G  48% /home`;
        }
        return `Filesystem     1K-blocks     Used Available Use% Mounted on
/dev/sda1       52428800 12582912  36700160  26% /
tmpfs            2097152        0   2097152   0% /dev/shm
/dev/sda2      104857600 47185920  52428800  48% /home`;
      }

      case 'free': {
        if (args.includes('-h') || args.includes('-m') || args.includes('--human')) {
          return `              total        used        free      shared  buff/cache   available
Mem:          7.8Gi       2.1Gi       3.5Gi       256Mi       2.2Gi       5.2Gi
Swap:         2.0Gi          0B       2.0Gi`;
        }
        return `              total        used        free      shared  buff/cache   available
Mem:        8169472     2202624     3670016      262144     2296832     5439488
Swap:       2097152           0     2097152`;
      }

      case 'env':
      case 'printenv': {
        const varName = args[0];
        const envVars: Record<string, string> = {
          USER: 'user',
          HOME: '/home/user',
          PATH: '/usr/local/bin:/usr/bin:/bin',
          SHELL: '/bin/bash',
          TERM: 'xterm-256color',
          LANG: 'en_US.UTF-8',
          PWD: currentPath,
        };

        if (varName) {
          return envVars[varName] || '';
        }

        return Object.entries(envVars).map(([k, v]) => `${k}=${v}`).join('\n');
      }

      case 'echo': {
        const text = args.join(' ').replace(/"/g, '').replace(/'/g, '');

        // Handle variable expansion
        const expanded = text.replace(/\$([A-Z_]+)/g, (_, varName) => {
          const vars: Record<string, string> = {
            PATH: '/usr/local/bin:/usr/bin:/bin',
            HOME: '/home/user',
            USER: 'user',
            PWD: currentPath,
          };
          return vars[varName] || '';
        });

        // Handle redirection
        const redirectIndex = args.indexOf('>');
        const appendIndex = args.indexOf('>>');

        if (appendIndex !== -1) {
          const content = args.slice(0, appendIndex).join(' ').replace(/"/g, '').replace(/'/g, '');
          const fileName = args[appendIndex + 1];
          const resolved = resolvePath(fileName);
          const node = getNode(resolved);

          if (node && node.type === 'file') {
            const parts = resolved.split('/').filter(Boolean);
            const fName = parts.pop();

            setFileSystem(prev => {
              const newFs = JSON.parse(JSON.stringify(prev));
              let parent = newFs;
              for (const part of parts) {
                parent = parent.children[part];
              }
              parent.children[fName!].content = (parent.children[fName!].content || '') + '\n' + content;
              parent.children[fName!].size = parent.children[fName!].content.length;
              return newFs;
            });
          }
          return '';
        } else if (redirectIndex !== -1) {
          const content = args.slice(0, redirectIndex).join(' ').replace(/"/g, '').replace(/'/g, '');
          const fileName = args[redirectIndex + 1];

          const parts = currentPath.split('/').filter(Boolean);

          setFileSystem(prev => {
            const newFs = JSON.parse(JSON.stringify(prev));
            let parent = newFs;
            for (const part of parts) {
              parent = parent.children[part];
            }
            parent.children[fileName] = {
              type: 'file',
              name: fileName,
              content: content,
              permissions: '-rw-r--r--',
              owner: 'user',
              size: content.length,
            };
            return newFs;
          });
          return '';
        }

        return expanded;
      }

      case 'clear':
        setTerminalHistory([]);
        return '';

      case 'help':
        return `Available commands:
  pwd     - Print working directory
  ls      - List directory contents
  cd      - Change directory
  cat     - Display file contents
  touch   - Create empty file
  mkdir   - Create directory
  cp      - Copy files
  mv      - Move/rename files
  rm      - Remove files
  head    - Display first lines
  tail    - Display last lines
  grep    - Search for patterns
  wc      - Word/line count
  find    - Find files
  chmod   - Change permissions
  whoami  - Display current user
  hostname - Display hostname
  df      - Disk free space
  free    - Memory usage
  env     - Environment variables
  echo    - Print text
  clear   - Clear terminal`;

      default:
        return `${command}: command not found`;
    }
  }, [currentPath, fileSystem, getNode, resolvePath]);

  // Handle pipe commands
  const executePipedCommand = useCallback((cmd: string): string => {
    const pipes = cmd.split('|').map(c => c.trim());

    let output = '';
    for (let i = 0; i < pipes.length; i++) {
      const pipeCmd = pipes[i];

      if (i === 0) {
        output = executeCommand(pipeCmd);
      } else {
        // For piped commands, we simulate by parsing the output
        const parts = pipeCmd.split(/\s+/);
        const pipedCommand = parts[0];
        const pipedArgs = parts.slice(1);

        switch (pipedCommand) {
          case 'grep': {
            const pattern = pipedArgs[0]?.replace(/"/g, '').toLowerCase();
            if (pattern) {
              output = output.split('\n').filter(line =>
                line.toLowerCase().includes(pattern)
              ).join('\n');
            }
            break;
          }
          case 'wc': {
            if (pipedArgs.includes('-l')) {
              output = String(output.split('\n').filter(Boolean).length);
            } else if (pipedArgs.includes('-w')) {
              output = String(output.split(/\s+/).filter(Boolean).length);
            } else {
              const lines = output.split('\n').length;
              const words = output.split(/\s+/).filter(Boolean).length;
              const chars = output.length;
              output = `${lines} ${words} ${chars}`;
            }
            break;
          }
          case 'head': {
            const nFlag = pipedArgs.find(a => a.startsWith('-n') || a.startsWith('-'));
            const lines = nFlag ? parseInt(nFlag.replace('-n', '').replace('-', '')) || 10 : 10;
            output = output.split('\n').slice(0, lines).join('\n');
            break;
          }
          case 'tail': {
            const nFlag = pipedArgs.find(a => a.startsWith('-n') || a.startsWith('-'));
            const lines = nFlag ? parseInt(nFlag.replace('-n', '').replace('-', '')) || 10 : 10;
            output = output.split('\n').slice(-lines).join('\n');
            break;
          }
          default:
            break;
        }
      }
    }

    return output;
  }, [executeCommand]);

  // Check if command matches expected
  const checkCommand = useCallback((cmd: string): boolean => {
    if (!currentCommand) return false;

    const trimmed = cmd.trim();
    const expected = currentCommand.expectedCommand;

    if (Array.isArray(expected)) {
      return expected.some(e => trimmed === e || trimmed.replace(/\s+/g, ' ') === e.replace(/\s+/g, ' '));
    }

    return trimmed === expected || trimmed.replace(/\s+/g, ' ') === expected.replace(/\s+/g, ' ');
  }, [currentCommand]);

  // Handle command submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const cmd = inputValue.trim();

    // Add to command history
    setCommandHistory(prev => [...prev, cmd]);
    setHistoryIndex(-1);

    // Add input line to terminal
    setTerminalHistory(prev => [
      ...prev,
      { type: 'input', content: cmd, timestamp: new Date() },
    ]);

    // Execute command and get output
    const output = cmd.includes('|') ? executePipedCommand(cmd) : executeCommand(cmd);

    if (output) {
      setTerminalHistory(prev => [
        ...prev,
        { type: 'output', content: output, timestamp: new Date() },
      ]);
    }

    // Check if command is correct for the lesson
    if (currentCommand && checkCommand(cmd)) {
      const commandId = `${currentLesson.id}-${currentCommandIndex}`;
      setCompletedCommands(prev => new Set([...prev, commandId]));

      setTerminalHistory(prev => [
        ...prev,
        { type: 'success', content: `✓ ${currentCommand.explanation}`, timestamp: new Date() },
      ]);

      setShowHint(false);

      // Move to next command
      if (currentCommandIndex < currentLesson.commands.length - 1) {
        setCurrentCommandIndex(currentCommandIndex + 1);
      } else if (currentLessonIndex < LESSONS.length - 1) {
        // Move to next lesson
        setCurrentLessonIndex(currentLessonIndex + 1);
        setCurrentCommandIndex(0);
      }
    }

    setInputValue('');
  }, [inputValue, executeCommand, executePipedCommand, checkCommand, currentCommand, currentLesson, currentCommandIndex, currentLessonIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ctrl+C - cancel current input
    if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      if (inputValue.trim()) {
        setTerminalHistory(prev => [
          ...prev,
          { type: 'input', content: `$ ${inputValue}^C`, timestamp: new Date() }
        ]);
      } else {
        setTerminalHistory(prev => [
          ...prev,
          { type: 'output', content: '^C', timestamp: new Date() }
        ]);
      }
      setInputValue('');
      setHistoryIndex(-1);
      return;
    }

    // Tab - autocomplete
    if (e.key === 'Tab') {
      e.preventDefault();
      
      const parts = inputValue.trimStart().split(/\s+/);
      const isTypingCommand = parts.length === 1;
      const partialInput = parts[parts.length - 1] || '';
      
      // Available commands
      const AVAILABLE_COMMANDS = [
        'pwd', 'ls', 'cd', 'cat', 'touch', 'mkdir', 'cp', 'mv', 'rm',
        'head', 'tail', 'grep', 'wc', 'find', 'chmod', 'whoami', 'hostname',
        'df', 'free', 'env', 'printenv', 'echo', 'clear', 'help'
      ];
      
      if (isTypingCommand) {
        // Autocomplete command
        const matches = AVAILABLE_COMMANDS.filter(cmd => 
          cmd.startsWith(partialInput.toLowerCase())
        );
        
        if (matches.length === 1) {
          setInputValue(matches[0] + ' ');
        } else if (matches.length > 1) {
          // Show available completions
          setTerminalHistory(prev => [
            ...prev,
            { type: 'input', content: `$ ${inputValue}`, timestamp: new Date() },
            { type: 'output', content: matches.join('  '), timestamp: new Date() }
          ]);
        }
      } else {
        // Autocomplete path/file
        const prefix = parts.slice(0, -1).join(' ');
        let dirPath = currentPath;
        let searchPrefix = partialInput;
        
        // Handle path with directory component
        if (partialInput.includes('/')) {
          const lastSlash = partialInput.lastIndexOf('/');
          const pathPart = partialInput.slice(0, lastSlash) || '/';
          searchPrefix = partialInput.slice(lastSlash + 1);
          
          // Resolve the directory path
          if (pathPart.startsWith('/')) {
            dirPath = pathPart;
          } else if (pathPart.startsWith('~')) {
            dirPath = `/home/user${pathPart.slice(1)}`;
          } else {
            const pathParts = currentPath.split('/').filter(Boolean);
            const inputParts = pathPart.split('/').filter(Boolean);
            for (const part of inputParts) {
              if (part === '..') {
                pathParts.pop();
              } else if (part !== '.') {
                pathParts.push(part);
              }
            }
            dirPath = '/' + pathParts.join('/');
          }
        }
        
        // Get directory contents
        const node = getNode(dirPath);
        if (node && node.type === 'directory' && node.children) {
          const matches = Object.keys(node.children).filter(name =>
            name.startsWith(searchPrefix)
          ).map(name => {
            const child = node.children![name];
            return child.type === 'directory' ? name + '/' : name;
          });
          
          if (matches.length === 1) {
            // Reconstruct the path
            let completedPath = matches[0];
            if (partialInput.includes('/')) {
              const lastSlash = partialInput.lastIndexOf('/');
              completedPath = partialInput.slice(0, lastSlash + 1) + matches[0];
            }
            setInputValue(prefix + ' ' + completedPath);
          } else if (matches.length > 1) {
            // Find common prefix for partial completion
            let commonPrefix = matches[0];
            for (const match of matches) {
              while (!match.startsWith(commonPrefix)) {
                commonPrefix = commonPrefix.slice(0, -1);
              }
            }
            
            if (commonPrefix.length > searchPrefix.length) {
              // Complete to common prefix
              let completedPath = commonPrefix;
              if (partialInput.includes('/')) {
                const lastSlash = partialInput.lastIndexOf('/');
                completedPath = partialInput.slice(0, lastSlash + 1) + commonPrefix;
              }
              setInputValue(prefix + ' ' + completedPath);
            } else {
              // Show available completions
              setTerminalHistory(prev => [
                ...prev,
                { type: 'input', content: `$ ${inputValue}`, timestamp: new Date() },
                { type: 'output', content: matches.join('  '), timestamp: new Date() }
              ]);
            }
          }
        }
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputValue('');
      }
    }
  }, [commandHistory, historyIndex, inputValue, currentPath, getNode]);

  // Reset all progress
  const resetProgress = useCallback(() => {
    setCurrentLessonIndex(0);
    setCurrentCommandIndex(0);
    setTerminalHistory([]);
    setCompletedCommands(new Set());
    setCurrentPath('/home/user');
    setFileSystem(createInitialFileSystem());
    setShowHint(false);
  }, []);

  // Jump to specific lesson
  const jumpToLesson = useCallback((index: number) => {
    setCurrentLessonIndex(index);
    setCurrentCommandIndex(0);
    setShowHint(false);
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Terminal className="h-10 w-10 text-green-500" />
          <h1 className="text-3xl md:text-4xl font-bold">Learn Linux</h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Master essential Linux commands through interactive lessons.
          Type commands in the terminal and watch them execute in real-time.
        </p>
      </div>

      {/* Progress Bar */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <span className="font-medium">Progress</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {completedCount}/{totalCommands} commands completed
            </span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
          {progressPercentage === 100 && (
            <p className="mt-2 text-center text-green-600 font-medium">
              🎉 Congratulations! You've completed all lessons!
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lessons Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Lessons
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {LESSONS.map((lesson, index) => {
              const lessonCompletedCount = lesson.commands.filter((_, cmdIndex) =>
                completedCommands.has(`${lesson.id}-${cmdIndex}`)
              ).length;
              const isComplete = lessonCompletedCount === lesson.commands.length;
              const isCurrent = index === currentLessonIndex;

              return (
                <button
                  key={lesson.id}
                  onClick={() => jumpToLesson(index)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    isCurrent
                      ? 'bg-primary/10 border-2 border-primary'
                      : 'hover:bg-muted border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isComplete ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        lesson.icon
                      )}
                      <span className="font-medium">{lesson.title}</span>
                    </div>
                    <Badge variant={isComplete ? 'default' : 'secondary'}>
                      {lessonCompletedCount}/{lesson.commands.length}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 pl-7">
                    {lesson.description}
                  </p>
                </button>
              );
            })}

            <Button
              variant="outline"
              onClick={resetProgress}
              className="w-full mt-4"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset All Progress
            </Button>
          </CardContent>
        </Card>

        {/* Terminal and Current Task */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Task Card */}
          {currentCommand && (
            <Card className="border-primary/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ChevronRight className="h-5 w-5 text-primary" />
                    Current Task
                  </CardTitle>
                  <Badge>
                    Step {currentCommandIndex + 1}/{currentLesson.commands.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-lg mb-4">{currentCommand.instruction}</p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHint(!showHint)}
                    className="text-muted-foreground"
                  >
                    <Lightbulb className="h-4 w-4 mr-1" />
                    {showHint ? 'Hide Hint' : 'Show Hint'}
                  </Button>
                </div>
                {showHint && (
                  <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      💡 {currentCommand.hint}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Terminal */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="pb-2 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-sm text-gray-400 ml-2">
                  user@linux-tutorial: {currentPath}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div
                ref={terminalRef}
                onClick={() => inputRef.current?.focus()}
                className="h-80 overflow-y-auto p-4 font-mono text-sm cursor-text"
              >
                {/* Welcome message */}
                {terminalHistory.length === 0 && (
                  <div className="text-green-400 mb-4">
                    <p>Welcome to the Linux Terminal Tutorial!</p>
                    <p className="text-gray-500 mt-2">
                      Type "help" for available commands. Follow the instructions on the left.
                    </p>
                  </div>
                )}

                {/* Terminal history */}
                {terminalHistory.map((line, index) => (
                  <div
                    key={index}
                    className={`mb-1 ${
                      line.type === 'input'
                        ? 'text-white'
                        : line.type === 'error'
                          ? 'text-red-400'
                          : line.type === 'success'
                            ? 'text-green-400 bg-green-900/30 p-2 rounded my-2'
                            : 'text-gray-300'
                    }`}
                  >
                    {line.type === 'input' && (
                      <span className="text-green-400">$ </span>
                    )}
                    <span className="whitespace-pre-wrap">{line.content}</span>
                  </div>
                ))}

                {/* Input line */}
                <form onSubmit={handleSubmit} className="flex items-center">
                  <span className="text-green-400">$ </span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 bg-transparent text-white outline-none ml-1 caret-green-400"
                    spellCheck={false}
                    autoComplete="off"
                    autoCapitalize="off"
                  />
                </form>
              </div>
            </CardContent>
          </Card>

          {/* Quick Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div className="p-2 rounded bg-muted">
                  <code className="text-primary">pwd</code>
                  <p className="text-muted-foreground text-xs mt-1">Print directory</p>
                </div>
                <div className="p-2 rounded bg-muted">
                  <code className="text-primary">ls</code>
                  <p className="text-muted-foreground text-xs mt-1">List files</p>
                </div>
                <div className="p-2 rounded bg-muted">
                  <code className="text-primary">cd [dir]</code>
                  <p className="text-muted-foreground text-xs mt-1">Change directory</p>
                </div>
                <div className="p-2 rounded bg-muted">
                  <code className="text-primary">cat [file]</code>
                  <p className="text-muted-foreground text-xs mt-1">View file</p>
                </div>
                <div className="p-2 rounded bg-muted">
                  <code className="text-primary">grep [text] [file]</code>
                  <p className="text-muted-foreground text-xs mt-1">Search text</p>
                </div>
                <div className="p-2 rounded bg-muted">
                  <code className="text-primary">help</code>
                  <p className="text-muted-foreground text-xs mt-1">All commands</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
