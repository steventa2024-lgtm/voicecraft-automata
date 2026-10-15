export function isAllowedLoopbackRedirect(value: string): boolean;
export function verifyPkce(verifier: string, challenge: string): boolean;
export function createPkce(): { verifier: string; challenge: string; state: string };
export function timingSafeStringEqual(left: string, right: string): boolean;
export function assessPayload(data: string, maxBytes?: number): { ok: boolean; code?: string; size: number };
