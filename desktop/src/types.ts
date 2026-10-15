export interface PreviewBlock {
  x: number;
  y: number;
  z: number;
  block: string;
}

export interface PreviewResult {
  instruction?: {
    action: string;
    structure: string;
    material: string;
    dimensions: { width: number; depth: number; height: number };
    floors: number;
    direction: string;
    valid: boolean;
    errors?: string[];
    warnings?: string[];
    requiresConfirmation?: boolean;
  };
  blocks: PreviewBlock[];
  count: number;
  limited?: boolean;
  description: string;
  bridge?: string;
  bounds?: { width: number; height: number; depth: number };
  materials?: string[];
}

export interface AccountState {
  signedIn: boolean;
  email?: string;
  plan?: string;
  subscription?: string;
  unlimited?: boolean;
  tasks?: number;
  blocks?: number;
  stale?: boolean;
  error?: string;
  reason?: string;
}

export interface BridgeEvent {
  type?: string;
  status?: string;
  message?: string;
  progress?: number;
  jobId?: string;
  count?: number;
  warnings?: string[];
  site?: { warnings?: string[]; protectedCount?: number; slope?: number; water?: number; lava?: number };
  result?: { placed?: number; failed?: number; skipped?: number; status?: string };
  mode?: string;
  running?: boolean;
  event?: BridgeEvent;
}

declare global {
  interface Window {
    zeropulse?: {
      invoke: (channel: string, payload?: unknown) => Promise<unknown>;
      onEvent: (callback: (event: BridgeEvent) => void) => () => void;
    };
  }
}
