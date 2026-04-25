import getDb from '@/lib/db';
import crypto from 'crypto';
import { methodAllowed, parseTokenAmount, requireSession, sendApiError } from '@/lib/apiGuards';
import { creditTokens, debitTokens, recordTransaction } from '@/lib/tokenLedger';

// Simple 3-reel slot machine.
// Uses secure randomness and a deterministic paytable (house edge via expected value).
const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣'];

// Payouts in percent of bet to avoid floating point issues (e.g. 120 = 1.2x credit).
// Expected return (credit multiple) is ~0.962 with uniform symbol distribution.
const PAYOUT_PAIR_PCT = [120, 120, 120, 140, 160, 200, 300];
const PAYOUT_TRIPLE_PCT = [500, 500, 600, 800, 1200, 2000, 6500];

function spinReels() {
  return [
    crypto.randomInt(0, SYMBOLS.length),
    crypto.randomInt(0, SYMBOLS.length),
    crypto.randomInt(0, SYMBOLS.length),
  ];
}

function evaluateSpin(reelIdx) {
  const [a, b, c] = reelIdx;

  if (a === b && b === c) {
    return {
      outcome: 'triple',
      symbolIndex: a,
      payoutPct: PAYOUT_TRIPLE_PCT[a],
    };
  }

  if (a === b || a === c) {
    return { outcome: 'pair', symbolIndex: a, payoutPct: PAYOUT_PAIR_PCT[a] };
  }

  if (b === c) {
    return { outcome: 'pair', symbolIndex: b, payoutPct: PAYOUT_PAIR_PCT[b] };
  }

  return { outcome: 'lose', symbolIndex: null, payoutPct: 0 };
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
      newBalance,
    });
  } catch (error) {
    return sendApiError(res, error);
  }
}

