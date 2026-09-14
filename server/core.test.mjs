import test from 'node:test';
import assert from 'node:assert/strict';
import { draw, eligible, inviteCode } from './core.mjs';

test('want to watch movies and series are eligible', () => {
  assert.equal(eligible({ kind: 'movie', status: 'want' }), true);
  assert.equal(eligible({ kind: 'series', status: 'want' }), true);
});
test('watching series stay eligible but watching movies and watched items do not', () => {
  assert.equal(eligible({ kind: 'series', status: 'watching' }), true);
  assert.equal(eligible({ kind: 'movie', status: 'watching' }), false);
  assert.equal(eligible({ kind: 'series', status: 'watched' }), false);
});
test('type filter applies after status', () => {
  assert.equal(eligible({ kind: 'series', status: 'watching' }, 'movie'), false);
});
test('draw returns an input element', () => {
  const items = [1, 2, 3];
  assert.ok(items.includes(draw(items)));
  assert.throws(() => draw([]));
});
test('invite codes omit ambiguous characters', () => {
  assert.match(inviteCode(), /^[A-HJ-NP-Z2-9]{9}$/);
});
