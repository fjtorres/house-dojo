import { defineConfig } from '@playwright/test'

// Needs the local Supabase stack (auth, realtime, Mailpit) running: npm run supabase:start
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  // the app picks its language from the browser; the specs are written against the Spanish texts
  use: { locale: 'es-ES', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5173/', reuseExistingServer: !process.env.CI },
})
