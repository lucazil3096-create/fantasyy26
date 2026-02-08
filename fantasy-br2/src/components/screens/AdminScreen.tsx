'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ref, set, get, update, remove } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useStore, Player, UserData, TradeOffer } from '@/store/useStore';
import { DEFAULT_APPEARANCE, AppearanceConfig } from '@/lib/appearance';
import { ScoringRules, DEFAULT_SCORING } from '@/lib/scoring';

// ─── Types ───────────────────────────────────────────────────────────────────

type AdminTab =
  | 'main'
  | 'temporada'
  | 'membros'
  | 'draft'
  | 'jogadores'
  | 'pontuacao'
  | 'mercado'
  | 'aparencia'
  | 'configuracoes';

interface MemberEntry {
  nickname: string;
  totalPoints: number;
  team: Player[];
  confirmed: boolean;
  formation: string;
  captain: number | null;
}

// ─── Tab Metadata ────────────────────────────────────────────────────────────

const TAB_META: Record<
  Exclude<AdminTab, 'main'>,
  { label: string; description: string; icon: string; color: string }
> = {
  temporada: {
    label: 'Temporada',
    description: 'Rodada, status, datas',
    icon: '\u{1F4C5}',
    color: 'text-blue-400',
  },
  membros: {
    label: 'Membros',
    description: 'Gerenciar membros',
    icon: '\u{1F465}',
    color: 'text-violet-400',
  },
  draft: {
    label: 'Draft',
    description: 'Iniciar e gerenciar',
    icon: '\u{1F3AF}',
    color: 'text-emerald-400',
  },
  jogadores: {
    label: 'Jogadores',
    description: 'Sync API-Football',
    icon: '\u26BD',
    color: 'text-cyan-400',
  },
  pontuacao: {
    label: 'Pontuacao',
    description: 'Regras e calcular',
    icon: '\u{1F4CA}',
    color: 'text-amber-400',
  },
  mercado: {
    label: 'Mercado',
    description: 'Trocas e mercado',
    icon: '\u{1F4B1}',
    color: 'text-pink-400',
  },
  aparencia: {
    label: 'Aparencia',
    description: 'Logo, cores, fontes',
    icon: '\u{1F3A8}',
    color: 'text-orange-400',
  },
  configuracoes: {
    label: 'Configuracoes',
    description: 'Nome, codigo, excluir',
    icon: '\u2699\uFE0F',
    color: 'text-zinc-300',
  },
};

// ─── Helper: position color ──────────────────────────────────────────────────

function posColor(pos: string): string {
  switch (pos) {
    case 'G': return 'text-amber-400';
    case 'D': return 'text-blue-400';
    case 'M': return 'text-emerald-400';
    case 'A': return 'text-red-400';
    default: return 'text-zinc-400';
  }
}

// ─── Helper: map API position to code ────────────────────────────────────────

function mapPosition(pos: string): string {
  if (!pos) return 'M';
  const p = pos.toLowerCase();
  if (p.includes('goalkeeper')) return 'G';
  if (p.includes('defender')) return 'D';
  if (p.includes('midfielder')) return 'M';
  if (p.includes('attacker') || p.includes('forward')) return 'A';
  return 'M';
}

// ─── Helper: generate access code ────────────────────────────────────────────

function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN ADMIN SCREEN
// ═════════════════════════════════════════════════════════════════════════════

export default function AdminScreen() {
  const {
    isAdmin,
    nickname,
    currentLeague,
    players,
    appearance,
    setAppearance,
    settings,
    setSettings,
    round,
    setRound,
  } = useStore();

  const [tab, setTab] = useState<AdminTab>('main');
  const [loading, setLoading] = useState('');
  const [msg, setMsg] = useState('');

  // ── Guard ──
  if (!isAdmin) {
    return (
      <div className="bg-zinc-800 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3 opacity-50">&#128274;</div>
        <p className="text-red-400 font-semibold mb-1">Acesso Restrito</p>
        <p className="text-zinc-500 text-sm">
          Apenas o administrador da liga pode acessar este painel.
        </p>
      </div>
    );
  }

  if (!currentLeague) {
    return (
      <div className="bg-zinc-800 rounded-2xl p-8 text-center">
        <p className="text-zinc-400">Nenhuma liga selecionada.</p>
      </div>
    );
  }

  // After the null guard, TypeScript still sees currentLeague as possibly null
  // inside nested function components. We assign a non-null const here.
  const league = currentLeague;
  const leagueId = league.id;

  // ── Message banner ──
  function MessageBanner() {
    if (!msg) return null;
    const isError = msg.toLowerCase().includes('erro') || msg.toLowerCase().includes('falha');
    return (
      <div
        className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center justify-between ${
          isError
            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        }`}
      >
        <span>{msg}</span>
        <button
          onClick={() => setMsg('')}
          className="text-zinc-500 hover:text-zinc-300 text-xs ml-3 shrink-0"
        >
          &#10005;
        </button>
      </div>
    );
  }

  // ── Tab header with back button ──
  function TabHeader({ title }: { title: string }) {
    return (
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <button
          onClick={() => { setTab('main'); setMsg(''); }}
          className="text-zinc-400 hover:text-zinc-200 text-sm flex items-center gap-1 transition-colors"
        >
          <span>&#8592;</span> Voltar
        </button>
      </div>
    );
  }

  // ── Section card ──
  function Section({ title, children }: { title?: string; children: React.ReactNode }) {
    return (
      <div className="bg-zinc-800/80 rounded-2xl p-4 space-y-3">
        {title && <p className="text-zinc-300 text-sm font-semibold">{title}</p>}
        {children}
      </div>
    );
  }

  // ── Styled text input ──
  function Input({
    label,
    value,
    onChange,
    type = 'text',
    placeholder,
    disabled,
  }: {
    label?: string;
    value: string | number;
    onChange: (val: string) => void;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
  }) {
    return (
      <div>
        {label && <label className="text-zinc-500 text-xs mb-1 block">{label}</label>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 bg-zinc-700 rounded-xl text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
    );
  }

  // ── Action button ──
  function ActionButton({
    onClick,
    disabled,
    loadingKey,
    label,
    loadingLabel,
    variant = 'primary',
    className: extraClass,
  }: {
    onClick: () => void;
    disabled?: boolean;
    loadingKey?: string;
    label: string;
    loadingLabel?: string;
    variant?: 'primary' | 'secondary' | 'danger' | 'warning';
    className?: string;
  }) {
    const isLoading = loadingKey ? loading === loadingKey : false;
    const variants = {
      primary: 'bg-emerald-500 hover:bg-emerald-600 text-white',
      secondary: 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300',
      danger: 'bg-red-600/30 hover:bg-red-600/50 text-red-400',
      warning: 'bg-amber-600 hover:bg-amber-700 text-white',
    };
    return (
      <button
        onClick={onClick}
        disabled={disabled || isLoading}
        className={`py-3 font-semibold rounded-xl text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${extraClass || 'w-full'}`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            {loadingLabel || 'Carregando...'}
          </span>
        ) : (
          label
        )}
      </button>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // TAB 1: MAIN DASHBOARD
  // ═════════════════════════════════════════════════════════════════════════════

  function MainTab() {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <span className="text-amber-400 text-lg font-bold">A</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Painel Admin</h2>
            <p className="text-zinc-500 text-xs">{league.name}</p>
          </div>
        </div>

        <MessageBanner />

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-800/80 rounded-2xl p-4">
            <p className="text-zinc-500 text-xs mb-1">Codigo de Acesso</p>
            <p className="text-amber-400 font-mono font-bold text-lg tracking-widest">
              {league.accessCode}
            </p>
          </div>
          <div className="bg-zinc-800/80 rounded-2xl p-4">
            <p className="text-zinc-500 text-xs mb-1">Temporada</p>
            <p className="text-white font-bold text-lg">{league.season}</p>
          </div>
          <div className="bg-zinc-800/80 rounded-2xl p-4">
            <p className="text-zinc-500 text-xs mb-1">Rodada Atual</p>
            <p className="text-white font-bold text-lg">
              {round.number}
              <span className={`text-xs ml-2 ${
                round.status === 'active' ? 'text-emerald-400' :
                round.status === 'finished' ? 'text-zinc-400' :
                'text-amber-400'
              }`}>
                {round.status === 'active' ? 'ATIVA' :
                 round.status === 'finished' ? 'ENCERRADA' :
                 'AGUARDANDO'}
              </span>
            </p>
          </div>
          <div className="bg-zinc-800/80 rounded-2xl p-4">
            <p className="text-zinc-500 text-xs mb-1">Jogadores</p>
            <p className="text-emerald-400 font-bold text-lg">{players.length}</p>
          </div>
        </div>

        {/* Tab Grid */}
        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(TAB_META) as [Exclude<AdminTab, 'main'>, typeof TAB_META[keyof typeof TAB_META]][] ).map(
            ([key, meta]) => (
              <button
                key={key}
                onClick={() => { setTab(key); setMsg(''); }}
                className="bg-zinc-800/80 hover:bg-zinc-700/80 rounded-2xl p-4 text-left transition-all active:scale-[0.97] border border-transparent hover:border-zinc-700"
              >
                <span className="text-xl mb-2 block">{meta.icon}</span>
                <p className={`font-semibold text-sm ${meta.color}`}>{meta.label}</p>
                <p className="text-zinc-500 text-[10px] mt-0.5 leading-tight">{meta.description}</p>
              </button>
            ),
          )}
        </div>

        {/* System info footer */}
        <div className="bg-zinc-800/50 rounded-2xl p-4">
          <h3 className="text-zinc-400 text-xs font-semibold mb-2">INFO DO SISTEMA</h3>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Admin</span>
              <span className="text-zinc-300">{nickname}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Liga ID</span>
              <span className="text-zinc-500 font-mono text-[10px]">{leagueId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Max Membros</span>
              <span className="text-zinc-300">{league.maxMembers}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Mercado</span>
              <span className={settings.marketOpen ? 'text-emerald-400' : 'text-red-400'}>
                {settings.marketOpen ? 'Aberto' : 'Fechado'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // TAB 2: TEMPORADA (Season Management)
  // ═════════════════════════════════════════════════════════════════════════════

  function TemporadaTab() {
    const [season, setSeason] = useState(league.season);
    const [roundNum, setRoundNum] = useState(round.number);
    const [roundStatus, setRoundStatus] = useState<'waiting' | 'active' | 'finished'>(round.status);
    const [nextGame, setNextGame] = useState(round.nextGameDate || '');
    const [deadline, setDeadline] = useState(round.deadline || '');

    async function saveSeason() {
      setLoading('save-season');
      try {
        await update(ref(db, `leagues/${leagueId}`), {
          'info/season': season,
        });
        setMsg('Temporada atualizada!');
      } catch {
        setMsg('Erro ao salvar temporada.');
      } finally {
        setLoading('');
      }
    }

    async function saveRound() {
      setLoading('save-round');
      try {
        const roundData = {
          number: roundNum,
          status: roundStatus,
          deadline: deadline || null,
          nextGameDate: nextGame || null,
        };
        await set(ref(db, `leagues/${leagueId}/round`), roundData);
        setRound(roundData);
        setMsg('Rodada atualizada!');
      } catch {
        setMsg('Erro ao salvar rodada.');
      } finally {
        setLoading('');
      }
    }

    async function advanceRound() {
      setLoading('advance-round');
      try {
        const newRound = {
          number: round.number + 1,
          status: 'waiting' as const,
          deadline: null,
          nextGameDate: null,
        };

        // Update round
        await set(ref(db, `leagues/${leagueId}/round`), newRound);

        // Un-confirm all members
        const membersSnap = await get(ref(db, `leagues/${leagueId}/members`));
        const membersData = membersSnap.val();
        if (membersData) {
          const updates: Record<string, boolean> = {};
          Object.keys(membersData).forEach((nick) => {
            updates[`leagues/${leagueId}/members/${nick}/confirmed`] = false;
          });
          await update(ref(db), updates);
        }

        setRound(newRound);
        setRoundNum(newRound.number);
        setRoundStatus(newRound.status);
        setNextGame('');
        setDeadline('');
        setMsg(`Avancou para rodada ${newRound.number}! Todos os membros foram desconfirmados.`);
      } catch {
        setMsg('Erro ao avancar rodada.');
      } finally {
        setLoading('');
      }
    }

    return (
      <div className="space-y-4">
        <TabHeader title="Temporada" />
        <MessageBanner />

        {/* Season */}
        <Section title="Temporada / Ano">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                label="Ano da temporada"
                type="number"
                value={season}
                onChange={(v) => setSeason(parseInt(v) || 2026)}
              />
            </div>
            <ActionButton
              onClick={saveSeason}
              loadingKey="save-season"
              label="Salvar"
              loadingLabel="Salvando..."
              className="px-6 shrink-0"
            />
          </div>
        </Section>

        {/* Round Config */}
        <Section title="Rodada Atual">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Numero da Rodada"
              type="number"
              value={roundNum}
              onChange={(v) => setRoundNum(parseInt(v) || 1)}
            />
            <div>
              <label className="text-zinc-500 text-xs mb-1 block">Status</label>
              <select
                value={roundStatus}
                onChange={(e) => setRoundStatus(e.target.value as 'waiting' | 'active' | 'finished')}
                className="w-full px-3 py-2 bg-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              >
                <option value="waiting">Aguardando</option>
                <option value="active">Ativa</option>
                <option value="finished">Encerrada</option>
              </select>
            </div>
          </div>

          <Input
            label="Proximo Jogo (data/hora)"
            type="datetime-local"
            value={nextGame}
            onChange={setNextGame}
          />

          <Input
            label="Deadline da Rodada"
            type="datetime-local"
            value={deadline}
            onChange={setDeadline}
          />

          <ActionButton
            onClick={saveRound}
            loadingKey="save-round"
            label="Salvar Rodada"
            loadingLabel="Salvando..."
          />
        </Section>

        {/* Advance Round */}
        <Section title="Avancar Rodada">
          <p className="text-zinc-500 text-xs leading-relaxed">
            Incrementa o numero da rodada, reseta o status para &quot;aguardando&quot; e desconfirma
            todos os membros da liga. Esta acao nao pode ser desfeita.
          </p>
          <div className="bg-zinc-900/50 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-zinc-400 text-xs">Rodada atual</p>
              <p className="text-white font-bold text-lg">{round.number}</p>
            </div>
            <div className="text-zinc-600 text-xl">&#8594;</div>
            <div>
              <p className="text-zinc-400 text-xs">Proxima rodada</p>
              <p className="text-emerald-400 font-bold text-lg">{round.number + 1}</p>
            </div>
          </div>
          <ActionButton
            onClick={advanceRound}
            loadingKey="advance-round"
            label={`Avancar para Rodada ${round.number + 1}`}
            loadingLabel="Avancando..."
            variant="warning"
          />
        </Section>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // TAB 3: MEMBROS (Member Management)
  // ═════════════════════════════════════════════════════════════════════════════

  function MembrosTab() {
    const [members, setMembers] = useState<MemberEntry[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(true);
    const [viewingTeam, setViewingTeam] = useState<string | null>(null);
    const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

    const loadMembers = useCallback(async () => {
      setLoadingMembers(true);
      try {
        const snap = await get(ref(db, `leagues/${leagueId}/members`));
        const data = snap.val();
        if (data) {
          const list: MemberEntry[] = Object.entries(data).map(
            ([nick, val]: [string, unknown]) => {
              const v = val as Partial<UserData>;
              return {
                nickname: nick,
                totalPoints: v.totalPoints || 0,
                team: Array.isArray(v.team) ? v.team : [],
                confirmed: v.confirmed || false,
                formation: v.formation || '4-3-3',
                captain: v.captain || null,
              };
            },
          );
          list.sort((a, b) => b.totalPoints - a.totalPoints);
          setMembers(list);
        } else {
          setMembers([]);
        }
      } catch {
        setMsg('Erro ao carregar membros.');
      } finally {
        setLoadingMembers(false);
      }
    }, []);

    useEffect(() => {
      loadMembers();
    }, [loadMembers]);

    async function resetPoints(nick: string) {
      setLoading(`reset-${nick}`);
      try {
        await set(ref(db, `leagues/${leagueId}/members/${nick}/totalPoints`), 0);
        setMembers((prev) =>
          prev.map((m) => (m.nickname === nick ? { ...m, totalPoints: 0 } : m)),
        );
        setMsg(`Pontos de ${nick} resetados!`);
      } catch {
        setMsg(`Erro ao resetar pontos de ${nick}.`);
      } finally {
        setLoading('');
      }
    }

    async function removeMember(nick: string) {
      setLoading(`remove-${nick}`);
      try {
        await remove(ref(db, `leagues/${leagueId}/members/${nick}`));
        setMembers((prev) => prev.filter((m) => m.nickname !== nick));
        setConfirmRemove(null);
        setMsg(`${nick} removido da liga.`);
      } catch {
        setMsg(`Erro ao remover ${nick}.`);
      } finally {
        setLoading('');
      }
    }

    // Viewing a member's team
    if (viewingTeam) {
      const member = members.find((m) => m.nickname === viewingTeam);
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">
              Time de {viewingTeam}
            </h3>
            <button
              onClick={() => setViewingTeam(null)}
              className="text-zinc-400 hover:text-zinc-200 text-sm flex items-center gap-1 transition-colors"
            >
              <span>&#8592;</span> Voltar
            </button>
          </div>

          {/* Team info */}
          <div className="bg-zinc-800/80 rounded-2xl p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400">Formacao</span>
              <span className="text-white">{member?.formation || '---'}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400">Pontos Totais</span>
              <span className="text-emerald-400 font-bold">{member?.totalPoints || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Status</span>
              <span className={member?.confirmed ? 'text-emerald-400' : 'text-amber-400'}>
                {member?.confirmed ? 'Confirmado' : 'Nao confirmado'}
              </span>
            </div>
          </div>

          {/* Player list */}
          {member && member.team.length > 0 ? (
            <div className="space-y-1.5">
              {member.team.map((p) => (
                <div
                  key={p.id}
                  className={`bg-zinc-800/80 rounded-xl p-3 flex items-center gap-3 ${
                    member.captain === p.id ? 'ring-1 ring-amber-500/50' : ''
                  }`}
                >
                  <span className={`text-xs font-bold w-4 text-center ${posColor(p.position)}`}>
                    {p.position}
                  </span>
                  {p.photo ? (
                    <img
                      src={p.photo}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover bg-zinc-700"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-500 text-xs font-bold">
                      {p.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {p.name}
                      {member.captain === p.id && (
                        <span className="text-amber-400 text-[10px] ml-1.5 font-bold">C</span>
                      )}
                    </p>
                    <p className="text-zinc-500 text-xs truncate">{p.team}</p>
                  </div>
                  <span className="text-zinc-400 text-xs">{p.points} pts</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-zinc-800/60 rounded-2xl p-8 text-center">
              <p className="text-zinc-500 text-sm">Nenhum jogador no time</p>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <TabHeader title="Membros" />
        <MessageBanner />

        {loadingMembers ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="bg-zinc-800/60 rounded-2xl p-8 text-center">
            <p className="text-zinc-500 text-sm">Nenhum membro na liga.</p>
          </div>
        ) : (
          <>
            <div className="bg-zinc-800/50 rounded-xl px-4 py-2.5 flex justify-between text-xs">
              <span className="text-zinc-500">{members.length} membro{members.length !== 1 ? 's' : ''}</span>
              <span className="text-zinc-500">Max: {league.maxMembers}</span>
            </div>

            <div className="space-y-2">
              {members.map((m, idx) => (
                <div
                  key={m.nickname}
                  className="bg-zinc-800/80 rounded-2xl p-4"
                >
                  <div className="flex items-center gap-3 mb-2">
                    {/* Rank */}
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-amber-500/20 text-amber-400' :
                      idx === 1 ? 'bg-zinc-400/20 text-zinc-300' :
                      idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-zinc-700/50 text-zinc-500'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{m.nickname}</p>
                      <p className="text-zinc-500 text-[10px]">
                        {m.team.length} jogador{m.team.length !== 1 ? 'es' : ''} | {m.formation}
                        {m.confirmed && <span className="text-emerald-400 ml-1">&#10003;</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400 font-bold text-sm">{m.totalPoints}</p>
                      <p className="text-zinc-600 text-[10px]">pts</p>
                    </div>
                  </div>

                  {/* Member actions */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setViewingTeam(m.nickname)}
                      className="flex-1 py-2 bg-zinc-700/50 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors"
                    >
                      Ver Time
                    </button>
                    <button
                      onClick={() => resetPoints(m.nickname)}
                      disabled={loading === `reset-${m.nickname}`}
                      className="flex-1 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      {loading === `reset-${m.nickname}` ? 'Resetando...' : 'Resetar Pts'}
                    </button>
                    {confirmRemove === m.nickname ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => removeMember(m.nickname)}
                          disabled={loading === `remove-${m.nickname}`}
                          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          {loading === `remove-${m.nickname}` ? '...' : 'Sim'}
                        </button>
                        <button
                          onClick={() => setConfirmRemove(null)}
                          className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg text-xs transition-colors"
                        >
                          Nao
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRemove(m.nickname)}
                        className="flex-1 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs font-medium transition-colors"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // TAB 4: DRAFT (Draft Management)
  // ═════════════════════════════════════════════════════════════════════════════

  function DraftTab() {
    const [timerSec, setTimerSec] = useState(settings.draftTimerSeconds);
    const [totalRounds, setTotalRounds] = useState(settings.draftRounds);
    const [draftStatus, setDraftStatus] = useState('');
    const [draftInfo, setDraftInfo] = useState<{
      status: string;
      currentPick: number;
      totalPicks: number;
      participants: string[];
    } | null>(null);

    // Load current draft status on mount
    useEffect(() => {
      async function loadDraftInfo() {
        try {
          const snap = await get(ref(db, `leagues/${leagueId}/draft`));
          const data = snap.val();
          if (data && data.status) {
            setDraftInfo({
              status: data.status,
              currentPick: data.currentPick || 0,
              totalPicks: (data.participants?.length || 0) * (data.totalRounds || 0),
              participants: data.participants || [],
            });
          }
        } catch {
          // ignore
        }
      }
      loadDraftInfo();
    }, []);

    async function startDraft() {
      setLoading('draft-start');
      setDraftStatus('Carregando membros...');
      try {
        // Get all league members
        const membersSnap = await get(ref(db, `leagues/${leagueId}/members`));
        const membersData = membersSnap.val() || {};
        const nicknames = Object.keys(membersData);

        if (nicknames.length < 2) {
          setDraftStatus('Precisa de pelo menos 2 membros registrados na liga.');
          setLoading('');
          return;
        }

        // Shuffle for random order
        const shuffled = [...nicknames].sort(() => Math.random() - 0.5);

        // Get all player IDs
        const availableIds = players.map((p) => p.id);

        setDraftStatus(`Iniciando draft com ${shuffled.length} participantes...`);

        const draftData = {
          status: 'active',
          participants: shuffled,
          currentPick: 0,
          totalRounds,
          pickTimerSeconds: timerSec,
          pickStartedAt: Date.now(),
          picks: {},
          availablePlayers: availableIds,
        };

        await set(ref(db, `leagues/${leagueId}/draft`), draftData);

        // Also save config to league settings
        await update(ref(db, `leagues/${leagueId}/settings`), {
          draftRounds: totalRounds,
          draftTimerSeconds: timerSec,
        });
        setSettings({ draftRounds: totalRounds, draftTimerSeconds: timerSec });

        setDraftInfo({
          status: 'active',
          currentPick: 0,
          totalPicks: shuffled.length * totalRounds,
          participants: shuffled,
        });

        setDraftStatus(`Draft iniciado! ${shuffled.length} participantes, ${totalRounds} rodadas.`);
        setMsg(`Draft iniciado com ${shuffled.length} participantes!`);
      } catch {
        setDraftStatus('Erro ao iniciar draft.');
      } finally {
        setLoading('');
      }
    }

    async function pauseDraft() {
      setLoading('draft-pause');
      try {
        await set(ref(db, `leagues/${leagueId}/draft/status`), 'paused');
        if (draftInfo) setDraftInfo({ ...draftInfo, status: 'paused' });
        setMsg('Draft pausado.');
      } catch {
        setMsg('Erro ao pausar draft.');
      } finally {
        setLoading('');
      }
    }

    async function resumeDraft() {
      setLoading('draft-resume');
      try {
        await update(ref(db, `leagues/${leagueId}/draft`), {
          status: 'active',
          pickStartedAt: Date.now(),
        });
        if (draftInfo) setDraftInfo({ ...draftInfo, status: 'active' });
        setMsg('Draft retomado!');
      } catch {
        setMsg('Erro ao retomar draft.');
      } finally {
        setLoading('');
      }
    }

    async function resetDraft() {
      setLoading('draft-reset');
      try {
        await set(ref(db, `leagues/${leagueId}/draft`), { status: 'waiting' });
        setDraftInfo({ status: 'waiting', currentPick: 0, totalPicks: 0, participants: [] });
        setMsg('Draft resetado.');
      } catch {
        setMsg('Erro ao resetar draft.');
      } finally {
        setLoading('');
      }
    }

    const statusLabel = (s: string) => {
      switch (s) {
        case 'active': return { text: 'ATIVO', cls: 'bg-emerald-500/20 text-emerald-400' };
        case 'paused': return { text: 'PAUSADO', cls: 'bg-amber-500/20 text-amber-400' };
        case 'finished': return { text: 'FINALIZADO', cls: 'bg-zinc-500/20 text-zinc-400' };
        default: return { text: 'AGUARDANDO', cls: 'bg-blue-500/20 text-blue-400' };
      }
    };

    return (
      <div className="space-y-4">
        <TabHeader title="Gerenciar Draft" />
        <MessageBanner />

        {/* Current Status */}
        {draftInfo && (
          <Section title="Status Atual">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusLabel(draftInfo.status).cls}`}>
                {statusLabel(draftInfo.status).text}
              </span>
              {draftInfo.totalPicks > 0 && (
                <span className="text-zinc-400 text-xs">
                  Pick {draftInfo.currentPick}/{draftInfo.totalPicks}
                </span>
              )}
            </div>
            {draftInfo.participants.length > 0 && (
              <div className="mt-2">
                <p className="text-zinc-500 text-xs mb-1">Ordem dos participantes:</p>
                <div className="flex flex-wrap gap-1.5">
                  {draftInfo.participants.map((nick, i) => (
                    <span key={nick} className="bg-zinc-700/60 text-zinc-300 px-2 py-1 rounded-lg text-xs">
                      {i + 1}. {nick}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {draftInfo.totalPicks > 0 && (
              <div className="mt-2">
                <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${(draftInfo.currentPick / draftInfo.totalPicks) * 100}%` }}
                  />
                </div>
                <p className="text-zinc-500 text-[10px] mt-1 text-right">
                  {Math.round((draftInfo.currentPick / draftInfo.totalPicks) * 100)}% completo
                </p>
              </div>
            )}
          </Section>
        )}

        {/* Config */}
        <Section title="Configuracao">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Timer por pick (seg)"
              type="number"
              value={timerSec}
              onChange={(v) => setTimerSec(parseInt(v) || 90)}
            />
            <Input
              label="Total de rodadas"
              type="number"
              value={totalRounds}
              onChange={(v) => setTotalRounds(parseInt(v) || 16)}
            />
          </div>
          <p className="text-zinc-500 text-[10px]">
            Jogadores disponiveis para draft: {players.length}
          </p>
        </Section>

        {draftStatus && (
          <div className="bg-zinc-800/80 rounded-xl p-3">
            <p className="text-zinc-400 text-sm">{draftStatus}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <ActionButton
            onClick={startDraft}
            disabled={!!loading}
            loadingKey="draft-start"
            label="Iniciar Draft"
            loadingLabel="Iniciando..."
          />
          <div className="grid grid-cols-2 gap-2">
            <ActionButton
              onClick={pauseDraft}
              disabled={!!loading}
              loadingKey="draft-pause"
              label="Pausar"
              loadingLabel="..."
              variant="warning"
            />
            <ActionButton
              onClick={resumeDraft}
              disabled={!!loading}
              loadingKey="draft-resume"
              label="Retomar"
              loadingLabel="..."
              variant="secondary"
            />
          </div>
          <ActionButton
            onClick={resetDraft}
            disabled={!!loading}
            loadingKey="draft-reset"
            label="Resetar Draft"
            loadingLabel="Resetando..."
            variant="danger"
          />
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // TAB 5: JOGADORES (Player Sync)
  // ═════════════════════════════════════════════════════════════════════════════

  function JogadoresTab() {
    const [syncStatus, setSyncStatus] = useState('');
    const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });

    async function syncPlayers() {
      setLoading('sync');
      setSyncStatus('Buscando times...');
      setSyncProgress({ current: 0, total: 0 });
      try {
        const teamsRes = await fetch('/api/football?action=teams');
        const teamsData = await teamsRes.json();
        const teams = teamsData?.response || [];

        if (teams.length === 0) {
          setSyncStatus('Nenhum time encontrado. Verifique a API.');
          setLoading('');
          return;
        }

        setSyncProgress({ current: 0, total: teams.length });
        setSyncStatus(`${teams.length} times encontrados. Buscando elencos...`);
        const allPlayers: unknown[] = [];

        for (let i = 0; i < teams.length; i++) {
          const team = teams[i].team;
          setSyncProgress({ current: i + 1, total: teams.length });
          setSyncStatus(`(${i + 1}/${teams.length}) ${team.name}...`);

          try {
            const squadRes = await fetch(`/api/football?action=squads&team=${team.id}`);
            const squadData = await squadRes.json();
            const squad = squadData?.response?.[0]?.players || [];

            for (const p of squad) {
              allPlayers.push({
                id: p.id,
                name: p.name,
                photo: p.photo || '',
                position: mapPosition(p.position),
                team: team.name,
                teamLogo: team.logo || '',
                price: 10,
                points: 0,
              });
            }
          } catch {
            setSyncStatus(`Erro no time ${team.name}, pulando...`);
            await new Promise((r) => setTimeout(r, 1000));
          }

          // Delay to avoid rate limiting
          if (i < teams.length - 1) {
            await new Promise((r) => setTimeout(r, 300));
          }
        }

        setSyncStatus(`${allPlayers.length} jogadores encontrados. Salvando...`);

        if (allPlayers.length >= 100) {
          await set(ref(db, 'gameData/players'), {
            players: allPlayers,
            teams: teams.map((t: { team: { id: number; name: string; logo: string } }) => ({
              id: t.team.id,
              name: t.team.name,
              logo: t.team.logo,
            })),
            lastSync: new Date().toISOString(),
          });
          setSyncStatus(`Sincronizacao completa! ${allPlayers.length} jogadores salvos.`);
          setMsg(`${allPlayers.length} jogadores sincronizados com sucesso!`);
        } else {
          setSyncStatus(`Apenas ${allPlayers.length} jogadores encontrados. Numero muito baixo, nao foi salvo.`);
        }
      } catch (err) {
        setSyncStatus(`Erro: ${err instanceof Error ? err.message : 'desconhecido'}`);
      } finally {
        setLoading('');
      }
    }

    async function checkApiStatus() {
      setLoading('api-check');
      try {
        const res = await fetch('/api/football?action=status');
        const data = await res.json();
        const account = data?.response?.account;
        const requests = data?.response?.requests;
        setSyncStatus(
          `API: ${account?.firstname || 'OK'} | ` +
          `Requests hoje: ${requests?.current || '?'}/${requests?.limit_day || '?'}`,
        );
      } catch {
        setSyncStatus('Erro ao verificar status da API.');
      } finally {
        setLoading('');
      }
    }

    return (
      <div className="space-y-4">
        <TabHeader title="Jogadores & Sync" />
        <MessageBanner />

        {/* Current Stats */}
        <Section title="Jogadores no Sistema">
          <div className="flex items-center justify-between">
            <span className="text-white font-bold text-2xl">{players.length}</span>
            <span className="text-zinc-500 text-xs">
              via API-Football + manuais
            </span>
          </div>
        </Section>

        {/* Sync Progress */}
        {syncStatus && (
          <div className="bg-zinc-800/80 rounded-2xl p-4">
            <p className="text-zinc-300 text-sm mb-2">{syncStatus}</p>
            {syncProgress.total > 0 && loading === 'sync' && (
              <div>
                <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full transition-all"
                    style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-zinc-500 text-[10px] mt-1 text-right">
                  {syncProgress.current}/{syncProgress.total} times
                </p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <ActionButton
          onClick={syncPlayers}
          disabled={!!loading}
          loadingKey="sync"
          label="Sincronizar Jogadores (API)"
          loadingLabel="Sincronizando..."
        />

        <ActionButton
          onClick={checkApiStatus}
          disabled={!!loading}
          loadingKey="api-check"
          label="Verificar Status da API"
          loadingLabel="Verificando..."
          variant="secondary"
        />

        <p className="text-zinc-600 text-[10px] text-center leading-relaxed">
          A sincronizacao busca todos os times do Brasileirao e seus elencos via API-Football.
          Jogadores com ID negativo sao manuais e nao serao substituidos.
        </p>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // TAB 6: PONTUACAO (Scoring)
  // ═════════════════════════════════════════════════════════════════════════════

  function PontuacaoTab() {
    const [rules, setRulesLocal] = useState<ScoringRules>(settings.scoringRules);
    const [captainMult, setCaptainMult] = useState(settings.captainMultiplier);
    const [calcResult, setCalcResult] = useState('');

    const scoringFields: { key: keyof ScoringRules; label: string; group: string }[] = [
      // Goals
      { key: 'goalForward', label: 'Gol (Atacante)', group: 'Gols' },
      { key: 'goalMidfielder', label: 'Gol (Meia)', group: 'Gols' },
      { key: 'goalDefender', label: 'Gol (Defensor)', group: 'Gols' },
      { key: 'goalGoalkeeper', label: 'Gol (Goleiro)', group: 'Gols' },
      // Assists
      { key: 'assist', label: 'Assistencia', group: 'Assistencia' },
      // Clean sheet
      { key: 'cleanSheetDefender', label: 'Clean Sheet (DEF)', group: 'Clean Sheet' },
      { key: 'cleanSheetGoalkeeper', label: 'Clean Sheet (GOL)', group: 'Clean Sheet' },
      // Cards
      { key: 'yellowCard', label: 'Cartao Amarelo', group: 'Cartoes' },
      { key: 'redCard', label: 'Cartao Vermelho', group: 'Cartoes' },
      // Saves
      { key: 'goalkeeperSave', label: 'Defesa (Goleiro)', group: 'Goleiro' },
      // Penalties
      { key: 'penaltyScored', label: 'Penalti Marcado', group: 'Penaltis' },
      { key: 'penaltyMissed', label: 'Penalti Perdido', group: 'Penaltis' },
      // Minutes
      { key: 'played60Plus', label: '60+ Minutos', group: 'Minutos' },
      { key: 'playedUnder60', label: '< 60 Minutos', group: 'Minutos' },
      // Others
      { key: 'goalsConceded2', label: 'A cada 2 gols sofridos', group: 'Outros' },
      { key: 'ownGoal', label: 'Gol Contra', group: 'Outros' },
    ];

    // Group fields
    const groups = scoringFields.reduce<Record<string, typeof scoringFields>>((acc, field) => {
      if (!acc[field.group]) acc[field.group] = [];
      acc[field.group].push(field);
      return acc;
    }, {});

    function updateRule(key: keyof ScoringRules, value: string) {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        setRulesLocal((prev) => ({ ...prev, [key]: num }));
      }
    }

    async function saveScoringRules() {
      setLoading('save-scoring');
      try {
        await update(ref(db, `leagues/${leagueId}/settings`), {
          scoringRules: rules,
          captainMultiplier: captainMult,
        });
        setSettings({ scoringRules: rules, captainMultiplier: captainMult });
        setMsg('Regras de pontuacao salvas!');
      } catch {
        setMsg('Erro ao salvar regras de pontuacao.');
      } finally {
        setLoading('');
      }
    }

    function resetToDefaults() {
      setRulesLocal(DEFAULT_SCORING);
      setCaptainMult(2);
    }

    async function calculateScores() {
      setLoading('calc-scoring');
      setCalcResult('Calculando pontuacao...');
      try {
        const res = await fetch(`/api/scoring?league=${leagueId}&round=${round.number}`);
        const data = await res.json();
        if (data.error) {
          setCalcResult(`Erro: ${data.error}`);
        } else {
          setCalcResult(`Pontuacao calculada! ${data.playersScored || 0} jogadores pontuados.`);
          setMsg(`Pontuacao da rodada ${round.number} calculada!`);
        }
      } catch {
        setCalcResult('Erro ao calcular pontuacao.');
      } finally {
        setLoading('');
      }
    }

    return (
      <div className="space-y-4">
        <TabHeader title="Pontuacao" />
        <MessageBanner />

        {/* Captain Multiplier */}
        <Section title="Multiplicador do Capitao">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-zinc-500 text-xs mb-1">
                Pontos do capitao sao multiplicados por este valor.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-zinc-700 rounded-xl px-3 py-2">
              <button
                onClick={() => setCaptainMult(Math.max(1, captainMult - 0.5))}
                className="text-zinc-400 hover:text-white text-sm font-bold px-1"
              >
                -
              </button>
              <span className="text-amber-400 font-bold text-lg min-w-[2rem] text-center">
                {captainMult}x
              </span>
              <button
                onClick={() => setCaptainMult(Math.min(5, captainMult + 0.5))}
                className="text-zinc-400 hover:text-white text-sm font-bold px-1"
              >
                +
              </button>
            </div>
          </div>
        </Section>

        {/* Scoring Rules by Group */}
        {Object.entries(groups).map(([groupName, fields]) => (
          <Section key={groupName} title={groupName}>
            <div className="space-y-2">
              {fields.map((field) => (
                <div key={field.key} className="flex items-center justify-between gap-3">
                  <label className="text-zinc-300 text-xs flex-1">{field.label}</label>
                  <input
                    type="number"
                    step="0.5"
                    value={rules[field.key]}
                    onChange={(e) => updateRule(field.key, e.target.value)}
                    className={`w-20 px-2 py-1.5 bg-zinc-700 rounded-lg text-center text-sm font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500/50 ${
                      rules[field.key] < 0 ? 'text-red-400' : rules[field.key] > 0 ? 'text-emerald-400' : 'text-zinc-400'
                    }`}
                  />
                </div>
              ))}
            </div>
          </Section>
        ))}

        {/* Save / Reset */}
        <div className="flex gap-2">
          <ActionButton
            onClick={resetToDefaults}
            label="Resetar Padrao"
            variant="secondary"
            className="flex-1"
          />
          <ActionButton
            onClick={saveScoringRules}
            loadingKey="save-scoring"
            label="Salvar Regras"
            loadingLabel="Salvando..."
            className="flex-1"
          />
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-800 pt-4">
          <Section title="Calcular Pontuacao da Rodada">
            <p className="text-zinc-500 text-xs">
              Busca os resultados reais da rodada {round.number} e calcula os pontos de cada jogador
              com base nas regras acima.
            </p>
            {calcResult && (
              <p className={`text-sm ${calcResult.includes('Erro') ? 'text-red-400' : 'text-emerald-400'}`}>
                {calcResult}
              </p>
            )}
            <ActionButton
              onClick={calculateScores}
              disabled={!!loading}
              loadingKey="calc-scoring"
              label={`Calcular Rodada ${round.number}`}
              loadingLabel="Calculando..."
              variant="warning"
            />
          </Section>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // TAB 7: MERCADO (Market/Trades Control)
  // ═════════════════════════════════════════════════════════════════════════════

  function MercadoTab() {
    const [marketOpen, setMarketOpen] = useState(settings.marketOpen);
    const [maxTrades, setMaxTrades] = useState(settings.maxTradesPerMonth);
    const [pendingTrades, setPendingTrades] = useState<(TradeOffer & { firebaseKey: string })[]>([]);
    const [loadingTrades, setLoadingTrades] = useState(true);

    useEffect(() => {
      async function loadPendingTrades() {
        setLoadingTrades(true);
        try {
          const snap = await get(ref(db, `leagues/${leagueId}/trades`));
          const data = snap.val();
          if (data) {
            const list: (TradeOffer & { firebaseKey: string })[] = [];
            Object.entries(data).forEach(([key, val]: [string, unknown]) => {
              const t = val as TradeOffer;
              if (t.status === 'pending') {
                list.push({ ...t, id: key, firebaseKey: key });
              }
            });
            list.sort((a, b) => b.createdAt - a.createdAt);
            setPendingTrades(list);
          }
        } catch {
          // ignore
        } finally {
          setLoadingTrades(false);
        }
      }
      loadPendingTrades();
    }, []);

    async function toggleMarket() {
      setLoading('toggle-market');
      try {
        const newState = !marketOpen;
        await set(ref(db, `leagues/${leagueId}/settings/marketOpen`), newState);
        setMarketOpen(newState);
        setSettings({ marketOpen: newState });
        setMsg(`Mercado ${newState ? 'aberto' : 'fechado'}!`);
      } catch {
        setMsg('Erro ao alterar mercado.');
      } finally {
        setLoading('');
      }
    }

    async function saveMaxTrades() {
      setLoading('save-max-trades');
      try {
        await set(ref(db, `leagues/${leagueId}/settings/maxTradesPerMonth`), maxTrades);
        setSettings({ maxTradesPerMonth: maxTrades });
        setMsg('Limite de trocas atualizado!');
      } catch {
        setMsg('Erro ao salvar limite de trocas.');
      } finally {
        setLoading('');
      }
    }

    async function cancelTrade(tradeKey: string) {
      setLoading(`cancel-trade-${tradeKey}`);
      try {
        await set(ref(db, `leagues/${leagueId}/trades/${tradeKey}/status`), 'rejected');
        setPendingTrades((prev) => prev.filter((t) => t.firebaseKey !== tradeKey));
        setMsg('Troca cancelada pelo admin.');
      } catch {
        setMsg('Erro ao cancelar troca.');
      } finally {
        setLoading('');
      }
    }

    return (
      <div className="space-y-4">
        <TabHeader title="Mercado & Trocas" />
        <MessageBanner />

        {/* Market Toggle */}
        <Section title="Estado do Mercado">
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-bold text-sm ${marketOpen ? 'text-emerald-400' : 'text-red-400'}`}>
                {marketOpen ? 'ABERTO' : 'FECHADO'}
              </p>
              <p className="text-zinc-500 text-xs">
                {marketOpen
                  ? 'Membros podem propor e aceitar trocas.'
                  : 'Trocas estao bloqueadas.'}
              </p>
            </div>
            <button
              onClick={toggleMarket}
              disabled={loading === 'toggle-market'}
              className={`relative w-14 h-7 rounded-full transition-all ${
                marketOpen ? 'bg-emerald-500' : 'bg-zinc-600'
              }`}
            >
              <span
                className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${
                  marketOpen ? 'left-7' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </Section>

        {/* Max Trades */}
        <Section title="Limite de Trocas">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Input
                label="Max trocas por mes"
                type="number"
                value={maxTrades}
                onChange={(v) => setMaxTrades(parseInt(v) || 1)}
              />
            </div>
            <div className="pt-5">
              <ActionButton
                onClick={saveMaxTrades}
                loadingKey="save-max-trades"
                label="Salvar"
                loadingLabel="..."
                className="px-6"
              />
            </div>
          </div>
        </Section>

        {/* Pending Trades */}
        <Section title="Trocas Pendentes">
          {loadingTrades ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pendingTrades.length === 0 ? (
            <p className="text-zinc-500 text-xs text-center py-4">Nenhuma troca pendente.</p>
          ) : (
            <div className="space-y-3">
              {pendingTrades.map((trade) => (
                <div key={trade.firebaseKey} className="bg-zinc-900/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-zinc-300 text-xs">
                      <span className="text-white font-medium">{trade.from}</span>
                      {' '}&#8594;{' '}
                      <span className="text-white font-medium">{trade.to}</span>
                    </p>
                    <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full text-[10px] font-bold">
                      PENDENTE
                    </span>
                  </div>

                  <div className="flex gap-2 mb-2">
                    <div className="flex-1">
                      <p className="text-[10px] text-zinc-500 mb-1">Oferece:</p>
                      {trade.offeredPlayers.map((p) => (
                        <p key={p.id} className="text-xs text-zinc-400 truncate">
                          <span className={`${posColor(p.position)} mr-1`}>{p.position}</span>
                          {p.name}
                        </p>
                      ))}
                    </div>
                    <div className="flex items-center text-zinc-700">&#8644;</div>
                    <div className="flex-1">
                      <p className="text-[10px] text-zinc-500 mb-1">Pede:</p>
                      {trade.requestedPlayers.map((p) => (
                        <p key={p.id} className="text-xs text-zinc-400 truncate">
                          <span className={`${posColor(p.position)} mr-1`}>{p.position}</span>
                          {p.name}
                        </p>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => cancelTrade(trade.firebaseKey)}
                    disabled={loading === `cancel-trade-${trade.firebaseKey}`}
                    className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {loading === `cancel-trade-${trade.firebaseKey}` ? 'Cancelando...' : 'Cancelar Troca (Admin)'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // TAB 8: APARENCIA (Appearance)
  // ═════════════════════════════════════════════════════════════════════════════

  function AparenciaTab() {
    const [config, setConfig] = useState<AppearanceConfig>(appearance);

    async function saveAppearance() {
      setLoading('appearance');
      try {
        await set(ref(db, `leagues/${leagueId}/appearance`), config);
        setAppearance(config);
        setMsg('Aparencia salva!');
      } catch {
        setMsg('Erro ao salvar aparencia.');
      } finally {
        setLoading('');
      }
    }

    function resetAppearance() {
      setConfig(DEFAULT_APPEARANCE);
    }

    const colorFields: { label: string; key: keyof AppearanceConfig }[] = [
      { label: 'Primaria', key: 'primaryColor' },
      { label: 'Secundaria', key: 'secondaryColor' },
      { label: 'Destaque', key: 'accentColor' },
      { label: 'Fundo', key: 'backgroundColor' },
      { label: 'Cards', key: 'cardColor' },
      { label: 'Texto', key: 'textColor' },
    ];

    return (
      <div className="space-y-4">
        <TabHeader title="Aparencia" />
        <MessageBanner />

        {/* Logo */}
        <Section title="Branding">
          <Input
            label="URL da Logo"
            value={config.logoUrl}
            onChange={(v) => setConfig({ ...config, logoUrl: v })}
            placeholder="https://exemplo.com/logo.png"
          />
          <Input
            label="Texto da Logo (fallback)"
            value={config.logoText}
            onChange={(v) => setConfig({ ...config, logoText: v })}
            placeholder="FB"
          />
          <Input
            label="Nome do Site"
            value={config.siteName}
            onChange={(v) => setConfig({ ...config, siteName: v })}
            placeholder="Fantasy BR"
          />
        </Section>

        {/* Colors */}
        <Section title="Cores">
          {colorFields.map(({ label, key }) => (
            <div key={key} className="flex items-center gap-3">
              <input
                type="color"
                value={config[key] as string}
                onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                className="w-10 h-10 rounded-lg border-0 cursor-pointer bg-transparent shrink-0"
              />
              <div className="flex-1">
                <p className="text-zinc-300 text-xs">{label}</p>
                <p className="text-zinc-500 text-[10px] font-mono">{config[key] as string}</p>
              </div>
            </div>
          ))}
        </Section>

        {/* Typography */}
        <Section title="Tipografia">
          <div>
            <label className="text-zinc-500 text-xs mb-1 block">Fonte</label>
            <select
              value={config.fontFamily}
              onChange={(e) => setConfig({ ...config, fontFamily: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-700 rounded-xl text-white text-sm focus:outline-none"
            >
              <option value="system-ui">System UI</option>
              <option value="Inter">Inter</option>
              <option value="Arial">Arial</option>
              <option value="Verdana">Verdana</option>
              <option value="Georgia">Georgia</option>
              <option value="monospace">Monospace</option>
            </select>
          </div>
          <div>
            <label className="text-zinc-500 text-xs mb-1 block">Tamanho do Titulo</label>
            <div className="flex gap-2">
              {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setConfig({ ...config, headingSize: size })}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                    config.headingSize === size
                      ? 'bg-emerald-500 text-white'
                      : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                  }`}
                >
                  {size.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-zinc-500 text-xs mb-1 block">Tamanho do Texto</label>
            <div className="flex gap-2">
              {(['sm', 'md', 'lg'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setConfig({ ...config, bodySize: size })}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                    config.bodySize === size
                      ? 'bg-emerald-500 text-white'
                      : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                  }`}
                >
                  {size.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* League Display */}
        <Section title="Exibicao da Liga">
          <Input
            label="Nome da Liga"
            value={config.leagueName}
            onChange={(v) => setConfig({ ...config, leagueName: v })}
          />
          <Input
            label="Ano da Temporada"
            type="number"
            value={config.seasonYear}
            onChange={(v) => setConfig({ ...config, seasonYear: parseInt(v) || 2026 })}
          />
        </Section>

        {/* Preview */}
        <div
          className="rounded-2xl p-5 border border-zinc-700/50"
          style={{ backgroundColor: config.cardColor, color: config.textColor }}
        >
          <p className="text-[10px] uppercase tracking-wider opacity-50 mb-2">Preview</p>
          <div className="flex items-center gap-3 mb-2">
            {config.logoUrl ? (
              <img
                src={config.logoUrl}
                alt=""
                className="w-8 h-8 rounded-lg object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                style={{ backgroundColor: config.primaryColor + '30', color: config.primaryColor }}
              >
                {config.logoText}
              </div>
            )}
            <div>
              <p
                style={{
                  fontFamily: config.fontFamily,
                  color: config.primaryColor,
                  fontWeight: 'bold',
                  fontSize: config.headingSize === 'sm' ? '14px' : config.headingSize === 'md' ? '16px' : config.headingSize === 'lg' ? '18px' : '20px',
                }}
              >
                {config.siteName}
              </p>
              <p style={{ fontSize: '11px', opacity: 0.6 }}>
                {config.leagueName} {config.seasonYear}
              </p>
            </div>
          </div>
          <div
            className="rounded-xl p-3 mt-2"
            style={{ backgroundColor: config.backgroundColor }}
          >
            <p style={{ color: config.accentColor, fontSize: '12px', fontWeight: 'bold' }}>
              Destaque de exemplo
            </p>
            <p style={{ fontSize: '11px', opacity: 0.7 }}>Texto de exemplo no corpo do app</p>
          </div>
        </div>

        {/* Save / Reset */}
        <div className="flex gap-2">
          <ActionButton
            onClick={resetAppearance}
            label="Resetar Padrao"
            variant="secondary"
            className="flex-1"
          />
          <ActionButton
            onClick={saveAppearance}
            loadingKey="appearance"
            label="Salvar"
            loadingLabel="Salvando..."
            className="flex-1"
          />
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // TAB 9: CONFIGURACOES (League Config)
  // ═════════════════════════════════════════════════════════════════════════════

  function ConfiguracoesTab() {
    const [leagueName, setLeagueName] = useState(league.name);
    const [maxMembersVal, setMaxMembersVal] = useState(league.maxMembers);
    const [newCode, setNewCode] = useState(league.accessCode);
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [showDeleteInput, setShowDeleteInput] = useState(false);

    async function saveLeagueInfo() {
      setLoading('save-league-info');
      try {
        await update(ref(db, `leagues/${leagueId}/info`), {
          name: leagueName,
          maxMembers: maxMembersVal,
        });
        setMsg('Informacoes da liga atualizadas!');
      } catch {
        setMsg('Erro ao salvar informacoes.');
      } finally {
        setLoading('');
      }
    }

    async function regenerateCode() {
      setLoading('regen-code');
      try {
        const code = generateAccessCode();
        await set(ref(db, `leagues/${leagueId}/info/accessCode`), code);
        setNewCode(code);
        setMsg(`Novo codigo de acesso: ${code}`);
      } catch {
        setMsg('Erro ao gerar novo codigo.');
      } finally {
        setLoading('');
      }
    }

    async function deleteLeague() {
      if (deleteConfirm !== league.name) {
        setMsg('Digite o nome exato da liga para confirmar.');
        return;
      }
      setLoading('delete-league');
      try {
        await remove(ref(db, `leagues/${leagueId}`));
        setMsg('Liga excluida. Recarregue a pagina.');
        // Ideally we'd redirect, but we don't have a router here.
        // The store listener should handle cleanup.
      } catch {
        setMsg('Erro ao excluir liga.');
      } finally {
        setLoading('');
      }
    }

    return (
      <div className="space-y-4">
        <TabHeader title="Configuracoes da Liga" />
        <MessageBanner />

        {/* Edit league name */}
        <Section title="Informacoes da Liga">
          <Input
            label="Nome da Liga"
            value={leagueName}
            onChange={setLeagueName}
          />
          <Input
            label="Maximo de Membros"
            type="number"
            value={maxMembersVal}
            onChange={(v) => setMaxMembersVal(parseInt(v) || 10)}
          />
          <ActionButton
            onClick={saveLeagueInfo}
            loadingKey="save-league-info"
            label="Salvar Alteracoes"
            loadingLabel="Salvando..."
          />
        </Section>

        {/* Access Code */}
        <Section title="Codigo de Acesso">
          <div className="flex items-center justify-between bg-zinc-900/50 rounded-xl p-4">
            <div>
              <p className="text-zinc-500 text-xs mb-1">Codigo atual</p>
              <p className="text-amber-400 font-mono font-bold text-xl tracking-[0.3em]">{newCode}</p>
            </div>
            <ActionButton
              onClick={regenerateCode}
              loadingKey="regen-code"
              label="Gerar Novo"
              loadingLabel="..."
              variant="warning"
              className="px-4 shrink-0"
            />
          </div>
          <p className="text-zinc-600 text-[10px] leading-relaxed">
            Ao gerar um novo codigo, o antigo deixa de funcionar.
            Membros existentes nao sao afetados.
          </p>
        </Section>

        {/* League ID (read-only) */}
        <Section title="Identificadores">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center bg-zinc-900/30 rounded-lg p-2.5">
              <span className="text-zinc-500">Liga ID</span>
              <span className="text-zinc-400 font-mono text-[10px] select-all">{leagueId}</span>
            </div>
            <div className="flex justify-between items-center bg-zinc-900/30 rounded-lg p-2.5">
              <span className="text-zinc-500">Admin UID</span>
              <span className="text-zinc-400 font-mono text-[10px] select-all">{league.adminUid}</span>
            </div>
            <div className="flex justify-between items-center bg-zinc-900/30 rounded-lg p-2.5">
              <span className="text-zinc-500">Criada em</span>
              <span className="text-zinc-400 text-[10px]">{league.createdAt}</span>
            </div>
          </div>
        </Section>

        {/* DANGER ZONE */}
        <div className="border border-red-500/20 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-red-400 text-sm">&#9888;</span>
            <p className="text-red-400 text-sm font-bold">Zona de Perigo</p>
          </div>

          {!showDeleteInput ? (
            <button
              onClick={() => setShowDeleteInput(true)}
              className="w-full py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-xl text-sm font-semibold transition-colors"
            >
              Excluir Liga Permanentemente
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-zinc-400 text-xs leading-relaxed">
                Esta acao e irreversivel. Todos os dados da liga, membros, times, trocas e
                historico serao permanentemente excluidos.
              </p>
              <p className="text-zinc-300 text-xs">
                Para confirmar, digite o nome da liga: <span className="text-red-400 font-bold">{league.name}</span>
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={league.name}
                className="w-full px-3 py-2 bg-zinc-900 rounded-xl text-red-400 text-sm placeholder-zinc-600 border border-red-500/30 focus:outline-none focus:ring-1 focus:ring-red-500/50"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowDeleteInput(false); setDeleteConfirm(''); }}
                  className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-xl text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <ActionButton
                  onClick={deleteLeague}
                  disabled={deleteConfirm !== league.name}
                  loadingKey="delete-league"
                  label="EXCLUIR LIGA"
                  loadingLabel="Excluindo..."
                  variant="danger"
                  className="flex-1"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER ACTIVE TAB
  // ═════════════════════════════════════════════════════════════════════════════

  const tabComponents: Record<AdminTab, () => React.JSX.Element> = {
    main: MainTab,
    temporada: TemporadaTab,
    membros: MembrosTab,
    draft: DraftTab,
    jogadores: JogadoresTab,
    pontuacao: PontuacaoTab,
    mercado: MercadoTab,
    aparencia: AparenciaTab,
    configuracoes: ConfiguracoesTab,
  };

  const ActiveTab = tabComponents[tab];
  return <ActiveTab />;
}
