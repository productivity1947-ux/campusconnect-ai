"use client";

import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-5">
      <section className="max-w-md rounded-2xl border border-line bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-ink">
          This page could not be loaded
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Your account and saved information are unchanged. Try loading this page
          again, or return to the home page.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button className="button-primary" onClick={reset} type="button">
            Try again
          </button>
          <Link className="button-secondary" href="/">
            Go home
          </Link>
        </div>
      </section>
    </main>
  );
}
