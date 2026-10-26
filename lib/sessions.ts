/**
 * Session handling in IST (UTC+5:30), the timezone both study guides use.
 * Summer: Asia 05:30-12:30, London open 12:30, NY open 17:30, overlap 17:30-21:00.
 * Winter: everything US/UK shifts one hour later (London 13:30, NY 18:30).
 */

export const IST_OFFSET_MIN = 330;

export type SessionName = "ASIA" | "LONDON" | "NEWYORK" | "OVERLAP" | "LATE-US" | "CLOSED";

export function toIst(date: Date | number): Date {
  const d = typeof date === "number" ? new Date(date) : date;
  return new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
}

/** Minutes past IST midnight. */
export function istMinutes(date: Date | number): number {
  const ist = toIst(date);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

export function istClock(date: Date | number): string {
  const ist = toIst(date);
  return `${String(ist.getUTCHours()).padStart(2, "0")}:${String(ist.getUTCMinutes()).padStart(2, "0")} IST`;
}

export function istDateKey(date: Date | number): string {
  const ist = toIst(date);
  return ist.toISOString().slice(0, 10);
}

/**
 * US daylight saving: second Sunday of March to first Sunday of November.
 * The guides warn about the week when the UK and US clocks disagree; we follow the US
 * change because the releases that matter for gold are US releases.
 */
export function isSummerTime(date: Date = new Date()): boolean {
  const year = date.getUTCFullYear();
  const marchFirst = new Date(Date.UTC(year, 2, 1));
  const secondSundayMarch = new Date(
    Date.UTC(year, 2, 1 + ((7 - marchFirst.getUTCDay()) % 7) + 7, 7),
  );
  const novFirst = new Date(Date.UTC(year, 10, 1));
  const firstSundayNov = new Date(Date.UTC(year, 10, 1 + ((7 - novFirst.getUTCDay()) % 7), 6));
  return date >= secondSundayMarch && date < firstSundayNov;
}

export type SessionWindows = {
  summer: boolean;
  asiaStart: number;
  asiaEnd: number;
  londonOpen: number;
  nyOpen: number;
  overlapEnd: number;
  usDataTime: number;
  fomcTime: number;
  /** Close breakout trades by this IST minute (22:30 summer / 23:30 winter). */
  breakoutCutoff: number;
};

export function sessionWindows(date: Date = new Date()): SessionWindows {
  const summer = isSummerTime(date);
  const shift = summer ? 0 : 60;
  return {
    summer,
    asiaStart: 5 * 60 + 30,
    asiaEnd: 12 * 60 + 30 + shift,
    londonOpen: 12 * 60 + 30 + shift,
    nyOpen: 17 * 60 + 30 + shift,
    overlapEnd: 21 * 60 + shift,
    usDataTime: 18 * 60 + shift,
    fomcTime: 23 * 60 + 30 + shift,
    breakoutCutoff: 22 * 60 + 30 + shift,
  };
}

export function currentSession(date: Date = new Date()): { name: SessionName; label: string } {
  const w = sessionWindows(date);
  const m = istMinutes(date);
  const ist = toIst(date);
  const day = ist.getUTCDay();
  if (day === 6 && m > 3 * 60) return { name: "CLOSED", label: "Weekend - market closed" };
  if (day === 0 && m < 3 * 60 + 30) return { name: "CLOSED", label: "Weekend - market closed" };
  if (m >= w.asiaStart && m < w.asiaEnd) return { name: "ASIA", label: "Asian session - range building" };
  if (m >= w.londonOpen && m < w.nyOpen) return { name: "LONDON", label: "London session - first real move" };
  if (m >= w.nyOpen && m < w.overlapEnd)
    return { name: "OVERLAP", label: "London / New York overlap - most volatile" };
  if (m >= w.overlapEnd || m < 3 * 60 + 30) return { name: "LATE-US", label: "Late US - fading volume" };
  return { name: "NEWYORK", label: "New York session" };
}

/** Is the clock inside a window where the guides allow breakout entries? */
export function inBreakoutWindow(date: Date = new Date()): boolean {
  const w = sessionWindows(date);
  const m = istMinutes(date);
  const londonWindow = m >= w.londonOpen && m <= w.londonOpen + 180;
  const nyWindow = m >= w.nyOpen && m <= w.nyOpen + 120;
  return londonWindow || nyWindow;
}

/** Scalping is only allowed in liquid hours: London open onward through the overlap. */
export function inScalpWindow(date: Date = new Date()): boolean {
  const w = sessionWindows(date);
  const m = istMinutes(date);
  return m >= w.londonOpen && m <= w.overlapEnd + 60;
}

/** Spreads widen at the daily rollover (about 02:30-03:30 IST). */
export function inRolloverWindow(date: Date = new Date()): boolean {
  const m = istMinutes(date);
  const w = sessionWindows(date);
  const start = 2 * 60 + 30 + (w.summer ? 0 : 60);
  return m >= start && m <= start + 60;
}

export function formatIstRange(startMin: number, endMin: number): string {
  const f = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return `${f(startMin)}-${f(endMin)} IST`;
}
