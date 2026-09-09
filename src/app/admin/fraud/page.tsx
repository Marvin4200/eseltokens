'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiPath } from '@/lib/clientPaths';

interface FunnelingPair {
  fromUserId: number; toUserId: number; fromUsername: string; toUsername: string;
  transferCount: number; totalAmount: number; lastAt: string;
}
interface PingPongPair {
  userA: number; userB: number; userAName: string; userBName: string;
  forwardCount: number; forwardAmount: number; backwardCount: number; backwardAmount: number;
}
interface FreshBigReceiver {
  userId: number; username: string; createdAt: string; receivedAmount: number; receivedCount: number;
}
interface HubReceiver {
  userId: number; username: string; distinctSenders: number; totalAmount: number;
}
interface FraudSignals {
  windowDays: number;
  funnelingPairs: FunnelingPair[];
  pingPongPairs: PingPongPair[];
  freshBigReceivers: FreshBigReceiver[];
  hubReceivers: HubReceiver[];
}

export default function FraudDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<FraudSignals | null>(null);
  const [loading, setLoading] = useState(true);
  const userRole = (session?.user as any)?.role;

  useEffect(() => {
    if (status === 'unauthenticated') {
      setTimeout(() => { router.push('/'); }, 0);
    }
    if (status === 'authenticated' && userRole !== 'moderator' && userRole !== 'admin') {
      setTimeout(() => { router.push('/dashboard'); }, 0);
    }
  }, [status, userRole]);

  useEffect(() => {
    if (userRole === 'moderator' || userRole === 'admin') {
      fetch(apiPath('/api/admin/fraud-signals'))
        .then((r) => r.json())
        .then(setData)
        .finally(() => setLoading(false));
    }
  }, [userRole]);

  if (status === 'loading' || (userRole && loading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session || (userRole !== 'moderator' && userRole !== 'admin')) return null;

  const totalSignals =
    (data?.funnelingPairs.length || 0) +
    (data?.pingPongPairs.length || 0) +
    (data?.freshBigReceivers.length || 0) +
    (data?.hubReceivers.length || 0);

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-red-600/8 blur-[150px] -top-40 -left-40" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-purple-500/5 blur-[120px] -bottom-32 -right-32" />
      </div>

      <nav className="relative z-10 border-b border-purple-500/10 bg-black/20 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/dashboard')}>
            <span className="text-2xl">🫏</span>
            <h1 className="text-xl font-bold">
              <span className="glow-text">Esel</span><span className="text-amber-400">Tokens</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {userRole === 'admin' && (
              <button
                onClick={() => router.push('/admin')}
                className="text-sm px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all"
              >
                Admin Panel
              </button>
            )}
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all"
            >
              ← Dashboard
            </button>
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🚨</span>
            <h1 className="text-3xl font-bold text-white">Anti-Fraud Signale</h1>
          </div>
          <p className="text-gray-500">
            Automatisch erkannte, auffaellige Token-Transfermuster der letzten {data?.windowDays ?? 7} Tage.
            Kein automatisches Enforcement -- nur Hinweise zum manuellen Nachschauen.
          </p>
        </div>

        {totalSignals === 0 && (
          <div className="game-card p-6 text-center text-gray-500">
            Keine auffaelligen Muster gefunden. ✅
          </div>
        )}

        {!!data?.funnelingPairs.length && (
          <Section title="🔁 Haeufige/grosse Transfers zwischen zwei Accounts" subtitle="Moegliches Reward-Abuse oder Alt-Account-Farming">
            <Table
              headers={['Von', 'An', 'Anzahl', 'Summe', 'Zuletzt']}
              rows={data.funnelingPairs.map((p) => [
                p.fromUsername, p.toUsername, p.transferCount, `${p.totalAmount.toLocaleString('de-DE')} 🪙`, p.lastAt,
              ])}
            />
          </Section>
        )}

        {!!data?.pingPongPairs.length && (
          <Section title="↔️ Hin- und Her-Transfers (Ping-Pong)" subtitle="Tokens fliessen in beide Richtungen zwischen denselben Accounts">
            <Table
              headers={['User A', 'User B', 'A→B', 'A→B Summe', 'B→A', 'B→A Summe']}
              rows={data.pingPongPairs.map((p) => [
                p.userAName, p.userBName, p.forwardCount, `${p.forwardAmount.toLocaleString('de-DE')} 🪙`,
                p.backwardCount, `${p.backwardAmount.toLocaleString('de-DE')} 🪙`,
              ])}
            />
          </Section>
        )}

        {!!data?.freshBigReceivers.length && (
          <Section title="🆕 Neue Accounts mit hohen Eingaengen" subtitle="Account &lt; 3 Tage alt, hat aber schon viel per Transfer erhalten">
            <Table
              headers={['User', 'Erstellt', 'Erhalten (Anzahl)', 'Erhalten (Summe)']}
              rows={data.freshBigReceivers.map((u) => [
                u.username, u.createdAt, u.receivedCount, `${u.receivedAmount.toLocaleString('de-DE')} 🪙`,
              ])}
            />
          </Section>
        )}

        {!!data?.hubReceivers.length && (
          <Section title="🕸️ Sammel-Accounts" subtitle="Ein Account bekommt Transfers von vielen verschiedenen Absendern">
            <Table
              headers={['User', 'Verschiedene Absender', 'Summe erhalten']}
              rows={data.hubReceivers.map((u) => [
                u.username, u.distinctSenders, `${u.totalAmount.toLocaleString('de-DE')} 🪙`,
              ])}
            />
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="game-card p-6 mb-6 animate-fade-in-up">
      <h2 className="text-lg font-bold text-white mb-1">{title}</h2>
      <p className="text-xs text-gray-500 mb-4">{subtitle}</p>
      {children}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-white/10">
            {headers.map((h) => (
              <th key={h} className="pb-2 pr-4">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/[0.03]">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-4 text-gray-300">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
