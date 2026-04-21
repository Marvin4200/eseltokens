import getDb from '@/lib/db';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/authOptions';
import { XP_PER_TOKEN, getLevelInfo } from '@/lib/leveling';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (session.user.role === 'pending') {
      return res.status(403).json({ error: 'Pending users cannot redeem tokens' });
    }

    const { amount = 1 } = req.body || {};
    const redeemAmount = Math.max(1, Math.floor(Number(amount) || 1));

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user.id);

    if (!user || user.balance < redeemAmount) {
      return res.status(400).json({ error: 'Not enough tokens' });
    }

    const xpGained = redeemAmount * XP_PER_TOKEN;
    const oldLevel = getLevelInfo(user.xp || 0).level;

    db.prepare('UPDATE users SET balance = balance - ?, xp = xp + ? WHERE id = ?').run(redeemAmount, xpGained, user.id);
    db.prepare('INSERT INTO transactions (fromUserId, type, amount) VALUES (?, ?, ?)').run(user.id, 'redeem', redeemAmount);

    const newLevel = getLevelInfo((user.xp || 0) + xpGained).level;

    res.status(200).json({
      success: true,
      xpGained,
      leveledUp: newLevel > oldLevel,
      newLevel,
      oldLevel,
    });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}