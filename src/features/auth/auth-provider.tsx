"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export type SignedInProfile = {
  id: string;
  email: string;
  displayName: string | null;
  role: "STUDENT" | "ADMIN" | "SUPER_ADMIN";
};

type AuthContextValue = {
  session: Session | null;
  profile: SignedInProfile | null;
  ready: boolean;
  profileError: string | null;
  refreshProfile: (token?: string) => Promise<SignedInProfile | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<SignedInProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const refreshProfile = useCallback(async (token?: string) => {
    const accessToken = token ?? session?.access_token;
    if (!accessToken) {
      setProfile(null);
      return null;
    }

    setProfileLoading(true);
    setProfileError(null);
    try {
      const response = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const body = (await response.json()) as {
        profile?: SignedInProfile;
        error?: string;
      };
      if (!response.ok || !body.profile) {
        setProfile(null);
        setProfileError(body.error ?? "Your account could not be loaded.");
        return null;
      }
      setProfile(body.profile);
      return body.profile;
    } catch {
      setProfile(null);
      setProfileError("Could not reach CampusConnect. Check your connection.");
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setProfileLoading(Boolean(nextSession));
      if (!nextSession) {
        setProfile(null);
        setProfileError(null);
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!error) {
        setSession(data.session);
        setProfileLoading(Boolean(data.session));
      }
      setAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.access_token) {
      const timer = window.setTimeout(
        () => void refreshProfile(session.access_token),
        0,
      );
      return () => window.clearTimeout(timer);
    } else if (authReady) {
      const timer = window.setTimeout(() => setProfileLoading(false), 0);
      return () => window.clearTimeout(timer);
    }
  }, [authReady, refreshProfile, session?.access_token]);

  const signOut = useCallback(async () => {
    const { error } = await getSupabaseBrowserClient().auth.signOut();
    if (error) throw error;
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      profile,
      ready: authReady && !profileLoading,
      profileError,
      refreshProfile,
      signOut,
    }),
    [
      authReady,
      profile,
      profileError,
      profileLoading,
      refreshProfile,
      session,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
