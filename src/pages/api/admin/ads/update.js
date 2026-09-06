import getDb from '@/lib/db';
import { methodAllowed, requireSession } from '@/lib/apiGuards';
import { AD_SLOT_KEY_RE, AD_MODES } from '@/lib/ads';

// Admin-only: POST /eseltokens/api/admin/ads/update
// Upserts one ad slot's full configuration (toggle, mode, house-ad content,
// and the network fields reserved for a later real ad network).
export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['POST'])) return;
  const session = await requireSession(req, res, ['admin']);
  if (!session) return;

  const {
    key,
    enabled,
    mode,
    title,
    description,
    imageEmoji,
    linkUrl,
    ctaText,
    badgeText,
    networkClient,
    networkSlotId,
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

  const db = getDb();
  const existing = db.prepare('SELECT 1 FROM ad_slots WHERE key = ?').get(key);
  if (!existing) {
    db.prepare(`INSERT INTO ad_slots (key, enabled, mode) VALUES (?, 0, 'off')`).run(key);
  }

  db.prepare(
    `UPDATE ad_slots SET
       enabled = ?,
       mode = ?,
       title = ?,
       description = ?,
       imageEmoji = ?,
       linkUrl = ?,
       ctaText = ?,
       badgeText = ?,
       networkClient = ?,
       networkSlotId = ?,
       updatedAt = datetime('now')
     WHERE key = ?`
  ).run(
    enabled ? 1 : 0,
    mode || 'off',
    title || null,
    description || null,
    imageEmoji || null,
    linkUrl || null,
    ctaText || null,
    badgeText || 'Anzeige',
    networkClient || null,
    networkSlotId || null,
    key
  );

  const updated = db.prepare('SELECT * FROM ad_slots WHERE key = ?').get(key);
  res.status(200).json({ ...updated, enabled: !!updated.enabled });
}
