'use client';

import { useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { href: '/earn', icon: '➕', label: '+ Tokens' },
  { type: 'divider' as const },
  { href: '/crash', icon: '📈', label: 'Crash' },
  { href: '/coinflip', icon: '🪙', label: 'Coinflip' },
  { href: '/mines', icon: '💣', label: 'Mines' },
  { href: '/dice', icon: '🎲', label: 'Dice' },
  { href: '/plinko', icon: '🔴', label: 'Plinko' },
  { href: '/roulette', icon: '🎡', label: 'Roulette' },
  { href: '/slots', icon: '🍒', label: 'Slots' },
  { href: '/jackpot', icon: '🎰', label: 'Jackpot' },
  { href: '/blackjack', icon: '🃏', label: 'Blackjack' },
  { type: 'divider' as const },
  { href: '/giveaways', icon: '🎁', label: 'Giveaways' },
];

// Feste linke Sidebar fuer Desktop (lg+) -- ersetzt die alte horizontale Pillen-Leiste, die bei
// 11 Eintraegen in zwei haessliche, umgebrochene Zeilen quer ueber die volle Breite zerfiel.
// Auf mobilen Groessen bleibt GameNav (Pillen im Hamburger-Dropdown) die aktive Navigation --
// diese Sidebar ist bewusst "hidden lg:flex", damit auf schmalen Screens kein Platz verschenkt wird.
export default function Sidebar({ current }: { current: string }) {
  const router = useRouter();
  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-56 flex-col bg-black/40 backdrop-blur-xl border-r border-white/5">
      <div
        className="flex items-center gap-2 px-5 h-[65px] flex-shrink-0 border-b border-white/5 cursor-pointer"
        onClick={() => router.push('/dashboard')}
      >
        <span className="text-2xl">🫏</span>
        <h1 className="text-lg font-bold">
          <span className="glow-text">Esel</span><span className="text-amber-400">Tokens</span>
        </h1>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item, i) => {
          if ('type' in item && item.type === 'divider') {
            return <div key={`div-${i}`} className="h-px bg-white/5 my-2 mx-2" />;
          }
          const { href, icon, label } = item as { href: string; icon: string; label: string };
          const isCurrent = href === current;
          return (
            <button
              key={href}
              onClick={() => { if (!isCurrent) router.push(href); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
                isCurrent
                  ? 'bg-purple-500/20 border border-purple-500/30 text-purple-300 cursor-default'
                  : 'border border-transparent text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="text-base leading-none w-5 text-center flex-shrink-0">{icon}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
