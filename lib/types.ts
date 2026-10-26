export type Candle = {
  /** Candle open time in epoch milliseconds (UTC). */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Interval = "5m" | "15m" | "1h" | "4h" | "1d";

export type Direction = "BUY" | "SELL";

export type StrategyId = "session-breakout" | "range" | "ema-pullback" | "scalp";

export type Signal = {
  id: string;
  symbol: string;
  displaySymbol: string;
  strategy: StrategyId;
  strategyName: string;
  /** Source guide the rules come from. */
  source: string;
  direction: Direction;
  /** "LIVE" = every rule passes right now, "FORMING" = setup is building, waiting for the trigger. */
  state: "LIVE" | "FORMING";
  entry: number;
  stop: number;
  target1: number;
  target2: number;
  riskPerUnit: number;
  rewardRisk: number;
  /** Modelled probability of hitting target 1 before the stop, 0-100. */
  winProbability: number;
  expectancyR: number;
  timeframe: string;
  /** Short one-line verdict. */
  headline: string;
  /** Bullet reasons: the confluence that fired. */
  reasons: string[];
  /** Bullet warnings: what would invalidate it. */
  warnings: string[];
  summary: string;
  retracement: RetracementInfo | null;
  createdAt: number;
  newsBlackout: boolean;
};

export type RetracementInfo = {
  swingHigh: number;
  swingLow: number;
  direction: "up" | "down";
  /** Current retracement depth of the last impulse, in percent. */
  depthPct: number;
  levels: { ratio: number; label: string; price: number }[];
  /** 127.2% / 161.8% extension targets measured from the pullback end. */
  extensions: { ratio: number; label: string; price: number }[];
  inGoldenZone: boolean;
  note: string;
};

export type IndicatorSnapshot = {
  interval: Interval;
  close: number;
  ema20: number;
  ema50: number;
  ema200: number;
  rsi14: number;
  atr14: number;
  atrPct: number;
  adx14: number;
  plusDI: number;
  minusDI: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  bbWidthPct: number;
  stochK: number;
  stochD: number;
  /** Market environment per BabyPips Grade 11. */
  environment: "TRENDING" | "RANGING" | "QUIET-EXPANDING" | "CHAOTIC";
  structure: "UPTREND" | "DOWNTREND" | "RANGE";
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  /** -100 (max bearish) to +100 (max bullish). */
  score: number;
  notes: string[];
};

export type BiasReport = {
  symbol: string;
  displaySymbol: string;
  price: number;
  changePct: number;
  /** Weighted multi-timeframe verdict: which side the market can go. */
  verdict: "STRONG BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG SELL";
  score: number;
  confidence: number;
  timeframes: IndicatorSnapshot[];
  levels: KeyLevels;
  retracement: RetracementInfo | null;
  summary: string;
  updatedAt: number;
};

export type KeyLevels = {
  asianHigh: number | null;
  asianLow: number | null;
  asianMid: number | null;
  asianWidth: number | null;
  dayHigh: number;
  dayLow: number;
  prevDayHigh: number;
  prevDayLow: number;
  prevDayClose: number;
  pivot: number;
  r1: number;
  r2: number;
  s1: number;
  s2: number;
  /** Central Pivot Range (Varsity chapter 22). */
  cprTop: number;
  cprBottom: number;
  cprWidthPct: number;
  cprVerdict: string;
  support: number[];
  resistance: number[];
};

export type NewsEvent = {
  id: string;
  title: string;
  country: string;
  currency: string;
  impact: "High" | "Medium" | "Low" | "Holiday";
  /** Epoch ms, UTC. Null for all-day / tentative events. */
  time: number | null;
  forecast: string;
  previous: string;
  /** Pairs and instruments this release can move. */
  affects: string[];
  goldRelevance: "DIRECT" | "INDIRECT" | "LOW";
  note: string;
};

export type ApiError = { error: string; detail?: string };
