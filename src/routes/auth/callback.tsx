import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Finishing sign in — ZeroPulse" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuthCallbackPage,
});

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value === "/dashboard") {
    return "/get-started";
  }
  return value;
}

function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let active = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const currentUrl = new URL(window.location.href);
    const hash = new URLSearchParams(currentUrl.hash.replace(/^#/, ""));
    const next = safeNext(currentUrl.searchParams.get("next"));
    const providerError =
      currentUrl.searchParams.get("error_description") ||
      currentUrl.searchParams.get("error") ||
      hash.get("error_description") ||
      hash.get("error");

    const finish = () => {
      if (!active) return;
      setComplete(true);
      window.setTimeout(() => window.location.replace(next), 350);
    };

    if (providerError) {
      setError(decodeURIComponent(providerError.replace(/\+/g, " ")));
      return () => {
        active = false;
      };
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) finish();
    });

    void (async () => {
      const code = currentUrl.searchParams.get("code");
      if (code) {
        currentUrl.searchParams.delete("code");
        window.history.replaceState(
          {},
          "",
          `${currentUrl.pathname}${currentUrl.search}`,
        );
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError && active) {
          setError(exchangeError.message);
          return;
        }
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError && active) {
        setError(sessionError.message);
        return;
      }
      if (data.session) {
        finish();
        return;
      }

      timeout = window.setTimeout(() => {
        if (active) {
          setError(
            "The provider did not return a valid session. Check its client ID, secret, and callback URL in the connected Supabase project.",
          );
        }
      }, 8000);
    })();

    return () => {
      active = false;
      if (timeout) window.clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="hero-aura grid min-h-screen place-items-center px-5">
      <section className="glass w-full max-w-md rounded-3xl p-8 text-center">
        {error ? (
          <>
            <ShieldAlert className="mx-auto size-10 text-destructive" />
            <h1 className="mt-4 font-display text-2xl font-semibold">Sign-in could not finish</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{error}</p>
            <Link
              to="/"
              className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
            >
              Return home and try again
            </Link>
          </>
        ) : complete ? (
          <>
            <CheckCircle2 className="mx-auto size-10 text-success" />
            <h1 className="mt-4 font-display text-2xl font-semibold">You are signed in</h1>
            <p className="mt-2 text-sm text-muted-foreground">Returning to your account…</p>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto size-10 animate-spin text-primary" />
            <h1 className="mt-4 font-display text-2xl font-semibold">Finishing secure sign-in</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              ZeroPulse is verifying the provider response and creating your account.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
