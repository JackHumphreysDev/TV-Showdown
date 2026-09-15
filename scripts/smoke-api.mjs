import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = process.env.API_URL || 'http://127.0.0.1:4000';
async function call(path, token, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  assert.equal(response.ok, true, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
async function callError(path, token, expectedStatus) {
  const response = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const data = await response.json();
  assert.equal(response.status, expectedStatus, `GET ${path}: ${JSON.stringify(data)}`);
  return data;
}
const suffix = randomUUID().slice(0, 8);
const password = `test-password-${suffix}-only`;
const rachel = await call('/api/auth/register', null, 'POST', { email: `rachel-${suffix}@example.invalid`, password, name: 'Rachel' });
const regis = await call('/api/auth/register', null, 'POST', { email: `regis-${suffix}@example.invalid`, password, name: 'Regis' });
const rachelMe = await call('/api/me', rachel.token);
const regisMe = await call('/api/me', regis.token);
const group = await call('/api/groups', rachel.token, 'POST', { name: 'Film night test' });
const invite = await call(`/api/groups/${group.id}/invite`, rachel.token, 'POST');
const publicPreview = await call(`/api/invites/${invite.code}`, null);
assert.equal(publicPreview.name, 'Film night test');
assert.equal('members' in publicPreview, false);
const preview = await call(`/api/invites/${invite.code}`, regis.token);
assert.equal(preview.alreadyMember, false);
assert.deepEqual(preview.members.map((member) => member.name), ['Rachel']);
await call('/api/groups/join', regis.token, 'POST', { code: invite.code });
const joinedPreview = await call(`/api/invites/${invite.code}`, regis.token);
assert.equal(joinedPreview.alreadyMember, true);
assert.deepEqual(joinedPreview.members.map((member) => member.name), ['Rachel', 'Regis']);
await call('/api/watchlist', rachel.token, 'POST', { title: 'Rachel film', kind: 'movie' });
await call('/api/watchlist', rachel.token, 'POST', { title: 'Rachel series', kind: 'series' });
await call('/api/watchlist', regis.token, 'POST', { title: 'Regis film', kind: 'movie' });
const regisSeries = await call('/api/watchlist', regis.token, 'POST', { title: 'Regis series', kind: 'series' });
await call(`/api/watchlist/${regisSeries.id}`, regis.token, 'PATCH', { status: 'watching' });
const details = await call(`/api/groups/${group.id}`, regis.token);
assert.equal(details.members.length, 2);
assert.equal(details.watchlists.length, 4);
const selected = [rachelMe.profile_id, regisMe.profile_id];
const first = await call(`/api/groups/${group.id}/spin`, rachel.token, 'POST', { selectedProfileIds: selected, filter: 'series', idempotencyKey: suffix });
assert.equal(first.result.kind, 'series');
const again = await call(`/api/groups/${group.id}/spin`, rachel.token, 'POST', { selectedProfileIds: selected, filter: 'series', idempotencyKey: suffix });
assert.equal(again.id, first.id);
const accepted = await call(`/api/groups/${group.id}/accept`, regis.token, 'POST', { version: first.version });
assert.equal(accepted.state, 'accepted');
const history = await call(`/api/groups/${group.id}/history`, rachel.token);
assert.equal(history[0].resultState, 'accepted');
const revokedInvite = await call(`/api/groups/${group.id}/invite`, rachel.token, 'POST');
await call(`/api/groups/${group.id}/invites`, rachel.token, 'DELETE');
const revokedError = await callError(`/api/invites/${revokedInvite.code}`, regis.token, 410);
assert.match(revokedError.error, /revoked/i);
const invalidError = await callError('/api/invites/NOT-A-REAL-CODE', regis.token, 404);
assert.match(invalidError.error, /not valid/i);
console.log('API smoke test passed: separate accounts, private invite confirmation, repeat joining, revoked and invalid invite recovery, UK group, watchlists, eligible series, fair spin, idempotency and shared acceptance.');
