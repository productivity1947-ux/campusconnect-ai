import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { LogoutButton } from "@/features/auth/logout-button";

type PortalShellProps = {
  role: "student" | "admin";
  title: string;
  description?: string;
  children: ReactNode;
};

export function PortalShell({
  role,
  title,
  description,
  children,
}: PortalShellProps) {
  const audience = role === "student" ? "Student space" : "Campus team";

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-y-3 px-5 py-4 sm:px-8">
          <BrandMark />
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {role === "student" ? (
              <Link
                className="text-sm font-medium text-muted transition hover:text-brand"
                href="/admin/login"
              >
                Campus team sign in
              </Link>
            ) : null}
            <Link
              className="hidden text-sm font-medium text-muted transition hover:text-brand sm:inline"
              href={role === "student" ? "/student" : "/admin"}
            >
              Dashboard
            </Link>
            <span className="hidden rounded-full border border-line bg-canvas px-3 py-1.5 text-xs font-medium text-muted sm:inline-flex">
              {audience}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8 max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.16em] text-brand uppercase">
            {audience}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 text-base leading-7 text-muted">{description}</p>
          ) : null}
        </div>
        {children}
      </main>
    </div>
  );
}
