import getDb from '@/lib/db';
import { ensureSlot, toPublicSlot, AD_SLOT_KEY_RE } from '@/lib/ads';

// Public, read-only: GET /eseltokens/api/ads/slot/:key
// Returns what a consumer should render for a given ad slot, or {enabled:false}.
// First-party only, no cookies, no PII — safe to call unauthenticated from the
// static landing page (same-origin via the /eseltokens/ nginx proxy) or the app.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { key } = req.query;
  if (typeof key !== 'string' || !AD_SLOT_KEY_RE.test(key)) {
    return res.status(400).json({ error: 'Invalid slot key' });
  }

  const db = getDb();
  const row = ensureSlot(db, key);
  res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  res.status(200).json(toPublicSlot(row));
}
