import getDb from '@/lib/db';
import { methodAllowed, parseTokenAmount, requireSession, sendApiError } from '@/lib/apiGuards';
import { creditTokens, debitTokens, recordTransaction } from '@/lib/tokenLedger';
import { spinSlots } from '@/lib/slots';

export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['POST'])) return;
  const session = await requireSession(req, res);
  if (!session) return;

  try {
    const { amount } = req.body;
    const bet = parseTokenAmount(amount);

    const db = getDb();
    const { symbols, multiplier } = spinSlots();
    const payout = Math.floor(bet * multiplier);
    const won = payout > 0;

    const play = db.transaction(() => {
      debitTokens(db, session.user.id, bet);
      if (payout > 0) {
        creditTokens(db, session.user.id, payout);
      }
      recordTransaction(db, {
        fromUserId: session.user.id,
        type: won ? 'slots_win' : 'slots_lose',
        amount: won ? payout : bet,
      });
    });
    play();

    const newBalance = db.prepare('SELECT balance FROM users WHERE id = ?').get(session.user.id).balance;

    return res.status(200).json({
      symbols,
      multiplier,
      won,
      bet,
      payout,
      newBalance,
    });
  } catch (error) {
    return sendApiError(res, error);
  }
}
