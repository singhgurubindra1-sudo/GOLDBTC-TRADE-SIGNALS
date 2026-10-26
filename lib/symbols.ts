export type SymbolSpec = {
  /** Internal key, also what the MT5 ticket shows. */
  key: string;
  label: string;
  /** TradingView symbol for the live chart widget. */
  tv: string;
  /** Other TradingView feeds for the same market, if the default one does not load. */
  tvAlternatives?: string[];
  /** Yahoo Finance ticker (primary data feed). */
  yahoo: string;
  /** Stooq ticker (fallback feed). */
  stooq?: string;
  /** Binance ticker for crypto. */
  binance?: string;
  /** Currencies whose news moves this instrument. */
  currencies: string[];
  /** Price decimals. */
  digits: number;
  /** Contract size per 1.00 lot, used by the position-size calculator. */
  contractSize: number;
  unit: string;
  kind: "metal" | "fx" | "crypto" | "index";
  /** Treated as the headline instrument of the dashboard. */
  primary?: boolean;
};

export const SYMBOLS: SymbolSpec[] = [
  {
    key: "XAUUSD",
    label: "Gold / USD",
    tv: "OANDA:XAUUSD",
    tvAlternatives: ["FOREXCOM:XAUUSD", "FX_IDC:XAUUSD", "CAPITALCOM:GOLD", "TVC:GOLD", "COMEX:GC1!"],
    yahoo: "XAUUSD=X",
    stooq: "xauusd",
    currencies: ["USD", "ALL"],
    digits: 2,
    contractSize: 100,
    unit: "oz",
    kind: "metal",
    primary: true,
  },
  {
    key: "BTCUSD",
    label: "Bitcoin / USD",
    tv: "BINANCE:BTCUSDT",
    tvAlternatives: ["COINBASE:BTCUSD", "BITSTAMP:BTCUSD", "CRYPTO:BTCUSD"],
    yahoo: "BTC-USD",
    binance: "BTCUSDT",
    currencies: ["USD"],
    digits: 1,
    contractSize: 1,
    unit: "BTC",
    kind: "crypto",
  },
  {
    key: "XAGUSD",
    label: "Silver / USD",
    tv: "OANDA:XAGUSD",
    tvAlternatives: ["FOREXCOM:XAGUSD", "CAPITALCOM:SILVER", "TVC:SILVER"],
    yahoo: "XAGUSD=X",
    stooq: "xagusd",
    currencies: ["USD"],
    digits: 3,
    contractSize: 5000,
    unit: "oz",
    kind: "metal",
  },
  {
    key: "EURUSD",
    label: "Euro / USD",
    tv: "OANDA:EURUSD",
    yahoo: "EURUSD=X",
    stooq: "eurusd",
    currencies: ["EUR", "USD"],
    digits: 5,
    contractSize: 100000,
    unit: "units",
    kind: "fx",
  },
  {
    key: "GBPUSD",
    label: "Pound / USD",
    tv: "OANDA:GBPUSD",
    yahoo: "GBPUSD=X",
    stooq: "gbpusd",
    currencies: ["GBP", "USD"],
    digits: 5,
    contractSize: 100000,
    unit: "units",
    kind: "fx",
  },
  {
    key: "USDJPY",
    label: "USD / Yen",
    tv: "OANDA:USDJPY",
    yahoo: "USDJPY=X",
    stooq: "usdjpy",
    currencies: ["USD", "JPY"],
    digits: 3,
    contractSize: 100000,
    unit: "units",
    kind: "fx",
  },
  {
    key: "AUDUSD",
    label: "Aussie / USD",
    tv: "OANDA:AUDUSD",
    yahoo: "AUDUSD=X",
    stooq: "audusd",
    currencies: ["AUD", "USD"],
    digits: 5,
    contractSize: 100000,
    unit: "units",
    kind: "fx",
  },
  {
    key: "USDCAD",
    label: "USD / Loonie",
    tv: "OANDA:USDCAD",
    yahoo: "USDCAD=X",
    stooq: "usdcad",
    currencies: ["USD", "CAD"],
    digits: 5,
    contractSize: 100000,
    unit: "units",
    kind: "fx",
  },
  {
    key: "DXY",
    label: "Dollar Index",
    tv: "TVC:DXY",
    tvAlternatives: ["CAPITALCOM:DXY", "ICEUS:DX1!"],
    yahoo: "DX-Y.NYB",
    currencies: ["USD"],
    digits: 3,
    contractSize: 1,
    unit: "index",
    kind: "index",
  },
];

export const PRIMARY_SYMBOL = "XAUUSD";

export function getSymbol(key: string): SymbolSpec | undefined {
  return SYMBOLS.find((s) => s.key.toUpperCase() === key.toUpperCase());
}

/** Which instruments a currency's news release can move. */
export function pairsForCurrency(currency: string): string[] {
  const cur = currency.toUpperCase();
  const hits = SYMBOLS.filter((s) => s.key.includes(cur) || s.currencies.includes(cur)).map((s) => s.key);
  if (cur === "USD") {
    // Every instrument here is quoted in dollars, so USD news moves all of them.
    return SYMBOLS.map((s) => s.key);
  }
  return hits.length ? hits : [];
}
