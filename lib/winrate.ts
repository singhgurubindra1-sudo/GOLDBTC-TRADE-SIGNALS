import type { StrategyId } from "./types";

/**
 * Modelled win probability.
 *
 * The base rates come from what the two study guides state about each strategy
 * (session breakout "wins 40-50% and depends on the 1.5-2R winners"; range trading and
 * EMA pullback are the higher-quality, lower-frequency setups). Each confluence item
 * that the engine actually verified nudges the number, each warning pulls it back.
 *
 * It is a transparent scoring model, not a backtested edge. Treat it as "how much of my
 * checklist passed", and keep your own journal of real results - which is exactly what
 * both guides tell you to judge a strategy on.
 */

export const BASE_WIN_RATE: Record<StrategyId, number> = {
  "session-breakout": 45,
  range: 55,
  "ema-pullback": 52,
  scalp: 48,
};

export const STRATEGY_NAME: Record<StrategyId, string> = {
  "session-breakout": "Asian-range session breakout",
  range: "Range trade at support / resistance",
  "ema-pullback": "EMA trend pullback",
  scalp: "Session scalp (micro pullback)",
};

export const STRATEGY_SOURCE: Record<StrategyId, string> = {
  "session-breakout": "BabyPips Path, Strategy 1 (Part 10)",
  range: "Varsity Path, Strategy 2 (Part 9)",
  "ema-pullback": "Varsity Path, Strategy 3 (Part 10)",
  scalp: "Derived: guide building blocks on the 5m/15m",
};

export type Confluence = { label: string; weight: number };

export function winProbability(
  strategy: StrategyId,
  confluences: Confluence[],
  penalties: Confluence[],
): number {
  const base = BASE_WIN_RATE[strategy];
  const plus = confluences.reduce((a, c) => a + c.weight, 0);
  const minus = penalties.reduce((a, c) => a + c.weight, 0);
  // Diminishing returns: ten ticked boxes do not make a certainty.
  const adjusted = base + 12 * Math.tanh(plus / 12) * 1.6 - minus;
  return Math.round(Math.max(28, Math.min(82, adjusted)));
}

/** Expectancy in R: (p x reward) - ((1 - p) x 1). */
export function expectancyR(winProb: number, rewardRisk: number): number {
  const p = winProb / 100;
  return p * rewardRisk - (1 - p);
}

/** Win rate a reward-to-risk ratio needs just to break even, before costs. */
export function breakEvenWinRate(rewardRisk: number): number {
  return (100 / (1 + rewardRisk));
}
