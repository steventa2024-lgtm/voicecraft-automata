import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/get-started")({
  head: () => ({
    meta: [
      { title: "Get started — ZeroPulse VoiceCraft" },
      {
        name: "description",
        content:
          "Minecraft control now lives in the ZeroPulse desktop application. Download the Windows app to connect a world, preview builds, and approve them locally.",
      },
    ],
  }),
  component: GetStartedPage,
});

function GetStartedPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-20">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Desktop application</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Minecraft control has moved into the app.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          The public website no longer contains a build dashboard. Voice commands, previews, approvals,
          and the Minecraft connection run inside the installed ZeroPulse VoiceCraft application, including
          when the marketing site is unreachable.
        </p>
        <ol className="mt-8 space-y-4 text-sm">
          {[
            "Create an account and choose a subscription or redeem a license key.",
            "Download the Windows installer and open ZeroPulse VoiceCraft.",
            "Sign in from the app. The system browser completes sign-in and returns to the app on this computer.",
            "Open a Java world to LAN with cheats, or connect the bot to a server where it has operator rights.",
            "Enter the host and port, start the local bridge, preview a command, then approve the build.",
          ].map((step, index) => (
            <li key={step} className="flex gap-3 rounded-2xl border border-border/70 bg-card/40 p-4">
              <span className="font-mono text-xs text-primary">0{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/download"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground"
          >
            <Download className="size-4" /> Download for Windows
          </Link>
          <Link to="/world-setup" className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3">
            <MonitorSmartphone className="size-4" /> World setup
          </Link>
        </div>
        <p className="mt-6 flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 text-primary" />
          Bookmarks to the old dashboard land here. Account, billing, and license tools stay on this website.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
