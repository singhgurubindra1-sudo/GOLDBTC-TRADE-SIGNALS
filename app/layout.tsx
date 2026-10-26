import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "GOLD / BTC Trade Signals - MT5 bias, scalps and news alerts",
  description:
    "Live XAU/USD and crypto bias, rule-based signals from the BabyPips and Zerodha Varsity gold playbooks, ForexFactory news alerts 20 minutes ahead of every release.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-40 border-b border-[#1e2a3a] bg-[#06090f]/90 backdrop-blur">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <span className="inline-block h-3 w-3 rounded-full bg-[#e5b544]" />
              GOLD<span className="text-[#e5b544]">/</span>BTC Signals
            </Link>
            <nav className="flex items-center gap-4 text-sm text-slate-300">
              <Link href="/" className="hover:text-white">
                Desk
              </Link>
              <Link href="/research" className="hover:text-white">
                Research brief
              </Link>
              <Link href="/playbook" className="hover:text-white">
                Playbook
              </Link>
            </nav>
            <p className="ml-auto text-xs text-slate-500">
              Education and research only. Not financial advice.
            </p>
          </div>
        </header>
        {children}
        <footer className="mx-auto max-w-[1500px] px-4 py-10 text-xs leading-relaxed text-slate-500">
          <p>
            Signals are generated from the rules in the two study guides (BabyPips Path and Zerodha Varsity
            Path) applied to live candles. Win percentages are a transparent confluence model, not a
            backtested edge and not a promise. Trading leveraged gold can lose more than you expect; the
            guides&apos; own position-sizing and daily-loss rules come first.
          </p>
          <p className="mt-2">
            India note: under FEMA rules, residents may trade currency and commodity derivatives only on
            recognised Indian exchanges. MCX gold futures through a SEBI-registered broker is the regulated
            route; offshore XAU/USD CFDs are not.
          </p>
        </footer>
      </body>
    </html>
  );
}
