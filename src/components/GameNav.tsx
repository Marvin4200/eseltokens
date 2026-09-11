'use client';

import { useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { href: '/earn', icon: '➕', label: '+ Tokens' },
  { href: '/crash', icon: '📈', label: 'Crash' },
  { href: '/coinflip', icon: '🪙', label: 'Coinflip' },
  { href: '/mines', icon: '💣', label: 'Mines' },
  { href: '/dice', icon: '🎲', label: 'Dice' },
  { href: '/plinko', icon: '🔴', label: 'Plinko' },
  { href: '/roulette', icon: '🎡', label: 'Roulette' },
  { href: '/slots', icon: '🍒', label: 'Slots' },
  { href: '/jackpot', icon: '🎰', label: 'Jackpot' },
  { href: '/blackjack', icon: '🃏', label: 'Blackjack' },
  { href: '/giveaways', icon: '🎁', label: 'Giveaways' },
];

// Zentrale Spiele-Navigation -- vorher hatte jede Seite (dashboard/crash/blackjack/jackpot/
// coinflip/earn) ihr eigenes fest verdrahtetes grid-cols-6-Array kopiert. Das driftete
// auseinander (dashboard fehlte z.B. der Giveaways-Eintrag) und die feste Spaltenzahl brach
// bei 7 Eintraegen in eine haessliche letzte Zeile mit nur einem Element um. flex-wrap mit
// Pillen statt fixem Grid skaliert unabhaengig von der Anzahl der Eintraege sauber mit.
export default function GameNav({ current, onNavigate }: { current: string; onNavigate?: () => void }) {
  const router = useRouter();
  return (
    <div className="bg-black/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
      <div className="max-w-6xl mx-auto">
        <p className="text-xs text-gray-600 uppercase tracking-widest mb-2">Navigation</p>
        <div className="flex flex-wrap gap-2">
          {NAV_ITEMS.map((item) => {
            const isCurrent = item.href === current;
            return (
              <button
                key={item.href}
                onClick={() => { onNavigate?.(); if (!isCurrent) router.push(item.href); }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-full transition-all text-sm font-medium ${
                  isCurrent
                    ? 'bg-purple-500/20 border border-purple-500/30 text-purple-300 cursor-default'
                    : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
