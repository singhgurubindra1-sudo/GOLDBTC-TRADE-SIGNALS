"use client";

import { useState } from "react";
import type { Signal } from "@/lib/types";
import { breakEvenWinRate } from "@/lib/winrate";

function probColor(p: number) {
  if (p >= 62) return "text-emerald-300";
  if (p >= 50) return "text-amber-300";
  return "text-rose-300";
}

function probBar(p: number) {
  if (p >= 62) return "bg-emerald-400";
  if (p >= 50) return "bg-amber-400";
  return "bg-rose-400";
}

export function SignalCard({
  signal,
  accountBalance,
  riskPct,
  contractSize,
  unit,
}: {
  signal: Signal;
  accountBalance: number;
  riskPct: number;
  contractSize: number;
  unit: string;
}) {
  const [open, setOpen] = useState(false);
  const long = signal.direction === "BUY";
  const riskAmount = (accountBalance * riskPct) / 100;
  const units = signal.riskPerUnit > 0 ? riskAmount / signal.riskPerUnit : 0;
  const lots = Math.floor((units / contractSize) * 100) / 100;
  const breakEven = breakEvenWinRate(signal.rewardRisk);
  const edge = signal.winProbability - breakEven;

  return (
    <article
      className={`panel overflow-hidden ${
        signal.state === "LIVE" ? (long ? "border-emerald-500/50" : "border-rose-500/50") : ""
      }`}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#1e2a3a] px-4 py-3">
        <span
          className={`rounded px-2 py-1 text-xs font-bold ${
            long ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
          }`}
        >
          {signal.direction}
        </span>
        <span className="font-semibold">{signal.symbol}</span>
        <span className="text-xs text-slate-400">{signal.strategyName}</span>
        <span
          className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${
            signal.state === "LIVE"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-slate-500/40 bg-slate-500/10 text-slate-300"
          }`}
        >
          {signal.state === "LIVE" ? "TRIGGER MET" : "FORMING - WAIT FOR TRIGGER"}
        </span>
        {signal.newsBlackout && (
          <span className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
            NEWS BLACKOUT
          </span>
        )}
        <div className="ml-auto text-right">
          <div className={`text-2xl font-bold ${probColor(signal.winProbability)}`}>
            {signal.winProbability}%
          </div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">modelled win rate</div>
        </div>
      </header>

      <div className="px-4 py-3">
        <p className="text-sm text-slate-200">{signal.headline}</p>

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded bg-[#1b2635]">
          <div className={`h-full ${probBar(signal.winProbability)}`} style={{ width: `${signal.winProbability}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Needs {breakEven.toFixed(0)}% just to break even at {signal.rewardRisk.toFixed(2)} : 1 -{" "}
          <span className={edge >= 0 ? "text-emerald-300" : "text-rose-300"}>
            {edge >= 0 ? "+" : ""}
            {edge.toFixed(0)} pts of modelled edge
          </span>
          , expectancy {signal.expectancyR >= 0 ? "+" : ""}
          {signal.expectancyR.toFixed(2)}R.
        </p>

        <dl className="mono mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          {[
            ["Entry", signal.entry],
            ["Stop", signal.stop],
            ["Target 1", signal.target1],
            ["Target 2", signal.target2],
          ].map(([label, value]) => (
            <div key={label as string} className="panel-soft px-3 py-2">
              <dt className="text-[10px] uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="text-sm text-slate-100">{value as number}</dd>
            </div>
          ))}
        </dl>

        <div className="mono mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="panel-soft px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Risk / {unit}</div>
            <div className="text-slate-100">{signal.riskPerUnit}</div>
          </div>
          <div className="panel-soft px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">R : R</div>
            <div className="text-slate-100">{signal.rewardRisk.toFixed(2)} : 1</div>
          </div>
          <div className="panel-soft px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Size at {riskPct}%</div>
            <div className="text-slate-100">
              {lots > 0 ? `${lots.toFixed(2)} lot` : "too small - skip"}
            </div>
          </div>
          <div className="panel-soft px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Loss if stopped</div>
            <div className="text-slate-100">${(lots * contractSize * signal.riskPerUnit).toFixed(2)}</div>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-300">{signal.summary}</p>

        <button
          className="mt-3 text-xs font-medium text-[#e5b544] hover:underline"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "hide" : "show"} the full technical reasoning, invalidation rules and MT5 ticket
        </button>

        {open && (
          <div className="mt-3 space-y-3 border-t border-[#1e2a3a] pt-3 text-xs">
            <div>
              <h4 className="font-semibold uppercase tracking-wide text-slate-400">
                Why the market can go {long ? "up" : "down"} here
              </h4>
              <ul className="mt-1 space-y-1 text-slate-300">
                {signal.reasons.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className={long ? "text-emerald-400" : "text-rose-400"}>+</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
            {signal.retracement && (
              <div>
                <h4 className="font-semibold uppercase tracking-wide text-slate-400">Retracement check</h4>
                <p className="mt-1 text-slate-300">
                  Last impulse ran {signal.retracement.direction === "up" ? "up" : "down"} from{" "}
                  {signal.retracement.swingLow.toFixed(2)} to {signal.retracement.swingHigh.toFixed(2)}; price has
                  retraced {signal.retracement.depthPct.toFixed(0)}%. {signal.retracement.note}
                </p>
                <div className="mono mt-2 flex flex-wrap gap-2">
                  {signal.retracement.levels.map((l) => (
                    <span
                      key={l.label}
                      className={`panel-soft px-2 py-1 ${
                        signal.retracement && Math.abs(signal.retracement.depthPct - l.ratio * 100) < 7
                          ? "border-[#e5b544]/60 text-[#e5b544]"
                          : "text-slate-300"
                      }`}
                    >
                      {l.label} {l.price.toFixed(2)}
                    </span>
                  ))}
                  {signal.retracement.extensions.map((l) => (
                    <span key={l.label} className="panel-soft px-2 py-1 text-slate-400">
                      ext {l.label} {l.price.toFixed(2)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div>
              <h4 className="font-semibold uppercase tracking-wide text-slate-400">
                What kills this trade
              </h4>
              <ul className="mt-1 space-y-1 text-slate-300">
                {signal.warnings.map((w, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-amber-400">!</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold uppercase tracking-wide text-slate-400">MT5 ticket</h4>
              <pre className="mono panel-soft mt-1 overflow-x-auto px-3 py-2 text-[11px] text-slate-200">
{`Symbol      ${signal.symbol}  (check your broker's exact name, e.g. XAUUSD.m)
Order       ${signal.state === "LIVE" ? "Market" : long ? "Buy stop / pending" : "Sell stop / pending"} ${signal.direction}
Entry       ${signal.entry}
Stop loss   ${signal.stop}
Take profit ${signal.target1}  (half)  ->  ${signal.target2}  (runner)
Volume      ${lots > 0 ? lots.toFixed(2) : "0.00"} lot   (${riskPct}% of $${accountBalance.toLocaleString()})
Timeframe   ${signal.timeframe}
Source      ${signal.source}`}
              </pre>
              <p className="mt-1 text-[11px] text-slate-500">
                Prices come from the data feed, not from your broker. MT5 quotes differ by the spread and a
                small broker offset, so always re-check the level on your own chart before sending the order.
              </p>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
