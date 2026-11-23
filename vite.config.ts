import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

/** Локальный запуск серверных функций из api/ тем же способом, каким их вызывает Vercel. Только для `pnpm dev`. */
function localApi(): Plugin {
  return {
    name: 'mayak-local-api',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, loadEnv('development', process.cwd(), ''))
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost')
        const m = url.pathname.match(/^\/api\/([a-z0-9-]+)$/)
        if (!m) return next()
        const file = path.join(process.cwd(), 'api', m[1] + '.js')
        if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('Not found') }
        try {
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const raw = Buffer.concat(chunks).toString('utf8')
          const type = String(req.headers['content-type'] || '')
          let body: unknown = raw
          if (type.includes('application/json')) { try { body = raw ? JSON.parse(raw) : {} } catch { body = {} } }
          else if (type.includes('application/x-www-form-urlencoded')) body = Object.fromEntries(new URLSearchParams(raw))
          const q = Object.fromEntries(url.searchParams)
          const r = res as any
          r.status = (code: number) => { res.statusCode = code; return r }
          r.json = (data: unknown) => { if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(data)); return r }
          r.send = (data: unknown) => { if (typeof data === 'object' && data !== null) return r.json(data); res.end(String(data ?? '')); return r }
          const mod = await import(pathToFileURL(file).href + '?t=' + fs.statSync(file).mtimeMs)
          await mod.default(Object.assign(req, { body, query: q }), r)
        } catch (e) {
          console.error('[api]', m[1], e)
          if (!res.writableEnded) { res.statusCode = 500; res.end(JSON.stringify({ ok: false, error: (e as Error).message })) }
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localApi()],
})
