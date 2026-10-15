import { z } from "zod";
import { generateTemplate, templateById } from "./templates.js";
import { parseCommand } from "./parser.js";
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
  if (input?.templateId) {
    const templateInput = z
      .object({
        templateId: z
          .string()
          .max(80)
          .refine((id) => Boolean(templateById(id))),
        templateOptions: z
          .object({
            width: z.number().int().min(1).max(MAX_WIDTH).optional(),
            depth: z.number().int().min(1).max(MAX_DEPTH).optional(),
            floors: z.number().int().min(1).max(MAX_FLOORS).optional(),
            material: z
              .string()
              .regex(/^[a-z0-9_]{1,60}$/)
              .optional(),
            accent: z
              .string()
              .regex(/^[a-z0-9_]{1,60}$/)
              .optional(),
            rotation: z.number().int().min(0).max(3).optional(),
            mirror: z.enum(["x", "z"]).nullable().optional(),
            placement: z.enum(["ground", "floating"]).optional(),
            elevation: z.number().int().min(0).max(16).optional(),
          })
          .strict()
          .default({}),
        action: z.enum(["build", "preview", "inspect"]),
      })
      .safeParse(input);
    if (!templateInput.success)
      return { ok: false, errors: ["Invalid template or unsupported template options."] };
    try {
      const plan = generateTemplate(
        templateInput.data.templateId,
        templateInput.data.templateOptions,
      );
      const base = parseCommand("build a small stone house");
      // All authority, placement coordinates and safety policy come from canonical defaults.
      // Legacy desktop fields are descriptive only; client approval is never accepted here.
      return {
        ok: true,
        instruction: {
          ...base,
          action: templateInput.data.action,
          templateId: plan.templateId,
          templateOptions: plan.settings,
          dimensions: {
            width: plan.bounds.width,
            depth: plan.bounds.depth,
            height: plan.bounds.height,
          },
          floors: plan.settings.floors,
          raw: templateById(plan.templateId).name,
          warnings: plan.warnings,
          approved: false,
          requiresConfirmation: true,
        },
      };
    } catch (error) {
      return { ok: false, errors: [error.message] };
    }
  }
  const parsed = instructionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "instruction"}: ${issue.message}`,
      ),
    };
  }
  const instruction = {
    ...parsed.data,
    approved: allowApproved ? parsed.data.approved : false,
  };
  if (instruction.action === "build" && instruction.structure === "unknown") {
    return { ok: false, errors: ["Build instructions require a supported structure."] };
  }
  if (
    (instruction.action === "build" || instruction.action === "clear") &&
    instruction.dimensions.width < 1
  ) {
    return { ok: false, errors: ["Dimensions must be positive for this action."] };
  }
  return { ok: true, instruction };
}
