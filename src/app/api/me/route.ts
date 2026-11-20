import { NextResponse } from "next/server";
import { getRequestProfile } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const result = await getRequestProfile(request);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      profile: {
        id: result.profile.id,
        email: result.profile.email,
        displayName: result.profile.displayName,
        role: result.profile.role,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
