"use client";

import { createContext, useCallback, useEffect, useState } from "react";
import { supabaseClient } from "../supabaseClient";

// Centralized auth state for the whole app. Replaces the old pattern where
// every page called supabaseClient.auth.getUser() itself and duplicated the
// navbar profile / logout logic.
export const AuthContext = createContext({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshUser: async () => null,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const { data } = await supabaseClient.auth.getUser();
    const nextUser = data?.user ?? null;
    setUser(nextUser);
    return nextUser;
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Load whatever session already exists (e.g. from a previous visit)
    // before the auth state change listener below takes over.
    supabaseClient.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUser(data?.user ?? null);
      setLoading(false);
    });

    // Keep user state in sync with sign in / sign out / token refresh,
    // wherever they happen (this tab, another tab, OAuth redirect, etc.)
    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabaseClient.auth.signOut();
    // Don't wait for onAuthStateChange to update the UI — clear it now so
    // logout feels immediate, with no page reload required.
    setUser(null);
  }, []);

  const value = { user, loading, signOut, refreshUser };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
