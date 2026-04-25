import getDb from '@/lib/db';
import crypto from 'crypto';
import { methodAllowed, parseTokenAmount, requireSession, sendApiError } from '@/lib/apiGuards';
import { creditTokens, debitTokens, recordTransaction } from '@/lib/tokenLedger';

// Simple 5x5 slot machine (5 reels, 5 visible rows).
// Uses secure randomness and a deterministic paytable (house edge via expected value).
const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣'];

// Payouts in percent of bet to avoid floating point issues (e.g. 160 = 1.6x credit).
// Win rule: only pay for a left-to-right streak on the payline (middle row),
// starting from reel 1. (3/4/5 in a row)
const PAYOUT_3_PCT = [120, 120, 130, 140, 160, 220, 320];
const PAYOUT_4_PCT = [220, 230, 250, 280, 340, 520, 820];
const PAYOUT_5_PCT = [450, 520, 620, 760, 980, 1800, 4200];

function spinReels() {
  return [
    crypto.randomInt(0, SYMBOLS.length),
    crypto.randomInt(0, SYMBOLS.length),
    crypto.randomInt(0, SYMBOLS.length),
    crypto.randomInt(0, SYMBOLS.length),
    crypto.randomInt(0, SYMBOLS.length),
  ];
}

function evaluateSpin(reelIdx) {
  const a = reelIdx[0];
  let streak = 1;
  for (let i = 1; i < reelIdx.length; i++) {
    if (reelIdx[i] === a) streak += 1;
    else break;
  }

  if (streak >= 5) return { outcome: 'triple', symbolIndex: a, payoutPct: PAYOUT_5_PCT[a], streak };
  if (streak === 4) return { outcome: 'triple', symbolIndex: a, payoutPct: PAYOUT_4_PCT[a], streak };
  if (streak === 3) return { outcome: 'pair', symbolIndex: a, payoutPct: PAYOUT_3_PCT[a], streak };

  return { outcome: 'lose', symbolIndex: null, payoutPct: 0, streak };
}

export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['POST'])) return;
  const session = await requireSession(req, res);
  if (!session) return;

  try {
    const { amount } = req.body;
    const bet = parseTokenAmount(amount, 'amount', 100000);

    const db = getDb();

    const reelIdx = spinReels();
    const evaluation = evaluateSpin(reelIdx);
    const payout = Math.floor((bet * evaluation.payoutPct) / 100);

    const play = db.transaction(() => {
      debitTokens(db, session.user.id, bet);
      if (payout > 0) {
        creditTokens(db, session.user.id, payout);
      }
      recordTransaction(db, {
        fromUserId: session.user.id,
        type: payout > 0 ? 'slots_win' : 'slots_lose',
        amount: bet,
      });
    });
    play();

    const newBalance = db.prepare('SELECT balance FROM users WHERE id = ?').get(session.user.id).balance;

    return res.status(200).json({
      bet,
      reels: reelIdx.map(i => SYMBOLS[i]),
      outcome: evaluation.outcome,
      matchedSymbol: evaluation.symbolIndex === null ? null : SYMBOLS[evaluation.symbolIndex],
      payout,
      payoutPct: evaluation.payoutPct,
      streak: evaluation.streak,
      newBalance,
    });
  } catch (error) {
    return sendApiError(res, error);
  }
}
