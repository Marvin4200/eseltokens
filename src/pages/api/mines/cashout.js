import getDb from '@/lib/db';
import { methodAllowed, requireSession, sendApiError, parseId } from '@/lib/apiGuards';
import { creditTokens, recordTransaction } from '@/lib/tokenLedger';

export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['POST'])) return;
  const session = await requireSession(req, res);
  if (!session) return;

  try {
    const gameId = parseId(req.body?.gameId, 'gameId');

    const db = getDb();
    const game = db.prepare(`SELECT * FROM mines_games WHERE id = ? AND userId = ?`).get(gameId, session.user.id);
    if (!game) {
      const err = new Error('Game not found');
      err.statusCode = 404;
      throw err;
    }
    if (game.status !== 'active') {
      const err = new Error('Game is not active');
      err.statusCode = 409;
      throw err;
    }

    const revealed = JSON.parse(game.revealedTiles);
    if (revealed.length === 0) {
      const err = new Error('Kein Feld aufgedeckt');
      err.statusCode = 400;
      throw err;
    }

    const payout = Math.floor(game.bet * game.multiplier);

    const finish = db.transaction(() => {
      db.prepare(
        `UPDATE mines_games SET status = 'cashed', payout = ?, updatedAt = datetime('now') WHERE id = ?`
      ).run(payout, gameId);
      creditTokens(db, session.user.id, payout);
      recordTransaction(db, { fromUserId: session.user.id, type: 'mines_win', amount: payout });
    });
    finish();

    const newBalance = db.prepare('SELECT balance FROM users WHERE id = ?').get(session.user.id).balance;
    const minePositions = JSON.parse(game.minePositions);

    return res.status(200).json({
      payout,
      multiplier: game.multiplier,
      minePositions,
      newBalance,
    });
  } catch (error) {
    return sendApiError(res, error);
  }
}
