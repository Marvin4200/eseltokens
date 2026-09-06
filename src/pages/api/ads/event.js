import getDb from '@/lib/db';
import { AD_SLOT_KEY_RE, AD_EVENT_TYPES } from '@/lib/ads';

// Public: POST /eseltokens/api/ads/event
// First-party impression/click beacon. No third-party network, no cookies —
// just a slot key, an event type and the page path, so this needs no consent banner.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = req.body || {};
  const { slotKey, type } = body;
  const page = typeof body.page === 'string' ? body.page.slice(0, 200) : null;

  if (typeof slotKey !== 'string' || !AD_SLOT_KEY_RE.test(slotKey)) {
    return res.status(400).json({ error: 'Invalid slotKey' });
  }
  if (!AD_EVENT_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }

  const db = getDb();
  const exists = db.prepare('SELECT 1 FROM ad_slots WHERE key = ?').get(slotKey);
  if (!exists) {
    // Unknown slot — don't create it here (that's ensureSlot's job on the read path)
    // and don't record noise for keys nobody configured.
    return res.status(204).end();
  }

  db.prepare('INSERT INTO ad_events (slotKey, type, page) VALUES (?, ?, ?)').run(slotKey, type, page);
  res.status(204).end();
}
