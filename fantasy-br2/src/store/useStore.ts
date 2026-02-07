import { create } from 'zustand';
import { DraftState, DraftPick } from '@/lib/draft';
import { AppearanceConfig, DEFAULT_APPEARANCE } from '@/lib/appearance';

export type Screen = 'home' | 'lineup' | 'draft' | 'ranking' | 'trades' | 'chat' | 'admin';

export interface Player {
  id: number;
  name: string;
  photo: string;
  position: string;
  team: string;
  teamLogo: string;
  price: number;
  points: number;
}

export interface TradeOffer {
  id: string;
  from: string;
  to: string;
  offeredPlayers: Player[];
  requestedPlayers: Player[];
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  from: string;
  text: string;
  timestamp: number;
}

export interface UserData {
  nickname: string;
  team: Player[];
  formation: string;
  budget: number;
  totalPoints: number;
  isAdmin: boolean;
  confirmed?: boolean;
  captain?: number | null;
}

interface AppState {
  // Auth
  user: UserData | null;
  isLoggedIn: boolean;
  isLoading: boolean;

  // Navigation
  screen: Screen;
  setScreen: (screen: Screen) => void;

  // Players
  players: Player[];
  setPlayers: (players: Player[]) => void;

  // Game state
  currentRound: number;
  roundStatus: 'waiting' | 'active' | 'finished';
  nextGameDate: string | null;
  nextRoundNumber: number | null;

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

  // Auth actions
  setUser: (user: UserData | null) => void;
  setLoading: (loading: boolean) => void;

  // Game actions
  setCurrentRound: (round: number) => void;
  setRoundStatus: (status: 'waiting' | 'active' | 'finished') => void;
  setNextGameDate: (date: string | null) => void;
  setNextRoundNumber: (round: number | null) => void;

  // Team actions
  updateTeam: (team: Player[]) => void;
  setCaptain: (playerId: number | null) => void;
  setConfirmed: (confirmed: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  // Auth
  user: null,
  isLoggedIn: false,
  isLoading: true,

  // Navigation
  screen: 'home',
  setScreen: (screen) => set({ screen }),

  // Players
  players: [],
  setPlayers: (players) => set({ players }),

  // Game state
  currentRound: 1,
  roundStatus: 'waiting',
  nextGameDate: null,
  nextRoundNumber: null,

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

  // Auth actions
  setUser: (user) => set({ user, isLoggedIn: !!user }),
  setLoading: (isLoading) => set({ isLoading }),

  // Game actions
  setCurrentRound: (currentRound) => set({ currentRound }),
  setRoundStatus: (roundStatus) => set({ roundStatus }),
  setNextGameDate: (nextGameDate) => set({ nextGameDate }),
  setNextRoundNumber: (nextRoundNumber) => set({ nextRoundNumber }),

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
