import type { Viewport } from 'next';

// Browser and PWA status-bar colour on consumer screens: the v2 page background
// (`canvas-dark`, #1A1415, tailwind.config.ts). Metadata can't use Tailwind tokens,
// so the hex is repeated here. The portals keep the root layout's #2C2324.
export const CONSUMER_THEME_COLOR = '#1A1415';

export const consumerViewport: Viewport = { themeColor: CONSUMER_THEME_COLOR };
