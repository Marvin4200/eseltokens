'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiPath } from '@/lib/clientPaths';
import NotificationsBell from '@/components/NotificationsBell';
import GameNav from '@/components/GameNav';

type Giveaway = {
  id: number;
  prize: string;
  durationMinutes: number;
  winnerSlots: number;
  createdAt: string;
  endsAt: number;
  ended: boolean;
  entryCount: number;
  entered: boolean;
  winners: { id: number; username: string }[] | null;
  isWinner: boolean;
};

function fmtMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export default function GiveawaysPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const userRole = (session?.user as any)?.role;
  const canManage = userRole === 'admin' || userRole === 'moderator';

  const [menuOpen, setMenuOpen] = useState(false);
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [now, setNow] = useState(Date.now());
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [prize, setPrize] = useState('');
  const [duration, setDuration] = useState('60');
  const [winnerSlots, setWinnerSlots] = useState('1');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      setTimeout(() => router.push('/'), 0);
    }
    if (authStatus === 'authenticated' && userRole === 'pending') {
      setTimeout(() => router.push('/'), 0);
    }
  }, [authStatus, userRole]);

  const refresh = async () => {
    const r = await fetch(apiPath('/api/giveaways'));
    if (!r.ok) return;
    const data = await r.json();
    setGiveaways(Array.isArray(data.giveaways) ? data.giveaways : []);
  };

  useEffect(() => {
    if (session) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { active, ended } = useMemo(() => {
    const active = giveaways.filter((g) => !g.ended);
    const ended = giveaways.filter((g) => g.ended);
    return { active, ended };
  }, [giveaways]);

  const enter = async (id: number) => {
    setBusyId(id);
    setMsg(null);
    try {
      const r = await fetch(apiPath(`/api/giveaways/${id}/enter`), { method: 'POST' });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(data?.error || 'Teilnahme fehlgeschlagen.');
        return;
      }
      setMsg('Erfolgreich teilgenommen!');
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const createGiveaway = async () => {
    setCreating(true);
    setMsg(null);
    try {
      const r = await fetch(apiPath('/api/giveaways'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prize, duration: Number(duration), winners: Number(winnerSlots) }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(data?.error || 'Erstellen fehlgeschlagen.');
        return;
      }
      setPrize('');
      setDuration('60');
      setWinnerSlots('1');
      setFormOpen(false);
      await refresh();
    } finally {
      setCreating(false);
    }
  };

  const deleteGiveaway = async (id: number) => {
    setBusyId(id);
    try {
      await fetch(apiPath(`/api/giveaways/${id}`), { method: 'DELETE' });
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  if (authStatus === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return null;

  return (
    <div className="h-screen overflow-hidden relative flex flex-col" style={{ height: '100dvh' }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[650px] h-[650px] rounded-full bg-amber-500/7 blur-[160px] -top-72 -left-44" />
        <div className="absolute w-[520px] h-[520px] rounded-full bg-purple-600/7 blur-[160px] -bottom-72 -right-44" />
      </div>

      <nav className="relative z-30 border-b border-purple-500/10 bg-black/20 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer" onClick={() => router.push('/dashboard')}>
            <span className="text-xl sm:text-2xl">🫏</span>
            <h1 className="text-base sm:text-xl font-bold">
              <span className="glow-text">Esel</span><span className="text-amber-400">Tokens</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationsBell />
            <button
              onClick={() => setMenuOpen((m) => !m)}
              className="w-8 h-8 flex flex-col items-center justify-center gap-[5px] text-gray-400 hover:text-white transition-colors flex-shrink-0"
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
      <div className={`flex-shrink-0 relative z-20 grid transition-[grid-template-rows] duration-300 ease-in-out ${menuOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <GameNav current="/giveaways" onNavigate={() => setMenuOpen(false)} />
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 flex-1 min-h-0 overflow-auto">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest">Community</p>
            <h1 className="text-2xl font-black text-white">Giveaways</h1>
          </div>
          {canManage && (
            <button
              onClick={() => setFormOpen((f) => !f)}
              className="text-sm px-4 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-all"
            >
              {formOpen ? 'Abbrechen' : '+ Neues Giveaway'}
            </button>
          )}
        </div>

        {msg && (
          <div className="mb-4 text-sm text-gray-200 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            {msg}
          </div>
        )}

        {canManage && formOpen && (
          <div className="game-card p-5 mb-6">
            <p className="text-white font-bold mb-3">Neues Giveaway</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-widest">Preis</label>
                <input
                  value={prize}
                  onChange={(e) => setPrize(e.target.value)}
                  placeholder="z.B. Discord Nitro"
                  className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-widest">Dauer (Minuten)</label>
                <input
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-widest">Anzahl Gewinner</label>
                <input
                  type="number"
                  min={1}
                  value={winnerSlots}
                  onChange={(e) => setWinnerSlots(e.target.value)}
                  className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
            <button
              onClick={createGiveaway}
              disabled={creating || !prize.trim()}
              className="mt-4 text-sm px-4 py-2 rounded-lg bg-amber-500 text-black font-bold hover:bg-amber-400 transition-all disabled:opacity-40"
            >
              {creating ? 'Wird erstellt…' : 'Giveaway starten'}
            </button>
          </div>
        )}

        <div className="mb-8">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Aktiv</p>
          {active.length === 0 && (
            <p className="text-sm text-gray-500">Gerade läuft kein Giveaway. Schau später wieder vorbei!</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((g) => (
              <div key={g.id} className="game-card p-5 relative overflow-hidden">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-base">🎁</div>
                  <div className="min-w-0">
                    <p className="text-white font-bold truncate">{g.prize}</p>
                    <p className="text-xs text-gray-500">{g.winnerSlots} Gewinner · {g.entryCount} Teilnehmer</p>
                  </div>
                </div>
                <p className="text-sm text-gray-300 mb-4">
                  Endet in <span className="text-amber-300 font-semibold">{fmtMs(g.endsAt - now)}</span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => enter(g.id)}
                    disabled={g.entered || busyId === g.id}
                    className={`flex-1 text-sm px-4 py-2 rounded-lg font-bold transition-all ${
                      g.entered
                        ? 'bg-white/5 border border-white/10 text-gray-500 cursor-default'
                        : 'bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-40'
                    }`}
                  >
                    {g.entered ? '✅ Teilgenommen' : busyId === g.id ? '…' : 'Teilnehmen'}
                  </button>
                  {canManage && (
                    <button
                      onClick={() => deleteGiveaway(g.id)}
                      disabled={busyId === g.id}
                      className="text-sm px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                      title="Giveaway löschen"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {ended.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Beendet</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ended.map((g) => (
                <div key={g.id} className={`game-card p-5 ${g.isWinner ? 'border-amber-400/40' : ''}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-base opacity-60">🎁</div>
                    <div className="min-w-0">
                      <p className="text-white font-bold truncate">{g.prize}</p>
                      <p className="text-xs text-gray-500">{g.entryCount} Teilnehmer</p>
                    </div>
                  </div>
                  {g.winners && g.winners.length > 0 ? (
                    <p className="text-sm text-gray-300">
                      🏆 {g.winners.map((w) => w.username).join(', ')}
                      {g.isWinner && <span className="text-amber-300 font-bold"> — du hast gewonnen!</span>}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">Niemand hat teilgenommen.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
