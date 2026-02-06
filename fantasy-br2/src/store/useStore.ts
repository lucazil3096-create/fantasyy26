import { create } from 'zustand';

export type Screen = 'home' | 'lineup' | 'draft' | 'ranking' | 'trades' | 'admin';

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

export interface UserData {
  nickname: string;
  team: Player[];
  formation: string;
  budget: number;
  totalPoints: number;
  isAdmin: boolean;
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
  isRoundActive: boolean;
  nextGameDate: string | null;

  // Auth actions
  setUser: (user: UserData | null) => void;
  setLoading: (loading: boolean) => void;

  // Game actions
  setCurrentRound: (round: number) => void;
  setRoundActive: (active: boolean) => void;
  setNextGameDate: (date: string | null) => void;
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
  isRoundActive: false,
  nextGameDate: null,

  // Auth actions
  setUser: (user) => set({ user, isLoggedIn: !!user }),
  setLoading: (isLoading) => set({ isLoading }),

  // Game actions
  setCurrentRound: (currentRound) => set({ currentRound }),
  setRoundActive: (isRoundActive) => set({ isRoundActive }),
  setNextGameDate: (nextGameDate) => set({ nextGameDate }),
}));
