import { useCallback, useEffect, useRef, useState } from "react";
import type { BuildInstruction } from "@/lib/command-parser";
import { makePairCode, normalizeCode, openRelay, type RelayHandle } from "@/lib/relay";

export type BridgeStatus = "idle" | "connecting" | "bridge" | "connected" | "building" | "error";
export type TransportKind = "local" | "cloud";

export interface BridgeEvent {
  type: "status" | "log" | "progress" | "error" | "mode";
  mode?: string;
  result?: { placed: number; mode: string; origin: { x: number; y: number; z: number } };
  status?: Exclude<BridgeStatus, "connecting">;
  message?: string;
  progress?: number;
}

export interface Connection {
  transport: TransportKind;
  url: string;
  code: string;
}

const STORAGE_KEY = "zeropulse.connection";
const DEFAULT_URL = "ws://localhost:8765";

function loadConnection(): Connection {
  const fallback: Connection = { transport: "local", url: DEFAULT_URL, code: "" };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...fallback, code: makePairCode() };
    const parsed = JSON.parse(raw) as Partial<Connection>;
    return {
      transport: parsed.transport === "cloud" ? "cloud" : "local",
      url: parsed.url || DEFAULT_URL,
      code: normalizeCode(parsed.code || "") || makePairCode(),
    };
  } catch {
    return { ...fallback, code: makePairCode() };
  }
}

/**
 * Talks to the ZeroPulse bridge either directly over LAN WebSocket ("local")
 * or through the hosted Realtime relay ("cloud"), which lets a phone drive a
 * bot running on a PC anywhere.
 */
export function useBridge() {
  const [conn, setConnState] = useState<Connection>(() => ({
    transport: "local",
    url: DEFAULT_URL,
    code: "",
  }));
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [mode, setMode] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [events, setEvents] = useState<Array<{ id: number; text: string; kind: string }>>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const relayRef = useRef<RelayHandle | null>(null);
  const counter = useRef(0);

  const push = useCallback((text: string, kind = "info") => {
    counter.current += 1;
    setEvents((prev) => [{ id: counter.current, text, kind }, ...prev].slice(0, 60));
  }, []);

  // Restore the saved transport once we're on the client.
  useEffect(() => {
    setConnState(loadConnection());
    setHydrated(true);
  }, []);

  const applyEvent = useCallback(
    (data: BridgeEvent) => {
      if (data.status) setStatus(data.status === "idle" ? "bridge" : data.status);
      if (data.mode) setMode(data.mode);
      if (data.result) {
        push(
          `Placed ${data.result.placed} blocks at ${data.result.origin.x}, ${data.result.origin.y}, ${data.result.origin.z} (${data.result.mode} mode)`,
          "success",
        );
      }
      if (typeof data.progress === "number") setProgress(data.progress);
      if (data.message) push(data.message, data.type === "error" ? "error" : "info");
    },
    [push],
  );

  const teardown = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    relayRef.current?.close();
    relayRef.current = null;
  }, []);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;
    teardown();
    setStatus("connecting");

    if (conn.transport === "cloud") {
      const code = normalizeCode(conn.code);
      if (!code) {
        setStatus("error");
        push("Enter a pairing code before connecting to the relay", "error");
        return;
      }
      push(`Joining relay channel ${code}`, "info");
      relayRef.current = openRelay(code, {
        onOpen: () => {
          setStatus("connecting");
          push("Relay ready — waiting for the companion app", "info");
        },
        onEvent: (payload) => applyEvent(payload as BridgeEvent),
        onError: (message) => {
          setStatus("error");
          push(message, "error");
        },
      });
      return;
    }

    push(`Dialling local bridge at ${conn.url}`, "info");
    try {
      const ws = new WebSocket(conn.url);
      socketRef.current = ws;
      ws.onopen = () => {
        setStatus("bridge");
        push("Companion found — checking Minecraft connection", "success");
      };
      ws.onmessage = (ev) => {
        try {
          applyEvent(JSON.parse(ev.data as string) as BridgeEvent);
        } catch {
          push(String(ev.data), "info");
        }
      };
      ws.onerror = () => {
        setStatus("error");
        push("Bridge unreachable — is the companion app running?", "error");
      };
      ws.onclose = () => setStatus((s) => (s === "error" ? s : "idle"));
    } catch {
      setStatus("error");
      push("Could not open a WebSocket to the bridge", "error");
    }
  }, [applyEvent, conn.code, conn.transport, conn.url, push, teardown]);

  const disconnect = useCallback(() => {
    teardown();
    setStatus("idle");
    setProgress(0);
    push("Disconnected from bridge", "info");
  }, [push, teardown]);

  const setConnection = useCallback((next: Partial<Connection>) => {
    setConnState((prev) => {
      const merged: Connection = {
        ...prev,
        ...next,
        code: next.code !== undefined ? normalizeCode(next.code) : prev.code,
      };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      }
      return merged;
    });
  }, []);

  const regenerateCode = useCallback(
    () => setConnection({ code: makePairCode() }),
    [setConnection],
  );

  const send = useCallback(
    (instruction: BuildInstruction) => {
      const payload = { type: "command", instruction };
      if (relayRef.current && (status === "connected" || status === "building")) {
        relayRef.current.send(payload);
        push(`Relayed → ${instruction.action} ${instruction.structure}`, "success");
        return true;
      }
      const ws = socketRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
        push(`Dispatched → ${instruction.action} ${instruction.structure}`, "success");
        return true;
      }
       push("Command not sent — connect the companion and Minecraft first", "warn");
      return false;
    },
    [push, status],
  );

  // Attach automatically using the saved transport.
  useEffect(() => {
    if (!hydrated) return;
    connect();
    return () => teardown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, conn.transport, conn.url, conn.code]);

  return {
    status,
    mode,
    progress,
    setProgress,
    events,
    push,
    connect,
    disconnect,
    send,
    conn,
    setConnection,
    regenerateCode,
  };
}
