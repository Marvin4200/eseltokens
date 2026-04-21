import getDb from '@/lib/db';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/authOptions';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session || !['member', 'moderator', 'admin'].includes(session.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const db = getDb();
  const userId = session.user.id;
  const username = session.user.name;
  const amount = Math.floor(Number(req.body.amount));

  if (!amount || amount < 1) return res.status(400).json({ error: 'Ungültiger Betrag' });

  const game = db.prepare(`SELECT * FROM jackpot_games WHERE status = 'depositing' ORDER BY id DESC LIMIT 1`).get();
  if (!game) return res.status(400).json({ error: 'Kein aktives Spiel' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user || user.balance < amount) return res.status(400).json({ error: 'Nicht genug Tokens' });

  const now = Date.now();

  // Deduct balance and insert deposit atomically
  const deposit = db.transaction(() => {
    db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(amount, userId);

    // Recalculate ticket ranges after deposit
    const existingDeposits = db.prepare('SELECT * FROM jackpot_deposits WHERE game_id = ? ORDER BY id ASC').all(game.id);
    const currentTotal = existingDeposits.reduce((s, d) => s + d.amount, 0);
    const newTotal = currentTotal + amount;
    const ticketStart = currentTotal / newTotal;
    const ticketEnd = 1.0;

    // Re-normalise all existing ticket ranges
    for (const dep of existingDeposits) {
      const newStart = (dep.ticket_start * currentTotal) / newTotal;
      const newEnd = (dep.ticket_end * currentTotal) / newTotal;
      db.prepare('UPDATE jackpot_deposits SET ticket_start = ?, ticket_end = ? WHERE id = ?').run(newStart, newEnd, dep.id);
    }

    // Update game total
    db.prepare('UPDATE jackpot_games SET total_pot = total_pot + ? WHERE id = ?').run(amount, game.id);

    // Insert new deposit
    db.prepare(`INSERT INTO jackpot_deposits (game_id, user_id, username, amount, ticket_start, ticket_end, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(game.id, userId, username, amount, ticketStart, ticketEnd, now);
  });

  deposit();

  return res.status(200).json({ success: true });
}
