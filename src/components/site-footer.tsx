import { KeyRound } from "lucide-react";
import { useAuth } from "./auth-provider";

export function SiteFooter() {
  const auth = useAuth();

  return (
    <footer className="border-t border-border/60 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-5 text-xs text-muted-foreground sm:flex-row">
        <p>ZeroPulse — voice-driven Minecraft automation. Not affiliated with Mojang.</p>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (!auth.requireUser()) return;
              auth.setKeyOpen(true);
            }}
            className="inline-flex items-center gap-1.5 transition hover:text-primary"
          >
            <KeyRound className="size-3.5" /> Add a Key
          </button>
          <p className="font-mono">desktop app · protocol v2</p>
        </div>
      </div>
    </footer>
  );
}
