export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-5 text-xs text-muted-foreground sm:flex-row">
        <p>ZeroPulse — voice-driven Minecraft automation. Not affiliated with Mojang.</p>
        <p className="font-mono">bridge protocol v1 · ws://localhost:8765</p>
      </div>
    </footer>
  );
}
