import "server-only";

import { createClient, type User } from "@supabase/supabase-js";
import type { UserProfile } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";

export type RequestProfileResult =
  | { ok: true; profile: UserProfile }
  | { ok: false; status: 401 | 403 | 503; message: string };

const authClient = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key
    ? createClient(url, key, {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      })
    : null;
})();

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isAllowlistedAdministrator(email: string, user: User) {
  if (!user.email_confirmed_at) return false;
  const allowlist = (process.env.CAMPUS_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email);
}

async function syncProfile(user: User): Promise<RequestProfileResult> {
  const email = user.email?.trim().toLowerCase();
  if (!email || !uuidPattern.test(user.id)) {
    return { ok: false, status: 401, message: "A verified account is required." };
  }

  const metadataName = user.user_metadata.display_name;
  const displayName =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim().slice(0, 150)
      : email.split("@")[0].slice(0, 150);
  const grantAdmin = isAllowlistedAdministrator(email, user);

  try {
    let profile = await prisma.userProfile.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email,
        displayName,
        role: grantAdmin ? "ADMIN" : "STUDENT",
      },
      update: { email, displayName },
    });

    if (grantAdmin && profile.role === "STUDENT") {
      profile = await prisma.userProfile.update({
        where: { id: profile.id },
        data: { role: "ADMIN" },
      });
    }

    if (
      profile.accountStatus !== "ACTIVE" ||
      profile.disabledAt !== null
    ) {
      return {
        ok: false,
        status: 403,
        message: "This account is currently disabled.",
      };
    }

    return { ok: true, profile };
  } catch (error) {
    console.error(
      "User profile sync failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return {
      ok: false,
      status: 503,
      message: "The account profile could not be loaded. Please try again.",
    };
  }
}

export async function getRequestProfile(
  request: Request,
): Promise<RequestProfileResult> {
  if (!authClient) {
    return {
      ok: false,
      status: 503,
      message: "Supabase authentication is not configured on the server.",
    };
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return { ok: false, status: 401, message: "Please sign in to continue." };
  }

  try {
    const { data, error } = await authClient.auth.getUser(token);
    if (error) {
      if (error.status && error.status >= 500) {
        return {
          ok: false,
          status: 503,
          message: "Authentication could not be verified. Please retry.",
        };
      }
      return { ok: false, status: 401, message: "Your session has expired." };
    }
    if (!data.user) {
      return { ok: false, status: 401, message: "Your session has expired." };
    }
    return await syncProfile(data.user);
  } catch (error) {
    console.error(
      "Supabase authentication request failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return {
      ok: false,
      status: 503,
      message: "Authentication could not be reached. Please retry.",
    };
  }
}

export function isAdministrator(profile: UserProfile) {
  return profile.role === "ADMIN" || profile.role === "SUPER_ADMIN";
}
