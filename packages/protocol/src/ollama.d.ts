import type { BuildInstruction } from "./parser.js";

export function planToInstruction(
  part: {
    structure: BuildInstruction["structure"];
    material?: string;
    size?: "small" | "medium" | "large";
    floors?: number;
    dimensions?: { width: number; depth: number; height: number };
    offset?: { x: number; y: number; z: number };
  },
  fallbackText: string,
): BuildInstruction;

export function validatePlannerResponse(text: string): {
  ok: boolean;
  error?: string;
  plan?: { summary: string; parts: Array<Record<string, unknown>> };
};

export const OLLAMA_SYSTEM_PROMPT: string;
export function isLocalOllamaUrl(value: string): boolean;
export function isLocalOllamaModel(value: string): boolean;
