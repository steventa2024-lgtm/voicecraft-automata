// This file mirrors Lovable Cloud's generated managed-auth client.
import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import { supabase } from "../supabase/client";

const lovableAuth = createLovableAuth();

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (
      provider: "google" | "apple" | "microsoft" | "lovable",
      options?: SignInOptions,
    ) => {
      const result = await lovableAuth.signInWithOAuth(provider, options);
      if (result.redirected || result.error) return result;

      try {
        await supabase.auth.setSession(result.tokens);
      } catch (error) {
        return { error: error instanceof Error ? error : new Error(String(error)) };
      }
      return result;
    },
  },
};
