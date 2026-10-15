import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Copy, Gamepad2, Globe2, ListChecks, Server, Smartphone } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { makePairCode, normalizeCode } from "@/lib/relay";

export const Route = createFileRoute("/world-setup")({
  head: () => ({
    meta: [
      { title: "World Setup — Prepare Minecraft for ZeroPulse" },
      {
        name: "description",
        content:
          "Create a Minecraft world, open it to LAN, and pair the ZeroPulse bridge so voice commands can place blocks in seconds.",
      },
      { property: "og:title", content: "World Setup — Prepare Minecraft for ZeroPulse" },
      {
        property: "og:description",
        content: "Generate a world, open LAN with cheats, and pair your bot in three steps.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WorldSetup,
});

const STORAGE_KEY = "zeropulse.world";

interface WorldConfig {
  host: string;
  port: string;
  username: string;
  version: string;
  code: string;
}

const DEFAULTS: WorldConfig = {
  host: "localhost",
  port: "25565",
  username: "ZeroPulse",
  version: "",
  code: "",
};

function WorldSetup() {
  const [cfg, setCfg] = useState<WorldConfig>(DEFAULTS);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved = raw ? (JSON.parse(raw) as Partial<WorldConfig>) : {};
      const conn = JSON.parse(localStorage.getItem("zeropulse.connection") || "{}");
      setCfg({
        ...DEFAULTS,
        ...saved,
        code: normalizeCode(saved.code || conn.code || "") || makePairCode(),
      });
    } catch {
      setCfg({ ...DEFAULTS, code: makePairCode() });
    }
  }, []);

  const update = (patch: Partial<WorldConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage disabled */
      }
      return next;
    });
  };

  const env = [
    `MC_HOST=${cfg.host || "localhost"}`,
    `MC_PORT=${cfg.port || "25565"}`,
    `MC_USERNAME=${cfg.username || "ZeroPulse"}`,
    `MC_VERSION=${cfg.version}`,
    `ZP_PAIR_CODE=${cfg.code}`,
  ].join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(env);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="min-h-screen grid-backdrop">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-5 py-12">
        <p className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-muted-foreground">
          <Globe2 className="size-3.5 text-primary" /> Step 1 of building by voice
        </p>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Set up a world the bot can build in
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          ZeroPulse places real blocks through a Mineflayer bot, so it needs a world it can join.
          Generate one in Java Edition, open it to LAN, then hand those details to your companion
          app.
        </p>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          <Card
            icon={<Gamepad2 className="size-4 text-primary" />}
            step="01"
            title="Create the world"
            items={[
              "Single Player → Create New World",
              "Game Mode: Creative (fastest placement)",
              "Allow Cheats: ON — unlocks /fill batch mode",
              "World Type: Superflat is ideal for big builds",
            ]}
          />
          <Card
            icon={<Server className="size-4 text-primary" />}
            step="02"
            title="Open to LAN"
            items={[
              "Press Esc → Open to LAN",
              "Allow Cheats: ON, Game Mode: Creative",
              "Note the port Minecraft prints in chat",
              "Offline/cracked servers work too",
            ]}
          />
          <Card
            icon={<Smartphone className="size-4 text-primary" />}
            step="03"
            title="Pair the bridge"
            items={[
              "Run the ZeroPulse companion on that PC",
              "Paste the config below into its settings",
              "Approve a paired device inside the desktop app. A pairing code alone cannot build.",
              "Enter the same pairing code, then speak",
            ]}
          />
        </div>

        <section className="glass mt-8 rounded-2xl p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ListChecks className="size-4 text-accent" /> Your world config
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Host"
              value={cfg.host}
              onChange={(v) => update({ host: v })}
              hint="localhost, or your PC's LAN IP"
            />
            <Field
              label="Port"
              value={cfg.port}
              onChange={(v) => update({ port: v })}
              hint="from the Open to LAN message"
            />
            <Field
              label="Bot name"
              value={cfg.username}
              onChange={(v) => update({ username: v })}
              hint="appears in game as a player"
            />
            <Field
              label="Minecraft version (optional)"
              value={cfg.version}
              onChange={(v) => update({ version: v })}
              hint="leave blank to auto-detect (recommended)"
            />
            <Field
              label="Pairing code"
              value={cfg.code}
              onChange={(v) => update({ code: normalizeCode(v) })}
              hint="optional paired companion, approved in the desktop app"
            />
          </div>

          <div className="mt-5 rounded-xl border border-border/70 bg-background/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">bridge/.env</p>
              <button
                onClick={copy}
                className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs transition hover:bg-muted"
              >
                {copied ? (
                  <Check className="size-3.5 text-success" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="mt-3 overflow-auto font-mono text-xs leading-relaxed text-primary">
              {env}
            </pre>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            With a pairing code set, the bridge dials out to the ZeroPulse relay — no port
            forwarding. Remote proposals still wait for approval on the desktop, which remains the only build host.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Card({
  icon,
  step,
  title,
  items,
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
  items: string[];
}) {
  return (
    <article className="glass animate-rise rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/25">
          {icon}
        </span>
        <span className="font-mono text-xs text-muted-foreground">{step}</span>
      </div>
      <h3 className="mt-4 font-display text-base font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {items.map((it) => (
          <li key={it} className="flex gap-2">
            <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        value={value}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background/60 px-4 font-mono text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
      />
      <span className="mt-1 block text-[11px] text-muted-foreground/80">{hint}</span>
    </label>
  );
}
