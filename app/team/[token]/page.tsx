"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";

const PHASE_ICONS: Record<string, string> = {
  "Planning":"🗺️","Permits":"📋","Demo":"🔨","Foundation":"🏗️","Framing":"🪵","MEP":"⚙️",
  "Plumbing":"🔧","Electrical":"⚡","HVAC":"🌀","Insulation":"🧱","Drywall":"🪣","Flooring":"🟫",
  "Painting":"🎨","Roofing":"🏠","Windows":"🪟","Finishing":"✨","Inspection":"🔍","Delivery":"🚚",
  "Staging":"🛋️","Listing":"📣","Closing":"🤝","Acquisition":"🔑","Assessment":"📊","Design":"✏️",
  "Feasibility":"📈","Fit-Out":"🪑","Opening":"🎉","Handover":"🤝","Launch":"🚀",
  "Construction":"🏗️","Execution":"▶️","Review":"👁️","Management":"👷",
};

const AVG: Record<string, number> = {
  "Planning":14,"Permits":30,"Demo":7,"Foundation":21,"Framing":21,"MEP":14,"Plumbing":10,
  "Electrical":10,"HVAC":7,"Insulation":5,"Drywall":10,"Flooring":7,"Painting":7,"Roofing":10,
  "Windows":5,"Finishing":14,"Inspection":7,"Delivery":3,"Staging":5,"Listing":14,"Closing":30,
  "Acquisition":45,"Assessment":14,"Structural":21,"Systems":14,"Certificate":14,"Design":21,
  "Feasibility":30,"Construction":60,"Management":30,"Execution":30,"Review":7,
};

const STATUS_COLORS: Record<string, { color: string; bg: string; border: string; label: string }> = {
  "not_started": { color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)", label: "Not Started" },
  "in_progress": { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", label: "In Progress" },
  "done":        { color: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.2)", label: "Complete" },
  "delayed":     { color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.2)", label: "Delayed" },
};

function getPhaseEst(proj: any, phaseIdx: number): Date {
  const base = proj.start_date ? new Date(proj.start_date) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
  let cum = 0;
  for (let k = 0; k <= phaseIdx; k++) { cum += AVG[proj.phases[k]?.name] ?? 14; }
  return new Date(base.getTime() + cum * 86400000);
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function TeamPage() {
  const [project, setProject] = useState<any>(null);
  const [member, setMember] = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [memberIndex, setMemberIndex] = useState<number | null>(null);
  const [projectName, setProjectName] = useState("");
  const [activeTab, setActiveTab] = useState<"schedule"|"timeline"|"quotes">("schedule");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("pid");
    const mi = params.get("mi");
    const pname = params.get("pname");
    if (!pid || mi === null) { setError("Invalid link. Please ask the project owner for a new link."); setLoading(false); return; }
    setMemberIndex(parseInt(mi));
    setProjectName(decodeURIComponent(pname || ""));
    loadProject(pid, parseInt(mi));
  }, []);

  async function loadProject(pid: string, mi: number) {
    const { data, error } = await supabase.from("projects").select("*").eq("id", parseInt(pid)).single();
    if (error || !data) { setError("Project not found. The link may have expired."); setLoading(false); return; }
    const team = data.team || [];
    const memberData = team[mi];
    if (!memberData) { setError("Team member not found. Please ask the project owner for a new link."); setLoading(false); return; }
    const allTrades = data.trades || [];
    const assignedTrades = allTrades.filter((t: any) => t.assignedTo === memberData.name);
    setProject(data);
    setMember(memberData);
    setTrades(assignedTrades.map((t: any) => ({ ...t, _localQuoted: String(t.quoted || ""), _localActual: String(t.actual || "") })));
    setLoading(false);
  }

  async function handleSave(tradeIndex: number) {
    if (!project || memberIndex === null) return;
    setSaving(tradeIndex);
    const trade = trades[tradeIndex];
    const allTrades = [...(project.trades || [])];
    const globalIdx = allTrades.findIndex((t: any) => t.name === trade.name && t.assignedTo === member.name);
    if (globalIdx === -1) { setSaving(null); return; }
    allTrades[globalIdx] = { ...allTrades[globalIdx], quoted: parseFloat(trade._localQuoted) || 0, actual: parseFloat(trade._localActual) || 0 };
    const { error } = await supabase.from("projects").update({ trades: allTrades }).eq("id", project.id);
    if (!error) {
      await supabase.from("notifications").insert({ user_id: project.user_id, type: "team_update", title: "📋 Trade Updated", message: `${member.name} updated ${trade.name}: Quoted $${parseFloat(trade._localQuoted) || 0} / Actual $${parseFloat(trade._localActual) || 0}`, read: false });
      setProject({ ...project, trades: allTrades });
      setSaved(tradeIndex);
      setTimeout(() => setSaved(null), 2000);
    }
    setSaving(null);
  }

  function fmtMoney(n: number) {
    if (!n) return "$0";
    if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
    if (n >= 1_000) return "$" + Math.round(n).toLocaleString("en-US");
    return "$" + n.toFixed(0);
  }

  const IS: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "10px", padding: "12px 16px", fontSize: "18px", fontWeight: "800",
    color: "#fff", outline: "none", fontFamily: "inherit",
  };

  const tabStyle = (t: string): React.CSSProperties => ({
    padding: "8px 16px", borderRadius: "8px", fontSize: "11px", fontWeight: 700,
    border: "none", cursor: "pointer", transition: "all 0.2s", letterSpacing: "0.5px",
    textTransform: "uppercase",
    background: activeTab === t ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.03)",
    color: activeTab === t ? "#a78bfa" : "rgba(255,255,255,0.3)",
    boxShadow: activeTab === t ? "inset 0 0 0 1px rgba(167,139,250,0.3)" : "none",
  });

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
      <div style={{ width: "32px", height: "32px", background: "#f59e0b", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "800", color: "#000" }}>GS</div>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px", letterSpacing: "1px" }}>LOADING...</p>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "20px", padding: "40px", maxWidth: "400px", textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚠️</div>
        <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#fff", marginBottom: "8px" }}>Link Error</h2>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: "1.6" }}>{error}</p>
      </div>
    </div>
  );

  const phases = (project?.phases || []).map((ph: any, i: number) => ({
    ...ph, index: i,
    estDate: getPhaseEst(project, i),
    daysLeft: Math.ceil((getPhaseEst(project, i).getTime() - new Date().getTime()) / 86400000),
  }));

  const overduePhases = phases.filter((ph: any) => ph.daysLeft < 0 && ph.status !== "done");
  const thisWeekPhases = phases.filter((ph: any) => ph.daysLeft >= 0 && ph.daysLeft <= 7 && ph.status !== "done");
  const nextWeekPhases = phases.filter((ph: any) => ph.daysLeft > 7 && ph.daysLeft <= 14 && ph.status !== "done");
  const doneCount = phases.filter((ph: any) => ph.status === "done").length;
  const pct = Math.round((doneCount / (phases.length || 1)) * 100);
  const currentPhase = phases.find((ph: any) => ph.status === "in_progress");

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#fff", fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: rgba(167,139,250,0.2); border-radius: 999px; }
      `}</style>

      <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "600px", height: "200px", background: "radial-gradient(ellipse at top, rgba(167,139,250,0.06) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      {/* Nav */}
      <nav style={{ padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(8,8,8,0.95)", backdropFilter: "blur(20px)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "28px", height: "28px", background: "#f59e0b", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "800", color: "#000" }}>GS</div>
          <span style={{ fontSize: "13px", fontWeight: "700" }}>GOLDSTREAM</span>
          <span style={{ fontSize: "9px", color: "rgba(167,139,250,0.7)", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: "4px", padding: "2px 7px", fontWeight: "700", letterSpacing: "1px" }}>TEAM PORTAL</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "800", color: "#a78bfa" }}>
            {(member?.name?.[0] || "?").toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: "11px", fontWeight: "700" }}>{member?.name}</p>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)" }}>{member?.role}</p>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "28px 20px", position: "relative", zIndex: 1 }}>

        {/* Project Hero */}
        <div style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.08), rgba(0,0,0,0.4))", border: "1px solid rgba(167,139,250,0.2)", borderRadius: "20px", padding: "24px 28px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, right: 0, width: "150px", height: "150px", background: "radial-gradient(circle at top right, rgba(167,139,250,0.1), transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "10px", right: "20px", fontSize: "60px", opacity: 0.04, fontWeight: "900", color: "#a78bfa", lineHeight: 1, pointerEvents: "none" }}>{pct}%</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <p style={{ fontSize: "9px", color: "rgba(167,139,250,0.6)", letterSpacing: "2px", fontWeight: "800", textTransform: "uppercase", marginBottom: "5px" }}>Your Project</p>
              <h1 style={{ fontSize: "22px", fontWeight: "900", letterSpacing: "-0.5px", marginBottom: "6px" }}>{project?.name}</h1>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>{project?.type}</span>
                {project?.address && <><span style={{ color: "rgba(255,255,255,0.2)" }}>·</span><span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>{project.address}</span></>}
                {currentPhase && <span style={{ fontSize: "10px", fontWeight: "700", color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "999px", padding: "2px 8px" }}>▶ {currentPhase.name} active</span>}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "36px", fontWeight: "900", color: "#a78bfa", letterSpacing: "-2px", lineHeight: 1 }}>{pct}<span style={{ fontSize: "16px", color: "rgba(167,139,250,0.5)" }}>%</span></div>
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)", letterSpacing: "1px", marginTop: "2px" }}>{doneCount}/{phases.length} PHASES</div>
            </div>
          </div>
          <div style={{ marginTop: "16px" }}>
            <div style={{ position: "relative", height: "7px", background: "rgba(255,255,255,0.06)", borderRadius: "999px" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #a78bfa88, #a78bfa)", borderRadius: "999px", boxShadow: "0 0 10px rgba(167,139,250,0.5)", position: "relative" }}>
                {pct > 0 && pct < 100 && <div style={{ position: "absolute", right: "-5px", top: "50%", transform: "translateY(-50%)", width: "13px", height: "13px", borderRadius: "50%", background: "#a78bfa", boxShadow: "0 0 0 3px rgba(0,0,0,0.5)", border: "2px solid #0a0a0a" }} />}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "5px", fontSize: "9px", color: "rgba(255,255,255,0.2)" }}>
              <span>{project?.start_date ? `Started ${new Date(project.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "No start date"}</span>
              <span>{project?.end_date ? `Deadline ${new Date(project.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "No deadline set"}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", background: "rgba(255,255,255,0.03)", borderRadius: "12px", padding: "4px", border: "1px solid rgba(255,255,255,0.05)", marginBottom: "20px" }}>
          <button onClick={() => setActiveTab("schedule")} style={tabStyle("schedule")}>📅 My Schedule</button>
          <button onClick={() => setActiveTab("timeline")} style={tabStyle("timeline")}>🗂 Full Timeline</button>
          <button onClick={() => setActiveTab("quotes")} style={tabStyle("quotes")}>💰 My Quotes</button>
        </div>

        {/* SCHEDULE TAB */}
        {activeTab === "schedule" && (
          <div>
            {overduePhases.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <div style={{ width: "3px", height: "14px", background: "#f87171", borderRadius: "999px", boxShadow: "0 0 6px #f87171" }} />
                  <p style={{ fontSize: "9px", color: "rgba(248,113,113,0.8)", letterSpacing: "2px", fontWeight: "800", textTransform: "uppercase" }}>⚠ Overdue — Action Required</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {overduePhases.map((ph: any) => <PhaseScheduleCard key={ph.index} ph={ph} color="#f87171" />)}
                </div>
              </div>
            )}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <div style={{ width: "3px", height: "14px", background: "#f59e0b", borderRadius: "999px", boxShadow: "0 0 6px #f59e0b" }} />
                <p style={{ fontSize: "9px", color: "rgba(245,158,11,0.8)", letterSpacing: "2px", fontWeight: "800", textTransform: "uppercase" }}>🔥 This Week</p>
                <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", fontWeight: "600" }}>{thisWeekPhases.length} phases</span>
              </div>
              {thisWeekPhases.length === 0
                ? <div style={{ padding: "20px", border: "1px dashed rgba(255,255,255,0.06)", borderRadius: "12px", textAlign: "center", fontSize: "12px", color: "rgba(255,255,255,0.2)" }}>Nothing due this week</div>
                : <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{thisWeekPhases.map((ph: any) => <PhaseScheduleCard key={ph.index} ph={ph} color="#f59e0b" />)}</div>
              }
            </div>
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <div style={{ width: "3px", height: "14px", background: "#60a5fa", borderRadius: "999px", boxShadow: "0 0 6px #60a5fa" }} />
                <p style={{ fontSize: "9px", color: "rgba(96,165,250,0.8)", letterSpacing: "2px", fontWeight: "800", textTransform: "uppercase" }}>→ Next Week</p>
                <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", fontWeight: "600" }}>{nextWeekPhases.length} phases</span>
              </div>
              {nextWeekPhases.length === 0
                ? <div style={{ padding: "20px", border: "1px dashed rgba(255,255,255,0.06)", borderRadius: "12px", textAlign: "center", fontSize: "12px", color: "rgba(255,255,255,0.2)" }}>Nothing due next week</div>
                : <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{nextWeekPhases.map((ph: any) => <PhaseScheduleCard key={ph.index} ph={ph} color="#60a5fa" />)}</div>
              }
            </div>
          </div>
        )}

        {/* TIMELINE TAB */}
        {activeTab === "timeline" && (
          <div>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: "700", marginBottom: "16px" }}>Full Project Timeline — Read Only · {phases.length} phases</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {phases.map((ph: any) => {
                const sc = STATUS_COLORS[ph.status] || STATUS_COLORS.not_started;
                const isCurrent = ph.status === "in_progress";
                const checklist = ph.checklist || [];
                const doneItems = checklist.filter((c: any) => c.done).length;
                return (
                  <div key={ph.index} style={{ background: isCurrent ? "rgba(245,158,11,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${isCurrent ? "rgba(245,158,11,0.25)" : sc.color + "22"}`, borderRadius: "14px", padding: "14px 18px", borderLeft: `3px solid ${sc.color}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: `${sc.color}15`, border: `2px solid ${sc.color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: isCurrent ? `0 0 10px ${sc.color}44` : "none" }}>
                          <span style={{ fontSize: "16px" }}>{ph.status === "done" ? "✅" : PHASE_ICONS[ph.name] || "📌"}</span>
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "13px", fontWeight: "800", color: sc.color }}>{ph.name}</span>
                            {isCurrent && <span style={{ fontSize: "8px", fontWeight: "800", color: "#f59e0b", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "4px", padding: "2px 6px", letterSpacing: "1px" }}>◀ ACTIVE</span>}
                          </div>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "2px" }}>
                            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>Est. {fmtDate(ph.estDate)}</span>
                            {ph.note && <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>· {ph.note}</span>}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {checklist.length > 0 && <span style={{ fontSize: "10px", color: doneItems === checklist.length ? "#34d399" : "rgba(255,255,255,0.3)", fontWeight: "700" }}>☑ {doneItems}/{checklist.length}</span>}
                        <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "999px", background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{sc.label}</span>
                        <span style={{ fontSize: "10px", fontWeight: "700", color: ph.daysLeft < 0 ? "#f87171" : ph.daysLeft <= 7 ? "#f59e0b" : "rgba(255,255,255,0.3)" }}>
                          {ph.daysLeft < 0 ? `⚠ ${Math.abs(ph.daysLeft)}d late` : ph.daysLeft === 0 ? "Today" : `${ph.daysLeft}d`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* QUOTES TAB */}
        {activeTab === "quotes" && (
          <div>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: "700", marginBottom: "16px" }}>
              💰 My Trade Quotes <span style={{ color: "rgba(255,255,255,0.15)", textTransform: "none", letterSpacing: "0", fontWeight: "400" }}>· update your quoted and actual amounts below</span>
            </p>
            {trades.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: "16px" }}>
                <p style={{ fontSize: "24px", marginBottom: "12px" }}>📋</p>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.3)" }}>No trades assigned to you yet.</p>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)", marginTop: "6px" }}>The project owner will assign trades and share a new link.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {trades.map((trade, i) => {
                  const over = parseFloat(trade._localActual) > parseFloat(trade._localQuoted) && parseFloat(trade._localQuoted) > 0;
                  const under = parseFloat(trade._localActual) > 0 && parseFloat(trade._localQuoted) > 0 && parseFloat(trade._localActual) <= parseFloat(trade._localQuoted);
                  return (
                    <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${over ? "rgba(248,113,113,0.25)" : under ? "rgba(52,211,153,0.2)" : "rgba(167,139,250,0.15)"}`, borderRadius: "16px", padding: "20px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <h3 style={{ fontSize: "14px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.8px" }}>{trade.name}</h3>
                        {over && <span style={{ fontSize: "10px", color: "#f87171", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", padding: "3px 10px", borderRadius: "999px", fontWeight: "700" }}>⚠ Over by {fmtMoney(parseFloat(trade._localActual) - parseFloat(trade._localQuoted))}</span>}
                        {under && <span style={{ fontSize: "10px", color: "#34d399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", padding: "3px 10px", borderRadius: "999px", fontWeight: "700" }}>✓ Under budget</span>}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                        <div>
                          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px", fontWeight: "600" }}>Quoted ($)</p>
                          <input type="number" placeholder="0" value={trade._localQuoted}
                            onChange={e => { const t = [...trades]; t[i] = { ...t[i], _localQuoted: e.target.value }; setTrades(t); }}
                            onKeyDown={e => e.key === "Enter" && handleSave(i)}
                            style={{ ...IS, color: "#f59e0b" }} />
                        </div>
                        <div>
                          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px", fontWeight: "600" }}>Actual ($)</p>
                          <input type="number" placeholder="0" value={trade._localActual}
                            onChange={e => { const t = [...trades]; t[i] = { ...t[i], _localActual: e.target.value }; setTrades(t); }}
                            onKeyDown={e => e.key === "Enter" && handleSave(i)}
                            style={{ ...IS, color: over ? "#f87171" : "#34d399" }} />
                        </div>
                      </div>
                      <button onClick={() => handleSave(i)} disabled={saving === i}
                        style={{ width: "100%", padding: "13px", background: saved === i ? "#34d399" : saving === i ? "rgba(167,139,250,0.3)" : "#a78bfa", color: "#000", borderRadius: "10px", fontWeight: "800", fontSize: "14px", border: "none", cursor: saving === i ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
                        {saved === i ? "✓ Saved!" : saving === i ? "Saving..." : "Save & Notify Owner ↵"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.15)", textAlign: "center", marginTop: "36px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "16px" }}>
          GOLDSTREAM · Team Portal · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}

function PhaseScheduleCard({ ph, color }: { ph: any; color: string }) {
  const sc = STATUS_COLORS[ph.status] || STATUS_COLORS.not_started;
  const checklist = ph.checklist || [];
  const doneItems = checklist.filter((c: any) => c.done).length;
  return (
    <div style={{ background: `${color}08`, border: `1px solid ${color}30`, borderRadius: "14px", padding: "16px 20px", borderLeft: `3px solid ${color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: `${color}15`, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 0 10px ${color}44` }}>
            <span style={{ fontSize: "16px" }}>{ph.status === "done" ? "✅" : PHASE_ICONS[ph.name] || "📌"}</span>
          </div>
          <div>
            <p style={{ fontSize: "14px", fontWeight: "800", color, marginBottom: "3px" }}>{ph.name}</p>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>Est. {fmtDate(ph.estDate)}</span>
              {ph.note && <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>· {ph.note}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
          <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "999px", background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{sc.label}</span>
          <span style={{ fontSize: "11px", fontWeight: "800", color }}>
            {ph.daysLeft < 0 ? `⚠ ${Math.abs(ph.daysLeft)}d overdue` : ph.daysLeft === 0 ? "Due Today" : `${ph.daysLeft}d left`}
          </span>
        </div>
      </div>
      {checklist.length > 0 && (
        <div style={{ marginTop: "12px", padding: "10px 12px", background: "rgba(0,0,0,0.2)", borderRadius: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.8px" }}>Checklist</span>
            <span style={{ fontSize: "9px", color: doneItems === checklist.length ? "#34d399" : color, fontWeight: "800" }}>{doneItems}/{checklist.length}</span>
          </div>
          <div style={{ height: "3px", background: "rgba(255,255,255,0.06)", borderRadius: "999px", overflow: "hidden", marginBottom: "8px" }}>
            <div style={{ height: "100%", width: `${checklist.length > 0 ? (doneItems / checklist.length) * 100 : 0}%`, background: doneItems === checklist.length ? "#34d399" : color, borderRadius: "999px" }} />
          </div>
          {checklist.map((item: any, idx: number) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "4px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: item.done ? "#34d399" : "rgba(255,255,255,0.06)", border: `1px solid ${item.done ? "#34d399" : "rgba(255,255,255,0.1)"}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {item.done && <span style={{ fontSize: "7px", color: "#000", fontWeight: "900" }}>✓</span>}
              </div>
              <span style={{ fontSize: "11px", color: item.done ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.65)", textDecoration: item.done ? "line-through" : "none" }}>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
