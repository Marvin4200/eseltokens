'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiPath } from '@/lib/clientPaths';
import NotificationsBell from '@/components/NotificationsBell';
import GameNav from '@/components/GameNav';

const REEL_EMOJIS = ['🍒', '🍋', '🔔', '💎', '7️⃣', '🫏'];

export default function SlotsPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [bet, setBet] = useState(1);
  const [balance, setBalance] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState<string[]>(['🍒', '🍋', '🔔']);
  const [result, setResult] = useState<{ won: boolean; payout: number; multiplier: number } | null>(null);
  const [history, setHistory] = useState<Array<{ won: boolean; amount: number }>>([]);

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

    // Kurzes "durchlaufendes" Placeholder-Reel-Flackern waehrend die Anfrage laeuft,
    // die tatsaechlichen Symbole kommen erst mit der Server-Antwort.
    const spinInterval = setInterval(() => {
      setReels([
        REEL_EMOJIS[Math.floor(Math.random() * REEL_EMOJIS.length)],
        REEL_EMOJIS[Math.floor(Math.random() * REEL_EMOJIS.length)],
        REEL_EMOJIS[Math.floor(Math.random() * REEL_EMOJIS.length)],
      ]);
    }, 80);

    try {
      const res = await fetch(apiPath('/api/slots/spin'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: bet }),
      });
      const data = await res.json();
      if (!res.ok) { clearInterval(spinInterval); setSpinning(false); return; }

      setTimeout(() => {
        clearInterval(spinInterval);
        setReels(data.symbols);
        setResult({ won: data.won, payout: data.payout, multiplier: data.multiplier });
        setHistory(prev => [{ won: data.won, amount: data.won ? data.payout : data.bet }, ...prev].slice(0, 10));
        setBalance(data.newBalance);
        setSpinning(false);
        update();
      }, 900);
    } catch {
      clearInterval(spinInterval);
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
          <GameNav current="/slots" onNavigate={() => setMenuOpen(false)} />
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto w-full px-3 sm:px-4 py-2 flex-1 flex flex-col min-h-0">
        <div className="mb-2 hidden lg:flex items-center gap-3">
          <span className="text-3xl">🎰</span>
          <h1 className="text-2xl font-bold text-white">Slots</h1>
          <span className="text-gray-600 text-sm ml-2">3 gleiche Symbole = großer Gewinn!</span>
        </div>

        {history.length > 0 && (
          <div className="mb-1.5 flex-shrink-0 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <span className="text-xs text-gray-500 flex-shrink-0">{history.filter(h => h.won).length}W / {history.filter(h => !h.won).length}L</span>
            {history.map((h, i) => (
              <span key={i} className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg border ${
                h.won ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'
              }`}>
                {h.won ? `+${h.amount}` : `-${h.amount}`}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-2 lg:gap-4 flex-1 min-h-0">
          <div className="flex-1 min-h-0 lg:flex-[2]">
            <div className="game-card relative overflow-hidden flex flex-col items-center justify-center h-full p-4">
              <div className="flex gap-3 sm:gap-4 mb-4">
                {reels.map((emoji, i) => (
                  <div
                    key={i}
                    className={`w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border-2 flex items-center justify-center text-4xl sm:text-5xl transition-all duration-200 ${
                      spinning ? 'border-white/10 animate-pulse' : result?.won ? 'border-amber-500/50 scale-105' : 'border-white/10'
                    }`}
                  >
                    {emoji}
                  </div>
                ))}
              </div>

              {result && !spinning && (
                <div className={`text-center animate-result-pop ${result.won ? 'result-win' : 'result-lose'}`}>
                  <p className={`text-2xl sm:text-3xl font-black ${result.won ? 'text-amber-400' : 'text-red-400'}`}>
                    {result.won ? `🎉 ${result.multiplier}x!` : '💀 Nichts'}
                  </p>
                  {result.won && <p className="text-lg font-bold text-green-400">+{result.payout} Tokens</p>}
                </div>
              )}

              {!spinning && !result && (
                <p className="text-gray-600 text-sm mt-2">Platziere deinen Einsatz und dreh die Walzen!</p>
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
                    <span>🎰 SPIN! ({bet} 🪙)</span>
                  )}
                </button>

                {balance < 1 && (
                  <p className="text-red-400/70 text-xs text-center">Keine Tokens mehr!</p>
                )}
              </div>
            </div>

            <div className="game-card p-4 lg:flex-1 lg:min-h-0 hidden lg:flex flex-col">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Gewinntabelle</h3>
              <div className="text-xs text-gray-500 space-y-1">
                <p>🍒🍒🍒 2.59x &nbsp; 🍒🍒 0.86x</p>
                <p>🍋🍋🍋 4.31x &nbsp; 🍋🍋 1.29x</p>
                <p>🔔🔔🔔 6.9x &nbsp; 🔔🔔 1.72x</p>
                <p>💎💎💎 12.93x &nbsp; 💎💎 2.59x</p>
                <p>7️⃣7️⃣7️⃣ 34.49x &nbsp; 7️⃣7️⃣ 4.31x</p>
                <p>🫏🫏🫏 129.35x &nbsp; 🫏🫏 8.62x</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
