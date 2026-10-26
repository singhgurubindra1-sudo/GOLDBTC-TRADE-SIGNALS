import type { Candle } from "./types";

/**
 * Indicator maths, with the settings the two study guides specify:
 * EMA 20/50/200, RSI 14, ATR 14, ADX 14, MACD 12/26/9, Bollinger 20/2, Stochastic 14/3/3.
 */

export function sma(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** EMA today = price x k + EMA yesterday x (1 - k), k = 2 / (period + 1). */
export function ema(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder's smoothing, used by RSI, ATR and ADX. */
function wilder(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let prev = sum / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = (prev * (period - 1) + values[i]) / period;
    out[i] = prev;
  }
  return out;
}

/** RSI = 100 - 100 / (1 + RS). */
export function rsi(closes: number[], period = 14): number[] {
  const gains: number[] = [0];
  const losses: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(Math.max(diff, 0));
    losses.push(Math.max(-diff, 0));
  }
  const avgGain = wilder(gains.slice(1), period);
  const avgLoss = wilder(losses.slice(1), period);
  const out: number[] = new Array(closes.length).fill(NaN);
  for (let i = 0; i < avgGain.length; i++) {
    const g = avgGain[i];
    const l = avgLoss[i];
    if (Number.isNaN(g) || Number.isNaN(l)) continue;
    out[i + 1] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
  }
  return out;
}

export function trueRanges(candles: Candle[]): number[] {
  const tr: number[] = [candles.length ? candles[0].high - candles[0].low : 0];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = candles[i - 1].close;
    tr.push(Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose)));
  }
  return tr;
}

/** ATR(14): the guides call this the single most useful gold indicator. */
export function atr(candles: Candle[], period = 14): number[] {
  return wilder(trueRanges(candles), period);
}

export function adx(candles: Candle[], period = 14) {
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
  }
  const tr = trueRanges(candles);
  const atrS = wilder(tr, period);
  const plusS = wilder(plusDM, period);
  const minusS = wilder(minusDM, period);
  const plusDI: number[] = [];
  const minusDI: number[] = [];
  const dx: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const a = atrS[i];
    if (!a || Number.isNaN(a)) {
      plusDI.push(NaN);
      minusDI.push(NaN);
      dx.push(NaN);
      continue;
    }
    const p = (100 * plusS[i]) / a;
    const m = (100 * minusS[i]) / a;
    plusDI.push(p);
    minusDI.push(m);
    dx.push(p + m === 0 ? 0 : (100 * Math.abs(p - m)) / (p + m));
  }
  const valid = dx.filter((v) => !Number.isNaN(v));
  const adxSmoothed = wilder(valid, period);
  const offset = dx.length - valid.length;
  const adxOut: number[] = new Array(candles.length).fill(NaN);
  for (let i = 0; i < adxSmoothed.length; i++) adxOut[i + offset] = adxSmoothed[i];
  return { adx: adxOut, plusDI, minusDI };
}

export function macd(closes: number[], fast = 12, slow = 26, signalPeriod = 9) {
  const fastE = ema(closes, fast);
  const slowE = ema(closes, slow);
  const line = closes.map((_, i) =>
    Number.isNaN(fastE[i]) || Number.isNaN(slowE[i]) ? NaN : fastE[i] - slowE[i],
  );
  const firstValid = line.findIndex((v) => !Number.isNaN(v));
  const compact = firstValid === -1 ? [] : line.slice(firstValid);
  const sigCompact = ema(compact, signalPeriod);
  const signal: number[] = new Array(closes.length).fill(NaN);
  for (let i = 0; i < sigCompact.length; i++) signal[i + firstValid] = sigCompact[i];
  const hist = line.map((v, i) =>
    Number.isNaN(v) || Number.isNaN(signal[i]) ? NaN : v - signal[i],
  );
  return { line, signal, hist };
}

export function bollinger(closes: number[], period = 20, mult = 2) {
  const mid = sma(closes, period);
  const upper: number[] = new Array(closes.length).fill(NaN);
  const lower: number[] = new Array(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = mid[i];
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper[i] = mean + mult * sd;
    lower[i] = mean - mult * sd;
  }
  return { upper, middle: mid, lower };
}

export function stochastic(candles: Candle[], kPeriod = 14, kSmooth = 3, dSmooth = 3) {
  const raw: number[] = new Array(candles.length).fill(NaN);
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const hh = Math.max(...slice.map((c) => c.high));
    const ll = Math.min(...slice.map((c) => c.low));
    raw[i] = hh === ll ? 50 : ((candles[i].close - ll) / (hh - ll)) * 100;
  }
  const firstValid = raw.findIndex((v) => !Number.isNaN(v));
  const compact = firstValid === -1 ? [] : raw.slice(firstValid);
  const kS = sma(compact, kSmooth);
  const dS = sma(kS.filter((v) => !Number.isNaN(v)), dSmooth);
  const k: number[] = new Array(candles.length).fill(NaN);
  const d: number[] = new Array(candles.length).fill(NaN);
  for (let i = 0; i < kS.length; i++) k[i + firstValid] = kS[i];
  const dOffset = candles.length - dS.length;
  for (let i = 0; i < dS.length; i++) d[i + dOffset] = dS[i];
  return { k, d };
}

/** Supertrend (10, 3) - the Varsity guide's optional trailing stop for strategy 3. */
export function supertrend(candles: Candle[], period = 10, mult = 3) {
  const atrS = atr(candles, period);
  const dir: number[] = new Array(candles.length).fill(1);
  const line: number[] = new Array(candles.length).fill(NaN);
  let upper = NaN;
  let lower = NaN;
  for (let i = 0; i < candles.length; i++) {
    const a = atrS[i];
    if (Number.isNaN(a)) continue;
    const mid = (candles[i].high + candles[i].low) / 2;
    const bUpper = mid + mult * a;
    const bLower = mid - mult * a;
    const prevClose = i > 0 ? candles[i - 1].close : candles[i].close;
    upper = Number.isNaN(upper) || bUpper < upper || prevClose > upper ? bUpper : upper;
    lower = Number.isNaN(lower) || bLower > lower || prevClose < lower ? bLower : lower;
    const prevDir = i > 0 ? dir[i - 1] : 1;
    let d = prevDir;
    if (candles[i].close > upper) d = 1;
    else if (candles[i].close < lower) d = -1;
    dir[i] = d;
    line[i] = d === 1 ? lower : upper;
  }
  return { line, dir };
}

export function last<T>(arr: T[]): T {
  return arr[arr.length - 1];
}

export function lastValid(arr: number[]): number {
  for (let i = arr.length - 1; i >= 0; i--) if (!Number.isNaN(arr[i])) return arr[i];
  return NaN;
}

/** Swing pivots: a high with `lookback` lower highs on both sides (and the mirror for lows). */
export function swingPoints(candles: Candle[], lookback = 3) {
  const highs: { index: number; price: number; time: number }[] = [];
  const lows: { index: number; price: number; time: number }[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const windowSlice = candles.slice(i - lookback, i + lookback + 1);
    const isHigh = windowSlice.every((c) => c.high <= candles[i].high);
    const isLow = windowSlice.every((c) => c.low >= candles[i].low);
    if (isHigh) highs.push({ index: i, price: candles[i].high, time: candles[i].time });
    if (isLow) lows.push({ index: i, price: candles[i].low, time: candles[i].time });
  }
  return { highs, lows };
}

/** Dow Theory structure: higher highs + higher lows, or lower highs + lower lows. */
export function marketStructure(candles: Candle[], lookback = 3) {
  const { highs, lows } = swingPoints(candles, lookback);
  const h = highs.slice(-3);
  const l = lows.slice(-3);
  const higherHighs = h.length >= 2 && h[h.length - 1].price > h[h.length - 2].price;
  const higherLows = l.length >= 2 && l[l.length - 1].price > l[l.length - 2].price;
  const lowerHighs = h.length >= 2 && h[h.length - 1].price < h[h.length - 2].price;
  const lowerLows = l.length >= 2 && l[l.length - 1].price < l[l.length - 2].price;
  let structure: "UPTREND" | "DOWNTREND" | "RANGE" = "RANGE";
  if (higherHighs && higherLows) structure = "UPTREND";
  else if (lowerHighs && lowerLows) structure = "DOWNTREND";
  const lastHigherLow = l.length ? l[l.length - 1].price : null;
  const lastLowerHigh = h.length ? h[h.length - 1].price : null;
  return { structure, higherHighs, higherLows, lowerHighs, lowerLows, lastHigherLow, lastLowerHigh, highs, lows };
}

/** Support and resistance zones clustered from swing pivots, nearest first. */
export function supportResistance(candles: Candle[], tolerancePct = 0.0025) {
  const { highs, lows } = swingPoints(candles, 3);
  const cluster = (points: { price: number }[]) => {
    const zones: { price: number; touches: number }[] = [];
    for (const p of points) {
      const found = zones.find((z) => Math.abs(z.price - p.price) / p.price < tolerancePct);
      if (found) {
        found.price = (found.price * found.touches + p.price) / (found.touches + 1);
        found.touches += 1;
      } else zones.push({ price: p.price, touches: 1 });
    }
    return zones.sort((a, b) => b.touches - a.touches);
  };
  const price = last(candles).close;
  const resistance = cluster(highs)
    .filter((z) => z.price > price)
    .sort((a, b) => a.price - b.price);
  const support = cluster(lows)
    .filter((z) => z.price < price)
    .sort((a, b) => b.price - a.price);
  return { support, resistance };
}

/** Classic floor pivots. P = (H + L + C) / 3. */
export function pivotPoints(high: number, low: number, close: number) {
  const p = (high + low + close) / 3;
  return {
    pivot: p,
    r1: 2 * p - low,
    r2: p + (high - low),
    r3: high + 2 * (p - low),
    s1: 2 * p - high,
    s2: p - (high - low),
    s3: low - 2 * (high - p),
  };
}

/** Central Pivot Range (Varsity chapter 22). */
export function centralPivotRange(high: number, low: number, close: number) {
  const p = (high + low + close) / 3;
  const bc = (high + low) / 2;
  const tc = p - bc + p;
  const top = Math.max(tc, bc);
  const bottom = Math.min(tc, bc);
  return { pivot: p, top, bottom, width: top - bottom };
}

export const FIB_RATIOS = [0.236, 0.382, 0.5, 0.618, 0.786];

/** Candlestick triggers the guides use for entries. */
export function candlePatterns(candles: Candle[]) {
  const n = candles.length;
  if (n < 3) return { bullish: [] as string[], bearish: [] as string[] };
  const c = candles[n - 1];
  const p = candles[n - 2];
  const p2 = candles[n - 3];
  const body = Math.abs(c.close - c.open);
  const range = c.high - c.low || 1e-9;
  const upperWick = c.high - Math.max(c.close, c.open);
  const lowerWick = Math.min(c.close, c.open) - c.low;
  const prevBody = Math.abs(p.close - p.open);
  const bullish: string[] = [];
  const bearish: string[] = [];

  if (lowerWick > body * 2 && upperWick < body && body / range < 0.4) bullish.push("Hammer");
  if (upperWick > body * 2 && lowerWick < body && body / range < 0.4) bearish.push("Shooting star");
  if (body / range < 0.1) bullish.push("Doji (indecision)");
  if (body / range > 0.9 && c.close > c.open) bullish.push("Bullish marubozu");
  if (body / range > 0.9 && c.close < c.open) bearish.push("Bearish marubozu");
  if (c.close > c.open && p.close < p.open && c.close >= p.open && c.open <= p.close)
    bullish.push("Bullish engulfing");
  if (c.close < c.open && p.close > p.open && c.close <= p.open && c.open >= p.close)
    bearish.push("Bearish engulfing");
  if (c.close > c.open && p.close < p.open && c.close > (p.open + p.close) / 2 && c.open < p.close)
    bullish.push("Piercing pattern");
  if (c.close < c.open && p.close > p.open && c.close < (p.open + p.close) / 2 && c.open > p.close)
    bearish.push("Dark cloud cover");
  if (
    p2.close < p2.open &&
    prevBody / (p.high - p.low || 1e-9) < 0.35 &&
    c.close > c.open &&
    c.close > (p2.open + p2.close) / 2
  )
    bullish.push("Morning star");
  if (
    p2.close > p2.open &&
    prevBody / (p.high - p.low || 1e-9) < 0.35 &&
    c.close < c.open &&
    c.close < (p2.open + p2.close) / 2
  )
    bearish.push("Evening star");
  return { bullish, bearish };
}

/** RSI divergence between the last two swings (regular and hidden). */
export function rsiDivergence(candles: Candle[], rsiValues: number[]) {
  const { highs, lows } = swingPoints(candles, 3);
  const out = {
    regularBullish: false,
    regularBearish: false,
    hiddenBullish: false,
    hiddenBearish: false,
  };
  if (lows.length >= 2) {
    const a = lows[lows.length - 2];
    const b = lows[lows.length - 1];
    const ra = rsiValues[a.index];
    const rb = rsiValues[b.index];
    if (!Number.isNaN(ra) && !Number.isNaN(rb)) {
      if (b.price < a.price && rb > ra) out.regularBullish = true;
      if (b.price > a.price && rb < ra) out.hiddenBullish = true;
    }
  }
  if (highs.length >= 2) {
    const a = highs[highs.length - 2];
    const b = highs[highs.length - 1];
    const ra = rsiValues[a.index];
    const rb = rsiValues[b.index];
    if (!Number.isNaN(ra) && !Number.isNaN(rb)) {
      if (b.price > a.price && rb < ra) out.regularBearish = true;
      if (b.price < a.price && rb > ra) out.hiddenBearish = true;
    }
  }
  return out;
}
