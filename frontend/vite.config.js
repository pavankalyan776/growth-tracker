import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // `npm test` renders the real app against a RUNNING backend (see README: "Testing")
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    testTimeout: 20000,
  },
})
