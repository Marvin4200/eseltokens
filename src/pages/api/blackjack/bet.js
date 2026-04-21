import getDb from '@/lib/db';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/authOptions';
import { createDeck, drawCard, calculateHand } from '@/lib/blackjack';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const { tableId, amount } = req.body;
  const bet = parseInt(amount);
  if (!bet || bet < 1) return res.status(400).json({ error: 'Mindestens 1 Token' });

  const db = getDb();

  const table = db.prepare('SELECT * FROM blackjack_tables WHERE id = ?').get(tableId);
  if (!table) return res.status(404).json({ error: 'Tisch nicht gefunden' });
  if (table.status !== 'betting') return res.status(400).json({ error: 'Nicht in der Setzphase' });

  const player = db.prepare('SELECT * FROM blackjack_players WHERE tableId = ? AND userId = ?').get(tableId, session.user.id);
  if (!player) return res.status(400).json({ error: 'Du bist nicht an diesem Tisch' });

  const hands = JSON.parse(player.hands);
  if (hands.length > 0) return res.status(400).json({ error: 'Du hast bereits gesetzt' });

  const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(session.user.id);
  if (!user || user.balance < bet) return res.status(400).json({ error: 'Nicht genug Tokens' });

  // Deduct bet
  db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(bet, session.user.id);

  // Set hand
  const newHands = [{ cards: [], bet, status: 'waiting' }];
  db.prepare('UPDATE blackjack_players SET hands = ? WHERE id = ?').run(JSON.stringify(newHands), player.id);

  // Check if all players have bet → deal cards
  const players = db.prepare('SELECT * FROM blackjack_players WHERE tableId = ?').all(tableId);
  const allBet = players.every(p => {
    if (p.id === player.id) return true;
    const h = JSON.parse(p.hands);
    return h.length > 0 && h[0].bet > 0;
  });

  if (allBet) {
    dealCards(db, tableId);
  }

  db.prepare("UPDATE blackjack_tables SET updatedAt = datetime('now') WHERE id = ?").run(tableId);
  return res.status(200).json({ success: true });
}

function dealCards(db, tableId) {
  let deck = createDeck(2);
  const players = db.prepare('SELECT * FROM blackjack_players WHERE tableId = ? ORDER BY seatIndex').all(tableId);

  const dealerCards = [];

  // Deal 2 cards to each player, then 2 to dealer
  for (let round = 0; round < 2; round++) {
    for (const player of players) {
      const result = drawCard(deck);
      deck = result.deck;
      // Re-read from DB to get the latest hands (important for round 2)
      const freshPlayer = db.prepare('SELECT hands FROM blackjack_players WHERE id = ?').get(player.id);
      const hands = JSON.parse(freshPlayer.hands);
      hands[0].cards.push(result.card);
      db.prepare('UPDATE blackjack_players SET hands = ? WHERE id = ?').run(JSON.stringify(hands), player.id);
    }
    const result = drawCard(deck);
    deck = result.deck;
    dealerCards.push(result.card);
  }

  // Find first player to play
  let firstSeat = -1;
  for (const player of players) {
    const freshPlayer = db.prepare('SELECT hands FROM blackjack_players WHERE id = ?').get(player.id);
    const hands = JSON.parse(freshPlayer.hands);
    const hand = calculateHand(hands[0].cards);
    if (hand.blackjack) {
      hands[0].status = 'blackjack';
      db.prepare('UPDATE blackjack_players SET hands = ? WHERE id = ?').run(JSON.stringify(hands), player.id);
    } else {
      hands[0].status = 'playing';
      db.prepare('UPDATE blackjack_players SET hands = ? WHERE id = ?').run(JSON.stringify(hands), player.id);
      if (firstSeat === -1) firstSeat = player.seatIndex;
    }
  }

  db.prepare('UPDATE blackjack_tables SET status = ?, deck = ?, dealerCards = ?, currentSeat = ?, updatedAt = datetime(\'now\') WHERE id = ?')
    .run('playing', JSON.stringify(deck), JSON.stringify(dealerCards), firstSeat, tableId);

  // If no active players (all blackjack), go to dealer
  if (firstSeat === -1) {
    const { playDealer } = require('@/lib/blackjack');
    // Set a dummy currentSeat beyond all players so playDealer triggers
    db.prepare('UPDATE blackjack_tables SET currentSeat = 99 WHERE id = ?').run(tableId);
    playDealer(db, tableId);
  }
}
