"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";

export function LogoutButton() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSignOut() {
    setBusy(true);
    setError("");
    try {
      await signOut();
      router.replace("/");
    } catch {
      setError("Sign out could not be completed. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="button-secondary min-h-10 px-4 py-2 text-sm"
        disabled={busy}
        onClick={() => void handleSignOut()}
        type="button"
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error ? <span className="text-xs text-red-700" role="alert">{error}</span> : null}
    </div>
  );
}
