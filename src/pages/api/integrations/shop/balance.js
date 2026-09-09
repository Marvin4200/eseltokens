import getDb from '@/lib/db';

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

// Read-only Gegenstueck zu credit.js -- gibt den AKTUELLEN Kontostand zurueck, damit der Shop
// denselben Wert wie eseltokens.com/dashboard anzeigen kann. Es gibt nur eine Balance (die in
// eseltokens' eigener SQLite-DB), der Shop fuehrt keine eigene Kopie -- diese Route ist die
// einzige Quelle dafuer aus einer anderen App heraus.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  if (!requireIntegrationSecret(req, res)) return;

  const discordId = String(req.query.discordId || '').trim();
  if (!discordId || !/^\d{10,32}$/.test(discordId)) {
    return res.status(400).json({ error: 'Invalid discordId' });
  }

  const db = getDb();
  const user = db.prepare('SELECT balance FROM users WHERE discordId = ?').get(discordId);
  return res.status(200).json({ balance: user?.balance ?? 0 });
}
