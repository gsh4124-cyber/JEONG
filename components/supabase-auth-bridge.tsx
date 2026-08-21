"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

let signInInFlight: { key: string; promise: Promise<void> } | null = null;

async function ensureSupabaseGoogleSession(
  googleIdToken: string,
  googleAccessToken?: string,
  expectedEmail?: string,
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { data: existing, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) console.warn("JEONG Supabase session check:", sessionError.message);

  const expected = String(expectedEmail ?? "").trim().toLowerCase();
  const existingEmail = String(existing.session?.user.email ?? "").trim().toLowerCase();
  if (existing.session && (!expected || existingEmail === expected)) return;

  if (existing.session) {
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) throw signOutError;
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: googleIdToken,
    ...(googleAccessToken ? { access_token: googleAccessToken } : {}),
  });
  if (error) throw error;
}

export function SupabaseAuthBridge({
  googleIdToken,
  googleAccessToken,
  expectedEmail,
  signedOut = false,
}: {
  googleIdToken?: string;
  googleAccessToken?: string;
  expectedEmail?: string;
  signedOut?: boolean;
}) {
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      console.warn("JEONG Supabase auth bridge: Supabase environment variables are missing.");
      return;
    }
    if (signedOut) {
      const supabase = getSupabaseBrowserClient();
      if (supabase) void supabase.auth.signOut({ scope: "local" });
      return;
    }
    if (!googleIdToken) {
      console.warn("JEONG Supabase auth bridge: Google ID token is missing. Sign out and sign in with Google again once.");
      return;
    }

    const key = String(expectedEmail ?? "").trim().toLowerCase() || googleIdToken.slice(-24);
    if (signInInFlight?.key === key) return;
    const previous = signInInFlight?.promise ?? Promise.resolve();
    const promise = previous
      .catch(() => undefined)
      .then(() => ensureSupabaseGoogleSession(googleIdToken, googleAccessToken, expectedEmail))
      .catch((error: unknown) => console.warn("JEONG Supabase auth bridge:", error instanceof Error ? error.message : String(error)));
    signInInFlight = { key, promise };
    void promise.finally(() => {
      if (signInInFlight?.promise === promise) signInInFlight = null;
    });
  }, [googleIdToken, googleAccessToken, expectedEmail, signedOut]);

  return null;
}
