import Link from 'next/link';
import { Logo } from '@/components/ds';

type AuthShellProps = {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  intro?: React.ReactNode;
  children: React.ReactNode;
};

// Figma "Brand / Retail Portal / 01 Login": gradient art panel beside a white form
// column. Below lg the art becomes a short band above the form.
export function AuthShell({ eyebrow, title, intro, children }: AuthShellProps) {
  return (
    <main className="flex min-h-screen flex-col bg-canvas font-brand lg:flex-row">
      <Link
        href="/"
        aria-label="Flaym home"
        className="flex h-40 shrink-0 flex-col items-center justify-center gap-2 bg-flaym-gradient lg:sticky lg:top-0 lg:h-screen lg:w-1/2 lg:gap-5"
      >
        <Logo height={40} className="lg:hidden" />
        <Logo height={106} className="hidden lg:inline-block" />
        <span className="text-caption italic tracking-[4px] text-on-primary lg:text-body">FORWARD</span>
      </Link>

      <div className="flex flex-1 justify-center px-4 py-10 sm:px-6 lg:items-center lg:px-12 lg:py-16">
        <div className="w-full max-w-[440px] space-y-5">
          {(eyebrow || title || intro) && (
            <div>
              {eyebrow && <p className="text-label uppercase text-slate">{eyebrow}</p>}
              {title && <h1 className="mt-4 font-brand text-display uppercase text-primary">{title}</h1>}
              {intro && <p className="mt-3 text-body leading-[22.4px] text-slate">{intro}</p>}
            </div>
          )}
          {children}
        </div>
      </div>
    </main>
  );
}

/** Inline form error, same look as the brand onboarding error box. */
export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="border border-accent bg-accent-subtle px-4 py-3 text-body text-accent-strong">
      {children}
    </p>
  );
}
