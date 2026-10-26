"use client";

import { useEffect, useRef } from "react";

type Props = {
  /** TradingView symbol, e.g. OANDA:XAUUSD. */
  symbol: string;
  /** TradingView interval code: 5, 15, 60, 240, D. */
  interval: string;
  height?: number;
};

/**
 * Live TradingView chart with the indicator set both guides ask for:
 * 20/50/200 EMA on price, plus RSI(14), MACD(12,26,9) and ATR(14) panes.
 */
export function TradingViewChart({ symbol, interval, height = 560 }: Props) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    el.innerHTML = "";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = `${height}px`;
    el.appendChild(widget);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "Asia/Kolkata",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "#0d131d",
      gridColor: "rgba(30, 42, 58, 0.6)",
      hide_side_toolbar: false,
      allow_symbol_change: true,
      withdateranges: true,
      details: true,
      studies: [
        "STD;EMA",
        "STD;EMA",
        "STD;EMA",
        "STD;RSI",
        "STD;MACD",
        "STD;Average%1True%1Range",
      ],
      support_host: "https://www.tradingview.com",
    });
    el.appendChild(script);

    return () => {
      el.innerHTML = "";
    };
  }, [symbol, interval, height]);

  return (
    <div className="panel overflow-hidden">
      <div className="tradingview-widget-container" ref={container} style={{ height }} />
      <p className="border-t border-[#1e2a3a] px-3 py-2 text-[11px] text-slate-500">
        Chart timezone is Asia/Kolkata (IST), as the guides recommend. The three EMA studies default to 9
        periods when the widget loads - set them to 20, 50 and 200 once and TradingView remembers it per
        browser.
      </p>
    </div>
  );
}

/** TradingView's own oscillator / moving-average rating, as a second opinion. */
export function TradingViewGauge({ symbol, interval }: { symbol: string; interval: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    el.innerHTML = "";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    el.appendChild(widget);
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      interval,
      width: "100%",
      isTransparent: true,
      height: 420,
      symbol,
      showIntervalTabs: true,
      displayMode: "single",
      locale: "en",
      colorTheme: "dark",
    });
    el.appendChild(script);
    return () => {
      el.innerHTML = "";
    };
  }, [symbol, interval]);

  return (
    <div className="panel p-2">
      <div className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        TradingView rating (second opinion)
      </div>
      <div ref={container} />
    </div>
  );
}
