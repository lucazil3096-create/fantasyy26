'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';

export default function HomeScreen() {
  const { user, currentRound, nextGameDate } = useStore();
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!nextGameDate) return;

    const timer = setInterval(() => {
      const diff = new Date(nextGameDate).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown('JOGO AGORA!');
        clearInterval(timer);
        return;
      }

      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      setCountdown(`${d}d ${h}h ${m}m ${s}s`);
    }, 1000);

    return () => clearInterval(timer);
  }, [nextGameDate]);

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-6">
        <p className="text-emerald-200 text-sm">Bem-vindo de volta</p>
        <h2 className="text-2xl font-bold text-white mt-1">
          {user?.nickname || 'Jogador'}
        </h2>
        <div className="flex items-center gap-4 mt-4">
          <div className="bg-white/10 rounded-xl px-4 py-2">
            <p className="text-emerald-200 text-xs">Pontos</p>
            <p className="text-white font-bold text-lg">{user?.totalPoints ?? 0}</p>
          </div>
          <div className="bg-white/10 rounded-xl px-4 py-2">
            <p className="text-emerald-200 text-xs">Rodada</p>
            <p className="text-white font-bold text-lg">{currentRound}</p>
          </div>
          <div className="bg-white/10 rounded-xl px-4 py-2">
            <p className="text-emerald-200 text-xs">Cartoletas</p>
            <p className="text-white font-bold text-lg">C$ {user?.budget?.toFixed(1) ?? '100.0'}</p>
          </div>
        </div>
      </div>

      {/* Countdown */}
      {nextGameDate && (
        <div className="bg-zinc-800 rounded-2xl p-5 text-center">
          <p className="text-zinc-400 text-sm mb-2">Proximo jogo</p>
          <p className="text-2xl font-bold text-white font-mono">
            {countdown || 'Calculando...'}
          </p>
        </div>
      )}

      {/* Quick Stats */}
      <div className="bg-zinc-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-3">Seu Time</h3>
        {user?.team && user.team.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {user.team.slice(0, 6).map((p) => (
              <div key={p.id} className="bg-zinc-700/50 rounded-xl p-2 text-center">
                <p className="text-white text-xs font-medium truncate">{p.name}</p>
                <p className="text-zinc-400 text-[10px]">{p.position}</p>
              </div>
            ))}
            {user.team.length > 6 && (
              <div className="bg-zinc-700/50 rounded-xl p-2 text-center flex items-center justify-center">
                <p className="text-zinc-400 text-xs">+{user.team.length - 6}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-zinc-500 text-sm">
            Nenhum jogador escalado ainda. Va para o Draft!
          </p>
        )}
      </div>
    </div>
  );
}
