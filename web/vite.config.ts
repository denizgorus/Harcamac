import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isGithubPages = Boolean(
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GITHUB_PAGES
)

export default defineConfig({
  base: isGithubPages ? '/Harcamac/' : '/',
  plugins: [react()]
})
