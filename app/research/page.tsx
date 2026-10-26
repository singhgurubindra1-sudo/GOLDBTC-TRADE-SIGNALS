import Link from "next/link";

export const metadata = {
  title: "Gold research brief - October 2026",
  description:
    "Deep-research brief on what is driving gold right now: Fed path, central-bank and ETF demand, dollar and yields, levels and the week's event risk.",
};

const SOURCES: { label: string; url: string }[] = [
  { label: "World Gold Council - Gold Market Commentary (Sept/Oct 2026)", url: "https://www.gold.org/goldhub/research/gold-market-commentary-september-2026" },
  { label: "World Gold Council - China gold market update, Q3 official buying", url: "https://www.gold.org/goldhub/gold-focus/2026/10/china-gold-market-update-q3-ends-strong-official-gold-buying" },
  { label: "World Gold Council - global gold-backed ETF holdings and flows", url: "https://www.gold.org/goldhub/data/global-gold-backed-etf-holdings-and-flows" },
  { label: "Kitco - China buys the gold dip as ETF holdings hit a record (15 Oct 2026)", url: "https://www.kitco.com/news/article/2026-10-15/china-buys-gold-dip-etf-holdings-hit-record-and-holiday-demand-lifts-q4" },
  { label: "MINING.COM - Central banks' gold buying momentum carries into 2026", url: "https://www.mining.com/central-banks-gold-buying-momentum-carries-into-2026/" },
  { label: "Newsquawk - Week in Focus, 26-30 October 2026", url: "https://www.newsquawk.com/headlines/week-in-focus-26-30th-october-2026-fomc-boc-rbnz-ecb-boj-policy-decisions-us-pce" },
  { label: "Kiplinger - What to look out for in economic data this week (26-30 Oct)", url: "https://www.kiplinger.com/investing/economy/this-weeks-economic-calendar" },
  { label: "FXLeaders - XAU/USD reclaims $4,000 ahead of the Fed decision (26 Oct 2026)", url: "https://www.fxleaders.com/news/2026/10/26/gold-price-forecast-xau-usd-reclaims-4000-as-oil-cools-ahead-of-fed-decision/" },
  { label: "RoboForex - XAU/USD weekly forecast, 26-30 October 2026", url: "https://roboforex.com/beginners/analytics/forex-forecast/gold/xau-usd-gold-weekly-forecast-2026-10-23/" },
  { label: "ING - Gold's bull run to continue in 2026", url: "https://think.ing.com/articles/golds-bull-run-to-continue-in-2026/" },
];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[#e5b544]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

export default function ResearchPage() {
  return (
    <main className="mx-auto max-w-[1100px] space-y-5 px-4 py-6">
      <header className="panel p-5">
        <p className="text-xs uppercase tracking-wide text-slate-500">Deep research brief · desk research, 26 October 2026</p>
        <h1 className="mt-1 text-2xl font-bold text-white">What is actually driving gold right now</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          The short version: gold is in a <strong className="text-white">high-level consolidation inside an intact bull
          market</strong>. Spot is back around <span className="mono">$4,000-4,015</span> after a week of selling, the
          structural bid (central banks, record ETF holdings) has not gone away, and the next real catalyst is the
          Fed on <strong className="text-white">Wednesday 28 October</strong>, followed by US GDP and PCE on Thursday.
          That mix - supported by flows, pressured by rate expectations - is exactly the environment where the
          playbooks in your two PDFs work best: <em>trade the levels and the retracements, stay flat into the data</em>.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          This page is a dated research snapshot written by hand from the sources listed at the bottom. It does not
          auto-update. The live, auto-updating read is on the{" "}
          <Link href="/" className="text-[#e5b544] hover:underline">
            desk page
          </Link>
          .
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="1. The bull case is structural, not sentimental">
          <p>
            Central-bank demand is still the floor under this market. The World Gold Council&apos;s working number for
            2026 is roughly <strong className="text-white">850 tonnes</strong> of official-sector buying, close to
            2025&apos;s pace. The PBoC added about <strong className="text-white">23 tonnes in September</strong>, its
            biggest month since October 2023, taking it to roughly 103 tonnes year to date - and notably, it bought
            into the price dip rather than waiting.
          </p>
          <p>
            Investment demand finally joined in. Global gold-backed ETF holdings rose 67 tonnes in Q3 to a record
            <strong className="text-white"> 4,256 tonnes</strong>, with Europe (the UK alone +54t, plus France and
            Germany) out-buying North America for the first positive-flow quarter since 2021. AUM still fell about 7%
            month on month because the price dropped - which tells you the drawdown was price-led, not flow-led.
          </p>
          <p className="text-slate-400">
            Trading consequence: dips have a buyer. That favours the Varsity guide&apos;s strategy 3 (buy the 20-50 EMA
            pullback) over trying to short strength, unless the 4-hour structure actually breaks.
          </p>
        </Card>

        <Card title="2. The bear case is the rate path">
          <p>
            Gold pays no interest, so real yields and the Fed&apos;s expected path are the handbrake. The October
            meeting (statement Wednesday, 23:30 IST summer time) is broadly expected to be a{" "}
            <strong className="text-white">hold at 3.75-4.00%</strong> - a Reuters poll had 94 of 100 economists on
            hold. The market&apos;s attention is therefore on the <em>wording</em>, the dissent count and the press
            conference, not the decision.
          </p>
          <p>
            That is the asymmetry to respect: a hold is priced, so the move comes from tone. A hawkish &quot;higher for
            longer&quot; framing is the scenario that pushes gold back under $4,000 and keeps it there; a dovish nod to
            December cuts is what re-opens the upside.
          </p>
          <p className="text-slate-400">
            Trading consequence: this is a BabyPips Part 7 situation - do not hold breakout trades through the
            statement. Flat 30 minutes before, then treat the post-statement high and low as a brand-new range.
          </p>
        </Card>

        <Card title="3. Levels the market is actually watching">
          <p>
            Sell-side and technical desks are clustering around the same handful of numbers this week:
          </p>
          <ul className="mono space-y-1 text-xs text-slate-300">
            <li>· <span className="text-rose-300">Resistance</span> $4,110 → then $4,285 and $4,355 if it breaks</li>
            <li>· <span className="text-slate-400">Pivot area</span> $4,074 - the line between cautious bearish and neutral</li>
            <li>· <span className="text-emerald-300">Support</span> $3,893-3,895, the obvious shelf under the market</li>
          </ul>
          <p>
            The $4,000 handle itself is doing work as a psychological round number, which both guides tell you to
            treat as extra confluence when it lines up with a pivot or a Fibonacci level.
          </p>
          <p className="text-slate-400">
            Trading consequence: these are the levels to check your signal entries against. A long into $4,110 with
            no room to the next resistance fails the 1.5 : 1 filter - skip it, as the rules say.
          </p>
        </Card>

        <Card title="4. Volatility: size from ATR, not habit">
          <p>
            Daily ATR on gold has been running in the <strong className="text-white">$50-100</strong> band through
            2026 - many times what it was a few years ago. A $10 stop is not a tight stop any more, it is noise.
          </p>
          <p>
            That is why every signal on the desk page sizes its stop from ATR plus structure, and why the position
            calculator rounds lots <em>down</em>. On a small account the honest answer is often &quot;this trade is too
            big for me today&quot; - the guides say that is a signal to stay on demo, not to shrink the stop.
          </p>
          <p className="text-slate-400">
            Trading consequence: the 1% rule bites harder than it used to. 0.5% per trade while you are learning
            this engine is the sane default.
          </p>
        </Card>

        <Card title="5. Intermarket: what to watch alongside the chart">
          <p>
            The relationships in Part 7 of the BabyPips guide still hold most of the time, but which one is driving
            changes week to week ( &quot;narrative analysis&quot; ). Right now the dominant pair of drivers is{" "}
            <strong className="text-white">rate expectations vs official-sector demand</strong>.
          </p>
          <ul className="space-y-1 text-xs text-slate-300">
            <li>· <span className="text-slate-100">DXY</span> - usually inverse. A dollar bounce on a hawkish Fed is the clearest bear trigger.</li>
            <li>· <span className="text-slate-100">US 10-year real yield</span> - inverse, and the cleaner signal of the two.</li>
            <li>· <span className="text-slate-100">Silver (XAG/USD)</span> - same direction, more volatile; a silver refusal to confirm a gold move is a warning (Dow&apos;s confirmation idea).</li>
            <li>· <span className="text-slate-100">Oil</span> - cooling oil has eased inflation-panic bids this week, part of why gold stabilised rather than spiked.</li>
          </ul>
        </Card>

        <Card title="6. This week's event risk (IST)">
          <ul className="space-y-1 text-xs text-slate-300">
            <li>· <strong className="text-white">Wed 28 Oct</strong> - FOMC statement and press conference (23:30 / 00:30 IST). The week&apos;s main event. Expect two-way swings.</li>
            <li>· <strong className="text-white">Wed 28 Oct</strong> - RBNZ and Bank of Canada decisions (moves their own pairs; gold only via risk sentiment).</li>
            <li>· <strong className="text-white">Thu 29 Oct</strong> - US advance Q3 GDP plus September PCE / core PCE (18:00 / 19:00 IST). Core PCE expected around +0.3% m/m vs +0.2% prior.</li>
            <li>· <strong className="text-white">Thu 29 Oct</strong> - ECB decision. <strong className="text-white">Fri 30 Oct</strong> - BoJ decision, euro-area flash CPI and GDP.</li>
            <li>· US CPI is <em>not</em> this week - the October release was mid-month.</li>
          </ul>
          <p className="text-slate-400">
            The desk page pulls the ForexFactory calendar live and alerts you 20 minutes before each of these, for
            every pair they touch, so you do not have to remember the list.
          </p>
        </Card>
      </div>

      <Card title="How this brief feeds the signals">
        <p>
          The engine does not read this page - it reads candles. But the two interact in a way worth being explicit
          about:
        </p>
        <ul className="space-y-1 text-sm text-slate-300">
          <li>
            · <strong className="text-white">Consolidation inside a bull market</strong> means the range strategy
            (Varsity strategy 2) and the pullback strategy (strategy 3) will fire more often than clean session
            breakouts. ADX below 20 on the 4-hour is the tell, and the desk page prints it.
          </li>
          <li>
            · <strong className="text-white">Event-heavy week</strong> means the news blackout will switch on
            repeatedly. When it does, the modelled win rates are explicitly marked down - the honest read of a setup
            20 minutes before the Fed is &quot;do not take it&quot;.
          </li>
          <li>
            · <strong className="text-white">High ATR</strong> means stops are wide and lots are small. If the
            position calculator says 0.00 lot, the trade is bigger than your account should carry.
          </li>
        </ul>
      </Card>

      <section className="panel p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Sources</h2>
        <ul className="mt-3 space-y-1 text-xs">
          {SOURCES.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer" className="text-[#e5b544] hover:underline">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Caveats worth keeping: the short-term forecasts in the broker pieces above disagree with each other (one
          puts a December hike near 75%, another near 9%) - they are opinions, not consensus, and they are quoted
          here as what the market is arguing about rather than as fact. Long-range &quot;price prediction&quot; pages were
          deliberately excluded; their numbers are internally inconsistent. Nothing on this page is financial advice.
        </p>
      </section>
    </main>
  );
}
