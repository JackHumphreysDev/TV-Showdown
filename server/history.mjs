export function groupHistory(db, groupId, limit = 60) {
  const pageSize = Math.max(1, Math.min(100, Number(limit) || 60));
  return db.prepare(`SELECT sr.id, ss.id AS sessionId, ss.state AS sessionState,
    ss.created_at AS roundStartedAt, sr.created_at AS createdAt,
    sr.profile_name AS winnerName, sr.title, sr.kind, sr.year,
    sr.state AS resultState
    FROM spin_sessions ss JOIN spin_results sr ON sr.session_id=ss.id
    WHERE ss.group_id=?
    ORDER BY ss.rowid DESC, sr.rowid DESC LIMIT ?`).all(groupId, pageSize);
}
