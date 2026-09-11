import getDb from '@/lib/db';

function requireIntegrationSecret(req, res) {
  const expected = (process.env.SHOP_INTEGRATION_SECRET || '').trim();
  if (!expected) {
    res.status(503).json({ error: 'Admin integration is not configured' });
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

// Server-zu-Server-Pendant zu /api/admin/users (session-basiert, nur fuer die eseltokens-eigene
// UI) -- admin.eselbande.com hat keine eseltokens-Session, authentifiziert sich stattdessen mit
// demselben SHOP_INTEGRATION_SECRET, das admin-dashboard schon fuer /credit etc. nutzt.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  if (!requireIntegrationSecret(req, res)) return;

  const db = getDb();
  const users = db.prepare('SELECT id, discordId, username, discriminator, avatar, balance, xp, role, createdAt FROM users ORDER BY balance DESC').all();
  res.status(200).json(users);
}
