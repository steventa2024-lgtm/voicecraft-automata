import { z } from "zod";
import {
  ACTIONS,
  COMMAND_VERSION,
  MATERIALS,
  MAX_DEPTH,
  MAX_DISTANCE,
  MAX_FLOORS,
  MAX_HEIGHT,
  MAX_OPERATIONS,
  MAX_VERTICAL,
  MAX_WIDTH,
  STRUCTURES,
  WORLD_MAX_Y,
  WORLD_MIN_Y,
} from "./limits.js";

const structureSchema = z.enum([...STRUCTURES, "unknown"]);
const materialSchema = z.enum(MATERIALS);

export const instructionSchema = z
  .object({
    version: z.literal(COMMAND_VERSION).default(COMMAND_VERSION),
    action: z.enum(ACTIONS),
    structure: structureSchema,
    material: materialSchema,
    size: z.enum(["small", "medium", "large"]),
    direction: z.enum(["front", "back", "left", "right"]),
    dimensions: z.object({
      width: z.number().int().min(0).max(MAX_WIDTH),
      depth: z.number().int().min(0).max(MAX_DEPTH),
      height: z.number().int().min(0).max(MAX_HEIGHT),
    }),
    floors: z.number().int().min(1).max(MAX_FLOORS),
    offset: z.object({
      x: z.number().int().min(-MAX_DISTANCE).max(MAX_DISTANCE),
      y: z.number().int().min(-MAX_VERTICAL).max(MAX_VERTICAL),
      z: z.number().int().min(0).max(MAX_DISTANCE),
    }),
    position: z
      .object({
        x: z.number().int().min(-30_000_000).max(30_000_000),
        y: z.number().int().min(WORLD_MIN_Y).max(WORLD_MAX_Y),
        z: z.number().int().min(-30_000_000).max(30_000_000),
      })
      .nullable(),
    rotation: z.number().int().min(0).max(3),
    confidence: z.number().min(0).max(1),
    raw: z.string().max(500),
    requiresConfirmation: z.boolean(),
    protectedBlockPolicy: z.enum(["abort", "skip"]),
    estimatedOperations: z.number().int().min(0).max(MAX_OPERATIONS),
    clamped: z.boolean(),
    warnings: z.array(z.string().max(300)).max(20),
    valid: z.boolean(),
    errors: z.array(z.string().max(300)).max(20),
    approved: z.boolean(),
  })
  .strict();

/**
 * Trust boundary for instructions edited in the UI.
 * Client-supplied approval is ignored unless the caller is the local authorized approver.
 */
export function sanitizeInstruction(input, { allowApproved = false } = {}) {
  const parsed = instructionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "instruction"}: ${issue.message}`),
    };
  }
  const instruction = {
    ...parsed.data,
    approved: allowApproved ? parsed.data.approved : false,
  };
  if (instruction.action === "build" && instruction.structure === "unknown") {
    return { ok: false, errors: ["Build instructions require a supported structure."] };
  }
  if ((instruction.action === "build" || instruction.action === "clear") && instruction.dimensions.width < 1) {
    return { ok: false, errors: ["Dimensions must be positive for this action."] };
  }
  return { ok: true, instruction };
}
