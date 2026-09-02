import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  CircleDot,
  Hammer,
  Mountain,
  Mic,
  MicOff,
  Plug,
  RefreshCw,
  Smartphone,
  ScanLine,
  Wifi,
  Send,
  Square,
  Trash2,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { useBridge, type BridgeStatus } from "@/hooks/use-bridge";
import {
  describeInstruction,
  estimateBlocks,
  parseCommand,
  type BuildInstruction,
} from "@/lib/command-parser";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Voice Control Dashboard — ZeroPulse" },
      {
        name: "description",
        content:
          "Speak a build order and watch ZeroPulse translate it into structured Minecraft block placement routines in real time.",
      },
      { property: "og:title", content: "Voice Control Dashboard — ZeroPulse" },
      {
        property: "og:description",
        content: "Real-time voice control center for Mineflayer-powered Minecraft building.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const QUICK_ACTION_GROUPS = [
  {
    label: "Plan & control",
    commands: [
      "Preview a large stone mansion 12 blocks ahead",
      "Preview a sandstone pyramid in front of me",
      "Undo the last build",
      "Clear a 15 by 15 area in front of me",
    ],
  },
  {
    label: "Homes",
    commands: [
      "Make a small oak house 10 blocks ahead",
      "Build me a large stone mansion",
      "Build a two floor brick mansion to my left",
      "Build a modern glass house to my right",
    ],
  },
  {
    label: "Defense",
    commands: [
      "Construct a deepslate castle",
      "Build a large stone fortress",
      "Build a stone watchtower",
      "Build a 6 floor quartz tower",
      "Build a 31 block wide wall in front of me",
    ],
  },
  {
    label: "Landscape & utility",
    commands: [
      "Build a bridge 15 blocks ahead",
      "Build a flower garden",
      "Build a stone fountain",
      "Build a sandstone pyramid",
      "Build a wheat farm",
    ],
  },
];

const STATUS_META: Record<BridgeStatus, { label: string; dot: string; text: string }> = {
  idle: { label: "Idle", dot: "bg-muted-foreground", text: "text-muted-foreground" },
  connecting: {
    label: "Waiting for companion",
    dot: "bg-warning animate-pulse",
    text: "text-warning",
  },
  bridge: {
    label: "Companion online · Minecraft offline",
    dot: "bg-warning",
    text: "text-warning",
  },
  connected: { label: "Connected", dot: "bg-success", text: "text-success" },
  building: { label: "Building", dot: "bg-primary animate-pulse", text: "text-primary" },
  error: { label: "Error", dot: "bg-destructive", text: "text-destructive" },
};

interface LogRow {
  id: number;
  time: string;
  transcript: string;
  instruction: BuildInstruction;
}

interface SpeechResultLike {
  readonly isFinal: boolean;
  readonly 0: { transcript: string };
}

interface SpeechEventLike {
  readonly resultIndex: number;
  readonly results: { readonly length: number; readonly [index: number]: SpeechResultLike };
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function Dashboard() {
  const bridge = useBridge();
  const sendToBridge = bridge.send;
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [draft, setDraft] = useState("");
  const [log, setLog] = useState<LogRow[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const rowId = useRef(0);

  const meta = STATUS_META[bridge.status];
  const typed = draft || transcript;
  const preview = typed ? parseCommand(typed) : (log[0]?.instruction ?? parseCommand(""));

  const dispatch = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      const instruction = parseCommand(clean);
      rowId.current += 1;
      setLog((prev) =>
        [
          {
            id: rowId.current,
            time: new Date().toLocaleTimeString([], { hour12: false }),
            transcript: clean,
            instruction,
          },
          ...prev,
        ].slice(0, 40),
      );
      sendToBridge(instruction);
      setDraft("");
      setTranscript("");
    },
    [sendToBridge],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Ctor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (event: SpeechEventLike) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result) text += result[0].transcript;
      }
      setTranscript(text);
      const finalResult = event.results[event.results.length - 1];
      if (finalResult?.isFinal) dispatch(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    return () => rec.abort?.();
  }, [dispatch]);

  const toggleMic = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      setTranscript("");
      rec.start();
      setListening(true);
    }
  };

  const activeProgress = bridge.progress;

  return (
    <div className="min-h-screen grid-backdrop">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Control center</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Speak a build order. ZeroPulse parses it and streams block routines to your local bot.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="glass flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium">
              <span className={`size-2 rounded-full ${meta.dot}`} />
              <span className={meta.text}>{meta.label}</span>
            </span>
            {bridge.mode ? (
              <span className="glass rounded-full px-3.5 py-2 font-mono text-xs text-muted-foreground">
                {bridge.mode === "command"
                  ? "/fill placement"
                  : bridge.mode === "creative"
                    ? "hand placement"
                    : "building disabled"}
              </span>
            ) : null}
            <button
              onClick={bridge.status === "idle" ? bridge.connect : bridge.disconnect}
              className="flex items-center gap-2 rounded-full border border-border bg-secondary px-3.5 py-2 text-xs font-medium transition hover:bg-muted"
            >
              <Plug className="size-3.5" />
              {bridge.status === "idle" ? "Connect bridge" : "Disconnect"}
            </button>
          </div>
        </div>

        <ConnectionPanel bridge={bridge} />

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          {/* Voice capture */}
          <section className="glass animate-rise rounded-2xl p-6">
            <div className="flex flex-col items-center gap-4 py-4">
              <button
                onClick={toggleMic}
                disabled={!supported}
                aria-label={listening ? "Stop listening" : "Start listening"}
                className={`grid size-28 place-items-center rounded-full border transition disabled:opacity-40 ${
                  listening
                    ? "animate-pulse-ring border-primary/60 bg-primary/20 text-primary"
                    : "border-border bg-secondary text-foreground hover:border-primary/50 hover:text-primary"
                }`}
              >
                {listening ? <Mic className="size-10" /> : <MicOff className="size-10" />}
              </button>
              <p className="text-center text-sm text-muted-foreground">
                {!supported
                  ? "Speech recognition unavailable in this browser — type a command below."
                  : listening
                    ? "Listening…"
                    : "Tap to speak a command"}
              </p>
              <p className="min-h-6 text-center font-mono text-sm text-primary">{transcript}</p>
            </div>

            <div className="mt-2 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && dispatch(draft)}
                placeholder="build me a large stone mansion"
                className="h-11 flex-1 rounded-xl border border-input bg-background/60 px-4 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
              />
              <button
                onClick={() => dispatch(draft)}
                className="flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-glow"
              >
                <Send className="size-4" /> Send
              </button>
            </div>

            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Quick actions
              </p>
              <div className="mt-3 space-y-3">
                {QUICK_ACTION_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-primary/80">
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.commands.map((command) => (
                        <button
                          key={command}
                          onClick={() => dispatch(command)}
                          className="rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-primary"
                        >
                          {command}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Parsed instruction + progress */}
          <section className="glass animate-rise rounded-2xl p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Boxes className="size-4 text-primary" /> Parsed instruction
            </h2>
            <pre className="mt-3 max-h-60 overflow-auto rounded-xl border border-border/70 bg-background/60 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
              {JSON.stringify(preview, null, 2)}
            </pre>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <Stat label="Confidence" value={`${Math.round(preview.confidence * 100)}%`} />
              <Stat label="Est. blocks" value={estimateBlocks(preview).toLocaleString()} />
              <Stat label="Floors" value={String(preview.floors)} />
            </div>
            {bridge.siteReport ? (
              <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-4">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
                  <ScanLine className="size-4" /> Site awareness
                </h3>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat
                    label="Footprint"
                    value={`${bridge.siteReport.footprint.width}×${bridge.siteReport.footprint.depth}`}
                  />
                  <Stat label="Slope" value={`${bridge.siteReport.slope} blocks`} />
                  <Stat
                    label="Excavate"
                    value={bridge.siteReport.excavationBlocks.toLocaleString()}
                  />
                  <Stat
                    label="Foundation"
                    value={bridge.siteReport.foundationBlocks.toLocaleString()}
                  />
                </div>
                <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Mountain className="size-3.5 text-accent" /> Base elevation Y{" "}
                  {bridge.siteReport.baseY}
                  {bridge.siteReport.protectedBlocks.length
                    ? ` · ${bridge.siteReport.protectedBlocks.length} protected blocks require attention`
                    : " · no protected blocks detected"}
                </p>
              </div>
            ) : null}
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Hammer className="size-3.5" /> Build progress
                </span>
                <span className="font-mono">{Math.round(activeProgress)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-200"
                  style={{ width: `${activeProgress}%` }}
                />
              </div>
            </div>
            <button
              onClick={() => {
                dispatch("stop");
              }}
              disabled={bridge.status !== "building"}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/40 px-4 py-2.5 text-sm font-medium text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Square className="size-4" /> Abort build
            </button>
          </section>
        </div>

        {/* Logs */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          <section className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Activity className="size-4 text-accent" /> Command log
              </h2>
              <button
                onClick={() => setLog([])}
                className="flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-destructive"
              >
                <Trash2 className="size-3.5" /> Clear
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {log.length === 0 && (
                <li className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  No commands yet — speak or pick a quick action.
                </li>
              )}
              {log.map((row) => (
                <li
                  key={row.id}
                  className="animate-rise rounded-xl border border-border/70 bg-background/50 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm">“{row.transcript}”</p>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {row.time}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-primary">
                    → {describeInstruction(row.instruction)}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="glass rounded-2xl p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CircleDot className="size-4 text-primary" /> Bridge telemetry
            </h2>
            <ul className="mt-4 space-y-1.5 font-mono text-xs">
              {bridge.events.length === 0 && (
                <li className="text-muted-foreground">Awaiting bridge connection…</li>
              )}
              {bridge.events.map((e) => (
                <li
                  key={e.id}
                  className={
                    e.kind === "error"
                      ? "text-destructive"
                      : e.kind === "success"
                        ? "text-success"
                        : e.kind === "warn"
                          ? "text-warning"
                          : "text-muted-foreground"
                  }
                >
                  {e.kind === "error" && <AlertTriangle className="mr-1 inline size-3" />}
                  {e.text}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}

function ConnectionPanel({ bridge }: { bridge: ReturnType<typeof useBridge> }) {
  const { conn, setConnection, regenerateCode, connect } = bridge;
  return (
    <section className="glass mt-6 rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Wifi className="size-4 text-primary" /> Connection
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Direct connects a browser on this PC to the companion. Relay waits for the companion
            using the same pairing code; joining the relay alone does not mean Minecraft is
            connected.
          </p>
        </div>
        <div className="flex rounded-full border border-border bg-secondary/60 p-1 text-xs">
          {(["local", "cloud"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setConnection({ transport: t })}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${
                conn.transport === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "local" ? <Plug className="size-3.5" /> : <Smartphone className="size-3.5" />}
              {t === "local" ? "Direct (this PC)" : "Relay (anywhere)"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        {conn.transport === "local" ? (
          <input
            value={conn.url}
            onChange={(e) => setConnection({ url: e.target.value })}
            spellCheck={false}
            placeholder="ws://localhost:8765"
            className="h-11 rounded-xl border border-input bg-background/60 px-4 font-mono text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
          />
        ) : (
          <div className="flex gap-2">
            <input
              value={conn.code}
              onChange={(e) => setConnection({ code: e.target.value })}
              spellCheck={false}
              placeholder="PAIR CODE"
              className="h-11 flex-1 rounded-xl border border-input bg-background/60 px-4 font-mono text-sm uppercase tracking-[0.3em] outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
            />
            <button
              onClick={regenerateCode}
              title="Generate a new pairing code"
              className="grid size-11 place-items-center rounded-xl border border-border bg-secondary transition hover:bg-muted"
            >
              <RefreshCw className="size-4" />
            </button>
          </div>
        )}
        <button
          onClick={connect}
          className="h-11 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary-glow"
        >
          Reconnect
        </button>
      </div>

      {conn.transport === "cloud" ? (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          On the PC running Minecraft, start the companion with pairing code{" "}
          <span className="text-primary">{conn.code || "——————"}</span> (Companion app → Pairing
          code, or <span className="text-primary">ZP_PAIR_CODE={conn.code || "CODE"}</span> in the
          bridge .env).
        </p>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/50 p-3">
      <p className="font-display text-lg font-semibold text-primary">{value}</p>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
