import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  Cpu,
  Download,
  Gamepad2,
  Globe2,
  Loader2,
  LockKeyhole,
  Monitor,
  Network,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@/components/auth-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: "Downloads, Console Setup & Plans — ZeroPulse" },
      {
        name: "description",
        content:
          "Download the protected ZeroPulse Java or Bedrock companion, connect a console, and choose your Minecraft automation plan.",
      },
    ],
  }),
  component: DownloadPage,
});

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 9,
    icon: Cpu,
    tasks: "5 tasks / day",
    blocks: "5,000 blocks / day",
    description: "For focused daily builds and learning the workflow.",
    featured: false,
  },
  {
    id: "builder_pro",
    name: "Builder Pro",
    price: 30,
    icon: Sparkles,
    tasks: "30 tasks / day",
    blocks: "50,000 blocks / day",
    description: "For larger bases and regular creative sessions.",
    featured: true,
  },
  {
    id: "architect",
    name: "Architect",
    price: 75,
    icon: Globe2,
    tasks: "Unlimited tasks",
    blocks: "500,000 blocks / day",
    description: "For cities, mega-builds, and high-volume servers.",
    featured: false,
  },
] as const;

const CONSOLE_GUIDES = {
  xbox: {
    title: "Xbox",
    steps: [
      "Run the ZeroPulse Bedrock Gateway on a PC or server on the same network as the console.",
      "Point the gateway at the Java server or LAN world where the ZeroPulse builder bot connects.",
      "Use a current BedrockConnect DNS method or a LAN-advertising helper to expose the custom server in Xbox's Friends tab.",
      "Join with the Microsoft account you want to use. Floodgate is required when the Java server should accept Bedrock players without Java accounts.",
    ],
  },
  playstation: {
    title: "PlayStation",
    steps: [
      "Start the Bedrock Gateway on an always-on PC or hosted server and allow UDP port 19132 through its firewall.",
      "Use a supported BedrockConnect DNS setup or a BedrockTogether-style LAN helper from a phone on the same Wi-Fi.",
      "Open Minecraft → Play → Friends and select the advertised LAN game, then choose the destination server.",
      "Keep the helper open during discovery. The ZeroPulse builder still runs beside the Java world or server.",
    ],
  },
  switch: {
    title: "Nintendo Switch",
    steps: [
      "Run the Bedrock Gateway and confirm UDP 19132 is reachable from the Switch's network.",
      "Configure a current BedrockConnect DNS server in the Switch network settings; DNS endpoints can change, so use the provider's current values.",
      "Open any featured server to reach the custom-server menu, then enter the gateway's public host and Bedrock port.",
      "Complete Microsoft account pairing when prompted. For internet-hosted gateways, forward UDP 19132 and restrict administration ports.",
    ],
  },
} as const;

function DownloadPage() {
  const auth = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const download = async (kind: "java" | "bedrock") => {
    if (!auth.requireUser()) return;
    setBusy(`download-${kind}`);
    setMessage(null);
    try {
      const response = await auth.authorizedFetch(`/api/downloads/${kind}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Download is unavailable.");
      window.location.assign(body.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Download is unavailable.");
    } finally {
      setBusy(null);
    }
  };

  const checkout = async (planTier: string) => {
    if (!auth.requireUser()) return;
    setBusy(`plan-${planTier}`);
    setMessage(null);
    try {
      const response = await auth.authorizedFetch("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ tier: planTier }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Checkout could not start.");
      window.location.assign(body.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout could not start.");
      setBusy(null);
    }
  };

  const openPortal = async () => {
    if (!auth.requireUser()) return;
    setBusy("portal");
    setMessage(null);
    try {
      const response = await auth.authorizedFetch("/api/billing/portal", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Billing portal could not open.");
      window.location.assign(body.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Billing portal could not open.");
      setBusy(null);
    }
  };

  const activePlan = auth.account?.profile.plan_tier;
  const hasSubscription = ["active", "trialing"].includes(
    auth.account?.profile.subscription_status || "",
  );

  return (
    <div className="min-h-screen hero-aura">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-16">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary">
            <LockKeyhole className="size-3.5" /> Account-protected downloads
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Download the desktop app. <span className="text-gradient">Build from there.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            The Windows installer is the product. It includes the command center, local bridge, and
            Minecraft Java builder. Account and billing stay on this website.
          </p>
        </div>

        {message ? (
          <div className="mt-6 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            {message}
          </div>
        ) : null}

        <section className="mt-10 grid gap-5 md:grid-cols-2">
          <article className="glass rounded-3xl p-6">
            <div className="flex items-start justify-between">
              <span className="grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30">
                <Monitor className="size-6" />
              </span>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-primary">
                Primary
              </span>
            </div>
            <h2 className="mt-5 font-display text-2xl font-semibold">Windows desktop app</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Installable ZeroPulse VoiceCraft application for Minecraft Java. The installer
              bundles the desktop dashboard and local bridge. It does not include Minecraft.
            </p>
            <button
              onClick={() => void download("java")}
              disabled={Boolean(busy)}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground transition hover:bg-primary-glow disabled:opacity-50"
            >
              {busy === "download-java" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Download for Windows
            </button>
          </article>

          <article className="glass rounded-3xl p-6">
            <div className="flex items-start justify-between">
              <span className="grid size-12 place-items-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/30">
                <Gamepad2 className="size-6" />
              </span>
              <span className="rounded-full bg-accent/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-accent">
                Planned
              </span>
            </div>
            <h2 className="mt-5 font-display text-2xl font-semibold">Bedrock gateway</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Native Bedrock automation is not included. Console access would depend on a separate
              Geyser or Floodgate gateway, which is not shipped in this repository.
            </p>
            <button
              type="button"
              disabled
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border font-medium text-muted-foreground"
            >
              Not available in this build
            </button>
          </article>
        </section>

        <section className="mt-16">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-semibold">Console connection hub</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Consoles do not expose a normal custom-server button. These discovery workarounds
              route the console into your Geyser gateway; they do not replace the local ZeroPulse
              builder.
            </p>
          </div>
          <Tabs defaultValue="xbox" className="glass mt-6 rounded-3xl p-5 sm:p-7">
            <TabsList className="grid h-auto w-full grid-cols-3 bg-background/70">
              {Object.entries(CONSOLE_GUIDES).map(([id, guide]) => (
                <TabsTrigger key={id} value={id} className="py-2.5">
                  {guide.title}
                </TabsTrigger>
              ))}
            </TabsList>
            {Object.entries(CONSOLE_GUIDES).map(([id, guide]) => (
              <TabsContent key={id} value={id} className="mt-6">
                <ol className="grid gap-3">
                  {guide.steps.map((step, index) => (
                    <li key={step} className="flex gap-3 rounded-xl border border-border/70 bg-background/50 p-4 text-sm text-muted-foreground">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 font-mono text-xs text-primary">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </TabsContent>
            ))}
          </Tabs>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              [Network, "LAN discovery", "Console and helper must share a network unless the gateway is hosted."],
              [ShieldCheck, "Firewall & ports", "Allow Bedrock UDP 19132; only forward it when internet access is intended."],
              [Smartphone, "Account pairing", "Use a Microsoft account and Floodgate when Bedrock users lack Java accounts."],
            ].map(([Icon, title, body]) => {
              const GuideIcon = Icon as typeof Network;
              return (
                <div key={String(title)} className="rounded-2xl border border-border/70 bg-secondary/30 p-4">
                  <GuideIcon className="size-5 text-primary" />
                  <h3 className="mt-3 text-sm font-medium">{String(title)}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{String(body)}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-20" id="plans">
          <div className="text-center">
            <h2 className="font-display text-3xl font-semibold">Builder plans</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Usage resets at midnight UTC. A task is reserved atomically before the build begins.
            </p>
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {PLANS.map((plan) => {
              const selected = hasSubscription && activePlan === plan.id;
              return (
                <article
                  key={plan.id}
                  className={`relative rounded-3xl border p-6 ${plan.featured ? "border-primary/50 bg-primary/5 shadow-[0_0_40px_hsl(var(--primary)/0.08)]" : "border-border bg-card/50"}`}
                >
                  {plan.featured ? (
                    <span className="absolute right-5 top-5 rounded-full bg-primary px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-primary-foreground">
                      Most popular
                    </span>
                  ) : null}
                  <plan.icon className="size-6 text-primary" />
                  <h3 className="mt-5 font-display text-xl font-semibold">{plan.name}</h3>
                  <div className="mt-3 flex items-end gap-1">
                    <span className="font-display text-4xl font-semibold tracking-tight">
                      ${plan.price}
                    </span>
                    <span className="pb-1 text-sm text-muted-foreground">/ month</span>
                  </div>
                  <p className="mt-2 min-h-10 text-sm text-muted-foreground">{plan.description}</p>
                  <ul className="mt-5 space-y-2.5 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-success" /> {plan.tasks}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-success" /> {plan.blocks}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-success" /> Secure companion verification
                    </li>
                  </ul>
                  <button
                    onClick={() => void (hasSubscription ? openPortal() : checkout(plan.id))}
                    disabled={Boolean(busy) || auth.account?.profile.unlimited_tester}
                    className={`mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium transition disabled:opacity-50 ${plan.featured ? "bg-primary text-primary-foreground hover:bg-primary-glow" : "border border-border bg-secondary hover:border-primary/40"}`}
                  >
                    {busy === `plan-${plan.id}` || (hasSubscription && busy === "portal") ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    {auth.account?.profile.unlimited_tester
                      ? "Unlimited tester active"
                      : selected
                        ? "Manage current plan"
                        : hasSubscription
                          ? "Change in billing portal"
                          : `Choose ${plan.name}`}
                  </button>
                </article>
              );
            })}
          </div>
          {hasSubscription ? (
            <div className="mt-5 text-center">
              <button onClick={() => void openPortal()} className="text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline">
                Update payment method or cancel in the secure billing portal
              </button>
            </div>
          ) : null}
        </section>

        <section className="glass mt-16 rounded-3xl p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold">Java quick start</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["1", "Install", "Sign in and run the Windows installer. Shortcuts are created for you."],
              ["2", "Open LAN", "Enable cheats, open the Java world to LAN, and copy its port."],
              ["3", "Connect", "Enter the host, port, and bot name in the desktop Connections section."],
              ["4", "Approve", "Preview a command in Build Studio, then approve it before blocks change."],
            ].map(([number, title, body]) => (
              <div key={number}>
                <span className="font-mono text-xs text-primary">{number}</span>
                <h3 className="mt-2 text-sm font-medium">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
          <Link to="/world-setup" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            Open the complete world setup guide
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
