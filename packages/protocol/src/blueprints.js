import { z } from "zod";
import { MATERIALS, STRUCTURES } from "./limits.js";

export const BLUEPRINT_FORMAT = "zeropulse-blueprint-v1";

const blueprintSchema = z
  .object({
    format: z.literal(BLUEPRINT_FORMAT),
    name: z.string().trim().min(1).max(80),
    category: z.string().trim().min(1).max(40),
    structure: z.enum(STRUCTURES),
    material: z.enum(MATERIALS),
    size: z.enum(["small", "medium", "large"]),
    floors: z.number().int().min(1).max(8),
    dimensions: z.object({
      width: z.number().int().min(1).max(64),
      depth: z.number().int().min(1).max(64),
      height: z.number().int().min(1).max(384),
    }),
    favorite: z.boolean().default(false),
    notes: z.string().max(500).default(""),
    templateId: z.string().regex(/^[a-z0-9-]{3,80}$/).optional(),
    templateOptions: z
      .object({
        width: z.number().int().min(1).max(64).optional(),
        depth: z.number().int().min(1).max(64).optional(),
        floors: z.number().int().min(1).max(8).optional(),
        material: z.string().regex(/^[a-z0-9_]+$/).optional(),
        accent: z.string().regex(/^[a-z0-9_]+$/).optional(),
        rotation: z.number().int().min(0).max(3).optional(),
        mirror: z.enum(["x", "z"]).nullable().optional(),
      })
      .optional(),
  })
  .strict();

export function exportBlueprint(blueprint) {
  const parsed = blueprintSchema.parse({
    format: BLUEPRINT_FORMAT,
    favorite: false,
    notes: "",
    ...blueprint,
    format: BLUEPRINT_FORMAT,
  });
  return JSON.stringify(parsed, null, 2);
}

export function importBlueprint(text) {
  let json;
  try {
    json = JSON.parse(String(text || ""));
  } catch {
    return { ok: false, error: "Blueprint file is not valid JSON." };
  }
  if (json && typeof json === "object" && json.format && json.format !== BLUEPRINT_FORMAT) {
    return { ok: false, error: `Unsupported blueprint format ${json.format}.` };
  }
  const parsed = blueprintSchema.safeParse({ format: BLUEPRINT_FORMAT, favorite: false, notes: "", ...json });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join(" ") };
  }
  return { ok: true, blueprint: parsed.data };
}

export function identifyExternalSchematic(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    return {
      ok: false,
      format: "gzip-nbt",
      error:
        "Sponge .schem and .litematic files are not imported. Export a ZeroPulse blueprint JSON file instead. No compatibility is claimed for those formats.",
    };
  }
  return { ok: false, format: "unknown", error: "Unrecognised schematic file. ZeroPulse blueprint JSON is the supported format." };
}
