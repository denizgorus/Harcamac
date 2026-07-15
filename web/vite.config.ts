import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isGithubPages = Boolean(
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GITHUB_PAGES
)

export default defineConfig({
  base: isGithubPages ? './' : '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api/yahoo': {
        target: 'https://query2.finance.yahoo.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/yahoo/, ''),
        configure: proxy => {
          proxy.on('proxyReq', proxyRequest => {
            proxyRequest.setHeader('User-Agent', 'Mozilla/5.0 Harcamac/1.0')
            proxyRequest.setHeader('Accept', 'application/json,text/plain,*/*')
          })
        },
      },
      '/api/tefas': {
        target: 'https://www.tefas.gov.tr',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/tefas/, ''),
        configure: proxy => {
          proxy.on('proxyReq', proxyRequest => {
            proxyRequest.setHeader('User-Agent', 'Mozilla/5.0 Harcamac/1.0')
            proxyRequest.setHeader('Accept', 'application/json,text/plain,*/*')
          })
        },
      },
    },
  },
})
