// The shared generator is JavaScript so desktop, mobile, and the worker execute one implementation.
// @ts-expect-error Shared protocol sources are JavaScript.
import { MATERIALS as protocolMaterials } from "../../packages/protocol/src/limits.js";
// @ts-expect-error Shared protocol sources are JavaScript.
import { generateTemplate as generateShared, isometricPreview as previewShared, listTemplates as listShared } from "../../packages/protocol/src/templates.js";

export type CatalogTemplate = {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  complexity: string;
  estimatedBlocks: number;
  warnings: string[];
  permissions: string;
  minecraft: string;
  generatorVersion: number;
  defaults: { width: number; depth: number; floors: number; material: string; accent: string };
  ranges: { width: [number, number]; depth: [number, number]; floors: [number, number] };
  supports: { floors: boolean; resize: boolean; rotate: boolean; mirror: boolean };
};

export type GeneratedPlan = {
  blocks: Array<{ x: number; y: number; z: number; block: string; states?: Record<string,string> }>;
  count: number;
  bounds: { width: number; height: number; depth: number };
  fingerprint: string;
  warnings: string[];
  settings: { width: number; depth: number; floors: number; material: string; accent: string; rotation: number; mirror: "x" | "z" | null };
};

export const MATERIALS = protocolMaterials as readonly string[];

export function listTemplates(): CatalogTemplate[] {
  return listShared();
}

export function generateTemplate(id: string, options?: object): GeneratedPlan {
  return generateShared(id, options);
}

export function isometricPreview(blocks: unknown[], width?: number, height?: number) {
  return previewShared(blocks, width, height) as {
    width: number;
    height: number;
    cells: Array<{ x: number; y: number; color: string }>;
    faces: Array<{ points: Array<{ x: number; y: number }>; color: string }>;
  };
}
