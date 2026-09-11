'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiPath } from '@/lib/clientPaths';
import NotificationsBell from '@/components/NotificationsBell';
import GameNav from '@/components/GameNav';

const ROWS = 16;
const MULTIPLIERS = [
  21.34, 12, 2.67, 1.87, 1.6, 1.47, 1.33, 0.67, 0.4,
  0.67, 1.33, 1.47, 1.6, 1.87, 2.67, 12, 21.34,
];

function multiplierColor(m: number) {
  if (m >= 10) return 'bg-red-500/30 border-red-500/50 text-red-300';
  if (m >= 2) return 'bg-amber-500/30 border-amber-500/50 text-amber-300';
  if (m >= 1) return 'bg-purple-500/25 border-purple-500/40 text-purple-300';
  return 'bg-white/5 border-white/10 text-gray-400';
}

export default function PlinkoPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [bet, setBet] = useState(1);
  const [balance, setBalance] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [dropping, setDropping] = useState(false);
  const [ballPos, setBallPos] = useState<{ x: number; row: number } | null>(null);
  const [landedSlot, setLandedSlot] = useState<number | null>(null);
  const [result, setResult] = useState<{ won: boolean; payout: number; multiplier: number } | null>(null);
  const [history, setHistory] = useState<Array<{ won: boolean; amount: number; multiplier: number }>>([]);

  const userRole = (session?.user as any)?.role;

  useEffect(() => {
    if (status !== 'loading') setInitialLoad(false);
  }, [status]);

  useEffect(() => {
    if (status === 'unauthenticated') setTimeout(() => router.push('/'), 0);
    if (status === 'authenticated' && userRole === 'pending') setTimeout(() => router.push('/'), 0);
  }, [status, userRole]);

  useEffect(() => {
    if (session && !dropping) setBalance((session.user as any)?.balance ?? 0);
  }, [session]);

  const doDrop = async () => {
    if (dropping || bet < 1 || bet > balance) return;
    setDropping(true);
    setResult(null);
    setLandedSlot(null);

    try {
      const res = await fetch(apiPath('/api/plinko/drop'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: bet }),
      });
      const data = await res.json();
      if (!res.ok) { setDropping(false); return; }

      const path: string[] = data.path;
      let x = 0;
      let row = 0;
      setBallPos({ x: 0, row: 0 });

      const stepMs = 140;
      path.forEach((dir, i) => {
        setTimeout(() => {
          if (dir === 'R') x++;
          row = i + 1;
          setBallPos({ x, row });
        }, (i + 1) * stepMs);
      });

      setTimeout(() => {
        setLandedSlot(data.slot);
        setResult({ won: data.won, payout: data.payout, multiplier: data.multiplier });
        setHistory(prev => [{ won: data.won, amount: data.won ? data.payout : data.bet, multiplier: data.multiplier }, ...prev].slice(0, 10));
        setBalance(data.newBalance);
        setDropping(false);
        update();
      }, (path.length + 1) * stepMs);
    } catch {
      setDropping(false);
    }
  };

  const setQuickBet = (pct: number) => setBet(Math.max(1, Math.floor(balance * pct)));

  if (status === 'loading' && initialLoad) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session && initialLoad) return null;

  return (
    <div className="h-screen overflow-hidden relative flex flex-col" style={{ height: '100dvh' }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[600px] h-[600px] rounded-full bg-purple-600/8 blur-[150px] -top-60 -right-40" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-amber-500/6 blur-[120px] bottom-0 -left-32" />
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
              onClick={() => setMenuOpen(m => !m)}
              className="w-8 h-8 flex flex-col items-center justify-center gap-[5px] text-gray-400 hover:text-white transition-colors flex-shrink-0"
              aria-label="Menü"
            >
              <span className={`block w-5 h-0.5 bg-current transition-all duration-300 origin-center ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
              <span className={`block w-5 h-0.5 bg-current transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-current transition-all duration-300 origin-center ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
            </button>
            <div className="text-sm flex items-center gap-1">
              <span className="hidden sm:inline text-gray-500">Guthaben: </span>
              <span className="token-display text-base sm:text-lg">{balance}</span>
              <span className="text-gray-600 text-xs">🪙</span>
            </div>
          </div>
        </div>
      </nav>
      {menuOpen && <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />}
      <div className={`flex-shrink-0 relative z-20 grid transition-[grid-template-rows] duration-300 ease-in-out ${menuOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <GameNav current="/plinko" onNavigate={() => setMenuOpen(false)} />
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto w-full px-3 sm:px-4 py-2 flex-1 flex flex-col min-h-0">
        <div className="mb-2 hidden lg:flex items-center gap-3">
          <span className="text-3xl">🔴</span>
          <h1 className="text-2xl font-bold text-white">Plinko</h1>
          <span className="text-gray-600 text-sm ml-2">Lass die Kugel fallen und hoffe auf den Rand!</span>
        </div>

        {history.length > 0 && (
          <div className="mb-1.5 flex-shrink-0 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <span className="text-xs text-gray-500 flex-shrink-0">{history.filter(h => h.won).length}W / {history.filter(h => !h.won).length}L</span>
            {history.map((h, i) => (
              <span key={i} className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg border ${
                h.won ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'
              }`}>
                {h.multiplier.toFixed(2)}x
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-2 lg:gap-4 flex-1 min-h-0">
          <div className="flex-1 min-h-0 lg:flex-[2]">
            <div className="game-card relative overflow-hidden flex flex-col items-center justify-center h-full p-3">
              <div className="relative w-full max-w-[480px]" style={{ aspectRatio: '1 / 1.05' }}>
                {/* Pin rows */}
                <div className="absolute inset-0 flex flex-col justify-between py-2">
                  {Array.from({ length: ROWS }).map((_, row) => (
                    <div key={row} className="flex justify-center items-center gap-[3%]" style={{ paddingLeft: `${(ROWS - row) * 1.5}%`, paddingRight: `${(ROWS - row) * 1.5}%` }}>
                      {Array.from({ length: row + 1 }).map((_, i) => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/25 flex-shrink-0" />
                      ))}
                    </div>
                  ))}
                </div>

                {/* Ball */}
                {ballPos && (
                  <div
                    className="absolute w-3.5 h-3.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.8)] transition-all duration-150 ease-linear"
                    style={{
                      top: `${(ballPos.row / (ROWS + 1)) * 100}%`,
                      left: `${50 + (ballPos.x - ballPos.row / 2) * (80 / ROWS)}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                )}
              </div>

              {/* Slot multipliers */}
              <div className="flex gap-0.5 w-full max-w-[480px] mt-1">
                {MULTIPLIERS.map((m, i) => (
                  <div
                    key={i}
                    className={`flex-1 text-center text-[9px] sm:text-[11px] font-bold py-1.5 rounded border transition-all ${multiplierColor(m)} ${
                      landedSlot === i ? 'scale-110 ring-2 ring-white/50' : ''
                    }`}
                  >
                    {m}x
                  </div>
                ))}
              </div>

              {result && !dropping && (
                <div className={`mt-3 text-center animate-result-pop ${result.won ? 'result-win' : 'result-lose'}`}>
                  <p className={`text-2xl sm:text-3xl font-black ${result.won ? 'text-amber-400' : 'text-red-400'}`}>
                    {result.multiplier.toFixed(2)}x
                  </p>
                  <p className={`text-sm font-bold ${result.won ? 'text-green-400' : 'text-red-400'}`}>
                    {result.won ? `+${result.payout}` : `-${bet - result.payout}`} Tokens
                  </p>
                </div>
              )}

              {!dropping && !result && (
                <p className="text-gray-600 text-sm mt-3">Platziere deinen Einsatz und lass die Kugel fallen!</p>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 lg:w-72 lg:min-h-0 lg:flex lg:flex-col">
            <div className="game-card p-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Einsatz</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setBet(Math.max(1, bet - 1))}
                    disabled={dropping || bet <= 1}
                    className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all disabled:opacity-30 font-bold text-lg flex-shrink-0"
                  >−</button>
                  <input
                    type="number"
                    min={1}
                    max={balance}
                    value={bet}
                    onChange={(e) => setBet(Math.max(1, Math.min(balance, parseInt(e.target.value) || 1)))}
                    disabled={dropping}
                    className="game-input flex-1 text-center text-lg font-bold"
                  />
                  <button
                    onClick={() => setBet(Math.min(balance, bet + 1))}
                    disabled={dropping || bet >= balance}
                    className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all disabled:opacity-30 font-bold text-lg flex-shrink-0"
                  >+</button>
                </div>

                <div className="flex gap-2">
                  {[{ label: 'Min', pct: 0 }, { label: '25%', pct: 0.25 }, { label: '50%', pct: 0.5 }, { label: 'Max', pct: 1 }].map(({ label, pct }) => (
                    <button
                      key={label}
                      onClick={() => pct === 0 ? setBet(1) : setQuickBet(pct)}
                      disabled={dropping}
                      className="flex-1 text-xs py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all disabled:opacity-30"
                    >{label}</button>
                  ))}
                </div>

                <button
                  onClick={doDrop}
                  disabled={dropping || balance < 1 || bet > balance}
                  className="w-full py-3 rounded-xl font-black text-lg transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed btn-coinflip"
                >
                  {dropping ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      Fällt...
                    </span>
                  ) : (
                    <span>🔴 DROP! ({bet} 🪙)</span>
                  )}
                </button>

                {balance < 1 && (
                  <p className="text-red-400/70 text-xs text-center">Keine Tokens mehr!</p>
                )}
              </div>
            </div>

            <div className="game-card p-4 lg:flex-1 lg:min-h-0 hidden lg:flex flex-col">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Regeln</h3>
              <div className="text-xs text-gray-500 space-y-1.5">
                <p>🔴 Kugel fällt über 16 Pin-Reihen nach unten</p>
                <p>🎯 Rand-Slots = hoher Multiplikator, Mitte = niedrig</p>
                <p className="pt-1 border-t border-white/5 text-gray-600">16 unabhängige 50/50-Entscheidungen, kryptographisch fair</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
