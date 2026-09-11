import getDb from '@/lib/db';
import { AD_SLOT_KEY_RE, AD_MODES } from '@/lib/ads';

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

// Server-zu-Server-Pendant zu /api/admin/ads/slots (GET) und /api/admin/ads/update (POST),
// in einem Endpunkt gebuendelt fuer admin.eselbande.com.
export default async function handler(req, res) {
  if (!requireIntegrationSecret(req, res)) return;
  const db = getDb();

  if (req.method === 'GET') {
    const slots = db.prepare('SELECT * FROM ad_slots ORDER BY key').all();
    const stats = db
      .prepare(
        `SELECT slotKey,
           SUM(CASE WHEN type = 'impression' THEN 1 ELSE 0 END) AS impressions,
           SUM(CASE WHEN type = 'click' THEN 1 ELSE 0 END) AS clicks
         FROM ad_events GROUP BY slotKey`
      )
      .all();
    const statsByKey = Object.fromEntries(stats.map((s) => [s.slotKey, s]));
    return res.status(200).json(
      slots.map((s) => ({
        ...s,
        enabled: !!s.enabled,
        stats: statsByKey[s.key] || { impressions: 0, clicks: 0 },
      }))
    );
  }

  if (req.method === 'POST') {
    const {
      key, enabled, mode, title, description, imageEmoji, linkUrl, ctaText, badgeText,
      networkClient, networkSlotId,
    } = req.body || {};

    if (typeof key !== 'string' || !AD_SLOT_KEY_RE.test(key)) {
      return res.status(400).json({ error: 'Invalid key' });
    }
    if (mode !== undefined && !AD_MODES.includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode' });
    }
    if (linkUrl && !/^https:\/\//.test(linkUrl)) {
      return res.status(400).json({ error: 'linkUrl must start with https://' });
    }
    for (const [name, val] of [
      ['title', title], ['description', description], ['ctaText', ctaText], ['badgeText', badgeText],
    ]) {
      if (val !== undefined && val !== null && typeof val === 'string' && val.length > 300) {
        return res.status(400).json({ error: `${name} too long` });
      }
    }

    const existing = db.prepare('SELECT 1 FROM ad_slots WHERE key = ?').get(key);
    if (!existing) {
      db.prepare(`INSERT INTO ad_slots (key, enabled, mode) VALUES (?, 0, 'off')`).run(key);
    }
    db.prepare(
      `UPDATE ad_slots SET
         enabled = ?, mode = ?, title = ?, description = ?, imageEmoji = ?, linkUrl = ?,
         ctaText = ?, badgeText = ?, networkClient = ?, networkSlotId = ?, updatedAt = datetime('now')
       WHERE key = ?`
    ).run(
      enabled ? 1 : 0, mode || 'off', title || null, description || null, imageEmoji || null,
      linkUrl || null, ctaText || null, badgeText || 'Anzeige', networkClient || null,
      networkSlotId || null, key
    );
    const updated = db.prepare('SELECT * FROM ad_slots WHERE key = ?').get(key);
    return res.status(200).json({ ...updated, enabled: !!updated.enabled });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}
