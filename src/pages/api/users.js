import getDb from '@/lib/db';
import { methodAllowed, requireSession } from '@/lib/apiGuards';

export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['GET'])) return;
  const session = await requireSession(req, res);
  if (!session) return;

  const db = getDb();

  const users = db.prepare(`
    SELECT u.id, u.username, u.avatar, u.balance, u.xp, u.role,
      COALESCE(g.total, 0) as givenTotal
    FROM users u
    LEFT JOIN (
      SELECT fromUserId, SUM(amount) as total FROM transactions WHERE type = 'give' GROUP BY fromUserId
    ) g ON g.fromUserId = u.id
    WHERE u.role != ?
  `).all('pending');
  res.status(200).json(users);
}
