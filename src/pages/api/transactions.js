import getDb from '@/lib/db';

export default function handler(req, res) {
  const db = getDb();

  if (req.method === 'GET') {
    const transactions = db.prepare(`
      SELECT t.id, t.type, t.amount, t.createdAt,
        fu.username as fromUsername,
        tu.username as toUsername
      FROM transactions t
      LEFT JOIN users fu ON t.fromUserId = fu.id
      LEFT JOIN users tu ON t.toUserId = tu.id
      ORDER BY t.createdAt DESC
      LIMIT 50
    `).all();
    res.status(200).json(transactions);
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}