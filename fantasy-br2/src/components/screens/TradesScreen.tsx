'use client';

export default function TradesScreen() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Trocas</h2>

      <div className="bg-zinc-800 rounded-2xl p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-zinc-700 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">T</span>
        </div>
        <h3 className="text-white font-semibold text-lg mb-2">Mercado de Trocas</h3>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Aqui voce podera propor e aceitar trocas de jogadores com outros
          participantes. Disponivel apos o Draft.
        </p>
      </div>

      {/* Trade Rules */}
      <div className="bg-zinc-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-3">Como funciona</h3>
        <ul className="space-y-2 text-zinc-400 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-emerald-400">-</span>
            <span>Proponha trocas 1 por 1 ou multiplas</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400">-</span>
            <span>O outro usuario aceita ou recusa</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400">-</span>
            <span>Limite de trocas por mes definido pelo admin</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
