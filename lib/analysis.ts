import {
  adx,
  atr,
  bollinger,
  candlePatterns,
  centralPivotRange,
  ema,
  FIB_RATIOS,
  last,
  lastValid,
  macd,
  marketStructure,
  pivotPoints,
  rsi,
  rsiDivergence,
  stochastic,
  supportResistance,
  swingPoints,
} from "./indicators";
import { istDateKey, istMinutes, sessionWindows } from "./sessions";
import type { BiasReport, Candle, IndicatorSnapshot, Interval, KeyLevels, RetracementInfo } from "./types";
import { getSymbol } from "./symbols";

export type Analysis = {
  interval: Interval;
  candles: Candle[];
  close: number;
  ema20: number;
  ema50: number;
  ema200: number;
  ema20Series: number[];
  ema50Series: number[];
  ema200Series: number[];
  rsiSeries: number[];
  rsi14: number;
  atr14: number;
  adx14: number;
  plusDI: number;
  minusDI: number;
  macd: { line: number; signal: number; hist: number };
  bb: { upper: number; middle: number; lower: number; widthPct: number };
  stoch: { k: number; d: number };
  patterns: { bullish: string[]; bearish: string[] };
  divergence: ReturnType<typeof rsiDivergence>;
  structure: ReturnType<typeof marketStructure>;
  zones: ReturnType<typeof supportResistance>;
  snapshot: IndicatorSnapshot;
};

function slope(series: number[], lookback = 5): number {
  const valid = series.filter((v) => !Number.isNaN(v));
  if (valid.length < lookback + 1) return 0;
  const now = valid[valid.length - 1];
  const before = valid[valid.length - 1 - lookback];
  return before ? ((now - before) / before) * 100 : 0;
}

export function analyse(candles: Candle[], interval: Interval): Analysis {
  const closes = candles.map((c) => c.close);
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const e200 = ema(closes, 200);
  const rsiSeries = rsi(closes, 14);
  const atrSeries = atr(candles, 14);
  const { adx: adxSeries, plusDI, minusDI } = adx(candles, 14);
  const m = macd(closes);
  const bb = bollinger(closes, 20, 2);
  const st = stochastic(candles, 14, 3, 3);
  const structure = marketStructure(candles, 3);
  const zones = supportResistance(candles);
  const patterns = candlePatterns(candles);
  const divergence = rsiDivergence(candles, rsiSeries);

  const close = last(candles).close;
  const ema20 = lastValid(e20);
  const ema50 = lastValid(e50);
  const ema200 = lastValid(e200);
  const atr14 = lastValid(atrSeries);
  const adx14 = lastValid(adxSeries);
  const bbUpper = lastValid(bb.upper);
  const bbLower = lastValid(bb.lower);
  const bbMiddle = lastValid(bb.middle);
  const bbWidthPct = bbMiddle ? ((bbUpper - bbLower) / bbMiddle) * 100 : 0;

  // Bollinger squeeze: current width in the bottom third of the last 50 readings.
  const widthHistory = bb.upper
    .map((u, i) => (Number.isNaN(u) || Number.isNaN(bb.lower[i]) ? NaN : u - bb.lower[i]))
    .filter((v) => !Number.isNaN(v))
    .slice(-50);
  const sortedWidth = [...widthHistory].sort((a, b) => a - b);
  const squeezeThreshold = sortedWidth[Math.floor(sortedWidth.length * 0.33)] ?? Infinity;
  const squeezing = bbUpper - bbLower <= squeezeThreshold;

  const rsi14 = lastValid(rsiSeries);
  const atrPct = close ? (atr14 / close) * 100 : 0;
  const recentAtr = atrSeries.filter((v) => !Number.isNaN(v)).slice(-30);
  const avgAtr = recentAtr.length ? recentAtr.reduce((a, b) => a + b, 0) / recentAtr.length : atr14;

  let environment: IndicatorSnapshot["environment"] = "RANGING";
  if (atr14 > avgAtr * 2.2) environment = "CHAOTIC";
  else if (adx14 >= 25) environment = "TRENDING";
  else if (adx14 < 20 && squeezing) environment = "QUIET-EXPANDING";
  else if (adx14 < 20) environment = "RANGING";
  else environment = structure.structure === "RANGE" ? "RANGING" : "TRENDING";

  // Scored bias, built from the checks both guides use.
  const notes: string[] = [];
  let score = 0;
  // The 200 EMA needs 200 closes. On a short history it is simply unknown, and an
  // unknown must not be read as bearish.
  const haveEma200 = Number.isFinite(ema200);
  if (!haveEma200) {
    notes.push("Not enough history for a 200 EMA on this timeframe - long-term filter skipped.");
  } else if (close > ema200) {
    score += 18;
    notes.push("Price above the 200 EMA - favour buying.");
  } else {
    score -= 18;
    notes.push("Price below the 200 EMA - favour selling.");
  }
  if (haveEma200) {
    if (ema50 > ema200) {
      score += 12;
      notes.push("50 EMA above 200 EMA (golden-cross structure).");
    } else {
      score -= 12;
      notes.push("50 EMA below 200 EMA (death-cross structure).");
    }
  }
  if (close > ema20) score += 8;
  else score -= 8;
  const e50Slope = slope(e50);
  if (e50Slope > 0.05) {
    score += 8;
    notes.push("50 EMA sloping up.");
  } else if (e50Slope < -0.05) {
    score -= 8;
    notes.push("50 EMA sloping down.");
  }
  if (structure.structure === "UPTREND") {
    score += 15;
    notes.push("Higher highs and higher lows (Dow Theory uptrend).");
  } else if (structure.structure === "DOWNTREND") {
    score -= 15;
    notes.push("Lower highs and lower lows (Dow Theory downtrend).");
  } else notes.push("No clean swing structure - treat as a range.");
  if (m.hist.length) {
    const hist = lastValid(m.hist);
    const line = lastValid(m.line);
    if (line > 0) score += 7;
    else score -= 7;
    if (hist > 0) score += 5;
    else score -= 5;
    notes.push(`MACD ${line > 0 ? "above" : "below"} zero, histogram ${hist > 0 ? "rising" : "falling"}.`);
  }
  if (adx14 >= 25) {
    const trendUp = plusDI[plusDI.length - 1] > minusDI[minusDI.length - 1];
    score += trendUp ? 10 : -10;
    notes.push(`ADX ${adx14.toFixed(0)} with ${trendUp ? "+DI" : "-DI"} on top: trending ${trendUp ? "up" : "down"}.`);
  } else {
    notes.push(`ADX ${adx14.toFixed(0)} - weak or no trend, range tools come first.`);
  }
  if (environment === "RANGING" || environment === "QUIET-EXPANDING") {
    // In ranges the oscillators lead, so RSI extremes count against the move.
    if (rsi14 < 30) {
      score += 10;
      notes.push(`RSI ${rsi14.toFixed(0)} oversold inside a range - look to buy support.`);
    } else if (rsi14 > 70) {
      score -= 10;
      notes.push(`RSI ${rsi14.toFixed(0)} overbought inside a range - look to sell resistance.`);
    }
  } else if (rsi14 > 70) {
    notes.push(`RSI ${rsi14.toFixed(0)} is high, but in a trend that is strength, not a sell signal.`);
  } else if (rsi14 >= 45 && rsi14 <= 60) {
    notes.push(`RSI ${rsi14.toFixed(0)} holding mid-range - healthy trend pullback zone.`);
  }
  if (divergence.regularBearish) {
    score -= 8;
    notes.push("Regular bearish RSI divergence: upward momentum fading.");
  }
  if (divergence.regularBullish) {
    score += 8;
    notes.push("Regular bullish RSI divergence: downward momentum fading.");
  }
  if (divergence.hiddenBullish) {
    score += 4;
    notes.push("Hidden bullish divergence: uptrend likely to continue.");
  }
  if (divergence.hiddenBearish) {
    score -= 4;
    notes.push("Hidden bearish divergence: downtrend likely to continue.");
  }
  if (patterns.bullish.length) {
    score += 6;
    notes.push(`Last candle: ${patterns.bullish.join(", ")}.`);
  }
  if (patterns.bearish.length) {
    score -= 6;
    notes.push(`Last candle: ${patterns.bearish.join(", ")}.`);
  }
  if (squeezing) notes.push("Bollinger squeeze: volatility is coiled, expect expansion.");

  score = Math.max(-100, Math.min(100, score));
  const bias: IndicatorSnapshot["bias"] = score >= 20 ? "BULLISH" : score <= -20 ? "BEARISH" : "NEUTRAL";

  const snapshot: IndicatorSnapshot = {
    interval,
    close,
    ema20,
    ema50,
    ema200,
    rsi14,
    atr14,
    atrPct,
    adx14,
    plusDI: plusDI[plusDI.length - 1] ?? NaN,
    minusDI: minusDI[minusDI.length - 1] ?? NaN,
    macd: lastValid(m.line),
    macdSignal: lastValid(m.signal),
    macdHist: lastValid(m.hist),
    bbUpper,
    bbMiddle,
    bbLower,
    bbWidthPct,
    stochK: lastValid(st.k),
    stochD: lastValid(st.d),
    environment,
    structure: structure.structure,
    bias,
    score,
    notes,
  };

  return {
    interval,
    candles,
    close,
    ema20,
    ema50,
    ema200,
    ema20Series: e20,
    ema50Series: e50,
    ema200Series: e200,
    rsiSeries,
    rsi14,
    atr14,
    adx14,
    plusDI: plusDI[plusDI.length - 1] ?? NaN,
    minusDI: minusDI[minusDI.length - 1] ?? NaN,
    macd: { line: lastValid(m.line), signal: lastValid(m.signal), hist: lastValid(m.hist) },
    bb: { upper: bbUpper, middle: bbMiddle, lower: bbLower, widthPct: bbWidthPct },
    stoch: { k: lastValid(st.k), d: lastValid(st.d) },
    patterns,
    divergence,
    structure,
    zones,
    snapshot,
  };
}

/** Retracement of the most recent impulse, with Fibonacci levels and extensions. */
export function retracement(candles: Candle[]): RetracementInfo | null {
  if (candles.length < 20) return null;
  const { highs, lows } = swingPoints(candles, 3);
  // A clean one-way run can have no confirmed swing pivot at all. Fall back to the
  // extremes of the recent window so the retracement monitor never goes blank.
  const window = candles.slice(-60);
  const fallbackHighIdx = window.reduce((best, c, i) => (c.high > window[best].high ? i : best), 0);
  const fallbackLowIdx = window.reduce((best, c, i) => (c.low < window[best].low ? i : best), 0);
  const offset = candles.length - window.length;
  const lastHigh = highs.length
    ? highs[highs.length - 1]
    : { index: offset + fallbackHighIdx, price: window[fallbackHighIdx].high, time: window[fallbackHighIdx].time };
  const lastLow = lows.length
    ? lows[lows.length - 1]
    : { index: offset + fallbackLowIdx, price: window[fallbackLowIdx].low, time: window[fallbackLowIdx].time };
  const price = last(candles).close;
  const impulseUp = lastHigh.index > lastLow.index;
  const swingHigh = lastHigh.price;
  const swingLow = lastLow.price;
  const range = swingHigh - swingLow;
  if (range <= 0) return null;

  const depthPct = impulseUp
    ? ((swingHigh - price) / range) * 100
    : ((price - swingLow) / range) * 100;

  const levels = FIB_RATIOS.map((ratio) => ({
    ratio,
    label: `${(ratio * 100).toFixed(1)}%`,
    price: impulseUp ? swingHigh - range * ratio : swingLow + range * ratio,
  }));

  // Extensions measured from the end of the pullback, as both guides describe.
  const pullbackEnd = impulseUp ? swingHigh - range * (depthPct / 100) : swingLow + range * (depthPct / 100);
  const extensions = [1.272, 1.618].map((ratio) => ({
    ratio,
    label: `${(ratio * 100).toFixed(1)}%`,
    price: impulseUp ? pullbackEnd + range * ratio : pullbackEnd - range * ratio,
  }));

  const inGoldenZone = depthPct >= 38.2 && depthPct <= 61.8;
  let note: string;
  if (depthPct < 0)
    note = "Price has pushed past the old extreme - the impulse is still extending, so there is no retracement to buy yet. Wait for the first pullback.";
  else if (depthPct > 100)
    note = "Price has gone through the other end of the swing: the old impulse is finished and a new swing is forming. Re-measure once it prints a pivot.";
  else if (depthPct < 23.6) note = "Barely pulled back. Price is extended away from the EMAs - wait, do not chase.";
  else if (depthPct < 38.2) note = "Shallow retracement (under 38.2%). Only strong trends resume from here.";
  else if (inGoldenZone)
    note = "Retracement sits in the 38.2-61.8% golden zone, the area where the guides take pullback entries.";
  else if (depthPct <= 78.6) note = "Deep retracement (61.8-78.6%). Last chance for the trend; needs a strong trigger candle.";
  else note = "Retracement beyond 78.6% - the trend is in doubt. Treat the old impulse as finished.";

  return {
    swingHigh,
    swingLow,
    direction: impulseUp ? "up" : "down",
    depthPct,
    levels,
    extensions,
    inGoldenZone,
    note,
  };
}

/** Asian range, day levels, floor pivots and the CPR. */
export function keyLevels(h1: Candle[], d1: Candle[], now = new Date()): KeyLevels {
  const w = sessionWindows(now);
  const todayKey = istDateKey(now);
  const asian = h1.filter((c) => {
    if (istDateKey(c.time) !== todayKey) return false;
    const m = istMinutes(c.time);
    return m >= w.asiaStart && m < w.asiaEnd;
  });
  const asianHigh = asian.length ? Math.max(...asian.map((c) => c.high)) : null;
  const asianLow = asian.length ? Math.min(...asian.map((c) => c.low)) : null;

  const todayCandles = h1.filter((c) => istDateKey(c.time) === todayKey);
  const dayHigh = todayCandles.length ? Math.max(...todayCandles.map((c) => c.high)) : last(h1).high;
  const dayLow = todayCandles.length ? Math.min(...todayCandles.map((c) => c.low)) : last(h1).low;

  const prevDay = d1[d1.length - 2] ?? d1[d1.length - 1];
  const p = pivotPoints(prevDay.high, prevDay.low, prevDay.close);
  const cpr = centralPivotRange(prevDay.high, prevDay.low, prevDay.close);
  const cprWidthPct = prevDay.close ? (cpr.width / prevDay.close) * 100 : 0;
  const cprVerdict =
    cprWidthPct < 0.15
      ? "Narrow CPR - a trending day is more likely. Favour breakout and pullback trades."
      : cprWidthPct > 0.45
        ? "Wide CPR - a sideways day is more likely. Favour range trades."
        : "Average CPR width - no strong day-type bias.";

  const zones = supportResistance(h1);
  return {
    asianHigh,
    asianLow,
    asianMid: asianHigh != null && asianLow != null ? (asianHigh + asianLow) / 2 : null,
    asianWidth: asianHigh != null && asianLow != null ? asianHigh - asianLow : null,
    dayHigh,
    dayLow,
    prevDayHigh: prevDay.high,
    prevDayLow: prevDay.low,
    prevDayClose: prevDay.close,
    pivot: p.pivot,
    r1: p.r1,
    r2: p.r2,
    s1: p.s1,
    s2: p.s2,
    cprTop: cpr.top,
    cprBottom: cpr.bottom,
    cprWidthPct,
    cprVerdict,
    support: zones.support.slice(0, 3).map((z) => z.price),
    resistance: zones.resistance.slice(0, 3).map((z) => z.price),
  };
}

const TF_WEIGHT: Record<string, number> = { "1d": 0.35, "4h": 0.3, "1h": 0.2, "15m": 0.1, "5m": 0.05 };

/** Weighted multi-timeframe verdict: which side the market can go from here. */
export function buildBiasReport(
  symbolKey: string,
  analyses: Analysis[],
  levels: KeyLevels,
  retr: RetracementInfo | null,
): BiasReport {
  const spec = getSymbol(symbolKey);
  let weighted = 0;
  let weightSum = 0;
  for (const a of analyses) {
    const w = TF_WEIGHT[a.interval] ?? 0.1;
    weighted += a.snapshot.score * w;
    weightSum += w;
  }
  const score = weightSum ? weighted / weightSum : 0;
  const verdict: BiasReport["verdict"] =
    score >= 45 ? "STRONG BUY" : score >= 18 ? "BUY" : score <= -45 ? "STRONG SELL" : score <= -18 ? "SELL" : "NEUTRAL";

  // Confidence rises when the timeframes agree with each other.
  const signs = analyses.map((a) => Math.sign(a.snapshot.score));
  const agreement = signs.length
    ? Math.abs(signs.reduce((a, b) => a + b, 0)) / signs.length
    : 0;
  const confidence = Math.round(Math.min(95, 40 + agreement * 40 + Math.min(Math.abs(score), 60) * 0.25));

  const daily = analyses.find((a) => a.interval === "1d");
  const h4 = analyses.find((a) => a.interval === "4h");
  const h1 = analyses.find((a) => a.interval === "1h");
  // The live price must come from the FASTEST timeframe that loaded (5m), not the last
  // entry in the list - that is the daily candle, which lags by hours.
  const fastest = analyses[0];
  const price = fastest?.close ?? 0;
  const dailyCandles = daily?.candles ?? [];
  const prevClose = dailyCandles.length > 1 ? dailyCandles[dailyCandles.length - 2].close : price;

  const parts: string[] = [];
  parts.push(
    `Multi-timeframe read is ${verdict} (score ${score.toFixed(0)}/100, ${confidence}% timeframe agreement).`,
  );
  if (daily) parts.push(`Daily: ${daily.snapshot.structure.toLowerCase()}, ADX ${daily.adx14.toFixed(0)}, ${daily.snapshot.environment.toLowerCase()} environment.`);
  if (h4)
    parts.push(
      `4-hour: price ${h4.close > h4.ema50 ? "above" : "below"} the 50 EMA (${h4.ema50.toFixed(spec?.digits ?? 2)}), RSI ${h4.rsi14.toFixed(0)}, ATR ${h4.atr14.toFixed(2)}.`,
    );
  if (h1) parts.push(`1-hour trigger frame RSI ${h1.rsi14.toFixed(0)}, ATR ${h1.atr14.toFixed(2)}.`);
  if (retr) parts.push(retr.note);
  parts.push(levels.cprVerdict);

  return {
    symbol: symbolKey,
    displaySymbol: spec?.label ?? symbolKey,
    price,
    changePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
    verdict,
    score,
    confidence,
    timeframes: analyses.map((a) => a.snapshot),
    levels,
    retracement: retr,
    summary: parts.join(" "),
    updatedAt: Date.now(),
  };
}
