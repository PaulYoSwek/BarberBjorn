import { readFileSync } from 'node:fs'
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
