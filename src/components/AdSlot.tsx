'use client';

import { useEffect, useRef, useState } from 'react';
import { apiPath } from '@/lib/clientPaths';

interface HouseAd {
  title: string;
  description: string;
  imageEmoji: string;
  linkUrl: string;
  ctaText: string;
  badgeText: string;
}

interface NetworkAd {
  client: string | null;
  slotId: string | null;
}

interface SlotResponse {
  key: string;
  enabled: boolean;
  mode?: 'house' | 'adsense' | 'custom' | 'off';
  house?: HouseAd;
  network?: NetworkAd;
}

function track(slotKey: string, type: 'impression' | 'click') {
  try {
    fetch(apiPath('/api/ads/event'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotKey,
        type,
        page: typeof window !== 'undefined' ? window.location.pathname : null,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* best-effort only */
  }
}

/**
 * Renders one centrally-managed ad slot. Defaults to a self-promo "house ad"
 * for our own products (shop.eselbande.com). The `mode` branch is already in
 * place for a real ad network later — flip a slot's mode in /admin/ads and add
 * networkClient/networkSlotId there; only the branch below needs to grow with it.
 */
export default function AdSlot({ slotKey, className = '' }: { slotKey: string; className?: string }) {
  const [data, setData] = useState<SlotResponse | null>(null);
  const trackedImpression = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch(apiPath(`/api/ads/slot/${slotKey}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slotKey]);

  useEffect(() => {
    if (data?.enabled && data.mode === 'house' && data.house && !trackedImpression.current) {
      trackedImpression.current = true;
      track(slotKey, 'impression');
    }
  }, [data, slotKey]);

  if (!data || !data.enabled) return null;

  if (data.mode === 'adsense' || data.mode === 'custom') {
    // Reserved for a real ad network — not wired up yet, so render nothing rather
    // than a broken/empty box. Extend this branch once a network is integrated.
    return null;
  }

  const house = data.house;
  if (!house?.title) return null;

  return (
    <div className={`game-card p-5 sm:p-6 relative overflow-hidden ${className}`} data-ad-slot={slotKey}>
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/10 rounded-full blur-[50px] pointer-events-none" />
      <div className="relative flex items-center gap-4 flex-wrap sm:flex-nowrap">
        <div className="w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center text-2xl flex-shrink-0">
          {house.imageEmoji}
        </div>
        <div className="flex-1 min-w-0">
          <span className="inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-gray-500 border border-white/10 mb-1">
            {house.badgeText}
          </span>
          <p className="font-semibold text-white text-sm sm:text-base truncate">{house.title}</p>
          {house.description && (
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 line-clamp-2">{house.description}</p>
          )}
        </div>
        {house.linkUrl && (
          <a
            href={house.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track(slotKey, 'click')}
            className="flex-shrink-0 text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-amber-500/20 border border-purple-500/30 text-purple-200 hover:from-purple-500/30 hover:to-amber-500/30 transition-all whitespace-nowrap"
          >
            {house.ctaText}
          </a>
        )}
      </div>
    </div>
  );
}
