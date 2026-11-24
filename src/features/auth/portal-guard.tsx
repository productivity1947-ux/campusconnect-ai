"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { LogoutButton } from "@/features/auth/logout-button";

export function PortalGuard({
  role,
  children,
}: {
  role: "student" | "admin";
  children: ReactNode;
}) {
  const router = useRouter();
  const {
    session,
    profile,
    ready,
    authError,
    profileError,
    refreshProfile,
    retryAuth,
  } = useAuth();

  useEffect(() => {
    if (ready && !session) router.replace(role === "admin" ? "/admin/login" : "/login");
  }, [ready, role, router, session]);

  if (authError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-5">
        <section
          aria-live="polite"
          className="max-w-md rounded-2xl border border-line bg-white p-6 text-center"
          role="alert"
        >
          <h1 className="text-lg font-semibold text-ink">
            Could not check your session
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">{authError}</p>
          <button
            className="button-primary mt-5"
            onClick={retryAuth}
            type="button"
          >
            Retry session check
          </button>
        </section>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-5">
        <p className="text-sm font-medium text-muted">Checking your session…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-5">
        <p className="text-sm text-muted">Taking you to sign in…</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-5">
        <section className="max-w-md rounded-2xl border border-line bg-white p-6 text-center">
          <h1 className="text-lg font-semibold text-ink">Account unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            {profileError ?? "Your account profile could not be loaded."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              className="button-primary"
              onClick={() => void refreshProfile()}
              type="button"
            >
              Try again
            </button>
            <LogoutButton />
          </div>
        </section>
      </main>
    );
  }

  const isAdmin = profile.role === "ADMIN" || profile.role === "SUPER_ADMIN";
  if ((role === "admin" && !isAdmin) || (role === "student" && isAdmin)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-5">
        <section className="max-w-md rounded-2xl border border-line bg-white p-6 text-center">
          <h1 className="text-lg font-semibold text-ink">This portal is not available</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Your account does not have access to this area.
          </p>
          <Link className="button-primary mt-5" href={isAdmin ? "/admin" : "/student"}>
            Open your portal
          </Link>
        </section>
      </main>
    );
  }

  return children;
}
