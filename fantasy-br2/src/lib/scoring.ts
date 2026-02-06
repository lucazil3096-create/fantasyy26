// Scoring system for Fantasy BR
// Points calculated based on real match events from API-Football

export interface ScoringRules {
  // Goals
  goalForward: number;
  goalMidfielder: number;
  goalDefender: number;
  goalGoalkeeper: number;
  // Assists
  assist: number;
  // Clean sheets
  cleanSheetDefender: number;
  cleanSheetGoalkeeper: number;
  // Cards
  yellowCard: number;
  redCard: number;
  // Saves
  goalkeeperSave: number;
  // Penalties
  penaltyScored: number;
  penaltyMissed: number;
  // Minutes
  played60Plus: number;
  playedUnder60: number;
  // Goals conceded (GK/DEF)
  goalsConceded2: number; // per 2 goals conceded
  // Own goal
  ownGoal: number;
}

export const DEFAULT_SCORING: ScoringRules = {
  goalForward: 4,
  goalMidfielder: 5,
  goalDefender: 6,
  goalGoalkeeper: 7,
  assist: 3,
  cleanSheetDefender: 4,
  cleanSheetGoalkeeper: 4,
  yellowCard: -1,
  redCard: -3,
  goalkeeperSave: 0.5,
  penaltyScored: 1, // bonus on top of goal
  penaltyMissed: -2,
  played60Plus: 2,
  playedUnder60: 1,
  goalsConceded2: -1,
  ownGoal: -2,
};

export interface PlayerMatchStats {
  playerId: number;
  minutes: number;
  goals: number;
  assists: number;
  saves: number;
  yellowCards: number;
  redCards: number;
  penaltiesScored: number;
  penaltiesMissed: number;
  ownGoals: number;
  goalsConceded: number;
  cleanSheet: boolean;
  position: string; // G, D, M, A
}

export function calculatePlayerPoints(
  stats: PlayerMatchStats,
  rules: ScoringRules = DEFAULT_SCORING
): number {
  let points = 0;

  // Minutes played
  if (stats.minutes >= 60) {
    points += rules.played60Plus;
  } else if (stats.minutes > 0) {
    points += rules.playedUnder60;
  }

  // Goals by position
  const goalPoints =
    stats.position === 'G' ? rules.goalGoalkeeper :
    stats.position === 'D' ? rules.goalDefender :
    stats.position === 'M' ? rules.goalMidfielder :
    rules.goalForward;
  points += stats.goals * goalPoints;

  // Assists
  points += stats.assists * rules.assist;

  // Clean sheet (only GK and DEF)
  if (stats.cleanSheet && (stats.position === 'G' || stats.position === 'D')) {
    points += stats.position === 'G' ? rules.cleanSheetGoalkeeper : rules.cleanSheetDefender;
  }

  // Cards
  points += stats.yellowCards * rules.yellowCard;
  points += stats.redCards * rules.redCard;

  // GK saves
  if (stats.position === 'G') {
    points += stats.saves * rules.goalkeeperSave;
  }

  // Penalties
  points += stats.penaltiesScored * rules.penaltyScored;
  points += stats.penaltiesMissed * rules.penaltyMissed;

  // Own goals
  points += stats.ownGoals * rules.ownGoal;

  // Goals conceded (GK/DEF)
  if ((stats.position === 'G' || stats.position === 'D') && stats.goalsConceded >= 2) {
    points += Math.floor(stats.goalsConceded / 2) * rules.goalsConceded2;
  }

  return Math.round(points * 10) / 10; // 1 decimal
}
