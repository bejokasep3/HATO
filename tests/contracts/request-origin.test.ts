import assert from 'node:assert/strict'
import test from 'node:test'
import { isAllowedRequestOrigin } from '../../src/lib/auth/request-origin'

test('cookie mutations accept configured production aliases without permitting other hosts', () => {
  const canonical = 'https://hato-zeta.vercel.app'
  const aliases = 'https://hato-bejokasep3s-projects.vercel.app,https://hato-git-main-bejokasep3s-projects.vercel.app'
  assert.equal(isAllowedRequestOrigin(canonical, canonical, aliases), true)
  assert.equal(isAllowedRequestOrigin('https://hato-git-main-bejokasep3s-projects.vercel.app', canonical, aliases), true)
  assert.equal(isAllowedRequestOrigin('https://attacker.vercel.app', canonical, aliases), false)
  assert.equal(isAllowedRequestOrigin('https://hato-zeta.vercel.app.attacker.example', canonical, aliases), false)
  assert.equal(isAllowedRequestOrigin('http://hato-zeta.vercel.app', canonical, aliases), false)
})

test('missing and invalid cookie origins stay denied', () => {
  assert.equal(isAllowedRequestOrigin(null, 'https://hato.example'), false)
  assert.equal(isAllowedRequestOrigin('https://hato.example', undefined), false)
  assert.equal(isAllowedRequestOrigin('null', 'invalid', 'data:text/plain,test'), false)
  assert.equal(isAllowedRequestOrigin('http://localhost:3000', 'http://localhost:3000'), true)
})
