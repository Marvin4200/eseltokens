import getDb from '@/lib/db';
import { methodAllowed, requireSession, parseId, sendApiError } from '@/lib/apiGuards';

export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['DELETE'])) return;
  const session = await requireSession(req, res, ['admin', 'moderator']);
  if (!session) return;

  try {
    const db = getDb();
    const id = parseId(req.query.id, 'giveawayId');
    const result = db.prepare('DELETE FROM giveaways WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Giveaway nicht gefunden.' });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    return sendApiError(res, error);
  }
}
