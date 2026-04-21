import getDb from '@/lib/db';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/authOptions';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (session.user.role === 'pending') {
      return res.status(403).json({ error: 'Pending users cannot give tokens' });
    }

    const db = getDb();
    const { to, amount: rawAmount = 1 } = req.body;
    const amount = Math.max(1, Math.min(100, Math.floor(Number(rawAmount) || 1)));

    const toUser = db.prepare('SELECT * FROM users WHERE id = ?').get(to);
    if (!toUser) {
      return res.status(400).json({ error: 'User not found' });
    }

    const sender = db.prepare('SELECT balance FROM users WHERE id = ?').get(session.user.id);
    if (!sender || sender.balance < amount) {
      return res.status(400).json({ error: 'Not enough tokens' });
    }

    db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(amount, session.user.id);
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, toUser.id);
    db.prepare('INSERT INTO transactions (fromUserId, toUserId, type, amount) VALUES (?, ?, ?, ?)').run(session.user.id, toUser.id, 'give', amount);

    res.status(200).json({ success: true });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}