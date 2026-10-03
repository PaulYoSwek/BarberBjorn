import { statSync } from 'node:fs'
import { expect, test } from 'vitest'

test('logo and portrait files exist', () => {
  for (const file of ['public/logo-mark.png', 'public/logo-wordmark.png', 'public/logo-name.png', 'public/portrait.png', 'public/favicon.png']) {
    expect(statSync(file).size).toBeGreaterThan(1000)
  }
})

test('hero video exists', () => {
  expect(statSync('public/hero.mp4').size).toBeGreaterThan(10_000)
})
