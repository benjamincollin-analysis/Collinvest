"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "../../lib/supabase";

// ── Types ────────────────────────────────────────────────────────────
type OccupancyStatus = "occupied" | "vacant" | "planned";

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
};

const EMPTY_SCENARIO_PROP: Omit<ScenarioProperty, "id"> = {
  name: "", value: 0, mortgage: 0, rent: 0, expenses: 0, appreciation: 3.5,
};

function toDb(p: Omit<Property, "id">) {
  return { name: p.name, type: p.type, value: p.value, mortgage: p.mortgage, rent: p.rent, expenses: p.expenses, occupancy_status: p.occupancyStatus, planned_date: p.plannedDate, appreciation: p.appreciation, lat: p.lat, lng: p.lng, address: p.address };
}
function fromDb(row: any): Property {
  return { id: row.id, name: row.name, type: row.type, value: row.value, mortgage: row.mortgage, rent: row.rent, expenses: row.expenses, occupancyStatus: row.occupancy_status, plannedDate: row.planned_date || "", appreciation: row.appreciation, lat: row.lat, lng: row.lng, address: row.address || "" };
}
function fmt(n: number) { if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M"; if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K"; return "$" + n.toLocaleString("en-US"); }
function fmtFull(n: number) { return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US"); }
function pct(value: number, total: number) { return Math.min(100, Math.max(0, (value / total) * 100)); }
function isEffectivelyOccupied(p: Property) { return p.occupancyStatus === "occupied"; }
function propCashFlow(p: Property) { return isEffectivelyOccupied(p) ? p.rent - p.expenses : -p.expenses; }
function occupancyLabel(p: Property) { if (p.occupancyStatus === "occupied") return "Occupied"; if (p.occupancyStatus === "vacant") return "Vacant"; return p.plannedDate ? `Planned ${p.plannedDate}` : "Planned"; }
function occupancyColor(p: Property) { if (p.occupancyStatus === "occupied") return { bg: "rgba(52,211,153,0.08)", color: "#34d399", border: "rgba(52,211,153,0.2)" }; if (p.occupancyStatus === "vacant") return { bg: "rgba(248,113,113,0.08)", color: "#f87171", border: "rgba(248,113,113,0.2)" }; return { bg: "rgba(96,165,250,0.08)", color: "#60a5fa", border: "rgba(96,165,250,0.2)" }; }
function computeProjections(properties: Property[], scenario: Scenario, years = 10) { const realValue = properties.reduce((s, p) => s + p.value, 0); const realAvgApp = properties.length > 0 ? properties.reduce((s, p) => s + p.appreciation, 0) / properties.length / 100 : 0.035; const realMonthlyCF = properties.reduce((s, p) => s + propCashFlow(p), 0); const scenApp = realAvgApp + scenario.appreciationDelta / 100; const extraValue = scenario.extraProperties.reduce((s, p) => s + p.value, 0); const extraCF = scenario.extraProperties.reduce((s, p) => s + (p.rent - p.expenses), 0); const scenBaseValue = realValue + extraValue; const real = [], scen = []; for (let y = 0; y <= years; y++) { real.push({ year: y, value: realValue * Math.pow(1 + realAvgApp, y), cashFlow: realMonthlyCF }); scen.push({ year: y, value: scenBaseValue * Math.pow(1 + scenApp, y), cashFlow: realMonthlyCF + extraCF }); } return { real, scen }; }
function monthsToGoal(currentValue: number, annualRate: number, goal: number) { if (currentValue >= goal) return 0; if (annualRate <= 0) return Infinity; return Math.ceil(Math.log(goal / currentValue) / Math.log(1 + annualRate)); }
function fmtTime(months: number) { if (months === 0) return "✓ Done"; if (months === Infinity) return "∞"; if (months < 12) return `${months}mo`; return `${Math.ceil(months / 12)}yr`; }
function checkMilestone(currentPct: number, milestones: number[], seenKey: string): number | null { try { const seen: number[] = JSON.parse(localStorage.getItem(seenKey) || "[]"); for (const m of milestones) { if (currentPct >= m && !seen.includes(m)) { seen.push(m); localStorage.setItem(seenKey, JSON.stringify(seen)); return m; } } } catch {} return null; }

function TacticalMap({ properties, selected, onSelect }: { properties: Property[]; selected: number | null; onSelect: (id: number) => void; }) {
  const mapRef = useRef<HTMLDivElement>(null); const leafletRef = useRef<any>(null); const markersRef = useRef<any[]>([]); const initDone = useRef(false);
  if (typeof window !== "undefined" && !initDone.current) { initDone.current = true; setTimeout(() => { if (!document.getElementById("leaflet-css")) { const link = document.createElement("link"); link.id = "leaflet-css"; link.rel = "stylesheet"; link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(link); } if (!(window as any).L) { const script = document.createElement("script"); script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; script.onload = () => setupMap(); document.head.appendChild(script); } else setupMap(); }, 100); }
  function setupMap() { const L = (window as any).L; if (!mapRef.current || leafletRef.current) return; const center: [number, number] = [20, 10]; const zoom = properties.length > 0 ? 4 : 2; const map = L.map(mapRef.current, { center, zoom, zoomControl: false, attributionControl: false }); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map); const s = document.createElement("style"); s.textContent = `.leaflet-layer{filter:invert(1) hue-rotate(195deg) brightness(0.82) contrast(1.1) saturate(0.45)}.leaflet-container{background:#050a0f!important}.leaflet-control-zoom{display:none}.leaflet-popup-content-wrapper{background:rgba(5,10,15,0.96)!important;border:1px solid rgba(245,158,11,0.4)!important;border-radius:12px!important;color:#fff!important;font-family:'DM Sans',sans-serif!important}.leaflet-popup-tip{background:rgba(5,10,15,0.96)!important}.leaflet-popup-close-button{color:rgba(255,255,255,0.4)!important}`; document.head.appendChild(s); leafletRef.current = { map, L }; renderMarkers(map, L, properties, selected, onSelect); }
  const prevPropsRef = useRef<string>(""); const cur = JSON.stringify({ properties, selected }); if (cur !== prevPropsRef.current && leafletRef.current) { prevPropsRef.current = cur; const { map, L } = leafletRef.current; renderMarkers(map, L, properties, selected, onSelect); }
  function renderMarkers(map: any, L: any, props: Property[], sel: number | null, onSel: (id: number) => void) { markersRef.current.forEach((m) => m.remove()); markersRef.current = []; props.forEach((p) => { const isSelected = sel === p.id; const cf = propCashFlow(p); const oc = occupancyColor(p); const borderColor = isSelected ? "#f59e0b" : oc.color; const bgColor = isSelected ? "rgba(245,158,11,0.92)" : "rgba(5,10,15,0.92)"; const valueColor = isSelected ? "#000" : "#f59e0b"; const cfColor = isSelected ? "#000" : (cf >= 0 ? "#34d399" : "#f87171"); const iconHtml = `<div style="position:relative;text-align:center;"><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:44px;height:44px;border:1px solid ${borderColor};border-radius:50%;opacity:0.35;animation:tPulse 2s ease-out infinite;"></div><div style="background:${bgColor};border:2px solid ${borderColor};border-radius:10px;padding:7px 12px;min-width:110px;box-shadow:0 0 14px ${borderColor}44;position:relative;"><div style="font-size:9px;color:${isSelected ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)'};letter-spacing:1px;text-transform:uppercase;font-weight:700;margin-bottom:2px;">${p.name.length > 14 ? p.name.slice(0, 13) + "…" : p.name}</div><div style="font-size:12px;font-weight:800;color:${valueColor};">${fmt(p.value)}</div><div style="font-size:10px;font-weight:700;color:${cfColor};margin-top:2px;">${cf >= 0 ? "+" : ""}${fmtFull(cf)}/mo</div><div style="font-size:9px;color:${isSelected ? 'rgba(0,0,0,0.4)' : oc.color};margin-top:2px;font-weight:600;">${occupancyLabel(p).toUpperCase()}</div></div><div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:7px solid ${borderColor};margin:0 auto;"></div></div>`; const icon = L.divIcon({ html: iconHtml, className: "", iconSize: [130, 72], iconAnchor: [65, 79], popupAnchor: [0, -82] }); const equity = p.value - p.mortgage; const roi = equity > 0 ? ((cf * 12 / equity) * 100).toFixed(1) : "—"; const popup = `<div style="padding:6px 8px;min-width:190px;"><div style="font-size:13px;font-weight:800;margin-bottom:10px;">${p.name}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div><div style="font-size:9px;color:rgba(255,255,255,0.3);text-transform:uppercase;">Value</div><div style="font-size:13px;font-weight:700;color:#f59e0b;">${fmtFull(p.value)}</div></div><div><div style="font-size:9px;color:rgba(255,255,255,0.3);text-transform:uppercase;">Equity</div><div style="font-size:13px;font-weight:700;">${fmtFull(equity)}</div></div><div><div style="font-size:9px;color:rgba(255,255,255,0.3);text-transform:uppercase;">Cash Flow</div><div style="font-size:13px;font-weight:700;color:${cf >= 0 ? '#34d399' : '#f87171'};">${cf >= 0 ? "+" : ""}${fmtFull(cf)}/mo</div></div><div><div style="font-size:9px;color:rgba(255,255,255,0.3);text-transform:uppercase;">ROI</div><div style="font-size:13px;font-weight:700;">${roi}%</div></div></div>${p.address ? `<div style="margin-top:8px;font-size:10px;color:rgba(255,255,255,0.2);">${p.address}</div>` : ""}</div>`; const marker = L.marker([p.lat, p.lng], { icon }); marker.bindPopup(popup); marker.on("click", () => onSel(p.id)); marker.addTo(map); markersRef.current.push(marker); }); if (props.length > 1) { try { map.fitBounds(L.latLngBounds(props.map((p) => [p.lat, p.lng])), { padding: [60, 60] }); } catch {} } }
  return (<div style={{ position: "relative", borderRadius: "20px", overflow: "hidden", border: "1px solid rgba(245,158,11,0.15)" }}><div style={{ position: "absolute", inset: 0, zIndex: 400, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(245,158,11,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,0.025) 1px,transparent 1px)", backgroundSize: "40px 40px" }} /><div style={{ position: "absolute", top: "14px", left: "18px", zIndex: 402, pointerEvents: "none", display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399", boxShadow: "0 0 6px #34d399", animation: "blink 1.5s ease-in-out infinite" }} /><span style={{ fontSize: "10px", color: "rgba(245,158,11,0.7)", letterSpacing: "2px", fontWeight: "700", textTransform: "uppercase" }}>GOLDSTREAM · TACTICAL VIEW</span></div><div style={{ position: "absolute", top: "14px", right: "18px", zIndex: 402, pointerEvents: "none", fontSize: "10px", color: "rgba(245,158,11,0.5)", letterSpacing: "1px", fontWeight: "600" }}>{String(properties.length).padStart(2, "0")} ASSETS TRACKED</div><div ref={mapRef} className="gs-map" style={{ height: "380px", width: "100%" }} /></div>);
}

function MilestoneToast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 8000); return () => clearTimeout(t); }, [onClose]);
  return (<div style={{ position: "fixed", bottom: "30px", left: "50%", transform: "translateX(-50%)", zIndex: 200, maxWidth: "480px", width: "calc(100% - 40px)", background: "rgba(10,10,10,0.97)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: "16px", padding: "20px 24px", boxShadow: "0 0 40px rgba(245,158,11,0.15)", display: "flex", alignItems: "flex-start", gap: "14px", animation: "slideUp 0.4s ease" }}><div style={{ fontSize: "24px", flexShrink: 0 }}>🏆</div><div style={{ flex: 1 }}><p style={{ fontSize: "11px", color: "#f59e0b", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "4px" }}>Milestone Reached</p><p style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)", lineHeight: "1.5" }}>{message}</p></div><button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "18px", flexShrink: 0 }}>×</button></div>);
}

function GoalReachedOverlay({ name, goalLabel, goalType, onNewGoal, onDismiss }: { name: string; goalLabel: string; goalType: "portfolio" | "cashflow"; onNewGoal: (val: number) => void; onDismiss: () => void; }) {
  const [newGoal, setNewGoal] = useState("");
  return (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: "20px" }}><style>{`@keyframes confetti { 0%{transform:translateY(-10px) rotate(0deg);opacity:1} 100%{transform:translateY(100vh) rotate(720deg);opacity:0} }`}</style>{Array.from({ length: 12 }).map((_, i) => (<div key={i} style={{ position: "fixed", top: "-20px", left: `${8 * (i + 1)}%`, width: "8px", height: "8px", background: i % 3 === 0 ? "#f59e0b" : i % 3 === 1 ? "#34d399" : "#60a5fa", borderRadius: i % 2 === 0 ? "50%" : "0", animation: `confetti ${2 + Math.random() * 3}s ease-in ${Math.random() * 2}s forwards`, pointerEvents: "none" }} />))}<div style={{ background: "rgba(10,10,10,0.98)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "28px", padding: "48px 40px", maxWidth: "500px", width: "100%", textAlign: "center" }}><div style={{ fontSize: "56px", marginBottom: "20px" }}>🏆</div><p style={{ fontSize: "11px", color: "#f59e0b", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px" }}>Goal Achieved</p><h2 style={{ fontSize: "28px", fontWeight: "900", color: "#fff", marginBottom: "8px", letterSpacing: "-0.5px" }}>Congratulations, {name.toUpperCase()}!</h2><p style={{ fontSize: "15px", color: "rgba(255,255,255,0.5)", marginBottom: "8px" }}>You've reached your {goalType === "portfolio" ? "portfolio" : "cash flow"} goal of <span style={{ color: "#f59e0b", fontWeight: "700" }}>{goalLabel}</span>.</p><p style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)", marginBottom: "36px", lineHeight: "1.6" }}>Goldstream will always help you reach farther.<br />What's your next target?</p><div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}><input type="number" placeholder={goalType === "portfolio" ? "e.g. 5000000" : "e.g. 5000"} value={newGoal} onChange={e => setNewGoal(e.target.value)} style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "12px", padding: "13px 16px", fontSize: "14px", color: "#fff", outline: "none", fontFamily: "inherit" }} /><button onClick={() => { if (newGoal) onNewGoal(parseFloat(newGoal)); }} style={{ padding: "13px 20px", background: "#f59e0b", color: "#000", borderRadius: "12px", fontWeight: "800", fontSize: "14px", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>Set Goal →</button></div><button onClick={onDismiss} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", cursor: "pointer", fontSize: "12px", textDecoration: "underline" }}>I'll set it later</button></div></div>);
}

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

export default function Dashboard() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState<"portfolio" | "finances" | "projects" | "market" | "projections">("portfolio");
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
  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);
  const [goalReached, setGoalReached] = useState<{ type: "portfolio" | "cashflow"; label: string } | null>(null);

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
  function openEdit(p: Property, e: React.MouseEvent) { e.stopPropagation(); setEditingId(p.id); setForm({ name: p.name, type: p.type, value: String(p.value), mortgage: String(p.mortgage), rent: String(p.rent), expenses: String(p.expenses), occupancyStatus: p.occupancyStatus, plannedDate: p.plannedDate, appreciation: String(p.appreciation), address: p.address, lat: String(p.lat), lng: String(p.lng) }); setShowForm(true); }
  async function geocodeAddress(address: string) { try { const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`, { headers: { "Accept-Language": "en" } }); const data = await res.json(); if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }; } catch {} return null; }
  async function handleGeocodeClick() { if (!form.address) return; setGeocoding(true); const coords = await geocodeAddress(form.address); if (coords) setForm({ ...form, lat: String(coords.lat), lng: String(coords.lng) }); setGeocoding(false); }
  async function handleSave() { const errors: Record<string, boolean> = {}; if (!form.name) errors.name = true; if (!form.value) errors.value = true; if (Object.keys(errors).length > 0) { setFormErrors(errors); return; } setFormErrors({}); setSaving(true); let lat = parseFloat(form.lat) || 29.7604; let lng = parseFloat(form.lng) || -95.3698; if (form.address && (!form.lat || !form.lng)) { const coords = await geocodeAddress(form.address); if (coords) { lat = coords.lat; lng = coords.lng; } } const data: Omit<Property, "id"> = { name: form.name, type: form.type, value: parseFloat(form.value) || 0, mortgage: parseFloat(form.mortgage) || 0, rent: parseFloat(form.rent) || 0, expenses: parseFloat(form.expenses) || 0, occupancyStatus: form.occupancyStatus, plannedDate: form.plannedDate, appreciation: parseFloat(form.appreciation) || 0, address: form.address, lat, lng }; if (editingId !== null) { const { error } = await supabase.from("properties").update(toDb(data)).eq("id", editingId); if (!error) setProperties(properties.map((p) => p.id === editingId ? { ...p, ...data } : p)); } else { const newId = Date.now(); const { error } = await supabase.from("properties").insert({ id: newId, ...toDb(data), user_id: user?.id }); if (!error) setProperties([...properties, { id: newId, ...data }]); } setSaving(false); setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }
  function handleDelete(id: number) { setConfirmDelete(id); }
  async function confirmDeleteNow() { if (confirmDelete === null) return; const { error } = await supabase.from("properties").delete().eq("id", confirmDelete); if (!error) { setProperties(properties.filter((p) => p.id !== confirmDelete)); if (selected === confirmDelete) setSelected(null); } setConfirmDelete(null); }
  function addScenarioProp() { setScenario(s => ({ ...s, extraProperties: [...s.extraProperties, { id: Date.now(), ...scenPropForm }] })); setShowAddScenarioProp(false); setScenPropForm({ ...EMPTY_SCENARIO_PROP, name: "Hypothetical Property" }); }
  async function fetchAiInsight() { setAiLoading(true); setAiInsight(""); try { const summary = { totalValue, totalEquity, monthlyCashFlow, properties: properties.length, avgAppreciation: (avgAppreciation * 100).toFixed(1), proj5: proj5Real?.value.toFixed(0), proj10: proj10Real?.value.toFixed(0), monthsTo1M: realMonthsTo1M === Infinity ? "never" : realMonthsTo1M, monthsTo2M: realMonthsTo2M === Infinity ? "never" : realMonthsTo2M }; const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: `You are a sharp real estate investment analyst. 3 specific data-driven insights, no fluff. Bold labels: **Velocity**, **Risk**, **Action**. Data: ${JSON.stringify(summary)}` }] }) }); const data = await res.json(); setAiInsight(data.content?.find((b: any) => b.type === "text")?.text || ""); } catch { setAiInsight("Unable to load insights."); } setAiLoading(false); }

  const CW = 600; const CH = 160; const allVals = [...projReal.map(p => p.value), ...(scenario.enabled ? projScen.map(p => p.value) : []), GOAL_PORTFOLIO]; const maxVal = Math.max(...allVals);
  const chartPts = (pts: typeof projReal) => pts.map((p, i) => `${(i / 10) * (CW - 40) + 20},${CH - 20 - ((p.value / maxVal) * (CH - 40))}`).join(" ");
  const goalY = CH - 20 - ((GOAL_PORTFOLIO / maxVal) * (CH - 40)); const mile1Y = CH - 20 - ((MILESTONE / maxVal) * (CH - 40));
  const IS: React.CSSProperties = { width: "100%", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", color: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const tabStyle = (t: string) => ({ padding: "7px 20px", borderRadius: "8px", fontSize: "11px", fontWeight: 700 as const, border: "none", cursor: "pointer" as const, transition: "all 0.2s", letterSpacing: "0.5px", textTransform: "uppercase" as const, background: activeTab === t ? "rgba(245,166,35,0.12)" : "transparent", color: activeTab === t ? "#f5a623" : "rgba(255,255,255,0.3)", boxShadow: activeTab === t ? "inset 0 0 0 1px rgba(245,166,35,0.25)" : "none" });

  if (loading) return (<div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}><div style={{ width: "28px", height: "28px", background: "#f59e0b", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "800", color: "#000" }}>GS</div><p style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px", letterSpacing: "1px" }}>LOADING PORTFOLIO...</p></div>);

  const displayName = settings.firstName || user?.email?.split("@")[0] || "User";

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#fff", fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        select option { background: #0d0d0d; color: #fff; }
        @keyframes tPulse { 0%{transform:translate(-50%,-50%) scale(1);opacity:0.4} 100%{transform:translate(-50%,-50%) scale(2.8);opacity:0} }
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
          display:grid; grid-template-columns:1fr 1fr 1fr 1fr 200px;
          border-bottom:1px solid rgba(255,255,255,0.04);
          background: rgba(5,5,5,0.9);
          backdrop-filter:blur(20px);
          position:sticky; top:0; z-index:9; padding:0 40px;
          box-shadow: 0 1px 0 rgba(245,166,35,0.06), 0 4px 20px rgba(0,0,0,0.4);
        }
        .gs-strip-desktop .strip-cell { display:flex; flex-direction:column; justify-content:center; padding:10px 18px; border-right:1px solid rgba(255,255,255,0.04); gap:3px; }
        .gs-strip-desktop .strip-cell:last-child { border-right:none; }
        .gs-strip-label { font-size:8px; color:rgba(255,255,255,0.25); letter-spacing:1.8px; text-transform:uppercase; font-weight:700; }
        .gs-strip-value { font-size:16px; font-weight:900; letter-spacing:-0.5px; }
        .gs-strip-sub { font-size:10px; color:rgba(255,255,255,0.18); }

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
        <div className="gs-tabs">{(["portfolio", "finances", "projects", "market", "projections"] as const).map((t) => (<button key={t} onClick={() => setActiveTab(t)} style={tabStyle(t)}>{t}</button>))}</div>
        <div className="gs-nav-user">
          <span>{displayName}</span>
          <NotificationBell user={user} properties={properties} />
          <button onClick={() => setShowSettings(true)} style={{ fontSize: "11px", padding: "5px 12px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "6px", color: "#f59e0b", cursor: "pointer", fontWeight: "600" }}>⚙ Goals</button>
          <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b", fontWeight: "800", fontSize: "11px" }}>{(settings.firstName?.[0] || user?.email?.[0] || "U").toUpperCase()}</div>
          <button onClick={handleLogout} style={{ fontSize: "11px", padding: "5px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontWeight: "600" }}>Log out</button>
        </div>
      </nav>

      <div className="gs-strip-desktop">
        {[{ label: "Portfolio", value: fmt(totalValue), color: "#f59e0b", sub: `${portfolioPct.toFixed(1)}% to ${fmt(GOAL_PORTFOLIO)}` }, { label: "Equity", value: fmtFull(totalEquity), color: "#f59e0b", sub: "net owned" }, { label: "Cash Flow", value: `${monthlyCashFlow >= 0 ? "+" : ""}${fmtFull(monthlyCashFlow)}/mo`, color: monthlyCashFlow >= 0 ? "#34d399" : "#f87171", sub: `${cashFlowPct.toFixed(1)}% to $${GOAL_CASHFLOW.toLocaleString()}` }, { label: "Properties", value: String(properties.length), color: "#fff", sub: `${properties.filter(p => p.occupancyStatus === "occupied").length} occupied` }].map((m) => (<div key={m.label} className="strip-cell"><span className="gs-strip-label">{m.label}</span><span className="gs-strip-value" style={{ color: m.color }}>{m.value}</span><span className="gs-strip-sub">{m.sub}</span></div>))}
        <div className="strip-cell" style={{ paddingLeft: "16px", cursor: "pointer" }} onClick={() => setShowSettings(true)}><div style={{ display: "flex", justifyContent: "space-between" }}><span className="gs-strip-label">Goal</span><span className="gs-strip-sub">{portfolioPct.toFixed(0)}% ✎</span></div><div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "999px", marginTop: "6px" }}><div style={{ height: "100%", width: `${portfolioPct}%`, background: "#f59e0b", borderRadius: "999px", boxShadow: "0 0 6px rgba(245,158,11,0.5)", transition: "width 0.8s" }} /></div><span className="gs-strip-sub" style={{ marginTop: "4px" }}>{fmt(totalValue)} of {fmt(GOAL_PORTFOLIO)}</span></div>
      </div>

      <div className="gs-strip-mobile">
        <div className="gs-strip-mobile-grid">{[{ label: "Portfolio", value: fmt(totalValue), color: "#f59e0b", sub: `${portfolioPct.toFixed(1)}% to ${fmt(GOAL_PORTFOLIO)}` }, { label: "Cash Flow", value: `${monthlyCashFlow >= 0 ? "+" : ""}${fmtFull(monthlyCashFlow)}/mo`, color: monthlyCashFlow >= 0 ? "#34d399" : "#f87171", sub: `${cashFlowPct.toFixed(1)}% to goal` }, { label: "Equity", value: fmtFull(totalEquity), color: "#f59e0b", sub: "net owned" }, { label: "Properties", value: `${properties.length} total`, color: "#fff", sub: `${properties.filter(p => p.occupancyStatus === "occupied").length} occupied` }].map((m) => (<div key={m.label} className="gs-strip-mobile-card"><div className="gs-strip-label">{m.label}</div><div style={{ fontSize: "16px", fontWeight: "800", color: m.color, marginTop: "3px", letterSpacing: "-0.3px" }}>{m.value}</div><div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "2px" }}>{m.sub}</div></div>))}</div>
        <div className="gs-strip-mobile-goal"><div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}><span className="gs-strip-label">Portfolio Goal</span><span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{portfolioPct.toFixed(1)}% of {fmt(GOAL_PORTFOLIO)}</span></div><div className="gs-strip-mobile-goal-bar"><div style={{ height: "100%", width: `${portfolioPct}%`, background: "#f59e0b", borderRadius: "999px", boxShadow: "0 0 6px rgba(245,158,11,0.5)", transition: "width 0.8s" }} /></div></div>
      </div>

      <div className="gs-main">
        {activeTab === "portfolio" && <>
          <div className="gs-grid-2">
            <GoalCard label="Portfolio Value" p={portfolioPct} milestonePct={milestonePct} value={fmt(totalValue)} sub={`of ${fmt(GOAL_PORTFOLIO)} vision`} pctLabel={`${portfolioPct.toFixed(1)}% to ${fmt(GOAL_PORTFOLIO)}`} barColor="#f59e0b" glow="rgba(245,158,11,0.4)" min="$0" mid={fmt(MILESTONE)} max={fmt(GOAL_PORTFOLIO)} onEdit={() => setShowSettings(true)} />
            <GoalCard label="Monthly Cash Flow" p={cashFlowPct} value={`${monthlyCashFlow >= 0 ? "+" : ""}${fmtFull(monthlyCashFlow)}`} valueColor={monthlyCashFlow >= 0 ? "#34d399" : "#f87171"} sub={`of $${GOAL_CASHFLOW.toLocaleString()}/mo target`} pctLabel={`${cashFlowPct.toFixed(1)}% to $${GOAL_CASHFLOW.toLocaleString()}`} barColor={monthlyCashFlow >= 0 ? "#34d399" : "#f87171"} glow={monthlyCashFlow >= 0 ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"} min="$0" max={`$${GOAL_CASHFLOW.toLocaleString()}/mo`} onEdit={() => setShowSettings(true)} />
          </div>
          <div className="gs-grid-4">{[{ label: "Total Equity", value: fmtFull(totalEquity), color: "#f5a623", sub: "net owned value" }, { label: "Gross Rent", value: fmtFull(totalRent) + "/mo", color: "#fff", sub: "monthly income" }, { label: "Total Expenses", value: fmtFull(totalExpenses) + "/mo", color: "#f87171", sub: "monthly outflow" }, { label: "Properties", value: String(properties.length), color: "#fff", sub: `${properties.filter(p => p.occupancyStatus === "occupied").length} occupied` }].map((m: any) => (<div key={m.label} className="gs-kpi-card"><p style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)", letterSpacing: "1.8px", textTransform: "uppercase", marginBottom: "10px", fontWeight: "700" }}>{m.label}</p><p style={{ fontSize: "24px", fontWeight: "900", color: m.color, letterSpacing: "-0.5px", lineHeight: 1 }}>{m.value}</p><p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "6px" }}>{m.sub}</p></div>))}</div>
          <div style={{ marginBottom: "20px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}><div><h2 style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase" }}>Asset Map</h2><p style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", marginTop: "2px" }}>All portfolio properties</p></div><button onClick={() => window.open("/map", "_blank")} style={{ fontSize: "11px", padding: "6px 14px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "8px", color: "#f59e0b", cursor: "pointer", fontWeight: "700" }}>⤢ Pop Out Map</button></div><TacticalMap properties={properties} selected={selected} onSelect={(id) => setSelected(selected === id ? null : id)} /></div>          <PropertyTable properties={properties} selected={selected} onSelect={setSelected} onEdit={openEdit} onDelete={handleDelete} onAdd={openAdd} />
          {active && <PropertyDetail property={active} onEdit={openEdit} onClose={() => setSelected(null)} />}
        </>}



        {activeTab === "projections" && <>
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

        {activeTab === "market" && <MarketInline />}{activeTab === "projects" && <ProjectsTab user={user} />}
{activeTab === "finances" && <FinancesTab properties={properties} user={user} />}
      </div>

      {confirmDelete !== null && (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: "20px" }}><div style={{ background: "#0f0f0f", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "20px", padding: "36px", width: "100%", maxWidth: "380px", textAlign: "center" }}><div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: "22px" }}>⚠</div><h3 style={{ fontSize: "17px", fontWeight: "800", marginBottom: "8px" }}>Delete Property?</h3><p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "28px", lineHeight: "1.5" }}>Permanently remove <span style={{ color: "#fff", fontWeight: "600" }}>{properties.find(p => p.id === confirmDelete)?.name}</span> from your portfolio.</p><div style={{ display: "flex", gap: "10px" }}><button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: "12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "13px", color: "rgba(255,255,255,0.4)", background: "none", cursor: "pointer", fontWeight: "600" }}>Cancel</button><button onClick={confirmDeleteNow} style={{ flex: 1, padding: "12px", background: "#ef4444", color: "#fff", borderRadius: "10px", fontSize: "13px", fontWeight: "800", border: "none", cursor: "pointer" }}>Yes, Delete</button></div></div></div>)}
      {showAddScenarioProp && (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: "20px" }}><div className="gs-modal" style={{ border: "1px solid rgba(96,165,250,0.25)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}><h2 style={{ fontSize: "17px", fontWeight: "800", color: "#60a5fa" }}>Add Hypothetical Property</h2><button onClick={() => setShowAddScenarioProp(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "22px" }}>×</button></div><div style={{ display: "flex", flexDirection: "column", gap: "14px" }}><Field label="Name"><input type="text" value={scenPropForm.name} onChange={e => setScenPropForm(f => ({ ...f, name: e.target.value }))} style={IS} /></Field><div className="gs-modal-grid"><Field label="Market Value ($)"><input type="number" placeholder="300000" value={scenPropForm.value || ""} onChange={e => setScenPropForm(f => ({ ...f, value: parseFloat(e.target.value) || 0 }))} style={IS} /></Field><Field label="Mortgage ($)"><input type="number" placeholder="240000" value={scenPropForm.mortgage || ""} onChange={e => setScenPropForm(f => ({ ...f, mortgage: parseFloat(e.target.value) || 0 }))} style={IS} /></Field></div><div className="gs-modal-grid"><Field label="Monthly Rent ($)"><input type="number" placeholder="2000" value={scenPropForm.rent || ""} onChange={e => setScenPropForm(f => ({ ...f, rent: parseFloat(e.target.value) || 0 }))} style={IS} /></Field><Field label="Monthly Expenses ($)"><input type="number" placeholder="400" value={scenPropForm.expenses || ""} onChange={e => setScenPropForm(f => ({ ...f, expenses: parseFloat(e.target.value) || 0 }))} style={IS} /></Field></div><Field label="Appreciation %/yr"><input type="number" placeholder="3.5" value={scenPropForm.appreciation} onChange={e => setScenPropForm(f => ({ ...f, appreciation: parseFloat(e.target.value) || 3.5 }))} style={IS} /></Field></div><div style={{ display: "flex", gap: "10px", marginTop: "24px" }}><button onClick={() => setShowAddScenarioProp(false)} style={{ flex: 1, padding: "12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "13px", color: "rgba(255,255,255,0.4)", background: "none", cursor: "pointer", fontWeight: "600" }}>Cancel</button><button onClick={addScenarioProp} style={{ flex: 1, padding: "12px", background: "#60a5fa", color: "#000", borderRadius: "10px", fontSize: "13px", fontWeight: "800", border: "none", cursor: "pointer" }}>Add to Scenario</button></div></div></div>)}
      {showForm && (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "20px" }}><div className="gs-modal"><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}><h2 style={{ fontSize: "18px", fontWeight: "800" }}>{editingId !== null ? "Edit Property" : "Add Property"}</h2><button onClick={() => { setShowForm(false); setEditingId(null); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "22px" }}>×</button></div><div style={{ display: "flex", flexDirection: "column", gap: "14px" }}><Field label="Property Name"><input type="text" placeholder="e.g. 14 Maple Street" value={form.name} onChange={e => { setForm({ ...form, name: e.target.value }); setFormErrors(f => ({ ...f, name: false })); }} style={{ ...IS, border: formErrors.name ? "1px solid #f87171" : "1px solid rgba(255,255,255,0.12)", boxShadow: formErrors.name ? "0 0 0 2px rgba(248,113,113,0.2)" : "none" }} /></Field><Field label="Property Type"><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={IS}>{["Single Family", "Duplex", "Triplex", "Condo", "Multi-Family", "Commercial"].map(t => <option key={t}>{t}</option>)}</select></Field><Field label="Address (for map)"><div style={{ display: "flex", gap: "8px" }}><input type="text" placeholder="e.g. 1234 Main St, Houston TX" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} style={{ ...IS, flex: 1 }} /><button onClick={handleGeocodeClick} disabled={geocoding} style={{ padding: "10px 12px", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "10px", color: "#f59e0b", fontSize: "11px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }}>{geocoding ? "..." : "Locate"}</button></div>{form.lat && form.lng && <p style={{ fontSize: "10px", color: "rgba(52,211,153,0.6)", marginTop: "4px" }}>✓ {parseFloat(form.lat).toFixed(4)}, {parseFloat(form.lng).toFixed(4)}</p>}</Field><div className="gs-modal-grid"><Field label="Market Value ($)"><input type="number" placeholder="200000" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} style={IS} /></Field><Field label="Mortgage Balance ($)"><input type="number" placeholder="160000" value={form.mortgage} onChange={e => setForm({ ...form, mortgage: e.target.value })} style={IS} /></Field></div><div className="gs-modal-grid"><Field label="Monthly Rent ($)"><input type="number" placeholder="1200" value={form.rent} onChange={e => setForm({ ...form, rent: e.target.value })} style={IS} /></Field><Field label="Monthly Expenses ($)"><input type="number" placeholder="300" value={form.expenses} onChange={e => setForm({ ...form, expenses: e.target.value })} style={IS} /></Field></div><div className="gs-modal-grid"><Field label="Occupancy Status"><select value={form.occupancyStatus} onChange={e => setForm({ ...form, occupancyStatus: e.target.value as OccupancyStatus })} style={IS}><option value="occupied">✓ Occupied</option><option value="vacant">✗ Vacant</option><option value="planned">◷ Planned</option></select></Field>{form.occupancyStatus === "planned" ? (<Field label="Target Month"><input type="month" value={form.plannedDate} onChange={e => setForm({ ...form, plannedDate: e.target.value })} style={IS} /></Field>) : (<Field label="Appreciation %/yr"><input type="number" placeholder="3.5" value={form.appreciation} onChange={e => setForm({ ...form, appreciation: e.target.value })} style={IS} /></Field>)}</div>{form.occupancyStatus === "planned" && (<Field label="Appreciation %/yr"><input type="number" placeholder="3.5" value={form.appreciation} onChange={e => setForm({ ...form, appreciation: e.target.value })} style={IS} /></Field>)}</div><div style={{ display: "flex", gap: "10px", marginTop: "24px" }}><button onClick={() => { setShowForm(false); setEditingId(null); }} style={{ flex: 1, padding: "12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "13px", color: "rgba(255,255,255,0.4)", background: "none", cursor: "pointer", fontWeight: "600" }}>Cancel</button><button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: "12px", background: saving ? "rgba(245,158,11,0.5)" : "#f59e0b", color: "#000", borderRadius: "10px", fontSize: "13px", fontWeight: "800", border: "none", cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "Saving..." : editingId !== null ? "Save Changes" : "Add Property"}</button></div></div></div>)}
    </div>
  );
}

function GoalCard({ label, p, milestonePct, value, valueColor, sub, pctLabel, barColor, glow, min, mid, max, onEdit }: any) {
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

function PropertyTable({ properties, selected, onSelect, onEdit, onDelete, onAdd }: any) {
  return (<div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px", overflow: "hidden", marginBottom: "20px" }}><div className="gs-section-header" style={{ padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}><h2 style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase" }}>Properties</h2><button onClick={onAdd} style={{ fontSize: "12px", padding: "8px 16px", background: "#f59e0b", color: "#000", borderRadius: "8px", fontWeight: "700", border: "none", cursor: "pointer" }}>+ Add Property</button></div><div className="gs-table-wrap"><table className="gs-table" style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}><thead><tr style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", letterSpacing: "1px", textTransform: "uppercase" }}>{["Property", "Value", "Equity", "Rent/mo", "Cash Flow", "ROI", "Status", ""].map(h => (<th key={h} style={{ textAlign: h === "Property" || h === "" ? "left" : "right", padding: "12px 16px", fontWeight: "600", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{h}</th>))}</tr></thead><tbody>{properties.map((p: Property) => { const equity = p.value - p.mortgage; const cf = propCashFlow(p); const roi = equity > 0 ? ((cf * 12) / equity) * 100 : 0; const oc = occupancyColor(p); return (<tr key={p.id} onClick={() => onSelect(selected === p.id ? null : p.id)} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", background: selected === p.id ? "rgba(245,158,11,0.04)" : "transparent", transition: "background 0.15s" }}><td style={{ padding: "14px 16px" }}><p style={{ fontWeight: "600" }}>{p.name}</p><p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>{p.type}</p></td><td style={{ textAlign: "right", padding: "14px 16px" }}>{fmtFull(p.value)}</td><td style={{ textAlign: "right", padding: "14px 16px", color: "#f59e0b", fontWeight: "600" }}>{fmtFull(equity)}</td><td style={{ textAlign: "right", padding: "14px 16px" }}>{isEffectivelyOccupied(p) ? fmtFull(p.rent) : "—"}</td><td style={{ textAlign: "right", padding: "14px 16px", fontWeight: "700", color: cf >= 0 ? "#34d399" : "#f87171" }}>{cf >= 0 ? "+" : ""}{fmtFull(cf)}</td><td style={{ textAlign: "right", padding: "14px 16px", color: "rgba(255,255,255,0.5)" }}>{roi.toFixed(1)}%</td><td style={{ textAlign: "right", padding: "14px 16px" }}><span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "999px", fontWeight: "600", background: oc.bg, color: oc.color, border: `1px solid ${oc.border}`, whiteSpace: "nowrap" }}>{occupancyLabel(p)}</span></td><td style={{ padding: "14px 10px" }} onClick={e => e.stopPropagation()}><div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}><button onClick={e => onEdit(p, e)} style={{ fontSize: "11px", padding: "4px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontWeight: "600" }}>Edit</button><button onClick={() => onDelete(p.id)} style={{ fontSize: "16px", background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button></div></td></tr>); })}</tbody></table></div></div>);
}

function PropertyDetail({ property: p, onEdit, onClose }: any) {
  const equity = p.value - p.mortgage; const cf = propCashFlow(p); const roi = equity > 0 ? ((cf * 12 / equity) * 100).toFixed(1) + "%" : "—";
  return (<div style={{ background: "rgba(245,158,11,0.03)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "20px", padding: "24px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", gap: "12px" }}><div style={{ flex: 1, minWidth: 0 }}><h3 style={{ fontSize: "17px", fontWeight: "800" }}>{p.name}</h3><p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>{p.type} · {occupancyLabel(p)}{p.address ? ` · ${p.address}` : ""}</p></div><div style={{ display: "flex", gap: "8px", flexShrink: 0 }}><button onClick={e => onEdit(p, e)} style={{ fontSize: "12px", padding: "6px 14px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "8px", color: "#f59e0b", cursor: "pointer", fontWeight: "600" }}>Edit</button><button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "20px", lineHeight: 1 }}>×</button></div></div><div className="gs-detail-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px" }}>{[{ label: "Market Value", value: fmtFull(p.value) }, { label: "Mortgage", value: fmtFull(p.mortgage) }, { label: "Equity", value: fmtFull(equity), hi: true }, { label: "Appreciation", value: p.appreciation + "%/yr" }, { label: "Monthly Rent", value: isEffectivelyOccupied(p) ? fmtFull(p.rent) : "—" }, { label: "Expenses", value: fmtFull(p.expenses) }, { label: "Net Cash Flow", value: fmtFull(cf) }, { label: "Annual ROI", value: roi }].map((m: any) => (<div key={m.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: "12px", padding: "14px", border: m.hi ? "1px solid rgba(245,158,11,0.2)" : "1px solid rgba(255,255,255,0.05)" }}><p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginBottom: "6px", letterSpacing: "0.8px", textTransform: "uppercase" }}>{m.label}</p><p style={{ fontSize: "16px", fontWeight: "700", color: m.hi ? "#f59e0b" : "#fff" }}>{m.value}</p></div>))}</div></div>);
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
                  <input type="number" placeholder="1200" value={form.amount} onChange={e => { setForm({ ...form, amount: e.target.value }); setExpenseErrors(f => ({ ...f, amount: false })); }} style={{ ...IS, border: expenseErrors.amount ? "1px solid #f87171" : "1px solid rgba(255,255,255,0.12)" }} />
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
        <button onClick={() => setShowForm(true)} style={{ padding: "10px 20px", background: "#a78bfa", color: "#000", borderRadius: "10px", fontWeight: "800", fontSize: "13px", border: "none", cursor: "pointer" }}>+ New Project</button>
      </div>

      {/* #46 — Cash Available Tracker */}
      <CashTracker totalEquity={projects.reduce((s, p) => s + (p.budget || 0) - (p.spent || 0), 0)} totalRemaining={projects.reduce((s, p) => s + Math.max(0, (p.budget || 0) - (p.spent || 0)), 0)} userId={user?.id} />

      {/* Summary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "Total Projects", value: String(projects.length), color: "#fff", sub: `${activeProjects.length} active` },
          { label: "Total Budget", value: fmtMoney(totalBudget), color: "#a78bfa", sub: "across all projects" },
          { label: "Total Spent", value: fmtMoney(totalSpent), color: "#f87171", sub: totalBudget > 0 ? `${((totalSpent / totalBudget) * 100).toFixed(1)}% of budget` : "no budget set" },
          { label: "Remaining", value: fmtMoney(totalBudget - totalSpent), color: totalBudget > totalSpent ? "#34d399" : "#f87171", sub: "budget left" },
        ].map(m => (
          <div key={m.label} className="gs-kpi-card">
            <p style={{ fontSize: "8px", color: "rgba(255,255,255,0.25)", letterSpacing: "1.8px", textTransform: "uppercase", marginBottom: "10px", fontWeight: "700" }}>{m.label}</p>
            <p style={{ fontSize: "24px", fontWeight: "900", color: m.color, letterSpacing: "-0.5px", lineHeight: 1 }}>{m.value}</p>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "6px" }}>{m.sub}</p>
          </div>
        ))}
      </div>

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
                      <button onClick={async () => { const newVal = !p.verified; await supabase.from("projects").update({ verified: newVal }).eq("id", p.id); setProjects(prev => prev.map(pr => pr.id === p.id ? { ...pr, verified: newVal } : pr)); }} title={p.verified ? "Click to unverify" : "Click to verify"} style={{ fontSize: "11px", padding: "5px 12px", background: p.verified ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${p.verified ? "rgba(52,211,153,0.35)" : "rgba(255,255,255,0.08)"}`, borderRadius: "8px", color: p.verified ? "#34d399" : "rgba(255,255,255,0.25)", cursor: "pointer", fontWeight: "700", fontSize: "11px", letterSpacing: "0.3px" }}>{p.verified ? "✓ VERIFIED" : "◯ Verify"}</button>
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
                              return (
                                <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", minWidth: "90px", position: "relative", paddingTop: "18px" }}>
                                    <div onClick={() => { const statuses = ["not_started","in_progress","done","delayed"]; const next = statuses[(statuses.indexOf(ph.status) + 1) % statuses.length]; updatePhase(p, i, { status: next }); }} style={{ width: "32px", height: "32px", borderRadius: "50%", background: sc.bg, border: `2px solid ${sc.color}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: ph.status === "in_progress" ? `0 0 10px ${sc.color}66` : "none", transition: "all 0.2s" }}>
                                      <span style={{ fontSize: "10px" }}>{ph.status === "done" ? "✓" : ph.status === "delayed" ? "!" : ph.status === "in_progress" ? "▶" : "○"}</span>
                                    </div>
                                    <span style={{ fontSize: "10px", color: sc.color, fontWeight: "700", textAlign: "center", whiteSpace: "nowrap", marginTop: "4px" }}>{ph.name}</span>
                                    <button onClick={() => deletePhase(p, i)} title="Remove phase" style={{ position: "absolute", top: "0px", right: "0px", zIndex: 10, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: "4px", color: "#f87171", cursor: "pointer", fontSize: "11px", lineHeight: 1, padding: "1px 5px", fontWeight: "700" }}>×</button>
                                  </div>
                                  {!isLast && <div style={{ flex: 1, height: "2px", background: ph.status === "done" ? "#34d399" : "rgba(255,255,255,0.08)", margin: "0 4px", marginBottom: "20px" }} />}
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
              <Field label="Total Budget ($)"><input type="number" placeholder="150000" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} style={IS} /></Field>
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

function CashTracker({ totalEquity, totalRemaining, userId }: { totalEquity: number; totalRemaining: number; userId: string }) {
  const storageKey = `gs_warChest_${userId}`;
  const [warChest, setWarChest] = useState(0);
  const [equityPct, setEquityPct] = useState(20);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) { const d = JSON.parse(raw); setWarChest(d.warChest || 0); setEquityPct(d.equityPct || 20); }
    } catch {}
  }, [storageKey]);

  function save(wc: number, ep: number) {
    try { localStorage.setItem(storageKey, JSON.stringify({ warChest: wc, equityPct: ep })); } catch {}
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
            <span style={{ fontSize: "10px", color: "rgba(52,211,153,0.7)", letterSpacing: "2px", fontWeight: "700", textTransform: "uppercase" }}>Cash Available · War Chest</span>
          </div>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)" }}>Manual savings + auto-calculated from portfolio equity</p>
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
          { label: "War Chest", sublabel: "manual cash input", value: fmtM(warChest), color: "#34d399" },
          { label: "Equity Deployable", sublabel: `${equityPct}% of project equity`, value: fmtM(autoCash), color: "#60a5fa" },
          { label: "Total Available", sublabel: "combined liquidity", value: fmtM(totalAvailable), color: "#f59e0b", big: true },
        ].map(m => (
          <div key={m.label} style={{ background: "rgba(0,0,0,0.2)", borderRadius: "12px", padding: "14px 16px", border: `1px solid ${m.color}22` }}>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "600", marginBottom: "2px" }}>{m.label}</p>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginBottom: "6px" }}>{m.sublabel}</p>
            <p style={{ fontSize: m.big ? "22px" : "18px", fontWeight: "900", color: m.color, letterSpacing: "-0.5px" }}>{m.value}</p>
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




