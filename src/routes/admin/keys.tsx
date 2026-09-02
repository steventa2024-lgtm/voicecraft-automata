import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Clipboard,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/keys")({
  head: () => ({
    meta: [
      { title: "Private License Key Administration — ZeroPulse" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminKeysPage,
});

interface LicenseKeyRow {
  id: string;
  key_hint: string;
  status: "available" | "claimed" | "revoked";
  claimed_by_user_id: string | null;
  created_at: string;
  activated_at: string | null;
  revoked_at: string | null;
}

function AdminKeysPage() {
  const auth = useAuth();
  const [keys, setKeys] = useState<LicenseKeyRow[]>([]);
  const [generated, setGenerated] = useState<string[]>([]);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    if (!auth.user || !auth.account?.isAdmin) return;
    setBusy("load");
    setMessage(null);
    try {
      const response = await auth.authorizedFetch("/api/admin/keys");
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Key inventory could not be loaded.");
      setKeys(body.keys || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Key inventory could not be loaded.");
    } finally {
      setBusy(null);
    }
  }, [auth.user, auth.account?.isAdmin, auth.authorizedFetch]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const generate = async () => {
    setBusy("generate");
    setGenerated([]);
    setMessage(null);
    try {
      const response = await auth.authorizedFetch("/api/admin/keys", {
        method: "POST",
        body: JSON.stringify({ count }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Keys could not be generated.");
      setGenerated(body.keys || []);
      setMessage(body.warning);
      await loadKeys();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Keys could not be generated.");
      setBusy(null);
    }
  };

  const revoke = async (id: string) => {
    if (!window.confirm("Revoke this key? A revoked key cannot be redeemed again.")) return;
    setBusy(id);
    setMessage(null);
    try {
      const response = await auth.authorizedFetch("/api/admin/keys", {
        method: "PATCH",
        body: JSON.stringify({ id, status: "revoked" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Key could not be revoked.");
      await loadKeys();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Key could not be revoked.");
      setBusy(null);
    }
  };

  if (auth.loading || auth.accountLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!auth.user) {
    return (
      <div className="min-h-screen hero-aura">
        <SiteHeader />
        <main className="mx-auto grid min-h-[70vh] max-w-lg place-items-center px-5 text-center">
          <div className="glass rounded-3xl p-8">
            <ShieldAlert className="mx-auto size-9 text-warning" />
            <h1 className="mt-4 font-display text-2xl font-semibold">Admin sign-in required</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This private route is only available to authorized ZeroPulse administrators.
            </p>
            <button onClick={() => auth.setAuthOpen(true)} className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">
              Sign in
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!auth.account) {
    return (
      <div className="min-h-screen hero-aura">
        <SiteHeader />
        <main className="mx-auto grid min-h-[70vh] max-w-lg place-items-center px-5 text-center">
          <div className="glass rounded-3xl p-8">
            <ShieldAlert className="mx-auto size-9 text-warning" />
            <h1 className="mt-4 font-display text-2xl font-semibold">Account setup needs attention</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {auth.accountError ||
                "Your secure account profile could not be loaded. Retry after checking the server connection."}
            </p>
            <button
              onClick={() => void auth.refreshAccount()}
              className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
            >
              Retry account setup
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!auth.account.isAdmin) {
    return (
      <div className="min-h-screen hero-aura">
        <SiteHeader />
        <main className="mx-auto grid min-h-[70vh] max-w-lg place-items-center px-5 text-center">
          <div className="glass rounded-3xl p-8">
            <ShieldAlert className="mx-auto size-9 text-destructive" />
            <h1 className="mt-4 font-display text-2xl font-semibold">Access denied</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your account does not have the admin role. The API also enforces this role on every
              key operation.
            </p>
            <Link to="/" className="mt-6 inline-flex rounded-xl border border-border px-5 py-3 text-sm hover:border-primary/40">
              Return home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen hero-aura">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary">
          <ArrowLeft className="size-3.5" /> Back to ZeroPulse
        </Link>
        <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
              <ShieldCheck className="size-3.5" /> Private administrator portal
            </div>
            <h1 className="mt-4 font-display text-3xl font-semibold">Friends & family keys</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Plaintext keys appear once. Only their SHA-256 hashes and a masked hint remain in the
              database, and redemption binds the entitlement to one companion device.
            </p>
          </div>
          <button onClick={() => void loadKeys()} disabled={Boolean(busy)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm hover:border-primary/40 disabled:opacity-50">
            <RefreshCw className={`size-4 ${busy === "load" ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {message ? (
          <div className="mt-6 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            {message}
          </div>
        ) : null}

        <section className="glass mt-8 rounded-3xl p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <label className="text-xs text-muted-foreground">
              Number of keys
              <input
                type="number"
                min={1}
                max={25}
                value={count}
                onChange={(event) => setCount(Math.min(25, Math.max(1, Number(event.target.value))))}
                className="mt-1.5 block h-11 w-32 rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary/60"
              />
            </label>
            <button onClick={() => void generate()} disabled={Boolean(busy)} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {busy === "generate" ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              Generate secure {count === 1 ? "key" : "keys"}
            </button>
          </div>

          {generated.length ? (
            <div className="mt-6 rounded-2xl border border-success/30 bg-success/5 p-4">
              <p className="text-xs font-medium text-success">
                Copy these now. ZeroPulse cannot display them again.
              </p>
              <div className="mt-3 space-y-2">
                {generated.map((key) => (
                  <div key={key} className="flex items-center justify-between gap-3 rounded-xl bg-background/80 p-3">
                    <code className="font-mono text-sm text-foreground">{key}</code>
                    <button onClick={() => void navigator.clipboard.writeText(key)} className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-primary" aria-label={`Copy ${key}`}>
                      <Clipboard className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="glass mt-6 rounded-3xl p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Key inventory</h2>
            <span className="font-mono text-xs text-muted-foreground">{keys.length} recent keys</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key hint</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Activated</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-mono">{key.key_hint}</TableCell>
                  <TableCell>
                    <Badge variant={key.status === "revoked" ? "destructive" : key.status === "claimed" ? "secondary" : "outline"}>
                      {key.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(key.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{key.activated_at ? new Date(key.activated_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell className="text-right">
                    {key.status !== "revoked" ? (
                      <button onClick={() => void revoke(key.id)} disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive disabled:opacity-40">
                        {busy === key.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} Revoke
                      </button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
              {!keys.length && busy !== "load" ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No keys have been generated.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
