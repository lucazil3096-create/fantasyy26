'use client';

import { useState, useEffect, useCallback } from 'react';
import { ref, push, set, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useStore, Player, TradeOffer } from '@/store/useStore';

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function posColor(pos: string): string {
  switch (pos) {
    case 'G': return 'text-amber-400';
    case 'D': return 'text-blue-400';
    case 'M': return 'text-emerald-400';
    case 'A': return 'text-red-400';
    default: return 'text-zinc-400';
  }
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function TradesScreen() {
  const {
    user,
    nickname,
    isAdmin,
    currentLeague,
    trades,
  } = useStore();

  const [tab, setTab] = useState<'received' | 'sent' | 'new'>('received');
  const [allMembers, setAllMembers] = useState<string[]>([]);
  const [targetUser, setTargetUser] = useState('');
  const [targetTeam, setTargetTeam] = useState<Player[]>([]);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [offeredIds, setOfferedIds] = useState<Set<number>>(new Set());
  const [requestedIds, setRequestedIds] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const leagueId = currentLeague?.id;

  // ── Load league members (excluding self) ──
  useEffect(() => {
    if (!leagueId || !nickname) return;
    async function load() {
      try {
        const snap = await get(ref(db, `leagues/${leagueId}/members`));
        const data = snap.val();
        if (data) {
          const nicks = Object.keys(data).filter((n) => n !== nickname);
          setAllMembers(nicks);
        }
      } catch {
        setAllMembers([]);
      }
    }
    load();
  }, [leagueId, nickname]);

  // ── Load target user's team ──
  useEffect(() => {
    if (!targetUser || !leagueId) {
      setTargetTeam([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoadingTarget(true);
      try {
        const snap = await get(ref(db, `leagues/${leagueId}/members/${targetUser}/team`));
        const data = snap.val();
        if (!cancelled) {
          setTargetTeam(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) setTargetTeam([]);
      } finally {
        if (!cancelled) setLoadingTarget(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [targetUser, leagueId]);

  // ── Derived ──
  const myTeam = user?.team || [];

  const receivedTrades = trades.filter(
    (t) => t.to === nickname && t.status === 'pending',
  );
  const sentTrades = trades.filter(
    (t) => t.from === nickname && t.status === 'pending',
  );
  const historyTrades = trades.filter(
    (t) =>
      (t.from === nickname || t.to === nickname) &&
      t.status !== 'pending',
  );

  // For admin: show all pending trades
  const allPending = trades.filter((t) => t.status === 'pending');

  // ── Toggle helpers ──
  const toggleOffered = useCallback((id: number) => {
    setOfferedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }, []);

  const toggleRequested = useCallback((id: number) => {
    setRequestedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }, []);

  // ── Send trade proposal ──
  async function sendTrade() {
    if (!leagueId || !nickname) return;
    if (!targetUser || offeredIds.size === 0 || requestedIds.size === 0) {
      setMsg('Selecione pelo menos 1 jogador de cada lado.');
      return;
    }
    setSending(true);
    setMsg('');
    try {
      const offer: Omit<TradeOffer, 'id'> = {
        from: nickname,
        to: targetUser,
        offeredPlayers: myTeam.filter((p) => offeredIds.has(p.id)),
        requestedPlayers: targetTeam.filter((p) => requestedIds.has(p.id)),
        status: 'pending',
        createdAt: Date.now(),
      };
      await push(ref(db, `leagues/${leagueId}/trades`), offer);
      setMsg('Proposta enviada!');
      setOfferedIds(new Set());
      setRequestedIds(new Set());
      setTargetUser('');
      setTab('sent');
    } catch {
      setMsg('Erro ao enviar proposta.');
    } finally {
      setSending(false);
    }
  }

  // ── Respond to trade (accept / reject) ──
  async function respondTrade(tradeId: string, accept: boolean) {
    if (!leagueId) return;
    setProcessing(tradeId);
    setMsg('');
    try {
      const trade = trades.find((t) => t.id === tradeId);
      if (!trade) return;

      if (accept) {
        // Load both teams fresh from Firebase to avoid stale data
        const [fromSnap, toSnap] = await Promise.all([
          get(ref(db, `leagues/${leagueId}/members/${trade.from}/team`)),
          get(ref(db, `leagues/${leagueId}/members/${trade.to}/team`)),
        ]);

        let fromTeam: Player[] = fromSnap.val() || [];
        let toTeam: Player[] = toSnap.val() || [];

        const offIds = new Set(trade.offeredPlayers.map((p) => p.id));
        const reqIds = new Set(trade.requestedPlayers.map((p) => p.id));

        // Validate that the players still exist on each team
        const fromHasAll = trade.offeredPlayers.every((p) =>
          fromTeam.some((fp) => fp.id === p.id),
        );
        const toHasAll = trade.requestedPlayers.every((p) =>
          toTeam.some((tp) => tp.id === p.id),
        );

        if (!fromHasAll || !toHasAll) {
          setMsg('Alguns jogadores ja nao estao no time. Troca invalidada.');
          await set(ref(db, `leagues/${leagueId}/trades/${tradeId}/status`), 'rejected');
          return;
        }

        // Swap players
        fromTeam = fromTeam.filter((p) => !offIds.has(p.id));
        fromTeam.push(...trade.requestedPlayers);

        toTeam = toTeam.filter((p) => !reqIds.has(p.id));
        toTeam.push(...trade.offeredPlayers);

        // Write both teams and update status atomically-ish
        await Promise.all([
          set(ref(db, `leagues/${leagueId}/members/${trade.from}/team`), fromTeam),
          set(ref(db, `leagues/${leagueId}/members/${trade.to}/team`), toTeam),
          set(ref(db, `leagues/${leagueId}/trades/${tradeId}/status`), 'accepted'),
        ]);

        setMsg('Troca aceita! Os jogadores foram transferidos.');
      } else {
        await set(ref(db, `leagues/${leagueId}/trades/${tradeId}/status`), 'rejected');
        setMsg('Proposta recusada.');
      }
    } catch {
      setMsg('Erro ao processar troca.');
    } finally {
      setProcessing(null);
    }
  }

  // ── Cancel own pending trade ──
  async function cancelTrade(tradeId: string) {
    if (!leagueId) return;
    setProcessing(tradeId);
    try {
      await set(ref(db, `leagues/${leagueId}/trades/${tradeId}/status`), 'rejected');
      setMsg('Proposta cancelada.');
    } catch {
      setMsg('Erro ao cancelar proposta.');
    } finally {
      setProcessing(null);
    }
  }

  // ─── Guard ────────────────────────────────────────────────────────────────

  if (!currentLeague || !nickname) return null;

  // ─── Admin View (read-only) ───────────────────────────────────────────────

  if (isAdmin) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white">Trocas da Liga</h2>
        <p className="text-zinc-500 text-xs">
          Como administrador, voce pode visualizar as trocas mas nao pode propor.
        </p>

        {/* Pending */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-300">
            Pendentes ({allPending.length})
          </h3>
          {allPending.length === 0 ? (
            <EmptyState text="Nenhuma troca pendente" />
          ) : (
            allPending.map((trade) => (
              <TradeCard key={trade.id} trade={trade} viewMode="admin" />
            ))
          )}
        </div>

        {/* History */}
        {trades.filter((t) => t.status !== 'pending').length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-300">Historico</h3>
            {trades
              .filter((t) => t.status !== 'pending')
              .sort((a, b) => b.createdAt - a.createdAt)
              .slice(0, 20)
              .map((trade) => (
                <TradeCard key={trade.id} trade={trade} viewMode="admin" />
              ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Player View ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Trocas</h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-800/80 rounded-xl p-1">
        {([
          { id: 'received' as const, label: 'Recebidas', count: receivedTrades.length },
          { id: 'sent' as const, label: 'Enviadas', count: sentTrades.length },
          { id: 'new' as const, label: 'Nova Proposta', count: 0 },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setMsg(''); }}
            className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-all relative ${
              tab === t.id
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="absolute -top-1.5 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Message banner */}
      {msg && (
        <div
          className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
            msg.includes('Erro') || msg.includes('invalidada')
              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}
        >
          {msg}
        </div>
      )}

      {/* ── Tab: Received ── */}
      {tab === 'received' && (
        <div className="space-y-3">
          {receivedTrades.length === 0 ? (
            <EmptyState text="Nenhuma proposta recebida" />
          ) : (
            receivedTrades
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((trade) => (
                <TradeCard
                  key={trade.id}
                  trade={trade}
                  viewMode="received"
                  onRespond={respondTrade}
                  processing={processing}
                />
              ))
          )}

          {/* History for received */}
          {historyTrades.filter((t) => t.to === nickname).length > 0 && (
            <>
              <div className="border-t border-zinc-800 pt-3">
                <h3 className="text-xs font-semibold text-zinc-500 mb-2">HISTORICO</h3>
              </div>
              {historyTrades
                .filter((t) => t.to === nickname)
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, 10)
                .map((trade) => (
                  <TradeCard key={trade.id} trade={trade} viewMode="history" />
                ))}
            </>
          )}
        </div>
      )}

      {/* ── Tab: Sent ── */}
      {tab === 'sent' && (
        <div className="space-y-3">
          {sentTrades.length === 0 ? (
            <EmptyState text="Nenhuma proposta enviada" />
          ) : (
            sentTrades
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((trade) => (
                <TradeCard
                  key={trade.id}
                  trade={trade}
                  viewMode="sent"
                  onCancel={cancelTrade}
                  processing={processing}
                />
              ))
          )}

          {/* History for sent */}
          {historyTrades.filter((t) => t.from === nickname).length > 0 && (
            <>
              <div className="border-t border-zinc-800 pt-3">
                <h3 className="text-xs font-semibold text-zinc-500 mb-2">HISTORICO</h3>
              </div>
              {historyTrades
                .filter((t) => t.from === nickname)
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, 10)
                .map((trade) => (
                  <TradeCard key={trade.id} trade={trade} viewMode="history" />
                ))}
            </>
          )}
        </div>
      )}

      {/* ── Tab: New Proposal ── */}
      {tab === 'new' && (
        <div className="space-y-4">
          {/* Select target user */}
          <div className="bg-zinc-800/80 rounded-2xl p-4">
            <p className="text-zinc-300 text-sm font-medium mb-3">Propor troca com:</p>
            {allMembers.length === 0 ? (
              <p className="text-zinc-500 text-xs">Nenhum outro membro na liga</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {allMembers.map((nick) => (
                  <button
                    key={nick}
                    onClick={() => {
                      setTargetUser(nick === targetUser ? '' : nick);
                      setRequestedIds(new Set());
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      targetUser === nick
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                        : 'bg-zinc-700/60 text-zinc-400 hover:bg-zinc-600 hover:text-white'
                    }`}
                  >
                    {nick}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* My players to offer */}
          <div className="bg-zinc-800/80 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-zinc-300">
                Seus jogadores
              </p>
              {offeredIds.size > 0 && (
                <span className="text-red-400 text-xs font-bold">
                  {offeredIds.size} selecionado{offeredIds.size !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {myTeam.length === 0 ? (
              <p className="text-zinc-500 text-xs">Voce nao tem jogadores no time</p>
            ) : (
              <div className="space-y-1 max-h-56 overflow-y-auto hide-scrollbar">
                {myTeam.map((p) => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    selected={offeredIds.has(p.id)}
                    onToggle={() => toggleOffered(p.id)}
                    selectedColor="red"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Target user's players to request */}
          {targetUser && (
            <div className="bg-zinc-800/80 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-zinc-300">
                  Jogadores de <span className="text-emerald-400">{targetUser}</span>
                </p>
                {requestedIds.size > 0 && (
                  <span className="text-emerald-400 text-xs font-bold">
                    {requestedIds.size} selecionado{requestedIds.size !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {loadingTarget ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : targetTeam.length === 0 ? (
                <p className="text-zinc-500 text-xs">Sem jogadores no time</p>
              ) : (
                <div className="space-y-1 max-h-56 overflow-y-auto hide-scrollbar">
                  {targetTeam.map((p) => (
                    <PlayerRow
                      key={p.id}
                      player={p}
                      selected={requestedIds.has(p.id)}
                      onToggle={() => toggleRequested(p.id)}
                      selectedColor="emerald"
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Summary & Send */}
          {(offeredIds.size > 0 || requestedIds.size > 0) && (
            <div className="bg-zinc-800/80 rounded-2xl p-4 border border-zinc-700/50">
              <p className="text-white text-sm font-semibold mb-3">Resumo da Proposta</p>

              <div className="flex gap-3 mb-4">
                {/* Offered */}
                <div className="flex-1 bg-red-500/5 rounded-xl p-3 border border-red-500/10">
                  <p className="text-red-400 text-[10px] font-bold uppercase tracking-wider mb-2">
                    Voce oferece ({offeredIds.size})
                  </p>
                  {myTeam.filter((p) => offeredIds.has(p.id)).map((p) => (
                    <div key={p.id} className="flex items-center gap-1.5 py-0.5">
                      <span className={`text-[10px] font-medium ${posColor(p.position)}`}>
                        {p.position}
                      </span>
                      <span className="text-zinc-300 text-xs truncate">{p.name}</span>
                    </div>
                  ))}
                </div>

                {/* Arrow */}
                <div className="flex items-center text-zinc-600 text-lg">&#8644;</div>

                {/* Requested */}
                <div className="flex-1 bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/10">
                  <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-2">
                    Voce pede ({requestedIds.size})
                  </p>
                  {targetTeam.filter((p) => requestedIds.has(p.id)).map((p) => (
                    <div key={p.id} className="flex items-center gap-1.5 py-0.5">
                      <span className={`text-[10px] font-medium ${posColor(p.position)}`}>
                        {p.position}
                      </span>
                      <span className="text-zinc-300 text-xs truncate">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={sendTrade}
                disabled={sending || !targetUser || offeredIds.size === 0 || requestedIds.size === 0}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-xl transition-all active:scale-[0.98]"
              >
                {sending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enviando...
                  </span>
                ) : (
                  'Enviar Proposta'
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-zinc-800/60 rounded-2xl p-8 text-center">
      <div className="text-zinc-600 text-3xl mb-2">&#8644;</div>
      <p className="text-zinc-500 text-sm">{text}</p>
    </div>
  );
}

function PlayerRow({
  player,
  selected,
  onToggle,
  selectedColor,
}: {
  player: Player;
  selected: boolean;
  onToggle: () => void;
  selectedColor: 'red' | 'emerald';
}) {
  const borderClass = selected
    ? selectedColor === 'red'
      ? 'bg-red-500/10 border border-red-500/30'
      : 'bg-emerald-500/10 border border-emerald-500/30'
    : 'bg-zinc-700/20 border border-transparent hover:bg-zinc-700/40';

  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-2 p-2.5 rounded-xl text-left transition-all ${borderClass}`}
    >
      {/* Position badge */}
      <span className={`text-[10px] font-bold w-4 text-center ${posColor(player.position)}`}>
        {player.position}
      </span>

      {/* Photo */}
      {player.photo ? (
        <img
          src={player.photo}
          alt=""
          className="w-7 h-7 rounded-full object-cover bg-zinc-700"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-500 text-[10px] font-bold">
          {player.name.charAt(0)}
        </div>
      )}

      {/* Name & Team */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-medium truncate">{player.name}</p>
        <p className="text-zinc-500 text-[10px] truncate">{player.team}</p>
      </div>

      {/* Selection indicator */}
      <div
        className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
          selected
            ? selectedColor === 'red'
              ? 'bg-red-500 text-white'
              : 'bg-emerald-500 text-white'
            : 'border border-zinc-600'
        }`}
      >
        {selected && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    </button>
  );
}

function TradeCard({
  trade,
  viewMode,
  onRespond,
  onCancel,
  processing,
}: {
  trade: TradeOffer;
  viewMode: 'received' | 'sent' | 'history' | 'admin';
  onRespond?: (id: string, accept: boolean) => void;
  onCancel?: (id: string) => void;
  processing?: string | null;
}) {
  const isProcessing = processing === trade.id;

  const statusBadge = () => {
    if (trade.status === 'accepted') {
      return (
        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
          ACEITA
        </span>
      );
    }
    if (trade.status === 'rejected') {
      return (
        <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
          RECUSADA
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
        PENDENTE
      </span>
    );
  };

  // Label for each column depends on viewMode
  let leftLabel = '';
  let rightLabel = '';
  let leftPlayers = trade.offeredPlayers;
  let rightPlayers = trade.requestedPlayers;

  if (viewMode === 'received') {
    leftLabel = 'VOCE RECEBE';
    rightLabel = 'VOCE ENTREGA';
    leftPlayers = trade.offeredPlayers;
    rightPlayers = trade.requestedPlayers;
  } else if (viewMode === 'sent') {
    leftLabel = 'VOCE OFERECE';
    rightLabel = 'VOCE PEDE';
    leftPlayers = trade.offeredPlayers;
    rightPlayers = trade.requestedPlayers;
  } else {
    // history / admin
    leftLabel = `${trade.from} oferece`;
    rightLabel = `${trade.to} oferece`;
    leftPlayers = trade.offeredPlayers;
    rightPlayers = trade.requestedPlayers;
  }

  return (
    <div className={`bg-zinc-800/80 rounded-2xl p-4 transition-all ${
      trade.status !== 'pending' ? 'opacity-70' : ''
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {viewMode === 'received' && (
            <p className="text-zinc-400 text-xs">
              De: <span className="text-white font-medium">{trade.from}</span>
            </p>
          )}
          {viewMode === 'sent' && (
            <p className="text-zinc-400 text-xs">
              Para: <span className="text-white font-medium">{trade.to}</span>
            </p>
          )}
          {(viewMode === 'admin' || viewMode === 'history') && (
            <p className="text-zinc-400 text-xs">
              <span className="text-white font-medium">{trade.from}</span>
              {' '}&#8594;{' '}
              <span className="text-white font-medium">{trade.to}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-zinc-600 text-[10px]">{timeAgo(trade.createdAt)}</span>
          {(viewMode === 'history' || viewMode === 'admin') && statusBadge()}
        </div>
      </div>

      {/* Player columns */}
      <div className="flex gap-3 mb-3">
        <div className="flex-1 bg-zinc-900/50 rounded-xl p-3">
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${
            viewMode === 'received' ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {leftLabel}
          </p>
          {leftPlayers.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5 py-0.5">
              <span className={`text-[10px] font-medium ${posColor(p.position)}`}>{p.position}</span>
              <span className="text-zinc-300 text-xs truncate">{p.name}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center text-zinc-600">&#8644;</div>

        <div className="flex-1 bg-zinc-900/50 rounded-xl p-3">
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${
            viewMode === 'received' ? 'text-red-400' : 'text-emerald-400'
          }`}>
            {rightLabel}
          </p>
          {rightPlayers.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5 py-0.5">
              <span className={`text-[10px] font-medium ${posColor(p.position)}`}>{p.position}</span>
              <span className="text-zinc-300 text-xs truncate">{p.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      {viewMode === 'received' && trade.status === 'pending' && onRespond && (
        <div className="flex gap-2">
          <button
            onClick={() => onRespond(trade.id, true)}
            disabled={isProcessing}
            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white text-sm font-bold rounded-xl transition-all active:scale-[0.98]"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-1.5">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </span>
            ) : (
              'Aceitar'
            )}
          </button>
          <button
            onClick={() => onRespond(trade.id, false)}
            disabled={isProcessing}
            className="flex-1 py-2.5 bg-red-500/15 hover:bg-red-500/25 disabled:opacity-50 text-red-400 text-sm font-bold rounded-xl transition-all active:scale-[0.98]"
          >
            Recusar
          </button>
        </div>
      )}

      {viewMode === 'sent' && trade.status === 'pending' && onCancel && (
        <div className="flex items-center justify-between">
          <p className="text-amber-400/70 text-[10px] font-medium">Aguardando resposta...</p>
          <button
            onClick={() => onCancel(trade.id)}
            disabled={isProcessing}
            className="px-3 py-1.5 bg-zinc-700/50 hover:bg-zinc-700 disabled:opacity-50 text-zinc-400 text-xs font-medium rounded-lg transition-all"
          >
            {isProcessing ? 'Cancelando...' : 'Cancelar'}
          </button>
        </div>
      )}
    </div>
  );
}
