import type { Config } from 'tailwindcss';

/**
 * Flaym design system tokens (from the Figma "UI foundations" page).
 * Brand palette: Flaym #FF5000 · Flare #FFFFFF · Ash #D5D1C8 · Char #7B7673 · Obsidian #2C2324.
 * Use these tokens with the components in src/components/ds. Figma defines no
 * danger colour and no shadows: errors use the accent tones.
 */
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: '#FFFFFF', // light page background (bg-canvas)
          dark: '#2C2324', //    dark page background (bg-canvas-dark)
          warm: '#F4F2EE', //    warm off-white page background (bg-canvas-warm, Figma "Retail Portal")
        },
        surface: {
          DEFAULT: '#FFFFFF', // cards, inputs, segmented control
          muted: '#E7E3DB', //   secondary bars, neutral pill
          dark: '#3A2F30', //    raised card on bg-canvas-dark (Figma "App" frames)
        },
        primary: '#2C2324', //   Obsidian: text, primary button, nav, active segment
        'on-primary': '#FFFFFF', // text on obsidian / accent
        muted: '#7B7673', //     Char: muted text, labels, captions
        line: {
          DEFAULT: '#D5D1C8', // Ash: borders (border-line)
          dark: '#4A3E3F', //    dividers and borders on bg-canvas-dark (Figma "App" frames)
        },
        accent: {
          DEFAULT: '#FF5000', // Flaym: CTA, active states
          subtle: '#FFE3D6', //  "New" pill background
          strong: '#B33800', //  "New" pill text
        },
        success: {
          DEFAULT: '#2F7D4F', // "Delivered" pill text
          subtle: '#DCEFE3',
        },
        warning: {
          DEFAULT: '#B26A00', // "Pending" pill text
          subtle: '#FBECD2',
        },
      },
      fontFamily: {
        // Flaym: IBM Plex Mono (named `brand`, not `mono`, so preflight's
        // <code>/<pre> font stays unchanged).
        brand: ['var(--font-plex-mono)', 'ui-monospace', 'monospace'],
      },
      // Flaym type scale. Headings and labels are uppercase via the `uppercase` class.
      fontSize: {
        display: ['36px', { lineHeight: '1.3', letterSpacing: '0.7px' }],
        'heading-xl': ['32px', { lineHeight: '1.3', letterSpacing: '0.6px' }],
        'heading-lg': ['20px', { lineHeight: '1.3', letterSpacing: '0.4px' }],
        body: ['14px', { lineHeight: '1.3' }],
        caption: ['12px', { lineHeight: '1.3' }],
        label: ['11px', { lineHeight: '1.3', letterSpacing: '0.7px' }],
      },
      backgroundImage: {
        'flaym-gradient':
          'linear-gradient(180deg, #D5D1C8 0%, #EE9A6C 50%, #FF5000 70%, #7A2E12 100%)',
        // Figma "App / 03 Scan": backdrop behind the camera view.
        'flaym-scan':
          'linear-gradient(180deg, #8A3414 0%, #C4501C 30%, #5A2A1C 70%, #2C2324 100%)',
      },
      borderRadius: {
        // Flaym: square controls, fully rounded pills.
        control: '0px',
        pill: '9999px',
      },
    },
  },
  plugins: [],
};

export default config;
