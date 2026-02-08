import { create } from 'zustand';
import { DraftState, DraftPick } from '@/lib/draft';
import { AppearanceConfig, DEFAULT_APPEARANCE } from '@/lib/appearance';
import { ScoringRules, DEFAULT_SCORING } from '@/lib/scoring';

// ── Screens ──
export type Screen = 'home' | 'lineup' | 'draft' | 'ranking' | 'trades' | 'chat' | 'admin' | 'leagues';

// ── Player ──
export interface Player {
  id: number;
  name: string;
  photo: string;
  position: string; // G, D, M, A
  team: string;
  teamLogo: string;
  points: number;
}

// ── Trade ──
export interface TradeOffer {
  id: string;
  from: string;
  to: string;
  offeredPlayers: Player[];
  requestedPlayers: Player[];
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

// ── Chat ──
export interface ChatMessage {
  id: string;
  from: string;
  text: string;
  timestamp: number;
}

// ── League ──
export interface League {
  id: string;
  name: string;
  logo: string;
  accessCode: string;
  adminUid: string;
  adminNickname: string;
  season: number;
  maxMembers: number;
  createdAt: string;
}

// ── User Data (within a league) ──
export interface UserData {
  nickname: string;
  team: Player[];
  formation: string;
  totalPoints: number;
  confirmed: boolean;
  captain: number | null;
}

// ── Round Config ──
export interface RoundConfig {
  number: number;
  status: 'waiting' | 'active' | 'finished';
  deadline: string | null;
  nextGameDate: string | null;
}

// ── Admin Settings ──
export interface LeagueSettings {
  draftRounds: number;
  draftTimerSeconds: number;
  maxTradesPerMonth: number;
  marketOpen: boolean;
  captainMultiplier: number;
  scoringRules: ScoringRules;
}

// ── App State ──
interface AppState {
  // Auth
  uid: string | null;
  nickname: string | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  isAdmin: boolean; // true if user is admin of current league

  // League
  currentLeague: League | null;
  leagues: League[];
  setCurrentLeague: (league: League | null) => void;
  setLeagues: (leagues: League[]) => void;

  // User (within league)
  user: UserData | null;

  // Navigation
  screen: Screen;
  setScreen: (screen: Screen) => void;

  // Players (shared - from API)
  players: Player[];
  setPlayers: (players: Player[]) => void;

  // Round state
  round: RoundConfig;
  setRound: (round: Partial<RoundConfig>) => void;

  // Draft
  draft: DraftState | null;
  setDraft: (draft: DraftState | null) => void;
  addDraftPick: (pick: DraftPick) => void;

  // Trades
  trades: TradeOffer[];
  setTrades: (trades: TradeOffer[]) => void;

  // Chat
  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;
  unreadCount: number;
  setUnreadCount: (count: number) => void;

  // Appearance
  appearance: AppearanceConfig;
  setAppearance: (config: AppearanceConfig) => void;

  // League settings
  settings: LeagueSettings;
  setSettings: (settings: Partial<LeagueSettings>) => void;

  // Auth actions
  setAuth: (uid: string | null, nickname: string | null, isAdmin: boolean) => void;
  setUser: (user: UserData | null) => void;
  setLoading: (loading: boolean) => void;

  // Team actions
  updateTeam: (team: Player[]) => void;
  setCaptain: (playerId: number | null) => void;
  setConfirmed: (confirmed: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  // Auth
  uid: null,
  nickname: null,
  isLoggedIn: false,
  isLoading: true,
  isAdmin: false,

  // League
  currentLeague: null,
  leagues: [],
  setCurrentLeague: (currentLeague) => set({ currentLeague }),
  setLeagues: (leagues) => set({ leagues }),

  // User
  user: null,

  // Navigation
  screen: 'home',
  setScreen: (screen) => set({ screen }),

  // Players
  players: [],
  setPlayers: (players) => set({ players }),

  // Round
  round: { number: 1, status: 'waiting', deadline: null, nextGameDate: null },
  setRound: (partial) =>
    set((s) => ({ round: { ...s.round, ...partial } })),

  // Draft
  draft: null,
  setDraft: (draft) => set({ draft }),
  addDraftPick: (pick) =>
    set((s) => {
      if (!s.draft) return {};
      return {
        draft: {
          ...s.draft,
          picks: [...s.draft.picks, pick],
          currentPick: s.draft.currentPick + 1,
          availablePlayers: s.draft.availablePlayers.filter((id) => id !== pick.playerId),
        },
      };
    }),

  // Trades
  trades: [],
  setTrades: (trades) => set({ trades }),

  // Chat
  messages: [],
  setMessages: (messages) => set({ messages }),
  unreadCount: 0,
  setUnreadCount: (unreadCount) => set({ unreadCount }),

  // Appearance
  appearance: DEFAULT_APPEARANCE,
  setAppearance: (appearance) => set({ appearance }),

  // League settings
  settings: {
    draftRounds: 16,
    draftTimerSeconds: 90,
    maxTradesPerMonth: 3,
    marketOpen: false,
    captainMultiplier: 2,
    scoringRules: DEFAULT_SCORING,
  },
  setSettings: (partial) =>
    set((s) => ({ settings: { ...s.settings, ...partial } })),

  // Auth actions
  setAuth: (uid, nickname, isAdmin) =>
    set({ uid, nickname, isLoggedIn: !!uid, isAdmin }),
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),

  // Team actions
  updateTeam: (team) =>
    set((s) => {
      if (!s.user) return {};
      return { user: { ...s.user, team } };
    }),
  setCaptain: (playerId) =>
    set((s) => {
      if (!s.user) return {};
      return { user: { ...s.user, captain: playerId } };
    }),
  setConfirmed: (confirmed) =>
    set((s) => {
      if (!s.user) return {};
      return { user: { ...s.user, confirmed } };
    }),
}));
