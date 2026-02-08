'use client';

import { useEffect, useState, useCallback, ReactNode } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useStore, Screen, UserData, RoundConfig, League, Player } from '@/store/useStore';
import { DraftState } from '@/lib/draft';

interface RankEntry {
  nickname: string;
  totalPoints: number;
}

interface MemberSummary {
  count: number;
  confirmedCount: number;
  entries: RankEntry[];
}

// ── Countdown helpers ──
function calcCountdown(targetMs: number) {
  const diff = targetMs - Date.now();
  if (diff <= 0) return null;
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
  };
}

// ══════════════════════════════════════════════════
//  HOME SCREEN
// ══════════════════════════════════════════════════
export default function HomeScreen() {
  const {
    user,
    round,
    currentLeague,
    isAdmin,
    nickname,
    setScreen,
    players,
    draft,
  } = useStore();

  // If the user is admin, show the admin dashboard; otherwise, the player view
  return isAdmin ? (
    <AdminDashboard
      currentLeague={currentLeague}
      round={round}
      draft={draft}
      players={players}
      nickname={nickname}
      setScreen={setScreen}
    />
  ) : (
    <PlayerHome
      user={user}
      round={round}
      currentLeague={currentLeague}
      nickname={nickname}
      setScreen={setScreen}
    />
  );
}

// ══════════════════════════════════════════════════
//  ADMIN DASHBOARD
// ══════════════════════════════════════════════════
function AdminDashboard({
  currentLeague,
  round,
  draft,
  players,
  nickname,
  setScreen,
}: {
  currentLeague: League | null;
  round: RoundConfig;
  draft: DraftState | null;
  players: Player[];
  nickname: string | null;
  setScreen: (screen: Screen) => void;
}) {
  const [memberData, setMemberData] = useState<MemberSummary>({
    count: 0,
    confirmedCount: 0,
    entries: [],
  });
  const [copied, setCopied] = useState(false);

  // Load league members
  useEffect(() => {
    if (!currentLeague) return;
    async function load() {
      try {
        const snap = await get(ref(db, `leagues/${currentLeague!.id}/members`));
        const data = snap.val();
        if (!data) {
          setMemberData({ count: 0, confirmedCount: 0, entries: [] });
          return;
        }
        const entries: RankEntry[] = [];
        let confirmedCount = 0;
        for (const [nick, val] of Object.entries(data)) {
          const member = val as { totalPoints?: number; confirmed?: boolean };
          entries.push({ nickname: nick, totalPoints: member.totalPoints ?? 0 });
          if (member.confirmed) confirmedCount++;
        }
        entries.sort((a, b) => b.totalPoints - a.totalPoints);
        setMemberData({ count: entries.length, confirmedCount, entries });
      } catch {
        /* ignore */
      }
    }
    load();
  }, [currentLeague]);

  const copyAccessCode = useCallback(() => {
    if (!currentLeague?.accessCode) return;
    navigator.clipboard.writeText(currentLeague.accessCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [currentLeague?.accessCode]);

  // Derive statuses
  const draftStatusLabel =
    draft?.status === 'active'
      ? 'Em andamento'
      : draft?.status === 'paused'
      ? 'Pausado'
      : draft?.status === 'finished'
      ? 'Finalizado'
      : 'Aguardando';

  const draftStatusColor =
    draft?.status === 'active'
      ? 'text-emerald-400'
      : draft?.status === 'paused'
      ? 'text-amber-400'
      : draft?.status === 'finished'
      ? 'text-blue-400'
      : 'text-zinc-400';

  const roundStatusLabel =
    round.status === 'active'
      ? 'Ao Vivo'
      : round.status === 'finished'
      ? 'Encerrada'
      : 'Aguardando';

  const roundStatusColor =
    round.status === 'active'
      ? 'text-red-400'
      : round.status === 'finished'
      ? 'text-emerald-400'
      : 'text-amber-400';

  type QuickLink = {
    label: string;
    sub: string;
    screen: Screen;
    color: string;
    icon: ReactNode;
  };

  const quickLinks: QuickLink[] = [
    {
      label: 'Draft',
      sub: draftStatusLabel,
      screen: 'admin',
      color: 'from-emerald-500/20 to-emerald-900/10 border-emerald-800/40',
      icon: (
        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      label: 'Ranking',
      sub: `${memberData.count} membros`,
      screen: 'ranking',
      color: 'from-amber-500/20 to-amber-900/10 border-amber-800/40',
      icon: (
        <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      label: 'Chat',
      sub: 'Mensagens',
      screen: 'chat',
      color: 'from-blue-500/20 to-blue-900/10 border-blue-800/40',
      icon: (
        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      label: 'Admin',
      sub: 'Configuracoes',
      screen: 'admin',
      color: 'from-purple-500/20 to-purple-900/10 border-purple-800/40',
      icon: (
        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header greeting */}
      <div className="text-center pt-1 pb-2">
        <p className="text-zinc-500 text-xs tracking-wider uppercase">Painel do Administrador</p>
        <h2 className="text-white font-bold text-xl mt-1">
          Ola, {nickname || 'Admin'}
        </h2>
      </div>

      {/* League info card */}
      <div className="bg-gradient-to-br from-emerald-900/40 to-zinc-900 rounded-2xl p-5 border border-emerald-900/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-lg truncate">
              {currentLeague?.name || 'Liga'}
            </p>
            <p className="text-emerald-400/70 text-xs">
              Temporada {currentLeague?.season || new Date().getFullYear()}
            </p>
          </div>
        </div>

        {/* Access code */}
        <div className="bg-black/30 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-wider">Codigo de Acesso</p>
            <p className="text-white font-mono font-bold text-lg tracking-widest mt-0.5">
              {currentLeague?.accessCode || '---'}
            </p>
          </div>
          <button
            onClick={copyAccessCode}
            className="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 text-xs font-medium rounded-lg transition-colors"
          >
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-zinc-800/80 rounded-xl px-3 py-3 text-center border border-zinc-700/50">
          <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-wider">Membros</p>
          <p className="text-white font-black text-2xl mt-1">
            {memberData.count}
            <span className="text-zinc-600 text-sm font-normal">/{currentLeague?.maxMembers || '?'}</span>
          </p>
        </div>
        <div className="bg-zinc-800/80 rounded-xl px-3 py-3 text-center border border-zinc-700/50">
          <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-wider">Rodada</p>
          <p className="text-white font-black text-2xl mt-1">{round.number}</p>
          <p className={`text-[10px] font-semibold ${roundStatusColor}`}>{roundStatusLabel}</p>
        </div>
        <div className="bg-zinc-800/80 rounded-xl px-3 py-3 text-center border border-zinc-700/50">
          <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-wider">Jogadores</p>
          <p className="text-white font-black text-2xl mt-1">{players.length}</p>
        </div>
      </div>

      {/* Draft & Round status detail */}
      <div className="bg-zinc-800/80 rounded-2xl p-4 border border-zinc-700/50 space-y-3">
        <h3 className="text-white font-semibold text-sm">Status</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-sm">Draft</span>
            <span className={`text-sm font-semibold ${draftStatusColor}`}>{draftStatusLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-sm">Rodada {round.number}</span>
            <span className={`text-sm font-semibold ${roundStatusColor}`}>{roundStatusLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-sm">Escalacoes cravadas</span>
            <span className="text-sm font-semibold text-white">
              {memberData.confirmedCount}/{memberData.count}
            </span>
          </div>
          {round.nextGameDate && (
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-sm">Proximo jogo</span>
              <span className="text-sm text-white">
                {new Date(round.nextGameDate).toLocaleDateString('pt-BR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Top 5 mini ranking */}
      {memberData.entries.length > 0 && (
        <div className="bg-zinc-800/80 rounded-2xl p-4 border border-zinc-700/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm">Top 5</h3>
            <button onClick={() => setScreen('ranking')} className="text-emerald-400 text-xs hover:underline">
              Ver ranking
            </button>
          </div>
          <div className="space-y-1.5">
            {memberData.entries.slice(0, 5).map((entry, idx) => {
              const medalColors = ['text-yellow-400', 'text-zinc-300', 'text-amber-600'];
              return (
                <div
                  key={entry.nickname}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-700/30 transition-colors"
                >
                  <span className={`w-5 text-center font-bold text-xs ${medalColors[idx] || 'text-zinc-500'}`}>
                    {idx + 1}
                  </span>
                  <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] text-zinc-300 shrink-0">
                    {entry.nickname.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 text-xs font-medium truncate text-white">
                    {entry.nickname}
                  </span>
                  <span className="text-white text-xs font-bold">{entry.totalPoints}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick links grid */}
      <div className="grid grid-cols-2 gap-2">
        {quickLinks.map((link) => (
          <button
            key={link.label}
            onClick={() => setScreen(link.screen)}
            className={`bg-gradient-to-br ${link.color} border rounded-2xl p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98]`}
          >
            <div className="mb-2">{link.icon}</div>
            <p className="text-white font-semibold text-sm">{link.label}</p>
            <p className="text-zinc-400 text-[11px] mt-0.5">{link.sub}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
//  PLAYER HOME
// ══════════════════════════════════════════════════
function PlayerHome({
  user,
  round,
  currentLeague,
  nickname,
  setScreen,
}: {
  user: UserData | null;
  round: RoundConfig;
  currentLeague: League | null;
  nickname: string | null;
  setScreen: (screen: Screen) => void;
}) {
  const [countdown, setCountdown] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  const [topRanking, setTopRanking] = useState<RankEntry[]>([]);
  const [userRank, setUserRank] = useState(0);

  // ── Countdown timer ──
  useEffect(() => {
    if (!round.nextGameDate) {
      setCountdown(null);
      return;
    }
    const target = new Date(round.nextGameDate).getTime();
    if (isNaN(target)) {
      setCountdown(null);
      return;
    }

    const tick = () => {
      const result = calcCountdown(target);
      setCountdown(result);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [round.nextGameDate]);

  // ── Load mini ranking from league-scoped members ──
  useEffect(() => {
    if (!currentLeague) return;
    async function loadRanking() {
      try {
        const snap = await get(ref(db, `leagues/${currentLeague!.id}/members`));
        const data = snap.val();
        if (!data) return;
        const entries: RankEntry[] = Object.entries(data).map(
          ([nick, val]: [string, unknown]) => ({
            nickname: nick,
            totalPoints: (val as { totalPoints?: number }).totalPoints ?? 0,
          })
        );
        entries.sort((a, b) => b.totalPoints - a.totalPoints);
        setTopRanking(entries.slice(0, 5));
        const idx = entries.findIndex((e) => e.nickname === nickname);
        if (idx >= 0) setUserRank(idx + 1);
      } catch {
        /* ignore */
      }
    }
    loadRanking();
  }, [currentLeague, nickname]);

  // Position counts
  const positionCounts = {
    G: user?.team?.filter((p) => p.position === 'G').length ?? 0,
    D: user?.team?.filter((p) => p.position === 'D').length ?? 0,
    M: user?.team?.filter((p) => p.position === 'M').length ?? 0,
    A: user?.team?.filter((p) => p.position === 'A').length ?? 0,
  };

  // Round badge
  const roundLabel =
    round.status === 'finished'
      ? 'RODADA ENCERRADA'
      : round.status === 'active'
      ? 'RODADA AO VIVO'
      : 'AGUARDANDO';

  const roundBadgeColor =
    round.status === 'active'
      ? 'bg-red-500/20 border-red-500/40 text-red-400'
      : round.status === 'finished'
      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
      : 'bg-amber-500/15 border-amber-500/30 text-amber-400';

  return (
    <div className="space-y-4">
      {/* Round Status Badge */}
      <div className="text-center">
        <p className="text-zinc-500 text-xs mb-2">Rodada {round.number}</p>
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${roundBadgeColor}`}>
          {round.status === 'active' && (
            <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
          )}
          <span className="font-black text-sm tracking-wider">{roundLabel}</span>
        </div>
      </div>

      {/* Countdown */}
      {countdown && (
        <div className="text-center">
          <div className="flex justify-center gap-2 mt-2">
            {countdown.d > 0 && (
              <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-2xl font-black text-white">{countdown.d}</span>
                <span className="text-[9px] text-emerald-400 ml-1">D</span>
              </div>
            )}
            <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-2xl font-black text-white">{String(countdown.h).padStart(2, '0')}</span>
              <span className="text-[9px] text-emerald-400 ml-1">H</span>
            </div>
            <span className="text-emerald-500 self-center animate-pulse font-light">:</span>
            <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-2xl font-black text-white">{String(countdown.m).padStart(2, '0')}</span>
              <span className="text-[9px] text-emerald-400 ml-1">M</span>
            </div>
            <span className="text-emerald-500 self-center animate-pulse font-light">:</span>
            <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-2xl font-black text-white">{String(countdown.s).padStart(2, '0')}</span>
              <span className="text-[9px] text-emerald-400 ml-1">S</span>
            </div>
          </div>
          {round.nextGameDate && (
            <p className="text-zinc-500 text-xs mt-2">
              Rodada {round.number} em{' '}
              {new Date(round.nextGameDate).toLocaleDateString('pt-BR', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      )}

      {/* User Stats Card */}
      <div className="bg-gradient-to-br from-emerald-900/40 to-zinc-900 rounded-2xl p-5 border border-emerald-900/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-lg">
            {nickname?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-lg truncate">{nickname || 'Jogador'}</p>
            <p className="text-emerald-400 text-xs">
              {userRank > 0 ? `${userRank}o lugar` : 'Sem ranking'}
              {currentLeague && (
                <span className="text-zinc-500"> - {currentLeague.name}</span>
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-black/20 rounded-xl px-3 py-2 text-center">
            <p className="text-emerald-400 text-[10px] font-medium uppercase tracking-wider">Pontos</p>
            <p className="text-white font-black text-xl">{user?.totalPoints ?? 0}</p>
          </div>
          <div className="bg-black/20 rounded-xl px-3 py-2 text-center">
            <p className="text-emerald-400 text-[10px] font-medium uppercase tracking-wider">Rodada</p>
            <p className="text-white font-black text-xl">{round.number}</p>
          </div>
          <div className="bg-black/20 rounded-xl px-3 py-2 text-center">
            <p className="text-emerald-400 text-[10px] font-medium uppercase tracking-wider">Elenco</p>
            <p className="text-white font-black text-xl">{user?.team?.length ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Confirmation Status */}
      {user?.team && user.team.length > 0 && (
        <div
          className={`rounded-2xl p-4 flex items-center justify-between ${
            user.confirmed
              ? 'bg-emerald-900/20 border border-emerald-700/40'
              : 'bg-amber-900/20 border border-amber-700/40'
          }`}
        >
          <div>
            <p className={`font-semibold text-sm ${user.confirmed ? 'text-emerald-400' : 'text-amber-400'}`}>
              {user.confirmed ? 'Escalacao Cravada!' : 'Escalacao Pendente'}
            </p>
            <p className="text-zinc-500 text-xs">
              {user.confirmed
                ? 'Seu time esta confirmado para a rodada'
                : 'Confirme sua escalacao antes do jogo'}
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
      <div className="bg-zinc-800/80 rounded-2xl p-4 border border-zinc-700/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm">Seu Time</h3>
          <button onClick={() => setScreen('lineup')} className="text-emerald-400 text-xs hover:underline">
            Ver escalacao
          </button>
        </div>

        {user?.team && user.team.length > 0 ? (
          <>
            {/* Position breakdown bar */}
            <div className="flex gap-2 mb-3">
              {Object.entries(positionCounts).map(([pos, count]) => (
                <div key={pos} className="flex-1 bg-zinc-700/50 rounded-lg py-1.5 text-center">
                  <p className="text-zinc-500 text-[10px]">
                    {pos === 'G' ? 'GOL' : pos === 'D' ? 'DEF' : pos === 'M' ? 'MEI' : 'ATA'}
                  </p>
                  <p className="text-white font-bold text-sm">{count}</p>
                </div>
              ))}
            </div>

            {/* Player mini grid */}
            <div className="grid grid-cols-4 gap-1.5">
              {user.team.slice(0, 12).map((p) => (
                <div key={p.id} className="bg-zinc-700/30 rounded-lg p-1.5 text-center relative">
                  {p.photo ? (
                    <img
                      src={p.photo}
                      alt=""
                      className="w-8 h-8 rounded-full mx-auto mb-1 object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-zinc-600 mx-auto mb-1 flex items-center justify-center text-[10px] text-zinc-400">
                      {p.position}
                    </div>
                  )}
                  <p className="text-white text-[10px] font-medium truncate">
                    {p.name.split(' ').pop()}
                  </p>
                  {user.captain === p.id && (
                    <span className="absolute top-0.5 right-0.5 text-amber-400 text-[8px] font-bold bg-amber-400/10 rounded px-0.5">
                      C
                    </span>
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
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-zinc-700/50 mx-auto mb-3 flex items-center justify-center">
              <svg className="w-6 h-6 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-zinc-500 text-sm mb-3">Nenhum jogador escalado</p>
            <button
              onClick={() => setScreen('draft')}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-colors"
            >
              Ir para o Draft
            </button>
          </div>
        )}
      </div>

      {/* Mini Ranking */}
      <div className="bg-zinc-800/80 rounded-2xl p-4 border border-zinc-700/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm">Classificacao</h3>
          <button onClick={() => setScreen('ranking')} className="text-emerald-400 text-xs hover:underline">
            Ver tudo
          </button>
        </div>

        {topRanking.length > 0 ? (
          <div className="space-y-1.5">
            {topRanking.map((entry, idx) => {
              const isMe = entry.nickname === nickname;
              const medalColors = ['text-yellow-400', 'text-zinc-300', 'text-amber-600'];
              return (
                <div
                  key={entry.nickname}
                  className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                    isMe ? 'bg-emerald-900/20 border border-emerald-800/30' : 'hover:bg-zinc-700/30'
                  }`}
                >
                  <span className={`w-5 text-center font-bold text-xs ${medalColors[idx] || 'text-zinc-500'}`}>
                    {idx + 1}
                  </span>
                  <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] text-zinc-300 shrink-0">
                    {entry.nickname.charAt(0).toUpperCase()}
                  </div>
                  <span
                    className={`flex-1 text-xs font-medium truncate ${isMe ? 'text-emerald-300' : 'text-white'}`}
                  >
                    {entry.nickname}
                    {isMe && <span className="text-emerald-400/60 ml-1">(voce)</span>}
                  </span>
                  <span className="text-white text-xs font-bold">{entry.totalPoints}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-zinc-500 text-xs">Sem dados ainda</p>
          </div>
        )}
      </div>
    </div>
  );
}
