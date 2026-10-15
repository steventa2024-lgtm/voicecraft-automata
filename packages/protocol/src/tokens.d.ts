export interface RunnerTokenPayload {
  sub: string;
  scope: string;
  iat: number;
  exp: number;
  jti: string;
  deviceId: string | null;
}

export function issueRunnerToken(
  userId: string,
  secret: string,
  options?: { deviceId?: string; lifetimeSeconds?: number; now?: number; jti?: string },
): { token: string; expiresAt: string; payload: RunnerTokenPayload };

export function verifyRunnerToken(
  token: string,
  secret: string,
  options?: {
    now?: number;
    expectedDeviceId?: string;
    isConsumed?: (jti: string) => boolean;
  },
):
  | { ok: true; payload: RunnerTokenPayload }
  | { ok: false; code: string; message: string; payload?: undefined };
