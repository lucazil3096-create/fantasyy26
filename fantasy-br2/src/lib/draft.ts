// Draft logic utilities
// Snake draft: Round 1 → 1,2,3...N | Round 2 → N,...,3,2,1 | Round 3 → 1,2,3...N

export interface DraftState {
  status: 'waiting' | 'active' | 'paused' | 'finished';
  participants: string[]; // nicknames in draft order
  currentPick: number; // global pick number (0-indexed)
  totalRounds: number; // how many rounds of picks
  pickTimerSeconds: number; // seconds per pick
  pickStartedAt: number; // timestamp when current pick started
  picks: DraftPick[]; // all picks made
  availablePlayers: number[]; // player IDs not yet picked
}

export interface DraftPick {
  pickNumber: number;
  round: number;
  nickname: string;
  playerId: number;
  playerName: string;
  timestamp: number;
  wasAutoPick: boolean;
}

export function getSnakeOrder(participants: string[], totalRounds: number): string[] {
  const order: string[] = [];
  for (let round = 0; round < totalRounds; round++) {
    if (round % 2 === 0) {
      // Forward: 1, 2, 3, ..., N
      order.push(...participants);
    } else {
      // Reverse: N, ..., 3, 2, 1
      order.push(...[...participants].reverse());
    }
  }
  return order;
}

export function getCurrentPicker(
  participants: string[],
  currentPick: number,
  totalRounds: number
): { nickname: string; round: number; pickInRound: number } | null {
  const totalPicks = participants.length * totalRounds;
  if (currentPick >= totalPicks) return null;

  const round = Math.floor(currentPick / participants.length);
  const pickInRound = currentPick % participants.length;

  const isReversed = round % 2 === 1;
  const idx = isReversed ? participants.length - 1 - pickInRound : pickInRound;

  return {
    nickname: participants[idx],
    round: round + 1,
    pickInRound: pickInRound + 1,
  };
}

export function getPicksForUser(picks: DraftPick[], nickname: string): DraftPick[] {
  return picks.filter((p) => p.nickname === nickname);
}

export function getRemainingTime(pickStartedAt: number, pickTimerSeconds: number): number {
  if (!pickStartedAt) return pickTimerSeconds;
  const elapsed = (Date.now() - pickStartedAt) / 1000;
  return Math.max(0, pickTimerSeconds - elapsed);
}
