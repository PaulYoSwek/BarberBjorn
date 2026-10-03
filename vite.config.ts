import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import type { IncomingMessage, ServerResponse } from 'node:http'

function adminLoginDev(expected: string) {
  return {
    name: 'admin-login-dev',
    configureServer(server: { middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/__admin-login' || req.method !== 'POST') {
          next()
          return
        }
        const chunks: Buffer[] = []
        req.on('data', (chunk) => chunks.push(chunk as Buffer))
        req.on('end', () => {
          let given = ''
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString() || '{}') as { password?: unknown }
            if (typeof body.password === 'string') given = body.password
          } catch {
            given = ''
          }
          const ok = expected.length > 0 && given === expected
          res.statusCode = ok ? 200 : 401
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok }))
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), adminLoginDev(env.ADMIN_PASSWORD ?? '')],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/animation-event-polyfill.ts', './src/test-setup.ts'],
    },
  }
})
