import { cn } from './cn';

type LogoProps = {
  /** Rendered height in px; width follows the 400×142 artwork ratio. */
  height?: number;
  /** `framed` puts the white wordmark on an obsidian tile, for light backgrounds (as in Figma). */
  framed?: boolean;
  className?: string;
};

// Figma "Logo / flaym / white" — traced placeholder until the official vector file arrives.
export function Logo({ height = 24, framed = false, className }: LogoProps) {
  const width = Math.round((height * 400) / 142);
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icons/flaym-logo-white.svg" alt="flaym" width={width} height={height} className="block" />
  );
  if (!framed) return <span className={cn('inline-block', className)}>{img}</span>;
  return (
    <span className={cn('inline-flex items-center justify-center bg-primary px-[18px] py-4', className)}>
      {img}
    </span>
  );
}
