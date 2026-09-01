import { useCallback, useEffect, useRef, useState } from "react";
import type { BuildInstruction } from "@/lib/command-parser";

export type BridgeStatus = "idle" | "connecting" | "connected" | "building" | "error";

export interface BridgeEvent {
  type: "status" | "log" | "progress" | "error";
  status?: Exclude<BridgeStatus, "connecting">;
  message?: string;
  progress?: number;
}

const DEFAULT_URL = "ws://localhost:8765";

/** Talks to the locally-installed ZeroPulse bridge over WebSocket. */
export function useBridge(url: string = DEFAULT_URL) {
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [events, setEvents] = useState<Array<{ id: number; text: string; kind: string }>>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const counter = useRef(0);

  const push = useCallback((text: string, kind = "info") => {
    counter.current += 1;
    setEvents((prev) => [{ id: counter.current, text, kind }, ...prev].slice(0, 60));
  }, []);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;
    socketRef.current?.close();
    setStatus("connecting");
    push(`Dialling local bridge at ${url}`, "info");
    try {
      const ws = new WebSocket(url);
      socketRef.current = ws;
      ws.onopen = () => {
        setStatus("connected");
        push("Bridge online — Mineflayer bot attached", "success");
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data as string) as BridgeEvent;
          if (data.status) setStatus(data.status);
          if (typeof data.progress === "number") setProgress(data.progress);
          if (data.message) push(data.message, data.type === "error" ? "error" : "info");
        } catch {
          push(String(ev.data), "info");
        }
      };
      ws.onerror = () => {
        setStatus("error");
        push("Bridge unreachable — is the companion app running?", "error");
      };
      ws.onclose = () => {
        setStatus((s) => (s === "error" ? s : "idle"));
      };
    } catch {
      setStatus("error");
      push("Could not open a WebSocket to the bridge", "error");
    }
  }, [push, url]);

  const disconnect = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    setStatus("idle");
    setProgress(0);
    push("Disconnected from bridge", "info");
  }, [push]);

  const send = useCallback(
    (instruction: BuildInstruction) => {
      const ws = socketRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "command", instruction }));
        push(`Dispatched → ${instruction.action} ${instruction.structure}`, "success");
        return true;
      }
      push("No bridge connection — running local simulation", "warn");
      return false;
    },
    [push],
  );

  useEffect(() => () => socketRef.current?.close(), []);

  return { status, progress, setProgress, events, push, connect, disconnect, send };
}
