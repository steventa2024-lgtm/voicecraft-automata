/**
 * Website-facing types for the shared command contract.
 * The implementation lives in packages/protocol so the desktop app and bridge cannot drift.
 */
export type {
  BuildInstruction,
} from "../../../packages/protocol/src/parser.js";
export {
  describeInstruction,
  estimateBlocks,
  isDestructiveAction,
  parseCommand,
} from "../../../packages/protocol/src/parser.js";

export type StructureKind =
  | "mansion"
  | "house"
  | "tower"
  | "castle"
  | "fortress"
  | "watchtower"
  | "bridge"
  | "wall"
  | "pyramid"
  | "farm"
  | "garden"
  | "fountain"
  | "unknown";

export type BuildDirection = "front" | "back" | "left" | "right";
