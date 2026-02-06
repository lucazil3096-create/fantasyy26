'use client';

import { useEffect, useState } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useStore } from '@/store/useStore';

interface RankEntry {
  nickname: string;
  totalPoints: number;
}

export default function RankingScreen() {
  const { user } = useStore();
  const [ranking, setRanking] = useState<RankEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRanking() {
      try {
        const snap = await get(ref(db, 'users'));
        const data = snap.val();
        if (!data) {
          setRanking([]);
          return;
        }

        const entries: RankEntry[] = Object.entries(data).map(
          ([nickname, val]: [string, unknown]) => {
            const userData = val as { totalPoints?: number };
            return {
              nickname,
              totalPoints: userData.totalPoints ?? 0,
            };
          }
        );

        entries.sort((a, b) => b.totalPoints - a.totalPoints);
        setRanking(entries);
      } catch {
        setRanking([]);
      } finally {
        setLoading(false);
      }
    }

    loadRanking();
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Ranking</h2>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-zinc-500">Carregando ranking...</p>
        </div>
      ) : ranking.length === 0 ? (
        <div className="bg-zinc-800 rounded-2xl p-6 text-center">
          <p className="text-zinc-500">Nenhum jogador ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {ranking.map((entry, idx) => {
            const isMe = entry.nickname === user?.nickname;
            const medal =
              idx === 0 ? 'text-yellow-400' :
              idx === 1 ? 'text-zinc-300' :
              idx === 2 ? 'text-amber-600' : 'text-zinc-500';

            return (
              <div
                key={entry.nickname}
                className={`flex items-center gap-3 p-3 rounded-xl ${
                  isMe ? 'bg-emerald-900/30 border border-emerald-700/50' : 'bg-zinc-800'
                }`}
              >
                <span className={`w-8 text-center font-bold ${medal}`}>
                  {idx + 1}
                </span>
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-300">
                  {entry.nickname.charAt(0).toUpperCase()}
                </div>
                <span className={`flex-1 font-medium ${isMe ? 'text-emerald-300' : 'text-white'}`}>
                  {entry.nickname}
                  {isMe && <span className="text-emerald-400 text-xs ml-2">(voce)</span>}
                </span>
                <span className="font-bold text-white">{entry.totalPoints} pts</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
