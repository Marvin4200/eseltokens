import getDb from '@/lib/db';

function requireIntegrationSecret(req, res) {
  const expected = (process.env.SHOP_INTEGRATION_SECRET || '').trim();
  if (!expected) {
    res.status(503).json({ error: 'Admin integration is not configured' });
    return false;
  }
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (token !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

const WINDOW_DAYS = 7;

// Server-zu-Server-Pendant zu /api/admin/fraud-signals (session-basiert) fuer
// admin.eselbande.com -- identische Queries, nur secret- statt session-authentifiziert.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  if (!requireIntegrationSecret(req, res)) return;

  const db = getDb();
  const since = `datetime('now', '-${WINDOW_DAYS} days')`;

  const funnelingPairs = db.prepare(`
    SELECT t.fromUserId, t.toUserId, fu.username as fromUsername, tu.username as toUsername,
      COUNT(*) as transferCount, SUM(t.amount) as totalAmount, MAX(t.createdAt) as lastAt
    FROM transactions t
    JOIN users fu ON t.fromUserId = fu.id
    JOIN users tu ON t.toUserId = tu.id
    WHERE t.type = 'give' AND t.createdAt >= ${since}
    GROUP BY t.fromUserId, t.toUserId
    HAVING transferCount >= 3 OR totalAmount >= 2000
    ORDER BY totalAmount DESC
    LIMIT 25
  `).all();

  const pingPongPairs = db.prepare(`
    SELECT a.fromUserId as userA, a.toUserId as userB,
      ua.username as userAName, ub.username as userBName,
      a.forwardCount, a.forwardAmount, b.backwardCount, b.backwardAmount
    FROM (
      SELECT fromUserId, toUserId, COUNT(*) as forwardCount, SUM(amount) as forwardAmount
      FROM transactions
      WHERE type = 'give' AND createdAt >= ${since}
      GROUP BY fromUserId, toUserId
    ) a
    JOIN (
      SELECT fromUserId, toUserId, COUNT(*) as backwardCount, SUM(amount) as backwardAmount
      FROM transactions
      WHERE type = 'give' AND createdAt >= ${since}
      GROUP BY fromUserId, toUserId
    ) b ON b.fromUserId = a.toUserId AND b.toUserId = a.fromUserId
    JOIN users ua ON ua.id = a.fromUserId
    JOIN users ub ON ub.id = a.toUserId
    WHERE a.fromUserId < a.toUserId
    ORDER BY (a.forwardAmount + b.backwardAmount) DESC
    LIMIT 25
  `).all();

  const freshBigReceivers = db.prepare(`
    SELECT u.id as userId, u.username, u.createdAt,
      SUM(t.amount) as receivedAmount, COUNT(*) as receivedCount
    FROM users u
    JOIN transactions t ON t.toUserId = u.id AND t.type = 'give'
    WHERE u.createdAt >= datetime('now', '-3 days')
    GROUP BY u.id
    HAVING receivedAmount >= 1000
    ORDER BY receivedAmount DESC
    LIMIT 25
  `).all();

  const hubReceivers = db.prepare(`
    SELECT t.toUserId as userId, u.username,
      COUNT(DISTINCT t.fromUserId) as distinctSenders, SUM(t.amount) as totalAmount
    FROM transactions t
    JOIN users u ON u.id = t.toUserId
    WHERE t.type = 'give' AND t.createdAt >= ${since}
    GROUP BY t.toUserId
    HAVING distinctSenders >= 5
    ORDER BY distinctSenders DESC
    LIMIT 25
  `).all();

  res.status(200).json({
    windowDays: WINDOW_DAYS,
    funnelingPairs,
    pingPongPairs,
    freshBigReceivers,
    hubReceivers,
  });
}
