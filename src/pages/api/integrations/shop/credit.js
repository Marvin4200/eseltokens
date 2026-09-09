import getDb from '@/lib/db';
import { creditTokens, recordTransaction } from '@/lib/tokenLedger';

function requireIntegrationSecret(req, res) {
  const expected = (process.env.SHOP_INTEGRATION_SECRET || '').trim();
  if (!expected) {
    res.status(503).json({ error: 'Shop integration is not configured' });
    return false;
  }

  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (token !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  if (!requireIntegrationSecret(req, res)) return;

  try {
    const { discordId, username, amount, reason = 'Shop-Kauf' } = req.body || {};

    const cleanDiscordId = String(discordId || '').trim();
    const granted = Math.max(0, Math.floor(Number(amount) || 0));

    if (!cleanDiscordId || !/^\d{10,32}$/.test(cleanDiscordId)) {
      return res.status(400).json({ error: 'Invalid discordId' });
    }
    if (granted <= 0 || granted > 50000) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const db = getDb();
    // Nutzer wird bei Erstkontakt (z.B. erster Discord-Login) angelegt -- ein Shop-Kauf VOR dem
    // ersten Login auf eseltokens.com darf trotzdem nicht scheitern, deshalb hier anlegen statt
    // wie bei fahrstuhls voice-reward auf 404 zu gehen.
    let user = db.prepare('SELECT id, balance, role FROM users WHERE discordId = ?').get(cleanDiscordId);
    if (!user) {
      db.prepare(
        `INSERT INTO users (discordId, username, balance, role) VALUES (?, ?, 0, 'user')`
      ).run(cleanDiscordId, username || 'unknown');
      user = db.prepare('SELECT id, balance, role FROM users WHERE discordId = ?').get(cleanDiscordId);
    }
    if (user.role === 'pending') return res.status(403).json({ error: 'User is pending' });

    const tx = db.transaction(() => {
      creditTokens(db, user.id, granted);
      recordTransaction(db, { fromUserId: user.id, type: 'shop_purchase', amount: granted });
    });
    tx();

    const newBalance = db.prepare('SELECT balance FROM users WHERE id = ?').get(user.id)?.balance ?? user.balance;
    return res.status(200).json({ success: true, amountGranted: granted, newBalance, reason });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}
