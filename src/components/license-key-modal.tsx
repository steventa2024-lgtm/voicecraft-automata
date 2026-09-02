import { useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { useAuth } from "./auth-provider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

export function LicenseKeyModal() {
  const auth = useAuth();
  const [key, setKey] = useState("");
  const [hwid, setHwid] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (auth.keyOpen) setHwid(localStorage.getItem("zeropulse.device-id") || "");
  }, [auth.keyOpen]);

  const redeem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!auth.user) {
      auth.setKeyOpen(false);
      auth.setAuthOpen(true);
      return;
    }
    setBusy(true);
    setMessage(null);
    setSuccess(false);
    try {
      const response = await auth.authorizedFetch("/api/license/redeem", {
        method: "POST",
        body: JSON.stringify({ key, hwid }),
      });
      const body = await response.json();
      setMessage(body.message || (response.ok ? "Key activated." : "Key could not be activated."));
      setSuccess(response.ok);
      if (response.ok) await auth.refreshAccount();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not redeem the key.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={auth.keyOpen} onOpenChange={auth.setKeyOpen}>
      <DialogContent className="border-border bg-background/95 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display"><KeyRound className="size-5 text-primary" /> Add a key</DialogTitle>
          <DialogDescription>Activate a private friends-and-family key on this companion device.</DialogDescription>
        </DialogHeader>
        <form onSubmit={redeem} className="space-y-3">
          <input value={key} onChange={(event) => setKey(event.target.value)} placeholder="Zero-XXXXX-XXXXX-XXXXX" className="h-12 w-full rounded-xl border border-input bg-background px-4 font-mono text-sm uppercase outline-none focus:border-primary/60" />
          {!hwid ? <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">Connect the desktop companion from the dashboard first. The key will be locked to that device.</p> : <p className="text-xs text-muted-foreground">Companion detected · device binding ready</p>}
          {message ? <p className={`rounded-lg border p-3 text-xs ${success ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>{message}</p> : null}
          <button disabled={busy || !key || !hwid} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-40">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Activate unlimited tester access
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
