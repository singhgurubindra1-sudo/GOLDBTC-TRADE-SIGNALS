"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BiasPanel } from "./BiasPanel";
import { NewsAlerts } from "./NewsAlerts";
import { SignalCard } from "./SignalCard";
import { TradingViewChart, TradingViewGauge } from "./TradingViewChart";
import { SYMBOLS, getSymbol } from "@/lib/symbols";
import { buildClientReport, clientCalendar, clientSpot, CLIENT_FEEDS } from "@/lib/clientFeeds";
import type { DashboardPayload, SymbolReport } from "@/lib/engine";
import type { NewsEvent } from "@/lib/types";

const ENGINE_REFRESH_MS = 45_000;
const TICK_MS = 8_000;
const SETTINGS_KEY = "gbts.settings.v1";

type Quote = { price: number; at: number; provider: string };

function ageLabel(sec: number) {
  if (sec < 90) return `${sec}s ago`;
  if (sec < 5400) return `${Math.round(sec / 60)}m ago`;
  return `${(sec / 3600).toFixed(1)}h ago`;
}

export function Dashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [clientReports, setClientReports] = useState<Record<string, SymbolReport>>({});
  const [clientEvents, setClientEvents] = useState<NewsEvent[] | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [symbol, setSymbol] = useState("XAUUSD");
  const [chartInterval, setChartInterval] = useState("15");
  const [balance, setBalance] = useState(10_000);
  const [riskPct, setRiskPct] = useState(1);
  const [onlyLive, setOnlyLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const eventsRef = useRef<NewsEvent[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as { balance?: number; riskPct?: number; symbol?: string };
        if (s.balance) setBalance(s.balance);
        if (s.riskPct) setRiskPct(s.riskPct);
        if (s.symbol) setSymbol(s.symbol);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ balance, riskPct, symbol }));
    } catch {
      // ignore
    }
  }, [balance, riskPct, symbol]);

  /* ---------- server engine ---------- */
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/signals", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail ? `${json.error}: ${json.detail}` : (json.error ?? "Request failed"));
      } else {
        const payload = json as DashboardPayload;
        setData(payload);
        if (payload.events.length) eventsRef.current = payload.events;
        setError(null);
        setLastUpdated(Date.now());
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), ENGINE_REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  /* ---------- browser fallback: build the report here when the server feed failed ---------- */
  const serverSymbols = useMemo(() => new Set((data?.reports ?? []).map((r) => r.symbol)), [data]);
  const needFallback = useMemo(
    () => CLIENT_FEEDS.map((f) => f.symbol).filter((s) => !serverSymbols.has(s)),
    [serverSymbols],
  );

  useEffect(() => {
    if (!data || !needFallback.length) return;
    let cancelled = false;
    const run = async () => {
      let events = eventsRef.current;
      if (!events.length) {
        const fetched = await clientCalendar();
        if (fetched && !cancelled) {
          events = fetched;
          eventsRef.current = fetched;
          setClientEvents(fetched);
        }
      }
      for (const sym of needFallback) {
        try {
          const rep = await buildClientReport(sym, events, new Date());
          if (rep && !cancelled) setClientReports((prev) => ({ ...prev, [sym]: rep }));
        } catch {
          // leave it missing; the banner explains why
        }
      }
    };
    void run();
    const id = setInterval(() => void run(), ENGINE_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [data, needFallback]);

  /* ---------- fast price tick ---------- */
  const tick = useCallback(async () => {
    const symbols = SYMBOLS.map((s) => s.key).join(",");
    try {
      const res = await fetch(`/api/quote?symbols=${symbols}`, { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as { quotes: Record<string, Quote> };
        if (Object.keys(json.quotes).length) {
          setQuotes((prev) => ({ ...prev, ...json.quotes }));
          return;
        }
      }
    } catch {
      // fall through to the browser feed
    }
    // Server could not quote: ask the browser-reachable feeds directly.
    for (const feed of CLIENT_FEEDS) {
      const q = await clientSpot(feed.symbol);
      if (q) setQuotes((prev) => ({ ...prev, [feed.symbol]: { price: q.price, at: q.at, provider: q.source } }));
    }
  }, []);

  useEffect(() => {
    void tick();
    const id = setInterval(() => void tick(), TICK_MS);
    return () => clearInterval(id);
  }, [tick]);

  /* ---------- merged view ---------- */
  const reports = useMemo<SymbolReport[]>(() => {
    const server = data?.reports ?? [];
    const extra = Object.values(clientReports).filter((r) => !serverSymbols.has(r.symbol));
    const merged = [...server, ...extra];
    return merged.sort((a, b) => {
      const order = SYMBOLS.map((s) => s.key);
      return order.indexOf(a.symbol) - order.indexOf(b.symbol);
    });
  }, [data, clientReports, serverSymbols]);

  const events = useMemo(() => (data?.events.length ? data.events : (clientEvents ?? [])), [data, clientEvents]);

  const report = useMemo(
    () => reports.find((r) => r.symbol === symbol) ?? reports[0] ?? null,
    [reports, symbol],
  );
  const spec = getSymbol(symbol);
  const quote = quotes[symbol];

  const allSignals = useMemo(() => {
    const list = reports.flatMap((r) => r.signals);
    return onlyLive ? list.filter((s) => s.state === "LIVE") : list;
  }, [reports, onlyLive]);

  const symbolSignals = useMemo(
    () => (report ? (onlyLive ? report.signals.filter((s) => s.state === "LIVE") : report.signals) : []),
    [report, onlyLive],
  );
  const scalps = useMemo(() => allSignals.filter((s) => s.strategy === "scalp"), [allSignals]);

  const feedProblem = Boolean(data && data.reports.length < SYMBOLS.length);

  return (
    <main className="mx-auto max-w-[1700px] space-y-5 px-4 py-5">
      {/* Status strip */}
      <div className="panel flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-xs">
        <span className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${loading ? "bg-amber-400" : error ? "bg-rose-500" : "bg-emerald-400"}`} />
          {loading ? "loading feeds" : error ? "feed problem" : "live"}
        </span>
        {data && (
          <>
            <span className="text-slate-400">
              clock <span className="mono text-slate-200">{data.istClock}</span>
            </span>
            <span className="text-slate-400">
              session <span className="text-slate-200">{data.session.label}</span>
            </span>
          </>
        )}
        {lastUpdated && (
          <span className="text-slate-500">
            engine {new Date(lastUpdated).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false })} IST ·
            every {ENGINE_REFRESH_MS / 1000}s · price every {TICK_MS / 1000}s
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1 text-slate-400">
            account $
            <input
              type="number"
              className="panel-soft mono w-24 px-2 py-1 text-slate-200"
              value={balance}
              min={100}
              step={100}
              onChange={(e) => setBalance(Math.max(100, Number(e.target.value) || 0))}
            />
          </label>
          <label className="flex items-center gap-1 text-slate-400">
            risk %
            <input
              type="number"
              className="panel-soft mono w-16 px-2 py-1 text-slate-200"
              value={riskPct}
              min={0.1}
              max={2}
              step={0.1}
              onChange={(e) => setRiskPct(Math.min(2, Math.max(0.1, Number(e.target.value) || 0.5)))}
            />
          </label>
          <button
            className="panel-soft px-2 py-1 text-slate-200 hover:text-white"
            onClick={() => {
              void load();
              void tick();
            }}
          >
            refresh now
          </button>
        </div>
      </div>

      {error && (
        <div className="panel border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <p className="font-semibold">The signal engine could not be reached.</p>
          <p className="mono mt-1 text-xs">{error}</p>
        </div>
      )}

      {/* Headline quote */}
      <div className="panel flex flex-wrap items-end gap-x-8 gap-y-3 px-4 py-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">{spec?.label ?? symbol}</div>
          <div className="mono text-4xl font-bold text-white">
            {quote ? quote.price.toFixed(spec?.digits ?? 2) : report ? report.bias.price.toFixed(spec?.digits ?? 2) : "—"}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {quote ? (
              <>
                tick feed: <span className="text-slate-300">{quote.provider}</span> ·{" "}
                {ageLabel(Math.max(0, Math.round((Date.now() - quote.at) / 1000)))}
              </>
            ) : (
              "no tick feed - showing the last candle close"
            )}
          </div>
        </div>
        {report && (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">engine candles</div>
            <div className="mono text-lg text-slate-200">{report.bias.price.toFixed(spec?.digits ?? 2)}</div>
            <div className={`text-[11px] ${report.feedAgeSec > 900 ? "text-amber-300" : "text-slate-500"}`}>
              last {report.providers["5m"] ?? "candle"} · {ageLabel(report.feedAgeSec)}
              {report.clientSide && " · built in your browser"}
            </div>
          </div>
        )}
        {report && (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">daily change</div>
            <div className={`mono text-lg ${report.bias.changePct >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
              {report.bias.changePct >= 0 ? "+" : ""}
              {report.bias.changePct.toFixed(2)}%
            </div>
          </div>
        )}
        {report && (
          <div className="ml-auto text-right">
            <div className="text-xs uppercase tracking-wide text-slate-500">verdict</div>
            <div
              className={`text-2xl font-bold ${
                report.bias.verdict.includes("BUY")
                  ? "text-emerald-300"
                  : report.bias.verdict.includes("SELL")
                    ? "text-rose-300"
                    : "text-slate-300"
              }`}
            >
              {report.bias.verdict}
            </div>
          </div>
        )}
      </div>

      {report?.proxyNote && (
        <div className="panel border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
          {report.proxyNote}
        </div>
      )}

      {feedProblem && (
        <div className="panel border-amber-500/50 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
          <p className="text-sm font-semibold">
            {reports.length
              ? `${SYMBOLS.length - (data?.reports.length ?? 0)} instrument(s) have no server feed.`
              : "No server price feed answered."}
          </p>
          {data?.errors.length ? (
            <ul className="mono mt-2 space-y-1">
              {data.errors.slice(0, 4).map((e) => (
                <li key={e}>· {e}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-2 text-amber-100/80">
            The machine serving this app must reach <span className="mono">query1.finance.yahoo.com</span> (candles) and{" "}
            <span className="mono">nfs.faireconomy.media</span> (ForexFactory). Running{" "}
            <span className="mono">npm run dev</span> on your own computer fixes it; in a filtered environment, allow
            those two hosts. Meanwhile gold and BTC fall back to a browser feed, and the TradingView chart below
            always works because your browser loads it directly.
          </p>
        </div>
      )}

      {/* News alerts */}
      <NewsAlerts events={events} stale={data?.calendarStale ?? false} />

      {/* Instrument tabs */}
      <div className="flex flex-wrap gap-2">
        {SYMBOLS.map((s) => {
          const r = reports.find((x) => x.symbol === s.key);
          const q = quotes[s.key];
          const active = symbol === s.key;
          const v = r?.bias.verdict;
          const tone = v?.includes("BUY") ? "text-emerald-300" : v?.includes("SELL") ? "text-rose-300" : "text-slate-300";
          const live = r?.signals.filter((x) => x.state === "LIVE").length ?? 0;
          return (
            <button
              key={s.key}
              onClick={() => setSymbol(s.key)}
              className={`panel-soft px-3 py-2 text-left text-xs transition ${
                active ? "border-[#e5b544]/70 bg-[#e5b544]/10" : "hover:border-slate-500"
              }`}
            >
              <div className="font-semibold text-slate-100">{s.key}</div>
              <div className={`mono ${tone}`}>
                {q ? q.price.toFixed(s.digits) : r ? r.bias.price.toFixed(s.digits) : "no feed"}
                {v ? ` · ${v}` : ""}
              </div>
              {live > 0 && (
                <div className="mt-0.5 text-[10px] text-[#e5b544]">
                  {live} live setup{live > 1 ? "s" : ""}
                </div>
              )}
              {r?.clientSide && <div className="mt-0.5 text-[10px] text-amber-300/80">browser feed</div>}
            </button>
          );
        })}
      </div>

      {/* Chart: full width, large */}
      <TradingViewChart
        symbol={spec?.tv ?? "OANDA:XAUUSD"}
        alternatives={spec?.tvAlternatives}
        interval={chartInterval}
        onIntervalChange={setChartInterval}
      />

      {/* Bias + TradingView rating */}
      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        {report ? (
          <BiasPanel bias={report.bias} digits={spec?.digits ?? 2} />
        ) : (
          <div className="panel px-4 py-6 text-sm text-slate-400">
            No candle data for {symbol}, so there is no computed bias. The chart above still works.
          </div>
        )}
        <TradingViewGauge symbol={spec?.tv ?? "OANDA:XAUUSD"} interval={chartInterval} />
      </div>

      {/* Signals */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Signals for {symbol}</h2>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={onlyLive} onChange={(e) => setOnlyLive(e.target.checked)} />
            only setups whose trigger has already fired
          </label>
          {report?.blackout.blocked && (
            <span className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
              news blackout active ({report.blackout.title}, {report.blackout.minutesAway}m) - win rates marked down
            </span>
          )}
        </div>

        {symbolSignals.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {symbolSignals.map((s) => (
              <SignalCard
                key={s.id}
                signal={s}
                accountBalance={balance}
                riskPct={riskPct}
                contractSize={spec?.contractSize ?? 100}
                unit={spec?.unit ?? "oz"}
              />
            ))}
          </div>
        ) : (
          <div className="panel px-4 py-6 text-sm text-slate-400">
            {report
              ? `No setup on ${symbol} passes the rules right now. That is a result, not a bug - both guides spend more pages on when not to trade than on entries. The bias table above still tells you which way it is leaning.`
              : `No data for ${symbol}, so no signals can be computed.`}
          </div>
        )}
      </section>

      {/* Scalp feed */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Scalp feed - every instrument ({scalps.length})
        </h2>
        {scalps.length ? (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {scalps.map((s) => (
              <SignalCard
                key={s.id}
                signal={s}
                accountBalance={balance}
                riskPct={riskPct}
                contractSize={getSymbol(s.symbol)?.contractSize ?? 100}
                unit={getSymbol(s.symbol)?.unit ?? "oz"}
              />
            ))}
          </div>
        ) : (
          <div className="panel px-4 py-6 text-sm text-slate-400">
            No scalp qualifies at this minute. The scalp engine only fires in the London and New York hours, with the
            15m and 1h trend, at a pullback - never on an extended candle.
          </div>
        )}
      </section>

      {/* Data health */}
      {reports.length > 0 && (
        <section className="panel p-4 text-xs">
          <h2 className="font-semibold uppercase tracking-wide text-slate-400">Data health</h2>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {reports.map((r) => (
              <div key={r.symbol} className="panel-soft px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200">{r.symbol}</span>
                  <span className={r.feedAgeSec > 900 ? "text-amber-300" : "text-slate-500"}>
                    newest candle {ageLabel(r.feedAgeSec)}
                  </span>
                  {r.clientSide && <span className="text-amber-300/80">browser feed</span>}
                </div>
                <div className="mono text-slate-400">
                  {Object.entries(r.providers)
                    .map(([tf, p]) => `${tf}:${p}`)
                    .join("  ")}
                </div>
                {r.dataWarnings.length > 0 && (
                  <div className="mt-1 text-[11px] text-amber-300/80">{r.dataWarnings.slice(0, 2).join(" · ")}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
