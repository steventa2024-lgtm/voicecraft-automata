export function buildPlan(instruction: unknown): {
  blocks: Array<{ x: number; y: number; z: number; block: string }>;
  count: number;
  materials: string[];
  bounds: { width: number; height: number; depth: number; min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
};

export function planClear(instruction: unknown): Array<{ x: number; y: number; z: number; block: string }>;
export function assertPlanFitsWorld(originY: number, plan: { bounds: { height: number } }): void;
