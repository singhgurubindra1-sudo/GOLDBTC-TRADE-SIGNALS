import { fetchCalendar } from "./providers/calendar";
import { fetchCandles } from "./providers/marketData";
import { assembleReport, TIMEFRAMES, type SymbolReport } from "./report";
import { currentSession, istClock, sessionWindows } from "./sessions";
import { PRIMARY_SYMBOL, SYMBOLS } from "./symbols";
import type { Candle, Interval, NewsEvent } from "./types";

export type { SymbolReport };

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
  const candles: Partial<Record<Interval, Candle[]>> = {};

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
    candles[tf] = res.candles;
  }

  return assembleReport({ symbol, candles, events, now, providers, dataWarnings });
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
