import getDb from '@/lib/db';
import { methodAllowed, requireSession, parseNonNegativeInt, sendApiError } from '@/lib/apiGuards';
import { finalizeExpiredGiveaways, serializeGiveaway } from '@/lib/giveaways';

const MAX_DURATION_MINUTES = 60 * 24 * 14; // 14 Tage
const MAX_WINNER_SLOTS = 50;
const MAX_PRIZE_LENGTH = 200;

export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['GET', 'POST'])) return;
  const session = await requireSession(req, res);
  if (!session) return;

  try {
    const db = getDb();
    finalizeExpiredGiveaways(db);

    if (req.method === 'GET') {
      const rows = db.prepare('SELECT * FROM giveaways ORDER BY created_at DESC').all();
      const giveaways = rows.map((row) => serializeGiveaway(db, row, session.user.id));
      return res.status(200).json({ giveaways });
    }

    // POST: nur Admins/Moderatoren duerfen Giveaways anlegen.
    if (!['admin', 'moderator'].includes(session.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const prize = String(req.body?.prize || '').trim();
    if (!prize || prize.length > MAX_PRIZE_LENGTH) {
      return res.status(400).json({ error: `Prize muss 1-${MAX_PRIZE_LENGTH} Zeichen lang sein.` });
    }
    const duration = parseNonNegativeInt(req.body?.duration, 'duration', MAX_DURATION_MINUTES);
    if (duration < 1) {
      return res.status(400).json({ error: 'duration muss mindestens 1 Minute sein.' });
    }
    const winners = parseNonNegativeInt(req.body?.winners, 'winners', MAX_WINNER_SLOTS);
    if (winners < 1) {
      return res.status(400).json({ error: 'winners muss mindestens 1 sein.' });
    }

    const now = Date.now();
    const endsAt = now + duration * 60_000;
    const result = db
      .prepare('INSERT INTO giveaways (prize, duration, winners, ends_at) VALUES (?, ?, ?, ?)')
      .run(prize, duration, winners, endsAt);

    const created = db.prepare('SELECT * FROM giveaways WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json({ giveaway: serializeGiveaway(db, created, session.user.id) });
  } catch (error) {
    return sendApiError(res, error);
  }
}
