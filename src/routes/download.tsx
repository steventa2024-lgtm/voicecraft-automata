import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Terminal, ShieldCheck, Cpu } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: "Download the ZeroPulse Bridge — Local Minecraft Companion" },
      {
        name: "description",
        content:
          "Install the ZeroPulse local bridge: a Node.js companion that connects Mineflayer to your Minecraft Java world and executes voice build orders.",
      },
      { property: "og:title", content: "Download the ZeroPulse Bridge" },
      {
        property: "og:description",
        content: "Node.js companion app linking your dashboard to Minecraft Java via Mineflayer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DownloadPage,
});

const STEPS = [
  {
    icon: Download,
    title: "1 · Download & unzip",
    body: "Grab zeropulse-bridge.zip and extract it anywhere on the machine running Minecraft Java Edition.",
  },
  {
    icon: Terminal,
    title: "2 · Install & run",
    body: "Run npm install then npm start. The bridge opens a local WebSocket server on port 8765.",
  },
  {
    icon: Cpu,
    title: "3 · Open to LAN",
    body: "In Minecraft press Esc → Open to LAN, note the port, and set MC_PORT in the bridge .env file.",
  },
  {
    icon: ShieldCheck,
    title: "4 · Connect the dashboard",
    body: "Hit Connect bridge in the dashboard. Traffic never leaves your machine — the browser talks to localhost only.",
  },
];

function DownloadPage() {
  return (
    <div className="min-h-screen hero-aura">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-5 py-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Install the <span className="text-gradient">local bridge</span>
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          The bridge is a small Node.js companion. It hosts a WebSocket server for the dashboard and
          drives a Mineflayer bot that places blocks inside your world.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href="/downloads/zeropulse-bridge.zip"
            download
            className="glow-ring inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-medium text-primary-foreground transition hover:bg-primary-glow"
          >
            <Download className="size-4" /> Download bridge (.zip)
          </a>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3.5 font-medium transition hover:bg-secondary"
          >
            Open dashboard
          </Link>
        </div>
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          Requires Node.js 18+ · Minecraft Java Edition 1.20+ · Windows, macOS, Linux
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {STEPS.map((s) => (
            <div key={s.title} className="glass rounded-2xl p-5">
              <s.icon className="size-5 text-primary" />
              <h2 className="mt-3 font-display text-base font-semibold">{s.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="glass mt-8 rounded-2xl p-6">
          <h2 className="font-display text-base font-semibold">Quick start</h2>
          <pre className="mt-3 overflow-auto rounded-xl border border-border/70 bg-background/70 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
            {`unzip zeropulse-bridge.zip && cd zeropulse-bridge
npm install
cp .env.example .env      # set MC_HOST / MC_PORT / MC_USERNAME
npm start                 # ws://localhost:8765`}
          </pre>
        </div>

        <div className="glass mt-8 rounded-2xl p-6">
          <h2 className="font-display text-base font-semibold">
            Desktop companion — no Node.js required
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The ZeroPulse Companion wraps the same bridge in a desktop app that ships its own
            runtime. Launch it, fill in your LAN port, press{" "}
            <span className="font-mono text-foreground">Start bridge</span>, and the dashboard
            connects automatically. Windows x64 and macOS builds are produced from this repo with{" "}
            <span className="font-mono text-foreground">./desktop/build.sh</span> — they are ~160 MB
            (Windows) and ~390 MB (macOS) because the Electron runtime and the full Minecraft
            protocol dataset are bundled, so they are distributed as release artifacts rather than
            from this page.
          </p>
          <pre className="mt-3 overflow-auto rounded-xl border border-border/70 bg-background/70 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
            {`./desktop/build.sh                        # Windows x64 + macOS x64
PLATFORMS=darwin ARCH=arm64 ./desktop/build.sh   # Apple Silicon`}
          </pre>
        </div>

        <div className="glass mt-8 rounded-2xl p-6">
          <h2 className="font-display text-base font-semibold">How blocks get placed</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            On spawn the bot probes for operator rights. With cheats or op it builds using{" "}
            <span className="font-mono text-foreground">/fill</span> and{" "}
            <span className="font-mono text-foreground">/setblock</span> for near-instant results.
            Without op it falls back to real hand placement: the creative inventory API loads each
            block, the bot flies to the spot and clicks the neighbouring face. The dashboard shows
            which mode is active and reports the exact world coordinates when a build finishes.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
