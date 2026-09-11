'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiPath } from '@/lib/clientPaths';
import NotificationsBell from '@/components/NotificationsBell';
import GameNav from '@/components/GameNav';
import Sidebar from '@/components/Sidebar';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const OUTSIDE_BETS: Array<{ type: string; label: string; payout: string }> = [
  { type: 'red', label: 'Rot', payout: '2x' },
  { type: 'black', label: 'Schwarz', payout: '2x' },
  { type: 'even', label: 'Gerade', payout: '2x' },
  { type: 'odd', label: 'Ungerade', payout: '2x' },
  { type: 'low', label: '1-18', payout: '2x' },
  { type: 'high', label: '19-36', payout: '2x' },
  { type: 'dozen1', label: '1. Dutzend', payout: '3x' },
  { type: 'dozen2', label: '2. Dutzend', payout: '3x' },
  { type: 'dozen3', label: '3. Dutzend', payout: '3x' },
  { type: 'column1', label: 'Reihe 1', payout: '3x' },
  { type: 'column2', label: 'Reihe 2', payout: '3x' },
  { type: 'column3', label: 'Reihe 3', payout: '3x' },
];

function colorOf(n: number) {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

export default function RoulettePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [bet, setBet] = useState(1);
  const [betType, setBetType] = useState('red');
  const [straightNum, setStraightNum] = useState(0);
  const [balance, setBalance] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [landedNumber, setLandedNumber] = useState<number | null>(null);
  const [result, setResult] = useState<{ won: boolean; payout: number } | null>(null);
  const [history, setHistory] = useState<Array<{ number: number; color: string }>>([]);

  const userRole = (session?.user as any)?.role;

  useEffect(() => {
    if (status !== 'loading') setInitialLoad(false);
  }, [status]);

  useEffect(() => {
    if (status === 'unauthenticated') setTimeout(() => router.push('/'), 0);
    if (status === 'authenticated' && userRole === 'pending') setTimeout(() => router.push('/'), 0);
  }, [status, userRole]);

  useEffect(() => {
    if (session && !spinning) setBalance((session.user as any)?.balance ?? 0);
  }, [session]);

  const doSpin = async () => {
    if (spinning || bet < 1 || bet > balance) return;
    setSpinning(true);
    setResult(null);
    setLandedNumber(null);

    try {
      const res = await fetch(apiPath('/api/roulette/spin'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: bet, betType, betValue: betType === 'straight' ? straightNum : undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setSpinning(false); return; }

      setTimeout(() => {
        setLandedNumber(data.number);
        setResult({ won: data.won, payout: data.payout });
        setHistory(prev => [{ number: data.number, color: data.color }, ...prev].slice(0, 12));
        setBalance(data.newBalance);
        setSpinning(false);
        update();
      }, 1600);
    } catch {
      setSpinning(false);
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
    <div className="h-screen overflow-hidden relative flex flex-col lg:pl-56" style={{ height: '100dvh' }}>
      <Sidebar current="/roulette" />
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
              className="lg:hidden w-8 h-8 flex flex-col items-center justify-center gap-[5px] text-gray-400 hover:text-white transition-colors flex-shrink-0"
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
      <div className={`lg:hidden flex-shrink-0 relative z-20 grid transition-[grid-template-rows] duration-300 ease-in-out ${menuOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <GameNav current="/roulette" onNavigate={() => setMenuOpen(false)} />
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto w-full px-3 sm:px-4 py-2 flex-1 flex flex-col min-h-0 overflow-y-auto">
        <div className="mb-2 hidden lg:flex items-center gap-3">
          <span className="text-3xl">🎡</span>
          <h1 className="text-2xl font-bold text-white">Roulette</h1>
          <span className="text-gray-600 text-sm ml-2">Europäisch, eine einzige Null</span>
        </div>

        {history.length > 0 && (
          <div className="mb-1.5 flex-shrink-0 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {history.map((h, i) => (
              <span key={i} className={`flex-shrink-0 w-7 h-7 flex items-center justify-center text-xs font-bold rounded-full border ${
                h.color === 'red' ? 'bg-red-500/25 border-red-500/40 text-red-300'
                : h.color === 'black' ? 'bg-white/10 border-white/20 text-gray-300'
                : 'bg-green-500/25 border-green-500/40 text-green-300'
              }`}>
                {h.number}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-2 lg:gap-4 flex-1 min-h-0">
          <div className="flex-1 min-h-0 lg:flex-[2]">
            <div className="game-card relative overflow-hidden flex flex-col items-center justify-center h-full p-4">
              <div className="relative w-48 h-48 sm:w-56 sm:h-56">
                <div className={`absolute inset-0 rounded-full border-4 border-amber-500/40 ${spinning ? 'animate-spin' : ''}`} style={{ animationDuration: '0.6s' }} />
                <div className="absolute inset-4 rounded-full bg-gradient-to-br from-gray-900 to-black border border-white/10 flex items-center justify-center">
                  {landedNumber !== null && !spinning ? (
                    <div className="text-center">
                      <p className={`text-4xl font-black ${
                        colorOf(landedNumber) === 'red' ? 'text-red-400' : colorOf(landedNumber) === 'black' ? 'text-gray-200' : 'text-green-400'
                      }`}>{landedNumber}</p>
                    </div>
                  ) : (
                    <span className="text-4xl">🎡</span>
                  )}
                </div>
              </div>

              {result && !spinning && (
                <div className={`mt-4 text-center animate-result-pop ${result.won ? 'result-win' : 'result-lose'}`}>
                  <p className={`text-2xl font-black ${result.won ? 'text-amber-400' : 'text-red-400'}`}>
                    {result.won ? '🎉 GEWONNEN!' : '💀 VERLOREN!'}
                  </p>
                  {result.won && <p className="text-lg font-bold text-green-400">+{result.payout} Tokens</p>}
                </div>
              )}

              {!spinning && !result && (
                <p className="text-gray-600 text-sm mt-4">Wähle einen Einsatztyp und dreh das Rad!</p>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 lg:w-80 lg:min-h-0 lg:flex lg:flex-col">
            <div className="game-card p-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Einsatz</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setBet(Math.max(1, bet - 1))}
                    disabled={spinning || bet <= 1}
                    className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all disabled:opacity-30 font-bold text-lg flex-shrink-0"
                  >−</button>
                  <input
                    type="number"
                    min={1}
                    max={balance}
                    value={bet}
                    onChange={(e) => setBet(Math.max(1, Math.min(balance, parseInt(e.target.value) || 1)))}
                    disabled={spinning}
                    className="game-input flex-1 text-center text-lg font-bold"
                  />
                  <button
                    onClick={() => setBet(Math.min(balance, bet + 1))}
                    disabled={spinning || bet >= balance}
                    className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all disabled:opacity-30 font-bold text-lg flex-shrink-0"
                  >+</button>
                </div>

                <div className="flex gap-2">
                  {[{ label: 'Min', pct: 0 }, { label: '25%', pct: 0.25 }, { label: '50%', pct: 0.5 }, { label: 'Max', pct: 1 }].map(({ label, pct }) => (
                    <button
                      key={label}
                      onClick={() => pct === 0 ? setBet(1) : setQuickBet(pct)}
                      disabled={spinning}
                      className="flex-1 text-xs py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all disabled:opacity-30"
                    >{label}</button>
                  ))}
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Einsatztyp</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {OUTSIDE_BETS.map(({ type, label, payout }) => (
                      <button
                        key={type}
                        onClick={() => setBetType(type)}
                        disabled={spinning}
                        className={`text-[10px] py-1.5 px-1 rounded-lg border transition-all disabled:opacity-30 leading-tight ${
                          betType === type
                            ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        <div>{label}</div>
                        <div className="opacity-60">{payout}</div>
                      </button>
                    ))}
                    <button
                      onClick={() => setBetType('straight')}
                      disabled={spinning}
                      className={`text-[10px] py-1.5 px-1 rounded-lg border transition-all disabled:opacity-30 leading-tight ${
                        betType === 'straight'
                          ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      <div>Zahl</div>
                      <div className="opacity-60">36x</div>
                    </button>
                  </div>
                </div>

                {betType === 'straight' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Zahl (0-36):</span>
                    <input
                      type="number"
                      min={0}
                      max={36}
                      value={straightNum}
                      onChange={(e) => setStraightNum(Math.max(0, Math.min(36, parseInt(e.target.value) || 0)))}
                      disabled={spinning}
                      className="game-input flex-1 text-center text-sm font-bold py-1"
                    />
                  </div>
                )}

                <button
                  onClick={doSpin}
                  disabled={spinning || balance < 1 || bet > balance}
                  className="w-full py-3 rounded-xl font-black text-lg transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed btn-coinflip"
                >
                  {spinning ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      Dreht sich...
                    </span>
                  ) : (
                    <span>🎡 SPIN! ({bet} 🪙)</span>
                  )}
                </button>

                {balance < 1 && (
                  <p className="text-red-400/70 text-xs text-center">Keine Tokens mehr!</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
