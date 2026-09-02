import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface AccountSummary {
  profile: {
    email: string | null;
    is_admin: boolean;
    plan_tier: "starter" | "builder_pro" | "architect";
    subscription_status: string;
    unlimited_tester: boolean;
    daily_usage_counter: { date: string | null; tasks: number; blocks: number };
  };
  usage: { task_count: number; block_count: number };
  isAdmin: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  accountLoading: boolean;
  accountError: string | null;
  account: AccountSummary | null;
  authOpen: boolean;
  keyOpen: boolean;
  setAuthOpen: (open: boolean) => void;
  setKeyOpen: (open: boolean) => void;
  requireUser: () => boolean;
  authorizedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  refreshAccount: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);

  const authorizedFetch = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sign in to continue.");
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${token}`);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    return fetch(input, { ...init, headers });
  }, []);

  const refreshAccount = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setAccount(null);
      setAccountError(null);
      setAccountLoading(false);
      return;
    }
    setAccountLoading(true);
    setAccountError(null);
    try {
      const response = await authorizedFetch("/api/account/me");
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message || "Your account profile could not be loaded.");
      }
      setAccount(body as AccountSummary);
    } catch (error) {
      setAccount(null);
      setAccountError(
        error instanceof Error ? error.message : "Your account profile could not be loaded.",
      );
    } finally {
      setAccountLoading(false);
    }
  }, [authorizedFetch]);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      if (!nextSession) setAccount(null);
      if (!nextSession) {
        setAccountError(null);
        setAccountLoading(false);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) void refreshAccount();
  }, [session, refreshAccount]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user || null,
      loading,
      accountLoading,
      accountError,
      account,
      authOpen,
      keyOpen,
      setAuthOpen,
      setKeyOpen,
      requireUser: () => {
        if (session?.user) return true;
        setAuthOpen(true);
        return false;
      },
      authorizedFetch,
      refreshAccount,
      signOut: async () => {
        await supabase.auth.signOut();
        setAccount(null);
        setAccountError(null);
        setAccountLoading(false);
      },
    }),
    [
      session,
      loading,
      accountLoading,
      accountError,
      account,
      authOpen,
      keyOpen,
      authorizedFetch,
      refreshAccount,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
