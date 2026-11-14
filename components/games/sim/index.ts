// The shared simulator kit: SimFrame layout, SimComplete end card, SimFeedback
// tones, SimTerminal, the terminal lab layout and missions for sandboxes.
// terraform-puzzle.tsx and incident-commander-simulator.tsx are the reference
// games built on it; linux-terminal.tsx is the reference terminal lab.
export { SIM_TONE, SIM_CATEGORY, type SimTone, type SimCategory } from './tones';
export {
  SimFrame,
  SimBar,
  SimGoal,
  SimHowTo,
  SimHintButton,
  SimResetButton,
  SimStage,
  SimPhoneBar,
  SimTabBadge,
  revealTop,
  type SimBarProps,
  type SimPanel,
  type SimStep,
  type SimStepStatus,
} from './sim-frame';
export { SimComplete, type SimCompleteProps, type SimStat } from './sim-complete';
export { SimFeedback, SimAnnouncer, type SimFeedbackProps } from './sim-feedback';
export {
  SimTerminal,
  SimTerminalWindow,
  terminalLineClass,
  resultLine,
  type SimTerminalLine,
  type SimTerminalLineType,
  type SimTerminalProps,
} from './sim-terminal';
export {
  SimLabBar,
  SimLabLayout,
  SimLabPanel,
  SimLabLessons,
  useSimLab,
  labLines,
  labStats,
  labSteps,
  lessonsSummary,
  focusTerminal,
  LAB_TERMINAL_HEIGHT,
  type SimLabLesson,
  type SimLabState,
  type SimLabUi,
} from './sim-lab';
export { SimMissionHelp, SimMissionList } from './sim-missions';
export {
  useMissions,
  passedMissions,
  missionProgress,
  type Mission,
  type MissionView,
  type MissionProgress,
} from './use-missions';
export { SimGameProvider, useSimGame } from './sim-game';
