export const metadata = {
  title: "The playbook - rules the engine enforces",
  description: "The exact rules from the BabyPips Path and Zerodha Varsity Path guides that this engine checks on every refresh.",
};

function Rule({ n, children }: { n: number | string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mono mt-0.5 h-5 w-5 shrink-0 rounded bg-[#e5b544]/15 text-center text-[11px] leading-5 text-[#e5b544]">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function Section({
  title,
  tag,
  source,
  children,
}: {
  title: string;
  tag: string;
  source: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <span className="rounded bg-[#e5b544]/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#e5b544]">
          {tag}
        </span>
        <span className="ml-auto text-[11px] text-slate-500">{source}</span>
      </div>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

export default function PlaybookPage() {
  return (
    <main className="mx-auto max-w-[1100px] space-y-5 px-4 py-6">
      <header className="panel p-5">
        <h1 className="text-2xl font-bold text-white">The playbook the engine enforces</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Every signal on the desk page is produced by one of the four rule sets below. Nothing is discretionary: if
          a rule fails, the setup is either downgraded to <span className="font-semibold">FORMING</span> or dropped.
          The win percentage you see is the base rate for that strategy, adjusted by the confluence items the engine
          could actually verify, and marked down by the penalties it found.
        </p>
      </header>

      <Section
        title="Strategy 1 - Asian range session breakout"
        tag="day trade · 15m"
        source="BabyPips Path, Part 10"
      >
        <ul className="space-y-2">
          <Rule n={1}>
            Mark the Asian range: highest high and lowest low from 05:30 IST until the London open (12:30 IST
            summer, 13:30 IST winter).
          </Rule>
          <Rule n={2}>
            Width filter: skip the day if the range is wider than about 50% of the 14-day daily ATR (already moved
            too much) or tighter than about 15% (fakeout farm).
          </Rule>
          <Rule n={3}>No entry within 30 minutes either side of high-impact USD news. On NFP, CPI and FOMC days, trade only after the release.</Rule>
          <Rule n={4}>Daily bias: price above the daily 50 EMA favours longs. Against it, half size or skip.</Rule>
          <Rule n={5}>
            Entry: a 15-minute candle closes beyond the range with a body at least half its total size. First valid
            breakout of the day only.
          </Rule>
          <Rule n={6}>Stop: the range midpoint, and it must allow at least 0.5 x the 1-hour ATR. Otherwise use the far side of the range.</Rule>
          <Rule n={7}>Target: 1.5-2R, or one range height projected from the breakout level - whichever comes first.</Rule>
          <Rule n={8}>Management: breakeven stop at +1R, everything closed by 22:30 IST. Never held overnight.</Rule>
        </ul>
        <p className="text-slate-400">
          Expect 40-50% wins and a dependence on the 1.5-2R winners, with losing streaks of 5-7 trades. If the
          first breakout candle closes outside and the next one or two close back inside, that is a fakeout - the
          advanced variation trades the other way, with the stop beyond the fakeout extreme.
        </p>
      </Section>

      <Section title="Strategy 2 - Range trade at support / resistance" tag="swing · 1h trigger" source="Varsity Path, Part 9">
        <ul className="space-y-2">
          <Rule n={1}>Environment: 4-hour 20/50/200 EMAs flat and tangled, ADX(14) below 20 (or falling from a high reading).</Rule>
          <Rule n={2}>A clear horizontal range with at least two touches at support and two at resistance.</Rule>
          <Rule n={3}>Range height at least 3 x the 1-hour ATR, so a 1.5 : 1 trade actually fits inside it.</Rule>
          <Rule n={4}>Price must be in the bottom 20% of the range to buy (top 20% to sell). Never the middle.</Rule>
          <Rule n={5}>Trigger: a 1-hour hammer, bullish engulfing, piercing pattern or morning star closes. Mirror for shorts.</Rule>
          <Rule n={6}>
            At least one confirmation: RSI(14) below 30 or turning up from below 35, a bullish RSI divergence, a
            lower Bollinger band touch, or a pivot / round number inside the zone.
          </Rule>
          <Rule n={7}>Nothing high-impact due in the next 2 hours.</Rule>
          <Rule n={8}>Stop: below the zone (or the trigger candle&apos;s low, whichever is lower) minus 0.5 x the 1-hour ATR.</Rule>
          <Rule n={9}>Target 1 the range midpoint - close half, stop to breakeven. Target 2 just inside the far zone, never at the exact edge.</Rule>
          <Rule n={10}>Exit the moment a 4-hour candle closes outside the zone. After the third touch, consider half size.</Rule>
        </ul>
      </Section>

      <Section title="Strategy 3 - EMA trend pullback" tag="swing · 1h trigger" source="Varsity Path, Part 10">
        <ul className="space-y-2">
          <Rule n={1}>4-hour: 50 EMA above the 200 EMA, both sloping up, price above the 200 EMA (mirror for shorts).</Rule>
          <Rule n={2}>Dow Theory structure holding: higher highs and higher lows, and the last higher low unbroken.</Rule>
          <Rule n={3}>ADX(14) above 20, ideally above 25.</Rule>
          <Rule n={4}>Wait for the pullback into the 20-50 EMA band. Do not buy while price is far above the 20 EMA.</Rule>
          <Rule n={5}>Confluence in the zone: old resistance now support, the 38.2-61.8% Fibonacci level of the last swing, a round number.</Rule>
          <Rule n={6}>Trigger: a 1-hour bullish engulfing, hammer or morning star closing in the zone, or a break of the last pullback candle&apos;s high.</Rule>
          <Rule n={7}>No high-impact USD news within 2 hours.</Rule>
          <Rule n={8}>
            Stop: below the pullback swing low minus 0.3 x the 4-hour ATR. If that stop is wider than 2 x ATR, the
            pullback is too deep - no trade.
          </Rule>
          <Rule n={9}>Target 1: 2R or the previous swing high, whichever comes first. Close half, stop to breakeven.</Rule>
          <Rule n={10}>
            Trail the rest: out when a 4-hour candle closes below the 20 EMA (or on Supertrend 10, 3). Kill
            everything if a 4-hour candle closes below the 50 EMA <em>and</em> below the last higher low.
          </Rule>
        </ul>
      </Section>

      <Section title="Scalp engine - the guides' blocks on a faster clock" tag="scalp · 5m" source="Derived, not one of the three numbered strategies">
        <p>
          Both guides are explicit that scalping is hard on gold and is not one of their strategies. This engine
          still runs scalps because you asked for them, but it refuses to loosen the parts that keep you solvent:
          session filter, trend alignment, pullback-only entries, ATR stops and the news rule.
        </p>
        <ul className="space-y-2">
          <Rule n={1}>Only in liquid hours: London open through the London / New York overlap (plus one hour).</Rule>
          <Rule n={2}>Direction must agree with the 15-minute EMA stack <em>and</em> the 1-hour 50 EMA.</Rule>
          <Rule n={3}>Entry at a pullback to the 15-minute 20 EMA, inside 0.8 x the 5-minute ATR. Never on an extended candle.</Rule>
          <Rule n={4}>Trigger: a 5-minute reversal candle in the direction of the trend; RSI reset into the 40-60 band.</Rule>
          <Rule n={5}>Stop: 0.5 x the 5-minute ATR beyond the micro swing. Target 1 at 1.2R, target 2 at 2R.</Rule>
          <Rule n={6}>
            In a flat micro market (5-minute ADX below 20) it switches to a band-edge mean reversion instead, with
            the band middle as the target - one attempt per edge.
          </Rule>
          <Rule n={7}>Be flat before every release. The alert panel is the clock for this.</Rule>
        </ul>
      </Section>

      <Section title="Risk rules - these override every signal" tag="non-negotiable" source="BabyPips Part 9 / Varsity Part 11">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="px-2 py-1 font-medium">Rule</th>
                <th className="px-2 py-1 font-medium">Limit</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {[
                ["Risk per trade", "0.5% learning, 1% experienced"],
                ["Maximum loss per day", "2%, or two losing trades - then stop for the day"],
                ["Maximum loss per week", "4-5%, then stop and review the journal"],
                ["Maximum open risk at once", "2% (count gold + silver + short dollar as one bet)"],
                ["After a 10% drawdown", "Halve position size until half of it is recovered"],
                ["Minimum reward-to-risk", "1.5 : 1, or skip the trade"],
                ["Effective leverage", "Under 5 : 1 of account value"],
                ["Stop placement", "Structure point + 0.3-0.5 x ATR buffer. Only ever tightened, never widened."],
              ].map(([a, b]) => (
                <tr key={a} className="border-t border-[#1e2a3a]">
                  <td className="px-2 py-1.5">{a}</td>
                  <td className="px-2 py-1.5 text-slate-200">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-slate-400">
          Position size (ounces) = amount you are willing to lose / stop distance in dollars; lots = ounces / 100.
          Always round down. The desk page does this for you from the account size and risk % in the top bar.
        </p>
      </Section>

      <Section title="Pre-trade checklist" tag="before you click" source="BabyPips Appendix">
        <ul className="space-y-1 text-sm">
          {[
            "I know which environment gold is in today (trend, range, quiet before expansion).",
            "There is no high-impact USD news within 30 minutes.",
            "The setup matches the written rules exactly - not approximately.",
            "The direction agrees with the daily chart, or I am using reduced size.",
            "The stop is at a structure level with an ATR buffer.",
            "Position size is calculated: risk is 1% of the account or less.",
            "Reward-to-risk is at least 1.5 : 1.",
            "I am calm, and not trading to recover a loss.",
            "I will log this trade in my journal with a screenshot.",
          ].map((c) => (
            <li key={c} className="flex gap-2">
              <span className="text-[#e5b544]">☐</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </Section>

      <section className="panel border-amber-500/40 bg-amber-500/5 p-5 text-sm text-amber-100/90">
        <h2 className="font-semibold text-amber-200">On the win percentages</h2>
        <p className="mt-2 leading-relaxed">
          The percentage on each card is a <strong>confluence score dressed as a probability</strong>: a base rate
          taken from what the guides state about that strategy, moved by the checks the engine verified on live
          candles. It is not a backtest, and it cannot be - a backtest needs the 50-100 recorded trades the guides
          ask you to collect yourself, with real spread and slippage. Use the number to rank setups against each
          other, not to size up. The only honest win rate is the one in your own journal after 50 trades.
        </p>
      </section>
    </main>
  );
}
