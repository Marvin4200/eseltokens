import getDb from '@/lib/db';
import { recordTransaction } from '@/lib/tokenLedger';
import { requireIntegrationSecret } from '@/lib/apiGuards';

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error('userId ist ungueltig.');
  return id;
}

function parseNonNegativeInt(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${label} muss eine nicht-negative ganze Zahl sein.`);
  return n;
}

const VALID_ROLES = ['pending', 'member', 'moderator', 'admin'];

// Server-zu-Server-Pendant zu /api/admin/update-balance + update-role + update-xp (session-basiert)
// in einem Endpunkt gebuendelt, weil admin.eselbande.com pro Aufruf typischerweise nur ein Feld
// aendert -- das Frontend schickt jeweils nur die Felder, die sich geaendert haben.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
  if (!requireIntegrationSecret(req, res, 'SHOP_INTEGRATION_SECRET', 'Admin integration is not configured')) return;

  try {
    const db = getDb();
    const { userId, balance, role, xp } = req.body || {};
    const id = parseId(userId);

    const user = db.prepare('SELECT id, balance FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const changes = [];

    if (balance !== undefined) {
      const safeBalance = parseNonNegativeInt(balance, 'balance');
      const apply = db.transaction(() => {
        db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(safeBalance, id);
        const delta = safeBalance - Number(user.balance || 0);
        if (delta !== 0) {
          recordTransaction(db, {
            toUserId: id,
            fromUserId: null,
            type: delta > 0 ? 'admin_grant' : 'admin_remove',
            amount: Math.abs(delta),
          });
        }
      });
      apply();
      changes.push('balance');
    }

    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
      changes.push('role');
    }

    if (xp !== undefined) {
      const safeXp = parseNonNegativeInt(xp, 'xp');
      db.prepare('UPDATE users SET xp = ? WHERE id = ?').run(safeXp, id);
      changes.push('xp');
    }

    const updated = db.prepare('SELECT id, discordId, username, discriminator, avatar, balance, xp, role, createdAt FROM users WHERE id = ?').get(id);
    return res.status(200).json({ success: true, changed: changes, user: updated });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Unbekannter Fehler' });
  }
}
