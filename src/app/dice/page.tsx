'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiPath } from '@/lib/clientPaths';
import NotificationsBell from '@/components/NotificationsBell';
import GameNav from '@/components/GameNav';

const MIN_TARGET = 2;
const MAX_TARGET = 98;
const HOUSE_EDGE = 0.97;

type Direction = 'under' | 'over';

function computeMultiplier(direction: Direction, target: number) {
  const winChance = direction === 'under' ? target : 100 - target;
  return Math.round((HOUSE_EDGE * 100 / winChance) * 10000) / 10000;
}

export default function DicePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [bet, setBet] = useState(1);
  const [direction, setDirection] = useState<Direction>('under');
  const [target, setTarget] = useState(50);
  const [balance, setBalance] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [result, setResult] = useState<{ won: boolean; payout: number } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [history, setHistory] = useState<Array<{ won: boolean; amount: number }>>([]);

  const userRole = (session?.user as any)?.role;
  const winChance = direction === 'under' ? target : 100 - target;
  const multiplier = computeMultiplier(direction, target);
  const potentialPayout = Math.floor(bet * multiplier);

  useEffect(() => {
    if (status !== 'loading') setInitialLoad(false);
  }, [status]);

  useEffect(() => {
    if (status === 'unauthenticated') setTimeout(() => router.push('/'), 0);
    if (status === 'authenticated' && userRole === 'pending') setTimeout(() => router.push('/'), 0);
  }, [status, userRole]);

  useEffect(() => {
    if (session && !rolling) setBalance((session.user as any)?.balance ?? 0);
  }, [session]);

  const doRoll = async () => {
    if (rolling || bet < 1 || bet > balance) return;
    setRolling(true);
    setShowResult(false);
    setResult(null);

    try {
      const res = await fetch(apiPath('/api/dice/roll'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: bet, direction, target }),
      });
      const data = await res.json();
      if (!res.ok) { setRolling(false); return; }

      setLastRoll(data.roll);
      setTimeout(() => {
        setResult({ won: data.won, payout: data.payout });
        setShowResult(true);
        setBalance(data.newBalance);
        setHistory(prev => [{ won: data.won, amount: data.won ? data.payout : data.bet }, ...prev].slice(0, 10));
        setRolling(false);
        update();
      }, 900);
    } catch {
      setRolling(false);
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
          <GameNav current="/dice" onNavigate={() => setMenuOpen(false)} />
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto w-full px-3 sm:px-4 py-2 flex-1 flex flex-col min-h-0">
        <div className="mb-2 hidden lg:flex items-center gap-3">
          <span className="text-3xl">🎲</span>
          <h1 className="text-2xl font-bold text-white">Dice</h1>
          <span className="text-gray-600 text-sm ml-2">Wähle über oder unter, stell die Ziellinie ein!</span>
        </div>

        {history.length > 0 && (
          <div className="mb-1.5 flex-shrink-0 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <span className="text-xs text-gray-500 flex-shrink-0">{history.filter(h => h.won).length}W / {history.filter(h => !h.won).length}L</span>
            {history.map((h, i) => (
              <span key={i} className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg border ${
                h.won ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'
              }`}>
                {h.won ? '+' : '-'}{h.amount}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-2 lg:gap-4 flex-1 min-h-0">
          <div className="flex-1 min-h-0 lg:flex-[2]">
            <div className="game-card relative overflow-hidden flex flex-col items-center justify-center h-full p-6">
              {/* Slider track visualizing 0-100 with target marker + last roll marker */}
              <div className="w-full max-w-lg">
                <div className="relative h-10 rounded-full overflow-hidden border border-white/10 mb-4">
                  <div
                    className="absolute inset-y-0 left-0 bg-red-500/25"
                    style={{ width: direction === 'under' ? `${target}%` : '0%' }}
                  />
                  <div
                    className="absolute inset-y-0 right-0 bg-red-500/25"
                    style={{ width: direction === 'over' ? `${100 - target}%` : '0%' }}
                  />
                  <div
                    className="absolute inset-y-0 bg-green-500/25"
                    style={{
                      left: direction === 'under' ? `${target}%` : '0%',
                      width: direction === 'under' ? `${100 - target}%` : `${target}%`,
                    }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white/80"
                    style={{ left: `${target}%` }}
                  />
                  {lastRoll !== null && (
                    <div
                      className={`absolute -top-1 w-3 h-3 rounded-full border-2 border-black transition-all duration-700 ${
                        result?.won ? 'bg-amber-400' : 'bg-red-500'
                      }`}
                      style={{ left: `calc(${lastRoll}% - 6px)` }}
                    />
                  )}
                </div>

                <input
                  type="range"
                  min={MIN_TARGET}
                  max={MAX_TARGET}
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                  disabled={rolling}
                  className="w-full accent-purple-500"
                />

                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0</span>
                  <span className="text-white font-bold">Ziel: {target}</span>
                  <span>100</span>
                </div>
              </div>

              {lastRoll !== null && (
                <p className="mt-4 text-lg text-gray-400">
                  Wurf: <span className="font-bold text-white">{lastRoll.toFixed(2)}</span>
                </p>
              )}

              {showResult && result && (
                <div className={`mt-3 text-center animate-result-pop ${result.won ? 'result-win' : 'result-lose'}`}>
                  <p className={`text-2xl sm:text-3xl font-black ${result.won ? 'text-amber-400' : 'text-red-400'}`}>
                    {result.won ? '🎉 GEWONNEN!' : '💀 VERLOREN!'}
                  </p>
                  {result.won && <p className="text-lg font-bold text-green-400">+{result.payout} Tokens</p>}
                </div>
              )}

              {!rolling && !showResult && (
                <p className="text-gray-600 text-sm mt-4">Stelle Ziel & Richtung ein und würfle!</p>
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
                    disabled={rolling || bet <= 1}
                    className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all disabled:opacity-30 font-bold text-lg flex-shrink-0"
                  >−</button>
                  <input
                    type="number"
                    min={1}
                    max={balance}
                    value={bet}
                    onChange={(e) => setBet(Math.max(1, Math.min(balance, parseInt(e.target.value) || 1)))}
                    disabled={rolling}
                    className="game-input flex-1 text-center text-lg font-bold"
                  />
                  <button
                    onClick={() => setBet(Math.min(balance, bet + 1))}
                    disabled={rolling || bet >= balance}
                    className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all disabled:opacity-30 font-bold text-lg flex-shrink-0"
                  >+</button>
                </div>

                <div className="flex gap-2">
                  {[{ label: 'Min', pct: 0 }, { label: '25%', pct: 0.25 }, { label: '50%', pct: 0.5 }, { label: 'Max', pct: 1 }].map(({ label, pct }) => (
                    <button
                      key={label}
                      onClick={() => pct === 0 ? setBet(1) : setQuickBet(pct)}
                      disabled={rolling}
                      className="flex-1 text-xs py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all disabled:opacity-30"
                    >{label}</button>
                  ))}
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Richtung</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDirection('under')}
                      disabled={rolling}
                      className={`flex-1 text-sm py-1.5 rounded-lg border transition-all disabled:opacity-30 ${
                        direction === 'under'
                          ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >⬇ Unter</button>
                    <button
                      onClick={() => setDirection('over')}
                      disabled={rolling}
                      className={`flex-1 text-sm py-1.5 rounded-lg border transition-all disabled:opacity-30 ${
                        direction === 'over'
                          ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >⬆ Über</button>
                  </div>
                </div>

                <div className="flex justify-between text-xs text-gray-500 px-0.5">
                  <span>Chance: {winChance}%</span>
                  <span>{multiplier.toFixed(4)}x</span>
                </div>

                <button
                  onClick={doRoll}
                  disabled={rolling || balance < 1 || bet > balance}
                  className="w-full py-3 rounded-xl font-black text-lg transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed btn-coinflip"
                >
                  {rolling ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      Würfelt...
                    </span>
                  ) : (
                    <span>🎲 WÜRFELN ({bet} 🪙 → {potentialPayout} 🪙)</span>
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
                <p>🎲 Es wird eine Zahl zwischen 0.00 und 99.99 gewürfelt</p>
                <p>⬇ Unter deinem Ziel = Gewinn (bei „Unter“)</p>
                <p>⬆ Über deinem Ziel = Gewinn (bei „Über“)</p>
                <p className="pt-1 border-t border-white/5 text-gray-600">Kleinere Gewinnchance = höherer Multiplikator</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
