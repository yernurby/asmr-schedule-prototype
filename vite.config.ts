import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base MUST match the GitHub Pages sub-path, otherwise assets 404 on Pages.
export default defineConfig({
  base: '/asmr-schedule-prototype/',
  plugins: [react()],
})
