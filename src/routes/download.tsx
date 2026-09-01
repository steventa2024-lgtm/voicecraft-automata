import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Terminal, ShieldCheck, Cpu, Monitor, Smartphone, Apple } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import windowsCompanion from "@/assets/zeropulse-windows.zip.asset.json";
import macCompanion from "@/assets/zeropulse-macos.zip.asset.json";

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
    title: "1 · Download the companion",
    body: "Choose Windows or macOS above, unzip the entire download, then open ZeroPulse Companion.",
  },
  {
    icon: Cpu,
    title: "2 · Open Minecraft",
    body: "Open a Java Edition world to LAN with cheats enabled and copy the port shown in chat.",
  },
  {
    icon: ShieldCheck,
    title: "3 · Start the companion",
    body: "Enter that LAN port and the pairing code from your dashboard, then press Start bridge.",
  },
  {
    icon: Smartphone,
    title: "4 · Speak from any device",
    body: "Use Relay mode on desktop or mobile. Only send commands after the status says Connected.",
  },
];

const DESKTOP_DOWNLOADS = [
  {
    icon: Monitor,
    title: "Windows companion",
    detail: "Windows 10/11 · x64 · no Node.js required",
    href: windowsCompanion.url,
  },
  {
    icon: Apple,
    title: "macOS companion",
    detail: "Intel Mac · ZIP archive · no Node.js required",
    href: macCompanion.url,
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
            The companion connects your dashboard to Minecraft Java and places blocks with a
            Mineflayer bot. Download the desktop app below, start it beside your game, then pair the
            dashboard.
        </p>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {DESKTOP_DOWNLOADS.map((item) => (
            <a key={item.title} href={item.href} download className="glass group rounded-2xl p-5 transition hover:border-primary/50">
              <item.icon className="size-6 text-primary" />
              <h2 className="mt-4 font-display text-lg font-semibold">{item.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
                <Download className="size-4" /> Download ZIP
              </span>
            </a>
          ))}
        </section>

        <section className="glass mt-5 flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-display font-semibold"><Smartphone className="size-5 text-accent" /> iPhone & Android controller</h2>
            <p className="mt-1 text-sm text-muted-foreground">Open the dashboard in Safari or Chrome, then choose Add to Home Screen / Install app.</p>
          </div>
          <Link to="/dashboard" className="shrink-0 rounded-xl bg-primary px-5 py-3 text-center text-sm font-medium text-primary-foreground transition hover:bg-primary-glow">Open mobile dashboard</Link>
        </section>
        <p className="mt-3 text-xs text-muted-foreground">
          A phone can be the voice controller. Minecraft Java and the companion must still run on a Windows/Mac/Linux computer or hosted game server; iOS and Android cannot run a Mineflayer Java bridge locally.
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
          <h2 className="font-display text-base font-semibold">
            Desktop companion — no Node.js required
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Unzip the download, open ZeroPulse Companion, enter the LAN port shown by Minecraft,
            copy the dashboard pairing code into the app, then press Start bridge. Keep the app
            running while you issue commands. The source-code ZIP remains available for Linux and
            advanced users.
          </p>
          <pre className="mt-3 overflow-auto rounded-xl border border-border/70 bg-background/70 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
            {`1. Minecraft Java → Esc → Open to LAN → Allow Cheats: ON
2. Open ZeroPulse Companion and enter the LAN port
3. Dashboard → Relay (anywhere) → copy its pairing code
4. Paste the same code into Companion → Start bridge
5. Wait for “Minecraft connected”, then speak`}
          </pre>
          <a href="/downloads/zeropulse-bridge.zip" download className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline"><Terminal className="size-4" /> Download source version (Node.js 18+)</a>
        </div>

        <div className="glass mt-8 rounded-2xl p-6">
          <h2 className="font-display text-base font-semibold">Before you open it</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><span className="text-foreground">Windows:</span> extract the full ZIP, then run <span className="font-mono text-primary">ZeroPulseCompanion.exe</span>.</li>
            <li><span className="text-foreground">macOS:</span> extract the ZIP, then Control-click the app and choose Open. This preview build is unsigned.</li>
            <li><span className="text-foreground">Phone/tablet:</span> install the dashboard from the browser; do not download the desktop ZIP to your phone.</li>
          </ul>
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
