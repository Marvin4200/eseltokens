import getDb from '@/lib/db';
import { methodAllowed, requireSession } from '@/lib/apiGuards';

// Admin-only: GET /eseltokens/api/admin/ads/slots
// Lists every configured ad slot plus its impression/click counters.
export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['GET'])) return;
  const session = await requireSession(req, res, ['admin']);
  if (!session) return;

  const db = getDb();
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

  res.status(200).json(
    slots.map((s) => ({
      ...s,
      enabled: !!s.enabled,
      stats: statsByKey[s.key] || { impressions: 0, clicks: 0 },
    }))
  );
}
