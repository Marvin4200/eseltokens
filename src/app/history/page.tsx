'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiPath } from '@/lib/clientPaths';

interface HistoryItem {
  id: number;
  type: string;
  amount: number;
  createdAt: string;
  direction: 'in' | 'out';
  counterpart: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  give: 'Tokens-Transfer',
  crash_win: 'Crash-Gewinn',
  shop_purchase: 'Shop-Kauf gutgeschrieben',
  reward_voice_activity: 'Sprachkanal-Belohnung',
  reward_daily: 'Täglicher Bonus',
  reward_starter_pack: 'Starter-Paket',
  reward_topgg_vote: 'Top.gg Vote-Bonus',
  redeem: 'Team-Code eingelöst',
  premium_redeem: 'Premium mit Tokens freigeschaltet',
  premium_redeem_refund: 'Rückerstattung (Freischaltung fehlgeschlagen)',
};

function labelFor(item: HistoryItem) {
  if (item.type === 'give') {
    return item.direction === 'in'
      ? `Erhalten von ${item.counterpart ?? 'unbekannt'}`
      : `Gesendet an ${item.counterpart ?? 'unbekannt'}`;
  }
  return TYPE_LABELS[item.type] ?? item.type;
}

export default function History() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      setTimeout(() => { router.push('/'); }, 0);
    }
  }, [status]);

  useEffect(() => {
    if (session) load(0, false);
  }, [session]);

  const load = async (nextOffset: number, append: boolean) => {
    setLoading(true);
    const res = await fetch(apiPath(`/api/tokens/history?offset=${nextOffset}`));
    const data = await res.json();
    setItems((prev) => (append ? [...prev, ...(data.items ?? [])] : (data.items ?? [])));
    setHasMore(!!data.hasMore);
    setOffset(data.nextOffset ?? nextOffset);
    setLoading(false);
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-amber-600/8 blur-[150px] -top-40 -left-40" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-purple-500/5 blur-[120px] -bottom-32 -right-32" />
      </div>

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
        <div className="mb-6 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🧾</span>
            <h1 className="text-3xl font-bold text-white">Mein Kontoauszug</h1>
          </div>
          <p className="text-gray-500">Alle Gutschriften, Abbuchungen und Transfers deines Accounts.</p>
        </div>

        <div className="game-card p-4 sm:p-6 animate-fade-in-up stagger-2">
          {items.length === 0 && !loading && (
            <p className="text-gray-600 text-center py-12">Noch keine Transaktionen vorhanden.</p>
          )}

          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.03] transition-all"
              >
                <div>
                  <div className="text-sm text-white font-medium">{labelFor(item)}</div>
                  <div className="text-xs text-gray-500">{new Date(item.createdAt.replace(' ', 'T') + 'Z').toLocaleString('de-DE')}</div>
                </div>
                <div className={`font-bold text-sm whitespace-nowrap ${item.direction === 'in' ? 'text-green-400' : 'text-red-400'}`}>
                  {item.direction === 'in' ? '+' : '-'}{item.amount.toLocaleString('de-DE')} 🪙
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="text-center mt-4">
              <button
                onClick={() => load(offset, true)}
                disabled={loading}
                className="text-sm px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all disabled:opacity-50"
              >
                {loading ? 'Lädt…' : 'Mehr laden'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
