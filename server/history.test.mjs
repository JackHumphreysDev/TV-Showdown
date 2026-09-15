import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { groupHistory } from './history.mjs';

function historyDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE spin_sessions (
    id TEXT PRIMARY KEY, group_id TEXT NOT NULL, state TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE spin_results (
    id TEXT PRIMARY KEY, session_id TEXT NOT NULL, profile_name TEXT NOT NULL,
    title TEXT NOT NULL, kind TEXT NOT NULL, year INTEGER, state TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`);
  return db;
}

test('group history keeps skipped results and orders the newest outcome first', () => {
  const db = historyDatabase();
  db.exec(`INSERT INTO spin_sessions VALUES
    ('round-one', 'group-one', 'accepted', '2026-09-14 18:00:00'),
    ('round-two', 'group-one', 'active', '2026-09-14 19:00:00'),
    ('other-round', 'group-two', 'accepted', '2026-09-14 20:00:00');
  INSERT INTO spin_results VALUES
    ('first-pick', 'round-one', 'Rachel', 'Film A', 'movie', 2024, 'skipped', '2026-09-14 18:00:01'),
    ('second-pick', 'round-one', 'Rachel', 'Film B', 'movie', 2025, 'accepted', '2026-09-14 18:00:02'),
    ('current-pick', 'round-two', 'Regis', 'Series C', 'series', 2026, 'pending', '2026-09-14 19:00:01'),
    ('private-pick', 'other-round', 'Alex', 'Film D', 'movie', 2023, 'accepted', '2026-09-14 20:00:01');`);

  const rows = groupHistory(db, 'group-one');

  assert.deepEqual(rows.map((row) => row.id), ['current-pick', 'second-pick', 'first-pick']);
  assert.deepEqual(rows.map((row) => row.resultState), ['pending', 'accepted', 'skipped']);
  assert.equal(rows[0].sessionState, 'active');
  assert.equal(rows[1].sessionId, 'round-one');
  assert.equal(rows.some((row) => row.id === 'private-pick'), false);
});

test('group history applies a bounded result limit', () => {
  const db = historyDatabase();
  db.exec(`INSERT INTO spin_sessions VALUES ('round-one', 'group-one', 'active', '2026-09-14 18:00:00');
  INSERT INTO spin_results VALUES
    ('first-pick', 'round-one', 'Rachel', 'Film A', 'movie', 2024, 'skipped', '2026-09-14 18:00:01'),
    ('second-pick', 'round-one', 'Rachel', 'Film B', 'movie', 2025, 'pending', '2026-09-14 18:00:02');`);

  assert.equal(groupHistory(db, 'group-one', 1).length, 1);
  assert.equal(groupHistory(db, 'group-one', 1)[0].id, 'second-pick');
});
