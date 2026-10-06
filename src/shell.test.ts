import { readdirSync, readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

test('vercel serves /admin through the app and leaves /api to serverless routes', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
    rewrites?: { source: string; destination: string }[]
    headers?: { source: string; headers: { key: string; value: string }[] }[]
  }
  expect(config.rewrites).toEqual([{ source: '/((?!api/).*)', destination: '/index.html' }])
  const assets = config.headers?.find((rule) => rule.source === '/assets/(.*)')
  expect(assets?.headers).toContainEqual({ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' })
})

test('the shell defines the locked colors and no radius tokens', () => {
  const css = readFileSync('src/styles.css', 'utf8')
  expect(css).toContain('--yellow: #f5c400')
  expect(css).toContain('--paper: #efece4')
  expect(css).toContain('--paper-warm: #e4dfd4')
  expect(css).toContain('--about: #2a2a2a')
  expect(css).toContain('--ink: #101010')
  expect(css).not.toMatch(/border-radius:\s*[1-9]/)
})

test('the map box outranks the late-loading Mapbox stylesheet', () => {
  const css = readFileSync('src/styles.css', 'utf8')
  // `.mapboxgl-map { position: relative }` arrives after our CSS; a single-class rule would lose and collapse the map.
  expect(css).toMatch(/\.hero-map \.map-canvas \{[^}]*position: absolute/)
  expect(css).not.toMatch(/^\.map-canvas \{/m)
})

test('the template migration carries every starting mail text', async () => {
  const { MAIL_TEMPLATES } = await import('./mail-templates')
  // The newest migration that writes mail templates must carry the current texts.
  const latest = readdirSync('supabase/migrations')
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .reverse()
    .find((file) => readFileSync(`supabase/migrations/${file}`, 'utf8').includes('mail_templates'))
  const sql = readFileSync(`supabase/migrations/${latest}`, 'utf8')
  for (const langs of Object.values(MAIL_TEMPLATES)) {
    for (const { subject, body } of Object.values(langs)) {
      expect(sql).toContain(subject.replaceAll("'", "''"))
      expect(sql).toContain(body.replaceAll("'", "''"))
    }
  }
})

test('the dashboard has its own home-screen app that opens /admin', () => {
  const admin = JSON.parse(readFileSync('public/admin.webmanifest', 'utf8')) as Record<string, string>
  const site = JSON.parse(readFileSync('public/site.webmanifest', 'utf8')) as Record<string, string>
  expect(admin.start_url).toBe('/admin')
  expect(admin.scope).toBe('/admin')
  expect(admin.display).toBe('standalone')
  expect(admin.id).not.toBe(site.id)
  expect(site.start_url).toBe('/')
  const html = readFileSync('index.html', 'utf8')
  expect(html).toContain("location.pathname.indexOf('/admin') === 0")
  expect(html).toContain("'/admin.webmanifest'")
})
