import React, { useMemo, useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

// ============================================================
// GLOBAL IMPORT–EXPORT PRICE DASHBOARD (LIVE API VERSION)
// ------------------------------------------------------------
// This file contains TWO parts:
// 1) <GlobalTradePriceDashboard /> – React UI that fetches from /api/prices
// 2) API EXAMPLE for Next.js: /pages/api/prices.ts – normalizes providers
//    You can paste the API code into your Next.js app, or adapt to Express.
// ------------------------------------------------------------
// SCHEMA returned by the API (array of rows):
// {
//   date: string (YYYY-MM-DD),
//   product: string,
//   unit: string,            // e.g., "USD/MT"
//   price: number,
//   currency: string,        // e.g., "USD"
//   incoterm: string,        // e.g., "FOB Lagos", "CIF Dubai"
//   region: string,          // e.g., "Asia"
//   country: string,         // e.g., "India"
//   source: string           // label of the provider
// }
// ============================================================

// ========= FRONTEND: React Dashboard =========
export default function GlobalTradePriceDashboard() {
  const [rows, setRows] = useState([] as any[]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [product, setProduct] = useState("All");
  const [region, setRegion] = useState("All");
  const [country, setCountry] = useState("All");
  const [incoterm, setIncoterm] = useState("All");
  const [currency, setCurrency] = useState("USD");

  // Fetch from your API (poll every 5 minutes)
  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/prices");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (mounted) setRows(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (mounted) setError(e.message || "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    const id = setInterval(fetchData, 5 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const products = useMemo(() => ["All", ...uniq(rows.map((r) => r.product))], [rows]);
  const regions = useMemo(() => ["All", ...uniq(rows.map((r) => r.region))], [rows]);
  const countries = useMemo(() => ["All", ...uniq(rows.map((r) => r.country))], [rows]);
  const incoterms = useMemo(() => ["All", ...uniq(rows.map((r) => r.incoterm))], [rows]);

  const filtered = useMemo(() => {
    return rows
      .filter((r) => (product === "All" ? true : r.product === product))
      .filter((r) => (region === "All" ? true : r.region === region))
      .filter((r) => (country === "All" ? true : r.country === country))
      .filter((r) => (incoterm === "All" ? true : r.incoterm === incoterm))
      .map((r) => ({ ...r, dateObj: new Date(r.date) }))
      .sort((a, b) => a.dateObj - b.dateObj);
  }, [rows, product, region, country, incoterm]);

  const kpis = useMemo(() => {
    if (!filtered.length) return { last: 0, mom: 0, avg: 0, min: 0, max: 0 };
    const last = filtered[filtered.length - 1].price;
    const prev = filtered[filtered.length - 2]?.price ?? last;
    const mom = last && prev ? ((last - prev) / prev) * 100 : 0;
    const prices = filtered.map((r) => r.price);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return { last, mom, avg, min, max };
  }, [filtered]);

  const series = useMemo(() => {
    const byDate = new Map<string, any>();
    filtered.forEach((r) => {
      const key = r.date;
      if (!byDate.has(key)) byDate.set(key, { date: key });
      byDate.get(key)[r.product] = r.price;
    });
    return Array.from(byDate.values()).sort((a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime());
  }, [filtered]);

  const regionalBars = useMemo(() => {
    const latestDate = filtered[filtered.length - 1]?.date;
    if (!latestDate) return [] as any[];
    const latestRows = filtered.filter((r) => r.date === latestDate);
    const map = new Map<string, { region: string; price: number; n: number }>();
    latestRows.forEach((r) => {
      if (!map.has(r.region)) map.set(r.region, { region: r.region, price: 0, n: 0 });
      const obj = map.get(r.region)!;
      obj.price += r.price;
      obj.n += 1;
    });
    return Array.from(map.values()).map((x) => ({ region: x.region, price: x.price / x.n }));
  }, [filtered]);

  return (
    <div className="min-h-screen w-full bg-[#0b1b13] text-[#eef5ef] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 md:mb-8">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">Global Import–Export Price Dashboard</h1>
          <p className="text-[#cfe2d2] mt-2">Live data from your API. Filter by product, region, country, and incoterms.</p>
          {loading && <div className="mt-3 text-sm">Loading latest prices…</div>}
          {error && <div className="mt-3 text-sm text-red-300">Error: {error}</div>}
        </header>

        {/* Controls */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 mb-6">
          <Select label="Product" value={product} onChange={setProduct} options={products} className="lg:col-span-3" />
          <Select label="Region" value={region} onChange={setRegion} options={regions} className="lg:col-span-3" />
          <Select label="Country" value={country} onChange={setCountry} options={countries} className="lg:col-span-3" />
          <Select label="Incoterm" value={incoterm} onChange={setIncoterm} options={incoterms} className="lg:col-span-3" />
        </section>

        {/* KPI Cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <KPI title="Last Price" value={formatCurrency(kpis.last, currency)} />
          <KPI title="MoM Change" value={`${kpis.mom.toFixed(2)}%`} />
          <KPI title="Avg Price" value={formatCurrency(kpis.avg, currency)} />
          <KPI title="Range" value={`${formatCurrency(kpis.min, currency)} – ${formatCurrency(kpis.max, currency)}`} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <Card className="lg:col-span-2">
            <CardHeader title="Price Trend (by Product)" subtitle="Hover to see exact values" />
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
                  <XAxis dataKey="date" stroke="#cfe2d2" />
                  <YAxis stroke="#cfe2d2" />
                  <Tooltip contentStyle={{ background: "#12251a", border: "1px solid rgba(255,255,255,.1)", color: "#eef5ef" }} />
                  <Legend />
                  {uniq(filtered.map((r) => r.product)).map((p) => (
                    <Line key={p} type="monotone" dataKey={p} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <CardHeader title="Latest by Region" subtitle="Average of latest month" />
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionalBars} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
                  <XAxis dataKey="region" stroke="#cfe2d2" />
                  <YAxis stroke="#cfe2d2" />
                  <Tooltip contentStyle={{ background: "#12251a", border: "1px solid rgba(255,255,255,.1)", color: "#eef5ef" }} />
                  <Bar dataKey="price" fill="#2ecc71" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Price Records" subtitle={`${filtered.length} rows`} />
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-left">
                  {["date","product","unit","price","currency","incoterm","region","country","source"].map((h) => (
                    <th key={h} className="px-3 py-3 font-semibold capitalize text-[#cfe2d2]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <tr key={idx} className={idx % 2 ? "bg-white/0" : "bg-white/5"}>
                    <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                    <td className="px-3 py-2">{r.product}</td>
                    <td className="px-3 py-2">{r.unit}</td>
                    <td className="px-3 py-2">{formatCurrency(r.price, r.currency)}</td>
                    <td className="px-3 py-2">{r.currency}</td>
                    <td className="px-3 py-2">{r.incoterm}</td>
                    <td className="px-3 py-2">{r.region}</td>
                    <td className="px-3 py-2">{r.country}</td>
                    <td className="px-3 py-2">{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <section className="mt-8 text-xs text-[#cfe2d2]">
          <p className="opacity-80">API expected at <code>/api/prices</code>. See the Next.js route example below.</p>
        </section>
      </div>
    </div>
  );
}

// ===== Helpers / UI bits =====
const formatCurrency = (v: number, c = "USD") => new Intl.NumberFormat(undefined, { style: "currency", currency: c, maximumFractionDigits: 2 }).format(Number(v) || 0);
const uniq = (arr: any[]) => Array.from(new Set(arr.filter(Boolean)));

function Card({ children, className = "" }: any) {
  return <div className={`bg-[#12251a] border border-white/10 rounded-2xl shadow-xl ${className}`}>{children}</div>;
}
function CardHeader({ title, subtitle }: any) {
  return (
    <div className="px-4 md:px-6 pt-4 md:pt-5 pb-2 border-b border-white/10">
      <h3 className="text-lg md:text-xl font-bold">{title}</h3>
      {subtitle && <p className="text-[#cfe2d2] text-xs md:text-sm mt-1">{subtitle}</p>}
    </div>
  );
}
function KPI({ title, value }: any) {
  return (
    <div className="bg-[#12251a] border border-white/10 rounded-2xl p-4 md:p-5">
      <div className="text-[#cfe2d2] text-xs uppercase tracking-wide">{title}</div>
      <div className="text-2xl md:text-3xl font-extrabold mt-1">{value}</div>
    </div>
  );
}
function Select({ label, value, onChange, options, className = "" }: any) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs text-[#cfe2d2] mb-1">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-[#12251a] border border-white/10 rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-[#2ecc71]">
        {options.map((opt: string) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </label>
  );
}

// ============================================================
// ===== BACKEND: Next.js API Route Example (TypeScript) =====
// Save as: /pages/api/prices.ts (Next.js 12/13 pages router)
// Or adapt to /app/api/prices/route.ts (Next.js 13+ app router)
// ENV VARS required (add to .env.local):
//   COMTRADE_TOKEN=xxxxx           // UN Comtrade API token (optional)
//   USDA_TOKEN=xxxxx               // USDA AMS token (optional)
//   FAOSTAT_TOKEN=xxxxx            // FAOSTAT if needed (optional)
// Notes: Uncomment providers you want, map their payloads to schema.
// ============================================================

/*
import type { NextApiRequest, NextApiResponse } from 'next';

// Simple in-memory cache (restart-safe caching can use Redis/Upstash)
let CACHE: { data: any[]; ts: number } = { data: [], ts: 0 };
const TTL_MS = 30 * 60 * 1000; // 30 minutes

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Serve from cache if fresh
    const now = Date.now();
    if (CACHE.data.length && now - CACHE.ts < TTL_MS) {
      res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=300');
      return res.status(200).json(CACHE.data);
    }

    // --- Collect from providers (add/remove as needed) ---
    const results: any[] = [];

    // 1) UN Comtrade (example: HS code 0713 – legumes; adapt for your HS codes)
    // const comtrade = await fetchComtrade({ token: process.env.COMTRADE_TOKEN!, reporter: 'Nigeria', partner: 'India', hs: '0713', period: '202501' });
    // results.push(...comtrade);

    // 2) USDA AMS (example: beef, grains — depending on series)
    // const usda = await fetchUsdaAms({ token: process.env.USDA_TOKEN!, commodity: 'beef' });
    // results.push(...usda);

    // 3) Your internal sheets/DB (Google Sheets CSV, Airtable, Supabase)
    // const sheetRows = await fetchCsv('https://YOUR_PUBLISHED_SHEET_URL.csv');
    // results.push(...sheetRows);

    // Fallback/demo data if providers are not configured (remove in prod)
    if (!results.length) {
      results.push(
        { date: '2025-07-01', product: 'Cassia Tora (Split)', unit: 'USD/MT', price: 220, currency: 'USD', incoterm: 'FOB Lagos', region: 'Asia', country: 'India', source: 'Demo' },
        { date: '2025-08-01', product: 'Cassia Tora (Split)', unit: 'USD/MT', price: 255, currency: 'USD', incoterm: 'FOB Lagos', region: 'Asia', country: 'India', source: 'Demo' },
        { date: '2025-09-01', product: 'Cassia Tora (Split)', unit: 'USD/MT', price: 275, currency: 'USD', incoterm: 'FOB Lagos', region: 'Asia', country: 'India', source: 'Demo' },
        { date: '2025-09-01', product: 'Sugar ICUMSA-45', unit: 'USD/MT', price: 510, currency: 'USD', incoterm: 'CIF Dubai', region: 'Middle East', country: 'UAE', source: 'Demo' },
        { date: '2025-09-01', product: 'Yellow Corn Powder', unit: 'USD/MT', price: 260, currency: 'USD', incoterm: 'FOB Nigeria', region: 'Africa', country: 'Nigeria', source: 'Demo' },
        { date: '2025-09-01', product: 'Beef 10ppm', unit: 'USD/MT', price: 3960, currency: 'USD', incoterm: 'CIF KSA', region: 'Middle East', country: 'Saudi Arabia', source: 'Demo' },
      );
    }

    // Cache & send
    CACHE = { data: results, ts: now };
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=300');
    return res.status(200).json(results);
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}

// ------- Provider helpers (examples) -------
async function fetchComtrade({ token, reporter, partner, hs, period }: { token: string; reporter: string; partner: string; hs: string; period: string; }) {
  // Docs: https://comtradeplus.un.org/ (v1)
  const url = `https://comtradeplus.un.org/api/v1/getHS?reporter=${encodeURIComponent(reporter)}&partner=${encodeURIComponent(partner)}&period=${period}&cmdCode=${hs}&flow=Export&token=${token}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Comtrade ${res.status}`);
  const json = await res.json();
  // Map to schema (you must choose price fields / unit normalization based on series)
  const rows = (json?.dataset || []).map((d: any) => ({
    date: String(d.period) + '-01',
    product: d.cmdDescE || 'Commodity',
    unit: 'USD/MT', // TODO: derive if provided
    price: Number(d.primaryValue) || 0, // Example – often VALUE not directly price; you may divide by quantity
    currency: 'USD',
    incoterm: 'FOB',
    region: d.ptTitle || 'Global',
    country: d.ptTitle || 'Global',
    source: 'UN Comtrade',
  }));
  return rows;
}

async function fetchUsdaAms({ token, commodity }: { token: string; commodity: string; }) {
  // Example endpoint (adjust to your target series)
  const url = `https://api.ams.usda.gov/services/v1/markets/commodity/${encodeURIComponent(commodity)}?api_key=${token}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`USDA AMS ${res.status}`);
  const json = await res.json();
  // Map to schema – you will need to align fields
  const rows = (json?.results || []).map((r: any) => ({
    date: r.report_date?.slice(0,10) || '2025-01-01',
    product: r.commodity || commodity,
    unit: r.unit || 'USD/MT',
    price: Number(r.price) || 0,
    currency: 'USD',
    incoterm: 'CIF/FOB',
    region: r.region || 'US',
    country: r.country || 'US',
    source: 'USDA AMS',
  }));
  return rows;
}

async function fetchCsv(csvUrl: string) {
  const res = await fetch(csvUrl);
  if (!res.ok) throw new Error(`CSV ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split(/?
/);
  const header = lines.shift()!.split(',').map((h) => h.trim());
  return lines.map((line) => {
    const cols = line.split(',').map((c) => c.trim());
    const o: any = Object.fromEntries(header.map((h, i) => [h, cols[i] ?? '']));
    o.price = Number(o.price);
    return o;
  });
}
*/
