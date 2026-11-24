"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const profileRequestId = useRef(0);
  const profileAbortController = useRef<AbortController | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const profileRef = useRef<SignedInProfile | null>(null);

  const refreshProfile = useCallback(
    async (token?: string) => {
      const accessToken = token ?? sessionRef.current?.access_token;
      if (!accessToken) {
        profileRequestId.current += 1;
        profileAbortController.current?.abort();
        profileAbortController.current = null;
        profileRef.current = null;
        setProfile(null);
        setProfileError(null);
        setProfileLoading(false);
        return null;
      }

      profileAbortController.current?.abort();
      const controller = new AbortController();
      profileAbortController.current = controller;
      const requestId = ++profileRequestId.current;
      setProfileLoading(true);
      setProfileError(null);
      try {
        const response = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          profile?: SignedInProfile;
          error?: string;
        };
        if (requestId !== profileRequestId.current) return null;
        if (!response.ok || !body.profile) {
          profileRef.current = null;
          setProfile(null);
          setProfileError(body.error ?? "Your account could not be loaded.");
          return null;
        }
        profileRef.current = body.profile;
        setProfile(body.profile);
        return body.profile;
      } catch {
        if (requestId !== profileRequestId.current) return null;
        profileRef.current = null;
        setProfile(null);
        setProfileError("Could not reach CampusConnect. Check your connection.");
        return null;
      } finally {
        if (requestId === profileRequestId.current) {
          profileAbortController.current = null;
          setProfileLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;
    let authEventVersion = 0;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventVersion += 1;
      const currentUserId = sessionRef.current?.user.id;
      const nextUserId = nextSession?.user.id;
      if (currentUserId && currentUserId === nextUserId) {
        sessionRef.current = nextSession;
        setSession(nextSession);
        if (!profileRef.current && !profileAbortController.current) {
          setProfileLoading(true);
          setProfileRefreshKey((current) => current + 1);
        }
        return;
      }

      profileRequestId.current += 1;
      profileAbortController.current?.abort();
      profileAbortController.current = null;
      sessionRef.current = nextSession;
      setSession(nextSession);
      setProfileLoading(Boolean(nextSession));
      if (profileRef.current?.id !== nextUserId) {
        profileRef.current = null;
        setProfile(null);
      }
      if (!nextSession) {
        profileRef.current = null;
        setProfile(null);
        setProfileError(null);
      }
    });

    const initialAuthEventVersion = authEventVersion;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (
        active &&
        !error &&
        authEventVersion === initialAuthEventVersion
      ) {
        profileRequestId.current += 1;
        profileAbortController.current?.abort();
        profileAbortController.current = null;
        sessionRef.current = data.session;
        setSession(data.session);
        setProfileLoading(Boolean(data.session));
      }
      if (active) setAuthReady(true);
    });

    return () => {
      active = false;
      profileRequestId.current += 1;
      profileAbortController.current?.abort();
      profileAbortController.current = null;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.access_token) {
      if (profileRef.current?.id === session.user.id) return;
      const timer = window.setTimeout(
        () => void refreshProfile(session.access_token),
        0,
      );
      return () => window.clearTimeout(timer);
    } else if (authReady) {
      const timer = window.setTimeout(() => setProfileLoading(false), 0);
      return () => window.clearTimeout(timer);
    }
  }, [
    authReady,
    profileRefreshKey,
    refreshProfile,
    session?.access_token,
    session?.user.id,
  ]);

  const signOut = useCallback(async () => {
    const { error } = await getSupabaseBrowserClient().auth.signOut();
    if (error) throw error;
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
