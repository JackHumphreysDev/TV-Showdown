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
async function expectStatus(path, token, expected, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.equal(response.status, expected, `${method} ${path} should return ${expected}`);
}
const suffix = randomUUID().slice(0, 8);
const password = `test-password-${suffix}-only`;
const rachel = await call('/api/auth/register', null, 'POST', { email: `rachel-${suffix}@example.invalid`, password, name: 'Rachel' });
const regis = await call('/api/auth/register', null, 'POST', { email: `regis-${suffix}@example.invalid`, password, name: 'Regis' });
const outsider = await call('/api/auth/register', null, 'POST', { email: `outsider-${suffix}@example.invalid`, password, name: 'Outsider' });
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
await expectStatus(`/api/groups/${group.id}`, regis.token, 403, 'PATCH', { name: 'Not allowed' });
await expectStatus(`/api/groups/${group.id}`, regis.token, 403, 'DELETE');
await call('/api/watchlist', rachel.token, 'POST', { title: 'Rachel film', kind: 'movie' });
await call('/api/watchlist', rachel.token, 'POST', { title: 'Rachel series one', kind: 'series' });
await call('/api/watchlist', rachel.token, 'POST', { title: 'Rachel series two', kind: 'series' });
const watchedFilm = await call('/api/watchlist', rachel.token, 'POST', { title: 'Rachel watched film', kind: 'movie' });
await call(`/api/watchlist/${watchedFilm.id}`, rachel.token, 'PATCH', { status: 'watched' });
const watchingFilm = await call('/api/watchlist', rachel.token, 'POST', { title: 'Rachel watching film', kind: 'movie' });
await call(`/api/watchlist/${watchingFilm.id}`, rachel.token, 'PATCH', { status: 'watching' });
await call('/api/watchlist', regis.token, 'POST', { title: 'Regis film', kind: 'movie' });
const regisSeries = await call('/api/watchlist', regis.token, 'POST', { title: 'Regis series one', kind: 'series' });
await call('/api/watchlist', regis.token, 'POST', { title: 'Regis series two', kind: 'series' });
await call(`/api/watchlist/${regisSeries.id}`, regis.token, 'PATCH', { status: 'watching' });
const details = await call(`/api/groups/${group.id}`, regis.token);
assert.equal(details.members.length, 2);
assert.equal(details.watchlists.length, 6);
assert(details.watchlists.some((item) => item.title === 'Rachel film'));
assert(details.watchlists.some((item) => item.title === 'Regis series one' && item.status === 'watching'));
assert(!details.watchlists.some((item) => item.id === watchedFilm.id || item.id === watchingFilm.id));
const rachelOwnList = await call('/api/watchlist', rachel.token);
assert(rachelOwnList.some((item) => item.id === watchedFilm.id));
assert(rachelOwnList.some((item) => item.id === watchingFilm.id));
await expectStatus(`/api/groups/${group.id}`, outsider.token, 403);
await expectStatus(`/api/watchlist/${watchedFilm.id}`, regis.token, 404, 'PATCH', { status: 'want' });
const selected = [rachelMe.profile_id, regisMe.profile_id];
const first = await call(`/api/groups/${group.id}/spin`, rachel.token, 'POST', { selectedProfileIds: selected, filter: 'series', idempotencyKey: suffix });
assert.equal(first.result.kind, 'series');
const again = await call(`/api/groups/${group.id}/spin`, rachel.token, 'POST', { selectedProfileIds: selected, filter: 'series', idempotencyKey: suffix });
assert.equal(again.id, first.id);
const skipped = await call(`/api/groups/${group.id}/skip`, regis.token, 'POST', { version: first.version });
assert.notEqual(skipped.result.id, first.result.id);
assert.notEqual(skipped.result.title, first.result.title);
const accepted = await call(`/api/groups/${group.id}/accept`, regis.token, 'POST', { version: skipped.version });
assert.equal(accepted.state, 'accepted');
const history = await call(`/api/groups/${group.id}/history`, rachel.token);
assert.equal(history[0].resultState, 'accepted');
assert.equal(history[0].sessionId, first.id);
assert.equal(history[1].resultState, 'skipped');
assert.equal(history[1].sessionId, first.id);
await call(`/api/groups/${group.id}`, rachel.token, 'DELETE');
const groupsAfterDelete = await call('/api/groups', rachel.token);
assert.equal(groupsAfterDelete.some((item) => item.id === group.id), false);
console.log('API smoke test passed: separate accounts, owner-only group settings, invite, UK group, watchlists, eligible series, fair spin, idempotency, shared acceptance and group deletion.');
