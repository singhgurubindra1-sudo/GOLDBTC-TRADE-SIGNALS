"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NewsEvent } from "@/lib/types";

/**
 * ForexFactory news panel and the alert engine.
 *
 * Every event gets a live countdown. At T-20 minutes (configurable) each event fires once:
 * a desktop notification, a beep, and a sticky banner naming every pair it can move.
 * A second, quieter ping fires at T-5 and at the release itself so you know when the
 * blackout starts and ends.
 */

const LEAD_OPTIONS = [20, 15, 30, 60];

type Fired = Record<string, number[]>;

const STORAGE_KEY = "gbts.alerts.v1";

function beep(times = 3, frequency = 880) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + i * 0.45;
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.start(start);
      osc.stop(start + 0.4);
    }
    setTimeout(() => void ctx.close(), times * 500 + 500);
  } catch {
    // Audio is a nicety; never let it break the page.
  }
}

function impactColor(impact: NewsEvent["impact"]) {
  if (impact === "High") return "bg-rose-500/15 text-rose-300 border-rose-500/40";
  if (impact === "Medium") return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  if (impact === "Holiday") return "bg-slate-500/15 text-slate-300 border-slate-500/40";
  return "bg-slate-500/10 text-slate-400 border-slate-600/40";
}

function istTime(ms: number) {
  return new Date(ms).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function countdown(ms: number) {
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const s = Math.floor((abs % 60_000) / 1000);
  const body = h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s).padStart(2, "0")}s`;
  return ms < 0 ? `${body} ago` : `in ${body}`;
}

export type ActiveAlert = {
  id: string;
  event: NewsEvent;
  lead: number;
  firedAt: number;
};

export function NewsAlerts({
  events,
  stale,
  onBlackoutChange,
}: {
  events: NewsEvent[];
  stale: boolean;
  onBlackoutChange?: (blocked: boolean) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [lead, setLead] = useState(20);
  const [soundOn, setSoundOn] = useState(true);
  const [impactFilter, setImpactFilter] = useState<"High" | "High+Medium" | "All">("High+Medium");
  const [currencyFilter, setCurrencyFilter] = useState("ALL");
  const [notifyState, setNotifyState] = useState<NotificationPermission | "unsupported">("default");
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);
  const firedRef = useRef<Fired>({});

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof Notification === "undefined") {
      setNotifyState("unsupported");
      return;
    }
    setNotifyState(Notification.permission);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { lead?: number; sound?: boolean; fired?: Fired };
        if (parsed.lead) setLead(parsed.lead);
        if (typeof parsed.sound === "boolean") setSoundOn(parsed.sound);
        firedRef.current = parsed.fired ?? {};
      }
    } catch {
      // ignore unreadable storage
    }
  }, []);

  const persist = useCallback(
    (next: { lead?: number; sound?: boolean }) => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            lead: next.lead ?? lead,
            sound: next.sound ?? soundOn,
            fired: firedRef.current,
          }),
        );
      } catch {
        // ignore
      }
    },
    [lead, soundOn],
  );

  const askPermission = async () => {
    if (typeof Notification === "undefined") return;
    const res = await Notification.requestPermission();
    setNotifyState(res);
  };

  const currencies = useMemo(
    () => ["ALL", ...Array.from(new Set(events.map((e) => e.currency))).filter(Boolean).sort()],
    [events],
  );

  const watched = useMemo(() => {
    return events.filter((e) => {
      if (!e.time) return false;
      if (impactFilter === "High" && e.impact !== "High") return false;
      if (impactFilter === "High+Medium" && !["High", "Medium"].includes(e.impact)) return false;
      if (currencyFilter !== "ALL" && e.currency !== currencyFilter) return false;
      return true;
    });
  }, [events, impactFilter, currencyFilter]);

  const upcoming = useMemo(
    () => watched.filter((e) => (e.time as number) > now - 45 * 60_000).slice(0, 40),
    [watched, now],
  );

  // The alert engine: fire once per event per threshold.
  useEffect(() => {
    const thresholds = [lead, 5, 0];
    const newAlerts: ActiveAlert[] = [];
    for (const ev of watched) {
      if (!ev.time) continue;
      const minsAway = (ev.time - now) / 60_000;
      for (const t of thresholds) {
        if (minsAway <= t && minsAway > t - 1.05) {
          const already = firedRef.current[ev.id] ?? [];
          if (already.includes(t)) continue;
          firedRef.current[ev.id] = [...already, t];
          const title =
            t === 0
              ? `NOW: ${ev.currency} ${ev.title}`
              : `${t} min to ${ev.currency} ${ev.title}`;
          const body = `${ev.impact} impact - ${istTime(ev.time)} IST. Affects ${ev.affects.join(", ") || "its own pairs"}. ${ev.note}`;
          if (notifyState === "granted") {
            try {
              new Notification(title, { body, tag: `${ev.id}-${t}`, requireInteraction: false });
            } catch {
              // ignore
            }
          }
          if (soundOn) beep(t === 0 ? 4 : t === 5 ? 2 : 3, ev.impact === "High" ? 980 : 760);
          newAlerts.push({ id: `${ev.id}-${t}`, event: ev, lead: t, firedAt: Date.now() });
        }
      }
    }
    if (newAlerts.length) {
      setAlerts((prev) => [...newAlerts, ...prev].slice(0, 6));
      persist({});
    }
  }, [now, watched, lead, soundOn, notifyState, persist]);

  // Blackout state: 30 minutes either side of a high-impact release.
  const blackout = useMemo(() => {
    for (const ev of events) {
      if (!ev.time || ev.impact !== "High") continue;
      const mins = (ev.time - now) / 60_000;
      if (mins <= 30 && mins >= -30) return { ev, mins };
    }
    return null;
  }, [events, now]);

  useEffect(() => {
    onBlackoutChange?.(Boolean(blackout));
  }, [blackout, onBlackoutChange]);

  const nextHigh = useMemo(
    () => events.find((e) => e.time && e.time > now && e.impact === "High") ?? null,
    [events, now],
  );

  return (
    <section className="space-y-3">
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={`panel alert-pulse flex flex-wrap items-center gap-x-3 gap-y-1 border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm ${
                a.lead === 0 ? "font-semibold" : ""
              }`}
            >
              <span className="rounded bg-rose-500 px-2 py-0.5 text-xs font-bold text-white">
                {a.lead === 0 ? "RELEASE NOW" : `T-${a.lead} MIN`}
              </span>
              <span className="font-medium">
                {a.event.currency} {a.event.title}
              </span>
              <span className="text-slate-300">{istTime(a.event.time as number)} IST</span>
              <span className="text-slate-400">
                Affects: {a.event.affects.length ? a.event.affects.join(", ") : a.event.currency}
              </span>
              <button
                className="ml-auto text-xs text-slate-400 underline hover:text-white"
                onClick={() => setAlerts((prev) => prev.filter((x) => x.id !== a.id))}
              >
                dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="panel p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            ForexFactory calendar &amp; alerts
          </h2>
          {stale && (
            <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
              serving cached feed
            </span>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-1 text-slate-400">
              alert lead
              <select
                className="panel-soft px-2 py-1 text-slate-200"
                value={lead}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setLead(v);
                  persist({ lead: v });
                }}
              >
                {LEAD_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o} min
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1 text-slate-400">
              impact
              <select
                className="panel-soft px-2 py-1 text-slate-200"
                value={impactFilter}
                onChange={(e) => setImpactFilter(e.target.value as typeof impactFilter)}
              >
                <option value="High">High only</option>
                <option value="High+Medium">High + Medium</option>
                <option value="All">All</option>
              </select>
            </label>
            <label className="flex items-center gap-1 text-slate-400">
              currency
              <select
                className="panel-soft px-2 py-1 text-slate-200"
                value={currencyFilter}
                onChange={(e) => setCurrencyFilter(e.target.value)}
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="panel-soft px-2 py-1 text-slate-200 hover:text-white"
              onClick={() => {
                setSoundOn((s) => {
                  persist({ sound: !s });
                  return !s;
                });
              }}
            >
              sound {soundOn ? "on" : "off"}
            </button>
            {notifyState !== "granted" && notifyState !== "unsupported" && (
              <button
                className="rounded bg-[#e5b544] px-2 py-1 font-semibold text-black hover:brightness-110"
                onClick={askPermission}
              >
                enable desktop alerts
              </button>
            )}
            {notifyState === "denied" && (
              <span className="text-rose-300">notifications blocked in browser settings</span>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          {blackout ? (
            <span className="rounded border border-rose-500/50 bg-rose-500/15 px-2 py-1 font-semibold text-rose-200">
              NEWS BLACKOUT - {blackout.ev.currency} {blackout.ev.title} {countdown(blackout.ev.time as number - now)}.
              No new entries 30 min either side.
            </span>
          ) : (
            <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-200">
              No high-impact release inside 30 minutes - entries allowed.
            </span>
          )}
          {nextHigh?.time && (
            <span className="text-slate-400">
              Next high impact: <span className="text-slate-200">{nextHigh.currency} {nextHigh.title}</span>{" "}
              {countdown(nextHigh.time - now)} ({istTime(nextHigh.time)} IST)
            </span>
          )}
        </div>

        <div className="mt-3 max-h-[420px] overflow-y-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-[#0d131d] text-slate-400">
              <tr>
                <th className="px-2 py-2 font-medium">Countdown</th>
                <th className="px-2 py-2 font-medium">IST</th>
                <th className="px-2 py-2 font-medium">Cur</th>
                <th className="px-2 py-2 font-medium">Event</th>
                <th className="px-2 py-2 font-medium">Impact</th>
                <th className="px-2 py-2 font-medium">Fcst / Prev</th>
                <th className="px-2 py-2 font-medium">Pairs affected</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((ev) => {
                const diff = (ev.time as number) - now;
                const soon = diff > 0 && diff <= lead * 60_000;
                const live = Math.abs(diff) < 30 * 60_000;
                return (
                  <tr
                    key={ev.id}
                    className={`border-t border-[#1e2a3a] ${soon ? "bg-rose-500/10" : live ? "bg-amber-500/5" : ""}`}
                  >
                    <td className={`mono px-2 py-2 ${soon ? "font-bold text-rose-300" : "text-slate-300"}`}>
                      {countdown(diff)}
                    </td>
                    <td className="mono px-2 py-2 text-slate-400">{istTime(ev.time as number)}</td>
                    <td className="px-2 py-2 font-semibold text-slate-200">{ev.currency}</td>
                    <td className="px-2 py-2 text-slate-200">
                      {ev.title}
                      {ev.goldRelevance === "DIRECT" && (
                        <span className="ml-2 rounded bg-[#e5b544]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#e5b544]">
                          GOLD MOVER
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] ${impactColor(ev.impact)}`}>
                        {ev.impact}
                      </span>
                    </td>
                    <td className="mono px-2 py-2 text-slate-400">
                      {ev.forecast} / {ev.previous}
                    </td>
                    <td className="px-2 py-2 text-slate-400">{ev.affects.join(", ") || ev.currency}</td>
                  </tr>
                );
              })}
              {!upcoming.length && (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-slate-500">
                    No events match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          Alerts fire at T-{lead}, T-5 and at the release, once each, per browser. Keep this tab open (it can
          be in the background) for desktop notifications. The guides&apos; rule: flat from 30 minutes before to
          15-30 minutes after high-impact USD data, then trade the reaction using the news high and low as a
          fresh range.
        </p>
      </div>
    </section>
  );
}
