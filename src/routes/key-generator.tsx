import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Clipboard,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Waves,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/key-generator")({
  head: () => ({
    meta: [
      { title: "Private Key Generator — ZeroPulse" },
      { name: "robots", content: "noindex,nofollow,noarchive" },
    ],
  }),
  component: KeyGeneratorPage,
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

async function api(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("content-type", "application/json");
  return fetch(path, { ...init, headers, credentials: "same-origin" });
}

function KeyGeneratorPage() {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [keys, setKeys] = useState<LicenseKeyRow[]>([]);
  const [generated, setGenerated] = useState<string[]>([]);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    setBusy("load");
    setMessage(null);
    try {
      const response = await api("/api/key-generator/keys");
      const body = await response.json();
      if (response.status === 401) {
        setAuthenticated(false);
        throw new Error("Your private session expired. Sign in again.");
      }
      if (!response.ok) throw new Error(body.message || "Key inventory could not be loaded.");
      setKeys(body.keys || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Key inventory could not be loaded.");
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void api("/api/key-generator/session")
      .then((response) => {
        setAuthenticated(response.ok);
        if (response.ok) void loadKeys();
      })
      .finally(() => setChecking(false));
  }, [loadKeys]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy("login");
    setMessage(null);
    try {
      const response = await api("/api/key-generator/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Private sign-in failed.");
      setPassword("");
      setAuthenticated(true);
      await loadKeys();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Private sign-in failed.");
      setBusy(null);
    }
  };

  const logout = async () => {
    await api("/api/key-generator/logout", { method: "POST" });
    setAuthenticated(false);
    setKeys([]);
    setGenerated([]);
    setMessage(null);
  };

  const generate = async () => {
    setBusy("generate");
    setGenerated([]);
    setMessage(null);
    try {
      const response = await api("/api/key-generator/keys", {
        method: "POST",
        body: JSON.stringify({ count }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Keys could not be generated.");
      setGenerated(body.keys || []);
      setMessage(body.warning || null);
      await loadKeys();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Keys could not be generated.");
      setBusy(null);
    }
  };

  const revoke = async (id: string) => {
    if (!window.confirm("Revoke this key and remove its unlimited entitlement?")) return;
    setBusy(id);
    setMessage(null);
    try {
      const response = await api("/api/key-generator/keys", {
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

  if (checking) {
    return <main className="hero-aura grid min-h-screen place-items-center"><Loader2 className="size-7 animate-spin text-primary" /></main>;
  }

  if (!authenticated) {
    return (
      <main className="hero-aura grid min-h-screen place-items-center px-5 py-12">
        <section className="glass w-full max-w-md rounded-3xl p-7 sm:p-8">
          <div className="flex items-center justify-between">
            <span className="grid size-11 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30"><LockKeyhole className="size-5" /></span>
            <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Private</span>
          </div>
          <h1 className="mt-6 font-display text-2xl font-semibold">ZeroPulse key generator</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This standalone owner portal is not connected to public account sign-in and is not listed in the public navigation.
          </p>
          <form onSubmit={login} className="mt-6 space-y-4">
            <label className="block text-xs text-muted-foreground">Username
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary/60" />
            </label>
            <label className="block text-xs text-muted-foreground">Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary/60" />
            </label>
            {message ? <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{message}</p> : null}
            <button disabled={Boolean(busy)} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50">
              {busy === "login" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Sign in to private portal
            </button>
          </form>
          <Link to="/" className="mt-5 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"><ArrowLeft className="size-3.5" /> Public ZeroPulse site</Link>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen hero-aura">
      <header className="border-b border-border/60 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30"><Waves className="size-4" /></span><span className="font-display font-semibold">Zero<span className="text-primary">Pulse</span> Private</span></div>
          <button onClick={() => void logout()} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"><LogOut className="size-4" /> Sign out</button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 py-12">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary"><ShieldCheck className="size-3.5" /> Owner-only key control</div>
            <h1 className="mt-4 font-display text-3xl font-semibold">Friends & family keys</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Generate one-time keys here. Recipients redeem them through Add a Key on the public site for lifetime unlimited builder access.</p>
          </div>
          <button onClick={() => void loadKeys()} disabled={Boolean(busy)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm hover:border-primary/40 disabled:opacity-50"><RefreshCw className={`size-4 ${busy === "load" ? "animate-spin" : ""}`} /> Refresh</button>
        </div>
        {message ? <div className="mt-6 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">{message}</div> : null}
        <section className="glass mt-8 rounded-3xl p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <label className="text-xs text-muted-foreground">Number of keys
              <input type="number" min={1} max={25} value={count} onChange={(event) => setCount(Math.min(25, Math.max(1, Number(event.target.value))))} className="mt-1.5 block h-11 w-32 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary/60" />
            </label>
            <button onClick={() => void generate()} disabled={Boolean(busy)} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy === "generate" ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Generate secure {count === 1 ? "key" : "keys"}</button>
          </div>
          {generated.length ? <div className="mt-6 rounded-2xl border border-success/30 bg-success/5 p-4"><p className="text-xs font-medium text-success">Copy these now. Plaintext keys are never stored.</p><div className="mt-3 space-y-2">{generated.map((key) => <div key={key} className="flex items-center justify-between gap-3 rounded-xl bg-background/80 p-3"><code className="font-mono text-sm">{key}</code><button onClick={() => void navigator.clipboard.writeText(key)} className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-primary" aria-label="Copy generated key"><Clipboard className="size-4" /></button></div>)}</div></div> : null}
        </section>
        <section className="glass mt-6 rounded-3xl p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Key inventory</h2><span className="font-mono text-xs text-muted-foreground">{keys.length} recent keys</span></div>
          <Table><TableHeader><TableRow><TableHead>Key hint</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead>Activated</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>{keys.map((key) => <TableRow key={key.id}><TableCell className="font-mono">{key.key_hint}</TableCell><TableCell><Badge variant={key.status === "revoked" ? "destructive" : key.status === "claimed" ? "secondary" : "outline"}>{key.status}</Badge></TableCell><TableCell className="text-xs text-muted-foreground">{new Date(key.created_at).toLocaleDateString()}</TableCell><TableCell className="text-xs text-muted-foreground">{key.activated_at ? new Date(key.activated_at).toLocaleDateString() : "—"}</TableCell><TableCell className="text-right">{key.status !== "revoked" ? <button onClick={() => void revoke(key.id)} disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive disabled:opacity-40">{busy === key.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} Revoke</button> : null}</TableCell></TableRow>)}{!keys.length && busy !== "load" ? <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">No keys have been generated.</TableCell></TableRow> : null}</TableBody>
          </Table>
        </section>
      </main>
    </div>
  );
}
