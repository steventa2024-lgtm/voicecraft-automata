import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/keys")({
  head: () => ({ meta: [
    { title: "Private Key Generator — ZeroPulse" },
    { name: "robots", content: "noindex,nofollow,noarchive" },
  ] }),
  component: LegacyAdminKeysRedirect,
});

function LegacyAdminKeysRedirect() {
  useEffect(() => window.location.replace("/key-generator"), []);
  return <main className="hero-aura grid min-h-screen place-items-center"><Loader2 className="size-7 animate-spin text-primary" /></main>;
}
