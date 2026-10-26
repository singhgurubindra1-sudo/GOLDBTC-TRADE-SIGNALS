import { analyse, buildBiasReport, keyLevels, retracement, type Analysis } from "./analysis";
import { fetchCalendar, newsBlackout, nextEventFor } from "./providers/calendar";
import { fetchCandles } from "./providers/marketData";
import { generateSignals } from "./strategies";
import { currentSession, istClock, sessionWindows } from "./sessions";
import { PRIMARY_SYMBOL, SYMBOLS } from "./symbols";
import type { BiasReport, Interval, NewsEvent, Signal } from "./types";

const TIMEFRAMES: Interval[] = ["5m", "15m", "1h", "4h", "1d"];

export type SymbolReport = {
  symbol: string;
  bias: BiasReport;
  signals: Signal[];
  providers: Record<string, string>;
  dataWarnings: string[];
  nextEvent: NewsEvent | null;
  blackout: { blocked: boolean; title: string | null; minutesAway: number | null };
};

export type DashboardPayload = {
  generatedAt: number;
  istClock: string;
  session: { name: string; label: string; summerTime: boolean; windows: ReturnType<typeof sessionWindows> };
  reports: SymbolReport[];
  events: NewsEvent[];
  calendarWarnings: string[];
  calendarStale: boolean;
  errors: string[];
};

async function loadSymbol(symbol: string, events: NewsEvent[], now: Date): Promise<SymbolReport> {
  const providers: Record<string, string> = {};
  const dataWarnings: string[] = [];
  const analyses: Record<string, Analysis> = {};

  const results = await Promise.all(
    TIMEFRAMES.map(async (tf) => {
      try {
        const res = await fetchCandles(symbol, tf);
        return { tf, res };
      } catch (err) {
        dataWarnings.push(`${tf}: ${(err as Error).message}`);
        return { tf, res: null };
      }
    }),
  );

  for (const { tf, res } of results) {
    if (!res) continue;
    providers[tf] = res.stale ? `${res.provider} (stale)` : res.provider;
    if (res.warnings.length) dataWarnings.push(...res.warnings.map((w) => `${tf} ${w}`));
    analyses[tf] = analyse(res.candles, tf);
  }

  const h1 = analyses["1h"];
  const d1 = analyses["1d"];
  if (!h1 || !d1) throw new Error(`Not enough data for ${symbol}: ${dataWarnings.join(" | ")}`);

  const levels = keyLevels(h1.candles, d1.candles, now);
  const retr = retracement((analyses["4h"] ?? h1).candles);
  const bias = buildBiasReport(
    symbol,
    TIMEFRAMES.map((tf) => analyses[tf]).filter(Boolean),
    levels,
    retr,
  );

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

  return {
    symbol,
    bias,
    signals,
    providers,
    dataWarnings,
    nextEvent,
    blackout: {
      blocked: blackout.blocked,
      title: blackout.event?.title ?? null,
      minutesAway: blackout.minutesAway,
    },
  };
}

export async function buildDashboard(symbolKeys?: string[]): Promise<DashboardPayload> {
  const now = new Date();
  const wanted = symbolKeys?.length
    ? SYMBOLS.filter((s) => symbolKeys.map((k) => k.toUpperCase()).includes(s.key))
    : SYMBOLS;
  const ordered = [
    ...wanted.filter((s) => s.key === PRIMARY_SYMBOL),
    ...wanted.filter((s) => s.key !== PRIMARY_SYMBOL),
  ];

  const errors: string[] = [];
  let events: NewsEvent[] = [];
  let calendarWarnings: string[] = [];
  let calendarStale = false;
  try {
    const cal = await fetchCalendar();
    events = cal.events;
    calendarWarnings = cal.warnings;
    calendarStale = cal.stale;
  } catch (err) {
    errors.push(`Calendar: ${(err as Error).message}`);
  }

  const reports: SymbolReport[] = [];
  const settled = await Promise.allSettled(ordered.map((s) => loadSymbol(s.key, events, now)));
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") reports.push(r.value);
    else errors.push(`${ordered[i].key}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
  });

  const session = currentSession(now);
  const windows = sessionWindows(now);
  return {
    generatedAt: now.getTime(),
    istClock: istClock(now),
    session: { name: session.name, label: session.label, summerTime: windows.summer, windows },
    reports,
    events,
    calendarWarnings,
    calendarStale,
    errors,
  };
}
