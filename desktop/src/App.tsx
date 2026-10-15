import { useEffect, useMemo, useState } from "react";
import { planToInstruction } from "../../packages/protocol/src/ollama.js";
import { describeInstruction, parseCommand } from "../../packages/protocol/src/parser.js";
import { buildPlan } from "../../packages/protocol/src/plan.js";
import { Catalog } from "./catalog";
import { CompanionPanel } from "./companion";
import { VoxelPreview } from "./preview";
import type { AccountState, BridgeEvent, PreviewResult } from "./types";

type Section = "home" | "studio" | "catalog" | "library" | "companion" | "history" | "connections" | "settings";

const NAV: Array<{ id: Section; label: string }> = [
  { id: "home", label: "Home" },
  { id: "studio", label: "Build Studio" },
  { id: "catalog", label: "Catalog" },
  { id: "library", label: "Blueprints" },
  { id: "companion", label: "Companion" },
  { id: "history", label: "History" },
  { id: "connections", label: "Connections" },
  { id: "settings", label: "Settings" },
];

async function call<T>(channel: string, payload?: unknown): Promise<T> {
  if (!window.zeropulse) throw new Error("Open this screen inside the ZeroPulse desktop app to use local controls.");
  return (await window.zeropulse.invoke(channel, payload)) as T;
}

function localPreview(text: string): PreviewResult {
  const instruction = parseCommand(text);
  if (!instruction.valid || !["build", "preview", "clear", "inspect"].includes(instruction.action)) {
    return { instruction, blocks: [], count: 0, description: describeInstruction(instruction) };
  }
  try {
    const planning = instruction.action === "clear" ? instruction : { ...instruction, action: "build" as const, valid: true };
    const plan = buildPlan(planning);
    return {
      instruction,
      blocks: plan.blocks,
      count: plan.count,
      limited: false,
      description: describeInstruction(instruction),
      materials: plan.materials,
      bounds: plan.bounds,
    };
  } catch (error) {
    return { instruction, blocks: [], count: 0, description: error instanceof Error ? error.message : "Plan failed." };
  }
}

export function App() {
  const [section, setSection] = useState<Section>("home");
  const [account, setAccount] = useState<AccountState>({ signedIn: false });
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [bridgeRunning, setBridgeRunning] = useState(false);
  const [minecraft, setMinecraft] = useState("Not connected");
  const [voice, setVoice] = useState("Idle");
  const [ai, setAi] = useState("Not checked");
  const [executor, setExecutor] = useState("Idle");
  const [progress, setProgress] = useState<number | null>(null);
  const [log, setLog] = useState<string[]>(["Desktop dashboard loaded from local files."]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [jobId, setJobId] = useState("");
  const [planWarnings, setPlanWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void call<Record<string, unknown>>("settings.get").then(setSettings).catch(() => undefined);
    void call<AccountState>("auth.status").then(setAccount).catch((reason) => setAccount({ signedIn: false, reason: String(reason) }));
    if (!window.zeropulse) return;
    return window.zeropulse.onEvent((event) => {
      const inner = event.type === "bridge-event" ? event.event || event : event;
      if (inner.message) setLog((current) => [inner.message as string, ...current].slice(0, 80));
      if (event.type === "bridge") setBridgeRunning(Boolean(event.running));
      if (inner.status) setExecutor(inner.status);
      if (typeof inner.progress === "number") setProgress(inner.progress);
      if (inner.type === "mode") setMinecraft(inner.message || inner.mode || "Minecraft responded");
      if (inner.type === "plan" && inner.jobId) {
        setJobId(inner.jobId);
        setPlanWarnings(Array.isArray(inner.warnings) ? inner.warnings.filter((warning) => typeof warning === "string") : []);
      }
      if (inner.status === "connected") setMinecraft("Bot is in the world");
      if (inner.type === "error" && inner.message) setError(inner.message);
    });
  }, []);

  const allowance = useMemo(() => {
    if (!account.signedIn) return "Sign in to see build allowance";
    if (account.stale) return "Allowance unavailable offline";
    if (account.unlimited) return "Unlimited tester";
    return `${account.plan || "plan"} · ${account.tasks ?? 0} tasks used today · ${account.blocks ?? 0} blocks used`;
  }, [account]);

  return (
    <div className="grid h-screen grid-rows-[1fr_auto] bg-[#07111f] text-[#e7eefc]">
      <div className="grid min-h-0 grid-cols-[220px_1fr]">
        <aside className="flex flex-col border-r border-white/10 bg-[#0b1730]/90 px-3 py-4">
          <div className="px-2">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#7eb6ff]">ZeroPulse</p>
            <h1 className="text-lg font-semibold">VoiceCraft</h1>
          </div>
          <nav className="mt-6 grid gap-1">
            {NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`rounded-xl px-3 py-2 text-left text-sm ${section === item.id ? "bg-[#2f7bff] text-white" : "text-[#c5d2ea] hover:bg-white/5"}`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-[#93a0b8]">
            <p>{account.email || "Not signed in"}</p>
            <p className="mt-1">{allowance}</p>
          </div>
        </aside>
        <main className="min-h-0 overflow-auto p-6">
          {error ? (
            <p className="mb-4 rounded-xl border border-[#ff5d73]/40 bg-[#ff5d73]/10 px-4 py-3 text-sm text-[#ffd0d6]">{error}</p>
          ) : null}
          {section === "home" ? (
            <Home
              account={account}
              bridgeRunning={bridgeRunning}
              minecraft={minecraft}
              executor={executor}
              ai={ai}
              onNavigate={setSection}
            />
          ) : null}
          {section === "studio" ? (
            <Studio
              preview={preview}
              jobId={jobId}
              voice={voice}
              setVoice={setVoice}
              onPreview={async (text) => {
                setError("");
                const local = localPreview(text);
                setPreview(local);
                try {
                  const remote = await call<PreviewResult>("bridge.command", { text });
                  setPreview({ ...local, bridge: remote.bridge, description: remote.description || local.description });
                } catch (reason) {
                  setPreview({ ...local, bridge: reason instanceof Error ? reason.message : "Bridge did not accept the command." });
                }
              }}
              onApprove={async () => {
                if (!jobId) {
                  setError("Preview the command and wait for the bridge to assign a job before approving.");
                  return;
                }
                await call("bridge.approve", { jobId });
              }}
              onCancel={() => void call("bridge.cancel").catch((reason) => setError(String(reason)))}
              onPause={() => void call("bridge.pause").catch((reason) => setError(String(reason)))}
              onResume={() => void call("bridge.resume").catch((reason) => setError(String(reason)))}
              onPlan={async (prompt) => {
                const result = await call<{ plan: { summary: string; parts: Array<Record<string, unknown>> } }>("ollama.plan", { prompt });
                const first = result.plan.parts[0];
                const instruction = planToInstruction(first as Parameters<typeof planToInstruction>[0], prompt);
                setPreview(localPreview(describeInstruction(instruction)));
                setAi(result.plan.summary);
              }}
            />
          ) : null}
          {section === "catalog" ? (
            <Catalog
              bridgeRunning={bridgeRunning}
              jobId={jobId}
              planWarnings={planWarnings}
              onPrepare={async (instruction, description) => {
                setError("");
                setJobId("");
                setPlanWarnings([]);
                const remote = await call<PreviewResult>("bridge.command", { text: description, instruction });
                setPreview({ ...remote, description: remote.description || description });
              }}
              onApprove={async () => {
                if (!jobId) {
                  setError("Prepare the blueprint and wait for the bridge job before approving.");
                  return;
                }
                await call("bridge.approve", { jobId });
              }}
              onPause={() => void call("bridge.pause").catch((reason) => setError(String(reason)))}
              onResume={() => void call("bridge.resume").catch((reason) => setError(String(reason)))}
              onCancel={() => void call("bridge.cancel").catch((reason) => setError(String(reason)))}
            />
          ) : null}
          {section === "library" ? <Library onUse={(text) => { setSection("studio"); setPreview(localPreview(text)); }} /> : null}
          {section === "companion" ? <CompanionPanel /> : null}
          {section === "history" ? <History onError={setError} /> : null}
          {section === "connections" ? (
            <Connections
              settings={settings}
              running={bridgeRunning}
              onStart={async (payload) => {
                await call("bridge.start", payload);
                setBridgeRunning(true);
              }}
              onStop={async () => {
                await call("bridge.stop");
                setBridgeRunning(false);
              }}
              onError={setError}
            />
          ) : null}
          {section === "settings" ? (
            <Settings
              settings={settings}
              onSave={async (next) => setSettings(await call("settings.set", next))}
              onSignIn={async () => setAccount(await call("auth.signIn"))}
              onPassword={async (email, password) => setAccount(await call("auth.password", { email, password }))}
              onSignOut={async () => setAccount(await call("auth.signOut"))}
              onOllama={async () => {
                const health = await call<{ models: string[] }>("ollama.health");
                setAi(health.models.length ? `Models: ${health.models.join(", ")}` : "Ollama is up, with no models installed.");
              }}
              onOpen={(path) => void call("shell.open", { path })}
              ai={ai}
              onError={setError}
            />
          ) : null}
          <section className="mt-6">
            <h2 className="text-sm font-medium text-[#93a0b8]">Activity</h2>
            <ul className="mt-2 max-h-36 space-y-1 overflow-auto font-mono text-xs text-[#9fb0c9]">
              {log.map((line, index) => (
                <li key={`${line}-${index}`}>{line}</li>
              ))}
            </ul>
          </section>
        </main>
      </div>
      <footer className="border-t border-white/10 bg-[#08101d]">
        {progress !== null && executor !== "idle" ? (
          <div className="px-4 pt-2">
            <div className="mb-1 flex justify-between text-xs text-[#93a0b8]">
              <span>Build executor: {executor}</span>
              <span>{progress}% confirmed placements</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-[#2f7bff]" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2 px-4 py-2 text-xs text-[#93a0b8] md:grid-cols-5">
          <span>Minecraft: {minecraft}</span>
          <span>Voice: {voice}</span>
          <span>AI: {ai}</span>
          <span>Executor: {executor}</span>
          <span>Account: {account.signedIn ? account.subscription || "signed in" : "signed out"}</span>
        </div>
      </footer>
    </div>
  );
}

function Home({
  account,
  bridgeRunning,
  minecraft,
  executor,
  ai,
  onNavigate,
}: {
  account: AccountState;
  bridgeRunning: boolean;
  minecraft: string;
  executor: string;
  ai: string;
  onNavigate: (section: Section) => void;
}) {
  return (
    <section>
      <p className="text-xs uppercase tracking-[0.18em] text-[#7eb6ff]">Command center</p>
      <h2 className="mt-2 text-3xl font-semibold">Speak it. Preview it. Build it.</h2>
      <p className="mt-3 max-w-2xl text-sm text-[#93a0b8]">
        This window is the product. It loads from files shipped with the app. Minecraft changes happen only after a
        preview, an approval, and a server-side entitlement check.
      </p>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {[
          ["Bridge", bridgeRunning ? "Process running" : "Stopped"],
          ["Minecraft", minecraft],
          ["Executor", executor],
          ["Account", account.email || account.reason || "Signed out"],
          ["Subscription", account.subscription || "Unknown until sign-in"],
          ["Local AI", ai],
        ].map(([label, value]) => (
          <article key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wider text-[#93a0b8]">{label}</p>
            <p className="mt-2 text-sm">{value}</p>
          </article>
        ))}
      </div>
      {!bridgeRunning ? (
        <p className="mt-5 rounded-2xl border border-dashed border-white/15 p-4 text-sm text-[#c5d2ea]">
          The bridge is not running. Open Connections, enter the Minecraft host and LAN port, then start it.
          <button className="ml-3 underline" onClick={() => onNavigate("connections")}>Go to Connections</button>
        </p>
      ) : null}
    </section>
  );
}

function Studio({
  preview,
  jobId,
  voice,
  setVoice,
  onPreview,
  onApprove,
  onCancel,
  onPause,
  onResume,
  onPlan,
}: {
  preview: PreviewResult | null;
  jobId: string;
  voice: string;
  setVoice: (value: string) => void;
  onPreview: (text: string) => Promise<void>;
  onApprove: () => Promise<void>;
  onCancel: () => void;
  onPause: () => void;
  onResume: () => void;
  onPlan: (prompt: string) => Promise<void>;
}) {
  const [text, setText] = useState("preview a large stone mansion");
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState("");

  function toggleVoice() {
    const recognitionCtor = (window as unknown as { SpeechRecognition?: new () => BrowserSpeech; webkitSpeechRecognition?: new () => BrowserSpeech }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => BrowserSpeech }).webkitSpeechRecognition;
    if (!recognitionCtor) {
      setVoice("Unavailable");
      setNote("Speech recognition is not available here. Type the command instead. No paid speech service is used.");
      return;
    }
    if (listening) {
      setListening(false);
      setVoice("Idle");
      return;
    }
    const recognition = new recognitionCtor();
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript || "").join(" ");
      setText(transcript);
      setVoice(event.results[event.results.length - 1]?.isFinal ? "Transcript ready" : "Listening");
    };
    recognition.onerror = () => {
      setListening(false);
      setVoice("Error");
      setNote("The microphone did not produce a transcript. Check the OS permission and type the command.");
    };
    recognition.onend = () => setListening(false);
    recognition.start();
    setListening(true);
    setVoice("Listening — microphone is on");
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <div>
        <h2 className="text-2xl font-semibold">Build Studio</h2>
        <p className="mt-1 text-sm text-[#93a0b8]">Transcription and the interpreted action stay visible before approval.</p>
        <textarea value={text} onChange={(event) => setText(event.target.value)} className="mt-4 h-24 w-full rounded-2xl border border-white/10 bg-black/30 p-3" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="rounded-xl bg-white/10 px-4 py-2" onClick={toggleVoice}>{listening ? "Stop microphone" : "Push to talk"}</button>
          <button className="rounded-xl bg-[#2f7bff] px-4 py-2" onClick={() => void onPreview(text)}>Preview</button>
          <button className="rounded-xl bg-[#3dd6a5] px-4 py-2 text-[#06281d]" onClick={() => void onApprove()} disabled={!jobId}>Approve build</button>
          <button className="rounded-xl bg-white/10 px-4 py-2" onClick={onPause}>Pause</button>
          <button className="rounded-xl bg-white/10 px-4 py-2" onClick={onResume}>Resume</button>
          <button className="rounded-xl bg-[#ff5d73]/20 px-4 py-2" onClick={onCancel}>Stop</button>
          <button
            className="rounded-xl bg-white/10 px-4 py-2"
            onClick={() => {
              const instruction = preview?.instruction;
              if (!instruction?.valid || instruction.structure === "unknown" || !instruction.dimensions) {
                setNote("Preview a valid structure before saving it.");
                return;
              }
              void call("library.save", {
                blueprint: {
                  name: instruction.structure,
                  category: instruction.structure,
                  structure: instruction.structure,
                  material: instruction.material,
                  size: "medium",
                  floors: instruction.floors,
                  dimensions: instruction.dimensions,
                },
              }).then(() => setNote("Blueprint saved locally.")).catch((reason) => setNote(reason instanceof Error ? reason.message : "Could not save the blueprint."));
            }}
          >
            Save blueprint
          </button>
        </div>
        <p className="mt-3 text-xs text-[#93a0b8]">Voice: {voice}. {note}</p>
        <p className="mt-2 text-sm">{preview?.description || "No plan yet."}</p>
        {preview?.bridge ? <p className="mt-2 text-sm text-[#ffd0a8]">{preview.bridge}</p> : null}
        {preview?.instruction?.warnings?.map((warning) => (
          <p key={warning} className="mt-1 text-xs text-[#ffd0a8]">{warning}</p>
        ))}
        <div className="mt-4">
          <label className="text-xs uppercase tracking-wider text-[#93a0b8]">Optional local Ollama plan</label>
          <button
            className="mt-2 rounded-xl border border-white/10 px-4 py-2 text-sm"
            onClick={() => void onPlan(text).catch((reason) => setNote(reason instanceof Error ? reason.message : "Ollama plan failed."))}
          >
            Ask local model
          </button>
          <p className="mt-2 text-xs text-[#93a0b8]">The model can only return known structures. It cannot run Minecraft commands. Ordinary commands still work if Ollama is off.</p>
        </div>
      </div>
      <div>
        <VoxelPreview blocks={preview?.blocks || []} limited={preview?.limited} />
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-white/5 p-3"><dt className="text-xs text-[#93a0b8]">Blocks</dt><dd>{preview?.count ?? "—"}</dd></div>
          <div className="rounded-xl bg-white/5 p-3"><dt className="text-xs text-[#93a0b8]">Job</dt><dd className="truncate">{jobId || "Waiting for bridge"}</dd></div>
        </dl>
      </div>
    </section>
  );
}

function Library({ onUse }: { onUse: (text: string) => void }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState("Saved blueprints live in the local database.");
  async function refresh() {
    setRows(await call("library.list"));
  }
  useEffect(() => {
    void refresh().catch((error) => setMessage(error instanceof Error ? error.message : "Library unavailable."));
  }, []);
  return (
    <section>
      <h2 className="text-2xl font-semibold">Blueprint library</h2>
      <p className="mt-1 text-sm text-[#93a0b8]">{message} Sponge and Litematic files are rejected with an explicit error.</p>
      <div className="mt-4 grid gap-3">
        {rows.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-4 text-sm">No blueprints yet. Save one from a preview in Build Studio after the bridge is running, or import ZeroPulse JSON.</p> : null}
        {rows.map((row) => (
          <article key={String(row.id)} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 p-4">
            <div>
              <h3 className="font-medium">{String(row.name)}</h3>
              <p className="text-xs text-[#93a0b8]">{String(row.category)} · {String(row.structure)} · {String(row.width)}×{String(row.depth)}×{String(row.height)}</p>
            </div>
            <div className="flex gap-2">
              <button className="rounded-lg bg-white/10 px-3 py-1 text-sm" onClick={() => onUse(`build a ${row.material} ${row.structure} ${row.width} by ${row.depth} by ${row.height}`)}>Preview</button>
              <button className="rounded-lg bg-white/10 px-3 py-1 text-sm" onClick={() => void call("library.duplicate", { id: row.id }).then(refresh)}>Duplicate</button>
              <button className="rounded-lg bg-white/10 px-3 py-1 text-sm" onClick={() => void call("library.favorite", { id: row.id, favorite: !row.favorite }).then(refresh)}>{row.favorite ? "Unfavorite" : "Favorite"}</button>
              <button className="rounded-lg bg-white/10 px-3 py-1 text-sm" onClick={() => void call<{ text: string }>("library.export", { id: row.id }).then((file) => navigator.clipboard.writeText(file.text)).then(() => setMessage("Blueprint JSON copied."))}>Export</button>
              <button className="rounded-lg bg-[#ff5d73]/20 px-3 py-1 text-sm" onClick={() => void call("library.delete", { id: row.id }).then(refresh)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
      <label className="mt-4 block text-sm">
        Import JSON
        <textarea
          className="mt-2 h-24 w-full rounded-2xl border border-white/10 bg-black/30 p-3"
          placeholder="Paste a zeropulse-blueprint-v1 file"
          onBlur={(event) => {
            if (!event.target.value.trim()) return;
            void call("library.import", { text: event.target.value }).then(refresh).catch((error) => setMessage(error instanceof Error ? error.message : "Import failed."));
          }}
        />
      </label>
    </section>
  );
}

function History({ onError }: { onError: (message: string) => void }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    void call<Array<Record<string, unknown>>>("history.list").then(setRows).catch((error) => onError(error instanceof Error ? error.message : "History unavailable."));
  }, [onError]);
  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Build history</h2>
        <div className="flex gap-2">
          <button className="rounded-xl bg-white/10 px-3 py-2 text-sm" onClick={() => void call("history.undo").catch((error) => onError(error instanceof Error ? error.message : "Undo failed."))}>Undo last supported build</button>
          <button className="rounded-xl bg-white/10 px-3 py-2 text-sm" onClick={() => void call("history.redo").catch((error) => onError(error instanceof Error ? error.message : "Redo failed."))}>Redo</button>
        </div>
      </div>
      <p className="mt-2 text-sm text-[#93a0b8]">Undo restores recorded blocks only where the world still matches. Containers are excluded. A cancelled build is not listed as completed.</p>
      {rows.length === 0 ? <p className="mt-4 rounded-2xl border border-dashed border-white/15 p-4 text-sm">No local builds recorded yet.</p> : null}
      <div className="mt-4 grid gap-2">
        {rows.map((row) => (
          <article key={String(row.id)} className="rounded-2xl border border-white/10 p-4 text-sm">
            <p className="font-medium">{String(row.structure || row.action)} · {String(row.status)}</p>
            <p className="text-xs text-[#93a0b8]">{String(row.started_at)} · placed {String(row.placed)} · failed {String(row.failed)} · undo {row.undo_available ? "available" : "unavailable"}</p>
            {row.note ? <p className="mt-1 text-xs">{String(row.note)}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function Connections({
  settings,
  running,
  onStart,
  onStop,
  onError,
}: {
  settings: Record<string, unknown>;
  running: boolean;
  onStart: (payload: Record<string, unknown>) => Promise<void>;
  onStop: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [host, setHost] = useState(String(settings.minecraftHost || "localhost"));
  const [port, setPort] = useState(String(settings.minecraftPort || 25565));
  const [username, setUsername] = useState(String(settings.minecraftUsername || "ZeroPulse"));
  const [version, setVersion] = useState(String(settings.minecraftVersion || ""));
  const [authMode, setAuth] = useState(settings.minecraftAuth === "microsoft" ? "microsoft" : "offline");
  useEffect(() => {
    setHost(String(settings.minecraftHost || "localhost"));
    setPort(String(settings.minecraftPort || 25565));
    setUsername(String(settings.minecraftUsername || "ZeroPulse"));
    setVersion(String(settings.minecraftVersion || ""));
    setAuth(settings.minecraftAuth === "microsoft" ? "microsoft" : "offline");
  }, [settings]);
  return (
    <section className="max-w-xl">
      <h2 className="text-2xl font-semibold">Connections</h2>
      <p className="mt-2 text-sm text-[#93a0b8]">The bridge binds to 127.0.0.1 and requires a token held by this app. Java worlds need cheats or operator rights. Survival building is reported as unavailable.</p>
      <label className="mt-4 block text-sm">Host<input className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" value={host} onChange={(event) => setHost(event.target.value)} /></label>
      <label className="mt-3 block text-sm">Port<input className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" value={port} onChange={(event) => setPort(event.target.value)} /></label>
      <label className="mt-3 block text-sm">Bot username<input className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
      <label className="mt-3 block text-sm">Version (optional)<input className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" value={version} onChange={(event) => setVersion(event.target.value)} placeholder="1.20.4" /></label>
      <label className="mt-3 block text-sm">Authentication
        <select className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" value={authMode} onChange={(event) => setAuth(event.target.value)}>
          <option value="offline">Offline / LAN</option>
          <option value="microsoft">Microsoft</option>
        </select>
      </label>
      <div className="mt-4 flex gap-2">
        <button className="rounded-xl bg-[#2f7bff] px-4 py-2" onClick={() => void onStart({ host, port: Number(port), username, version, auth: authMode, bridgePort: Number(settings.bridgePort || 8765) }).catch((error) => onError(error instanceof Error ? error.message : "Could not start the bridge."))}>{running ? "Restart bridge" : "Start bridge"}</button>
        <button className="rounded-xl bg-white/10 px-4 py-2" onClick={() => void onStop()}>Stop bridge</button>
      </div>
      <p className="mt-4 text-sm text-[#93a0b8]">Bedrock and console gateways are not part of this build. In-game chat commands stay off unless you explicitly enable them in Settings, and they still cannot approve destructive actions.</p>
    </section>
  );
}

function Settings({
  settings,
  onSave,
  onSignIn,
  onPassword,
  onSignOut,
  onOllama,
  onOpen,
  ai,
  onError,
}: {
  settings: Record<string, unknown>;
  onSave: (next: Record<string, unknown>) => Promise<void>;
  onSignIn: () => Promise<void>;
  onPassword: (email: string, password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onOllama: () => Promise<void>;
  onOpen: (path: string) => void;
  ai: string;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  useEffect(() => setDraft(settings), [settings]);
  const field = (key: string, label: string) => (
    <label className="block text-sm" key={key}>{label}
      <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2" value={String(draft[key] ?? "")} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
    </label>
  );
  return (
    <section className="max-w-2xl">
      <h2 className="text-2xl font-semibold">Settings</h2>
      <div className="mt-4 grid gap-3">
        {field("appOrigin", "Account website")}
        {field("supabaseUrl", "Supabase URL")}
        {field("supabasePublishableKey", "Supabase publishable key")}
        {field("ollamaUrl", "Ollama URL")}
        {field("ollamaModel", "Ollama model")}
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(draft.chatControl)} onChange={(event) => setDraft({ ...draft, chatControl: event.target.checked })} />
        Allow allowlisted in-game chat to request previews. Destructive chat actions stay blocked.
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-xl bg-[#2f7bff] px-4 py-2" onClick={() => void onSave(draft).catch((error) => onError(error instanceof Error ? error.message : "Could not save settings."))}>Save settings</button>
        <button className="rounded-xl bg-white/10 px-4 py-2" onClick={() => void onSignIn().catch((error) => onError(error instanceof Error ? error.message : "Browser sign-in failed."))}>Sign in with browser</button>
        <button className="rounded-xl bg-white/10 px-4 py-2" onClick={() => void onSignOut()}>Sign out</button>
        <button className="rounded-xl bg-white/10 px-4 py-2" onClick={() => void onOllama().catch((error) => onError(error instanceof Error ? error.message : "Ollama is not reachable."))}>Check Ollama</button>
        <button className="rounded-xl bg-white/10 px-4 py-2" onClick={() => onOpen("/download")}>Account downloads</button>
        <button className="rounded-xl bg-white/10 px-4 py-2" onClick={() => onOpen("/get-started")}>Setup guide</button>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
        <input className="rounded-xl border border-white/10 bg-black/30 px-3 py-2" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <input className="rounded-xl border border-white/10 bg-black/30 px-3 py-2" placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <button className="rounded-xl bg-white/10 px-4 py-2" onClick={() => void onPassword(email, password).catch((error) => onError(error instanceof Error ? error.message : "Password sign-in failed."))}>Sign in</button>
      </div>
      <p className="mt-3 text-xs text-[#93a0b8]">Passwords are sent only to your Supabase project and are not written to logs. Sessions use OS encryption when the platform provides it. {ai}</p>
    </section>
  );
}

interface BrowserSpeech extends EventTarget {
  interimResults: boolean;
  start: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
