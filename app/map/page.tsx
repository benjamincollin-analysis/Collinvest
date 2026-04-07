"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "../../lib/supabase";

type OccupancyStatus = "occupied" | "vacant" | "planned" | "sold" | "str";

type Property = {
  id: number;
  name: string;
  type: string;
  value: number;
  mortgage: number;
  rent: number;
  expenses: number;
  occupancyStatus: OccupancyStatus;
  plannedDate: string;
  appreciation: number;
  lat: number;
  lng: number;
  address: string;
  occupancyPct: number;
  soldPrice: number;
  soldDate: string;
  groupTag: string;
};

function fmt(n: number) { if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M"; if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K"; return "$" + n.toLocaleString("en-US"); }
function fmtFull(n: number) { return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US"); }

function propCashFlow(p: Property) {
  if (p.occupancyStatus === "sold") return 0;
  if (p.occupancyStatus === "str") return p.rent * ((p.occupancyPct ?? 100) / 100) - p.expenses;
  if (p.occupancyStatus === "occupied") return p.rent - p.expenses;
  return -p.expenses;
}

function occupancyColor(status: OccupancyStatus) {
  if (status === "occupied") return { color: "#34d399", label: "Occupied", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)" };
  if (status === "vacant") return { color: "#f87171", label: "Vacant", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" };
  if (status === "sold") return { color: "#ffd700", label: "Sold", bg: "rgba(255,215,0,0.08)", border: "rgba(255,215,0,0.2)" };
  if (status === "str") return { color: "#e879f9", label: "STR", bg: "rgba(232,121,249,0.08)", border: "rgba(232,121,249,0.2)" };
  return { color: "#60a5fa", label: "Planned", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.2)" };
}

function fromDb(row: any): Property {
  return {
    id: row.id, name: row.name, type: row.type, value: row.value,
    mortgage: row.mortgage, rent: row.rent, expenses: row.expenses,
    occupancyStatus: row.occupancy_status, plannedDate: row.planned_date || "",
    appreciation: row.appreciation, lat: row.lat, lng: row.lng,
    address: row.address || "", occupancyPct: row.occupancy_pct ?? 100,
    soldPrice: row.sold_price ?? 0, soldDate: row.sold_date ?? "",
    groupTag: row.group_tag ?? "",
  };
}

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Property | null>(null);
  const [filterStatus, setFilterStatus] = useState<string[]>(["occupied","vacant","str","planned","sold"]);
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [showLegend, setShowLegend] = useState(true);
  const initDone = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = "/auth"; return; }
      supabase.from("properties").select("*").eq("user_id", session.user.id)
        .then(({ data }) => { setProperties((data || []).map(fromDb)); setLoading(false); });
    });
  }, []);

  const groups = Array.from(new Set(properties.map(p => p.groupTag).filter(Boolean))) as string[];
  const types = Array.from(new Set(properties.map(p => p.type))) as string[];

  const filtered = properties.filter(p => {
    if (filterStatus.length > 0 && filterStatus.length < 5 && !filterStatus.includes(p.occupancyStatus)) return false;
    if (filterGroup !== "all" && p.groupTag !== filterGroup) return false;
    if (filterType !== "all" && p.type !== filterType) return false;
    return true;
  });

  function toggleStatus(s: string) {
    setFilterStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  useEffect(() => {
    if (loading || initDone.current) return;
    initDone.current = true;
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css"; link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    if (!(window as any).L) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => setupMap();
      document.head.appendChild(script);
    } else setupMap();
  }, [loading]);

  function setupMap() {
    const L = (window as any).L;
    if (!mapRef.current || leafletRef.current) return;
    const map = L.map(mapRef.current, { center: [20, 10], zoom: 2, zoomControl: true, attributionControl: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    const s = document.createElement("style");
    s.textContent = `.leaflet-layer{filter:invert(1) hue-rotate(195deg) brightness(0.82) contrast(1.1) saturate(0.45)}.leaflet-container{background:#050a0f!important}.leaflet-popup-content-wrapper{background:rgba(5,10,15,0.96)!important;border:1px solid rgba(245,158,11,0.4)!important;border-radius:12px!important;color:#fff!important;font-family:'DM Sans',sans-serif!important}.leaflet-popup-tip{background:rgba(5,10,15,0.96)!important}.leaflet-popup-close-button{color:rgba(255,255,255,0.4)!important}.leaflet-control-zoom{background:rgba(10,10,10,0.9)!important;border:1px solid rgba(255,255,255,0.1)!important}.leaflet-control-zoom a{background:transparent!important;color:rgba(255,255,255,0.6)!important;border-bottom:1px solid rgba(255,255,255,0.08)!important}`;
    document.head.appendChild(s);
    leafletRef.current = { map, L };
  }

  useEffect(() => {
    if (!leafletRef.current) {
      setTimeout(() => {
        if (!leafletRef.current) return;
        drawMarkers();
      }, 500);
      return;
    }
    drawMarkers();
    function drawMarkers() {
    if (!leafletRef.current) return;
    const { map, L } = leafletRef.current;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    filtered.forEach(p => {
      if (!p.lat || !p.lng) return;
      const cf = propCashFlow(p);
      const oc = occupancyColor(p.occupancyStatus);
      const isSelected = selected?.id === p.id;
      const borderColor = isSelected ? "#f59e0b" : oc.color;
      const bgColor = isSelected ? "rgba(245,158,11,0.92)" : "rgba(5,10,15,0.92)";
      const valueColor = isSelected ? "#000" : "#f59e0b";
      const cfColor = isSelected ? "#000" : (cf >= 0 ? "#34d399" : "#f87171");
      const label = p.occupancyStatus === "sold" ? `SOLD ${p.soldPrice ? fmt(p.soldPrice) : ""}` : p.occupancyStatus === "str" ? `STR ${p.occupancyPct}%` : oc.label.toUpperCase();

      const iconHtml = `<div style="position:relative;text-align:center;">
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:44px;height:44px;border:1px solid ${borderColor};border-radius:50%;opacity:0.35;animation:tPulse 2s ease-out infinite;"></div>
        <div style="background:${bgColor};border:2px solid ${borderColor};border-radius:10px;padding:7px 12px;min-width:120px;box-shadow:0 0 14px ${borderColor}44;position:relative;">
          <div style="font-size:9px;color:${isSelected ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)'};letter-spacing:1px;text-transform:uppercase;font-weight:700;margin-bottom:2px;">${p.name.length > 14 ? p.name.slice(0,13)+"…" : p.name}</div>
          <div style="font-size:12px;font-weight:800;color:${valueColor};">${fmt(p.value)}</div>
          <div style="font-size:10px;font-weight:700;color:${cfColor};margin-top:2px;">${p.occupancyStatus === "sold" ? "EXITED" : (cf >= 0 ? "+" : "") + fmtFull(cf) + "/mo"}</div>
          <div style="font-size:9px;color:${isSelected ? 'rgba(0,0,0,0.4)' : oc.color};margin-top:2px;font-weight:600;">${label}</div>
        </div>
        <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:7px solid ${borderColor};margin:0 auto;"></div>
      </div>`;

      const icon = L.divIcon({ html: iconHtml, className: "", iconSize: [130, 72], iconAnchor: [65, 79] });
      const marker = L.marker([p.lat, p.lng], { icon });
      marker.on("click", () => setSelected(prev => prev?.id === p.id ? null : p));
      marker.addTo(map);
      markersRef.current.push(marker);
    });

    if (filtered.length > 1) {
      try { map.fitBounds(L.latLngBounds(filtered.filter(p => p.lat && p.lng).map(p => [p.lat, p.lng])), { padding: [80, 80] }); } catch {}
    } else if (filtered.length === 1 && filtered[0].lat) {
      map.setView([filtered[0].lat, filtered[0].lng], 13);
    }
    } // close drawMarkers
  }, [filtered, selected, loading]);

  const totalValue = filtered.reduce((s, p) => s + p.value, 0);
  const totalCF = filtered.reduce((s, p) => s + propCashFlow(p), 0);
  const occupied = filtered.filter(p => p.occupancyStatus === "occupied").length;
  const STATUSES: OccupancyStatus[] = ["occupied", "vacant", "str", "planned", "sold"];

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
      <div style={{ width: "28px", height: "28px", background: "#f59e0b", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "800", color: "#000" }}>GS</div>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px", letterSpacing: "1px" }}>LOADING MAP...</p>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#fff", fontFamily: "'DM Sans','Helvetica Neue',sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes tPulse { 0%{transform:translate(-50%,-50%) scale(1);opacity:0.4} 100%{transform:translate(-50%,-50%) scale(2.8);opacity:0} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: rgba(245,166,35,0.2); border-radius: 999px; }
      `}</style>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "10px 20px", background: "rgba(5,5,5,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)", zIndex: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <div style={{ width: "24px", height: "24px", background: "#f59e0b", borderRadius: "5px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: "800", color: "#000" }}>GS</div>
          <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "0.5px" }}>TACTICAL MAP</span>
          <span style={{ fontSize: "9px", color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "4px", padding: "1px 6px" }}>LIVE</span>
        </div>

        {/* KPI strip */}
        <div style={{ display: "flex", gap: "20px", flexShrink: 0 }}>
          {[
            { label: "Showing", value: `${filtered.length} / ${properties.length}` },
            { label: "Value", value: fmt(totalValue), color: "#f59e0b" },
            { label: "Cash Flow", value: `${totalCF >= 0 ? "+" : ""}${fmtFull(totalCF)}/mo`, color: totalCF >= 0 ? "#34d399" : "#f87171" },
            { label: "Occupied", value: `${occupied}/${filtered.length}`, color: "#34d399" },
          ].map(m => (
            <div key={m.label}>
              <p style={{ fontSize: "8px", color: "rgba(255,255,255,0.25)", letterSpacing: "1.5px", textTransform: "uppercase" }}>{m.label}</p>
              <p style={{ fontSize: "14px", fontWeight: "800", color: m.color || "#fff", letterSpacing: "-0.3px" }}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", flex: 1 }}>
          {/* Status filters */}
          {STATUSES.map(s => {
            const oc = occupancyColor(s);
            const active = filterStatus.includes(s);
            return (
              <button key={s} onClick={() => toggleStatus(s)} style={{ padding: "4px 12px", borderRadius: "999px", fontSize: "10px", fontWeight: "700", border: `1px solid ${active ? oc.color : "rgba(255,255,255,0.1)"}`, background: active ? `${oc.color}22` : "rgba(255,255,255,0.03)", color: active ? oc.color : "rgba(255,255,255,0.4)", cursor: "pointer", transition: "all 0.15s" }}>
                {oc.label}
              </button>
            );
          })}

          {/* Group filter */}
          {groups.length > 0 && (
            <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "4px 10px", fontSize: "10px", color: filterGroup !== "all" ? "#60a5fa" : "rgba(255,255,255,0.4)", outline: "none", fontFamily: "inherit", cursor: "pointer" }}>
              <option value="all">All Groups</option>
              {groups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          )}

          {/* Type filter */}
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "4px 10px", fontSize: "10px", color: filterType !== "all" ? "#a78bfa" : "rgba(255,255,255,0.4)", outline: "none", fontFamily: "inherit", cursor: "pointer" }}>
            <option value="all">All Types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {filterStatus.length > 0 && (
            <button onClick={() => { setFilterStatus([]); setFilterGroup("all"); setFilterType("all"); }} style={{ padding: "4px 12px", borderRadius: "999px", fontSize: "10px", fontWeight: "700", border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)", color: "#f87171", cursor: "pointer" }}>
              Clear ×
            </button>
          )}
        </div>

        {/* Legend toggle */}
        <button onClick={() => setShowLegend(!showLegend)} style={{ fontSize: "10px", padding: "5px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontWeight: "600", flexShrink: 0 }}>
          {showLegend ? "Hide" : "Show"} Legend
        </button>

        <button onClick={() => window.location.href = "/Dashboard"} style={{ fontSize: "10px", padding: "5px 12px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "8px", color: "#f59e0b", cursor: "pointer", fontWeight: "700", flexShrink: 0 }}>
          ← Dashboard
        </button>
      </div>

      {/* Map + sidebar */}
      <div style={{ flex: 1, display: "flex", position: "relative", overflow: "hidden" }}>
        {/* Map */}
        <div ref={mapRef} style={{ flex: 1, height: "calc(100vh - 57px)" }} />

        {/* Legend */}
        {showLegend && (
          <div style={{ position: "absolute", bottom: "24px", left: "20px", zIndex: 500, background: "rgba(5,10,15,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px", padding: "14px 18px", minWidth: "180px", backdropFilter: "blur(12px)" }}>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: "700", marginBottom: "10px" }}>Legend</p>
            {STATUSES.map(s => {
              const oc = occupancyColor(s);
              const count = properties.filter(p => p.occupancyStatus === s).length;
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: oc.color, boxShadow: `0 0 6px ${oc.color}88`, flexShrink: 0 }} />
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", flex: 1 }}>{oc.label}</span>
                  <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontWeight: "700" }}>{count}</span>
                </div>
              );
            })}
            <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)" }}>Click a pin to inspect</p>
            </div>
          </div>
        )}

        {/* Property detail sidebar */}
        {selected && (
          <div style={{ width: "320px", height: "calc(100vh - 57px)", background: "rgba(8,8,8,0.97)", borderLeft: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)", overflowY: "auto", zIndex: 500, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: "800", marginBottom: "4px" }}>{selected.name}</h3>
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{selected.type}{selected.address ? ` · ${selected.address}` : ""}</p>
                  {selected.groupTag && <p style={{ fontSize: "10px", color: "#60a5fa", marginTop: "3px" }}>📦 {selected.groupTag}</p>}
                </div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "20px", lineHeight: 1 }}>×</button>
              </div>
              <div style={{ marginTop: "12px" }}>
                {(() => { const oc = occupancyColor(selected.occupancyStatus); return <span style={{ fontSize: "10px", fontWeight: "700", padding: "3px 10px", borderRadius: "999px", background: oc.bg, color: oc.color, border: `1px solid ${oc.border}` }}>{oc.label}{selected.occupancyStatus === "str" ? ` · ${selected.occupancyPct}% occ.` : ""}</span>; })()}
              </div>
            </div>

            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { label: "Market Value", value: fmtFull(selected.value), color: "#f59e0b", big: true },
                { label: "Mortgage", value: fmtFull(selected.mortgage), color: "#fff" },
                { label: "Equity", value: fmtFull(selected.value - selected.mortgage), color: "#f59e0b" },
                { label: "Monthly Rent", value: selected.occupancyStatus === "occupied" || selected.occupancyStatus === "str" ? fmtFull(selected.rent) : "—", color: "#fff" },
                { label: "Expenses / mo", value: fmtFull(selected.expenses), color: "#f87171" },
                { label: "Net Cash Flow", value: `${propCashFlow(selected) >= 0 ? "+" : ""}${fmtFull(propCashFlow(selected))}/mo`, color: propCashFlow(selected) >= 0 ? "#34d399" : "#f87171", big: true },
                { label: "Appreciation", value: `${selected.appreciation}%/yr`, color: "rgba(255,255,255,0.6)" },
                ...(selected.occupancyStatus === "sold" ? [
                  { label: "Sale Price", value: fmtFull(selected.soldPrice), color: "#ffd700" },
                  { label: "Profit", value: fmtFull(selected.soldPrice - selected.value), color: selected.soldPrice > selected.value ? "#34d399" : "#f87171" },
                  { label: "Sale Date", value: selected.soldDate || "—", color: "rgba(255,255,255,0.4)" },
                ] : []),
              ].map(m => (
                <div key={m.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "10px", border: m.big ? "1px solid rgba(245,158,11,0.15)" : "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{m.label}</span>
                  <span style={{ fontSize: m.big ? "15px" : "13px", fontWeight: m.big ? "800" : "600", color: m.color }}>{m.value}</span>
                </div>
              ))}
            </div>

            <div style={{ padding: "0 20px 20px", marginTop: "auto" }}>
              <button onClick={() => window.location.href = "/Dashboard"} style={{ width: "100%", padding: "11px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "10px", color: "#f59e0b", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}>
                Open in Dashboard →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 