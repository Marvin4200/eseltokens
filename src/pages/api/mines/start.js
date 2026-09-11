import getDb from '@/lib/db';
import { methodAllowed, parseTokenAmount, requireSession, sendApiError } from '@/lib/apiGuards';
import { debitTokens, recordTransaction } from '@/lib/tokenLedger';
import { GRID_SIZE, MIN_MINES, MAX_MINES, generateMinePositions } from '@/lib/mines';

export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['POST'])) return;
  const session = await requireSession(req, res);
  if (!session) return;

  try {
    const { amount, mines } = req.body;
    const bet = parseTokenAmount(amount);
    const mineCount = Number(mines);
    if (!Number.isInteger(mineCount) || mineCount < MIN_MINES || mineCount > MAX_MINES) {
      const err = new Error('Invalid mines');
      err.statusCode = 400;
      throw err;
    }

    const db = getDb();

    const existing = db.prepare(`SELECT id FROM mines_games WHERE userId = ? AND status = 'active'`).get(session.user.id);
    if (existing) {
      const err = new Error('Es läuft bereits ein Mines-Spiel');
      err.statusCode = 409;
      throw err;
    }

    const minePositions = generateMinePositions(GRID_SIZE, mineCount);

    let gameId;
    const start = db.transaction(() => {
      debitTokens(db, session.user.id, bet);
      recordTransaction(db, { fromUserId: session.user.id, type: 'mines_bet', amount: bet });
      const result = db.prepare(
        `INSERT INTO mines_games (userId, bet, mineCount, gridSize, minePositions, revealedTiles, status, multiplier)
         VALUES (?, ?, ?, ?, ?, '[]', 'active', 1)`
      ).run(session.user.id, bet, mineCount, GRID_SIZE, JSON.stringify(minePositions));
      gameId = result.lastInsertRowid;
    });
    start();

    const newBalance = db.prepare('SELECT balance FROM users WHERE id = ?').get(session.user.id).balance;

    return res.status(200).json({
      gameId,
      bet,
      mineCount,
      gridSize: GRID_SIZE,
      revealedTiles: [],
      multiplier: 1,
      newBalance,
    });
  } catch (error) {
    return sendApiError(res, error);
  }
}
