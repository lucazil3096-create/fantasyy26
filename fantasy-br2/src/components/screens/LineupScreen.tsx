'use client';

import { useStore } from '@/store/useStore';

export default function LineupScreen() {
  const { user } = useStore();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Escalacao</h2>
        <span className="text-sm text-zinc-400">
          Formacao: {user?.formation || '4-3-3'}
        </span>
      </div>

      {/* Formation Field */}
      <div className="bg-gradient-to-b from-emerald-900/30 to-emerald-800/10 rounded-2xl p-4 min-h-[400px] border border-emerald-900/30 flex items-center justify-center">
        {user?.team && user.team.length > 0 ? (
          <div className="text-center">
            <p className="text-zinc-400 text-sm mb-2">{user.team.length} jogadores</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {user.team.map((p) => (
                <div
                  key={p.id}
                  className="bg-zinc-800/80 border border-zinc-700 rounded-xl px-3 py-2 text-center"
                >
                  <p className="text-white text-xs font-medium">{p.name}</p>
                  <p className="text-emerald-400 text-[10px]">{p.position}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-zinc-500 text-lg mb-2">Campo Vazio</p>
            <p className="text-zinc-600 text-sm">
              Participe do Draft para escalar seu time
            </p>
          </div>
        )}
      </div>

      {/* Team Stats */}
      <div className="bg-zinc-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-3">Resumo</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-700/50 rounded-xl p-3">
            <p className="text-zinc-400 text-xs">Jogadores</p>
            <p className="text-white font-bold">{user?.team?.length ?? 0}/16</p>
          </div>
          <div className="bg-zinc-700/50 rounded-xl p-3">
            <p className="text-zinc-400 text-xs">Orcamento</p>
            <p className="text-white font-bold">C$ {user?.budget?.toFixed(1) ?? '100.0'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
