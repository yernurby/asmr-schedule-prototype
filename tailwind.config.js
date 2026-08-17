/** @type {import('tailwindcss').Config} */
// The real ASMR system uses the stock Tailwind palette (verified pixel-by-pixel
// against reference/screens). We therefore add NO custom colours — only
// semantic aliases that point at the exact values documented in
// docs/design-tokens.md. Never introduce a colour that is not listed there.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: '#F8FAFC', // slate-50
        surface: '#FFFFFF',
        muted: '#F1F5F9', // slate-100
        line: '#E2E8F0', // slate-200
        'line-strong': '#CBD5E1', // slate-300
        'line-input': '#E5E7EB', // gray-200
      },
      borderRadius: {
        // The system only ever uses 6px, 8px and full.
        card: '6px',
        modal: '8px',
      },
      spacing: {
        sidebar: '256px',
        topbar: '64px',
      },
      maxWidth: {
        modal: '512px',
      },
    },
  },
  plugins: [],
}
