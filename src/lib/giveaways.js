// Ends open giveaways whose time is up and picks winners -- called lazily at the top of every
// giveaways read/write instead of via a cron job, since a Next.js API route has no persistent
// process to run one in. Cheap: only touches rows where ends_at has actually passed.
export function finalizeExpiredGiveaways(db) {
  const now = Date.now();
  const expired = db
    .prepare('SELECT * FROM giveaways WHERE ended_at IS NULL AND ends_at IS NOT NULL AND ends_at <= ?')
    .all(now);

  for (const giveaway of expired) {
    const entrants = db
      .prepare('SELECT userId FROM giveaway_entries WHERE giveawayId = ?')
      .all(giveaway.id)
      .map((row) => row.userId);

    const pool = [...entrants];
    const winnerCount = Math.min(giveaway.winners, pool.length);
    const winnerIds = [];
    for (let i = 0; i < winnerCount; i++) {
      const index = Math.floor(Math.random() * pool.length);
      winnerIds.push(pool.splice(index, 1)[0]);
    }

    db.prepare("UPDATE giveaways SET ended_at = datetime('now'), winner_ids = ? WHERE id = ?").run(
      JSON.stringify(winnerIds),
      giveaway.id,
    );
  }
}

export function serializeGiveaway(db, giveaway, userId) {
  const entryCount = db
    .prepare('SELECT COUNT(*) AS c FROM giveaway_entries WHERE giveawayId = ?')
    .get(giveaway.id).c;
  const entered = !!db
    .prepare('SELECT 1 FROM giveaway_entries WHERE giveawayId = ? AND userId = ?')
    .get(giveaway.id, userId);

  let winners = null;
  if (giveaway.ended_at) {
    const winnerIds = JSON.parse(giveaway.winner_ids || '[]');
    winners = winnerIds.map((id) => {
      const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id);
      return user ? { id: user.id, username: user.username } : { id, username: 'Unbekannt' };
    });
  }

  return {
    id: giveaway.id,
    prize: giveaway.prize,
    durationMinutes: giveaway.duration,
    winnerSlots: giveaway.winners,
    createdAt: giveaway.created_at,
    endsAt: giveaway.ends_at,
    ended: !!giveaway.ended_at,
    entryCount,
    entered,
    winners,
    isWinner: winners ? winners.some((w) => w.id === userId) : false,
  };
}
