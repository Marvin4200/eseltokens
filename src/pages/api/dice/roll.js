import getDb from '@/lib/db';
import crypto from 'crypto';
import { methodAllowed, parseTokenAmount, requireSession, sendApiError } from '@/lib/apiGuards';
import { creditTokens, debitTokens, recordTransaction } from '@/lib/tokenLedger';
import { MIN_TARGET, MAX_TARGET, computeMultiplier } from '@/lib/dice';

export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['POST'])) return;
  const session = await requireSession(req, res);
  if (!session) return;

  try {
    const { amount, direction, target } = req.body;
    const bet = parseTokenAmount(amount);

    if (direction !== 'under' && direction !== 'over') {
      const err = new Error('Invalid direction');
      err.statusCode = 400;
      throw err;
    }
    const targetNum = Number(target);
    if (!Number.isInteger(targetNum) || targetNum < MIN_TARGET || targetNum > MAX_TARGET) {
      const err = new Error('Invalid target');
      err.statusCode = 400;
      throw err;
    }

    const db = getDb();

    // 0-9999 -> 0.00-99.99, kryptographisch sicher wie bei Coinflip/Mines.
    const roll = crypto.randomInt(0, 10000) / 100;
    const won = direction === 'under' ? roll < targetNum : roll > targetNum;
    const multiplier = computeMultiplier(direction, targetNum);
    const payout = won ? Math.floor(bet * multiplier) : 0;

    const play = db.transaction(() => {
      debitTokens(db, session.user.id, bet);
      if (won) {
        creditTokens(db, session.user.id, payout);
      }
      recordTransaction(db, {
        fromUserId: session.user.id,
        type: won ? 'dice_win' : 'dice_lose',
        amount: won ? payout : bet,
      });
    });
    play();

    const newBalance = db.prepare('SELECT balance FROM users WHERE id = ?').get(session.user.id).balance;

    return res.status(200).json({
      won,
      roll,
      direction,
      target: targetNum,
      multiplier,
      bet,
      payout,
      newBalance,
    });
  } catch (error) {
    return sendApiError(res, error);
  }
}
