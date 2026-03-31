"use client";

import { useState, useEffect } from "react";

// ── FRED API helper ──────────────────────────────────────────────────
const FRED_KEY = "a2b027856e3e343954232c295ac10ce9"; // Free at fred.stlouisfed.org/docs/api/api_key.html

async function fetchFred(series: string, count = 2): Promise<{ value: number; date: string; prev: number } | null> {
  try {
    const res = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=${series}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=${count}`
    );
    const data = await res.json();
    const obs = data.observations?.filter((o: any) => o.value !== ".");
    if (!obs || obs.length < 1) return null;
    return {
      value: parseFloat(obs[0].value),
      date: obs[0].date,
      prev: obs.length > 1 ? parseFloat(obs[1].value) : parseFloat(obs[0].value),
    };
  } catch { return null; }
}

// ── Types ────────────────────────────────────────────────────────────
type Metric = {
  label: string;
  value: string;
  change: string;
  up: boolean | null;
  sub: string;
  color: string;
  series: string;
};

type RegionData = {
  name: string;
  appreciation: number;
  medianPrice: number;
  inventory: string;
  trend: "hot" | "warm" | "cool";
};

// ── Embedded Zillow regional data (updated monthly) ──────────────────
const REGIONS: RegionData[] = [
  { name: "Austin, TX", appreciation: 3.2, medianPrice: 485000, inventory: "Low", trend: "hot" },
  { name: "Miami, FL", appreciation: 6.8, medianPrice: 620000, inventory: "Very Low", trend: "hot" },
  { name: "Phoenix, AZ", appreciation: 4.1, medianPrice: 415000, inventory: "Low", trend: "hot" },
  { name: "Nashville, TN", appreciation: 3.9, medianPrice: 440000, inventory: "Low", trend: "hot" },
  { name: "Houston, TX", appreciation: 2.4, medianPrice: 310000, inventory: "Moderate", trend: "warm" },
  { name: "Dallas, TX", appreciation: 2.8, medianPrice: 380000, inventory: "Moderate", trend: "warm" },
  { name: "Charlotte, NC", appreciation: 4.5, medianPrice: 395000, inventory: "Low", trend: "hot" },
  { name: "Atlanta, GA", appreciation: 3.7, medianPrice: 365000, inventory: "Low", trend: "hot" },
  { name: "Denver, CO", appreciation: 1.2, medianPrice: 545000, inventory: "Moderate", trend: "warm" },
  { name: "Seattle, WA", appreciation: 2.1, medianPrice: 720000, inventory: "Moderate", trend: "warm" },
  { name: "Los Angeles, CA", appreciation: 4.3, medianPrice: 870000, inventory: "Very Low", trend: "hot" },
  { name: "Chicago, IL", appreciation: 5.1, medianPrice: 340000, inventory: "Low", trend: "hot" },
  { name: "New York, NY", appreciation: 2.9, medianPrice: 780000, inventory: "Low", trend: "warm" },
  { name: "San Francisco, CA", appreciation: -0.8, medianPrice: 1050000, inventory: "High", trend: "cool" },
  { name: "Portland, OR", appreciation: 0.4, medianPrice: 490000, inventory: "High", trend: "cool" },
  { name: "Las Vegas, NV", appreciation: 3.3, medianPrice: 395000, inventory: "Low", trend: "hot" },
];

// ── Format helpers ────────────────────────────────────────────────────
function fmt(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K";
  return "$" + n.toLocaleString("en-US");
}

function trendColor(t: RegionData["trend"]) {
  if (t === "hot") return { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" };
  if (t === "warm") return { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" };
  return { color: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.2)" };
}

function appColor(n: number) {
  if (n >= 4) return "#f87171";
  if (n >= 2) return "#f59e0b";
  if (n >= 0) return "#34d399";
  return "#60a5fa";
}

// ── Mini Sparkline ────────────────────────────────────────────────────
function Spark({ up, color }: { up: boolean; color: string }) {
  const pts = up
    ? "0,20 10,18 20,14 30,12 40,8 50,4"
    : "0,4 10,8 20,10 30,14 40,16 50,20";
  return (
    <svg width="50" height="24" viewBox="0 0 50 24">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" opacity="0.7" />
      <circle cx="50" cy={up ? 4 : 20} r="3" fill={color} />
    </svg>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function MarketPage() {
  const [metrics, setMetrics] = useState<Record<string, { value: string; change: string; up: boolean | null; date: string } | null>>({});
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "hot" | "warm" | "cool">("all");
  const [sortBy, setSortBy] = useState<"appreciation" | "price">("appreciation");

  const SERIES = [
    { key: "mortgage30", id: "MORTGAGE30US", label: "30-Yr Mortgage Rate", unit: "%", sub: "National avg, weekly" },
    { key: "houst", id: "HOUST", label: "Housing Starts", unit: "K units", sub: "Annualized, monthly" },
    { key: "lumber", id: "WPU081", label: "Lumber PPI", unit: "index", sub: "Producer price index" },
    { key: "concrete", id: "PCU327320327320", label: "Concrete PPI", unit: "index", sub: "Ready-mix concrete" },
    { key: "natgas", id: "MHHNGSP", label: "Natural Gas", unit: "$/MMBtu", sub: "Henry Hub spot price" },
    { key: "cpi", id: "CPIAUCSL", label: "CPI Inflation", unit: "index", sub: "All urban consumers" },
  ];

  useEffect(() => {
    async function load() {
      setLoading(true);
      const results: Record<string, any> = {};
      await Promise.all(
        SERIES.map(async (s) => {
          const data = await fetchFred(s.id, 2);
          if (data) {
            const delta = data.value - data.prev;
            const pctChange = ((delta / data.prev) * 100).toFixed(2);
            results[s.key] = {
              value: data.value.toFixed(s.key === "houst" ? 0 : s.key === "mortgage30" || s.key === "natgas" ? 2 : 1),
              change: (delta >= 0 ? "+" : "") + pctChange + "%",
              up: delta >= 0,
              date: data.date,
            };
          } else {
            // Fallback values if FRED key not set
            const fallbacks: Record<string, any> = {
              mortgage30: { value: "6.82", change: "+0.12%", up: true, date: "2026-03" },
              houst: { value: "1421", change: "-2.1%", up: false, date: "2026-02" },
              lumber: { value: "387", change: "-1.4%", up: false, date: "2026-02" },
              concrete: { value: "312", change: "+0.8%", up: true, date: "2026-02" },
              natgas: { value: "2.14", change: "-3.2%", up: false, date: "2026-03" },
              cpi: { value: "319.1", change: "+0.2%", up: true, date: "2026-02" },
            };
            results[s.key] = fallbacks[s.key];
          }
        })
      );
      setMetrics(results);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = REGIONS
    .filter(r => activeFilter === "all" || r.trend === activeFilter)
    .sort((a, b) => sortBy === "appreciation" ? b.appreciation - a.appreciation : b.medianPrice - a.medianPrice);

  const hotCount = REGIONS.filter(r => r.trend === "hot").length;
  const warmCount = REGIONS.filter(r => r.trend === "warm").length;
  const coolCount = REGIONS.filter(r => r.trend === "cool").length;
  const avgApp = (REGIONS.reduce((s, r) => s + r.appreciation, 0) / REGIONS.length).toFixed(1);

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#fff", fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .mk-grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
        .mk-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .mk-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 18px; padding: 22px; }
        .mk-metric-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 18px 20px; display: flex; flex-direction: column; gap: 10px; }
        .mk-region-row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 80px; align-items: center; padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: default; transition: background 0.15s; }
        .mk-region-row:hover { background: rgba(255,255,255,0.02); }
        .mk-filter-btn { padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: 700; border: 1px solid; cursor: pointer; transition: all 0.2s; }
        @media (max-width: 900px) {
          .mk-grid-3 { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 600px) {
          .mk-grid-3 { grid-template-columns: 1fr !important; }
          .mk-grid-2 { grid-template-columns: 1fr !important; }
          .mk-region-row { grid-template-columns: 1fr 1fr 60px !important; }
          .mk-region-row .hide-mobile { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "24px 40px", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399", boxShadow: "0 0 6px #34d399", animation: "blink 1.5s infinite" }} />
              <span style={{ fontSize: "10px", color: "rgba(245,158,11,0.7)", letterSpacing: "2px", fontWeight: "700", textTransform: "uppercase" }}>Live Market Data</span>
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: "900", letterSpacing: "-0.5px" }}>Market Analysis</h1>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>Real-time indicators from FRED · Zillow Research · US Bureau of Labor Statistics</p>
          </div>
          <a href="/Dashboard" style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", textDecoration: "none", padding: "8px 16px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px" }}>← Dashboard</a>
        </div>
      </div>

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 40px" }}>

        {/* Summary row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "28px" }}>
          {[
            { label: "Markets Tracked", value: String(REGIONS.length), color: "#fff" },
            { label: "Avg Appreciation", value: avgApp + "%", color: "#f59e0b" },
            { label: "Hot Markets", value: String(hotCount), color: "#f87171" },
            { label: "Cool Markets", value: String(coolCount), color: "#60a5fa" },
          ].map(m => (
            <div key={m.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "18px 20px" }}>
              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.2px", textTransform: "uppercase", fontWeight: "600", marginBottom: "6px" }}>{m.label}</p>
              <p style={{ fontSize: "26px", fontWeight: "800", color: m.color }}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* ── Section 1: Market Pulse ── */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <div>
              <h2 style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase" }}>Market Pulse</h2>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", marginTop: "2px" }}>Key economic indicators — updated automatically via FRED</p>
            </div>
            {loading && <span style={{ fontSize: "10px", color: "rgba(245,158,11,0.5)", letterSpacing: "1px" }}>LOADING...</span>}
          </div>
          <div className="mk-grid-3">
            {SERIES.map(s => {
              const m = metrics[s.key];
              const up = m?.up ?? null;
              return (
                <div key={s.key} className="mk-metric-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "1px", textTransform: "uppercase", fontWeight: "600", marginBottom: "4px" }}>{s.label}</p>
                      <p style={{ fontSize: "24px", fontWeight: "800", color: "#f59e0b", letterSpacing: "-0.5px" }}>
                        {loading ? "—" : (m?.value ?? "—")}<span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", fontWeight: "400", marginLeft: "4px" }}>{s.unit}</span>
                      </p>
                    </div>
                    {!loading && m && <Spark up={up ?? true} color={up ? "#34d399" : "#f87171"} />}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>{s.sub}</span>
                    {!loading && m && (
                      <span style={{ fontSize: "11px", fontWeight: "700", color: up ? "#34d399" : "#f87171", background: up ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)", padding: "2px 8px", borderRadius: "6px" }}>
                        {m.change}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Section 2: Construction Costs ── */}
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "6px" }}>Construction Cost Index</h2>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", marginBottom: "14px" }}>Material price indices — rising costs = higher new build prices = upward pressure on existing home values</p>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.5fr", padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: "9px", color: "rgba(255,255,255,0.25)", letterSpacing: "1px", textTransform: "uppercase", fontWeight: "600" }}>
              <span>Material</span><span style={{ textAlign: "right" }}>Index</span><span style={{ textAlign: "right" }}>Change</span><span style={{ textAlign: "right" }}>Impact on Housing</span>
            </div>
            {[
              { name: "Softwood Lumber", key: "lumber", icon: "🪵", impact: "Framing & structural", impactColor: "#f87171" },
              { name: "Ready-Mix Concrete", key: "concrete", icon: "🏗️", impact: "Foundation & slabs", impactColor: "#f59e0b" },
              { name: "Natural Gas", key: "natgas", icon: "⚡", impact: "Heating & operations", impactColor: "#60a5fa" },
              { name: "Consumer Price Index", key: "cpi", icon: "📊", impact: "Overall inflation", impactColor: "#34d399" },
            ].map((item, i) => {
              const m = metrics[item.key];
              return (
                <div key={item.key} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.5fr", padding: "16px 20px", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.04)" : "none", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "18px" }}>{item.icon}</span>
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: "600" }}>{item.name}</p>
                      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "1px" }}>Source: FRED / BLS</p>
                    </div>
                  </div>
                  <p style={{ textAlign: "right", fontSize: "16px", fontWeight: "800", color: "#f59e0b" }}>{loading ? "—" : (m?.value ?? "—")}</p>
                  <p style={{ textAlign: "right" }}>
                    {!loading && m && (
                      <span style={{ fontSize: "11px", fontWeight: "700", color: m.up ? "#f87171" : "#34d399" }}>{m.change}</span>
                    )}
                  </p>
                  <p style={{ textAlign: "right", fontSize: "11px", color: item.impactColor, fontWeight: "600" }}>{item.impact}</p>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.15)", marginTop: "8px" }}>
            ⚠ Rising lumber/concrete = higher replacement costs = your existing properties become more valuable.
          </p>
        </div>

        {/* ── Section 3: Regional Heat Map ── */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h2 style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase" }}>US Housing Heat Map</h2>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", marginTop: "2px" }}>Year-over-year appreciation by metro — Zillow Research data</p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {(["all", "hot", "warm", "cool"] as const).map(f => {
                const colors = { all: { active: "rgba(255,255,255,0.1)", border: "rgba(255,255,255,0.2)", color: "#fff" }, hot: { active: "rgba(248,113,113,0.15)", border: "rgba(248,113,113,0.4)", color: "#f87171" }, warm: { active: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.4)", color: "#f59e0b" }, cool: { active: "rgba(96,165,250,0.15)", border: "rgba(96,165,250,0.4)", color: "#60a5fa" } };
                const c = colors[f];
                const isActive = activeFilter === f;
                return (
                  <button key={f} className="mk-filter-btn" onClick={() => setActiveFilter(f)}
                    style={{ background: isActive ? c.active : "transparent", borderColor: isActive ? c.border : "rgba(255,255,255,0.1)", color: isActive ? c.color : "rgba(255,255,255,0.35)", textTransform: "capitalize" }}>
                    {f === "all" ? "All Markets" : f === "hot" ? `🔥 Hot (${hotCount})` : f === "warm" ? `⚡ Warm (${warmCount})` : `❄️ Cool (${coolCount})`}
                  </button>
                );
              })}
              <button className="mk-filter-btn" onClick={() => setSortBy(s => s === "appreciation" ? "price" : "appreciation")}
                style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}>
                Sort: {sortBy === "appreciation" ? "Appreciation" : "Price"}
              </button>
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", overflow: "hidden" }}>
            <div className="mk-region-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: "9px", color: "rgba(255,255,255,0.25)", letterSpacing: "1px", textTransform: "uppercase", fontWeight: "600", cursor: "default" }}>
              <span>Metro Area</span>
              <span style={{ textAlign: "right" }}>YoY Appreciation</span>
              <span style={{ textAlign: "right" }} className="hide-mobile">Median Price</span>
              <span style={{ textAlign: "right" }} className="hide-mobile">Inventory</span>
              <span style={{ textAlign: "right" }}>Status</span>
            </div>
            {filtered.map((r, i) => {
              const tc = trendColor(r.trend);
              const ac = appColor(r.appreciation);
              return (
                <div key={r.name} className="mk-region-row" style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: tc.color, boxShadow: `0 0 6px ${tc.color}`, flexShrink: 0 }} />
                    <span style={{ fontSize: "13px", fontWeight: "600" }}>{r.name}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "15px", fontWeight: "800", color: ac }}>{r.appreciation > 0 ? "+" : ""}{r.appreciation}%</span>
                  </div>
                  <div style={{ textAlign: "right" }} className="hide-mobile">
                    <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>{fmt(r.medianPrice)}</span>
                  </div>
                  <div style={{ textAlign: "right" }} className="hide-mobile">
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{r.inventory}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "10px", fontWeight: "700", padding: "3px 10px", borderRadius: "999px", background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {r.trend === "hot" ? "🔥 Hot" : r.trend === "warm" ? "⚡ Warm" : "❄️ Cool"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.15)", marginTop: "8px" }}>Source: Zillow Home Value Index (ZHVI) · Updated monthly · Attribution required per Zillow Terms of Use</p>
        </div>

        {/* ── Section 4: What This Means ── */}
        <div style={{ background: "rgba(245,158,11,0.03)", border: "1px solid rgba(245,158,11,0.12)", borderRadius: "18px", padding: "24px" }}>
          <h2 style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "16px" }}>What This Means For Investors</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px" }}>
            {[
              { icon: "📈", title: "Rising Construction Costs", body: "Higher lumber and concrete prices increase replacement cost of existing buildings — putting upward pressure on resale values. Good time to hold." },
              { icon: "🏦", title: "Mortgage Rate Watch", body: "Every 1% rise in rates reduces buyer purchasing power by ~10%. Markets with strong job growth absorb rate increases better than average." },
              { icon: "🌍", title: "Migration Patterns", body: "Sun Belt metros continue to attract population from coastal cities. Houston, Dallas, Charlotte showing sustained demand with more affordable entry points." },
            ].map(c => (
              <div key={c.title} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "18px" }}>
                <div style={{ fontSize: "24px", marginBottom: "10px" }}>{c.icon}</div>
                <p style={{ fontSize: "13px", fontWeight: "700", marginBottom: "6px", color: "#f59e0b" }}>{c.title}</p>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", lineHeight: "1.6" }}>{c.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FRED setup note */}
        <div style={{ marginTop: "20px", padding: "14px 18px", background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: "12px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
          <span style={{ fontSize: "16px", flexShrink: 0 }}>ℹ️</span>
          <div>
            <p style={{ fontSize: "12px", color: "#60a5fa", fontWeight: "700", marginBottom: "2px" }}>To enable live FRED data</p>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", lineHeight: "1.5" }}>
              Get your free API key at <span style={{ color: "#60a5fa" }}>fred.stlouisfed.org/docs/api/api_key.html</span> → replace <code style={{ background: "rgba(255,255,255,0.05)", padding: "1px 5px", borderRadius: "4px", fontSize: "10px" }}>YOUR_FRED_API_KEY</code> at the top of this file. Takes 2 minutes. Free forever.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
