'use client';

import { useEffect, useState } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useStore } from '@/store/useStore';

interface RankEntry { nickname: string; totalPoints: number }

export default function HomeScreen() {
  const { user, currentRound, nextGameDate, roundStatus, nextRoundNumber, setScreen } = useStore();
  const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0 });
  const [countdownActive, setCountdownActive] = useState(false);
  const [topRanking, setTopRanking] = useState<RankEntry[]>([]);
  const [userRank, setUserRank] = useState(0);

  // Countdown timer
  useEffect(() => {
    if (!nextGameDate) { setCountdownActive(false); return; }
    const target = new Date(nextGameDate).getTime();
    if (isNaN(target)) { setCountdownActive(false); return; }

    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setCountdownActive(false); return; }
      setCountdownActive(true);
      setCountdown({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [nextGameDate]);

  // Load mini ranking
  useEffect(() => {
    async function loadRanking() {
      try {
        const snap = await get(ref(db, 'users'));
        const data = snap.val();
        if (!data) return;
        const entries: RankEntry[] = Object.entries(data).map(
          ([nickname, val]: [string, unknown]) => ({
            nickname,
            totalPoints: (val as { totalPoints?: number }).totalPoints ?? 0,
          })
        );
        entries.sort((a, b) => b.totalPoints - a.totalPoints);
        setTopRanking(entries.slice(0, 5));
        const idx = entries.findIndex(e => e.nickname === user?.nickname);
        if (idx >= 0) setUserRank(idx + 1);
      } catch { /* ignore */ }
    }
    loadRanking();
  }, [user?.nickname]);

  const positionCounts = {
    G: user?.team?.filter(p => p.position === 'G').length ?? 0,
    D: user?.team?.filter(p => p.position === 'D').length ?? 0,
    M: user?.team?.filter(p => p.position === 'M').length ?? 0,
    A: user?.team?.filter(p => p.position === 'A').length ?? 0,
  };

  const roundLabel = roundStatus === 'finished'
    ? 'RODADA ENCERRADA'
    : roundStatus === 'active'
    ? 'RODADA AO VIVO'
    : 'AGUARDANDO';

  const roundBadgeColor = roundStatus === 'active'
    ? 'bg-red-500/20 border-red-500/40 text-red-400'
    : roundStatus === 'finished'
    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
    : 'bg-amber-500/15 border-amber-500/30 text-amber-400';

  return (
    <div className="space-y-4">
      {/* Round Status Badge */}
      <div className="text-center">
        <p className="text-zinc-500 text-xs mb-2">Rodada {currentRound}</p>
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${roundBadgeColor}`}>
          {roundStatus === 'active' && <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />}
          <span className="font-black text-sm tracking-wider">{roundLabel}</span>
        </div>
      </div>

      {/* Countdown */}
      {countdownActive && (
        <div className="text-center">
          <div className="flex justify-center gap-2 mt-2">
            {countdown.d > 0 && (
              <div className="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <span className="text-2xl font-black text-white">{countdown.d}</span>
                <span className="text-[9px] text-purple-400 ml-1">D</span>
              </div>
            )}
            <div className="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <span className="text-2xl font-black text-white">{String(countdown.h).padStart(2, '0')}</span>
              <span className="text-[9px] text-purple-400 ml-1">H</span>
            </div>
            <span className="text-purple-500 self-center animate-pulse font-light">:</span>
            <div className="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <span className="text-2xl font-black text-white">{String(countdown.m).padStart(2, '0')}</span>
              <span className="text-[9px] text-purple-400 ml-1">M</span>
            </div>
            <span className="text-purple-500 self-center animate-pulse font-light">:</span>
            <div className="px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <span className="text-2xl font-black text-white">{String(countdown.s).padStart(2, '0')}</span>
              <span className="text-[9px] text-purple-400 ml-1">S</span>
            </div>
          </div>
          {nextRoundNumber && nextGameDate && (
            <p className="text-zinc-500 text-xs mt-2">
              Rodada {nextRoundNumber} em{' '}
              {new Date(nextGameDate).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}

      {/* User Stats Card */}
      <div className="bg-gradient-to-br from-emerald-900/40 to-zinc-900 rounded-2xl p-5 border border-emerald-900/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-lg">
            {user?.nickname?.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-white font-bold text-lg">{user?.nickname || 'Jogador'}</p>
            <p className="text-emerald-400 text-xs">{userRank > 0 ? `${userRank}o lugar` : 'Sem ranking'}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-black/20 rounded-xl px-3 py-2 text-center">
            <p className="text-emerald-400 text-[10px] font-medium">PONTOS</p>
            <p className="text-white font-black text-xl">{user?.totalPoints ?? 0}</p>
          </div>
          <div className="bg-black/20 rounded-xl px-3 py-2 text-center">
            <p className="text-emerald-400 text-[10px] font-medium">RODADA</p>
            <p className="text-white font-black text-xl">{currentRound}</p>
          </div>
          <div className="bg-black/20 rounded-xl px-3 py-2 text-center">
            <p className="text-emerald-400 text-[10px] font-medium">CARTOLETAS</p>
            <p className="text-white font-black text-xl">C${user?.budget?.toFixed(0) ?? '100'}</p>
          </div>
        </div>
      </div>

      {/* Cravar Status */}
      {user?.team && user.team.length > 0 && (
        <div className={`rounded-2xl p-4 flex items-center justify-between ${
          user.confirmed
            ? 'bg-emerald-900/20 border border-emerald-700/40'
            : 'bg-amber-900/20 border border-amber-700/40'
        }`}>
          <div>
            <p className={`font-semibold text-sm ${user.confirmed ? 'text-emerald-400' : 'text-amber-400'}`}>
              {user.confirmed ? 'Escalacao Cravada!' : 'Escalacao Pendente'}
            </p>
            <p className="text-zinc-500 text-xs">
              {user.confirmed ? 'Seu time esta confirmado para a rodada' : 'Confirme sua escalacao antes do jogo'}
            </p>
          </div>
          {!user.confirmed && (
            <button
              onClick={() => setScreen('lineup')}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors shrink-0"
            >
              Cravar
            </button>
          )}
        </div>
      )}

      {/* Team Overview */}
      <div className="bg-zinc-800/80 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm">Seu Time</h3>
          <button onClick={() => setScreen('lineup')} className="text-emerald-400 text-xs">
            Ver escalacao
          </button>
        </div>

        {user?.team && user.team.length > 0 ? (
          <>
            <div className="flex gap-2 mb-3">
              {Object.entries(positionCounts).map(([pos, count]) => (
                <div key={pos} className="flex-1 bg-zinc-700/50 rounded-lg py-1.5 text-center">
                  <p className="text-zinc-500 text-[10px]">{pos === 'G' ? 'GOL' : pos === 'D' ? 'DEF' : pos === 'M' ? 'MEI' : 'ATA'}</p>
                  <p className="text-white font-bold text-sm">{count}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {user.team.slice(0, 12).map((p) => (
                <div key={p.id} className="bg-zinc-700/30 rounded-lg p-1.5 text-center">
                  {p.photo ? (
                    <img src={p.photo} alt="" className="w-8 h-8 rounded-full mx-auto mb-1 object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-zinc-600 mx-auto mb-1 flex items-center justify-center text-[10px] text-zinc-400">
                      {p.position}
                    </div>
                  )}
                  <p className="text-white text-[10px] font-medium truncate">{p.name.split(' ').pop()}</p>
                  {user.captain === p.id && (
                    <span className="text-amber-400 text-[8px] font-bold">C</span>
                  )}
                </div>
              ))}
              {user.team.length > 12 && (
                <div className="bg-zinc-700/30 rounded-lg p-1.5 text-center flex items-center justify-center">
                  <p className="text-zinc-400 text-xs">+{user.team.length - 12}</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-zinc-500 text-sm mb-2">Nenhum jogador escalado</p>
            <button
              onClick={() => setScreen('draft')}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-colors"
            >
              Ir para o Draft
            </button>
          </div>
        )}
      </div>

      {/* Mini Ranking */}
      <div className="bg-zinc-800/80 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm">Classificacao</h3>
          <button onClick={() => setScreen('ranking')} className="text-emerald-400 text-xs">
            Ver tudo
          </button>
        </div>

        {topRanking.length > 0 ? (
          <div className="space-y-1.5">
            {topRanking.map((entry, idx) => {
              const isMe = entry.nickname === user?.nickname;
              const medalColors = ['text-yellow-400', 'text-zinc-300', 'text-amber-600'];
              return (
                <div key={entry.nickname} className={`flex items-center gap-2 p-2 rounded-lg ${isMe ? 'bg-emerald-900/20' : ''}`}>
                  <span className={`w-5 text-center font-bold text-xs ${medalColors[idx] || 'text-zinc-500'}`}>
                    {idx + 1}
                  </span>
                  <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] text-zinc-300 shrink-0">
                    {entry.nickname.charAt(0).toUpperCase()}
                  </div>
                  <span className={`flex-1 text-xs font-medium truncate ${isMe ? 'text-emerald-300' : 'text-white'}`}>
                    {entry.nickname}
                  </span>
                  <span className="text-white text-xs font-bold">{entry.totalPoints}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-zinc-500 text-xs text-center py-2">Sem dados ainda</p>
        )}
      </div>
    </div>
  );
}
