"use client";

import type { BiasReport, IndicatorSnapshot } from "@/lib/types";

function verdictStyle(v: BiasReport["verdict"]) {
  switch (v) {
    case "STRONG BUY":
      return "bg-emerald-500 text-black";
    case "BUY":
      return "bg-emerald-500/25 text-emerald-200 border border-emerald-500/50";
    case "SELL":
      return "bg-rose-500/25 text-rose-200 border border-rose-500/50";
    case "STRONG SELL":
      return "bg-rose-500 text-white";
    default:
      return "bg-slate-500/20 text-slate-200 border border-slate-500/50";
  }
}

function Gauge({ score }: { score: number }) {
  const pct = (score + 100) / 2; // -100..100 -> 0..100
  return (
    <div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-gradient-to-r from-rose-500/70 via-slate-600 to-emerald-500/70">
        <div
          className="absolute top-[-4px] h-5 w-1.5 rounded bg-white shadow"
          style={{ left: `calc(${pct}% - 3px)` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-slate-500">
        <span>sell</span>
        <span>neutral</span>
        <span>buy</span>
      </div>
    </div>
  );
}

function tfRow(tf: IndicatorSnapshot, digits: number) {
  const color = tf.bias === "BULLISH" ? "text-emerald-300" : tf.bias === "BEARISH" ? "text-rose-300" : "text-slate-300";
  return (
    <tr key={tf.interval} className="border-t border-[#1e2a3a]">
      <td className="px-2 py-1.5 font-semibold text-slate-200">{tf.interval}</td>
      <td className={`px-2 py-1.5 font-semibold ${color}`}>{tf.bias}</td>
      <td className="mono px-2 py-1.5 text-slate-300">{tf.score.toFixed(0)}</td>
      <td className="mono px-2 py-1.5 text-slate-300">{tf.close.toFixed(digits)}</td>
      <td className="mono px-2 py-1.5 text-slate-400">{tf.ema20.toFixed(digits)}</td>
      <td className="mono px-2 py-1.5 text-slate-400">{tf.ema50.toFixed(digits)}</td>
      <td className="mono px-2 py-1.5 text-slate-400">{tf.ema200.toFixed(digits)}</td>
      <td className="mono px-2 py-1.5 text-slate-300">{tf.rsi14.toFixed(0)}</td>
      <td className="mono px-2 py-1.5 text-slate-300">{tf.adx14.toFixed(0)}</td>
      <td className="mono px-2 py-1.5 text-slate-300">{tf.atr14.toFixed(2)}</td>
      <td className="mono px-2 py-1.5 text-slate-400">{tf.macdHist >= 0 ? "+" : ""}{tf.macdHist.toFixed(2)}</td>
      <td className="px-2 py-1.5 text-[11px] text-slate-400">{tf.environment}</td>
    </tr>
  );
}

export function BiasPanel({ bias, digits }: { bias: BiasReport; digits: number }) {
  const l = bias.levels;
  return (
    <section className="panel p-4">
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Which side the market can go - {bias.symbol}
          </h2>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="mono text-3xl font-bold text-white">{bias.price.toFixed(digits)}</span>
            <span className={`mono text-sm ${bias.changePct >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
              {bias.changePct >= 0 ? "+" : ""}
              {bias.changePct.toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="ml-auto text-right">
          <span className={`inline-block rounded px-3 py-1.5 text-lg font-bold ${verdictStyle(bias.verdict)}`}>
            {bias.verdict}
          </span>
          <div className="mt-1 text-[11px] text-slate-400">
            score {bias.score.toFixed(0)} / 100 · {bias.confidence}% timeframe agreement
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Gauge score={bias.score} />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-300">{bias.summary}</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="px-2 py-1 font-medium">TF</th>
              <th className="px-2 py-1 font-medium">Bias</th>
              <th className="px-2 py-1 font-medium">Score</th>
              <th className="px-2 py-1 font-medium">Close</th>
              <th className="px-2 py-1 font-medium">EMA20</th>
              <th className="px-2 py-1 font-medium">EMA50</th>
              <th className="px-2 py-1 font-medium">EMA200</th>
              <th className="px-2 py-1 font-medium">RSI</th>
              <th className="px-2 py-1 font-medium">ADX</th>
              <th className="px-2 py-1 font-medium">ATR</th>
              <th className="px-2 py-1 font-medium">MACD h</th>
              <th className="px-2 py-1 font-medium">Environment</th>
            </tr>
          </thead>
          <tbody>{bias.timeframes.map((tf) => tfRow(tf, digits))}</tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel-soft p-3">
          <h3 className="text-[10px] uppercase tracking-wide text-slate-500">Asian range (breakout base)</h3>
          <p className="mono mt-1 text-sm text-slate-200">
            {l.asianHigh != null && l.asianLow != null
              ? `${l.asianLow.toFixed(digits)} - ${l.asianHigh.toFixed(digits)}`
              : "not formed yet"}
          </p>
          {l.asianMid != null && (
            <p className="mono text-[11px] text-slate-500">
              mid / stop {l.asianMid.toFixed(digits)} · width {l.asianWidth?.toFixed(2)}
            </p>
          )}
        </div>
        <div className="panel-soft p-3">
          <h3 className="text-[10px] uppercase tracking-wide text-slate-500">Floor pivots</h3>
          <p className="mono mt-1 text-[11px] leading-5 text-slate-300">
            R2 {l.r2.toFixed(digits)}
            <br />R1 {l.r1.toFixed(digits)}
            <br />
            <span className="text-[#e5b544]">P {l.pivot.toFixed(digits)}</span>
            <br />S1 {l.s1.toFixed(digits)}
            <br />S2 {l.s2.toFixed(digits)}
          </p>
        </div>
        <div className="panel-soft p-3">
          <h3 className="text-[10px] uppercase tracking-wide text-slate-500">Central Pivot Range</h3>
          <p className="mono mt-1 text-sm text-slate-200">
            {l.cprBottom.toFixed(digits)} - {l.cprTop.toFixed(digits)}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-slate-400">{l.cprVerdict}</p>
        </div>
        <div className="panel-soft p-3">
          <h3 className="text-[10px] uppercase tracking-wide text-slate-500">Nearest zones (1h swings)</h3>
          <p className="mono mt-1 text-[11px] leading-5 text-slate-300">
            R: {l.resistance.map((r) => r.toFixed(digits)).join(" · ") || "-"}
            <br />
            S: {l.support.map((s) => s.toFixed(digits)).join(" · ") || "-"}
          </p>
          <p className="mono mt-1 text-[11px] text-slate-500">
            day {l.dayLow.toFixed(digits)} - {l.dayHigh.toFixed(digits)}
          </p>
        </div>
      </div>

      {bias.retracement && (
        <div className="panel-soft mt-3 p-3">
          <h3 className="text-[10px] uppercase tracking-wide text-slate-500">
            Retracement monitor (always on)
          </h3>
          <p className="mt-1 text-xs text-slate-300">
            Last impulse {bias.retracement.direction === "up" ? "up" : "down"}{" "}
            {bias.retracement.swingLow.toFixed(digits)} → {bias.retracement.swingHigh.toFixed(digits)}; retraced{" "}
            <span className={bias.retracement.inGoldenZone ? "font-semibold text-[#e5b544]" : "text-slate-200"}>
              {bias.retracement.depthPct.toFixed(1)}%
            </span>
            . {bias.retracement.note}
          </p>
          <div className="mono mt-2 flex flex-wrap gap-2 text-[11px]">
            {bias.retracement.levels.map((lv) => (
              <span
                key={lv.label}
                className={`rounded border px-2 py-1 ${
                  Math.abs(bias.retracement!.depthPct - lv.ratio * 100) < 7
                    ? "border-[#e5b544]/60 bg-[#e5b544]/10 text-[#e5b544]"
                    : "border-[#1e2a3a] text-slate-300"
                }`}
              >
                {lv.label} · {lv.price.toFixed(digits)}
              </span>
            ))}
            {bias.retracement.extensions.map((lv) => (
              <span key={lv.label} className="rounded border border-[#1e2a3a] px-2 py-1 text-slate-500">
                ext {lv.label} · {lv.price.toFixed(digits)}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
