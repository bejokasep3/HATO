import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NextRequest } from 'next/server'
import { authenticateAdmin } from '../../src/lib/auth/admin'
import { GET as cronGet } from '../../src/app/api/cron/cycles/route'

test('A11: auth configuration missing fails closed', async () => {
  const previous = process.env.HATO_ADMIN_USER_ID
  delete process.env.HATO_ADMIN_USER_ID
  try {
    const result = await authenticateAdmin(new NextRequest('http://localhost/api/orders'))
    assert.equal(result.error?.status, 503)
  } finally {
    if (previous === undefined) delete process.env.HATO_ADMIN_USER_ID
    else process.env.HATO_ADMIN_USER_ID = previous
  }
})

test('A11: missing session and wrong cookie origin are denied before business handler', async () => {
  const saved = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    admin: process.env.HATO_ADMIN_USER_ID,
    app: process.env.NEXT_PUBLIC_APP_URL,
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key'
  process.env.HATO_ADMIN_USER_ID = '11111111-1111-4111-8111-111111111111'
  process.env.NEXT_PUBLIC_APP_URL = 'https://hato.example'
  try {
    const noSession = await authenticateAdmin(new NextRequest('https://hato.example/api/orders'))
    assert.equal(noSession.error?.status, 401)
    const wrongOrigin = await authenticateAdmin(new NextRequest('https://hato.example/api/orders', {
      method: 'POST', headers: { cookie: 'unrelated=1', origin: 'https://attacker.example' },
    }))
    assert.equal(wrongOrigin.error?.status, 403)
  } finally {
    for (const [name, value] of Object.entries({
      NEXT_PUBLIC_SUPABASE_URL: saved.url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: saved.key,
      HATO_ADMIN_USER_ID: saved.admin,
      NEXT_PUBLIC_APP_URL: saved.app,
    })) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
})

test('A11: cron requires secret and remains inactive when authenticated', async () => {
  const saved = process.env.CRON_SECRET
  try {
    delete process.env.CRON_SECRET
    assert.equal((await cronGet(new NextRequest('http://localhost/api/cron/cycles'))).status, 503)
    process.env.CRON_SECRET = 'fixture-secret'
    assert.equal((await cronGet(new NextRequest('http://localhost/api/cron/cycles'))).status, 401)
    const allowed = await cronGet(new NextRequest('http://localhost/api/cron/cycles', {
      headers: { authorization: 'Bearer fixture-secret' },
    }))
    assert.equal(allowed.status, 200)
    assert.equal((await allowed.json()).status, 'disabled')
  } finally {
    if (saved === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = saved
  }
})
