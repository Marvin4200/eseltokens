'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiPath } from '@/lib/clientPaths';

interface Achievement {
  key: string;
  category: string;
  icon: string;
  label: string;
  unlocked: boolean;
  progress: number;
}

export default function Achievements() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      setTimeout(() => { router.push('/'); }, 0);
    }
  }, [status]);

  useEffect(() => {
    if (session) {
      fetch(apiPath('/api/tokens/achievements'))
        .then((r) => r.json())
        .then((data) => {
          setAchievements(data.achievements ?? []);
          setUnlockedCount(data.unlockedCount ?? 0);
          setTotalCount(data.totalCount ?? 0);
        })
        .finally(() => setLoading(false));
    }
  }, [session]);

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  const categories = Array.from(new Set(achievements.map((a) => a.category)));

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-amber-600/8 blur-[150px] -top-40 -left-40" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-purple-500/5 blur-[120px] -bottom-32 -right-32" />
      </div>

      <nav className="relative z-10 border-b border-purple-500/10 bg-black/20 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/dashboard')}>
            <span className="text-2xl">🫏</span>
            <h1 className="text-xl font-bold">
              <span className="glow-text">Esel</span><span className="text-amber-400">Tokens</span>
            </h1>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all"
          >
            ← Dashboard
          </button>
        </div>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🏅</span>
            <h1 className="text-3xl font-bold text-white">Achievements</h1>
          </div>
          <p className="text-gray-500">
            {unlockedCount} von {totalCount} freigeschaltet
          </p>
          <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden max-w-md">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-purple-500 transition-all"
              style={{ width: `${totalCount ? (unlockedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>

        {categories.map((category) => (
          <div key={category} className="mb-6 animate-fade-in-up">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">{category}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {achievements.filter((a) => a.category === category).map((a) => (
                <div
                  key={a.key}
                  className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                    a.unlocked
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-white/[0.02] border-white/[0.05] opacity-60'
                  }`}
                >
                  <span className="text-2xl flex-shrink-0">{a.unlocked ? a.icon : '🔒'}</span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium ${a.unlocked ? 'text-white' : 'text-gray-500'}`}>
                      {a.label}
                    </div>
                    {!a.unlocked && (
                      <div className="mt-1.5 h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full bg-gray-500 transition-all"
                          style={{ width: `${a.progress * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
