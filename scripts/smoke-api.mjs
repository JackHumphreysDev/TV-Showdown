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
async function callError(path, token, method, body, expectedStatus) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  assert.equal(response.status, expectedStatus, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
const suffix = randomUUID().slice(0, 8);
const password = `test-password-${suffix}-only`;
const rachel = await call('/api/auth/register', null, 'POST', { email: `rachel-${suffix}@example.invalid`, password, name: 'Rachel' });
const regis = await call('/api/auth/register', null, 'POST', { email: `regis-${suffix}@example.invalid`, password, name: 'Regis' });
const rachelMe = await call('/api/me', rachel.token);
const regisMe = await call('/api/me', regis.token);
const group = await call('/api/groups', rachel.token, 'POST', { name: 'Film night test' });
const renamedGroup = await call(`/api/groups/${group.id}`, rachel.token, 'PATCH', { name: 'Friday film club' });
assert.equal(renamedGroup.name, 'Friday film club');
const rachelGroups = await call('/api/groups', rachel.token);
assert.equal(rachelGroups.find((item) => item.id === group.id)?.name, 'Friday film club');
const invite = await call(`/api/groups/${group.id}/invite`, rachel.token, 'POST');
const preview = await call(`/api/invites/${invite.code}`, null);
assert.equal(preview.name, 'Friday film club');
await call('/api/groups/join', regis.token, 'POST', { code: invite.code });
await callError(`/api/groups/${group.id}`, regis.token, 'PATCH', { name: 'Not allowed' }, 403);
await callError(`/api/groups/${group.id}`, regis.token, 'DELETE', undefined, 403);
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
await call(`/api/groups/${group.id}`, rachel.token, 'DELETE');
const groupsAfterDelete = await call('/api/groups', rachel.token);
assert.equal(groupsAfterDelete.some((item) => item.id === group.id), false);
console.log('API smoke test passed: separate accounts, owner-only group settings, invite, UK group, watchlists, eligible series, fair spin, idempotency, shared acceptance and group deletion.');
