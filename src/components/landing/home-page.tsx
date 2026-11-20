import { BrandMark } from "@/components/brand-mark";
import { Icon, type IconName } from "@/components/ui/icon";
import Link from "next/link";

const steps: {
  number: string;
  icon: IconName;
  title: string;
  description: string;
}[] = [
  {
    number: "01",
    icon: "message-circle",
    title: "Share what is happening",
    description:
      "Describe a campus concern in your own words. You should not need to guess which office to contact.",
  },
  {
    number: "02",
    icon: "sparkles",
    title: "Get help finding the next step",
    description:
      "AI can help organize the details and suggest a route, while you stay in control of what is shared.",
  },
  {
    number: "03",
    icon: "compass",
    title: "Know what happens next",
    description:
      "A clear owner and visible updates can replace the uncertainty of sending a message into the void.",
  },
];

const principles: {
  icon: IconName;
  title: string;
  description: string;
}[] = [
  {
    icon: "lock",
    title: "Clarity before sharing",
    description:
      "Students should know what information a report needs and how it will be used before they submit it.",
  },
  {
    icon: "heart",
    title: "AI that supports people",
    description:
      "AI can help organize information. People remain responsible for review, decisions, and meaningful follow-up.",
  },
  {
    icon: "users",
    title: "Accountability that is visible",
    description:
      "Every concern deserves a clear next step and an accountable campus team—not another dead end.",
  },
];

const campusAreas: {
  icon: IconName;
  title: string;
  description: string;
}[] = [
  {
    icon: "building",
    title: "Spaces & facilities",
    description: "Classrooms, study spaces, housing, and shared areas.",
  },
  {
    icon: "users",
    title: "Student support",
    description: "A clearer path toward the people who can help.",
  },
  {
    icon: "layers",
    title: "Campus experience",
    description: "Everyday friction that shapes how campus life feels.",
  },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold tracking-[0.17em] text-brand uppercase">
      {children}
    </p>
  );
}

export function HomePage() {
  return (
    <div id="top" className="min-h-screen overflow-hidden bg-white text-ink">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <BrandMark />
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex"
          >
            <a className="transition-colors hover:text-ink" href="#how-it-works">
              How it works
            </a>
            <a className="transition-colors hover:text-ink" href="#approach">
              Our approach
            </a>
            <a className="transition-colors hover:text-ink" href="#for-campus">
              For campus teams
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              className="text-sm font-semibold text-slate-600 transition hover:text-brand"
              href="/login"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:px-5"
            >
              <span>Get started</span>
              <Icon name="arrow-up-right" size={16} />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden border-b border-slate-100 bg-canvas">
          <div aria-hidden="true" className="hero-grid absolute inset-0 -z-10" />
          <div
            aria-hidden="true"
            className="absolute -right-48 top-8 -z-10 size-[520px] rounded-full bg-blue-100/70 blur-[100px]"
          />
          <div
            aria-hidden="true"
            className="absolute -left-40 bottom-0 -z-10 size-[380px] rounded-full bg-indigo-100/50 blur-[90px]"
          />

          <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[1.04fr_0.96fr] lg:gap-12 lg:pb-24 lg:pt-24">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm shadow-blue-900/5">
                <span className="size-2 rounded-full bg-emerald-500" />
                A more thoughtful way to be heard
              </div>
              <h1 className="mt-7 max-w-[680px] text-balance text-5xl leading-[1.08] font-semibold tracking-[-0.055em] text-ink sm:text-6xl lg:text-[4.35rem]">
                A better campus starts with{" "}
                <span className="text-brand">being heard.</span>
              </h1>
              <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-muted sm:text-xl">
                CampusConnect AI is a student-first way to turn campus concerns
                into clear next steps—with thoughtful AI support and people
                accountable for the follow-through.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <span>Raise a concern</span>
                  <Icon name="arrow-right" size={17} />
                </Link>
                <a
                  href="#approach"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/80 px-6 py-3 text-sm font-semibold text-ink transition hover:border-slate-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  Our principles
                </a>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-slate-600">
                <span className="inline-flex items-center gap-2">
                  <Icon name="shield-check" size={17} className="text-brand" />
                  Student-first by design
                </span>
                <span className="inline-flex items-center gap-2">
                  <Icon name="users" size={17} className="text-brand" />
                  AI-assisted, people-led
                </span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[560px] lg:mr-0">
              <div className="float-gently absolute -right-3 -top-5 z-10 hidden items-center gap-2 rounded-full border border-white bg-white px-4 py-2.5 text-xs font-semibold text-ink shadow-lg shadow-slate-900/10 sm:flex lg:-right-5">
                <span className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Icon name="sparkles" size={15} />
                </span>
                Product concept preview
              </div>
              <div className="absolute -bottom-8 -left-8 size-36 rounded-full border border-blue-200/60" />
              <div className="absolute -bottom-2 -left-2 size-28 rounded-full border border-indigo-200/60" />
              <div className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_32px_90px_-40px_rgba(27,52,98,0.42)] ring-1 ring-slate-900/5">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-7">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                      <Icon name="sparkles" size={19} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        CampusConnect assistant
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        A sample student experience
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] text-slate-500 uppercase">
                    Preview
                  </span>
                </div>
                <div className="bg-[#f7f9fd] px-5 py-5 sm:px-7 sm:py-7">
                  <p className="text-[10px] font-bold tracking-[0.16em] text-slate-400 uppercase">
                    Sample conversation
                  </p>
                  <div className="mt-4 flex justify-end">
                    <p className="max-w-[86%] rounded-2xl rounded-br-md bg-[#20365b] px-4 py-3 text-sm leading-6 text-white shadow-sm">
                      The study room in the library has had a broken light for
                      a few days.
                    </p>
                  </div>
                  <div className="mt-4 flex items-start gap-3">
                    <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl bg-white text-brand shadow-sm ring-1 ring-slate-100">
                      <Icon name="sparkles" size={16} />
                    </span>
                    <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-slate-100 bg-white px-4 py-3.5 shadow-sm">
                      <p className="text-sm font-semibold text-ink">
                        Thanks for speaking up.
                      </p>
                      <p className="mt-1.5 text-sm leading-6 text-muted">
                        A clear description can help the right campus team
                        understand what needs attention.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-100 bg-white p-3.5">
                      <p className="text-[11px] font-medium text-muted">
                        Suggested topic
                      </p>
                      <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                        <Icon name="building" size={15} className="text-brand" />
                        Facilities
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white p-3.5">
                      <p className="text-[11px] font-medium text-muted">
                        Review
                      </p>
                      <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                        <Icon
                          name="check-circle"
                          size={15}
                          className="text-emerald-600"
                        />
                        People-led
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-center gap-2 border-t border-slate-200/70 pt-4 text-xs font-medium text-slate-500">
                    <Icon name="lock" size={14} />
                    Illustrative only · Nothing is submitted
                  </div>
                </div>
              </div>
              <div className="absolute -right-4 bottom-12 hidden size-12 items-center justify-center rounded-2xl border border-white bg-white text-brand shadow-lg shadow-slate-900/10 sm:flex">
                <Icon name="heart" size={21} />
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <SectionLabel>A simpler path forward</SectionLabel>
              <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.045em] text-ink sm:text-5xl">
                From “something is wrong” to “here is what happens next.”
              </h2>
              <p className="mt-5 text-base leading-7 text-muted sm:text-lg">
                The experience is designed to make raising a concern feel
                clearer, more respectful, and easier to follow.
              </p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {steps.map((step) => (
                <article
                  key={step.number}
                  className="group rounded-[24px] border border-line bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5 sm:p-8"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand transition group-hover:bg-brand group-hover:text-white">
                      <Icon name={step.icon} size={21} />
                    </span>
                    <span className="text-sm font-semibold tracking-[0.12em] text-slate-300">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="mt-7 text-xl font-semibold tracking-[-0.025em] text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-muted">
                    {step.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="approach"
          className="scroll-mt-24 border-y border-slate-100 bg-canvas py-20 sm:py-28"
        >
          <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20">
            <div className="max-w-xl">
              <SectionLabel>Trust is part of the product</SectionLabel>
              <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.045em] text-ink sm:text-5xl">
                Helpful technology should feel human.
              </h2>
              <p className="mt-5 text-base leading-7 text-muted sm:text-lg">
                Campus concerns can be personal. The right experience should
                make the process easier without taking control away from the
                people it is meant to serve.
              </p>
              <a
                href="#for-campus"
                className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:text-brand-dark"
              >
                What this means for campus teams
                <Icon name="arrow-right" size={17} />
              </a>
            </div>
            <div className="space-y-3">
              {principles.map((principle, index) => (
                <article
                  key={principle.title}
                  className="flex gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-900/[0.02] sm:gap-5 sm:p-6"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <Icon name={principle.icon} size={20} />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold tracking-[0.14em] text-slate-300">
                        0{index + 1}
                      </span>
                      <h3 className="text-base font-semibold text-ink">
                        {principle.title}
                      </h3>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {principle.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="for-campus" className="scroll-mt-24 bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <SectionLabel>For campus teams</SectionLabel>
                <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.045em] text-ink sm:text-5xl">
                  Better listening can make campus feel more connected.
                </h2>
              </div>
              <p className="max-w-md text-base leading-7 text-muted">
                A shared, thoughtful process can help surface what needs
                attention and make follow-through easier to understand.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {campusAreas.map((area) => (
                <article
                  key={area.title}
                  className="rounded-[22px] border border-line bg-white p-6"
                >
                  <span className="flex size-11 items-center justify-center rounded-xl bg-[#f1f5ff] text-brand">
                    <Icon name={area.icon} size={20} />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold tracking-[-0.02em] text-ink">
                    {area.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {area.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 sm:px-8 sm:pb-28">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[30px] bg-ink px-6 py-12 text-white sm:px-12 sm:py-16 lg:px-16">
            <div
              aria-hidden="true"
              className="absolute -right-24 -top-44 size-[420px] rounded-full border border-white/10"
            />
            <div
              aria-hidden="true"
              className="absolute -right-8 -top-28 size-[300px] rounded-full border border-white/10"
            />
            <div className="relative flex flex-col justify-between gap-8 md:flex-row md:items-center">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold tracking-[0.17em] text-blue-200 uppercase">
                  CampusConnect AI
                </p>
                <h2 className="mt-4 text-balance text-3xl leading-tight font-semibold tracking-[-0.04em] sm:text-4xl">
                  A more connected campus starts with listening.
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                  Explore the idea behind a clearer, more student-centered
                  feedback loop.
                </p>
              </div>
              <Link
                href="/register"
                className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Start a grievance
                <Icon name="arrow-up-right" size={16} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <BrandMark />
            <span className="hidden text-slate-300 sm:inline">|</span>
            <p className="text-xs leading-5 text-muted">
              A clearer path from campus concerns to positive change.
            </p>
          </div>
          <a
            href="#top"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-brand"
          >
            Back to top
            <Icon name="arrow-up-right" size={14} />
          </a>
          <Link
            className="text-xs font-semibold text-slate-500 transition hover:text-brand"
            href="/admin/login"
          >
            Administrator sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
