import { statSync } from 'node:fs'
import { expect, test } from 'vitest'

test('logo and portrait files exist', () => {
  for (const file of ['public/logo-mark.png', 'public/logo-wordmark.png', 'public/portrait.png']) {
    expect(statSync(file).size).toBeGreaterThan(1000)
  }
})
