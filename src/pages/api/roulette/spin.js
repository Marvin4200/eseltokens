import getDb from '@/lib/db';
import { methodAllowed, parseTokenAmount, requireSession, sendApiError } from '@/lib/apiGuards';
import { creditTokens, debitTokens, recordTransaction } from '@/lib/tokenLedger';
import { BET_TYPES, spinWheel, colorOf, evaluateBet } from '@/lib/roulette';

export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['POST'])) return;
  const session = await requireSession(req, res);
  if (!session) return;

  try {
    const { amount, betType, betValue } = req.body;
    const bet = parseTokenAmount(amount);

    if (!BET_TYPES.includes(betType)) {
      const err = new Error('Invalid betType');
      err.statusCode = 400;
      throw err;
    }
    let numberValue = null;
    if (betType === 'straight') {
      numberValue = Number(betValue);
      if (!Number.isInteger(numberValue) || numberValue < 0 || numberValue > 36) {
        const err = new Error('Invalid betValue');
        err.statusCode = 400;
        throw err;
      }
    }

    const db = getDb();
    const number = spinWheel();
    const color = colorOf(number);
    const payoutMultiplier = evaluateBet(betType, numberValue, number);
    const payout = Math.floor(bet * payoutMultiplier);
    const won = payout > 0;

    const play = db.transaction(() => {
      debitTokens(db, session.user.id, bet);
      if (payout > 0) {
        creditTokens(db, session.user.id, payout);
      }
      recordTransaction(db, {
        fromUserId: session.user.id,
        type: won ? 'roulette_win' : 'roulette_lose',
        amount: won ? payout : bet,
      });
    });
    play();

    const newBalance = db.prepare('SELECT balance FROM users WHERE id = ?').get(session.user.id).balance;

    return res.status(200).json({
      number,
      color,
      betType,
      betValue: numberValue,
      won,
      bet,
      payout,
      newBalance,
    });
  } catch (error) {
    return sendApiError(res, error);
  }
}
