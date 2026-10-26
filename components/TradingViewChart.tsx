"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  /** Default TradingView symbol, e.g. OANDA:XAUUSD. */
  symbol: string;
  /** Other feeds for the same market, offered if the default one will not load. */
  alternatives?: string[];
  /** TradingView interval code: 5, 15, 60, 240, D. */
  interval: string;
  onIntervalChange?: (interval: string) => void;
};

const SIZES = [
  { key: "m", label: "Medium", css: "70vh" },
  { key: "l", label: "Large", css: "88vh" },
  { key: "s", label: "Small", css: "480px" },
] as const;

const TF_BUTTONS: { label: string; code: string }[] = [
  { label: "1m", code: "1" },
  { label: "5m", code: "5" },
  { label: "15m", code: "15" },
  { label: "30m", code: "30" },
  { label: "1h", code: "60" },
  { label: "4h", code: "240" },
  { label: "1D", code: "D" },
  { label: "1W", code: "W" },
];

const STORAGE_KEY = "gbts.chart.v1";

/**
 * Live TradingView chart, sized to be actually usable: large by default, with a
 * fullscreen mode, and a feed switcher for when a particular exchange symbol does not
 * load in the free widget.
 */
export function TradingViewChart({ symbol, alternatives = [], interval, onIntervalChange }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<(typeof SIZES)[number]["key"]>("m");
  const [full, setFull] = useState(false);
  const [feed, setFeed] = useState(symbol);
  const [custom, setCustom] = useState("");
  const [nonce, setNonce] = useState(0);

  // A new instrument resets the feed choice, but a manual override for THIS instrument
  // survives a re-render.
  useEffect(() => {
    setFeed(symbol);
    setCustom("");
  }, [symbol]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as { size?: typeof size };
        if (s.size) setSize(s.size);
      }
    } catch {
      // ignore
    }
  }, []);

  const persistSize = (next: typeof size) => {
    setSize(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ size: next }));
    } catch {
      // ignore
    }
  };

  const height = full ? "100%" : SIZES.find((s) => s.key === size)!.css;

  const mount = useCallback(() => {
    const el = container.current;
    if (!el) return;
    el.innerHTML = "";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "100%";
    widget.style.width = "100%";
    el.appendChild(widget);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: feed,
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
      details: false,
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
  }, [feed, interval]);

  useEffect(() => {
    mount();
    return () => {
      if (container.current) container.current.innerHTML = "";
    };
  }, [mount, nonce, full, size]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [full]);

  const feedOptions = Array.from(new Set([symbol, ...alternatives]));

  const controls = (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#1e2a3a] px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-1">
        {TF_BUTTONS.map((t) => (
          <button
            key={t.code}
            onClick={() => onIntervalChange?.(t.code)}
            className={`rounded px-2 py-1 ${
              interval === t.code ? "bg-[#e5b544] font-semibold text-black" : "panel-soft text-slate-300 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <label className="ml-2 flex items-center gap-1 text-slate-400">
        feed
        <select
          className="panel-soft max-w-[180px] px-2 py-1 text-slate-200"
          value={feedOptions.includes(feed) ? feed : "custom"}
          onChange={(e) => {
            if (e.target.value !== "custom") setFeed(e.target.value);
          }}
        >
          {feedOptions.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
          {!feedOptions.includes(feed) && <option value="custom">{feed}</option>}
        </select>
      </label>

      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (custom.trim()) setFeed(custom.trim().toUpperCase());
        }}
      >
        <input
          className="panel-soft mono w-40 px-2 py-1 text-slate-200 placeholder:text-slate-600"
          placeholder="e.g. FOREXCOM:XAUUSD"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <button className="panel-soft px-2 py-1 text-slate-300 hover:text-white" type="submit">
          load
        </button>
      </form>

      <div className="ml-auto flex items-center gap-1">
        {!full &&
          SIZES.map((s) => (
            <button
              key={s.key}
              onClick={() => persistSize(s.key)}
              className={`rounded px-2 py-1 ${
                size === s.key ? "bg-[#1e2a3a] text-white" : "panel-soft text-slate-300 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        <button className="panel-soft px-2 py-1 text-slate-300 hover:text-white" onClick={() => setNonce((n) => n + 1)}>
          reload
        </button>
        <button
          className="rounded bg-[#e5b544] px-2 py-1 font-semibold text-black hover:brightness-110"
          onClick={() => setFull((f) => !f)}
        >
          {full ? "exit fullscreen (Esc)" : "fullscreen"}
        </button>
      </div>
    </div>
  );

  if (full) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[#06090f]">
        {controls}
        <div className="min-h-0 flex-1">
          <div className="tradingview-widget-container h-full w-full" ref={container} />
        </div>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden">
      {controls}
      <div className="tradingview-widget-container w-full" ref={container} style={{ height }} />
      <p className="border-t border-[#1e2a3a] px-3 py-2 text-[11px] leading-relaxed text-slate-500">
        Chart timezone is Asia/Kolkata (IST). The three EMA studies load with TradingView&apos;s default period -
        set them to 20, 50 and 200 once and your browser keeps it. If a feed shows &quot;invalid symbol&quot;, pick
        another from the feed list (OANDA and FOREXCOM need no login; COMEX:GC1! is the futures contract) or type
        your own, e.g. your broker&apos;s <span className="mono">XAUUSD.m</span>.
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
      height: 400,
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
