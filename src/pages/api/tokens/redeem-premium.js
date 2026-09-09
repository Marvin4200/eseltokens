import getDb from '@/lib/db';
import { methodAllowed, requireSession, sendApiError } from '@/lib/apiGuards';
import { debitTokens, creditTokens, recordTransaction } from '@/lib/tokenLedger';
import { findPremiumProduct } from '@/lib/premiumCatalog';

export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['POST'])) return;
  const session = await requireSession(req, res);
  if (!session) return;

  const product = findPremiumProduct(req.body?.productKey);
  if (!product) return res.status(400).json({ error: 'Unbekanntes Produkt' });

  const discordId = session.user.discordId;
  if (!discordId) return res.status(400).json({ error: 'Kein verknuepfter Discord-Account' });

  const db = getDb();

  // Tokens SOFORT abbuchen (synchron, in Transaction) -- der anschliessende Aufruf des Shops
  // ist ein Netzwerk-Request und darf niemals vor der Abbuchung passieren, sonst koennten zwei
  // parallele Klicks beide dieselbe (noch nicht abgebuchte) Balance sehen und beide durchgehen.
  try {
    const debit = db.transaction(() => {
      debitTokens(db, session.user.id, product.priceTokens);
      recordTransaction(db, {
        fromUserId: session.user.id,
        type: 'premium_redeem',
        amount: product.priceTokens,
      });
    });
    debit();
  } catch (err) {
    return sendApiError(res, err, 'Abbuchung fehlgeschlagen');
  }

  try {
    const base = (process.env.SHOP_INTERNAL_API_BASE || '').replace(/\/+$/, '');
    if (!base) throw new Error('SHOP_INTERNAL_API_BASE ist nicht konfiguriert.');
    const r = await fetch(`${base}/api/internal/redeem-with-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.ESELTOKENS_INTEGRATION_SECRET}`,
      },
      body: JSON.stringify({
        productKey: product.productKey,
        discordId,
        username: session.user.name || 'unknown',
      }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(`shop redeem-with-tokens -> ${r.status}: ${text}`);
    }
  } catch (err) {
    // Freischaltung fehlgeschlagen -- Tokens zurueckerstatten, sonst waeren sie fuer den Nutzer
    // ersatzlos weg, obwohl er nie Premium bekommen hat.
    const refund = db.transaction(() => {
      creditTokens(db, session.user.id, product.priceTokens);
      recordTransaction(db, {
        fromUserId: session.user.id,
        type: 'premium_redeem_refund',
        amount: product.priceTokens,
      });
    });
    refund();
    console.error('redeem-premium: shop-Aktivierung fehlgeschlagen', err);
    return res.status(502).json({ error: 'Freischaltung ist fehlgeschlagen, Tokens wurden zurueckerstattet.' });
  }

  const newBalance = db.prepare('SELECT balance FROM users WHERE id = ?').get(session.user.id)?.balance;
  return res.status(200).json({ ok: true, product: product.name, newBalance });
}
