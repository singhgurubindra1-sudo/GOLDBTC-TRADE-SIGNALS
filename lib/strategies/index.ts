import { atr, last } from "../indicators";
import { inBreakoutWindow, inRolloverWindow, inScalpWindow, istClock, sessionWindows, currentSession } from "../sessions";
import { getSymbol } from "../symbols";
import type { Analysis } from "../analysis";
import type { Candle, Direction, KeyLevels, NewsEvent, RetracementInfo, Signal, StrategyId } from "../types";
import { breakEvenWinRate, expectancyR, STRATEGY_NAME, STRATEGY_SOURCE, winProbability, type Confluence } from "../winrate";

export type StrategyContext = {
  symbol: string;
  analyses: Record<string, Analysis>;
  levels: KeyLevels;
  retracement: RetracementInfo | null;
  now: Date;
  /** High-impact news inside the 30-minutes-either-side window. */
  blackout: { blocked: boolean; event: NewsEvent | null; minutesAway: number | null };
  /** The next event that can move this instrument, whatever the distance. */
  nextEvent: NewsEvent | null;
};

function round(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

function hoursUntil(event: NewsEvent | null, now: Date): number | null {
  if (!event?.time) return null;
  return (event.time - now.getTime()) / 3_600_000;
}

type Draft = {
  strategy: StrategyId;
  direction: Direction;
  state: Signal["state"];
  entry: number;
  stop: number;
  target1: number;
  target2: number;
  timeframe: string;
  headline: string;
  reasons: string[];
  warnings: string[];
  confluences: Confluence[];
  penalties: Confluence[];
  retracement?: RetracementInfo | null;
};

function finalise(ctx: StrategyContext, d: Draft): Signal | null {
  const spec = getSymbol(ctx.symbol);
  const digits = spec?.digits ?? 2;
  const risk = Math.abs(d.entry - d.stop);
  if (!Number.isFinite(risk) || risk <= 0) return null;
  const reward = Math.abs(d.target2 - d.entry);
  const rewardRisk = reward / risk;
  // Both guides refuse trades that cannot pay at least 1.5 : 1.
  if (rewardRisk < 1.4) return null;

  const penalties = [...d.penalties];
  if (ctx.blackout.blocked && ctx.blackout.event) {
    penalties.push({
      label: `High-impact ${ctx.blackout.event.currency} news ${ctx.blackout.minutesAway}m away (${ctx.blackout.event.title})`,
      weight: 12,
    });
  }
  if (inRolloverWindow(ctx.now)) penalties.push({ label: "Daily rollover window - spreads are widest", weight: 6 });

  const prob = winProbability(d.strategy, d.confluences, penalties);
  const exp = expectancyR(prob, rewardRisk);
  const breakEven = breakEvenWinRate(rewardRisk);

  const summaryBits: string[] = [];
  summaryBits.push(
    `${d.direction === "BUY" ? "Upside" : "Downside"} setup on ${spec?.label ?? ctx.symbol} from the ${STRATEGY_NAME[d.strategy]} playbook (${d.timeframe}).`,
  );
  summaryBits.push(d.reasons.join(" "));
  summaryBits.push(
    `Risk ${risk.toFixed(digits)} per ${spec?.unit ?? "unit"}, reward-to-risk ${rewardRisk.toFixed(2)} : 1, so this needs about ${breakEven.toFixed(0)}% wins just to break even; the model puts it at ${prob}%, expectancy ${exp >= 0 ? "+" : ""}${exp.toFixed(2)}R per trade.`,
  );
  if (penalties.length) summaryBits.push(`Held back by: ${penalties.map((p) => p.label).join("; ")}.`);

  return {
    id: `${ctx.symbol}-${d.strategy}-${d.direction}-${Math.round(d.entry * 100)}`,
    symbol: ctx.symbol,
    displaySymbol: spec?.label ?? ctx.symbol,
    strategy: d.strategy,
    strategyName: STRATEGY_NAME[d.strategy],
    source: STRATEGY_SOURCE[d.strategy],
    direction: d.direction,
    state: d.state,
    entry: round(d.entry, digits),
    stop: round(d.stop, digits),
    target1: round(d.target1, digits),
    target2: round(d.target2, digits),
    riskPerUnit: round(risk, digits),
    rewardRisk: Number(rewardRisk.toFixed(2)),
    winProbability: prob,
    expectancyR: Number(exp.toFixed(2)),
    timeframe: d.timeframe,
    headline: d.headline,
    reasons: d.reasons,
    warnings: [...d.warnings, ...penalties.map((p) => p.label)],
    summary: summaryBits.join(" "),
    retracement: d.retracement ?? ctx.retracement,
    createdAt: Date.now(),
    newsBlackout: ctx.blackout.blocked,
  };
}

/* ------------------------------------------------------------------ *
 * Strategy 1 - Asian range session breakout (BabyPips Path, Part 10)
 * ------------------------------------------------------------------ */
function sessionBreakout(ctx: StrategyContext): Signal[] {
  const m15 = ctx.analyses["15m"];
  const h1 = ctx.analyses["1h"];
  const d1 = ctx.analyses["1d"];
  const { asianHigh, asianLow, asianMid, asianWidth } = ctx.levels;
  if (!m15 || !h1 || !d1 || asianHigh == null || asianLow == null || asianMid == null || asianWidth == null) return [];

  const dailyAtrSeries = atr(d1.candles, 14);
  const dailyAtr = dailyAtrSeries[dailyAtrSeries.length - 1];
  if (!Number.isFinite(dailyAtr) || dailyAtr <= 0) return [];
  const widthRatio = asianWidth / dailyAtr;
  // Rule 2: skip if the Asian range is wider than ~50% or tighter than ~15% of the 14-day ATR.
  if (widthRatio > 0.55 || widthRatio < 0.12) return [];

  const w = sessionWindows(ctx.now);
  const inWindow = inBreakoutWindow(ctx.now);
  const candles = m15.candles;
  const lastCandle = last(candles);
  const body = Math.abs(lastCandle.close - lastCandle.open);
  const range = lastCandle.high - lastCandle.low || 1e-9;
  const strongBody = body / range >= 0.5;
  // Daily bias reference: the 50 EMA, or the 20 EMA on a short daily history.
  const dailyRef = Number.isFinite(d1.ema50) ? d1.ema50 : Number.isFinite(d1.ema20) ? d1.ema20 : d1.close;
  const dailyRefName = Number.isFinite(d1.ema50) ? "daily 50 EMA" : Number.isFinite(d1.ema20) ? "daily 20 EMA" : "daily close";
  const dailyBiasUp = d1.close > dailyRef;

  const out: Signal[] = [];
  const minStop = 0.5 * h1.atr14;

  const build = (direction: Direction, live: boolean): Signal | null => {
    const long = direction === "BUY";
    const breakLevel = long ? asianHigh : asianLow;
    const entry = live ? lastCandle.close : breakLevel;
    let stop = asianMid;
    if (Math.abs(entry - stop) < minStop) stop = long ? asianLow : asianHigh;
    if (Math.abs(entry - stop) < minStop) stop = long ? entry - minStop : entry + minStop;
    const risk = Math.abs(entry - stop);
    const projection = long ? breakLevel + asianWidth : breakLevel - asianWidth;
    const t1 = long ? entry + 1.5 * risk : entry - 1.5 * risk;
    const r2 = long ? entry + 2 * risk : entry - 2 * risk;
    const t2 = long ? Math.min(r2, projection) : Math.max(r2, projection);

    const reasons: string[] = [];
    const confluences: Confluence[] = [];
    const warnings: string[] = [];

    reasons.push(
      `Asian range ${asianLow.toFixed(2)} - ${asianHigh.toFixed(2)} is ${(widthRatio * 100).toFixed(0)}% of the 14-day daily ATR (${dailyAtr.toFixed(2)}), inside the 15-50% band the rules want.`,
    );
    confluences.push({ label: "Asian range width inside the tradable band", weight: 3 });

    if (live) {
      reasons.push(
        `A 15-minute candle has closed ${long ? "above" : "below"} the range with a body ${(100 * (body / range)).toFixed(0)}% of its total size - a real breakout, not a wick.`,
      );
      confluences.push({ label: "Breakout candle closed with a strong body", weight: 4 });
    } else {
      reasons.push(
        `Price is still inside the range; the trade arms when a 15-minute candle closes ${long ? "above " + asianHigh.toFixed(2) : "below " + asianLow.toFixed(2)} with a body at least half the candle.`,
      );
    }

    if (dailyBiasUp === long) {
      reasons.push(
        `Daily bias agrees: price is ${long ? "above" : "below"} the ${dailyRefName} (${dailyRef.toFixed(2)}), so this gets full size.`,
      );
      confluences.push({ label: "Breakout runs with the daily 50 EMA bias", weight: 5 });
    } else {
      warnings.push(`Breakout fights the ${dailyRefName} bias - the rules say half size or skip.`);
      reasons.push("Against the daily bias, so size down.");
    }

    if (m15.bb.widthPct < 0.45) {
      reasons.push("Bollinger bands were squeezed before the open - the classic pre-breakout coil.");
      confluences.push({ label: "Bollinger squeeze before the session open", weight: 3 });
    }
    if (inWindow) {
      reasons.push(
        `Clock is inside the entry window (London ${Math.floor(w.londonOpen / 60)}:${String(w.londonOpen % 60).padStart(2, "0")} + 3h, New York ${Math.floor(w.nyOpen / 60)}:${String(w.nyOpen % 60).padStart(2, "0")} + 2h IST).`,
      );
      confluences.push({ label: "Inside the London/NY breakout window", weight: 4 });
    } else {
      warnings.push("Outside the London/NY breakout window - wait for the open rather than trading a dead-hour break.");
    }
    if (ctx.levels.pivot && ((long && entry > ctx.levels.pivot) || (!long && entry < ctx.levels.pivot))) {
      reasons.push(`Price is ${long ? "above" : "below"} the daily pivot ${ctx.levels.pivot.toFixed(2)}, which favours ${long ? "buyers" : "sellers"} today.`);
      confluences.push({ label: "On the right side of the daily pivot", weight: 2 });
    }
    if (ctx.levels.cprWidthPct < 0.15) {
      reasons.push("Narrow CPR: a trending day is more likely, which is what a breakout needs.");
      confluences.push({ label: "Narrow CPR - trend day expected", weight: 3 });
    }

    warnings.push("Gold fakes out at the London open: if the next one or two 15m candles close back inside the range, the breakout has failed.");
    warnings.push(`Move the stop to breakeven at +1R and close everything by ${Math.floor(w.breakoutCutoff / 60)}:${String(w.breakoutCutoff % 60).padStart(2, "0")} IST - never hold a breakout overnight.`);

    return finalise(ctx, {
      strategy: "session-breakout",
      direction,
      state: live ? "LIVE" : "FORMING",
      entry,
      stop,
      target1: t1,
      target2: t2,
      timeframe: "15m entry / 1h setup / daily bias",
      headline: live
        ? `15m close ${long ? "above" : "below"} the Asian range at ${entry.toFixed(2)}`
        : `Armed: waiting for a 15m close ${long ? "above" : "below"} ${breakLevel.toFixed(2)}`,
      reasons,
      warnings,
      confluences,
      penalties: dailyBiasUp === long ? [] : [{ label: "Against the daily 50 EMA bias", weight: 6 }],
    });
  };

  const brokeUp = lastCandle.close > asianHigh && strongBody;
  const brokeDown = lastCandle.close < asianLow && strongBody;

  if (brokeUp && inWindow) {
    const s = build("BUY", true);
    if (s) out.push(s);
  } else if (brokeDown && inWindow) {
    const s = build("SELL", true);
    if (s) out.push(s);
  } else {
    const s = build(dailyBiasUp ? "BUY" : "SELL", false);
    if (s) out.push(s);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Strategy 2 - Range trading at support / resistance (Varsity, Part 9)
 * ------------------------------------------------------------------ */
function rangeTrade(ctx: StrategyContext): Signal[] {
  const h4 = ctx.analyses["4h"];
  const h1 = ctx.analyses["1h"];
  if (!h4 || !h1) return [];

  // Flat, tangled EMAs and ADX below 20 (or falling from a high reading).
  // Flat and tangled EMAs. The 200 EMA is only included when there is enough history
  // for it, so a short feed does not silently disable the whole strategy.
  const emaLegs = [Math.abs(h4.ema20 - h4.ema50)];
  if (Number.isFinite(h4.ema200)) emaLegs.push(Math.abs(h4.ema50 - h4.ema200));
  const emaSpread = emaLegs.reduce((a, b) => a + b, 0) / emaLegs.length;
  const tangled = emaSpread / h4.close < 0.012;
  if (h4.adx14 >= 22 || !tangled) return [];

  const supportZone = h4.zones.support.find((z) => z.touches >= 2) ?? h4.zones.support[0];
  const resistanceZone = h4.zones.resistance.find((z) => z.touches >= 2) ?? h4.zones.resistance[0];
  if (!supportZone || !resistanceZone) return [];

  const height = resistanceZone.price - supportZone.price;
  // Needs room for a 1.5 : 1 trade inside it: at least 3 x the 1-hour ATR.
  if (height < 3 * h1.atr14) return [];

  const price = h1.close;
  const position = (price - supportZone.price) / height;
  const newsHours = hoursUntil(ctx.nextEvent, ctx.now);
  const out: Signal[] = [];

  const build = (direction: Direction): Signal | null => {
    const long = direction === "BUY";
    const zone = long ? supportZone : resistanceZone;
    const buffer = 0.5 * h1.atr14;
    const triggerLow = last(h1.candles).low;
    const triggerHigh = last(h1.candles).high;
    const entry = price;
    const stop = long ? Math.min(zone.price, triggerLow) - buffer : Math.max(zone.price, triggerHigh) + buffer;
    const mid = supportZone.price + height / 2;
    const t1 = mid;
    // Target 2 sits just inside the far zone, never at the exact edge.
    const t2 = long ? resistanceZone.price - 0.15 * height : supportZone.price + 0.15 * height;

    const triggers = long ? h1.patterns.bullish : h1.patterns.bearish;
    const hasTrigger = triggers.length > 0;
    const rsiOk = long ? h1.rsi14 < 35 : h1.rsi14 > 65;
    const bbTouch = long ? price <= h1.bb.lower * 1.001 : price >= h1.bb.upper * 0.999;
    const divergenceOk = long ? h1.divergence.regularBullish : h1.divergence.regularBearish;

    const reasons: string[] = [];
    const confluences: Confluence[] = [];
    const warnings: string[] = [];

    reasons.push(
      `4-hour EMAs are flat and tangled with ADX ${h4.adx14.toFixed(0)} (below 20), so this is range behaviour, not a trend.`,
    );
    confluences.push({ label: "Range environment confirmed (flat EMAs, ADX < 20)", weight: 4 });
    reasons.push(
      `Range runs ${supportZone.price.toFixed(2)} - ${resistanceZone.price.toFixed(2)} (${supportZone.touches} touches at support, ${resistanceZone.touches} at resistance), ${(height / h1.atr14).toFixed(1)}x the 1-hour ATR tall.`,
    );
    confluences.push({ label: `Range is ${(height / h1.atr14).toFixed(1)}x the 1h ATR - room for 1.5R`, weight: 3 });
    reasons.push(
      `Price is in the ${long ? "bottom" : "top"} ${(100 * (long ? position : 1 - position)).toFixed(0)}% of the range - the only part of a range the rules allow you to trade.`,
    );
    confluences.push({ label: "Entry at the range edge, not the middle", weight: 4 });

    if (hasTrigger) {
      reasons.push(`1-hour trigger candle closed: ${triggers.join(", ")}.`);
      confluences.push({ label: `1h trigger candle (${triggers.join(", ")})`, weight: 5 });
    } else {
      reasons.push(`No 1-hour trigger candle yet - wait for a ${long ? "hammer, bullish engulfing, piercing or morning star" : "shooting star, bearish engulfing, dark cloud or evening star"} to close.`);
    }
    if (rsiOk) {
      reasons.push(`RSI(14) at ${h1.rsi14.toFixed(0)} is ${long ? "oversold / turning up from below 35" : "overbought / turning down from above 65"}.`);
      confluences.push({ label: `RSI confirmation (${h1.rsi14.toFixed(0)})`, weight: 4 });
    }
    if (bbTouch) {
      reasons.push(`Price is tagging the ${long ? "lower" : "upper"} Bollinger band - extra confluence inside a range.`);
      confluences.push({ label: "Bollinger band touch at the zone", weight: 3 });
    }
    if (divergenceOk) {
      reasons.push(`${long ? "Bullish" : "Bearish"} RSI divergence at the zone - the guides call this the highest-quality range confirmation.`);
      confluences.push({ label: "RSI divergence at the range edge", weight: 6 });
    }
    const pivotInZone = [ctx.levels.pivot, ctx.levels.s1, ctx.levels.r1, ctx.levels.cprTop, ctx.levels.cprBottom].some(
      (lvl) => Math.abs(lvl - zone.price) < 0.4 * h1.atr14,
    );
    if (pivotInZone) {
      reasons.push("A daily pivot / CPR level sits inside the zone, which strengthens it.");
      confluences.push({ label: "Pivot or CPR level inside the zone", weight: 3 });
    }

    const penalties: Confluence[] = [];
    if (!hasTrigger) penalties.push({ label: "No 1h trigger candle yet", weight: 8 });
    if (!rsiOk && !divergenceOk && !bbTouch)
      penalties.push({ label: "No momentum confirmation (needs RSI, divergence or a band touch)", weight: 8 });
    if (newsHours != null && newsHours < 2 && newsHours > -0.5)
      penalties.push({ label: `Range rule: nothing due for 2 hours, but ${ctx.nextEvent?.title} is ${newsHours.toFixed(1)}h away`, weight: 10 });
    if (zone.touches >= 4) penalties.push({ label: `Zone already tested ${zone.touches} times - half size, it is closer to breaking`, weight: 5 });

    warnings.push("Exit immediately if a 4-hour candle closes outside the zone: the range has broken and this strategy is off.");
    warnings.push("Close half at the range midpoint and move the stop to breakeven.");
    if (zone.touches >= 4) warnings.push("Fourth or later touch - the guides say consider half size.");

    return finalise(ctx, {
      strategy: "range",
      direction,
      state: hasTrigger && (rsiOk || divergenceOk || bbTouch) ? "LIVE" : "FORMING",
      entry,
      stop,
      target1: t1,
      target2: t2,
      timeframe: "1h entry / 4h setup / daily direction",
      headline: `${long ? "Buy" : "Sell"} the ${long ? "support" : "resistance"} edge at ${zone.price.toFixed(2)} (ADX ${h4.adx14.toFixed(0)} range)`,
      reasons,
      warnings,
      confluences,
      penalties,
    });
  };

  if (position <= 0.25) {
    const s = build("BUY");
    if (s) out.push(s);
  }
  if (position >= 0.75) {
    const s = build("SELL");
    if (s) out.push(s);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Strategy 3 - EMA trend pullback (Varsity, Part 10)
 * ------------------------------------------------------------------ */
function emaPullback(ctx: StrategyContext): Signal[] {
  const h4 = ctx.analyses["4h"];
  const h1 = ctx.analyses["1h"];
  const d1 = ctx.analyses["1d"];
  if (!h4 || !h1 || !d1) return [];

  // Without a 200 EMA there is no long-term filter, and this strategy is built on it.
  if (!Number.isFinite(h4.ema200)) return [];
  const up = h4.ema50 > h4.ema200 && h4.close > h4.ema200 && h4.structure.structure !== "DOWNTREND";
  const down = h4.ema50 < h4.ema200 && h4.close < h4.ema200 && h4.structure.structure !== "UPTREND";
  if (!up && !down) return [];
  if (h4.adx14 < 18) return [];

  const long = up;
  const zoneHigh = Math.max(h4.ema20, h4.ema50);
  const zoneLow = Math.min(h4.ema20, h4.ema50);
  const price = h1.close;
  const atr4 = h4.atr14;
  // Price must be in (or just approaching) the 20-50 EMA band.
  const inZone = price <= zoneHigh + 0.3 * atr4 && price >= zoneLow - 0.3 * atr4;
  const distanceFromZone = long ? (price - zoneHigh) / atr4 : (zoneLow - price) / atr4;
  if (!inZone && distanceFromZone > 1.5) return [];

  const swingLow = h4.structure.lastHigherLow ?? Math.min(...h4.candles.slice(-10).map((c) => c.low));
  const swingHigh = h4.structure.lastLowerHigh ?? Math.max(...h4.candles.slice(-10).map((c) => c.high));
  const pullbackExtreme = long
    ? Math.min(...h1.candles.slice(-12).map((c) => c.low))
    : Math.max(...h1.candles.slice(-12).map((c) => c.high));
  const buffer = 0.3 * atr4;
  const stop = long ? pullbackExtreme - buffer : pullbackExtreme + buffer;
  const entry = price;
  const risk = Math.abs(entry - stop);
  // "If the stop is larger than 2 x ATR, the pullback is too deep for a good trade."
  if (risk > 2 * atr4) return [];
  const prevSwing = long
    ? Math.max(...h4.candles.slice(-20).map((c) => c.high))
    : Math.min(...h4.candles.slice(-20).map((c) => c.low));
  const r2 = long ? entry + 2 * risk : entry - 2 * risk;
  const t1 = long ? Math.min(r2, prevSwing) : Math.max(r2, prevSwing);
  const t2 = long ? entry + 3 * risk : entry - 3 * risk;

  const triggers = long ? h1.patterns.bullish : h1.patterns.bearish;
  const hasTrigger = triggers.length > 0;
  const structureIntact = long
    ? h4.structure.lastHigherLow == null || price > h4.structure.lastHigherLow
    : h4.structure.lastLowerHigh == null || price < h4.structure.lastLowerHigh;
  if (!structureIntact) return [];

  const reasons: string[] = [];
  const confluences: Confluence[] = [];
  const warnings: string[] = [];
  const penalties: Confluence[] = [];

  reasons.push(
    `4-hour trend is ${long ? "up" : "down"}: 50 EMA ${h4.ema50.toFixed(2)} ${long ? "above" : "below"} the 200 EMA ${h4.ema200.toFixed(2)}, price ${long ? "above" : "below"} both, ADX ${h4.adx14.toFixed(0)}.`,
  );
  confluences.push({ label: "4h trend filter passed (EMA stack + ADX)", weight: 5 });
  reasons.push(
    `Price ${inZone ? "has pulled back into" : "is approaching"} the 20-50 EMA band (${zoneLow.toFixed(2)} - ${zoneHigh.toFixed(2)}), which is where buyers who missed the move wait.`,
  );
  if (inZone) confluences.push({ label: "Pullback is inside the 20-50 EMA zone", weight: 5 });
  if (h4.structure.structure === (long ? "UPTREND" : "DOWNTREND")) {
    reasons.push(`Dow Theory structure intact: ${long ? "higher highs and higher lows" : "lower highs and lower lows"} on the 4-hour.`);
    confluences.push({ label: "Swing structure intact", weight: 4 });
  }
  const retr = ctx.retracement;
  if (retr?.inGoldenZone) {
    reasons.push(`Retracement is ${retr.depthPct.toFixed(0)}% of the last impulse - inside the 38.2-61.8% Fibonacci zone.`);
    confluences.push({ label: "Fibonacci 38.2-61.8% confluence", weight: 5 });
  } else if (retr) {
    reasons.push(`Retracement depth ${retr.depthPct.toFixed(0)}%. ${retr.note}`);
    if (retr.depthPct > 78.6) penalties.push({ label: "Retracement deeper than 78.6% - trend in doubt", weight: 10 });
    if (retr.depthPct < 23.6) penalties.push({ label: "Barely any pullback - price is extended from the EMAs", weight: 8 });
  }
  if (hasTrigger) {
    reasons.push(`1-hour trigger candle closed in the zone: ${triggers.join(", ")}.`);
    confluences.push({ label: `1h trigger candle (${triggers.join(", ")})`, weight: 5 });
  } else {
    reasons.push("Still waiting for the 1-hour trigger: a bullish engulfing, hammer or morning star closing in the zone, or a break of the last pullback candle's high.");
    penalties.push({ label: "No 1h trigger candle yet", weight: 8 });
  }
  if ((long && h4.macd.line > 0) || (!long && h4.macd.line < 0)) {
    reasons.push(`4-hour MACD stayed ${long ? "above" : "below"} zero through the pullback - momentum never flipped.`);
    confluences.push({ label: "MACD held its side of zero during the pullback", weight: 4 });
  }
  if ((long && h1.divergence.hiddenBullish) || (!long && h1.divergence.hiddenBearish)) {
    reasons.push(`Hidden ${long ? "bullish" : "bearish"} divergence at the EMA - the guides flag this as added confidence for a pullback entry.`);
    confluences.push({ label: "Hidden divergence at the EMA zone", weight: 5 });
  }
  const dailyRef = Number.isFinite(d1.ema50) ? d1.ema50 : d1.ema20;
  if (Number.isFinite(dailyRef) && ((long && d1.close > dailyRef) || (!long && d1.close < dailyRef))) {
    reasons.push(`Daily chart agrees (price ${long ? "above" : "below"} its daily 50 EMA).`);
    confluences.push({ label: "Daily timeframe agrees", weight: 4 });
  } else if (Number.isFinite(dailyRef)) {
    penalties.push({ label: "Daily timeframe disagrees with the 4h trend", weight: 6 });
  }
  const nextLevel = long ? ctx.levels.resistance[0] : ctx.levels.support[0];
  const nearMajor = Number.isFinite(nextLevel) && Math.abs(nextLevel - price) < 0.6 * atr4;
  if (nearMajor) penalties.push({ label: "Sitting right under / over a major level - little room to run", weight: 6 });

  const newsHours = hoursUntil(ctx.nextEvent, ctx.now);
  if (newsHours != null && newsHours < 2 && newsHours > -0.5)
    penalties.push({ label: `Pullback rule: no entry with news inside 2 hours (${ctx.nextEvent?.title}, ${newsHours.toFixed(1)}h)`, weight: 10 });

  warnings.push(`Trail the runner: exit when a 4-hour candle closes ${long ? "below" : "above"} the 20 EMA, or use Supertrend (10, 3).`);
  warnings.push(`Kill the whole trade if a 4-hour candle closes ${long ? "below" : "above"} the 50 EMA and beyond the last ${long ? "higher low" : "lower high"} (${(long ? swingLow : swingHigh).toFixed(2)}).`);

  const signal = finalise(ctx, {
    strategy: "ema-pullback",
    direction: long ? "BUY" : "SELL",
    state: hasTrigger && inZone ? "LIVE" : "FORMING",
    entry,
    stop,
    target1: t1,
    target2: t2,
    timeframe: "1h entry / 4h setup / daily direction",
    headline: `${long ? "Buy" : "Sell"} the pullback into the 4h 20-50 EMA zone (${zoneLow.toFixed(2)} - ${zoneHigh.toFixed(2)})`,
    reasons,
    warnings,
    confluences,
    penalties,
  });
  return signal ? [signal] : [];
}

/* ------------------------------------------------------------------ *
 * Scalp engine - the guides' building blocks on the 5m / 15m.
 * Not one of the three numbered strategies: it reuses their filters
 * (EMA stack, retracement zone, RSI, ATR stops, session + news rules)
 * on a faster clock, for intraday scalps.
 * ------------------------------------------------------------------ */
function scalps(ctx: StrategyContext): Signal[] {
  const m5 = ctx.analyses["5m"];
  const m15 = ctx.analyses["15m"];
  const h1 = ctx.analyses["1h"];
  if (!m5 || !m15 || !h1) return [];

  const liquidHours = inScalpWindow(ctx.now);
  const session = currentSession(ctx.now);
  if (session.name === "CLOSED") return [];

  const out: Signal[] = [];
  const atr5 = m5.atr14;
  if (!Number.isFinite(atr5) || atr5 <= 0) return [];

  const trendUp = m15.ema20 > m15.ema50 && h1.close > h1.ema50;
  const trendDown = m15.ema20 < m15.ema50 && h1.close < h1.ema50;

  const build = (direction: Direction): Signal | null => {
    const long = direction === "BUY";
    const price = m5.close;
    const anchor = m15.ema20;
    const swing = long
      ? Math.min(...m5.candles.slice(-8).map((c) => c.low))
      : Math.max(...m5.candles.slice(-8).map((c) => c.high));
    const entry = price;
    const stop = long ? swing - 0.5 * atr5 : swing + 0.5 * atr5;
    const risk = Math.abs(entry - stop);
    if (risk <= 0) return null;
    const t1 = long ? entry + 1.2 * risk : entry - 1.2 * risk;
    const t2 = long ? entry + 2 * risk : entry - 2 * risk;

    const triggers = long ? m5.patterns.bullish : m5.patterns.bearish;
    const hasTrigger = triggers.length > 0;
    const pullbackToAnchor = Math.abs(price - anchor) < 0.8 * atr5;
    const rsiReset = long ? m5.rsi14 > 38 && m5.rsi14 < 62 : m5.rsi14 < 62 && m5.rsi14 > 38;
    const microRetr = ctx.analyses["5m"] ? null : null;

    const reasons: string[] = [];
    const confluences: Confluence[] = [];
    const warnings: string[] = [];
    const penalties: Confluence[] = [];

    reasons.push(
      `Micro trend is ${long ? "up" : "down"}: 15m 20 EMA ${long ? "above" : "below"} the 50 EMA and the 1-hour close ${long ? "above" : "below"} its 50 EMA, so the scalp runs with the hour.`,
    );
    confluences.push({ label: "5m scalp aligned with the 15m and 1h trend", weight: 5 });
    if (pullbackToAnchor) {
      reasons.push(`Price has pulled back to the 15m 20 EMA (${anchor.toFixed(2)}) instead of chasing an extended candle.`);
      confluences.push({ label: "Entry at the 15m 20 EMA, not extended", weight: 4 });
    } else {
      penalties.push({ label: "Price is extended from the 15m 20 EMA - wait for the pullback", weight: 7 });
    }
    if (hasTrigger) {
      reasons.push(`5-minute trigger: ${triggers.join(", ")}.`);
      confluences.push({ label: `5m trigger candle (${triggers.join(", ")})`, weight: 4 });
    } else {
      penalties.push({ label: "No 5m trigger candle yet", weight: 6 });
    }
    if (rsiReset) {
      reasons.push(`5-minute RSI ${m5.rsi14.toFixed(0)} has reset into the middle band - momentum cooled without breaking.`);
      confluences.push({ label: "RSI reset into the 40-60 band", weight: 3 });
    }
    if (liquidHours) {
      reasons.push(`${session.label} - liquid hours, which is the only time the rules allow scalping.`);
      confluences.push({ label: "Inside the London / New York liquid window", weight: 4 });
    } else {
      penalties.push({ label: "Outside London/NY hours - spreads eat scalps", weight: 10 });
      warnings.push("Thin session: scalping outside the London and New York hours is how spread costs quietly beat you.");
    }
    const nearPivot = [ctx.levels.pivot, ctx.levels.r1, ctx.levels.s1, ctx.levels.cprTop, ctx.levels.cprBottom].some(
      (lvl) => Math.abs(lvl - entry) < 0.5 * atr5,
    );
    if (nearPivot) {
      reasons.push("Entry sits on a daily pivot / CPR level, where intraday algos react.");
      confluences.push({ label: "Pivot or CPR level at the entry", weight: 3 });
    }
    const retr = ctx.retracement;
    if (retr?.inGoldenZone) {
      reasons.push(`Higher-timeframe retracement is ${retr.depthPct.toFixed(0)}% deep - inside the golden zone, so the scalp is with the bigger pullback, not against it.`);
      confluences.push({ label: "Higher-timeframe retracement in the golden zone", weight: 3 });
    }

    warnings.push(`ATR-sized stop: ${risk.toFixed(2)} per unit (0.5 x the 5m ATR beyond the micro swing). Never widen it.`);
    warnings.push("Scalps are closed, not held: take 50% at target 1, stop to breakeven, out before the next release.");
    if (ctx.nextEvent?.time) {
      const mins = Math.round((ctx.nextEvent.time - ctx.now.getTime()) / 60_000);
      if (mins > 0 && mins < 45)
        warnings.push(`${ctx.nextEvent.title} (${ctx.nextEvent.currency}) is ${mins} minutes away - be flat before it.`);
    }
    void microRetr;

    return finalise(ctx, {
      strategy: "scalp",
      direction,
      state: hasTrigger && pullbackToAnchor && liquidHours ? "LIVE" : "FORMING",
      entry,
      stop,
      target1: t1,
      target2: t2,
      timeframe: "5m entry / 15m setup / 1h direction",
      headline: `${long ? "Long" : "Short"} scalp off the 15m 20 EMA at ${entry.toFixed(2)} (${risk.toFixed(2)} risk)`,
      reasons,
      warnings,
      confluences,
      penalties,
    });
  };

  if (trendUp) {
    const s = build("BUY");
    if (s) out.push(s);
  }
  if (trendDown) {
    const s = build("SELL");
    if (s) out.push(s);
  }
  // In a flat micro market, scalp the 5m range edges off the Bollinger bands instead.
  if (!trendUp && !trendDown && m5.adx14 < 20) {
    const long = m5.close <= m5.bb.lower * 1.0005;
    const short = m5.close >= m5.bb.upper * 0.9995;
    if (long || short) {
      const dir: Direction = long ? "BUY" : "SELL";
      const entry = m5.close;
      const risk = 1.1 * atr5;
      const stop = long ? entry - risk : entry + risk;
      const s = finalise(ctx, {
        strategy: "scalp",
        direction: dir,
        state: liquidHours ? "LIVE" : "FORMING",
        entry,
        stop,
        target1: long ? entry + 1.2 * risk : entry - 1.2 * risk,
        target2: long ? m5.bb.middle + (m5.bb.upper - m5.bb.middle) * 0.6 : m5.bb.middle - (m5.bb.middle - m5.bb.lower) * 0.6,
        timeframe: "5m mean reversion / 15m context",
        headline: `${long ? "Long" : "Short"} the 5m band edge at ${entry.toFixed(2)} (flat micro market)`,
        reasons: [
          `5-minute ADX ${m5.adx14.toFixed(0)} with no EMA trend: this is a chop market, so the edges pay and breakouts do not.`,
          `Price is tagging the ${long ? "lower" : "upper"} Bollinger band with RSI ${m5.rsi14.toFixed(0)}; target is the band middle, where mean reversion ends.`,
        ],
        warnings: [
          "Mean reversion only works while the micro market stays flat: drop it the moment a 5m candle closes hard through the band with a big body.",
          "One attempt per edge. If it fails, the market is trending and you are on the wrong side.",
        ],
        confluences: [
          { label: "Flat micro market (5m ADX < 20)", weight: 3 },
          { label: "Band-edge entry with a measured target", weight: 3 },
          ...(liquidHours ? [{ label: "Liquid session", weight: 3 }] : []),
        ],
        penalties: liquidHours ? [] : [{ label: "Thin session", weight: 10 }],
      });
      if (s) out.push(s);
    }
  }
  return out;
}

export function generateSignals(ctx: StrategyContext): Signal[] {
  const all = [...sessionBreakout(ctx), ...rangeTrade(ctx), ...emaPullback(ctx), ...scalps(ctx)];
  return all.sort((a, b) => {
    if (a.state !== b.state) return a.state === "LIVE" ? -1 : 1;
    return b.winProbability - a.winProbability;
  });
}

/** Position size: amount you are willing to lose / stop distance. */
export function positionSize(accountBalance: number, riskPct: number, stopDistance: number, contractSize: number) {
  const riskAmount = (accountBalance * riskPct) / 100;
  if (stopDistance <= 0) return { riskAmount, units: 0, lots: 0 };
  const units = riskAmount / stopDistance;
  const lots = Math.floor((units / contractSize) * 100) / 100;
  return { riskAmount, units, lots };
}

export { istClock };
export type { Candle };
