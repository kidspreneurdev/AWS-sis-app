import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'
import type { IncomingMessage, ServerResponse } from 'http'

/**
 * Dev-only: serves api/student-portal/*.js the way Vercel does in production,
 * so `npm run dev` alone is enough to test student-portal endpoints without
 * needing `vercel dev` (which requires linking/logging into the Vercel CLI).
 * Never runs in the production build — see `apply: 'serve'` below.
 */
function mhsApiDevPlugin(env: Record<string, string>): Plugin {
  const apiDir = path.resolve(__dirname, 'api/student-portal')

  return {
    name: 'mhs-student-portal-api-dev',
    apply: 'serve',
    configureServer(server) {
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value
      }

      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const match = url.pathname.match(/^\/api\/student-portal\/([a-z0-9-]+)$/i)
        if (!match) return next()

        // All actions are dispatched through the single [action].js catch-all,
        // mirroring Vercel's dynamic-route file resolution in production.
        const handlerPath = path.join(apiDir, '[action].js')
        if (!fs.existsSync(handlerPath)) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: `No handler for ${match[1]}` }))
          return
        }

        const reqWithExtras = req as IncomingMessage & { query: Record<string, string>; body: unknown }
        reqWithExtras.query = { ...Object.fromEntries(url.searchParams), action: match[1] }

        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const raw = Buffer.concat(chunks).toString('utf8')
          try {
            reqWithExtras.body = raw ? JSON.parse(raw) : {}
          } catch {
            reqWithExtras.body = {}
          }
        }

        const resWithHelpers = res as ServerResponse & { status: (code: number) => ServerResponse; send: (body: string) => void }
        resWithHelpers.status = (code: number) => { res.statusCode = code; return res }
        resWithHelpers.send = (body: string) => { res.end(body) }

        try {
          // Cache-busting query so edits to the handler are picked up without restarting the dev server.
          const mod = await import(/* @vite-ignore */ `${handlerPath}?t=${Date.now()}`)
          await mod.default(reqWithExtras, resWithHelpers)
        } catch (err) {
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }))
          }
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), mhsApiDevPlugin(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
