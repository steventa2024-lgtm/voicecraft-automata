import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

export const Route = createFileRoute("/auth/desktop")({
  head: () => ({
    meta: [
      { title: "Sign in to the desktop app — ZeroPulse" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DesktopAuthPage,
});

function DesktopAuthPage() {
  const auth = useAuth();
  const [message, setMessage] = useState("Checking your ZeroPulse session…");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (auth.loading || started.current) return;
    const current = new URL(window.location.href);
    const state = current.searchParams.get("state") || "";
    const codeChallenge = current.searchParams.get("code_challenge") || "";
    const redirectUri = current.searchParams.get("redirect_uri") || "";
    if (!auth.user) {
      setMessage("Sign in with the same account you use on the website. This page will return you to the desktop app.");
      auth.setAuthOpen(true);
      return;
    }
    started.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const response = await auth.authorizedFetch("/api/auth/desktop/issue", {
          method: "POST",
          body: JSON.stringify({ state, codeChallenge, redirectUri }),
        });
        const body = await response.json();
        if (!response.ok || !body.code) throw new Error(body.message || "Desktop sign-in could not start.");
        const target = new URL(redirectUri);
        target.searchParams.set("code", body.code);
        target.searchParams.set("state", state);
        if (!cancelled) window.location.replace(target.toString());
      } catch (issueError) {
        if (!cancelled) {
          setError(issueError instanceof Error ? issueError.message : "Desktop sign-in failed.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6">
      <p className="text-xs uppercase tracking-[0.16em] text-primary">ZeroPulse VoiceCraft</p>
      <h1 className="mt-3 font-display text-3xl font-semibold">Connect the desktop app</h1>
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      {!error && auth.user ? <Loader2 className="mt-6 size-5 animate-spin text-primary" /> : null}
    </main>
  );
}
