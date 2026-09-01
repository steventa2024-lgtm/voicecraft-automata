import { Link } from "@tanstack/react-router";
import { Waves } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
        <Link to="/" className="group flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30 transition group-hover:bg-primary/25">
            <Waves className="size-4" />
          </span>
          <span className="font-display text-base font-semibold tracking-tight">
            Zero<span className="text-primary">Pulse</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            to="/dashboard"
            className="rounded-md px-3 py-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            Dashboard
          </Link>
          <Link
            to="/download"
            className="rounded-md bg-primary px-3.5 py-2 font-medium text-primary-foreground transition hover:bg-primary-glow"
          >
            Download bridge
          </Link>
        </nav>
      </div>
    </header>
  );
}
