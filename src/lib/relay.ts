/**
 * Cloud relay transport.
 *
 * The dashboard (phone or desktop) and the local bridge both join the same
 * Realtime broadcast channel, keyed by a short pairing code. Commands travel
 * dashboard → bridge on the `cmd` event, telemetry travels back on `evt`.
 *
 * Nothing is persisted: the channel is a pure fan-out pipe.
 */
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function makePairCode(len = 6): string {
  let out = "";
  const bytes = new Uint8Array(len);
  if (typeof crypto !== "undefined") crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i += 1) {
    out += CODE_ALPHABET[(bytes[i] || Math.floor(Math.random() * 255)) % CODE_ALPHABET.length];
  }
  return out;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export function channelName(code: string): string {
  return `zp-relay-${normalizeCode(code)}`;
}

export interface RelayHandlers {
  onEvent: (payload: any) => void;
  onOpen: () => void;
  onError: (message: string) => void;
}

export interface RelayHandle {
  send: (payload: any) => void;
  close: () => void;
}

export function openRelay(code: string, handlers: RelayHandlers): RelayHandle {
  const channel: RealtimeChannel = supabase.channel(channelName(code), {
    config: { broadcast: { self: false } },
  });

  channel.on("broadcast", { event: "evt" }, ({ payload }) => handlers.onEvent(payload));

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      handlers.onOpen();
      channel.send({ type: "broadcast", event: "cmd", payload: { type: "hello" } });
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      handlers.onError("Relay channel error — check your connection and pairing code");
    }
  });

  return {
    send: (payload) => {
      channel.send({ type: "broadcast", event: "cmd", payload });
    },
    close: () => {
      supabase.removeChannel(channel);
    },
  };
}
