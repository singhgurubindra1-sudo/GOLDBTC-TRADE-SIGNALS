import type { NewsEvent } from "../types";
import { pairsForCurrency } from "../symbols";

/**
 * ForexFactory calendar, taken from the weekly JSON feeds Faireconomy publishes for it
 * (the same data the ForexFactory calendar page renders). This week and next week are
 * merged so a Friday evening still shows Monday's releases.
 */

const FEEDS = [
  "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
  "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
];

type RawEvent = {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
};

export type CalendarResult = {
  events: NewsEvent[];
  fetchedAt: number;
  stale: boolean;
  warnings: string[];
};

let cache: { data: CalendarResult; expires: number } | null = null;
const TTL_MS = 10 * 60_000;

/** Releases the guides single out as gold movers. */
const DIRECT_GOLD = [
  "non-farm",
  "nonfarm",
  "cpi",
  "core cpi",
  "fomc",
  "federal funds",
  "fed chair",
  "fed interest rate",
  "pce",
  "retail sales",
  "gdp",
  "unemployment claims",
  "jobless",
  "ism",
  "ppi",
  "unemployment rate",
  "powell",
  "warsh",
  "treasury yield",
  "consumer confidence",
];

function goldRelevance(ev: RawEvent): { level: NewsEvent["goldRelevance"]; note: string } {
  const title = ev.title.toLowerCase();
  const isUsd = ev.country.toUpperCase() === "USD";
  const direct = DIRECT_GOLD.some((k) => title.includes(k));
  if (isUsd && direct && ev.impact === "High")
    return {
      level: "DIRECT",
      note: "Top-tier USD release: $20-60 swings in minutes are normal on gold. Flat before it, trade the reaction after.",
    };
  if (isUsd && ev.impact === "High")
    return { level: "DIRECT", note: "High-impact USD news: spreads widen and stops slip. No new entries 30 min either side." };
  if (isUsd) return { level: "INDIRECT", note: "USD data: can nudge the dollar, so it can nudge gold." };
  if (ev.impact === "High")
    return { level: "INDIRECT", note: "High-impact non-USD release: moves its own pairs, gold only through risk sentiment." };
  return { level: "LOW", note: "Low-impact release. Usually noise." };
}

function normalise(raw: RawEvent): NewsEvent {
  const parsed = raw.date ? new Date(raw.date) : null;
  const time = parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : null;
  const impact = (["High", "Medium", "Low", "Holiday"].includes(raw.impact) ? raw.impact : "Low") as NewsEvent["impact"];
  const rel = goldRelevance(raw);
  const currency = (raw.country || "").toUpperCase();
  return {
    id: `${currency}-${raw.title}-${raw.date}`.replace(/\s+/g, "-").toLowerCase(),
    title: raw.title,
    country: currency,
    currency,
    impact,
    time,
    forecast: raw.forecast || "-",
    previous: raw.previous || "-",
    affects: pairsForCurrency(currency),
    goldRelevance: rel.level,
    note: rel.note,
  };
}

export async function fetchCalendar(opts: { force?: boolean } = {}): Promise<CalendarResult> {
  const now = Date.now();
  if (!opts.force && cache && cache.expires > now) return cache.data;

  const warnings: string[] = [];
  const collected: RawEvent[] = [];
  for (const url of FEEDS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "goldbtc-trade-signals/1.0", Accept: "application/json" },
        cache: "no-store",
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as RawEvent[];
      if (Array.isArray(json)) collected.push(...json);
    } catch (err) {
      warnings.push(`${url.split("/").pop()}: ${(err as Error).message}`);
    }
  }

  if (!collected.length) {
    if (cache) return { ...cache.data, stale: true, warnings };
    throw new Error(`ForexFactory calendar feed unreachable. ${warnings.join(" | ")}`);
  }

  const events = collected
    .map(normalise)
    .filter((e) => e.impact !== "Holiday" || e.goldRelevance === "DIRECT")
    .sort((a, b) => (a.time ?? 0) - (b.time ?? 0));

  const data: CalendarResult = { events, fetchedAt: now, stale: false, warnings };
  cache = { data, expires: now + TTL_MS };
  return data;
}

/**
 * News blackout per the guides:
 *   - breakout and scalp trades: no entry 30 min before or after a high-impact USD release
 *   - range and pullback trades: nothing due in the next 2 hours
 */
export function newsBlackout(
  events: NewsEvent[],
  at: number = Date.now(),
  opts: { beforeMin?: number; afterMin?: number; impacts?: NewsEvent["impact"][]; currency?: string } = {},
): { blocked: boolean; event: NewsEvent | null; minutesAway: number | null } {
  const beforeMin = opts.beforeMin ?? 30;
  const afterMin = opts.afterMin ?? 30;
  const impacts = opts.impacts ?? ["High"];
  for (const ev of events) {
    if (!ev.time || !impacts.includes(ev.impact)) continue;
    if (opts.currency && ev.currency !== opts.currency && ev.currency !== "USD") continue;
    const diffMin = (ev.time - at) / 60_000;
    if (diffMin <= beforeMin && diffMin >= -afterMin) {
      return { blocked: true, event: ev, minutesAway: Math.round(diffMin) };
    }
  }
  return { blocked: false, event: null, minutesAway: null };
}

export function nextEventFor(events: NewsEvent[], symbolKey: string, at: number = Date.now()): NewsEvent | null {
  return (
    events.find((e) => e.time && e.time > at && e.impact !== "Low" && e.affects.includes(symbolKey)) ?? null
  );
}
