import { Link } from "@tanstack/react-router";
import { KeyRound, LogIn, LogOut, UserRound, Waves } from "lucide-react";
import { useAuth } from "./auth-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function SiteHeader() {
  const auth = useAuth();

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
            className="hidden rounded-md px-3 py-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:block"
            activeProps={{ className: "text-foreground" }}
          >
            Dashboard
          </Link>
          <Link
            to="/world-setup"
            className="hidden rounded-md px-3 py-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground md:block"
            activeProps={{ className: "text-foreground" }}
          >
            World setup
          </Link>
          <Link
            to="/download"
            className="rounded-md bg-primary px-3.5 py-2 font-medium text-primary-foreground transition hover:bg-primary-glow"
          >
            Download
          </Link>
          {auth.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="ml-1 grid size-9 place-items-center rounded-lg border border-border bg-secondary text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                  aria-label="Open account menu"
                >
                  <UserRound className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 border-border bg-background">
                <DropdownMenuLabel>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {auth.user.email}
                  </span>
                  <span className="mt-1 block text-xs font-medium uppercase tracking-wider text-primary">
                    {auth.account?.profile.unlimited_tester
                      ? "Unlimited tester"
                      : (auth.account?.profile.plan_tier || "Starter").replace("_", " ")}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => auth.setKeyOpen(true)}>
                  <KeyRound className="size-4" /> Add a key
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void auth.signOut()}>
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              onClick={() => auth.setAuthOpen(true)}
              className="ml-1 grid size-9 place-items-center rounded-lg border border-border bg-secondary text-muted-foreground transition hover:border-primary/40 hover:text-foreground sm:flex sm:w-auto sm:gap-2 sm:px-3"
            >
              <LogIn className="size-4" />
              <span className="hidden sm:inline">Sign in</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
