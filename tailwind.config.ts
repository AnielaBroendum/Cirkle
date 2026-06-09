import type { Config } from 'tailwindcss';

/**
 * Cirkle — "Espresso" warm-editorial theme.
 *
 * The app was originally built as a LIGHT UI (bg-white, text-gray-900, blue
 * `cirkle` accent). Rather than rewrite ~1,700 utility usages by hand, we ship
 * the dark Espresso design by REDEFINING the tokens those utilities resolve to:
 *
 *  • `gray`  ramp is INVERTED + warmed → gray-50 is the darkest page bg and
 *    gray-900/950 is cream text. So `bg-gray-50/100`, `border-gray-200/300`,
 *    `text-gray-900/700/500` all flip to the dark palette automatically.
 *  • `white` → a raised espresso surface, so `bg-white` cards become dark cards
 *    and `text-white` (used on accent buttons) becomes dark text on terracotta.
 *  • `black` → near-espresso black.
 *  • `cirkle` (the brand accent) → terracotta/espresso; the darkest steps (900/950,
 *    used as logo/heading text) become cream so they stay legible on dark.
 *
 * Raw palette (for reference / one-off use):
 *   bg #1A0F08 · surface #241509 · surface-2 #30200f · line #3A281B
 *   cream #F3EADE · muted #B49C84 · muted-2 #8A7257
 *   terracotta #E0915C · gold #D8A03A
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
        // Raised surface — `bg-white` cards become dark espresso panels.
        white: '#241509',
        // `text-black` / `bg-black` → deepest espresso.
        black: '#120A05',

        // Inverted, warmed neutral ramp. Light index = dark surface; dark index = cream.
        gray: {
          50: '#1A0F08',   // darkest page background  (bg-gray-50)
          100: '#241509',  // surface                  (bg-gray-100, border/divide-gray-100)
          200: '#30200F',  // raised / hairline         (bg-gray-200, border-gray-200)
          300: '#3A281B',  // borders & rules           (border-gray-300)
          400: '#8A7257',  // tertiary / muted text     (text-gray-400)
          500: '#B49C84',  // secondary text            (text-gray-500)
          600: '#C6B49B',  // body text                 (text-gray-600)
          700: '#DFD3C4',  // strong text               (text-gray-700)
          800: '#ECE3D6',  // near-headline
          900: '#F3EADE',  // primary text / cream      (text-gray-900)
          950: '#F8F2EA',
        },

        // Brand accent — terracotta over espresso. Used for buttons, links,
        // active states. 900/950 read as cream so logo/heading text stays legible.
        cirkle: {
          50: '#2E1C10',   // dark accent tint surface (bg-cirkle-50)
          100: '#3A2417',
          200: '#5E3A22',
          300: '#8B4F24',
          400: '#C2703C',
          500: '#E0915C',  // primary accent (bg-cirkle-500, buttons)
          600: '#D8824E',  // accent hover / links (text-cirkle-600)
          700: '#C97A47',  // pressed / accent text (text-cirkle-700)
          800: '#E8B488',  // light accent on dark
          900: '#F0E6D8',  // heading/logo text → cream (text-cirkle-900)
          950: '#F3EADE',  // logo text → cream (text-cirkle-950)
        },

        // Direct semantic tokens for new components built to the Espresso spec.
        espresso: {
          bg: '#1A0F08',
          surface: '#241509',
          'surface-2': '#30200F',
          line: '#3A281B',
          cream: '#F3EADE',
          muted: '#B49C84',
          'muted-2': '#8A7257',
        },
        terracotta: {
          DEFAULT: '#E0915C',
          dark: '#C97A47',
        },
        gold: '#D8A03A',
        sage: '#9CB88A',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-fraunces)', 'Georgia', 'serif'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
    },
  },
  plugins: [],
};

export default config;
