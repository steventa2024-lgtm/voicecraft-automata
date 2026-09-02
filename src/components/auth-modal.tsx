import { useEffect, useState } from "react";
import { Github, Loader2, LockKeyhole, Mail } from "lucide-react";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-provider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

export function AuthModal() {
  const auth = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [providers, setProviders] = useState<{
    google: boolean | null;
    github: boolean | null;
  }>({ google: null, github: null });

  const authCallbackUrl = () => {
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", "/dashboard");
    return callback.toString();
  };

  useEffect(() => {
    if (!auth.authOpen) return;
    const url = import.meta.env["VITE_SUPABASE_URL"];
    const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return;
    const controller = new AbortController();
    void fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const settings = (await response.json()) as {
          external?: { google?: boolean; github?: boolean };
        };
        setProviders({
          google: Boolean(settings.external?.google),
          github: Boolean(settings.external?.github),
        });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [auth.authOpen]);

  const emailSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: authCallbackUrl() },
          })
        : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) return setMessage(result.error.message);
    if (mode === "signup" && !result.data.session) {
      setMessage("Check your email to confirm your account, then sign in.");
      return;
    }
    auth.setAuthOpen(false);
  };

  const oauth = async (provider: "google" | "github") => {
    setBusy(true);
    setMessage(null);

    if (provider === "google") {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setBusy(false);
        setMessage(result.error.message);
        return;
      }
      if (!result.redirected) {
        setBusy(false);
        auth.setAuthOpen(false);
      }
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: authCallbackUrl() },
    });
    if (error) {
      setBusy(false);
      setMessage(error.message);
    }
  };

  return (
    <Dialog open={auth.authOpen} onOpenChange={auth.setAuthOpen}>
      <DialogContent className="border-border bg-background/95 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <LockKeyhole className="size-5 text-primary" /> {mode === "signin" ? "Sign in to ZeroPulse" : "Create your account"}
          </DialogTitle>
          <DialogDescription>
            Your session protects downloads, billing, usage allowances, and VIP keys.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => void oauth("google")} disabled={busy || providers.google === false} className="rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50">
            {providers.google === false ? "Google setup pending" : "Continue with Google"}
          </button>
          <button onClick={() => void oauth("github")} disabled={busy || providers.github === false} className="flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50">
            <Github className="size-4" />
            {providers.github === false ? "GitHub setup pending" : "Continue with GitHub"}
          </button>
        </div>
        {providers.google === false || providers.github === false ? (
          <p className="text-center text-[11px] text-muted-foreground">
            Providers marked setup pending are disabled on the connected authentication project.
          </p>
        ) : null}

        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or use email <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={emailSubmit} className="space-y-3">
          <label className="block text-xs text-muted-foreground">
            Email
            <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary/60" />
          </label>
          <label className="block text-xs text-muted-foreground">
            Password
            <input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary/60" />
          </label>
          {message ? <p className="rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning">{message}</p> : null}
          <button disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(null); }} className="text-xs text-muted-foreground hover:text-primary">
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
