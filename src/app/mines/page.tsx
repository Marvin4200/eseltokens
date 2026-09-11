'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiPath } from '@/lib/clientPaths';
import NotificationsBell from '@/components/NotificationsBell';
import GameNav from '@/components/GameNav';

const GRID_SIZE = 25;
const MINE_OPTIONS = [1, 3, 5, 10];

type TileState = 'hidden' | 'safe' | 'mine';

export default function MinesPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [bet, setBet] = useState(1);
  const [mineCount, setMineCount] = useState(5);
  const [balance, setBalance] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const [gameId, setGameId] = useState<number | null>(null);
  const [tiles, setTiles] = useState<TileState[]>(Array(GRID_SIZE).fill('hidden'));
  const [revealedCount, setRevealedCount] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [busy, setBusy] = useState(false);
  const [busted, setBusted] = useState(false);
  const [lastResult, setLastResult] = useState<{ won: boolean; amount: number } | null>(null);
  const [history, setHistory] = useState<Array<{ won: boolean; amount: number }>>([]);

  const userRole = (session?.user as any)?.role;
  const inGame = gameId !== null;
  const safeTiles = GRID_SIZE - mineCount;
  const nextMultiplier = inGame
    ? Math.round(computeMultiplierClient(GRID_SIZE, mineCount, revealedCount + 1) * 10000) / 10000
    : 1;

  useEffect(() => {
    if (status !== 'loading') setInitialLoad(false);
  }, [status]);

  useEffect(() => {
    if (status === 'unauthenticated') setTimeout(() => router.push('/'), 0);
    if (status === 'authenticated' && userRole === 'pending') setTimeout(() => router.push('/'), 0);
  }, [status, userRole]);

  useEffect(() => {
    if (session && !inGame) setBalance((session.user as any)?.balance ?? 0);
  }, [session]);

  const resetBoard = () => {
    setTiles(Array(GRID_SIZE).fill('hidden'));
    setRevealedCount(0);
    setMultiplier(1);
    setBusted(false);
    setLastResult(null);
  };

  const startGame = async () => {
    if (busy || inGame || bet < 1 || bet > balance) return;
    setBusy(true);
    try {
      const res = await fetch(apiPath('/api/mines/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: bet, mines: mineCount }),
      });
      const data = await res.json();
      if (!res.ok) { setBusy(false); return; }
      resetBoard();
      setGameId(data.gameId);
      setBalance(data.newBalance);
    } finally {
      setBusy(false);
    }
  };

  const revealTile = async (tile: number) => {
    if (busy || !inGame || tiles[tile] !== 'hidden') return;
    setBusy(true);
    try {
      const res = await fetch(apiPath('/api/mines/reveal'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, tile }),
      });
      const data = await res.json();
      if (!res.ok) { setBusy(false); return; }

      if (data.busted) {
        const revealedMines = new Set(data.minePositions as number[]);
        setTiles(prev => prev.map((t, i) => (i === tile ? 'mine' : revealedMines.has(i) ? 'mine' : t)));
        setBusted(true);
        setLastResult({ won: false, amount: 0 });
        setHistory(prev => [{ won: false, amount: 0 }, ...prev].slice(0, 10));
        setTimeout(() => { setGameId(null); update(); }, 1800);
        return;
      }

      setTiles(prev => prev.map((t, i) => (i === tile ? 'safe' : t)));
      setRevealedCount(data.revealedTiles.length);
      setMultiplier(data.multiplier);

      if (data.cleared) {
        setLastResult({ won: true, amount: data.payout });
        setHistory(prev => [{ won: true, amount: data.payout }, ...prev].slice(0, 10));
        setBalance(data.newBalance);
        setTimeout(() => { setGameId(null); update(); }, 1800);
      }
    } finally {
      setBusy(false);
    }
  };

  const cashOut = async () => {
    if (busy || !inGame || revealedCount === 0) return;
    setBusy(true);
    try {
      const res = await fetch(apiPath('/api/mines/cashout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId }),
      });
      const data = await res.json();
      if (!res.ok) { setBusy(false); return; }
      setLastResult({ won: true, amount: data.payout });
      setHistory(prev => [{ won: true, amount: data.payout }, ...prev].slice(0, 10));
      setBalance(data.newBalance);
      setTimeout(() => { setGameId(null); update(); }, 1200);
    } finally {
      setBusy(false);
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
          <GameNav current="/mines" onNavigate={() => setMenuOpen(false)} />
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto w-full px-3 sm:px-4 py-2 flex-1 flex flex-col min-h-0">
        <div className="mb-2 hidden lg:flex items-center gap-3">
          <span className="text-3xl">💣</span>
          <h1 className="text-2xl font-bold text-white">Mines</h1>
          <span className="text-gray-600 text-sm ml-2">Deck sichere Felder auf, cash aus bevor es knallt!</span>
        </div>

        {history.length > 0 && (
          <div className="mb-1.5 flex-shrink-0 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <span className="text-xs text-gray-500 flex-shrink-0">{history.filter(h => h.won).length}W / {history.filter(h => !h.won).length}L</span>
            {history.map((h, i) => (
              <span key={i} className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg border ${
                h.won ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'
              }`}>
                {h.won ? `+${h.amount}` : 'Bust'}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-2 lg:gap-4 flex-1 min-h-0">
          <div className="flex-1 min-h-0 lg:flex-[2]">
            <div className="game-card relative overflow-hidden flex flex-col items-center justify-center h-full p-4">
              {inGame && (
                <div className="mb-3 text-center">
                  <p className="text-3xl font-black text-amber-400">{multiplier.toFixed(4)}x</p>
                  <p className="text-xs text-gray-500">{revealedCount} / {safeTiles} sicher · nächstes Feld: {nextMultiplier.toFixed(4)}x</p>
                </div>
              )}

              <div className="grid grid-cols-5 gap-2 w-full max-w-[420px] aspect-square">
                {tiles.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => revealTile(i)}
                    disabled={busy || !inGame || t !== 'hidden'}
                    className={`aspect-square rounded-lg border text-xl sm:text-2xl flex items-center justify-center transition-all duration-200 ${
                      t === 'hidden'
                        ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-purple-500/30 disabled:hover:bg-white/5 disabled:cursor-not-allowed'
                        : t === 'safe'
                          ? 'bg-green-500/20 border-green-500/40 scale-95'
                          : 'bg-red-500/20 border-red-500/40 scale-95'
                    }`}
                  >
                    {t === 'safe' && '🫏'}
                    {t === 'mine' && '💣'}
                  </button>
                ))}
              </div>

              {lastResult && (
                <div className={`mt-3 text-center animate-result-pop ${lastResult.won ? 'result-win' : 'result-lose'}`}>
                  <p className={`text-2xl font-black ${lastResult.won ? 'text-amber-400' : 'text-red-400'}`}>
                    {lastResult.won ? '🎉 GEWONNEN!' : '💥 BOOM!'}
                  </p>
                  {lastResult.won && <p className="text-lg font-bold text-green-400">+{lastResult.amount} Tokens</p>}
                </div>
              )}

              {!inGame && !lastResult && (
                <p className="text-gray-600 text-sm mt-3">Wähle Einsatz & Minenanzahl und starte das Spiel!</p>
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
                    disabled={inGame || bet <= 1}
                    className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all disabled:opacity-30 font-bold text-lg flex-shrink-0"
                  >−</button>
                  <input
                    type="number"
                    min={1}
                    max={balance}
                    value={bet}
                    onChange={(e) => setBet(Math.max(1, Math.min(balance, parseInt(e.target.value) || 1)))}
                    disabled={inGame}
                    className="game-input flex-1 text-center text-lg font-bold"
                  />
                  <button
                    onClick={() => setBet(Math.min(balance, bet + 1))}
                    disabled={inGame || bet >= balance}
                    className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all disabled:opacity-30 font-bold text-lg flex-shrink-0"
                  >+</button>
                </div>

                <div className="flex gap-2">
                  {[{ label: 'Min', pct: 0 }, { label: '25%', pct: 0.25 }, { label: '50%', pct: 0.5 }, { label: 'Max', pct: 1 }].map(({ label, pct }) => (
                    <button
                      key={label}
                      onClick={() => pct === 0 ? setBet(1) : setQuickBet(pct)}
                      disabled={inGame}
                      className="flex-1 text-xs py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all disabled:opacity-30"
                    >{label}</button>
                  ))}
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Minen</p>
                  <div className="flex gap-2">
                    {MINE_OPTIONS.map((n) => (
                      <button
                        key={n}
                        onClick={() => setMineCount(n)}
                        disabled={inGame}
                        className={`flex-1 text-sm py-1.5 rounded-lg border transition-all disabled:opacity-30 ${
                          mineCount === n
                            ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                        }`}
                      >💣{n}</button>
                    ))}
                  </div>
                </div>

                {!inGame ? (
                  <button
                    onClick={startGame}
                    disabled={busy || balance < 1 || bet > balance}
                    className="w-full py-3 rounded-xl font-black text-lg transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed btn-coinflip"
                  >
                    💣 SPIEL STARTEN ({bet} 🪙)
                  </button>
                ) : (
                  <button
                    onClick={cashOut}
                    disabled={busy || revealedCount === 0 || busted}
                    className="w-full py-3 rounded-xl font-black text-lg transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-r from-green-500 to-emerald-500 text-black hover:brightness-110"
                  >
                    💰 CASH OUT ({Math.floor(bet * multiplier)} 🪙)
                  </button>
                )}

                {balance < 1 && !inGame && (
                  <p className="text-red-400/70 text-xs text-center">Keine Tokens mehr!</p>
                )}
              </div>
            </div>

            <div className="game-card p-4 lg:flex-1 lg:min-h-0 hidden lg:flex flex-col">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Regeln</h3>
              <div className="text-xs text-gray-500 space-y-1.5">
                <p>🫏 Sicheres Feld = Multiplikator steigt</p>
                <p>💣 Mine = Einsatz verloren</p>
                <p>💰 Jederzeit auszahlen lassen, solange mind. 1 Feld aufgedeckt ist</p>
                <p className="pt-1 border-t border-white/5 text-gray-600">Mehr Minen = höheres Risiko, höherer Multiplikator</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Muss exakt mit src/lib/mines.js computeMultiplier() uebereinstimmen -- nur fuer die
// "naechstes Feld"-Vorschau im UI, die eigentliche Auszahlung kommt immer vom Server.
function computeMultiplierClient(gridSize: number, mineCount: number, revealedCount: number) {
  if (revealedCount <= 0) return 1;
  const safeTiles = gridSize - mineCount;
  let mult = 1;
  for (let i = 0; i < revealedCount; i++) {
    mult *= (gridSize - i) / (safeTiles - i);
  }
  return mult * 0.97;
}
