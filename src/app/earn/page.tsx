'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiPath } from '@/lib/clientPaths';
import NotificationsBell from '@/components/NotificationsBell';
import GameNav from '@/components/GameNav';
import Sidebar from '@/components/Sidebar';

type Status = {
  balance: number;
  starterPack: { claimable: boolean; amount: number };
  daily: { eligible: boolean; amount: number; nextClaimAt: number; remainingMs: number };
  vote: { eligible: boolean; amount: number; nextClaimAt: number; remainingMs: number; url: string };
};

function fmtMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export default function EarnPage() {
  const { data: session, status: authStatus, update } = useSession();
  const router = useRouter();
  const userRole = (session?.user as any)?.role;

  const [menuOpen, setMenuOpen] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [s, setS] = useState<Status | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [fx, setFx] = useState<'starter' | 'daily' | 'vote' | null>(null);

  useEffect(() => {
    if (authStatus !== 'loading') setInitialLoad(false);
  }, [authStatus]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      setTimeout(() => router.push('/'), 0);
    }
    if (authStatus === 'authenticated' && userRole === 'pending') {
      setTimeout(() => router.push('/'), 0);
    }
  }, [authStatus, userRole]);

  const refresh = async () => {
    const r = await fetch(apiPath('/api/rewards/status'));
    if (!r.ok) return;
    const data = await r.json();
    setS(data);
  };

  useEffect(() => {
    if (session) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const balance = useMemo(() => (session?.user as any)?.balance ?? s?.balance ?? 0, [session, s]);

  const burst = (k: 'starter' | 'daily' | 'vote') => {
    setFx(k);
    setTimeout(() => setFx(null), 900);
  };

  const claim = async (which: 'starter' | 'daily' | 'vote') => {
    setMsg(null);
    const url =
      which === 'starter' ? '/api/tokens/starter-pack' :
      which === 'daily' ? '/api/tokens/daily' :
      '/api/tokens/vote';

    const r = await fetch(apiPath(url), { method: 'POST' });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (data?.voteUrl) {
        setMsg('Vote zuerst auf top.gg und dann Claim.');
      } else if (data?.remainingMs) {
        setMsg(`Cooldown: ${fmtMs(data.remainingMs)}`);
      } else {
        setMsg(data?.error || 'Aktion fehlgeschlagen.');
      }
      return;
    }
    setMsg(`+${data.amount} Tokens`);
    burst(which);
    await update();
    await refresh();
  };

  if (authStatus === 'loading' && initialLoad) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session && initialLoad) return null;

  const rewards: Array<{
    key: 'starter' | 'daily' | 'vote';
    icon: string;
    accent: string;
    title: string;
    cadence: string;
    desc: string;
    amount: number;
    available: boolean;
    remainingMs?: number;
    extra?: React.ReactNode;
  }> = [
    {
      key: 'starter',
      icon: '🎁',
      accent: 'from-amber-500/20 to-orange-500/10 border-amber-500/25',
      title: 'Starter Pack',
      cadence: 'Einmalig',
      desc: 'Ein einmaliges Willkommensgeschenk für neue Mitglieder.',
      amount: s?.starterPack?.amount ?? 0,
      available: !!s?.starterPack?.claimable,
    },
    {
      key: 'daily',
      icon: '🌅',
      accent: 'from-purple-500/20 to-fuchsia-500/10 border-purple-500/25',
      title: 'Daily Reward',
      cadence: 'Alle 24h',
      desc: 'Hol dir jeden Tag gratis Tokens ab — einfach vorbeischauen.',
      amount: s?.daily?.amount ?? 0,
      available: !!s?.daily?.eligible,
      remainingMs: s?.daily?.remainingMs ?? 0,
    },
    {
      key: 'vote',
      icon: '🗳️',
      accent: 'from-blue-500/20 to-cyan-500/10 border-blue-500/25',
      title: 'Vote to Earn',
      cadence: 'Alle 12h',
      desc: 'Vote auf top.gg für den Fahrstuhl Bot und hol dir deine Belohnung.',
      amount: s?.vote?.amount ?? 0,
      available: !!s?.vote?.eligible,
      remainingMs: s?.vote?.remainingMs ?? 0,
      extra: (
        <a
          href={s?.vote?.url || '#'}
          target="_blank"
          rel="noreferrer"
          className={`btn-chip text-center text-xs ${s?.vote?.url ? '' : 'opacity-40 pointer-events-none'}`}
        >
          🔗 Zu top.gg
        </a>
      ),
    },
  ];

  const totalAvailable = rewards.filter(r => r.available).length;

  return (
    <div className="h-screen overflow-hidden relative flex flex-col lg:pl-56" style={{ height: '100dvh' }}>
      <Sidebar current="/earn" />
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[650px] h-[650px] rounded-full bg-amber-500/7 blur-[160px] -top-72 -left-44" />
        <div className="absolute w-[520px] h-[520px] rounded-full bg-purple-600/7 blur-[160px] -bottom-72 -right-44" />
      </div>

      <nav className="relative z-30 border-b border-purple-500/10 bg-black/20 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer lg:hidden" onClick={() => router.push('/dashboard')}>
            <span className="text-xl sm:text-2xl">🫏</span>
            <h1 className="text-base sm:text-xl font-bold">
              <span className="glow-text">Esel</span><span className="text-amber-400">Tokens</span>
            </h1>
          </div>
          <h2 className="hidden lg:block text-sm font-semibold text-gray-400 tracking-wide">+ Tokens</h2>
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationsBell />
            <button
              onClick={() => setMenuOpen(m => !m)}
              className="lg:hidden w-8 h-8 flex flex-col items-center justify-center gap-[5px] text-gray-400 hover:text-white transition-colors flex-shrink-0"
              aria-label="Menü"
            >
              <span className={`block w-5 h-0.5 bg-current transition-all duration-300 origin-center ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
              <span className={`block w-5 h-0.5 bg-current transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-current transition-all duration-300 origin-center ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
            </button>
          </div>
        </div>
      </nav>

      {menuOpen && <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />}
      <div className={`lg:hidden flex-shrink-0 relative z-20 grid transition-[grid-template-rows] duration-300 ease-in-out ${menuOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <GameNav current="/earn" onNavigate={() => setMenuOpen(false)} />
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 flex-1 min-h-0 overflow-auto">

        {/* ── Greeting header, same language as Dashboard ── */}
        <div className="mb-5 sm:mb-6 flex items-center justify-between flex-wrap gap-3 animate-fade-in-up">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Tokens verdienen 💰</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {totalAvailable > 0
                ? `${totalAvailable} Belohnung${totalAvailable !== 1 ? 'en' : ''} gerade verfügbar`
                : 'Alle Belohnungen abgeholt — schau später wieder vorbei'}
            </p>
          </div>
          <div className="game-card px-5 py-3 flex items-center gap-3">
            <span className="text-2xl">🪙</span>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-widest">Guthaben</p>
              <p className="token-display text-lg leading-tight">{balance}</p>
            </div>
          </div>
        </div>

        {msg && (
          <div className="mb-4 text-sm text-gray-200 bg-white/5 border border-white/10 rounded-xl px-4 py-3 animate-fade-in-up">
            {msg}
          </div>
        )}

        {/* ── Reward cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {rewards.map((r, i) => (
            <div
              key={r.key}
              className={`game-card p-6 relative overflow-hidden flex flex-col animate-fade-in-up ${i === 0 ? 'stagger-1' : i === 1 ? 'stagger-2' : 'stagger-3'}`}
            >
              {fx === r.key && <div className="absolute inset-0 reward-burst pointer-events-none" />}
              <div className={`absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gradient-to-br ${r.accent} opacity-40 blur-[50px]`} />

              <div className="relative flex items-start justify-between mb-4">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${r.accent} border flex items-center justify-center text-2xl flex-shrink-0`}>
                  {r.icon}
                </div>
                {r.available ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-green-500/15 border border-green-500/30 text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Verfügbar
                  </span>
                ) : r.remainingMs !== undefined ? (
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-500">
                    ⏳ {fmtMs(r.remainingMs)}
                  </span>
                ) : (
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-600">
                    ✓ Erledigt
                  </span>
                )}
              </div>

              <div className="relative flex-1">
                <p className="text-white font-bold text-lg leading-tight">{r.title}</p>
                <p className="text-xs text-gray-500 mb-3">{r.cadence}</p>
                <p className="text-sm text-gray-400 leading-relaxed">{r.desc}</p>
              </div>

              <div className="relative mt-5">
                <div className="flex items-baseline gap-1.5 mb-3">
                  <span className="token-display text-2xl">+{r.amount}</span>
                  <span className="text-xs text-gray-500">Tokens</span>
                </div>

                {r.key === 'vote' ? (
                  <div className="grid grid-cols-2 gap-2">
                    {r.extra}
                    <button
                      onClick={() => claim('vote')}
                      className="btn-primary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={!r.available}
                    >
                      Claim
                    </button>
                  </div>
                ) : r.available ? (
                  <button onClick={() => claim(r.key)} className="w-full btn-gold py-2.5 rounded-xl font-bold">
                    Jetzt claimen
                  </button>
                ) : (
                  <button disabled className="w-full py-2.5 rounded-xl font-bold bg-white/[0.03] border border-white/10 text-gray-600 cursor-not-allowed">
                    {r.remainingMs !== undefined ? 'Noch nicht bereit' : 'Bereits abgeholt'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Footer hint ── */}
        <div className="mt-6 game-card px-5 py-4 flex items-center gap-3 text-sm text-gray-400 animate-fade-in-up stagger-3">
          <span className="text-lg">💡</span>
          <p>Weitere Tokens gibt's fürs gemeinsame Sprachchatten auf dem Server und in den Spielen nebenan in der Sidebar.</p>
        </div>
      </div>
    </div>
  );
}
