'use client';

import { useState } from 'react';
import { ref, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useStore, Player } from '@/store/useStore';

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

export default function LineupScreen() {
  const { user, updateTeam, setCaptain, setConfirmed } = useStore();
  const [formation, setFormation] = useState(user?.formation || '4-3-3');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  if (!user) return null;

  const team = user.team || [];
  const formationSlots = FORMATIONS[formation] || FORMATIONS['4-3-3'];
  const totalStarters = formationSlots.G + formationSlots.D + formationSlots.M + formationSlots.A;

  // Separate starters (first N by position) and bench
  const starters: Record<string, Player[]> = { G: [], D: [], M: [], A: [] };
  const bench: Player[] = [];

  // Group players by position
  const byPosition: Record<string, Player[]> = { G: [], D: [], M: [], A: [] };
  for (const p of team) {
    if (byPosition[p.position]) byPosition[p.position].push(p);
    else byPosition['M'].push(p); // fallback
  }

  // Fill starters based on formation
  for (const pos of ['G', 'D', 'M', 'A'] as const) {
    const needed = formationSlots[pos];
    starters[pos] = byPosition[pos].slice(0, needed);
    bench.push(...byPosition[pos].slice(needed));
  }

  const allStarters = [...starters.G, ...starters.D, ...starters.M, ...starters.A];

  async function handleCravar() {
    if (allStarters.length < totalStarters) {
      setMsg(`Precisa de ${totalStarters} titulares. Tem ${allStarters.length}.`);
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      await set(ref(db, `users/${user!.nickname}/confirmed`), true);
      await set(ref(db, `users/${user!.nickname}/formation`), formation);
      await set(ref(db, `users/${user!.nickname}/captain`), user!.captain ?? null);
      setConfirmed(true);
      setMsg('Escalacao cravada!');
    } catch {
      setMsg('Erro ao cravar escalacao');
    } finally {
      setSaving(false);
    }
  }

  function toggleCaptain(playerId: number) {
    setCaptain(user!.captain === playerId ? null : playerId);
  }

  async function moveToEnd(player: Player) {
    const newTeam = team.filter(p => p.id !== player.id);
    newTeam.push(player);
    updateTeam(newTeam);
    await set(ref(db, `users/${user!.nickname}/team`), newTeam);
  }

  async function moveToStart(player: Player) {
    const newTeam = team.filter(p => p.id !== player.id);
    // Insert at position where this position starts
    const posIndex = newTeam.findIndex(p => p.position === player.position);
    if (posIndex >= 0) {
      newTeam.splice(posIndex, 0, player);
    } else {
      newTeam.unshift(player);
    }
    updateTeam(newTeam);
    await set(ref(db, `users/${user!.nickname}/team`), newTeam);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Escalacao</h2>
        <div className="flex items-center gap-2">
          {user.confirmed && (
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full">
              CRAVADO
            </span>
          )}
          <span className="text-sm text-zinc-400">{formation}</span>
        </div>
      </div>

      {/* Formation Selector */}
      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
        {Object.keys(FORMATIONS).map((f) => (
          <button
            key={f}
            onClick={() => setFormation(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              formation === f
                ? 'bg-emerald-500 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Football Field */}
      <div className="bg-gradient-to-b from-emerald-900/30 via-emerald-800/15 to-emerald-900/30 rounded-2xl border border-emerald-900/30 overflow-hidden">
        {/* Field lines */}
        <div className="relative py-4 px-3">
          {/* Center line */}
          <div className="absolute top-1/2 left-4 right-4 border-t border-emerald-700/20" />
          {/* Center circle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border border-emerald-700/20 rounded-full" />

          {/* Rows: ATK, MID, DEF, GK */}
          <div className="space-y-3">
            {/* Attackers */}
            <div className="flex justify-center gap-2">
              {starters.A.map((p) => (
                <PlayerCard key={p.id} player={p} isCaptain={user.captain === p.id} onCaptain={toggleCaptain} onBench={() => moveToEnd(p)} />
              ))}
              {Array.from({ length: Math.max(0, formationSlots.A - starters.A.length) }).map((_, i) => (
                <EmptySlot key={`ea-${i}`} pos="A" />
              ))}
            </div>

            {/* Midfielders */}
            <div className="flex justify-center gap-2">
              {starters.M.map((p) => (
                <PlayerCard key={p.id} player={p} isCaptain={user.captain === p.id} onCaptain={toggleCaptain} onBench={() => moveToEnd(p)} />
              ))}
              {Array.from({ length: Math.max(0, formationSlots.M - starters.M.length) }).map((_, i) => (
                <EmptySlot key={`em-${i}`} pos="M" />
              ))}
            </div>

            {/* Defenders */}
            <div className="flex justify-center gap-2">
              {starters.D.map((p) => (
                <PlayerCard key={p.id} player={p} isCaptain={user.captain === p.id} onCaptain={toggleCaptain} onBench={() => moveToEnd(p)} />
              ))}
              {Array.from({ length: Math.max(0, formationSlots.D - starters.D.length) }).map((_, i) => (
                <EmptySlot key={`ed-${i}`} pos="D" />
              ))}
            </div>

            {/* Goalkeeper */}
            <div className="flex justify-center gap-2">
              {starters.G.map((p) => (
                <PlayerCard key={p.id} player={p} isCaptain={user.captain === p.id} onCaptain={toggleCaptain} onBench={() => moveToEnd(p)} />
              ))}
              {Array.from({ length: Math.max(0, formationSlots.G - starters.G.length) }).map((_, i) => (
                <EmptySlot key={`eg-${i}`} pos="G" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bench */}
      {bench.length > 0 && (
        <div className="bg-zinc-800/80 rounded-2xl p-4">
          <h3 className="text-white font-semibold text-sm mb-3">Banco ({bench.length})</h3>
          <div className="space-y-1.5">
            {bench.map((p) => (
              <div key={p.id} className="flex items-center gap-2 bg-zinc-700/30 rounded-xl p-2">
                <div className={`w-6 h-6 rounded-full ${POS_COLORS[p.position] || 'bg-zinc-500'} flex items-center justify-center text-[9px] text-white font-bold shrink-0`}>
                  {p.position}
                </div>
                {p.photo ? (
                  <img src={p.photo} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-zinc-600 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{p.name}</p>
                  <p className="text-zinc-500 text-[10px] truncate">{p.team}</p>
                </div>
                <span className="text-zinc-400 text-xs">{p.points} pts</span>
                <button
                  onClick={() => moveToStart(p)}
                  className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] rounded-lg hover:bg-emerald-500/30"
                >
                  Titular
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="bg-zinc-800/80 rounded-2xl p-4">
        <h3 className="text-white font-semibold text-sm mb-3">Resumo</h3>
        <div className="grid grid-cols-4 gap-2">
          {(['G', 'D', 'M', 'A'] as const).map((pos) => {
            const have = byPosition[pos].length;
            const need = formationSlots[pos];
            return (
              <div key={pos} className="bg-zinc-700/50 rounded-xl p-2 text-center">
                <p className="text-zinc-500 text-[10px]">{POS_LABELS[pos]}</p>
                <p className={`font-bold text-sm ${have >= need ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {have}/{need}
                </p>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 mt-3">
          <div className="flex-1 bg-zinc-700/50 rounded-xl p-2 text-center">
            <p className="text-zinc-500 text-[10px]">TOTAL</p>
            <p className="text-white font-bold text-sm">{team.length} jogadores</p>
          </div>
          <div className="flex-1 bg-zinc-700/50 rounded-xl p-2 text-center">
            <p className="text-zinc-500 text-[10px]">ORCAMENTO</p>
            <p className="text-white font-bold text-sm">C$ {user.budget?.toFixed(1)}</p>
          </div>
        </div>
      </div>

      {/* Cravar Button */}
      {msg && (
        <p className={`text-center text-sm ${msg.includes('Erro') || msg.includes('Precisa') ? 'text-red-400' : 'text-emerald-400'}`}>
          {msg}
        </p>
      )}
      <button
        onClick={handleCravar}
        disabled={saving || team.length === 0}
        className={`w-full py-4 font-bold rounded-2xl text-white transition-colors ${
          user.confirmed
            ? 'bg-emerald-700/50 border border-emerald-600/50'
            : 'bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 disabled:text-zinc-500'
        }`}
      >
        {saving ? 'Salvando...' : user.confirmed ? 'Escalacao Cravada' : 'Cravar Escalacao'}
      </button>
    </div>
  );
}

function PlayerCard({ player, isCaptain, onCaptain, onBench }: {
  player: Player;
  isCaptain: boolean;
  onCaptain: (id: number) => void;
  onBench: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={`w-16 flex flex-col items-center p-1.5 rounded-xl transition-colors ${
          isCaptain ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-zinc-800/80 border border-zinc-700/50'
        }`}
      >
        {player.photo ? (
          <img src={player.photo} alt="" className="w-10 h-10 rounded-full object-cover mb-1" />
        ) : (
          <div className={`w-10 h-10 rounded-full ${POS_COLORS[player.position] || 'bg-zinc-600'} flex items-center justify-center text-xs text-white font-bold mb-1`}>
            {player.position}
          </div>
        )}
        <p className="text-white text-[9px] font-medium truncate w-full text-center">
          {player.name.split(' ').pop()}
        </p>
        {isCaptain && <span className="text-amber-400 text-[8px] font-bold">C</span>}
      </button>

      {showMenu && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-10 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
          <button
            onClick={() => { onCaptain(player.id); setShowMenu(false); }}
            className="block w-full px-3 py-1.5 text-[10px] text-amber-400 hover:bg-zinc-700 whitespace-nowrap"
          >
            {isCaptain ? 'Remover C' : 'Capitao'}
          </button>
          <button
            onClick={() => { onBench(); setShowMenu(false); }}
            className="block w-full px-3 py-1.5 text-[10px] text-zinc-400 hover:bg-zinc-700 whitespace-nowrap"
          >
            Pro banco
          </button>
        </div>
      )}
    </div>
  );
}

function EmptySlot({ pos }: { pos: string }) {
  return (
    <div className="w-16 flex flex-col items-center p-1.5 rounded-xl bg-zinc-800/40 border border-dashed border-zinc-700/50">
      <div className="w-10 h-10 rounded-full bg-zinc-700/30 flex items-center justify-center text-zinc-600 text-xs mb-1">
        ?
      </div>
      <p className="text-zinc-600 text-[9px]">{POS_LABELS[pos]}</p>
    </div>
  );
}
