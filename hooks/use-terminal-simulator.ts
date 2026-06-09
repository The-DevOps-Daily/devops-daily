'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Shared lesson/terminal engine for the terminal-style simulators (Docker,
 * Kubernetes, Linux, Git). Owns the mechanics every simulator had copied:
 * terminal history, input state, command history navigation, optional Tab
 * completion, hint visibility, lesson/command progression, completion
 * tracking, auto-scroll, and focus.
 *
 * Domain behavior stays in the component: `execute` runs a command against
 * the simulator's own state and returns the output, `matches` decides
 * whether the input satisfies the current lesson step.
 *
 * The option flags encode user-visible differences that existed between the
 * simulators before consolidation (success-line format, history navigation
 * style, advance delay). They are kept so the refactor doesn't change any
 * simulator's behavior; collapsing them to one style is a separate decision.
 */

export type TerminalLineType = 'input' | 'output' | 'error' | 'success';

export interface TerminalLine {
  type: TerminalLineType;
  content: string;
  timestamp: Date;
}

export interface SimulatorLessonCommand {
  expectedCommand: string | string[];
  explanation: string;
}

export interface SimulatorLesson<C extends SimulatorLessonCommand = SimulatorLessonCommand> {
  id: string;
  commands: C[];
}

export interface ExecuteResult {
  output: string;
  type?: TerminalLineType;
  /** True when the command (e.g. `clear`) should wipe the terminal. */
  clear?: boolean;
}

export interface UseTerminalSimulatorOptions<C extends SimulatorLessonCommand> {
  lessons: SimulatorLesson<C>[];
  /** Run a command against the simulator's domain state. */
  execute: (cmd: string) => ExecuteResult;
  /** Does this input satisfy the current lesson command? */
  matches: (cmd: string, command: C) => boolean;
  /** Success line appended when a lesson command is completed. */
  successMessage: (command: C) => string;
  /** How completedCommands entries are keyed. 'lesson-id' = `${lesson.id}-${cmdIdx}`, 'index' = `${lessonIdx}-${cmdIdx}`. */
  completionKeyStyle?: 'lesson-id' | 'index';
  /** Delay before advancing to the next command/lesson (K8s/Git use 700ms). */
  advanceDelayMs?: number;
  /** 'append' walks history oldest-first from the end; 'recent-first' dedupes, caps at 20, walks from the start. */
  historyStyle?: 'append' | 'recent-first';
  /** Render the command's own output line as 'success' when it completes a step. */
  promoteOutputType?: boolean;
  /** Skip the success path when the step was already completed. */
  guardRepeatCompletion?: boolean;
  /** Enables Tab completion against this list. Components with richer completion (Linux's filesystem-aware paths) leave this unset and intercept Tab before delegating other keys to handleKeyDown. */
  availableCommands?: string[];
  /** Prefix shown before the echoed input on Ctrl+C (Linux shows '$ '). */
  ctrlCInputPrefix?: string;
  /** Reset domain state (containers, filesystem, cluster...) alongside progress. */
  onReset?: () => void;
}

export function useTerminalSimulator<C extends SimulatorLessonCommand>({
  lessons,
  execute,
  matches,
  successMessage,
  completionKeyStyle = 'lesson-id',
  advanceDelayMs = 0,
  historyStyle = 'append',
  promoteOutputType = false,
  guardRepeatCompletion = false,
  availableCommands,
  ctrlCInputPrefix = '',
  onReset,
}: UseTerminalSimulatorOptions<C>) {
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [currentCommandIndex, setCurrentCommandIndex] = useState(0);
  const [terminalHistory, setTerminalHistory] = useState<TerminalLine[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [completedCommands, setCompletedCommands] = useState<Set<string>>(new Set());
  const [showHint, setShowHint] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  const currentLesson = lessons[currentLessonIndex];
  const currentCommand = currentLesson?.commands[currentCommandIndex];
  const totalCommands = lessons.reduce((sum, lesson) => sum + lesson.commands.length, 0);
  const completedCount = completedCommands.size;
  const progressPercentage = totalCommands > 0 ? (completedCount / totalCommands) * 100 : 0;

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalHistory]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const completionKey = useCallback(
    (lessonIndex: number, commandIndex: number) =>
      completionKeyStyle === 'lesson-id'
        ? `${lessons[lessonIndex].id}-${commandIndex}`
        : `${lessonIndex}-${commandIndex}`,
    [completionKeyStyle, lessons]
  );

  const advance = useCallback(() => {
    setCurrentCommandIndex((commandIndex) => {
      if (currentLesson && commandIndex < currentLesson.commands.length - 1) {
        return commandIndex + 1;
      }
      if (currentLessonIndex < lessons.length - 1) {
        setCurrentLessonIndex(currentLessonIndex + 1);
        return 0;
      }
      return commandIndex;
    });
    setShowHint(false);
  }, [currentLesson, currentLessonIndex, lessons.length]);

  const submitCommand = useCallback(
    (raw: string) => {
      if (!raw.trim()) return;
      const cmd = raw.trim();

      setCommandHistory((prev) =>
        historyStyle === 'recent-first'
          ? [cmd, ...prev.filter((item) => item !== cmd)].slice(0, 20)
          : [...prev, cmd]
      );
      setHistoryIndex(-1);
      setInputValue('');

      const result = execute(cmd);
      const key = completionKey(currentLessonIndex, currentCommandIndex);
      const isExpected =
        !!currentCommand &&
        matches(cmd, currentCommand) &&
        !(guardRepeatCompletion && completedCommands.has(key));

      if (result.clear) {
        setTerminalHistory([]);
        return;
      }

      let outputType: TerminalLineType = result.type ?? 'output';
      if (isExpected && promoteOutputType && outputType !== 'error') {
        outputType = 'success';
      }

      setTerminalHistory((prev) => [
        ...prev,
        { type: 'input', content: cmd, timestamp: new Date() },
        ...(result.output ? [{ type: outputType, content: result.output, timestamp: new Date() }] : []),
        ...(isExpected && currentCommand
          ? [
              {
                type: 'success' as const,
                content: successMessage(currentCommand),
                timestamp: new Date(),
              },
            ]
          : []),
      ]);

      if (isExpected) {
        setCompletedCommands((prev) => new Set(prev).add(key));
        if (advanceDelayMs > 0) {
          setTimeout(advance, advanceDelayMs);
        } else {
          advance();
        }
      }
    },
    [
      advance,
      advanceDelayMs,
      completedCommands,
      completionKey,
      currentCommand,
      currentCommandIndex,
      currentLessonIndex,
      execute,
      guardRepeatCompletion,
      historyStyle,
      matches,
      promoteOutputType,
      successMessage,
    ]
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      submitCommand(inputValue);
    },
    [inputValue, submitCommand]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.ctrlKey && event.key === 'c') {
        event.preventDefault();
        setTerminalHistory((prev) => [
          ...prev,
          {
            type: inputValue.trim() ? 'input' : 'output',
            content: inputValue.trim() ? `${ctrlCInputPrefix}${inputValue}^C` : '^C',
            timestamp: new Date(),
          },
        ]);
        setInputValue('');
        setHistoryIndex(-1);
        return;
      }

      if (availableCommands && event.key === 'Tab') {
        event.preventDefault();
        const matchesList = availableCommands.filter((command) => command.startsWith(inputValue));
        if (matchesList.length === 1) {
          setInputValue(`${matchesList[0]} `);
        } else if (matchesList.length > 1) {
          setTerminalHistory((prev) => [
            ...prev,
            { type: 'input', content: inputValue, timestamp: new Date() },
            { type: 'output', content: matchesList.join('  '), timestamp: new Date() },
          ]);
        }
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (historyStyle === 'recent-first') {
          const nextIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
          if (nextIndex >= 0) {
            setHistoryIndex(nextIndex);
            setInputValue(commandHistory[nextIndex]);
          }
        } else if (historyIndex < commandHistory.length - 1) {
          const nextIndex = historyIndex + 1;
          setHistoryIndex(nextIndex);
          setInputValue(commandHistory[commandHistory.length - 1 - nextIndex]);
        }
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (historyStyle === 'recent-first') {
          const nextIndex = Math.max(historyIndex - 1, -1);
          setHistoryIndex(nextIndex);
          setInputValue(nextIndex >= 0 ? commandHistory[nextIndex] : '');
        } else if (historyIndex > 0) {
          const nextIndex = historyIndex - 1;
          setHistoryIndex(nextIndex);
          setInputValue(commandHistory[commandHistory.length - 1 - nextIndex]);
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setInputValue('');
        }
      }
    },
    [availableCommands, commandHistory, ctrlCInputPrefix, historyIndex, historyStyle, inputValue]
  );

  const resetProgress = useCallback(() => {
    setCurrentLessonIndex(0);
    setCurrentCommandIndex(0);
    setTerminalHistory([]);
    setCompletedCommands(new Set());
    setShowHint(false);
    setInputValue('');
    setCommandHistory([]);
    setHistoryIndex(-1);
    onReset?.();
  }, [onReset]);

  const jumpToLesson = useCallback((index: number) => {
    setCurrentLessonIndex(index);
    setCurrentCommandIndex(0);
    setShowHint(false);
  }, []);

  return {
    // progression
    currentLessonIndex,
    currentCommandIndex,
    currentLesson,
    currentCommand,
    completedCommands,
    completedCount,
    totalCommands,
    progressPercentage,
    // terminal
    terminalHistory,
    setTerminalHistory,
    inputValue,
    setInputValue,
    commandHistory,
    showHint,
    setShowHint,
    inputRef,
    terminalRef,
    // actions
    submitCommand,
    handleSubmit,
    handleKeyDown,
    resetProgress,
    jumpToLesson,
  };
}
