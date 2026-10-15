export interface BuildInstruction {
  version: number;
  action: "build" | "preview" | "inspect" | "clear" | "undo" | "redo" | "stop" | "pause" | "resume" | "unknown";
  structure: string;
  material: string;
  size: "small" | "medium" | "large";
  direction: "front" | "back" | "left" | "right";
  dimensions: { width: number; depth: number; height: number };
  floors: number;
  offset: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number } | null;
  rotation: number;
  confidence: number;
  raw: string;
  requiresConfirmation: boolean;
  protectedBlockPolicy: "abort" | "skip";
  estimatedOperations: number;
  clamped: boolean;
  warnings: string[];
  valid: boolean;
  errors: string[];
  approved: boolean;
}

export function parseCommand(input: string): BuildInstruction;
export function describeInstruction(instruction: BuildInstruction): string;
export function estimateBlocks(instruction: BuildInstruction): number;
export function isDestructiveAction(action: string): boolean;
