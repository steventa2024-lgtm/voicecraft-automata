import { useEffect, useState } from "react";

type CompanionStatus = {
  name: string;
  account: string | null;
  platform: string;
  version: string;
  listening: boolean;
  addresses: string[];
  port: number;
  encrypted: boolean;
  transport: string;
  permissions: { build: boolean; view: boolean; input: boolean };
  remoteDesktop: string;
  remoteDesktopReason: string;
  devices: Array<{ id: string; name: string; pairedAt: number }>;
  bridgeRunning: boolean;
  activeJob: { status?: string; progress?: number | null } | null;
};

async function call<T>(channel: string, payload?: unknown): Promise<T> {
  if (!window.zeropulse) throw new Error("Open this screen inside the ZeroPulse desktop app.");
  return (await window.zeropulse.invoke(channel, payload)) as T;
}

export function CompanionPanel() {
  const [status, setStatus] = useState<CompanionStatus | null>(null);
  const [pairing, setPairing] = useState<{ code: string; expiresAt: number; addresses: string[]; port: number } | null>(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    setStatus(await call<CompanionStatus>("companion.status"));
  }

  useEffect(() => {
    void refresh().catch((error) => setMessage(error instanceof Error ? error.message : "Companion status is unavailable."));
  }, []);

  return (
    <section className="max-w-3xl">
      <h2 className="text-2xl font-semibold">Mobile Companion</h2>
      <p className="mt-1 text-sm text-[#93a0b8]">Pair a phone on this private network. The phone can request VoiceCraft build actions. It cannot run programs or open the desktop.</p>
      <div className="mt-4 grid gap-3 rounded-3xl border border-white/10 bg-[#0b1730] p-4 text-sm">
        <p>PC {status?.name || "—"} · {status?.platform || "—"} · app {status?.version || "—"}</p>
        <p>Account {status?.account || "Not signed in"}</p>
        <p>Bridge {status?.bridgeRunning ? "running" : "not running"}</p>
        <p>Build {status?.activeJob?.status || "idle"}{typeof status?.activeJob?.progress === "number" ? ` · ${Math.round(status.activeJob.progress * 100)}%` : ""}</p>
        <p>{status?.transport}</p>
        <p className="text-[#ffd0a8]">{status?.remoteDesktopReason}</p>
      </div>
      {status?.devices.length ? (
        <p className="mt-4 rounded-2xl border border-[#2f7bff]/50 bg-[#2f7bff]/10 px-4 py-3 text-sm">Phone paired. Screen sharing is off. Remote builds are {status.permissions.build ? "allowed" : "blocked"}.</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-xl bg-[#2f7bff] px-4 py-2" onClick={() => void call<typeof pairing>("companion.arm").then((next) => { setPairing(next); setMessage(""); void refresh(); }).catch((error) => setMessage(error instanceof Error ? error.message : "Could not start pairing."))}>Pair phone</button>
        <button className="rounded-xl bg-white/10 px-4 py-2" onClick={() => void refresh()}>Refresh</button>
        <button className="rounded-xl bg-[#ff5d73]/20 px-4 py-2" onClick={() => void call("companion.stop").then(() => { setPairing(null); return refresh(); })}>Stop all sessions</button>
      </div>
      {pairing ? (
        <div className="mt-4 rounded-3xl border border-[#2f7bff] bg-black/30 p-4">
          <p className="text-xs uppercase tracking-wider text-[#7eb6ff]">One-time code</p>
          <p className="mt-2 font-mono text-3xl">{pairing.code}</p>
          <p className="mt-2 text-sm text-[#93a0b8]">Expires {new Date(pairing.expiresAt).toLocaleTimeString()}. Use it once. Addresses: {pairing.addresses.join(", ") || "no private address"} port {pairing.port}.</p>
        </div>
      ) : null}
      <div className="mt-4 grid gap-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(status?.permissions.build)} onChange={(event) => void call<CompanionStatus>("companion.permissions", { build: event.target.checked }).then(setStatus)} /> Allow remote build actions</label>
        <label className="flex items-center gap-2 text-sm text-[#93a0b8]"><input type="checkbox" checked={false} disabled /> Allow remote desktop viewing</label>
        <label className="flex items-center gap-2 text-sm text-[#93a0b8]"><input type="checkbox" checked={false} disabled /> Allow remote desktop input</label>
      </div>
      <div className="mt-4 grid gap-2">
        {(status?.devices || []).map((device) => (
          <div key={device.id} className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2 text-sm">
            <span>{device.name}</span>
            <button className="rounded-lg bg-[#ff5d73]/20 px-3 py-1" onClick={() => void call<CompanionStatus>("companion.revoke", { deviceId: device.id }).then(setStatus)}>Revoke</button>
          </div>
        ))}
        {status && status.devices.length === 0 ? <p className="text-sm text-[#93a0b8]">No phone is paired.</p> : null}
      </div>
      {message ? <p className="mt-3 text-sm text-[#ffd0a8]">{message}</p> : null}
    </section>
  );
}
