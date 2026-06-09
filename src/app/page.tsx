import Link from 'next/link';
import { Building2, Store, ShoppingBag, ChevronRight } from 'lucide-react';

const ROLES = [
  {
    role: 'brand',
    icon: Building2,
    label: "I'm a Brand",
    desc: 'Upload products, send samples, fulfil orders.',
  },
  {
    role: 'retailer',
    icon: Store,
    label: "I'm a Retailer",
    desc: 'Display samples, earn commission.',
  },
  {
    role: 'consumer',
    icon: ShoppingBag,
    label: "I'm Shopping",
    desc: 'Scan, discover makers, buy before you leave.',
  },
] as const;

export default function Home() {
  return (
    <main className="relative mx-auto min-h-screen w-full max-w-md overflow-hidden bg-[#1A0F08] text-[#F3EADE]">
      {/* Full-bleed hero image (gradient stands in for photography) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(160deg, #E0915C 0%, #7a3f1f 70%, #2a1308 100%)',
        }}
      />
      {/* Exact legibility overlay from the prototype */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(transparent 40%, rgba(21,16,10,0.65) 78%, #1A0F08 100%)',
        }}
      />

      {/* Top bar — logo + login */}
      <div className="absolute left-0 right-0 top-[54px] z-10 flex items-center justify-between px-[26px]">
        <span
          className="text-[24px] italic"
          style={{ fontFamily: 'var(--font-fraunces), Georgia, serif', fontWeight: 500 }}
        >
          Cirkle<span className="not-italic text-[#E0915C]">.</span>
        </span>
        <Link href="/auth/login" className="text-[13px] text-[#B49C84] hover:text-[#F3EADE]">
          Log in
        </Link>
      </div>

      {/* Lookbook tag */}
      <span className="absolute bottom-3 left-3 z-10 text-[9px] uppercase tracking-[1.5px] text-white/65">
        Lookbook · SS26
      </span>

      {/* Body — anchored to the bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-[26px] pb-[34px]">
        {/* Dots */}
        <div className="mb-5 flex gap-1.5">
          <i className="h-[7px] w-[22px] rounded-[4px] bg-[#E0915C]" />
          <i className="h-[7px] w-[7px] rounded-full bg-white/25" />
          <i className="h-[7px] w-[7px] rounded-full bg-white/25" />
        </div>

        {/* Headline */}
        <h1
          className="text-[42px] leading-[1.02]"
          style={{ fontFamily: 'var(--font-fraunces), Georgia, serif', fontWeight: 500 }}
        >
          Fashion worth
          <br />
          the <em className="italic">detour</em>
          <span className="ml-1 inline-block h-[13px] w-[13px] rounded-full bg-[#E0915C] align-baseline" />
        </h1>

        {/* Subcopy */}
        <p className="mb-[22px] mt-1.5 max-w-[300px] text-[14px] leading-[1.55] text-[#B49C84]">
          Scan a tag in your favourite café or shop. Discover the maker. Buy it
          before you leave.
        </p>

        {/* Role options, lined up */}
        <div className="space-y-2.5">
          {ROLES.map(({ role, icon: Icon, label, desc }, i) => {
            const primary = i === 2;
            return (
              <Link
                key={role}
                href={`/auth/signup?role=${role}`}
                className={`group flex items-center gap-3.5 rounded-[18px] px-4 py-3 transition active:scale-[0.98] ${
                  primary
                    ? 'bg-[#F3EADE] text-[#1A0F08]'
                    : 'border border-[#3A281B] bg-[#241509]/80 text-[#F3EADE] backdrop-blur'
                }`}
              >
                <span
                  className={`grid h-10 w-10 flex-none place-items-center rounded-xl ${
                    primary ? 'bg-[#1A0F08]/10' : 'bg-[#1A0F08]/60'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold leading-tight">
                    {label}
                  </span>
                  <span
                    className={`block text-[11.5px] leading-tight ${
                      primary ? 'text-[#1A0F08]/65' : 'text-[#B49C84]'
                    }`}
                  >
                    {desc}
                  </span>
                </span>
                <ChevronRight
                  className={`h-[18px] w-[18px] flex-none transition group-hover:translate-x-0.5 ${
                    primary ? 'opacity-50' : 'opacity-45'
                  }`}
                />
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
