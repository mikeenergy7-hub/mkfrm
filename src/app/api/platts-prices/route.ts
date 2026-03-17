/**
 * S&P Global Commodity Insights (Platts) price proxy
 *
 * Endpoints confirmed from official spgci-python SDK (github.com/spgi-ci/spgci-python):
 *   Auth:   POST https://api.platts.com/auth/api           (form-encoded: username + password)
 *   Prices: GET  https://api.platts.com/market-data/v3/value/current?symbol=XXX,YYY&pageSize=N
 *
 * GET /api/platts-prices → { ok, prices, units, latestDate, symbolCount }
 */

import { NextResponse } from "next/server";
import { storeGet } from "@/lib/store";

const BASE_URL  = "https://api.platts.com";
const AUTH_URL  = `${BASE_URL}/auth/api`;
// Confirmed from official spgci-python SDK: market-data/v3/value/current/symbol
const PRICE_URL = `${BASE_URL}/market-data/v3/value/current/symbol`;

// Every symbol used by Dashboard + PnL Tracker
const SYMBOLS = [
  // Naphtha
  "PAAAA00","PAAAD00","PAAAP00","PAAAQ00","PAAAR00",
  "AAPKA00","AAPLD00","NAGFM00","NAGFM01","NAGFM02",
  // MOPJ
  "RAXFM00","AAXFE00","AAXFF00",
  // Gasoline 92
  "PGAEY00","PGAEZ00","AAXEK00","AAXEL00","AAXEM00",
  // Gasoil
  "AAOVC00","AAOVC01","AACUE00","AACUE01",
  // Fuel Oil
  "PUABE00","PUADV00","PUAXZ00","PUAYF00",
  "AAIDC00","PPXDK00","AAPKB00","AAPKC00","AAPKD00",
  "AAPML00","PPXDM00","AMFSA00",
  // Gasoline Med
  "AAWZA00","ABWFB00","ABWFC00","ABWFD00",
  // Additional
  "AAFEX00","AAPLF00",
];

// ── Credentials ────────────────────────────────────────────────────────────
async function loadCredentials() {
  const saved = await storeGet<{ email: string; password: string }>("platts-settings");
  if (saved?.email) return saved;
  return {
    email:    process.env.PLATTS_EMAIL    || "",
    password: process.env.PLATTS_PASSWORD || "",
  };
}

// ── In-memory token cache ────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(username: string, password: string): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  // Auth uses application/x-www-form-urlencoded (confirmed from official SDK)
  const body = new URLSearchParams({ username, password });

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":   "mkfrm/1.0",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error(`No access_token in auth response: ${JSON.stringify(data).slice(0, 200)}`);

  cachedToken = data.access_token as string;
  tokenExpiry = Date.now() + 55 * 60 * 1000; // cache 55 min (token valid 1 hr)
  return cachedToken;
}

// ── Fetch current prices ─────────────────────────────────────────────────────
// Fetch one batch, recursively stripping unsubscribed symbols until we get a 200 or exhaust all
async function fetchBatch(
  token: string,
  symbols: string[],
  accumulated: string[] = [],
): Promise<{ items: unknown[]; unsubscribed: string[] }> {
  if (!symbols.length) return { items: [], unsubscribed: accumulated };

  const filterExpr = `symbol in (${symbols.map(s => `"${s}"`).join(",")})`;
  const params     = new URLSearchParams({ filter: filterExpr, pageSize: "5000" });

  const res = await fetch(`${PRICE_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });

  if (res.ok) {
    const data = await res.json();
    return { items: data.results ?? (Array.isArray(data) ? data : []), unsubscribed: accumulated };
  }

  const text = await res.text();

  if (res.status === 401) { cachedToken = null; throw new Error("Auth expired, please retry"); }

  // 400 with "Unsubscribed" → parse unsubscribed from response, strip, retry
  if (res.status === 400 && text.includes("Unsubscribed")) {
    let cause = text;
    try { cause = JSON.parse(text)?.cause ?? text; } catch (_) { /* keep raw */ }
    const match = cause.match(/Unsubscribed symbols?:\s*([A-Z0-9,\s]+)/i);
    const newUnsub = match
      ? match[1].split(/[,\s]+/).map(s => s.trim()).filter(Boolean)
      : symbols; // if we can't parse the list, treat all as unsubscribed

    const allUnsub  = [...new Set([...accumulated, ...newUnsub])];
    const remaining = symbols.filter(s => !allUnsub.includes(s));
    return fetchBatch(token, remaining, allUnsub);
  }

  // 500 after already stripping → API couldn't serve remaining symbols either
  // Treat all remaining as unavailable so we return partial results gracefully
  if (res.status === 500 && accumulated.length > 0) {
    return { items: [], unsubscribed: [...accumulated, ...symbols] };
  }

  throw new Error(`Price fetch failed (${res.status}): ${text.slice(0, 400)}`);
}

async function fetchCurrentPrices(token: string) {
  const BATCH = 50;
  const results: Record<string, { value: number; uom: string; date: string }> = {};
  const allUnsubscribed: string[] = [];

  for (let i = 0; i < SYMBOLS.length; i += BATCH) {
    const batch = SYMBOLS.slice(i, i + BATCH);
    const { items, unsubscribed } = await fetchBatch(token, batch);
    allUnsubscribed.push(...unsubscribed);

    // SDK response: { results: [{ symbol, data: [{ value, assessDate, uom }] }] }
    type RawItem = {
      symbol?: string;
      data?: Array<{ value?: number | string; assessDate?: string; uom?: string }>;
      value?: number | string; assessDate?: string; uom?: string;
    };

    for (const item of items as RawItem[]) {
      const sym = item.symbol;
      if (!sym) continue;

      if (Array.isArray(item.data) && item.data.length > 0) {
        for (const d of item.data) {
          const dt  = d.assessDate ?? "";
          const val = parseFloat(String(d.value ?? ""));
          const uom = d.uom ?? "";
          if (isNaN(val)) continue;
          if (!results[sym] || dt > results[sym].date) results[sym] = { value: val, uom, date: dt };
        }
      } else {
        const dt  = item.assessDate ?? "";
        const val = parseFloat(String(item.value ?? ""));
        const uom = item.uom ?? "";
        if (!isNaN(val) && (!results[sym] || dt > results[sym].date)) {
          results[sym] = { value: val, uom, date: dt };
        }
      }
    }
  }

  return { results, unsubscribed: allUnsubscribed };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET() {
  const creds = await loadCredentials();
  const { email, password } = creds;

  if (!email || !password || email.includes("example.com")) {
    return NextResponse.json({
      ok:    false,
      error: "Platts credentials not set — click ⚙ in the header to enter your username and password",
    }, { status: 400 });
  }

  try {
    // S&P Global uses the email address as the username
    const token = await getToken(email, password);
    const { results: raw, unsubscribed } = await fetchCurrentPrices(token);

    const prices: Record<string, number> = {};
    const units:  Record<string, string> = {};
    let   latestDate = "";

    for (const [sym, { value, uom, date }] of Object.entries(raw)) {
      prices[sym] = value;
      units[sym]  = uom;
      if (date > latestDate) latestDate = date;
    }

    const symbolCount = Object.keys(prices).length;

    if (symbolCount === 0) {
      return NextResponse.json({
        ok:    false,
        error: `Your Platts API subscription doesn't include any of the symbols used by this app (${unsubscribed.length} symbols unsubscribed). Please use CSV upload instead, or contact your S&P Global account manager to enable API access for these symbols.`,
        unsubscribed,
      }, { status: 200 }); // 200 so the UI shows the message rather than a network error
    }

    return NextResponse.json({
      ok: true, prices, units, latestDate, symbolCount,
      unsubscribedCount: unsubscribed.length,
      ...(unsubscribed.length > 0 ? { warning: `${unsubscribed.length} symbols not in your subscription were skipped` } : {}),
    });
  } catch (err: unknown) {
    cachedToken = null;
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
