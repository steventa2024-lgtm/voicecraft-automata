import { z } from "zod";
import { MATERIALS, STRUCTURES } from "./limits.js";
import { parseCommand } from "./parser.js";

const partSchema = z
  .object({
    structure: z.enum(STRUCTURES),
    material: z.enum(MATERIALS).optional(),
    size: z.enum(["small", "medium", "large"]).optional(),
    floors: z.number().int().min(1).max(8).optional(),
    dimensions: z
      .object({
        width: z.number().int().min(3).max(64),
        depth: z.number().int().min(3).max(64),
        height: z.number().int().min(3).max(96),
      })
      .optional(),
    offset: z
      .object({
        x: z.number().int().min(-48).max(48),
        y: z.number().int().min(-32).max(32),
        z: z.number().int().min(2).max(48),
      })
      .optional(),
  })
  .strict();

export const plannerResponseSchema = z
  .object({
    summary: z.string().min(1).max(300),
    parts: z.array(partSchema).min(1).max(6),
  })
  .strict();

export const OLLAMA_SYSTEM_PROMPT = [
  "You convert Minecraft building requests into JSON only.",
  "Use only known structure names and materials.",
  "Do not emit Minecraft commands, coordinates outside the schema, or extra keys.",
  "Schema: {\"summary\": string, \"parts\": [{\"structure\": one of " +
    STRUCTURES.join("|") +
    ", \"material\"?: one of " +
    MATERIALS.join("|") +
    ", \"size\"?: small|medium|large, \"floors\"?: number, \"dimensions\"?: {width,depth,height}, \"offset\"?: {x,y,z}}]}",
  "Keep every part inside the numeric limits. Prefer one part when the request maps to a single structure.",
].join(" ");

export function extractJson(text) {
  const raw = String(text || "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error("The model did not return JSON.");
  }
}

export function validatePlannerResponse(text) {
  let json;
  try {
    json = extractJson(text);
  } catch (error) {
    return { ok: false, error: error.message };
  }
  const parsed = plannerResponseSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      error: `The model plan failed validation: ${parsed.error.issues.map((issue) => issue.message).join(" ")}`,
    };
  }
  return { ok: true, plan: parsed.data };
}

export function planToInstruction(part, fallbackText) {
  const phrase = [
    "build",
    part.size || "medium",
    part.material?.replaceAll("_", " ") || "",
    part.structure,
    part.floors ? `${part.floors} floors` : "",
    part.dimensions ? `${part.dimensions.width} by ${part.dimensions.depth} by ${part.dimensions.height}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const instruction = parseCommand(phrase || fallbackText);
  if (part.offset) instruction.offset = { ...instruction.offset, ...part.offset };
  if (part.dimensions) instruction.dimensions = { ...part.dimensions };
  instruction.approved = false;
  return instruction;
}

export function isLocalOllamaUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  } catch {
    return false;
  }
}
