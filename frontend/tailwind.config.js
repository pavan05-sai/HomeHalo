/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#F8F7F2',
        card: '#FFFFFF',
        primary: {
          DEFAULT: '#168568',
          hover: '#117155',
          foreground: '#FFFFFF',
        },
        foreground: '#242923',
        'muted-foreground': '#72776F',
        border: '#E8E6DE',
        secondary: '#EAF3EC',
        ring: '#168568',
        risk: {
          low: { bg: '#EAF3EC', text: '#0F6B52' },
          elevated: { bg: '#FFF4D6', text: '#8A5A00' },
          high: { bg: '#FFEAD9', text: '#A8420A' },
          critical: { bg: '#FDECEA', text: '#B42318' },
        },
      },
      borderRadius: {
        card: '16px',
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Fraunces Variable', 'Georgia', 'serif'],
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
      },
    },
  },
  plugins: [],
}
