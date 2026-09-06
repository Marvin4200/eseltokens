'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiPath } from '@/lib/clientPaths';

interface Slot {
  key: string;
  enabled: boolean;
  mode: 'house' | 'adsense' | 'custom' | 'off';
  title: string | null;
  description: string | null;
  imageEmoji: string | null;
  linkUrl: string | null;
  ctaText: string | null;
  badgeText: string | null;
  networkClient: string | null;
  networkSlotId: string | null;
  updatedAt: string;
  stats: { impressions: number; clicks: number };
}

const MODE_LABELS: Record<string, string> = {
  house: 'Eigenwerbung (House Ad)',
  adsense: 'Google AdSense (noch nicht angebunden)',
  custom: 'Eigenes Netzwerk (noch nicht angebunden)',
  off: 'Aus',
};

export default function AdsAdmin() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const userRole = (session?.user as any)?.role;
  const [slots, setSlots] = useState<Slot[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated' || (status === 'authenticated' && userRole !== 'admin')) {
      setTimeout(() => { router.push('/'); }, 0);
    }
  }, [status, userRole]);

  useEffect(() => {
    if (userRole === 'admin') fetchSlots();
  }, [userRole]);

  const fetchSlots = async () => {
    const res = await fetch(apiPath('/api/admin/ads/slots'));
    const data = await res.json();
    setSlots(Array.isArray(data) ? data : []);
  };

  const patch = (key: string, field: keyof Slot, value: any) => {
    setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, [field]: value } : s)));
  };

  const save = async (slot: Slot) => {
    setSaving(slot.key);
    try {
      await fetch(apiPath('/api/admin/ads/update'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slot),
      });
      setMsg(`„${slot.key}“ gespeichert.`);
      await fetchSlots();
    } finally {
      setSaving(null);
      setTimeout(() => setMsg(null), 3000);
    }
  };

  const addSlot = async () => {
    const key = newKey.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/.test(key)) {
      setMsg('Ungültiger Slot-Key (nur a-z, 0-9, "-").');
      return;
    }
    await fetch(apiPath('/api/admin/ads/update'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, enabled: false, mode: 'off', badgeText: 'Anzeige' }),
    });
    setNewKey('');
    fetchSlots();
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session || userRole !== 'admin') return null;

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/8 blur-[150px] -top-40 -left-40" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-amber-500/5 blur-[120px] -bottom-32 -right-32" />
      </div>

      <nav className="relative z-10 border-b border-purple-500/10 bg-black/20 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/admin')}>
            <span className="text-2xl">🫏</span>
            <h1 className="text-xl font-bold">
              <span className="glow-text">Esel</span><span className="text-amber-400">Tokens</span>
            </h1>
          </div>
          <button
            onClick={() => router.push('/admin')}
            className="text-sm px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all"
          >
            ← Admin Panel
          </button>
        </div>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">📢</span>
            <h1 className="text-3xl font-bold text-white">Anzeigen-Slots</h1>
          </div>
          <p className="text-gray-500">
            Zentral verwalten, wo und was beworben wird — landing page &amp; EselTokens, ohne Deploy.
          </p>
          {msg && <p className="text-sm text-purple-300 mt-2">{msg}</p>}
        </div>

        <div className="space-y-5">
          {slots.map((slot) => (
            <div key={slot.key} className="game-card p-5 sm:p-6 animate-fade-in-up">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <code className="text-sm font-mono text-purple-300 bg-white/5 px-2 py-1 rounded-md border border-white/10">
                    {slot.key}
                  </code>
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={slot.enabled}
                      onChange={(e) => patch(slot.key, 'enabled', e.target.checked)}
                      className="w-4 h-4 accent-purple-500"
                    />
                    <span className={`text-sm font-medium ${slot.enabled ? 'text-green-400' : 'text-gray-500'}`}>
                      {slot.enabled ? 'Aktiv' : 'Aus'}
                    </span>
                  </label>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>👁 {slot.stats.impressions} Impressions</span>
                  <span>🖱 {slot.stats.clicks} Klicks</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Modus</label>
                  <select
                    value={slot.mode}
                    onChange={(e) => patch(slot.key, 'mode', e.target.value)}
                    className="game-select text-sm w-full"
                  >
                    {Object.entries(MODE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Badge-Text</label>
                  <input
                    type="text"
                    value={slot.badgeText || ''}
                    onChange={(e) => patch(slot.key, 'badgeText', e.target.value)}
                    className="game-input text-sm w-full"
                    placeholder="Anzeige"
                  />
                </div>
              </div>

              {slot.mode === 'house' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Emoji</label>
                    <input
                      type="text"
                      value={slot.imageEmoji || ''}
                      onChange={(e) => patch(slot.key, 'imageEmoji', e.target.value)}
                      className="game-input text-sm w-full"
                      placeholder="🚀"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Titel</label>
                    <input
                      type="text"
                      value={slot.title || ''}
                      onChange={(e) => patch(slot.key, 'title', e.target.value)}
                      className="game-input text-sm w-full"
                      placeholder="Fahrstuhl Premium"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Beschreibung</label>
                    <input
                      type="text"
                      value={slot.description || ''}
                      onChange={(e) => patch(slot.key, 'description', e.target.value)}
                      className="game-input text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Link</label>
                    <input
                      type="text"
                      value={slot.linkUrl || ''}
                      onChange={(e) => patch(slot.key, 'linkUrl', e.target.value)}
                      className="game-input text-sm w-full"
                      placeholder="https://shop.eselbande.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Button-Text</label>
                    <input
                      type="text"
                      value={slot.ctaText || ''}
                      onChange={(e) => patch(slot.key, 'ctaText', e.target.value)}
                      className="game-input text-sm w-full"
                      placeholder="Jetzt entdecken →"
                    />
                  </div>
                </div>
              )}

              {(slot.mode === 'adsense' || slot.mode === 'custom') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 p-3 rounded-xl bg-amber-500/[0.04] border border-amber-500/10">
                  <p className="sm:col-span-2 text-xs text-amber-300/80">
                    Noch nicht live: Der Slot rendert erst etwas, sobald das Netzwerk technisch angebunden ist. Diese Felder sind schon vorbereitet.
                  </p>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Client-ID</label>
                    <input
                      type="text"
                      value={slot.networkClient || ''}
                      onChange={(e) => patch(slot.key, 'networkClient', e.target.value)}
                      className="game-input text-sm w-full"
                      placeholder="ca-pub-..."
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Slot-ID</label>
                    <input
                      type="text"
                      value={slot.networkSlotId || ''}
                      onChange={(e) => patch(slot.key, 'networkSlotId', e.target.value)}
                      className="game-input text-sm w-full"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => save(slot)}
                  disabled={saving === slot.key}
                  className="text-sm font-semibold px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-200 hover:bg-purple-500/30 transition-all disabled:opacity-50"
                >
                  {saving === slot.key ? 'Speichert…' : 'Speichern'}
                </button>
              </div>
            </div>
          ))}

          {slots.length === 0 && (
            <p className="text-gray-600 text-center py-12">Noch keine Slots konfiguriert.</p>
          )}

          <div className="game-card p-5 sm:p-6">
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Neuen Slot anlegen</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="z.B. landing-footer"
                className="game-input text-sm flex-1"
              />
              <button
                onClick={addSlot}
                className="text-sm font-semibold px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all"
              >
                Anlegen
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Ein Slot muss zusätzlich per Code an der gewünschten Stelle eingebunden werden (z.B. &lt;AdSlot slotKey=&quot;...&quot;/&gt;).
              Slots, die im Code bereits verwendet werden, tauchen hier automatisch beim ersten Aufruf auf.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
