import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{html,js,svelte,ts}'],
  safelist: ['dark'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1280px' }
    },
    extend: {
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',

        canvas: 'hsl(var(--canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'hsl(var(--surface) / <alpha-value>)',
          2: 'hsl(var(--surface-2) / <alpha-value>)'
        },
        ink: {
          DEFAULT: 'hsl(var(--ink) / <alpha-value>)',
          soft: 'hsl(var(--ink-soft) / <alpha-value>)'
        },

        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
          peach: 'hsl(var(--accent-peach) / <alpha-value>)',
          butter: 'hsl(var(--accent-butter) / <alpha-value>)',
          mint: 'hsl(var(--accent-mint) / <alpha-value>)',
          sky: 'hsl(var(--accent-sky) / <alpha-value>)',
          lilac: 'hsl(var(--accent-lilac) / <alpha-value>)'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)'
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)'
        },
        tile: {
          peach: {
            DEFAULT: 'hsl(var(--tile-peach) / <alpha-value>)',
            foreground: 'hsl(var(--tile-peach-foreground) / <alpha-value>)'
          },
          butter: {
            DEFAULT: 'hsl(var(--tile-butter) / <alpha-value>)',
            foreground: 'hsl(var(--tile-butter-foreground) / <alpha-value>)'
          },
          mint: {
            DEFAULT: 'hsl(var(--tile-mint) / <alpha-value>)',
            foreground: 'hsl(var(--tile-mint-foreground) / <alpha-value>)'
          },
          sky: {
            DEFAULT: 'hsl(var(--tile-sky) / <alpha-value>)',
            foreground: 'hsl(var(--tile-sky-foreground) / <alpha-value>)'
          },
          lilac: {
            DEFAULT: 'hsl(var(--tile-lilac) / <alpha-value>)',
            foreground: 'hsl(var(--tile-lilac-foreground) / <alpha-value>)'
          }
        },
        success: {
          DEFAULT: 'hsl(var(--success) / <alpha-value>)',
          foreground: 'hsl(var(--success-foreground) / <alpha-value>)'
        },
        warning: {
          DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
          foreground: 'hsl(var(--warning-foreground) / <alpha-value>)'
        },
        info: {
          DEFAULT: 'hsl(var(--info) / <alpha-value>)',
          foreground: 'hsl(var(--info-foreground) / <alpha-value>)'
        },
        severe: {
          DEFAULT: 'hsl(var(--severe) / <alpha-value>)',
          foreground: 'hsl(var(--severe-foreground) / <alpha-value>)'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)'
        },
        reaction: {
          ras: {
            DEFAULT: 'hsl(var(--reaction-ras) / <alpha-value>)',
            foreground: 'hsl(var(--reaction-ras-foreground) / <alpha-value>)'
          },
          inconfort: {
            DEFAULT: 'hsl(var(--reaction-inconfort) / <alpha-value>)',
            foreground: 'hsl(var(--reaction-inconfort-foreground) / <alpha-value>)'
          },
          reaction: {
            DEFAULT: 'hsl(var(--reaction-reaction) / <alpha-value>)',
            foreground: 'hsl(var(--reaction-reaction-foreground) / <alpha-value>)'
          }
        },
        celebrate: {
          DEFAULT: 'hsl(var(--celebrate) / <alpha-value>)',
          foreground: 'hsl(var(--celebrate-foreground) / <alpha-value>)'
        }
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius-lg)',
        md: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
        tile: 'var(--radius-tile)',
        hero: 'var(--radius-hero)'
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        card: 'var(--shadow-card)',
        soft: 'var(--shadow-soft)',
        lifted: 'var(--shadow-lifted)',
        glow: 'var(--shadow-glow)'
      },
      ringOffsetColor: {
        DEFAULT: 'hsl(var(--canvas) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        canvas: 'hsl(var(--canvas) / <alpha-value>)',
        surface: 'hsl(var(--surface) / <alpha-value>)'
      },
      transitionTimingFunction: {
        soft: 'var(--ease-soft)',
        spring: 'var(--ease-spring)',
        celebrate: 'var(--ease-celebrate)'
      },
      transitionDuration: {
        fast: 'var(--dur-fast)',
        base: 'var(--dur-base)',
        slow: 'var(--dur-slow)',
        celebrate: 'var(--dur-celebrate)'
      },
      fontFamily: {
        sans: [
          '"Inter Variable"',
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ],
        display: ['"Fraunces Variable"', 'Fraunces', 'Georgia', 'serif']
      }
    }
  }
};

export default config;
