'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiPath } from '@/lib/clientPaths';

type Outcome = 'triple' | 'pair' | 'lose';

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '💎', '7️⃣'];
const VISIBLE_PER_REEL = 5; // more "fields" visible
const SPIN_MIN_MS = 1400;
const SPIN_MAX_MS = 2000;

interface SlotsResponse {
  bet: number;
  reels: [string, string, string];
  outcome: Outcome;
  matchedSymbol: string | null;
  payout: number;
  payoutPct: number;
  newBalance: number;
}

export default function SlotsPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [bet, setBet] = useState(10);
  const [balance, setBalance] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const [spinning, setSpinning] = useState(false);
  const [autoSpin, setAutoSpin] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  // Each reel is a "strip" of visible symbols. The payline is the center index.
  const [reelStrips, setReelStrips] = useState<[string[], string[], string[]]>([
    Array.from({ length: VISIBLE_PER_REEL }, () => '🍒'),
    Array.from({ length: VISIBLE_PER_REEL }, () => '🍒'),
    Array.from({ length: VISIBLE_PER_REEL }, () => '🍒'),
  ]);
  const [last, setLast] = useState<SlotsResponse | null>(null);
  const [history, setHistory] = useState<Array<{ outcome: Outcome; payout: number; bet: number }>>([]);

  const userRole = (session?.user as any)?.role;
  const initialLoadRef = useRef(true);
  const autoSpinRef = useRef(false);
  const spinTimeoutRef = useRef<number | null>(null);
  const stopSoundRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    if (status !== 'loading') initialLoadRef.current = false;
  }, [status]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      setTimeout(() => router.push('/'), 0);
    }
    if (status === 'authenticated' && userRole === 'pending') {
      setTimeout(() => router.push('/'), 0);
    }
  }, [status, userRole]);

  useEffect(() => {
    if (session && !spinning) {
      setBalance((session.user as any)?.balance ?? 0);
    }
  }, [session, spinning]);

  const canSpin = useMemo(() => !spinning && bet >= 1 && bet <= balance, [spinning, bet, balance]);

  const setQuickBet = (pct: number) => {
    setBet(Math.max(1, Math.floor(balance * pct)));
  };

  const randSymbol = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

  const makeStrip = (center: string) => {
    const strip = Array.from({ length: VISIBLE_PER_REEL }, () => randSymbol());
    strip[Math.floor(VISIBLE_PER_REEL / 2)] = center;
    return strip;
  };

  const beep = async (freq: number, ms: number, type: OscillatorType = 'sine', gain = 0.035) => {
    if (!soundOn) return null;
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = gain;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      const t = window.setTimeout(() => {
        try { o.stop(); } catch {}
        try { ctx.close(); } catch {}
      }, ms);
      return () => {
        window.clearTimeout(t);
        try { o.stop(); } catch {}
        try { ctx.close(); } catch {}
      };
    } catch {
      return null;
    }
  };

  const doSpin = async () => {
    if (!canSpin) return;

    setSpinning(true);
    setLast(null);

    // Start "spinning" animation by mutating strips quickly.
    const interval = window.setInterval(() => {
      setReelStrips([
        Array.from({ length: VISIBLE_PER_REEL }, () => randSymbol()),
        Array.from({ length: VISIBLE_PER_REEL }, () => randSymbol()),
        Array.from({ length: VISIBLE_PER_REEL }, () => randSymbol()),
      ]);
    }, 70);

    // Spin sound (continuous-ish), stopped once result is applied.
    stopSoundRef.current?.();
    stopSoundRef.current = (await beep(150, SPIN_MAX_MS + 300, 'square', 0.02)) || null;

    try {
      const res = await fetch(apiPath('/api/tokens/slots'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: bet }),
      });
      const data = (await res.json()) as SlotsResponse;
      if (!res.ok) {
        window.clearInterval(interval);
        setSpinning(false);
        stopSoundRef.current?.();
        return;
      }

      const wait = Math.floor(Math.random() * (SPIN_MAX_MS - SPIN_MIN_MS + 1)) + SPIN_MIN_MS;
      window.setTimeout(async () => {
        window.clearInterval(interval);
        stopSoundRef.current?.();

        setReelStrips([makeStrip(data.reels[0]), makeStrip(data.reels[1]), makeStrip(data.reels[2])]);
        setBalance(data.newBalance);
        setLast(data);
        setHistory(prev => [{ outcome: data.outcome, payout: data.payout, bet: data.bet }, ...prev].slice(0, 12));
        setSpinning(false);
        update();

        // Result sfx.
        if (data.payout > 0) {
          await beep(data.outcome === 'triple' ? 880 : 660, 140, 'triangle', 0.05);
          await beep(data.outcome === 'triple' ? 990 : 740, 120, 'triangle', 0.05);
        } else {
          await beep(220, 120, 'sawtooth', 0.03);
        }
      }, wait);
    } catch {
      window.clearInterval(interval);
      setSpinning(false);
      stopSoundRef.current?.();
    }
  };

  useEffect(() => {
    autoSpinRef.current = autoSpin;
    if (!autoSpin) {
      if (spinTimeoutRef.current) window.clearTimeout(spinTimeoutRef.current);
      spinTimeoutRef.current = null;
      return;
    }

    // kick
    if (!spinning && bet >= 1 && bet <= balance) {
      spinTimeoutRef.current = window.setTimeout(() => doSpin(), 250);
    }
  }, [autoSpin]);

  useEffect(() => {
    // Chain autospins when a spin finishes.
    if (!autoSpinRef.current) return;
    if (spinning) return;
    if (!(bet >= 1 && bet <= balance)) {
      setAutoSpin(false);
      return;
    }
    spinTimeoutRef.current = window.setTimeout(() => doSpin(), 650);
  }, [spinning, balance, bet]);

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) window.clearTimeout(spinTimeoutRef.current);
      stopSoundRef.current?.();
    };
  }, []);

  if (status === 'loading' && initialLoadRef.current) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session && initialLoadRef.current) return null;

  const resultText = last
    ? last.payout > 0
      ? `+${last.payout} Tokens`
      : `-${last.bet} Tokens`
    : null;

  const resultClass = last
    ? last.payout > 0
      ? 'text-green-400'
      : 'text-red-400'
    : 'text-gray-400';

  return (
    <div className="h-screen overflow-hidden relative flex flex-col" style={{ height: '100dvh' }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[650px] h-[650px] rounded-full bg-amber-500/7 blur-[160px] -top-72 -left-44" />
        <div className="absolute w-[520px] h-[520px] rounded-full bg-purple-600/7 blur-[160px] -bottom-72 -right-44" />
      </div>

      {/* Nav */}
      <nav className="relative z-30 border-b border-purple-500/10 bg-black/20 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer" onClick={() => router.push('/dashboard')}>
            <span className="text-xl sm:text-2xl">🫏</span>
            <h1 className="text-base sm:text-xl font-bold">
              <span className="glow-text">Esel</span>
              <span className="text-amber-400">Tokens</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
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
          <div className="bg-black/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
            <div className="max-w-6xl mx-auto">
              <p className="text-xs text-gray-600 uppercase tracking-widest mb-2">Navigation</p>
              <div className="grid grid-cols-6 gap-2">
                {[
                  { href: '/dashboard', icon: '🏠', label: 'Dashboard', current: false },
                  { href: '/crash', icon: '📈', label: 'Crash', current: false },
                  { href: '/coinflip', icon: '🪙', label: 'Coinflip', current: false },
                  { href: '/jackpot', icon: '🎰', label: 'Jackpot', current: false },
                  { href: '/blackjack', icon: '🃏', label: 'Blackjack', current: false },
                  { href: '/slots', icon: '🎰', label: 'Slots', current: true },
                ].map(item => (
                  <button
                    key={item.href}
                    onClick={() => {
                      setMenuOpen(false);
                      if (!item.current) router.push(item.href);
                    }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-xs ${
                      item.current
                        ? 'bg-purple-500/20 border border-purple-500/30 text-purple-300 cursor-default'
                        : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto w-full px-3 sm:px-4 py-3 flex-1 flex flex-col min-h-0">
        {/* Header + History */}
        <div className="mb-2 hidden lg:flex items-center gap-3">
          <span className="text-3xl">🎰</span>
          <h1 className="text-2xl font-bold text-white">Slots</h1>
          <span className="text-gray-600 text-sm ml-2">3 Walzen, Pair oder Triple</span>
        </div>

        {history.length > 0 && (
          <div className="mb-2 flex-shrink-0 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <span className="text-xs text-gray-500 flex-shrink-0">
              {history.filter(h => h.payout > 0).length}W / {history.filter(h => h.payout <= 0).length}L
            </span>
            {history.map((h, i) => (
              <span
                key={i}
                className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg border ${
                  h.payout > 0
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                }`}
              >
                {h.payout > 0 ? `+${h.payout}` : `-${h.bet}`}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-2 lg:gap-4 flex-1 min-h-0">
          <div className="flex-1 min-h-0 lg:flex-[2]">
            <div className="game-card relative overflow-hidden h-full flex flex-col items-center justify-center">
              <div className="relative">
                <div className={`absolute -inset-10 rounded-full blur-[80px] ${spinning ? 'bg-amber-500/12' : last && last.payout > 0 ? 'bg-green-500/12' : 'bg-purple-500/10'}`} />
                <div className="relative slots-frame">
                  <div className="slots-payline" aria-hidden="true" />
                  {reelStrips.map((strip, idx) => {
                    const centerIdx = Math.floor(VISIBLE_PER_REEL / 2);
                    return (
                      <div key={idx} className={`slots-col slots-col-tall ${spinning ? 'slots-reel-spin' : ''}`}>
                        {strip.map((sym, i) => (
                          <div
                            key={i}
                            className={`slots-cell ${i === centerIdx ? 'slots-cell-center' : 'slots-cell-dim'}`}
                          >
                            {sym}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 text-center">
                {resultText ? (
                  <p className={`text-2xl sm:text-3xl font-black animate-result-pop ${resultClass}`}>{resultText}</p>
                ) : (
                  <p className="text-sm text-gray-500">Pair (links) zahlt klein, Triple zahlt fett.</p>
                )}
                {last && last.payout > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {last.outcome.toUpperCase()} {last.matchedSymbol ? `(${last.matchedSymbol})` : ''} · {last.payoutPct}% Payout
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="lg:w-[360px] flex flex-col gap-2">
            <div className="game-card p-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Einsatz</p>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setQuickBet(0.25)} className="btn-chip flex-1">25%</button>
                <button onClick={() => setQuickBet(0.5)} className="btn-chip flex-1">50%</button>
                <button onClick={() => setBet(Math.max(1, balance))} className="btn-chip flex-1">Max</button>
              </div>
              <input
                type="number"
                min={1}
                max={balance}
                value={bet}
                onChange={e => setBet(Math.max(1, Math.min(balance || 999999, parseInt(e.target.value) || 1)))}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-lg outline-none focus:border-purple-500/40"
              />

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAutoSpin(v => !v)}
                  disabled={balance < 1 || bet < 1}
                  className={`btn-chip ${autoSpin ? 'border-amber-400/40 text-amber-200 bg-amber-500/10' : ''}`}
                >
                  {autoSpin ? 'AutoSpin: ON' : 'AutoSpin'}
                </button>
                <button
                  onClick={() => setSoundOn(v => !v)}
                  className={`btn-chip ${soundOn ? '' : 'border-red-500/30 text-red-300 bg-red-500/10'}`}
                  title="Sound an/aus"
                >
                  {soundOn ? 'Sound: ON' : 'Sound: OFF'}
                </button>
              </div>

              <button
                onClick={doSpin}
                disabled={!canSpin}
                className={`w-full mt-3 btn-primary ${spinning ? 'opacity-80' : ''}`}
              >
                {spinning ? 'Spinning...' : 'SPIN'}
              </button>
              {balance < 1 && <p className="text-red-400/70 text-xs text-center mt-2">Keine Tokens mehr!</p>}
            </div>

            <div className="game-card p-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Paytable</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  <span>🍒🍒</span><span className="text-amber-300 font-bold">1.1x</span>
                </div>
                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  <span>🍒🍒🍒</span><span className="text-amber-300 font-bold">4x</span>
                </div>
                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  <span>💎💎</span><span className="text-amber-300 font-bold">1.5x</span>
                </div>
                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  <span>💎💎💎</span><span className="text-amber-300 font-bold">16x</span>
                </div>
                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  <span>7️⃣7️⃣</span><span className="text-amber-300 font-bold">1.8x</span>
                </div>
                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  <span>7️⃣7️⃣7️⃣</span><span className="text-amber-300 font-bold">42x</span>
                </div>
              </div>
              <p className="text-[11px] text-gray-600 mt-3">Payouts sind als Credit-Multiplikator auf deinen Einsatz gerechnet.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
