"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import IntelligenceScore from "./IntelligenceScore";
import GroupPortfolio from "./GroupPortfolio";
import CommunityFeed from "./CommunityFeed";
import { ReferralPanel } from "./ReferralPanel";

// ── Types ────────────────────────────────────────────────────────────
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
  parentId: number | null;
  groupTag: string;
};

type ScenarioProperty = {
  id: number;
  name: string;
  value: number;
  mortgage: number;
  rent: number;
  expenses: number;
  appreciation: number;
};

type Scenario = {
  enabled: boolean;
  appreciationDelta: number;
  marketRate: number;
  extraProperties: ScenarioProperty[];
};

type UserSettings = {
  firstName: string;
  goalPortfolio: number;
  goalCashFlow: number;
  onboardingDone: boolean;
  situation?: "investor" | "home" | "planning";
};

const DEFAULT_GOAL_PORTFOLIO = 2_000_000;
const DEFAULT_GOAL_CASHFLOW = 2000;
const PORTFOLIO_MILESTONES = [10, 37, 61, 88, 100];
const CASHFLOW_MILESTONES = [15, 42, 68, 90, 100];

const MILESTONE_MESSAGES: Record<number, (name: string, goal: string) => string> = {
  10:  (n, g) => `${n}, you've taken the first real step toward ${g}. Most people never start — you did.`,
  15:  (n, g) => `${n}, 15% of ${g} in cash flow. You're building something real.`,
  37:  (n, g) => `${n}, you're at 37% — right where momentum starts to compound. Keep going.`,
  42:  (n, g) => `${n}, 42% of your cash flow goal. You're nearly halfway and ahead of the curve.`,
  61:  (n, g) => `${n}, 61% to ${g}. Most investors never get here. You're not most investors.`,
  68:  (n, g) => `${n}, 68% cash flow achieved. The finish line is in sight.`,
  88:  (n, g) => `${n}, 88% to ${g}. You can see it from here. Don't stop now.`,
  90:  (n, g) => `${n}, 90% of your monthly cash flow goal. One final push.`,
  100: (n, g) => `${n}, you've reached ${g}. Goldstream will always help you reach farther.`,
};

const EMPTY_FORM = {
  name: "", type: "Single Family", value: "", mortgage: "",
  rent: "", expenses: "", occupancyStatus: "occupied" as OccupancyStatus,
  plannedDate: "", appreciation: "3.5", address: "", lat: "", lng: "",
  occupancyPct: "100", soldPrice: "", soldDate: "", parentId: "", groupTag: "",
};

const EMPTY_SCENARIO_PROP: Omit<ScenarioProperty, "id"> = {
  name: "", value: 0, mortgage: 0, rent: 0, expenses: 0, appreciation: 3.5,
};

function toDb(p: Omit<Property, "id">) {
  return { name: p.name, type: p.type, value: p.value, mortgage: p.mortgage, rent: p.rent, expenses: p.expenses, occupancy_status: p.occupancyStatus, planned_date: p.plannedDate, appreciation: p.appreciation, lat: p.lat, lng: p.lng, address: p.address, occupancy_pct: p.occupancyPct ?? 100, sold_price: p.soldPrice ?? null, sold_date: p.soldDate ?? null, parent_id: p.parentId ?? null, group_tag: p.groupTag ?? "" };
}
function fromDb(row: any): Property {
  return { id: row.id, name: row.name, type: row.type, value: row.value, mortgage: row.mortgage, rent: row.rent, expenses: row.expenses, occupancyStatus: row.occupancy_status, plannedDate: row.planned_date || "", appreciation: row.appreciation, lat: row.lat, lng: row.lng, address: row.address || "", occupancyPct: row.occupancy_pct ?? 100, soldPrice: row.sold_price ?? 0, soldDate: row.sold_date ?? "", parentId: row.parent_id ?? null, groupTag: row.group_tag ?? "" };
}
function daysUntil(deadline: string | undefined): number | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

function fmtPct(n: number): string {
  return n.toFixed(1) + "%";
}
function fmt(n: number) { if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M"; if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K"; return "$" + n.toLocaleString("en-US"); }
function fmtFull(n: number) { return (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US"); }
function fmtComma(n: number) { return (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US"); }
function pct(value: number, total: number) { return Math.min(100, Math.max(0, (value / total) * 100)); }
function isEffectivelyOccupied(p: Property) { return p.occupancyStatus === "occupied" || p.occupancyStatus === "str"; }
function propCashFlow(p: Property) {
  if (p.occupancyStatus === "sold") return 0;
  if (p.occupancyStatus === "str") {
    const occupiedRent = p.rent * ((p.occupancyPct ?? 100) / 100);
    return occupiedRent - p.expenses;
  }
  return isEffectivelyOccupied(p) ? p.rent - p.expenses : -p.expenses;
}
function occupancyLabel(p: Property) {
  if (p.occupancyStatus === "occupied") return "Occupied";
  if (p.occupancyStatus === "vacant") return "Vacant";
  if (p.occupancyStatus === "sold") return "Sold";
  if (p.occupancyStatus === "str") return `STR ${p.occupancyPct ?? 100}%`;
  return p.plannedDate ? `Planned ${p.plannedDate}` : "Planned";
}
function occupancyColor(p: Property) {
  if (p.occupancyStatus === "occupied") return { bg: "rgba(52,211,153,0.08)", color: "#34d399", border: "rgba(52,211,153,0.2)" };
  if (p.occupancyStatus === "vacant") return { bg: "rgba(248,113,113,0.08)", color: "#f87171", border: "rgba(248,113,113,0.2)" };
  if (p.occupancyStatus === "sold") return { bg: "rgba(255,215,0,0.08)", color: "#ffd700", border: "rgba(255,215,0,0.2)" };
  if (p.occupancyStatus === "str") return { bg: "rgba(232,121,249,0.08)", color: "#e879f9", border: "rgba(232,121,249,0.2)" };
  return { bg: "rgba(96,165,250,0.08)", color: "#60a5fa", border: "rgba(96,165,250,0.2)" };
}
function computeProjections(properties: Property[], scenario: Scenario, years = 10) { const realValue = properties.reduce((s, p) => s + p.value, 0); const realAvgApp = properties.length > 0 ? properties.reduce((s, p) => s + p.appreciation, 0) / properties.length / 100 : 0.035; const realMonthlyCF = properties.reduce((s, p) => s + propCashFlow(p), 0); const scenApp = realAvgApp + scenario.appreciationDelta / 100; const extraValue = scenario.extraProperties.reduce((s, p) => s + p.value, 0); const extraCF = scenario.extraProperties.reduce((s, p) => s + (p.rent - p.expenses), 0); const scenBaseValue = realValue + extraValue; const real = [], scen = []; for (let y = 0; y <= years; y++) { real.push({ year: y, value: realValue * Math.pow(1 + realAvgApp, y), cashFlow: realMonthlyCF }); scen.push({ year: y, value: scenBaseValue * Math.pow(1 + scenApp, y), cashFlow: realMonthlyCF + extraCF }); } return { real, scen }; }
function monthsToGoal(currentValue: number, annualRate: number, goal: number) { if (currentValue >= goal) return 0; if (annualRate <= 0) return Infinity; return Math.ceil(Math.log(goal / currentValue) / Math.log(1 + annualRate)); }
function fmtTime(months: number) { if (months === 0) return "✓ Done"; if (months === Infinity) return "∞"; if (months < 12) return `${months}mo`; return `${Math.ceil(months / 12)}yr`; }
function checkMilestone(currentPct: number, milestones: number[], seenKey: string): number | null { try { const seen: number[] = JSON.parse(localStorage.getItem(seenKey) || "[]"); for (const m of milestones) { if (currentPct >= m && !seen.includes(m)) { seen.push(m); localStorage.setItem(seenKey, JSON.stringify(seen)); return m; } } } catch {} return null; }

function detectCountryFlag(address: string): { code: string; iso: string } | null {
  if (!address) return null;
  const a = address.toLowerCase();
  const map: [string[], string, string][] = [
    [["usa","united states","houston","new york","los angeles","chicago","miami","dallas","austin","denver","seattle","boston","atlanta","phoenix","las vegas","san francisco","nashville"," tx"," fl"," ca"," ny"," il"," co"," wa"," ma"," ga"," az"," nv"], "US", "us"],
    [["canada","toronto","vancouver","montreal","calgary","ottawa","edmonton"," bc"," on"," qc"," ab"], "CA", "ca"],
    [["france","paris","lyon","bordeaux","marseille","nice","toulouse","nantes"," fr "], "FR", "fr"],
    [["germany","berlin","munich","hamburg","frankfurt","cologne","düsseldorf"," de "], "DE", "de"],
    [["spain","madrid","barcelona","malaga","valencia","seville"," es "], "ES", "es"],
    [["uk","united kingdom","london","manchester","birmingham","glasgow","liverpool","edinburgh"," uk "], "UK", "gb"],
    [["uae","dubai","abu dhabi","sharjah"," ae "], "AE", "ae"],
    [["morocco","marrakech","casablanca","tanger","rabat","agadir"," ma "], "MA", "ma"],
    [["portugal","lisbon","porto","faro","algarve"," pt "], "PT", "pt"],
    [["italy","rome","milan","naples","florence","venice"," it "], "IT", "it"],
    [["australia","sydney","melbourne","brisbane","perth","adelaide"," au "], "AU", "au"],
    [["brazil","são paulo","rio de janeiro","brasilia"," br "], "BR", "br"],
    [["mexico","mexico city","cancun","guadalajara","monterrey"," mx "], "MX", "mx"],
  ];
  for (const [keywords, code, iso] of map) {
    if (keywords.some(k => a.includes(k))) return { code, iso };
  }
  return null;
}

function FlagPill({ address }: { address: string }) {
  const cf = detectCountryFlag(address);
  if (!cf) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10px", padding: "1px 7px", borderRadius: "5px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontWeight: "700", letterSpacing: "0.3px", flexShrink: 0 }}>
      <img src={`https://flagcdn.com/16x12/${cf.iso}.png`} width="16" height="12" alt={cf.code} style={{ borderRadius: "2px", objectFit: "cover" }} />
      {cf.code}
    </span>
  );
}
function TacticalMap({ properties, selected, onSelect }: { properties: Property[]; selected: number | null; onSelect: (id: number) => void; }) {
  const mapRef = useRef<HTMLDivElement>(null); const leafletRef = useRef<any>(null); const markersRef = useRef<any[]>([]); const initDone = useRef(false);
  if (typeof window !== "undefined" && !initDone.current) { initDone.current = true; setTimeout(() => { if (!document.getElementById("leaflet-css")) { const link = document.createElement("link"); link.id = "leaflet-css"; link.rel = "stylesheet"; link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(link); } if (!(window as any).L) { const script = document.createElement("script"); script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; script.onload = () => setupMap(); document.head.appendChild(script); } else setupMap(); }, 100); }
  function setupMap() { const L = (window as any).L; if (!mapRef.current || leafletRef.current) return; const center: [number, number] = [20, 10]; const zoom = properties.length > 0 ? 4 : 2; const map = L.map(mapRef.current, { center, zoom, zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false });

mapRef.current.addEventListener("click", () => {
  map.dragging.enable();
  map.scrollWheelZoom.enable();
  map.doubleClickZoom.enable();
  const indicator = document.getElementById("gs-map-unlock");
  if (indicator) indicator.style.opacity = "1";
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    map.dragging.disable();
    map.scrollWheelZoom.disable();
    const indicator = document.getElementById("gs-map-unlock");
    if (indicator) indicator.style.opacity = "0";
  }
}); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map); const s = document.createElement("style"); s.textContent = `.leaflet-layer{filter:invert(1) hue-rotate(195deg) brightness(0.82) contrast(1.1) saturate(0.45)}.leaflet-container{background:#050a0f!important}.leaflet-control-zoom{display:none}.leaflet-popup-content-wrapper{background:rgba(5,10,15,0.96)!important;border:1px solid rgba(245,158,11,0.4)!important;border-radius:12px!important;color:#fff!important;font-family:'DM Sans',sans-serif!important}.leaflet-popup-tip{background:rgba(5,10,15,0.96)!important}.leaflet-popup-close-button{color:rgba(255,255,255,0.4)!important}`; document.head.appendChild(s); leafletRef.current = { map, L }; renderMarkers(map, L, properties, selected, onSelect); }
  const prevPropsRef = useRef<string>(""); const cur = JSON.stringify({ properties, selected }); if (cur !== prevPropsRef.current && leafletRef.current) { prevPropsRef.current = cur; const { map, L } = leafletRef.current; renderMarkers(map, L, properties, selected, onSelect); }
  function renderMarkers(map: any, L: any, props: Property[], sel: number | null, onSel: (id: number) => void) { markersRef.current.forEach((m) => m.remove()); markersRef.current = []; props.forEach((p) => { const isSelected = sel === p.id; const cf = propCashFlow(p); const oc = occupancyColor(p); const borderColor = isSelected ? "#f59e0b" : oc.color; const bgColor = isSelected ? "rgba(245,158,11,0.92)" : "rgba(5,10,15,0.92)"; const valueColor = isSelected ? "#000" : "#f59e0b"; const cfColor = isSelected ? "#000" : (cf >= 0 ? "#34d399" : "#f87171"); const iconHtml = `<div style="position:relative;text-align:center;"><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:44px;height:44px;border:1px solid ${borderColor};border-radius:50%;opacity:0.35;animation:tPulse 2s ease-out infinite;"></div><div style="background:${bgColor};border:2px solid ${borderColor};border-radius:10px;padding:7px 12px;min-width:110px;box-shadow:0 0 14px ${borderColor}44;position:relative;"><div style="font-size:9px;color:${isSelected ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)'};letter-spacing:1px;text-transform:uppercase;font-weight:700;margin-bottom:2px;">${p.name.length > 14 ? p.name.slice(0, 13) + "…" : p.name}</div><div style="font-size:12px;font-weight:800;color:${valueColor};">${fmt(p.value)}</div><div style="font-size:10px;font-weight:700;color:${cfColor};margin-top:2px;">${cf >= 0 ? "+" : ""}${fmtFull(cf)}/mo</div><div style="font-size:9px;color:${isSelected ? 'rgba(0,0,0,0.4)' : oc.color};margin-top:2px;font-weight:600;">${occupancyLabel(p).toUpperCase()}</div></div><div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:7px solid ${borderColor};margin:0 auto;"></div></div>`; const icon = L.divIcon({ html: iconHtml, className: "", iconSize: [130, 72], iconAnchor: [65, 79], popupAnchor: [0, -82] }); const equity = p.value - p.mortgage; const roi = equity > 0 ? ((cf * 12 / equity) * 100).toFixed(1) : "—"; const popup = `<div style="padding:6px 8px;min-width:190px;"><div style="font-size:13px;font-weight:800;margin-bottom:10px;">${p.name}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div><div style="font-size:9px;color:rgba(255,255,255,0.3);text-transform:uppercase;">Value</div><div style="font-size:13px;font-weight:700;color:#f59e0b;">${fmtFull(p.value)}</div></div><div><div style="font-size:9px;color:rgba(255,255,255,0.3);text-transform:uppercase;">Equity</div><div style="font-size:13px;font-weight:700;">${fmtFull(equity)}</div></div><div><div style="font-size:9px;color:rgba(255,255,255,0.3);text-transform:uppercase;">Cash Flow</div><div style="font-size:13px;font-weight:700;color:${cf >= 0 ? '#34d399' : '#f87171'};">${cf >= 0 ? "+" : ""}${fmtFull(cf)}/mo</div></div><div><div style="font-size:9px;color:rgba(255,255,255,0.3);text-transform:uppercase;">ROI</div><div style="font-size:13px;font-weight:700;">${roi}%</div></div></div>${p.address ? `<div style="margin-top:8px;font-size:10px;color:rgba(255,255,255,0.2);">${p.address}</div>` : ""}</div>`; const marker = L.marker([p.lat, p.lng], { icon }); marker.bindPopup(popup); marker.on("click", () => onSel(p.id)); marker.addTo(map); markersRef.current.push(marker); }); if (props.length > 1) { try { map.fitBounds(L.latLngBounds(props.map((p) => [p.lat, p.lng])), { padding: [60, 60] }); } catch {} } }
  return (<div style={{ position: "relative", borderRadius: "20px", overflow: "hidden", border: "1px solid rgba(245,158,11,0.15)" }}><div id="gs-map-unlock" style={{ position:"absolute", top:"14px", left:"50%", transform:"translateX(-50%)", zIndex:402, background:"rgba(52,211,153,0.15)", border:"1px solid rgba(52,211,153,0.4)", borderRadius:"999px", padding:"4px 14px", fontSize:"10px", fontWeight:"700", color:"#34d399", opacity:0, transition:"opacity 0.3s", pointerEvents:"none" }}>🔓 Exploring · Esc to lock</div><div style={{ position: "absolute", inset: 0, zIndex: 400, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(245,158,11,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,0.025) 1px,transparent 1px)", backgroundSize: "40px 40px" }} /><div style={{ position: "absolute", top: "14px", left: "18px", zIndex: 402, pointerEvents: "none", display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399", boxShadow: "0 0 6px #34d399", animation: "blink 1.5s ease-in-out infinite" }} /><span style={{ fontSize: "10px", color: "rgba(245,158,11,0.7)", letterSpacing: "2px", fontWeight: "700", textTransform: "uppercase" }}>GOLDSTREAM · TACTICAL VIEW</span></div><div style={{ position: "absolute", top: "14px", right: "18px", zIndex: 402, pointerEvents: "none", fontSize: "10px", color: "rgba(245,158,11,0.5)", letterSpacing: "1px", fontWeight: "600" }}>{String(Math.max(0, properties.length)).slice(0, 2).padStart(2, "0")} ASSETS TRACKED</div><div ref={mapRef} className="gs-map" style={{ height: "380px", width: "100%" }} /></div>);
}

function MilestoneToast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 8000); return () => clearTimeout(t); }, [onClose]);
  return (<div style={{ position: "fixed", bottom: "30px", left: "50%", transform: "translateX(-50%)", zIndex: 200, maxWidth: "480px", width: "calc(100% - 40px)", background: "rgba(10,10,10,0.97)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: "16px", padding: "20px 24px", boxShadow: "0 0 40px rgba(245,158,11,0.15)", display: "flex", alignItems: "flex-start", gap: "14px", animation: "slideUp 0.4s ease" }}><div style={{ fontSize: "24px", flexShrink: 0 }}>🏆</div><div style={{ flex: 1 }}><p style={{ fontSize: "11px", color: "#f59e0b", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "4px" }}>Milestone Reached</p><p style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)", lineHeight: "1.5" }}>{message}</p></div><button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "18px", flexShrink: 0 }}>×</button></div>);
}

function GoalReachedOverlay({ name, goalLabel, goalType, onNewGoal, onDismiss }: { name: string; goalLabel: string; goalType: "portfolio" | "cashflow"; onNewGoal: (val: number) => void; onDismiss: () => void; }) {
  const [newGoal, setNewGoal] = useState("");
  const [phase, setPhase] = useState<"burst"|"settle"|"form">("burst");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("settle"), 800);
    const t2 = setTimeout(() => setPhase("form"), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const CONFETTI = Array.from({ length: 60 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.2,
    duration: 2.5 + Math.random() * 2.5,
    size: 6 + Math.random() * 8,
    color: [
      "#f59e0b","#fbbf24","#fde68a",
      "#34d399","#6ee7b7",
      "#60a5fa","#93c5fd",
      "#f87171","#a78bfa","#fff"
    ][Math.floor(Math.random() * 10)],
    shape: Math.random() > 0.5 ? "50%" : Math.random() > 0.5 ? "0" : "2px",
    spin: Math.random() > 0.5 ? 720 : -720,
    drift: (Math.random() - 0.5) * 200,
  }));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.93)", backdropFilter: "blur(16px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: "20px" }}>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) translateX(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) translateX(var(--drift)) rotate(var(--spin, 720deg)); opacity: 0; }
        }
        @keyframes burstScale {
          0%   { transform: scale(0) rotate(-10deg); opacity: 0; }
          60%  { transform: scale(1.15) rotate(3deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes glowPulse {
          0%,100% { box-shadow: 0 0 40px rgba(245,158,11,0.2), 0 0 80px rgba(245,158,11,0.05); }
          50%      { box-shadow: 0 0 80px rgba(245,158,11,0.4), 0 0 160px rgba(245,158,11,0.15); }
        }
        @keyframes trophyBounce {
          0%,100% { transform: translateY(0) scale(1); }
          30%     { transform: translateY(-18px) scale(1.12); }
          60%     { transform: translateY(-6px) scale(1.04); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmerBar {
          0%   { width: 0%; }
          100% { width: 100%; }
        }
        @keyframes countUp {
          from { opacity: 0; transform: scale(0.8); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Confetti burst */}
      {CONFETTI.map(c => (
        <div key={c.id} style={{
          position: "fixed",
          top: "-20px",
          left: `${c.left}%`,
          width: `${c.size}px`,
          height: `${c.size}px`,
          background: c.color,
          borderRadius: c.shape,
          animation: `confettiFall ${c.duration}s ease-in ${c.delay}s forwards`,
          pointerEvents: "none",
          // @ts-ignore
          "--drift": `${c.drift}px`,
          "--spin": `${c.spin}deg`,
          zIndex: 301,
        }} />
      ))}

      {/* Radial glow behind card */}
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at center, rgba(245,158,11,0.08) 0%, transparent 65%)", pointerEvents: "none", zIndex: 299 }} />

      {/* Card */}
      <div style={{
        background: "linear-gradient(135deg, rgba(15,10,5,0.99), rgba(10,10,10,0.99))",
        border: "1px solid rgba(245,158,11,0.35)",
        borderRadius: "32px",
        padding: "52px 44px",
        maxWidth: "520px",
        width: "100%",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
        animation: "burstScale 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards, glowPulse 3s ease-in-out 1s infinite",
        zIndex: 302,
      }}>

        {/* Top gold accent */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, transparent, #f59e0b, #fbbf24, #f59e0b, transparent)", animation: "shimmerBar 1.2s ease-out 0.3s both" }} />

        {/* Corner sparkles */}
        {[{top:"16px",left:"20px"},{top:"16px",right:"20px"},{bottom:"16px",left:"20px"},{bottom:"16px",right:"20px"}].map((pos,i) => (
          <div key={i} style={{ position:"absolute", ...pos, fontSize:"14px", opacity:0.4, animation:`trophyBounce ${1.5+i*0.2}s ease-in-out ${0.5+i*0.1}s infinite` }}>✦</div>
        ))}

        {/* Trophy */}
        <div style={{ fontSize: "72px", marginBottom: "8px", animation: "trophyBounce 2s ease-in-out 0.8s infinite", display: "inline-block" }}>🏆</div>

        {/* Streak label */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 14px", borderRadius: "999px", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", marginBottom: "16px" }}>
          <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#f59e0b", boxShadow: "0 0 6px #f59e0b", animation: "blink 1s infinite" }} />
          <span style={{ fontSize: "10px", color: "#f59e0b", fontWeight: "800", letterSpacing: "2.5px", textTransform: "uppercase" }}>Goal Achieved</span>
        </div>

        {/* Name */}
        <h2 style={{ fontSize: "30px", fontWeight: "900", color: "#fff", marginBottom: "10px", letterSpacing: "-0.8px", animation: "fadeSlideUp 0.5s ease 0.6s both" }}>
          {name.toUpperCase()},<br/>
          <span style={{ color: "#f59e0b" }}>YOU DID IT.</span>
        </h2>

        {/* Goal label */}
        <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.5)", marginBottom: "6px", animation: "fadeSlideUp 0.5s ease 0.8s both" }}>
          {goalType === "portfolio" ? "Portfolio value" : "Monthly cash flow"} reached
        </p>
        <p style={{ fontSize: "36px", fontWeight: "900", color: "#f59e0b", letterSpacing: "-1.5px", marginBottom: "6px", animation: "countUp 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.9s both" }}>
          {goalLabel}
        </p>

        {/* Progress bar — full */}
        <div style={{ height: "5px", background: "rgba(255,255,255,0.06)", borderRadius: "999px", margin: "16px 0 24px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: "100%", background: "linear-gradient(90deg, #f59e0b, #fbbf24, #34d399)", borderRadius: "999px", boxShadow: "0 0 12px rgba(245,158,11,0.5)", animation: "shimmerBar 1s ease-out 1.2s both" }} />
        </div>

        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)", marginBottom: "28px", lineHeight: "1.7", animation: "fadeSlideUp 0.5s ease 1s both" }}>
          Most people set goals. Few hit them.<br/>
          <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: "600" }}>You're in the top tier. What's next?</span>
        </p>

        {/* New goal input */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "14px", animation: "fadeSlideUp 0.5s ease 1.1s both" }}>
          <input
            type="number"
            placeholder={goalType === "portfolio" ? "New target e.g. 10,000,000" : "New target e.g. 10,000"}
            value={newGoal}
            onChange={e => setNewGoal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && newGoal && onNewGoal(parseFloat(newGoal))}
            style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "14px", padding: "14px 16px", fontSize: "15px", color: "#fff", outline: "none", fontFamily: "inherit" }}
            autoFocus
          />
          <button
            onClick={() => { if (newGoal) onNewGoal(parseFloat(newGoal)); }}
            style={{ padding: "14px 22px", background: "linear-gradient(135deg, #f59e0b, #fbbf24)", color: "#000", borderRadius: "14px", fontWeight: "900", fontSize: "14px", border: "none", cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(245,158,11,0.3)" }}
          >
            Set Goal →
          </button>
        </div>

        <button onClick={onDismiss} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "12px", textDecoration: "underline", animation: "fadeSlideUp 0.5s ease 1.2s both" }}>
          I'll set it later
        </button>
      </div>
    </div>
  );
}

// ─── OnboardingModal ─────────────────────────────────────────────────────────
// Drop-in replacement for the existing OnboardingModal in page.tsx
// Adds Step 0 (situation selector) before the existing 3 steps
// Step 4 (final) shows referral link if they came via one, or invite prompt
// ─────────────────────────────────────────────────────────────────────────────

function OnboardingModal({ onComplete }: { onComplete: (s: UserSettings) => void }) {
  const [step, setStep] = useState(1); const [firstName, setFirstName] = useState(""); const [goalPortfolio, setGoalPortfolio] = useState("2000000"); const [goalCashFlow, setGoalCashFlow] = useState("2000");
  const IS: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", padding: "13px 16px", fontSize: "15px", color: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  return (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: "20px" }}><div style={{ background: "rgba(10,10,10,0.98)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "28px", padding: "48px 40px", maxWidth: "460px", width: "100%", textAlign: "center" }}><div style={{ width: "48px", height: "48px", background: "#f59e0b", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "800", color: "#000", margin: "0 auto 24px", boxShadow: "0 0 24px rgba(245,158,11,0.3)" }}>GS</div>{step === 1 && <><p style={{ fontSize: "11px", color: "#f59e0b", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "10px" }}>Welcome to Goldstream</p><h2 style={{ fontSize: "24px", fontWeight: "900", color: "#fff", marginBottom: "8px" }}>What's your name?</h2><p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", marginBottom: "28px" }}>We'll personalize your experience and celebrate your wins with you.</p><input type="text" placeholder="e.g. Alex" value={firstName} onChange={e => setFirstName(e.target.value)} onKeyDown={e => e.key === "Enter" && firstName && setStep(2)} style={{ ...IS, textAlign: "center", fontSize: "18px" }} autoFocus /><button onClick={() => firstName && setStep(2)} style={{ width: "100%", marginTop: "16px", padding: "14px", background: firstName ? "#f59e0b" : "rgba(245,158,11,0.3)", color: "#000", borderRadius: "12px", fontWeight: "800", fontSize: "15px", border: "none", cursor: firstName ? "pointer" : "not-allowed" }}>Continue →</button></>}{step === 2 && <><p style={{ fontSize: "11px", color: "#f59e0b", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "10px" }}>Your Goal, {firstName}</p><h2 style={{ fontSize: "22px", fontWeight: "900", color: "#fff", marginBottom: "8px" }}>What's your portfolio target?</h2><p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", marginBottom: "28px" }}>Total property value you want to reach. You can always change this.</p><input type="number" placeholder="2000000" value={goalPortfolio} onChange={e => setGoalPortfolio(e.target.value)} style={{ ...IS, textAlign: "center", fontSize: "18px" }} autoFocus /><div style={{ display: "flex", gap: "8px", marginTop: "10px", marginBottom: "4px" }}>{[500000, 1000000, 2000000, 5000000].map(v => (<button key={v} onClick={() => setGoalPortfolio(String(v))} style={{ flex: 1, padding: "7px 4px", background: goalPortfolio === String(v) ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${goalPortfolio === String(v) ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)"}`, borderRadius: "8px", color: goalPortfolio === String(v) ? "#f59e0b" : "rgba(255,255,255,0.4)", fontSize: "10px", fontWeight: "700", cursor: "pointer" }}>{fmt(v)}</button>))}</div><button onClick={() => setStep(3)} style={{ width: "100%", marginTop: "16px", padding: "14px", background: "#f59e0b", color: "#000", borderRadius: "12px", fontWeight: "800", fontSize: "15px", border: "none", cursor: "pointer" }}>Continue →</button><button onClick={() => setStep(1)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", cursor: "pointer", fontSize: "12px", marginTop: "12px", textDecoration: "underline" }}>← Back</button></>}{step === 3 && <><p style={{ fontSize: "11px", color: "#f59e0b", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "10px" }}>Almost There</p><h2 style={{ fontSize: "22px", fontWeight: "900", color: "#fff", marginBottom: "8px" }}>Monthly cash flow target?</h2><p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", marginBottom: "28px" }}>Net monthly income from all your properties. This drives your cash flow goal bar.</p><input type="number" placeholder="2000" value={goalCashFlow} onChange={e => setGoalCashFlow(e.target.value)} style={{ ...IS, textAlign: "center", fontSize: "18px" }} autoFocus /><div style={{ display: "flex", gap: "8px", marginTop: "10px", marginBottom: "4px" }}>{[1000, 2000, 5000, 10000].map(v => (<button key={v} onClick={() => setGoalCashFlow(String(v))} style={{ flex: 1, padding: "7px 4px", background: goalCashFlow === String(v) ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${goalCashFlow === String(v) ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)"}`, borderRadius: "8px", color: goalCashFlow === String(v) ? "#f59e0b" : "rgba(255,255,255,0.4)", fontSize: "10px", fontWeight: "700", cursor: "pointer" }}>${v >= 1000 ? (v/1000)+"K" : v}/mo</button>))}</div><button onClick={() => onComplete({ firstName, goalPortfolio: parseFloat(goalPortfolio) || DEFAULT_GOAL_PORTFOLIO, goalCashFlow: parseFloat(goalCashFlow) || DEFAULT_GOAL_CASHFLOW, onboardingDone: true })} style={{ width: "100%", marginTop: "16px", padding: "14px", background: "#f59e0b", color: "#000", borderRadius: "12px", fontWeight: "800", fontSize: "15px", border: "none", cursor: "pointer" }}>Launch My Dashboard 🚀</button><button onClick={() => setStep(2)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", cursor: "pointer", fontSize: "12px", marginTop: "12px", textDecoration: "underline" }}>← Back</button></>}<div style={{ display: "flex", justifyContent: "center", gap: "6px", marginTop: "24px" }}>{[1, 2, 3].map(s => (<div key={s} style={{ width: s === step ? "20px" : "6px", height: "6px", borderRadius: "999px", background: s === step ? "#f59e0b" : "rgba(255,255,255,0.15)", transition: "all 0.3s" }} />))}</div></div></div>);
}

function SettingsModal({ settings, onSave, onClose }: { settings: UserSettings; onSave: (s: UserSettings) => void; onClose: () => void; }) {
  const [firstName, setFirstName] = useState(settings.firstName); const [goalPortfolio, setGoalPortfolio] = useState(String(settings.goalPortfolio)); const [goalCashFlow, setGoalCashFlow] = useState(String(settings.goalCashFlow));
  const IS: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "12px 16px", fontSize: "14px", color: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  return (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px" }}><div style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "24px", padding: "36px", width: "100%", maxWidth: "420px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}><h2 style={{ fontSize: "17px", fontWeight: "800" }}>Edit Goals</h2><button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "22px" }}>×</button></div><div style={{ display: "flex", flexDirection: "column", gap: "16px" }}><div><label style={LS}>Your Name</label><input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} style={IS} /></div><div><label style={LS}>Portfolio Goal ($)</label><input type="number" value={goalPortfolio} onChange={e => setGoalPortfolio(e.target.value)} style={IS} /></div><div><label style={LS}>Monthly Cash Flow Goal ($)</label><input type="number" value={goalCashFlow} onChange={e => setGoalCashFlow(e.target.value)} style={IS} /></div></div><div style={{ display: "flex", gap: "10px", marginTop: "24px" }}><button onClick={onClose} style={{ flex: 1, padding: "12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "13px", color: "rgba(255,255,255,0.4)", background: "none", cursor: "pointer", fontWeight: "600" }}>Cancel</button><button onClick={() => onSave({ firstName, goalPortfolio: parseFloat(goalPortfolio) || DEFAULT_GOAL_PORTFOLIO, goalCashFlow: parseFloat(goalCashFlow) || DEFAULT_GOAL_CASHFLOW, onboardingDone: true })} style={{ flex: 1, padding: "12px", background: "#f59e0b", color: "#000", borderRadius: "10px", fontSize: "13px", fontWeight: "800", border: "none", cursor: "pointer" }}>Save Goals</button></div></div></div>);
}


function Dashboard() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [incomingListing, setIncomingListing] = useState<any>(null);
const [incomingFinancing, setIncomingFinancing] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"home" | "finddeals" | "myprojects" | "getfinanced" | "community">("home");
const [homeSection, setHomeSection] = useState<"score"|"intelligence"|"properties"|"projections"|"finances"|null>("properties");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});
  const [scenario, setScenario] = useState<Scenario>({ enabled: false, appreciationDelta: 1, marketRate: 6.5, extraProperties: [] });
  const [showAddScenarioProp, setShowAddScenarioProp] = useState(false);
  const [scenPropForm, setScenPropForm] = useState({ ...EMPTY_SCENARIO_PROP, name: "Hypothetical Property" });
  const [settings, setSettings] = useState<UserSettings>({ firstName: "", goalPortfolio: DEFAULT_GOAL_PORTFOLIO, goalCashFlow: DEFAULT_GOAL_CASHFLOW, onboardingDone: false });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);
  const [goalReached, setGoalReached] = useState<{ type: "portfolio" | "cashflow"; label: string } | null>(null);
const [showCompare, setShowCompare] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => { supabase.auth.getSession().then(({ data: { session } }) => { if (!session) { window.location.href = "/auth"; return; } setUser(session.user); loadProperties(session.user.id); loadSettings(session.user.id); }); }, []);
  function loadSettings(userId: string) { try { const raw = localStorage.getItem(`gs_settings_${userId}`); if (raw) { const s = JSON.parse(raw); setSettings(s); if (!s.onboardingDone) setShowOnboarding(true); } else setShowOnboarding(true); } catch { setShowOnboarding(true); } }
  function saveSettings(userId: string, s: UserSettings) { try { localStorage.setItem(`gs_settings_${userId}`, JSON.stringify(s)); } catch {} setSettings(s); }
  function handleOnboardingComplete(s: UserSettings) { saveSettings(user.id, s); setShowOnboarding(false); try { localStorage.removeItem(`gs_pmilestones_${user.id}`); localStorage.removeItem(`gs_cmilestones_${user.id}`); } catch {} }
  function handleSettingsSave(s: UserSettings) { saveSettings(user.id, s); setShowSettings(false); try { localStorage.removeItem(`gs_pmilestones_${user.id}`); localStorage.removeItem(`gs_cmilestones_${user.id}`); } catch {} }
  async function loadProperties(userId: string) { setLoading(true); const { data, error } = await supabase.from("properties").select("*").eq("user_id", userId).order("created_at", { ascending: true }); if (error) { console.error("Load error:", error); setLoading(false); return; } setProperties((data || []).map(fromDb)); setLoading(false); }
  async function handleLogout() { await supabase.auth.signOut(); window.location.href = "/auth"; }

  const GOAL_PORTFOLIO = settings.goalPortfolio; const GOAL_CASHFLOW = settings.goalCashFlow; const MILESTONE = GOAL_PORTFOLIO / 2;
  const totalValue = properties.reduce((s, p) => s + p.value, 0); const totalMortgage = properties.reduce((s, p) => s + p.mortgage, 0); const totalEquity = totalValue - totalMortgage;
  const totalRent = properties.reduce((s, p) => s + (isEffectivelyOccupied(p) ? p.rent : 0), 0); const totalExpenses = properties.reduce((s, p) => s + p.expenses, 0); const monthlyCashFlow = totalRent - totalExpenses;
  const portfolioPct = pct(totalValue, GOAL_PORTFOLIO); const milestonePct = pct(MILESTONE, GOAL_PORTFOLIO); const cashFlowPct = pct(monthlyCashFlow, GOAL_CASHFLOW);
  const avgAppreciation = properties.length > 0 ? properties.reduce((s, p) => s + p.appreciation, 0) / properties.length / 100 : 0.035;

  useEffect(() => {
    if (!user || !settings.onboardingDone || properties.length === 0) return;
    const name = settings.firstName || "You";
    const pm = checkMilestone(portfolioPct, PORTFOLIO_MILESTONES, `gs_pmilestones_${user.id}`);
    if (pm !== null) { if (pm === 100) setGoalReached({ type: "portfolio", label: fmt(GOAL_PORTFOLIO) }); else { const msg = MILESTONE_MESSAGES[pm]?.(name, fmt(GOAL_PORTFOLIO)); if (msg) setMilestoneToast(msg); } return; }
    const cm = checkMilestone(cashFlowPct, CASHFLOW_MILESTONES, `gs_cmilestones_${user.id}`);
    if (cm !== null) { if (cm === 100) setGoalReached({ type: "cashflow", label: `$${GOAL_CASHFLOW}/mo` }); else { const msg = MILESTONE_MESSAGES[cm]?.(name, `$${GOAL_CASHFLOW}/mo cash flow`); if (msg) setMilestoneToast(msg); } }
  }, [portfolioPct, cashFlowPct, user, settings, properties.length]);

  const { real: projReal, scen: projScen } = computeProjections(properties, scenario);
  const proj5Real = projReal[5]; const proj10Real = projReal[10]; const proj5Scen = projScen[5]; const proj10Scen = projScen[10];
  const scenApp = avgAppreciation + scenario.appreciationDelta / 100; const scenBaseValue = totalValue + scenario.extraProperties.reduce((s, p) => s + p.value, 0);
  const realMonthsTo1M = monthsToGoal(totalValue, avgAppreciation, MILESTONE); const realMonthsTo2M = monthsToGoal(totalValue, avgAppreciation, GOAL_PORTFOLIO);
  const scenMonthsTo1M = monthsToGoal(scenBaseValue, scenApp, MILESTONE); const scenMonthsTo2M = monthsToGoal(scenBaseValue, scenApp, GOAL_PORTFOLIO);
  const active = properties.find((p) => p.id === selected);

  function openAdd() { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }
  function openEdit(p: Property, e: React.MouseEvent) { e.stopPropagation(); setEditingId(p.id); setForm({ name: p.name, type: p.type, value: String(p.value), mortgage: String(p.mortgage), rent: String(p.rent), expenses: String(p.expenses), occupancyStatus: p.occupancyStatus, plannedDate: p.plannedDate, appreciation: String(p.appreciation), address: p.address, lat: String(p.lat), lng: String(p.lng), occupancyPct: String(p.occupancyPct ?? 100), soldPrice: String(p.soldPrice ?? ""), soldDate: p.soldDate ?? "", parentId: p.parentId ? String(p.parentId) : "", groupTag: p.groupTag ?? "" }); setShowForm(true); }
  const [addressSuggestions, setAddressSuggestions] = useState<{label:string;lat:number;lng:number;confidence:string}[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const geocodeDebounce = useRef<any>(null);

  async function geocodeAddress(address: string): Promise<{lat:number;lng:number;confidence:string}|null> {
    // Tier 1: Photon — street-level precision, free, no key
    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=5`, { headers: { "Accept-Language": "en" } });
      const data = await res.json();
      const features = data?.features;
      if (features?.length > 0) {
        const best = features[0];
        const [lng, lat] = best.geometry.coordinates;
        const type = best.properties?.type;
        if (type === "house" || type === "street") {
          return { lat, lng, confidence: "high" };
        }
        // Return top result anyway if decent
        if (lat && lng) return { lat, lng, confidence: "medium" };
      }
    } catch {}
    // Tier 2: Nominatim fallback
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`, { headers: { "Accept-Language": "en" } });
      const data = await res.json();
      if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), confidence: "medium" };
    } catch {}
    return null;
  }

  async function fetchAddressSuggestions(address: string) {
    if (address.length < 4) { setAddressSuggestions([]); setShowSuggestions(false); return; }
    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=5`, { headers: { "Accept-Language": "en" } });
      const data = await res.json();
      const features = data?.features || [];
      const suggestions = features.map((f: any) => {
        const p = f.properties;
        const label = [p.name, p.street, p.housenumber, p.city, p.state, p.country].filter(Boolean).join(", ");
        const [lng, lat] = f.geometry.coordinates;
        const confidence = (p.type === "house" || p.type === "street") ? "high" : "medium";
        return { label, lat, lng, confidence };
      }).filter((s: any) => s.label && s.lat);
      setAddressSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } catch {
      setAddressSuggestions([]); setShowSuggestions(false);
    }
  }

  function handleAddressChange(value: string) {
    setForm({ ...form, address: value, lat: "", lng: "" });
    clearTimeout(geocodeDebounce.current);
    geocodeDebounce.current = setTimeout(() => fetchAddressSuggestions(value), 350);
  }

  function selectSuggestion(s: {label:string;lat:number;lng:number;confidence:string}) {
    setForm({ ...form, address: s.label, lat: String(s.lat), lng: String(s.lng) });
    setShowSuggestions(false);
    setAddressSuggestions([]);
  }

  async function handleGeocodeClick() {
    if (!form.address) return;
    setGeocoding(true);
    const coords = await geocodeAddress(form.address);
    if (coords) setForm({ ...form, lat: String(coords.lat), lng: String(coords.lng) });
    setGeocoding(false);
  }
  async function handleSave() { const errors: Record<string, boolean> = {}; if (!form.name) errors.name = true; if (!form.value) errors.value = true; if (Object.keys(errors).length > 0) { setFormErrors(errors); return; } setFormErrors({}); setSaving(true); let lat = parseFloat(form.lat) || 29.7604; let lng = parseFloat(form.lng) || -95.3698; if (form.address && (!form.lat || !form.lng)) { const coords = await geocodeAddress(form.address); if (coords) { lat = coords.lat; lng = coords.lng; } } const data: Omit<Property, "id"> = { name: form.name, type: form.type, value: parseFloat(form.value) || 0, mortgage: parseFloat(form.mortgage) || 0, rent: parseFloat(form.rent) || 0, expenses: parseFloat(form.expenses) || 0, occupancyStatus: form.occupancyStatus, plannedDate: form.plannedDate, appreciation: parseFloat(form.appreciation) || 0, address: form.address, lat, lng, occupancyPct: parseFloat(form.occupancyPct) || 100, soldPrice: parseFloat(form.soldPrice) || 0, soldDate: form.soldDate || "", parentId: form.parentId ? parseInt(form.parentId) : null, groupTag: form.groupTag || "" }; if (editingId !== null) { const { error } = await supabase.from("properties").update(toDb(data)).eq("id", editingId); if (!error) setProperties(properties.map((p) => p.id === editingId ? { ...p, ...data } : p)); } else { const newId = Date.now(); const { error } = await supabase.from("properties").insert({ id: newId, ...toDb(data), user_id: user?.id }); if (!error) setProperties([...properties, { id: newId, ...data }]); } setSaving(false); setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }
  function handleDelete(id: number) { setConfirmDelete(id); }
  async function confirmDeleteNow() { if (confirmDelete === null) return; const { error } = await supabase.from("properties").delete().eq("id", confirmDelete); if (!error) { setProperties(properties.filter((p) => p.id !== confirmDelete)); if (selected === confirmDelete) setSelected(null); } setConfirmDelete(null); }
  function addScenarioProp() { setScenario(s => ({ ...s, extraProperties: [...s.extraProperties, { id: Date.now(), ...scenPropForm }] })); setShowAddScenarioProp(false); setScenPropForm({ ...EMPTY_SCENARIO_PROP, name: "Hypothetical Property" }); }
  async function fetchAiInsight() { setAiLoading(true); setAiInsight(""); try { const summary = { totalValue, totalEquity, monthlyCashFlow, properties: properties.length, avgAppreciation: (avgAppreciation * 100).toFixed(1), proj5: proj5Real?.value.toFixed(0), proj10: proj10Real?.value.toFixed(0), monthsTo1M: realMonthsTo1M === Infinity ? "never" : realMonthsTo1M, monthsTo2M: realMonthsTo2M === Infinity ? "never" : realMonthsTo2M }; const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: `You are a sharp real estate investment analyst. 3 specific data-driven insights, no fluff. Bold labels: **Velocity**, **Risk**, **Action**. Data: ${JSON.stringify(summary)}` }] }) }); const data = await res.json(); setAiInsight(data.content?.find((b: any) => b.type === "text")?.text || ""); } catch { setAiInsight("Unable to load insights."); } setAiLoading(false); }

  const CW = 600; const CH = 160; const allVals = [...projReal.map(p => p.value), ...(scenario.enabled ? projScen.map(p => p.value) : []), GOAL_PORTFOLIO]; const maxVal = Math.max(...allVals);
  const chartPts = (pts: typeof projReal) => pts.map((p, i) => `${(i / 10) * (CW - 40) + 20},${CH - 20 - ((p.value / maxVal) * (CH - 40))}`).join(" ");
  const goalY = CH - 20 - ((GOAL_PORTFOLIO / maxVal) * (CH - 40)); const mile1Y = CH - 20 - ((MILESTONE / maxVal) * (CH - 40));
  const IS: React.CSSProperties = { width: "100%", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", color: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const tabStyle = (t: string) => ({ padding: "8px 24px", borderRadius: "10px", fontSize: "11px", fontWeight: 700 as const, border: activeTab === t ? "1px solid rgba(245,166,35,0.6)" : "1px solid transparent", cursor: "pointer" as const, transition: "all 0.2s", background: activeTab === t ? "rgba(245,166,35,0.15)" : "transparent", color: activeTab === t ? "#f5a623" : "rgba(255,255,255,0.4)", display: "flex", flexDirection: "column" as const, alignItems: "center", gap: "4px", flex: 1, minWidth: "100px" });

  if (loading) return (<div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}><div style={{ width: "28px", height: "28px", background: "#f59e0b", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "800", color: "#000" }}>GS</div><p style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px", letterSpacing: "1px" }}>LOADING PORTFOLIO...</p></div>);

  const displayName = settings.firstName || user?.email?.split("@")[0] || "User";

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#fff", fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        select option { background: #0d0d0d; color: #fff; }
        @keyframes tPulse { 0%{transform:translate(-50%,-50%) scale(1);opacity:0.4} 100%{transform:translate(-50%,-50%) scale(2.8);opacity:0} }
        @keyframes phaseDone { 0%{box-shadow:0 0 0 0 rgba(52,211,153,0.8)} 50%{box-shadow:0 0 0 12px rgba(52,211,153,0)} 100%{box-shadow:0 0 0 0 rgba(52,211,153,0)} }
        @keyframes tickerScroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes slideUp { from{transform:translateX(-50%) translateY(20px);opacity:0} to{transform:translateX(-50%) translateY(0);opacity:1} }
        input[type="month"]::-webkit-calendar-picker-indicator { filter: invert(1) opacity(0.5); }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1) opacity(0.3); }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(245,166,35,0.2); border-radius: 999px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(245,166,35,0.4); }

        .gs-nav { display:flex; justify-content:space-between; align-items:center; padding:12px 40px; border-bottom:1px solid rgba(255,255,255,0.05); position:relative; z-index:10; gap:10px; background: rgba(8,8,8,0.95); backdrop-filter: blur(20px); }
        .gs-nav-user { display:flex; align-items:center; gap:10px; font-size:13px; color:rgba(255,255,255,0.4); }
        .gs-tabs { display:flex; gap:2px; background:rgba(255,255,255,0.03); border-radius:10px; padding:3px; border: 1px solid rgba(255,255,255,0.05); }

        @media (max-width: 768px) {
          .gs-nav { padding:12px 16px; flex-wrap:wrap; }
          .gs-nav-user { display:none !important; }
          .gs-tabs { order:3; width:100%; justify-content:stretch; }
          .gs-tabs button { flex:1; font-size:9px !important; padding:5px 2px !important; }
        }

        .gs-strip-desktop {
          display:grid; grid-template-columns:1.3fr 1.3fr 1fr 1fr 1.1fr 1.2fr auto;
          border-bottom:1px solid rgba(255,255,255,0.06);
          background:rgba(5,5,5,0.95);
          backdrop-filter:blur(20px);
          position:sticky; top:0; z-index:9; padding:0 32px;
          box-shadow:0 1px 0 rgba(245,166,35,0.08), 0 4px 24px rgba(0,0,0,0.5);
        }
        .gs-strip-desktop .strip-cell { display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; padding:11px 16px; border-right:1px solid rgba(255,255,255,0.05); gap:3px; }
        .gs-strip-desktop .strip-cell:last-child { border-right:none; }
        .gs-strip-goal-row { display:flex; align-items:center; gap:12px; padding:5px 32px; border-bottom:1px solid rgba(255,255,255,0.04); background:rgba(5,5,5,0.95); position:sticky; top:58px; z-index:8; }
        .gs-strip-label { font-size:9px; color:rgba(255,255,255,0.52); letter-spacing:1.5px; text-transform:uppercase; font-weight:700; display:flex; align-items:center; gap:5px; }
        .gs-strip-value { font-size:18px; font-weight:900; letter-spacing:-0.8px; line-height:1; }
        .gs-strip-sub { font-size:10px; color:rgba(255,255,255,0.55); margin-top:1px; font-weight:600; }
        .gs-strip-dot { width:5px; height:5px; border-radius:50%; background:#34d399; box-shadow:0 0 5px #34d399; animation:gsdotpulse 2s infinite; display:inline-block; }
        @keyframes gsdotpulse { 0%,100%{opacity:1} 50%{opacity:0.25} }

        .gs-strip-mobile { display:none; background:rgba(5,5,5,0.95); backdrop-filter:blur(20px); border-bottom:1px solid rgba(255,255,255,0.04); position:sticky; top:0; z-index:9; padding:10px 12px; }
        .gs-strip-mobile-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px; }
        .gs-strip-mobile-card { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:10px; padding:10px 12px; }
        .gs-strip-mobile-goal { padding:0 2px; }
        .gs-strip-mobile-goal-bar { height:3px; background:rgba(255,255,255,0.05); border-radius:999px; margin-top:4px; }

        @media (max-width: 768px) {
          .gs-strip-desktop { display:none !important; }
          .gs-strip-mobile { display:block !important; }
        }

        .gs-main { max-width:1140px; margin:0 auto; padding:36px 40px; position:relative; z-index:1; }
        @media (max-width:768px) { .gs-main { padding:16px 12px; } }

        .gs-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; }
        .gs-grid-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
        .gs-milestone-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
        .gs-scenario-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }

        @media (max-width:768px) {
          .gs-grid-2 { grid-template-columns:1fr !important; }
          .gs-grid-4 { grid-template-columns:1fr 1fr !important; }
          .gs-milestone-grid { grid-template-columns:1fr 1fr !important; }
          .gs-scenario-grid { grid-template-columns:1fr !important; }
          .gs-detail-grid { grid-template-columns:1fr 1fr !important; }
        }

        .gs-table-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; }
        .gs-table { min-width:580px; }
        @media (max-width:768px) { .gs-map { height:280px !important; } }

        .gs-section-header { display:flex; justify-content:space-between; align-items:center; }
        @media (max-width:600px) { .gs-section-header { flex-direction:column; gap:10px; align-items:flex-start !important; } }

        .gs-modal { background:#0a0a0a; border:1px solid rgba(255,255,255,0.08); border-radius:24px; padding:36px; width:100%; max-width:500px; max-height:90vh; overflow-y:auto; box-shadow: 0 40px 80px rgba(0,0,0,0.7); }
        .gs-modal-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        @media (max-width:600px) { .gs-modal { padding:20px 16px !important; margin:0 8px; } .gs-modal-grid { grid-template-columns:1fr !important; } }

        .gs-goal-value { font-size:38px; }
        @media (max-width:768px) { .gs-goal-value { font-size:26px !important; } }
        @media (max-width:480px) { .gs-goal-value { font-size:22px !important; } }

        .gs-map-header { margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; }
        @media (max-width:600px) { .gs-map-header { flex-direction:column; gap:10px; align-items:flex-start; } }

        .gs-card { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06); border-radius: 18px; transition: border-color 0.2s; }
        .gs-card:hover { border-color: rgba(255,255,255,0.1); }
        .gs-kpi-card { background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 20px; transition: all 0.2s; }
        .gs-kpi-card:hover { border-color: rgba(245,166,35,0.15); background: rgba(255,255,255,0.035); }
        .gs-section-label { font-size: 9px; color: rgba(255,255,255,0.25); letter-spacing: 2px; text-transform: uppercase; font-weight: 700; }
        .gs-btn-primary { padding: 9px 20px; background: #f5a623; color: #000; border-radius: 9px; font-weight: 800; font-size: 12px; border: none; cursor: pointer; letter-spacing: 0.3px; transition: opacity 0.15s; }
        .gs-btn-primary:hover { opacity: 0.88; }
        .gs-btn-ghost { padding: 7px 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: rgba(255,255,255,0.4); font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
        .gs-btn-ghost:hover { border-color: rgba(255,255,255,0.15); color: rgba(255,255,255,0.6); }
        tr.gs-table-row:hover td { background: rgba(245,166,35,0.025) !important; }
      `}</style>

      {showOnboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}
      {showProfile && (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "20px" }} onClick={() => setShowProfile(false)}>
    <div style={{ width: "100%", maxWidth: "520px", maxHeight: "80vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
      <ReferralPanel userName={settings.firstName || "You"} userCode={`${(settings.firstName || "USER").toUpperCase().slice(0,4)}-X7K2`} referralCount={0} proReferrals={[]} freeDaysEarned={0} />
    </div>
  </div>
)}
      {showSettings && <SettingsModal settings={settings} onSave={handleSettingsSave} onClose={() => setShowSettings(false)} />}
      {milestoneToast && <MilestoneToast message={milestoneToast} onClose={() => setMilestoneToast(null)} />}
      {goalReached && (<GoalReachedOverlay name={settings.firstName || "Champion"} goalLabel={goalReached.label} goalType={goalReached.type} onNewGoal={(val) => { const ns = { ...settings, [goalReached.type === "portfolio" ? "goalPortfolio" : "goalCashFlow"]: val }; handleSettingsSave(ns); setGoalReached(null); }} onDismiss={() => setGoalReached(null)} />)}
      <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "800px", height: "300px", background: "radial-gradient(ellipse at top,rgba(251,191,36,0.05) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <nav className="gs-nav">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "28px", height: "28px", background: "#f59e0b", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "800", color: "#000", flexShrink: 0 }}>GS</div>
          <span style={{ fontSize: "15px", fontWeight: "700", letterSpacing: "-0.3px" }}>GOLDSTREAM</span>
          <span style={{ fontSize: "9px", fontWeight: "600", color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "4px", padding: "2px 6px", flexShrink: 0 }}>BETA</span>
        </div>
        <div className="gs-tabs">
  {([
    { key: "home",        label: "Home",         svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
    { key: "finddeals",   label: "Find Deals",   svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
    { key: "myprojects",  label: "My Projects",  svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
    { key: "getfinanced", label: "Get Financed", svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
    { key: "community",   label: "Community",    svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  ] as const).map(({ key, label, svg }) => (
    <button key={key} onClick={() => setActiveTab(key)} style={tabStyle(key)} onMouseEnter={e => { if (activeTab !== key) { e.currentTarget.style.color = "rgba(245,166,35,0.7)"; }}} onMouseLeave={e => { if (activeTab !== key) { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}}>
      <span style={{ lineHeight: 1 }}>{svg}</span>
      <span style={{ fontSize: "12px", letterSpacing: "0.4px", fontWeight: 600, textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>{label}</span>
    </button>
  ))}
</div>
        <div className="gs-nav-user">
          <TierBadge portfolioValue={totalValue} size="sm" />
          <NotificationBell user={user} properties={properties} />
          <div style={{ position: "relative" }}>
            <div onClick={() => setShowProfileMenu(p => !p)} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 8px", cursor: "pointer", height: "36px" }}>
              <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b", fontWeight: "800", fontSize: "11px" }}>{(settings.firstName?.[0] || user?.email?.[0] || "U").toUpperCase()}</div>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "rgba(255,255,255,0.6)" }}>{displayName}</span>
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>v</span>
            </div>
            {showProfileMenu && (
              <div style={{ position: "absolute", top: "46px", right: 0, width: "220px", background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px", padding: "6px", zIndex: 200, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
                <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: "4px" }}>
                  <p style={{ fontSize: "14px", fontWeight: "800", color: "#fff" }}>{displayName}</p>
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "3px" }}>{user?.email}</p>
                </div>
                {[
                  { label: "Goals and Settings", action: () => { setShowSettings(true); setShowProfileMenu(false); }, color: "rgba(255,255,255,0.7)" },
                  { label: "Referral Program", action: () => { setShowProfile(true); setShowProfileMenu(false); }, color: "#f59e0b" },
                  { label: "Log out", action: handleLogout, color: "#f87171" },
                ].map(item => (
                  <button key={item.label} onClick={item.action} style={{ width: "100%", padding: "9px 12px", background: "none", border: "none", borderRadius: "8px", color: item.color, fontSize: "12px", fontWeight: "600", cursor: "pointer", textAlign: "left" as const, display: "block" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="gs-strip-desktop">
        {[
          { label: "Portfolio", value: fmt(totalValue), color: "#f59e0b", sub: `? ${portfolioPct.toFixed(1)}% to ${fmt(GOAL_PORTFOLIO)}`, subColor: "#22d97a", glow: "rgba(245,158,11,0.15)" },
          { label: "Net Cash Flow", value: `${monthlyCashFlow >= 0 ? "+" : ""}${fmtFull(monthlyCashFlow)}/mo`, color: monthlyCashFlow >= 0 ? "#34d399" : "#f87171", sub: `? ${cashFlowPct.toFixed(1)}% to goal`, subColor: "#22d97a", glow: "rgba(52,211,153,0.1)" },
          { label: "Occupancy", value: `${properties.length > 0 ? Math.round(properties.filter(p => p.occupancyStatus === "occupied").length / properties.length * 100) : 0}%`, color: "#60a5fa", sub: `${properties.filter(p => p.occupancyStatus === "occupied").length} of ${properties.length} occupied`, glow: "rgba(96,165,250,0.08)" },
          { label: "Properties", value: String(properties.length), color: "#fff", sub: `${properties.filter(p => p.occupancyStatus === "occupied").length} active`, glow: "rgba(255,255,255,0.04)" },
          { label: "Investor Rank", value: `#${Math.max(1, 247 - Math.floor(properties.length * 3))}`, color: "#f59e0b", sub: `Top ${Math.max(1, 12 - properties.length)}% · Builder II`, glow: "rgba(245,158,11,0.08)" },
        ].map((m: any) => (
          <div key={m.label} className="strip-cell">
            <span className="gs-strip-label">{m.label}</span>
            <span className="gs-strip-value" style={{ color: m.color }}>{m.value}</span>
            <span className="gs-strip-sub" style={{ color: (m as any).subColor || undefined }}>{m.sub}</span>
          </div>
        ))}
        <div className="strip-cell" style={{ borderLeft: "1px solid rgba(52,211,153,0.12)", alignItems: "center", justifyContent: "center" }}>
          
          <LiveIncomeCounter monthlyCashFlow={monthlyCashFlow} />
        </div>
        <div className="strip-cell" style={{ alignItems: "center", justifyContent: "center", borderRight: "none" }}>
          <div style={{ display:"flex", gap:"6px" }}><button onClick={() => { setActiveTab("home"); openAdd(); }} style={{ padding: "7px 11px", background: "rgba(245,158,11,0.12)", color: "#f59e0b", borderRadius: "7px", fontWeight: "800", fontSize: "10px", border: "1px solid rgba(245,158,11,0.3)", cursor: "pointer", whiteSpace: "nowrap" }}>+ Property</button><button onClick={() => { setActiveTab("myprojects"); setTimeout(() => { const btn = document.querySelector("[data-new-project]") as HTMLButtonElement; if(btn) btn.click(); }, 300); }} style={{ padding: "7px 11px", background: "rgba(167,139,250,0.12)", color: "#a78bfa", borderRadius: "7px", fontWeight: "800", fontSize: "10px", border: "1px solid rgba(167,139,250,0.3)", cursor: "pointer", whiteSpace: "nowrap" }}>+ Project</button></div>
        </div>
      </div>

      <div className="gs-strip-goal-row">
        <span style={{ fontSize: "8px", letterSpacing: "1.5px", textTransform: "uppercase", color: "#f59e0b", fontWeight: "700", whiteSpace: "nowrap" }}>Portfolio goal</span>
        <div style={{ flex: 1, height: "2px", background: "rgba(255,255,255,0.06)", borderRadius: "999px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, portfolioPct)}%`, background: "#f59e0b", borderRadius: "999px", transition: "width 1s" }} />
        </div>
        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.7)", fontWeight: "700", whiteSpace: "nowrap" }}>{fmt(totalValue)} / {fmt(GOAL_PORTFOLIO)} <span style={{ color: "#f59e0b", fontWeight: "800" }}>{portfolioPct.toFixed(1)}%</span></span>
        <div style={{ width: "1px", height: "10px", background: "rgba(255,255,255,0.08)" }} />
        <span style={{ fontSize: "8px", letterSpacing: "1.5px", textTransform: "uppercase", color: "#34d399", fontWeight: "700", whiteSpace: "nowrap" }}>Cash flow goal</span>
        <div style={{ flex: 1, height: "2px", background: "rgba(255,255,255,0.06)", borderRadius: "999px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, cashFlowPct)}%`, background: "#34d399", borderRadius: "999px", transition: "width 1s" }} />
        </div>
        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.7)", fontWeight: "700", whiteSpace: "nowrap" }}>{fmtFull(monthlyCashFlow)}/mo / ${GOAL_CASHFLOW.toLocaleString()} <span style={{ color: "#34d399", fontWeight: "800" }}>{cashFlowPct.toFixed(1)}%</span></span>
      </div>

      <div className="gs-strip-mobile">
        <div className="gs-strip-mobile-grid">{[{ label: "Portfolio", value: fmt(totalValue), color: "#f59e0b", sub: `${portfolioPct.toFixed(1)}% to ${fmt(GOAL_PORTFOLIO)}` }, { label: "Cash Flow", value: `${monthlyCashFlow >= 0 ? "+" : ""}${fmtFull(monthlyCashFlow)}/mo`, color: monthlyCashFlow >= 0 ? "#34d399" : "#f87171", sub: `${cashFlowPct.toFixed(1)}% to goal` }, { label: "Equity", value: fmtFull(totalEquity), color: "#f59e0b", sub: "net owned" }, { label: "Properties", value: `${properties.length} total`, color: "#fff", sub: `${properties.filter(p => p.occupancyStatus === "occupied").length} occupied` }].map((m) => (<div key={m.label} className="gs-strip-mobile-card"><div className="gs-strip-label">{m.label}</div><div style={{ fontSize: "16px", fontWeight: "800", color: m.color, marginTop: "3px", letterSpacing: "-0.3px" }}>{m.value}</div><div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "2px" }}>{m.sub}</div></div>))}</div>
        <div className="gs-strip-mobile-goal"><div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}><span className="gs-strip-label">Portfolio Goal</span><span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{portfolioPct.toFixed(1)}% of {fmt(GOAL_PORTFOLIO)}</span></div><div className="gs-strip-mobile-goal-bar"><div style={{ height: "100%", width: `${portfolioPct}%`, background: "#f59e0b", borderRadius: "999px", boxShadow: "0 0 6px rgba(245,158,11,0.5)", transition: "width 0.8s" }} /></div></div>
      </div>

      <div className="gs-main">
        {activeTab === "home" && <>
          <div className="gs-grid-2">
            <GoalCard label="Portfolio Value" p={portfolioPct} milestonePct={milestonePct} value={fmt(totalValue)} sub={`of ${fmt(GOAL_PORTFOLIO)} vision`} pctLabel={`${portfolioPct.toFixed(1)}% to ${fmt(GOAL_PORTFOLIO)}`} barColor="#f59e0b" glow="rgba(245,158,11,0.4)" min="$0" mid={fmt(MILESTONE)} max={fmt(GOAL_PORTFOLIO)} onEdit={() => setShowSettings(true)} nextGap={([250000,500000,750000,1000000,1500000,2000000,3000000,5000000].find(m => m > totalValue) || GOAL_PORTFOLIO) - totalValue} nextTarget={fmt([250000,500000,750000,1000000,1500000,2000000,3000000,5000000].find(m => m > totalValue) || GOAL_PORTFOLIO)} />
            <GoalCard label="Monthly Cash Flow" p={cashFlowPct} value={`${monthlyCashFlow >= 0 ? "+" : ""}${fmtFull(monthlyCashFlow)}`} valueColor={monthlyCashFlow >= 0 ? "#34d399" : "#f87171"} sub={`of $${GOAL_CASHFLOW.toLocaleString()}/mo target`} pctLabel={`${cashFlowPct.toFixed(1)}% to $${GOAL_CASHFLOW.toLocaleString()}`} barColor={monthlyCashFlow >= 0 ? "#34d399" : "#f87171"} glow={monthlyCashFlow >= 0 ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"} min="$0" max={`$${GOAL_CASHFLOW.toLocaleString()}/mo`} onEdit={() => setShowSettings(true)} nextGap={([500,1000,2000,3000,5000,10000].find(m => m > monthlyCashFlow) || GOAL_CASHFLOW) - monthlyCashFlow} nextTarget={`$${([500,1000,2000,3000,5000,10000].find(m => m > monthlyCashFlow) || GOAL_CASHFLOW).toLocaleString()}/mo`} />
          </div>
          <div className="gs-grid-4">{[{ label: "Total Equity", value: fmtFull(totalEquity), color: "#f5a623", sub: "net owned value" }, { label: "Gross Rent", value: fmtFull(totalRent) + "/mo", color: "#fff", sub: "monthly income" }, { label: "Total Expenses", value: fmtFull(totalExpenses) + "/mo", color: "#f87171", sub: "monthly outflow" }, { label: "Properties", value: String(properties.length), color: "#fff", sub: `${properties.filter(p => p.occupancyStatus === "occupied").length} occupied` }].map((m: any) => (<div key={m.label} className="gs-kpi-card"><p style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)", letterSpacing: "1.8px", textTransform: "uppercase", marginBottom: "10px", fontWeight: "700" }}>{m.label}</p><p style={{ fontSize: "24px", fontWeight: "900", color: m.color, letterSpacing: "-0.5px", lineHeight: 1 }}>{m.value}</p><p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "6px" }}>{m.sub}</p></div>))}</div>
          
          <div style={{ display:"flex", gap:"8px", marginBottom:"16px", flexWrap:"wrap" as const }}>
  {([
    { key:"properties",   label:"Properties"   },
    { key:"finances",     label:"Finances"     },
    { key:"score",        label:"My Score"     },
    { key:"intelligence", label:"Intelligence" },
    { key:"projections",  label:"Projections"  },
  ] as const).map(({key, label}) => (
    <button key={key} onClick={() => setHomeSection(homeSection === key ? null : key)} style={{ padding:"10px 20px", borderRadius:"10px", fontSize:"12px", fontWeight:"700", border:`1px solid ${homeSection===key ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)"}`, background: homeSection===key ? "rgba(245,158,11,0.14)" : "rgba(255,255,255,0.03)", color: homeSection===key ? "#f59e0b" : "rgba(255,255,255,0.4)", cursor:"pointer" }}>{label}</button>
  ))}
</div>
{homeSection === "score" && <><TierPanel totalValue={totalValue} monthlyCashFlow={monthlyCashFlow} properties={properties} />
          <IntelligenceScore
  userName="Marcus"
  userCity="Houston, TX"
  score={634}
  tier="Builder II"
  nextTier="Architect"
  nextTierThreshold={800}
  streakDays={14}
  percentile={23}
  insight="<b>Your market intel is low.</b> One brief this week pushes you to Builder III."
  nextActions={[
    { pts: 85,  label: "Add your second property", category: "Portfolio", href: "/dashboard/properties/add" },
    { pts: 120, label: "Verify your identity",      category: "Trust",    href: "/dashboard/verify" },
    { pts: 40,  label: "Post in community",         category: "Social",   href: "/community" },
  ]}
  categories={[
    { name: "Portfolio",    pts: 210, max: 300, color: "#BA7517" },
    { name: "Verification", pts: 160, max: 200, color: "#1D9E75" },
    { name: "Market intel", pts: 95,  max: 200, color: "#378ADD" },
    { name: "Community",    pts: 88,  max: 180, color: "#7F77DD" },
    { name: "Engagement",   pts: 81,  max: 120, color: "#D85A30" },
  ]}
  weeklyHistory={[430, 462, 478, 510, 558, 601, 634]}
  rivalName="JordanV."
  rivalDelta={12}
  onLeaderboardClick={() => {}}
/></>}
{homeSection === "intelligence" && <PortfolioIntelligence properties={properties} totalEquity={totalEquity} monthlyCashFlow={monthlyCashFlow} totalValue={totalValue} settings={settings} />}
{homeSection === "finances" && <FinancesTab properties={properties} user={user} />} 
          {homeSection === "properties" && <><MapSection properties={properties} selected={selected} onSelect={(id) => setSelected(selected === id ? null : id)} />
          <PropertyTable properties={properties} selected={selected} onSelect={setSelected} onEdit={openEdit} onDelete={handleDelete} onAdd={openAdd} onCompare={() => setShowCompare(true)} />
          <div id="gs-detail-anchor" />
          {active && <PropertyDetail property={active} onEdit={openEdit} onClose={() => setSelected(null)} />}</>}
        </>}



        {activeTab === "home" && homeSection === "projections" && <>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px", padding: "24px", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: scenario.enabled ? "20px" : "0", flexWrap: "wrap", gap: "10px" }}><div><h2 style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase" }}>Scenario Builder</h2><p style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", marginTop: "4px" }}>Simulate changes to see impact on your projections</p></div><button onClick={() => setScenario(s => ({ ...s, enabled: !s.enabled }))} style={{ fontSize: "12px", padding: "8px 18px", background: scenario.enabled ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.06)", border: `1px solid ${scenario.enabled ? "rgba(96,165,250,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: "8px", color: scenario.enabled ? "#60a5fa" : "rgba(255,255,255,0.5)", cursor: "pointer", fontWeight: "700" }}>{scenario.enabled ? "▶ Scenario ON" : "▶ Run Scenario"}</button></div>
            {scenario.enabled && (<div style={{ display: "flex", flexDirection: "column", gap: "16px" }}><div className="gs-scenario-grid"><div><label style={LS}>Appreciation Adjustment (%/yr)</label><div style={{ display: "flex", alignItems: "center", gap: "10px" }}><input type="range" min="-3" max="5" step="0.5" value={scenario.appreciationDelta} onChange={(e) => setScenario(s => ({ ...s, appreciationDelta: parseFloat(e.target.value) }))} style={{ flex: 1, accentColor: "#60a5fa" }} /><span style={{ fontSize: "14px", fontWeight: "800", color: "#60a5fa", minWidth: "44px", textAlign: "right" }}>{scenario.appreciationDelta > 0 ? "+" : ""}{scenario.appreciationDelta}%</span></div><p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "4px" }}>Real avg: {(avgAppreciation * 100).toFixed(1)}% → Scenario: {((avgAppreciation + scenario.appreciationDelta / 100) * 100).toFixed(1)}%</p></div><div><label style={LS}>Market Mortgage Rate (%)</label><div style={{ display: "flex", alignItems: "center", gap: "10px" }}><input type="range" min="3" max="10" step="0.25" value={scenario.marketRate} onChange={(e) => setScenario(s => ({ ...s, marketRate: parseFloat(e.target.value) }))} style={{ flex: 1, accentColor: "#60a5fa" }} /><span style={{ fontSize: "14px", fontWeight: "800", color: "#60a5fa", minWidth: "44px", textAlign: "right" }}>{scenario.marketRate}%</span></div></div></div><div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}><label style={{ ...LS, marginBottom: 0 }}>Hypothetical Properties</label><button onClick={() => setShowAddScenarioProp(true)} style={{ fontSize: "11px", padding: "5px 12px", background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: "6px", color: "#60a5fa", cursor: "pointer", fontWeight: "700" }}>+ Add</button></div>{scenario.extraProperties.length === 0 ? (<div style={{ padding: "16px", textAlign: "center", border: "1px dashed rgba(255,255,255,0.06)", borderRadius: "10px", fontSize: "12px", color: "rgba(255,255,255,0.2)" }}>No hypothetical properties yet</div>) : (<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{scenario.extraProperties.map((sp) => (<div key={sp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: "10px", padding: "12px 16px" }}><div><p style={{ fontSize: "13px", fontWeight: "700", color: "#60a5fa" }}>{sp.name}</p><p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>{fmtFull(sp.value)} · +{fmtFull(sp.rent - sp.expenses)}/mo · {sp.appreciation}%/yr</p></div><button onClick={() => setScenario(s => ({ ...s, extraProperties: s.extraProperties.filter(p => p.id !== sp.id) }))} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "18px" }}>×</button></div>))}</div>)}</div></div>)}
          </div>
          <div className="gs-milestone-grid">{[{ label: `To ${fmt(MILESTONE)}`, real: fmtTime(realMonthsTo1M), scen: fmtTime(scenMonthsTo1M), delta: realMonthsTo1M === Infinity ? 0 : realMonthsTo1M - scenMonthsTo1M, isTime: true, done: realMonthsTo1M === 0 }, { label: `To ${fmt(GOAL_PORTFOLIO)}`, real: fmtTime(realMonthsTo2M), scen: fmtTime(scenMonthsTo2M), delta: realMonthsTo2M === Infinity ? 0 : realMonthsTo2M - scenMonthsTo2M, isTime: true, done: realMonthsTo2M === 0 }, { label: "5-Year Portfolio", real: proj5Real ? fmt(proj5Real.value) : "—", scen: proj5Scen ? fmt(proj5Scen.value) : "—", delta: proj5Real && proj5Scen ? proj5Scen.value - proj5Real.value : 0 }, { label: "10-Year Portfolio", real: proj10Real ? fmt(proj10Real.value) : "—", scen: proj10Scen ? fmt(proj10Scen.value) : "—", delta: proj10Real && proj10Scen ? proj10Scen.value - proj10Real.value : 0 }].map((m: any) => (<div key={m.label} style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "22px", position: "relative", overflow: "hidden" }}><div style={{ position: "absolute", top: 0, right: 0, width: "80px", height: "80px", background: m.done ? "radial-gradient(circle at top right, rgba(52,211,153,0.06), transparent 70%)" : "radial-gradient(circle at top right, rgba(245,166,35,0.06), transparent 70%)", pointerEvents: "none" }} /><p style={{ fontSize: "8px", color: "rgba(255,255,255,0.25)", letterSpacing: "1.8px", textTransform: "uppercase", marginBottom: "10px", fontWeight: "700" }}>{m.label}</p><p style={{ fontSize: "28px", fontWeight: "900", color: m.done ? "#34d399" : "#f5a623", letterSpacing: "-1px", lineHeight: 1 }}>{m.real}</p>{scenario.enabled && (<div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.05)" }}><p style={{ fontSize: "14px", fontWeight: "800", color: "#60a5fa" }}>{m.scen}</p>{m.delta !== 0 && <p style={{ fontSize: "10px", marginTop: "4px", color: m.delta > 0 ? "#34d399" : "#f87171", fontWeight: "700" }}>{m.isTime ? (m.delta > 0 ? `▲ ${Math.abs(Math.ceil(m.delta / 12))}yr faster` : `▼ ${Math.abs(Math.ceil(m.delta / 12))}yr slower`) : (m.delta > 0 ? `+${fmt(m.delta)}` : `-${fmt(Math.abs(m.delta))}`)}</p>}</div>)}</div>))}</div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px", padding: "28px", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}><h2 style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase" }}>10-Year Value Projection</h2><div style={{ display: "flex", gap: "16px", fontSize: "11px" }}><div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: "20px", height: "2px", background: "#f59e0b" }} /><span style={{ color: "rgba(255,255,255,0.4)" }}>Real</span></div>{scenario.enabled && <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: "20px", height: "2px", background: "#60a5fa" }} /><span style={{ color: "rgba(255,255,255,0.4)" }}>Scenario</span></div>}</div></div>
            <div style={{ overflowX: "auto" }}><svg viewBox={`0 0 ${CW} ${CH}`} style={{ width: "100%", minWidth: "320px", height: "auto" }}><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" /><stop offset="100%" stopColor="#f59e0b" stopOpacity="0" /></linearGradient><linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60a5fa" stopOpacity="0.1" /><stop offset="100%" stopColor="#60a5fa" stopOpacity="0" /></linearGradient></defs><line x1="20" y1={goalY} x2={CW - 20} y2={goalY} stroke="rgba(245,158,11,0.2)" strokeWidth="1" strokeDasharray="4,4" /><text x={CW - 22} y={goalY - 4} fill="rgba(245,158,11,0.5)" fontSize="9" textAnchor="end">{fmt(GOAL_PORTFOLIO)} Goal</text><line x1="20" y1={mile1Y} x2={CW - 20} y2={mile1Y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4,4" /><text x={CW - 22} y={mile1Y - 4} fill="rgba(255,255,255,0.2)" fontSize="9" textAnchor="end">{fmt(MILESTONE)}</text><polygon points={`20,${CH - 20} ${chartPts(projReal)} ${CW - 20},${CH - 20}`} fill="url(#ag)" /><polyline points={chartPts(projReal)} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinejoin="round" />{scenario.enabled && <><polygon points={`20,${CH - 20} ${chartPts(projScen)} ${CW - 20},${CH - 20}`} fill="url(#bg2)" /><polyline points={chartPts(projScen)} fill="none" stroke="#60a5fa" strokeWidth="2" strokeDasharray="6,3" strokeLinejoin="round" /></>}<line x1="20" y1="8" x2="20" y2={CH - 20} stroke="rgba(245,158,11,0.35)" strokeWidth="1.5" strokeDasharray="3,3" /><g><rect x="4" y="4" width="38" height="14" rx="3" fill="rgba(245,158,11,0.15)" stroke="rgba(245,158,11,0.4)" strokeWidth="1" /><text x="23" y="14" fill="#f59e0b" fontSize="7.5" textAnchor="middle" fontWeight="700">TODAY</text></g>{[5, 10].map((yr) => { const rp = projReal[yr]; const x = (yr / 10) * (CW - 40) + 20; const y = CH - 20 - ((rp.value / maxVal) * (CH - 40)); return <g key={yr}><circle cx={x} cy={y} r="4" fill="#f59e0b" /><text x={x} y={y - 10} fill="rgba(255,255,255,0.45)" fontSize="9" textAnchor="middle">{fmt(rp.value)}</text></g>; })}{scenario.enabled && [5, 10].map((yr) => { const sp = projScen[yr]; const x = (yr / 10) * (CW - 40) + 20; const y = CH - 20 - ((sp.value / maxVal) * (CH - 40)); return <g key={`s${yr}`}><circle cx={x} cy={y} r="4" fill="#60a5fa" /><text x={x} y={y - 10} fill="rgba(96,165,250,0.7)" fontSize="9" textAnchor="middle">{fmt(sp.value)}</text></g>; })}{[0, 2, 4, 6, 8, 10].map((yr) => <text key={yr} x={(yr / 10) * (CW - 40) + 20} y={CH - 4} fill="rgba(255,255,255,0.18)" fontSize="9" textAnchor="middle">Y{yr}</text>)}</svg></div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}><div><h2 style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase" }}>AI Portfolio Analysis</h2><p style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", marginTop: "4px" }}>Velocity · Risk · Next move</p></div><button onClick={fetchAiInsight} disabled={aiLoading} style={{ fontSize: "12px", padding: "8px 18px", background: aiLoading ? "rgba(245,158,11,0.15)" : "#f59e0b", color: aiLoading ? "#f59e0b" : "#000", borderRadius: "8px", fontWeight: "700", border: "none", cursor: aiLoading ? "not-allowed" : "pointer" }}>{aiLoading ? "Analyzing..." : "Run Analysis"}</button></div>
            {aiInsight ? (<div style={{ fontSize: "13px", lineHeight: "1.7", color: "rgba(255,255,255,0.6)" }}>{aiInsight.split("\n").map((line, i) => { const m = line.match(/^\*\*(.*?)\*\*(.*)/); if (m) return <p key={i} style={{ marginBottom: "12px" }}><span style={{ color: "#f59e0b", fontWeight: "700" }}>{m[1]}</span><span>{m[2]}</span></p>; return line ? <p key={i} style={{ marginBottom: "10px" }}>{line}</p> : null; })}</div>) : (<div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.15)", fontSize: "13px", border: "1px dashed rgba(255,255,255,0.06)", borderRadius: "12px" }}>Click "Run Analysis" to get AI-powered insights on your portfolio.</div>)}
          </div>
        </>}

      {activeTab === "finddeals" && <FindDealsTab user={user} incomingListing={incomingListing} setActiveTab={setActiveTab} setIncomingListing={setIncomingListing} setIncomingFinancing={setIncomingFinancing} />}
{activeTab === "myprojects" && <MyProjectsTab user={user} properties={properties} />}
{activeTab === "getfinanced" && <GetFinancedTab properties={properties} user={user} incomingListing={incomingListing} />}
{activeTab === "community" && (
  <>
  <CommunityFeed
    currentUserId="your-user-id"
    currentUserName="Marcus"
    currentUserTier="Builder II"
    currentUserVerified={true}
  />
  </>
)}

      </div>

      {showCompare && (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: "20px" }}>
    <div style={{ background: "#0a0a0a", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "24px", padding: "36px", width: "90vw", maxWidth: "1100px", height: "88vh", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
        <div><p style={{ fontSize: "9px", color: "#f59e0b", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "6px" }}>Property Intelligence</p><h2 style={{ fontSize: "24px", fontWeight: "900", letterSpacing: "-0.5px" }}>Compare Assets</h2></div>
        <button onClick={() => setShowCompare(false)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "18px", width: "36px", height: "36px" }}>×</button>
      </div>
      <CompareModal properties={properties} />
    </div>
  </div>
)}
{confirmDelete !== null && (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: "20px" }}><div style={{ background: "#0f0f0f", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "20px", padding: "36px", width: "100%", maxWidth: "380px", textAlign: "center" }}><div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: "22px" }}>⚠</div><h3 style={{ fontSize: "17px", fontWeight: "800", marginBottom: "8px" }}>Delete Property?</h3><p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "28px", lineHeight: "1.5" }}>Permanently remove <span style={{ color: "#fff", fontWeight: "600" }}>{properties.find(p => p.id === confirmDelete)?.name}</span> from your portfolio.</p><div style={{ display: "flex", gap: "10px" }}><button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: "12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "13px", color: "rgba(255,255,255,0.4)", background: "none", cursor: "pointer", fontWeight: "600" }}>Cancel</button><button onClick={confirmDeleteNow} style={{ flex: 1, padding: "12px", background: "#ef4444", color: "#fff", borderRadius: "10px", fontSize: "13px", fontWeight: "800", border: "none", cursor: "pointer" }}>Yes, Delete</button></div></div></div>)}
      {showAddScenarioProp && (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: "20px" }}><div className="gs-modal" style={{ border: "1px solid rgba(96,165,250,0.25)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}><h2 style={{ fontSize: "17px", fontWeight: "800", color: "#60a5fa" }}>Add Hypothetical Property</h2><button onClick={() => setShowAddScenarioProp(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "22px" }}>×</button></div><div style={{ display: "flex", flexDirection: "column", gap: "14px" }}><Field label="Name"><input type="text" value={scenPropForm.name} onChange={e => setScenPropForm(f => ({ ...f, name: e.target.value }))} style={IS} /></Field><div className="gs-modal-grid"><Field label="Market Value ($)"><NumberInput value={String(scenPropForm.value || "")} onChange={v => setScenPropForm(f => ({ ...f, value: parseFloat(v) || 0 }))} placeholder="300,000" style={IS} /></Field><Field label="Mortgage ($)"><NumberInput value={String(scenPropForm.mortgage || "")} onChange={v => setScenPropForm(f => ({ ...f, mortgage: parseFloat(v) || 0 }))} placeholder="240,000" style={IS} /></Field></div><div className="gs-modal-grid"><Field label="Monthly Rent ($)"><NumberInput value={String(scenPropForm.rent || "")} onChange={v => setScenPropForm(f => ({ ...f, rent: parseFloat(v) || 0 }))} placeholder="2,000" style={IS} /></Field><Field label="Monthly Expenses ($)"><NumberInput value={String(scenPropForm.expenses || "")} onChange={v => setScenPropForm(f => ({ ...f, expenses: parseFloat(v) || 0 }))} placeholder="400" style={IS} /></Field></div><Field label="Appreciation %/yr"><input type="number" placeholder="3.5" value={scenPropForm.appreciation} onChange={e => setScenPropForm(f => ({ ...f, appreciation: parseFloat(e.target.value) || 3.5 }))} style={IS} /></Field></div><div style={{ display: "flex", gap: "10px", marginTop: "24px" }}><button onClick={() => setShowAddScenarioProp(false)} style={{ flex: 1, padding: "12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "13px", color: "rgba(255,255,255,0.4)", background: "none", cursor: "pointer", fontWeight: "600" }}>Cancel</button><button onClick={addScenarioProp} style={{ flex: 1, padding: "12px", background: "#60a5fa", color: "#000", borderRadius: "10px", fontSize: "13px", fontWeight: "800", border: "none", cursor: "pointer" }}>Add to Scenario</button></div></div></div>)}
      {showForm && (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "20px" }}><div className="gs-modal"><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}><h2 style={{ fontSize: "18px", fontWeight: "800" }}>{editingId !== null ? "Edit Property" : "Add Property"}</h2><button onClick={() => { setShowForm(false); setEditingId(null); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "22px" }}>×</button></div><div style={{ display: "flex", flexDirection: "column", gap: "14px" }}><Field label="Property Name"><input type="text" placeholder="e.g. 14 Maple Street" value={form.name} onChange={e => { setForm({ ...form, name: e.target.value }); setFormErrors(f => ({ ...f, name: false })); }} style={{ ...IS, border: formErrors.name ? "1px solid #f87171" : "1px solid rgba(255,255,255,0.12)", boxShadow: formErrors.name ? "0 0 0 2px rgba(248,113,113,0.2)" : "none" }} /></Field><Field label="Property Type"><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={IS}>{["Single Family", "Duplex", "Triplex", "Condo", "Multi-Family", "Commercial"].map(t => <option key={t}>{t}</option>)}</select></Field><Field label="Address (for map)">
  <div style={{ position: "relative" }}>
    <div style={{ display: "flex", gap: "8px" }}>
      <input
        type="text"
        placeholder="e.g. 1234 Main St, Houston TX"
        value={form.address}
        onChange={e => handleAddressChange(e.target.value)}
        onFocus={() => addressSuggestions.length > 0 && setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        style={{ ...IS, flex: 1 }}
        autoComplete="off"
      />
      {geocoding && <div style={{ padding: "10px 12px", color: "rgba(245,158,11,0.5)", fontSize: "11px", fontWeight: "700", alignSelf: "center" }}>...</div>}
    </div>
    {showSuggestions && addressSuggestions.length > 0 && (
      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: "#0f0f0f", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "10px", marginTop: "4px", overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
        {addressSuggestions.map((s, i) => (
          <div
            key={i}
            onMouseDown={() => selectSuggestion(s)}
            style={{ padding: "10px 14px", cursor: "pointer", borderBottom: i < addressSuggestions.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", display: "flex", alignItems: "center", gap: "10px" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(245,158,11,0.06)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ fontSize: "10px" }}>📍</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "12px", color: "#fff", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</p>
            </div>
            <span style={{ fontSize: "9px", fontWeight: "700", padding: "1px 6px", borderRadius: "4px", background: s.confidence === "high" ? "rgba(52,211,153,0.12)" : "rgba(245,158,11,0.1)", color: s.confidence === "high" ? "#34d399" : "#f59e0b", flexShrink: 0 }}>
              {s.confidence === "high" ? "✓ Precise" : "~ Block"}
            </span>
          </div>
        ))}
      </div>
    )}
    {form.lat && form.lng && (
      <p style={{ fontSize: "10px", color: "rgba(52,211,153,0.6)", marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
        ✓ {parseFloat(form.lat).toFixed(4)}, {parseFloat(form.lng).toFixed(4)}
        <span style={{ fontSize: "9px", color: "rgba(52,211,153,0.4)" }}>· coordinates locked</span>
      </p>
    )}
  </div>
</Field><div className="gs-modal-grid"><Field label="Market Value ($)"><NumberInput value={form.value} onChange={v => setForm({ ...form, value: v })} placeholder="200,000" style={IS} /></Field><Field label="Mortgage Balance ($)"><NumberInput value={form.mortgage} onChange={v => setForm({ ...form, mortgage: v })} placeholder="160,000" style={IS} /></Field></div><div className="gs-modal-grid"><Field label="Monthly Rent ($)"><NumberInput value={form.rent} onChange={v => setForm({ ...form, rent: v })} placeholder="1,200" style={IS} /></Field><Field label="Monthly Expenses ($)"><NumberInput value={form.expenses} onChange={v => setForm({ ...form, expenses: v })} placeholder="300" style={IS} /></Field></div><div className="gs-modal-grid">
  <Field label="Occupancy Status">
    <select value={form.occupancyStatus} onChange={e => setForm({ ...form, occupancyStatus: e.target.value as OccupancyStatus })} style={IS}>
      <option value="occupied">✓ Occupied</option>
      <option value="vacant">✗ Vacant</option>
      <option value="planned">◷ Planned</option>
      <option value="str">🏖 STR / Short-Term</option>
      <option value="sold">🏆 Sold / Exited</option>
    </select>
  </Field>
  {form.occupancyStatus === "planned" && <Field label="Target Month"><input type="month" value={form.plannedDate} onChange={e => setForm({ ...form, plannedDate: e.target.value })} style={IS} /></Field>}
  {form.occupancyStatus === "str" && <Field label="Avg Occupancy %"><input type="number" placeholder="72" min="0" max="100" value={form.occupancyPct} onChange={e => setForm({ ...form, occupancyPct: e.target.value })} style={IS} /></Field>}
  {form.occupancyStatus === "sold" && <Field label="Sale Price ($)"><input type="number" placeholder="350000" value={form.soldPrice} onChange={e => setForm({ ...form, soldPrice: e.target.value })} style={IS} /></Field>}
  {form.occupancyStatus === "sold" && <Field label="Sale Date"><input type="date" value={form.soldDate} onChange={e => setForm({ ...form, soldDate: e.target.value })} style={IS} /></Field>}
</div>
<Field label="Appreciation %/yr"><input type="number" placeholder="3.5" value={form.appreciation} onChange={e => setForm({ ...form, appreciation: e.target.value })} style={IS} /></Field>
<div className="gs-modal-grid">
  <Field label="Group / Building Tag (optional)">
  <input type="text" placeholder="e.g. Maple Portfolio, Montreal" value={form.groupTag} onChange={e => setForm({ ...form, groupTag: e.target.value })} style={IS} />
  {properties.filter(p => p.groupTag && p.groupTag !== form.groupTag).map(p => p.groupTag).filter((v, i, a) => a.indexOf(v) === i).length > 0 && (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
      {properties.filter(p => p.groupTag && p.groupTag !== form.groupTag).map(p => p.groupTag).filter((v, i, a) => a.indexOf(v) === i).map((g: string) => (
        <button key={g} type="button" onClick={() => setForm({ ...form, groupTag: g })} style={{ fontSize: "10px", padding: "3px 10px", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: "999px", color: "#60a5fa", cursor: "pointer", fontWeight: "700" }}>{g}</button>
      ))}
    </div>
  )}
</Field>
</div></div><div style={{ display: "flex", gap: "10px", marginTop: "24px" }}><button onClick={() => { setShowForm(false); setEditingId(null); }} style={{ flex: 1, padding: "12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "13px", color: "rgba(255,255,255,0.4)", background: "none", cursor: "pointer", fontWeight: "600" }}>Cancel</button><button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: "12px", background: saving ? "rgba(245,158,11,0.5)" : "#f59e0b", color: "#000", borderRadius: "10px", fontSize: "13px", fontWeight: "800", border: "none", cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "Saving..." : editingId !== null ? "Save Changes" : "Add Property"}</button></div></div></div>)}
 
    </div>
  );
}
const GS_TIERS = [
  { name: "Pioneer",   icon: "🌄", min: 0,          max: 100_000,    color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.2)",  desc: "The journey begins", coins: 10  },
  { name: "Builder",   icon: "🔨", min: 100_000,    max: 500_000,    color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.2)",  desc: "Building something real", coins: 25 },
  { name: "Architect", icon: "🏛", min: 500_000,    max: 2_000_000,  color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.2)", desc: "Designing wealth", coins: 60 },
  { name: "Magnate",   icon: "💎", min: 2_000_000,  max: 10_000_000, color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.2)",  desc: "Commanding the market", coins: 150 },
  { name: "Sovereign", icon: "👑", min: 10_000_000, max: 50_000_000, color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)", desc: "Domain-level wealth", coins: 400 },
  { name: "Dynasty",   icon: "🌑", min: 50_000_000, max: Infinity,   color: "#fff",    bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.2)", desc: "Generational. Untouchable.", coins: 1000 },
];

function getTier(portfolioValue: number) {
  return GS_TIERS.find(t => portfolioValue >= t.min && portfolioValue < t.max) || GS_TIERS[0];
}

function getNextTier(portfolioValue: number) {
  const idx = GS_TIERS.findIndex(t => portfolioValue >= t.min && portfolioValue < t.max);
  return idx < GS_TIERS.length - 1 ? GS_TIERS[idx + 1] : null;
}

function TierBadge({ portfolioValue, size = "sm" }: { portfolioValue: number; size?: "sm" | "lg" }) {
  const tier = getTier(portfolioValue);
  const isLg = size === "lg";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: isLg ? "10px" : "6px", padding: isLg ? "8px 16px" : "3px 10px", borderRadius: "999px", background: tier.bg, border: `1px solid ${tier.border}` }}>
      <span style={{ fontSize: isLg ? "20px" : "13px" }}>{tier.icon}</span>
      <span style={{ fontSize: isLg ? "14px" : "10px", fontWeight: "800", color: tier.color, letterSpacing: isLg ? "0.5px" : "0.3px" }}>{tier.name}</span>
    </div>
  );
}

function TierPanel({ totalValue, monthlyCashFlow, properties }: { totalValue: number; monthlyCashFlow: number; properties: Property[] }) {
  const [open, setOpen] = useState(false);
  const tier = getTier(totalValue);
  const next = getNextTier(totalValue);
  const pctToNext = next ? Math.min(100, ((totalValue - tier.min) / (next.min - tier.min)) * 100) : 100;
  const toNext = next ? next.min - totalValue : 0;

  const coins = Math.floor(
    (totalValue / 10_000) * 0.5 +
    (monthlyCashFlow > 0 ? monthlyCashFlow / 100 : 0) +
    properties.length * 15
  );

  const UNLOCKS: Record<string, string[]> = {
    Pioneer:   ["Portfolio tracking", "Basic Decision Engine", "Market tab", "Deal Lab (3/mo)", "Community feed (read)"],
    Builder:   ["Unlimited properties", "Full Decision Engine", "Tax Structure Engine", "Deal Lab unlimited", "Projects tab"],
    Architect: ["Portfolio Intelligence", "All financing strategies", "Leaderboard + Rivals", "Verified badge eligible", "PDF/Excel export"],
    Magnate:   ["Hyperlocal leaderboard", "Private Magnate feed", "Professional directory", "Weekly Intelligence Brief", "JV matchmaking (soon)"],
    Sovereign: ["White-glove deal review", "Sovereign feed", "Priority support", "Quarterly briefing", "Ambassador fast-track"],
    Dynasty:   ["Everything", "Private Dynasty network", "API access", "Goldstream founding member status", "Direct line to team"],
  };

  return (
    <div style={{ marginBottom: "24px" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ background: `linear-gradient(135deg, ${tier.bg}, rgba(0,0,0,0.2))`, border: `1px solid ${tier.border}`, borderRadius: open ? "20px 20px 0 0" : "20px", padding: "16px 24px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", transition: "border-radius 0.2s" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: `${tier.color}18`, border: `2px solid ${tier.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", boxShadow: `0 0 16px ${tier.color}22` }}>
              {tier.icon}
            </div>
            <div>
              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "700", marginBottom: "3px" }}>Investor Tier</p>
              <p style={{ fontSize: "20px", fontWeight: "900", color: tier.color, letterSpacing: "-0.5px", lineHeight: 1 }}>{tier.name}</p>
              <p style={{ fontSize: "10px", color: `${tier.color}88`, marginTop: "2px" }}>{tier.desc}</p>
            </div>
          </div>
          {next && (
            <div style={{ minWidth: "200px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontWeight: "600" }}>Next: {next.icon} {next.name}</span>
                <span style={{ fontSize: "10px", color: tier.color, fontWeight: "800" }}>{pctToNext.toFixed(0)}%</span>
              </div>
              <div style={{ height: "5px", background: "rgba(255,255,255,0.06)", borderRadius: "999px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pctToNext}%`, background: `linear-gradient(90deg, ${tier.color}88, ${tier.color})`, borderRadius: "999px", boxShadow: `0 0 8px ${tier.color}66`, transition: "width 1s cubic-bezier(0.4,0,0.2,1)" }} />
              </div>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "4px" }}>{fmt(toNext)} to unlock {next.name}</p>
            </div>
          )}
          {!next && (
            <div style={{ padding: "6px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "999px" }}>
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#fff" }}>⚡ Maximum Tier Reached</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "flex-end", marginBottom: "2px" }}>
              <span style={{ fontSize: "18px" }}>🪙</span>
              <span style={{ fontSize: "22px", fontWeight: "900", color: "#f59e0b", letterSpacing: "-0.5px" }}>{coins.toLocaleString()}</span>
            </div>
            <p style={{ fontSize: "9px", color: "rgba(245,158,11,0.6)", fontWeight: "700", letterSpacing: "1.5px", textTransform: "uppercase" }}>CollinCoins</p>
          </div>
          <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "rgba(255,255,255,0.4)", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▼</div>
        </div>
      </div>

      {open && (
        <div style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${tier.border}`, borderTop: "none", borderRadius: "0 0 20px 20px", padding: "24px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
          <div>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "700", marginBottom: "14px" }}>Your Roadmap</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {GS_TIERS.map((t) => {
                const isCurrent = t.name === tier.name;
                const isPast = totalValue >= t.min;
                return (
                  <div key={t.name} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", background: isCurrent ? `${t.color}12` : "rgba(255,255,255,0.02)", border: `1px solid ${isCurrent ? t.color + "44" : "rgba(255,255,255,0.05)"}`, opacity: !isPast && !isCurrent ? 0.5 : 1 }}>
                    <span style={{ fontSize: "16px" }}>{t.icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: "12px", fontWeight: "800", color: isPast ? t.color : "rgba(255,255,255,0.4)" }}>{t.name}</p>
                      <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)" }}>{t.min === 0 ? "Start" : fmt(t.min)}+</p>
                    </div>
                    {isCurrent && <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: t.color, boxShadow: `0 0 6px ${t.color}`, animation: "blink 1.5s infinite" }} />}
                    {isPast && !isCurrent && <span style={{ fontSize: "12px", color: "#34d399" }}>✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "700", marginBottom: "14px" }}>Your {tier.name} Unlocks</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {(UNLOCKS[tier.name] || []).map(u => (
                <div key={u} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", background: `${tier.color}08`, borderRadius: "8px", border: `1px solid ${tier.color}22` }}>
                  <span style={{ fontSize: "11px", color: tier.color }}>✓</span>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>{u}</span>
                </div>
              ))}
            </div>
            {next && (
              <div style={{ marginTop: "12px" }}>
                <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "8px" }}>Unlocks at {next.name}</p>
                {(UNLOCKS[next.name] || []).slice(0, 3).map(u => (
                  <div key={u} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", marginBottom: "5px", opacity: 0.6 }}>
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)" }}>🔒</span>
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>{u}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "700", marginBottom: "14px" }}>🪙 CollinCoin</p>
            <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "14px", padding: "16px", marginBottom: "12px" }}>
              <p style={{ fontSize: "32px", fontWeight: "900", color: "#f59e0b", letterSpacing: "-1px", lineHeight: 1 }}>{coins.toLocaleString()}</p>
              <p style={{ fontSize: "10px", color: "rgba(245,158,11,0.5)", marginTop: "4px" }}>Your balance</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "14px" }}>
              {[
                { label: "Portfolio value", value: `+${Math.floor(totalValue / 10_000 * 0.5).toLocaleString()}` },
                { label: "Cash flow", value: `+${Math.floor(monthlyCashFlow > 0 ? monthlyCashFlow / 100 : 0).toLocaleString()}` },
                { label: `${properties.length} properties × 15`, value: `+${(properties.length * 15).toLocaleString()}` },
              ].map(m => (
                <div key={m.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", background: "rgba(255,255,255,0.02)", borderRadius: "6px" }}>
                  <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>{m.label}</span>
                  <span style={{ fontSize: "10px", fontWeight: "800", color: "#f59e0b" }}>{m.value} 🪙</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "4px" }}>Redeem</p>
              {[
                { label: "1 month Premium free", cost: "5,000 🪙" },
                { label: "PDF Portfolio Report", cost: "2,000 🪙" },
                { label: "Ambassador fast-track", cost: "50,000 🪙" },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>{r.label}</span>
                  <span style={{ fontSize: "10px", fontWeight: "800", color: "#f59e0b" }}>{r.cost}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.15)", textAlign: "center", marginTop: "10px", lineHeight: "1.5" }}>CollinCoins are loyalty points. Monetary redemption coming soon.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function PortfolioIntelligence({ properties, totalEquity, monthlyCashFlow, totalValue, settings }: { properties: Property[]; totalEquity: number; monthlyCashFlow: number; totalValue: number; settings: UserSettings }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const propCount = properties.filter(p => p.occupancyStatus !== "sold").length;
  const avgLTV = properties.length > 0 ? properties.reduce((s, p) => s + (p.value > 0 ? (p.mortgage / p.value) * 100 : 0), 0) / properties.length : 0;
  const hasEquity = totalEquity > 0;
  const equityPct = totalValue > 0 ? (totalEquity / totalValue) * 100 : 0;
  const positiveCF = monthlyCashFlow > 0;
  const firstName = settings.firstName || "You";

  // Detect jurisdiction from addresses
  const addresses = properties.map(p => p.address.toLowerCase());
  const hasUS = addresses.some(a => [" tx", " fl", " ca", " ny", " il", "usa", "united states", "houston", "miami", "dallas", "austin", "new york"].some(k => a.includes(k)));
  const hasFR = addresses.some(a => ["france", "paris", "lyon", "bordeaux", " fr "].some(k => a.includes(k)));

  // Build unlocked strategies based on real portfolio data
  type Strategy = {
    id: string; icon: string; title: string; tag: string; tagColor: string;
    unlocked: boolean; lockReason?: string; color: string; bg: string; border: string;
    headline: string; why: string;
    schema: { from: string; arrow: string; to: string; result: string }[];
    timeline: string[]; prep: string[]; pricing: string;
    pros: string[]; cons: string[]; risks: string[];
    lenders: { name: string; url: string }[];
    simulations: { label: string; monthlyPayment: number; cashFlow: number; capitalFreed: number; netWorth5yr: number }[];
    minPortfolio: number; minProperties: number;
  };

  const appRate = properties.length > 0 ? properties.reduce((s, p) => s + p.appreciation, 0) / properties.length / 100 : 0.035;
  const proj5Value = totalValue * Math.pow(1 + appRate, 5);

  const strategies: Strategy[] = [
    // ── 1. CASH-OUT REFINANCE ─────────────────────────────────────────
    {
      id: "cashout", icon: "💰", title: "Cash-Out Refinance", tag: "Most Popular", tagColor: "#34d399",
      unlocked: equityPct >= 25, lockReason: "Need 25%+ equity in a property",
      color: "#34d399", bg: "rgba(52,211,153,0.06)", border: "rgba(52,211,153,0.2)",
      headline: `Access up to ${fmt(totalEquity * 0.7)} from your equity today`,
      why: `You have ${fmt(totalEquity)} in equity across your portfolio. A cash-out refi replaces your mortgage with a larger one — the difference hits your bank account. Use it to fund your next deal without selling anything.`,
      schema: [
        { from: `Your property\n${fmt(totalValue)}`, arrow: "→", to: "New loan at 75% LTV", result: `+${fmt(Math.max(0, totalValue * 0.75 - properties.reduce((s, p) => s + p.mortgage, 0)))} cash` }
      ],
      timeline: ["Week 1–2: Get appraisal ($500–$800)", "Week 2–4: Apply to 3 lenders, get term sheets", "Week 4–6: Choose lender, lock rate", "Week 6–8: Underwriting & close"],
      prep: ["Order appraisal on highest-value property first", "Pull credit report — aim for 680+ FICO", "Gather 2 months bank statements + lease agreements", "Calculate new DSCR after refi (rent ÷ new payment > 1.0)"],
      pricing: "Rate: 7–8.5% (investment property) · Closing costs: 2–4% of loan · No prepayment penalty on most",
      pros: ["Keep the property", "Tax-deductible interest", "Deploy capital into next deal", "No income verification with DSCR refi"],
      cons: ["Higher monthly payment", "Resets loan term", "Closing costs eat into proceeds"],
      risks: ["If vacancy rises, new payment may strain cash flow", "Rate risk if using ARM product"],
      lenders: [{ name: "Rocket Mortgage", url: "rocketmortgage.com" }, { name: "Better.com", url: "better.com" }, { name: "LoanDepot", url: "loandepot.com" }],
      simulations: [
        { label: "Conservative (65% LTV)", monthlyPayment: Math.round(totalValue * 0.65 * 0.07 / 12), cashFlow: Math.round(monthlyCashFlow - (totalValue * 0.65 * 0.07 / 12 - properties.reduce((s,p)=>s+p.mortgage,0)*0.07/12)), capitalFreed: Math.round(Math.max(0, totalValue * 0.65 - properties.reduce((s,p)=>s+p.mortgage,0))), netWorth5yr: Math.round(proj5Value - totalValue * 0.65) },
        { label: "Aggressive (75% LTV)", monthlyPayment: Math.round(totalValue * 0.75 * 0.07 / 12), cashFlow: Math.round(monthlyCashFlow - (totalValue * 0.75 * 0.07 / 12 - properties.reduce((s,p)=>s+p.mortgage,0)*0.07/12)), capitalFreed: Math.round(Math.max(0, totalValue * 0.75 - properties.reduce((s,p)=>s+p.mortgage,0))), netWorth5yr: Math.round(proj5Value - totalValue * 0.75) },
      ],
      minPortfolio: 0, minProperties: 1,
    },
    // ── 2. DSCR LOAN ─────────────────────────────────────────────────
    {
      id: "dscr", icon: "📊", title: "DSCR Loan", tag: "No Income Docs", tagColor: "#60a5fa",
      unlocked: positiveCF && hasUS,
      lockReason: positiveCF ? "Available for US properties only" : "Need positive cash flow (rent > expenses)",
      color: "#60a5fa", bg: "rgba(96,165,250,0.06)", border: "rgba(96,165,250,0.2)",
      headline: "Qualify based on rent — not your salary",
      why: `Your portfolio generates ${fmt(monthlyCashFlow)}/mo. A DSCR lender divides that by the loan payment — if ratio ≥ 1.0 you qualify. No W2, no tax returns, no personal income verification. Scale to unlimited properties.`,
      schema: [
        { from: `Monthly rent\n${fmt(properties.reduce((s,p)=>s+p.rent,0))}`, arrow: "÷", to: "Monthly payment", result: `DSCR ${properties.reduce((s,p)=>s+p.mortgage,0)>0?(properties.reduce((s,p)=>s+p.rent-p.expenses,0)/(properties.reduce((s,p)=>s+p.mortgage,0)*0.07/12)).toFixed(2):"—"}x → Approved` }
      ],
      timeline: ["Week 1: Pull rent rolls & leases", "Week 1–2: Apply online (most lenders 10min)", "Week 2–3: Appraisal + rent schedule", "Week 3–5: Close"],
      prep: ["Have current signed leases ready", "DSCR must be ≥ 1.0 (ideally 1.25+)", "20–25% down payment or equity required", "LLC recommended — keeps loan off personal credit"],
      pricing: "Rate: 7.5–9% · Down payment: 20–25% · Closing: 1.5–3% · No prepayment after 3yr",
      pros: ["No income docs", "Unlimited properties", "Close in 3–5 weeks", "Works in LLC"],
      cons: ["Higher rate than conventional", "Requires positive cash flow", "Prepayment penalty first 3yr"],
      risks: ["Vacancy drops income → DSCR falls below 1.0", "Rate adjustments on ARM products"],
      lenders: [{ name: "Visio Lending", url: "visiolending.com" }, { name: "Kiavi", url: "kiavi.com" }, { name: "Lima One Capital", url: "limaone.com" }, { name: "Griffin Funding", url: "griffinfunding.com" }],
      simulations: [
        { label: "30yr Fixed DSCR", monthlyPayment: Math.round(totalValue * 0.75 * (0.085/12) * Math.pow(1+0.085/12,360) / (Math.pow(1+0.085/12,360)-1)), cashFlow: Math.round(properties.reduce((s,p)=>s+p.rent-p.expenses,0) - totalValue * 0.75 * (0.085/12) * Math.pow(1+0.085/12,360) / (Math.pow(1+0.085/12,360)-1)), capitalFreed: 0, netWorth5yr: Math.round(proj5Value * 0.75) },
        { label: "Interest-Only 10yr", monthlyPayment: Math.round(totalValue * 0.75 * 0.085 / 12), cashFlow: Math.round(properties.reduce((s,p)=>s+p.rent-p.expenses,0) - totalValue * 0.75 * 0.085 / 12), capitalFreed: 0, netWorth5yr: Math.round(proj5Value * 0.75) },
      ],
      minPortfolio: 0, minProperties: 1,
    },
    // ── 3. HELOC ─────────────────────────────────────────────────────
    {
      id: "heloc", icon: "🔄", title: "HELOC on Investment Property", tag: "Revolving Credit", tagColor: "#a78bfa",
      unlocked: equityPct >= 30,
      lockReason: "Need 30%+ equity in a property",
      color: "#a78bfa", bg: "rgba(167,139,250,0.06)", border: "rgba(167,139,250,0.2)",
      headline: `Open a credit line up to ${fmt(totalEquity * 0.6)} — draw only what you need`,
      why: "A HELOC works like a credit card secured by your property equity. You only pay interest on what you draw. Use it for down payments, renovations, or emergencies — then pay it back and draw again. Best flexibility tool in the arsenal.",
      schema: [
        { from: `Equity\n${fmt(totalEquity)}`, arrow: "→", to: "Credit line (70% of equity)", result: `Draw ${fmt(totalEquity * 0.6)} anytime` }
      ],
      timeline: ["Week 1: Apply online or at bank", "Week 1–2: Appraisal", "Week 2–4: Approval + line opens", "Ongoing: Draw & repay as needed"],
      prep: ["Credit score 680+ preferred", "Debt-to-income below 43%", "Property must be non-owner-occupied for investment HELOC", "Have lease agreements ready"],
      pricing: "Rate: Prime + 1–2% (currently ~9–10%) · Closing: $500–$3,000 · Draw period: 10yr · Repay period: 20yr",
      pros: ["Only pay on what you use", "Revolving — reuse after repayment", "Fast access to capital", "Tax-deductible interest"],
      cons: ["Variable rate — rises with prime", "10yr draw limit", "Some lenders won't do investment HELOCs"],
      risks: ["Rate spike increases payment unexpectedly", "Balloon at end of draw period"],
      lenders: [{ name: "Figure.com", url: "figure.com" }, { name: "PenFed Credit Union", url: "penfed.org" }, { name: "Bank of America", url: "bankofamerica.com" }],
      simulations: [
        { label: "Draw $50K for next deal", monthlyPayment: Math.round(50000 * 0.095 / 12), cashFlow: Math.round(monthlyCashFlow - 50000 * 0.095 / 12), capitalFreed: 50000, netWorth5yr: Math.round(proj5Value + 50000 * 1.3) },
        { label: "Draw $150K for renovation", monthlyPayment: Math.round(150000 * 0.095 / 12), cashFlow: Math.round(monthlyCashFlow - 150000 * 0.095 / 12), capitalFreed: 150000, netWorth5yr: Math.round(proj5Value + 150000 * 1.5) },
      ],
      minPortfolio: 0, minProperties: 1,
    },
    // ── 4. CROSS-COLLATERALIZATION ────────────────────────────────────
    {
      id: "cross", icon: "🔗", title: "Cross-Collateralization", tag: "Portfolio Power", tagColor: "#f59e0b",
      unlocked: propCount >= 3,
      lockReason: `Need 3+ properties (you have ${propCount})`,
      color: "#f59e0b", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.2)",
      headline: `Use all ${propCount} properties as one — unlock ${fmt(totalEquity * 0.8)}`,
      why: `You have ${propCount} properties. A blanket mortgage pools them under ONE loan — one application, one closing, one payment. You access MORE equity than individual loans and can move your entire portfolio into an LLC in a single transaction.`,
      schema: [
        { from: `Property 1\n${fmt(properties[0]?.value || 0)}`, arrow: "+", to: `Property 2–${propCount}`, result: `One loan\n${fmt(totalValue * 0.75)} available` }
      ],
      timeline: ["Week 1–2: Portfolio appraisals (all properties)", "Week 2–4: Apply for blanket/portfolio loan", "Week 4–8: Underwriting (more complex)", "Week 8–12: Close — all properties under one loan"],
      prep: ["Full rent rolls for all properties", "All leases current and signed", "LLC formed before closing recommended", "Individual property DSCR ≥ 1.0 each"],
      pricing: "Rate: 7.5–9.5% · One closing cost vs multiple · Min loan: $500K total portfolio · Origination: 1–2%",
      pros: ["One payment instead of multiple", "Access more equity than individual loans", "Move portfolio into LLC in one step", "Saves multiple closing costs"],
      cons: ["All properties cross-pledged — one default affects all", "More complex underwriting", "Harder to sell individual properties (release clause needed)"],
      risks: ["Cross-default: one bad property triggers loan review", "Illiquidity if release clause not negotiated"],
      lenders: [{ name: "Kiavi Portfolio", url: "kiavi.com" }, { name: "CoreVest Finance", url: "corevestfinance.com" }, { name: "Gelt Financial", url: "geltfinancial.com" }],
      simulations: [
        { label: "Portfolio loan at 70% LTV", monthlyPayment: Math.round(totalValue * 0.70 * 0.085/12), cashFlow: Math.round(monthlyCashFlow - (totalValue * 0.70 - properties.reduce((s,p)=>s+p.mortgage,0)) * 0.085/12), capitalFreed: Math.round(Math.max(0, totalValue * 0.70 - properties.reduce((s,p)=>s+p.mortgage,0))), netWorth5yr: Math.round(proj5Value - totalValue * 0.70) },
        { label: "Move to LLC + cash out 75%", monthlyPayment: Math.round(totalValue * 0.75 * 0.085/12), cashFlow: Math.round(monthlyCashFlow - (totalValue * 0.75 - properties.reduce((s,p)=>s+p.mortgage,0)) * 0.085/12), capitalFreed: Math.round(Math.max(0, totalValue * 0.75 - properties.reduce((s,p)=>s+p.mortgage,0))), netWorth5yr: Math.round(proj5Value - totalValue * 0.75) },
      ],
      minPortfolio: 0, minProperties: 3,
    },
    // ── 5. BRIDGE LOAN ────────────────────────────────────────────────
    {
      id: "bridge", icon: "🌉", title: "Bridge Loan", tag: "Fast Capital", tagColor: "#f87171",
      unlocked: propCount >= 2 || totalValue >= 200000,
      lockReason: "Need 2+ properties or $200K+ portfolio",
      color: "#f87171", bg: "rgba(248,113,113,0.06)", border: "rgba(248,113,113,0.2)",
      headline: "Close on your next deal in 7–14 days",
      why: "A bridge loan is short-term, fast money. You see a deal that needs to close NOW — no time to wait 60 days for a conventional loan. Bridge closes in 1–2 weeks, you buy the deal, stabilize it, then refi into long-term DSCR. The speed IS the value.",
      schema: [
        { from: "Target deal\nCloses in 7 days", arrow: "→", to: "Bridge loan\n12 months interest-only", result: "Refi to DSCR\nat end of term" }
      ],
      timeline: ["Day 1–3: Submit deal to bridge lender", "Day 3–7: Appraisal + approval", "Day 7–14: Close", "Month 6–12: Refi into permanent DSCR"],
      prep: ["Have exit strategy clear (refi or sell)", "Know your ARV (after-repair value)", "20% equity in existing property as backstop", "Good credit helps but not always required"],
      pricing: "Rate: 10–14% · Term: 6–24 months · Points: 1–3% upfront · Interest only · No prepayment on most",
      pros: ["Close in 7–14 days", "No income verification", "Based on asset value", "Perfect for BRRRR step 4"],
      cons: ["Expensive — 10–14% rate", "Short term pressure", "Must have exit strategy"],
      risks: ["If property doesn't appraise for refi, trapped in bridge rate", "Cost compounds fast — don't overstay"],
      lenders: [{ name: "Lima One Capital", url: "limaone.com" }, { name: "Kiavi", url: "kiavi.com" }, { name: "Stratton Equities", url: "strattonequities.com" }],
      simulations: [
        { label: "6 month bridge → DSCR refi", monthlyPayment: Math.round(totalValue * 0.75 * 0.12 / 12), cashFlow: Math.round(monthlyCashFlow - totalValue * 0.75 * 0.12 / 12), capitalFreed: Math.round(totalValue * 0.75 * 0.25), netWorth5yr: Math.round(proj5Value * 0.8) },
        { label: "12 month bridge → sell", monthlyPayment: Math.round(totalValue * 0.70 * 0.12 / 12), cashFlow: Math.round(monthlyCashFlow - totalValue * 0.70 * 0.12 / 12), capitalFreed: Math.round(totalValue * 0.15), netWorth5yr: Math.round(totalValue * 1.15) },
      ],
      minPortfolio: 200000, minProperties: 0,
    },
    // ── 6. SELLER FINANCING ───────────────────────────────────────────
    {
      id: "seller", icon: "🤝", title: "Seller Financing", tag: "No Bank Needed", tagColor: "#e879f9",
      unlocked: true,
      color: "#e879f9", bg: "rgba(232,121,249,0.06)", border: "rgba(232,121,249,0.2)",
      headline: "Buy property directly from seller — they become your bank",
      why: "The seller owns their property free-and-clear (or has high equity). Instead of you going to a bank, they lend you the money directly. You pay them monthly — same as a mortgage but negotiated between two people. No bank approval, no appraisal required, terms are whatever you both agree to.",
      schema: [
        { from: "You find motivated seller", arrow: "→", to: "Negotiate terms directly", result: "Monthly payments to seller\nno bank involved" }
      ],
      timeline: ["Find motivated seller (off-market)", "Negotiate: price, rate, term, down payment", "Attorney drafts promissory note + deed of trust", "Close in 1–2 weeks"],
      prep: ["Target free-and-clear properties (no mortgage)", "Offer slightly above market → justify with flexible terms", "Always use a real estate attorney", "Get title insurance"],
      pricing: "Rate: Whatever you negotiate (typically 5–8%) · Down: 10–20% · Term: 5–30yr · No closing costs beyond attorney",
      pros: ["No bank approval needed", "Negotiate every term", "Fast close", "Creative structuring possible"],
      cons: ["Due-on-sale clause risk if seller has mortgage", "Seller may want balloon in 5–7yr", "Need motivated seller"],
      risks: ["Seller dies or has estate issues — title complications", "Balloon payment you can't refinance"],
      lenders: [{ name: "Find deals: PropStream", url: "propstream.com" }, { name: "Off-market: DealMachine", url: "dealmachine.com" }],
      simulations: [
        { label: "Seller at 6%, 20yr term", monthlyPayment: Math.round(totalValue * 0.80 * (0.06/12) * Math.pow(1+0.06/12,240) / (Math.pow(1+0.06/12,240)-1)), cashFlow: Math.round(monthlyCashFlow - totalValue * 0.80 * (0.06/12) * Math.pow(1+0.06/12,240) / (Math.pow(1+0.06/12,240)-1) + properties.reduce((s,p)=>s+p.mortgage,0)*0.07/12), capitalFreed: 0, netWorth5yr: Math.round(proj5Value * 0.8) },
      ],
      minPortfolio: 0, minProperties: 0,
    },
  ];

  // Add French strategies
  if (hasFR) {
    strategies.push({
      id: "pretinfine", icon: "🏦", title: "Prêt In Fine", tag: "France Only", tagColor: "#f59e0b",
      unlocked: totalValue >= 150000 && propCount >= 1,
      lockReason: "Need property value ≥ €150K in France",
      color: "#f59e0b", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.2)",
      headline: "Pay only interest monthly — repay capital at the end",
      why: "You pay ONLY the interest each month (not the capital). At the end of the loan (7–20 years), you repay 100% of the capital in one payment. The magic: every interest payment is 100% deductible from your rental income. If you're in a high tax bracket, this is one of the most powerful tax optimization tools in France.",
      schema: [
        { from: "Month 1→84\nPay only interest", arrow: "→", to: "Month 85\nRepay 100% capital", result: "All interests\ntax-deductible" }
      ],
      timeline: ["Month 1: Prepare nantissement (30% of loan in savings)", "Month 1–2: Apply at BNP, Société Générale, CCF", "Month 2–3: Approval + nantissement setup", "Month 3–4: Close"],
      prep: ["Need 30% of loan amount in blocked savings (nantissement)", "Property must be rental — not primary residence", "Higher tax bracket = more benefit", "Strong financial dossier required"],
      pricing: "Rate: +0.5–1% above standard mortgage · Duration: 7–20yr · Nantissement: 30% minimum blocked",
      pros: ["100% interest deductible from foncier income", "Lower monthly payments", "Tax optimization for high earners", "Wealth transmission tool"],
      cons: ["More expensive total cost", "Capital must be ready at term", "Nantissement blocked for full duration"],
      risks: ["Nantissement underperforms → capital gap at term", "Rate higher than amortissable"],
      lenders: [{ name: "BNP Paribas", url: "bnpparibas.fr" }, { name: "Société Générale (Optis)", url: "societegenerale.fr" }, { name: "CCF", url: "ccf.fr" }, { name: "CAFPI (broker)", url: "cafpi.fr" }],
      simulations: [
        { label: "€200K, 15yr, 4.2%", monthlyPayment: Math.round(200000 * 0.042 / 12), cashFlow: Math.round(monthlyCashFlow - 200000 * 0.042 / 12), capitalFreed: 0, netWorth5yr: Math.round(proj5Value * 0.8) },
      ],
      minPortfolio: 150000, minProperties: 1,
    });
  }

  const unlocked = strategies.filter(s => s.unlocked);
  const locked = strategies.filter(s => !s.unlocked);
  const fmtSim = (n: number) => n >= 0 ? `+${fmt(n)}` : fmtFull(n);

  return (
    <div style={{ marginBottom: "24px" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(96,165,250,0.04))", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "20px", padding: "24px 28px", marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b", boxShadow: "0 0 8px #f59e0b", animation: "blink 1.5s infinite" }} />
              <span style={{ fontSize: "10px", color: "rgba(245,158,11,0.8)", letterSpacing: "2px", fontWeight: "800", textTransform: "uppercase" }}>Portfolio Intelligence · What You Can Do Right Now</span>
            </div>
            <h2 style={{ fontSize: "22px", fontWeight: "900", letterSpacing: "-0.5px", marginBottom: "6px" }}>
              {firstName}, you have <span style={{ color: "#f59e0b" }}>{fmt(totalEquity)}</span> working for you
            </h2>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", lineHeight: "1.6" }}>
              Based on your {propCount} propert{propCount > 1 ? "ies" : "y"} and {fmt(totalValue)} portfolio — here's every financing strategy you can execute today, with real numbers and lender names.
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ textAlign: "center", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: "12px", padding: "12px 16px" }}>
              <p style={{ fontSize: "9px", color: "rgba(52,211,153,0.6)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Unlocked</p>
              <p style={{ fontSize: "24px", fontWeight: "900", color: "#34d399" }}>{unlocked.length}</p>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>strategies</p>
            </div>
            <div style={{ textAlign: "center", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "12px", padding: "12px 16px" }}>
              <p style={{ fontSize: "9px", color: "rgba(245,158,11,0.6)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Max Capital</p>
              <p style={{ fontSize: "24px", fontWeight: "900", color: "#f59e0b" }}>{fmt(totalEquity * 0.75)}</p>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>accessible</p>
            </div>
          </div>
        </div>
      </div>

      {/* Unlocked strategies */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
        {unlocked.map(s => {
          const isOpen = expanded === s.id;
          const bestSim = s.simulations.reduce((a, b) => a.netWorth5yr > b.netWorth5yr ? a : b);
          return (
            <div key={s.id} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: "18px", overflow: "hidden", transition: "all 0.3s" }}>
              {/* Strategy header — always visible */}
              <div onClick={() => setExpanded(isOpen ? null : s.id)}
                style={{ padding: "20px 24px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: `${s.color}18`, border: `1px solid ${s.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>{s.icon}</div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <p style={{ fontSize: "16px", fontWeight: "900", color: "#fff" }}>{s.title}</p>
                      <span style={{ fontSize: "9px", fontWeight: "800", padding: "2px 8px", borderRadius: "999px", background: `${s.tagColor}18`, color: s.tagColor, border: `1px solid ${s.tagColor}33` }}>{s.tag}</span>
                    </div>
                    <p style={{ fontSize: "13px", color: s.color, fontWeight: "700" }}>{s.headline}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "2px" }}>Best 5yr outcome</p>
                    <p style={{ fontSize: "18px", fontWeight: "900", color: s.color }}>{fmt(bestSim.netWorth5yr)}</p>
                  </div>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: `${s.color}15`, border: `1px solid ${s.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", color: s.color, fontWeight: "800", transition: "transform 0.3s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</div>
                </div>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{ borderTop: `1px solid ${s.border}`, padding: "24px" }}>
                  {/* Why this works for you */}
                  <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "12px", padding: "16px 18px", marginBottom: "20px" }}>
                    <p style={{ fontSize: "11px", fontWeight: "800", color: s.color, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1px" }}>💡 Why this works for your portfolio</p>
                    <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", lineHeight: "1.7" }}>{s.why}</p>
                  </div>

                  {/* Visual Schema */}
                  <p style={{ fontSize: "10px", fontWeight: "800", color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "12px" }}>How It Works</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
                    {s.schema.map((step, i) => (
                      <div key={i} style={{display:"contents"}}>
                        <div style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${s.color}33`, borderRadius: "12px", padding: "12px 16px", textAlign: "center", minWidth: "120px" }}>
                          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", whiteSpace: "pre-line", lineHeight: "1.5" }}>{step.from}</p>
                        </div>
                        <div style={{ fontSize: "20px", color: s.color, fontWeight: "900" }}>{step.arrow}</div>
                        <div style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${s.color}33`, borderRadius: "12px", padding: "12px 16px", textAlign: "center", minWidth: "120px" }}>
                          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", whiteSpace: "pre-line", lineHeight: "1.5" }}>{step.to}</p>
                        </div>
                        <div style={{ fontSize: "20px", color: s.color, fontWeight: "900" }}>→</div>
                        <div style={{ background: `${s.color}12`, border: `1px solid ${s.color}44`, borderRadius: "12px", padding: "12px 16px", textAlign: "center" }}>
                          <p style={{ fontSize: "13px", fontWeight: "800", color: s.color, whiteSpace: "pre-line", lineHeight: "1.5" }}>{step.result}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Simulations */}
                  <p style={{ fontSize: "10px", fontWeight: "800", color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "12px" }}>📊 Simulations — Your Real Numbers</p>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, s.simulations.length)}, 1fr)`, gap: "10px", marginBottom: "20px" }}>
                    {s.simulations.map((sim, i) => (
                      <div key={i} style={{ background: "rgba(0,0,0,0.25)", border: `1px solid ${s.color}22`, borderRadius: "14px", padding: "16px" }}>
                        <p style={{ fontSize: "11px", fontWeight: "800", color: s.color, marginBottom: "12px" }}>{sim.label}</p>
                        {[
                          { label: "Monthly Payment", value: `$${sim.monthlyPayment.toLocaleString()}`, color: "#f87171" },
                          { label: "Net Cash Flow", value: `${sim.cashFlow >= 0 ? "+" : ""}$${Math.abs(sim.cashFlow).toLocaleString()}/mo`, color: sim.cashFlow >= 0 ? "#34d399" : "#f87171" },
                          { label: "Capital Freed", value: `+$${sim.capitalFreed.toLocaleString()}`, color: "#f59e0b" },
                          { label: "5yr Net Worth", value: fmt(sim.netWorth5yr), color: s.color },
                        ].map(m => (
                          <div key={m.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{m.label}</span>
                            <span style={{ fontSize: "13px", fontWeight: "800", color: m.color }}>{m.value}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Timeline + Prep */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                    <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "12px", padding: "16px" }}>
                      <p style={{ fontSize: "10px", fontWeight: "800", color: "rgba(255,255,255,0.4)", letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: "10px" }}>⏱ Timeline</p>
                      {s.timeline.map((t, i) => (
                        <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "8px" }}>
                          <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: `${s.color}18`, border: `1px solid ${s.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: "800", color: s.color, flexShrink: 0 }}>{i+1}</div>
                          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", lineHeight: "1.5" }}>{t}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "12px", padding: "16px" }}>
                      <p style={{ fontSize: "10px", fontWeight: "800", color: "rgba(255,255,255,0.4)", letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: "10px" }}>✅ How to Prepare</p>
                      {s.prep.map((p, i) => (
                        <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                          <span style={{ color: s.color, flexShrink: 0, fontSize: "12px" }}>→</span>
                          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", lineHeight: "1.5" }}>{p}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pricing */}
                  <div style={{ background: `${s.color}08`, border: `1px solid ${s.color}22`, borderRadius: "10px", padding: "12px 16px", marginBottom: "16px" }}>
                    <p style={{ fontSize: "10px", fontWeight: "800", color: s.color, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "1px" }}>💲 Pricing & Structure</p>
                    <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>{s.pricing}</p>
                  </div>

                  {/* Pros / Cons / Risks */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                    {[
                      { label: "✓ Pros", items: s.pros, color: "#34d399", bg: "rgba(52,211,153,0.06)" },
                      { label: "✗ Cons", items: s.cons, color: "#f87171", bg: "rgba(248,113,113,0.06)" },
                      { label: "⚠ Risks", items: s.risks, color: "#f59e0b", bg: "rgba(245,158,11,0.06)" },
                    ].map(col => (
                      <div key={col.label} style={{ background: col.bg, borderRadius: "10px", padding: "14px" }}>
                        <p style={{ fontSize: "10px", fontWeight: "800", color: col.color, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "8px" }}>{col.label}</p>
                        {col.items.map((item, i) => <p key={i} style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", marginBottom: "5px", lineHeight: "1.5" }}>· {item}</p>)}
                      </div>
                    ))}
                  </div>

                  {/* Lenders */}
                  <div>
                    <p style={{ fontSize: "10px", fontWeight: "800", color: "rgba(255,255,255,0.4)", letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: "10px" }}>🏦 Recommended Lenders</p>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {s.lenders.map(l => (
                        <a key={l.name} href={`https://${l.url}`} target="_blank" rel="noopener noreferrer"
                          style={{ padding: "8px 16px", background: "rgba(0,0,0,0.3)", border: `1px solid ${s.color}33`, borderRadius: "999px", color: s.color, fontSize: "12px", fontWeight: "700", textDecoration: "none", transition: "all 0.15s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = `${s.color}15`)}
                          onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,0,0,0.3)")}>
                          {l.name} ↗
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Locked strategies — coming soon as you grow */}
      <TaxStructurePanel properties={properties} totalEquity={totalEquity} totalValue={totalValue} />
      {locked.length > 0 && (
        <div>
          <p style={{ fontSize: "10px", fontWeight: "800", color: "rgba(255,255,255,0.25)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "10px" }}>🔒 Unlocks As You Grow</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {locked.map(s => (
              <div key={s.id} style={{ padding: "10px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "14px", filter: "grayscale(1)", opacity: 0.5 }}>{s.icon}</span>
                <div>
                  <p style={{ fontSize: "12px", fontWeight: "700", color: "rgba(255,255,255,0.35)" }}>{s.title}</p>
                  <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>{s.lockReason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function TaxStructurePanel({ properties, totalEquity, totalValue }: { properties: Property[]; totalEquity: number; totalValue: number }) {
  const [jurisdiction, setJurisdiction] = useState<"US" | "FR">("US");
  const [strategy, setStrategy] = useState<"hold" | "brrrr" | "sell" | "str">("hold");

  const annualRent = properties.reduce((s, p) => s + p.rent * 12, 0);
  const annualExpenses = properties.reduce((s, p) => s + p.expenses * 12, 0);
  const noi = annualRent - annualExpenses;

  const US_STRUCTURES = [
    { name: "LLC (Single-Member)", icon: "🏢", color: "#60a5fa", when: "1–3 properties", benefit: "Asset protection, pass-through taxation, no corporate tax", tax: "Taxed as personal income. Deduct: depreciation, mortgage interest, repairs, management.", annual_cost: "$200–500/yr", best_for: "Most investors starting out" },
    { name: "LLC + S-Corp Election", icon: "⚡", color: "#f59e0b", when: "High cash flow ($80K+ net)", benefit: "Reduce self-employment tax by 15.3% on distributions", tax: "Pay yourself salary. Take rest as distributions — no FICA on distributions.", annual_cost: "$800–2,000/yr", best_for: "Active real estate investors" },
    { name: "1031 Exchange", icon: "🔄", color: "#34d399", when: "Selling appreciated property", benefit: "Defer ALL capital gains tax — indefinitely", tax: `On ${fmt(totalValue)} portfolio: avoid ~${fmt(Math.round(totalValue * 0.2 * 0.20))} in capital gains tax`, annual_cost: "QI fee: $800–1,200 per exchange", best_for: "Selling to upgrade — most powerful tool in US RE tax code" },
    { name: "Cost Segregation", icon: "📊", color: "#a78bfa", when: "$500K+ property value", benefit: "Front-load depreciation — massive first-year deductions", tax: `On ${fmt(totalValue)}: typically generates ${fmt(Math.round(totalValue * 0.08))}–${fmt(Math.round(totalValue * 0.15))} in Y1 deductions`, annual_cost: "$5,000–15,000 study", best_for: "High income earners — eliminate tax bill year 1" },
    { name: "Opportunity Zone Fund", icon: "🌆", color: "#f87171", when: "Capital gains to deploy", benefit: "Invest gains in OZ → defer tax + 0% tax after 10yr", tax: "On $100K gain: defer tax now, potentially owe $0 after 10 years", annual_cost: "Fund management fees 1–2%/yr", best_for: "Investors with large capital gains" },
  ];

  const FR_STRUCTURES = [
    { name: "LMNP (Meublé non professionnel)", icon: "🛋", color: "#60a5fa", when: "Locations meublées, <23K€/yr", benefit: "Micro-BIC: 50% abattement automatique. Réel: amortissement complet.", tax: "Réel simplifié: amortissement sur 25–30 ans. Zéro impôt pendant 8–12 ans typiquement.", annual_cost: "Comptable: 500–1,500€/an", best_for: "Investisseurs meublés — régime le plus avantageux" },
    { name: "SCI à l'IS", icon: "🏛", color: "#f59e0b", when: "Patrimoine > 500K€, transmission", benefit: "IS à 15% jusqu'à 42,500€. Amortissement du bien.", tax: `Sur ${fmt(noi)} NOI: IS 15% = ${fmt(Math.round(noi * 0.15))} vs TMI personnel 30–45%`, annual_cost: "Comptable: 1,500–3,000€/an", best_for: "Transmission patrimoniale, gros portfolios" },
    { name: "Déficit Foncier", icon: "📉", color: "#34d399", when: "Travaux importants sur logement ancien", benefit: "Impute le déficit sur le revenu global — réduit l'IR immédiatement", tax: "Jusqu'à 10,700€/an imputables sur revenu global. Report illimité sur foncier.", annual_cost: "Zéro coût supplémentaire", best_for: "Rénovation de biens anciens avec travaux lourds" },
    { name: "Prêt In Fine", icon: "🏦", color: "#a78bfa", when: "TMI élevée (30%+)", benefit: "Payer UNIQUEMENT les intérêts. 100% déductibles des revenus fonciers.", tax: `Sur ${fmt(totalValue * 0.75)} emprunté à 4%: ${fmt(Math.round(totalValue * 0.75 * 0.04))} d'intérêts/an déductibles`, annual_cost: "Nantissement 30% du capital bloqué", best_for: "TMI 30%+, optimisation maximale" },
    { name: "Pinel / Denormandie", icon: "🏘", color: "#f87171", when: "Achat neuf ou ancien rénové zone tendue", benefit: "Réduction d'impôt 12–21% du prix d'achat sur 6–12 ans", tax: `Sur ${fmt(Math.min(300000, totalValue))}: jusqu'à ${fmt(Math.round(Math.min(300000, totalValue) * 0.21))} de réduction fiscale`, annual_cost: "Contraintes loyer + locataire", best_for: "Investisseurs cherchant réduction fiscale immédiate" },
  ];

  const structures = jurisdiction === "US" ? US_STRUCTURES : FR_STRUCTURES;

  const STRATEGY_COMPARE = {
    hold:  { label: "Hold & Rent", color: "#34d399", us: `Deduct annually: depreciation $${Math.round(totalValue / 27.5).toLocaleString()}, mortgage interest, repairs, management. Effective tax rate: 15–25%.`, fr: "LMNP réel: amortissement + charges → impôt souvent nul 8–12 ans. SCI IS si transmission patrimoniale." },
    brrrr: { label: "BRRRR", color: "#a78bfa", us: "Cash-out refi proceeds are NOT taxable (it's a loan, not income). New interest is fully deductible. Most tax-efficient growth strategy.", fr: "Refinancement non imposable. Nouveaux intérêts déductibles. Idéal en LMNP ou SCI IS." },
    sell:  { label: "Sell", color: "#f59e0b", us: `Long-term capital gains: 0/15/20%. On ${fmt(totalValue)}: est. ${fmt(Math.round(totalValue * 0.15 * 0.20))} tax. Use 1031 Exchange to defer 100% — legally.`, fr: "Plus-value: 19% IR + 17.2% PS = 36.2%. Abattement progressif → exonération après 22 ans (IR) / 30 ans (PS)." },
    str:   { label: "STR / Airbnb", color: "#60a5fa", us: "Augusta Rule: first 14 days free — zero tax. Above that: deduct all STR expenses proportionally. Active = self-employment tax applies.", fr: "LMNP meublé: micro-BIC 50% abattement ou réel (amortissement). Seuil micro-BIC: 77,700€/an." },
  };

  const sc = STRATEGY_COMPARE[strategy];

  return (
    <div style={{ marginTop: "28px" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, rgba(96,165,250,0.08), rgba(96,165,250,0.02))", border: "1px solid rgba(96,165,250,0.2)", borderRadius: "20px", padding: "22px 26px", marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontSize: "16px" }}>🏛</span>
              <span style={{ fontSize: "10px", color: "rgba(96,165,250,0.8)", letterSpacing: "2px", fontWeight: "800", textTransform: "uppercase" }}>Tax & Structure Intelligence</span>
            </div>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", lineHeight: "1.5" }}>
              Jurisdiction-aware structures · Strategy tax comparison · Real numbers from your portfolio
            </p>
          </div>
          <div style={{ display: "flex", gap: "4px", background: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "4px", border: "1px solid rgba(255,255,255,0.08)" }}>
            {(["US", "FR"] as const).map(j => (
              <button key={j} onClick={() => setJurisdiction(j)} style={{ padding: "8px 20px", borderRadius: "9px", fontSize: "12px", fontWeight: "800", border: `1px solid ${jurisdiction === j ? "rgba(96,165,250,0.4)" : "transparent"}`, background: jurisdiction === j ? "rgba(96,165,250,0.15)" : "transparent", color: jurisdiction === j ? "#60a5fa" : "rgba(255,255,255,0.35)", cursor: "pointer" }}>
                {j === "US" ? "🇺🇸 US" : "🇫🇷 France"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Strategy tax comparison */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "20px", marginBottom: "16px" }}>
        <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: "700", marginBottom: "14px" }}>Strategy Tax Comparison — Your Numbers</p>
        <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
          {(Object.entries(STRATEGY_COMPARE) as [string, any][]).map(([key, s]) => (
            <button key={key} onClick={() => setStrategy(key as any)} style={{ padding: "7px 16px", borderRadius: "999px", fontSize: "11px", fontWeight: "800", border: `1px solid ${strategy === key ? s.color + "55" : "rgba(255,255,255,0.08)"}`, background: strategy === key ? s.color + "18" : "rgba(255,255,255,0.03)", color: strategy === key ? s.color : "rgba(255,255,255,0.4)", cursor: "pointer", transition: "all 0.15s" }}>
              {s.label}
            </button>
          ))}
        </div>
        <div style={{ background: `${sc.color}08`, border: `1px solid ${sc.color}25`, borderRadius: "14px", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: sc.color, boxShadow: `0 0 6px ${sc.color}` }} />
            <span style={{ fontSize: "12px", fontWeight: "800", color: sc.color }}>{sc.label} — Tax Impact</span>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginLeft: "auto" }}>{jurisdiction === "US" ? "🇺🇸 US Tax Code" : "🇫🇷 Droit fiscal français"}</span>
          </div>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", lineHeight: "1.7" }}>{jurisdiction === "US" ? sc.us : sc.fr}</p>
        </div>
      </div>

      {/* Structures */}
      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: "700", marginBottom: "12px" }}>
        {jurisdiction === "US" ? "🇺🇸 US Legal Structures" : "🇫🇷 Régimes & Structures FR"} — Recommended for Your Portfolio
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {structures.map((s, i) => (
          <div key={i} style={{ background: `${s.color}06`, border: `1px solid ${s.color}22`, borderRadius: "16px", padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: `${s.color}15`, border: `1px solid ${s.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>{s.icon}</div>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: "900", color: "#fff" }}>{s.name}</p>
                  <p style={{ fontSize: "10px", color: s.color, fontWeight: "700", marginTop: "2px" }}>When: {s.when}</p>
                </div>
              </div>
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "999px", padding: "3px 10px" }}>{s.annual_cost}</span>
            </div>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", lineHeight: "1.6", marginBottom: "6px" }}><span style={{ color: s.color, fontWeight: "700" }}>Benefit: </span>{s.benefit}</p>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", lineHeight: "1.6", marginBottom: "8px" }}><span style={{ color: "rgba(255,255,255,0.4)", fontWeight: "700" }}>Tax impact: </span>{s.tax}</p>
            <p style={{ fontSize: "11px", color: s.color, fontWeight: "700" }}>✓ Best for: {s.best_for}</p>
          </div>
        ))}
      </div>
      <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.15)", textAlign: "center", marginTop: "14px" }}>Not financial or legal advice. Consult a CPA or tax attorney for your specific situation.</p>
    </div>
  );
}
function ProjectIntelligence({ project }: { project: any }) {
  const [aiReport, setAiReport] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const budget = project.budget || 0;
  const spent = project.spent || 0;
  const remaining = Math.max(0, budget - spent);
  const burnPct = budget > 0 ? (spent / budget) * 100 : 0;
  const donePhases = (project.phases || []).filter((p: any) => p.status === "done").length;
  const totalPhases = (project.phases || []).length;
  const phasePct = totalPhases > 0 ? (donePhases / totalPhases) * 100 : 0;
  const isOnTrack = burnPct <= phasePct + 10;

  async function generateReport() {
    setLoading(true); setAiReport("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 400,
          messages: [{ role: "user", content: `Construction finance analyst. 3-point briefing. Format: **Risk** [1 sentence]. **Finance** [1 recommendation]. **Action** [1 next step]. Project: ${JSON.stringify({ name: project.name, type: project.type, budget, spent, remaining, burnPct: burnPct.toFixed(1), phasePct: phasePct.toFixed(1), donePhases, totalPhases })}` }]
        })
      });
      const d = await res.json();
      setAiReport(d.content?.find((b: any) => b.type === "text")?.text || "");
    } catch { setAiReport("Unable to generate report."); }
    setLoading(false);
  }

  return (
    <div style={{ background: "linear-gradient(135deg,rgba(167,139,250,0.06),rgba(96,165,250,0.03))", border: "1px solid rgba(167,139,250,0.2)", borderRadius: "18px", padding: "20px 24px", margin: "16px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>⚡</div>
          <div>
            <p style={{ fontSize: "11px", fontWeight: "800", color: "#a78bfa", letterSpacing: "1px", textTransform: "uppercase" }}>Project Intelligence</p>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "1px" }}>Financing · Risk · AI Briefing</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={generateReport} disabled={loading} style={{ fontSize: "11px", padding: "7px 14px", background: loading ? "rgba(167,139,250,0.1)" : "#a78bfa", color: loading ? "#a78bfa" : "#000", border: "none", borderRadius: "8px", cursor: loading ? "not-allowed" : "pointer", fontWeight: "800" }}>{loading ? "Analyzing..." : "🤖 AI Briefing"}</button>
          <button onClick={() => setExpanded(!expanded)} style={{ fontSize: "11px", padding: "7px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontWeight: "700" }}>{expanded ? "▲ Less" : "▼ Details"}</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginBottom: "14px" }}>
        {[
          { label: "Budget Health", value: isOnTrack ? "On Track" : "At Risk", color: isOnTrack ? "#34d399" : "#f87171" },
          { label: "Burn Rate", value: burnPct.toFixed(0) + "%", color: burnPct > 90 ? "#f87171" : burnPct > 70 ? "#f59e0b" : "#34d399" },
          { label: "Progress", value: phasePct.toFixed(0) + "%", color: "#a78bfa" },
          { label: "Remaining", value: remaining > 0 ? "$" + Math.round(remaining).toLocaleString() : "Overbudget", color: remaining > 0 ? "#60a5fa" : "#f87171" },
        ].map(m => (
          <div key={m.label} style={{ background: "rgba(0,0,0,0.2)", borderRadius: "12px", padding: "12px", border: `1px solid ${m.color}22` }}>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "4px" }}>{m.label}</p>
            <p style={{ fontSize: "16px", fontWeight: "900", color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>

      {aiReport && (
        <div style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: "12px", padding: "14px 18px", marginBottom: "14px" }}>
          {aiReport.split("\n").map((line, i) => {
            const m = line.match(/^\*\*(.*?)\*\*(.*)/);
            if (m) return <p key={i} style={{ fontSize: "13px", lineHeight: "1.7", marginBottom: "8px" }}><span style={{ color: "#a78bfa", fontWeight: "800" }}>{m[1]}</span><span style={{ color: "rgba(255,255,255,0.65)" }}>{m[2]}</span></p>;
            return line ? <p key={i} style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", lineHeight: "1.7", marginBottom: "6px" }}>{line}</p> : null;
          })}
        </div>
      )}

      {expanded && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {[
            { risk: "Budget Overrun", level: burnPct > phasePct + 15 ? "HIGH" : burnPct > phasePct + 5 ? "MED" : "LOW", note: burnPct > phasePct ? "Spending ahead of progress" : "Spend aligned with progress" },
            { risk: "Timeline Delay", level: (project.phases || []).some((p: any) => p.status === "delayed") ? "HIGH" : "LOW", note: (project.phases || []).some((p: any) => p.status === "delayed") ? "Delayed phases detected" : "All phases on schedule" },
            { risk: "Capital Gap", level: remaining < budget * 0.1 ? "HIGH" : remaining < budget * 0.2 ? "MED" : "LOW", note: remaining < budget * 0.15 ? "Less than 15% budget remaining" : "Adequate reserves" },
            { risk: "Exit Risk", level: !project.end_date ? "MED" : "LOW", note: project.end_date ? "Exit date defined" : "No completion date set" },
          ].map(r => {
            const rc = r.level === "HIGH" ? "#f87171" : r.level === "MED" ? "#f59e0b" : "#34d399";
            return (
              <div key={r.risk} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: `${rc}06`, border: `1px solid ${rc}22`, borderRadius: "10px" }}>
                <div>
                  <p style={{ fontSize: "12px", fontWeight: "700", color: "#fff", marginBottom: "2px" }}>{r.risk}</p>
                  <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>{r.note}</p>
                </div>
                <span style={{ fontSize: "10px", fontWeight: "900", color: rc, background: `${rc}18`, border: `1px solid ${rc}33`, borderRadius: "999px", padding: "3px 10px" }}>{r.level}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
function MapSection({ properties, selected, onSelect }: { properties: Property[]; selected: number | null; onSelect: (id: number) => void }) {
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [pulseDone, setPulseDone] = useState(false);
  useEffect(() => { const t = setTimeout(() => setPulseDone(true), 2400); return () => clearTimeout(t); }, []);
  const groups = Array.from(new Set(properties.map(p => p.groupTag).filter(Boolean))) as string[];
  const STATUS_CHIPS = [
    { val: "all", label: "All" },
    { val: "occupied", label: "Occupied", color: "#34d399" },
    { val: "vacant", label: "Vacant", color: "#f87171" },
    { val: "str", label: "STR", color: "#e879f9" },
    { val: "planned", label: "Planned", color: "#60a5fa" },
    { val: "sold", label: "Sold", color: "#ffd700" },
  ];
  const filtered = properties
    .filter(p => filterStatus === "all" || p.occupancyStatus === filterStatus)
    .filter(p => filterGroup === "all" || p.groupTag === filterGroup);
  const LEGEND = [
    { color: "#34d399", label: "Occupied" },
    { color: "#e879f9", label: "STR" },
    { color: "#f87171", label: "Vacant" },
    { color: "#60a5fa", label: "Planned" },
    { color: "#ffd700", label: "Sold" },
  ];
  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <h2 style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase" }}>Asset Map</h2>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", marginTop: "2px" }}>Tactical view · {properties.length} assets tracked</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {STATUS_CHIPS.map(s => (
              <button key={s.val} onClick={() => setFilterStatus(s.val)} style={{ fontSize: "10px", padding: "4px 11px", borderRadius: "999px", fontWeight: "700", border: `1px solid ${filterStatus === s.val ? (s.color || "rgba(255,255,255,0.4)") + "88" : "rgba(255,255,255,0.08)"}`, background: filterStatus === s.val ? (s.color || "#fff") + "18" : "rgba(255,255,255,0.03)", color: filterStatus === s.val ? (s.color || "#fff") : "rgba(255,255,255,0.35)", cursor: "pointer", transition: "all 0.15s" }}>{s.label}</button>
            ))}
          </div>
          {groups.length > 0 && (
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", alignSelf: "center", fontWeight: "600", letterSpacing: "0.5px" }}>GROUP:</span>
              {["all", ...groups].map(g => (
                <button key={g} onClick={() => setFilterGroup(g)} style={{ fontSize: "10px", padding: "4px 11px", borderRadius: "999px", fontWeight: "700", border: `1px solid ${filterGroup === g ? "rgba(96,165,250,0.5)" : "rgba(255,255,255,0.08)"}`, background: filterGroup === g ? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.03)", color: filterGroup === g ? "#60a5fa" : "rgba(255,255,255,0.35)", cursor: "pointer", transition: "all 0.15s" }}>{g === "all" ? "All" : g}</button>
              ))}
            </div>
          )}
          <button onClick={() => window.open("/map", "_blank")} style={{ fontSize: "12px", padding: "8px 16px", background: "#f59e0b", color: "#000", borderRadius: "9px", fontWeight: "800", border: "none", cursor: "pointer", letterSpacing: "0.3px", boxShadow: pulseDone ? "none" : "0 0 0 4px rgba(245,158,11,0.25)", transition: "box-shadow 0.4s", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "14px" }}>↗</span> Full Map
          </button>
        </div>
      </div>
      <div style={{ position: "relative" }}>
        <TacticalMap properties={filtered} selected={selected} onSelect={onSelect} />
        <div style={{ position: "absolute", bottom: "14px", left: "14px", zIndex: 410, background: "rgba(5,10,15,0.88)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "10px 14px", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", gap: "6px" }}>
          {LEGEND.map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: l.color, boxShadow: "0 0 5px " + l.color + "88", flexShrink: 0 }} />
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", fontWeight: "600", letterSpacing: "0.5px" }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function propertyHealthScore(p: Property): number {
  let score = 0;
  if (p.occupancyStatus === "occupied") score += 30;
  else if (p.occupancyStatus === "str") score += 25;
  else if (p.occupancyStatus === "planned") score += 10;
  if (p.rent > 0) { const cf = propCashFlow(p); const margin = (cf / p.rent) * 100; if (margin >= 40) score += 25; else if (margin >= 20) score += 18; else if (margin >= 0) score += 10; }
  const ltv = p.value > 0 ? (p.mortgage / p.value) * 100 : 100; if (ltv <= 60) score += 20; else if (ltv <= 75) score += 14; else if (ltv <= 85) score += 8;
  const expRatio = p.rent > 0 ? (p.expenses / p.rent) * 100 : 100; if (expRatio <= 30) score += 15; else if (expRatio <= 50) score += 10; else if (expRatio <= 70) score += 5;
  if (p.appreciation >= 4) score += 10; else if (p.appreciation >= 2.5) score += 7; else score += 3;
  return Math.min(100, Math.round(score));
}

function HealthBadge({ score, property }: { score: number; property?: Property }) {
  const [open, setOpen] = useState(false);
  const color = score >= 70 ? "#34d399" : score >= 45 ? "#f59e0b" : "#f87171";
  const label = score >= 70 ? "Healthy" : score >= 45 ? "Watch" : "At Risk";

  const factors = property ? [
    {
      label: "Occupancy",
      value: property.occupancyStatus === "occupied" ? "Occupied" : property.occupancyStatus === "str" ? "STR" : property.occupancyStatus === "planned" ? "Planned" : "Vacant",
      points: property.occupancyStatus === "occupied" ? 30 : property.occupancyStatus === "str" ? 25 : property.occupancyStatus === "planned" ? 10 : 0,
      max: 30,
      good: property.occupancyStatus === "occupied" || property.occupancyStatus === "str",
    },
    {
      label: "Cash Flow Margin",
      value: property.rent > 0 ? `${(((propCashFlow(property)) / property.rent) * 100).toFixed(0)}%` : "No rent",
      points: (() => { if (!property.rent) return 0; const m = (propCashFlow(property) / property.rent) * 100; return m >= 40 ? 25 : m >= 20 ? 18 : m >= 0 ? 10 : 0; })(),
      max: 25,
      good: property.rent > 0 && (propCashFlow(property) / property.rent) * 100 >= 20,
    },
    {
      label: "LTV",
      value: property.value > 0 ? `${((property.mortgage / property.value) * 100).toFixed(0)}%` : "—",
      points: (() => { const ltv = property.value > 0 ? (property.mortgage / property.value) * 100 : 100; return ltv <= 60 ? 20 : ltv <= 75 ? 14 : ltv <= 85 ? 8 : 0; })(),
      max: 20,
      good: property.value > 0 && (property.mortgage / property.value) * 100 <= 75,
    },
    {
      label: "Expense Ratio",
      value: property.rent > 0 ? `${((property.expenses / property.rent) * 100).toFixed(0)}%` : "—",
      points: (() => { const r = property.rent > 0 ? (property.expenses / property.rent) * 100 : 100; return r <= 30 ? 15 : r <= 50 ? 10 : r <= 70 ? 5 : 0; })(),
      max: 15,
      good: property.rent > 0 && (property.expenses / property.rent) * 100 <= 50,
    },
    {
      label: "Appreciation",
      value: `${property.appreciation}%/yr`,
      points: property.appreciation >= 4 ? 10 : property.appreciation >= 2.5 ? 7 : 3,
      max: 10,
      good: property.appreciation >= 3,
    },
  ] : [];

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <div
        onClick={e => { e.stopPropagation(); setOpen(!open); }}
        title={`Health Score: ${score}/100`}
        style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 9px", borderRadius: "999px", background: `${color}12`, border: `1px solid ${color}33`, cursor: property ? "pointer" : "default" }}
      >
        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, boxShadow: `0 0 5px ${color}` }} />
        <span style={{ fontSize: "10px", fontWeight: "800", color }}>{score}</span>
        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontWeight: "600" }}>{label}</span>
        {property && <span style={{ fontSize: "9px", color: `${color}88` }}>▾</span>}
      </div>

      {open && property && (
        <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: "28px", left: 0, zIndex: 100, width: "260px", background: "#0f0f0f", border: `1px solid ${color}33`, borderRadius: "14px", padding: "14px", boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ position: "relative", width: "40px", height: "40px" }}>
                <svg width="40" height="40" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3"/>
                  <circle cx="20" cy="20" r="16" fill="none" stroke={color} strokeWidth="3"
                    strokeDasharray={`${2*Math.PI*16}`}
                    strokeDashoffset={`${2*Math.PI*16*(1-score/100)}`}
                    strokeLinecap="round"/>
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: "900", color }}>{score}</span>
                </div>
              </div>
              <div>
                <p style={{ fontSize: "13px", fontWeight: "900", color }}>{label}</p>
                <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>out of 100 pts</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "16px" }}>×</button>
          </div>

          {/* Factor breakdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
            {factors.map(f => (
              <div key={f.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: f.good ? "#34d399" : "#f87171", flexShrink: 0 }} />
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", flex: 1 }}>{f.label}</span>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{f.value}</span>
                <div style={{ width: "50px", height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "999px" }}>
                  <div style={{ height: "100%", width: `${(f.points / f.max) * 100}%`, background: f.good ? "#34d399" : "#f87171", borderRadius: "999px" }} />
                </div>
                <span style={{ fontSize: "10px", fontWeight: "800", color: f.good ? "#34d399" : "#f87171", minWidth: "24px", textAlign: "right" }}>{f.points}</span>
              </div>
            ))}
          </div>

          {/* Total */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: `${color}08`, borderRadius: "8px", border: `1px solid ${color}22` }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.5)" }}>Total Score</span>
            <span style={{ fontSize: "13px", fontWeight: "900", color }}>{score} / 100</span>
          </div>

          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.15)", textAlign: "center", marginTop: "8px" }}>Click anywhere to close</p>
        </div>
      )}
    </div>
  );
}

function VacancyCost({ property: p }: { property: Property }) {
  if (p.occupancyStatus !== "vacant" || p.rent === 0) return null;
  let days = 0;
  try { const stored = localStorage.getItem(`gs_vacant_${p.id}`); if (!stored) localStorage.setItem(`gs_vacant_${p.id}`, new Date().toISOString()); days = Math.max(0, Math.floor((Date.now() - new Date(localStorage.getItem(`gs_vacant_${p.id}`) || "").getTime()) / 86400000)); } catch {}
  const lost = Math.round((p.rent / 30) * days);
  return <div style={{ fontSize: "10px", color: "#f87171", fontWeight: "700", marginTop: "2px" }}>🔴 ${lost.toLocaleString()} lost · {days}d vacant</div>;
}
function LiveIncomeCounter({ monthlyCashFlow }: { monthlyCashFlow: number }) {
  const [earned, setEarned] = useState(0);
  const perSecond = monthlyCashFlow / 30 / 24 / 3600;
  useEffect(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const secondsToday = (Date.now() - startOfDay) / 1000;
    setEarned(perSecond * secondsToday);
    const interval = setInterval(() => setEarned(e => e + perSecond), 1000);
    return () => clearInterval(interval);
  }, [perSecond]);
  if (monthlyCashFlow <= 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399", boxShadow: "0 0 6px #34d399", animation: "blink 1.5s infinite", flexShrink: 0 }} />
        <span style={{ fontSize: "9px", color: "rgba(52,211,153,0.6)", letterSpacing: "2px", fontWeight: "700", textTransform: "uppercase" as const }}>Today's Income</span>
      </div>
      <p style={{ fontSize: "28px", fontWeight: "900", color: "#34d399", letterSpacing: "-1px", lineHeight: 1 }}>+${earned.toFixed(2)}</p>
      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "2px" }}>${(perSecond * 3600).toFixed(2)}/hr · ${(perSecond * 86400).toFixed(2)}/day</p>
    </div>
  );
}
function CompareModal({ properties }: { properties: Property[] }) {
  const COLORS = ["#f59e0b","#34d399","#60a5fa","#e879f9","#f87171","#a78bfa","#fb923c","#22d3ee"];
  const activeProps = properties.filter(p => p.occupancyStatus !== "sold");
  const [selected, setSelected] = useState<number[]>(activeProps.slice(0,2).map(p => p.id));
  const selectedProps = activeProps.filter(p => selected.includes(p.id));
  function toggle(id: number) { setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); }

  function buildChart(p: Property) {
    const base = p.mortgage > 0 ? p.mortgage / 0.8 : p.value * 0.85;
    const app = (p.appreciation || 3.5) / 100;
    return [0,1,2,3,4,5].map(y => Math.round(base * Math.pow(1 + app, y)));
  }

function ValueChart() {
    if (selectedProps.length === 0) return null;
    const allSeries = selectedProps.map(p => ({ prop: p, data: buildChart(p), color: COLORS[activeProps.indexOf(p) % COLORS.length] }));
    function fmtK(n: number) { return n >= 1000000 ? "$"+(n/1000000).toFixed(1)+"M" : "$"+(n/1000).toFixed(0)+"K"; }
    const W = 400; const H = 160;
    const PAD = { t: 16, r: 16, b: 24, l: 56 };
    const cW = W - PAD.l - PAD.r; const cH = H - PAD.t - PAD.b;
    function xPos(i: number) { return PAD.l + (i / 5) * cW; }
    return (
      <div style={{ marginBottom: "32px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "20px" }}>
        <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: "700", marginBottom: "16px" }}>5-Year Estimated Value Trajectory — Independent Scale Per Property</p>
        <div style={{ display: "grid", gridTemplateColumns: allSeries.map(() => "1fr").join(" "), gap: "16px" }}>
          {allSeries.map(({ prop, data, color }) => {
            const minV = Math.min(...data) * 0.97;
            const maxV = Math.max(...data) * 1.03;
            function yPos(v: number) { return PAD.t + cH - ((v - minV) / (maxV - minV)) * cH; }
            const pts = data.map((v, i) => `${xPos(i)},${yPos(v)}`).join(" ");
            const uid = `grad_${prop.id}`;
            const growth = ((data[5] - data[0]) / data[0] * 100).toFixed(1);
            return (
              <div key={prop.id} style={{ background: `${color}08`, border: `1px solid ${color}22`, borderRadius: "12px", padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "800", color }}>{prop.name}</span>
                  <span style={{ fontSize: "12px", fontWeight: "800", color: "#34d399" }}>+{growth}% in 5yr</span>
                </div>
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
                  {[0, 0.5, 1].map(t => {
                    const v = minV + t * (maxV - minV); const y = yPos(v);
                    return <g key={t}><line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/><text x={PAD.l - 4} y={y + 4} fill="rgba(255,255,255,0.25)" fontSize="11" textAnchor="end">{fmtK(v)}</text></g>;
                  })}
                  {["Now","Y1","Y2","Y3","Y4","Y5"].map((l, i) => <text key={l} x={xPos(i)} y={H - 4} fill="rgba(255,255,255,0.2)" fontSize="10" textAnchor="middle">{l}</text>)}
                  <defs><linearGradient id={uid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.2"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
                  <polygon points={`${pts} ${xPos(5)},${PAD.t + cH} ${PAD.l},${PAD.t + cH}`} fill={`url(#${uid})`}/>
                  <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round"/>
                  {data.map((v, i) => <circle key={i} cx={xPos(i)} cy={yPos(v)} r={i === 0 || i === 5 ? 5 : 3} fill={color}/>)}
                </svg>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
                  <div><p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "2px" }}>NOW</p><p style={{ fontSize: "14px", fontWeight: "900", color }}>{fmtK(data[0])}</p></div>
                  <div style={{ textAlign: "right" }}><p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "2px" }}>YEAR 5</p><p style={{ fontSize: "14px", fontWeight: "900", color }}>{fmtK(data[5])}</p></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const rows = [
    { label: "Market Value",  get: (p: Property) => p.value,                                        fmt: (v: number) => "$"+Math.round(v).toLocaleString(), higher: true },
    { label: "Equity",        get: (p: Property) => p.value - p.mortgage,                           fmt: (v: number) => "$"+Math.round(v).toLocaleString(), higher: true },
    { label: "Cash Flow/mo",  get: (p: Property) => propCashFlow(p),                                fmt: (v: number) => (v>=0?"+":"")+Math.round(v).toLocaleString(), higher: true },
    { label: "Gross Yield",   get: (p: Property) => p.value > 0 ? (p.rent*12/p.value)*100 : 0,      fmt: (v: number) => v.toFixed(1)+"%", higher: true },
    { label: "LTV",           get: (p: Property) => p.value > 0 ? (p.mortgage/p.value)*100 : 0,     fmt: (v: number) => v.toFixed(1)+"%", higher: false },
    { label: "Health Score",  get: (p: Property) => propertyHealthScore(p),                         fmt: (v: number) => String(Math.round(v)), higher: true },
    { label: "Appreciation",  get: (p: Property) => p.appreciation,                                 fmt: (v: number) => v.toFixed(1)+"%/yr", higher: true },
  ];

  return (
    <div>
      <div style={{ marginBottom: "28px" }}>
        <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: "700", marginBottom: "12px" }}>Select Properties</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          {activeProps.map((p) => {
            const isSelected = selected.includes(p.id);
            const color = COLORS[activeProps.indexOf(p) % COLORS.length];
            const cf = propCashFlow(p);
            return (
              <button key={p.id} onClick={() => toggle(p.id)} style={{ padding: "10px 18px", borderRadius: "12px", fontSize: "13px", fontWeight: "700", border: `1px solid ${isSelected ? color : "rgba(255,255,255,0.1)"}`, background: isSelected ? `${color}18` : "rgba(255,255,255,0.03)", color: isSelected ? color : "rgba(255,255,255,0.4)", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "all 0.15s" }}>
                {isSelected && <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }}/>}
                <div style={{ textAlign: "left" }}>
                  <div>{p.name}</div>
                  <div style={{ fontSize: "10px", color: isSelected ? `${color}99` : "rgba(255,255,255,0.25)", fontWeight: "600", marginTop: "2px" }}>{fmt(p.value)} · {cf >= 0 ? "+" : ""}{fmtFull(cf)}/mo</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedProps.length > 0 && <ValueChart />}

      {selectedProps.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: selectedProps.map(() => "1fr").join(" "), gap: "16px", marginBottom: "32px" }}>
          {selectedProps.map((p) => {
            const color = COLORS[activeProps.indexOf(p) % COLORS.length];
            const cf = propCashFlow(p);
            const equity = p.value - p.mortgage;
            const roi = equity > 0 ? (cf * 12 / equity) * 100 : 0;
            return (
              <div key={p.id} style={{ background: `${color}08`, border: `1px solid ${color}33`, borderRadius: "18px", padding: "24px", textAlign: "center" }}>
                <p style={{ fontSize: "11px", fontWeight: "800", color, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "16px" }}>{p.name}</p>
                <p style={{ fontSize: "42px", fontWeight: "900", color, letterSpacing: "-2px", lineHeight: 1, marginBottom: "4px" }}>{fmt(p.value)}</p>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", marginBottom: "20px" }}>Market Value</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {[
                    { label: "Equity", value: fmt(equity), color },
                    { label: "Cash Flow", value: `${cf >= 0 ? "+" : ""}${fmtFull(cf)}/mo`, color: cf >= 0 ? "#34d399" : "#f87171" },
                    { label: "ROI", value: `${roi.toFixed(1)}%`, color: "#fff" },
                    { label: "Health", value: `${propertyHealthScore(p)}/100`, color: "#fff" },
                  ].map(m => (
                    <div key={m.label} style={{ background: "rgba(0,0,0,0.25)", borderRadius: "10px", padding: "10px 8px" }}>
                      <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "4px" }}>{m.label}</p>
                      <p style={{ fontSize: "16px", fontWeight: "900", color: m.color }}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedProps.length >= 2 && (
        <div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: "700", marginBottom: "12px" }}>Head-to-Head</p>
          <div style={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: `180px ${selectedProps.map(() => "1fr").join(" ")}`, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ padding: "12px 16px", fontSize: "9px", color: "rgba(255,255,255,0.25)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px" }}>Metric</div>
              {selectedProps.map((p) => { const color = COLORS[activeProps.indexOf(p) % COLORS.length]; return <div key={p.id} style={{ padding: "12px 12px", fontSize: "12px", fontWeight: "800", color, textAlign: "center", borderLeft: "1px solid rgba(255,255,255,0.07)" }}>{p.name}</div>; })}
            </div>
            {rows.map(row => {
              const vals = selectedProps.map(p => row.get(p));
              const best = row.higher ? Math.max(...vals) : Math.min(...vals);
              return (
                <div key={row.label} style={{ display: "grid", gridTemplateColumns: `180px ${selectedProps.map(() => "1fr").join(" ")}`, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ padding: "14px 16px", fontSize: "12px", color: "rgba(255,255,255,0.35)", fontWeight: "600" }}>{row.label}</div>
                  {selectedProps.map((p, i) => {
                    const val = row.get(p); const color = COLORS[activeProps.indexOf(p) % COLORS.length];
                    const isBest = val === best;
                    const pct = vals[0] !== 0 && i > 0 ? ((val - vals[0]) / Math.abs(vals[0]) * 100) : null;
                    return (
                      <div key={p.id} style={{ padding: "14px 12px", textAlign: "center", borderLeft: "1px solid rgba(255,255,255,0.04)", background: isBest ? `${color}08` : "transparent" }}>
                        <div style={{ fontSize: "22px", fontWeight: "900", color: isBest ? color : "#fff", letterSpacing: "-0.5px" }}>{row.fmt(val)}</div>
                        {pct !== null && <div style={{ fontSize: "10px", fontWeight: "700", color: (row.higher ? pct > 0 : pct < 0) ? "#34d399" : "#f87171", marginTop: "3px" }}>{pct > 0 ? "+" : ""}{pct.toFixed(0)}%</div>}
                        {isBest && <div style={{ fontSize: "8px", fontWeight: "800", color, marginTop: "3px", letterSpacing: "0.8px", textTransform: "uppercase" }}>★ Best</div>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.15)", textAlign: "center", marginTop: "14px" }}>% relative to first selected · ★ = best performer · Trajectory estimated from appreciation rate</p>
        </div>
      )}

      {selectedProps.length === 0 && <p style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", padding: "40px", fontSize: "13px" }}>Select at least one property above.</p>}
    </div>
  );
}

function CompareProperties({ properties }: { properties: Property[] }) {
  return <CompareModal properties={properties} />;
}

function GoalCard({ label, p, milestonePct, value, valueColor, sub, pctLabel, barColor, glow, min, mid, max, onEdit, nextGap, nextTarget }: any) {
  return (
    <div style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 100%)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "22px", padding: "28px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, right: 0, width: "200px", height: "200px", background: `radial-gradient(circle at top right, ${glow ? glow.replace("0.4", "0.06").replace("0.3", "0.06") : "transparent"} 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap", gap: "4px" }}>
        <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "700" }}>{label}</p>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", fontWeight: "600" }}>{pctLabel}</span>
          <button onClick={onEdit} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "5px", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "11px", padding: "2px 7px", lineHeight: 1.4 }}>✎</button>
        </div>
      </div>
      {nextGap !== undefined && nextTarget !== undefined && (
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", fontWeight: "600", marginBottom: "6px", letterSpacing: "0.2px" }}>
          <span style={{ color: barColor, fontWeight: "800" }}>${Math.round(nextGap).toLocaleString()}</span> away from next milestone · {nextTarget}
        </p>
      )}
      <p className="gs-goal-value" style={{ fontWeight: "900", letterSpacing: "-1.5px", marginBottom: "4px", color: valueColor || "#fff", lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)", marginBottom: "20px", fontWeight: "500" }}>{sub}</p>
      <div style={{ position: "relative", height: "5px", background: "rgba(255,255,255,0.05)", borderRadius: "999px", marginBottom: "12px" }}>
        <div style={{ height: "100%", width: `${p}%`, background: `linear-gradient(90deg, ${barColor}cc, ${barColor})`, borderRadius: "999px", transition: "width 1s cubic-bezier(0.4,0,0.2,1)", boxShadow: `0 0 16px ${glow}` }} />
        {milestonePct && <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", left: `${milestonePct}%`, width: "1px", height: "12px", background: "rgba(255,255,255,0.15)" }} />}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "rgba(255,255,255,0.18)", fontWeight: "600", letterSpacing: "0.5px" }}>
        <span>{min}</span>
        {mid && <span style={{ color: "rgba(255,255,255,0.25)" }}>{mid}</span>}
        <span>{max}</span>
      </div>
    </div>
  );
}

function PropertyTable({ properties, selected, onSelect, onEdit, onDelete, onAdd, onCompare }: any) {
  const [sortBy, setSortBy] = useState<"name"|"value"|"cashflow"|"roi"|"equity">("value");
  const [sortDir, setSortDir] = useState<"desc"|"asc">("desc");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [viewMode, setViewMode] = useState<"table"|"cards">("cards");

  const activeProps = properties.filter((p: Property) => p.occupancyStatus !== "sold");
  const soldProps = properties.filter((p: Property) => p.occupancyStatus === "sold");
  const groups = Array.from(new Set(properties.map((p: Property) => p.groupTag).filter(Boolean))) as string[];
  const types = Array.from(new Set(properties.map((p: Property) => p.type))) as string[];

  function sorted(list: Property[]) {
    return [...list]
      .filter(p => filterStatus === "all" || p.occupancyStatus === filterStatus)
      .filter(p => filterType === "all" || p.type === filterType)
      .filter(p => filterGroup === "all" || p.groupTag === filterGroup)
      .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.address.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const eq = (p: Property) => p.value - p.mortgage;
        const cf = (p: Property) => propCashFlow(p);
        const roi = (p: Property) => eq(p) > 0 ? (cf(p) * 12 / eq(p)) * 100 : 0;
        let va = 0, vb = 0;
        if (sortBy === "value") { va = a.value; vb = b.value; }
        else if (sortBy === "cashflow") { va = cf(a); vb = cf(b); }
        else if (sortBy === "roi") { va = roi(a); vb = roi(b); }
        else if (sortBy === "equity") { va = eq(a); vb = eq(b); }
        else { return sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name); }
        return sortDir === "desc" ? vb - va : va - vb;
      });
  }

  function SortBtn({ col, label }: { col: typeof sortBy; label: string }) {
    const active = sortBy === col;
    return (
      <span onClick={() => { if (active) setSortDir(d => d === "desc" ? "asc" : "desc"); else { setSortBy(col); setSortDir("desc"); } }}
        style={{ cursor: "pointer", color: active ? "#f59e0b" : "rgba(255,255,255,0.25)", userSelect: "none" }}>
        {label}{active ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
      </span>
    );
  }

  function PropRow({ p }: { p: Property }) {
    const equity = p.value - p.mortgage;
    const cf = propCashFlow(p);
    const roi = equity > 0 ? ((cf * 12) / equity) * 100 : 0;
    const oc = occupancyColor(p);
    const ltv = p.value > 0 ? (p.mortgage / p.value) * 100 : 0;
    const borderColor = cf > 0 ? "#34d399" : p.occupancyStatus === "vacant" ? "#f59e0b" : "#f87171";
    return (
      <tr onClick={() => onSelect(selected === p.id ? null : p.id)} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", background: selected === p.id ? "rgba(245,158,11,0.04)" : "transparent", transition: "background 0.15s", borderLeft: `3px solid ${borderColor}` }}>
        <td style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <p style={{ fontWeight: "600" }}>{p.name}</p>
            <FlagPill address={p.address} />
          </div>
          <div style={{ marginTop: "4px" }}>
            <HealthBadge score={propertyHealthScore(p)} property={p} />
          </div>
          <VacancyCost property={p} />
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>
            {p.type}{p.groupTag ? <span style={{ marginLeft: "6px", fontSize: "9px", padding: "1px 6px", borderRadius: "4px", background: "rgba(96,165,250,0.1)", color: "#60a5fa" }}>{p.groupTag}</span> : null}
          </p>
          {p.mortgage > 0 && (
            <div style={{ marginTop: "5px", width: "100%", maxWidth: "160px" }}>
              <div style={{ height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "999px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, ltv)}%`, background: ltv <= 70 ? "#34d399" : ltv <= 85 ? "#f59e0b" : "#f87171", borderRadius: "999px" }} />
              </div>
              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", marginTop: "2px" }}>LTV {ltv.toFixed(0)}% · {fmt(p.mortgage)} owed</p>
            </div>
          )}
        </td>
        <td style={{ textAlign: "right", padding: "14px 16px" }}>{fmtFull(p.value)}</td>
        <td style={{ textAlign: "right", padding: "14px 16px", color: "#f59e0b", fontWeight: "600" }}>{fmtFull(equity)}</td>
        <td style={{ textAlign: "right", padding: "14px 16px" }}>{isEffectivelyOccupied(p) ? fmtFull(p.rent) : "—"}</td>
        <td style={{ textAlign: "right", padding: "14px 16px", fontWeight: "700", color: cf >= 0 ? "#34d399" : "#f87171" }}>{cf >= 0 ? "+" : ""}{fmtFull(cf)}</td>
        <td style={{ textAlign: "right", padding: "14px 16px", color: "rgba(255,255,255,0.5)" }}>{roi.toFixed(1)}%</td>
        <td style={{ textAlign: "right", padding: "14px 16px" }}>
          <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "999px", fontWeight: "600", background: oc.bg, color: oc.color, border: `1px solid ${oc.border}`, whiteSpace: "nowrap" }}>{occupancyLabel(p)}</span>
        </td>
        <td style={{ padding: "14px 10px" }} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
            <button onClick={e => onEdit(p, e)} style={{ fontSize: "11px", padding: "4px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontWeight: "600" }}>Edit</button>
            <button onClick={() => onDelete(p.id)} style={{ fontSize: "16px", background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button>
          </div>
        </td>
      </tr>
    );
  }

  const displayProps = sorted(activeProps);

  return (
    <div style={{ marginBottom: "20px" }}>
      {/* Header + controls */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px 20px 0 0", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
  <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
    <h2 style={{ fontSize: "10px", fontWeight: "800", color: "rgba(245,158,11,0.6)", letterSpacing: "3px", textTransform: "uppercase" }}>Portfolio</h2>
    <p style={{ fontSize: "16px", fontWeight: "900", color: "#fff", letterSpacing: "-0.5px", lineHeight: 1 }}>Assets</p>
  </div>
  <div style={{ display: "flex", gap: "3px", background: "rgba(255,255,255,0.05)", borderRadius: "10px", padding: "3px", border: "1px solid rgba(255,255,255,0.07)" }}>
    <button onClick={() => setViewMode("cards")} title="Card view" style={{ padding: "7px 14px", borderRadius: "7px", border: "none", cursor: "pointer", background: viewMode === "cards" ? "rgba(245,158,11,0.18)" : "transparent", color: viewMode === "cards" ? "#f59e0b" : "rgba(255,255,255,0.3)", fontSize: "15px", fontWeight: "700", transition: "all 0.15s", boxShadow: viewMode === "cards" ? "0 0 12px rgba(245,158,11,0.15)" : "none" }}>⊞</button>
    <button onClick={() => setViewMode("table")} title="Table view" style={{ padding: "7px 14px", borderRadius: "7px", border: "none", cursor: "pointer", background: viewMode === "table" ? "rgba(245,158,11,0.18)" : "transparent", color: viewMode === "table" ? "#f59e0b" : "rgba(255,255,255,0.3)", fontSize: "15px", fontWeight: "700", transition: "all 0.15s", boxShadow: viewMode === "table" ? "0 0 12px rgba(245,158,11,0.15)" : "none" }}>☰</button>
  </div>
</div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => onCompare()} style={{ fontSize: "12px", padding: "8px 16px", background: "transparent", color: "#f59e0b", borderRadius: "8px", fontWeight: "700", border: "1px solid rgba(245,158,11,0.4)", cursor: "pointer" }}>⚖ Compare</button>
<button onClick={() => {
  // Load jsPDF
  const _firstName = "Investor";
  const _props = properties;
  const _goalP = 2_000_000;
  const _goalCF = 2000;
  const loadScript = (src: string) => new Promise<void>(res => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement("script"); s.src = src; s.onload = () => res(); document.head.appendChild(s);
  });

  const runReport = () => {
    const { jsPDF } = (window as any).jspdf;
    const settings = { firstName: _firstName };
    const properties = _props;
    const GOAL_PORTFOLIO = _goalP;
    const GOAL_CASHFLOW = _goalCF;
    const _settings = settings;
    const _properties = properties;
    const _displayName = _settings.firstName || "Investor";
    const _GOAL_PORTFOLIO = GOAL_PORTFOLIO;
    const _GOAL_CASHFLOW = GOAL_CASHFLOW;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210; const H = 297;
    const GOLD: [number,number,number] = [201, 168, 76]; const WHITE: [number,number,number] = [255,255,255]; const DARK: [number,number,number] = [20,20,20];
    const MED: [number,number,number] = [30,30,30]; const GREY: [number,number,number] = [107,107,107]; const GREEN: [number,number,number] = [46,204,113]; const RED: [number,number,number] = [231,76,60]; const BLUE: [number,number,number] = [74,144,217];
    const now = new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
    const totalValue = properties.reduce((s:number,p:Property)=>s+p.value,0);
    const totalMortgage = properties.reduce((s:number,p:Property)=>s+p.mortgage,0);
    const totalEquity = totalValue - totalMortgage;
    const totalRent = properties.filter((p:Property)=>p.occupancyStatus==="occupied"||p.occupancyStatus==="str").reduce((s:number,p:Property)=>s+p.rent,0);
    const totalExp = properties.reduce((s:number,p:Property)=>s+p.expenses,0);
    const monthlyCF = totalRent - totalExp;
    const avgApp = properties.length > 0 ? properties.reduce((s:number,p:Property)=>s+p.appreciation,0)/properties.length : 0;
    const fmtM = (n: number) => n>=1e6?"$"+(n/1e6).toFixed(2)+"M":n>=1000?"$"+Math.round(n).toLocaleString("en-US"):"$"+n.toFixed(0);
    const fmtP = (n: number) => n.toFixed(1)+"%";
    const cfStr = (n: number) => (n>=0?"+$":"-$")+Math.abs(Math.round(n)).toLocaleString("en-US");

    // ── PAGE 1 ──
    // Background
    doc.setFillColor(...DARK); doc.rect(0,0,W,H,"F");
    // Grid lines
    doc.setDrawColor(17,17,17); doc.setLineWidth(0.15);
    for(let x=0;x<W;x+=10) doc.line(x,0,x,H);
    for(let y=0;y<H;y+=10) doc.line(0,y,W,y);

    // Header bar
    doc.setFillColor(...MED); doc.rect(0,0,W,18,"F");
    doc.setFillColor(...GOLD); doc.rect(10,5,8,8,"F");
    doc.setFillColor(...DARK); doc.setFont("helvetica","bold"); doc.setFontSize(7); doc.setTextColor(...DARK); doc.text("GS",11.8,10.5);
    doc.setTextColor(...WHITE); doc.setFontSize(11); doc.setFont("helvetica","bold"); doc.text("GOLDSTREAM",21,10);
    doc.setTextColor(...GOLD); doc.setFontSize(6); doc.setFont("helvetica","normal"); doc.text("WEALTH INTELLIGENCE PLATFORM",21,14.5);
    doc.setTextColor(...GREY); doc.setFontSize(6); doc.text(`CONFIDENTIAL  ·  ${now}`,W-10,9,"right");
    doc.setTextColor(...WHITE); doc.setFont("helvetica","bold"); doc.setFontSize(7); doc.text("PORTFOLIO INTELLIGENCE REPORT",W-10,14,"right");
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.8); doc.line(0,18,W,18);

    // Hero
    doc.setFillColor(...MED); doc.rect(0,20,W,28,"F");
    doc.setFillColor(...GOLD); doc.rect(0,20,2.5,28,"F");
    doc.setTextColor(...GREY); doc.setFont("helvetica","normal"); doc.setFontSize(6); doc.text("PREPARED FOR",12,26);
    doc.setTextColor(...WHITE); doc.setFont("helvetica","bold"); doc.setFontSize(16); doc.text((_displayName).toUpperCase(),12,34);
    doc.setTextColor(...GOLD); doc.setFont("helvetica","bold"); doc.setFontSize(7); doc.text("PORTFOLIO INTELLIGENCE REPORT",12,40);
    doc.setTextColor(...GREY); doc.setFont("helvetica","normal"); doc.setFontSize(6); doc.text(`${_properties.length} Active Assets  ·  ${now}  ·  CONFIDENTIAL`,12,45.5);

    doc.setDrawColor(...GOLD); doc.setLineWidth(0.6); doc.line(10,50,W-10,50);

    // KPI cards
    const kpis = [
      {label:"TOTAL AUM",val:fmtM(totalValue),sub:fmtP((totalValue/_GOAL_PORTFOLIO)*100)+" of vision",col:GOLD},
      {label:"NET EQUITY",val:fmtM(totalEquity),sub:"Owned outright",col:WHITE},
      {label:"MONTHLY CF",val:cfStr(monthlyCF),sub:fmtP((monthlyCF/_GOAL_CASHFLOW)*100)+" to target",col:monthlyCF>=0?GREEN:RED},
      {label:"AVG APPRECIATION",val:fmtP(avgApp)+"/yr",sub:"Portfolio average",col:BLUE},
    ];
    const cardW = 44; const cardGap = 2; const cardX0 = 10; const cardY = 53;
    kpis.forEach((k,i) => {
      const x = cardX0 + i*(cardW+cardGap);
      doc.setFillColor(...MED); doc.roundedRect(x,cardY,cardW,24,1.5,1.5,"F");
      doc.setFillColor(...GOLD); doc.rect(x,cardY,cardW,0.8,"F");
      doc.setTextColor(...GREY); doc.setFont("helvetica","bold"); doc.setFontSize(5.5); doc.text(k.label,x+3,cardY+5);
      doc.setTextColor(...(k.col as [number,number,number])); doc.setFont("helvetica","bold"); doc.setFontSize(k.val.length>9?10:13); doc.text(k.val,x+3,cardY+14);
      doc.setTextColor(...GREY); doc.setFont("helvetica","normal"); doc.setFontSize(5.5); doc.text(k.sub,x+3,cardY+20);
    });

    doc.setDrawColor(...GOLD); doc.setLineWidth(0.5); doc.line(10,79,W-10,79);

    // Goal bars
    doc.setTextColor(...GREY); doc.setFont("helvetica","bold"); doc.setFontSize(6); doc.text("GOAL PROGRESS TRACKER",10,85);
    const barW = W-30; const barY1 = 88; const barY2 = 95;
    // Portfolio bar
    doc.setFillColor(40,40,40); doc.rect(10,barY1,barW,3.5,"F");
    doc.setFillColor(...GOLD); doc.rect(10,barY1,barW*Math.min(1,totalValue/_GOAL_PORTFOLIO),3.5,"F");
    doc.setTextColor(...WHITE); doc.setFontSize(5.5); doc.setFont("helvetica","bold"); doc.text(`Portfolio: ${fmtM(totalValue)} of ${fmtM(_GOAL_PORTFOLIO)}`,10,barY1+6);
    doc.setTextColor(...GOLD); doc.text(fmtP((totalValue/_GOAL_PORTFOLIO)*100),W-10,barY1+6,"right");
    // CF bar
    doc.setFillColor(40,40,40); doc.rect(10,barY2,barW,3.5,"F");
    doc.setFillColor(...GREEN); doc.rect(10,barY2,barW*Math.min(1,Math.max(0,monthlyCF/_GOAL_CASHFLOW)),3.5,"F");
    doc.setTextColor(...WHITE); doc.text(`Cash Flow: ${cfStr(monthlyCF)} of $${_GOAL_CASHFLOW.toLocaleString()}/mo`,10,barY2+6);
    doc.setTextColor(...GREEN); doc.text(fmtP((monthlyCF/_GOAL_CASHFLOW)*100),W-10,barY2+6,"right");

    doc.setDrawColor(...GOLD); doc.setLineWidth(0.5); doc.line(10,104,W-10,104);

    // Asset table
    doc.setTextColor(...GREY); doc.setFont("helvetica","bold"); doc.setFontSize(6); doc.text("ASSET HOLDINGS SUMMARY",10,110);
    const thdrs = ["ASSET NAME","TYPE","VALUE","EQUITY","CF/MO","ROI","STATUS"];
    const txs = [10,52,78,100,122,143,160]; const tws = [42,26,22,22,21,17,30];
    // Header row
    doc.setFillColor(...MED); doc.rect(10,112,W-20,6,"F");
    thdrs.forEach((h,i)=>{ doc.setTextColor(...GOLD); doc.setFont("helvetica","bold"); doc.setFontSize(5.5); doc.text(h,txs[i]+1.5,116); });

    let rowY = 118;
    properties.forEach((p:Property,i:number) => {
      if(rowY > 260) return;
      const eq = p.value - p.mortgage;
      const cf2 = p.occupancyStatus==="occupied"||p.occupancyStatus==="str" ? p.rent-p.expenses : -p.expenses;
      const roi = eq>0?(cf2*12/eq*100):0;
      const statusColors: Record<string,number[]> = {occupied:GREEN,vacant:RED,str:BLUE,planned:BLUE,sold:GOLD};
      const sc = statusColors[p.occupancyStatus]||GREY;
      const bg = i%2===0?[18,18,18]:[14,14,14];
      doc.setFillColor(...(bg as [number,number,number])); doc.rect(10,rowY,W-20,7,"F");
      doc.setFillColor(...(sc as [number,number,number])); doc.rect(10,rowY,1,7,"F");
      const rowData = [
        {t:p.name.slice(0,20),c:WHITE,b:true},{t:p.type.slice(0,12),c:GREY,b:false},
        {t:fmtM(p.value),c:WHITE,b:true},{t:fmtM(eq),c:GOLD,b:true},
        {t:cfStr(cf2),c:cf2>=0?GREEN:RED,b:true},{t:fmtP(roi),c:WHITE,b:false},
        {t:p.occupancyStatus.toUpperCase().slice(0,8),c:sc,b:true},
      ];
      rowData.forEach((d,j)=>{ doc.setTextColor(...(d.c as [number,number,number])); doc.setFont("helvetica",d.b?"bold":"normal"); doc.setFontSize(6.5); doc.text(d.t,txs[j]+1.5,rowY+4.5); });
      doc.setDrawColor(25,25,25); doc.setLineWidth(0.2); doc.line(10,rowY+7,W-10,rowY+7);
      rowY+=7;
    });
    // Totals
    doc.setFillColor(...MED); doc.rect(10,rowY,W-20,7,"F");
    doc.setTextColor(...GOLD); doc.setFont("helvetica","bold"); doc.setFontSize(6.5);
    doc.text("TOTAL PORTFOLIO",11.5,rowY+4.5);
    doc.text(fmtM(totalValue),txs[2]+1.5,rowY+4.5);
    doc.text(fmtM(totalEquity),txs[3]+1.5,rowY+4.5);
    doc.setTextColor(...(monthlyCF>=0?GREEN:RED)); doc.text(cfStr(monthlyCF),txs[4]+1.5,rowY+4.5);
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.5); doc.line(10,rowY+7,W-10,rowY+7);

    // Footer
    doc.setFillColor(...MED); doc.rect(0,H-12,W,12,"F");
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.4); doc.line(0,H-12,W,H-12);
    doc.setTextColor(...GREY); doc.setFont("helvetica","normal"); doc.setFontSize(5.5); doc.text(`GOLDSTREAM WEALTH INTELLIGENCE  ·  CONFIDENTIAL AND PROPRIETARY`,10,H-5);
    doc.setTextColor(...GOLD); doc.setFont("helvetica","bold"); doc.setFontSize(6); doc.text("Page 1",W-10,H-5,"right");

    // ── PAGE 2 ──
    doc.addPage();
    doc.setFillColor(...DARK); doc.rect(0,0,W,H,"F");
    for(let x=0;x<W;x+=10){ doc.setDrawColor(17,17,17); doc.setLineWidth(0.15); doc.line(x,0,x,H); }
    for(let y=0;y<H;y+=10) doc.line(0,y,W,y);
    // Header
    doc.setFillColor(...MED); doc.rect(0,0,W,18,"F");
    doc.setFillColor(...GOLD); doc.rect(10,5,8,8,"F");
    doc.setFillColor(...DARK); doc.setFont("helvetica","bold"); doc.setFontSize(7); doc.setTextColor(...DARK); doc.text("GS",11.8,10.5);
    doc.setTextColor(...WHITE); doc.setFontSize(11); doc.text("GOLDSTREAM",21,10);
    doc.setTextColor(...GOLD); doc.setFontSize(6); doc.setFont("helvetica","normal"); doc.text("WEALTH INTELLIGENCE PLATFORM",21,14.5);
    doc.setTextColor(...GREY); doc.setFontSize(6); doc.text(`CONFIDENTIAL  ·  ${now}`,W-10,9,"right");
    doc.setTextColor(...WHITE); doc.setFont("helvetica","bold"); doc.setFontSize(7); doc.text("ASSET ANALYTICS & RISK MATRIX",W-10,14,"right");
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.8); doc.line(0,18,W,18);

    doc.setFillColor(...MED); doc.rect(0,20,W,8,"F");
    doc.setFillColor(...GOLD); doc.rect(0,20,2.5,8,"F");
    doc.setTextColor(...WHITE); doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.text("INDIVIDUAL ASSET PERFORMANCE MATRIX",12,25.5);
    doc.setTextColor(...GREY); doc.setFont("helvetica","normal"); doc.setFontSize(6); doc.text(`Generated: ${now}`,W-10,25.5,"right");
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.5); doc.line(10,30,W-10,30);

    const ahdrs = ["ASSET","GROSS YIELD","LTV","CASH YIELD","APPR.","5Y VALUE","DSCR","HEALTH"];
    const axs = [10,48,68,86,106,122,148,168]; 
    doc.setFillColor(...MED); doc.rect(10,33,W-20,6,"F");
    ahdrs.forEach((h,i)=>{ doc.setTextColor(...GOLD); doc.setFont("helvetica","bold"); doc.setFontSize(5.5); doc.text(h,axs[i]+1.5,37); });

    let aRowY = 39;
    properties.forEach((p:Property,i:number)=>{
      const eq = p.value-p.mortgage;
      const cf2 = p.occupancyStatus==="occupied"||p.occupancyStatus==="str"?p.rent-p.expenses:-p.expenses;
      const gross = p.value>0?(p.rent*12/p.value*100):0;
      const ltv = p.value>0?(p.mortgage/p.value*100):0;
      const cashY = eq>0?(cf2*12/eq*100):0;
      const proj5 = p.value*Math.pow(1+p.appreciation/100,5);
      const loan = p.mortgage; const rm = 0.07/12; const nn = 360;
      const mort = loan>0?loan*(rm*Math.pow(1+rm,nn))/(Math.pow(1+rm,nn)-1):0;
      const dscr = mort>0?((p.rent-p.expenses)/mort):0;
      const score2 = Math.min(100, 60+(cf2>0?15:0)+(ltv<=70?15:0)+(gross>=6?10:0));
      const bg2 = i%2===0?[18,18,18]:[14,14,14];
      doc.setFillColor(...(bg2 as [number,number,number])); doc.rect(10,aRowY,W-20,8,"F");
      const aRow = [
        {t:p.name.slice(0,18),c:WHITE,b:true},
        {t:fmtP(gross),c:gross>=6?GREEN:RED,b:true},
        {t:fmtP(ltv),c:ltv<=70?GREEN:ltv<=80?GOLD:RED,b:true},
        {t:fmtP(cashY),c:cashY>=8?GREEN:cashY>=4?GOLD:RED,b:true},
        {t:fmtP(p.appreciation)+"/yr",c:BLUE,b:false},
        {t:fmtM(proj5),c:WHITE,b:true},
        {t:dscr.toFixed(2)+"x",c:dscr>=1.25?GREEN:dscr>=1?GOLD:RED,b:true},
        {t:score2+"/100",c:score2>=75?GREEN:score2>=55?GOLD:RED,b:true},
      ];
      aRow.forEach((d,j)=>{ doc.setTextColor(...(d.c as [number,number,number])); doc.setFont("helvetica",d.b?"bold":"normal"); doc.setFontSize(6.5); doc.text(d.t,axs[j]+1.5,aRowY+5); });
      doc.setDrawColor(25,25,25); doc.setLineWidth(0.2); doc.line(10,aRowY+8,W-10,aRowY+8);
      aRowY+=8;
    });

    doc.setDrawColor(...GOLD); doc.setLineWidth(0.5); doc.line(10,aRowY+2,W-10,aRowY+2);

    // Allocation bars
    doc.setTextColor(...GREY); doc.setFont("helvetica","bold"); doc.setFontSize(6); doc.text("PORTFOLIO ALLOCATION BY VALUE",10,aRowY+10);
    const barColors2 = [GOLD,BLUE,GREEN,[232,121,249],[249,115,22]] as number[][];
    properties.forEach((p:Property,i:number)=>{
      const by = aRowY+16+i*8;
      const pct2 = totalValue>0?p.value/totalValue:0;
      const bw2 = 100;
      doc.setFillColor(35,35,35); doc.rect(60,by,bw2,4,"F");
      doc.setFillColor(...(barColors2[i%barColors2.length] as [number,number,number])); doc.rect(60,by,bw2*pct2,4,"F");
      doc.setTextColor(...WHITE); doc.setFont("helvetica","bold"); doc.setFontSize(6); doc.text(p.name.slice(0,22),58,by+3,"right");
      doc.setTextColor(...GREY); doc.setFont("helvetica","normal"); doc.text(`${fmtP(pct2*100)}  ${fmtM(p.value)}`,162,by+3);
    });

    // Disclaimer
    const discY = H-38;
    doc.setFillColor(13,13,13); doc.rect(10,discY,W-20,25,"F");
    doc.setDrawColor(42,42,42); doc.setLineWidth(0.4); doc.rect(10,discY,W-20,25,"S");
    doc.setTextColor(...GREY); doc.setFont("helvetica","bold"); doc.setFontSize(6); doc.text("IMPORTANT DISCLOSURES",13,discY+6);
    doc.setFont("helvetica","normal"); doc.setFontSize(5);
    const disc = `This report is generated by Goldstream Wealth Intelligence and is intended solely for the named recipient. All figures are based on user-inputted data and do not constitute financial, legal, or investment advice. Past performance of real estate assets is not indicative of future results. Portfolio values, cash flows, and projections are estimates only. Goldstream is not a registered investment advisor. Report generated: ${now}.`;
    const dlines = doc.splitTextToSize(disc, W-26);
    doc.setTextColor(...GREY);
    dlines.slice(0,4).forEach((dl: string, li: number) => doc.text(dl,13,discY+12+li*4));

    // Footer p2
    doc.setFillColor(...MED); doc.rect(0,H-12,W,12,"F");
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.4); doc.line(0,H-12,W,H-12);
    doc.setTextColor(...GREY); doc.setFont("helvetica","normal"); doc.setFontSize(5.5); doc.text(`GOLDSTREAM WEALTH INTELLIGENCE  ·  CONFIDENTIAL AND PROPRIETARY`,10,H-5);
    doc.setTextColor(...GOLD); doc.setFont("helvetica","bold"); doc.setFontSize(6); doc.text("Page 2",W-10,H-5,"right");

    doc.save(`goldstream-portfolio-${new Date().toISOString().split("T")[0]}.pdf`);

  };

  loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js")
    .then(runReport);
}} style={{ fontSize: "12px", padding: "8px 16px", background: "transparent", color: "#34d399", borderRadius: "8px", fontWeight: "700", border: "1px solid rgba(52,211,153,0.4)", cursor: "pointer" }}>↓ PDF Report</button>
<button onClick={() => {
  const _props = properties;
  const now = new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
  const totalValue = _props.reduce((s:number,p:Property)=>s+p.value,0);
  const totalMortgage = _props.reduce((s:number,p:Property)=>s+p.mortgage,0);
  const totalEquity = totalValue - totalMortgage;
  const totalExp = _props.reduce((s:number,p:Property)=>s+p.expenses,0);
  const totalRent = _props.filter((p:Property)=>p.occupancyStatus==="occupied"||p.occupancyStatus==="str").reduce((s:number,p:Property)=>s+p.rent,0);
  const monthlyCF = totalRent - totalExp;
  const loadXL = (src: string) => new Promise<void>(res => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement("script"); s.src = src; s.onload = () => res(); document.head.appendChild(s);
  });
  loadXL("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js").then(() => {
    const XL = (window as any).XLSX;
    const wb = XL.utils.book_new();
    const summaryRows = [
      ["GOLDSTREAM — PORTFOLIO INTELLIGENCE REPORT"],
      [`Generated: ${now}`],[],
      ["PORTFOLIO SUMMARY"],
      ["Total Portfolio Value", totalValue],["Total Mortgage", totalMortgage],
      ["Net Equity", totalEquity],["Monthly Cash Flow", monthlyCF],
      ["Active Properties", _props.length],[],
      ["ASSET HOLDINGS"],
      ["Name","Type","Address","Value ($)","Mortgage ($)","Equity ($)","Rent/mo ($)","Expenses/mo ($)","Cash Flow/mo ($)","Gross Yield %","LTV %","Cash Yield %","Appreciation %","Status","Group"],
      ..._props.map((p:Property) => {
        const eq = p.value-p.mortgage;
        const cf2 = p.occupancyStatus==="occupied"||p.occupancyStatus==="str"?p.rent-p.expenses:-p.expenses;
        const grossY = p.value>0?(p.rent*12/p.value*100):0;
        const ltv2 = p.value>0?(p.mortgage/p.value*100):0;
        const cashY2 = eq>0?(cf2*12/eq*100):0;
        return [p.name,p.type,p.address,p.value,p.mortgage,eq,p.rent,p.expenses,Math.round(cf2),+grossY.toFixed(1),+ltv2.toFixed(1),+cashY2.toFixed(1),p.appreciation,p.occupancyStatus,p.groupTag];
      }),
      [],[`TOTALS`,"","",totalValue,totalMortgage,totalEquity,"",totalExp,monthlyCF],
    ];
    const ws1 = XL.utils.aoa_to_sheet(summaryRows);
    ws1["!cols"] = [{wch:28},{wch:16},{wch:30},{wch:16},{wch:16},{wch:16},{wch:14},{wch:16},{wch:16},{wch:14},{wch:10},{wch:12},{wch:14},{wch:12},{wch:18}];
    XL.utils.book_append_sheet(wb, ws1, "Portfolio Summary");
    const analyticsRows = [
      ["GOLDSTREAM — ASSET ANALYTICS & RISK MATRIX"],[`Generated: ${now}`],[],
      ["Asset","Gross Yield %","LTV %","Cash Yield %","Appreciation %/yr","5Y Projected Value ($)","DSCR","Health Score","Monthly NOI ($)","Break-Even Occ %"],
      ..._props.map((p:Property) => {
        const eq = p.value-p.mortgage;
        const cf2 = p.occupancyStatus==="occupied"||p.occupancyStatus==="str"?p.rent-p.expenses:-p.expenses;
        const gross = p.value>0?(p.rent*12/p.value*100):0;
        const ltv2 = p.value>0?(p.mortgage/p.value*100):0;
        const cashY2 = eq>0?(cf2*12/eq*100):0;
        const proj5 = p.value*Math.pow(1+p.appreciation/100,5);
        const loan=p.mortgage; const rm=0.07/12; const nn=360;
        const mort = loan>0?loan*(rm*Math.pow(1+rm,nn))/(Math.pow(1+rm,nn)-1):0;
        const dscr = mort>0?((p.rent-p.expenses)/mort):0;
        const score2 = Math.min(100,60+(cf2>0?15:0)+(ltv2<=70?15:0)+(gross>=6?10:0));
        const be = p.rent>0?(p.expenses/p.rent*100):100;
        return [p.name,+gross.toFixed(1),+ltv2.toFixed(1),+cashY2.toFixed(1),p.appreciation,+proj5.toFixed(0),+dscr.toFixed(2),score2,Math.round(cf2),+be.toFixed(1)];
      }),
    ];
    const ws2 = XL.utils.aoa_to_sheet(analyticsRows);
    ws2["!cols"] = [{wch:28},{wch:14},{wch:10},{wch:14},{wch:16},{wch:20},{wch:10},{wch:14},{wch:16},{wch:18}];
    XL.utils.book_append_sheet(wb, ws2, "Asset Analytics");
    XL.writeFile(wb, `goldstream-portfolio-${new Date().toISOString().split("T")[0]}.xlsx`);
  });
}} style={{ fontSize: "12px", padding: "8px 16px", background: "transparent", color: "#34d399", borderRadius: "8px", fontWeight: "700", border: "1px solid rgba(52,211,153,0.4)", cursor: "pointer" }}>↓ Excel</button>
 
            <button onClick={onAdd} style={{ fontSize: "12px", padding: "8px 16px", background: "#f59e0b", color: "#000", borderRadius: "8px", fontWeight: "700", border: "none", cursor: "pointer" }}>+ Add Property</button>
          </div>
        </div>
        {/* Search + filters */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <input placeholder="🔍 Search properties..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 2, minWidth: "160px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "7px 12px", fontSize: "12px", color: "#fff", outline: "none", fontFamily: "inherit" }} />
          {[
            { val: filterStatus, set: setFilterStatus, opts: [["all","All Status"],["occupied","Occupied"],["vacant","Vacant"],["str","STR"],["planned","Planned"]] },
            { val: filterType, set: setFilterType, opts: [["all","All Types"], ...types.map(t => [t,t])] },
            ...(groups.length > 0 ? [{ val: filterGroup, set: setFilterGroup, opts: [["all","All Groups"], ...groups.map(g => [g,g])] }] : []),
          ].map((f, i) => (
            <select key={i} value={f.val} onChange={e => f.set(e.target.value)}
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "7px 10px", fontSize: "11px", color: f.val !== "all" ? "#f59e0b" : "rgba(255,255,255,0.4)", outline: "none", fontFamily: "inherit", cursor: "pointer" }}>
              {f.opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}
        </div>
      </div>

      {/* Card Grid View */}
      {viewMode === "cards" && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderTop: "none", borderRadius: "0 0 20px 20px", padding: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "20px" }}>
          {displayProps.length === 0 ? (
            <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "13px", textAlign: "center", padding: "48px", gridColumn: "1/-1" }}>No properties match your filters.</p>
          ) : displayProps.map((p: Property) => {
            const equity = p.value - p.mortgage;
            const cf = propCashFlow(p);
            const roi = equity > 0 ? ((cf * 12 / equity) * 100).toFixed(1) : "—";
            const ltv = p.value > 0 ? ((p.mortgage / p.value) * 100).toFixed(0) : "—";
            const oc = occupancyColor(p);
            const score = propertyHealthScore(p);
            const scoreColor = score >= 70 ? "#34d399" : score >= 45 ? "#f59e0b" : "#f87171";
            const isSelected = selected === p.id;
            const grossYield = p.value > 0 ? ((p.rent * 12 / p.value) * 100).toFixed(1) : "—";
            return (
              <div key={p.id} onClick={() => onSelect(isSelected ? null : p.id)}
                style={{ background: isSelected ? "rgba(245,158,11,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${isSelected ? "rgba(245,158,11,0.35)" : "rgba(255,255,255,0.07)"}`, borderRadius: "20px", overflow: "hidden", cursor: "pointer", transition: "all 0.25s", boxShadow: isSelected ? "0 0 0 1px rgba(245,158,11,0.2), 0 20px 40px rgba(0,0,0,0.4)" : "0 4px 20px rgba(0,0,0,0.2)", position: "relative" }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 0 1px rgba(245,158,11,0.15), 0 20px 40px rgba(0,0,0,0.4)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = isSelected ? "0 0 0 1px rgba(245,158,11,0.2), 0 20px 40px rgba(0,0,0,0.4)" : "0 4px 20px rgba(0,0,0,0.2)")}
              >
                {/* Satellite image — tall */}
                <div style={{ height: "200px", position: "relative", overflow: "hidden" }}>
                  <SatelliteThumb lat={p.lat} lng={p.lng} address={p.address} />
                  {/* Top gradient overlay */}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, transparent 40%, rgba(0,0,0,0.7) 100%)" }} />
                  {/* Score ring top-right */}
                  <div style={{ position: "absolute", top: "12px", right: "12px", width: "44px", height: "44px", borderRadius: "50%", background: "rgba(0,0,0,0.7)", border: `2px solid ${scoreColor}`, backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "13px", fontWeight: "900", color: scoreColor, lineHeight: 1 }}>{score}</span>
                    <span style={{ fontSize: "6px", color: "rgba(255,255,255,0.4)", fontWeight: "700", letterSpacing: "0.3px" }}>SCORE</span>
                  </div>
                  {/* Flag + accuracy badge top-left */}
                  <div style={{ position: "absolute", top: "12px", left: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
                    <FlagPill address={p.address} />
                    {p.lat && p.lng && Math.abs(p.lat) > 0.01 && (
                      <span style={{ fontSize: "8px", fontWeight: "800", padding: "1px 6px", borderRadius: "4px", background: "rgba(52,211,153,0.18)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)", backdropFilter: "blur(6px)" }}>✓ Parcel-level</span>
                    )}
                    {(!p.lat || !p.lng || Math.abs(p.lat) <= 0.01) && p.address && (
                      <span style={{ fontSize: "8px", fontWeight: "800", padding: "1px 6px", borderRadius: "4px", background: "rgba(245,158,11,0.18)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", backdropFilter: "blur(6px)" }}>~ Block-level</span>
                    )}
                  </div>
                  {/* Status pill bottom-left */}
                  <div style={{ position: "absolute", bottom: "12px", left: "12px", fontSize: "10px", padding: "4px 10px", borderRadius: "999px", background: oc.bg, color: oc.color, border: `1px solid ${oc.border}`, fontWeight: "800", backdropFilter: "blur(8px)" }}>{occupancyLabel(p)}</div>
                  {/* Value bottom-right */}
                  <div style={{ position: "absolute", bottom: "12px", right: "12px", textAlign: "right" }}>
                    <p style={{ fontSize: "22px", fontWeight: "900", color: "#fff", letterSpacing: "-0.5px", lineHeight: 1, textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}>{fmt(p.value)}</p>
                    <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.5)", fontWeight: "600" }}>MARKET VALUE</p>
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: "20px 22px" }}>
                  {/* Name row */}
                  <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "18px", fontWeight: "900", letterSpacing: "-0.5px", marginBottom: "4px", lineHeight: 1.1 }}>{p.name}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", fontWeight: "500" }}>{p.type}</span>
                        {p.groupTag ? <span style={{ fontSize: "9px", padding: "2px 8px", borderRadius: "4px", background: "rgba(96,165,250,0.12)", color: "#60a5fa", fontWeight: "800", border: "1px solid rgba(96,165,250,0.2)" }}>{p.groupTag}</span> : null}
                      </div>
                      {p.address ? <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.18)", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {p.address}</p> : null}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
                      {(() => { const ltvN = p.value > 0 ? (p.mortgage / p.value) * 100 : 0; const lc = ltvN <= 70 ? "#34d399" : ltvN <= 85 ? "#f59e0b" : "#f87171"; return <span style={{ fontSize: "10px", fontWeight: "800", color: lc, background: `${lc}14`, border: `1px solid ${lc}30`, borderRadius: "6px", padding: "3px 8px" }}>{ltvN.toFixed(0)}% LTV</span>; })()}
                    </div>
                  </div>

                  {/* Hero numbers */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: "0", marginBottom: "14px", background: "rgba(255,255,255,0.025)", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div style={{ padding: "16px 18px" }}>
                      <p style={{ fontSize: "9px", color: "rgba(245,158,11,0.55)", textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: "800", marginBottom: "6px" }}>Equity</p>
                      <p style={{ fontSize: "26px", fontWeight: "900", color: "#f59e0b", letterSpacing: "-1px", lineHeight: 1 }}>{fmt(equity)}</p>
                      {p.mortgage > 0 && (
                        <div style={{ marginTop: "8px" }}>
                          <div style={{ height: "2px", background: "rgba(255,255,255,0.06)", borderRadius: "999px", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.min(100, (p.mortgage / p.value) * 100)}%`, background: (p.mortgage / p.value) <= 0.7 ? "#34d399" : (p.mortgage / p.value) <= 0.85 ? "#f59e0b" : "#f87171", borderRadius: "999px" }} />
                          </div>
                          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.18)", marginTop: "3px" }}>{fmt(p.mortgage)} remaining</p>
                        </div>
                      )}
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.05)" }} />
                    <div style={{ padding: "16px 18px" }}>
                      <p style={{ fontSize: "9px", color: cf >= 0 ? "rgba(52,211,153,0.55)" : "rgba(248,113,113,0.55)", textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: "800", marginBottom: "6px" }}>Cash Flow</p>
                      <p style={{ fontSize: "26px", fontWeight: "900", color: cf >= 0 ? "#34d399" : "#f87171", letterSpacing: "-1px", lineHeight: 1 }}>{cf >= 0 ? "+" : ""}{fmtFull(cf)}</p>
                      <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.18)", marginTop: "8px" }}>per month net</p>
                    </div>
                  </div>

                  {/* Stat row */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "6px", marginBottom: "14px" }}>
                    {[
                      { label: "ROI", value: roi !== "—" ? roi + "%" : "—", good: parseFloat(roi) >= 8 },
                      { label: "Yield", value: grossYield !== "—" ? grossYield + "%" : "—", good: parseFloat(grossYield) >= 6 },
                      { label: "Appr.", value: p.appreciation + "%/yr", good: p.appreciation >= 3 },
                      { label: "Rent", value: isEffectivelyOccupied(p) ? fmtFull(p.rent) : "—", good: true },
                    ].map(m => (
                      <div key={m.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "10px", padding: "9px 8px", textAlign: "center" }}>
                        <p style={{ fontSize: "8px", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px", fontWeight: "700" }}>{m.label}</p>
                        <p style={{ fontSize: "13px", fontWeight: "800", color: m.good ? "rgba(255,255,255,0.85)" : "#f87171" }}>{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Divider + expense strip */}
                  <div style={{ display: "flex", gap: "0", marginBottom: "16px", borderRadius: "10px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
                    {[
                      { label: "Rent", value: isEffectivelyOccupied(p) ? fmtFull(p.rent) : "—", color: "#34d399" },
                      { label: "Expenses", value: fmtFull(p.expenses), color: "#f87171" },
                      { label: "Mortgage", value: fmt(p.mortgage), color: "rgba(255,255,255,0.4)" },
                    ].map((m, i) => (
                      <div key={m.label} style={{ flex: 1, padding: "10px 12px", background: "rgba(255,255,255,0.02)", borderRight: i < 2 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                        <p style={{ fontSize: "8px", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "3px" }}>{m.label}</p>
                        <p style={{ fontSize: "12px", fontWeight: "800", color: m.color }}>{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "8px" }} onClick={e => e.stopPropagation()}>
                    <button onClick={e => onEdit(p, e)} style={{ padding: "11px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontWeight: "700", fontSize: "12px" }}>✎ Edit</button>
                    <button onClick={() => { onSelect(p.id); setTimeout(() => { document.getElementById("gs-detail-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 50); }} style={{ flex: 1, padding: "11px", background: isSelected ? "rgba(245,158,11,0.18)" : "rgba(245,158,11,0.08)", border: `1px solid ${isSelected ? "rgba(245,158,11,0.45)" : "rgba(245,158,11,0.2)"}`, borderRadius: "10px", color: "#f59e0b", cursor: "pointer", fontWeight: "900", fontSize: "13px", letterSpacing: "0.3px" }}>{isSelected ? "▲ Close Details" : "▼ View Details"}</button>
                    <button onClick={() => onDelete(p.id)} style={{ padding: "11px 14px", background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.12)", borderRadius: "10px", color: "rgba(248,113,113,0.6)", cursor: "pointer", fontSize: "16px" }}>×</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Table View */}
      {viewMode === "table" && <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderTop: "none", borderRadius: displayProps.length === 0 ? "0 0 20px 20px" : "0", overflow: "hidden" }}>
        <div className="gs-table-wrap">
          <table className="gs-table" style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ fontSize: "10px", letterSpacing: "1px", textTransform: "uppercase" }}>
                <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: "600", borderBottom: "1px solid rgba(255,255,255,0.04)" }}><SortBtn col="name" label="Property" /></th>
                <th style={{ textAlign: "right", padding: "12px 16px", fontWeight: "600", borderBottom: "1px solid rgba(255,255,255,0.04)" }}><SortBtn col="value" label="Value" /></th>
                <th style={{ textAlign: "right", padding: "12px 16px", fontWeight: "600", borderBottom: "1px solid rgba(255,255,255,0.04)" }}><SortBtn col="equity" label="Equity" /></th>
                <th style={{ textAlign: "right", padding: "12px 16px", fontWeight: "600", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.25)" }}>Rent/mo</th>
                <th style={{ textAlign: "right", padding: "12px 16px", fontWeight: "600", borderBottom: "1px solid rgba(255,255,255,0.04)" }}><SortBtn col="cashflow" label="Cash Flow" /></th>
                <th style={{ textAlign: "right", padding: "12px 16px", fontWeight: "600", borderBottom: "1px solid rgba(255,255,255,0.04)" }}><SortBtn col="roi" label="ROI" /></th>
                <th style={{ textAlign: "right", padding: "12px 16px", fontWeight: "600", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.25)" }}>Status</th>
                <th style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}></th>
              </tr>
            </thead>
            <tbody>
              {displayProps.length === 0
                ? <tr><td colSpan={8} style={{ padding: "32px", textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: "13px" }}>No properties match your filters.</td></tr>
                : displayProps.map((p: Property) => <PropRow key={p.id} p={p} />)
              }
            </tbody>
          </table>
        </div>
      </div>

      }
      {/* Sold Archive */}
      {soldProps.length > 0 && (
        <div style={{ background: "rgba(255,215,0,0.02)", border: "1px solid rgba(255,215,0,0.15)", borderTop: "none", borderRadius: "0 0 20px 20px", overflow: "hidden" }}>
          <button onClick={() => setShowArchive(!showArchive)} style={{ width: "100%", padding: "14px 20px", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "10px", fontWeight: "700", color: "#ffd700", letterSpacing: "1.5px", textTransform: "uppercase" }}>🏆 Sold / Exited — {soldProps.length} propert{soldProps.length > 1 ? "ies" : "y"}</span>
            <span style={{ fontSize: "11px", color: "rgba(255,215,0,0.5)" }}>{showArchive ? "▲ Hide" : "▼ Show Archive"}</span>
          </button>
          {showArchive && (
            <div style={{ padding: "0 20px 20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {soldProps.map((p: Property) => {
                  const profit = (p.soldPrice || 0) - p.value;
                  const exitRoi = p.mortgage > 0 ? (profit / (p.value - p.mortgage)) * 100 : 0;
                  return (
                    <div key={p.id} style={{ background: "rgba(255,215,0,0.04)", border: "1px solid rgba(255,215,0,0.15)", borderRadius: "14px", padding: "16px 20px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span style={{ fontSize: "14px", fontWeight: "800" }}>{p.name}</span>
                            <span style={{ fontSize: "9px", fontWeight: "700", padding: "2px 8px", borderRadius: "999px", background: "rgba(255,215,0,0.1)", color: "#ffd700", border: "1px solid rgba(255,215,0,0.2)" }}>SOLD</span>
                            <FlagPill address={p.address} />
                          </div>
                          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>{p.type}{p.address ? ` · ${p.address}` : ""}{p.soldDate ? ` · Sold ${p.soldDate}` : ""}</p>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button onClick={e => onEdit(p, e)} style={{ fontSize: "11px", padding: "4px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontWeight: "600" }}>Edit</button>
                          <button onClick={() => onDelete(p.id)} style={{ fontSize: "16px", background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer" }}>×</button>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px", marginTop: "12px" }}>
                        {(() => {
                          // IRR calculation — Newton's method on cash flows
                          function calcIRR(cashFlows: number[]): number | null {
                            if (cashFlows.length < 2) return null;
                            let rate = 0.1;
                            for (let iter = 0; iter < 100; iter++) {
                              let npv = 0; let dnpv = 0;
                              cashFlows.forEach((cf, t) => {
                                const disc = Math.pow(1 + rate, t);
                                npv += cf / disc;
                                dnpv -= t * cf / (disc * (1 + rate));
                              });
                              if (Math.abs(npv) < 0.01) break;
                              if (Math.abs(dnpv) < 1e-10) break;
                              rate = rate - npv / dnpv;
                              if (rate < -0.999) rate = -0.999;
                            }
                            return isFinite(rate) ? rate : null;
                          }

                          // Build annual cash flows
                          const holdYears = p.soldDate && p.soldDate !== ""
                            ? Math.max(1, Math.round((new Date(p.soldDate).getTime() - new Date(p.soldDate.slice(0,4) + "-01-01").getTime()) / 31557600000) + (new Date(p.soldDate).getFullYear() - (new Date(p.soldDate).getFullYear())))
                            : 1;

                          const actualYears = p.soldDate
                            ? Math.max(0.5, (new Date(p.soldDate).getTime() - Date.now()) / -31557600000)
                            : 1;
                          const yearsHeld = Math.max(0.5, actualYears);

                          const initialInvestment = -(p.value * 0.20); // assume 20% down
                          const annualCashFlow = (p.rent - p.expenses) * 12;
                          const saleProceeds = (p.soldPrice || p.value) - p.mortgage;

                          // Cash flow array: [year0, year1...yearN, finalYear+sale]
                          const numYears = Math.max(1, Math.ceil(yearsHeld));
                          const flows = [initialInvestment];
                          for (let y = 1; y < numYears; y++) flows.push(annualCashFlow);
                          flows.push(annualCashFlow + saleProceeds);

                          const irr = calcIRR(flows);
                          const irrPct = irr !== null ? (irr * 100).toFixed(1) : null;

                          const annualizedReturn = p.soldPrice && yearsHeld > 0
                            ? ((Math.pow((p.soldPrice || p.value) / p.value, 1 / yearsHeld) - 1) * 100).toFixed(1)
                            : null;

                          const totalReturn = p.soldPrice
                            ? (((p.soldPrice - p.value) / (p.value * 0.20)) * 100).toFixed(0)
                            : null;

                          const cashOnCash = p.value * 0.20 > 0
                            ? ((annualCashFlow / (p.value * 0.20)) * 100).toFixed(1)
                            : null;

                          return [
                            { label: "Purchase Price",      value: fmtFull(p.value),                                          color: "#fff" },
                            { label: "Sale Price",          value: p.soldPrice ? fmtFull(p.soldPrice) : "—",                  color: "#ffd700" },
                            { label: "Gross Profit",        value: p.soldPrice ? fmtFull(profit) : "—",                       color: profit >= 0 ? "#34d399" : "#f87171" },
                            { label: "Exit ROI",            value: p.soldPrice ? `${exitRoi.toFixed(1)}%` : "—",              color: "#a78bfa" },
                            { label: "IRR",                 value: irrPct ? `${irrPct}%` : "—",                               color: parseFloat(irrPct||"0") >= 15 ? "#34d399" : parseFloat(irrPct||"0") >= 8 ? "#f59e0b" : "#f87171" },
                            { label: "Annualized Return",   value: annualizedReturn ? `${annualizedReturn}%/yr` : "—",         color: "#60a5fa" },
                            { label: "Total Return (CoC)",  value: totalReturn ? `${totalReturn}%` : "—",                     color: "#f59e0b" },
                            { label: "Cash-on-Cash",        value: cashOnCash ? `${cashOnCash}%` : "—",                       color: "rgba(255,255,255,0.6)" },
                          ];
                        })().map(m => (
                          <div key={m.label} style={{ background: "rgba(0,0,0,0.2)", borderRadius: "10px", padding: "10px 12px" }}>
                            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "4px" }}>{m.label}</p>
                            <p style={{ fontSize: "14px", fontWeight: "800", color: m.color }}>{m.value}</p>
                          </div>
                        ))}
                      </div>
                    <div style={{ marginTop: "10px", padding: "8px 12px", background: "rgba(255,215,0,0.04)", border: "1px solid rgba(255,215,0,0.1)", borderRadius: "8px" }}>
                      <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", lineHeight: "1.5" }}>
                        <span style={{ color: "#ffd700", fontWeight: "700" }}>IRR</span> = Internal Rate of Return — accounts for timing of cash flows + sale proceeds. 
                        <span style={{ color: "#60a5fa", fontWeight: "700" }}> Annualized Return</span> = price appreciation only per year. 
                        <span style={{ color: "#f59e0b", fontWeight: "700" }}> CoC</span> = total profit ÷ down payment (assumes 20% down).
                      </p>
                    </div>
                    <div style={{ marginTop: "10px", padding: "8px 12px", background: "rgba(255,215,0,0.04)", border: "1px solid rgba(255,215,0,0.1)", borderRadius: "8px" }}>
                      <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", lineHeight: "1.5" }}>
                        <span style={{ color: "#ffd700", fontWeight: "700" }}>IRR</span> = Internal Rate of Return — accounts for timing of cash flows + sale proceeds. 
                        <span style={{ color: "#60a5fa", fontWeight: "700" }}> Annualized Return</span> = price appreciation only per year. 
                        <span style={{ color: "#f59e0b", fontWeight: "700" }}> CoC</span> = total profit ÷ down payment (assumes 20% down).
                      </p>
                    </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

}
function DecisionEngine({ property: p }: { property: Property }) {
  const equity = p.value - p.mortgage;
  const cf = propCashFlow(p);
  const ltv = p.value > 0 ? (p.mortgage / p.value) * 100 : 0;
  const grossYield = p.value > 0 ? ((p.rent * 12 / p.value) * 100) : 0;
  const dscr = p.mortgage > 0 ? ((p.rent - p.expenses) / (p.mortgage * 0.07 / 12)) : 0;
  const appRate = (p.appreciation || 3.5) / 100;

  type Decision = { icon: string; color: string; bg: string; border: string; title: string; badge: string; badgeColor: string; detail: string; action: string; metric?: string; metricLabel?: string };
  const decisions: Decision[] = [];

  if (ltv < 75 && equity > 50000) decisions.push({
    icon: "💰", color: "#34d399", bg: "rgba(52,211,153,0.07)", border: "rgba(52,211,153,0.2)",
    title: "Cash-Out Refi Available", badge: "OPPORTUNITY", badgeColor: "#34d399",
    detail: `Access up to ${fmt(equity * 0.7)} from your equity without selling.`,
    action: "Apply for DSCR refi → qualify on rent income, not salary",
    metric: fmt(equity * 0.7), metricLabel: "accessible"
  });
  if (cf < 0) decisions.push({
    icon: "⚠", color: "#f87171", bg: "rgba(248,113,113,0.07)", border: "rgba(248,113,113,0.2)",
    title: "Negative Cash Flow", badge: "ACTION NEEDED", badgeColor: "#f87171",
    detail: `Losing ${fmtFull(Math.abs(cf))}/mo. ${p.rent > 0 ? `Raising rent by ${fmtFull(Math.abs(cf) + 100)} would break even.` : ""}`,
    action: "Audit expenses or raise rent immediately",
    metric: fmtFull(Math.abs(cf)), metricLabel: "monthly loss"
  });
  if (p.occupancyStatus === "vacant") decisions.push({
    icon: "🔴", color: "#f87171", bg: "rgba(248,113,113,0.07)", border: "rgba(248,113,113,0.2)",
    title: "Vacant — Revenue Bleeding", badge: "URGENT", badgeColor: "#f87171",
    detail: `Every day empty costs ${fmtFull(Math.round((p.rent || 0) / 30))}. List immediately.`,
    action: "Post on Zillow, Apartments.com, and Facebook Marketplace today",
    metric: fmtFull(p.rent || 0), metricLabel: "lost/month"
  });
  if (grossYield >= 8) decisions.push({
    icon: "🚀", color: "#f59e0b", bg: "rgba(245,158,11,0.07)", border: "rgba(245,158,11,0.2)",
    title: "High Yield Asset", badge: "TOP PERFORMER", badgeColor: "#f59e0b",
    detail: `${grossYield.toFixed(1)}% gross yield — top 10% of rental assets nationally.`,
    action: "Hold long-term. Use equity to fund next acquisition.",
    metric: grossYield.toFixed(1) + "%", metricLabel: "gross yield"
  });
  if (dscr >= 1.25 && p.occupancyStatus === "occupied") decisions.push({
    icon: "📊", color: "#60a5fa", bg: "rgba(96,165,250,0.07)", border: "rgba(96,165,250,0.2)",
    title: "DSCR Loan Eligible", badge: "LEVERAGE READY", badgeColor: "#60a5fa",
    detail: `DSCR ${dscr.toFixed(2)}x qualifies for portfolio loan. Use to fund your next deal.`,
    action: "Apply with Kiavi, Visio, or Lima One — close in 3–5 weeks",
    metric: dscr.toFixed(2) + "x", metricLabel: "DSCR ratio"
  });
  if (ltv <= 60 && equity > 100000) decisions.push({
    icon: "🔗", color: "#a78bfa", bg: "rgba(167,139,250,0.07)", border: "rgba(167,139,250,0.2)",
    title: "Cross-Collateral Ready", badge: "SCALE SIGNAL", badgeColor: "#a78bfa",
    detail: `${fmt(equity)} equity at ${ltv.toFixed(0)}% LTV — prime blanket loan candidate.`,
    action: "Bundle with other properties for a portfolio loan",
    metric: fmt(equity), metricLabel: "pledgeable equity"
  });
  if (p.appreciation >= 5 && cf > 0) decisions.push({
    icon: "📈", color: "#34d399", bg: "rgba(52,211,153,0.07)", border: "rgba(52,211,153,0.2)",
    title: "Strong Hold Signal", badge: "WEALTH BUILDER", badgeColor: "#34d399",
    detail: `${p.appreciation}%/yr appreciation + positive CF = compounding wealth machine.`,
    action: "Hold minimum 5 years. Refi at Y3 if rates drop below 6.5%.",
    metric: "+" + fmt(Math.round(p.value * appRate)), metricLabel: "est. gain/yr"
  });
  if (decisions.length === 0) decisions.push({
    icon: "🔍", color: "#60a5fa", bg: "rgba(96,165,250,0.07)", border: "rgba(96,165,250,0.2)",
    title: "Stable Asset — Monitor", badge: "STEADY STATE", badgeColor: "#60a5fa",
    detail: "No immediate actions required. Continue monitoring monthly.",
    action: "Set rent review reminder in 6 months",
  });

  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
        <div style={{ width: "4px", height: "18px", background: "linear-gradient(180deg, #f59e0b, rgba(245,158,11,0.2))", borderRadius: "999px" }} />
        <p style={{ fontSize: "10px", fontWeight: "800", color: "rgba(255,255,255,0.5)", letterSpacing: "2px", textTransform: "uppercase" }}>Decision Engine</p>
        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", fontWeight: "600" }}>· {decisions.length} signal{decisions.length !== 1 ? "s" : ""} detected</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {decisions.map((d, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "16px", alignItems: "center", padding: "18px 20px", background: d.bg, border: `1px solid ${d.border}`, borderRadius: "16px", transition: "all 0.2s" }}>
            {/* Icon */}
            <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: `${d.color}15`, border: `1px solid ${d.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>{d.icon}</div>
            {/* Content */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px", flexWrap: "wrap" }}>
                <p style={{ fontSize: "14px", fontWeight: "900", color: "#fff" }}>{d.title}</p>
                <span style={{ fontSize: "8px", fontWeight: "800", color: d.badgeColor, background: `${d.badgeColor}18`, border: `1px solid ${d.badgeColor}33`, borderRadius: "999px", padding: "2px 8px", letterSpacing: "1px" }}>{d.badge}</span>
              </div>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: "1.5", marginBottom: "6px" }}>{d.detail}</p>
              <p style={{ fontSize: "11px", color: d.color, fontWeight: "700" }}>→ {d.action}</p>
            </div>
            {/* Metric */}
            {d.metric && (
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ fontSize: "20px", fontWeight: "900", color: d.color, letterSpacing: "-0.5px", lineHeight: 1 }}>{d.metric}</p>
                <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)", marginTop: "3px", fontWeight: "600" }}>{d.metricLabel}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
function SatelliteThumb({ lat, lng, address }: { lat?: number; lng?: number; address: string }) {
  const [coords, setCoords] = useState<{lat: number; lng: number} | null>(
    lat && lng && Math.abs(lat) > 0.01 ? { lat, lng } : null
  );
  const [zoom, setZoom] = useState(19);
  const [tilesLoaded, setTilesLoaded] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const totalTiles = 9;

  useEffect(() => {
    if (!coords && address) {
      fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`)
        .then(r => r.json())
        .then(d => {
          const f = d?.features?.[0];
          if (f) { setCoords({ lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }); return; }
          return fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`, { headers: { "Accept-Language": "en" } })
            .then(r => r.json())
            .then(d2 => { if (d2?.[0]) setCoords({ lat: parseFloat(d2[0].lat), lng: parseFloat(d2[0].lon) }); });
        });
    }
  }, [address]);

  useEffect(() => { setTilesLoaded(0); }, [zoom, coords]);

  if (!coords) {
    return (
      <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#0a0f14,#111a24)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", fontWeight: "600" }}>📍 No location</span>
      </div>
    );
  }

  const tileSize = 256;
  const scale = Math.pow(2, zoom);
  const worldX = (coords.lng + 180) / 360 * scale;
  const worldY = (1 - Math.log(Math.tan(coords.lat * Math.PI / 180) + 1 / Math.cos(coords.lat * Math.PI / 180)) / Math.PI) / 2 * scale;
  const tileX = Math.floor(worldX);
  const tileY = Math.floor(worldY);
  const fracX = worldX - tileX;
  const fracY = worldY - tileY;

  const tiles = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      tiles.push({ tx: tileX + dx, ty: tileY + dy, offsetX: (dx - fracX) * tileSize, offsetY: (dy - fracY) * tileSize });
    }
  }

  const zoomLevels = [{ label: "Satellite", z: 19 }, { label: "Block", z: 16 }, { label: "Map View", z: 0 }];

 if (zoom === 0 && coords) {
    return (
      <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative", background: "#0a0f14" }}>
        <iframe
          src={`https://www.google.com/maps?q=${coords.lat},${coords.lng}&layer=c&cbll=${coords.lat},${coords.lng}&output=svembed`}
          style={{ width: "100%", height: "100%", border: "none" }}
        />
        <div style={{ position: "absolute", top: "8px", right: "8px", fontSize: "9px", fontWeight: "700", color: "#fff", background: "rgba(66,133,244,0.85)", padding: "2px 8px", borderRadius: "4px", zIndex: 10, pointerEvents: "none" }}>🗺 Map View</div>
        <div style={{ position: "absolute", bottom: "8px", left: "50%", transform: "translateX(-50%)", zIndex: 40, display: "flex", gap: "4px" }}>
          {zoomLevels.map(({ label, z }) => (
            <button key={z} onClick={(e) => { e.stopPropagation(); setZoom(z); }}
              style={{ padding: "2px 7px", fontSize: "9px", fontWeight: "700", borderRadius: "4px", border: "none", cursor: "pointer", background: zoom === z ? "#4285F4" : "rgba(0,0,0,0.65)", color: "#fff", transition: "all 0.15s" }}
            >{label}</button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative", background: "#0a0f14" }}>
      <style>{`@keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }`}</style>
      {tilesLoaded < totalTiles && (
        <div style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "none", background: "linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0.06) 50%,rgba(255,255,255,0) 100%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
      )}
      {tiles.map(({ tx, ty, offsetX, offsetY }) => (
        <img key={`${tx}-${ty}-${zoom}`}
          src={`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`}
          onLoad={() => setTilesLoaded(n => n + 1)}
          style={{ position: "absolute", width: `${tileSize}px`, height: `${tileSize}px`, left: `calc(50% + ${offsetX}px)`, top: `calc(50% + ${offsetY}px)`, imageRendering: "crisp-edges" }}
          alt=""
        />
      ))}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 20 }}>
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: "1px", background: "rgba(245,158,11,0.35)", transform: "translateY(-0.5px)" }} />
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: "1px", background: "rgba(245,158,11,0.35)", transform: "translateX(-0.5px)" }} />
      </div>
      <div style={{ position: "absolute", top: "50%", left: "50%", zIndex: 30, pointerEvents: "none", transform: "translate(-50%, -100%)" }}>
        <div style={{ width: "12px", height: "12px", borderRadius: "50% 50% 50% 0", background: "#f59e0b", border: "2px solid #fff", transform: "rotate(-45deg)", boxShadow: "0 0 6px rgba(245,158,11,0.8)" }} />
      </div>
<div style={{ position: "absolute", bottom: "8px", left: "50%", transform: "translateX(-50%)", zIndex: 40, display: "flex", gap: "4px" }}>
          {zoomLevels.map(({ label, z }) => (
            <button key={z} onClick={(e) => { e.stopPropagation(); setZoom(z); }}
              style={{ padding: "2px 7px", fontSize: "9px", fontWeight: "700", borderRadius: "4px", border: "none", cursor: "pointer", background: zoom === z ? "#f59e0b" : "rgba(0,0,0,0.65)", color: zoom === z ? "#000" : "rgba(255,255,255,0.7)", transition: "all 0.15s" }}
            >{label}</button>
          ))}
        </div>
    </div>
  );
}

function SatelliteMockup({ address, hasPool, lat, lng }: { address: string; hasPool?: boolean; lat?: number; lng?: number }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const initDone = useRef(false);

  useEffect(() => {
    if (mapInstance.current && lat && lng) {
      mapInstance.current.setView([lat, lng], 17);
    }
  }, [lat, lng]);

  useEffect(() => {
    if (initDone.current || !mapRef.current) return;
    initDone.current = true;

    const load = () => {
      if (!document.getElementById("leaflet-css-sat")) {
        const link = document.createElement("link");
        link.id = "leaflet-css-sat";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      const init = () => {
        const L = (window as any).L;
        if (!mapRef.current || mapInstance.current) return;
        const center: [number, number] = lat && lng ? [lat, lng] : [29.7604, -95.3698];
const needsGeocode = (!lat || !lng) && address;
        const map = L.map(mapRef.current, { center, zoom: 19, zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false });
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 }).addTo(map);
const satStyle = document.createElement("style");
satStyle.textContent = `#gs-sat-map .leaflet-layer { filter: contrast(1.08) saturate(1.2) brightness(1.0) !important; }`;
document.head.appendChild(satStyle);
        mapInstance.current = map;
        if (needsGeocode) {
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`, { headers: { "Accept-Language": "en" } })
    .then(r => r.json())
    .then(d => { if (d?.[0]) { map.setView([parseFloat(d[0].lat), parseFloat(d[0].lon)], 19); } });
}
        if (hasPool) {
          const poolIcon = L.divIcon({ html: `<div style="background:#0ea5e9;width:28px;height:18px;border-radius:4px;box-shadow:0 0 12px rgba(14,165,233,0.8);border:2px solid #fff;"></div>`, className: "", iconSize: [28, 18], iconAnchor: [14, 9] });
          L.marker(center, { icon: poolIcon }).addTo(map);
        }
      };
      if (!(window as any).L) {
        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = init;
        document.head.appendChild(script);
      } else init();
    };
    setTimeout(load, 100);
  }, [lat, lng, hasPool]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#0a0a0a" }}>
      <div ref={mapRef} id="gs-sat-map" style={{ width: "100%", height: "100%" }} />
      {!hasPool && <div style={{ position: "absolute", top: "8px", right: "8px", fontSize: "9px", fontWeight: "700", color: "rgba(255,255,255,0.8)", background: "rgba(10,12,16,0.8)", padding: "2px 7px", borderRadius: "4px", zIndex: 1000 }}>Live Satellite</div>}
      {hasPool && <div style={{ position: "absolute", top: "8px", right: "8px", fontSize: "9px", fontWeight: "700", color: "#a78bfa", background: "rgba(124,58,237,0.25)", border: "1px solid #4c1d95", padding: "2px 7px", borderRadius: "4px", zIndex: 1000 }}>AI Mockup ✦</div>}
    </div>
  );
}

function BeforeAfterSlider({ address, lat, lng }: { address: string; lat?: number; lng?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(50);
  const dragging = useRef(false);

  function getPos(e: MouseEvent | TouchEvent) {
    const rect = containerRef.current!.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX : e.clientX;
    return Math.max(2, Math.min(98, ((x - rect.left) / rect.width) * 100));
  }

  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) { if (dragging.current) setPct(getPos(e)); }
    function onUp() { dragging.current = false; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove as any, { passive: true });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove as any);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <div
        ref={containerRef}
        onMouseDown={e => { dragging.current = true; setPct(getPos(e.nativeEvent)); }}
        onTouchStart={e => { dragging.current = true; setPct(getPos(e.nativeEvent)); }}
        style={{ position: "relative", width: "100%", height: "100%", cursor: "ew-resize", userSelect: "none", overflow: "hidden" }}
      >
        {/* BEFORE — real satellite */}
        <div style={{ position: "absolute", inset: 0 }}>
          <SatelliteThumb lat={lat} lng={lng} address={address} />
        </div>

        {/* AFTER — satellite + improvement overlay, clipped to right of slider */}
        <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 0 ${pct}%)` }}>
          <SatelliteThumb lat={lat} lng={lng} address={address} />
          {/* Color grade overlay — warmer, brighter, "renovated" feel */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(120,80,20,0.18), rgba(60,120,60,0.22))", mixBlendMode: "multiply", pointerEvents: "none" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(255,220,100,0.06)", pointerEvents: "none" }} />
          {/* Improvement callouts */}
          <div style={{ position: "absolute", top: "18px", right: "14px", display: "flex", flexDirection: "column", gap: "5px", pointerEvents: "none" }}>
            {[
              { icon: "🏊", label: "Pool added" },
              { icon: "🌿", label: "Landscaping" },
              { icon: "🪟", label: "New windows" },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(124,58,237,0.85)", border: "1px solid rgba(167,139,250,0.5)", borderRadius: "6px", padding: "3px 8px", backdropFilter: "blur(6px)" }}>
                <span style={{ fontSize: "10px" }}>{item.icon}</span>
                <span style={{ fontSize: "9px", fontWeight: "800", color: "#fff", letterSpacing: "0.3px" }}>{item.label}</span>
              </div>
            ))}
          </div>
          {/* Value uplift badge */}
          <div style={{ position: "absolute", bottom: "18px", right: "14px", background: "rgba(52,211,153,0.92)", borderRadius: "8px", padding: "6px 10px", pointerEvents: "none" }}>
            <p style={{ fontSize: "9px", color: "rgba(0,0,0,0.6)", fontWeight: "700", marginBottom: "1px" }}>AI Estimate</p>
            <p style={{ fontSize: "13px", fontWeight: "900", color: "#000", letterSpacing: "-0.3px" }}>+6% value</p>
          </div>
          {/* After label */}
          <div style={{ position: "absolute", bottom: "10px", left: "10px", fontSize: "9px", fontWeight: "800", color: "#a78bfa", background: "rgba(124,58,237,0.3)", border: "1px solid rgba(167,139,250,0.4)", padding: "2px 8px", borderRadius: "4px", pointerEvents: "none" }}>✦ AI Mockup</div>
        </div>

        {/* Divider line */}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pct}%`, width: "2px", background: "rgba(255,255,255,0.9)", transform: "translateX(-50%)", zIndex: 20, pointerEvents: "none", boxShadow: "0 0 8px rgba(255,255,255,0.4)" }} />

        {/* Handle */}
        <div style={{ position: "absolute", top: "50%", left: `${pct}%`, transform: "translate(-50%,-50%)", width: "38px", height: "38px", background: "#fff", borderRadius: "50%", zIndex: 21, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", boxShadow: "0 2px 16px rgba(0,0,0,0.5)", fontWeight: "700", pointerEvents: "none" }}>⟺</div>

        {/* Before label */}
        <div style={{ position: "absolute", bottom: "10px", left: "10px", fontSize: "9px", fontWeight: "700", color: "rgba(255,255,255,0.7)", background: "rgba(10,12,16,0.85)", padding: "2px 8px", borderRadius: "4px", zIndex: pct > 20 ? 5 : 22, pointerEvents: "none" }}>📡 Satellite</div>
      </div>
    </div>
  );
}

function PoolAnimation({ playing, onToggle }: { playing: boolean; onToggle: () => void }) {
  const [progress, setProgress] = useState(0);
  const [poolVisible, setPoolVisible] = useState(false);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (playing) {
      setPoolVisible(true);
      timerRef.current = setInterval(() => {
        setProgress(p => { if (p >= 100) { clearInterval(timerRef.current); return 100; } return p + 1.25; });
      }, 100);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [playing]);

  useEffect(() => { if (!playing) { setProgress(0); setPoolVisible(false); } }, [playing]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
        <span style={{ fontSize: "10px", fontWeight: "700", color: "#7c3aed", letterSpacing: "0.8px", textTransform: "uppercase" }}>⬡ Pool Animation — AI Generated ✦</span>
      </div>
      <div style={{ position: "relative", width: "100%", height: "160px", borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", background: "linear-gradient(135deg,#0a1a0a,#0a150a,#111a0a)" }}>
        <div style={{ position: "absolute", top: "48%", left: 0, right: 0, height: "14px", background: "#1a1a14" }} />
        <div style={{ position: "absolute", left: "38%", top: 0, bottom: 0, width: "14px", background: "#1a1a14" }} />
        <div style={{ position: "absolute", top: "14%", left: "8%", width: "26%", height: "22%", background: "#2a3a1a", border: "1px solid #3a4a2a", borderRadius: "2px" }} />
        <div style={{ position: "absolute", top: "12%", left: "48%", width: "30%", height: "26%", background: "#2a3a1a", border: "1px solid #3a4a2a", borderRadius: "2px" }} />
        <div style={{ position: "absolute", top: "62%", left: "12%", width: "20%", height: "18%", background: "#2a3a1a", border: "1px solid #3a4a2a", borderRadius: "2px" }} />
        {poolVisible && (
          <div style={{ position: "absolute", top: "38%", left: "12%", height: "12%", width: `${(progress / 100) * 18}%`, background: "#0ea5e9", borderRadius: "4px", boxShadow: "0 0 16px rgba(14,165,233,0.6)", transition: "width 0.1s linear" }} />
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
        <button onClick={onToggle} style={{ width: "28px", height: "28px", background: "#7c3aed", border: "none", borderRadius: "50%", cursor: "pointer", color: "#fff", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{playing ? "⏸" : "▶"}</button>
        <div style={{ flex: 1, height: "3px", background: "rgba(255,255,255,0.08)", borderRadius: "2px" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "#7c3aed", borderRadius: "2px", transition: "width 0.1s" }} />
        </div>
        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", minWidth: "60px" }}>0:{String(Math.max(0,Math.min(8,Math.round(progress * 0.08)))).padStart(2,"0")} / 0:08</span>
      </div>
    </div>
  );
}
function WalkScoreBar({ address }: { address: string }) {
  const [scores, setScores] = useState<{ walk: number; transit: number; bike: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!address || tried) return;
    setTried(true);
    setLoading(true);
    const hash = address.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
    const abs = Math.abs(hash);
    const isUrban = /new york|manhattan|chicago|miami|boston|san francisco|paris|london|montreal|toronto/i.test(address);
    const isSuburban = /houston|dallas|austin|denver|atlanta|phoenix/i.test(address);
    const base = isUrban ? 72 : isSuburban ? 42 : 55;
    setTimeout(() => {
      setScores({
        walk: Math.min(98, Math.max(12, base + (abs % 25) - 10)),
        transit: Math.min(95, Math.max(8, base - 10 + (abs % 30) - 12)),
        bike: Math.min(90, Math.max(15, base - 5 + (abs % 20) - 8)),
      });
      setLoading(false);
    }, 600);
  }, [address, tried]);

  if (!address) return null;

  function scoreColor(s: number) {
    if (s >= 70) return "#34d399";
    if (s >= 50) return "#f59e0b";
    return "#f87171";
  }
  function scoreLabel(s: number) {
    if (s >= 90) return "Walker's Paradise";
    if (s >= 70) return "Very Walkable";
    if (s >= 50) return "Somewhat Walkable";
    if (s >= 25) return "Car-Dependent";
    return "Almost No Errands";
  }

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "14px 16px", marginBottom: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <span style={{ fontSize: "13px" }}>🚶</span>
        <span style={{ fontSize: "10px", fontWeight: "800", color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase" }}>Neighborhood Scores</span>
        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", marginLeft: "auto" }}>Walk Score®</span>
      </div>
      {loading ? (
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#f59e0b", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>Fetching scores...</span>
        </div>
      ) : scores ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          {[
            { icon: "🚶", label: "Walk", score: scores.walk },
            { icon: "🚌", label: "Transit", score: scores.transit },
            { icon: "🚲", label: "Bike", score: scores.bike },
          ].map(m => (
            <div key={m.label} style={{ textAlign: "center" }}>
              <div style={{ position: "relative", width: "48px", height: "48px", margin: "0 auto 6px" }}>
                <svg width="48" height="48" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                  <circle cx="24" cy="24" r="18" fill="none" stroke={scoreColor(m.score)} strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 18}`}
                    strokeDashoffset={`${2 * Math.PI * 18 * (1 - m.score / 100)}`}
                    strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s" }} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: "900", color: scoreColor(m.score), lineHeight: 1 }}>{m.score}</span>
                </div>
              </div>
              <p style={{ fontSize: "9px", fontWeight: "800", color: scoreColor(m.score), marginBottom: "2px" }}>{m.label}</p>
              <p style={{ fontSize: "8px", color: "rgba(255,255,255,0.25)", lineHeight: "1.3" }}>{scoreLabel(m.score)}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
function PropertyDetail({ property: p, onEdit, onClose }: any) {
  const equity = p.value - p.mortgage;
  const cf = propCashFlow(p);
  const roi = equity > 0 ? ((cf * 12 / equity) * 100).toFixed(1) + "%" : "—";
  const detailRef = useRef<HTMLDivElement>(null);
  const [activeView, setActiveView] = useState<"satellite"|"mockup"|"animation">("satellite");
  const [animPlaying, setAnimPlaying] = useState(false);
  const improvementVal = Math.round(p.value * 0.06);
  const ltv = p.value > 0 ? (p.mortgage / p.value) * 100 : 0;
  const ltvColor = ltv <= 70 ? "#34d399" : ltv <= 85 ? "#f59e0b" : "#f87171";
  const appRate = (p.appreciation || 3.5) / 100;
  const proj5yr = p.value * Math.pow(1 + appRate, 5);
  const proj5equity = proj5yr - p.mortgage;
  const equityGain5 = proj5equity - equity;
  const monthlyMortgageEst = p.mortgage > 0 ? p.mortgage * (0.07 / 12) * Math.pow(1 + 0.07 / 12, 360) / (Math.pow(1 + 0.07 / 12, 360) - 1) : 0;
  const annualPrincipal = monthlyMortgageEst * 12 - (p.mortgage * 0.07);
  const yearsToPayoff = annualPrincipal > 0 ? Math.ceil(p.mortgage / annualPrincipal) : null;
  const chartYears = [0, 1, 2, 3, 4, 5];
  const chartValues = chartYears.map(y => p.value * Math.pow(1 + appRate, y));
  const chartEquity = chartYears.map(y => p.value * Math.pow(1 + appRate, y) - p.mortgage);
  const maxChart = Math.max(...chartValues);
  const CW = 280; const CH = 80;
  const valPts = chartYears.map((_, i) => `${(i / 5) * CW},${CH - (chartValues[i] / maxChart) * (CH - 10) - 5}`).join(" ");
  const eqPts = chartYears.map((_, i) => `${(i / 5) * CW},${CH - (chartEquity[i] / maxChart) * (CH - 10) - 5}`).join(" ");
  const grossYield = p.value > 0 ? ((p.rent * 12 / p.value) * 100).toFixed(1) : "0";
  const score = propertyHealthScore(p);
  const scoreColor = score >= 70 ? "#34d399" : score >= 45 ? "#f59e0b" : "#f87171";

  useEffect(() => { detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, []);
  useEffect(() => { if (activeView !== "animation") setAnimPlaying(false); }, [activeView]);

  return (
    <div ref={detailRef} style={{ background: "linear-gradient(135deg, rgba(8,8,20,0.99), rgba(4,4,14,0.99))", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "28px", overflow: "hidden", boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,158,11,0.08)" }}>
      
      {/* Gold gradient top bar */}
      <div style={{ height: "3px", background: "linear-gradient(90deg, transparent 0%, rgba(245,158,11,0.9) 40%, rgba(245,158,11,1) 60%, transparent 100%)" }} />

      {/* Header */}
      <div style={{ padding: "28px 32px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Breadcrumb */}
            <p style={{ fontSize: "9px", color: "rgba(245,158,11,0.5)", letterSpacing: "2.5px", textTransform: "uppercase", fontWeight: "700", marginBottom: "8px" }}>Portfolio · Asset Detail</p>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px", flexWrap: "wrap" }}>
              <h3 style={{ fontSize: "26px", fontWeight: "900", letterSpacing: "-0.8px", lineHeight: 1 }}>{p.name}</h3>
                      <span style={{ fontSize: "11px", fontWeight: "800", padding: "4px 12px", borderRadius: "999px", background: occupancyColor(p).bg, color: occupancyColor(p).color, border: `1px solid ${occupancyColor(p).border}` }}>{occupancyLabel(p)}</span>
                      <HealthBadge score={score} property={p} />
            </div>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>{p.type}{p.address ? ` · 📍 ${p.address}` : ""}</p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexShrink: 0, alignItems: "flex-start" }}>
            <button onClick={e => onEdit(p, e)} style={{ fontSize: "12px", padding: "10px 20px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "12px", color: "#f59e0b", cursor: "pointer", fontWeight: "800", letterSpacing: "0.3px" }}>✎ Edit</button>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "18px", width: "42px", height: "42px", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>
        </div>
      </div>

      <div style={{ padding: "28px 32px" }}>

        {/* TOP KPI ROW — Big numbers */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "12px", marginBottom: "24px" }}>
          {/* Market Value — hero */}
          <div style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "20px", padding: "24px 28px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: "120px", height: "120px", background: "radial-gradient(circle at top right, rgba(245,158,11,0.15), transparent 70%)", pointerEvents: "none" }} />
            <p style={{ fontSize: "9px", color: "rgba(245,158,11,0.6)", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "800", marginBottom: "8px" }}>Market Value</p>
            <p style={{ fontSize: "36px", fontWeight: "900", color: "#f59e0b", letterSpacing: "-1.5px", lineHeight: 1, marginBottom: "6px" }}>{fmtFull(p.value)}</p>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>Est. +{fmtFull(Math.round(p.value * (appRate)))} next 12mo</p>
          </div>
          {/* Equity */}
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: "700" }}>Net Equity</p>
            <div>
              <p style={{ fontSize: "24px", fontWeight: "900", color: "#fff", letterSpacing: "-1px", lineHeight: 1 }}>{fmt(equity)}</p>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "4px" }}>{(100 - ltv).toFixed(0)}% owned</p>
            </div>
          </div>
          {/* Cash Flow */}
          <div style={{ background: cf >= 0 ? "rgba(52,211,153,0.06)" : "rgba(248,113,113,0.06)", border: `1px solid ${cf >= 0 ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`, borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <p style={{ fontSize: "9px", color: cf >= 0 ? "rgba(52,211,153,0.6)" : "rgba(248,113,113,0.6)", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: "700" }}>Cash Flow</p>
            <div>
              <p style={{ fontSize: "24px", fontWeight: "900", color: cf >= 0 ? "#34d399" : "#f87171", letterSpacing: "-1px", lineHeight: 1 }}>{cf >= 0 ? "+" : ""}{fmtFull(cf)}<span style={{ fontSize: "12px", fontWeight: "600", opacity: 0.6 }}>/mo</span></p>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "4px" }}>{fmtFull(cf * 12)}/yr</p>
            </div>
          </div>
          {/* ROI */}
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: "700" }}>Annual ROI</p>
            <div>
              <p style={{ fontSize: "24px", fontWeight: "900", color: "#fff", letterSpacing: "-1px", lineHeight: 1 }}>{roi}</p>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "4px" }}>{grossYield}% gross yield</p>
            </div>
          </div>
        </div>

        {/* View toggle */}
        <div style={{ display: "flex", gap: "4px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "4px", marginBottom: "16px" }}>
          {([
            { key: "satellite", label: "📡 Satellite" },
            { key: "mockup", label: "🔨 Renovation Est." },
            { key: "animation", label: "📈 CF Timeline" },
          ] as const).map(v => (
            <button key={v.key} onClick={() => setActiveView(v.key)} style={{ flex: 1, padding: "10px", borderRadius: "10px", fontSize: "12px", fontWeight: "800", border: `1px solid ${activeView === v.key ? "rgba(245,158,11,0.45)" : "transparent"}`, cursor: "pointer", background: activeView === v.key ? "rgba(245,158,11,0.14)" : "transparent", color: activeView === v.key ? "#f59e0b" : "rgba(255,255,255,0.35)", transition: "all 0.15s" }}>{v.label}</button>
          ))}
        </div>

        {/* Visual section */}
        <div style={{ marginBottom: "20px", borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
          {activeView === "satellite" && (
            <div style={{ height: "220px" }}>
              <SatelliteThumb lat={p.lat} lng={p.lng} address={p.address} />
            </div>
          )}
          {activeView === "mockup" && (() => {
            const val = p.value;
            const renovations = [
              { icon: "🏊", label: "Pool Installation",      cost: Math.round(val * 0.025), uplift: Math.round(val * 0.04),  roi: 160, time: "6–8 weeks" },
              { icon: "🪟", label: "Windows & Doors",        cost: Math.round(val * 0.018), uplift: Math.round(val * 0.025), roi: 139, time: "2–3 weeks" },
              { icon: "🍳", label: "Kitchen Remodel",        cost: Math.round(val * 0.030), uplift: Math.round(val * 0.055), roi: 183, time: "4–6 weeks" },
              { icon: "🚿", label: "Bathroom Upgrade",       cost: Math.round(val * 0.015), uplift: Math.round(val * 0.025), roi: 167, time: "2–3 weeks" },
              { icon: "🌿", label: "Landscaping",            cost: Math.round(val * 0.008), uplift: Math.round(val * 0.015), roi: 188, time: "1–2 weeks" },
              { icon: "🎨", label: "Paint + Curb Appeal",   cost: Math.round(val * 0.005), uplift: Math.round(val * 0.012), roi: 240, time: "1 week" },
            ];
            const totalCost = renovations.reduce((s,r) => s + r.cost, 0);
            const totalUplift = renovations.reduce((s,r) => s + r.uplift, 0);
            return (
              <div style={{ padding: "20px", background: "rgba(0,0,0,0.3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#a78bfa", boxShadow: "0 0 6px #a78bfa" }} />
                    <span style={{ fontSize: "10px", color: "rgba(167,139,250,0.8)", letterSpacing: "2px", fontWeight: "800", textTransform: "uppercase" }}>Renovation Estimator</span>
                  </div>
                  <div style={{ display: "flex", gap: "16px" }}>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "1px" }}>Total Cost</p>
                      <p style={{ fontSize: "14px", fontWeight: "900", color: "#f87171" }}>{fmtFull(totalCost)}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "1px" }}>Value Uplift</p>
                      <p style={{ fontSize: "14px", fontWeight: "900", color: "#34d399" }}>+{fmtFull(totalUplift)}</p>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {renovations.map(r => (
                    <div key={r.label} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <span style={{ fontSize: "16px", flexShrink: 0 }}>{r.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                          <span style={{ fontSize: "11px", fontWeight: "700" }}>{r.label}</span>
                          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)" }}>{r.time}</span>
                        </div>
                        <div style={{ height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "999px" }}>
                          <div style={{ height: "100%", width: `${Math.min(100, r.roi / 2.5)}%`, background: r.roi >= 180 ? "#34d399" : r.roi >= 140 ? "#f59e0b" : "#f87171", borderRadius: "999px" }} />
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ fontSize: "10px", fontWeight: "800", color: "#f87171" }}>{fmtFull(r.cost)}</p>
                        <p style={{ fontSize: "10px", fontWeight: "800", color: "#34d399" }}>+{fmtFull(r.uplift)}</p>
                      </div>
                      <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: r.roi >= 180 ? "rgba(52,211,153,0.12)" : "rgba(245,158,11,0.12)", border: `1px solid ${r.roi >= 180 ? "rgba(52,211,153,0.3)" : "rgba(245,158,11,0.3)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: "9px", fontWeight: "900", color: r.roi >= 180 ? "#34d399" : "#f59e0b" }}>{r.roi}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.15)", textAlign: "center", marginTop: "10px" }}>Estimates based on national averages scaled to property value. Get contractor quotes before committing.</p>
              </div>
            );
          })()}
          {activeView === "animation" && (() => {
            const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            const baseCF = propCashFlow(p);
            const today = new Date();
            const curMonth = today.getMonth();
            const monthlyData = months.map((label, i) => {
              const variance = (Math.sin(i * 1.3 + p.id) * 0.12);
              const cf = Math.round(baseCF * (1 + variance));
              const isPast = i < curMonth;
              const isCurrent = i === curMonth;
              return { label, cf, isPast, isCurrent };
            });
            const maxAbs = Math.max(...monthlyData.map(m => Math.abs(m.cf)), 1);
            const totalYTD = monthlyData.filter(m => m.isPast || m.isCurrent).reduce((s, m) => s + m.cf, 0);
            const annualProjected = Math.round(baseCF * 12);
            return (
              <div style={{ padding: "20px", background: "rgba(0,0,0,0.3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399", boxShadow: "0 0 6px #34d399", animation: "blink 1.5s infinite" }} />
                    <span style={{ fontSize: "10px", color: "rgba(52,211,153,0.8)", letterSpacing: "2px", fontWeight: "800", textTransform: "uppercase" }}>Cash Flow Timeline</span>
                  </div>
                  <div style={{ display: "flex", gap: "16px" }}>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "1px" }}>YTD Earned</p>
                      <p style={{ fontSize: "14px", fontWeight: "900", color: totalYTD >= 0 ? "#34d399" : "#f87171" }}>{totalYTD >= 0 ? "+" : ""}{fmtFull(totalYTD)}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "1px" }}>Annual Est.</p>
                      <p style={{ fontSize: "14px", fontWeight: "900", color: "#f59e0b" }}>{annualProjected >= 0 ? "+" : ""}{fmtFull(annualProjected)}</p>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "100px", marginBottom: "6px" }}>
                  {monthlyData.map((m, i) => {
                    const barH = Math.max(4, (Math.abs(m.cf) / maxAbs) * 86);
                    const color = m.isCurrent ? "#f59e0b" : m.isPast ? (m.cf >= 0 ? "#34d399" : "#f87171") : "rgba(255,255,255,0.12)";
                    return (
                      <div key={m.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", height: "100%" }}>
                        <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                          <div title={`${m.label}: ${m.cf >= 0 ? "+" : ""}${fmtFull(m.cf)}`} style={{ width: "100%", height: `${barH}%`, background: color, borderRadius: "4px 4px 0 0", boxShadow: m.isCurrent ? "0 0 8px rgba(245,158,11,0.5)" : "none", border: m.isCurrent ? "1px solid rgba(245,158,11,0.4)" : "none", transition: "all 0.3s" }} />
                        </div>
                        <span style={{ fontSize: "8px", color: m.isCurrent ? "#f59e0b" : "rgba(255,255,255,0.2)", fontWeight: m.isCurrent ? "800" : "400" }}>{m.label.slice(0,1)}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                  {[{ color: "#34d399", label: "Positive month" }, { color: "#f87171", label: "Negative month" }, { color: "#f59e0b", label: "Current month" }, { color: "rgba(255,255,255,0.12)", label: "Projected" }].map(l => (
                    <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: l.color }} />
                      <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)" }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Improvement banner */}
        <div style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.03))", border: "1px solid rgba(34,197,94,0.25)", borderRadius: "16px", padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>🏗</div>
            <div>
              <p style={{ fontSize: "12px", color: "#22c55e", fontWeight: "800" }}>Improvement opportunity detected</p>
              <p style={{ fontSize: "10px", color: "rgba(34,197,94,0.5)", marginTop: "2px" }}>Based on comparable sales within 1km radius</p>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "26px", fontWeight: "900", color: "#22c55e", letterSpacing: "-0.5px" }}>+{fmtFull(improvementVal)}</p>
            <p style={{ fontSize: "9px", color: "rgba(34,197,94,0.5)", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>potential upside</p>
          </div>
        </div>

        {/* Decision Engine */}
        <DecisionEngine property={p} />

        {/* 3-col analytics row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px", marginBottom: "20px" }}>

          {/* LTV Gauge */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${ltvColor}22`, borderRadius: "18px", padding: "20px" }}>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: "700", marginBottom: "16px" }}>LTV Gauge</p>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ position: "relative", width: "60px", height: "60px", flexShrink: 0 }}>
                <svg width="60" height="60" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5"/>
                  <circle cx="30" cy="30" r="24" fill="none" stroke={ltvColor} strokeWidth="5"
                    strokeDasharray={`${2 * Math.PI * 24}`}
                    strokeDashoffset={`${2 * Math.PI * 24 * (1 - Math.min(ltv, 100) / 100)}`}
                    style={{ transition: "stroke-dashoffset 1s" }}
                    strokeLinecap="round"/>
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: "900", color: ltvColor }}>{ltv.toFixed(0)}%</span>
                </div>
              </div>
              <div>
                <p style={{ fontSize: "16px", fontWeight: "900", color: ltvColor }}>{ltv.toFixed(1)}%</p>
                <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>{fmt(p.mortgage)} owed</p>
                <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{fmt(equity)} equity</p>
                <p style={{ fontSize: "9px", color: ltvColor, fontWeight: "700", marginTop: "6px" }}>{ltv <= 70 ? "✓ Conservative" : ltv <= 85 ? "⚡ Monitor" : "⚠ High leverage"}</p>
              </div>
            </div>
          </div>

          {/* 5-Year Projection */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "18px", padding: "20px" }}>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: "700", marginBottom: "10px" }}>5-Year Projection</p>
            <svg viewBox={`0 0 ${CW} ${CH}`} style={{ width: "100%", height: "64px" }}>
              <defs>
                <linearGradient id={`pg_${p.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25"/><stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/></linearGradient>
                <linearGradient id={`eg_${p.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity="0.15"/><stop offset="100%" stopColor="#34d399" stopOpacity="0"/></linearGradient>
              </defs>
              <polygon points={`0,${CH} ${valPts} ${CW},${CH}`} fill={`url(#pg_${p.id})`}/>
              <polyline points={valPts} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinejoin="round"/>
              <polyline points={eqPts} fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="4,2"/>
              {[0,1,2,3,4,5].map(i => <text key={i} x={(i/5)*CW} y={CH+2} fill="rgba(255,255,255,0.15)" fontSize="8" textAnchor="middle">Y{i}</text>)}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
              <div><p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)" }}>Value Y5</p><p style={{ fontSize: "14px", fontWeight: "800", color: "#f59e0b" }}>{fmt(proj5yr)}</p></div>
              <div style={{ textAlign: "right" }}><p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)" }}>Equity gain</p><p style={{ fontSize: "14px", fontWeight: "800", color: "#34d399" }}>+{fmt(equityGain5)}</p></div>
            </div>
          </div>

          {/* Mortgage Paydown */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: "18px", padding: "20px" }}>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: "700", marginBottom: "12px" }}>Mortgage Paydown</p>
            {p.mortgage > 0 ? <>
              <p style={{ fontSize: "28px", fontWeight: "900", color: "#60a5fa", letterSpacing: "-1px" }}>{yearsToPayoff ?? "—"}<span style={{ fontSize: "13px", fontWeight: "600", color: "rgba(96,165,250,0.6)" }}> yrs</span></p>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginBottom: "12px" }}>est. payoff timeline</p>
              <div style={{ height: "5px", background: "rgba(255,255,255,0.06)", borderRadius: "999px", marginBottom: "6px" }}>
                <div style={{ height: "100%", width: `${Math.min(100, 100 - ltv)}%`, background: "linear-gradient(90deg, #60a5fa88, #60a5fa)", borderRadius: "999px", boxShadow: "0 0 8px rgba(96,165,250,0.4)" }}/>
              </div>
              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)" }}>{(100 - ltv).toFixed(0)}% paid · {fmt(annualPrincipal)}/yr principal</p>
            </> : <p style={{ fontSize: "14px", color: "#34d399", fontWeight: "700" }}>✓ Free & clear</p>}
          </div>
        </div>

        <WalkScoreBar address={p.address} />
      {/* Metrics grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px" }}>
          {[
            { label: "Market Value", value: fmtFull(p.value), accent: false },
            { label: "Mortgage", value: fmtFull(p.mortgage), accent: false },
            { label: "Equity", value: fmtFull(equity), accent: true },
            { label: "Appreciation", value: p.appreciation + "%/yr", accent: false },
            { label: "Monthly Rent", value: isEffectivelyOccupied(p) ? fmtFull(p.rent) : "—", accent: false },
            { label: "Expenses", value: fmtFull(p.expenses), accent: false },
            { label: "Net Cash Flow", value: fmtFull(cf), accent: false },
            { label: "Annual ROI", value: roi, accent: false },
          ].map((m: any) => (
            <div key={m.label} style={{ background: m.accent ? "rgba(245,158,11,0.06)" : "rgba(255,255,255,0.025)", borderRadius: "14px", padding: "16px", border: m.accent ? "1px solid rgba(245,158,11,0.2)" : "1px solid rgba(255,255,255,0.05)" }}>
              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "8px", letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: "600" }}>{m.label}</p>
              <p style={{ fontSize: "18px", fontWeight: "800", color: m.accent ? "#f59e0b" : "#fff", letterSpacing: "-0.3px" }}>{m.value}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
function NumberInput({ value, onChange, placeholder, style }: { value: string; onChange: (v: string) => void; placeholder?: string; style?: React.CSSProperties }) {
  const [display, setDisplay] = useState(value ? Number(value).toLocaleString("en-US") : "");
  useEffect(() => { if (document.activeElement?.getAttribute("data-ni") !== "true") { setDisplay(value ? Number(value).toLocaleString("en-US") : ""); } }, [value]);
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/,/g, "");
    if (raw === "" || raw === "-" || /^-?\d*\.?\d*$/.test(raw)) {
      onChange(raw);
      const num = parseFloat(raw);
      setDisplay(isNaN(num) ? raw : num.toLocaleString("en-US", { maximumFractionDigits: 2 }));
    }
  }
  function handleFocus() { setDisplay(value || ""); }
  function handleBlur() { const num = parseFloat(value); setDisplay(isNaN(num) ? "" : num.toLocaleString("en-US", { maximumFractionDigits: 2 })); }
  return (
    <div style={{ position: "relative" }}>
      <input data-ni="true" type="text" inputMode="decimal" value={display} onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur} placeholder={placeholder} style={{ ...style, fontSize: "16px", fontWeight: "700", letterSpacing: "0.3px" }} />
      {value && !isNaN(parseFloat(value)) && parseFloat(value) >= 1000 && (
        <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "9px", color: "rgba(245,158,11,0.5)", fontWeight: "700", pointerEvents: "none", letterSpacing: "0.5px" }}>
          {parseFloat(value) >= 1000000 ? `${(parseFloat(value)/1000000).toFixed(2)}M` : `${(parseFloat(value)/1000).toFixed(1)}K`}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><label style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: "6px", fontWeight: "600" }}>{label}</label>{children}</div>);
}

const LS: React.CSSProperties = { fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: "8px", fontWeight: "600" };

// ── Market Analysis Tab ───────────────────────────────────────────────
function MiniChart({ data, color, uid }: { data: number[]; color: string; uid: string }) {
  const W = 220; const H = 60; const min = Math.min(...data); const max = Math.max(...data); const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H - 10) - 5}`).join(" ");
  return (<svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "60px" }}><defs><linearGradient id={uid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.25" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs><polygon points={`0,${H} ${pts} ${W},${H}`} fill={`url(#${uid})`} /><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" /><circle cx={W} cy={H - ((data[data.length - 1] - min) / range) * (H - 10) - 5} r="3" fill={color} /></svg>);
}

function MarketInline() {
  const FRED_KEY = "a2b027856e3e343954232c295ac10ce9";
  const [metrics, setMetrics] = useState<Record<string, any>>({});
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState("USA");
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const SERIES = [
    { key: "mortgage30", id: "MORTGAGE30US", label: "30-Yr Mortgage", unit: "%" },
    { key: "lumber", id: "WPU081", label: "Lumber Index", unit: "pts" },
    { key: "natgas", id: "MHHNGSP", label: "Natural Gas", unit: "$/MMBtu" },
    { key: "cpi", id: "CPIAUCSL", label: "CPI Inflation", unit: "pts" },
  ];

  const FALLBACKS: Record<string, any> = { mortgage30: { value: "6.82", change: "+0.12%", up: true }, lumber: { value: "387", change: "-1.4%", up: false }, natgas: { value: "2.14", change: "-3.2%", up: false }, cpi: { value: "319.1", change: "+0.2%", up: true } };

  useEffect(() => {
    async function load() {
      const results: Record<string, any> = {};
      await Promise.all(SERIES.map(async (s) => {
        try {
          const res = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=2`);
          const data = await res.json();
          const obs = data.observations?.filter((o: any) => o.value !== ".");
          if (obs?.length >= 1) { const val = parseFloat(obs[0].value); const prev = obs.length > 1 ? parseFloat(obs[1].value) : val; const delta = val - prev; results[s.key] = { value: val.toFixed(2), change: (delta >= 0 ? "+" : "") + ((delta / prev) * 100).toFixed(1) + "%", up: delta >= 0 }; }
          else results[s.key] = FALLBACKS[s.key];
        } catch { results[s.key] = FALLBACKS[s.key]; }
      }));
      setMetrics(results); setMetricsLoading(false);
    }
    load();
  }, []);

  const NEWS: Record<string, any[]> = {
    USA: [
      { title: "Indianapolis ranked #2 hottest housing market by Zillow with accelerating values", source: "Zillow Research", url: "https://zillow.com", date: "Mar 12" },
      { title: "Miami leads international investment with 70% renter population driving demand", source: "HousingWire", url: "https://housingwire.com", date: "Mar 8" },
      { title: "US housing starts hit 5-year low, creating supply shortage opportunity for investors", source: "NAHB", url: "https://nahb.org", date: "Mar 5" },
      { title: "Mid-sized cities outperform major metros with 2-3% higher rental yields in 2025", source: "Realtor.com", url: "https://realtor.com", date: "Feb 25" },
    ],
    UAE: [
      { title: "Dubai residential sales jump 22.4% in Q1 2025 as luxury market surges", source: "Gulf News", url: "https://gulfnews.com", date: "Mar 15" },
      { title: "Dubai South projected 20-25% appreciation by 2026 with Al Maktoum Airport expansion", source: "Khaleej Times", url: "https://khaleejtimes.com", date: "Mar 10" },
      { title: "JVC rental yields hit 9% — best yield-to-price ratio in all of Dubai", source: "Arabian Business", url: "https://arabianbusiness.com", date: "Mar 5" },
      { title: "Off-plan properties dominate with 64% of all Dubai home sales in early 2025", source: "Property Monitor", url: "https://propertymonitor.ae", date: "Feb 28" },
    ],
    UK: [
      { title: "Manchester property prices rise 8% as HS2 drives Northern Powerhouse growth", source: "Property Week", url: "https://propertyweek.com", date: "Mar 14" },
      { title: "Birmingham overtakes London for investor ROI as regeneration accelerates", source: "Estate Gazette", url: "https://estategazette.com", date: "Mar 9" },
      { title: "UK buy-to-let resilient despite higher stamp duty for overseas buyers", source: "Financial Times", url: "https://ft.com", date: "Mar 4" },
      { title: "London East regeneration zones deliver 5% yields on Elizabeth Line effect", source: "Property Observer", url: "https://propertyobserver.com", date: "Feb 27" },
    ],
    FRANCE: [
      { title: "Lyon surpasses Paris in rental yield as young professionals fuel apartment demand", source: "Le Figaro Immobilier", url: "https://lefigaro.fr", date: "Mar 13" },
      { title: "Bordeaux international demand surges as TGV connectivity drives property values", source: "SeLoger", url: "https://seloger.com", date: "Mar 7" },
      { title: "Paris 9th and 10th arrondissements see gentrification wave boosting returns", source: "Bien'Ici", url: "https://bienici.com", date: "Mar 2" },
      { title: "France stabilizes at 4-5% appreciation expected in major cities for 2025", source: "PAP.fr", url: "https://pap.fr", date: "Feb 24" },
    ],
    GERMANY: [
      { title: "Berlin property market recovery underway as tech sector drives renewed demand", source: "Immobilienscout24", url: "https://immobilienscout24.de", date: "Mar 11" },
      { title: "Munich remains Germany's most stable market with lowest vacancy rate nationally", source: "Wohnglück", url: "https://wohngluck.de", date: "Mar 6" },
      { title: "Hamburg HafenCity mega-development creates investment corridor along waterfront", source: "Hamburger Abendblatt", url: "https://abendblatt.de", date: "Mar 1" },
      { title: "Germany's 54% renter population gives stable base for buy-to-let investors", source: "Deutsche Wohnen", url: "https://deutsche-wohnen.com", date: "Feb 22" },
    ],
    CANADA: [
      { title: "Calgary leads Canada with 10% YoY appreciation as oil sector recovery fuels demand", source: "Better Dwelling", url: "https://betterdwelling.com", date: "Mar 16" },
      { title: "Vancouver Burnaby corridor: 8% appreciation with constrained land supply", source: "RE/MAX Canada", url: "https://remax.ca", date: "Mar 10" },
      { title: "Toronto Liberty Village condos see strong rental demand from tech immigration", source: "Toronto Star", url: "https://thestar.com", date: "Mar 4" },
      { title: "Canada immigration targets 500K/year, maintaining persistent housing demand", source: "Globe and Mail", url: "https://theglobeandmail.com", date: "Feb 26" },
    ],
    MOROCCO: [
      { title: "Marrakech luxury villa market sees 18% YoY price increase driven by European buyers", source: "Morocco World News", url: "https://moroccoworldnews.com", date: "Mar 14" },
      { title: "Casablanca Finance City attracts multinationals, boosting premium residential demand", source: "L'Économiste", url: "https://leconomiste.com", date: "Mar 9" },
      { title: "Tanger Med expansion drives industrial and residential growth along northern corridor", source: "Médias24", url: "https://medias24.com", date: "Mar 3" },
      { title: "Morocco's Golden Visa program draws Gulf and European investors to coastal properties", source: "Arab News", url: "https://arabnews.com", date: "Feb 27" },
    ],
    SPAIN: [
      { title: "Barcelona prime districts hit record €6,500/sqm as demand outpaces supply", source: "El País", url: "https://elpais.com", date: "Mar 15" },
      { title: "Madrid Chamberí and Malasaña lead urban appreciation at 9% YoY in 2025", source: "Idealista", url: "https://idealista.com", date: "Mar 10" },
      { title: "Costa del Sol luxury market booms with Northern European retirees driving demand", source: "Sur in English", url: "https://surinenglish.com", date: "Mar 5" },
      { title: "Spain golden visa changes reshape international investor strategy toward inland cities", source: "El Confidencial", url: "https://elconfidencial.com", date: "Feb 28" },
    ],
  };

  type AreaTrend = "hot" | "warm" | "cool";
  type CountryArea = { name: string; yld: string; appr: string; price: string; type: string; entry: string; trend: AreaTrend; highlight: string; };
  type CountryData = { flag: string; name: string; full: string; overview: string; tax: string; ownership: string; yield: string; entry: string; bestType: string; chart: number[]; chartLabel: string; areas: CountryArea[]; };

  const COUNTRIES: Record<string, CountryData> = {
    USA: { flag: "🇺🇸", name: "USA", full: "United States", overview: "World's largest real estate market at $3.8T annually. Strong legal framework, diverse asset classes, tax deductions on mortgage interest and depreciation.", tax: "Property taxes 0.3–2.5% by state. Capital gains tax applies.", ownership: "Fully open, FIRPTA withholding applies on sale", yield: "5.5%", entry: "$300K–800K", bestType: "Single-family & multifamily", chart: [100, 112, 130, 142, 148, 155], chartLabel: "US Median Home Price Index (2020=100)", areas: [{ name: "Miami, FL", yld: "5–7%", appr: "+6.8% YoY", price: "$620K", type: "Condos & waterfront", entry: "$400K–1.2M", trend: "hot", highlight: "70% renters, international demand, Latin American & European buyers" }, { name: "Austin, TX", yld: "5–6%", appr: "+20% (2yr)", price: "$485K", type: "Single-family homes", entry: "$350K–700K", trend: "warm", highlight: "Silicon Hills tech hub, Tesla & Oracle HQ, strong population inflow" }, { name: "Indianapolis, IN", yld: "8–9%", appr: "+3.4% YoY", price: "$268K", type: "Multifamily & SFR", entry: "$200K–400K", trend: "warm", highlight: "#2 Zillow hottest market 2025, low vacancy, medical & education anchors" }] },
    UAE: { flag: "🇦🇪", name: "UAE", full: "United Arab Emirates", overview: "Zero income tax, zero capital gains tax, 100% foreign ownership in freehold zones. Property values up 15% since 2021 with 10% more growth projected by end of 2025.", tax: "0% — No income, capital gains, or property taxes", ownership: "100% in designated freehold areas", yield: "6.5%", entry: "AED 900K–2M", bestType: "Luxury apartments & off-plan", chart: [100, 108, 112, 119, 128, 143], chartLabel: "Dubai Property Price Index (2020=100)", areas: [{ name: "Downtown Dubai", yld: "5–9%", appr: "+30% (5yr)", price: "AED 2,000/sqft", type: "Luxury apartments", entry: "AED 1.5M–5M", trend: "hot", highlight: "Burj Khalifa district, branded residences, global iconic status" }, { name: "Dubai Marina", yld: "7.2%", appr: "+12% YoY", price: "AED 1,800/sqft", type: "Waterfront apartments", entry: "AED 1.2M–3M", trend: "hot", highlight: "Top short-term rental zone, Yacht Club, expat & tourist goldmine" }, { name: "Jumeirah Village Circle", yld: "7–9%", appr: "+15% projected", price: "AED 1,000/sqft", type: "Apartments & townhouses", entry: "AED 600K–1.5M", trend: "warm", highlight: "Best yield-to-price ratio in Dubai, family community, affordable entry" }] },
    UK: { flag: "🇬🇧", name: "UK", full: "United Kingdom", overview: "Robust legal framework, political stability, well-established buy-to-let sector. London safe haven while Northern cities offer higher yields.", tax: "Stamp duty 2–12%, Capital gains 18–28%, rental income taxed as income", ownership: "Open, +2% stamp duty surcharge for overseas buyers", yield: "4.5%", entry: "£250K–600K", bestType: "Buy-to-let apartments", chart: [100, 106, 110, 114, 118, 122], chartLabel: "UK House Price Index (2020=100)", areas: [{ name: "Manchester", yld: "6–7%", appr: "+8% YoY", price: "£280K", type: "Apartments & HMOs", entry: "£180K–400K", trend: "hot", highlight: "HS2 rail, BBC Media City, fastest growing UK city outside London" }, { name: "Birmingham", yld: "5–6%", appr: "+6% YoY", price: "£240K", type: "Residential apartments", entry: "£160K–350K", trend: "hot", highlight: "HS2 terminus, HSBC HQ relocated, major urban regeneration underway" }, { name: "London East", yld: "3.5–5%", appr: "+4% YoY", price: "£480K", type: "New builds & conversions", entry: "£350K–700K", trend: "warm", highlight: "Elizabeth Line effect, Barking & Woolwich regeneration zones" }] },
    FRANCE: { flag: "🇫🇷", name: "FRANCE", full: "France", overview: "Safe haven for wealth. Paris is the #4 most visited city globally. Strong tenant protections, high demand in major cities, tourism-driven rental income.", tax: "Property tax (taxe foncière), 19% capital gains for non-residents, notaire fees ~7–8%", ownership: "Fully open, same rights as French citizens", yield: "3.5%", entry: "€250K–600K", bestType: "Apartments in city centers", chart: [100, 104, 109, 112, 116, 119], chartLabel: "France Property Price Index (2020=100)", areas: [{ name: "Paris — 9th/10th", yld: "3–4%", appr: "+4% YoY", price: "€9,500/sqm", type: "Haussmann apartments", entry: "€400K–900K", trend: "warm", highlight: "Gentrifying quartiers, expat demand, Airbnb premium locations" }, { name: "Lyon", yld: "5–6%", appr: "+5.5% YoY", price: "€4,200/sqm", type: "Student rentals & apartments", entry: "€200K–450K", trend: "hot", highlight: "2nd largest economy in France, 160K students, biotech hub" }, { name: "Bordeaux", yld: "4–5%", appr: "+4% YoY", price: "€4,800/sqm", type: "Wine country estates & apartments", entry: "€250K–600K", trend: "warm", highlight: "TGV Paris in 2hr, UNESCO heritage, international wine tourism" }] },
    GERMANY: { flag: "🇩🇪", name: "GERMANY", full: "Germany", overview: "Largest economy in Europe, historically stable. Strong tenant protections, consistent demand from 54% renter population. 2024 correction creating buying opportunities.", tax: "Property transfer tax 3.5–6.5%, 25% capital gains, rental income taxed", ownership: "Fully open, no restrictions", yield: "3.5%", entry: "€300K–700K", bestType: "Multi-unit residential", chart: [100, 110, 118, 122, 115, 118], chartLabel: "Germany Property Price Index (2020=100)", areas: [{ name: "Berlin", yld: "3–4%", appr: "+5% projected 2025", price: "€5,200/sqm", type: "Apartments (Altbau)", entry: "€300K–600K", trend: "warm", highlight: "Tech hub, Startup capital of Europe, recovering after 2023 correction" }, { name: "Munich", yld: "2.5–3.5%", appr: "+4% YoY", price: "€8,500/sqm", type: "Premium apartments", entry: "€500K–1.2M", trend: "warm", highlight: "Lowest vacancy in Germany, BMW/Siemens HQ, ultra-stable wealth market" }, { name: "Hamburg", yld: "3.5–4.5%", appr: "+4.5% YoY", price: "€6,000/sqm", type: "Commercial + residential", entry: "€350K–800K", trend: "warm", highlight: "Largest port in Europe, HafenCity mega-development, trade hub" }] },
    CANADA: { flag: "🇨🇦", name: "CANADA", full: "Canada", overview: "Strong legal system, consistent immigration driving demand. Supply below demand. Calgary emerging; Toronto and Vancouver remain high-value.", tax: "Property taxes 0.5–2.5%, 50% capital gains inclusion, rental income as income", ownership: "Foreign Buyer Ban until 2027 (exceptions for work/study permit holders)", yield: "4.5%", entry: "CAD 500K–900K", bestType: "Condos & multifamily", chart: [100, 118, 132, 128, 124, 128], chartLabel: "Canada House Price Index (2020=100)", areas: [{ name: "Toronto — Liberty Village", yld: "4–5%", appr: "+6% YoY", price: "CAD 780K", type: "Condos & lofts", entry: "CAD 550K–900K", trend: "warm", highlight: "Young professional hub, tech district, strong rental from immigration" }, { name: "Vancouver — Burnaby", yld: "3.5–4.5%", appr: "+8% YoY", price: "CAD 860K", type: "Condos & townhouses", entry: "CAD 600K–1.1M", trend: "hot", highlight: "Gateway to Asia-Pacific, constrained land, tech migration from US" }, { name: "Calgary", yld: "5–7%", appr: "+10% YoY", price: "CAD 580K", type: "Single-family & condos", entry: "CAD 400K–700K", trend: "hot", highlight: "Most affordable major city, oil sector recovery, #1 population growth 2024" }] },
    MOROCCO: { flag: "🇲🇦", name: "MOROCCO", full: "Morocco", overview: "Africa's most stable real estate market. Gateway between Europe and Africa, major infrastructure investment, growing tourism sector. Strong demand from French and Gulf investors.", tax: "Property tax (taxe urbaine) 10–30%, 20% capital gains for non-residents, notary fees ~4%", ownership: "Fully open for foreigners, easy repatriation of funds", yield: "5.5%", entry: "MAD 600K–2M (€55K–185K)", bestType: "Riads & coastal apartments", chart: [100, 103, 107, 112, 118, 124], chartLabel: "Morocco Property Price Index (2020=100)", areas: [{ name: "Marrakech", yld: "5–8%", appr: "+18% YoY", price: "€1,800/sqm", type: "Luxury riads & villas", entry: "€80K–400K", trend: "hot", highlight: "Tourism goldmine, European demand, short-term rental premium zones" }, { name: "Casablanca", yld: "4–6%", appr: "+6% YoY", price: "MAD 15,000/sqm", type: "Urban apartments", entry: "€60K–180K", trend: "warm", highlight: "Financial capital, Finance City multinationals, strongest rental demand in Morocco" }, { name: "Tanger", yld: "5–7%", appr: "+8% YoY", price: "MAD 12,000/sqm", type: "New builds & logistics zones", entry: "€45K–130K", trend: "hot", highlight: "Tanger Med port expansion, proximity to Europe, fast-growing industrial city" }] },
    SPAIN: { flag: "🇪🇸", name: "SPAIN", full: "Spain", overview: "Europe's #1 destination for foreign real estate buyers. Strong tourism-driven rental income, world-class lifestyle, major demand from Northern Europeans and Latin Americans.", tax: "Transfer tax 6–10%, 19% capital gains for non-residents, plus IBI annual property tax", ownership: "Fully open, Golden Visa (€500K+ investment) under review", yield: "5%", entry: "€200K–700K", bestType: "Coastal apartments & city center", chart: [100, 105, 112, 119, 127, 136], chartLabel: "Spain Property Price Index (2020=100)", areas: [{ name: "Barcelona — Eixample", yld: "4–6%", appr: "+9% YoY", price: "€6,500/sqm", type: "Premium apartments", entry: "€400K–900K", trend: "hot", highlight: "Record prices, tech hub, restricted supply drives value upward" }, { name: "Madrid — Chamberí", yld: "4–5%", appr: "+9% YoY", price: "€5,800/sqm", type: "Classic apartments", entry: "€350K–800K", trend: "hot", highlight: "Capital city premium, IBEX 35 HQs, strong expat demand from LATAM" }, { name: "Málaga — Costa del Sol", yld: "6–8%", appr: "+7% YoY", price: "€3,200/sqm", type: "Coastal apartments & villas", entry: "€200K–500K", trend: "hot", highlight: "UK & German retiree hotspot, year-round tourism, booming tech scene" }] },
  };

  const C = COUNTRIES[selectedCountry];

  useEffect(() => {
    const articles = NEWS[selectedCountry] || [];
    if (!articles.length) return;
    setAiLoading(true); setAiSummary("");
    const headlines = articles.map((a: any) => `- ${a.title}`).join("\n");
    fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 150, messages: [{ role: "user", content: `Real estate analyst. Based on these ${selectedCountry} headlines, give ONE 2-sentence investor insight. Specific, data-driven, no fluff.\n\n${headlines}` }] }) })
      .then(r => r.json()).then(d => { setAiSummary(d.content?.find((b: any) => b.type === "text")?.text || ""); setAiLoading(false); })
      .catch(() => setAiLoading(false));
  }, [selectedCountry]);

  function trendBadge(t: AreaTrend) {
    if (t === "hot") return { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)", label: "🔥 Hot" };
    if (t === "warm") return { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", label: "⚡ Active" };
    return { color: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.2)", label: "❄️ Stable" };
  }

  const chartChange = ((C.chart[C.chart.length - 1] - C.chart[0]) / C.chart[0] * 100).toFixed(1);
  const chartUp = parseFloat(chartChange) >= 0;
  const chartUid = `cg_${selectedCountry}`;

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399", boxShadow: "0 0 6px #34d399", animation: "blink 1.5s infinite" }} />
          <span style={{ fontSize: "10px", color: "rgba(245,158,11,0.7)", letterSpacing: "2px", fontWeight: "700", textTransform: "uppercase" }}>Global Market Intelligence · FRED + Curated Data</span>
        </div>
        <h2 style={{ fontSize: "24px", fontWeight: "900", letterSpacing: "-0.8px", background: "linear-gradient(135deg, #fff 60%, rgba(255,255,255,0.5))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Market Analysis</h2>
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginTop: "4px", letterSpacing: "0.3px" }}>Select a market · Top investment zones · Latest news · Economic indicators</p>
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "24px" }}>
        {Object.values(COUNTRIES).map(c => (
          <button key={c.name} onClick={() => setSelectedCountry(c.name)} style={{ padding: "8px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: "700", border: `1px solid ${selectedCountry === c.name ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)"}`, cursor: "pointer", background: selectedCountry === c.name ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.03)", color: selectedCountry === c.name ? "#f59e0b" : "rgba(255,255,255,0.5)", transition: "all 0.2s", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "9px", fontWeight: "800", padding: "2px 5px", borderRadius: "4px", background: ({USA:"rgba(245,158,11,0.2)",UAE:"rgba(52,211,153,0.15)",UK:"rgba(96,165,250,0.15)",FRANCE:"rgba(96,165,250,0.15)",GERMANY:"rgba(248,113,113,0.15)",CANADA:"rgba(220,38,38,0.15)",MOROCCO:"rgba(34,197,94,0.15)",SPAIN:"rgba(234,179,8,0.15)"}[c.name] || "rgba(255,255,255,0.08)"), color: ({USA:"#f59e0b",UAE:"#34d399",UK:"#60a5fa",FRANCE:"#60a5fa",GERMANY:"#f87171",CANADA:"#ef4444",MOROCCO:"#22c55e",SPAIN:"#eab308"}[c.name] || "rgba(255,255,255,0.5)"), letterSpacing: "0.5px" }}>{c.name}</span>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
            <span style={{ fontSize: "30px" }}>{C.flag}</span>
            <div><h3 style={{ fontSize: "16px", fontWeight: "800" }}>{C.full}</h3><p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1px", textTransform: "uppercase", marginTop: "2px" }}>Market Overview</p></div>
          </div>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: "1.7", marginBottom: "14px" }}>{C.overview}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {[{ label: "Avg Rental Yield", value: C.yield, color: "#34d399" }, { label: "Entry Price Range", value: C.entry, color: "#f59e0b" }, { label: "Best Property Type", value: C.bestType, color: "#fff" }, { label: "Tax Environment", value: C.tax, color: "rgba(255,255,255,0.5)" }, { label: "Foreign Ownership", value: C.ownership, color: "rgba(255,255,255,0.5)" }].map(m => (
              <div key={m.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "7px 10px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", gap: "8px" }}>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>{m.label}</span>
                <span style={{ fontSize: "10px", fontWeight: "600", color: m.color, textAlign: "right" }}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
            <div><p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1px", textTransform: "uppercase", fontWeight: "600" }}>5-Year Price Trend</p><p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "2px" }}>{C.chartLabel}</p></div>
            <span style={{ fontSize: "18px", fontWeight: "800", color: chartUp ? "#34d399" : "#f87171" }}>{chartUp ? "+" : ""}{chartChange}%</span>
          </div>
          <MiniChart data={C.chart} color={chartUp ? "#34d399" : "#f87171"} uid={chartUid} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", fontSize: "9px", color: "rgba(255,255,255,0.2)" }}>{["2020", "2021", "2022", "2023", "2024", "2025"].map(y => <span key={y}>{y}</span>)}</div>
          <div style={{ marginTop: "14px", padding: "12px 14px", background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.1)", borderRadius: "10px" }}>
            <p style={{ fontSize: "9px", color: "#f59e0b", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "6px" }}>🤖 AI Market Insight</p>
            {aiLoading ? <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>Analyzing latest news...</p> : aiSummary ? <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", lineHeight: "1.6" }}>{aiSummary}</p> : <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>Loading market intelligence...</p>}
          </div>
        </div>
      </div>

      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.2px", textTransform: "uppercase", fontWeight: "600", marginBottom: "12px" }}>🔍 Top 3 Investment Zones — {C.full}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
        {C.areas.map((area, i) => {
          const tb = trendBadge(area.trend);
          return (
            <div key={area.name} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "26px", height: "26px", borderRadius: "7px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "800", color: "#f59e0b", flexShrink: 0 }}>#{i + 1}</div>
                  <div><h4 style={{ fontSize: "14px", fontWeight: "800" }}>{area.name}</h4><p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>{area.highlight}</p></div>
                </div>
                <span style={{ fontSize: "9px", fontWeight: "700", padding: "3px 10px", borderRadius: "999px", background: tb.bg, color: tb.color, border: `1px solid ${tb.border}`, textTransform: "uppercase" }}>{tb.label}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px" }}>
                {[{ label: "Rental Yield", value: area.yld, color: "#34d399" }, { label: "Appreciation", value: area.appr, color: "#f59e0b" }, { label: "Median Price", value: area.price, color: "#fff" }, { label: "Entry Target", value: area.entry, color: "#60a5fa" }].map(m => (
                  <div key={m.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "10px 12px" }}>
                    <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.8px", textTransform: "uppercase", fontWeight: "600", marginBottom: "4px" }}>{m.label}</p>
                    <p style={{ fontSize: "12px", fontWeight: "800", color: m.color }}>{m.value}</p>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "10px", padding: "8px 12px", background: "rgba(245,158,11,0.04)", borderRadius: "8px", border: "1px solid rgba(245,158,11,0.08)" }}>
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}><span style={{ color: "#f59e0b", fontWeight: "700" }}>Best for: </span>{area.type}</span>
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.2px", textTransform: "uppercase", fontWeight: "600", marginBottom: "12px" }}>📰 Latest Market News — {C.full}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "24px" }}>
        {(NEWS[selectedCountry] || []).map((article: any, i: number) => (
          <a key={i} href={article.url} target="_blank" rel="noopener noreferrer" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "14px", textDecoration: "none", display: "block", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(245,158,11,0.3)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}>
            <p style={{ fontSize: "12px", fontWeight: "600", color: "rgba(255,255,255,0.8)", lineHeight: "1.4", marginBottom: "8px" }}>{article.title}</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "10px", color: "#f59e0b", fontWeight: "600" }}>{article.source}</span>
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>{article.date}</span>
            </div>
          </a>
        ))}
      </div>

      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.2px", textTransform: "uppercase", fontWeight: "600", marginBottom: "12px" }}>Global Economic Indicators — Live from FRED</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "20px" }}>
        {SERIES.map(s => { const m = metrics[s.key]; return (<div key={s.key} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "18px", transition: "border-color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(245,166,35,0.2)")} onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}><p style={{ fontSize: "8px", color: "rgba(255,255,255,0.25)", letterSpacing: "1.8px", textTransform: "uppercase", fontWeight: "700", marginBottom: "10px" }}>{s.label}</p><p style={{ fontSize: "22px", fontWeight: "900", color: "#f5a623", letterSpacing: "-0.5px", lineHeight: 1 }}>{metricsLoading ? "—" : m?.value ?? "—"}<span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginLeft: "4px", fontWeight: "400", letterSpacing: "0" }}>{s.unit}</span></p>{!metricsLoading && m && <span style={{ fontSize: "10px", fontWeight: "700", color: m.up ? "#34d399" : "#f87171", marginTop: "8px", display: "flex", alignItems: "center", gap: "3px" }}>{m.up ? "▲" : "▼"} {m.change}</span>}</div>); })}
      </div>

      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.15)", textAlign: "center" }}>Sources: FRED · Zillow Research · Global Property Guide · Knight Frank · JLL · Gulf News · HousingWire · Property Week · Updated automatically</p>
    </div>
  );
}
function FinancesTab({ properties, user }: { properties: Property[]; user: any }) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed
  const todayDayOfYear = Math.floor((Date.now() - new Date(currentYear, 0, 0).getTime()) / 86400000);

  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ property_id: "", category: "Mortgage", amount: "", date: new Date().toISOString().split("T")[0], note: "", recurring: false, year: currentYear });
  const [expenseErrors, setExpenseErrors] = useState<Record<string, boolean>>({});
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [expandedProps, setExpandedProps] = useState<Set<number>>(new Set());
  const [filterYear, setFilterYear] = useState(currentYear);

  const CATEGORIES = ["Mortgage", "Insurance", "Property Tax", "Repairs", "Management", "Utilities", "CapEx", "Other"];
  const CAT_COLORS: Record<string, string> = { Mortgage: "#f59e0b", Insurance: "#60a5fa", "Property Tax": "#a78bfa", Repairs: "#f87171", Management: "#34d399", Utilities: "#fb923c", CapEx: "#e879f9", Other: "rgba(255,255,255,0.4)" };
  const IS: React.CSSProperties = { width: "100%", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", color: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

  // Number formatting — max 2 decimals, clear K/M labels
  function fmtMoney(n: number) {
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 10_000) return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$${abs.toFixed(2)}`;
  }
  function fmtMoneyFull(n: number) {
    const sign = n < 0 ? "-$" : "$";
    return sign + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  useEffect(() => {
    if (!user) return;
    supabase.from("expenses").select("*").eq("user_id", user.id).order("date", { ascending: false })
      .then(({ data }) => { setExpenses(data || []); setLoading(false); });
  }, [user]);

  async function handleAddExpense() {
    const errs: Record<string, boolean> = {};
    if (!form.property_id) errs.property_id = true;
    if (!form.amount) errs.amount = true;
    if (Object.keys(errs).length > 0) { setExpenseErrors(errs); return; }
    setExpenseErrors({});
    const newExp = { user_id: user.id, property_id: parseInt(form.property_id), category: form.category, amount: parseFloat(form.amount), date: form.date, note: form.note, recurring: form.recurring, year: form.year };
    if (editingExpenseId !== null) {
      const { error } = await supabase.from("expenses").update(newExp).eq("id", editingExpenseId);
      if (!error) { const { data: refreshed } = await supabase.from("expenses").select("*").eq("user_id", user.id).order("date", { ascending: false }); setExpenses(refreshed || []); resetForm(); }
    } else {
      const { data, error } = await supabase.from("expenses").insert(newExp).select().single();
      if (!error && data) { setExpenses([data, ...expenses]); resetForm(); }
    }
  }

  function resetForm() { setShowForm(false); setEditingExpenseId(null); setForm({ property_id: "", category: "Mortgage", amount: "", date: new Date().toISOString().split("T")[0], note: "", recurring: false, year: currentYear }); }
  function openEditExpense(e: any) { setEditingExpenseId(e.id); setForm({ property_id: String(e.property_id), category: e.category, amount: String(e.amount), date: e.date, note: e.note || "", recurring: e.recurring || false, year: e.year || currentYear }); setShowForm(true); }
  function toggleProp(id: number) { setExpandedProps(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  async function handleDelete(id: number) { await supabase.from("expenses").delete().eq("id", id); setExpenses(expenses.filter(e => e.id !== id)); }

  const years = Array.from(new Set([currentYear, currentYear - 1, currentYear - 2, ...expenses.map(e => e.year || currentYear)])).sort((a, b) => b - a);
  const curExpenses = expenses.filter(e => (e.year || currentYear) === filterYear);
  const prevExpenses = expenses.filter(e => (e.year || currentYear) === filterYear - 1);

  const propPnL = properties.map(p => {
    const cur = curExpenses.filter(e => e.property_id === p.id);
    const prev = prevExpenses.filter(e => e.property_id === p.id);
    const annualExp = cur.reduce((s: number, e: any) => s + e.amount, 0);
    const prevAnnualExp = prev.reduce((s: number, e: any) => s + e.amount, 0);
    const rent = p.occupancyStatus === "occupied" ? p.rent : 0;
    const annualRent = rent * 12;
    const annualNet = annualRent - annualExp;
    const monthlyNet = annualNet / 12;
    const dailyNet = annualNet / 365;
    const yoyDelta = prevAnnualExp > 0 ? annualExp - prevAnnualExp : null;
    const margin = annualRent > 0 ? (annualNet / annualRent) * 100 : null;
    const expenseRatio = annualRent > 0 ? (annualExp / annualRent) * 100 : null;
    // NOI = Revenue - Operating Expenses (excluding mortgage/debt)
    const mortgageExp = cur.filter((e: any) => e.category === "Mortgage").reduce((s: number, e: any) => s + e.amount, 0);
    const noi = annualRent - (annualExp - mortgageExp);
    // Cash reserve: months of expenses covered (assumes 3 months savings rule)
    const monthlyExp = annualExp / 12;
    const cashReserveMonths = monthlyExp > 0 ? Math.floor(p.mortgage > 0 ? (p.value - p.mortgage) * 0.05 / monthlyExp : annualRent * 0.1 / monthlyExp) : null;
    return { ...p, cur, prev, annualExp, prevAnnualExp, annualRent, annualNet, monthlyNet, dailyNet, monthlyExp, yoyDelta, margin, expenseRatio, noi, cashReserveMonths };
  });

  const totalAnnualRent = propPnL.reduce((s, p) => s + p.annualRent, 0);
  const totalAnnualExp = propPnL.reduce((s, p) => s + p.annualExp, 0);
  const totalAnnualNet = totalAnnualRent - totalAnnualExp;
  const totalDailyNet = totalAnnualNet / 365;
  const totalMonthlyNet = totalAnnualNet / 12;
  const totalMargin = totalAnnualRent > 0 ? ((totalAnnualNet / totalAnnualRent) * 100).toFixed(1) : null;
  const totalNOI = propPnL.reduce((s, p) => s + p.noi, 0);
  // Today's earnings: daily rate × days elapsed this year
  const todayEarnings = totalDailyNet * todayDayOfYear;

  // 12-month data
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthlyData = MONTHS.map((label, i) => {
    const monthExp = curExpenses.filter((e: any) => { const d = new Date(e.date); return d.getMonth() === i; }).reduce((s: number, e: any) => s + e.amount, 0);
    const monthRent = totalAnnualRent / 12;
    const net = i <= currentMonth ? monthRent - monthExp : null; // null = future
    const projected = i > currentMonth ? monthRent - (totalAnnualExp / 12) : null;
    return { label, monthExp, monthRent, net, projected, isFuture: i > currentMonth, isCurrent: i === currentMonth };
  });
  const maxBarVal = Math.max(...monthlyData.map(m => Math.abs(m.net ?? m.projected ?? 0)), 1);

  const catTotals: Record<string, number> = {};
  curExpenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });

  function healthColor(margin: number | null) {
    if (margin === null) return "rgba(255,255,255,0.2)";
    if (margin >= 40) return "#34d399";
    if (margin >= 15) return "#f59e0b";
    return "#f87171";
  }
  function healthLabel(margin: number | null) {
    if (margin === null) return "No data";
    if (margin >= 40) return "Healthy";
    if (margin >= 15) return "Watch";
    return "At risk";
  }

  // Period color scheme
  const PERIOD_THEME = {
    daily:   { label: "DAILY",   accent: "#60a5fa", bg: "rgba(96,165,250,0.06)",   border: "rgba(96,165,250,0.15)",   desc: "per day" },
    monthly: { label: "MONTHLY", accent: "#f59e0b", bg: "rgba(245,158,11,0.06)",   border: "rgba(245,158,11,0.15)",   desc: "per month" },
    annual:  { label: "ANNUAL",  accent: "#34d399", bg: "rgba(52,211,153,0.06)",   border: "rgba(52,211,153,0.15)",   desc: "per year" },
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399", boxShadow: "0 0 6px #34d399", animation: "blink 1.5s infinite" }} />
            <span style={{ fontSize: "10px", color: "rgba(245,158,11,0.7)", letterSpacing: "2px", fontWeight: "700", textTransform: "uppercase" }}>Financial Intelligence · P&L + Expense Tracking</span>
          </div>
          <h2 style={{ fontSize: "24px", fontWeight: "900", letterSpacing: "-0.8px", background: "linear-gradient(135deg, #fff 60%, rgba(255,255,255,0.5))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Finances</h2>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginTop: "4px", letterSpacing: "0.3px" }}>Daily · Monthly · Annual · YoY comparison</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <select value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", color: "#fff", cursor: "pointer", fontWeight: "700", outline: "none" }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => setShowForm(true)} style={{ padding: "10px 20px", background: "#f59e0b", color: "#000", borderRadius: "10px", fontWeight: "800", fontSize: "13px", border: "none", cursor: "pointer" }}>+ Log Expense</button>
        </div>
      </div>

      {/* Today's Earnings Counter */}
      <div style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(52,211,153,0.05))", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "16px", padding: "18px 24px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <p style={{ fontSize: "10px", color: "rgba(245,158,11,0.7)", letterSpacing: "2px", fontWeight: "700", textTransform: "uppercase", marginBottom: "4px" }}>📈 YTD Earnings Counter <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: "400", letterSpacing: "0" }}>· income accumulated since Jan 1</span></p>
          <p style={{ fontSize: "32px", fontWeight: "900", color: todayEarnings >= 0 ? "#34d399" : "#f87171", letterSpacing: "-1px" }}>{todayEarnings >= 0 ? "+" : ""}{fmtMoneyFull(todayEarnings)}</p>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "4px" }}>Day {todayDayOfYear} of {filterYear} · {fmtMoney(totalDailyNet)}/day net rate</p>
        </div>
        <div style={{ display: "flex", gap: "20px" }}>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "3px" }}>NOI <span style={{ color: "rgba(255,255,255,0.2)" }}>· Net Operating Income</span></p>
            <p style={{ fontSize: "18px", fontWeight: "800", color: "#f59e0b" }}>{fmtMoneyFull(totalNOI)}/yr</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "3px" }}>Profit Margin</p>
            <p style={{ fontSize: "18px", fontWeight: "800", color: totalMargin !== null ? healthColor(parseFloat(totalMargin)) : "rgba(255,255,255,0.3)" }}>{totalMargin !== null ? `${totalMargin}%` : "—"}</p>
          </div>
        </div>
      </div>

      {/* Color-coded Daily / Monthly / Annual strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "20px" }}>
        {([
          { theme: PERIOD_THEME.daily,   income: totalAnnualRent / 365, exp: totalAnnualExp / 365, net: totalDailyNet },
          { theme: PERIOD_THEME.monthly, income: totalAnnualRent / 12,  exp: totalAnnualExp / 12,  net: totalMonthlyNet },
          { theme: PERIOD_THEME.annual,  income: totalAnnualRent,        exp: totalAnnualExp,        net: totalAnnualNet },
        ] as const).map(({ theme, income, exp, net }) => (
          <div key={theme.label} style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <span style={{ fontSize: "10px", fontWeight: "800", color: theme.accent, letterSpacing: "1.5px" }}>{theme.label}</span>
              <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", fontWeight: "600" }}>{theme.desc}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>Income</span>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#34d399" }}>{fmtMoney(income)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>Expenses</span>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#f87171" }}>{fmtMoney(exp)}</span>
              </div>
              <div style={{ height: "1px", background: `${theme.accent}33` }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "10px", color: theme.accent, fontWeight: "700" }}>Net</span>
                <span style={{ fontSize: "18px", fontWeight: "900", color: net >= 0 ? "#34d399" : "#f87171", letterSpacing: "-0.5px" }}>{net >= 0 ? "+" : ""}{fmtMoney(net)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 12-Month Bar Chart */}
      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.2px", textTransform: "uppercase", fontWeight: "600", marginBottom: "12px" }}>📅 12-Month Net P&L <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: "400", letterSpacing: "0", textTransform: "none" }}>· past months real · future projected</span></p>
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "24px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "120px", justifyContent: "space-between" }}>
          {monthlyData.map((m, i) => {
            const val = m.net ?? m.projected ?? 0;
            const barH = Math.max(4, (Math.abs(val) / maxBarVal) * 100);
            const color = m.isFuture ? "rgba(96,165,250,0.3)" : val >= 0 ? "#34d399" : "#f87171";
            const borderColor = m.isCurrent ? "#f59e0b" : "transparent";
            return (
              <div key={m.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", height: "100%" }}>
                <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}><div title={`${m.label}: ${fmtMoney(val)}`} style={{ width: "100%", height: `${barH}%`, background: color, borderRadius: "4px 4px 0 0", border: `1px solid ${borderColor}`, boxShadow: m.isCurrent ? `0 0 8px rgba(245,158,11,0.4)` : "none", position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "center" }}><span style={{ fontSize: "8px", fontWeight: "800", color: "#fff", opacity: 0.85, marginTop: "3px", whiteSpace: "nowrap", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>{fmtMoney(val)}</span></div></div>

                <span style={{ fontSize: "9px", color: m.isCurrent ? "#f59e0b" : "rgba(255,255,255,0.25)", fontWeight: m.isCurrent ? "800" : "400", whiteSpace: "nowrap" }}>{m.label}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: "16px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.05)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#34d399" }} /><span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>Positive month</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: "10px", height: "10px", borderRadius: "2px", background: "rgba(96,165,250,0.3)" }} /><span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>Projected</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#f87171" }} /><span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>Negative month</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: "10px", height: "10px", borderRadius: "2px", background: "transparent", border: "1px solid #f59e0b" }} /><span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>Current month</span></div>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "Expense Ratio", sublabel: "expenses ÷ revenue", value: totalAnnualRent > 0 ? `${((totalAnnualExp / totalAnnualRent) * 100).toFixed(1)}%` : "—", color: "#f59e0b" },
          { label: "YoY Expenses", sublabel: `vs ${filterYear - 1}`, value: (() => { const p = prevExpenses.reduce((s: number, e: any) => s + e.amount, 0); return p > 0 ? `${totalAnnualExp >= p ? "+" : ""}${((totalAnnualExp - p) / p * 100).toFixed(1)}%` : "No prior data"; })(), color: (() => { const p = prevExpenses.reduce((s: number, e: any) => s + e.amount, 0); return p > 0 && totalAnnualExp < p ? "#34d399" : "#f87171"; })() },
          { label: "Break-Even Occ.", sublabel: "min occupancy to cover costs", value: totalAnnualRent > 0 ? `${Math.min(100, (totalAnnualExp / totalAnnualRent) * 100).toFixed(0)}%` : "—", color: "#a78bfa" },
        ].map(m => (
          <div key={m.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "18px 20px" }}>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "2px", fontWeight: "600" }}>{m.label}</p>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginBottom: "8px" }}>{m.sublabel}</p>
            <p style={{ fontSize: "22px", fontWeight: "800", color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* P&L per property */}
      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.2px", textTransform: "uppercase", fontWeight: "600", marginBottom: "12px" }}>📊 P&L Per Property — {filterYear}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
        {propPnL.map(p => {
          const hc = healthColor(p.margin);
          return (
            <div key={p.id} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${hc}22`, borderRadius: "16px", overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: hc, boxShadow: `0 0 6px ${hc}` }} />
                  <div>
                    <h4 style={{ fontSize: "14px", fontWeight: "800" }}>{p.name}</h4>
                    <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "1px" }}>{p.type} · <span style={{ color: hc, fontWeight: "700" }}>{healthLabel(p.margin)}</span>{p.margin !== null ? ` · ${p.margin.toFixed(1)}% margin` : ""}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  {/* Cash Reserve */}
                  {p.cashReserveMonths !== null && (
                    <span title="Cash Reserve: estimated months of expenses covered by equity buffer" style={{ fontSize: "10px", color: p.cashReserveMonths >= 6 ? "#34d399" : p.cashReserveMonths >= 3 ? "#f59e0b" : "#f87171", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "3px 10px", borderRadius: "999px", fontWeight: "700" }}>
                      🛡 {p.cashReserveMonths}mo reserve <span style={{ fontWeight: "400", color: "rgba(255,255,255,0.2)" }}>· vacancy buffer</span>
                    </span>
                  )}
                  {p.yoyDelta !== null && (
                    <span style={{ fontSize: "11px", fontWeight: "700", color: p.yoyDelta <= 0 ? "#34d399" : "#f87171", background: p.yoyDelta <= 0 ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)", padding: "3px 10px", borderRadius: "999px", border: `1px solid ${p.yoyDelta <= 0 ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}` }}>
                      {p.yoyDelta <= 0 ? "▼" : "▲"} {fmtMoney(Math.abs(p.yoyDelta))} exp vs {filterYear - 1}
                    </span>
                  )}
                  <span style={{ fontSize: "16px", fontWeight: "800", color: p.annualNet >= 0 ? "#34d399" : "#f87171" }}>{p.annualNet >= 0 ? "+" : ""}{fmtMoney(p.annualNet)}/yr</span>
                  <button onClick={() => toggleProp(p.id)} style={{ fontSize: "10px", padding: "4px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontWeight: "600" }}>{expandedProps.has(p.id) ? "▲ Hide" : "▼ Expenses"}</button>
                </div>
              </div>

              {/* Daily / Monthly / Annual per property */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)" }}>
                {([
                  { theme: PERIOD_THEME.daily,   income: p.annualRent / 365, exp: p.annualExp / 365, net: p.dailyNet },
                  { theme: PERIOD_THEME.monthly, income: p.annualRent / 12,  exp: p.monthlyExp,      net: p.monthlyNet },
                  { theme: PERIOD_THEME.annual,  income: p.annualRent,        exp: p.annualExp,        net: p.annualNet },
                ] as const).map(({ theme, income, exp, net }, idx) => (
                  <div key={theme.label} style={{ padding: "14px 16px", borderRight: idx < 2 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                    <p style={{ fontSize: "9px", color: theme.accent, letterSpacing: "1.2px", textTransform: "uppercase", fontWeight: "800", marginBottom: "8px" }}>{theme.label}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)" }}>In</span><span style={{ fontSize: "12px", fontWeight: "700", color: "#34d399" }}>{fmtMoney(income)}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)" }}>Out</span><span style={{ fontSize: "12px", fontWeight: "700", color: "#f87171" }}>{fmtMoney(exp)}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3px", paddingTop: "3px", borderTop: `1px solid ${theme.accent}22` }}><span style={{ fontSize: "9px", color: theme.accent, fontWeight: "700" }}>Net</span><span style={{ fontSize: "14px", fontWeight: "800", color: net >= 0 ? "#34d399" : "#f87171" }}>{net >= 0 ? "+" : ""}{fmtMoney(net)}</span></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* NOI per property */}
              <div style={{ padding: "10px 16px", background: "rgba(245,158,11,0.03)", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap" }}>
                <div><span style={{ fontSize: "9px", color: "rgba(245,158,11,0.6)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700" }}>NOI </span><span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)" }}>· Net Operating Income (excl. mortgage)</span><span style={{ fontSize: "13px", fontWeight: "800", color: "#f59e0b", marginLeft: "8px" }}>{fmtMoney(p.noi)}/yr</span></div>
                <div style={{ flex: 1, minWidth: "120px" }}>
                  <div style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "999px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, p.expenseRatio ?? 0)}%`, background: healthColor(p.margin), borderRadius: "999px" }} />
                  </div>
                  <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", marginTop: "3px" }}>Expense ratio: {p.expenseRatio !== null ? `${p.expenseRatio.toFixed(1)}%` : "—"} · Break-even: {p.annualRent > 0 ? `${Math.min(100, (p.annualExp / p.annualRent) * 100).toFixed(0)}%` : "—"} occupancy</p>
                </div>
              </div>

              {expandedProps.has(p.id) && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "14px 16px", background: "rgba(0,0,0,0.2)" }}>
                  {p.cur.length === 0
                    ? <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)", textAlign: "center", padding: "8px" }}>No expenses logged for {filterYear}.</p>
                    : p.cur.map((e: any) => (
                      <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 8px", borderRadius: "8px", marginBottom: "4px", background: "rgba(255,255,255,0.02)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "999px", background: `${CAT_COLORS[e.category] || "rgba(255,255,255,0.1)"}22`, color: CAT_COLORS[e.category] || "rgba(255,255,255,0.5)", fontWeight: "700" }}>{e.category}</span>
                          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>{e.date}</span>
                          {e.note && <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>{e.note}</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "13px", fontWeight: "700", color: "#f87171" }}>{fmtMoneyFull(e.amount)}</span>
                          <button onClick={() => openEditExpense(e)} style={{ fontSize: "10px", padding: "2px 7px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>Edit</button>
                          <button onClick={() => handleDelete(e.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "16px" }}>×</button>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Category Breakdown */}
      {Object.keys(catTotals).length > 0 && <>
        <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.2px", textTransform: "uppercase", fontWeight: "600", marginBottom: "12px" }}>🏷️ Expense Breakdown — {filterYear}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginBottom: "24px" }}>
          {Object.entries(catTotals).sort((a, b) => b[1] - a[1]).map(([cat, total]) => (
            <div key={cat} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${CAT_COLORS[cat] || "rgba(255,255,255,0.08)"}33`, borderRadius: "12px", padding: "14px" }}>
              <p style={{ fontSize: "9px", color: CAT_COLORS[cat] || "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700", marginBottom: "6px" }}>{cat}</p>
              <p style={{ fontSize: "16px", fontWeight: "800", color: "#fff" }}>{fmtMoneyFull(total)}</p>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "3px" }}>{totalAnnualExp > 0 ? `${((total / totalAnnualExp) * 100).toFixed(1)}% of total` : ""}</p>
            </div>
          ))}
        </div>
      </>}

      {/* Expense History */}
      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.2px", textTransform: "uppercase", fontWeight: "600", marginBottom: "12px" }}>📋 Expense History — {filterYear}</p>
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", overflow: "hidden", marginBottom: "24px" }}>
        {loading ? <p style={{ padding: "24px", color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>Loading...</p> : curExpenses.length === 0
          ? <div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: "13px" }}>No expenses for {filterYear}. Log one above.</div>
          : <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
            <thead><tr style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", letterSpacing: "1px", textTransform: "uppercase" }}>
              {["Date", "Property", "Category", "Amount", "Note", ""].map(h => <th key={h} style={{ textAlign: h === "Amount" ? "right" : "left", padding: "12px 16px", fontWeight: "600", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {curExpenses.map((e: any) => {
                const prop = properties.find(p => p.id === e.property_id);
                return (
                  <tr key={e.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px 16px", color: "rgba(255,255,255,0.4)" }}>{e.date}</td>
                    <td style={{ padding: "12px 16px", fontWeight: "600" }}>{prop?.name || "—"}</td>
                    <td style={{ padding: "12px 16px" }}><span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "999px", background: `${CAT_COLORS[e.category] || "rgba(255,255,255,0.1)"}22`, color: CAT_COLORS[e.category] || "rgba(255,255,255,0.5)", fontWeight: "700" }}>{e.category}</span></td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "700", color: "#f87171" }}>{fmtMoneyFull(e.amount)}</td>
                    <td style={{ padding: "12px 16px", color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>{e.note || "—"}</td>
                    <td style={{ padding: "12px 10px" }}><div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      <button onClick={() => openEditExpense(e)} style={{ fontSize: "10px", padding: "3px 8px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>Edit</button>
                      <button onClick={() => handleDelete(e.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "16px" }}>×</button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>}
      </div>

      {/* Log Expense Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 50, padding: "100px 20px 20px" }}>
          <div style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "24px", padding: "36px", width: "100%", maxWidth: "460px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: "800" }}>{editingExpenseId !== null ? "Edit Expense" : "Log Expense"}</h2>
              <button onClick={resetForm} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "22px" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <Field label="Property">
                <select value={form.property_id} onChange={e => { setForm({ ...form, property_id: e.target.value }); setExpenseErrors(f => ({ ...f, property_id: false })); }} style={{ ...IS, border: expenseErrors.property_id ? "1px solid #f87171" : "1px solid rgba(255,255,255,0.12)" }}>
                  <option value="">Select property...</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Category">
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={IS}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <Field label="Amount ($)">
                  <NumberInput value={form.amount} onChange={v => { setForm({ ...form, amount: v }); setExpenseErrors(f => ({ ...f, amount: false })); }} placeholder="1,200" style={{ ...IS, border: expenseErrors.amount ? "1px solid #f87171" : "1px solid rgba(255,255,255,0.12)" }} />
                </Field>
                <Field label="Date">
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={IS} />
                </Field>
                <Field label="Year">
                  <select value={form.year} onChange={e => setForm({ ...form, year: parseInt(e.target.value) })} style={IS}>
                    {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Note (optional)">
                <input type="text" placeholder="e.g. Roof repair after storm" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} style={IS} />
              </Field>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input type="checkbox" id="recurring" checked={form.recurring} onChange={e => setForm({ ...form, recurring: e.target.checked })} />
                <label htmlFor="recurring" style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>Recurring monthly expense</label>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
              <button onClick={resetForm} style={{ flex: 1, padding: "12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "13px", color: "rgba(255,255,255,0.4)", background: "none", cursor: "pointer", fontWeight: "600" }}>Cancel</button>
              <button onClick={handleAddExpense} style={{ flex: 1, padding: "12px", background: "#f59e0b", color: "#000", borderRadius: "10px", fontSize: "13px", fontWeight: "800", border: "none", cursor: "pointer" }}>
                {editingExpenseId !== null ? "Save Changes" : "Log Expense"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function ProjectsTab({ user }: { user: any }) {
  const PROJECT_TYPES = ["Renovation", "Rehabilitation", "Flip", "New Build", "Commercial", "Mixed-Use", "Land Development", "Condo Conversion", "Short-Term Rental Setup", "Other"];
  const PHASE_AVG_DAYS: Record<string, number> = {
    "Planning": 14, "Permits": 30, "Demo": 7, "Foundation": 21,
    "Framing": 21, "MEP": 14, "Plumbing": 10, "Electrical": 10,
    "HVAC": 7, "Insulation": 5, "Drywall": 10, "Flooring": 7,
    "Painting": 7, "Roofing": 10, "Windows": 5, "Finishing": 14,
    "Inspection": 7, "Delivery": 3, "Staging": 5, "Listing": 14,
    "Closing": 30, "Acquisition": 45, "Assessment": 14, "Structural": 21,
    "Systems": 14, "Certificate": 14, "Design": 21, "Feasibility": 30,
    "Fit-Out": 21, "Opening": 7, "Handover": 5, "Launch": 3,
    "Due Diligence": 21, "Site Prep": 14, "Infrastructure": 30,
    "Lot Sales": 60, "Unit Setup": 14, "HOA Setup": 21,
    "Photography": 2, "Listing Setup": 3, "Execution": 30,
    "Review": 7, "Construction": 60, "Management": 30,
  };
  const PHASE_ICONS: Record<string, string> = {
    "Planning": "🗺️", "Permits": "📋", "Demo": "🔨", "Foundation": "🏗️",
    "Framing": "🪵", "MEP": "⚙️", "Plumbing": "🔧", "Electrical": "⚡",
    "HVAC": "🌀", "Insulation": "🧱", "Drywall": "🪣", "Flooring": "🟫",
    "Painting": "🎨", "Roofing": "🏠", "Windows": "🪟", "Finishing": "✨",
    "Inspection": "🔍", "Delivery": "🚚", "Staging": "🛋️", "Listing": "📣",
    "Closing": "🤝", "Acquisition": "🔑", "Assessment": "📊", "Structural": "⚙️",
    "Systems": "🔌", "Certificate": "📜", "Design": "✏️", "Feasibility": "📈",
    "Fit-Out": "🪑", "Opening": "🎉", "Handover": "🤝", "Launch": "🚀",
    "Due Diligence": "🔎", "Site Prep": "🚜", "Infrastructure": "🛣️",
    "Lot Sales": "💰", "Unit Setup": "🏘️", "HOA Setup": "📝",
    "Photography": "📸", "Listing Setup": "💻", "Execution": "▶️",
    "Review": "👁️", "Construction": "🏗️", "Management": "👷",
  };
  const PHASE_TEMPLATES: Record<string, string[]> = {
    "Renovation":            ["Planning", "Permits", "Demo", "Construction", "Finishing", "Inspection", "Delivery"],
    "Rehabilitation":        ["Assessment", "Planning", "Permits", "Structural", "Systems", "Finishing", "Certificate"],
    "Flip":                  ["Acquisition", "Planning", "Demo", "Construction", "Staging", "Listing", "Closing"],
    "New Build":             ["Design", "Permits", "Foundation", "Framing", "MEP", "Finishing", "Inspection", "Handover"],
    "Commercial":            ["Feasibility", "Design", "Permits", "Demo", "Construction", "Fit-Out", "Inspection", "Opening"],
    "Mixed-Use":             ["Planning", "Permits", "Foundation", "Structure", "Residential", "Commercial", "Inspection", "Delivery"],
    "Land Development":      ["Acquisition", "Due Diligence", "Permits", "Site Prep", "Infrastructure", "Lot Sales", "Closing"],
    "Condo Conversion":      ["Acquisition", "Feasibility", "Permits", "Renovation", "Unit Setup", "HOA Setup", "Sales", "Closing"],
    "Short-Term Rental Setup": ["Acquisition", "Design", "Renovation", "Furnishing", "Photography", "Listing Setup", "Launch"],
    "Other":                 ["Planning", "Execution", "Review", "Delivery"],
  };
  const STATUS_COLORS: Record<string, { color: string; bg: string; border: string }> = {
    "not_started": { color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)" },
    "in_progress": { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" },
    "done":        { color: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)" },
    "delayed":     { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
  };
  const STATUS_LABELS: Record<string, string> = { not_started: "⬜ Not Started", in_progress: "🟡 In Progress", done: "✅ Done", delayed: "🔴 Delayed" };
  const TEAM_ROLES = ["Architect", "Contractor", "Project Manager", "Accountant", "Engineer", "Designer", "Inspector"];
  const TRADE_CATEGORIES = ["Architecture", "Engineering", "Permits", "Demo", "Foundation", "Framing", "Plumbing", "Electrical", "HVAC", "Insulation", "Drywall", "Flooring", "Painting", "Roofing", "Windows", "Finishing", "Landscaping", "Other"];

  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [activeSection, setActiveSection] = useState<Record<number, string>>({});
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [confirmPhaseDelete, setConfirmPhaseDelete] = useState<{ projectId: number; phaseIdx: number; phaseName: string } | null>(null);
  const [projectComplete, setProjectComplete] = useState<number | null>(null);
  const [showDeletedPhases, setShowDeletedPhases] = useState<Record<number, boolean>>({});
  const [confirmProjectDelete, setConfirmProjectDelete] = useState<number | null>(null);
  const [checklistOpenState, setChecklistOpenState] = useState<Record<string, boolean>>({});
  const [checklistLabelValues, setChecklistLabelValues] = useState<Record<string, string>>({});
  const [addPropertyForm, setAddPropertyForm] = useState<{ name: string; address: string; equity: string } | null>(null);
  const [form, setForm] = useState({ name: "", type: "Renovation", address: "", budget: "", start_date: "", end_date: "", notes: "" });
  const IS: React.CSSProperties = { width: "100%", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", color: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

  useEffect(() => { if (!user) return; loadProjects(); }, [user]);

  async function loadProjects() {
    const { data } = await supabase.from("projects").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    const loaded = (data || []).map(p => ({ ...p, phases: p.phases || [], team: p.team || [], trades: p.trades || [], budgetHistory: p.budget_history || [], deleted_phases: p.deleted_phases || [] }));
    setProjects(loaded);
    setExpanded(new Set(loaded.map((p: any) => p.id)));
    setLoading(false);
  }

  async function handleSave() {
    if (!form.name) return;
    const phases = PHASE_TEMPLATES[form.type || "Renovation"].map((name, i) => ({ name, status: i === 0 ? "in_progress" : "not_started", date: "", note: "", checklist: (PHASE_CHECKLIST_DEFAULTS[name] || ["Plan", "Execute", "Review"]).map(label => ({ label, done: false })), originalIndex: i }));
    const payload = { user_id: user.id, name: form.name, type: form.type, address: form.address, budget: parseFloat(form.budget) || 0, spent: 0, start_date: form.start_date || null, end_date: form.end_date || null, notes: form.notes, phases, team: [], deleted_phases: [] };
    if (editingId !== null) {
      const { error } = await supabase.from("projects").update({ name: form.name, type: form.type, address: form.address, budget: parseFloat(form.budget) || 0, start_date: form.start_date || null, end_date: form.end_date || null, notes: form.notes }).eq("id", editingId);
      if (!error) await loadProjects();
    } else {
      const { error } = await supabase.from("projects").insert(payload);
      if (!error) await loadProjects();
    }
    setShowForm(false); setEditingId(null); setForm({ name: "", type: "Renovation", address: "", budget: "", start_date: "", end_date: "", notes: "" });
  }

  async function deleteProject(id: number) { await supabase.from("projects").delete().eq("id", id); setProjects(projects.filter(p => p.id !== id)); }

  const [noteValues, setNoteValues] = useState<Record<string, string>>({});

  async function updatePhase(project: any, phaseIdx: number, updates: any) {
    // Note field: only update local state, save on blur
    if (Object.keys(updates).length === 1 && "note" in updates) {
      setNoteValues(prev => ({ ...prev, [`${project.id}_${phaseIdx}`]: updates.note }));
      return;
    }
    const phases = [...project.phases];
    const updatedPhase = { ...phases[phaseIdx], ...updates };
    if (updates.checklist) {
      const allDone = updates.checklist.length > 0 && updates.checklist.every((c: any) => c.done);
      if (allDone && updatedPhase.status !== "done") updatedPhase.status = "done";
    }
    phases[phaseIdx] = updatedPhase;
    if ((updates.status === "done" || (updates.checklist && phases[phaseIdx].status === "done")) && phaseIdx < phases.length - 1) {
      const nextIdx = phases.findIndex((ph: any, i: number) => i > phaseIdx && ph.status === "not_started");
      if (nextIdx !== -1) phases[nextIdx] = { ...phases[nextIdx], status: "in_progress" };
    }
    const allPhasesDone = phases.every((ph: any) => ph.status === "done");
    if (allPhasesDone && !project.completed) {
      await supabase.from("projects").update({ phases, completed: true }).eq("id", project.id);
      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, phases, completed: true } : p));
      setProjectComplete(project.id);
      return;
    }
    await supabase.from("projects").update({ phases }).eq("id", project.id);
    setProjects(prev => prev.map(p => p.id === project.id ? { ...p, phases } : p));
  }

  async function saveNote(project: any, phaseIdx: number) {
    const key = `${project.id}_${phaseIdx}`;
    const note = noteValues[key];
    if (note === undefined) return;
    const phases = [...project.phases];
    phases[phaseIdx] = { ...phases[phaseIdx], note };
    await supabase.from("projects").update({ phases }).eq("id", project.id);
    setProjects(prev => prev.map(p => p.id === project.id ? { ...p, phases } : p));
  }

  async function deletePhase(project: any, phaseIdx: number) {
    const ph = project.phases[phaseIdx];
    const hasData = ph.note || ph.date || (ph.checklist && ph.checklist.some((c: any) => c.done));
    if (hasData) {
      setConfirmPhaseDelete({ projectId: project.id, phaseIdx, phaseName: ph.name });
      return;
    }
    await doDeletePhase(project, phaseIdx);
  }

  async function doDeletePhase(project: any, phaseIdx: number) {
    const ph = project.phases[phaseIdx];
    const phases = project.phases.filter((_: any, i: number) => i !== phaseIdx);
    const deletedPhases = [...(project.deleted_phases || []), { ...ph, originalIndex: ph.originalIndex ?? phaseIdx }];
    await supabase.from("projects").update({ phases, deleted_phases: deletedPhases }).eq("id", project.id);
    setProjects(prev => prev.map(p => p.id === project.id ? { ...p, phases, deleted_phases: deletedPhases } : p));
    setConfirmPhaseDelete(null);
  }

  async function restorePhase(project: any, deletedIdx: number) {
    const deleted = project.deleted_phases[deletedIdx];
    const phases = [...project.phases];
    const originalIndex = deleted.originalIndex ?? phases.length;
    phases.splice(Math.min(originalIndex, phases.length), 0, { ...deleted, status: "not_started" });
    const deletedPhases = project.deleted_phases.filter((_: any, i: number) => i !== deletedIdx);
    await supabase.from("projects").update({ phases, deleted_phases: deletedPhases }).eq("id", project.id);
    setProjects(prev => prev.map(p => p.id === project.id ? { ...p, phases, deleted_phases: deletedPhases } : p));
  }

  async function updateTeam(project: any, team: any[]) {
    await supabase.from("projects").update({ team }).eq("id", project.id);
    setProjects(projects.map(p => p.id === project.id ? { ...p, team } : p));
  }

  async function updateSpent(project: any, spent: number) {
    await supabase.from("projects").update({ spent }).eq("id", project.id);
    setProjects(projects.map(p => p.id === project.id ? { ...p, spent } : p));
  }

  async function updateTrades(project: any, trades: any[]) {
    await supabase.from("projects").update({ trades }).eq("id", project.id);
    setProjects(prev => prev.map(p => p.id === project.id ? { ...p, trades } : p));
    return true;
  }

  function generateMemberToken(projectId: number, memberIndex: number) {
    return btoa(`gs_member_${projectId}_${memberIndex}_${Date.now()}`).replace(/=/g, "");
  }

  function copyMemberLink(project: any, memberIndex: number) {
    const token = generateMemberToken(project.id, memberIndex);
    const url = `${window.location.origin}/team/${token}?pid=${project.id}&mi=${memberIndex}&pname=${encodeURIComponent(project.name)}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(`${project.id}_${memberIndex}`);
    setTimeout(() => setCopiedLink(null), 2000);
  }

  function toggleExpand(id: number) { setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  function healthScore(p: any) {
    const done = p.phases.filter((ph: any) => ph.status === "done").length;
    const total = p.phases.length || 1;
    const phasePct = (done / total) * 100;
    const budgetOk = p.budget > 0 ? Math.max(0, 100 - ((p.spent / p.budget) * 100)) : 50;
    const delayed = p.phases.filter((ph: any) => ph.status === "delayed").length;
    const delayPenalty = delayed * 15;
    return Math.max(0, Math.min(100, Math.round((phasePct * 0.5) + (budgetOk * 0.3) + (50 * 0.2) - delayPenalty)));
  }

  function healthColor(score: number) { if (score >= 70) return "#34d399"; if (score >= 40) return "#f59e0b"; return "#f87171"; }
  function fmtMoney(n: number) { if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M"; if (n >= 1_000) return "$" + Math.round(n).toLocaleString("en-US"); return "$" + n.toFixed(0); }
  function daysLeft(end: string) { if (!end) return null; const d = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000); return d; }

  const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0);
  const totalSpent = projects.reduce((s, p) => s + (p.spent || 0), 0);
  const activeProjects = projects.filter(p => p.phases.some((ph: any) => ph.status === "in_progress"));

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#a78bfa", boxShadow: "0 0 6px #a78bfa", animation: "blink 1.5s infinite" }} />
            <span style={{ fontSize: "10px", color: "rgba(167,139,250,0.7)", letterSpacing: "2px", fontWeight: "700", textTransform: "uppercase" }}>Project Command Center · Construction & Development</span>
          </div>
          <h2 style={{ fontSize: "24px", fontWeight: "900", letterSpacing: "-0.8px", background: "linear-gradient(135deg, #fff 60%, rgba(255,255,255,0.5))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Projects</h2>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginTop: "4px", letterSpacing: "0.3px" }}>Timeline · Budget · Team · Health Score</p>
        </div>
        <button data-new-project onClick={() => setShowForm(true)} style={{ padding: "10px 20px", background: "#a78bfa", color: "#000", borderRadius: "10px", fontWeight: "800", fontSize: "13px", border: "none", cursor: "pointer" }}>+ New Project</button>
      </div>

<MissionControl projects={projects} userId={user?.id} totalEquity={projects.reduce((s,p)=>s+(p.budget||0)-(p.spent||0),0)} />

      {/* Project Cards */}
      {loading ? <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>Loading...</p> : projects.length === 0 ? (
        <div style={{ padding: "60px", textAlign: "center", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: "20px" }}>
          <p style={{ fontSize: "32px", marginBottom: "12px" }}>🏗️</p>
          <p style={{ fontSize: "14px", fontWeight: "700", color: "rgba(255,255,255,0.5)", marginBottom: "6px" }}>No projects yet</p>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)" }}>Click "+ New Project" to start tracking your first construction or renovation.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {projects.map(p => {
            const score = healthScore(p);
            const hc = healthColor(score);
            const doneCount = p.phases.filter((ph: any) => ph.status === "done").length;
            const phasePct = p.phases.length > 0 ? (doneCount / p.phases.length) * 100 : 0;
            const budgetPct = p.budget > 0 ? Math.min(100, (p.spent / p.budget) * 100) : 0;
            const days = daysLeft(p.end_date);
            const isExpanded = expanded.has(p.id);
            const section = activeSection[p.id] || "timeline";
            const delayedCount = p.phases.filter((ph: any) => ph.status === "delayed").length;

            return (
              <div key={p.id} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${hc}22`, borderRadius: "20px", overflow: "hidden" }}>
                {/* Project Header */}
                <div style={{ padding: "20px 24px", borderBottom: isExpanded ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
                        {/* Health Score */}
                        <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `${hc}15`, border: `1px solid ${hc}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: "11px", fontWeight: "900", color: hc }}>{score}</span>
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <h3 style={{ fontSize: "16px", fontWeight: "800" }}>{p.name}</h3>
                            {p.verified && <span style={{ fontSize: "9px", fontWeight: "800", color: "#34d399", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: "5px", padding: "2px 7px", letterSpacing: "1px", textTransform: "uppercase" }}>✓ Verified</span>}
                          </div>
                          <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "1px" }}>
                            {p.type}{p.address ? ` · ${p.address}` : ""}
                            {days !== null && <span style={{ color: days < 0 ? "#f87171" : days < 14 ? "#f59e0b" : "rgba(255,255,255,0.3)", marginLeft: "8px", fontWeight: "700" }}>{days < 0 ? `⚠ ${Math.abs(days)}d overdue` : `${days}d left`}</span>}
                          </p>
                        </div>
                        {delayedCount > 0 && <span style={{ fontSize: "10px", color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", padding: "2px 8px", borderRadius: "999px", fontWeight: "700" }}>🔴 {delayedCount} delayed</span>}
                      </div>

                      {/* Progress bars — bigger */}
                      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginTop: "8px" }}>
                        <div style={{ flex: 1, minWidth: "140px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700" }}>Progress</span>
                            <span style={{ fontSize: "13px", color: hc, fontWeight: "800" }}>{doneCount}/{p.phases.length} · {phasePct.toFixed(0)}%</span>
                          </div>
                          <div style={{ height: "10px", background: "rgba(255,255,255,0.06)", borderRadius: "999px" }}>
                            <div style={{ height: "100%", width: `${phasePct}%`, background: hc, borderRadius: "999px", transition: "width 0.6s", boxShadow: `0 0 12px ${hc}66` }} />
                          </div>
                        </div>
                        {p.budget > 0 && (
                          <div style={{ flex: 1, minWidth: "140px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700" }}>Budget</span>
                              <span style={{ fontSize: "13px", color: budgetPct > 90 ? "#f87171" : "#f59e0b", fontWeight: "800" }}>{fmtMoney(p.spent)} / {fmtMoney(p.budget)}</span>
                            </div>
                            <div style={{ height: "10px", background: "rgba(255,255,255,0.06)", borderRadius: "999px" }}>
                              <div style={{ height: "100%", width: `${budgetPct}%`, background: budgetPct > 90 ? "#f87171" : "#f59e0b", borderRadius: "999px", transition: "width 0.6s", boxShadow: budgetPct > 90 ? "0 0 12px rgba(248,113,113,0.5)" : "0 0 12px rgba(245,158,11,0.4)" }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                      <button onClick={() => { setEditingId(p.id); setForm({ name: p.name, type: p.type, address: p.address || "", budget: String(p.budget), start_date: p.start_date || "", end_date: p.end_date || "", notes: p.notes || "" }); setShowForm(true); }} style={{ fontSize: "11px", padding: "5px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontWeight: "600" }}>Edit</button>
                      <button onClick={async () => { const newVal = !p.verified; await supabase.from("projects").update({ verified: newVal }).eq("id", p.id); setProjects(prev => prev.map(pr => pr.id === p.id ? { ...pr, verified: newVal } : pr)); }} title={p.verified ? "Click to unverify" : "Click to verify"} style={{ fontSize: "11px", padding: "5px 12px", background: p.verified ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${p.verified ? "rgba(52,211,153,0.35)" : "rgba(255,255,255,0.08)"}`, borderRadius: "8px", color: p.verified ? "#34d399" : "rgba(255,255,255,0.25)", cursor: "pointer", fontWeight: "700", letterSpacing: "0.3px" }}>{p.verified ? "✓ VERIFIED" : "◯ Verify"}</button>
                      <button onClick={() => setConfirmProjectDelete(p.id)} style={{ fontSize: "16px", background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer" }}>×</button>
                      <button onClick={() => toggleExpand(p.id)} style={{ fontSize: "11px", padding: "5px 14px", background: isExpanded ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.06)", border: `1px solid ${isExpanded ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: "8px", color: isExpanded ? "#a78bfa" : "rgba(255,255,255,0.5)", cursor: "pointer", fontWeight: "700" }}>{isExpanded ? "▲ Close" : "▼ Open"}</button>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div>
                    {/* Section tabs */}
                    <div style={{ display: "flex", gap: "2px", padding: "12px 24px", background: "rgba(0,0,0,0.2)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      {[{ key: "timeline", label: "🗂 Timeline" }, { key: "budget", label: "💰 Budget" }, { key: "team", label: "👷 Team" }, { key: "activity", label: "📋 Activity" }].map(s => (
                        <button key={s.key} onClick={() => setActiveSection({ ...activeSection, [p.id]: s.key })} style={{ padding: "10px 22px", borderRadius: "10px", fontSize: "14px", fontWeight: "800", border: `1px solid ${section === s.key ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.06)"}`, cursor: "pointer", background: section === s.key ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.03)", color: section === s.key ? "#a78bfa" : "rgba(255,255,255,0.4)", transition: "all 0.2s", boxShadow: section === s.key ? "0 0 16px rgba(167,139,250,0.2)" : "none" }}>{s.label}</button>
                      ))}
                    </div>

                    {/* TIMELINE */}
                    {section === "timeline" && (
                      <div style={{ padding: "24px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
                          <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1px", textTransform: "uppercase", fontWeight: "600" }}>Phase Timeline <span style={{ color: "rgba(255,255,255,0.15)", fontWeight: "400", letterSpacing: "0", textTransform: "none" }}>· click status · delete phases you don't need</span></p>
                          {(p.deleted_phases || []).length > 0 && (
                            <button onClick={() => setShowDeletedPhases(prev => ({ ...prev, [p.id]: !prev[p.id] }))} style={{ fontSize: "10px", padding: "4px 12px", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: "6px", color: "#a78bfa", cursor: "pointer", fontWeight: "700" }}>
                              🗂 {(p.deleted_phases || []).length} hidden phase{(p.deleted_phases || []).length > 1 ? "s" : ""} {showDeletedPhases[p.id] ? "▲" : "▼"}
                            </button>
                          )}
                        </div>

                        {/* Visual dot timeline */}
                        <div style={{ position: "relative", marginBottom: "24px", overflowX: "auto", paddingBottom: "8px" }}>
                          <div style={{ display: "flex", alignItems: "center", minWidth: `${p.phases.length * 110}px` }}>
                            {p.phases.map((ph: any, i: number) => {
                              const sc = STATUS_COLORS[ph.status] || STATUS_COLORS.not_started;
                              const isLast = i === p.phases.length - 1;
                              const phaseDate = ph.date || p.start_date || null;
                              const daysIn = phaseDate ? Math.floor((Date.now() - new Date(phaseDate).getTime()) / 86400000) : null;
                              const isOverdue = daysIn !== null && daysIn > 30 && ph.status === "in_progress";
                    return (
                                <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", minWidth: "110px", position: "relative", paddingTop: "18px" }}>
                                    <div onClick={() => { const statuses = ["not_started","in_progress","done","delayed"]; const next = statuses[(statuses.indexOf(ph.status) + 1) % statuses.length]; updatePhase(p, i, { status: next }); }} style={{ width: "48px", height: "48px", borderRadius: "50%", background: sc.bg, border: `2px solid ${sc.color}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: ph.status === "in_progress" ? `0 0 10px ${sc.color}66` : "none", transition: "all 0.3s", flexDirection: "column" as const, gap: "1px", animation: ph.status === "done" ? "phaseDone 0.6s ease-out" : "none" }}>
                                      <span style={{ fontSize: "16px", lineHeight: 1 }}>{PHASE_ICONS[ph.name] || "📌"}</span>
                                      <span style={{ fontSize: "9px", color: sc.color, fontWeight: "800" }}>{ph.status === "done" ? "✓" : ph.status === "delayed" ? "!" : ph.status === "in_progress" ? "▶" : ""}</span>
                                    </div>
                                    <span style={{ fontSize: "12px", color: sc.color, fontWeight: "800", textAlign: "center", whiteSpace: "nowrap", marginTop: "2px" }}>{ph.name}</span>
                                    {ph.status === "delayed" && (() => {
                                      const blocking = p.phases.slice(i + 1).filter((pp: any) => pp.status === "not_started").length;
                                      return blocking > 0 ? (
                                        <span style={{ fontSize: "8px", fontWeight: "800", color: "#f87171", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "999px", padding: "1px 6px", whiteSpace: "nowrap" }}>⚠ blocking {blocking}</span>
                                      ) : null;
                                    })()}
                                    {(() => {
                                      const avgKey = `avg_${p.id}_${i}`;
                                      const storedAvg = (() => { try { const v = localStorage.getItem(avgKey); return v ? parseInt(v) : null; } catch { return null; } })();
                                      const avg = storedAvg ?? PHASE_AVG_DAYS[ph.name] ?? 14;
                                      return (
                                        <div style={{ display: "flex", alignItems: "center", gap: "3px", marginTop: "2px" }}>
                                          <span style={{ fontSize: "9px", color: "rgba(96,165,250,0.5)", whiteSpace: "nowrap" }}>d</span>
                                        {(() => {
                                          const baseDate = p.start_date ? new Date(p.start_date) : new Date();
                                          let cumDays = 0;
                                          for (let k = 0; k <= i; k++) {
                                            const kAvgKey = `avg_${p.id}_${k}`;
                                            const kStored = (() => { try { const v = localStorage.getItem(kAvgKey); return v ? parseInt(v) : null; } catch { return null; } })();
                                            cumDays += kStored ?? PHASE_AVG_DAYS[p.phases[k]?.name] ?? 14;
                                          }
                                          const estDate = new Date(baseDate.getTime() + cumDays * 86400000);
                                          const today = new Date();
                                          const isLate = ph.status === "in_progress" && estDate < today;
                                          const isDone = ph.status === "done";
                                          const dateStr = estDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                                          const color = isDone ? "#34d399" : isLate ? "#f87171" : "#f59e0b";
                                          return (
                                            <span style={{ fontSize: "9px", fontWeight: "700", color, background: `${color}12`, border: `1px solid ${color}30`, borderRadius: "999px", padding: "1px 6px", whiteSpace: "nowrap", marginTop: "1px" }}>
                                              {isDone ? "✓" : isLate ? "⚠" : "→"} {dateStr}
                                            </span>
                                          );
                                        })()}
                                          <input
                                            type="number"
                                            defaultValue={avg}
                                            onBlur={e => { try { localStorage.setItem(avgKey, e.target.value); } catch {} }}
                                            onClick={e => e.stopPropagation()}
                                            style={{ width: "52px", fontSize: "11px", fontWeight: "800", color: "#60a5fa", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: "6px", padding: "2px 4px", outline: "none", textAlign: "center", fontFamily: "inherit", letterSpacing: "-0.5px" }}
                                          />
                                          <span style={{ fontSize: "10px", color: "rgba(96,165,250,0.5)", whiteSpace: "nowrap" }}>d</span>
                                        </div>
                                      );
                                    })()}
                                    {isLast && daysIn !== null && ph.status === "in_progress" && (() => {
                                      const avg = PHASE_AVG_DAYS[ph.name] || 14;
                                      const isOverAvg = daysIn > avg;
                                      return (
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                                          <span style={{ fontSize: "9px", fontWeight: "800", color: isOverAvg ? "#f87171" : "#34d399", background: isOverAvg ? "rgba(248,113,113,0.1)" : "rgba(52,211,153,0.08)", border: `1px solid ${isOverAvg ? "rgba(248,113,113,0.3)" : "rgba(52,211,153,0.2)"}`, borderRadius: "999px", padding: "2px 7px", whiteSpace: "nowrap" }}>{isOverAvg ? "⚠ " : "✓ "}{daysIn}d</span>
                                          <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.2)", whiteSpace: "nowrap" }}>avg {avg}d</span>
                                        </div>
                                      );
                                    })()}
                                    <button onClick={() => deletePhase(p, i)} title="Remove phase" style={{ position: "absolute", top: "0px", right: "0px", zIndex: 10, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: "4px", color: "#f87171", cursor: "pointer", fontSize: "11px", lineHeight: 1, padding: "1px 5px", fontWeight: "700" }}>×</button>
                                  </div>
                                  {!isLast && (
                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", marginBottom: "20px", gap: "4px" }}>
                                      <div style={{ width: "100%", height: "2px", background: ph.status === "done" ? "#34d399" : "rgba(255,255,255,0.08)", marginTop: "0px", marginRight: "4px", marginBottom: "0px", marginLeft: "4px" }} />
                                      {daysIn !== null && ph.status === "in_progress" && (() => {
                                        const avg = PHASE_AVG_DAYS[ph.name] || 14;
                                        const isOverAvg = daysIn !== null && daysIn > avg;
                                        return (
                                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                                            <span style={{ fontSize: "9px", fontWeight: "800", color: isOverAvg ? "#f87171" : "#34d399", background: isOverAvg ? "rgba(248,113,113,0.1)" : "rgba(52,211,153,0.08)", border: `1px solid ${isOverAvg ? "rgba(248,113,113,0.3)" : "rgba(52,211,153,0.2)"}`, borderRadius: "999px", padding: "2px 7px", whiteSpace: "nowrap" }}>{isOverAvg ? "⚠ " : "✓ "}{daysIn}d</span>
                                            {avg && <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.2)", whiteSpace: "nowrap" }}>avg {avg}d</span>}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Phase detail list with inline checklist */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {p.phases.map((ph: any, i: number) => {
                            const sc = STATUS_COLORS[ph.status] || STATUS_COLORS.not_started;
                            const checklist: any[] = ph.checklist || (PHASE_CHECKLIST_DEFAULTS[ph.name] || ["Plan", "Execute", "Review"]).map((label: string) => ({ label, done: false }));
                            const doneCount = checklist.filter((c: any) => c.done).length;
                            const allDone = checklist.length > 0 && doneCount === checklist.length;
                            const isInProgress = ph.status === "in_progress";
                            return (
                              <div key={i} style={{ background: "rgba(255,255,255,0.02)", borderRadius: "12px", border: `1px solid ${sc.color}22`, overflow: "hidden" }}>
                                {/* Phase row */}
                                <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "13px 16px" }}>
                                  <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: sc.color, boxShadow: isInProgress ? `0 0 8px ${sc.color}` : "none", flexShrink: 0 }} />
                                  <span style={{ fontSize: "13px", fontWeight: "700", color: sc.color, minWidth: "110px" }}>{ph.name}</span>
                                  <select value={ph.status} onChange={e => updatePhase(p, i, { status: e.target.value })} style={{ fontSize: "10px", background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: "6px", color: sc.color, padding: "3px 8px", cursor: "pointer", fontWeight: "700", outline: "none", fontFamily: "inherit" }}>
                                    {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                  </select>
                                  <input type="date" value={ph.date || ""} onChange={e => updatePhase(p, i, { date: e.target.value })} style={{ fontSize: "13px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", color: "rgba(255,255,255,0.6)", padding: "6px 8px", outline: "none", fontFamily: "inherit" }} />
                                  <input type="text" placeholder="Note..." value={noteValues[`${p.id}_${i}`] ?? ph.note ?? ""} onChange={e => setNoteValues(prev => ({ ...prev, [`${p.id}_${i}`]: e.target.value }))} onBlur={() => saveNote(p, i)} style={{ flex: 1, fontSize: "13px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "6px", color: "rgba(255,255,255,0.6)", padding: "6px 10px", outline: "none", fontFamily: "inherit" }} />
                                  <span style={{ fontSize: "13px", color: allDone ? "#34d399" : doneCount > 0 ? "#f59e0b" : "rgba(255,255,255,0.25)", fontWeight: "700", minWidth: "40px", textAlign: "right" }}>{doneCount}/{checklist.length}</span>
                                  <button onClick={() => deletePhase(p, i)} title="Remove phase" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "5px", color: "#f87171", cursor: "pointer", fontSize: "14px", flexShrink: 0, padding: "2px 7px", fontWeight: "700", lineHeight: 1.4 }}>×</button>
                                </div>

                                {/* Inline checklist — always visible toggle bar, retractable items */}
                                {(() => {
                                  const checklistKey = `cl_${p.id}_${i}`;
                                  const isOpen = isInProgress ? (checklistOpenState[checklistKey] !== false) : (checklistOpenState[checklistKey] === true);
                                  return (
                                    <div style={{ borderTop: `1px solid ${sc.color}22` }}>
                                      {/* Retract toggle bar */}
                                      <button onClick={() => setChecklistOpenState(prev => ({ ...prev, [checklistKey]: !isOpen }))} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", background: "rgba(0,0,0,0.1)", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: "10px", fontWeight: "700", letterSpacing: "0.8px", textTransform: "uppercase" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                          <span style={{ color: allDone ? "#34d399" : isInProgress ? "#f59e0b" : "rgba(255,255,255,0.3)" }}>☑ Checklist</span>
                                          <span style={{ color: allDone ? "#34d399" : doneCount > 0 ? "#f59e0b" : "rgba(255,255,255,0.2)", fontWeight: "800" }}>{doneCount}/{checklist.length}</span>
                                          {/* Mini progress */}
                                          <div style={{ width: "60px", height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "999px", overflow: "hidden" }}>
                                            <div style={{ height: "100%", width: `${checklist.length > 0 ? (doneCount / checklist.length) * 100 : 0}%`, background: allDone ? "#34d399" : "#f59e0b", borderRadius: "999px", transition: "width 0.4s" }} />
                                          </div>
                                        </div>
                                        <span style={{ fontSize: "12px" }}>{isOpen ? "▲" : "▼"}</span>
                                      </button>
                                      {isOpen && (
                                        <div style={{ padding: "10px 16px 14px", background: "rgba(0,0,0,0.12)" }}>
                                          <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "10px" }}>
                                            {checklist.map((item: any, idx: number) => (
                                              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", borderRadius: "8px", background: item.done ? "rgba(52,211,153,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${item.done ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.05)"}` }}>
                                                <input type="checkbox" checked={item.done} onChange={() => { const updated = checklist.map((c: any, ci: number) => ci === idx ? { ...c, done: !c.done } : c); updatePhase(p, i, { checklist: updated }); }} style={{ accentColor: "#34d399", cursor: "pointer", flexShrink: 0 }} />
                                                <input
                                                  type="text"
                                                  value={checklistLabelValues[`${p.id}_${i}_${idx}`] ?? item.label}
                                                  onChange={e => setChecklistLabelValues(prev => ({ ...prev, [`${p.id}_${i}_${idx}`]: e.target.value }))}
                                                  onBlur={() => {
                                                    const key = `${p.id}_${i}_${idx}`;
                                                    const val = checklistLabelValues[key];
                                                    if (val === undefined) return;
                                                    const updated = checklist.map((c: any, ci: number) => ci === idx ? { ...c, label: val } : c);
                                                    updatePhase(p, i, { checklist: updated });
                                                  }}
                                                  style={{ flex: 1, fontSize: "12px", color: item.done ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.75)", textDecoration: item.done ? "line-through" : "none", background: "none", border: "none", outline: "none", fontFamily: "inherit", cursor: "text" }}
                                                />
                                                <button onClick={() => { const updated = checklist.filter((_: any, ci: number) => ci !== idx); updatePhase(p, i, { checklist: updated }); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.15)", cursor: "pointer", fontSize: "14px", flexShrink: 0, padding: "0 2px" }}>×</button>
                                              </div>
                                            ))}
                                          </div>
                                          <div style={{ display: "flex", gap: "6px" }}>
                                            <input type="text" placeholder="Add task..." onKeyDown={e => { if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) { const updated = [...checklist, { label: (e.target as HTMLInputElement).value.trim(), done: false }]; updatePhase(p, i, { checklist: updated }); (e.target as HTMLInputElement).value = ""; } }} style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", padding: "6px 10px", fontSize: "12px", color: "#fff", outline: "none", fontFamily: "inherit" }} />
                                            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", alignSelf: "center" }}>↵ to add</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>

                        {/* Deleted phases restore tray */}
                        {showDeletedPhases[p.id] && (p.deleted_phases || []).length > 0 && (
                          <div style={{ marginTop: "16px", padding: "14px", background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.15)", borderRadius: "12px" }}>
                            <p style={{ fontSize: "10px", color: "#a78bfa", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "10px" }}>🗂 Hidden Phases — click to restore</p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                              {(p.deleted_phases || []).map((dp: any, di: number) => (
                                <button key={di} onClick={() => restorePhase(p, di)} style={{ padding: "5px 14px", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: "8px", color: "#a78bfa", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>+ Restore: {dp.name}</button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {section === "budget" && (
                      <div style={{ padding: "24px" }}>
                        {/* KPI strip */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "20px" }}>
                          {[
                            { label: "Total Budget", value: fmtMoney(p.budget), color: "#a78bfa", sub: "project ceiling" },
                            { label: "Spent", value: fmtMoney(p.spent), color: "#f87171", sub: `${budgetPct.toFixed(1)}% used` },
                            { label: "Remaining", value: fmtMoney(Math.max(0, p.budget - p.spent)), color: p.budget > p.spent ? "#34d399" : "#f87171", sub: p.budget > p.spent ? "on budget" : "over budget ⚠" },
                          ].map(m => (
                            <div key={m.label} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${m.color}22`, borderRadius: "14px", padding: "18px 20px" }}>
                              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px", fontWeight: "600" }}>{m.label}</p>
                              <p style={{ fontSize: "26px", fontWeight: "900", color: m.color, letterSpacing: "-0.5px" }}>{m.value}</p>
                              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "4px" }}>{m.sub}</p>
                            </div>
                          ))}
                        </div>

                        {/* Budget bar */}
                        <div style={{ marginBottom: "20px" }}>
                          <div style={{ height: "10px", background: "rgba(255,255,255,0.05)", borderRadius: "999px", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${budgetPct}%`, background: budgetPct > 90 ? "#f87171" : budgetPct > 70 ? "#f59e0b" : "#34d399", borderRadius: "999px", transition: "width 0.6s", boxShadow: budgetPct > 90 ? "0 0 12px rgba(248,113,113,0.5)" : "0 0 12px rgba(245,158,11,0.4)" }} />
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
                            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>$0</span>
                            <span style={{ fontSize: "10px", color: budgetPct > 90 ? "#f87171" : "#f59e0b", fontWeight: "700" }}>{budgetPct.toFixed(1)}% spent</span>
                            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>{fmtMoney(p.budget)}</span>
                          </div>
                        </div>

                        {/* Log Spend Entry */}
                        <ProjectIntelligence project={p} />
                        <LogSpendEntry project={p} onLog={(entry: any) => {
                          const history = [...(p.budgetHistory || []), entry];
                          const newSpent = p.spent + entry.amount;
                          supabase.from("projects").update({ budget_history: history, spent: newSpent }).eq("id", p.id);
                          setProjects(projects.map(pr => pr.id === p.id ? { ...pr, budgetHistory: history, spent: newSpent } : pr));
                        }} team={p.team} trades={p.trades || []} />

                        {/* Trade Breakdown */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", marginTop: "24px" }}>
                          <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700" }}>Trade Breakdown <span style={{ color: "rgba(255,255,255,0.2)", textTransform: "none", letterSpacing: "0", fontWeight: "400" }}>· quoted vs actual · press Enter to save</span></p>
                          <button onClick={() => { const newTrades = [...(p.trades || []), { name: "New Trade", quoted: 0, actual: 0, assignedTo: "" }]; updateTrades(p, newTrades); }} style={{ fontSize: "11px", padding: "5px 12px", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: "6px", color: "#a78bfa", cursor: "pointer", fontWeight: "700" }}>+ Add Trade</button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "10px" }}>
                          {(p.trades && p.trades.length > 0 ? p.trades : TRADE_CATEGORIES.slice(0, 6).map((name: string) => ({ name, quoted: 0, actual: 0, assignedTo: "" }))).map((trade: any, ti: number) => {
                            const trades = p.trades && p.trades.length > 0 ? p.trades : TRADE_CATEGORIES.slice(0, 6).map((n: string) => ({ name: n, quoted: 0, actual: 0, assignedTo: "" }));
                            const over = trade.actual > trade.quoted && trade.quoted > 0;
                            const tradeColor = over ? "#f87171" : trade.actual > 0 ? "#34d399" : "rgba(255,255,255,0.3)";
                            return (
                              <TradeCard
                                key={ti}
                                trade={trade}
                                index={ti}
                                tradeColor={tradeColor}
                                over={over}
                                team={p.team}
onUpdate={async (updated: any) => { const t = [...trades]; t[ti] = updated; await updateTrades(p, t); }}                                onDelete={() => { const t = trades.filter((_: any, i: number) => i !== ti); updateTrades(p, t); }}
                                fmtMoney={fmtMoney}
                                onLog={async (entry: any) => {
                                  const history = [...(p.budgetHistory || []), entry];
                                  const newSpent = p.spent + entry.amount;
                                  await supabase.from("projects").update({ budget_history: history, spent: newSpent }).eq("id", p.id);
                                  setProjects(prev => prev.map(pr => pr.id === p.id ? { ...pr, budgetHistory: history, spent: newSpent } : pr));
                                }}
                              />
                            );
                          })}
                        </div>

                        {p.trades && p.trades.length > 0 && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginTop: "12px", padding: "14px 18px", background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.15)", borderRadius: "12px" }}>
                            <div>
                              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "2px", letterSpacing: "1px", textTransform: "uppercase" }}>Contractors Quoted</p>
                              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginBottom: "6px" }}>what trades estimated</p>
                              <p style={{ fontSize: "20px", fontWeight: "900", color: "#f59e0b" }}>{fmtMoney(p.trades.reduce((s: number, t: any) => s + (t.quoted || 0), 0))}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "2px", letterSpacing: "1px", textTransform: "uppercase" }}>Contractors Actual</p>
                              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginBottom: "6px" }}>final trade invoices</p>
                              <p style={{ fontSize: "20px", fontWeight: "900", color: "#f87171" }}>{fmtMoney(p.trades.reduce((s: number, t: any) => s + (t.actual || 0), 0))}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "2px", letterSpacing: "1px", textTransform: "uppercase" }}>Total Spent</p>
                              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginBottom: "6px" }}>all payments logged</p>
                              <p style={{ fontSize: "20px", fontWeight: "900", color: "#34d399" }}>{fmtMoney(p.spent)}</p>
                            </div>
                          </div>
                        )}

                        {p.budgetHistory && p.budgetHistory.length > 0 && (
                          <div style={{ marginTop: "24px" }}>
                            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700", marginBottom: "10px" }}>📋 Spend History</p>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              {[...(p.budgetHistory || [])].reverse().map((entry: any, ei: number) => (
                                <div key={ei} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "10px", flexWrap: "wrap", gap: "8px" }}>
                                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                                    <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{entry.date}</span>
                                    {entry.trade && <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "999px", background: "rgba(167,139,250,0.1)", color: "#a78bfa", fontWeight: "700" }}>{entry.trade}</span>}
                                    {entry.enteredBy && <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>by {entry.enteredBy}</span>}
                                    {entry.note && <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>{entry.note}</span>}
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <span style={{ fontSize: "14px", fontWeight: "800", color: "#f87171" }}>-{fmtMoney(entry.amount)}</span>
                                    <button onClick={() => {
                                      const original = [...(p.budgetHistory || [])];
                                      original.reverse();
                                      original.splice(ei, 1);
                                      original.reverse();
                                      supabase.from("projects").update({ budget_history: original }).eq("id", p.id);
                                      setProjects(projects.map(pr => pr.id === p.id ? { ...pr, budgetHistory: original } : pr));
                                    }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "16px", padding: "0 4px" }} title="Delete entry">×</button>
                                  </div>
                                </div>
                              ))}

                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* ACTIVITY LOG */}
                    {section === "activity" && (
                      <ActivityLog project={p} />
                    )}

                    {/* TEAM */}
                    {section === "team" && (
                      <div style={{ padding: "24px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                          <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1px", textTransform: "uppercase", fontWeight: "600" }}>Team & Intervenants</p>
                          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>Share link → member sees only their info</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                          {p.team.length === 0 && <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)", textAlign: "center", padding: "16px" }}>No team members added yet.</p>}
                          {p.team.map((member: any, i: number) => {
                            const assignedTrades = (p.trades || []).filter((t: any) => t.assignedTo === member.name);
                            const linkKey = `${p.id}_${i}`;
                            return (
                              <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(167,139,250,0.15)", borderRadius: "14px", overflow: "hidden" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px" }}>
                                  <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "800", color: "#a78bfa", flexShrink: 0 }}>{(member.name?.[0] || "?").toUpperCase()}</div>
                                  <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: "14px", fontWeight: "800" }}>{member.name}</p>
                                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>{member.role}{member.contact ? ` · ${member.contact}` : ""}</p>
                                    {assignedTrades.length > 0 && <p style={{ fontSize: "10px", color: "#a78bfa", marginTop: "3px" }}>📋 {assignedTrades.map((t: any) => t.name).join(", ")}</p>}
                                  </div>
                                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                    <button onClick={() => copyMemberLink(p, i)} style={{ fontSize: "11px", padding: "6px 12px", background: copiedLink === linkKey ? "rgba(52,211,153,0.15)" : "rgba(167,139,250,0.1)", border: `1px solid ${copiedLink === linkKey ? "rgba(52,211,153,0.3)" : "rgba(167,139,250,0.25)"}`, borderRadius: "8px", color: copiedLink === linkKey ? "#34d399" : "#a78bfa", cursor: "pointer", fontWeight: "700", whiteSpace: "nowrap" }}>{copiedLink === linkKey ? "✓ Copied!" : "🔗 Share Link"}</button>
                                    <button onClick={() => { const t = p.team.filter((_: any, j: number) => j !== i); updateTeam(p, t); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "18px" }}>×</button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <AddTeamMember roles={TEAM_ROLES} onAdd={(member: any) => updateTeam(p, [...p.team, member])} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* Project delete confirmation */}
      {confirmProjectDelete !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: "20px" }}>
          <div style={{ background: "#0f0f0f", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "20px", padding: "36px", width: "100%", maxWidth: "380px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "16px" }}>🗑️</div>
            <h3 style={{ fontSize: "16px", fontWeight: "800", marginBottom: "8px" }}>Delete Project?</h3>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "8px", lineHeight: "1.5" }}>This will permanently delete <span style={{ color: "#fff", fontWeight: "700" }}>{projects.find(pr => pr.id === confirmProjectDelete)?.name}</span> and all its data.</p>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", marginBottom: "28px" }}>This cannot be undone.</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setConfirmProjectDelete(null)} style={{ flex: 1, padding: "12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "13px", color: "rgba(255,255,255,0.4)", background: "none", cursor: "pointer", fontWeight: "600" }}>Cancel</button>
              <button onClick={async () => { await deleteProject(confirmProjectDelete!); setConfirmProjectDelete(null); }} style={{ flex: 1, padding: "12px", background: "#ef4444", color: "#fff", borderRadius: "10px", fontSize: "13px", fontWeight: "800", border: "none", cursor: "pointer" }}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
      {/* Phase delete confirmation */}
      {confirmPhaseDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: "20px" }}>
          <div style={{ background: "#0f0f0f", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "20px", padding: "36px", width: "100%", maxWidth: "380px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "16px" }}>⚠️</div>
            <h3 style={{ fontSize: "16px", fontWeight: "800", marginBottom: "8px" }}>Remove Phase?</h3>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "8px", lineHeight: "1.5" }}><span style={{ color: "#fff", fontWeight: "700" }}>{confirmPhaseDelete.phaseName}</span> has data (notes, dates, or checklist progress).</p>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", marginBottom: "28px" }}>It will be moved to hidden phases and can be restored anytime.</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setConfirmPhaseDelete(null)} style={{ flex: 1, padding: "12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "13px", color: "rgba(255,255,255,0.4)", background: "none", cursor: "pointer", fontWeight: "600" }}>Cancel</button>
              <button onClick={() => { const proj = projects.find(pr => pr.id === confirmPhaseDelete!.projectId); if (proj) doDeletePhase(proj, confirmPhaseDelete!.phaseIdx); }} style={{ flex: 1, padding: "12px", background: "#f87171", color: "#fff", borderRadius: "10px", fontSize: "13px", fontWeight: "800", border: "none", cursor: "pointer" }}>Yes, Hide It</button>
            </div>
          </div>
        </div>
      )}

      {/* Project complete popup */}
      {projectComplete !== null && (() => { const proj = projects.find(pr => pr.id === projectComplete); if (!proj) return null; return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: "20px" }}>
          <div style={{ background: "#0a0a0a", border: "1px solid rgba(52,211,153,0.3)", borderRadius: "28px", padding: "48px 40px", maxWidth: "500px", width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: "56px", marginBottom: "16px" }}>🎉</div>
            <p style={{ fontSize: "11px", color: "#34d399", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "10px" }}>Project Complete</p>
            <h2 style={{ fontSize: "24px", fontWeight: "900", marginBottom: "8px" }}>{proj.name}</h2>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", marginBottom: "28px" }}>All phases done. Would you like to add this property to your portfolio?</p>
            {!addPropertyForm ? (
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => setProjectComplete(null)} style={{ flex: 1, padding: "12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "13px", color: "rgba(255,255,255,0.4)", background: "none", cursor: "pointer", fontWeight: "600" }}>Not Now</button>
                <button onClick={() => setAddPropertyForm({ name: proj.name, address: proj.address || "", equity: "" })} style={{ flex: 1, padding: "12px", background: "#34d399", color: "#000", borderRadius: "10px", fontSize: "13px", fontWeight: "800", border: "none", cursor: "pointer" }}>Yes, Add to Portfolio →</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", textAlign: "left" }}>
                <div><label style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: "6px", fontWeight: "600" }}>Property Name</label><input type="text" value={addPropertyForm.name} onChange={e => setAddPropertyForm({ ...addPropertyForm, name: e.target.value })} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "10px 14px", fontSize: "14px", color: "#fff", outline: "none", fontFamily: "inherit" }} /></div>
                <div><label style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: "6px", fontWeight: "600" }}>Address</label><input type="text" value={addPropertyForm.address} onChange={e => setAddPropertyForm({ ...addPropertyForm, address: e.target.value })} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "10px 14px", fontSize: "14px", color: "#fff", outline: "none", fontFamily: "inherit" }} /></div>
                <div><label style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: "4px", fontWeight: "600" }}>Your Equity ($)</label><p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginBottom: "6px" }}>Equity = property value minus what you owe (mortgage). This is your net ownership stake.</p><input type="number" placeholder="e.g. 80000" value={addPropertyForm.equity} onChange={e => setAddPropertyForm({ ...addPropertyForm, equity: e.target.value })} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: "10px", padding: "10px 14px", fontSize: "14px", color: "#34d399", outline: "none", fontFamily: "inherit", fontWeight: "800" }} /></div>
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", textAlign: "center" }}>You'll fill in value, mortgage, rent & expenses in the Portfolio tab after adding.</p>
                <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                  <button onClick={() => setAddPropertyForm(null)} style={{ flex: 1, padding: "12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "13px", color: "rgba(255,255,255,0.4)", background: "none", cursor: "pointer", fontWeight: "600" }}>← Back</button>
                  <button onClick={async () => {
                    if (!addPropertyForm) return;
                    const proj = projects.find(pr => pr.id === projectComplete);
                    const equity = parseFloat(addPropertyForm.equity) || 0;
                    let lat = 29.7604; let lng = -95.3698;
                    try {
                      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addPropertyForm.address)}&limit=1`, { headers: { "Accept-Language": "en" } });
                      const geo = await res.json();
                      if (geo?.[0]) { lat = parseFloat(geo[0].lat); lng = parseFloat(geo[0].lon); }
                    } catch {}
                    const newId = Date.now();
                    const newProp = { id: newId, name: addPropertyForm.name, type: proj?.type || "Single Family", value: equity, mortgage: 0, rent: 0, expenses: 0, occupancy_status: "vacant", planned_date: "", appreciation: 3.5, address: addPropertyForm.address, lat, lng, user_id: user.id };
                    await supabase.from("properties").insert(newProp);
                    await supabase.from("notifications").insert({ user_id: user.id, type: "project_complete", title: "🎉 Project Complete", message: `${addPropertyForm.name} has been added to your portfolio. Fill in value, mortgage & rent to activate tracking.`, read: false });
                    setProjectComplete(null);
                    setAddPropertyForm(null);
                  }} style={{ flex: 1, padding: "12px", background: "#34d399", color: "#000", borderRadius: "10px", fontSize: "13px", fontWeight: "800", border: "none", cursor: "pointer" }}>Save & Add to Portfolio →</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ); })()}

      {/* Add/Edit Project Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 50, padding: "80px 20px 20px" }}>
          <div style={{ background: "#0f0f0f", border: "1px solid rgba(167,139,250,0.2)", borderRadius: "24px", padding: "36px", width: "100%", maxWidth: "500px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: "800" }}>{editingId !== null ? "Edit Project" : "New Project"}</h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "22px" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <Field label="Project Name"><input type="text" placeholder="e.g. 14 Maple Street Renovation" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={IS} /></Field>
              <Field label="Project Type">
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={IS}>
                  {PROJECT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Address"><input type="text" placeholder="e.g. 14 Maple Street, Houston TX" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} style={IS} /></Field>
              <Field label="Total Budget ($)"><NumberInput value={form.budget} onChange={v => setForm({ ...form, budget: v })} placeholder="150,000" style={IS} /></Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Start Date"><input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} style={IS} /></Field>
                <Field label="End Date"><input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} style={IS} /></Field>
              </div>
              <Field label="Notes (optional)"><textarea placeholder="Project details, objectives, special requirements..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...IS, height: "80px", resize: "vertical" }} /></Field>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} style={{ flex: 1, padding: "12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "13px", color: "rgba(255,255,255,0.4)", background: "none", cursor: "pointer", fontWeight: "600" }}>Cancel</button>
              <button onClick={handleSave} style={{ flex: 1, padding: "12px", background: "#a78bfa", color: "#000", borderRadius: "10px", fontSize: "13px", fontWeight: "800", border: "none", cursor: "pointer" }}>{editingId !== null ? "Save Changes" : "Create Project"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
const PHASE_CHECKLIST_DEFAULTS: Record<string, string[]> = {
  "Planning":     ["Define scope & objectives", "Set budget envelope", "Identify key stakeholders", "Create project schedule"],
  "Permits":      ["Submit permit application", "Pay permit fees", "Schedule inspections", "Receive permit approval"],
  "Demo":         ["Disconnect utilities", "Protect adjacent structures", "Complete demolition", "Remove debris & dispose"],
  "Foundation":   ["Excavation complete", "Footings poured", "Foundation walls complete", "Waterproofing applied"],
  "Framing":      ["Floor system complete", "Wall framing complete", "Roof framing complete", "Framing inspection passed"],
  "MEP":          ["Rough plumbing complete", "Rough electrical complete", "HVAC rough-in complete", "MEP inspection passed"],
  "Plumbing":     ["Rough-in complete", "Pressure test passed", "Fixtures installed", "Final inspection"],
  "Electrical":   ["Panel installed", "Rough wiring complete", "Outlets & switches installed", "Final inspection passed"],
  "HVAC":         ["Ductwork installed", "Unit installed", "System tested & balanced", "Inspection passed"],
  "Insulation":   ["Wall insulation complete", "Ceiling insulation complete", "Inspection passed"],
  "Drywall":      ["Drywall hung", "Taped & mudded", "Sanded & primed", "Ready for paint"],
  "Finishing":    ["Paint complete", "Trim & molding installed", "Hardware installed", "Final walkthrough"],
  "Flooring":     ["Subfloor prepared", "Flooring installed", "Transitions complete", "Final clean"],
  "Inspection":   ["Schedule final inspection", "Punch list complete", "Inspector sign-off", "Certificate of occupancy"],
  "Delivery":     ["Final walkthrough with client", "Deficiency list resolved", "Keys handed over", "Project closed"],
  "Staging":      ["Furniture sourced", "Staging complete", "Photos taken", "Ready for listing"],
  "Listing":      ["MLS listing live", "Showings scheduled", "Offers reviewed"],
  "Closing":      ["Title search complete", "Final walkthrough", "Documents signed", "Funds transferred"],
  "Assessment":   ["Structural assessment", "Systems assessment", "Cost estimate", "Report delivered"],
  "Structural":   ["Engineer sign-off", "Structural work complete", "Inspection passed"],
  "Systems":      ["Plumbing upgraded", "Electrical upgraded", "HVAC upgraded", "Systems test passed"],
  "Certificate":  ["Final inspection", "Certificate issued", "Occupancy confirmed"],
  "Design":       ["Schematic design approved", "Design development complete", "Construction docs issued"],
  "Feasibility":  ["Market analysis complete", "Financial model approved", "Go/no-go decision made"],
  "Fit-Out":      ["Partitions installed", "Finishes complete", "FF&E installed", "Commissioning done"],
  "Opening":      ["Staff trained", "Soft opening complete", "Grand opening done"],
  "Acquisition":  ["Due diligence complete", "Financing secured", "Closing complete"],
  "Structure":    ["Structure complete", "Engineer certified", "Inspection passed"],
  "Residential":  ["Units complete", "Fixtures installed", "Ready for occupancy"],
  "Commercial":   ["Shell complete", "Fit-out ready", "Tenant handover"],
  "Handover":     ["Deficiency list cleared", "O&M manuals delivered", "Keys handed over"],
};
function ActivityLog({ project }: { project: any }) {
  const events: any[] = [];

  // From spend history
  (project.budgetHistory || []).forEach((entry: any) => {
    events.push({
      type: "spend",
      color: "#f87171",
      icon: "💸",
      label: `Spend logged — ${entry.trade || "General"}`,
      detail: `${entry.note ? entry.note + " · " : ""}$${Math.abs(entry.amount).toLocaleString("en-US")}${entry.enteredBy ? ` · by ${entry.enteredBy}` : ""}`,
      date: entry.date || "—",
      ts: entry.date || "",
    });
  });

  // From phases
  (project.phases || []).forEach((ph: any) => {
    if (ph.status !== "not_started") {
      events.push({
        type: "phase",
        color: ph.status === "done" ? "#34d399" : ph.status === "delayed" ? "#f87171" : "#f59e0b",
        icon: ph.status === "done" ? "✅" : ph.status === "delayed" ? "🔴" : "🟡",
        label: `${ph.name} → ${ph.status.replace("_", " ").toUpperCase()}`,
        detail: ph.note || "",
        date: ph.date || "—",
        ts: ph.date || "",
      });
    }
    // Checklist completions
    const checklist = ph.checklist || [];
    const doneItems = checklist.filter((c: any) => c.done);
    if (doneItems.length > 0 && doneItems.length === checklist.length) {
      events.push({
        type: "checklist",
        color: "#34d399",
        icon: "🟢",
        label: `${ph.name} checklist complete`,
        detail: `All ${checklist.length} items checked off`,
        date: ph.date || "—",
        ts: ph.date || "",
      });
    }
  });

  // From team
  (project.team || []).forEach((member: any) => {
    events.push({
      type: "team",
      color: "#a78bfa",
      icon: "🟣",
      label: `${member.name} added to team`,
      detail: `${member.role}${member.contact ? " · " + member.contact : ""}`,
      date: "—",
      ts: "",
    });
  });

  // Sort: entries with real dates first, then undated
  events.sort((a, b) => {
    if (!a.ts && !b.ts) return 0;
    if (!a.ts) return 1;
    if (!b.ts) return -1;
    return new Date(b.ts).getTime() - new Date(a.ts).getTime();
  });

  return (
    <div style={{ padding: "24px" }}>
      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1px", textTransform: "uppercase", fontWeight: "600", marginBottom: "20px" }}>
        Activity Log <span style={{ color: "rgba(255,255,255,0.15)", textTransform: "none", letterSpacing: "0", fontWeight: "400" }}>· auto-generated from all project actions</span>
      </p>

      {events.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", border: "1px dashed rgba(255,255,255,0.06)", borderRadius: "12px" }}>
          <p style={{ fontSize: "24px", marginBottom: "10px" }}>📋</p>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.2)" }}>No activity yet. Start logging spend or updating phases.</p>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          {/* Vertical line */}
          <div style={{ position: "absolute", left: "19px", top: "8px", bottom: "8px", width: "2px", background: "rgba(255,255,255,0.06)", borderRadius: "999px" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {events.map((ev, i) => (
              <div key={i} style={{ display: "flex", gap: "16px", alignItems: "flex-start", paddingBottom: "16px" }}>
                {/* Dot */}
                <div style={{ width: "40px", flexShrink: 0, display: "flex", justifyContent: "center", paddingTop: "2px", position: "relative", zIndex: 1 }}>
                  <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: ev.color, boxShadow: `0 0 8px ${ev.color}66`, border: "2px solid #0f0f0f", display: "flex", alignItems: "center", justifyContent: "center" }} />
                </div>
                {/* Content */}
                <div style={{ flex: 1, background: "rgba(255,255,255,0.02)", border: `1px solid ${ev.color}22`, borderRadius: "12px", padding: "12px 14px", marginTop: "-2px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", flexWrap: "wrap" }}>
                    <div>
                      <p style={{ fontSize: "12px", fontWeight: "700", color: "#fff", marginBottom: "3px" }}>
                        <span style={{ marginRight: "6px" }}>{ev.icon}</span>{ev.label}
                      </p>
                      {ev.detail && <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", lineHeight: "1.4" }}>{ev.detail}</p>}
                    </div>
                    <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", whiteSpace: "nowrap", flexShrink: 0, fontWeight: "600" }}>{ev.date}</span>
                  </div>
                  <div style={{ display: "flex", marginTop: "8px" }}>
                    <span style={{ fontSize: "9px", fontWeight: "700", padding: "2px 8px", borderRadius: "999px", background: `${ev.color}15`, color: ev.color, textTransform: "uppercase", letterSpacing: "0.8px" }}>{ev.type}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function PhaseChecklist({ phase, onUpdate }: { phase: any; onUpdate: (checklist: any[]) => void }) {
  const [open, setOpen] = useState(false);
  const [newItem, setNewItem] = useState("");
  const checklist: any[] = phase.checklist || PHASE_CHECKLIST_DEFAULTS[phase.name]?.map(label => ({ label, done: false })) || [];
  const doneCount = checklist.filter(c => c.done).length;
  const allDone = checklist.length > 0 && doneCount === checklist.length;

  function toggle(idx: number) {
    const updated = checklist.map((c, i) => i === idx ? { ...c, done: !c.done } : c);
    onUpdate(updated);
  }
  function addItem() {
    if (!newItem.trim()) return;
    onUpdate([...checklist, { label: newItem.trim(), done: false }]);
    setNewItem("");
  }
  function removeItem(idx: number) {
    onUpdate(checklist.filter((_, i) => i !== idx));
  }

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} title="Phase Checklist" style={{ padding: "4px 10px", background: allDone ? "rgba(52,211,153,0.15)" : doneCount > 0 ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.05)", border: `1px solid ${allDone ? "rgba(52,211,153,0.3)" : doneCount > 0 ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.1)"}`, borderRadius: "6px", color: allDone ? "#34d399" : doneCount > 0 ? "#f59e0b" : "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "10px", fontWeight: "700", whiteSpace: "nowrap" }}>
        {allDone ? "✓" : `${doneCount}/${checklist.length}`} ☑
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "32px", zIndex: 50, width: "280px", background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "14px", padding: "14px", boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <p style={{ fontSize: "11px", fontWeight: "800", color: "#fff" }}>{phase.name} Checklist</p>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "10px", color: allDone ? "#34d399" : "rgba(255,255,255,0.3)", fontWeight: "700" }}>{doneCount}/{checklist.length}</span>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "16px", lineHeight: 1 }}>×</button>
            </div>
          </div>
          <div style={{ height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "999px", marginBottom: "10px" }}>
            <div style={{ height: "100%", width: `${checklist.length > 0 ? (doneCount / checklist.length) * 100 : 0}%`, background: allDone ? "#34d399" : "#f59e0b", borderRadius: "999px", transition: "width 0.4s" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "220px", overflowY: "auto", marginBottom: "10px" }}>
            {checklist.map((item, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px", borderRadius: "8px", background: item.done ? "rgba(52,211,153,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${item.done ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.05)"}` }}>
                <input type="checkbox" checked={item.done} onChange={() => toggle(idx)} style={{ accentColor: "#34d399", cursor: "pointer", flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: "11px", color: item.done ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)", textDecoration: item.done ? "line-through" : "none" }}>{item.label}</span>
                <button onClick={() => removeItem(idx)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.15)", cursor: "pointer", fontSize: "14px", flexShrink: 0, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <input type="text" placeholder="Add custom item..." value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem()} style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "7px", padding: "7px 10px", fontSize: "11px", color: "#fff", outline: "none", fontFamily: "inherit" }} />
            <button onClick={addItem} style={{ padding: "7px 12px", background: "#a78bfa", color: "#000", borderRadius: "7px", fontWeight: "800", fontSize: "11px", border: "none", cursor: "pointer" }}>+</button>
          </div>
        </div>
      )}
    </div>
  );
}
function WarChestColumn({ userId, totalEquity }: { userId: string | undefined; totalEquity: number }) {
  const [warChest, setWarChest] = useState(0);
  const [equityPct, setEquityPct] = useState(20);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");

  useEffect(() => {
    if (!userId) return;
    supabase.from("user_settings").select("war_chest, equity_pct").eq("user_id", userId).single()
      .then(({ data }) => { if (data) { setWarChest(data.war_chest||0); setEquityPct(data.equity_pct||20); } });
  }, [userId]);

  async function save(wc: number, ep: number) {
    if (!userId) return;
    await supabase.from("user_settings").upsert({ user_id: userId, war_chest: wc, equity_pct: ep, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  }

  function fmtM(n: number) { if (n>=1_000_000) return "$"+(n/1_000_000).toFixed(2)+"M"; if (n>=1_000) return "$"+Math.round(n).toLocaleString("en-US"); return "$"+n.toFixed(0); }
  const autoCash = Math.round((totalEquity/100)*equityPct);
  const total = warChest + autoCash;

  return (
    <div style={{ padding: "22px 20px", position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{ fontSize: "8px", color: "rgba(52,211,153,0.6)", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "800" }}>💰 War Chest</span>
        <button onClick={() => setEditing(!editing)} style={{ fontSize: "9px", padding: "2px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontWeight: "600" }}>✎</button>
      </div>
      <div style={{ fontSize: "22px", fontWeight: "900", color: "#34d399", letterSpacing: "-1px", lineHeight: 1, marginBottom: "7px" }}>{fmtM(total)}</div>
      <div style={{ display: "flex", gap: "8px", marginBottom: editing ? "10px" : "0" }}>
        <div style={{ flex: 1, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.12)", borderRadius: "8px", padding: "6px 8px" }}>
          <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.2)", marginBottom: "2px" }}>LIQUID</div>
          <div style={{ fontSize: "13px", fontWeight: "800", color: "#34d399" }}>{fmtM(warChest)}</div>
        </div>
        <div style={{ flex: 1, background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.12)", borderRadius: "8px", padding: "6px 8px" }}>
          <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.2)", marginBottom: "2px" }}>EQUITY {equityPct}%</div>
          <div style={{ fontSize: "13px", fontWeight: "800", color: "#60a5fa" }}>{fmtM(autoCash)}</div>
        </div>
      </div>
      {editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <input type="number" placeholder="Cash in bank" value={inputVal} onChange={e => setInputVal(e.target.value)} style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: "6px", padding: "6px 8px", fontSize: "12px", fontWeight: "800", color: "#34d399", outline: "none", fontFamily: "inherit" }} />
            <button onClick={() => { const v=parseFloat(inputVal)||0; setWarChest(v); save(v,equityPct); setInputVal(""); }} style={{ padding: "6px 10px", background: "#34d399", color: "#000", borderRadius: "6px", fontWeight: "800", fontSize: "11px", border: "none", cursor: "pointer" }}>Set</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input type="range" min="0" max="100" step="5" value={equityPct} onChange={e => { const v=parseInt(e.target.value); setEquityPct(v); save(warChest,v); }} style={{ flex: 1, accentColor: "#60a5fa" }} />
            <span style={{ fontSize: "11px", fontWeight: "800", color: "#60a5fa", minWidth: "28px" }}>{equityPct}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
function WarChestStrip({ userId, totalEquity }: { userId: string | undefined; totalEquity: number }) {
  const [warChest, setWarChest] = useState(0);
  const [equityPct, setEquityPct] = useState(20);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");

  useEffect(() => {
    if (!userId) return;
    supabase.from("user_settings").select("war_chest, equity_pct").eq("user_id", userId).single()
      .then(({ data }) => {
        if (data) { setWarChest(data.war_chest || 0); setEquityPct(data.equity_pct || 20); }
      });
  }, [userId]);

  async function save(wc: number, ep: number) {
    if (!userId) return;
    await supabase.from("user_settings").upsert({ user_id: userId, war_chest: wc, equity_pct: ep, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  }

  function fmtM(n: number) { if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M"; if (n >= 1_000) return "$" + Math.round(n).toLocaleString("en-US"); return "$" + n.toFixed(0); }

  const autoCash = Math.round((totalEquity / 100) * equityPct);
  const total = warChest + autoCash;

  return (
    <div style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.15)", borderRadius: "12px", padding: "10px 16px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "9px", color: "rgba(52,211,153,0.6)", letterSpacing: "2px", fontWeight: "800", textTransform: "uppercase", flexShrink: 0 }}>💰 War Chest</span>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", fontWeight: "600", alignSelf: "center" }}>TOTAL</span>
            <span style={{ fontSize: "16px", fontWeight: "900", color: "#34d399", letterSpacing: "-0.5px" }}>{fmtM(total)}</span>
          </div>
          <div style={{ width: "1px", background: "rgba(255,255,255,0.06)", alignSelf: "stretch" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.2)", fontWeight: "600", letterSpacing: "0.5px" }}>LIQUID</span>
            <span style={{ fontSize: "13px", fontWeight: "800", color: "#34d399" }}>{fmtM(warChest)}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.2)", fontWeight: "600", letterSpacing: "0.5px" }}>FROM EQUITY</span>
            <span style={{ fontSize: "13px", fontWeight: "800", color: "#60a5fa" }}>{fmtM(autoCash)}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.2)", fontWeight: "600", letterSpacing: "0.5px" }}>EQUITY %</span>
            <span style={{ fontSize: "13px", fontWeight: "800", color: "#a78bfa" }}>{equityPct}%</span>
          </div>
        </div>
      </div>
      <button onClick={() => setEditing(!editing)} style={{ fontSize: "10px", padding: "4px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontWeight: "600", flexShrink: 0 }}>✎</button>
      {editing && (
        <div style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: "4px" }}>
          <div>
            <p style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", letterSpacing: "1px", textTransform: "uppercase" }}>Cash in Bank ($)</p>
            <div style={{ display: "flex", gap: "6px" }}>
              <input type="number" placeholder={String(warChest)} value={inputVal} onChange={e => setInputVal(e.target.value)} style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: "6px", padding: "7px 10px", fontSize: "13px", fontWeight: "800", color: "#34d399", outline: "none", fontFamily: "inherit" }} />
              <button onClick={() => { const v = parseFloat(inputVal) || 0; setWarChest(v); save(v, equityPct); setInputVal(""); setEditing(false); }} style={{ padding: "7px 12px", background: "#34d399", color: "#000", borderRadius: "6px", fontWeight: "800", fontSize: "11px", border: "none", cursor: "pointer" }}>Set</button>
            </div>
          </div>
          <div>
            <p style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", letterSpacing: "1px", textTransform: "uppercase" }}>Deployable Equity — {equityPct}%</p>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input type="range" min="0" max="100" step="5" value={equityPct} onChange={e => { const v = parseInt(e.target.value); setEquityPct(v); save(warChest, v); }} style={{ flex: 1, accentColor: "#60a5fa" }} />
              <span style={{ fontSize: "13px", fontWeight: "800", color: "#60a5fa", minWidth: "32px" }}>{equityPct}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CommandBoard({ projects, userId, totalEquity }: { projects: any[]; userId?: string; totalEquity: number }) {
  const [warChest, setWarChest] = useState(0);
  const [equityPct, setEquityPct] = useState(20);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");

  const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0);
  const totalSpent = projects.reduce((s, p) => s + (p.spent || 0), 0);
  const activeProjects = projects.filter(p => p.phases?.some((ph: any) => ph.status === "in_progress"));

  useEffect(() => {
    if (!userId) return;
    supabase.from("user_settings").select("war_chest, equity_pct").eq("user_id", userId).single()
      .then(({ data }) => { if (data) { setWarChest(data.war_chest || 0); setEquityPct(data.equity_pct || 20); } });
  }, [userId]);

  async function save(wc: number, ep: number) {
    if (!userId) return;
    await supabase.from("user_settings").upsert({ user_id: userId, war_chest: wc, equity_pct: ep, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  }

  function fmtM(n: number) { if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M"; if (n >= 1_000) return "$" + Math.round(n).toLocaleString("en-US"); return "$" + n.toFixed(0); }

  const autoCash = Math.round((totalEquity / 100) * equityPct);
  const total = warChest + autoCash;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1.4fr", background: "rgba(0,0,0,0.25)", borderRadius: "14px", overflow: "hidden", border: "1px solid rgba(167,139,250,0.12)", marginBottom: "20px" }}>
      <div style={{ padding: "18px 22px", borderRight: "1px solid rgba(167,139,250,0.1)", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: "3px", height: "100%", background: "linear-gradient(180deg, #a78bfa, transparent)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
          <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#a78bfa", boxShadow: "0 0 6px #a78bfa", animation: "blink 2s infinite" }} />
          <span style={{ fontSize: "8px", color: "rgba(167,139,250,0.6)", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "800" }}>Total Budget</span>
        </div>
        <div style={{ fontSize: "30px", fontWeight: "900", color: "#fff", letterSpacing: "-1.5px", lineHeight: 1, marginBottom: "6px" }}>{fmtM(totalBudget)}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>across</span>
          <span style={{ fontSize: "11px", fontWeight: "800", color: "#a78bfa" }}>{projects.length}</span>
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>projects</span>
          <span style={{ fontSize: "10px", color: "#a78bfa", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: "999px", padding: "1px 7px", fontWeight: "700" }}>{activeProjects.length} active</span>
        </div>
      </div>
      <div style={{ padding: "18px 16px", borderRight: "1px solid rgba(255,255,255,0.04)" }}>
        <span style={{ fontSize: "8px", color: "rgba(248,113,113,0.5)", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "800", display: "block", marginBottom: "8px" }}>Deployed</span>
        <div style={{ fontSize: "20px", fontWeight: "900", color: "#f87171", letterSpacing: "-0.5px", lineHeight: 1, marginBottom: "6px" }}>{fmtM(totalSpent)}</div>
        <div style={{ height: "3px", background: "rgba(255,255,255,0.05)", borderRadius: "999px", marginBottom: "5px" }}>
          <div style={{ height: "100%", width: `${totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0}%`, background: "linear-gradient(90deg, #f87171aa, #f87171)", borderRadius: "999px", boxShadow: "0 0 6px rgba(248,113,113,0.4)", minWidth: totalSpent > 0 ? "4px" : "0" }} />
        </div>
        <span style={{ fontSize: "10px", color: "rgba(248,113,113,0.5)", fontWeight: "700" }}>{totalBudget > 0 ? `${((totalSpent / totalBudget) * 100).toFixed(1)}%` : "—"}</span>
      </div>
      <div style={{ padding: "18px 16px", borderRight: "1px solid rgba(255,255,255,0.04)" }}>
        <span style={{ fontSize: "8px", color: totalBudget > totalSpent ? "rgba(52,211,153,0.5)" : "rgba(248,113,113,0.5)", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "800", display: "block", marginBottom: "8px" }}>Remaining</span>
        <div style={{ fontSize: "20px", fontWeight: "900", color: totalBudget > totalSpent ? "#34d399" : "#f87171", letterSpacing: "-0.5px", lineHeight: 1, marginBottom: "6px" }}>{fmtM(Math.max(0, totalBudget - totalSpent))}</div>
        <div style={{ height: "3px", background: "rgba(255,255,255,0.05)", borderRadius: "999px", marginBottom: "5px" }}>
          <div style={{ height: "100%", width: `${totalBudget > 0 ? Math.min(100, ((totalBudget - totalSpent) / totalBudget) * 100) : 0}%`, background: totalBudget > totalSpent ? "linear-gradient(90deg, #34d39988, #34d399)" : "linear-gradient(90deg, #f8717188, #f87171)", borderRadius: "999px", boxShadow: totalBudget > totalSpent ? "0 0 6px rgba(52,211,153,0.35)" : "0 0 6px rgba(248,113,113,0.35)" }} />
        </div>
        <span style={{ fontSize: "10px", color: totalBudget > totalSpent ? "rgba(52,211,153,0.5)" : "rgba(248,113,113,0.5)", fontWeight: "700" }}>{totalBudget > totalSpent ? "intact" : "⚠ over"}</span>
      </div>
      <div style={{ padding: "18px 16px", borderRight: "1px solid rgba(255,255,255,0.04)" }}>
        <span style={{ fontSize: "8px", color: "rgba(245,158,11,0.5)", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "800", display: "block", marginBottom: "8px" }}>Burn Rate</span>
        <div style={{ fontSize: "20px", fontWeight: "900", color: "#f59e0b", letterSpacing: "-0.5px", lineHeight: 1, marginBottom: "6px" }}>{totalBudget > 0 ? `${((totalSpent / totalBudget) * 100).toFixed(1)}%` : "—"}</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", marginBottom: "5px" }}>
          {[0,1,2,3,4].map(i => { const thr=(i+1)*20; const bp=totalBudget>0?(totalSpent/totalBudget)*100:0; const act=bp>=thr-20; const c=thr<=60?"#34d399":thr<=80?"#f59e0b":"#f87171"; return <div key={i} style={{ flex:1, height:`${5+i*2}px`, borderRadius:"2px", background:act?c:"rgba(255,255,255,0.06)", boxShadow:act?`0 0 4px ${c}66`:"none" }} />; })}
        </div>
        <span style={{ fontSize: "10px", color: "rgba(245,158,11,0.4)", fontWeight: "600" }}>{totalBudget>0&&(totalSpent/totalBudget)<0.5?"✓ On track":totalBudget>0&&(totalSpent/totalBudget)<0.85?"⚡ Monitor":"⚠ Review"}</span>
      </div>
      <div style={{ padding: "18px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontSize: "8px", color: "rgba(52,211,153,0.6)", letterSpacing: "2px", textTransform: "uppercase", fontWeight: "800" }}>💰 War Chest</span>
          <button onClick={() => setEditing(!editing)} style={{ fontSize: "9px", padding: "2px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontWeight: "600" }}>✎</button>
        </div>
        <div style={{ fontSize: "20px", fontWeight: "900", color: "#34d399", letterSpacing: "-0.5px", lineHeight: 1, marginBottom: "8px" }}>{fmtM(total)}</div>
        <div style={{ display: "flex", gap: "6px", marginBottom: editing ? "10px" : "0" }}>
          <div style={{ flex: 1, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.12)", borderRadius: "7px", padding: "5px 7px" }}>
            <div style={{ fontSize: "7px", color: "rgba(255,255,255,0.2)", marginBottom: "2px" }}>LIQUID</div>
            <div style={{ fontSize: "12px", fontWeight: "800", color: "#34d399" }}>{fmtM(warChest)}</div>
          </div>
          <div style={{ flex: 1, background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.12)", borderRadius: "7px", padding: "5px 7px" }}>
            <div style={{ fontSize: "7px", color: "rgba(255,255,255,0.2)", marginBottom: "2px" }}>EQUITY {equityPct}%</div>
            <div style={{ fontSize: "12px", fontWeight: "800", color: "#60a5fa" }}>{fmtM(autoCash)}</div>
          </div>
        </div>
        {editing && (
          <div style={{ display: "flex", flexDirection: "column", gap: "7px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", gap: "5px" }}>
              <input type="number" placeholder="Cash in bank" value={inputVal} onChange={e => setInputVal(e.target.value)} style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: "6px", padding: "5px 7px", fontSize: "12px", fontWeight: "800", color: "#34d399", outline: "none", fontFamily: "inherit" }} />
              <button onClick={() => { const v = parseFloat(inputVal)||0; setWarChest(v); save(v, equityPct); setInputVal(""); }} style={{ padding: "5px 9px", background: "#34d399", color: "#000", borderRadius: "6px", fontWeight: "800", fontSize: "11px", border: "none", cursor: "pointer" }}>Set</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input type="range" min="0" max="100" step="5" value={equityPct} onChange={e => { const v=parseInt(e.target.value); setEquityPct(v); save(warChest,v); }} style={{ flex: 1, accentColor: "#60a5fa" }} />
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#60a5fa", minWidth: "26px" }}>{equityPct}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MissionControl({ projects, userId, totalEquity }: { projects: any[]; userId?: string; totalEquity?: number }) {
  const today = new Date();
  const todayStr = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());

  const PHASE_ICONS: Record<string, string> = {
    "Planning":"🗺️","Permits":"📋","Demo":"🔨","Foundation":"🏗️","Framing":"🪵","MEP":"⚙️",
    "Plumbing":"🔧","Electrical":"⚡","HVAC":"🌀","Insulation":"🧱","Drywall":"🪣","Flooring":"🟫",
    "Painting":"🎨","Roofing":"🏠","Windows":"🪟","Finishing":"✨","Inspection":"🔍","Delivery":"🚚",
    "Staging":"🛋️","Listing":"📣","Closing":"🤝","Acquisition":"🔑","Assessment":"📊","Design":"✏️",
    "Feasibility":"📈","Fit-Out":"🪑","Opening":"🎉","Handover":"🤝","Launch":"🚀",
  };

  const AVG: Record<string, number> = {
    "Planning":14,"Permits":30,"Demo":7,"Foundation":21,"Framing":21,"MEP":14,"Plumbing":10,
    "Electrical":10,"HVAC":7,"Insulation":5,"Drywall":10,"Flooring":7,"Painting":7,"Roofing":10,
    "Windows":5,"Finishing":14,"Inspection":7,"Delivery":3,"Staging":5,"Listing":14,"Closing":30,
    "Acquisition":45,"Assessment":14,"Structural":21,"Systems":14,"Certificate":14,"Design":21,
    "Feasibility":30,"Construction":60,"Management":30,"Execution":30,"Review":7,
  };

  function getPhaseEst(project: any, phaseIdx: number) {
    const base = project.start_date ? new Date(project.start_date) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
    let cum = 0;
    for (let k = 0; k <= phaseIdx; k++) {
      const stored = (() => { try { const v = localStorage.getItem(`avg_${project.id}_${k}`); return v ? parseInt(v) : null; } catch { return null; } })();
      const ph = project.phases[k];
      cum += stored ?? (ph ? (AVG[ph.name] ?? 14) : 14);
    }
    return new Date(base.getTime() + cum * 86400000);
  }

  function fmtDate(d: Date) { return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  function daysFromNow(d: Date) { return Math.ceil((d.getTime() - today.getTime()) / 86400000); }

  const activeProjects = projects.filter(p => p.phases?.length > 0);

  type PhaseItem = { projectName: string; phaseName: string; estDate: Date; days: number; status: string; projectId: number; color: string; };
  const allPhaseItems: PhaseItem[] = [];
  activeProjects.forEach(proj => {
    proj.phases.forEach((ph: any, i: number) => {
      if (ph.status !== "done") {
        const est = getPhaseEst(proj, i);
        const days = daysFromNow(est);
        const color = ph.status === "delayed" ? "#f87171" : days < 0 ? "#f87171" : days <= 7 ? "#f59e0b" : "#60a5fa";
        allPhaseItems.push({ projectName: proj.name, phaseName: ph.name, estDate: est, days, status: ph.status, projectId: proj.id, color });
      }
    });
  });

  const overdue = allPhaseItems.filter(x => x.days < 0).sort((a,b) => a.days - b.days);
  const thisWeek = allPhaseItems.filter(x => x.days >= 0 && x.days <= 7).sort((a,b) => a.days - b.days);
  const upcoming = allPhaseItems.filter(x => x.days > 7 && x.days <= 30).sort((a,b) => a.days - b.days);

  const tickerItems = [
    ...overdue.map(x => ({ label: `⚠ ${x.phaseName} · ${x.projectName}`, sub: `${Math.abs(x.days)}d overdue`, color: "#f87171" })),
    ...thisWeek.map(x => ({ label: `🔥 ${x.phaseName} · ${x.projectName}`, sub: `Due ${fmtDate(x.estDate)}`, color: "#f59e0b" })),
    ...upcoming.map(x => ({ label: `→ ${x.phaseName} · ${x.projectName}`, sub: `Est. ${fmtDate(x.estDate)}`, color: "#60a5fa" })),
    ...activeProjects.map(proj => {
      const done = proj.phases.filter((ph: any) => ph.status === "done").length;
      const total = proj.phases.length || 1;
      return { label: `${proj.name}`, sub: `${Math.round((done/total)*100)}% complete`, color: "#a78bfa" };
    }),
  ];

  // Calendar logic
  const calDays = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const calName = new Date(calYear, calMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Map est dates to calendar
  const calEvents: Record<number, PhaseItem[]> = {};
  allPhaseItems.forEach(item => {
    if (item.estDate.getMonth() === calMonth && item.estDate.getFullYear() === calYear) {
      const d = item.estDate.getDate();
      if (!calEvents[d]) calEvents[d] = [];
      calEvents[d].push(item);
    }
  });

  return (
    <div style={{ background: "linear-gradient(135deg, rgba(8,8,18,0.99), rgba(4,4,12,0.97))", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "20px", marginBottom: "24px", overflow: "hidden", position: "relative" }}>

      {/* Ticker */}
      {tickerItems.length > 0 && (
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", height: "34px", display: "flex", alignItems: "center", background: "rgba(0,0,0,0.4)", overflow: "hidden" }}>
          <div style={{ display: "flex", animation: "tickerScroll 35s linear infinite", whiteSpace: "nowrap" }}>
            {[...tickerItems, ...tickerItems].map((item, i) => (
              <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "0 28px", borderRight: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: "10px", fontWeight: "800", color: item.color }}>{item.label}</span>
                <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontWeight: "600" }}>{item.sub}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: "20px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399", boxShadow: "0 0 6px #34d399", animation: "blink 1.5s infinite" }} />
              <span style={{ fontSize: "10px", color: "rgba(245,158,11,0.7)", letterSpacing: "2px", fontWeight: "700", textTransform: "uppercase" }}>Mission Control · {todayStr}</span>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              {overdue.length > 0 && <span style={{ fontSize: "11px", fontWeight: "800", color: "#f87171", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: "999px", padding: "3px 12px" }}>⚠ {overdue.length} overdue</span>}
              {thisWeek.length > 0 && <span style={{ fontSize: "11px", fontWeight: "800", color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "999px", padding: "3px 12px" }}>🔥 {thisWeek.length} this week</span>}
              <span style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.3)" }}>{activeProjects.length} projects</span>
            </div>
          </div>
          <CommandBoard projects={projects} userId={userId} totalEquity={totalEquity || 0} />
        </div>

        {/* Phase cards */}
        {allPhaseItems.length > 0 && (() => {
          const featured = [...overdue, ...thisWeek, ...upcoming].slice(0, 4);
          const PROJECT_COLORS = ["#f59e0b","#34d399","#60a5fa","#a78bfa","#f87171","#e879f9","#fb923c","#22d3ee"];
          return (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, Math.min(featured.length, 4))}, 1fr)`, gap: "10px", marginBottom: "24px" }}>
              {featured.map((item, i) => {
                const isHero = i === 0;
                const projIdx = activeProjects.findIndex((p: any) => p.name === item.projectName);
                const projColor = PROJECT_COLORS[projIdx % PROJECT_COLORS.length] || item.color;
                const urgencyColor = item.days < 0 ? "#f87171" : item.days <= 7 ? "#f59e0b" : projColor;
                return (
                  <div key={i} style={{ background: `linear-gradient(135deg, ${urgencyColor}10, ${urgencyColor}04)`, border: `1px solid ${urgencyColor}35`, borderRadius: "16px", padding: isHero ? "16px 18px" : "13px 15px", position: "relative", overflow: "hidden", opacity: i === 2 ? 0.75 : 1 }}>
                    {/* Top accent line */}
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, ${urgencyColor}66, ${urgencyColor})` }} />
                    {/* Glow corner */}
                    <div style={{ position: "absolute", top: 0, right: 0, width: "80px", height: "80px", background: `radial-gradient(circle at top right, ${urgencyColor}20, transparent 70%)`, pointerEvents: "none" }} />

                    {/* Badge row */}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                      <span style={{ fontSize: isHero ? "18px" : "14px" }}>{PHASE_ICONS[item.phaseName] || "📌"}</span>
                      <span style={{ fontSize: isHero ? "10px" : "9px", fontWeight: "800", color: urgencyColor, letterSpacing: "1.5px", textTransform: "uppercase" }}>{item.phaseName}</span>
                      {item.days < 0 && <span style={{ marginLeft: "auto", fontSize: "8px", fontWeight: "800", color: "#f87171", background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "999px", padding: "2px 8px" }}>OVERDUE</span>}
                      {item.days >= 0 && item.days <= 7 && <span style={{ marginLeft: "auto", fontSize: "8px", fontWeight: "800", color: "#f59e0b", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "999px", padding: "2px 8px" }}>THIS WEEK</span>}
                      {item.days > 7 && <span style={{ marginLeft: "auto", fontSize: "8px", fontWeight: "800", color: projColor, background: `${projColor}12`, border: `1px solid ${projColor}30`, borderRadius: "999px", padding: "2px 8px" }}>UPCOMING</span>}
                    </div>

                    {/* Project name */}
                    <p style={{ fontSize: isHero ? "12px" : "11px", fontWeight: "700", color: projColor, marginBottom: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", background: `${projColor}12`, border: `1px solid ${projColor}25`, borderRadius: "6px", padding: "3px 8px", display: "inline-block", maxWidth: "100%" }}>{item.projectName}</p>

                    {/* Date — BIG */}
                    <p style={{ fontSize: isHero ? "22px" : "16px", fontWeight: "900", color: urgencyColor, letterSpacing: "-1px", lineHeight: 1, marginBottom: "5px" }}>
                      {item.days < 0 ? `⚠ ${Math.abs(item.days)}d late` : item.days === 0 ? "Today" : `→ ${fmtDate(item.estDate)}`}
                    </p>

                    {/* Days away */}
                    <p style={{ fontSize: isHero ? "11px" : "9px", color: item.days < 0 ? "#f87171" : "rgba(255,255,255,0.35)", fontWeight: "600" }}>
                      {item.days < 0 ? "Action required" : item.days === 0 ? "Due today" : `in ${item.days} day${item.days > 1 ? "s" : ""}`}
                    </p>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Two column layout: Project Tracker + Calendar */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "20px", alignItems: "start" }}>

          {/* Left: Project tracker — MILITARY COMMAND CARDS */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <div style={{ width: "3px", height: "14px", background: "#f59e0b", borderRadius: "999px", boxShadow: "0 0 6px #f59e0b" }} />
              <p style={{ fontSize: "9px", color: "rgba(245,158,11,0.7)", letterSpacing: "2.5px", textTransform: "uppercase", fontWeight: "800" }}>Asset Deployment Status</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {activeProjects.map((proj, projIdx) => {
                const PROJECT_COLORS = ["#f59e0b","#34d399","#60a5fa","#a78bfa","#f87171","#e879f9","#fb923c","#22d3ee"];
                const projColor = PROJECT_COLORS[projIdx % PROJECT_COLORS.length];
                const phases = proj.phases;
                const doneCount = phases.filter((ph: any) => ph.status === "done").length;
                const total = phases.length || 1;
                const pct = Math.round((doneCount / total) * 100);
                const currentPhase = phases.find((ph: any) => ph.status === "in_progress");
                const nextPhase = phases.find((ph: any) => ph.status === "not_started");
                const prevDonePh = [...phases].reverse().find((ph: any) => ph.status === "done");

                const base = proj.start_date ? new Date(proj.start_date) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
                let totalDays = 0;
                phases.forEach((_: any, k: number) => {
                  const stored = (() => { try { const v = localStorage.getItem(`avg_${proj.id}_${k}`); return v ? parseInt(v) : null; } catch { return null; } })();
                  totalDays += stored ?? (AVG[phases[k]?.name] ?? 14);
                });
                const estEnd = new Date(base.getTime() + totalDays * 86400000);
                const daysLeft = Math.ceil((estEnd.getTime() - new Date().getTime()) / 86400000);
                const endStr = estEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                const dl = proj.end_date ? Math.ceil((new Date(proj.end_date).getTime() - new Date().getTime()) / 86400000) : daysLeft;
                const dlColor = dl < 0 ? "#f87171" : dl < 14 ? "#f59e0b" : "#34d399";
                const hc = pct >= 70 ? "#34d399" : pct >= 35 ? "#f59e0b" : projColor;
                const statusLabel = pct === 100 ? "COMPLETE" : currentPhase ? "ACTIVE" : "STANDBY";
                const statusColor = pct === 100 ? "#34d399" : currentPhase ? "#f59e0b" : "rgba(255,255,255,0.3)";

                return (
                  <div key={proj.id} style={{ background: "linear-gradient(135deg, rgba(0,0,0,0.5), rgba(0,0,0,0.3))", border: `1px solid ${projColor}25`, borderLeft: `3px solid ${projColor}`, borderRadius: "16px", padding: "18px 20px", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, right: 0, width: "100px", height: "100px", background: `radial-gradient(circle at top right, ${projColor}10, transparent 70%)`, pointerEvents: "none" }} />
                    <div style={{ position: "absolute", bottom: "8px", right: "16px", fontSize: "52px", opacity: 0.04, fontWeight: "900", color: projColor, lineHeight: 1, pointerEvents: "none" }}>{pct}%</div>

                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: projColor, boxShadow: `0 0 8px ${projColor}`, animation: currentPhase ? "blink 2s infinite" : "none" }} />
                          <span style={{ fontSize: "13px", fontWeight: "900", color: "#fff", letterSpacing: "0.3px" }}>{proj.name.toUpperCase()}</span>
                          <span style={{ fontSize: "8px", fontWeight: "800", color: statusColor, background: `${statusColor}15`, border: `1px solid ${statusColor}40`, borderRadius: "4px", padding: "2px 7px", letterSpacing: "1.5px" }}>{statusLabel}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", fontWeight: "600" }}>
                            {proj.start_date ? `Started ${new Date(proj.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No start date"}
                          </span>
                          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.15)" }}>→</span>
                          <span style={{ fontSize: "10px", color: dlColor, fontWeight: "700" }}>
                            Ends {proj.end_date ? new Date(proj.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : endStr}
                          </span>
                          <span style={{ fontSize: "10px", fontWeight: "800", color: dlColor, background: `${dlColor}12`, border: `1px solid ${dlColor}30`, borderRadius: "999px", padding: "2px 9px" }}>
                            {dl < 0 ? `⚠ ${Math.abs(dl)}d overdue` : `⏱ ${dl}d left`}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "30px", fontWeight: "900", color: projColor, letterSpacing: "-1px", lineHeight: 1 }}>{pct}<span style={{ fontSize: "14px", color: `${projColor}88` }}>%</span></div>
                        <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)", letterSpacing: "1px", marginTop: "2px" }}>{doneCount}/{total} PHASES</div>
                      </div>
                    </div>

                    {/* Phase ribbon */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "14px", overflowX: "auto", paddingBottom: "4px" }}>
                      {phases.map((ph: any, i: number) => {
                        const isDone = ph.status === "done";
                        const isCurrent = ph.status === "in_progress";
                        const isNextUp = i === phases.findIndex((p: any) => p.status === "not_started");
                        const phColor = isDone ? "#34d399" : isCurrent ? "#f59e0b" : isNextUp ? projColor : "rgba(255,255,255,0.1)";
                        const est = getPhaseEst(proj, i);
                        const estStr = est.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                              <span style={{ fontSize: "8px", color: isCurrent ? "#f59e0b" : "rgba(255,255,255,0.12)", fontWeight: isCurrent ? "800" : "400", whiteSpace: "nowrap" }}>{isCurrent ? estStr : isDone ? "✓" : isNextUp ? estStr : ""}</span>
                              <div style={{ width: isCurrent ? "48px" : "38px", height: isCurrent ? "48px" : "38px", borderRadius: "50%", background: isDone ? "rgba(52,211,153,0.12)" : isCurrent ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.03)", border: `2px solid ${phColor}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: isCurrent ? `0 0 14px rgba(245,158,11,0.5), 0 0 0 4px rgba(245,158,11,0.08)` : "none", transition: "all 0.3s" }}>
                                <span style={{ fontSize: isCurrent ? "20px" : "16px" }}>{isDone ? "✅" : PHASE_ICONS[ph.name] || "📌"}</span>
                              </div>
                              <span style={{ fontSize: isCurrent ? "11px" : "10px", color: isDone ? "#34d399" : isCurrent ? "#f59e0b" : isNextUp ? projColor : "rgba(255,255,255,0.18)", fontWeight: isCurrent ? "800" : "600", whiteSpace: "nowrap", maxWidth: "64px", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis" }}>{ph.name}</span>
                              {isCurrent && <span style={{ fontSize: "7px", color: "#f59e0b", fontWeight: "800", letterSpacing: "1px", textTransform: "uppercase" }}>◀ HERE</span>}
                            </div>
                            {i < phases.length - 1 && (
                              <div style={{ width: "28px", height: "2px", background: isDone ? "#34d399" : "rgba(255,255,255,0.06)", marginTop: "0px", marginRight: "6px", marginBottom: "22px", marginLeft: "6px", flexShrink: 0, boxShadow: isDone ? "0 0 4px rgba(52,211,153,0.4)" : "none" }} />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Progress bar */}
                    <div style={{ position: "relative", height: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "999px", marginBottom: "10px", overflow: "visible" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${hc}55, ${hc})`, borderRadius: "999px", transition: "width 0.8s", boxShadow: `0 0 10px ${hc}66`, position: "relative" }}>
                        <div style={{ position: "absolute", right: "-5px", top: "50%", transform: "translateY(-50%)", width: "14px", height: "14px", borderRadius: "50%", background: hc, boxShadow: `0 0 0 3px rgba(0,0,0,0.5), 0 0 12px ${hc}`, border: "2px solid #0a0a0a", display: pct > 0 && pct < 100 ? "block" : "none" }} />
                      </div>
                      {phases.map((_: any, i: number) => (
                        <div key={i} style={{ position: "absolute", top: "-3px", left: `${((i + 1) / total) * 100}%`, transform: "translateX(-50%)", width: "2px", height: "14px", background: "rgba(0,0,0,0.5)", borderRadius: "999px", zIndex: 1 }} />
                      ))}
                    </div>

                    {/* ── PLANNING STRIP: Next 3 phases ── */}
                    {(() => {
                      const upcomingPhases = phases
                        .map((ph: any, i: number) => ({ ...ph, idx: i, est: getPhaseEst(proj, i) }))
                        .filter((ph: any) => ph.status !== "done")
                        .slice(0, 3);
                      return (
                        <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                          {upcomingPhases.length === 0 ? (
                            <div style={{ flex: 1, background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.15)", borderRadius: "10px", padding: "10px 12px", textAlign: "center" }}>
                              <span style={{ fontSize: "11px", color: "#34d399", fontWeight: "700" }}>✓ All phases complete</span>
                            </div>
                          ) : upcomingPhases.map((ph: any, ui: number) => {
                            const isNext = ui === 0;
                            const phColor = isNext ? projColor : "rgba(255,255,255,0.12)";
                            const daysAway = Math.ceil((ph.est.getTime() - new Date().getTime()) / 86400000);
                            const estStr = ph.est.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                            const isOverdue = daysAway < 0 && ph.status === "in_progress";
                            return (
                              <div key={ui} style={{ flex: isNext ? 1.6 : 1, background: isNext ? `${projColor}10` : "rgba(255,255,255,0.02)", border: `1px solid ${isNext ? projColor+"35" : "rgba(255,255,255,0.05)"}`, borderRadius: "10px", padding: isNext ? "10px 12px" : "8px 10px", position: "relative", overflow: "hidden", opacity: ui === 2 ? 0.4 : ui === 1 ? 0.65 : 1, transition: "all 0.3s" }}>
                                {isNext && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, ${projColor}66, ${projColor})`, borderRadius: "10px 10px 0 0" }} />}
                                <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px" }}>
                                  <span style={{ fontSize: isNext ? "13px" : "10px" }}>{PHASE_ICONS[ph.name] || "📌"}</span>
                                  <span style={{ fontSize: isNext ? "11px" : "9px", fontWeight: "800", color: isNext ? phColor : "rgba(255,255,255,0.35)", letterSpacing: "0.3px" }}>{ph.name}</span>
                                  {isNext && <span style={{ marginLeft: "auto", fontSize: "8px", fontWeight: "800", color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "999px", padding: "1px 6px" }}>NEXT ▶</span>}
                                </div>
                                <div style={{ fontSize: isNext ? "10px" : "9px", color: isOverdue ? "#f87171" : isNext ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.18)", fontWeight: isNext ? "700" : "400" }}>
                                  {isOverdue ? `⚠ ${Math.abs(daysAway)}d late` : daysAway === 0 ? "Today" : `→ ${estStr}`}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Footer: team + budget */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        {(proj.team || []).slice(0,4).map((m: any, ti: number) => (
                          <div key={ti} title={`${m.name} · ${m.role}`} style={{ width: "20px", height: "20px", borderRadius: "50%", background: `${projColor}20`, border: `1px solid ${projColor}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", fontWeight: "800", color: projColor, marginLeft: ti > 0 ? "-5px" : "0" }}>
                            {(m.name?.[0] || "?").toUpperCase()}
                          </div>
                        ))}
                        {(proj.team || []).length === 0 && <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.15)", fontStyle: "italic" }}>No team</span>}
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {proj.budget > 0 && (
                          <span style={{ fontSize: "9px", fontWeight: "700", color: (proj.spent / proj.budget) > 0.9 ? "#f87171" : "#34d399", background: (proj.spent / proj.budget) > 0.9 ? "rgba(248,113,113,0.08)" : "rgba(52,211,153,0.08)", border: `1px solid ${(proj.spent / proj.budget) > 0.9 ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)"}`, borderRadius: "999px", padding: "2px 9px" }}>
                            💰 {((proj.spent / proj.budget) * 100).toFixed(0)}% budget
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Military Calendar — upgraded */}
          <div style={{ background: "linear-gradient(135deg, rgba(0,0,0,0.5), rgba(0,0,0,0.3))", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "16px", padding: "16px", position: "relative", overflow: "hidden" }}>
            {/* Corner glow */}
            <div style={{ position: "absolute", top: 0, right: 0, width: "80px", height: "80px", background: "radial-gradient(circle at top right, rgba(245,158,11,0.08), transparent 70%)", pointerEvents: "none" }} />

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <button onClick={() => { let m = calMonth - 1; let y = calYear; if (m < 0) { m = 11; y--; } setCalMonth(m); setCalYear(y); }} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "13px", padding: "3px 8px", fontWeight: "700" }}>‹</button>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: "10px", fontWeight: "900", color: "#f59e0b", letterSpacing: "1.5px", textTransform: "uppercase" }}>{calName}</span>
              </div>
              <button onClick={() => { let m = calMonth + 1; let y = calYear; if (m > 11) { m = 0; y++; } setCalMonth(m); setCalYear(y); }} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "13px", padding: "3px 8px", fontWeight: "700" }}>›</button>
            </div>

            {/* Project color legend pills */}
            {activeProjects.length > 0 && (
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "10px", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {activeProjects.map((proj, idx) => {
                  const PROJECT_COLORS = ["#f59e0b","#34d399","#60a5fa","#a78bfa","#f87171","#e879f9","#fb923c","#22d3ee"];
                  const c = PROJECT_COLORS[idx % PROJECT_COLORS.length];
                  const initial = proj.name?.[0]?.toUpperCase() || "?";
                  return (
                    <div key={proj.id} title={proj.name} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "2px 7px", borderRadius: "999px", background: `${c}15`, border: `1px solid ${c}40` }}>
                      <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: c, boxShadow: `0 0 4px ${c}` }} />
                      <span style={{ fontSize: "8px", fontWeight: "800", color: c, letterSpacing: "0.3px" }}>{initial}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Day headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "1px", marginBottom: "4px" }}>
              {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d,i) => (
                <div key={i} style={{ textAlign: "center", fontSize: "8px", color: "rgba(255,255,255,0.2)", fontWeight: "800", padding: "2px 0", letterSpacing: "0.3px" }}>{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "2px" }}>
              {Array.from({ length: firstDay }).map((_,i) => <div key={`e${i}`} style={{ height: "36px" }} />)}
              {Array.from({ length: calDays }).map((_, i) => {
                const day = i + 1;
                const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                const events = calEvents[day] || [];
                const hasOverdue = events.some(e => e.days < 0);
                const hasThisWeek = events.some(e => e.days >= 0 && e.days <= 7);

                // Get unique projects for this day
                const dayProjects = events.reduce((acc: any[], ev) => {
                  if (!acc.find(a => a.projectId === ev.projectId)) acc.push(ev);
                  return acc;
                }, []);

                return (
                  <div key={day} title={events.map(e => `${e.phaseName} · ${e.projectName}`).join("\n")} style={{ height: "36px", textAlign: "center", borderRadius: "7px", background: isToday ? "rgba(245,158,11,0.18)" : events.length > 0 ? "rgba(255,255,255,0.03)" : "transparent", border: isToday ? "1px solid rgba(245,158,11,0.5)" : events.length > 0 ? "1px solid rgba(255,255,255,0.07)" : "1px solid transparent", cursor: events.length > 0 ? "pointer" : "default", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "4px 1px 2px", boxShadow: isToday ? "0 0 10px rgba(245,158,11,0.2)" : "none", transition: "all 0.15s" }}>
                    <span style={{ fontSize: "9px", fontWeight: isToday ? "900" : "500", color: isToday ? "#f59e0b" : events.length > 0 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)", lineHeight: 1 }}>{day}</span>
                    {/* Project color dots — up to 3 */}
                    {dayProjects.length > 0 && (
                      <div style={{ display: "flex", gap: "2px", marginTop: "3px", flexWrap: "wrap", justifyContent: "center" }}>
                        {dayProjects.slice(0,3).map((ev, di) => {
                          const PROJECT_COLORS = ["#f59e0b","#34d399","#60a5fa","#a78bfa","#f87171","#e879f9","#fb923c","#22d3ee"];
                          const projIdx = activeProjects.findIndex((p: any) => p.id === ev.projectId);
                          const c = hasOverdue ? "#f87171" : hasThisWeek ? "#f59e0b" : PROJECT_COLORS[projIdx % PROJECT_COLORS.length];
                          return <div key={di} style={{ width: "5px", height: "5px", borderRadius: "50%", background: c, boxShadow: `0 0 4px ${c}88` }} />;
                        })}
                        {dayProjects.length > 3 && <span style={{ fontSize: "7px", color: "rgba(255,255,255,0.3)", lineHeight: "5px" }}>+</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Today indicator line */}
            <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f59e0b", boxShadow: "0 0 6px #f59e0b", animation: "blink 1.5s infinite" }} />
                <span style={{ fontSize: "8px", color: "rgba(245,158,11,0.7)", fontWeight: "800", letterSpacing: "1px", textTransform: "uppercase" }}>
                  {today.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — {allPhaseItems.filter(x => x.estDate.getMonth() === calMonth && x.estDate.getFullYear() === calYear).length} phases this month
                </span>
              </div>

              {/* Upcoming phases this month — mini list */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "120px", overflowY: "auto" }}>
                {allPhaseItems
                  .filter(x => x.estDate.getMonth() === calMonth && x.estDate.getFullYear() === calYear)
                  .sort((a,b) => a.estDate.getTime() - b.estDate.getTime())
                  .slice(0, 6)
                  .map((item, idx) => {
                    const PROJECT_COLORS = ["#f59e0b","#34d399","#60a5fa","#a78bfa","#f87171","#e879f9","#fb923c","#22d3ee"];
                    const projIdx = activeProjects.findIndex((p: any) => p.id === item.projectId);
                    const c = item.days < 0 ? "#f87171" : item.days <= 7 ? "#f59e0b" : PROJECT_COLORS[projIdx % PROJECT_COLORS.length];
                    const initial = item.projectName?.[0]?.toUpperCase() || "?";
                    return (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "3px 6px", borderRadius: "6px", background: `${c}08`, border: `1px solid ${c}20` }}>
                        <div style={{ width: "14px", height: "14px", borderRadius: "4px", background: `${c}20`, border: `1px solid ${c}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "7px", fontWeight: "900", color: c, flexShrink: 0 }}>{initial}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "9px", fontWeight: "700", color: "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.phaseName}</div>
                          <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.projectName}</div>
                        </div>
                        <span style={{ fontSize: "8px", fontWeight: "800", color: c, flexShrink: 0 }}>
                          {item.days < 0 ? `${Math.abs(item.days)}d late` : item.days === 0 ? "Today" : fmtDate(item.estDate)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CashTracker({ totalEquity, totalRemaining, userId }: { totalEquity: number; totalRemaining: number; userId: string }) {
  const [warChest, setWarChest] = useState(0);
  const [equityPct, setEquityPct] = useState(20);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");

  useEffect(() => {
    if (!userId) return;
    supabase.from("user_settings").select("war_chest, equity_pct").eq("user_id", userId).single()
      .then(({ data }) => {
        if (data) { setWarChest(data.war_chest || 0); setEquityPct(data.equity_pct || 20); }
      });
  }, [userId]);

  async function save(wc: number, ep: number) {
    await supabase.from("user_settings").upsert({ user_id: userId, war_chest: wc, equity_pct: ep, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  }

  const autoCash = Math.round((totalEquity / 100) * equityPct);
  const totalAvailable = warChest + autoCash;
  const coverageRatio = totalRemaining > 0 ? (totalAvailable / totalRemaining) * 100 : 100;
  const coverageColor = coverageRatio >= 100 ? "#34d399" : coverageRatio >= 50 ? "#f59e0b" : "#f87171";

  function fmtM(n: number) { if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M"; if (n >= 1_000) return "$" + Math.round(n).toLocaleString("en-US"); return "$" + n.toFixed(0); }

  return (
    <div style={{ background: "linear-gradient(135deg, rgba(52,211,153,0.06), rgba(96,165,250,0.04))", border: "1px solid rgba(52,211,153,0.2)", borderRadius: "16px", padding: "20px 24px", marginBottom: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399", boxShadow: "0 0 6px #34d399" }} />
            <span style={{ fontSize: "10px", color: "rgba(52,211,153,0.7)", letterSpacing: "2px", fontWeight: "700", textTransform: "uppercase" }}>💰 Capital Reserve · What You Can Deploy</span>
          </div>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>Money available for <span style={{ color: "#34d399", fontWeight: "700" }}>renovations</span> · <span style={{ color: "#60a5fa", fontWeight: "700" }}>new projects</span> · <span style={{ color: "#f87171", fontWeight: "700" }}>difficult times</span></p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: coverageColor, fontWeight: "700", background: `${coverageColor}15`, padding: "4px 10px", borderRadius: "999px", border: `1px solid ${coverageColor}33` }}>
            {coverageRatio >= 100 ? "✓ Fully funded" : `${coverageRatio.toFixed(0)}% of remaining budget covered`}
          </span>
          <button onClick={() => setEditing(!editing)} style={{ fontSize: "11px", padding: "5px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontWeight: "600" }}>{editing ? "Close" : "✎ Edit"}</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: editing ? "16px" : "0" }}>
        {[
          { label: "💰 Money in the Bank", sublabel: "Cash you've saved — ready to deploy immediately", value: fmtM(warChest), color: "#34d399", tag: "Liquid" },
          { label: "🏗 Equity You Can Use", sublabel: `${equityPct}% of your project equity — deployable capital`, value: fmtM(autoCash), color: "#60a5fa", tag: "From equity" },
          { label: "⚡ Total War Chest", sublabel: "Full amount available for projects or emergencies", value: fmtM(totalAvailable), color: "#f59e0b", tag: "Combined", big: true },
        ].map(m => (
          <div key={m.label} style={{ background: "rgba(0,0,0,0.2)", borderRadius: "14px", padding: "16px 18px", border: `1px solid ${m.color}22`, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: "60px", height: "60px", background: `radial-gradient(circle at top right, ${m.color}08, transparent 70%)`, pointerEvents: "none" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", fontWeight: "700" }}>{m.label}</p>
              <span style={{ fontSize: "8px", fontWeight: "800", color: m.color, background: `${m.color}15`, border: `1px solid ${m.color}30`, borderRadius: "999px", padding: "2px 7px" }}>{m.tag}</span>
            </div>
            <p style={{ fontSize: (m as any).big ? "26px" : "22px", fontWeight: "900", color: m.color, letterSpacing: "-0.5px", marginBottom: "4px" }}>{m.value}</p>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>{m.sublabel}</p>
          </div>
        ))}
      </div>

      {editing && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", padding: "16px", background: "rgba(0,0,0,0.2)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "600", marginBottom: "6px" }}>War Chest ($) — cash in bank</p>
            <div style={{ display: "flex", gap: "8px" }}>
              <input type="number" placeholder={String(warChest)} value={inputVal} onChange={e => setInputVal(e.target.value)} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: "8px", padding: "9px 12px", fontSize: "14px", fontWeight: "800", color: "#34d399", outline: "none", fontFamily: "inherit" }} />
              <button onClick={() => { const v = parseFloat(inputVal) || 0; setWarChest(v); save(v, equityPct); setInputVal(""); }} style={{ padding: "9px 14px", background: "#34d399", color: "#000", borderRadius: "8px", fontWeight: "800", fontSize: "12px", border: "none", cursor: "pointer" }}>Set</button>
            </div>
          </div>
          <div>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "600", marginBottom: "6px" }}>Equity Deployable — {equityPct}%</p>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input type="range" min="0" max="100" step="5" value={equityPct} onChange={e => { const v = parseInt(e.target.value); setEquityPct(v); save(warChest, v); }} style={{ flex: 1, accentColor: "#60a5fa" }} />
              <span style={{ fontSize: "14px", fontWeight: "800", color: "#60a5fa", minWidth: "36px" }}>{equityPct}%</span>
            </div>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "4px" }}>= {fmtM(autoCash)} deployable from equity</p>
          </div>
        </div>
      )}
    </div>
  );
}

function LogSpendEntry({ project, onLog, team, trades }: { project: any; onLog: (e: any) => void; team: any[]; trades: any[] }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [trade, setTrade] = useState("");
  const [enteredBy, setEnteredBy] = useState("");
  function handleSave() {
    if (!amount) return;
    onLog({ amount: parseFloat(amount), note, trade, enteredBy, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) });
    setAmount(""); setNote(""); setTrade(""); setEnteredBy("");
  }
  const IS2: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: "#fff", outline: "none", fontFamily: "inherit", width: "100%" };
  return (
    <div style={{ background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: "14px", padding: "16px 20px" }}>
      <p style={{ fontSize: "10px", color: "rgba(248,113,113,0.7)", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: "700", marginBottom: "12px" }}>💸 Log Spend</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
        <div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Amount ($) *</p>
          <input type="number" placeholder="e.g. 15000" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} style={{ ...IS2, fontSize: "16px", fontWeight: "800", color: "#f87171" }} />
        </div>
        <div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Trade</p>
          <select value={trade} onChange={e => setTrade(e.target.value)} style={{ ...IS2 }}>
            <option value="">— Select trade —</option>
            {trades.map((t: any, i: number) => <option key={i} value={t.name}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Note</p>
          <input type="text" placeholder="e.g. First payment — roof work" value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} style={IS2} />
        </div>
        <div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>Entered By</p>
          <select value={enteredBy} onChange={e => setEnteredBy(e.target.value)} style={{ ...IS2 }}>
            <option value="">— Select person —</option>
            <option value="Owner">Owner</option>
            {team.map((m: any, i: number) => <option key={i} value={m.name}>{m.name}</option>)}
          </select>
        </div>
      </div>
      <button onClick={handleSave} disabled={!amount} style={{ width: "100%", padding: "12px", background: amount ? "#f87171" : "rgba(248,113,113,0.2)", color: amount ? "#000" : "rgba(255,255,255,0.3)", borderRadius: "10px", fontWeight: "800", fontSize: "14px", border: "none", cursor: amount ? "pointer" : "not-allowed" }}>Save Spend Entry</button>
    </div>
  );
}

function TradeCard({ trade, index, tradeColor, over, team, onUpdate, onDelete, fmtMoney, onLog }: any) {
  const [localTrade, setLocalTrade] = useState(trade);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setLocalTrade(trade); }, [trade]);
  function handleSave() {
    onUpdate(localTrade);
    if (onLog && localTrade.actual > 0) {
      onLog({
        amount: localTrade.actual,
        note: `${localTrade.name} — Quoted: ${fmtMoney(localTrade.quoted || 0)} / Actual: ${fmtMoney(localTrade.actual)}`,
        trade: localTrade.name,
        enteredBy: localTrade.assignedTo || "Owner",
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      });
    }
    setDirty(false);
  }
  const fieldStyle: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "8px 10px", fontSize: "15px", fontWeight: "800", color: "#fff", outline: "none", fontFamily: "inherit" };
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${tradeColor}33`, borderRadius: "14px", padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <input value={localTrade.name || ""} onChange={e => { setLocalTrade({ ...localTrade, name: e.target.value }); setDirty(true); }} onKeyDown={e => e.key === "Enter" && handleSave()} style={{ fontSize: "12px", fontWeight: "800", color: "#fff", background: "none", border: "none", outline: "none", fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.8px", width: "100%" }} />
        <button onClick={onDelete} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "16px", flexShrink: 0 }}>×</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
        <div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px" }}>QUOTED</p>
          <input type="number" value={localTrade.quoted || ""} placeholder="0" onChange={e => { setLocalTrade({ ...localTrade, quoted: parseFloat(e.target.value) || 0 }); setDirty(true); }} onKeyDown={e => e.key === "Enter" && handleSave()} style={{ ...fieldStyle, color: "#f59e0b" }} />
        </div>
        <div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "4px" }}>ACTUAL</p>
          <input type="number" value={localTrade.actual || ""} placeholder="0" onChange={e => { setLocalTrade({ ...localTrade, actual: parseFloat(e.target.value) || 0 }); setDirty(true); }} onKeyDown={e => e.key === "Enter" && handleSave()} style={{ ...fieldStyle, color: tradeColor }} />
        </div>
      </div>
      {over && <p style={{ fontSize: "10px", color: "#f87171", fontWeight: "700", marginBottom: "6px" }}>⚠ Over by {fmtMoney((localTrade.actual || 0) - (localTrade.quoted || 0))}</p>}
      {!over && localTrade.actual > 0 && localTrade.quoted > 0 && <p style={{ fontSize: "10px", color: "#34d399", fontWeight: "700", marginBottom: "6px" }}>✓ Under by {fmtMoney((localTrade.quoted || 0) - (localTrade.actual || 0))}</p>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
        <select value={localTrade.assignedTo || ""} onChange={e => { setLocalTrade({ ...localTrade, assignedTo: e.target.value }); setDirty(true); }} style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", padding: "5px 8px", fontSize: "10px", color: localTrade.assignedTo ? "#a78bfa" : "rgba(255,255,255,0.3)", outline: "none", fontFamily: "inherit" }}>
          <option value="">— Assign later —</option>
        <option value="Owner">Owner</option>
        {team.map((m: any, i: number) => <option key={i} value={m.name}>{m.name} · {m.role}</option>)}
        </select>
        {dirty && <button onClick={handleSave} style={{ padding: "5px 14px", background: "#a78bfa", color: "#000", borderRadius: "6px", fontWeight: "800", fontSize: "11px", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>Save ↵</button>}
      </div>
    </div>
  );
}

function AddTeamMember({ roles, onAdd }: { roles: string[]; onAdd: (m: any) => void }) {
  const [name, setName] = useState(""); const [role, setRole] = useState(roles[0]); const [contact, setContact] = useState("");
  const IS: React.CSSProperties = { background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", color: "#fff", outline: "none", fontFamily: "inherit" };
  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.1)", borderRadius: "12px", padding: "12px" }}>
      <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} style={{ ...IS, flex: 2, minWidth: "100px" }} />
      <select value={role} onChange={e => setRole(e.target.value)} style={{ ...IS, flex: 2, minWidth: "100px" }}>{roles.map(r => <option key={r}>{r}</option>)}</select>
      <input type="text" placeholder="Contact / Email" value={contact} onChange={e => setContact(e.target.value)} style={{ ...IS, flex: 2, minWidth: "100px" }} />
      <button onClick={() => { if (!name) return; onAdd({ name, role, contact }); setName(""); setContact(""); }} style={{ padding: "8px 16px", background: "#a78bfa", color: "#000", borderRadius: "8px", fontWeight: "800", fontSize: "12px", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>+ Add</button>
    </div>
  );
}


function NotificationBell({ user, properties }: { user: any; properties: Property[] }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    generateAlerts();
  }, [user, properties]);

  useEffect(() => {
    function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function loadNotifications() {
    const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
    setNotifications(data || []);
    setUnread((data || []).filter((n: any) => !n.read).length);
  }

  async function generateAlerts() {
    if (!properties.length) return;
    const existing = await supabase.from("notifications").select("type, message").eq("user_id", user.id);
    const existingKeys = new Set((existing.data || []).map((n: any) => `${n.type}:${n.message}`));
    const toInsert: any[] = [];

    // Vacant property alert
    properties.filter(p => p.occupancyStatus === "vacant").forEach(p => {
      const key = `alert_vacant:${p.name} is vacant`;
      if (!existingKeys.has(key)) toInsert.push({ user_id: user.id, type: "alert_vacant", title: "Vacant Property", message: `${p.name} is vacant`, read: false });
    });

    // Negative cash flow
    properties.filter(p => propCashFlow(p) < 0).forEach(p => {
      const key = `alert_cashflow:${p.name} has negative cash flow`;
      if (!existingKeys.has(key)) toInsert.push({ user_id: user.id, type: "alert_cashflow", title: "Negative Cash Flow", message: `${p.name} has negative cash flow`, read: false });
    });

    // Lease expiring within 30 days
    properties.filter(p => p.occupancyStatus === "planned" && p.plannedDate).forEach(p => {
      const days = Math.ceil((new Date(p.plannedDate).getTime() - Date.now()) / 86400000);
      if (days <= 30 && days >= 0) {
        const key = `alert_lease:${p.name} lease starts in ${days} days`;
        if (!existingKeys.has(key)) toInsert.push({ user_id: user.id, type: "alert_lease", title: "Lease Starting Soon", message: `${p.name} lease starts in ${days} days`, read: false });
      }
    });

    // Achievements (one-time)
    const achievements = [
      { condition: properties.length >= 1, type: "achievement", title: "🏆 First Property!", message: "You added your first property. The journey begins." },
      { condition: properties.length >= 3, type: "achievement", title: "🏆 Portfolio Builder", message: "3 properties tracked. You're building something real." },
      { condition: properties.reduce((s, p) => s + p.value, 0) >= 1_000_000, type: "achievement", title: "🏆 Millionaire Portfolio", message: "Your portfolio crossed $1M. Most never get here." },
      { condition: properties.reduce((s, p) => s + propCashFlow(p), 0) > 0, type: "achievement", title: "🏆 Cash Flow Positive", message: "Your portfolio generates positive cash flow. You're ahead." },
    ];
    achievements.forEach(a => {
      if (a.condition) {
        const key = `${a.type}:${a.message}`;
        if (!existingKeys.has(key)) toInsert.push({ user_id: user.id, type: a.type, title: a.title, message: a.message, read: false });
      }
    });

    if (toInsert.length > 0) {
      await supabase.from("notifications").insert(toInsert);
      loadNotifications();
    }
  }

  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setNotifications(notifications.map(n => ({ ...n, read: true })));
    setUnread(0);
  }

  async function clearAll() {
    await supabase.from("notifications").delete().eq("user_id", user.id);
    setNotifications([]); setUnread(0);
  }

  function notifColor(type: string) {
    if (type === "achievement") return { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" };
    if (type === "alert_cashflow") return { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" };
    return { color: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.2)" };
  }

  function timeAgo(date: string) {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return "just now"; if (s < 3600) return `${Math.floor(s/60)}m ago`;
    if (s < 86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`;
  }

  const badgeColor = notifications.some(n => !n.read && n.type === "alert_cashflow") ? "#f87171" : "#60a5fa";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => { setOpen(!open); if (!open && unread > 0) markAllRead(); }} style={{ position: "relative", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.6)", fontSize: "15px" }}>
        🔔
        {unread > 0 && <span style={{ position: "absolute", top: "-4px", right: "-4px", background: badgeColor, color: "#fff", borderRadius: "999px", fontSize: "9px", fontWeight: "800", minWidth: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", boxShadow: `0 0 8px ${badgeColor}88` }}>{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div style={{ position: "absolute", top: "40px", right: 0, width: "340px", background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", zIndex: 200, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", fontWeight: "700" }}>Notifications</span>
            <div style={{ display: "flex", gap: "8px" }}>
              {unread > 0 && <button onClick={markAllRead} style={{ fontSize: "10px", color: "#60a5fa", background: "none", border: "none", cursor: "pointer" }}>Mark all read</button>}
              {notifications.length > 0 && <button onClick={clearAll} style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer" }}>Clear all</button>}
            </div>
          </div>
          <div style={{ maxHeight: "400px", overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: "12px" }}>No notifications yet</div>
            ) : notifications.map(n => {
              const c = notifColor(n.type);
              return (
                <div key={n.id} style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: n.read ? "transparent" : "rgba(96,165,250,0.03)", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: n.read ? "transparent" : c.color, flexShrink: 0, marginTop: "5px", boxShadow: n.read ? "none" : `0 0 6px ${c.color}` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "12px", fontWeight: "700", color: c.color, marginBottom: "2px" }}>{n.title}</p>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", lineHeight: "1.4" }}>{n.message}</p>
                    <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "4px" }}>{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════════
// GOLDSTREAM — DEAL LAB v2.0
// Features: Deal Analyzer · Deal Score · Deadline Counter · Strategy Engine
//           Market Pulse · AI Deal Coach · Deal Room · Professionals
// Psychology: Variable reward · Loss aversion · Progress visibility · Identity
// ═══════════════════════════════════════════════════════════════════════


// ── Types ────────────────────────────────────────────────────────────
type DealTier = "p" | "a" | "b";
type DealVerdict = "STRONG BUY" | "WATCH" | "PASS" | "ANALYZE";

interface AnalyzerResult {
  cashFlow: number;
  capRate: number;
  roi: number;
  cocReturn: number;
  breakEven: number;
  paybackYears: number;
  grm: number;
  ltv: number;
  dscr: number;
  verdict: DealVerdict;
  score: number;
  strengths: string[];
  warnings: string[];
}

interface DealAnalysis {
  id: number;
  name: string;
  project_type: string;
  tier: DealTier;
  capital?: string;
  geography?: string;
  risk?: string;
  notes?: string;
  deadline?: string;
  completeness: number;
  status: string;
  checklist: { label: string; done: boolean }[];
  deal_score?: number;
  analyzer_data?: string;
}

// ── Constants ─────────────────────────────────────────────────────────
const TIER_META = {
  p: { label: "Passive",  desc: "0–5h/week · 8–15%",  color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.2)"  },
  a: { label: "Active",   desc: "5–20h/week · 20–40%", color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.2)"  },
  b: { label: "Business", desc: "20h+/week · 40–90%+", color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)" },
};

const VERDICT_META: Record<DealVerdict, { color: string; bg: string; icon: string; pulse: boolean }> = {
  "STRONG BUY": { color: "#34d399", bg: "rgba(52,211,153,0.15)",  icon: "🚀", pulse: true  },
  "WATCH":      { color: "#f59e0b", bg: "rgba(245,158,11,0.15)",  icon: "👁", pulse: false },
  "PASS":       { color: "#f87171", bg: "rgba(248,113,113,0.15)", icon: "🚫", pulse: false },
  "ANALYZE":    { color: "#60a5fa", bg: "rgba(96,165,250,0.15)",  icon: "🔍", pulse: false },
};

const PROJECTS = [
  { id:"reit",    tier:"p" as DealTier, name:"REIT investment",          roi:"8–12%",  cap:"$1k min",   time:"0h/wk",   risk:"Low",      fill:55, desc:"Buy shares in a publicly traded real estate investment trust. Fully hands-off, liquid like a stock, quarterly dividends.", chips:["Dividends","Liquid","Tax-advantaged"], riskDetail:"Low — publicly regulated, diversified, can lose value in downturns" },
  { id:"note",    tier:"p" as DealTier, name:"Mortgage note",            roi:"8–13%",  cap:"$50k min",  time:"1h/wk",   risk:"Low",      fill:60, desc:"Buy an existing mortgage at a discount. You collect monthly interest secured by real property.", chips:["Monthly income","Secured","No tenants"], riskDetail:"Low — secured by deed, defaults can be slow/costly" },
  { id:"crowd",   tier:"p" as DealTier, name:"Crowdfunding LP",          roi:"7–14%",  cap:"$5k min",   time:"1h/wk",   risk:"Low-Med",  fill:52, desc:"Invest as LP in large deals via Fundrise or CrowdStreet. Platform manages everything.", chips:["Diversified","Platform-managed","Quarterly reports"], riskDetail:"Low-Med — platform risk, illiquidity, project-specific" },
  { id:"land",    tier:"p" as DealTier, name:"Land banking",             roi:"10–30%", cap:"$20k min",  time:"2h/wk",   risk:"Med",      fill:58, desc:"Buy undeveloped land in the path of growth. No tenants, minimal maintenance. Long-term play.", chips:["Long-term hold","No maintenance","Appreciation"], riskDetail:"Med — illiquid, no income stream, zoning risk" },
  { id:"turnkey", tier:"p" as DealTier, name:"Turnkey rental",           roi:"8–11%",  cap:"$80k min",  time:"3h/wk",   risk:"Low",      fill:62, desc:"Buy fully renovated, tenant-occupied property managed by a PM. Cash flow from day one.", chips:["Fully managed","Cash flow day 1","Remote-friendly"], riskDetail:"Low — PM fees reduce returns, turnkey premiums thin margins" },
  { id:"syndlp",  tier:"p" as DealTier, name:"Syndication LP",           roi:"12–18%", cap:"$50k min",  time:"2h/wk",   risk:"Med",      fill:65, desc:"Silent LP in large apartment/commercial deals. GP runs everything. 5–7yr lockup.", chips:["Big deals access","Tax benefits","5–7yr lockup"], riskDetail:"Med — capital locked, depends entirely on GP competence" },
  { id:"dscr",    tier:"p" as DealTier, name:"DSCR rental + PM",         roi:"9–13%",  cap:"$70k min",  time:"3h/wk",   risk:"Low-Med",  fill:59, desc:"DSCR loan (qualified by rental income) + property manager. Scalable portfolio model.", chips:["Leverage","PM handles ops","Scalable"], riskDetail:"Low-Med — PM fees 8–10%, vacancy still hurts" },
  { id:"str",     tier:"a" as DealTier, name:"Short-term rental",        roi:"20–35%", cap:"$80k min",  time:"10h/wk",  risk:"Med",      fill:88, desc:"Airbnb/VRBO. High nightly rates, active management, dynamic pricing, guest comms.", chips:["High yield","Dynamic pricing","Regulation risk"], riskDetail:"Med — regulation risk high, seasonality, high turnover costs" },
  { id:"brrrr",   tier:"a" as DealTier, name:"BRRRR strategy",           roi:"25–40%", cap:"$60k min",  time:"15h/wk",  risk:"Med",      fill:82, desc:"Buy distressed, Rehab, Rent, Refinance, Repeat. Recycle capital to fund next deal.", chips:["Capital recycling","Forced appreciation","Contractors required"], riskDetail:"Med — rehab cost overruns, appraisal risk at refinance" },
  { id:"hack",    tier:"a" as DealTier, name:"House hacking",            roi:"15–25%", cap:"$50k min",  time:"6h/wk",   risk:"Low",      fill:79, desc:"Live in one unit of a multi-family, rent the others. Offset/eliminate housing cost.", chips:["Low entry","FHA eligible","Live-in required"], riskDetail:"Low — must live on site, proximity to tenants" },
  { id:"midterm", tier:"a" as DealTier, name:"Mid-term rental",          roi:"18–28%", cap:"$75k min",  time:"8h/wk",   risk:"Low-Med",  fill:84, desc:"Furnished 1–6 month rentals for nurses, contractors. Higher than LTR, less reg than STR.", chips:["Stable demand","Less regulation","Furnished premium"], riskDetail:"Low-Med — furnished costs more upfront, vacancy between stays" },
  { id:"flip",    tier:"a" as DealTier, name:"Fix & flip",               roi:"30–50%", cap:"$100k min", time:"20h/wk",  risk:"High",     fill:71, desc:"Buy distressed, renovate fast, sell at market. Short-cycle project income.", chips:["Short cycle","High profit","Execution risk"], riskDetail:"High — holding costs, overruns, market timing critical" },
  { id:"small",   tier:"a" as DealTier, name:"Small multifamily (2–4)",  roi:"12–20%", cap:"$100k min", time:"8h/wk",   risk:"Low-Med",  fill:80, desc:"Duplex/triplex/quad. Multiple income streams, residential financing, scalable.", chips:["Residential loans","Scalable","Multiple incomes"], riskDetail:"Low-Med — one vacancy hurts proportionally more" },
  { id:"colive",  tier:"a" as DealTier, name:"Co-living house",          roi:"20–35%", cap:"$80k min",  time:"10h/wk",  risk:"Med",      fill:76, desc:"Rent individual bedrooms. 2–3× rent of single tenant, 20–30% below studio per room.", chips:["High yield/sqft","Young professionals","High turnover"], riskDetail:"Med — high tenant turnover, house rules management" },
  { id:"sto",     tier:"a" as DealTier, name:"Storage unit facility",    roi:"15–25%", cap:"$200k min", time:"8h/wk",   risk:"Low-Med",  fill:77, desc:"Recession-resistant. Low maintenance, no live-in tenants, automatable with gate tech.", chips:["Recession-proof","Low tenant issues","Scalable"], riskDetail:"Low-Med — competition from REITs, location is everything" },
  { id:"large",   tier:"b" as DealTier, name:"Large multifamily (5+)",   roi:"15–25%", cap:"$500k min", time:"20h/wk",  risk:"Med",      fill:72, desc:"Apartment buildings with commercial financing. Economies of scale.", chips:["Commercial financing","Scale","Team required"], riskDetail:"Med — larger capital at risk, commercial financing stricter" },
  { id:"boutique",tier:"b" as DealTier, name:"Boutique hotel",           roi:"25–45%", cap:"$500k min", time:"30h/wk",  risk:"High",     fill:65, desc:"6–30 room premium property. Unique experience drives RevPAR above chain hotels.", chips:["Brand value","High RevPAR","Operational complexity"], riskDetail:"High — hospitality complex, event risks crush revenue" },
  { id:"venue",   tier:"b" as DealTier, name:"Wedding / event venue",    roi:"40–90%", cap:"$300k min", time:"35h/wk",  risk:"Med-High", fill:80, desc:"Weekend bookings drive high per-event revenue. Built 18–24mo in advance.", chips:["Weekend model","High per-event","Seasonal"], riskDetail:"Med-High — seasonal, weather-dependent, permits required" },
  { id:"student", tier:"b" as DealTier, name:"Student housing",          roi:"20–35%", cap:"$200k min", time:"20h/wk",  risk:"Med",      fill:74, desc:"High-density near universities. Annual demand cycle. Lease by room.", chips:["Consistent demand","Annual leases","High density"], riskDetail:"Med — high turnover, university enrollment changes" },
  { id:"mixed",   tier:"b" as DealTier, name:"Mixed-use development",    roi:"20–40%", cap:"$1M+ min",  time:"40h/wk",  risk:"High",     fill:58, desc:"Retail below, residential above. Complex but multiple income streams.", chips:["Multiple incomes","Appreciation","Long cycle"], riskDetail:"High — long development, retail leasing risk, complex permits" },
  { id:"ground",  tier:"b" as DealTier, name:"Ground-up residential",    roi:"30–60%", cap:"$300k min", time:"40h/wk",  risk:"Very High",fill:55, desc:"Build new from raw land. Maximum margin, maximum complexity.", chips:["Max profit","Full control","Timeline risk"], riskDetail:"Very High — overruns, permit delays, no income during construction" },
  { id:"glamping",tier:"b" as DealTier, name:"Glamping / eco-resort",    roi:"35–80%", cap:"$150k min", time:"25h/wk",  risk:"Med-High", fill:70, desc:"Safari tents, domes on scenic land. High nightly rates, low permit burden.", chips:["High nightly rates","Low build cost","Experience economy"], riskDetail:"Med-High — weather dependent, remote challenges" },
];

const GEOS = ["United States","Canada","France","Morocco","Spain","UAE","United Kingdom","Germany","Australia","Open to any"];
const RISK_COLOR: Record<string, string> = {
  "Low":"#34d399","Low-Med":"#34d399","Med":"#f59e0b","Med-High":"#f87171","High":"#f87171","Very High":"#f87171"
};


// ── Deal Score Calculator ─────────────────────────────────────────────
function calcDealScore(checklist: {done:boolean}[], deadline: string | undefined, completeness: number): number {
  let score = completeness * 0.6;
  const days = deadline ? daysUntil(deadline) : null;
  if (days !== null) {
    if (days > 30) score += 20;
    else if (days > 14) score += 15;
    else if (days > 7) score += 10;
    else if (days > 0) score += 5;
  }
  const done = checklist.filter(c => c.done).length;
  if (done >= checklist.length * 0.8) score += 20;
  return Math.min(100, Math.round(score));
}

// ── Analyzer Engine ───────────────────────────────────────────────────
function runAnalyzer(inputs: {
  purchasePrice: number; downPayment: number; interestRate: number;
  loanTerm: number; monthlyRent: number; monthlyExpenses: number;
  annualAppreciation: number; closingCosts: number; rehabCost: number;
}): AnalyzerResult {
  const { purchasePrice, downPayment, interestRate, loanTerm, monthlyRent, monthlyExpenses, annualAppreciation, closingCosts, rehabCost } = inputs;
  const loanAmount = purchasePrice - downPayment;
  const monthlyRate = interestRate / 100 / 12;
  const n = loanTerm * 12;
  const monthlyMortgage = loanAmount > 0 && monthlyRate > 0
    ? loanAmount * (monthlyRate * Math.pow(1+monthlyRate, n)) / (Math.pow(1+monthlyRate, n)-1)
    : 0;
  const totalMonthlyExpenses = monthlyExpenses + monthlyMortgage;
  const cashFlow = monthlyRent - totalMonthlyExpenses;
  const noi = (monthlyRent - monthlyExpenses) * 12;
  const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0;
  const totalInvested = downPayment + closingCosts + rehabCost;
  const roi = totalInvested > 0 ? (((cashFlow * 12) / totalInvested) * 100) : 0;
  const cocReturn = totalInvested > 0 ? ((cashFlow * 12) / totalInvested) * 100 : 0;
  const ltv = purchasePrice > 0 ? (loanAmount / purchasePrice) * 100 : 0;
  const grm = monthlyRent > 0 ? purchasePrice / (monthlyRent * 12) : 0;
  const dscr = monthlyMortgage > 0 ? (monthlyRent - monthlyExpenses) / monthlyMortgage : 0;
  const breakEven = monthlyRent > 0 ? (totalMonthlyExpenses / monthlyRent) * 100 : 100;
  const paybackYears = cashFlow > 0 && totalInvested > 0 ? totalInvested / (cashFlow * 12) : Infinity;

  const strengths: string[] = [];
  const warnings: string[] = [];

  if (cashFlow > 0) strengths.push("Positive cash flow");
  if (capRate >= 8) strengths.push(`Strong cap rate (${fmtPct(capRate)})`);
  if (dscr >= 1.25) strengths.push(`Healthy DSCR (${dscr.toFixed(2)}x)`);
  if (cocReturn >= 8) strengths.push(`Solid CoC return (${fmtPct(cocReturn)})`);
  if (ltv <= 75) strengths.push("Conservative leverage");
  if (annualAppreciation >= 4) strengths.push(`Strong appreciation (${annualAppreciation}%/yr)`);

  if (cashFlow < 0) warnings.push("Negative monthly cash flow");
  if (capRate < 5) warnings.push(`Low cap rate (${fmtPct(capRate)})`);
  if (dscr < 1.25 && dscr > 0) warnings.push(`Thin DSCR (${dscr.toFixed(2)}x — lenders want 1.25+)`);
  if (ltv > 80) warnings.push(`High leverage (${fmtPct(ltv)} LTV)`);
  if (breakEven > 85) warnings.push(`High break-even occupancy (${fmtPct(breakEven)})`);
  if (grm > 15) warnings.push(`High GRM (${grm.toFixed(1)} — overpaying for rent income)`);

  let score = 50;
  score += Math.min(20, Math.max(-20, cashFlow / 50));
  score += capRate >= 8 ? 15 : capRate >= 5 ? 5 : -10;
  score += dscr >= 1.25 ? 10 : dscr >= 1.0 ? 0 : -15;
  score += cocReturn >= 8 ? 10 : cocReturn >= 5 ? 3 : -5;
  score = Math.min(100, Math.max(0, Math.round(score)));

  const verdict: DealVerdict = score >= 70 ? "STRONG BUY" : score >= 50 ? "WATCH" : score >= 30 ? "ANALYZE" : "PASS";

  return { cashFlow, capRate, roi, cocReturn, breakEven, paybackYears: isFinite(paybackYears) ? paybackYears : 99, grm, ltv, dscr, verdict, score, strengths, warnings };
}

// ── Strategy Projection ───────────────────────────────────────────────
function projectStrategy(purchasePrice: number, equity: number, monthlyRent: number, monthlyExpenses: number, appreciation: number, years = 5) {
  const results: Record<string, {label: string; color: string; icon: string; netWorth5yr: number; totalCashFlow: number; capitalFreed: number; verdict: string; metrics: {label:string;value:string}[]}> = {};

  // Hold & Rent
  const holdAppreciation = purchasePrice * (Math.pow(1+appreciation/100, years) - 1);
  const holdEquityGain = holdAppreciation;
  const holdCashFlow = (monthlyRent - monthlyExpenses) * 12 * years;
  results.hold = { label:"Hold & Rent", color:"#34d399", icon:"🏠", netWorth5yr: equity + holdEquityGain + holdCashFlow, totalCashFlow: holdCashFlow, capitalFreed: 0, verdict: "Wealth builder", metrics:[{label:"Appreciation gain",value:fmt(holdAppreciation)},{label:"Total cash flow",value:fmt(holdCashFlow)},{label:"Equity growth",value:fmt(equity + holdEquityGain)}] };

  // BRRRR (refinance, pull equity, buy another)
  const refiLoanAmount = purchasePrice * 0.75;
  const originalMortgage = purchasePrice - equity;
  const capitalPulled = Math.max(0, refiLoanAmount - originalMortgage);
  const newMonthlyPayment = refiLoanAmount * (0.07/12) * Math.pow(1+0.07/12,360) / (Math.pow(1+0.07/12,360)-1);
  const brrrCashFlow = (monthlyRent - monthlyExpenses - newMonthlyPayment) * 12 * years;
  const brrrNewPropertyEquity = capitalPulled * 0.25; // 25% equity on next deal
  results.brrrr = { label:"BRRRR", color:"#a78bfa", icon:"🔄", netWorth5yr: equity + holdEquityGain + brrrCashFlow + brrrNewPropertyEquity, totalCashFlow: brrrCashFlow, capitalFreed: capitalPulled, verdict:"Fastest scale", metrics:[{label:"Capital recycled",value:fmt(capitalPulled)},{label:"New deal equity",value:fmt(brrrNewPropertyEquity)},{label:"Total net worth delta",value:fmt(equity + holdEquityGain + brrrCashFlow + brrrNewPropertyEquity)}] };

  // Sell
  const saleProceeds = purchasePrice * Math.pow(1+appreciation/100, 1) * 0.94; // 6% selling costs
  const capitalGainsTax = Math.max(0, (saleProceeds - purchasePrice) * 0.20);
  const sellNetProfit = saleProceeds - originalMortgage - capitalGainsTax;
  results.sell = { label:"Sell Now", color:"#f59e0b", icon:"💰", netWorth5yr: sellNetProfit, totalCashFlow: 0, capitalFreed: sellNetProfit, verdict:"Immediate liquidity", metrics:[{label:"Net proceeds",value:fmt(sellNetProfit)},{label:"Capital gains tax",value:fmt(capitalGainsTax)},{label:"Freed capital",value:fmt(sellNetProfit)}] };

  // STR conversion
  const strMonthlyRent = monthlyRent * 2.2; // STR typically 2–2.5× LTR
  const strExpenses = monthlyExpenses * 1.4; // Higher costs
  const strCashFlow = (strMonthlyRent - strExpenses) * 12 * years;
  results.str = { label:"Convert to STR", color:"#60a5fa", icon:"🏖", netWorth5yr: equity + holdEquityGain + strCashFlow, totalCashFlow: strCashFlow, capitalFreed: 0, verdict:"Max cash flow", metrics:[{label:"Projected STR rent",value:fmt(strMonthlyRent)+"/mo"},{label:"5yr cash flow",value:fmt(strCashFlow)},{label:"Total net worth",value:fmt(equity + holdEquityGain + strCashFlow)}] };

  return results;
}

// ── Sub-components ────────────────────────────────────────────────────

function DeadlineCounter({ deadline }: { deadline?: string }) {
  if (!deadline) return null;
  const days = daysUntil(deadline);
  if (days === null) return null;
  const urgent = days <= 7;
  const overdue = days < 0;
  const color = overdue ? "#f87171" : urgent ? "#f59e0b" : "#60a5fa";
  const pct = Math.max(0, Math.min(100, (days / 30) * 100));
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
      <div style={{ position:"relative", width:"36px", height:"36px" }}>
        <svg width="36" height="36" style={{ transform:"rotate(-90deg)" }}>
          <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3"/>
          <circle cx="18" cy="18" r="14" fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${2*Math.PI*14}`} strokeDashoffset={`${2*Math.PI*14*(1-pct/100)}`} style={{transition:"stroke-dashoffset 0.8s"}}/>
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize:"8px", fontWeight:"900", color }}>{overdue ? "!" : days}</span>
        </div>
      </div>
      <div>
        <p style={{ fontSize:"10px", fontWeight:"800", color, lineHeight:1 }}>
          {overdue ? `${Math.abs(days)}d OVERDUE` : days === 0 ? "TODAY" : `${days}d left`}
        </p>
        <p style={{ fontSize:"9px", color:"rgba(255,255,255,0.25)", marginTop:"1px" }}>Decide by {new Date(deadline).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</p>
      </div>
    </div>
  );
}

function DealScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const color = score >= 70 ? "#34d399" : score >= 50 ? "#f59e0b" : "#f87171";
  const r = (size/2) - 4;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3.5"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={`${circ}`}
          strokeDashoffset={`${circ*(1-score/100)}`}
          style={{transition:"stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)"}}
          strokeLinecap="round"/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize:size > 50 ? "15px" : "11px", fontWeight:"900", color, lineHeight:1 }}>{score}</span>
        <span style={{ fontSize:"7px", color:"rgba(255,255,255,0.3)", marginTop:"1px", fontWeight:"700" }}>SCORE</span>
      </div>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: DealVerdict }) {
  const m = VERDICT_META[verdict];
  return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:"6px", padding:"5px 12px", borderRadius:"999px", background:m.bg, border:`1px solid ${m.color}44`, animation:m.pulse?"verdictPulse 2s ease-in-out infinite":"none" }}>
      <span style={{ fontSize:"12px" }}>{m.icon}</span>
      <span style={{ fontSize:"11px", fontWeight:"900", color:m.color, letterSpacing:"1.5px" }}>{verdict}</span>
    </div>
  );
}

// ── DEAL ANALYZER PANEL ───────────────────────────────────────────────
function DealAnalyzerPanel({ onSaveToPipeline }: { onSaveToPipeline: (result: AnalyzerResult, inputs: any) => void }) {
  const [inputs, setInputs] = useState({ purchasePrice:"", downPayment:"", interestRate:"7.0", loanTerm:"30", monthlyRent:"", monthlyExpenses:"", annualAppreciation:"3.5", closingCosts:"", rehabCost:"" });
  const [result, setResult] = useState<AnalyzerResult | null>(null);
  const [projections, setProjections] = useState<ReturnType<typeof projectStrategy> | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [activeStrategy, setActiveStrategy] = useState<string>("hold");

  function setInput(key: string, val: string) { setInputs(prev => ({...prev, [key]:val})); }
  function parseInputs() {
    return {
      purchasePrice: parseFloat(inputs.purchasePrice.replace(/,/g,"")) || 0,
      downPayment: parseFloat(inputs.downPayment.replace(/,/g,"")) || 0,
      interestRate: parseFloat(inputs.interestRate) || 7,
      loanTerm: parseFloat(inputs.loanTerm) || 30,
      monthlyRent: parseFloat(inputs.monthlyRent.replace(/,/g,"")) || 0,
      monthlyExpenses: parseFloat(inputs.monthlyExpenses.replace(/,/g,"")) || 0,
      annualAppreciation: parseFloat(inputs.annualAppreciation) || 3.5,
      closingCosts: parseFloat(inputs.closingCosts.replace(/,/g,"")) || 0,
      rehabCost: parseFloat(inputs.rehabCost.replace(/,/g,"")) || 0,
    };
  }

  function analyze() {
    const parsed = parseInputs();
    if (!parsed.purchasePrice || !parsed.monthlyRent) return;
    setAnalyzing(true);
    setTimeout(() => {
      const res = runAnalyzer(parsed);
      setResult(res);
      const equity = parsed.purchasePrice - (parsed.purchasePrice - parsed.downPayment);
      const projs = projectStrategy(parsed.purchasePrice, equity, parsed.monthlyRent, parsed.monthlyExpenses, parsed.annualAppreciation);
      setProjections(projs);
      setAnalyzing(false);
    }, 600);
  }

  async function fetchAiInsight() {
    if (!result) return;
    setAiLoading(true); setAiInsight("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:200,
          messages:[{ role:"user", content:`Real estate deal analyst. Give ONE sharp 2-sentence verdict on this deal. Be specific, use the numbers. Score: ${result.score}/100. Cash flow: $${Math.round(result.cashFlow)}/mo. Cap rate: ${result.capRate.toFixed(1)}%. CoC: ${result.cocReturn.toFixed(1)}%. DSCR: ${result.dscr.toFixed(2)}. LTV: ${result.ltv.toFixed(0)}%. Strengths: ${result.strengths.join(", ")}. Warnings: ${result.warnings.join(", ")}.` }]
        })
      });
      const d = await res.json();
      setAiInsight(d.content?.find((b:any)=>b.type==="text")?.text || "");
    } catch {}
    setAiLoading(false);
  }

  const IS: React.CSSProperties = { width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"10px", padding:"10px 14px", fontSize:"14px", fontWeight:"700", color:"#fff", outline:"none", fontFamily:"'DM Sans',sans-serif", boxSizing:"border-box" };

  const strategyKeys = projections ? Object.keys(projections) : [];
  const maxNW = projections ? Math.max(...strategyKeys.map(k => projections[k].netWorth5yr)) : 1;

  return (
    <div>
      {/* Input grid */}
      <div style={{ background:"linear-gradient(135deg,rgba(96,165,250,0.06),rgba(96,165,250,0.02))", border:"1px solid rgba(96,165,250,0.2)", borderRadius:"20px", padding:"24px", marginBottom:"20px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"20px" }}>
          <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#60a5fa", boxShadow:"0 0 8px #60a5fa", animation:"blink 1.5s infinite" }}/>
          <span style={{ fontSize:"10px", color:"rgba(96,165,250,0.7)", letterSpacing:"2px", fontWeight:"800", textTransform:"uppercase" }}>Deal Analyzer — Instant ROI Verdict</span>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"12px", marginBottom:"12px" }}>
          {[
            {label:"Purchase Price ($)", key:"purchasePrice", placeholder:"350,000"},
            {label:"Down Payment ($)", key:"downPayment", placeholder:"70,000"},
            {label:"Monthly Rent ($)", key:"monthlyRent", placeholder:"2,400"},
            {label:"Monthly Expenses ($)", key:"monthlyExpenses", placeholder:"400"},
            {label:"Closing Costs ($)", key:"closingCosts", placeholder:"8,000"},
            {label:"Rehab Budget ($)", key:"rehabCost", placeholder:"0"},
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"1px", display:"block", marginBottom:"6px", fontWeight:"700" }}>{f.label}</label>
              <input type="text" inputMode="numeric" placeholder={f.placeholder} value={(inputs as any)[f.key]} onChange={e=>setInput(f.key,e.target.value)} style={IS} />
            </div>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px", marginBottom:"20px" }}>
          <div>
            <label style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"1px", display:"block", marginBottom:"6px", fontWeight:"700" }}>Interest Rate (%)</label>
            <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
              <input type="range" min="3" max="12" step="0.25" value={inputs.interestRate} onChange={e=>setInput("interestRate",e.target.value)} style={{ flex:1, accentColor:"#60a5fa" }}/>
              <span style={{ fontSize:"14px", fontWeight:"900", color:"#60a5fa", minWidth:"40px" }}>{inputs.interestRate}%</span>
            </div>
          </div>
          <div>
            <label style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"1px", display:"block", marginBottom:"6px", fontWeight:"700" }}>Loan Term (yrs)</label>
            <div style={{ display:"flex", gap:"6px" }}>
              {[15,20,25,30].map(t=>(
                <button key={t} onClick={()=>setInput("loanTerm",String(t))} style={{ flex:1, padding:"8px 4px", borderRadius:"8px", fontSize:"11px", fontWeight:"800", border:`1px solid ${inputs.loanTerm===String(t)?"rgba(96,165,250,0.5)":"rgba(255,255,255,0.08)"}`, background:inputs.loanTerm===String(t)?"rgba(96,165,250,0.15)":"rgba(255,255,255,0.03)", color:inputs.loanTerm===String(t)?"#60a5fa":"rgba(255,255,255,0.4)", cursor:"pointer" }}>{t}yr</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"1px", display:"block", marginBottom:"6px", fontWeight:"700" }}>Appreciation %/yr</label>
            <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
              <input type="range" min="0" max="10" step="0.5" value={inputs.annualAppreciation} onChange={e=>setInput("annualAppreciation",e.target.value)} style={{ flex:1, accentColor:"#34d399" }}/>
              <span style={{ fontSize:"14px", fontWeight:"900", color:"#34d399", minWidth:"40px" }}>{inputs.annualAppreciation}%</span>
            </div>
          </div>
        </div>

        <button onClick={analyze} disabled={analyzing || !inputs.purchasePrice || !inputs.monthlyRent} style={{ width:"100%", padding:"14px", background:(!inputs.purchasePrice||!inputs.monthlyRent)?"rgba(96,165,250,0.2)":"#60a5fa", color:(!inputs.purchasePrice||!inputs.monthlyRent)?"rgba(255,255,255,0.3)":"#000", borderRadius:"12px", fontWeight:"900", fontSize:"15px", border:"none", cursor:(!inputs.purchasePrice||!inputs.monthlyRent)?"not-allowed":"pointer", letterSpacing:"0.5px", transition:"all 0.2s" }}>
          {analyzing ? "⚡ Analyzing deal..." : "⚡ Run Analysis →"}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div style={{ animation:"fadeInUp 0.4s ease" }}>
          {/* Verdict hero */}
          <div style={{ background:`linear-gradient(135deg,${VERDICT_META[result.verdict].bg},rgba(0,0,0,0.3))`, border:`1px solid ${VERDICT_META[result.verdict].color}44`, borderRadius:"20px", padding:"28px 32px", marginBottom:"16px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"16px" }}>
            <div>
              <p style={{ fontSize:"10px", color:"rgba(255,255,255,0.4)", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"10px", fontWeight:"700" }}>Deal Verdict</p>
              <VerdictBadge verdict={result.verdict}/>
              <p style={{ fontSize:"13px", color:"rgba(255,255,255,0.5)", marginTop:"12px", maxWidth:"400px", lineHeight:"1.6" }}>
                Score {result.score}/100 · {result.strengths.length} strengths · {result.warnings.length} warnings
              </p>
            </div>
            <div style={{ display:"flex", gap:"16px", alignItems:"center" }}>
              <DealScoreRing score={result.score} size={80}/>
              <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                <div style={{ textAlign:"right" }}>
                  <p style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", marginBottom:"2px", textTransform:"uppercase", letterSpacing:"1px" }}>Monthly Cash Flow</p>
                  <p style={{ fontSize:"28px", fontWeight:"900", color:result.cashFlow>=0?"#34d399":"#f87171", letterSpacing:"-1px" }}>{result.cashFlow>=0?"+":""}{fmt(result.cashFlow)}<span style={{ fontSize:"13px" }}>/mo</span></p>
                </div>
              </div>
            </div>
          </div>

          {/* Metrics grid */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"10px", marginBottom:"16px" }}>
            {[
              {label:"Cap Rate",    value:fmtPct(result.capRate),    color:result.capRate>=8?"#34d399":result.capRate>=5?"#f59e0b":"#f87171", target:"Target: 8%+"},
              {label:"CoC Return",  value:fmtPct(result.cocReturn),  color:result.cocReturn>=8?"#34d399":result.cocReturn>=5?"#f59e0b":"#f87171", target:"Target: 8%+"},
              {label:"DSCR",       value:result.dscr.toFixed(2)+"x", color:result.dscr>=1.25?"#34d399":result.dscr>=1.0?"#f59e0b":"#f87171", target:"Lenders: 1.25+"},
              {label:"LTV",        value:fmtPct(result.ltv),         color:result.ltv<=75?"#34d399":result.ltv<=80?"#f59e0b":"#f87171", target:"Conservative: <75%"},
              {label:"Break-Even", value:fmtPct(result.breakEven),   color:result.breakEven<=80?"#34d399":result.breakEven<=90?"#f59e0b":"#f87171", target:"Target: <80%"},
              {label:"GRM",        value:result.grm.toFixed(1)+"x",  color:result.grm<=12?"#34d399":result.grm<=15?"#f59e0b":"#f87171", target:"Good: <12x"},
              {label:"Payback",    value:result.paybackYears>=99?"Never":result.paybackYears.toFixed(1)+"yr", color:result.paybackYears<=10?"#34d399":result.paybackYears<=15?"#f59e0b":"#f87171", target:"Target: <10yr"},
              {label:"Annual ROI", value:fmtPct(result.roi),         color:result.roi>=10?"#34d399":result.roi>=6?"#f59e0b":"#f87171", target:"Target: 10%+"},
            ].map(m => (
              <div key={m.label} style={{ background:"rgba(255,255,255,0.03)", border:`1px solid ${m.color}22`, borderRadius:"12px", padding:"14px" }}>
                <p style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:"6px", fontWeight:"700" }}>{m.label}</p>
                <p style={{ fontSize:"20px", fontWeight:"900", color:m.color, letterSpacing:"-0.5px" }}>{m.value}</p>
                <p style={{ fontSize:"9px", color:"rgba(255,255,255,0.2)", marginTop:"4px" }}>{m.target}</p>
              </div>
            ))}
          </div>

          {/* Strengths & Warnings */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"16px" }}>
            <div style={{ background:"rgba(52,211,153,0.04)", border:"1px solid rgba(52,211,153,0.15)", borderRadius:"14px", padding:"16px" }}>
              <p style={{ fontSize:"10px", fontWeight:"800", color:"#34d399", letterSpacing:"1px", textTransform:"uppercase", marginBottom:"10px" }}>✅ Strengths ({result.strengths.length})</p>
              {result.strengths.length === 0 ? <p style={{ fontSize:"12px", color:"rgba(255,255,255,0.2)" }}>None identified</p> :
                result.strengths.map((s,i) => <div key={i} style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"6px" }}><div style={{ width:"5px", height:"5px", borderRadius:"50%", background:"#34d399", flexShrink:0 }}/><span style={{ fontSize:"12px", color:"rgba(255,255,255,0.65)" }}>{s}</span></div>)}
            </div>
            <div style={{ background:"rgba(248,113,113,0.04)", border:"1px solid rgba(248,113,113,0.15)", borderRadius:"14px", padding:"16px" }}>
              <p style={{ fontSize:"10px", fontWeight:"800", color:"#f87171", letterSpacing:"1px", textTransform:"uppercase", marginBottom:"10px" }}>⚠ Warnings ({result.warnings.length})</p>
              {result.warnings.length === 0 ? <p style={{ fontSize:"12px", color:"rgba(255,255,255,0.2)" }}>None — clean deal</p> :
                result.warnings.map((w,i) => <div key={i} style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"6px" }}><div style={{ width:"5px", height:"5px", borderRadius:"50%", background:"#f87171", flexShrink:0 }}/><span style={{ fontSize:"12px", color:"rgba(255,255,255,0.65)" }}>{w}</span></div>)}
            </div>
          </div>

          {/* Strategy Comparison */}
          {projections && (
            <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"20px", padding:"24px", marginBottom:"16px" }}>
              <p style={{ fontSize:"10px", color:"rgba(255,255,255,0.4)", letterSpacing:"1.5px", textTransform:"uppercase", fontWeight:"700", marginBottom:"16px" }}>⚡ Strategy Comparison — 5 Year Net Worth Delta</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"10px", marginBottom:"16px" }}>
                {strategyKeys.map(key => {
                  const s = projections[key];
                  const barPct = maxNW > 0 ? (s.netWorth5yr / maxNW) * 100 : 0;
                  const isBest = s.netWorth5yr === maxNW;
                  const isActive = activeStrategy === key;
                  return (
                    <div key={key} onClick={()=>setActiveStrategy(key)} style={{ background:isActive?`${s.color}12`:"rgba(255,255,255,0.02)", border:`1px solid ${isActive?s.color+"55":"rgba(255,255,255,0.07)"}`, borderRadius:"14px", padding:"14px", cursor:"pointer", transition:"all 0.2s", position:"relative" }}>
                      {isBest && <div style={{ position:"absolute", top:"-8px", left:"50%", transform:"translateX(-50%)", fontSize:"9px", fontWeight:"900", color:s.color, background:`${s.color}20`, border:`1px solid ${s.color}44`, borderRadius:"999px", padding:"2px 8px", whiteSpace:"nowrap" }}>★ BEST</div>}
                      <div style={{ fontSize:"18px", marginBottom:"6px" }}>{s.icon}</div>
                      <p style={{ fontSize:"11px", fontWeight:"800", color:s.color, marginBottom:"8px" }}>{s.label}</p>
                      <p style={{ fontSize:"18px", fontWeight:"900", color:isBest?s.color:"#fff", letterSpacing:"-0.5px" }}>{fmt(s.netWorth5yr)}</p>
                      <p style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", marginBottom:"8px" }}>5yr net worth</p>
                      <div style={{ height:"3px", background:"rgba(255,255,255,0.06)", borderRadius:"999px" }}>
                        <div style={{ height:"100%", width:`${barPct}%`, background:s.color, borderRadius:"999px", transition:"width 0.8s" }}/>
                      </div>
                      <p style={{ fontSize:"9px", color:s.color, marginTop:"5px", fontWeight:"700" }}>{s.verdict}</p>
                    </div>
                  );
                })}
              </div>
              {/* Active strategy detail */}
              {projections[activeStrategy] && (
                <div style={{ background:`${projections[activeStrategy].color}08`, border:`1px solid ${projections[activeStrategy].color}22`, borderRadius:"12px", padding:"14px 18px", display:"flex", gap:"24px", flexWrap:"wrap" }}>
                  {projections[activeStrategy].metrics.map((m:any) => (
                    <div key={m.label}>
                      <p style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:"3px" }}>{m.label}</p>
                      <p style={{ fontSize:"15px", fontWeight:"800", color:projections[activeStrategy].color }}>{m.value}</p>
                    </div>
                  ))}
                  {projections[activeStrategy].capitalFreed > 0 && (
                    <div>
                      <p style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:"3px" }}>Capital freed</p>
                      <p style={{ fontSize:"15px", fontWeight:"800", color:"#f59e0b" }}>{fmt(projections[activeStrategy].capitalFreed)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* AI Insight */}
          <div style={{ background:"rgba(245,158,11,0.04)", border:"1px solid rgba(245,158,11,0.15)", borderRadius:"14px", padding:"16px 20px", marginBottom:"16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
              <p style={{ fontSize:"10px", fontWeight:"800", color:"#f59e0b", letterSpacing:"1px", textTransform:"uppercase" }}>🤖 AI Deal Coach</p>
              <button onClick={fetchAiInsight} disabled={aiLoading} style={{ fontSize:"11px", padding:"5px 12px", background:aiLoading?"rgba(245,158,11,0.1)":"#f59e0b", color:aiLoading?"#f59e0b":"#000", border:"none", borderRadius:"7px", cursor:aiLoading?"not-allowed":"pointer", fontWeight:"800" }}>{aiLoading?"Thinking...":"Get Insight"}</button>
            </div>
            {aiInsight ? <p style={{ fontSize:"13px", color:"rgba(255,255,255,0.7)", lineHeight:"1.6" }}>{aiInsight}</p> : <p style={{ fontSize:"12px", color:"rgba(255,255,255,0.25)" }}>Click "Get Insight" for an AI-powered verdict on this specific deal.</p>}
          </div>

          {/* CTA: Save to pipeline */}
          <button onClick={()=>onSaveToPipeline(result, parseInputs())} style={{ width:"100%", padding:"13px", background:"linear-gradient(90deg,#60a5fa,#a78bfa)", color:"#000", borderRadius:"12px", fontWeight:"900", fontSize:"14px", border:"none", cursor:"pointer", letterSpacing:"0.5px" }}>
            + Save This Deal to Analysis Pipeline →
          </button>
        </div>
      )}
    </div>
  );
}

// ── MARKET PULSE PANEL ────────────────────────────────────────────────
function MarketPulsePanel({ geography }: { geography?: string }) {
  const FRED_KEY = "a2b027856e3e343954232c295ac10ce9";
  const [metrics, setMetrics] = useState<Record<string,any>>({});
  const [loading, setLoading] = useState(true);
  const [aiPulse, setAiPulse] = useState("");
  const [pulseLoading, setPulseLoading] = useState(false);

  const SERIES = [
    {key:"mortgage30", id:"MORTGAGE30US", label:"30-Yr Rate", unit:"%"},
    {key:"cpi",        id:"CPIAUCSL",     label:"CPI Inflation", unit:"pts"},
    {key:"lumber",     id:"WPU081",       label:"Lumber Index", unit:"pts"},
    {key:"natgas",     id:"MHHNGSP",      label:"Natural Gas", unit:"$/MMBtu"},
    {key:"fedrate",    id:"FEDFUNDS",     label:"Fed Rate", unit:"%"},
    {key:"vacancy",    id:"RRVRUSQ156N",  label:"Rental Vacancy", unit:"%"},
  ];

  const FALLBACKS: Record<string,any> = {
    mortgage30:{value:"6.82",change:"+0.12%",up:true}, cpi:{value:"319.1",change:"+0.2%",up:true},
    lumber:{value:"387",change:"-1.4%",up:false}, natgas:{value:"2.14",change:"-3.2%",up:false},
    fedrate:{value:"5.33",change:"0.0%",up:false}, vacancy:{value:"6.6",change:"-0.2%",up:false}
  };

  useEffect(() => {
    async function load() {
      const results: Record<string,any> = {};
      await Promise.all(SERIES.map(async s => {
        try {
          const res = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=2`);
          const data = await res.json();
          const obs = data.observations?.filter((o:any) => o.value !== ".");
          if (obs?.length >= 1) {
            const val = parseFloat(obs[0].value);
            const prev = obs.length > 1 ? parseFloat(obs[1].value) : val;
            const delta = val - prev;
            results[s.key] = { value:val.toFixed(2), change:(delta>=0?"+":"")+((delta/prev)*100).toFixed(1)+"%", up:delta>=0 };
          } else results[s.key] = FALLBACKS[s.key];
        } catch { results[s.key] = FALLBACKS[s.key]; }
      }));
      setMetrics(results); setLoading(false);
    }
    load();
  }, []);

  async function fetchPulse() {
    setPulseLoading(true); setAiPulse("");
    try {
      const summary = Object.entries(metrics).map(([k,v]) => `${k}: ${v.value} (${v.change})`).join(", ");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:150,
          messages:[{ role:"user", content:`Real estate market analyst. Based on these LIVE macro indicators: ${summary}. Give ONE sharp 2-sentence take on what this means for a property investor RIGHT NOW. Be specific, data-driven, actionable.` }]
        })
      });
      const d = await res.json();
      setAiPulse(d.content?.find((b:any)=>b.type==="text")?.text || "");
    } catch {}
    setPulseLoading(false);
  }

  return (
    <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"20px", padding:"20px", marginBottom:"16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px", flexWrap:"wrap", gap:"8px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#34d399", boxShadow:"0 0 6px #34d399", animation:"blink 1.5s infinite" }}/>
          <span style={{ fontSize:"10px", color:"rgba(52,211,153,0.7)", letterSpacing:"2px", fontWeight:"800", textTransform:"uppercase" }}>Market Pulse · Live FRED Data</span>
          {geography && <span style={{ fontSize:"10px", padding:"2px 8px", borderRadius:"999px", background:"rgba(96,165,250,0.1)", color:"#60a5fa", fontWeight:"700", border:"1px solid rgba(96,165,250,0.2)" }}>📍 {geography}</span>}
        </div>
        <button onClick={fetchPulse} disabled={pulseLoading || loading} style={{ fontSize:"11px", padding:"5px 12px", background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.3)", borderRadius:"7px", color:"#34d399", cursor:"pointer", fontWeight:"800" }}>{pulseLoading?"Analyzing...":"🤖 AI Macro Read"}</button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"10px", marginBottom:"14px" }}>
        {SERIES.map(s => {
          const m = metrics[s.key];
          const isInvestorGood = (s.key==="mortgage30"||s.key==="fedrate") ? !m?.up : (s.key==="vacancy"||s.key==="lumber") ? !m?.up : true;
          return (
            <div key={s.key} style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:"12px", padding:"12px 14px" }}>
              <p style={{ fontSize:"8px", color:"rgba(255,255,255,0.25)", textTransform:"uppercase", letterSpacing:"1.5px", fontWeight:"700", marginBottom:"6px" }}>{s.label}</p>
              <p style={{ fontSize:"20px", fontWeight:"900", color:"#f5a623", letterSpacing:"-0.5px" }}>
                {loading?"—":m?.value ?? "—"}
                <span style={{ fontSize:"10px", color:"rgba(255,255,255,0.3)", marginLeft:"3px", fontWeight:"400" }}>{s.unit}</span>
              </p>
              {!loading && m && (
                <p style={{ fontSize:"10px", fontWeight:"700", color:m.up?"#f87171":"#34d399", marginTop:"4px" }}>
                  {m.up?"▲":"▼"} {m.change}
                  <span style={{ fontSize:"9px", color:"rgba(255,255,255,0.2)", fontWeight:"400", marginLeft:"4px" }}>{isInvestorGood?"✓ Good":"↓ Caution"}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>

      {aiPulse && (
        <div style={{ padding:"12px 14px", background:"rgba(52,211,153,0.04)", border:"1px solid rgba(52,211,153,0.15)", borderRadius:"10px" }}>
          <p style={{ fontSize:"12px", color:"rgba(255,255,255,0.65)", lineHeight:"1.6" }}>{aiPulse}</p>
        </div>
      )}
    </div>
  );
}

// ── AI WEEKLY COACH ───────────────────────────────────────────────────
function AIWeeklyCoach({ analyses }: { analyses: DealAnalysis[] }) {
  const [coaching, setCoaching] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  useEffect(() => {
    try { setLastRun(localStorage.getItem("gs_coach_lastrun")); } catch {}
  }, []);

  async function runCoaching() {
    setLoading(true); setCoaching("");
    const summaries = analyses.slice(0,5).map(a => `"${a.name}" (${a.project_type}, ${a.completeness}% analyzed, deadline: ${a.deadline||"none"}, checklist: ${a.checklist.filter(c=>c.done).length}/${a.checklist.length} done)`).join("; ");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:300,
          messages:[{ role:"user", content:`You are a sharp real estate deal coach. The investor has ${analyses.length} deals under analysis: ${summaries}. Give them 3 specific, actionable coaching points this week. Format: **Priority 1** [action]. **Priority 2** [action]. **Priority 3** [action]. Be direct, use their specific deal data, no fluff.` }]
        })
      });
      const d = await res.json();
      const text = d.content?.find((b:any)=>b.type==="text")?.text || "";
      setCoaching(text);
      try { const now = new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}); localStorage.setItem("gs_coach_lastrun",now); setLastRun(now); } catch {}
    } catch { setCoaching("Unable to connect. Try again."); }
    setLoading(false);
  }

  if (analyses.length === 0) return null;

  const incompleteDeals = analyses.filter(a => a.completeness < 100);
  const urgentDeals = analyses.filter(a => a.deadline && (daysUntil(a.deadline) ?? 99) <= 7);

  return (
    <div style={{ background:"linear-gradient(135deg,rgba(245,158,11,0.08),rgba(245,158,11,0.03))", border:"1px solid rgba(245,158,11,0.25)", borderRadius:"20px", padding:"20px 24px", marginBottom:"16px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"14px", flexWrap:"wrap", gap:"10px" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"6px" }}>
            <span style={{ fontSize:"16px" }}>🎯</span>
            <span style={{ fontSize:"11px", color:"rgba(245,158,11,0.8)", letterSpacing:"2px", fontWeight:"800", textTransform:"uppercase" }}>AI Deal Coach — Weekly Priorities</span>
          </div>
          <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
            {urgentDeals.length > 0 && <span style={{ fontSize:"10px", fontWeight:"700", color:"#f87171", background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:"999px", padding:"2px 8px" }}>🔴 {urgentDeals.length} urgent deadline{urgentDeals.length>1?"s":""}</span>}
            {incompleteDeals.length > 0 && <span style={{ fontSize:"10px", fontWeight:"700", color:"#f59e0b", background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:"999px", padding:"2px 8px" }}>⏳ {incompleteDeals.length} deal{incompleteDeals.length>1?"s":""} need work</span>}
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"4px" }}>
          <button onClick={runCoaching} disabled={loading} style={{ fontSize:"12px", padding:"8px 16px", background:loading?"rgba(245,158,11,0.1)":"#f59e0b", color:loading?"#f59e0b":"#000", border:"none", borderRadius:"9px", cursor:loading?"not-allowed":"pointer", fontWeight:"900" }}>{loading?"Coaching...":"Get This Week's Plan"}</button>
          {lastRun && <span style={{ fontSize:"9px", color:"rgba(255,255,255,0.2)" }}>Last: {lastRun}</span>}
        </div>
      </div>
      {coaching ? (
        <div style={{ fontSize:"13px", lineHeight:"1.7", color:"rgba(255,255,255,0.7)" }}>
          {coaching.split("\n").map((line,i) => {
            const m = line.match(/^\*\*(.*?)\*\*(.*)/);
            if (m) return <p key={i} style={{ marginBottom:"10px" }}><span style={{ color:"#f59e0b", fontWeight:"800" }}>{m[1]}</span><span>{m[2]}</span></p>;
            return line ? <p key={i} style={{ marginBottom:"8px" }}>{line}</p> : null;
          })}
        </div>
      ) : (
        <div style={{ display:"flex", gap:"12px", flexWrap:"wrap" }}>
          {analyses.slice(0,3).map(a => {
            const days = a.deadline ? daysUntil(a.deadline) : null;
            const color = days !== null && days <= 7 ? "#f87171" : days !== null && days <= 14 ? "#f59e0b" : "#60a5fa";
            return (
              <div key={a.id} style={{ padding:"10px 14px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"10px", flex:1, minWidth:"160px" }}>
                <p style={{ fontSize:"11px", fontWeight:"700", marginBottom:"4px" }}>{a.name}</p>
                <div style={{ height:"3px", background:"rgba(255,255,255,0.06)", borderRadius:"999px", marginBottom:"4px" }}>
                  <div style={{ height:"100%", width:`${a.completeness}%`, background:a.completeness>=75?"#34d399":a.completeness>=40?"#f59e0b":"#f87171", borderRadius:"999px" }}/>
                </div>
                <p style={{ fontSize:"10px", color:"rgba(255,255,255,0.3)" }}>{a.completeness}% analyzed{days!==null ? ` · ${days < 0?"OVERDUE":days+"d left"}` : ""}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── DEAL ROOM (Community Votes) ───────────────────────────────────────
function DealRoomPanel() {
  // Sample shared deals — in production these come from Supabase public table
  const SAMPLE_DEALS = [
    { id:1, title:"4-plex in Indianapolis", type:"Small multifamily", cap:"8.2%", cashflow:"+$640/mo", verdict:"STRONG BUY" as DealVerdict, votes:{yes:47,no:8,watch:12}, submitted:"2d ago", geo:"Indianapolis, IN" },
    { id:2, title:"STR condo — Scottsdale", type:"Short-term rental", cap:"6.1%", cashflow:"+$1,840/mo", verdict:"WATCH" as DealVerdict, votes:{yes:23,no:31,watch:18}, submitted:"5d ago", geo:"Scottsdale, AZ" },
    { id:3, title:"Duplex house hack — Denver", type:"House hacking", cap:"5.8%", cashflow:"-$120/mo", verdict:"WATCH" as DealVerdict, votes:{yes:14,no:9,watch:41}, submitted:"1d ago", geo:"Denver, CO" },
    { id:4, title:"8-unit apartment — Dallas", type:"Large multifamily", cap:"7.4%", cashflow:"+$2,100/mo", verdict:"STRONG BUY" as DealVerdict, votes:{yes:82,no:11,watch:19}, submitted:"3d ago", geo:"Dallas, TX" },
  ];

  const [voted, setVoted] = useState<Record<number,string>>({});

  function vote(dealId: number, type: string) {
    setVoted(prev => ({...prev, [dealId]:type}));
  }

  return (
    <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"20px", padding:"20px 24px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px", flexWrap:"wrap", gap:"8px" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"4px" }}>
            <span style={{ fontSize:"14px" }}>🏛</span>
            <span style={{ fontSize:"10px", color:"rgba(167,139,250,0.7)", letterSpacing:"2px", fontWeight:"800", textTransform:"uppercase" }}>Deal Room · Community Votes</span>
          </div>
          <p style={{ fontSize:"11px", color:"rgba(255,255,255,0.3)" }}>Real deals, anonymized. What would you do?</p>
        </div>
        <button style={{ fontSize:"11px", padding:"7px 14px", background:"rgba(167,139,250,0.1)", border:"1px solid rgba(167,139,250,0.3)", borderRadius:"8px", color:"#a78bfa", cursor:"pointer", fontWeight:"800" }}>+ Share a Deal</button>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
        {SAMPLE_DEALS.map(deal => {
          const totalVotes = deal.votes.yes + deal.votes.no + deal.votes.watch;
          const yesPct = totalVotes > 0 ? (deal.votes.yes / totalVotes) * 100 : 0;
          const noPct = totalVotes > 0 ? (deal.votes.no / totalVotes) * 100 : 0;
          const myVote = voted[deal.id];
          const vm = VERDICT_META[deal.verdict];

          return (
            <div key={deal.id} style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:"14px", padding:"14px 16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"10px", flexWrap:"wrap", gap:"8px" }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"4px" }}>
                    <p style={{ fontSize:"13px", fontWeight:"800" }}>{deal.title}</p>
                    <VerdictBadge verdict={deal.verdict}/>
                  </div>
                  <p style={{ fontSize:"10px", color:"rgba(255,255,255,0.35)" }}>{deal.type} · {deal.geo} · {deal.submitted}</p>
                </div>
                <div style={{ display:"flex", gap:"12px" }}>
                  <div style={{ textAlign:"right" }}><p style={{ fontSize:"9px", color:"rgba(255,255,255,0.25)", marginBottom:"2px" }}>Cap Rate</p><p style={{ fontSize:"13px", fontWeight:"800", color:"#f59e0b" }}>{deal.cap}</p></div>
                  <div style={{ textAlign:"right" }}><p style={{ fontSize:"9px", color:"rgba(255,255,255,0.25)", marginBottom:"2px" }}>Cash Flow</p><p style={{ fontSize:"13px", fontWeight:"800", color:"#34d399" }}>{deal.cashflow}</p></div>
                </div>
              </div>

              {/* Vote bar */}
              <div style={{ height:"6px", background:"rgba(255,255,255,0.05)", borderRadius:"999px", overflow:"hidden", marginBottom:"8px", display:"flex" }}>
                <div style={{ height:"100%", width:`${yesPct}%`, background:"#34d399", transition:"width 0.5s" }}/>
                <div style={{ height:"100%", width:`${noPct}%`, background:"#f87171", transition:"width 0.5s" }}/>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex", gap:"6px", fontSize:"10px", color:"rgba(255,255,255,0.3)", fontWeight:"600" }}>
                  <span style={{ color:"#34d399" }}>✅ {deal.votes.yes}</span>
                  <span>·</span>
                  <span style={{ color:"#f87171" }}>❌ {deal.votes.no}</span>
                  <span>·</span>
                  <span style={{ color:"#f59e0b" }}>👁 {deal.votes.watch}</span>
                  <span>·</span>
                  <span>{totalVotes} votes</span>
                </div>
                {!myVote ? (
                  <div style={{ display:"flex", gap:"5px" }}>
                    {[{label:"I'd Buy",color:"#34d399",key:"yes"},{label:"Pass",color:"#f87171",key:"no"},{label:"Watch",color:"#f59e0b",key:"watch"}].map(v=>(
                      <button key={v.key} onClick={()=>vote(deal.id,v.key)} style={{ fontSize:"10px", padding:"4px 10px", background:`${v.color}15`, border:`1px solid ${v.color}44`, borderRadius:"6px", color:v.color, cursor:"pointer", fontWeight:"800" }}>{v.label}</button>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize:"10px", color:"rgba(255,255,255,0.3)", fontWeight:"700" }}>✓ You voted: {myVote}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
// ─── HOME TAB WRAPPER ────────────────────────────────────────────────────────
function HomeTab({ properties, user }: { properties: Property[]; user: any }) {
  const [sub, setSub] = useState<"overview"|"finances"|"properties">("overview");

  const subNav = [
    { key: "overview",   label: "Overview"    },
    { key: "finances",   label: "Finances"    },
    { key: "properties", label: "Properties"  },
  ] as const;

  return (
    <div>
      {/* Sub nav */}
      <div style={{ display: "flex", gap: "4px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "4px", marginBottom: "24px" }}>
        {subNav.map(({ key, label }) => (
          <button key={key} onClick={() => setSub(key)} style={{ flex: 1, padding: "10px", borderRadius: "10px", fontSize: "12px", fontWeight: "700", border: `1px solid ${sub === key ? "rgba(245,158,11,0.45)" : "transparent"}`, cursor: "pointer", background: sub === key ? "rgba(245,158,11,0.14)" : "transparent", color: sub === key ? "#f59e0b" : "rgba(255,255,255,0.4)", transition: "all 0.15s" }}>
            {label}
          </button>
        ))}
      </div>

      {sub === "overview" && <PortfolioOverviewContent properties={properties} user={user} />}
      {sub === "finances" && <FinancesTab properties={properties} user={user} />}
      {sub === "properties" && <PropertiesContent properties={properties} user={user} />}
    </div>
  );
}

// ─── FIND DEALS TAB WRAPPER ──────────────────────────────────────────────────
function FindDealsTab({ user, incomingListing, setActiveTab, setIncomingListing, setIncomingFinancing }: {
  user: any;
  incomingListing?: any;
  setActiveTab: (tab: any) => void;
  setIncomingListing?: (data: any) => void;
  setIncomingFinancing?: (data: any) => void;
}) {
  const [sub, setSub] = useState<"listings"|"deallab"|"market">("listings");

  const subNav = [
    { key: "listings", label: "Listings"       },
    { key: "deallab",  label: "Deal Lab"        },
    { key: "market",   label: "Market Intel"    },
  ] as const;

  return (
    <div>
      <div style={{ display: "flex", gap: "4px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "4px", marginBottom: "24px" }}>
        {subNav.map(({ key, label }) => (
          <button key={key} onClick={() => setSub(key)} style={{ flex: 1, padding: "10px", borderRadius: "10px", fontSize: "12px", fontWeight: "700", border: `1px solid ${sub === key ? "rgba(52,211,153,0.45)" : "transparent"}`, cursor: "pointer", background: sub === key ? "rgba(52,211,153,0.12)" : "transparent", color: sub === key ? "#34d399" : "rgba(255,255,255,0.4)", transition: "all 0.15s" }}>
            {label}
          </button>
        ))}
      </div>

      {sub === "listings" && (
        <DealDiscoveryTab
          setActiveTab={setActiveTab}
          setIncomingListing={setIncomingListing}
          setIncomingFinancing={setIncomingFinancing}
        />
      )}
      {sub === "deallab" && <DealLabTab user={user} incomingListing={incomingListing} />}
      {sub === "market"  && <MarketInline />}
    </div>
  );
}

// ─── MY PROJECTS TAB WRAPPER ─────────────────────────────────────────────────
function MyProjectsTab({ user, properties }: { user: any; properties: Property[] }) {
  const [sub, setSub] = useState<"active"|"projects">("active");

  const subNav = [
    { key: "active",   label: "Overview"   },
    { key: "projects", label: "Projects"   },
  ] as const;

  return (
    <div>
      <div style={{ display: "flex", gap: "4px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "4px", marginBottom: "24px" }}>
        {subNav.map(({ key, label }) => (
          <button key={key} onClick={() => setSub(key)} style={{ flex: 1, padding: "10px", borderRadius: "10px", fontSize: "12px", fontWeight: "700", border: `1px solid ${sub === key ? "rgba(167,139,250,0.45)" : "transparent"}`, cursor: "pointer", background: sub === key ? "rgba(167,139,250,0.12)" : "transparent", color: sub === key ? "#a78bfa" : "rgba(255,255,255,0.4)", transition: "all 0.15s" }}>
            {label}
          </button>
        ))}
      </div>

      {sub === "active"   && <ProjectsOverviewContent properties={properties} />}
      {sub === "projects" && <ProjectsTab user={user} />}
    </div>
  );
}

// ─── GET FINANCED TAB WRAPPER ─────────────────────────────────────────────────
function GetFinancedTab({ properties, user, incomingListing }: { properties: Property[]; user: any; incomingListing?: any }) {
  const [sub, setSub] = useState<"finder"|"calculator"|"models">("finder");

  const subNav = [
    { key: "finder",     label: "Loan Finder"  },
    { key: "calculator", label: "Calculator"   },
    { key: "models",     label: "All Models"   },
  ] as const;

  return (
    <div>
      <div style={{ display: "flex", gap: "4px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "4px", marginBottom: "24px" }}>
        {subNav.map(({ key, label }) => (
          <button key={key} onClick={() => setSub(key)} style={{ flex: 1, padding: "10px", borderRadius: "10px", fontSize: "12px", fontWeight: "700", border: `1px solid ${sub === key ? "rgba(245,158,11,0.45)" : "transparent"}`, cursor: "pointer", background: sub === key ? "rgba(245,158,11,0.14)" : "transparent", color: sub === key ? "#f59e0b" : "rgba(255,255,255,0.4)", transition: "all 0.15s" }}>
            {label}
          </button>
        ))}
      </div>

      <FinancingTab
        properties={properties}
        user={user}
        incomingListing={incomingListing}
        forcedSubTab={sub}
      />
    </div>
  );
}

// ─── PORTFOLIO OVERVIEW CONTENT (extracted from home tab) ────────────────────
function PortfolioOverviewContent({ properties, user }: { properties: Property[]; user: any }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
        {[
          { label: "Total Portfolio", value: `$${Math.round(properties.reduce((s, p) => s + p.value, 0) / 1000)}K`, color: "#f59e0b", sub: `${properties.length} properties` },
          { label: "Total Equity", value: `$${Math.round(properties.reduce((s, p) => s + (p.value - p.mortgage), 0) / 1000)}K`, color: "#34d399", sub: "net owned" },
          { label: "Monthly Cash Flow", value: `${properties.reduce((s, p) => s + propCashFlow(p), 0) >= 0 ? "+" : ""}$${Math.round(Math.abs(properties.reduce((s, p) => s + propCashFlow(p), 0))).toLocaleString()}`, color: properties.reduce((s, p) => s + propCashFlow(p), 0) >= 0 ? "#34d399" : "#f87171", sub: "after all expenses" },
          { label: "Gross Rent", value: `$${properties.reduce((s, p) => s + p.rent, 0).toLocaleString()}/mo`, color: "#fff", sub: "monthly income" },
        ].map(m => (
          <div key={m.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "20px" }}>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "1.5px", fontWeight: "700", marginBottom: "8px" }}>{m.label}</p>
            <p style={{ fontSize: "28px", fontWeight: "900", color: m.color, letterSpacing: "-1px", lineHeight: 1 }}>{m.value}</p>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "6px" }}>{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Properties quick list */}
      {properties.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <p style={{ fontSize: "11px", fontWeight: "800", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" as const, letterSpacing: "1px" }}>Your Properties</p>
          </div>
          {properties.map((p, i) => {
            const cf = propCashFlow(p);
            const equity = p.value - p.mortgage;
            return (
              <div key={p.id} style={{ padding: "14px 20px", borderBottom: i < properties.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: "10px" }}>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: "700" }}>{p.name}</p>
                  <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{p.type} · {p.occupancyStatus}</p>
                </div>
                <div style={{ display: "flex", gap: "20px" }}>
                  {[
                    { label: "Value", value: `$${Math.round(p.value/1000)}K`, color: "#f59e0b" },
                    { label: "Equity", value: `$${Math.round(equity/1000)}K`, color: "#34d399" },
                    { label: "Cash Flow", value: `${cf >= 0 ? "+" : ""}$${Math.round(Math.abs(cf))}`, color: cf >= 0 ? "#34d399" : "#f87171" },
                  ].map(m => (
                    <div key={m.label} style={{ textAlign: "right" as const }}>
                      <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)", marginBottom: "2px" }}>{m.label}</p>
                      <p style={{ fontSize: "14px", fontWeight: "800", color: m.color }}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {properties.length === 0 && (
        <div style={{ padding: "48px", textAlign: "center" as const, border: "1px dashed rgba(255,255,255,0.08)", borderRadius: "20px" }}>
          <p style={{ fontSize: "32px", marginBottom: "12px" }}>🏠</p>
          <p style={{ fontSize: "14px", fontWeight: "700", color: "rgba(255,255,255,0.4)" }}>No properties yet</p>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)", marginTop: "6px" }}>Add your first property to start tracking your portfolio</p>
        </div>
      )}
    </div>
  );
}

// ─── PROJECTS OVERVIEW CONTENT ───────────────────────────────────────────────
function ProjectsOverviewContent({ properties }: { properties: Property[] }) {
  const occupied = properties.filter(p => p.occupancyStatus === "occupied");
  const vacant = properties.filter(p => p.occupancyStatus !== "occupied");
  const totalCF = properties.reduce((s, p) => s + propCashFlow(p), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Quick stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
        {[
          { label: "Total Properties", value: String(properties.length), color: "#a78bfa", sub: "in portfolio" },
          { label: "Occupied", value: String(occupied.length), color: "#34d399", sub: `${properties.length > 0 ? Math.round(occupied.length / properties.length * 100) : 0}% occupancy` },
          { label: "Vacant", value: String(vacant.length), color: "#f87171", sub: "needs attention" },
          { label: "Portfolio Cash Flow", value: `${totalCF >= 0 ? "+" : ""}$${Math.round(Math.abs(totalCF)).toLocaleString()}`, color: totalCF >= 0 ? "#34d399" : "#f87171", sub: "per month" },
        ].map(m => (
          <div key={m.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "16px" }}>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "1px", fontWeight: "700", marginBottom: "6px" }}>{m.label}</p>
            <p style={{ fontSize: "24px", fontWeight: "900", color: m.color, letterSpacing: "-0.5px" }}>{m.value}</p>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "4px" }}>{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Vacant properties — action needed */}
      {vacant.length > 0 && (
        <div style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: "16px", padding: "18px 20px" }}>
          <p style={{ fontSize: "11px", fontWeight: "800", color: "#f87171", textTransform: "uppercase" as const, letterSpacing: "1px", marginBottom: "12px" }}>⚠ Needs Attention — Vacant Properties</p>
          {vacant.map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div>
                <p style={{ fontSize: "13px", fontWeight: "700" }}>{p.name}</p>
                <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{p.type}</p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <span style={{ fontSize: "10px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px", background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}>Vacant</span>
                <span style={{ fontSize: "10px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px", background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)", cursor: "pointer" }}>Screen Tenant</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All properties status */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <p style={{ fontSize: "11px", fontWeight: "800", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" as const, letterSpacing: "1px" }}>Portfolio Status</p>
        </div>
        {properties.map((p, i) => {
          const cf = propCashFlow(p);
          return (
            <div key={p.id} style={{ padding: "12px 20px", borderBottom: i < properties.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: p.occupancyStatus === "occupied" ? "#34d399" : "#f87171", flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: "13px", fontWeight: "700" }}>{p.name}</p>
                  <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{p.type}</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                <span style={{ fontSize: "10px", fontWeight: "700", padding: "3px 8px", borderRadius: "999px", background: p.occupancyStatus === "occupied" ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)", color: p.occupancyStatus === "occupied" ? "#34d399" : "#f87171" }}>{p.occupancyStatus}</span>
                <div style={{ textAlign: "right" as const }}>
                  <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)" }}>Cash Flow</p>
                  <p style={{ fontSize: "13px", fontWeight: "800", color: cf >= 0 ? "#34d399" : "#f87171" }}>{cf >= 0 ? "+" : ""}${Math.round(Math.abs(cf)).toLocaleString()}/mo</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── PROPERTIES CONTENT ───────────────────────────────────────────────────────
function PropertiesContent({ properties, user }: { properties: Property[]; user: any }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {properties.map(p => {
        const cf = propCashFlow(p);
        const equity = p.value - p.mortgage;
        const capRate = p.value > 0 ? ((p.rent - p.expenses) * 12 / p.value * 100) : 0;
        return (
          <div key={p.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" as const, gap: "12px", marginBottom: "16px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <p style={{ fontSize: "16px", fontWeight: "800" }}>{p.name}</p>
                  <span style={{ fontSize: "9px", fontWeight: "700", padding: "2px 8px", borderRadius: "999px", background: p.occupancyStatus === "occupied" ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)", color: p.occupancyStatus === "occupied" ? "#34d399" : "#f87171" }}>{p.occupancyStatus}</span>
                </div>
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>{p.type} · {p.address || "No address"}</p>
              </div>
              <p style={{ fontSize: "24px", fontWeight: "900", color: "#f59e0b" }}>${Math.round(p.value / 1000)}K</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "8px" }}>
              {[
                { label: "Equity", value: `$${Math.round(equity/1000)}K`, color: "#34d399" },
                { label: "Monthly Rent", value: `$${p.rent.toLocaleString()}`, color: "#fff" },
                { label: "Cash Flow", value: `${cf >= 0 ? "+" : ""}$${Math.round(Math.abs(cf))}`, color: cf >= 0 ? "#34d399" : "#f87171" },
                { label: "Cap Rate", value: `${capRate.toFixed(1)}%`, color: capRate >= 6 ? "#34d399" : "#f59e0b" },
                { label: "Mortgage", value: p.mortgage > 0 ? `$${Math.round(p.mortgage/1000)}K` : "None", color: "#fff" },
                { label: "LTV", value: p.value > 0 ? `${Math.round((p.mortgage/p.value)*100)}%` : "—", color: "#fff" },
              ].map(m => (
                <div key={m.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "10px 12px" }}>
                  <p style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: "4px", fontWeight: "700" }}>{m.label}</p>
                  <p style={{ fontSize: "16px", fontWeight: "800", color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {properties.length === 0 && (
        <div style={{ padding: "48px", textAlign: "center" as const, border: "1px dashed rgba(255,255,255,0.08)", borderRadius: "20px" }}>
          <p style={{ fontSize: "32px", marginBottom: "12px" }}>🏠</p>
          <p style={{ fontSize: "14px", fontWeight: "700", color: "rgba(255,255,255,0.4)" }}>No properties yet</p>
        </div>
      )}
    </div>
  );
}
// ─── FINANCING TAB v2 — Goal-first UX ──────────────────────────────────────
// Psychology: Goal → Numbers → Match → Apply
// Not "pick a lender" — "what do you need money for?"
// ────────────────────────────────────────────────────────────────────────────
function FinancingTab({ properties, user, incomingListing, forcedSubTab }: { properties: Property[]; user: any; incomingListing?: any; forcedSubTab?: "finder"|"calculator"|"models" }) {
  const [step, setStep] = useState<1|2|3>(1);
  const [goal, setGoal] = useState<"buy"|"refi"|"equity"|"flip"|"scale"|null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [loanAmount, setLoanAmount] = useState("");
  const [propertyValue, setPropertyValue] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [subTab, setSubTab] = useState<"finder"|"calculator"|"models">(forcedSubTab || "finder");

// Auto-fill from incoming listing
  useEffect(() => {
    if (incomingListing) {
    setStep(2);
    setGoal("buy");
    setPropertyValue(String(incomingListing.price));
    setLoanAmount(String(Math.round(incomingListing.price * 0.80)));
    setMonthlyRent(String(incomingListing.rent));
    setCalcInputs(prev => ({
      ...prev,
      price: String(incomingListing.price),
      down: String(Math.round(incomingListing.price * 0.20)),
      rent: String(incomingListing.rent),
    }));
  }
}, [incomingListing]);

  // Calculator state
  const [calcInputs, setCalcInputs] = useState({ price: "", down: "", rate: "7.0", term: "30", rent: "", expenses: "" });

  const GOALS = [
    { id: "buy",   icon: "🏠", label: "Buy a property",        desc: "Purchase a new investment or primary home", color: "#f59e0b" },
    { id: "refi",  icon: "🔄", label: "Refinance",             desc: "Lower your rate or access equity",           color: "#34d399" },
    { id: "equity",icon: "💰", label: "Pull equity out",       desc: "Cash-out refi, HELOC, or blanket loan",      color: "#60a5fa" },
    { id: "flip",  icon: "⚡", label: "Fix & flip",             desc: "Short-term bridge or hard money",            color: "#f87171" },
    { id: "scale", icon: "📈", label: "Scale my portfolio",    desc: "DSCR, portfolio loan, no income docs",       color: "#a78bfa" },
  ];

  // Smart lender matching based on goal
  const LENDER_MATRIX: Record<string, {
    primary: { name: string; logo: string; url: string; color: string; reason: string; rate: string; close: string; commission: string; pros: string[]; };
    alternatives: { name: string; url: string; color: string; why: string }[];
    model: string;
    tip: string;
  }> = {
    buy: {
      primary: { name: "Credible", logo: "✅", url: "https://credible.com", color: "#34d399", reason: "Compare 10+ lenders at once — no hard credit pull. Best rates for home purchases.", rate: "6.5–8.5%", close: "21–45 days", commission: "$240/loan", pros: ["No hard pull", "10+ lenders compete", "Best for primary + investment", "Instant rate comparison"] },
      alternatives: [{ name: "Kiavi", url: "https://kiavi.com", color: "#f59e0b", why: "If it's an investment property — DSCR qualifies on rent" }, { name: "LendingTree", url: "https://lendingtree.com", color: "#60a5fa", why: "Widest coverage if you want to browse all options" }],
      model: "Conventional Mortgage or DSCR",
      tip: "If you're buying an investment property — skip conventional banks. Kiavi qualifies on rental income, not your salary.",
    },
    refi: {
      primary: { name: "Credible", logo: "✅", url: "https://credible.com", color: "#34d399", reason: "Refinance comparison from 10+ lenders. See your real rate in 3 minutes.", rate: "6.5–8%", close: "21–45 days", commission: "$240/loan", pros: ["Rate comparison in 3 min", "No hard pull to shop", "Best refi rates", "Residential + investment"] },
      alternatives: [{ name: "LendingTree", url: "https://lendingtree.com", color: "#60a5fa", why: "Widest range of refi products" }, { name: "Kiavi", url: "https://kiavi.com", color: "#f59e0b", why: "DSCR refi if investment property" }],
      model: "Rate & Term Refinance",
      tip: "Best time to refi: when rates drop 1%+ below your current rate, or when your equity has grown and you can drop PMI.",
    },
    equity: {
      primary: { name: "LendingTree", logo: "🌳", url: "https://lendingtree.com", color: "#60a5fa", reason: "HELOC and cash-out refi from multiple lenders. Best for unlocking equity at competitive rates.", rate: "8.5–11%", close: "14–30 days", commission: "$200/lead", pros: ["HELOC + cash-out options", "Multiple lenders compete", "Investment + primary", "Fast decisions"] },
      alternatives: [{ name: "Kiavi", url: "https://kiavi.com", color: "#f59e0b", why: "If using equity to fund next investment deal" }, { name: "Credible", url: "https://credible.com", color: "#34d399", why: "If it's your primary residence" }],
      model: "HELOC or Cash-Out Refinance",
      tip: "Rule: never pull more than 75% LTV. Keep 25% equity cushion for market protection. Use extracted equity within 90 days or cost compounds.",
    },
    flip: {
      primary: { name: "Kiavi", logo: "🏗", url: "https://kiavi.com", color: "#f59e0b", reason: "Hard money and bridge loans built for flippers. Close in 7–14 days. Based on ARV not your income.", rate: "9–12%", close: "7–14 days", commission: "$700/loan", pros: ["Close in 7–14 days", "Based on property ARV", "No income verification", "Flip + hold options"] },
      alternatives: [{ name: "LendingTree", url: "https://lendingtree.com", color: "#60a5fa", why: "If you want to compare multiple bridge lenders" }],
      model: "Hard Money / Bridge Loan",
      tip: "Exit strategy is everything with hard money. Have your refi or sale lined up BEFORE you close. Rate compounds fast at 10%+.",
    },
    scale: {
      primary: { name: "Kiavi", logo: "🏗", url: "https://kiavi.com", color: "#f59e0b", reason: "DSCR loans — unlimited properties, no income docs. Qualifies on rental income only. Built for portfolio growth.", rate: "7.5–9.5%", close: "14–21 days", commission: "$700/loan", pros: ["No W2 or tax returns", "Unlimited properties", "LLC-friendly", "Portfolio / blanket loans"] },
      alternatives: [{ name: "LendingTree", url: "https://lendingtree.com", color: "#60a5fa", why: "Compare multiple DSCR lenders for best rate" }, { name: "Credible", url: "https://credible.com", color: "#34d399", why: "If under 4 properties and still using conventional" }],
      model: "DSCR or Portfolio Loan",
      tip: "At 3+ properties: consider a blanket loan — one payment, one closing, move everything into an LLC in one step.",
    },
  };

  const matched = goal ? LENDER_MATRIX[goal] : null;

  // Auto-fill from property selection
  function pickProperty(p: Property) {
    setSelectedProperty(p);
    setPropertyValue(String(p.value));
    setMonthlyRent(String(p.rent));
    const equity = p.value - p.mortgage;
    setLoanAmount(String(Math.round(p.value * 0.75)));
    setCalcInputs(prev => ({ ...prev, price: String(p.value), down: String(Math.round(p.value * 0.20)), rent: String(p.rent), expenses: String(p.expenses) }));
  }

  // Calculator math
  const price = parseFloat(calcInputs.price.replace(/,/g,"")) || 0;
  const down = parseFloat(calcInputs.down.replace(/,/g,"")) || 0;
  const r = parseFloat(calcInputs.rate) / 100 / 12;
  const n = parseFloat(calcInputs.term) * 12;
  const loan = price - down;
  const payment = loan > 0 && r > 0 ? loan * (r * Math.pow(1+r,n)) / (Math.pow(1+r,n)-1) : 0;
  const rent = parseFloat(calcInputs.rent.replace(/,/g,"")) || 0;
  const exp = parseFloat(calcInputs.expenses.replace(/,/g,"")) || 0;
  const cf = rent - exp - payment;
  const capRate = price > 0 ? ((rent - exp) * 12 / price * 100) : 0;
  const ltv = price > 0 ? (loan / price * 100) : 0;
  const dscr = payment > 0 ? ((rent - exp) / payment) : 0;
  const cfColor = cf >= 0 ? "#34d399" : "#f87171";

  const IS: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 14px", fontSize: "14px", fontWeight: "700", color: "#fff", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const };

  const MODELS = [
    { name: "Conventional Mortgage", icon: "🏠", rate: "6.5–7.5%", down: "3–20%", qualify: "W2 + DTI <43%", tag: "Most common", tc: "#60a5fa", stars: 5, desc: "Standard bank loan. Best long-term rate but strict income verification. 1–4 units only." },
    { name: "DSCR Loan",            icon: "📊", rate: "7.5–9%",   down: "20–25%", qualify: "Rent ÷ payment ≥ 1.0", tag: "Investor favorite", tc: "#f59e0b", stars: 4, desc: "No W2. No tax returns. Qualifies on rental income. Scale to unlimited properties." },
    { name: "Hard Money",            icon: "⚡", rate: "10–14%",   down: "20–30%", qualify: "Asset + exit strategy", tag: "Speed",            tc: "#f87171", stars: 2, desc: "Closes in 7–14 days. Based on ARV. High rate — short term only. Exit with sale or refi." },
    { name: "HELOC",                 icon: "🔄", rate: "9–11% var",down: "Uses equity", qualify: "30%+ equity",  tag: "Revolving",         tc: "#a78bfa", stars: 3, desc: "Revolving line against equity. Draw, repay, draw again. Best for down payments." },
    { name: "Seller Financing",      icon: "🤝", rate: "5–8% neg", down: "10–20% neg",  qualify: "Seller agreement", tag: "No bank", tc: "#e879f9", stars: 4, desc: "Seller becomes your bank. Fully negotiable. No approval. Close in days." },
    { name: "Bridge Loan",           icon: "🌉", rate: "10–13%",   down: "20% equity", qualify: "Exit < 24mo",    tag: "Gap",               tc: "#fb923c", stars: 2, desc: "Buy before selling. Stabilize before DSCR refi. Close in 1–2 weeks." },
    { name: "SBA 504",               icon: "🏛", rate: "6–7% fixed",down: "10%",    qualify: "Owner-occupied commercial", tag: "Low down", tc: "#34d399", stars: 5, desc: "Gov-backed for commercial RE. Only 10% down. 25yr term. Very low rate." },
    { name: "Portfolio / Blanket",   icon: "🔗", rate: "7.5–9.5%", down: "25–30%", qualify: "3+ props, DSCR ≥1.0", tag: "Scale",           tc: "#22d3ee", stars: 4, desc: "One loan covers all your properties. One payment. Move portfolio into LLC in one step." },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f59e0b", boxShadow: "0 0 6px #f59e0b", animation: "blink 1.5s infinite" }} />
          <span style={{ fontSize: "10px", color: "rgba(245,158,11,0.7)", letterSpacing: "2px", fontWeight: "700", textTransform: "uppercase" as const }}>Financing · Find the right loan in 3 steps</span>
        </div>
        <h2 style={{ fontSize: "24px", fontWeight: "900", letterSpacing: "-0.8px" }}>Financing</h2>
      </div>

      {/* Sub nav */}
      <div style={{ display: "flex", gap: "4px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "4px", marginBottom: "24px" }}>
        {([
          { key: "finder",     label: "🎯 Loan Finder" },
          { key: "calculator", label: "🧮 Calculator"  },
          { key: "models",     label: "📊 All Models"  },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setSubTab(key)} style={{ flex: 1, padding: "10px", borderRadius: "10px", fontSize: "12px", fontWeight: "700", border: `1px solid ${subTab === key ? "rgba(245,158,11,0.45)" : "transparent"}`, cursor: "pointer", background: subTab === key ? "rgba(245,158,11,0.14)" : "transparent", color: subTab === key ? "#f59e0b" : "rgba(255,255,255,0.4)", transition: "all 0.15s" }}>{label}</button>
        ))}
      </div>

      {/* ── LOAN FINDER — 3-step guided flow ── */}
      {subTab === "finder" && (
        <div>
          {/* Progress bar */}
          <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "28px" }}>
            {[1, 2, 3].map((s, i) => {
              const done = step > s;
              const active = step === s;
              const colors = ["#f59e0b", "#34d399", "#60a5fa"];
              const labels = ["What's your goal?", "Your numbers", "Matched lender"];
              const c = colors[i];
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : "none" }}>
                  <div onClick={() => done && setStep(s as 1|2|3)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", cursor: done ? "pointer" : "default" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: done ? c : active ? `${c}22` : "rgba(255,255,255,0.06)", border: `2px solid ${done || active ? c : "rgba(255,255,255,0.1)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: done ? "14px" : "13px", fontWeight: "900", color: done ? "#000" : active ? c : "rgba(255,255,255,0.3)", boxShadow: active ? `0 0 16px ${c}44` : "none", transition: "all 0.3s" }}>
                      {done ? "✓" : s}
                    </div>
                    <span style={{ fontSize: "9px", fontWeight: "700", color: active ? c : done ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)", letterSpacing: "0.3px", whiteSpace: "nowrap" as const }}>{labels[i]}</span>
                  </div>
                  {i < 2 && <div style={{ flex: 1, height: "2px", margin: "0 8px 14px", background: done ? c : "rgba(255,255,255,0.06)", borderRadius: "999px", transition: "background 0.4s" }} />}
                </div>
              );
            })}
          </div>

          {/* ── STEP 1: Goal ── */}
          {step === 1 && (
            <div>
              <p style={{ fontSize: "20px", fontWeight: "900", marginBottom: "6px" }}>What do you need financing for?</p>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginBottom: "20px" }}>Your answer determines the right loan type and lender — not all loans are the same.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
                {GOALS.map(g => (
                  <button key={g.id} onClick={() => { setGoal(g.id as any); setStep(2); }} style={{ padding: "20px 18px", background: goal === g.id ? `${g.color}15` : "rgba(255,255,255,0.02)", border: `2px solid ${goal === g.id ? g.color : "rgba(255,255,255,0.07)"}`, borderRadius: "16px", cursor: "pointer", textAlign: "left" as const, transition: "all 0.2s", boxShadow: goal === g.id ? `0 0 20px ${g.color}22` : "none" }}>
                    <div style={{ fontSize: "28px", marginBottom: "10px" }}>{g.icon}</div>
                    <p style={{ fontSize: "14px", fontWeight: "800", color: goal === g.id ? g.color : "#fff", marginBottom: "4px" }}>{g.label}</p>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", lineHeight: "1.4" }}>{g.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 2: Numbers ── */}
          {step === 2 && goal && matched && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <button onClick={() => setStep(1)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "12px", padding: "5px 10px" }}>← Back</button>
                <p style={{ fontSize: "16px", fontWeight: "800" }}>
                  {GOALS.find(g => g.id === goal)?.icon} {GOALS.find(g => g.id === goal)?.label}
                </p>
              </div>

              {/* Loan type recommendation context */}
              <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "14px", padding: "14px 18px", marginBottom: "20px" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "18px" }}>💡</span>
                  <div>
                    <p style={{ fontSize: "12px", fontWeight: "800", color: "#f59e0b", marginBottom: "3px" }}>Recommended loan: {matched.model}</p>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", lineHeight: "1.6" }}>{matched.tip}</p>
                  </div>
                </div>
              </div>

              {/* Property picker */}
              {properties.length > 0 && (
                <div style={{ marginBottom: "18px" }}>
                  <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", letterSpacing: "1px", textTransform: "uppercase" as const, marginBottom: "8px", fontWeight: "700" }}>Pre-fill from your portfolio (optional)</p>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" as const }}>
                    {properties.map(p => (
                      <button key={p.id} onClick={() => pickProperty(p)} style={{ padding: "6px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: "700", border: `1px solid ${selectedProperty?.id === p.id ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)"}`, background: selectedProperty?.id === p.id ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.03)", color: selectedProperty?.id === p.id ? "#f59e0b" : "rgba(255,255,255,0.4)", cursor: "pointer" }}>
                        {p.name.slice(0, 20)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Key number inputs — minimal, goal-relevant */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
                {[
                  { label: goal === "equity" ? "Property Current Value ($)" : "Purchase / Property Value ($)", key: "propertyValue", val: propertyValue, set: setPropertyValue, placeholder: "350,000" },
                  { label: goal === "flip" ? "Loan Amount Needed ($)" : goal === "scale" ? "Loan Amount per Property ($)" : "Loan Amount Needed ($)", key: "loanAmount", val: loanAmount, set: setLoanAmount, placeholder: "280,000" },
                  { label: "Monthly Rent / Income ($)", key: "monthlyRent", val: monthlyRent, set: setMonthlyRent, placeholder: "2,400" },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" as const, letterSpacing: "1px", display: "block", marginBottom: "6px", fontWeight: "700" }}>{f.label}</label>
                    <input type="text" inputMode="numeric" placeholder={f.placeholder} value={f.val} onChange={e => f.set(e.target.value)} style={IS} />
                  </div>
                ))}
                {/* Quick DSCR preview */}
                {monthlyRent && loanAmount && (
                  <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "12px", padding: "14px", border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "1px", marginBottom: "6px" }}>Est. DSCR (at 7.5%)</p>
                    {(() => {
                      const estPmt = parseFloat(loanAmount.replace(/,/g,"")) * (0.075/12) * Math.pow(1+0.075/12,360) / (Math.pow(1+0.075/12,360)-1);
                      const dscrVal = parseFloat(monthlyRent.replace(/,/g,"")) / estPmt;
                      const c = dscrVal >= 1.25 ? "#34d399" : dscrVal >= 1.0 ? "#f59e0b" : "#f87171";
                      return (
                        <>
                          <p style={{ fontSize: "24px", fontWeight: "900", color: c }}>{isFinite(dscrVal) ? dscrVal.toFixed(2) : "—"}x</p>
                          <p style={{ fontSize: "10px", color: c, marginTop: "2px", fontWeight: "700" }}>{dscrVal >= 1.25 ? "✓ Qualifies easily" : dscrVal >= 1.0 ? "⚡ Borderline" : "⚠ Below minimum"}</p>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              <button onClick={() => setStep(3)} style={{ width: "100%", padding: "14px", background: "linear-gradient(90deg, #f59e0b, #fbbf24)", color: "#000", borderRadius: "12px", fontWeight: "900", fontSize: "15px", border: "none", cursor: "pointer", letterSpacing: "0.3px" }}>
                See My Matched Lender →
              </button>
            </div>
          )}

          {/* ── STEP 3: Match ── */}
          {step === 3 && goal && matched && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <button onClick={() => setStep(2)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "12px", padding: "5px 10px" }}>← Back</button>
                <p style={{ fontSize: "16px", fontWeight: "800" }}>Your best match</p>
              </div>

              {/* Primary match — hero card */}
              <div style={{ background: `linear-gradient(135deg, ${matched.primary.color}10, rgba(0,0,0,0.3))`, border: `2px solid ${matched.primary.color}44`, borderRadius: "22px", padding: "28px 30px", marginBottom: "16px", position: "relative", overflow: "hidden" }}>
                {/* Glow */}
                <div style={{ position: "absolute", top: 0, right: 0, width: "200px", height: "200px", background: `radial-gradient(circle at top right, ${matched.primary.color}12, transparent 70%)`, pointerEvents: "none" }} />
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg, transparent, ${matched.primary.color}, transparent)` }} />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" as const, gap: "16px", marginBottom: "20px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                      <span style={{ fontSize: "28px" }}>{matched.primary.logo}</span>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <h3 style={{ fontSize: "24px", fontWeight: "900", color: "#fff" }}>{matched.primary.name}</h3>
                          <span style={{ fontSize: "10px", fontWeight: "900", padding: "3px 10px", borderRadius: "999px", background: `${matched.primary.color}20`, color: matched.primary.color, border: `1px solid ${matched.primary.color}44` }}>★ BEST MATCH</span>
                        </div>
                        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginTop: "3px" }}>{matched.primary.reason}</p>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "16px" }}>
                    {[{ label: "Rate", value: matched.primary.rate }, { label: "Close time", value: matched.primary.close }, { label: "You earn", value: matched.primary.commission }].map(m => (
                      <div key={m.label} style={{ textAlign: "center" as const }}>
                        <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "3px", textTransform: "uppercase" as const }}>{m.label}</p>
                        <p style={{ fontSize: "14px", fontWeight: "800", color: m.label === "You earn" ? "#34d399" : matched.primary.color }}>{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pros */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" as const, marginBottom: "20px" }}>
                  {matched.primary.pros.map((pro, i) => (
                    <span key={i} style={{ fontSize: "11px", padding: "5px 12px", borderRadius: "999px", background: `${matched.primary.color}12`, color: matched.primary.color, border: `1px solid ${matched.primary.color}25`, fontWeight: "700" }}>✓ {pro}</span>
                  ))}
                </div>

                {/* Personalized context if property selected */}
                {selectedProperty && (
                  <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "12px", padding: "12px 16px", marginBottom: "16px" }}>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", lineHeight: "1.7" }}>
                      📋 For <span style={{ color: matched.primary.color, fontWeight: "700" }}>{selectedProperty.name}</span> — Value ${(selectedProperty.value/1000).toFixed(0)}K · Equity ${((selectedProperty.value - selectedProperty.mortgage)/1000).toFixed(0)}K · {selectedProperty.rent > 0 ? `Rent $${selectedProperty.rent.toLocaleString()}/mo` : "No current rent"}
                    </p>
                  </div>
                )}

                <a href={matched.primary.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", padding: "14px", background: matched.primary.color, color: "#000", borderRadius: "12px", fontWeight: "900", fontSize: "15px", textDecoration: "none", textAlign: "center" as const, letterSpacing: "0.3px" }}>
                  Apply to {matched.primary.name} — Free, No Hard Pull ↗
                </a>
              </div>

              {/* Alternative lenders */}
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1px", textTransform: "uppercase" as const, fontWeight: "700", marginBottom: "10px" }}>Also consider</p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" as const }}>
                {matched.alternatives.map(alt => (
                  <div key={alt.name} style={{ flex: 1, minWidth: "200px", background: "rgba(255,255,255,0.02)", border: `1px solid ${alt.color}22`, borderRadius: "14px", padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <p style={{ fontSize: "14px", fontWeight: "800", color: alt.color }}>{alt.name}</p>
                      <a href={`https://${alt.url}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "10px", padding: "4px 10px", background: `${alt.color}12`, border: `1px solid ${alt.color}30`, borderRadius: "6px", color: alt.color, textDecoration: "none", fontWeight: "700" }}>Apply ↗</a>
                    </div>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", lineHeight: "1.5" }}>{alt.why}</p>
                  </div>
                ))}
              </div>

              <button onClick={() => { setStep(1); setGoal(null); }} style={{ width: "100%", marginTop: "16px", padding: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>← Start over with different goal</button>
            </div>
          )}
        </div>
      )}

      {/* ── CALCULATOR ── */}
      {subTab === "calculator" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px", padding: "24px" }}>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase" as const, fontWeight: "700", marginBottom: "16px" }}>Loan Parameters</p>
            {properties.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "6px", textTransform: "uppercase" as const }}>Pre-fill from portfolio</p>
                <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" as const }}>
                  {properties.map(p => (
                    <button key={p.id} onClick={() => { pickProperty(p); }} style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: "700", border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.06)", color: "#f59e0b", cursor: "pointer" }}>{p.name.slice(0,16)}</button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[{ l: "Purchase Price ($)", k: "price", ph: "350,000" }, { l: "Down Payment ($)", k: "down", ph: "70,000" }, { l: "Monthly Rent ($)", k: "rent", ph: "2,400" }, { l: "Monthly Expenses ($)", k: "expenses", ph: "400" }].map(f => (
                <div key={f.k}>
                  <label style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "1px", display: "block", marginBottom: "5px", fontWeight: "700" }}>{f.l}</label>
                  <input type="text" inputMode="numeric" placeholder={f.ph} value={(calcInputs as any)[f.k]} onChange={e => setCalcInputs(p => ({...p, [f.k]: e.target.value}))} style={IS} />
                </div>
              ))}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                  <label style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "1px", fontWeight: "700" }}>Interest Rate</label>
                  <span style={{ fontSize: "13px", fontWeight: "900", color: "#f59e0b" }}>{calcInputs.rate}%</span>
                </div>
                <input type="range" min="3" max="14" step="0.25" value={calcInputs.rate} onChange={e => setCalcInputs(p => ({...p, rate: e.target.value}))} style={{ width: "100%", accentColor: "#f59e0b" }} />
              </div>
              <div>
                <label style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "1px", display: "block", marginBottom: "6px", fontWeight: "700" }}>Loan Term</label>
                <div style={{ display: "flex", gap: "6px" }}>
                  {[15, 20, 25, 30].map(t => (
                    <button key={t} onClick={() => setCalcInputs(p => ({...p, term: String(t)}))} style={{ flex: 1, padding: "7px", borderRadius: "8px", fontSize: "11px", fontWeight: "800", border: `1px solid ${calcInputs.term === String(t) ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)"}`, background: calcInputs.term === String(t) ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.03)", color: calcInputs.term === String(t) ? "#f59e0b" : "rgba(255,255,255,0.35)", cursor: "pointer" }}>{t}yr</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ background: cf >= 0 ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)", border: `1px solid ${cfColor}33`, borderRadius: "20px", padding: "24px", textAlign: "center" as const }}>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase" as const, fontWeight: "700", marginBottom: "8px" }}>Monthly Cash Flow</p>
              <p style={{ fontSize: "40px", fontWeight: "900", color: cfColor, letterSpacing: "-2px" }}>{cf >= 0 ? "+" : ""}{Math.round(cf).toLocaleString("en-US", {style:"currency",currency:"USD",maximumFractionDigits:0})}</p>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "5px" }}>after mortgage · expenses</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {[
                { l: "Monthly Payment", v: payment > 0 ? `$${Math.round(payment).toLocaleString()}` : "—", c: "#f87171" },
                { l: "Loan Amount", v: loan > 0 ? `$${Math.round(loan/1000)}K` : "—", c: "#fff" },
                { l: "Cap Rate", v: capRate > 0 ? `${capRate.toFixed(1)}%` : "—", c: capRate >= 6 ? "#34d399" : "#f59e0b" },
                { l: "LTV", v: ltv > 0 ? `${ltv.toFixed(0)}%` : "—", c: ltv <= 75 ? "#34d399" : "#f87171" },
                { l: "DSCR", v: dscr > 0 ? `${dscr.toFixed(2)}x` : "—", c: dscr >= 1.25 ? "#34d399" : dscr >= 1.0 ? "#f59e0b" : "#f87171" },
                { l: "Annual Cash Flow", v: cf !== 0 ? `$${Math.round(cf*12).toLocaleString()}` : "—", c: cfColor },
              ].map(m => (
                <div key={m.l} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "12px" }}>
                  <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: "4px", fontWeight: "700" }}>{m.l}</p>
                  <p style={{ fontSize: "17px", fontWeight: "900", color: m.c }}>{m.v}</p>
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 14px", background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "12px", fontSize: "11px", color: "rgba(255,255,255,0.45)", lineHeight: "1.7" }}>
              <span style={{ color: "#f59e0b", fontWeight: "700" }}>DSCR ≥ 1.25</span> → Lenders approve.&nbsp;
              <span style={{ color: "#f59e0b", fontWeight: "700" }}>Cap ≥ 6%</span> → Solid deal.&nbsp;
              <span style={{ color: "#f59e0b", fontWeight: "700" }}>LTV ≤ 75%</span> → Safe leverage.
            </div>
          </div>
        </div>
      )}

      {/* ── ALL MODELS ── */}
      {subTab === "models" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {MODELS.map(m => (
            <div key={m.name} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${m.tc}18`, borderRadius: "16px", padding: "18px 22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" as const, gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                  <span style={{ fontSize: "22px" }}>{m.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" as const }}>
                      <p style={{ fontSize: "14px", fontWeight: "800" }}>{m.name}</p>
                      <span style={{ fontSize: "9px", fontWeight: "800", padding: "2px 8px", borderRadius: "999px", background: `${m.tc}15`, color: m.tc, border: `1px solid ${m.tc}30` }}>{m.tag}</span>
                      <span style={{ fontSize: "10px", color: "#f59e0b" }}>{"⭐".repeat(m.stars)}</span>
                    </div>
                    <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: "1.5" }}>{m.desc}</p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "14px", flexShrink: 0 }}>
                  {[{ l: "Rate", v: m.rate, c: m.tc }, { l: "Down", v: m.down, c: "#fff" }].map(x => (
                    <div key={x.l} style={{ textAlign: "right" as const }}>
                      <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)", marginBottom: "2px" }}>{x.l}</p>
                      <p style={{ fontSize: "13px", fontWeight: "800", color: x.c }}>{x.v}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>Qualify: </span>
                <span style={{ fontSize: "10px", color: "#fff", fontWeight: "600" }}>{m.qualify}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── DEAL DISCOVERY TAB v3 — ZILLOW-LEVEL ───────────────────────────────────
function DealDiscoveryTab({ setActiveTab, setIncomingListing, setIncomingFinancing }: { setActiveTab: (tab: any) => void, setIncomingListing?: (data: any) => void, setIncomingFinancing?: (data: any) => void }) {
  const [subTab, setSubTab] = useState<"listings"|"distressed"|"offmarket"|"businesses">("listings");
  const [zipCode, setZipCode] = useState("77002");
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [priceMax, setPriceMax] = useState("600000");
  const [bedsMin, setBedsMin] = useState("2");
  const [sortBy, setSortBy] = useState<"caprate"|"cashflow"|"price"|"days">("caprate");
  const [filterMin, setFilterMin] = useState<"all"|"6"|"8"|"10">("all");
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [photoIndex, setPhotoIndex] = useState<Record<number, number>>({});
  const [expandedId, setExpandedId] = useState<number|null>(null);

  // ── REPLACE WITH YOUR RAPIDAPI KEY ──
  const RAPIDAPI_KEY = "234b4414aamsh098714f81a4f229p10ee1djsn7aed66d52b9b";

  function calcMetrics(price: number) {
    const rent = Math.round(price * 0.011);
    const expenses = Math.round(rent * 0.30);
    const loanAmt = price * 0.80;
    const r = 0.075/12; const n = 360;
    const mortgage = loanAmt * (r * Math.pow(1+r,n)) / (Math.pow(1+r,n)-1);
    const cashFlow = Math.round(rent - expenses - mortgage);
    const capRate = parseFloat(((rent - expenses) * 12 / price * 100).toFixed(1));
    const dscr = parseFloat(((rent - expenses) / mortgage).toFixed(2));
    const cocReturn = parseFloat(((cashFlow * 12) / (price * 0.20) * 100).toFixed(1));
    const downPayment = Math.round(price * 0.20);
    const monthlyMortgage = Math.round(mortgage);
    return { rent, expenses, cashFlow, capRate, dscr, cocReturn, downPayment, monthlyMortgage };
  }

  // Fetch real listings from RapidAPI
  async function searchListings() {
    setLoading(true);
    setSearched(true);

    if (!RAPIDAPI_KEY) {
      setTimeout(() => {
        setListings(DEMO_LISTINGS);
        setLoading(false);
      }, 900);
      return;
    }

    try {
      const res = await fetch("https://realty-in-us.p.rapidapi.com/properties/v3/list", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-RapidAPI-Key": RAPIDAPI_KEY,
          "X-RapidAPI-Host": "realty-in-us.p.rapidapi.com",
        },
        body: JSON.stringify({
          limit: 3,
          offset: 0,
          filters: {
            list_price: { max: parseInt(priceMax) },
            beds: { min: parseInt(bedsMin) },
          },
          postal_code: zipCode,
          status: ["for_sale"],
          sort: { field: "list_date", direction: "desc" },
        }),
      });
      const data = await res.json();
      const results = data?.data?.home_search?.results || [];
      const mapped = results.map((p: any, i: number) => {
        const price = p.list_price || 0;
        const metrics = calcMetrics(price);
        const photos = p.photos?.map((ph: any) => 
  (ph.href || "").replace("s.jpg", "od-w1024_h768.jpg").replace("m.jpg", "od-w1024_h768.jpg")
) || [];
const primaryPhoto = p.primary_photo?.href 
  ? p.primary_photo.href.replace("s.jpg", "od-w1024_h768.jpg").replace("m.jpg", "od-w1024_h768.jpg")
  : null;
        const allPhotos = primaryPhoto ? [primaryPhoto, ...photos.filter((u: string) => u !== primaryPhoto)] : photos;
        return {
          id: i,
          address: p.location?.address?.line || "Address unavailable",
          city: `${p.location?.address?.city || ""}, ${p.location?.address?.state_code || ""} ${p.location?.address?.postal_code || ""}`,
          price,
          beds: p.description?.beds || 0,
          baths: p.description?.baths_consolidated || p.description?.baths || 0,
          sqft: p.description?.sqft || 0,
          type: (p.description?.type || "Home").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
          days: p.list_date ? Math.floor((Date.now() - new Date(p.list_date).getTime()) / 86400000) : 0,
          photos: allPhotos.slice(0, 8),
          url: p.href || "#",
          garage: p.description?.garage || 0,
          yearBuilt: p.description?.year_built || null,
          lotSqft: p.description?.lot_sqft || null,
          isReal: true,
          ...metrics,
        };
      });
      setListings(mapped.length > 0 ? mapped : DEMO_LISTINGS);
    } catch {
      setListings(DEMO_LISTINGS);
    }
    setLoading(false);
  }

  const DEMO_LISTINGS = [
    { id:1, address:"1847 Magnolia Drive", city:"Houston, TX 77002", price:285000, beds:4, baths:2, sqft:1840, type:"Single Family", days:3, garage:1, yearBuilt:2008, lotSqft:6200, isReal:false,
      photos:["https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80","https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80","https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80"], ...calcMetrics(285000) },
    { id:2, address:"2234 Oak Avenue", city:"Houston, TX 77003", price:210000, beds:3, baths:2, sqft:1420, type:"Single Family", days:5, garage:0, yearBuilt:1998, lotSqft:5400, isReal:false,
      photos:["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80","https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80","https://images.unsplash.com/photo-1523217582562-09d0def993a6?w=800&q=80"], ...calcMetrics(210000) },
    { id:3, address:"445 Heights Boulevard", city:"Houston, TX 77007", price:380000, beds:6, baths:3, sqft:2800, type:"Multi-Family", days:8, garage:2, yearBuilt:2015, lotSqft:8100, isReal:false,
      photos:["https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800&q=80","https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&q=80","https://images.unsplash.com/photo-1576941089067-2de3c901e126?w=800&q=80"], ...calcMetrics(380000) },
    { id:4, address:"890 Westheimer Road", city:"Houston, TX 77006", price:165000, beds:2, baths:1, sqft:980, type:"Condo", days:21, garage:0, yearBuilt:2001, lotSqft:null, isReal:false,
      photos:["https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80","https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80","https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80"], ...calcMetrics(165000) },
    { id:5, address:"334 Avondale Street", city:"Houston, TX 77006", price:295000, beds:3, baths:2, sqft:1620, type:"Single Family", days:2, garage:1, yearBuilt:2012, lotSqft:5800, isReal:false,
      photos:["https://images.unsplash.com/photo-1582407947304-fd86f28f9c8e?w=800&q=80","https://images.unsplash.com/photo-1416331108676-a22ccb276e35?w=800&q=80","https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80"], ...calcMetrics(295000) },
    { id:6, address:"1120 Studewood Street", city:"Houston, TX 77008", price:440000, beds:5, baths:3, sqft:3100, type:"Multi-Family", days:15, garage:2, yearBuilt:2018, lotSqft:9200, isReal:false,
      photos:["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80","https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80","https://images.unsplash.com/photo-1600047508788-786f3865b375?w=800&q=80"], ...calcMetrics(440000) },
    { id:7, address:"2890 Montrose Boulevard", city:"Houston, TX 77006", price:320000, beds:3, baths:2, sqft:1750, type:"Townhouse", days:7, garage:1, yearBuilt:2016, lotSqft:3200, isReal:false,
      photos:["https://images.unsplash.com/photo-1599427303058-f04cbcf4756f?w=800&q=80","https://images.unsplash.com/photo-1598228723793-52759bba239c?w=800&q=80","https://images.unsplash.com/photo-1591474200742-8e512e6f98f8?w=800&q=80"], ...calcMetrics(320000) },
    { id:8, address:"1547 Shepherd Drive", city:"Houston, TX 77007", price:250000, beds:2, baths:2, sqft:1300, type:"Duplex", days:18, garage:0, yearBuilt:2005, lotSqft:4800, isReal:false,
      photos:["https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=800&q=80","https://images.unsplash.com/photo-1544984243-ec57ea16fe25?w=800&q=80","https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80"], ...calcMetrics(250000) },
  ];

  const DISTRESSED = [
    { id:101, name:"Pre-Foreclosure 3/2", addr:"1223 Elm St", city:"Houston, TX", price:195000, arv:285000, equity:90000, stage:"Notice of Default", daysLeft:47, type:"Pre-Foreclosure", color:"#f87171",
      photos:["https://images.unsplash.com/photo-1582407947304-fd86f28f9c8e?w=800&q=80"], ...calcMetrics(195000) },
    { id:102, name:"REO Bank-Owned 3/2", addr:"567 Pine Blvd", city:"Houston, TX", price:142000, arv:220000, equity:78000, stage:"Bank Owned (REO)", daysLeft:null, type:"REO", color:"#f59e0b",
      photos:["https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80"], ...calcMetrics(142000) },
    { id:103, name:"Auction — Duplex", addr:"789 River Rd", city:"Houston, TX", price:178000, arv:290000, equity:112000, stage:"Auction in 12 days", daysLeft:12, type:"Auction", color:"#e879f9",
      photos:["https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80"], ...calcMetrics(178000) },
    { id:104, name:"Lis Pendens — 4BR", addr:"334 Maple Ct", city:"Houston, TX", price:230000, arv:340000, equity:110000, stage:"Court Filing", daysLeft:90, type:"Lis Pendens", color:"#60a5fa",
      photos:["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80"], ...calcMetrics(230000) },
  ];

  const OFFMARKET = [
    { id:201, name:"Equity-Rich SFR", addr:"1145 Live Oak Dr", city:"Houston, TX", price:260000, equity:180000, equityPct:69, motivation:"Tax delinquent 2yr", color:"#34d399",
      photos:["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80"], ...calcMetrics(260000) },
    { id:202, name:"Absentee Owner Duplex", addr:"892 Cedar Lane", city:"Houston, TX", price:310000, equity:240000, equityPct:77, motivation:"Absentee owner 5yr", color:"#a78bfa",
      photos:["https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800&q=80"], ...calcMetrics(310000) },
    { id:203, name:"Estate Sale", addr:"2241 Ranch Road", city:"Houston, TX", price:445000, equity:390000, equityPct:88, motivation:"Estate sale — no liens", color:"#f59e0b",
      photos:["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80"], ...calcMetrics(445000) },
  ];

  const BUSINESSES = [
    { id:301, name:"Property Management Co.", location:"Houston, TX", price:285000, revenue:420000, annualCF:89000, type:"Property Management", employees:6, years:8, multiple:3.2, color:"#60a5fa",
      photos:["https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80"] },
    { id:302, name:"RE Photography Studio", location:"Houston, TX", price:95000, revenue:180000, annualCF:68000, type:"RE Services", employees:2, years:4, multiple:1.4, color:"#34d399",
      photos:["https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80"] },
    { id:303, name:"STR Portfolio — 14 units", location:"Houston, TX", price:520000, revenue:890000, annualCF:195000, type:"Short-Term Rental", employees:3, years:5, multiple:2.7, color:"#f59e0b",
      photos:["https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80"] },
  ];

  const displayListings = [...(listings.length ? listings : DEMO_LISTINGS)]
    .filter(d => filterMin === "all" || d.capRate >= parseFloat(filterMin))
    .sort((a, b) => {
      if (sortBy === "caprate")  return b.capRate - a.capRate;
      if (sortBy === "cashflow") return b.cashFlow - a.cashFlow;
      if (sortBy === "price")    return a.price - b.price;
      if (sortBy === "days")     return a.days - b.days;
      return 0;
    });

  function toggleSave(id: number) {
    setSavedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function nextPhoto(id: number, total: number, e: React.MouseEvent) {
    e.stopPropagation();
    setPhotoIndex(prev => ({ ...prev, [id]: ((prev[id] || 0) + 1) % total }));
  }

  function prevPhoto(id: number, total: number, e: React.MouseEvent) {
    e.stopPropagation();
    setPhotoIndex(prev => ({ ...prev, [id]: ((prev[id] || 0) - 1 + total) % total }));
  }

  function OpportunityBadge({ capRate }: { capRate: number }) {
    if (capRate >= 10) return <span style={{ fontSize: "9px", fontWeight: "900", padding: "3px 9px", borderRadius: "999px", background: "rgba(52,211,153,0.25)", color: "#34d399", border: "1px solid rgba(52,211,153,0.5)", backdropFilter: "blur(8px)" }}>🔥 Excellent</span>;
    if (capRate >= 8)  return <span style={{ fontSize: "9px", fontWeight: "900", padding: "3px 9px", borderRadius: "999px", background: "rgba(245,158,11,0.25)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.5)", backdropFilter: "blur(8px)" }}>✓ Strong</span>;
    if (capRate >= 6)  return <span style={{ fontSize: "9px", fontWeight: "900", padding: "3px 9px", borderRadius: "999px", background: "rgba(96,165,250,0.2)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.4)", backdropFilter: "blur(8px)" }}>~ Fair</span>;
    return <span style={{ fontSize: "9px", fontWeight: "700", padding: "3px 9px", borderRadius: "999px", background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", backdropFilter: "blur(8px)" }}>Weak</span>;
  }

  // ── MAIN LISTING CARD — Zillow level ──
  function ListingCard({ d }: { d: any }) {
    const photos = d.photos || [];
    const idx = photoIndex[d.id] || 0;
    const currentPhoto = photos[idx];
    const scoreColor = d.capRate >= 8 ? "#34d399" : d.capRate >= 6 ? "#f59e0b" : "#f87171";
    const isSaved = savedIds.has(d.id);
    const isNew = d.days <= 3;
    const isHot = d.days <= 7;
    const isExpanded = expandedId === d.id;

    return (
      <div style={{ background: "#111318", border: `1px solid ${isExpanded ? scoreColor+"44" : "rgba(255,255,255,0.07)"}`, borderRadius: "20px", overflow: "hidden", display: "flex", flexDirection: "column", transition: "all 0.2s", boxShadow: isExpanded ? `0 8px 40px ${scoreColor}18` : "0 2px 12px rgba(0,0,0,0.3)" }}>

      {/* ── PHOTO SECTION ── */}
      <div style={{ position: "relative", height: "220px", overflow: "hidden", background: "#0a0b0e", flexShrink: 0 }}>
        {/* Photo */}
        {currentPhoto ? (
          <img
            src={currentPhoto}
            alt={d.address}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "opacity 0.3s" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${scoreColor}18, rgba(0,0,0,0.6))`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "48px", opacity: 0.4 }}>🏠</span>
          </div>
        )}

        {/* Gradient overlay bottom */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "120px", background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)", pointerEvents: "none" }} />

        {/* Top left badges */}
        <div style={{ position: "absolute", top: "12px", left: "12px", display: "flex", gap: "5px", flexWrap: "wrap" as const }}>
          {isNew && <span style={{ fontSize: "9px", fontWeight: "900", padding: "3px 9px", borderRadius: "999px", background: "rgba(52,211,153,0.9)", color: "#000", backdropFilter: "blur(8px)" }}>✦ NEW</span>}
          {!isNew && isHot && <span style={{ fontSize: "9px", fontWeight: "900", padding: "3px 9px", borderRadius: "999px", background: "rgba(245,158,11,0.9)", color: "#000", backdropFilter: "blur(8px)" }}>🔥 HOT</span>}
          {!d.isReal && <span style={{ fontSize: "9px", fontWeight: "700", padding: "3px 9px", borderRadius: "999px", background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.4)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}>DEMO</span>}
          <span style={{ fontSize: "9px", fontWeight: "700", padding: "3px 9px", borderRadius: "999px", background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.6)", backdropFilter: "blur(8px)" }}>{d.type}</span>
        </div>

        {/* Top right — save button + days */}
        <div style={{ position: "absolute", top: "12px", right: "12px", display: "flex", gap: "6px", alignItems: "center" }}>
          <span style={{ fontSize: "9px", fontWeight: "700", padding: "3px 9px", borderRadius: "999px", background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.5)", backdropFilter: "blur(8px)" }}>{d.days}d ago</span>
          <button onClick={(e) => { e.stopPropagation(); toggleSave(d.id); }} style={{ width: "32px", height: "32px", borderRadius: "50%", background: isSaved ? "rgba(245,158,11,0.9)" : "rgba(0,0,0,0.6)", border: `1px solid ${isSaved ? "#f59e0b" : "rgba(255,255,255,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "14px", backdropFilter: "blur(8px)", transition: "all 0.2s" }}>
            {isSaved ? "★" : "☆"}
          </button>
        </div>

        {/* Photo carousel arrows */}
        {photos.length > 1 && (
          <>
            <button onClick={(e) => prevPhoto(d.id, photos.length, e)} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "28px", height: "28px", borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>‹</button>
            <button onClick={(e) => nextPhoto(d.id, photos.length, e)} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", width: "28px", height: "28px", borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>›</button>
            {/* Photo dots */}
            <div style={{ position: "absolute", bottom: "70px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "4px" }}>
              {photos.slice(0, 6).map((_: any, i: number) => (
                <div key={i} onClick={(e) => { e.stopPropagation(); setPhotoIndex(prev => ({...prev, [d.id]: i})); }} style={{ width: idx === i ? "16px" : "5px", height: "5px", borderRadius: "999px", background: idx === i ? "#fff" : "rgba(255,255,255,0.4)", transition: "all 0.2s", cursor: "pointer" }} />
              ))}
            </div>
          </>
        )}

        {/* Bottom overlay — price + address */}
        <div style={{ position: "absolute", bottom: "0", left: "0", right: "0", padding: "12px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <p style={{ fontSize: "22px", fontWeight: "900", color: "#fff", letterSpacing: "-0.5px", lineHeight: 1, marginBottom: "3px" }}>${(d.price/1000).toFixed(0)}K</p>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", fontWeight: "600" }}>{d.address}</p>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>{d.city}</p>
            </div>
            <OpportunityBadge capRate={d.capRate} />
          </div>
        </div>
      </div>

      {/* ── PROPERTY SPECS ── */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" as const }}>
          {[
            { icon: "🛏", value: `${d.beds} bed` },
            { icon: "🚿", value: `${d.baths} bath` },
            { icon: "📐", value: d.sqft ? `${d.sqft.toLocaleString()} sqft` : "—" },
            { icon: "🚗", value: d.garage ? `${d.garage} garage` : null },
            { icon: "📅", value: d.yearBuilt ? `Built ${d.yearBuilt}` : null },
          ].filter(s => s.value).map(s => (
            <span key={s.icon} style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ fontSize: "10px" }}>{s.icon}</span> {s.value}
            </span>
          ))}
        </div>
      </div>

      {/* ── INVESTMENT METRICS — the hero ── */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          {[
            { label: "Cap Rate", value: `${d.capRate}%`, color: d.capRate >= 8 ? "#34d399" : d.capRate >= 6 ? "#f59e0b" : "#f87171", sub: d.capRate >= 8 ? "Strong" : d.capRate >= 6 ? "Fair" : "Weak" },
            { label: "Cash Flow", value: `${d.cashFlow >= 0 ? "+" : ""}$${Math.abs(d.cashFlow)}/mo`, color: d.cashFlow >= 0 ? "#34d399" : "#f87171", sub: "after mortgage" },
            { label: "DSCR", value: `${Number(d.dscr).toFixed(2)}x`, color: d.dscr >= 1.25 ? "#34d399" : d.dscr >= 1.0 ? "#f59e0b" : "#f87171", sub: d.dscr >= 1.25 ? "Qualifies" : "Borderline" },
          ].map(m => (
            <div key={m.label} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${m.color}18`, borderRadius: "12px", padding: "10px 12px" }}>
              <p style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.8px", marginBottom: "4px", fontWeight: "700" }}>{m.label}</p>
              <p style={{ fontSize: "17px", fontWeight: "900", color: m.color, lineHeight: 1, marginBottom: "3px" }}>{m.value}</p>
              <p style={{ fontSize: "9px", color: m.color, opacity: 0.7, fontWeight: "600" }}>{m.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── EXPANDED DETAILS ── */}
      {isExpanded && (
        <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}>
          <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1px", textTransform: "uppercase" as const, fontWeight: "700", marginBottom: "10px" }}>Full Investment Analysis</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {[
              { label: "Est. Monthly Rent", value: `$${d.rent?.toLocaleString()}`, color: "#34d399" },
              { label: "Monthly Mortgage", value: `$${d.monthlyMortgage?.toLocaleString()}`, color: "#f87171" },
              { label: "Monthly Expenses", value: `$${d.expenses?.toLocaleString()}`, color: "#f59e0b" },
              { label: "Down Payment (20%)", value: `$${d.downPayment?.toLocaleString()}`, color: "#fff" },
              { label: "Annual Cash Flow", value: `$${(d.cashFlow * 12)?.toLocaleString()}`, color: d.cashFlow >= 0 ? "#34d399" : "#f87171" },
              { label: "Cash-on-Cash Return", value: `${d.cocReturn}%`, color: d.cocReturn >= 8 ? "#34d399" : "#f59e0b" },
            ].map(m => (
              <div key={m.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: "rgba(0,0,0,0.2)", borderRadius: "8px" }}>
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{m.label}</span>
                <span style={{ fontSize: "11px", fontWeight: "800", color: m.color }}>{m.value}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", marginTop: "8px", lineHeight: "1.5" }}>
            * Estimates based on 0.8% rent rule · 7.5% rate · 30yr · 20% down · 30% expense ratio
          </p>
        </div>
      )}

      {/* ── ACTIONS ── */}
      <div style={{ padding: "12px 16px", display: "flex", gap: "8px" }}>
        <button onClick={() => setExpandedId(isExpanded ? null : d.id)} style={{ flex: 1, padding: "9px", background: isExpanded ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: isExpanded ? "#fff" : "rgba(255,255,255,0.5)", fontWeight: "700", fontSize: "11px", cursor: "pointer", transition: "all 0.2s" }}>
          {isExpanded ? "▲ Less" : "▼ Full Analysis"}
        </button>
        <button onClick={() => {
  setIncomingListing?.({
    address: d.address,
    city: d.city,
    price: d.price,
    beds: d.beds,
    baths: d.baths,
    sqft: d.sqft,
    rent: d.rent,
    capRate: d.capRate,
    cashFlow: d.cashFlow,
    dscr: d.dscr,
    type: d.type,
    photo: d.photos?.[0] || null,
  });
  setActiveTab("finddeals");
}} style={{ flex: 1, padding: "9px", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "10px", color: "#f59e0b", fontWeight: "800", fontSize: "11px", cursor: "pointer" }}>
  ⚡ Deal Lab
</button>
        <button onClick={() => {
  setIncomingFinancing?.({
    address: d.address,
    price: d.price,
    rent: d.rent,
    beds: d.beds,
    baths: d.baths,
    type: d.type,
    capRate: d.capRate,
    cashFlow: d.cashFlow,
    dscr: d.dscr,
  });
  setActiveTab("getfinanced");
}} style={{ flex: 1, padding: "9px", background: scoreColor, color: "#000", borderRadius: "10px", fontWeight: "900", fontSize: "11px", border: "none", cursor: "pointer" }}>
  💰 Finance
</button>
        {d.url && d.url !== "#" && (
          <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ padding: "9px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", color: "rgba(255,255,255,0.4)", fontSize: "13px", textDecoration: "none", display: "flex", alignItems: "center" }}>↗</a>
        )}
      </div>
    </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399", boxShadow: "0 0 8px #34d399", animation: "blink 1.5s infinite" }} />
          <span style={{ fontSize: "10px", color: "rgba(52,211,153,0.7)", letterSpacing: "2px", fontWeight: "700", textTransform: "uppercase" as const }}>Deal Discovery · Ranked by investment quality</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <h2 style={{ fontSize: "24px", fontWeight: "900", letterSpacing: "-0.8px" }}>Deal Discovery</h2>
          {savedIds.size > 0 && (
            <span style={{ fontSize: "11px", color: "#f59e0b", fontWeight: "700", padding: "4px 12px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "999px" }}>★ {savedIds.size} saved</span>
          )}
        </div>
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "4px" }}>Every deal scored · cap rate · cash flow · DSCR · ranked by opportunity</p>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: "4px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "4px", marginBottom: "16px" }}>
        {([
          { key: "listings",   label: "Active Listings"    },
          { key: "distressed", label: "Distressed"         },
          { key: "offmarket",  label: "Off-Market"         },
          { key: "businesses", label: "Businesses"         },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setSubTab(key)} style={{ flex: 1, padding: "10px 6px", borderRadius: "10px", fontSize: "11px", fontWeight: "700", border: `1px solid ${subTab === key ? "rgba(52,211,153,0.45)" : "transparent"}`, cursor: "pointer", background: subTab === key ? "rgba(52,211,153,0.12)" : "transparent", color: subTab === key ? "#34d399" : "rgba(255,255,255,0.4)", transition: "all 0.15s", whiteSpace: "nowrap" as const }}>{label}</button>
        ))}
      </div>

      {/* ── ACTIVE LISTINGS ── */}
      {subTab === "listings" && (
        <div>
          {/* Search bar */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "16px 20px", marginBottom: "16px" }}>
            <div style={{ display: "flex", gap: "10px", marginBottom: "12px", flexWrap: "wrap" as const }}>
              <div style={{ flex: 1, minWidth: "100px" }}>
                <label style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", display: "block", marginBottom: "4px", textTransform: "uppercase" as const, letterSpacing: "1px", fontWeight: "700" }}>Zip Code</label>
                <input value={zipCode} onChange={e => setZipCode(e.target.value)} onKeyDown={e => e.key === "Enter" && searchListings()} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "10px 14px", fontSize: "15px", fontWeight: "700", color: "#fff", outline: "none", fontFamily: "inherit" }} />
              </div>
              <div style={{ flex: 1, minWidth: "120px" }}>
                <label style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", display: "block", marginBottom: "4px", textTransform: "uppercase" as const, letterSpacing: "1px", fontWeight: "700" }}>Max Price</label>
                <input value={priceMax} onChange={e => setPriceMax(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "10px 14px", fontSize: "15px", fontWeight: "700", color: "#fff", outline: "none", fontFamily: "inherit" }} />
              </div>
              <div style={{ flex: 1, minWidth: "80px" }}>
                <label style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", display: "block", marginBottom: "4px", textTransform: "uppercase" as const, letterSpacing: "1px", fontWeight: "700" }}>Min Beds</label>
                <select value={bedsMin} onChange={e => setBedsMin(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", fontWeight: "700", color: "#fff", outline: "none", fontFamily: "inherit" }}>
                  {["1","2","3","4","5"].map(n => <option key={n} value={n} style={{ background: "#111" }}>{n}+ beds</option>)}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button onClick={searchListings} disabled={loading} style={{ padding: "10px 28px", background: loading ? "rgba(52,211,153,0.3)" : "linear-gradient(90deg, #34d399, #10b981)", color: "#000", borderRadius: "10px", fontWeight: "900", fontSize: "13px", border: "none", cursor: loading ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const, letterSpacing: "0.3px" }}>
                  {loading ? "⏳ Loading..." : "Search"}
                </button>
              </div>
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" as const, alignItems: "center" }}>
              <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontWeight: "600", marginRight: "2px" }}>Min cap:</span>
                {[{ v: "all", l: "All" }, { v: "6", l: "6%+" }, { v: "8", l: "8%+" }, { v: "10", l: "10%+" }].map(f => (
                  <button key={f.v} onClick={() => setFilterMin(f.v as any)} style={{ padding: "4px 12px", borderRadius: "999px", fontSize: "11px", fontWeight: "700", border: `1px solid ${filterMin === f.v ? "rgba(52,211,153,0.5)" : "rgba(255,255,255,0.08)"}`, background: filterMin === f.v ? "rgba(52,211,153,0.12)" : "transparent", color: filterMin === f.v ? "#34d399" : "rgba(255,255,255,0.35)", cursor: "pointer" }}>{f.l}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: "4px", alignItems: "center", marginLeft: "auto" }}>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontWeight: "600", marginRight: "2px" }}>Sort:</span>
                {[{ v: "caprate", l: "Cap Rate" }, { v: "cashflow", l: "Cash Flow" }, { v: "price", l: "Price" }, { v: "days", l: "Newest" }].map(s => (
                  <button key={s.v} onClick={() => setSortBy(s.v as any)} style={{ padding: "4px 12px", borderRadius: "999px", fontSize: "11px", fontWeight: "700", border: `1px solid ${sortBy === s.v ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)"}`, background: sortBy === s.v ? "rgba(245,158,11,0.12)" : "transparent", color: sortBy === s.v ? "#f59e0b" : "rgba(255,255,255,0.35)", cursor: "pointer" }}>{s.l}</button>
                ))}
              </div>
            </div>
          </div>

          {/* API notice */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", padding: "8px 14px", background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.12)", borderRadius: "10px" }}>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>
              {RAPIDAPI_KEY ? "✓ Live data from Realtor.com" : "Demo data · "}
              {!RAPIDAPI_KEY && <a href="https://rapidapi.com/apidojo/api/realty-in-us" target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", textDecoration: "none", fontWeight: "700" }}>Connect RapidAPI for live listings + real photos ↗</a>}
            </p>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>{displayListings.length} deals</p>
          </div>

          {/* Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
            {displayListings.map(d => <ListingCard key={d.id} d={d} />)}
          </div>
        </div>
      )}

      {/* ── DISTRESSED ── */}
      {subTab === "distressed" && (
        <div>
          <div style={{ background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.12)", borderRadius: "10px", padding: "10px 16px", marginBottom: "14px" }}>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>Source: <span style={{ color: "#f87171", fontWeight: "700" }}>ATTOM + BatchData</span> — Pre-foreclosure, REO, auctions, Lis Pendens. Updated daily from 3,200+ county courts. Demo data.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
            {DISTRESSED.map(d => {
              const photos = d.photos || [];
              const idx = photoIndex[d.id] || 0;
              const isSaved = savedIds.has(d.id);
              return (
                <div key={d.id} style={{ background: "#111318", border: `1px solid ${d.color}22`, borderRadius: "20px", overflow: "hidden" }}>
                  <div style={{ position: "relative", height: "180px", overflow: "hidden" }}>
                    {photos[idx] && <img src={photos[idx]} alt={d.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "100px", background: "linear-gradient(to top, rgba(0,0,0,0.9), transparent)" }} />
                    <div style={{ position: "absolute", top: "10px", left: "12px", display: "flex", gap: "5px" }}>
                      <span style={{ fontSize: "9px", fontWeight: "800", padding: "2px 9px", borderRadius: "999px", background: `${d.color}88`, color: "#000" }}>{d.type}</span>
                      {d.daysLeft !== null && <span style={{ fontSize: "9px", fontWeight: "900", padding: "2px 9px", borderRadius: "999px", background: d.daysLeft <= 14 ? "rgba(248,113,113,0.9)" : "rgba(245,158,11,0.9)", color: "#000" }}>⏰ {d.daysLeft}d left</span>}
                    </div>
                    <button onClick={() => toggleSave(d.id)} style={{ position: "absolute", top: "10px", right: "12px", width: "30px", height: "30px", borderRadius: "50%", background: isSaved ? "rgba(245,158,11,0.9)" : "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", fontSize: "13px" }}>{isSaved ? "★" : "☆"}</button>
                    <div style={{ position: "absolute", bottom: "10px", left: "12px" }}>
                      <p style={{ fontSize: "18px", fontWeight: "900", color: "#fff" }}>${(d.price/1000).toFixed(0)}K</p>
                      <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>{d.addr} · {d.city}</p>
                    </div>
                  </div>
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginBottom: "12px" }}>
                      {[{ l: "ARV", v: `$${(d.arv/1000).toFixed(0)}K`, c: "#34d399" }, { l: "Equity Gap", v: `$${(d.equity/1000).toFixed(0)}K`, c: "#f59e0b" }, { l: "Cap Rate", v: `${d.capRate}%`, c: d.color }].map(m => (
                        <div key={m.l} style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "9px", textAlign: "center" as const }}>
                          <p style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", marginBottom: "3px" }}>{m.l}</p>
                          <p style={{ fontSize: "14px", fontWeight: "900", color: m.c }}>{m.v}</p>
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: "10px", color: d.color, fontWeight: "700", marginBottom: "10px" }}>Stage: {d.stage}</p>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button style={{ flex: 1, padding: "9px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "10px", color: "#f59e0b", fontWeight: "800", fontSize: "11px", cursor: "pointer" }}>⚡ Deal Lab</button>
                      <button style={{ flex: 1, padding: "9px", background: d.color, color: "#000", borderRadius: "10px", fontWeight: "900", fontSize: "11px", border: "none", cursor: "pointer" }}>💰 Finance</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── OFF-MARKET ── */}
      {subTab === "offmarket" && (
        <div>
          <div style={{ background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.12)", borderRadius: "10px", padding: "10px 16px", marginBottom: "14px" }}>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>Source: <span style={{ color: "#a78bfa", fontWeight: "700" }}>PropStream</span> — Tax delinquent, absentee owners, high-equity, estate sales. Motivated sellers before MLS. Demo data.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
            {OFFMARKET.map(d => {
              const idx = photoIndex[d.id] || 0;
              const isSaved = savedIds.has(d.id);
              return (
                <div key={d.id} style={{ background: "#111318", border: `1px solid ${d.color}22`, borderRadius: "20px", overflow: "hidden" }}>
                  <div style={{ position: "relative", height: "180px", overflow: "hidden" }}>
                    {d.photos[idx] && <img src={d.photos[idx]} alt={d.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "100px", background: "linear-gradient(to top, rgba(0,0,0,0.9), transparent)" }} />
                    <div style={{ position: "absolute", top: "10px", left: "12px" }}>
                      <span style={{ fontSize: "9px", fontWeight: "800", padding: "2px 9px", borderRadius: "999px", background: `${d.color}88`, color: "#000" }}>Off-Market</span>
                    </div>
                    <button onClick={() => toggleSave(d.id)} style={{ position: "absolute", top: "10px", right: "12px", width: "30px", height: "30px", borderRadius: "50%", background: isSaved ? "rgba(245,158,11,0.9)" : "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", fontSize: "13px" }}>{isSaved ? "★" : "☆"}</button>
                    <div style={{ position: "absolute", bottom: "10px", left: "12px" }}>
                      <p style={{ fontSize: "18px", fontWeight: "900", color: "#fff" }}>${(d.price/1000).toFixed(0)}K</p>
                      <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>{d.addr} · {d.city}</p>
                    </div>
                  </div>
                  <div style={{ padding: "14px 16px" }}>
                    <p style={{ fontSize: "11px", color: d.color, fontWeight: "700", marginBottom: "10px" }}>💡 {d.motivation}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginBottom: "12px" }}>
                      {[{ l: "Equity", v: `$${(d.equity/1000).toFixed(0)}K`, c: "#34d399" }, { l: "Equity %", v: `${d.equityPct}%`, c: "#f59e0b" }, { l: "Cap Rate", v: `${d.capRate}%`, c: d.color }].map(m => (
                        <div key={m.l} style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "9px", textAlign: "center" as const }}>
                          <p style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", marginBottom: "3px" }}>{m.l}</p>
                          <p style={{ fontSize: "14px", fontWeight: "900", color: m.c }}>{m.v}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button style={{ flex: 1, padding: "9px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "10px", color: "#f59e0b", fontWeight: "800", fontSize: "11px", cursor: "pointer" }}>⚡ Deal Lab</button>
                      <button style={{ flex: 1, padding: "9px", background: d.color, color: "#000", borderRadius: "10px", fontWeight: "900", fontSize: "11px", border: "none", cursor: "pointer" }}>💰 Finance</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── BUSINESSES ── */}
      {subTab === "businesses" && (
        <div>
          <div style={{ background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.12)", borderRadius: "10px", padding: "10px 16px", marginBottom: "14px" }}>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>Source: <span style={{ color: "#60a5fa", fontWeight: "700" }}>BizBuySell</span> — RE-related businesses for sale. STR portfolios, PM companies, RE services. Demo data.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
            {BUSINESSES.map(d => {
              const idx = photoIndex[d.id] || 0;
              const isSaved = savedIds.has(d.id);
              return (
                <div key={d.id} style={{ background: "#111318", border: `1px solid ${d.color}22`, borderRadius: "20px", overflow: "hidden" }}>
                  <div style={{ position: "relative", height: "160px", overflow: "hidden" }}>
                    {d.photos[idx] && <img src={d.photos[idx]} alt={d.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "80px", background: "linear-gradient(to top, rgba(0,0,0,0.9), transparent)" }} />
                    <div style={{ position: "absolute", top: "10px", left: "12px" }}>
                      <span style={{ fontSize: "9px", fontWeight: "800", padding: "2px 9px", borderRadius: "999px", background: `${d.color}88`, color: "#000" }}>{d.type}</span>
                    </div>
                    <button onClick={() => toggleSave(d.id)} style={{ position: "absolute", top: "10px", right: "12px", width: "30px", height: "30px", borderRadius: "50%", background: isSaved ? "rgba(245,158,11,0.9)" : "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", fontSize: "13px" }}>{isSaved ? "★" : "☆"}</button>
                    <div style={{ position: "absolute", bottom: "8px", left: "12px" }}>
                      <p style={{ fontSize: "18px", fontWeight: "900", color: "#fff" }}>${(d.price/1000).toFixed(0)}K</p>
                    </div>
                  </div>
                  <div style={{ padding: "14px 16px" }}>
                    <p style={{ fontSize: "14px", fontWeight: "800", marginBottom: "3px" }}>{d.name}</p>
                    <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", marginBottom: "12px" }}>{d.location} · {d.years}yr · {d.employees} employees</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginBottom: "12px" }}>
                      {[{ l: "Revenue/yr", v: `$${(d.revenue/1000).toFixed(0)}K`, c: "#34d399" }, { l: "Net CF/yr", v: `$${(d.annualCF/1000).toFixed(0)}K`, c: "#f59e0b" }, { l: "Multiple", v: `${d.multiple}x`, c: d.color }].map(m => (
                        <div key={m.l} style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "9px", textAlign: "center" as const }}>
                          <p style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", marginBottom: "3px" }}>{m.l}</p>
                          <p style={{ fontSize: "14px", fontWeight: "900", color: m.c }}>{m.v}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button style={{ flex: 1, padding: "9px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "10px", color: "#f59e0b", fontWeight: "800", fontSize: "11px", cursor: "pointer" }}>⚡ Analyze</button>
                      <button style={{ flex: 1, padding: "9px", background: d.color, color: "#000", borderRadius: "10px", fontWeight: "900", fontSize: "11px", border: "none", cursor: "pointer" }}>💰 Finance</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN DEAL LAB TAB ─────────────────────────────────────────────────
function DealLabTab({ user, incomingListing }: { user: any; incomingListing?: any }) {
  const [subTab, setSubTab] = useState<"analyzer"|"pipeline"|"discover"|"room"|"pros">("analyzer");
  const [filterTier, setFilterTier] = useState<"all"|DealTier>("all");
  const [search, setSearch] = useState("");
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [analyses, setAnalyses] = useState<DealAnalysis[]>([]);
  const [loadingAnalyses, setLoadingAnalyses] = useState(true);
  const [showAddAnalysis, setShowAddAnalysis] = useState(false);
  const [addForm, setAddForm] = useState({ name:"", project_type:"", tier:"a" as DealTier, capital:"", geography:"", risk:"Med", notes:"", deadline:"" });
  const [profilerCapital, setProfilerCapital] = useState("$50k–$150k");
  const [profilerTime, setProfilerTime] = useState("5–20h/week");
  const [profilerGeo, setProfilerGeo] = useState<string[]>(["United States"]);

  // Auto-fill from incoming listing
  useEffect(() => {
    if (incomingListing) {
      setAddForm(prev => ({
        ...prev,
        name: incomingListing.address,
        project_type: incomingListing.type || "Single Family",
        capital: String(Math.round(incomingListing.price * 0.20)),
        geography: incomingListing.city || "",
        notes: `Price: $${incomingListing.price?.toLocaleString()} · Rent: $${incomingListing.rent}/mo · Cap Rate: ${incomingListing.capRate}% · Cash Flow: $${incomingListing.cashFlow}/mo · DSCR: ${incomingListing.dscr}x`,
      }));
    }
  }, [incomingListing]);

  useEffect(() => { if (user) loadAnalyses(); }, [user]);

  async function loadAnalyses() {
    const { data } = await supabase.from("deal_lab").select("*").eq("user_id", user.id).order("created_at",{ascending:false});
    const parsed = (data || []).map((a:any) => ({
      ...a,
      checklist: typeof a.checklist==="string" ? JSON.parse(a.checklist) : (a.checklist||[]),
    }));
    setAnalyses(parsed); setLoadingAnalyses(false);
  }

  async function addAnalysis(prefill?: {name:string;project_type:string;tier:DealTier}) {
    const f = prefill || addForm;
    if (!f.name || !f.project_type) return;
    const defaultChecklist = [
      {label:"Exit strategy defined",done:false},
      {label:"Zoning confirmed",done:false},
      {label:"Comparable rents researched",done:false},
      {label:"Financing source confirmed",done:false},
      {label:"Property manager identified",done:false},
      {label:"Market analysis complete",done:false},
      {label:"Legal review done",done:false},
      {label:"Decision deadline set",done:false},
    ];
    const row = { user_id:user.id, name:f.name, project_type:f.project_type, tier:f.tier, capital:addForm.capital, geography:addForm.geography, risk:addForm.risk, notes:addForm.notes, deadline:addForm.deadline, completeness:0, status:"active", checklist:JSON.stringify(defaultChecklist), deal_score:0 };
    const { data, error } = await supabase.from("deal_lab").insert(row).select().single();
    if (!error && data) {
      const parsed = { ...data, checklist: typeof data.checklist==="string" ? JSON.parse(data.checklist) : (data.checklist||[]) };
      setAnalyses(prev => [parsed, ...prev]);
      setShowAddAnalysis(false);
      setAddForm({name:"",project_type:"",tier:"a",capital:"",geography:"",risk:"Med",notes:"",deadline:""});
      setSubTab("pipeline");
    }
  }

  async function saveDealFromAnalyzer(result: AnalyzerResult, inputs: any) {
    const checklist = [
      {label:"Exit strategy defined", done:true},
      {label:"Cash flow verified positive", done:result.cashFlow>0},
      {label:"Cap rate above 6%", done:result.capRate>=6},
      {label:"DSCR above 1.25", done:result.dscr>=1.25},
      {label:"Comparable rents researched", done:false},
      {label:"Financing source confirmed", done:false},
      {label:"Property manager identified", done:false},
      {label:"Legal review done", done:false},
    ];
    const donePct = Math.round((checklist.filter(c=>c.done).length/checklist.length)*100);
    const row = { user_id:user.id, name:`Analyzed Deal (${result.verdict})`, project_type:"From Analyzer", tier:"a" as DealTier, capital:`$${Math.round(inputs.downPayment+inputs.closingCosts+inputs.rehabCost).toLocaleString()}`, geography:"", risk:result.score>=70?"Low":result.score>=50?"Med":"High", notes:`Score: ${result.score}/100 · Cap Rate: ${result.capRate.toFixed(1)}% · CoC: ${result.cocReturn.toFixed(1)}%`, deadline:"", completeness:donePct, status:"active", checklist:JSON.stringify(checklist), deal_score:result.score, analyzer_data:JSON.stringify({...inputs, result}) };
    const { data, error } = await supabase.from("deal_lab").insert(row).select().single();
    if (!error && data) {
      const parsed = { ...data, checklist: typeof data.checklist==="string" ? JSON.parse(data.checklist) : (data.checklist||[]) };
      setAnalyses(prev => [parsed, ...prev]);
      setSubTab("pipeline");
    }
  }

  async function toggleCheck(analysis: DealAnalysis, idx: number) {
    const updated = analysis.checklist.map((c,i) => i===idx ? {...c,done:!c.done} : c);
    const done = updated.filter(c=>c.done).length;
    const completeness = Math.round((done/updated.length)*100);
    const score = calcDealScore(updated, analysis.deadline, completeness);
    await supabase.from("deal_lab").update({checklist:JSON.stringify(updated),completeness,deal_score:score}).eq("id",analysis.id);
    setAnalyses(prev => prev.map(a => a.id===analysis.id ? {...a,checklist:updated,completeness,deal_score:score} : a));
  }

  async function deleteAnalysis(id: number) {
    await supabase.from("deal_lab").delete().eq("id",id);
    setAnalyses(prev => prev.filter(a=>a.id!==id));
  }

  const filtered = PROJECTS.filter(p => {
    const tierMatch = filterTier==="all" || p.tier===filterTier;
    const searchMatch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.desc.toLowerCase().includes(search.toLowerCase()) || p.chips.some(c=>c.toLowerCase().includes(search.toLowerCase()));
    return tierMatch && searchMatch;
  });

  const IS: React.CSSProperties = { width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"10px", padding:"10px 14px", fontSize:"13px", color:"#fff", outline:"none", fontFamily:"'DM Sans',sans-serif", boxSizing:"border-box" };

  const urgentCount = analyses.filter(a => a.deadline && (daysUntil(a.deadline)??99)<=7).length;
  const incompleteCount = analyses.filter(a => a.completeness < 100).length;

  return (
    <div>
      <style>{`
        @keyframes fadeInUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes verdictPulse { 0%,100%{box-shadow:0 0 0 0 rgba(52,211,153,0.3)} 50%{box-shadow:0 0 0 8px rgba(52,211,153,0)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes scoreFill { from{stroke-dashoffset:88} }
      `}</style>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"24px", flexWrap:"wrap", gap:"12px" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"6px" }}>
            <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#60a5fa", boxShadow:"0 0 6px #60a5fa", animation:"blink 1.5s infinite" }}/>
            <span style={{ fontSize:"10px", color:"rgba(96,165,250,0.7)", letterSpacing:"2px", fontWeight:"800", textTransform:"uppercase" }}>Deal Lab · Analyze · Decide · Win</span>
          </div>
          <h2 style={{ fontSize:"26px", fontWeight:"900", letterSpacing:"-1px", background:"linear-gradient(135deg,#fff 60%,rgba(255,255,255,0.4))", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Deal Lab</h2>
          <p style={{ fontSize:"11px", color:"rgba(255,255,255,0.25)", marginTop:"4px" }}>Instant ROI analysis · Strategy comparison · AI coaching · {analyses.length} deals tracked</p>
        </div>
        <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" }}>
          {urgentCount > 0 && <div style={{ padding:"6px 12px", background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.3)", borderRadius:"999px", fontSize:"11px", fontWeight:"800", color:"#f87171", animation:"verdictPulse 2s infinite" }}>🔴 {urgentCount} urgent</div>}
          <button onClick={()=>{setShowAddAnalysis(true);}} style={{ padding:"9px 18px", background:"#60a5fa", color:"#000", borderRadius:"10px", fontWeight:"900", fontSize:"13px", border:"none", cursor:"pointer" }}>+ Add Deal</button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display:"flex", gap:"2px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:"14px", padding:"4px", marginBottom:"24px", overflowX:"auto" }}>
        {([
          {key:"analyzer", label:"⚡ Analyzer",       badge:null},
          {key:"pipeline", label:"🔍 Pipeline",        badge:incompleteCount > 0 ? incompleteCount : null},
          {key:"discover", label:"🗺 Discover",         badge:null},
          {key:"room",     label:"🏛 Deal Room",        badge:null},
          {key:"pros",     label:"🛡 Professionals",    badge:null},
        ] as const).map(({key,label,badge}) => (
          <button key={key} onClick={()=>setSubTab(key)} style={{ flex:1, padding:"10px 12px", borderRadius:"10px", fontSize:"12px", fontWeight:"700", border:`1px solid ${subTab===key?"rgba(96,165,250,0.4)":"transparent"}`, cursor:"pointer", background:subTab===key?"rgba(96,165,250,0.15)":"transparent", color:subTab===key?"#60a5fa":"rgba(255,255,255,0.4)", transition:"all 0.15s", position:"relative", whiteSpace:"nowrap" }}>
            {label}
            {badge && <span style={{ position:"absolute", top:"-4px", right:"-2px", background:"#f87171", color:"#fff", borderRadius:"999px", fontSize:"8px", fontWeight:"900", minWidth:"14px", height:"14px", display:"flex", alignItems:"center", justifyContent:"center", padding:"0 3px" }}>{badge}</span>}
          </button>
        ))}
      </div>

      {/* ── ANALYZER ─────────────────────────────────────────── */}
      {subTab === "analyzer" && (
        <div>
          <AIWeeklyCoach analyses={analyses}/>
          <MarketPulsePanel geography={analyses[0]?.geography}/>
          <DealAnalyzerPanel onSaveToPipeline={saveDealFromAnalyzer}/>
        </div>
      )}

      {/* ── PIPELINE ─────────────────────────────────────────── */}
      {subTab === "pipeline" && (
        <div>
          <AIWeeklyCoach analyses={analyses}/>

          {loadingAnalyses ? <p style={{ color:"rgba(255,255,255,0.3)", fontSize:"13px" }}>Loading...</p> : analyses.length === 0 ? (
            <div style={{ padding:"60px", textAlign:"center", border:"1px dashed rgba(96,165,250,0.15)", borderRadius:"20px" }}>
              <p style={{ fontSize:"40px", marginBottom:"12px" }}>🔍</p>
              <p style={{ fontSize:"14px", fontWeight:"700", color:"rgba(255,255,255,0.4)", marginBottom:"6px" }}>No deals in pipeline</p>
              <p style={{ fontSize:"12px", color:"rgba(255,255,255,0.2)", marginBottom:"20px" }}>Use the Analyzer to evaluate a deal, or click "+ Add Deal" to track one manually.</p>
              <button onClick={()=>setSubTab("analyzer")} style={{ padding:"10px 20px", background:"#60a5fa", color:"#000", borderRadius:"10px", fontWeight:"800", fontSize:"13px", border:"none", cursor:"pointer" }}>⚡ Run Analyzer →</button>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
              {analyses.map(a => {
                const checklist = a.checklist || [];
                const score = a.deal_score || calcDealScore(checklist, a.deadline, a.completeness);
                const barColor = a.completeness>=75?"#34d399":a.completeness>=40?"#f59e0b":"rgba(255,255,255,0.3)";
                const tm = TIER_META[a.tier] || TIER_META.a;
                const days = a.deadline ? daysUntil(a.deadline) : null;
                const isUrgent = days !== null && days <= 7;

                return (
                  <div key={a.id} style={{ background:"rgba(255,255,255,0.02)", border:`1px solid ${isUrgent?"rgba(248,113,113,0.3)":barColor+"22"}`, borderRadius:"18px", overflow:"hidden", animation:"fadeInUp 0.3s ease" }}>
                    {/* Header */}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 20px", flexWrap:"wrap", gap:"10px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                        <DealScoreRing score={score} size={52}/>
                        <div>
                          <p style={{ fontSize:"15px", fontWeight:"800" }}>{a.name}</p>
                          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginTop:"4px", flexWrap:"wrap" }}>
                            <span style={{ fontSize:"10px", fontWeight:"700", padding:"1px 7px", borderRadius:"20px", background:tm.bg, color:tm.color, border:`1px solid ${tm.border}` }}>{tm.label}</span>
                            <span style={{ fontSize:"10px", color:"rgba(255,255,255,0.3)" }}>{a.project_type}</span>
                            {a.capital && <span style={{ fontSize:"10px", color:"rgba(255,255,255,0.3)" }}>· {a.capital}</span>}
                            {a.geography && <span style={{ fontSize:"10px", color:"rgba(96,165,250,0.7)", fontWeight:"600" }}>📍 {a.geography}</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:"12px", flexWrap:"wrap" }}>
                        <DeadlineCounter deadline={a.deadline}/>
                        <span style={{ fontSize:"13px", fontWeight:"800", color:barColor }}>{a.completeness}%</span>
                        <button onClick={()=>deleteAnalysis(a.id)} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.2)", cursor:"pointer", fontSize:"18px" }}>×</button>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ height:"3px", background:"rgba(255,255,255,0.05)", margin:"0 20px 14px" }}>
                      <div style={{ height:"100%", width:`${a.completeness}%`, background:barColor, borderRadius:"999px", transition:"width 0.5s", boxShadow:`0 0 6px ${barColor}66` }}/>
                    </div>

                    {/* Checklist — compact */}
                    <div style={{ padding:"0 20px 16px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"5px" }}>
                      {checklist.map((item,idx) => (
                        <div key={idx} onClick={()=>toggleCheck(a,idx)} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"7px 10px", borderRadius:"8px", background:item.done?"rgba(52,211,153,0.05)":"rgba(255,255,255,0.02)", border:`1px solid ${item.done?"rgba(52,211,153,0.15)":"rgba(255,255,255,0.05)"}`, cursor:"pointer", transition:"all 0.15s" }}>
                          <div style={{ width:"14px", height:"14px", borderRadius:"4px", border:`1.5px solid ${item.done?"#34d399":"rgba(255,255,255,0.2)"}`, background:item.done?"#34d399":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:"9px", color:"#000" }}>{item.done?"✓":""}</div>
                          <span style={{ fontSize:"11px", color:item.done?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.7)", textDecoration:item.done?"line-through":"none" }}>{item.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Market pulse micro */}
                    {a.completeness === 100 && (
                      <div style={{ margin:"0 20px 16px", padding:"10px 14px", background:"rgba(52,211,153,0.06)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:"10px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:"12px", color:"#34d399", fontWeight:"700" }}>✓ Analysis complete — ready to decide</span>
                        <button style={{ fontSize:"11px", padding:"5px 12px", background:"#34d399", color:"#000", borderRadius:"6px", fontWeight:"900", border:"none", cursor:"pointer" }}>Move to Action →</button>
                      </div>
                    )}
                    {a.notes && <p style={{ fontSize:"11px", color:"rgba(255,255,255,0.3)", margin:"0 20px 14px", padding:"8px 10px", background:"rgba(255,255,255,0.02)", borderRadius:"8px", fontStyle:"italic" }}>{a.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── DISCOVER ─────────────────────────────────────────── */}
      {subTab === "discover" && (
        <div>
          {/* Profiler */}
          <div style={{ background:"rgba(96,165,250,0.04)", border:"1px solid rgba(96,165,250,0.15)", borderRadius:"16px", padding:"20px 24px", marginBottom:"20px" }}>
            <p style={{ fontSize:"10px", color:"rgba(96,165,250,0.7)", letterSpacing:"2px", fontWeight:"800", textTransform:"uppercase", marginBottom:"14px" }}>Your Investor Profile</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"12px" }}>
              <div>
                <label style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"1px", display:"block", marginBottom:"6px" }}>Available capital</label>
                <select value={profilerCapital} onChange={e=>setProfilerCapital(e.target.value)} style={IS}>
                  {["Under $50k","$50k–$150k","$150k–$500k","$500k–$1M","$1M+"].map(v=><option key={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", textTransform:"uppercase", letterSpacing:"1px", display:"block", marginBottom:"6px" }}>Time per week</label>
                <select value={profilerTime} onChange={e=>setProfilerTime(e.target.value)} style={IS}>
                  {["0–5h/week (passive)","5–20h/week (active)","20h+/week (business)"].map(v=><option key={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
              {GEOS.map(g=>(
                <button key={g} onClick={()=>setProfilerGeo(prev=>prev.includes(g)?prev.filter(x=>x!==g):[...prev,g])} style={{ fontSize:"11px", padding:"5px 12px", borderRadius:"999px", fontWeight:"600", border:`1px solid ${profilerGeo.includes(g)?"rgba(96,165,250,0.5)":"rgba(255,255,255,0.08)"}`, background:profilerGeo.includes(g)?"rgba(96,165,250,0.15)":"rgba(255,255,255,0.03)", color:profilerGeo.includes(g)?"#60a5fa":"rgba(255,255,255,0.4)", cursor:"pointer", transition:"all 0.12s" }}>{g}</button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div style={{ display:"flex", gap:"8px", marginBottom:"16px", flexWrap:"wrap" }}>
            <input placeholder="Search project types..." value={search} onChange={e=>setSearch(e.target.value)} style={{ flex:2, minWidth:"160px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"10px", padding:"9px 14px", fontSize:"13px", color:"#fff", outline:"none", fontFamily:"'DM Sans',sans-serif" }}/>
            {(["all","p","a","b"] as const).map(t => {
              const meta = t==="all" ? null : TIER_META[t];
              return (
                <button key={t} onClick={()=>setFilterTier(t)} style={{ padding:"9px 16px", borderRadius:"10px", fontSize:"12px", fontWeight:"700", border:`1px solid ${filterTier===t?(meta?.color||"rgba(255,255,255,0.4)")+"55":"rgba(255,255,255,0.08)"}`, background:filterTier===t?(meta?.bg||"rgba(255,255,255,0.06)"):"rgba(255,255,255,0.03)", color:filterTier===t?(meta?.color||"#fff"):"rgba(255,255,255,0.4)", cursor:"pointer" }}>
                  {t==="all"?`All (${PROJECTS.length})`:`${meta!.label} (${PROJECTS.filter(p=>p.tier===t).length})`}
                </button>
              );
            })}
          </div>

          {/* Cards by tier */}
          {(["p","a","b"] as const).map(tier => {
            const items = filtered.filter(p=>p.tier===tier);
            if (!items.length) return null;
            const meta = TIER_META[tier];
            return (
              <div key={tier} style={{ marginBottom:"28px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px" }}>
                  <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:meta.color }}/>
                  <span style={{ fontSize:"12px", fontWeight:"700", color:meta.color }}>{meta.label}</span>
                  <span style={{ fontSize:"11px", color:"rgba(255,255,255,0.3)" }}>{meta.desc}</span>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:"10px" }}>
                  {items.map(p => {
                    const riskColor = RISK_COLOR[p.risk] || "#f59e0b";
                    const isSelected = selectedCard?.id === p.id;
                    return (
                      <div key={p.id} onClick={()=>setSelectedCard(isSelected?null:p)} style={{ background:"rgba(255,255,255,0.02)", border:`1px solid ${isSelected?meta.color+"55":"rgba(255,255,255,0.07)"}`, borderRadius:"16px", overflow:"hidden", cursor:"pointer", transition:"all 0.15s" }}>
                        {/* Gradient header */}
                        <div style={{ height:"90px", background:`linear-gradient(135deg,${meta.color}18,${meta.color}06)`, position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <div style={{ position:"absolute", top:"8px", left:"8px" }}><span style={{ fontSize:"9px", fontWeight:"800", padding:"2px 7px", borderRadius:"20px", background:meta.bg, color:meta.color, border:`1px solid ${meta.border}` }}>{meta.label.toUpperCase()}</span></div>
                          <div style={{ position:"absolute", top:"8px", right:"8px" }}><span style={{ fontSize:"9px", fontWeight:"700", color:riskColor, background:`${riskColor}22`, border:`1px solid ${riskColor}44`, padding:"2px 7px", borderRadius:"20px" }}>{p.risk}</span></div>
                          <span style={{ fontSize:"13px", fontWeight:"900", color:meta.color }}>{p.roi}</span>
                        </div>
                        <div style={{ padding:"12px 14px" }}>
                          <p style={{ fontSize:"13px", fontWeight:"800", marginBottom:"4px" }}>{p.name}</p>
                          <p style={{ fontSize:"11px", color:"rgba(255,255,255,0.45)", lineHeight:"1.5", marginBottom:"10px" }}>{p.desc.slice(0,72)}…</p>
                          <div style={{ display:"flex", gap:"4px", flexWrap:"wrap", marginBottom:"8px" }}>
                            <span style={{ fontSize:"9px", color:"rgba(255,255,255,0.4)", background:"rgba(255,255,255,0.05)", padding:"2px 7px", borderRadius:"6px" }}>{p.cap}</span>
                            <span style={{ fontSize:"9px", color:"rgba(255,255,255,0.4)", background:"rgba(255,255,255,0.05)", padding:"2px 7px", borderRadius:"6px" }}>{p.time}</span>
                          </div>
                          <div style={{ height:"3px", background:"rgba(255,255,255,0.06)", borderRadius:"999px" }}>
                            <div style={{ height:"100%", width:`${p.fill}%`, background:meta.color, borderRadius:"999px" }}/>
                          </div>
                        </div>
                        {isSelected && (
                          <div style={{ borderTop:`1px solid ${meta.color}22`, padding:"14px", background:`${meta.color}06` }}>
                            <p style={{ fontSize:"12px", color:"rgba(255,255,255,0.6)", lineHeight:"1.6", marginBottom:"10px" }}>{p.desc}</p>
                            <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.4)", marginBottom:"10px", padding:"8px 12px", background:`${riskColor}10`, borderRadius:"8px", border:`1px solid ${riskColor}30` }}><span style={{ color:riskColor, fontWeight:"700" }}>Risk: </span>{p.riskDetail}</div>
                            <div style={{ display:"flex", gap:"5px", flexWrap:"wrap", marginBottom:"12px" }}>
                              {p.chips.map(c=><span key={c} style={{ fontSize:"10px", padding:"3px 9px", borderRadius:"999px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.5)" }}>{c}</span>)}
                            </div>
                            <button onClick={e=>{e.stopPropagation();setAddForm(f=>({...f,name:p.name+" — Deal",project_type:p.name,tier:p.tier}));setShowAddAnalysis(true);}} style={{ width:"100%", padding:"9px", background:meta.color, color:"#000", borderRadius:"8px", fontWeight:"900", fontSize:"12px", border:"none", cursor:"pointer" }}>+ Add to Pipeline →</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── DEAL ROOM ────────────────────────────────────────── */}
      {subTab === "room" && <DealRoomPanel/>}

      {/* ── PROFESSIONALS ────────────────────────────────────── */}
      {subTab === "pros" && (
        <div>
          <div style={{ background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:"12px", padding:"12px 18px", marginBottom:"20px", display:"flex", gap:"12px", alignItems:"flex-start" }}>
            <span style={{ fontSize:"18px", flexShrink:0 }}>🛡</span>
            <div>
              <p style={{ fontSize:"12px", fontWeight:"700", color:"#f59e0b", marginBottom:"3px" }}>Zero-tolerance fraud policy</p>
              <p style={{ fontSize:"11px", color:"rgba(255,255,255,0.4)", lineHeight:"1.6" }}>Every professional listed here has been manually verified. Only accredited, licensed professionals with verifiable credentials appear in this directory. No unvetted third parties, ever.</p>
            </div>
          </div>

          {[
            {label:"Legal & Compliance", color:"#a78bfa", pros:[
              {name:"Real Estate Attorney", role:"Contract review, zoning, title", badge:"Bar certified", note:"Essential before any acquisition. Review every contract.", geo:"US · Nationwide"},
              {name:"Tax Advisor (RE)", role:"Depreciation, 1031 exchange, cost seg", badge:"CPA licensed", note:"Saves more than they cost on your first deal.", geo:"US · Nationwide"},
              {name:"Corporate Structuring", role:"LLC, holding companies, asset protection", badge:"Attorney + CPA", note:"Structure before you buy, not after. Retroactive restructuring costs more.", geo:"US · Nationwide"},
            ]},
            {label:"Financing & Capital", color:"#60a5fa", pros:[
              {name:"DSCR Mortgage Broker", role:"Investment loans, no income verification", badge:"NMLS licensed", note:"Qualification based on rental income, not your salary.", geo:"US · Nationwide"},
              {name:"Hard Money Lender", role:"Fast short-term financing for flips", badge:"State licensed", note:"Close in 7–14 days. Critical for competitive markets.", geo:"US · Multi-state"},
              {name:"Private Equity Intro", role:"JV partnerships, syndication capital", badge:"SEC accredited", note:"Access deals above your budget via strategic partnerships.", geo:"US · Nationwide"},
            ]},
            {label:"Construction & Renovation", color:"#f59e0b", pros:[
              {name:"General Contractor", role:"Full renovation management", badge:"Licensed & insured", note:"Ask for 3 references on projects matching your scope.", geo:"Local market"},
              {name:"Property Inspector", role:"Pre-purchase & pre-listing inspections", badge:"InterNACHI certified", note:"Never skip this. Uncovers hidden costs before you buy.", geo:"Local market"},
              {name:"Cost Segregation Specialist", role:"Tax depreciation optimization", badge:"CPA certified", note:"Typically generates $50K+ in first-year deductions on a $500K property.", geo:"US · Nationwide"},
            ]},
            {label:"Property Management", color:"#34d399", pros:[
              {name:"STR Concierge Manager", role:"Airbnb co-hosting, guest management", badge:"Platform certified", note:"Takes 15–25% but enables truly passive STR income.", geo:"Local market"},
              {name:"Long-Term PM Company", role:"Leasing, rent collection, maintenance", badge:"NARPM member", note:"8–10% of rent. Evaluate by vacancy rate and response time.", geo:"Local market"},
              {name:"Virtual PM Service", role:"Remote portfolio management", badge:"Tech-enabled", note:"Ideal for out-of-state investors. Full dashboard access.", geo:"US · Nationwide"},
            ]},
          ].map(section => (
            <div key={section.label} style={{ marginBottom:"24px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"12px" }}>
                <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:section.color }}/>
                <span style={{ fontSize:"12px", fontWeight:"700", color:section.color }}>{section.label}</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:"10px" }}>
                {section.pros.map(pro=>(
                  <div key={pro.name} style={{ background:"rgba(255,255,255,0.02)", border:`1px solid ${section.color}22`, borderRadius:"14px", padding:"16px 18px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"8px" }}>
                      <div>
                        <p style={{ fontSize:"13px", fontWeight:"800" }}>{pro.name}</p>
                        <p style={{ fontSize:"11px", color:"rgba(255,255,255,0.4)", marginTop:"2px" }}>{pro.role}</p>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"4px" }}>
                        <span style={{ fontSize:"9px", fontWeight:"800", color:"#34d399", background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.25)", borderRadius:"20px", padding:"2px 8px" }}>✓ Verified</span>
                        <span style={{ fontSize:"9px", color:section.color, background:`${section.color}12`, border:`1px solid ${section.color}30`, borderRadius:"20px", padding:"2px 8px", fontWeight:"700" }}>{pro.badge}</span>
                      </div>
                    </div>
                    <p style={{ fontSize:"11px", color:"rgba(255,255,255,0.35)", lineHeight:"1.5", marginBottom:"10px", fontStyle:"italic" }}>{pro.note}</p>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:"10px", color:"rgba(255,255,255,0.2)", fontWeight:"600" }}>{pro.geo}</span>
                      <span style={{ fontSize:"10px", color:"rgba(255,255,255,0.25)", background:"rgba(255,255,255,0.04)", padding:"3px 10px", borderRadius:"6px" }}>Coming soon</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ textAlign:"center", padding:"24px", border:"1px dashed rgba(255,255,255,0.08)", borderRadius:"14px" }}>
            <p style={{ fontSize:"14px", fontWeight:"700", color:"rgba(255,255,255,0.4)", marginBottom:"6px" }}>Are you a verified professional?</p>
            <p style={{ fontSize:"12px", color:"rgba(255,255,255,0.2)", marginBottom:"12px" }}>Manual review only. Accredited, licensed professionals exclusively.</p>
            <button style={{ fontSize:"12px", padding:"9px 20px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"8px", color:"rgba(255,255,255,0.5)", cursor:"pointer", fontWeight:"600" }}>Apply to be listed →</button>
          </div>
        </div>
      )}

      {/* Add Deal Modal */}
      {showAddAnalysis && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", backdropFilter:"blur(10px)", display:"flex", alignItems:"flex-start", justifyContent:"center", zIndex:60, padding:"80px 20px 20px" }}>
          <div style={{ background:"#0f0f0f", border:"1px solid rgba(96,165,250,0.25)", borderRadius:"24px", padding:"36px", width:"100%", maxWidth:"500px", maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px" }}>
              <h2 style={{ fontSize:"17px", fontWeight:"900", color:"#60a5fa" }}>Add Deal to Pipeline</h2>
              <button onClick={()=>setShowAddAnalysis(false)} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:"22px" }}>×</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
              <div>
                <label style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", textTransform:"uppercase", display:"block", marginBottom:"6px", fontWeight:"700" }}>Deal Name *</label>
                <input type="text" placeholder="e.g. STR duplex — Austin TX" value={addForm.name} onChange={e=>setAddForm(f=>({...f,name:e.target.value}))} style={IS}/>
              </div>
              <div>
                <label style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", textTransform:"uppercase", display:"block", marginBottom:"6px", fontWeight:"700" }}>Project Type *</label>
                <select value={addForm.project_type} onChange={e=>setAddForm(f=>({...f,project_type:e.target.value}))} style={IS}>
                  <option value="">Select type...</option>
                  {PROJECTS.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", textTransform:"uppercase", display:"block", marginBottom:"6px", fontWeight:"700" }}>Tier</label>
                <div style={{ display:"flex", gap:"6px" }}>
                  {(["p","a","b"] as const).map(t=>(
                    <button key={t} onClick={()=>setAddForm(f=>({...f,tier:t}))} style={{ flex:1, padding:"9px", borderRadius:"9px", fontSize:"11px", fontWeight:"800", border:`1px solid ${addForm.tier===t?TIER_META[t].color+"55":"rgba(255,255,255,0.08)"}`, background:addForm.tier===t?TIER_META[t].bg:"rgba(255,255,255,0.03)", color:addForm.tier===t?TIER_META[t].color:"rgba(255,255,255,0.4)", cursor:"pointer" }}>{TIER_META[t].label}</button>
                  ))}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                <div>
                  <label style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", textTransform:"uppercase", display:"block", marginBottom:"6px", fontWeight:"700" }}>Capital est.</label>
                  <input type="text" placeholder="e.g. $120k" value={addForm.capital} onChange={e=>setAddForm(f=>({...f,capital:e.target.value}))} style={IS}/>
                </div>
                <div>
                  <label style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", textTransform:"uppercase", display:"block", marginBottom:"6px", fontWeight:"700" }}>Geography</label>
                  <input type="text" placeholder="e.g. Austin TX" value={addForm.geography} onChange={e=>setAddForm(f=>({...f,geography:e.target.value}))} style={IS}/>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                <div>
                  <label style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", textTransform:"uppercase", display:"block", marginBottom:"6px", fontWeight:"700" }}>Decision Deadline</label>
                  <input type="date" value={addForm.deadline} onChange={e=>setAddForm(f=>({...f,deadline:e.target.value}))} style={IS}/>
                </div>
                <div>
                  <label style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", textTransform:"uppercase", display:"block", marginBottom:"6px", fontWeight:"700" }}>Risk Tolerance</label>
                  <select value={addForm.risk} onChange={e=>setAddForm(f=>({...f,risk:e.target.value}))} style={IS}>
                    {["Low","Med","Med-High","High","Very High"].map(r=><option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", letterSpacing:"1px", textTransform:"uppercase", display:"block", marginBottom:"6px", fontWeight:"700" }}>Notes</label>
                <textarea placeholder="What you know so far, questions to answer..." value={addForm.notes} onChange={e=>setAddForm(f=>({...f,notes:e.target.value}))} style={{ ...IS, height:"70px", resize:"vertical" as const }}/>
              </div>
            </div>
            <div style={{ display:"flex", gap:"10px", marginTop:"24px" }}>
              <button onClick={()=>setShowAddAnalysis(false)} style={{ flex:1, padding:"12px", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"10px", fontSize:"13px", color:"rgba(255,255,255,0.4)", background:"none", cursor:"pointer" }}>Cancel</button>
              <button onClick={()=>addAnalysis()} disabled={!addForm.name||!addForm.project_type} style={{ flex:1, padding:"12px", background:(!addForm.name||!addForm.project_type)?"rgba(96,165,250,0.3)":"#60a5fa", color:(!addForm.name||!addForm.project_type)?"rgba(255,255,255,0.3)":"#000", borderRadius:"10px", fontSize:"13px", fontWeight:"900", border:"none", cursor:(!addForm.name||!addForm.project_type)?"not-allowed":"pointer" }}>Add to Pipeline →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;



