import getDb from '@/lib/db';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/authOptions';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !['member', 'moderator', 'admin'].includes(session.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { amount } = req.body;
  const betAmount = Math.floor(Number(amount) || 0);
  if (betAmount < 1) {
    return res.status(400).json({ error: 'Mindestens 1 Token' });
  }

  const db = getDb();

  // Get current game
  const game = db.prepare('SELECT * FROM crash_games ORDER BY id DESC LIMIT 1').get();
  if (!game || game.status !== 'betting') {
    return res.status(400).json({ error: 'Wetten nicht möglich' });
  }

  // Check if already bet
  const existingBet = db.prepare('SELECT * FROM crash_bets WHERE game_id = ? AND user_id = ?').get(game.id, session.user.id);
  if (existingBet) {
    return res.status(400).json({ error: 'Du hast bereits gewettet' });
  }

  // Check balance
  const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(session.user.id);
  if (!user || user.balance < betAmount) {
    return res.status(400).json({ error: 'Nicht genug Tokens' });
  }

  // Deduct balance and place bet
  db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(betAmount, session.user.id);
  db.prepare('INSERT INTO crash_bets (game_id, user_id, amount) VALUES (?, ?, ?)').run(game.id, session.user.id, betAmount);

  res.status(200).json({ success: true });
}
