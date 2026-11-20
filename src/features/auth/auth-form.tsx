"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useAuth } from "@/features/auth/auth-provider";

type AuthFormProps = {
  mode: "login" | "register" | "admin";
};

async function loadProfile(accessToken: string) {
  const response = await fetch("/api/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const body = (await response.json()) as {
    profile?: { role: string };
    error?: string;
  };
  if (!response.ok || !body.profile) {
    throw new Error(body.error ?? "Your account could not be loaded.");
  }
  return body.profile;
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const isRegister = mode === "register";
  const isAdminLogin = mode === "admin";
  const [displayName, setDisplayName] = useState("");
  const [usn, setUsn] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);

    try {
      const supabase = getSupabaseBrowserClient();
      if (isRegister) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              display_name: displayName.trim(),
              ...(usn.trim() ? { usn: usn.trim() } : {}),
              ...(phoneNumber.trim()
                ? { phone_number: phoneNumber.trim() }
                : {}),
            },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });
        if (signUpError) throw signUpError;
        let photoWarning = "";
        if (photo && data.session && data.user) {
          const extension =
            photo.type === "image/jpeg"
              ? "jpg"
              : photo.type === "image/png"
                ? "png"
                : "webp";
          const path = `${data.user.id}/${crypto.randomUUID()}.${extension}`;
          const { data: uploaded, error: uploadError } = await supabase.storage
            .from("student-profile-photos")
            .upload(path, photo, {
              contentType: photo.type,
              cacheControl: "3600",
              upsert: false,
            });
          if (uploadError) {
            photoWarning =
              " Your account was created, but the optional photo could not be uploaded because profile photo storage is not configured.";
          } else {
            const { error: metadataError } = await supabase.auth.updateUser({
              data: { avatar_path: uploaded.path },
            });
            if (metadataError) {
              photoWarning =
                " Your account was created, but its optional photo could not be linked to the profile.";
            }
          }
        } else if (photo) {
          photoWarning =
            " Your account was created, but the optional photo was not saved; profile photo storage is not configured.";
        }
        if (!data.session) {
          setNotice(
            `Check your email for the Supabase confirmation link, then sign in here.${photoWarning}`,
          );
          return;
        }
        if (photoWarning) {
          await refreshProfile(data.session.access_token);
          setNotice(photoWarning.trim());
          return;
        }
        const profile = await loadProfile(data.session.access_token);
        await refreshProfile(data.session.access_token);
        router.replace(
          profile.role === "ADMIN" || profile.role === "SUPER_ADMIN"
            ? "/admin"
            : "/student",
        );
        return;
      }

      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
      if (signInError) throw signInError;
      if (!data.session) {
        throw new Error("Supabase did not create an active session.");
      }

      const profile = await loadProfile(data.session.access_token);
      if (
        isAdminLogin &&
        profile.role !== "ADMIN" &&
        profile.role !== "SUPER_ADMIN"
      ) {
        await supabase.auth.signOut();
        await refreshProfile();
        throw new Error(
          "This account is not provisioned as an administrator.",
        );
      }

      await refreshProfile(data.session.access_token);
      router.replace(
        profile.role === "ADMIN" || profile.role === "SUPER_ADMIN"
          ? "/admin"
          : "/student",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Sign-in could not be completed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandMark />
        </div>
        <section className="rounded-3xl border border-line bg-white p-6 shadow-xl shadow-slate-900/[0.04] sm:p-8">
          <p className="text-center text-xs font-semibold tracking-[0.16em] text-brand uppercase">
            {isAdminLogin ? "Campus team" : "Student portal"}
          </p>
          <h1 className="mt-3 text-center text-2xl font-semibold tracking-[-0.04em] text-ink">
            {isRegister
              ? "Create your student account"
              : isAdminLogin
                ? "Administrator sign in"
                : "Welcome back"}
          </h1>
          <p className="mt-2 text-center text-sm leading-6 text-muted">
            {isRegister
              ? "Student accounts are created with student access. Admin access is provisioned privately."
              : "Sign in with the email and password for your CampusConnect account."}
          </p>

          <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
            {isRegister ? (
              <>
                <label className="block text-sm font-medium text-ink">
                  Full name <span className="text-muted">(optional)</span>
                  <input
                    autoComplete="name"
                    className="form-input mt-2"
                    maxLength={150}
                    onChange={(event) => setDisplayName(event.target.value)}
                    value={displayName}
                  />
                </label>
                <label className="block text-sm font-medium text-ink">
                  USN <span className="text-muted">(optional)</span>
                  <input
                    autoComplete="off"
                    className="form-input mt-2"
                    maxLength={40}
                    onChange={(event) => setUsn(event.target.value)}
                    value={usn}
                  />
                </label>
                <label className="block text-sm font-medium text-ink">
                  Phone number <span className="text-muted">(optional)</span>
                  <input
                    autoComplete="tel"
                    className="form-input mt-2"
                    maxLength={30}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    type="tel"
                    value={phoneNumber}
                  />
                </label>
                <div>
                  <label className="block text-sm font-medium text-ink">
                    Profile photo <span className="text-muted">(optional)</span>
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      className="form-input mt-2"
                      onChange={(event) => {
                        const selected = event.target.files?.[0] ?? null;
                        if (
                          selected &&
                          (!["image/jpeg", "image/png", "image/webp"].includes(
                            selected.type,
                          ) ||
                            selected.size > 3 * 1024 * 1024)
                        ) {
                          setPhoto(null);
                          setPhotoPreview("");
                          event.target.value = "";
                          setError("Choose a JPG, PNG, or WebP photo under 3 MB.");
                          return;
                        }
                        setError("");
                        setPhoto(selected);
                        setPhotoPreview(selected ? URL.createObjectURL(selected) : "");
                      }}
                      type="file"
                    />
                  </label>
                  <p className="mt-2 text-xs text-muted">
                    You can leave this blank. Photo storage is not configured yet.
                  </p>
                  {photoPreview ? (
                    <Image
                      alt="Selected profile photo preview"
                      className="mt-3 size-20 rounded-full object-cover"
                      height={80}
                      unoptimized
                      src={photoPreview}
                      width={80}
                    />
                  ) : null}
                </div>
              </>
            ) : null}
            <label className="block text-sm font-medium text-ink">
              Email address
              <input
                autoComplete="email"
                className="form-input mt-2"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label className="block text-sm font-medium text-ink">
              Password
              <input
                autoComplete={isRegister ? "new-password" : "current-password"}
                className="form-input mt-2"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            {error ? (
              <p
                aria-live="polite"
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            {notice ? (
              <p
                aria-live="polite"
                className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800"
                role="status"
              >
                {notice}
              </p>
            ) : null}
            <button
              className="button-primary w-full"
              disabled={busy}
              type="submit"
            >
              {busy
                ? "Please wait…"
                : isRegister
                  ? "Create student account"
                  : "Sign in"}
            </button>
          </form>

          <div className="mt-6 border-t border-line pt-5 text-center text-sm text-muted">
            {isRegister ? (
              <>
                Already have an account?{" "}
                <Link className="font-semibold text-brand hover:underline" href="/login">
                  Sign in
                </Link>
              </>
            ) : isAdminLogin ? (
              <>
                Student?{" "}
                <Link className="font-semibold text-brand hover:underline" href="/login">
                  Use student sign in
                </Link>
              </>
            ) : (
              <>
                New here?{" "}
                <Link className="font-semibold text-brand hover:underline" href="/register">
                  Create a student account
                </Link>
              </>
            )}
          </div>
        </section>
        <p className="mt-5 text-center text-xs leading-5 text-muted">
          By continuing, you agree to use CampusConnect respectfully. AI suggestions
          are reviewed by campus staff and never decide the outcome of a grievance.
        </p>
      </div>
    </main>
  );
}
