import getDb from '@/lib/db';
import { methodAllowed, requireSession, parseNonNegativeInt } from '@/lib/apiGuards';

const PAGE_SIZE = 30;

export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['GET'])) return;
  const session = await requireSession(req, res);
  if (!session) return;

  const userId = session.user.id;
  let offset = 0;
  try {
    if (req.query.offset !== undefined) offset = parseNonNegativeInt(req.query.offset, 'offset');
  } catch (err) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }

  const db = getDb();

  const rows = db.prepare(`
    SELECT t.id, t.type, t.amount, t.createdAt, t.fromUserId, t.toUserId,
      fu.username as fromUsername, tu.username as toUsername
    FROM transactions t
    LEFT JOIN users fu ON t.fromUserId = fu.id
    LEFT JOIN users tu ON t.toUserId = tu.id
    WHERE t.fromUserId = ? OR t.toUserId = ?
    ORDER BY t.createdAt DESC, t.id DESC
    LIMIT ? OFFSET ?
  `).all(userId, userId, PAGE_SIZE + 1, offset);

  const hasMore = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE).map((row) => {
    // "give" ist der einzige Typ mit zwei echten Parteien -- Vorzeichen haengt davon ab, auf
    // welcher Seite der aktuelle Nutzer steht. Alle anderen Typen werden immer mit
    // fromUserId = betroffener Nutzer gebucht (siehe recordTransaction()-Aufrufe im Code),
    // toUserId bleibt dort ungenutzt/null.
    let direction;
    let counterpart = null;
    if (row.type === 'give') {
      if (row.toUserId === userId) {
        direction = 'in';
        counterpart = row.fromUsername;
      } else {
        direction = 'out';
        counterpart = row.toUsername;
      }
    } else if (row.type === 'premium_redeem') {
      direction = 'out';
    } else {
      direction = 'in';
    }
    return {
      id: row.id,
      type: row.type,
      amount: row.amount,
      createdAt: row.createdAt,
      direction,
      counterpart,
    };
  });

  res.status(200).json({ items: page, hasMore, nextOffset: offset + PAGE_SIZE });
}
