import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getManagerAuthEmail, MANAGER_USER_ID } from '../../shared/auth/manager'

test('manager login maps the public user ID to the internal auth email', () => {
  assert.equal(MANAGER_USER_ID, 'admin')
  assert.equal(getManagerAuthEmail('admin'), 'admin@hato.invalid')
  assert.equal(getManagerAuthEmail(' ADMIN '), 'admin@hato.invalid')
})

test('unknown manager user IDs are rejected before authentication', () => {
  assert.equal(getManagerAuthEmail('operator'), null)
  assert.equal(getManagerAuthEmail(''), null)
})
