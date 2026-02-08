'use client';

import { useState } from 'react';
import { ref, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useStore, Player } from '@/store/useStore';

// ── Formation definitions ──
const FORMATIONS: Record<string, { G: number; D: number; M: number; A: number }> = {
  '4-3-3': { G: 1, D: 4, M: 3, A: 3 },
  '4-4-2': { G: 1, D: 4, M: 4, A: 2 },
  '3-5-2': { G: 1, D: 3, M: 5, A: 2 },
  '3-4-3': { G: 1, D: 3, M: 4, A: 3 },
  '5-3-2': { G: 1, D: 5, M: 3, A: 2 },
  '4-5-1': { G: 1, D: 4, M: 5, A: 1 },
};

const POS_LABELS: Record<string, string> = { G: 'GOL', D: 'DEF', M: 'MEI', A: 'ATA' };
const POS_COLORS: Record<string, string> = {
  G: 'bg-amber-500',
  D: 'bg-blue-500',
  M: 'bg-emerald-500',
  A: 'bg-red-500',
};

// ── Helpers ──
function buildBasePath(leagueId: string, nickname: string) {
  return `leagues/${leagueId}/members/${nickname}`;
}

export default function LineupScreen() {
  const { user, currentLeague, updateTeam, setCaptain, setConfirmed } = useStore();
  const [formation, setFormation] = useState(user?.formation || '4-3-3');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  if (!user || !currentLeague) return null;

  const basePath = buildBasePath(currentLeague.id, user.nickname);
  const team = user.team || [];
  const formationSlots = FORMATIONS[formation] || FORMATIONS['4-3-3'];
  const totalStarters = formationSlots.G + formationSlots.D + formationSlots.M + formationSlots.A;

  // ── Separate starters from bench based on formation ──
  const starters: Record<string, Player[]> = { G: [], D: [], M: [], A: [] };
  const bench: Player[] = [];

  const byPosition: Record<string, Player[]> = { G: [], D: [], M: [], A: [] };
  for (const p of team) {
    if (byPosition[p.position]) {
      byPosition[p.position].push(p);
    } else {
      byPosition['M'].push(p); // fallback unknown positions to midfield
    }
  }

  for (const pos of ['G', 'D', 'M', 'A'] as const) {
    const needed = formationSlots[pos];
    starters[pos] = byPosition[pos].slice(0, needed);
    bench.push(...byPosition[pos].slice(needed));
  }

  const allStarters = [...starters.G, ...starters.D, ...starters.M, ...starters.A];

  // ── Cravar (confirm lineup) ──
  async function handleCravar() {
    if (allStarters.length < totalStarters) {
      setMsg(`Precisa de ${totalStarters} titulares. Tem ${allStarters.length}.`);
      return;
    }

    if (!user!.captain) {
      setMsg('Escolha um capitao antes de cravar.');
      return;
    }

    // Ensure captain is among starters
    const captainInStarters = allStarters.some((p) => p.id === user!.captain);
    if (!captainInStarters) {
      setMsg('O capitao precisa ser um titular.');
      return;
    }

    setSaving(true);
    setMsg('');
    try {
      await set(ref(db, `${basePath}/confirmed`), true);
      await set(ref(db, `${basePath}/formation`), formation);
      await set(ref(db, `${basePath}/captain`), user!.captain ?? null);
      setConfirmed(true);
      setMsg('Escalacao cravada!');
    } catch {
      setMsg('Erro ao cravar escalacao.');
    } finally {
      setSaving(false);
    }
  }

  // ── Captain toggle ──
  function toggleCaptain(playerId: number) {
    const next = user!.captain === playerId ? null : playerId;
    setCaptain(next);
    // Persist captain selection immediately
    set(ref(db, `${basePath}/captain`), next).catch(() => {});
  }

  // ── Move player to bench (end of team array) ──
  async function moveToBench(player: Player) {
    const newTeam = team.filter((p) => p.id !== player.id);
    newTeam.push(player);
    updateTeam(newTeam);
    try {
      await set(ref(db, `${basePath}/team`), newTeam);
    } catch {
      // silent – local state already updated
    }
  }

  // ── Promote player from bench to starters ──
  async function moveToStarters(player: Player) {
    const newTeam = team.filter((p) => p.id !== player.id);
    // Insert at the position where this position group starts
    const posIndex = newTeam.findIndex((p) => p.position === player.position);
    if (posIndex >= 0) {
      newTeam.splice(posIndex, 0, player);
    } else {
      newTeam.unshift(player);
    }
    updateTeam(newTeam);
    try {
      await set(ref(db, `${basePath}/team`), newTeam);
    } catch {
      // silent
    }
  }

  // ── Swap starter with bench player of same position ──
  async function swapWithBench(starter: Player, benchPlayer: Player) {
    const newTeam = team.map((p) => {
      if (p.id === starter.id) return benchPlayer;
      if (p.id === benchPlayer.id) return starter;
      return p;
    });
    updateTeam(newTeam);
    try {
      await set(ref(db, `${basePath}/team`), newTeam);
    } catch {
      // silent
    }
  }

  // Bench players of a given position (for swap dropdown)
  function benchOfPosition(pos: string) {
    return bench.filter((p) => p.position === pos);
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Escalacao</h2>
        <div className="flex items-center gap-2">
          {user.confirmed && (
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full uppercase tracking-wide">
              Cravado
            </span>
          )}
          <span className="text-sm text-zinc-400 font-mono">{formation}</span>
        </div>
      </div>

      {/* ── Formation Selector ── */}
      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1">
        {Object.keys(FORMATIONS).map((f) => (
          <button
            key={f}
            onClick={() => {
              setFormation(f);
              // Un-confirm when formation changes
              if (user.confirmed) {
                setConfirmed(false);
                set(ref(db, `${basePath}/confirmed`), false).catch(() => {});
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              formation === f
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* ── Football Field ── */}
      <div className="bg-gradient-to-b from-emerald-900/30 via-emerald-800/15 to-emerald-900/30 rounded-2xl border border-emerald-900/30 overflow-hidden">
        <div className="relative py-5 px-3">
          {/* Field decorations */}
          <div className="absolute top-1/2 left-4 right-4 border-t border-emerald-700/20" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border border-emerald-700/20 rounded-full" />
          {/* Top penalty area */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-8 border-b border-l border-r border-emerald-700/15 rounded-b-lg" />
          {/* Bottom penalty area */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-8 border-t border-l border-r border-emerald-700/15 rounded-t-lg" />

          {/* Player rows: ATK -> MID -> DEF -> GK */}
          <div className="relative z-10 space-y-4">
            {/* Attackers */}
            <FieldRow
              players={starters.A}
              emptyCount={Math.max(0, formationSlots.A - starters.A.length)}
              pos="A"
              captainId={user.captain}
              onCaptain={toggleCaptain}
              onBench={moveToBench}
              benchPlayers={benchOfPosition('A')}
              onSwap={swapWithBench}
            />

            {/* Midfielders */}
            <FieldRow
              players={starters.M}
              emptyCount={Math.max(0, formationSlots.M - starters.M.length)}
              pos="M"
              captainId={user.captain}
              onCaptain={toggleCaptain}
              onBench={moveToBench}
              benchPlayers={benchOfPosition('M')}
              onSwap={swapWithBench}
            />

            {/* Defenders */}
            <FieldRow
              players={starters.D}
              emptyCount={Math.max(0, formationSlots.D - starters.D.length)}
              pos="D"
              captainId={user.captain}
              onCaptain={toggleCaptain}
              onBench={moveToBench}
              benchPlayers={benchOfPosition('D')}
              onSwap={swapWithBench}
            />

            {/* Goalkeeper */}
            <FieldRow
              players={starters.G}
              emptyCount={Math.max(0, formationSlots.G - starters.G.length)}
              pos="G"
              captainId={user.captain}
              onCaptain={toggleCaptain}
              onBench={moveToBench}
              benchPlayers={benchOfPosition('G')}
              onSwap={swapWithBench}
            />
          </div>
        </div>
      </div>

      {/* ── Bench ── */}
      {bench.length > 0 && (
        <div className="bg-zinc-900/80 rounded-2xl p-4 border border-zinc-800">
          <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
            Banco
            <span className="text-zinc-500 text-xs font-normal">({bench.length})</span>
          </h3>
          <div className="space-y-1.5">
            {bench.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 bg-zinc-800/60 rounded-xl p-2 hover:bg-zinc-800 transition-colors"
              >
                <div
                  className={`w-6 h-6 rounded-full ${
                    POS_COLORS[p.position] || 'bg-zinc-500'
                  } flex items-center justify-center text-[9px] text-white font-bold shrink-0`}
                >
                  {p.position}
                </div>
                {p.photo ? (
                  <img
                    src={p.photo}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover shrink-0 border border-zinc-700"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-zinc-700 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{p.name}</p>
                  <p className="text-zinc-500 text-[10px] truncate">{p.team}</p>
                </div>
                <span className="text-zinc-400 text-xs tabular-nums">{p.points} pts</span>
                <button
                  onClick={() => moveToStarters(p)}
                  className="px-2.5 py-1 bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold rounded-lg hover:bg-emerald-500/25 transition-colors"
                >
                  Titular
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Position Summary ── */}
      <div className="bg-zinc-900/80 rounded-2xl p-4 border border-zinc-800">
        <h3 className="text-white font-semibold text-sm mb-3">Resumo</h3>
        <div className="grid grid-cols-4 gap-2">
          {(['G', 'D', 'M', 'A'] as const).map((pos) => {
            const have = byPosition[pos].length;
            const need = formationSlots[pos];
            const filled = have >= need;
            return (
              <div key={pos} className="bg-zinc-800/70 rounded-xl p-2.5 text-center">
                <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-wider">
                  {POS_LABELS[pos]}
                </p>
                <p
                  className={`font-bold text-sm mt-0.5 ${
                    filled ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {have}/{need}
                </p>
              </div>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="bg-zinc-800/70 rounded-xl p-2.5 text-center">
            <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-wider">Total</p>
            <p className="text-white font-bold text-sm mt-0.5">{team.length} jogadores</p>
          </div>
          <div className="bg-zinc-800/70 rounded-xl p-2.5 text-center">
            <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-wider">
              Titulares
            </p>
            <p
              className={`font-bold text-sm mt-0.5 ${
                allStarters.length >= totalStarters ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {allStarters.length}/{totalStarters}
            </p>
          </div>
        </div>
      </div>

      {/* ── Message ── */}
      {msg && (
        <p
          className={`text-center text-sm font-medium ${
            msg.includes('Erro') || msg.includes('Precisa') || msg.includes('Escolha') || msg.includes('precisa')
              ? 'text-red-400'
              : 'text-emerald-400'
          }`}
        >
          {msg}
        </p>
      )}

      {/* ── Cravar Button ── */}
      <button
        onClick={handleCravar}
        disabled={saving || team.length === 0}
        className={`w-full py-4 font-bold rounded-2xl text-white transition-all ${
          user.confirmed
            ? 'bg-emerald-700/40 border border-emerald-600/40 cursor-default'
            : 'bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed'
        }`}
      >
        {saving
          ? 'Salvando...'
          : user.confirmed
            ? 'Escalacao Cravada'
            : 'Cravar Escalacao'}
      </button>
    </div>
  );
}

// ── Field Row ──
// Renders a horizontal row of player cards + empty slots for one position group.
function FieldRow({
  players,
  emptyCount,
  pos,
  captainId,
  onCaptain,
  onBench,
  benchPlayers,
  onSwap,
}: {
  players: Player[];
  emptyCount: number;
  pos: string;
  captainId: number | null;
  onCaptain: (id: number) => void;
  onBench: (p: Player) => void;
  benchPlayers: Player[];
  onSwap: (starter: Player, benchPlayer: Player) => void;
}) {
  return (
    <div className="flex justify-center gap-2 flex-wrap">
      {players.map((p) => (
        <PlayerCard
          key={p.id}
          player={p}
          isCaptain={captainId === p.id}
          onCaptain={onCaptain}
          onBench={() => onBench(p)}
          benchPlayers={benchPlayers}
          onSwap={(bp) => onSwap(p, bp)}
        />
      ))}
      {Array.from({ length: emptyCount }).map((_, i) => (
        <EmptySlot key={`e-${pos}-${i}`} pos={pos} />
      ))}
    </div>
  );
}

// ── Player Card (on field) ──
function PlayerCard({
  player,
  isCaptain,
  onCaptain,
  onBench,
  benchPlayers,
  onSwap,
}: {
  player: Player;
  isCaptain: boolean;
  onCaptain: (id: number) => void;
  onBench: () => void;
  benchPlayers: Player[];
  onSwap: (benchPlayer: Player) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={`w-[68px] flex flex-col items-center p-1.5 rounded-xl transition-all ${
          isCaptain
            ? 'bg-amber-500/20 border border-amber-500/40 shadow-lg shadow-amber-500/10'
            : 'bg-zinc-900/80 border border-zinc-700/50 hover:border-zinc-600'
        }`}
      >
        {/* Photo / placeholder */}
        {player.photo ? (
          <img
            src={player.photo}
            alt=""
            className="w-10 h-10 rounded-full object-cover mb-1 border border-zinc-700"
          />
        ) : (
          <div
            className={`w-10 h-10 rounded-full ${
              POS_COLORS[player.position] || 'bg-zinc-600'
            } flex items-center justify-center text-xs text-white font-bold mb-1`}
          >
            {player.position}
          </div>
        )}

        {/* Player name (last name) */}
        <p className="text-white text-[9px] font-medium truncate w-full text-center leading-tight">
          {player.name.split(' ').pop()}
        </p>

        {/* Team badge */}
        {player.teamLogo && (
          <img
            src={player.teamLogo}
            alt=""
            className="w-3.5 h-3.5 object-contain mt-0.5"
          />
        )}

        {/* Captain badge */}
        {isCaptain && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-[8px] text-black font-black shadow">
            C
          </span>
        )}

        {/* Points */}
        <span className="text-zinc-500 text-[8px] mt-0.5">{player.points} pts</span>
      </button>

      {/* ── Context Menu ── */}
      {showMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-20"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-30 bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden min-w-[100px]">
            <button
              onClick={() => {
                onCaptain(player.id);
                setShowMenu(false);
              }}
              className="flex items-center gap-1.5 w-full px-3 py-2 text-[11px] text-amber-400 hover:bg-zinc-700/60 whitespace-nowrap transition-colors"
            >
              <span className="w-3 h-3 bg-amber-500/30 rounded-full flex items-center justify-center text-[7px] font-black">
                C
              </span>
              {isCaptain ? 'Remover Capitao' : 'Capitao'}
            </button>
            <button
              onClick={() => {
                onBench();
                setShowMenu(false);
              }}
              className="flex items-center gap-1.5 w-full px-3 py-2 text-[11px] text-zinc-400 hover:bg-zinc-700/60 whitespace-nowrap transition-colors"
            >
              Pro Banco
            </button>
            {/* Swap options – show bench players of same position */}
            {benchPlayers.length > 0 && (
              <>
                <div className="border-t border-zinc-700 mx-2" />
                <p className="px-3 pt-1.5 pb-0.5 text-[9px] text-zinc-600 uppercase tracking-wider">
                  Trocar com
                </p>
                {benchPlayers.map((bp) => (
                  <button
                    key={bp.id}
                    onClick={() => {
                      onSwap(bp);
                      setShowMenu(false);
                    }}
                    className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[11px] text-emerald-400 hover:bg-zinc-700/60 whitespace-nowrap transition-colors"
                  >
                    {bp.name.split(' ').pop()}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Empty Slot ──
function EmptySlot({ pos }: { pos: string }) {
  return (
    <div className="w-[68px] flex flex-col items-center p-1.5 rounded-xl bg-zinc-900/40 border border-dashed border-zinc-700/40">
      <div className="w-10 h-10 rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-600 text-xs mb-1">
        ?
      </div>
      <p className="text-zinc-600 text-[9px]">{POS_LABELS[pos]}</p>
    </div>
  );
}
