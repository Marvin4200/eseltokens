import getDb from '@/lib/db';
import { methodAllowed, requireSession, parseId, sendApiError } from '@/lib/apiGuards';
import { finalizeExpiredGiveaways, serializeGiveaway } from '@/lib/giveaways';

export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['POST'])) return;
  const session = await requireSession(req, res);
  if (!session) return;

  try {
    const db = getDb();
    finalizeExpiredGiveaways(db);

    const id = parseId(req.query.id, 'giveawayId');
    const giveaway = db.prepare('SELECT * FROM giveaways WHERE id = ?').get(id);
    if (!giveaway) {
      return res.status(404).json({ error: 'Giveaway nicht gefunden.' });
    }
    if (giveaway.ended_at) {
      return res.status(400).json({ error: 'Dieses Giveaway ist bereits beendet.' });
    }

    // Idempotent: doppeltes Klicken/erneutes Absenden loest keinen Fehler aus, der Unique-Index
    // auf (giveawayId, userId) verhindert ohnehin eine zweite Zeile.
    db.prepare('INSERT OR IGNORE INTO giveaway_entries (giveawayId, userId) VALUES (?, ?)').run(
      id,
      session.user.id,
    );

    const updated = db.prepare('SELECT * FROM giveaways WHERE id = ?').get(id);
    return res.status(200).json({ giveaway: serializeGiveaway(db, updated, session.user.id) });
  } catch (error) {
    return sendApiError(res, error);
  }
}
