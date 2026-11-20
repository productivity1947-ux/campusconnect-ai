import Link from "next/link";

export function BrandMark() {
  return (
    <Link
      href="/"
      aria-label="CampusConnect AI home"
      className="inline-flex items-center gap-3"
    >
      <span className="flex size-10 items-center justify-center rounded-[13px] bg-ink text-white shadow-sm">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-6"
          fill="none"
        >
          <path
            d="M4.5 19V9.6L12 4.5l7.5 5.1V19M2.5 19h19M9 19v-5.5h6V19"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="9.5" r="1" fill="#80a3ff" />
        </svg>
      </span>
      <span className="text-[17px] font-semibold tracking-[-0.035em] text-ink">
        CampusConnect<span className="ml-1 text-brand">AI</span>
      </span>
    </Link>
  );
}
