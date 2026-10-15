import { supabase } from './supabase';

const root = (process.env.EXPO_PUBLIC_VOICECRAFT_API_URL || '').replace(/\/$/, '');

export const cloudConfigured = root.startsWith('https://') && !root.includes('example.com');

export type PairingResult = {
  worldId: string;
  worldName: string;
  platform: 'ps5' | 'xbox';
};

export type PreviewResult = {
  previewId: string;
  summary: string;
  estimatedBlocks: number;
  requiresConfirmation: true;
};

async function api<T>(path: string, body: unknown): Promise<T> {
  if (!cloudConfigured) throw new Error('VoiceCraft Cloud API is not configured.');
  if (!supabase) throw new Error('Configure Supabase authentication first.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Sign in to continue.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(root + path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + data.session.access_token,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.message || 'Cloud request failed (HTTP ' + response.status + ').';
      throw new Error(message);
    }
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function claimPairing(code: string, platform: 'ps5' | 'xbox') {
  return api<PairingResult>('/api/mobile/pairing/claim', { code, platform });
}

export function requestPreview(worldId: string, instruction: string) {
  return api<PreviewResult>('/api/mobile/builds/preview', { worldId, instruction });
}

export function confirmPreview(previewId: string) {
  return api<{ jobId: string; status: string }>('/api/mobile/builds/confirm', { previewId });
}

export async function transcribeAudio(uri: string): Promise<string> {
  if (!cloudConfigured) throw new Error('VoiceCraft Cloud transcription is not configured.');
  if (!supabase) throw new Error('Configure Supabase authentication first.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Sign in to continue.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const form = new FormData();
  form.append('audio', { uri, name: 'voicecraft.m4a', type: 'audio/mp4' } as any);
  try {
    const response = await fetch(root + '/api/mobile/transcribe', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + data.session.access_token },
      body: form,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message || 'Could not transcribe the recording.');
    if (typeof payload?.text !== 'string') throw new Error('Invalid transcription response.');
    return payload.text;
  } finally {
    clearTimeout(timeout);
  }
}
