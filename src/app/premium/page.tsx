'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiPath } from '@/lib/clientPaths';

const CATALOG = [
  { productKey: 'fahrstuhl_basic', name: 'Fahrstuhl Premium', priceTokens: 3000 },
  { productKey: 'fahrstuhl_pro', name: 'Fahrstuhl Premium Pro', priceTokens: 6000 },
  { productKey: 'eselbuilder_pro', name: 'Eselbuilder Pro', priceTokens: 6000 },
  { productKey: 'eselmoderator_basic', name: 'EselModerator Premium', priceTokens: 3000 },
  { productKey: 'eselmoderator_pro', name: 'EselModerator Premium Pro', priceTokens: 6000 },
];

export default function PremiumPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(
    (session?.user as any)?.balance ?? null
  );

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/');
  }, [authStatus, router]);

  useEffect(() => {
    const b = (session?.user as any)?.balance;
    if (typeof b === 'number') setBalance(b);
  }, [session]);

  const redeem = async (productKey: string) => {
    setBusy(productKey);
    setMsg(null);
    try {
      const r = await fetch(apiPath('/api/tokens/redeem-premium'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productKey }),
      });
      const data = await r.json();
      if (!r.ok) {
        setMsg(data.error || 'Fehlgeschlagen.');
      } else {
        setMsg(`${data.product} freigeschaltet!`);
        setBalance(data.newBalance);
      }
    } catch {
      setMsg('Netzwerkfehler.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px' }}>
      <h1>Premium mit EselTokens freischalten</h1>
      {balance !== null && <p>Dein Guthaben: {balance} EselTokens</p>}
      {msg && <p>{msg}</p>}
      <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        {CATALOG.map((p) => (
          <div
            key={p.productKey}
            style={{
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 10,
              padding: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <strong>{p.name}</strong>
              <div>{p.priceTokens.toLocaleString('de-DE')} EselTokens</div>
            </div>
            <button
              disabled={busy === p.productKey || (balance !== null && balance < p.priceTokens)}
              onClick={() => redeem(p.productKey)}
            >
              {busy === p.productKey ? 'Wird freigeschaltet...' : 'Freischalten'}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
