import { createFileRoute, Link } from "@tanstack/react-router";
import { Mic, Cpu, Boxes, Download, Waves, Zap, ShieldCheck, Terminal } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import heroImage from "@/assets/hero-voxel.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZeroPulse VoiceCraft — Speak it. Preview it. Build it." },
      {
        name: "description",
        content:
          "ZeroPulse turns spoken commands into automated Minecraft builds. Download the local Mineflayer bridge and control your world with your voice.",
      },
      { property: "og:title", content: "ZeroPulse — Say It, Build It in Minecraft" },
      {
        property: "og:description",
        content:
          "Voice-controlled Minecraft construction in a downloadable Windows desktop application.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const PIPELINE = [
  {
    icon: Mic,
    title: "Speak",
    body: "Talk or type inside the desktop app. Transcription stays on screen before anything is approved.",
  },
  {
    icon: Cpu,
    title: "Parse",
    body: "ZeroPulse resolves intent, structure, material, scale and floor count into a typed build instruction.",
  },
  {
    icon: Boxes,
    title: "Build",
    body: "After you approve the preview, the local bridge places the validated plan in Minecraft Java.",
  },
];

const FEATURES = [
  { icon: Zap, title: "Sub-second dispatch", body: "Commands hit your bot over a localhost socket." },
  {
    icon: ShieldCheck,
    title: "Runs on your machine",
    body: "No world data leaves your PC. The bridge is local-only by design.",
  },
  {
    icon: Terminal,
    title: "Hackable routines",
    body: "Every generator is plain JavaScript — fork the mansion, add your own.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden hero-aura">
        <div className="absolute inset-0 grid-backdrop opacity-70" aria-hidden />
        <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-5 py-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-28">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              <Waves className="size-3.5" /> Voice automation for Minecraft Java
            </span>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Speak it. Preview it. <span className="text-gradient">Build it.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              ZeroPulse VoiceCraft is a Windows desktop application for Minecraft Java. Speak or
              type a structure, inspect the block plan, and approve it before the local builder
              changes the world.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/download"
                className="glow-ring inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-medium text-primary-foreground transition hover:bg-primary-glow"
              >
                <Download className="size-4" /> Download for Windows
              </Link>
              <Link
                to="/get-started"
                className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3.5 font-medium transition hover:bg-secondary"
              >
                <Mic className="size-4" /> Installation guide
              </Link>
            </div>
            <p className="mt-4 font-mono text-xs text-muted-foreground">
              Node 18+ · Minecraft Java 1.20+ · Windows / macOS / Linux
            </p>
          </div>

          <div className="animate-float relative">
            <div className="glass glow-ring overflow-hidden rounded-3xl">
              <img
                src={heroImage}
                alt="Holographic voxel mansion assembling block by block"
                width={1600}
                height={1008}
                className="w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="mx-auto w-full max-w-6xl px-5 py-20">
        <h2 className="font-display text-3xl font-semibold tracking-tight">
          Three steps from breath to blocks
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PIPELINE.map((s, i) => (
            <div key={s.title} className="glass rounded-2xl p-6 transition hover:border-primary/40">
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
                  <s.icon className="size-5" />
                </span>
                <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive preview */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-20">
        <div className="glass overflow-hidden rounded-3xl">
          <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
            <span className="size-2.5 rounded-full bg-destructive/70" />
            <span className="size-2.5 rounded-full bg-warning/70" />
            <span className="size-2.5 rounded-full bg-success/70" />
            <span className="ml-3 font-mono text-xs text-muted-foreground">
              zeropulse · control center
            </span>
          </div>
          <div className="grid gap-6 p-6 md:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-background/50 p-6">
              <div className="flex items-center gap-3">
                <span className="animate-pulse-ring grid size-12 place-items-center rounded-full bg-primary/20 text-primary">
                  <Mic className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-medium">Example command</p>
                  <p className="font-mono text-xs text-primary">“build me a large stone mansion”</p>
                </div>
              </div>
              <div className="mt-6 space-y-2 font-mono text-xs text-muted-foreground">
                <p>Illustration only — the app shows live status after you connect.</p>
                <p>→ structure: mansion · material: stone bricks</p>
                <p>→ preview, then explicit approval</p>
                <p>→ placement progress comes from the local bridge</p>
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/50 p-6">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Parsed instruction
              </p>
              <pre className="mt-3 overflow-auto font-mono text-xs leading-relaxed text-muted-foreground">
                {`{
  "action": "build",
  "structure": "mansion",
  "material": "stone_bricks",
  "size": "large",
  "dimensions": { "w": 31, "d": 23, "h": 10 },
  "floors": 2,
  "confidence": 0.94
}`}
              </pre>
            </div>
          </div>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border/60 p-5">
              <f.icon className="size-5 text-accent" />
              <h3 className="mt-3 font-display font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-24">
        <div className="glass glow-ring rounded-3xl p-10 text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            Your world is one sentence away
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Install the desktop app, open your Java world to LAN, and approve the first preview.
          </p>
          <Link
            to="/download"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3.5 font-medium text-primary-foreground transition hover:bg-primary-glow"
          >
            <Download className="size-4" /> Download for Windows
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
