# GOLD / BTC Trade Signals

A trading desk in a browser tab: live bias for XAU/USD (and 8 other instruments), rule-based
signals generated from **your two study guides**, a live TradingView chart with indicators, and
**ForexFactory news alerts that fire 20 minutes before every release, for every pair it touches**.

Everything the engine decides is traceable to a rule in one of the PDFs:

- `Gold_Trading_Course_BabyPips_Path.pdf` — sessions in IST, Asian-range session breakout, fakeouts,
  market environment, multi-timeframe rules, news handling, risk and position sizing.
- `Gold_Technical_Analysis_Varsity_Path.pdf` — candlesticks, support/resistance, RSI/MACD/Bollinger/ADX/ATR,
  Fibonacci, Dow Theory, the Central Pivot Range, and strategies 2 and 3 in full.

## What the site gives you

| Page | What it does |
| --- | --- |
| `/` (desk) | Which side the market can go, per instrument: a weighted multi-timeframe verdict (5m → daily), live TradingView chart with EMA 20/50/200 + RSI + MACD + ATR, TradingView's own rating as a second opinion, the live signal cards, the scalp feed, the ForexFactory panel with alerts, and a data-health strip. |
| `/research` | A dated deep-research brief on what is actually driving gold now (Fed path, central-bank and ETF demand, levels, volatility, intermarket, this week's events) with sources. |
| `/playbook` | The exact rules the engine enforces, strategy by strategy, plus the risk limits and the pre-trade checklist. |

### Signals

Four generators run on every refresh (45 s):

1. **Asian-range session breakout** (BabyPips strategy 1) — 15m entry, range-width filter against the
   14-day daily ATR, daily 50 EMA bias, midpoint stop with a 0.5 × 1h-ATR minimum, 1.5–2R or one range
   height, London/NY windows only, 22:30 IST cutoff.
2. **Range trade at support/resistance** (Varsity strategy 2) — flat tangled 4h EMAs with ADX < 20,
   range ≥ 3 × 1h ATR, edge-only entries, 1h trigger candle plus RSI / divergence / band-touch
   confirmation, midpoint then inside-the-far-zone targets.
3. **EMA trend pullback** (Varsity strategy 3) — 4h EMA stack and Dow structure, pullback into the
   20–50 EMA band with Fibonacci 38.2–61.8 % confluence, 1h trigger, stop capped at 2 × 4h ATR,
   2R/previous swing then trail under the 20 EMA.
4. **Scalp engine** (derived — the guides do not teach scalping) — 5m entries with the 15m and 1h
   trend, pullback to the 15m 20 EMA only, ATR stops, liquid hours only; switches to 5m band-edge
   mean reversion when the micro market is flat.

Each card shows entry / stop / target 1 / target 2, risk per unit, reward-to-risk, **the modelled win
percentage**, expectancy in R, the break-even win rate that R:R needs, a full technical rationale
("why the market can go up/down here"), what invalidates the trade, the retracement read with Fibonacci
levels and extensions, your position size at the account and risk % you set, and a copy-ready MT5 ticket.

### Retracements

Always on. The engine measures the last impulse, prints the depth as a percentage, flags the
38.2–61.8 % golden zone, lists all five retracement levels and the 127.2 / 161.8 % extension targets,
and refuses pullback entries deeper than 78.6 %.

### News alerts

The ForexFactory weekly calendar is pulled live. Every event gets a countdown; alerts fire at
**T-20 minutes** (configurable to 15/30/60), again at T-5 and at the release — desktop notification,
beep and a sticky banner naming every instrument that release can move. USD releases are mapped to all
instruments, since all of them are dollar-quoted. A **news blackout** flag switches on 30 minutes either
side of high-impact releases and marks down the win percentages of any live setup.

Keep the tab open (background is fine) and allow notifications once.

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
```

```bash
npm run build && npm run start   # production
npm run typecheck
```

No API key is required. Optional: `TWELVE_DATA_API_KEY` adds a third candle feed as a fallback.

### Data feeds

| Data | Primary | Fallbacks |
| --- | --- | --- |
| Gold, silver, FX, DXY candles | Yahoo Finance chart API | Twelve Data (if key set), Stooq (daily) |
| BTC candles | Binance klines | Yahoo Finance |
| Economic calendar | ForexFactory weekly JSON (`nfs.faireconomy.media`) | last good response, served as "cached" |

All feeds are fetched **server-side**, so there is no CORS problem and no key in the browser. 4-hour
candles are aggregated from hourly ones because Yahoo has no 4h bar.

**The host must be able to reach those domains.** If the dashboard shows "no price feed answered",
the environment is blocking egress, not the code — the request never leaves the box. On Claude cloud
environments, allow `query1.finance.yahoo.com` and `nfs.faireconomy.media` under Network access →
Allowed domains (see https://code.claude.com/docs/en/cloud-environments#network-access). Locally it
just works.

### MT5

The engine does not connect to MT5 — MetaTrader has no public web API. It reads the same market and
produces the ticket; you place it. MT5 quotes differ from the data feed by the spread and a small
broker offset, so re-check the level on your own chart before sending an order, and remember your
broker's symbol may be `XAUUSD.m`, `GOLD`, etc.

## Honesty about the win percentages

The percentage on each card is a **transparent confluence score**, not a backtest: a base rate taken
from what the guides state about that strategy (session breakout 40–50 % and dependent on its 1.5–2R
winners; range and pullback setups higher but rarer), moved by the checks the engine verified on live
candles, with diminishing returns and a hard 28–82 % clamp, then marked down for news blackouts,
rollover spreads, missing triggers and counter-trend entries.

It cannot be an edge measurement. An edge needs the 50–100 journalled trades with real spread and
slippage that both guides tell you to collect yourself. Use the number to **rank setups against each
other**, never to size up.

## Structure

```
app/            pages (desk, research, playbook) and API routes (signals, calendar, candles)
components/     Dashboard, BiasPanel, SignalCard, NewsAlerts, TradingView chart + gauge
lib/
  indicators.ts   EMA/SMA, RSI, ATR, ADX+DI, MACD, Bollinger, Stochastic, Supertrend,
                  swing pivots, Dow structure, S/R clustering, pivots, CPR, Fibonacci,
                  candlestick patterns, RSI divergence
  analysis.ts     per-timeframe snapshot + scored bias, retracement monitor, key levels
  strategies/     the four signal generators
  winrate.ts      base rates, confluence model, expectancy, break-even win rate
  sessions.ts     IST sessions, summer/winter shift, breakout / scalp / rollover windows
  providers/      candle feeds with fallbacks, ForexFactory calendar + blackout rules
  engine.ts       builds the whole dashboard payload
```

---

Education and research only. Not financial advice. Trading leveraged gold can lose more than you
expect. Under FEMA rules, Indian residents may trade gold derivatives on recognised Indian exchanges
(MCX, through a SEBI-registered broker); offshore XAU/USD CFDs are not permitted.
