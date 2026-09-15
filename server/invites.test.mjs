import assert from 'node:assert/strict';
import test from 'node:test';
import { inviteProblem } from './invites.mjs';

test('invite errors distinguish invalid, revoked and expired codes', () => {
  assert.deepEqual(inviteProblem(null), {
    status: 404,
    message: 'This invite code is not valid. Check it and try again.',
  });
  assert.deepEqual(inviteProblem({ revokedAt: '2026-09-15 12:00:00', expired: 0 }), {
    status: 410,
    message: 'This invite has been revoked. Ask the group owner for a new one.',
  });
  assert.deepEqual(inviteProblem({ revokedAt: null, expired: 1 }), {
    status: 410,
    message: 'This invite has expired. Ask the group owner for a new one.',
  });
  assert.equal(inviteProblem({ revokedAt: null, expired: 0 }), null);
});
