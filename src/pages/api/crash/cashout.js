import getDb from '@/lib/db';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/authOptions';

const MULTIPLIER_SPEED = 0.00006;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !['member', 'moderator', 'admin'].includes(session.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const db = getDb();
  const now = Date.now();

  // Get current game
  const game = db.prepare('SELECT * FROM crash_games ORDER BY id DESC LIMIT 1').get();
  if (!game || game.status !== 'running') {
    return res.status(400).json({ error: 'Spiel läuft nicht' });
  }

  // Calculate current multiplier
  const currentMultiplier = Math.floor(100 * Math.exp(MULTIPLIER_SPEED * (now - game.started_at))) / 100;

  // Check if game should have crashed already
  if (currentMultiplier >= game.crash_point) {
    return res.status(400).json({ error: 'Zu spät!' });
  }

  // Get user's bet
  const bet = db.prepare('SELECT * FROM crash_bets WHERE game_id = ? AND user_id = ? AND status = ?').get(game.id, session.user.id, 'active');
  if (!bet) {
    return res.status(400).json({ error: 'Keine aktive Wette' });
  }

  // Calculate payout
  const payout = Math.floor(bet.amount * currentMultiplier);
  const profit = payout - bet.amount;

  // Update bet status
  db.prepare('UPDATE crash_bets SET cashout_multiplier = ?, status = ? WHERE id = ?').run(currentMultiplier, 'won', bet.id);

  // Credit balance
  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(payout, session.user.id);

  // Record transaction
  if (profit > 0) {
    db.prepare('INSERT INTO transactions (fromUserId, type, amount) VALUES (?, ?, ?)').run(session.user.id, 'crash_win', profit);
  }

  res.status(200).json({ success: true, multiplier: currentMultiplier, payout, profit });
}
