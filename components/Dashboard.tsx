"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BiasPanel } from "./BiasPanel";
import { NewsAlerts } from "./NewsAlerts";
import { SignalCard } from "./SignalCard";
import { TradingViewChart, TradingViewGauge } from "./TradingViewChart";
import { SYMBOLS, getSymbol } from "@/lib/symbols";
import type { DashboardPayload } from "@/lib/engine";

const REFRESH_MS = 45_000;
const TF_TO_TV: Record<string, string> = { "5m": "5", "15m": "15", "1h": "60", "4h": "240", "1d": "D" };
const SETTINGS_KEY = "gbts.settings.v1";

export function Dashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [symbol, setSymbol] = useState("XAUUSD");
  const [chartTf, setChartTf] = useState("15m");
  const [balance, setBalance] = useState(10_000);
  const [riskPct, setRiskPct] = useState(1);
  const [onlyLive, setOnlyLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

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

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/signals", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail ? `${json.error}: ${json.detail}` : json.error ?? "Request failed");
      } else {
        setData(json as DashboardPayload);
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
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const report = useMemo(
    () => data?.reports.find((r) => r.symbol === symbol) ?? data?.reports[0] ?? null,
    [data, symbol],
  );
  const spec = getSymbol(report?.symbol ?? symbol);

  const allSignals = useMemo(() => {
    if (!data) return [];
    const list = data.reports.flatMap((r) => r.signals);
    return onlyLive ? list.filter((s) => s.state === "LIVE") : list;
  }, [data, onlyLive]);

  const symbolSignals = useMemo(
    () => (report ? (onlyLive ? report.signals.filter((s) => s.state === "LIVE") : report.signals) : []),
    [report, onlyLive],
  );

  const scalps = useMemo(() => allSignals.filter((s) => s.strategy === "scalp"), [allSignals]);

  return (
    <main className="mx-auto max-w-[1500px] space-y-5 px-4 py-5">
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
            <span className="text-slate-400">
              {data.session.summerTime ? "summer time (London 12:30, NY 17:30 IST)" : "winter time (London 13:30, NY 18:30 IST)"}
            </span>
          </>
        )}
        {lastUpdated && (
          <span className="text-slate-500">
            updated {new Date(lastUpdated).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false })} IST ·
            auto every {REFRESH_MS / 1000}s
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
          <button className="panel-soft px-2 py-1 text-slate-200 hover:text-white" onClick={() => void load()}>
            refresh now
          </button>
        </div>
      </div>

      {error && (
        <div className="panel border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <p className="font-semibold">The signal engine could not reach its data feeds.</p>
          <p className="mono mt-1 text-xs">{error}</p>
          <p className="mt-2 text-xs text-rose-100/80">
            The server needs outbound HTTPS to <span className="mono">query1.finance.yahoo.com</span> (candles) and{" "}
            <span className="mono">nfs.faireconomy.media</span> (ForexFactory calendar). Run it on your own machine or
            any host without an egress filter, or set <span className="mono">TWELVE_DATA_API_KEY</span> for the
            fallback feed.
          </p>
        </div>
      )}

      {!error && data && data.reports.length === 0 && (
        <div className="panel border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-semibold">The engine is running, but no price feed answered, so there are no signals.</p>
          <ul className="mono mt-2 space-y-1 text-xs">
            {data.errors.slice(0, 4).map((e) => (
              <li key={e}>· {e}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-100/80">
            Allow outbound HTTPS to <span className="mono">query1.finance.yahoo.com</span> and{" "}
            <span className="mono">nfs.faireconomy.media</span>, or set <span className="mono">TWELVE_DATA_API_KEY</span>.
            The TradingView chart below is loaded by your browser, so it keeps working either way.
          </p>
        </div>
      )}

      {/* News alerts: these drive every pair, so they sit above the instrument tabs. */}
      {data && <NewsAlerts events={data.events} stale={data.calendarStale} />}

      {/* Instrument tabs */}
      <div className="flex flex-wrap gap-2">
        {SYMBOLS.map((s) => {
          const r = data?.reports.find((x) => x.symbol === s.key);
          const active = (report?.symbol ?? symbol) === s.key;
          const v = r?.bias.verdict;
          const tone =
            v?.includes("BUY") ? "text-emerald-300" : v?.includes("SELL") ? "text-rose-300" : "text-slate-300";
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
                {r ? `${r.bias.price.toFixed(s.digits)} · ${v}` : "…"}
              </div>
              {r && r.signals.some((x) => x.state === "LIVE") && (
                <div className="mt-0.5 text-[10px] text-[#e5b544]">
                  {r.signals.filter((x) => x.state === "LIVE").length} live setup
                  {r.signals.filter((x) => x.state === "LIVE").length > 1 ? "s" : ""}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Chart + bias */}
      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400">chart timeframe</span>
            {Object.keys(TF_TO_TV).map((tf) => (
              <button
                key={tf}
                onClick={() => setChartTf(tf)}
                className={`panel-soft px-2 py-1 ${chartTf === tf ? "border-[#e5b544]/70 text-[#e5b544]" : "text-slate-300"}`}
              >
                {tf}
              </button>
            ))}
            <span className="ml-auto text-slate-500">
              indicators on chart: EMA 20/50/200 · RSI(14) · MACD(12,26,9) · ATR(14)
            </span>
          </div>
          <TradingViewChart symbol={spec?.tv ?? "OANDA:XAUUSD"} interval={TF_TO_TV[chartTf]} />
        </div>
        <div className="space-y-5">
          {report && <BiasPanel bias={report.bias} digits={spec?.digits ?? 2} />}
          <TradingViewGauge symbol={spec?.tv ?? "OANDA:XAUUSD"} interval={TF_TO_TV[chartTf]} />
        </div>
      </div>

      {/* Signals */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Signals for {report?.symbol ?? symbol}
          </h2>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={onlyLive} onChange={(e) => setOnlyLive(e.target.checked)} />
            only setups whose trigger has already fired
          </label>
          {report?.blackout.blocked && (
            <span className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-200">
              news blackout active ({report.blackout.title}, {report.blackout.minutesAway}m) - win rates are marked down
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
            No setup on {report?.symbol ?? symbol} passes the rules right now. That is a result, not a bug - both
            guides spend more pages on when not to trade than on entries. Check the bias table above for which way
            the market is leaning while you wait.
          </div>
        )}
      </section>

      {/* Scalp feed across every instrument */}
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
            No scalp qualifies at this minute. The scalp engine only fires in the London and New York hours, with
            the 15m and 1h trend, at a pullback - never on an extended candle.
          </div>
        )}
      </section>

      {/* Data health */}
      {data && (
        <section className="panel p-4 text-xs">
          <h2 className="font-semibold uppercase tracking-wide text-slate-400">Data health</h2>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {data.reports.map((r) => (
              <div key={r.symbol} className="panel-soft px-3 py-2">
                <div className="font-semibold text-slate-200">{r.symbol}</div>
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
          {(data.errors.length > 0 || data.calendarWarnings.length > 0) && (
            <div className="mt-2 text-[11px] text-amber-300/80">
              {[...data.errors, ...data.calendarWarnings].join(" · ")}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
