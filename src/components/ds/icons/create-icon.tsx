import { forwardRef } from 'react';

export type IconProps = Omit<React.SVGProps<SVGSVGElement>, 'ref'> & {
  /** Width and height in px. Figma icons are 24. */
  size?: number | string;
};

/**
 * Builds a Flaym icon from the Figma "Icon / …" component. Strokes and fills use
 * `currentColor`, so colour the icon with a text class (e.g. `text-smoke`).
 */
export function createIcon(displayName: string, defaultStrokeWidth: number, children: React.ReactNode) {
  const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
    { size = 24, strokeWidth = defaultStrokeWidth, ...props },
    ref
  ) {
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        focusable="false"
        {...props}
      >
        {children}
      </svg>
    );
  });
  Icon.displayName = displayName;
  return Icon;
}
