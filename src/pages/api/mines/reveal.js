import getDb from '@/lib/db';
import { methodAllowed, requireSession, sendApiError, parseId } from '@/lib/apiGuards';
import { creditTokens, recordTransaction } from '@/lib/tokenLedger';
import { computeMultiplier } from '@/lib/mines';

export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['POST'])) return;
  const session = await requireSession(req, res);
  if (!session) return;

  try {
    const gameId = parseId(req.body?.gameId, 'gameId');
    const tile = Number(req.body?.tile);

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
    if (!Number.isInteger(tile) || tile < 0 || tile >= game.gridSize) {
      const err = new Error('Invalid tile');
      err.statusCode = 400;
      throw err;
    }

    const revealed = JSON.parse(game.revealedTiles);
    if (revealed.includes(tile)) {
      const err = new Error('Tile already revealed');
      err.statusCode = 409;
      throw err;
    }

    const mines = JSON.parse(game.minePositions);
    const hitMine = mines.includes(tile);

    if (hitMine) {
      db.prepare(
        `UPDATE mines_games SET status = 'busted', revealedTiles = ?, updatedAt = datetime('now') WHERE id = ?`
      ).run(JSON.stringify([...revealed, tile]), gameId);

      return res.status(200).json({
        busted: true,
        tile,
        minePositions: mines,
        revealedTiles: [...revealed, tile],
      });
    }

    const nextRevealed = [...revealed, tile];
    const multiplier = computeMultiplier(game.gridSize, game.mineCount, nextRevealed.length);
    const safeTiles = game.gridSize - game.mineCount;
    const isMaxCleared = nextRevealed.length >= safeTiles;

    if (isMaxCleared) {
      const payout = Math.floor(game.bet * multiplier);
      const finish = db.transaction(() => {
        db.prepare(
          `UPDATE mines_games SET status = 'cashed', revealedTiles = ?, multiplier = ?, payout = ?, updatedAt = datetime('now') WHERE id = ?`
        ).run(JSON.stringify(nextRevealed), multiplier, payout, gameId);
        creditTokens(db, session.user.id, payout);
        recordTransaction(db, { fromUserId: session.user.id, type: 'mines_win', amount: payout });
      });
      finish();
      const newBalance = db.prepare('SELECT balance FROM users WHERE id = ?').get(session.user.id).balance;
      return res.status(200).json({
        busted: false,
        tile,
        revealedTiles: nextRevealed,
        multiplier,
        cleared: true,
        payout,
        minePositions: mines,
        newBalance,
      });
    }

    db.prepare(
      `UPDATE mines_games SET revealedTiles = ?, multiplier = ?, updatedAt = datetime('now') WHERE id = ?`
    ).run(JSON.stringify(nextRevealed), multiplier, gameId);

    return res.status(200).json({
      busted: false,
      tile,
      revealedTiles: nextRevealed,
      multiplier,
      cleared: false,
    });
  } catch (error) {
    return sendApiError(res, error);
  }
}
