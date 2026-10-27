import type { Config } from 'tailwindcss';

/**
 * Flaym design system tokens, matched to the Figma "Flaym / Colour" variables.
 * Colour names are Figma's: Flare, Ash, Smoke, Char, Flaym, Obsidian, Cinder, Slate.
 * Text levels: dark app = flare / ash / smoke; light portals = obsidian / cinder / slate.
 * Char is for lines, borders and disabled states only, never text.
 * The semantic names below (primary, accent, line…) alias these colours.
 * Figma defines no danger colour and no shadows: errors use the accent tones.
 */
const FLAYM = {
  flare: '#FFFFFF', //    text/primary: primary text on dark
  ash: '#D5D1C8', //      text/secondary: secondary text on dark; borders on light
  smoke: '#ACA7A1', //    text/tertiary: meta, labels, inactive tabs on dark
  char: '#7B7673', //     line/char: lines, borders, disabled. Never text
  flaym: '#FF5000', //    brand/flaym
  obsidian: '#2C2324', // surface/obsidian; light/text primary
  cinder: '#4A3E3F', //   light/text secondary
  slate: '#5E5856', //    light/text tertiary: meta, labels, table headers on light
};

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ...FLAYM,
        canvas: {
          DEFAULT: FLAYM.flare, // light page background (bg-canvas)
          dark: FLAYM.obsidian, // dark page background (bg-canvas-dark)
          warm: '#F4F2EE', //      warm off-white page background (bg-canvas-warm, Figma "Retail Portal")
        },
        surface: {
          DEFAULT: FLAYM.flare, // cards, inputs, segmented control
          muted: '#E7E3DB', //     secondary bars, neutral pill
          dark: '#3A2F30', //      raised card on bg-canvas-dark (Figma "App" frames)
        },
        primary: FLAYM.obsidian, // text, primary button, nav, active segment
        'on-primary': FLAYM.flare, // text on obsidian / accent
        line: {
          DEFAULT: FLAYM.ash, //   borders on light pages (border-line)
          dark: FLAYM.cinder, //   dividers and borders on bg-canvas-dark
        },
        accent: {
          DEFAULT: FLAYM.flaym, // CTA, active states
          subtle: '#FFE3D6', //    "New" pill background
          strong: '#B33800', //    "New" pill text
        },
        success: {
          DEFAULT: '#2F7D4F', // "Delivered" pill text
          subtle: '#DCEFE3',
        },
        warning: {
          DEFAULT: '#8A5200', // status/warning text: "Pending" pill text (5.5:1 on warning-subtle)
          subtle: '#FBECD2',
        },
        'warning-text': '#8A5200',
      },
      fontFamily: {
        // Flaym: IBM Plex Mono (named `brand`, not `mono`, so preflight's
        // <code>/<pre> font stays unchanged).
        brand: ['var(--font-plex-mono)', 'ui-monospace', 'monospace'],
      },
      // Flaym type scale, from the sizes the Figma frames use (the file has no text styles).
      // Nothing is smaller than 12px. Headings, labels and buttons are uppercase via `uppercase`.
      fontSize: {
        display: ['36px', { lineHeight: '1.3', letterSpacing: '0.7px' }],
        'heading-xl': ['32px', { lineHeight: '1.3', letterSpacing: '0.6px' }],
        'heading-lg': ['20px', { lineHeight: '1.3', letterSpacing: '0.4px' }],
        title: ['18px', { lineHeight: '1.3' }], //       app screen titles, product names
        'body-lg': ['15px', { lineHeight: '1.3' }], //   app large buttons and list titles
        body: ['14px', { lineHeight: '1.3' }],
        'body-sm': ['13px', { lineHeight: '1.3' }], //   portal tables and app rows
        caption: ['12px', { lineHeight: '1.3' }],
        label: ['12px', { lineHeight: '1.3', letterSpacing: '0.7px' }],
        button: ['14px', { lineHeight: '1.3', letterSpacing: '0.8px' }],
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
