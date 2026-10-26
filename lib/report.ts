import { analyse, buildBiasReport, keyLevels, retracement, type Analysis } from "./analysis";
import { newsBlackout, nextEventFor } from "./providers/calendar";
import { generateSignals } from "./strategies";
import type { BiasReport, Candle, Interval, NewsEvent, Signal } from "./types";

export const TIMEFRAMES: Interval[] = ["5m", "15m", "1h", "4h", "1d"];

export type SymbolReport = {
  symbol: string;
  bias: BiasReport;
  signals: Signal[];
  providers: Record<string, string>;
  dataWarnings: string[];
  nextEvent: NewsEvent | null;
  blackout: { blocked: boolean; title: string | null; minutesAway: number | null };
  /** Open time of the newest candle used, and how old it is in seconds. */
  lastCandleTime: number;
  feedAgeSec: number;
  /** True when the report was built in the browser from a fallback feed. */
  clientSide?: boolean;
  /** Set when the instrument is a proxy for the one asked for (e.g. a gold token). */
  proxyNote?: string;
};

/**
 * Turns candles into a finished report. Pure: no fetching, no server-only imports, so the
 * same code runs on the server and, when the server has no egress, in the browser.
 */
export function assembleReport(args: {
  symbol: string;
  candles: Partial<Record<Interval, Candle[]>>;
  events: NewsEvent[];
  now: Date;
  providers?: Record<string, string>;
  dataWarnings?: string[];
  clientSide?: boolean;
  proxyNote?: string;
}): SymbolReport {
  const { symbol, candles, events, now } = args;
  const analyses: Record<string, Analysis> = {};
  for (const tf of TIMEFRAMES) {
    const c = candles[tf];
    if (c && c.length >= 30) analyses[tf] = analyse(c, tf);
  }

  const h1 = analyses["1h"];
  const d1 = analyses["1d"];
  if (!h1 || !d1) {
    throw new Error(
      `Not enough data for ${symbol}: need 1h and 1d candles, got [${Object.keys(analyses).join(", ") || "none"}]. ${(args.dataWarnings ?? []).join(" | ")}`,
    );
  }

  const levels = keyLevels(h1.candles, d1.candles, now);
  const retr = retracement((analyses["4h"] ?? h1).candles);
  const ordered = TIMEFRAMES.map((tf) => analyses[tf]).filter(Boolean);
  const bias = buildBiasReport(symbol, ordered, levels, retr);

  const blackout = newsBlackout(events, now.getTime(), { beforeMin: 30, afterMin: 30 });
  const nextEvent = nextEventFor(events, symbol, now.getTime());

  const signals = generateSignals({
    symbol,
    analyses,
    levels,
    retracement: retr,
    now,
    blackout,
    nextEvent,
  });

  // Freshness is judged on the fastest timeframe that actually loaded.
  const fastest = ordered[0];
  const lastCandle = fastest.candles[fastest.candles.length - 1];

  return {
    symbol,
    bias,
    signals,
    providers: args.providers ?? {},
    dataWarnings: args.dataWarnings ?? [],
    nextEvent,
    blackout: {
      blocked: blackout.blocked,
      title: blackout.event?.title ?? null,
      minutesAway: blackout.minutesAway,
    },
    lastCandleTime: lastCandle.time,
    feedAgeSec: Math.max(0, Math.round((now.getTime() - lastCandle.time) / 1000)),
    clientSide: args.clientSide,
    proxyNote: args.proxyNote,
  };
}
