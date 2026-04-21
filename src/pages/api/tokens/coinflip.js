import getDb from '@/lib/db';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/authOptions';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (session.user.role === 'pending') {
      return res.status(403).json({ error: 'Pending users cannot coinflip' });
    }

    const { amount } = req.body;
    const bet = parseInt(amount);

    if (!bet || bet < 1) {
      return res.status(400).json({ error: 'Minimum bet is 1 token' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user.id);

    if (!user || user.balance < bet) {
      return res.status(400).json({ error: 'Not enough tokens' });
    }

    // Cryptographically secure random coin flip
    const randomByte = crypto.randomBytes(1)[0];
    const won = randomByte < 128; // 50/50

    if (won) {
      db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(bet, user.id);
    } else {
      db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(bet, user.id);
    }

    // Record transaction
    db.prepare('INSERT INTO transactions (fromUserId, type, amount) VALUES (?, ?, ?)').run(
      user.id,
      won ? 'coinflip_win' : 'coinflip_lose',
      bet
    );

    const newBalance = db.prepare('SELECT balance FROM users WHERE id = ?').get(user.id).balance;

    res.status(200).json({
      won,
      amount: bet,
      newBalance,
    });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
