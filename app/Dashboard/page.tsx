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
  const [activeTab, setActiveTab] = useState<"portfolio" | "map" | "projections" | "finances" | "market">("portfolio");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
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
  async function handleSave() { if (!form.name || !form.value) return; setSaving(true); let lat = parseFloat(form.lat) || 29.7604; let lng = parseFloat(form.lng) || -95.3698; if (form.address && (!form.lat || !form.lng)) { const coords = await geocodeAddress(form.address); if (coords) { lat = coords.lat; lng = coords.lng; } } const data: Omit<Property, "id"> = { name: form.name, type: form.type, value: parseFloat(form.value) || 0, mortgage: parseFloat(form.mortgage) || 0, rent: parseFloat(form.rent) || 0, expenses: parseFloat(form.expenses) || 0, occupancyStatus: form.occupancyStatus, plannedDate: form.plannedDate, appreciation: parseFloat(form.appreciation) || 0, address: form.address, lat, lng }; if (editingId !== null) { const { error } = await supabase.from("properties").update(toDb(data)).eq("id", editingId); if (!error) setProperties(properties.map((p) => p.id === editingId ? { ...p, ...data } : p)); } else { const newId = Date.now(); const { error } = await supabase.from("properties").insert({ id: newId, ...toDb(data), user_id: user?.id }); if (!error) setProperties([...properties, { id: newId, ...data }]); } setSaving(false); setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }
  function handleDelete(id: number) { setConfirmDelete(id); }
  async function confirmDeleteNow() { if (confirmDelete === null) return; const { error } = await supabase.from("properties").delete().eq("id", confirmDelete); if (!error) { setProperties(properties.filter((p) => p.id !== confirmDelete)); if (selected === confirmDelete) setSelected(null); } setConfirmDelete(null); }
  function addScenarioProp() { setScenario(s => ({ ...s, extraProperties: [...s.extraProperties, { id: Date.now(), ...scenPropForm }] })); setShowAddScenarioProp(false); setScenPropForm({ ...EMPTY_SCENARIO_PROP, name: "Hypothetical Property" }); }
  async function fetchAiInsight() { setAiLoading(true); setAiInsight(""); try { const summary = { totalValue, totalEquity, monthlyCashFlow, properties: properties.length, avgAppreciation: (avgAppreciation * 100).toFixed(1), proj5: proj5Real?.value.toFixed(0), proj10: proj10Real?.value.toFixed(0), monthsTo1M: realMonthsTo1M === Infinity ? "never" : realMonthsTo1M, monthsTo2M: realMonthsTo2M === Infinity ? "never" : realMonthsTo2M }; const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: `You are a sharp real estate investment analyst. 3 specific data-driven insights, no fluff. Bold labels: **Velocity**, **Risk**, **Action**. Data: ${JSON.stringify(summary)}` }] }) }); const data = await res.json(); setAiInsight(data.content?.find((b: any) => b.type === "text")?.text || ""); } catch { setAiInsight("Unable to load insights."); } setAiLoading(false); }

  const CW = 600; const CH = 160; const allVals = [...projReal.map(p => p.value), ...(scenario.enabled ? projScen.map(p => p.value) : []), GOAL_PORTFOLIO]; const maxVal = Math.max(...allVals);
  const chartPts = (pts: typeof projReal) => pts.map((p, i) => `${(i / 10) * (CW - 40) + 20},${CH - 20 - ((p.value / maxVal) * (CH - 40))}`).join(" ");
  const goalY = CH - 20 - ((GOAL_PORTFOLIO / maxVal) * (CH - 40)); const mile1Y = CH - 20 - ((MILESTONE / maxVal) * (CH - 40));
  const IS: React.CSSProperties = { width: "100%", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", color: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const tabStyle = (t: string) => ({ padding: "6px 18px", borderRadius: "8px", fontSize: "12px", fontWeight: 600 as const, border: "none", cursor: "pointer" as const, transition: "all 0.2s", background: activeTab === t ? "rgba(255,255,255,0.08)" : "transparent", color: activeTab === t ? "#fff" : "rgba(255,255,255,0.35)" });

  if (loading) return (<div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}><div style={{ width: "28px", height: "28px", background: "#f59e0b", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "800", color: "#000" }}>GS</div><p style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px", letterSpacing: "1px" }}>LOADING PORTFOLIO...</p></div>);

  const displayName = settings.firstName || user?.email?.split("@")[0] || "User";

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#fff", fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}>
      <style>{`* { box-sizing: border-box; } select option { background:#1a1a1a; color:#fff; } @keyframes tPulse { 0%{transform:translate(-50%,-50%) scale(1);opacity:0.4} 100%{transform:translate(-50%,-50%) scale(2.8);opacity:0} } @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} } @keyframes slideUp { from{transform:translateX(-50%) translateY(20px);opacity:0} to{transform:translateX(-50%) translateY(0);opacity:1} } input[type="month"]::-webkit-calendar-picker-indicator { filter: invert(1) opacity(0.5); } .gs-nav { display:flex; justify-content:space-between; align-items:center; padding:14px 40px; border-bottom:1px solid rgba(255,255,255,0.06); position:relative; z-index:10; gap:10px; } .gs-nav-user { display:flex; align-items:center; gap:10px; font-size:13px; color:rgba(255,255,255,0.4); } .gs-tabs { display:flex; gap:2px; background:rgba(255,255,255,0.04); border-radius:10px; padding:3px; } @media (max-width: 768px) { .gs-nav { padding:12px 16px; flex-wrap:wrap; } .gs-nav-user { display:none !important; } .gs-tabs { order:3; width:100%; justify-content:stretch; } .gs-tabs button { flex:1; font-size:10px !important; padding:5px 2px !important; } } .gs-strip-desktop { display:grid; grid-template-columns:1fr 1fr 1fr 1fr 180px; border-bottom:1px solid rgba(255,255,255,0.05); background:rgba(0,0,0,0.35); backdrop-filter:blur(10px); position:sticky; top:0; z-index:9; padding:0 40px; } .gs-strip-desktop .strip-cell { display:flex; flex-direction:column; justify-content:center; padding:10px 16px; border-right:1px solid rgba(255,255,255,0.05); gap:3px; } .gs-strip-desktop .strip-cell:last-child { border-right:none; } .gs-strip-label { font-size:9px; color:rgba(255,255,255,0.3); letter-spacing:1.2px; text-transform:uppercase; font-weight:600; } .gs-strip-value { font-size:15px; font-weight:800; letter-spacing:-0.3px; } .gs-strip-sub { font-size:10px; color:rgba(255,255,255,0.2); } .gs-strip-mobile { display:none; background:rgba(0,0,0,0.4); backdrop-filter:blur(10px); border-bottom:1px solid rgba(255,255,255,0.05); position:sticky; top:0; z-index:9; padding:10px 12px; } .gs-strip-mobile-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px; } .gs-strip-mobile-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:10px 12px; } .gs-strip-mobile-goal { padding:0 2px; } .gs-strip-mobile-goal-bar { height:4px; background:rgba(255,255,255,0.06); border-radius:999px; margin-top:4px; } @media (max-width: 768px) { .gs-strip-desktop { display:none !important; } .gs-strip-mobile { display:block !important; } } .gs-main { max-width:1100px; margin:0 auto; padding:40px; position:relative; z-index:1; } @media (max-width:768px) { .gs-main { padding:16px 12px; } } .gs-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; } .gs-grid-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; } .gs-milestone-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; } .gs-scenario-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; } @media (max-width:768px) { .gs-grid-2 { grid-template-columns:1fr !important; } .gs-grid-4 { grid-template-columns:1fr 1fr !important; } .gs-milestone-grid { grid-template-columns:1fr 1fr !important; } .gs-scenario-grid { grid-template-columns:1fr !important; } .gs-detail-grid { grid-template-columns:1fr 1fr !important; } } .gs-table-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; } .gs-table { min-width:580px; } @media (max-width:768px) { .gs-map { height:280px !important; } } .gs-section-header { display:flex; justify-content:space-between; align-items:center; } @media (max-width:600px) { .gs-section-header { flex-direction:column; gap:10px; align-items:flex-start !important; } } .gs-modal { background:#0f0f0f; border:1px solid rgba(255,255,255,0.1); border-radius:24px; padding:36px; width:100%; max-width:500px; max-height:90vh; overflow-y:auto; } .gs-modal-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; } @media (max-width:600px) { .gs-modal { padding:20px 16px !important; margin:0 8px; } .gs-modal-grid { grid-template-columns:1fr !important; } } .gs-goal-value { font-size:36px; } @media (max-width:768px) { .gs-goal-value { font-size:26px !important; } } @media (max-width:480px) { .gs-goal-value { font-size:22px !important; } } .gs-map-header { margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; } @media (max-width:600px) { .gs-map-header { flex-direction:column; gap:10px; align-items:flex-start; } }`}</style>

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
        <div className="gs-tabs">{(["portfolio", "map", "projections", "finances", "market"] as const).map((t) => (<button key={t} onClick={() => setActiveTab(t)} style={tabStyle(t)}>{t}</button>))}</div>
        <div className="gs-nav-user">
          <span>{displayName}</span>
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
          <div className="gs-grid-4">{[{ label: "Total Equity", value: fmtFull(totalEquity), color: "#f59e0b" }, { label: "Gross Rent", value: fmtFull(totalRent) + "/mo", color: "#fff" }, { label: "Total Expenses", value: fmtFull(totalExpenses) + "/mo", color: "#f87171" }, { label: "Properties", value: String(properties.length), color: "#fff" }].map((m) => (<div key={m.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "20px" }}><p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "8px", fontWeight: "600" }}>{m.label}</p><p style={{ fontSize: "22px", fontWeight: "800", color: m.color }}>{m.value}</p></div>))}</div>
          <PropertyTable properties={properties} selected={selected} onSelect={setSelected} onEdit={openEdit} onDelete={handleDelete} onAdd={openAdd} />
          {active && <PropertyDetail property={active} onEdit={openEdit} onClose={() => setSelected(null)} />}
        </>}

        {activeTab === "map" && <>
          <div className="gs-map-header"><div><h2 style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase" }}>Asset Map</h2><p style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)", marginTop: "4px" }}>All portfolio properties — live from database.</p></div><button onClick={openAdd} style={{ fontSize: "12px", padding: "8px 16px", background: "#f59e0b", color: "#000", borderRadius: "8px", fontWeight: "700", border: "none", cursor: "pointer", flexShrink: 0 }}>+ Add Property</button></div>
          <TacticalMap properties={properties} selected={selected} onSelect={(id) => setSelected(selected === id ? null : id)} />
          {active && <div style={{ marginTop: "16px" }}><PropertyDetail property={active} onEdit={openEdit} onClose={() => setSelected(null)} /></div>}
        </>}

        {activeTab === "projections" && <>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px", padding: "24px", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: scenario.enabled ? "20px" : "0", flexWrap: "wrap", gap: "10px" }}><div><h2 style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase" }}>Scenario Builder</h2><p style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", marginTop: "4px" }}>Simulate changes to see impact on your projections</p></div><button onClick={() => setScenario(s => ({ ...s, enabled: !s.enabled }))} style={{ fontSize: "12px", padding: "8px 18px", background: scenario.enabled ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.06)", border: `1px solid ${scenario.enabled ? "rgba(96,165,250,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: "8px", color: scenario.enabled ? "#60a5fa" : "rgba(255,255,255,0.5)", cursor: "pointer", fontWeight: "700" }}>{scenario.enabled ? "▶ Scenario ON" : "▶ Run Scenario"}</button></div>
            {scenario.enabled && (<div style={{ display: "flex", flexDirection: "column", gap: "16px" }}><div className="gs-scenario-grid"><div><label style={LS}>Appreciation Adjustment (%/yr)</label><div style={{ display: "flex", alignItems: "center", gap: "10px" }}><input type="range" min="-3" max="5" step="0.5" value={scenario.appreciationDelta} onChange={(e) => setScenario(s => ({ ...s, appreciationDelta: parseFloat(e.target.value) }))} style={{ flex: 1, accentColor: "#60a5fa" }} /><span style={{ fontSize: "14px", fontWeight: "800", color: "#60a5fa", minWidth: "44px", textAlign: "right" }}>{scenario.appreciationDelta > 0 ? "+" : ""}{scenario.appreciationDelta}%</span></div><p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "4px" }}>Real avg: {(avgAppreciation * 100).toFixed(1)}% → Scenario: {((avgAppreciation + scenario.appreciationDelta / 100) * 100).toFixed(1)}%</p></div><div><label style={LS}>Market Mortgage Rate (%)</label><div style={{ display: "flex", alignItems: "center", gap: "10px" }}><input type="range" min="3" max="10" step="0.25" value={scenario.marketRate} onChange={(e) => setScenario(s => ({ ...s, marketRate: parseFloat(e.target.value) }))} style={{ flex: 1, accentColor: "#60a5fa" }} /><span style={{ fontSize: "14px", fontWeight: "800", color: "#60a5fa", minWidth: "44px", textAlign: "right" }}>{scenario.marketRate}%</span></div></div></div><div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}><label style={{ ...LS, marginBottom: 0 }}>Hypothetical Properties</label><button onClick={() => setShowAddScenarioProp(true)} style={{ fontSize: "11px", padding: "5px 12px", background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: "6px", color: "#60a5fa", cursor: "pointer", fontWeight: "700" }}>+ Add</button></div>{scenario.extraProperties.length === 0 ? (<div style={{ padding: "16px", textAlign: "center", border: "1px dashed rgba(255,255,255,0.06)", borderRadius: "10px", fontSize: "12px", color: "rgba(255,255,255,0.2)" }}>No hypothetical properties yet</div>) : (<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{scenario.extraProperties.map((sp) => (<div key={sp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: "10px", padding: "12px 16px" }}><div><p style={{ fontSize: "13px", fontWeight: "700", color: "#60a5fa" }}>{sp.name}</p><p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>{fmtFull(sp.value)} · +{fmtFull(sp.rent - sp.expenses)}/mo · {sp.appreciation}%/yr</p></div><button onClick={() => setScenario(s => ({ ...s, extraProperties: s.extraProperties.filter(p => p.id !== sp.id) }))} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "18px" }}>×</button></div>))}</div>)}</div></div>)}
          </div>
          <div className="gs-milestone-grid">{[{ label: `To ${fmt(MILESTONE)}`, real: fmtTime(realMonthsTo1M), scen: fmtTime(scenMonthsTo1M), delta: realMonthsTo1M === Infinity ? 0 : realMonthsTo1M - scenMonthsTo1M, isTime: true, done: realMonthsTo1M === 0 }, { label: `To ${fmt(GOAL_PORTFOLIO)}`, real: fmtTime(realMonthsTo2M), scen: fmtTime(scenMonthsTo2M), delta: realMonthsTo2M === Infinity ? 0 : realMonthsTo2M - scenMonthsTo2M, isTime: true, done: realMonthsTo2M === 0 }, { label: "5-Year Portfolio", real: proj5Real ? fmt(proj5Real.value) : "—", scen: proj5Scen ? fmt(proj5Scen.value) : "—", delta: proj5Real && proj5Scen ? proj5Scen.value - proj5Real.value : 0 }, { label: "10-Year Portfolio", real: proj10Real ? fmt(proj10Real.value) : "—", scen: proj10Scen ? fmt(proj10Scen.value) : "—", delta: proj10Real && proj10Scen ? proj10Scen.value - proj10Real.value : 0 }].map((m: any) => (<div key={m.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "20px" }}><p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "8px", fontWeight: "600" }}>{m.label}</p><p style={{ fontSize: "24px", fontWeight: "800", color: m.done ? "#34d399" : "#f59e0b" }}>{m.real}</p>{scenario.enabled && (<div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.06)" }}><p style={{ fontSize: "13px", fontWeight: "700", color: "#60a5fa" }}>{m.scen}</p>{m.delta !== 0 && <p style={{ fontSize: "10px", marginTop: "3px", color: m.delta > 0 ? "#34d399" : "#f87171", fontWeight: "600" }}>{m.isTime ? (m.delta > 0 ? `▲ ${Math.abs(Math.ceil(m.delta / 12))}yr faster` : `▼ ${Math.abs(Math.ceil(m.delta / 12))}yr slower`) : (m.delta > 0 ? `+${fmt(m.delta)}` : `-${fmt(Math.abs(m.delta))}`)}</p>}</div>)}</div>))}</div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px", padding: "28px", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}><h2 style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase" }}>10-Year Value Projection</h2><div style={{ display: "flex", gap: "16px", fontSize: "11px" }}><div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: "20px", height: "2px", background: "#f59e0b" }} /><span style={{ color: "rgba(255,255,255,0.4)" }}>Real</span></div>{scenario.enabled && <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: "20px", height: "2px", background: "#60a5fa" }} /><span style={{ color: "rgba(255,255,255,0.4)" }}>Scenario</span></div>}</div></div>
            <div style={{ overflowX: "auto" }}><svg viewBox={`0 0 ${CW} ${CH}`} style={{ width: "100%", minWidth: "320px", height: "auto" }}><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" /><stop offset="100%" stopColor="#f59e0b" stopOpacity="0" /></linearGradient><linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60a5fa" stopOpacity="0.1" /><stop offset="100%" stopColor="#60a5fa" stopOpacity="0" /></linearGradient></defs><line x1="20" y1={goalY} x2={CW - 20} y2={goalY} stroke="rgba(245,158,11,0.2)" strokeWidth="1" strokeDasharray="4,4" /><text x={CW - 22} y={goalY - 4} fill="rgba(245,158,11,0.5)" fontSize="9" textAnchor="end">{fmt(GOAL_PORTFOLIO)} Goal</text><line x1="20" y1={mile1Y} x2={CW - 20} y2={mile1Y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4,4" /><text x={CW - 22} y={mile1Y - 4} fill="rgba(255,255,255,0.2)" fontSize="9" textAnchor="end">{fmt(MILESTONE)}</text><polygon points={`20,${CH - 20} ${chartPts(projReal)} ${CW - 20},${CH - 20}`} fill="url(#ag)" /><polyline points={chartPts(projReal)} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinejoin="round" />{scenario.enabled && <><polygon points={`20,${CH - 20} ${chartPts(projScen)} ${CW - 20},${CH - 20}`} fill="url(#bg2)" /><polyline points={chartPts(projScen)} fill="none" stroke="#60a5fa" strokeWidth="2" strokeDasharray="6,3" strokeLinejoin="round" /></>}<line x1="20" y1="8" x2="20" y2={CH - 20} stroke="rgba(245,158,11,0.35)" strokeWidth="1.5" strokeDasharray="3,3" /><g><rect x="4" y="4" width="38" height="14" rx="3" fill="rgba(245,158,11,0.15)" stroke="rgba(245,158,11,0.4)" strokeWidth="1" /><text x="23" y="14" fill="#f59e0b" fontSize="7.5" textAnchor="middle" fontWeight="700">TODAY</text></g>{[5, 10].map((yr) => { const rp = projReal[yr]; const x = (yr / 10) * (CW - 40) + 20; const y = CH - 20 - ((rp.value / maxVal) * (CH - 40)); return <g key={yr}><circle cx={x} cy={y} r="4" fill="#f59e0b" /><text x={x} y={y - 10} fill="rgba(255,255,255,0.45)" fontSize="9" textAnchor="middle">{fmt(rp.value)}</text></g>; })}{scenario.enabled && [5, 10].map((yr) => { const sp = projScen[yr]; const x = (yr / 10) * (CW - 40) + 20; const y = CH - 20 - ((sp.value / maxVal) * (CH - 40)); return <g key={`s${yr}`}><circle cx={x} cy={y} r="4" fill="#60a5fa" /><text x={x} y={y - 10} fill="rgba(96,165,250,0.7)" fontSize="9" textAnchor="middle">{fmt(sp.value)}</text></g>; })}{[0, 2, 4, 6, 8, 10].map((yr) => <text key={yr} x={(yr / 10) * (CW - 40) + 20} y={CH - 4} fill="rgba(255,255,255,0.18)" fontSize="9" textAnchor="middle">Y{yr}</text>)}</svg></div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}><div><h2 style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase" }}>AI Portfolio Analysis</h2><p style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", marginTop: "4px" }}>Velocity · Risk · Next move</p></div><button onClick={fetchAiInsight} disabled={aiLoading} style={{ fontSize: "12px", padding: "8px 18px", background: aiLoading ? "rgba(245,158,11,0.15)" : "#f59e0b", color: aiLoading ? "#f59e0b" : "#000", borderRadius: "8px", fontWeight: "700", border: "none", cursor: aiLoading ? "not-allowed" : "pointer" }}>{aiLoading ? "Analyzing..." : "Run Analysis"}</button></div>
            {aiInsight ? (<div style={{ fontSize: "13px", lineHeight: "1.7", color: "rgba(255,255,255,0.6)" }}>{aiInsight.split("\n").map((line, i) => { const m = line.match(/^\*\*(.*?)\*\*(.*)/); if (m) return <p key={i} style={{ marginBottom: "12px" }}><span style={{ color: "#f59e0b", fontWeight: "700" }}>{m[1]}</span><span>{m[2]}</span></p>; return line ? <p key={i} style={{ marginBottom: "10px" }}>{line}</p> : null; })}</div>) : (<div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.15)", fontSize: "13px", border: "1px dashed rgba(255,255,255,0.06)", borderRadius: "12px" }}>Click "Run Analysis" to get AI-powered insights on your portfolio.</div>)}
          </div>
        </>}

        {activeTab === "market" && <MarketInline />}
{activeTab === "finances" && <FinancesTab properties={properties} user={user} />}
      </div>

      {confirmDelete !== null && (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: "20px" }}><div style={{ background: "#0f0f0f", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "20px", padding: "36px", width: "100%", maxWidth: "380px", textAlign: "center" }}><div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: "22px" }}>⚠</div><h3 style={{ fontSize: "17px", fontWeight: "800", marginBottom: "8px" }}>Delete Property?</h3><p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "28px", lineHeight: "1.5" }}>Permanently remove <span style={{ color: "#fff", fontWeight: "600" }}>{properties.find(p => p.id === confirmDelete)?.name}</span> from your portfolio.</p><div style={{ display: "flex", gap: "10px" }}><button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: "12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "13px", color: "rgba(255,255,255,0.4)", background: "none", cursor: "pointer", fontWeight: "600" }}>Cancel</button><button onClick={confirmDeleteNow} style={{ flex: 1, padding: "12px", background: "#ef4444", color: "#fff", borderRadius: "10px", fontSize: "13px", fontWeight: "800", border: "none", cursor: "pointer" }}>Yes, Delete</button></div></div></div>)}
      {showAddScenarioProp && (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: "20px" }}><div className="gs-modal" style={{ border: "1px solid rgba(96,165,250,0.25)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}><h2 style={{ fontSize: "17px", fontWeight: "800", color: "#60a5fa" }}>Add Hypothetical Property</h2><button onClick={() => setShowAddScenarioProp(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "22px" }}>×</button></div><div style={{ display: "flex", flexDirection: "column", gap: "14px" }}><Field label="Name"><input type="text" value={scenPropForm.name} onChange={e => setScenPropForm(f => ({ ...f, name: e.target.value }))} style={IS} /></Field><div className="gs-modal-grid"><Field label="Market Value ($)"><input type="number" placeholder="300000" value={scenPropForm.value || ""} onChange={e => setScenPropForm(f => ({ ...f, value: parseFloat(e.target.value) || 0 }))} style={IS} /></Field><Field label="Mortgage ($)"><input type="number" placeholder="240000" value={scenPropForm.mortgage || ""} onChange={e => setScenPropForm(f => ({ ...f, mortgage: parseFloat(e.target.value) || 0 }))} style={IS} /></Field></div><div className="gs-modal-grid"><Field label="Monthly Rent ($)"><input type="number" placeholder="2000" value={scenPropForm.rent || ""} onChange={e => setScenPropForm(f => ({ ...f, rent: parseFloat(e.target.value) || 0 }))} style={IS} /></Field><Field label="Monthly Expenses ($)"><input type="number" placeholder="400" value={scenPropForm.expenses || ""} onChange={e => setScenPropForm(f => ({ ...f, expenses: parseFloat(e.target.value) || 0 }))} style={IS} /></Field></div><Field label="Appreciation %/yr"><input type="number" placeholder="3.5" value={scenPropForm.appreciation} onChange={e => setScenPropForm(f => ({ ...f, appreciation: parseFloat(e.target.value) || 3.5 }))} style={IS} /></Field></div><div style={{ display: "flex", gap: "10px", marginTop: "24px" }}><button onClick={() => setShowAddScenarioProp(false)} style={{ flex: 1, padding: "12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "13px", color: "rgba(255,255,255,0.4)", background: "none", cursor: "pointer", fontWeight: "600" }}>Cancel</button><button onClick={addScenarioProp} style={{ flex: 1, padding: "12px", background: "#60a5fa", color: "#000", borderRadius: "10px", fontSize: "13px", fontWeight: "800", border: "none", cursor: "pointer" }}>Add to Scenario</button></div></div></div>)}
      {showForm && (<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "20px" }}><div className="gs-modal"><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}><h2 style={{ fontSize: "18px", fontWeight: "800" }}>{editingId !== null ? "Edit Property" : "Add Property"}</h2><button onClick={() => { setShowForm(false); setEditingId(null); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "22px" }}>×</button></div><div style={{ display: "flex", flexDirection: "column", gap: "14px" }}><Field label="Property Name"><input type="text" placeholder="e.g. 14 Maple Street" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={IS} /></Field><Field label="Property Type"><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={IS}>{["Single Family", "Duplex", "Triplex", "Condo", "Multi-Family", "Commercial"].map(t => <option key={t}>{t}</option>)}</select></Field><Field label="Address (for map)"><div style={{ display: "flex", gap: "8px" }}><input type="text" placeholder="e.g. 1234 Main St, Houston TX" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} style={{ ...IS, flex: 1 }} /><button onClick={handleGeocodeClick} disabled={geocoding} style={{ padding: "10px 12px", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "10px", color: "#f59e0b", fontSize: "11px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }}>{geocoding ? "..." : "Locate"}</button></div>{form.lat && form.lng && <p style={{ fontSize: "10px", color: "rgba(52,211,153,0.6)", marginTop: "4px" }}>✓ {parseFloat(form.lat).toFixed(4)}, {parseFloat(form.lng).toFixed(4)}</p>}</Field><div className="gs-modal-grid"><Field label="Market Value ($)"><input type="number" placeholder="200000" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} style={IS} /></Field><Field label="Mortgage Balance ($)"><input type="number" placeholder="160000" value={form.mortgage} onChange={e => setForm({ ...form, mortgage: e.target.value })} style={IS} /></Field></div><div className="gs-modal-grid"><Field label="Monthly Rent ($)"><input type="number" placeholder="1200" value={form.rent} onChange={e => setForm({ ...form, rent: e.target.value })} style={IS} /></Field><Field label="Monthly Expenses ($)"><input type="number" placeholder="300" value={form.expenses} onChange={e => setForm({ ...form, expenses: e.target.value })} style={IS} /></Field></div><div className="gs-modal-grid"><Field label="Occupancy Status"><select value={form.occupancyStatus} onChange={e => setForm({ ...form, occupancyStatus: e.target.value as OccupancyStatus })} style={IS}><option value="occupied">✓ Occupied</option><option value="vacant">✗ Vacant</option><option value="planned">◷ Planned</option></select></Field>{form.occupancyStatus === "planned" ? (<Field label="Target Month"><input type="month" value={form.plannedDate} onChange={e => setForm({ ...form, plannedDate: e.target.value })} style={IS} /></Field>) : (<Field label="Appreciation %/yr"><input type="number" placeholder="3.5" value={form.appreciation} onChange={e => setForm({ ...form, appreciation: e.target.value })} style={IS} /></Field>)}</div>{form.occupancyStatus === "planned" && (<Field label="Appreciation %/yr"><input type="number" placeholder="3.5" value={form.appreciation} onChange={e => setForm({ ...form, appreciation: e.target.value })} style={IS} /></Field>)}</div><div style={{ display: "flex", gap: "10px", marginTop: "24px" }}><button onClick={() => { setShowForm(false); setEditingId(null); }} style={{ flex: 1, padding: "12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "13px", color: "rgba(255,255,255,0.4)", background: "none", cursor: "pointer", fontWeight: "600" }}>Cancel</button><button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: "12px", background: saving ? "rgba(245,158,11,0.5)" : "#f59e0b", color: "#000", borderRadius: "10px", fontSize: "13px", fontWeight: "800", border: "none", cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "Saving..." : editingId !== null ? "Save Changes" : "Add Property"}</button></div></div></div>)}
    </div>
  );
}

function GoalCard({ label, p, milestonePct, value, valueColor, sub, pctLabel, barColor, glow, min, mid, max, onEdit }: any) {
  return (<div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px", padding: "24px" }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", flexWrap: "wrap", gap: "4px" }}><p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: "600" }}>{label}</p><div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>{pctLabel}</span><button onClick={onEdit} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "12px", padding: "0" }}>✎</button></div></div><p className="gs-goal-value" style={{ fontWeight: "800", letterSpacing: "-1px", marginBottom: "4px", color: valueColor || "#fff" }}>{value}</p><p style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", marginBottom: "16px" }}>{sub}</p><div style={{ position: "relative", height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "999px", marginBottom: "10px" }}><div style={{ height: "100%", width: `${p}%`, background: barColor, borderRadius: "999px", transition: "width 0.8s", boxShadow: `0 0 12px ${glow}` }} />{milestonePct && <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", left: `${milestonePct}%`, width: "1px", height: "14px", background: "rgba(255,255,255,0.2)" }} />}</div><div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "rgba(255,255,255,0.2)" }}><span>{min}</span>{mid && <span style={{ color: "rgba(255,255,255,0.3)" }}>{mid}</span>}<span>{max}</span></div></div>);
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
        <h2 style={{ fontSize: "22px", fontWeight: "900", letterSpacing: "-0.5px" }}>Market Analysis</h2>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", marginTop: "3px" }}>Select a market · Top investment zones · Latest news · Economic indicators</p>
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
        {SERIES.map(s => { const m = metrics[s.key]; return (<div key={s.key} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "16px" }}><p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "1px", textTransform: "uppercase", fontWeight: "600", marginBottom: "6px" }}>{s.label}</p><p style={{ fontSize: "20px", fontWeight: "800", color: "#f59e0b" }}>{metricsLoading ? "—" : m?.value ?? "—"}<span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginLeft: "3px", fontWeight: "400" }}>{s.unit}</span></p>{!metricsLoading && m && <span style={{ fontSize: "10px", fontWeight: "700", color: m.up ? "#34d399" : "#f87171", marginTop: "4px", display: "block" }}>{m.change} vs last period</span>}</div>); })}
      </div>

      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.15)", textAlign: "center" }}>Sources: FRED · Zillow Research · Global Property Guide · Knight Frank · JLL · Gulf News · HousingWire · Property Week · Updated automatically</p>
    </div>
  );
}
function FinancesTab({ properties, user }: { properties: Property[]; user: any }) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ property_id: "", category: "Mortgage", amount: "", date: new Date().toISOString().split("T")[0], note: "", recurring: false });

  const CATEGORIES = ["Mortgage", "Insurance", "Property Tax", "Repairs", "Management", "Utilities", "CapEx", "Other"];

  useEffect(() => {
    if (!user) return;
    supabase.from("expenses").select("*").eq("user_id", user.id).order("date", { ascending: false })
      .then(({ data }) => { setExpenses(data || []); setLoading(false); });
  }, [user]);

  async function handleAddExpense() {
    if (!form.amount || !form.property_id) { alert("Please select a property and enter an amount."); return; }
    const newExp = { user_id: user.id, property_id: parseInt(form.property_id), category: form.category, amount: parseFloat(form.amount), date: form.date, note: form.note, recurring: form.recurring };
    const { data, error } = await supabase.from("expenses").insert(newExp).select().single();
    console.log("INSERT RESULT:", data, "ERROR:", error);
    if (!error && data) { setExpenses([data, ...expenses]); setShowForm(false); setForm({ property_id: "", category: "Mortgage", amount: "", date: new Date().toISOString().split("T")[0], note: "", recurring: false }); }
  }

  async function handleDelete(id: number) {
    await supabase.from("expenses").delete().eq("id", id);
    setExpenses(expenses.filter(e => e.id !== id));
  }

  const IS: React.CSSProperties = { width: "100%", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", color: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

  // P&L per property
  const propPnL = properties.map(p => {
    const propExpenses = expenses.filter(e => e.property_id === p.id);
    const totalLogged = propExpenses.reduce((s: number, e: any) => s + e.amount, 0);
    const rent = p.occupancyStatus === "occupied" ? p.rent : 0;
    const monthlyExp = p.expenses;
    const annualRent = rent * 12;
    const annualExp = monthlyExp * 12;
    const annualNet = annualRent - annualExp;
    return { ...p, propExpenses, totalLogged, annualRent, annualExp, annualNet };
  });

  const totalAnnualRent = propPnL.reduce((s, p) => s + p.annualRent, 0);
  const totalAnnualExp = propPnL.reduce((s, p) => s + p.annualExp, 0);
  const totalAnnualNet = totalAnnualRent - totalAnnualExp;

  // Category breakdown
  const catTotals: Record<string, number> = {};
  expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });

  const CAT_COLORS: Record<string, string> = { Mortgage: "#f59e0b", Insurance: "#60a5fa", "Property Tax": "#a78bfa", Repairs: "#f87171", Management: "#34d399", Utilities: "#fb923c", CapEx: "#e879f9", Other: "rgba(255,255,255,0.4)" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399", boxShadow: "0 0 6px #34d399", animation: "blink 1.5s infinite" }} />
            <span style={{ fontSize: "10px", color: "rgba(245,158,11,0.7)", letterSpacing: "2px", fontWeight: "700", textTransform: "uppercase" }}>Financial Intelligence · P&L + Expense Tracking</span>
          </div>
          <h2 style={{ fontSize: "22px", fontWeight: "900", letterSpacing: "-0.5px" }}>Finances</h2>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", marginTop: "3px" }}>P&L per property · Annual summary · Expense history</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ padding: "10px 20px", background: "#f59e0b", color: "#000", borderRadius: "10px", fontWeight: "800", fontSize: "13px", border: "none", cursor: "pointer" }}>+ Log Expense</button>
      </div>

      {/* Annual Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "24px" }}>
        {[{ label: "Annual Gross Income", value: fmtFull(totalAnnualRent), color: "#34d399" }, { label: "Annual Expenses", value: fmtFull(totalAnnualExp), color: "#f87171" }, { label: "Annual Net P&L", value: (totalAnnualNet >= 0 ? "+" : "") + fmtFull(totalAnnualNet), color: totalAnnualNet >= 0 ? "#34d399" : "#f87171" }].map(m => (
          <div key={m.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "20px" }}>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "8px", fontWeight: "600" }}>{m.label}</p>
            <p style={{ fontSize: "24px", fontWeight: "800", color: m.color }}>{m.value}</p>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "4px" }}>Based on current monthly rates × 12</p>
          </div>
        ))}
      </div>

      {/* P&L per property */}
      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.2px", textTransform: "uppercase", fontWeight: "600", marginBottom: "12px" }}>📊 P&L Per Property</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
        {propPnL.map(p => (
          <div key={p.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
              <div><h4 style={{ fontSize: "14px", fontWeight: "800" }}>{p.name}</h4><p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>{p.type}</p></div>
              <span style={{ fontSize: "16px", fontWeight: "800", color: p.annualNet >= 0 ? "#34d399" : "#f87171" }}>{p.annualNet >= 0 ? "+" : ""}{fmtFull(p.annualNet)}/yr</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px", marginBottom: "12px" }}>
              {[{ label: "Annual Income", value: fmtFull(p.annualRent), color: "#34d399" }, { label: "Annual Expenses", value: fmtFull(p.annualExp), color: "#f87171" }, { label: "Logged Costs", value: fmtFull(p.totalLogged), color: "#f59e0b" }].map(m => (
                <div key={m.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "12px" }}>
                  <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "4px" }}>{m.label}</p>
                  <p style={{ fontSize: "14px", fontWeight: "700", color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>
            {/* Income vs expense bar */}
            <div style={{ height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "999px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, p.annualRent > 0 ? (p.annualExp / p.annualRent) * 100 : 100)}%`, background: "#f87171", borderRadius: "999px" }} />
            </div>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "4px" }}>Expense ratio: {p.annualRent > 0 ? ((p.annualExp / p.annualRent) * 100).toFixed(1) : "—"}%</p>
          </div>
        ))}
      </div>

      {/* Category Breakdown */}
      {Object.keys(catTotals).length > 0 && <>
        <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.2px", textTransform: "uppercase", fontWeight: "600", marginBottom: "12px" }}>🏷️ Expense Breakdown by Category</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginBottom: "24px" }}>
          {Object.entries(catTotals).map(([cat, total]) => (
            <div key={cat} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${CAT_COLORS[cat] || "rgba(255,255,255,0.08)"}22`, borderRadius: "12px", padding: "14px" }}>
              <p style={{ fontSize: "9px", color: CAT_COLORS[cat] || "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "700", marginBottom: "6px" }}>{cat}</p>
              <p style={{ fontSize: "16px", fontWeight: "800", color: "#fff" }}>{fmtFull(total)}</p>
            </div>
          ))}
        </div>
      </>}

      {/* Expense History */}
      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.2px", textTransform: "uppercase", fontWeight: "600", marginBottom: "12px" }}>📋 Expense History</p>
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", overflow: "hidden", marginBottom: "24px" }}>
        {loading ? <p style={{ padding: "24px", color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>Loading...</p> : expenses.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: "13px" }}>No expenses logged yet. Click "+ Log Expense" to start.</div>
        ) : (
          <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
            <thead><tr style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", letterSpacing: "1px", textTransform: "uppercase" }}>
              {["Date", "Property", "Category", "Amount", "Note", ""].map(h => <th key={h} style={{ textAlign: h === "Amount" ? "right" : "left", padding: "12px 16px", fontWeight: "600", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {expenses.map((e: any) => {
                const prop = properties.find(p => p.id === e.property_id);
                return (
                  <tr key={e.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px 16px", color: "rgba(255,255,255,0.4)" }}>{e.date}</td>
                    <td style={{ padding: "12px 16px", fontWeight: "600" }}>{prop?.name || "—"}</td>
                    <td style={{ padding: "12px 16px" }}><span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "999px", background: `${CAT_COLORS[e.category] || "rgba(255,255,255,0.1)"}22`, color: CAT_COLORS[e.category] || "rgba(255,255,255,0.5)", fontWeight: "700" }}>{e.category}</span></td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "700", color: "#f87171" }}>{fmtFull(e.amount)}</td>
                    <td style={{ padding: "12px 16px", color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>{e.note || "—"}</td>
                    <td style={{ padding: "12px 10px" }}><button onClick={() => handleDelete(e.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: "16px" }}>×</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Expense Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 50, padding: "120px 20px 20px" }}>
          <div style={{ background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "24px", padding: "36px", width: "100%", maxWidth: "460px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: "800" }}>Log Expense</h2>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "22px" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <Field label="Property"><select value={form.property_id} onChange={e => setForm({ ...form, property_id: e.target.value })} style={IS}><option value="">Select property...</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
              <Field label="Category"><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={IS}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Amount ($)"><input type="number" placeholder="e.g. 1200" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={IS} /></Field>
                <Field label="Date"><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={IS} /></Field>
              </div>
              <Field label="Note (optional)"><input type="text" placeholder="e.g. Roof repair after storm" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} style={IS} /></Field>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input type="checkbox" id="recurring" checked={form.recurring} onChange={e => setForm({ ...form, recurring: e.target.checked })} />
                <label htmlFor="recurring" style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>Recurring monthly expense</label>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: "12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "13px", color: "rgba(255,255,255,0.4)", background: "none", cursor: "pointer", fontWeight: "600" }}>Cancel</button>
              <button onClick={() => handleAddExpense()} style={{ flex: 1, padding: "12px", background: "#f59e0b", color: "#000", borderRadius: "10px", fontSize: "13px", fontWeight: "800", border: "none", cursor: "pointer" }}>Log Expense</button>
            </div>
          </div>
        </div>
      )}
      </div>
  );
}