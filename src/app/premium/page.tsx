'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { apiPath } from '@/lib/clientPaths';

interface CatalogEntry {
  productKey: string;
  name: string;
  priceTokens: number;
  icon: string;
  blurb: string;
}

const CATALOG: CatalogEntry[] = [
  { productKey: 'fahrstuhl_basic', name: 'Fahrstuhl Premium', priceTokens: 3000, icon: '🚀', blurb: 'Erweiterte Funktionen für den Fahrstuhl-Bot.' },
  { productKey: 'fahrstuhl_pro', name: 'Fahrstuhl Premium Pro', priceTokens: 6000, icon: '🚀', blurb: 'Alles aus Premium, plus zusätzliche Pro-Features.' },
  { productKey: 'eselbuilder_pro', name: 'Eselbuilder Pro', priceTokens: 6000, icon: '🤖', blurb: 'KI-gestützte Server-Planung mit Eselbuilder.' },
  { productKey: 'eselmoderator_basic', name: 'EselModerator Premium', priceTokens: 3000, icon: '🛡️', blurb: 'Erweiterte Moderations-Funktionen.' },
  { productKey: 'eselmoderator_pro', name: 'EselModerator Premium Pro', priceTokens: 6000, icon: '🛡️', blurb: 'Alles aus Premium, plus zusätzliche Pro-Features.' },
];

function PremiumPageInner() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Ein Shop-Link wie /eseltokens/premium?product=eselbuilder_pro kam vorher trotzdem auf der
  // vollen Liste raus -- verwirrend, wenn man auf der Shop-Seite schon ein Produkt gewaehlt hat.
  // Mit dem Query-Param zeigen wir direkt nur noch dieses eine (plus einen Link zu allen).
  const preselectedKey = searchParams?.get('product') ?? null;
  const [showAll, setShowAll] = useState(!preselectedKey);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);
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
        setMsg({ text: data.error || 'Fehlgeschlagen.', tone: 'error' });
      } else {
        setMsg({ text: `${data.product} freigeschaltet! 🎉`, tone: 'success' });
        setBalance(data.newBalance);
      }
    } catch {
      setMsg({ text: 'Netzwerkfehler. Bitte versuch es erneut.', tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const visible = CATALOG.filter((p) => showAll || p.productKey === preselectedKey);
  const unknownProduct = !showAll && preselectedKey && !CATALOG.some((p) => p.productKey === preselectedKey);

  if (authStatus === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/8 blur-[150px] -top-40 -left-40" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-amber-500/5 blur-[120px] -bottom-32 -right-32" />
      </div>

      {/* Top Navigation */}
      <nav className="relative z-10 border-b border-purple-500/10 bg-black/20 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/dashboard')}>
            <span className="text-2xl">🫏</span>
            <h1 className="text-xl font-bold">
              <span className="glow-text">Esel</span><span className="text-amber-400">Tokens</span>
            </h1>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all"
          >
            ← Dashboard
          </button>
        </div>
      </nav>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">👑</span>
            <h1 className="text-3xl font-bold text-white">Premium freischalten</h1>
          </div>
          <p className="text-gray-500">Mit EselTokens statt Echtgeld — verdien sie im Casino oder kauf dir ein Paket.</p>
        </div>

        {/* Balance */}
        {balance !== null && (
          <div className="game-card p-5 mb-6 flex items-center justify-between animate-fade-in-up stagger-1">
            <span className="text-sm text-gray-400 uppercase tracking-wider">Dein Guthaben</span>
            <span className="token-display">{balance.toLocaleString('de-DE')}</span>
          </div>
        )}

        {msg && (
          <div
            className={`mb-6 p-4 rounded-xl border text-sm font-medium animate-fade-in-up ${
              msg.tone === 'success'
                ? 'bg-green-500/10 border-green-500/30 text-green-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            {msg.text}
          </div>
        )}

        {unknownProduct && (
          <p className="mb-4 text-sm text-gray-500">Unbekanntes Produkt — hier die volle Liste:</p>
        )}

        {/* Products */}
        <div className="space-y-3 animate-fade-in-up stagger-2">
          {visible.map((p) => {
            const tooExpensive = balance !== null && balance < p.priceTokens;
            return (
              <div key={p.productKey} className="game-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-amber-500/10 border border-purple-500/20 flex items-center justify-center text-2xl shrink-0">
                    {p.icon}
                  </div>
                  <div>
                    <div className="font-semibold text-white">{p.name}</div>
                    <div className="text-sm text-gray-500">{p.blurb}</div>
                    <div className="text-sm font-bold text-amber-400 mt-1">
                      {p.priceTokens.toLocaleString('de-DE')} EselTokens
                    </div>
                  </div>
                </div>
                <button
                  className="btn-primary shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:transform-none"
                  disabled={busy === p.productKey || tooExpensive}
                  onClick={() => redeem(p.productKey)}
                  title={tooExpensive ? 'Nicht genug EselTokens' : undefined}
                >
                  {busy === p.productKey ? 'Wird freigeschaltet…' : tooExpensive ? 'Zu wenig Tokens' : 'Freischalten'}
                </button>
              </div>
            );
          })}
        </div>

        {!showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="mt-6 text-sm text-purple-300 hover:text-purple-200 transition-colors"
          >
            Alle Produkte anzeigen →
          </button>
        )}

        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <button onClick={() => router.push('/dashboard')} className="btn-gold flex-1 text-center">
            🎰 Tokens im Casino verdienen
          </button>
          <a href="https://shop.eselbande.com" target="_blank" rel="noopener noreferrer" className="btn-primary flex-1 text-center">
            💳 Tokens kaufen
          </a>
        </div>
      </div>
    </div>
  );
}

// useSearchParams() bailt bei statischer Vorab-Generierung aus dem Server-Rendering aus, wenn die
// Komponente, die es aufruft, nicht in Suspense steckt -- ohne das bricht "next build" komplett ab.
export default function PremiumPage() {
  return (
    <Suspense fallback={null}>
      <PremiumPageInner />
    </Suspense>
  );
}
