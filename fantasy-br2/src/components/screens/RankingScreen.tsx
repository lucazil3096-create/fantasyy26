'use client';

import { useEffect, useState, useMemo } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useStore } from '@/store/useStore';

// ── Types ──

interface RoundPoints {
  [round: string]: number;
}

interface MemberData {
  totalPoints?: number;
  roundPoints?: RoundPoints;
  confirmed?: boolean;
}

interface RankEntry {
  nickname: string;
  totalPoints: number;
  roundPoints: RoundPoints;
}

// ── Medal helpers ──

function getMedalIcon(position: number): string | null {
  if (position === 0) return '\u{1F947}'; // gold
  if (position === 1) return '\u{1F948}'; // silver
  if (position === 2) return '\u{1F949}'; // bronze
  return null;
}

function getMedalColor(position: number): string {
  if (position === 0) return 'text-yellow-400';
  if (position === 1) return 'text-zinc-300';
  if (position === 2) return 'text-amber-600';
  return 'text-zinc-500';
}

// ══════════════════════════════════════════════════
//  RANKING SCREEN
// ══════════════════════════════════════════════════

export default function RankingScreen() {
  const { nickname, currentLeague, isAdmin } = useStore();

  const [ranking, setRanking] = useState<RankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedNick, setExpandedNick] = useState<string | null>(null);

  // ── Load members from league ──
  useEffect(() => {
    if (!currentLeague) {
      setRanking([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadRanking() {
      setLoading(true);
      setError(false);
      try {
        const snap = await get(ref(db, `leagues/${currentLeague!.id}/members`));
        if (cancelled) return;
        const data = snap.val();
        if (!data) {
          setRanking([]);
          return;
        }

        const entries: RankEntry[] = Object.entries(data).map(
          ([nick, val]: [string, unknown]) => {
            const member = val as MemberData;
            return {
              nickname: nick,
              totalPoints: member.totalPoints ?? 0,
              roundPoints: member.roundPoints ?? {},
            };
          }
        );

        entries.sort((a, b) => b.totalPoints - a.totalPoints);
        setRanking(entries);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRanking();
    return () => {
      cancelled = true;
    };
  }, [currentLeague]);

  // ── Filtered list ──
  const filtered = useMemo(() => {
    if (!search.trim()) return ranking;
    const q = search.trim().toLowerCase();
    return ranking.filter((e) => e.nickname.toLowerCase().includes(q));
  }, [ranking, search]);

  // ── Find current user position in the full ranking ──
  const myRank = useMemo(() => {
    if (isAdmin || !nickname) return -1;
    return ranking.findIndex((e) => e.nickname === nickname);
  }, [ranking, nickname, isAdmin]);

  // ── No league selected ──
  if (!currentLeague) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-zinc-500 text-sm">Selecione uma liga para ver o ranking.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Ranking</h2>
          <p className="text-zinc-500 text-xs mt-0.5">
            {currentLeague.name} &middot; {ranking.length} membro{ranking.length !== 1 ? 's' : ''}
          </p>
        </div>
        {myRank >= 0 && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-1.5 text-center">
            <p className="text-emerald-400 text-[10px] font-medium uppercase tracking-wider">Sua posicao</p>
            <p className="text-white font-black text-lg leading-tight">{myRank + 1}o</p>
          </div>
        )}
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar jogador..."
          className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-600/50 focus:ring-1 focus:ring-emerald-600/30 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Loading state ── */}
      {loading && (
        <div className="flex flex-col items-center py-12">
          <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-3" />
          <p className="text-zinc-500 text-sm">Carregando ranking...</p>
        </div>
      )}

      {/* ── Error state ── */}
      {!loading && error && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-2xl p-6 text-center">
          <p className="text-red-400 font-medium text-sm mb-1">Erro ao carregar ranking</p>
          <p className="text-zinc-500 text-xs">Verifique sua conexao e tente novamente.</p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && ranking.length === 0 && (
        <div className="bg-zinc-800/80 rounded-2xl p-8 text-center border border-zinc-700/50">
          <div className="w-14 h-14 rounded-full bg-zinc-700/50 mx-auto mb-4 flex items-center justify-center">
            <svg className="w-7 h-7 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-zinc-400 font-medium text-sm">Nenhum membro na liga ainda.</p>
          <p className="text-zinc-600 text-xs mt-1">Convide jogadores para comecar!</p>
        </div>
      )}

      {/* ── No search results ── */}
      {!loading && !error && ranking.length > 0 && filtered.length === 0 && (
        <div className="bg-zinc-800/80 rounded-2xl p-6 text-center border border-zinc-700/50">
          <p className="text-zinc-500 text-sm">Nenhum jogador encontrado para &ldquo;{search}&rdquo;</p>
        </div>
      )}

      {/* ── Podium (top 3) ── */}
      {!loading && !error && filtered.length > 0 && !search && (
        <div className="flex items-end justify-center gap-2 pt-2 pb-1">
          {/* 2nd place */}
          {filtered.length >= 2 && (
            <PodiumCard
              entry={filtered[1]}
              position={2}
              height="h-20"
              isMe={!isAdmin && filtered[1].nickname === nickname}
            />
          )}
          {/* 1st place */}
          {filtered.length >= 1 && (
            <PodiumCard
              entry={filtered[0]}
              position={1}
              height="h-28"
              isMe={!isAdmin && filtered[0].nickname === nickname}
            />
          )}
          {/* 3rd place */}
          {filtered.length >= 3 && (
            <PodiumCard
              entry={filtered[2]}
              position={3}
              height="h-16"
              isMe={!isAdmin && filtered[2].nickname === nickname}
            />
          )}
        </div>
      )}

      {/* ── Full list ── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-1.5">
          {filtered.map((entry, idx) => {
            // When searching, we need the actual rank from the full ranking
            const actualIdx = ranking.findIndex((r) => r.nickname === entry.nickname);
            const isMe = !isAdmin && entry.nickname === nickname;
            const isExpanded = expandedNick === entry.nickname;
            const medal = getMedalIcon(actualIdx);
            const medalColor = getMedalColor(actualIdx);
            const roundKeys = Object.keys(entry.roundPoints).sort(
              (a, b) => parseInt(a) - parseInt(b)
            );
            const hasRounds = roundKeys.length > 0;

            return (
              <div key={entry.nickname}>
                <button
                  onClick={() => hasRounds && setExpandedNick(isExpanded ? null : entry.nickname)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                    isMe
                      ? 'bg-emerald-900/30 border border-emerald-700/50'
                      : 'bg-zinc-800/80 border border-zinc-700/30 hover:border-zinc-600/50'
                  } ${hasRounds ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  {/* Position */}
                  <div className={`w-8 text-center font-bold ${medalColor}`}>
                    {medal ? (
                      <span className="text-lg">{medal}</span>
                    ) : (
                      <span className="text-sm">{actualIdx + 1}</span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      isMe
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    {entry.nickname.charAt(0).toUpperCase()}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0 text-left">
                    <span className={`font-medium text-sm truncate block ${isMe ? 'text-emerald-300' : 'text-white'}`}>
                      {entry.nickname}
                      {isMe && (
                        <span className="text-emerald-400/60 text-xs ml-1.5">(voce)</span>
                      )}
                    </span>
                    {hasRounds && (
                      <span className="text-zinc-500 text-[10px]">
                        {roundKeys.length} rodada{roundKeys.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Points */}
                  <div className="text-right shrink-0">
                    <span className="text-white font-bold text-sm">{entry.totalPoints}</span>
                    <span className="text-zinc-500 text-xs ml-1">pts</span>
                  </div>

                  {/* Expand arrow */}
                  {hasRounds && (
                    <svg
                      className={`w-4 h-4 text-zinc-500 transition-transform shrink-0 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>

                {/* ── Round breakdown (expanded) ── */}
                {isExpanded && hasRounds && (
                  <div className="mt-1 ml-11 mr-2 bg-zinc-900/80 rounded-xl border border-zinc-700/30 p-3 space-y-1.5">
                    <p className="text-zinc-400 text-[10px] font-semibold uppercase tracking-wider mb-2">
                      Pontos por Rodada
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {roundKeys.map((roundNum) => {
                        const pts = entry.roundPoints[roundNum];
                        return (
                          <div
                            key={roundNum}
                            className="bg-zinc-800/80 rounded-lg px-2 py-1.5 text-center"
                          >
                            <p className="text-zinc-500 text-[10px]">R{roundNum}</p>
                            <p className={`font-bold text-sm ${pts > 0 ? 'text-emerald-400' : pts < 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                              {pts}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    {/* Total from rounds vs totalPoints sanity */}
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-700/30 mt-2">
                      <span className="text-zinc-500 text-xs">Total das rodadas</span>
                      <span className="text-white font-bold text-xs">
                        {roundKeys.reduce((sum, k) => sum + (entry.roundPoints[k] ?? 0), 0)} pts
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════
//  PODIUM CARD
// ══════════════════════════════════════════════════

function PodiumCard({
  entry,
  position,
  height,
  isMe,
}: {
  entry: RankEntry;
  position: 1 | 2 | 3;
  height: string;
  isMe: boolean;
}) {
  const colors = {
    1: {
      bg: 'from-yellow-500/20 to-yellow-900/10',
      border: 'border-yellow-600/40',
      badge: 'bg-yellow-500 text-black',
      ring: 'ring-yellow-500/40',
    },
    2: {
      bg: 'from-zinc-400/15 to-zinc-700/10',
      border: 'border-zinc-500/40',
      badge: 'bg-zinc-400 text-black',
      ring: 'ring-zinc-400/30',
    },
    3: {
      bg: 'from-amber-700/20 to-amber-900/10',
      border: 'border-amber-700/40',
      badge: 'bg-amber-700 text-white',
      ring: 'ring-amber-700/30',
    },
  };

  const c = colors[position];

  return (
    <div className="flex flex-col items-center w-24">
      {/* Avatar with position badge */}
      <div className="relative mb-1.5">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold ring-2 ${c.ring} ${
            isMe ? 'bg-emerald-600 text-white' : 'bg-zinc-700 text-zinc-200'
          }`}
        >
          {entry.nickname.charAt(0).toUpperCase()}
        </div>
        <div
          className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full ${c.badge} flex items-center justify-center text-[10px] font-black`}
        >
          {position}
        </div>
      </div>

      {/* Name */}
      <p className={`text-xs font-semibold truncate w-full text-center ${isMe ? 'text-emerald-300' : 'text-white'}`}>
        {entry.nickname}
      </p>

      {/* Podium bar */}
      <div
        className={`w-full ${height} mt-1.5 rounded-t-xl bg-gradient-to-b ${c.bg} border ${c.border} border-b-0 flex items-center justify-center`}
      >
        <span className="text-white font-black text-sm">{entry.totalPoints}</span>
      </div>
    </div>
  );
}
