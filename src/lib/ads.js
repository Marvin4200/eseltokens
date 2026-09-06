// Shared helpers for the ad-slot system (house ads today, pluggable ad network later).
// A "slot" is a named placement (e.g. "landing-midcontent", "eseltokens-dashboard").
// mode: 'house' (self-promo, wired up now) | 'adsense' | 'custom' (reserved for later,
// not rendered yet) | 'off' (disabled).

export const AD_SLOT_KEY_RE = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/;
export const AD_MODES = ['house', 'adsense', 'custom', 'off'];
export const AD_EVENT_TYPES = ['impression', 'click'];

// Ensures a row exists for `key`, auto-creating a disabled placeholder for slots
// that were referenced by a consumer (landing page / app) but never configured yet.
// This lets a new <AdSlot slotKey="..."/> call show up in the admin UI on first load
// instead of silently 404ing.
export function ensureSlot(db, key) {
  let row = db.prepare('SELECT * FROM ad_slots WHERE key = ?').get(key);
  if (!row) {
    db.prepare(
      `INSERT OR IGNORE INTO ad_slots (key, enabled, mode, badgeText) VALUES (?, 0, 'off', 'Anzeige')`
    ).run(key);
    row = db.prepare('SELECT * FROM ad_slots WHERE key = ?').get(key);
  }
  return row;
}

export function toPublicSlot(row) {
  if (!row) return null;
  const enabled = !!row.enabled && row.mode !== 'off';
  if (!enabled) return { key: row.key, enabled: false };

  const base = { key: row.key, enabled: true, mode: row.mode };
  if (row.mode === 'house') {
    if (!row.title) return { key: row.key, enabled: false };
    base.house = {
      title: row.title,
      description: row.description || '',
      imageEmoji: row.imageEmoji || '✨',
      linkUrl: row.linkUrl || '',
      ctaText: row.ctaText || 'Mehr erfahren',
      badgeText: row.badgeText || 'Anzeige',
    };
  } else if (row.mode === 'adsense' || row.mode === 'custom') {
    // Not wired up to a real network yet — consumers branch on `mode` and render
    // nothing until networkClient/networkSlotId are actually filled in and the
    // rendering component is extended to emit the network's real snippet.
    base.network = {
      client: row.networkClient || null,
      slotId: row.networkSlotId || null,
    };
  }
  return base;
}
