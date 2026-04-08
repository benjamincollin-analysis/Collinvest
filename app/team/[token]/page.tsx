"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";

export default function TeamPage() {
  const [project, setProject] = useState<any>(null);
  const [member, setMember] = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [memberIndex, setMemberIndex] = useState<number | null>(null);
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("pid");
    const mi = params.get("mi");
    const pname = params.get("pname");
    if (!pid || mi === null) { setError("Invalid link. Please ask the project owner for a new link."); setLoading(false); return; }
    setProjectId(pid);
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
    allTrades[globalIdx] = {
      ...allTrades[globalIdx],
      quoted: parseFloat(trade._localQuoted) || 0,
      actual: parseFloat(trade._localActual) || 0,
    };
    const { error } = await supabase.from("projects").update({ trades: allTrades }).eq("id", project.id);
    if (!error) {
      // Fire notification to owner
      await supabase.from("notifications").insert({
        user_id: project.user_id,
        type: "team_update",
        title: "📋 Trade Updated",
        message: `${member.name} updated ${trade.name}: Quoted $${parseFloat(trade._localQuoted) || 0} / Actual $${parseFloat(trade._localActual) || 0}`,
        read: false,
      });
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

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#fff", fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: rgba(245,166,35,0.2); border-radius: 999px; }`}</style>

      {/* Header */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(5,5,5,0.95)", backdropFilter: "blur(20px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
          <div style={{ width: "28px", height: "28px", background: "#f59e0b", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "800", color: "#000" }}>GS</div>
          <span style={{ fontSize: "15px", fontWeight: "700" }}>GOLDSTREAM</span>
        </div>
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginLeft: "40px" }}>Team Portal · {projectName}</p>
      </div>

      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "32px 20px" }}>
        {/* Welcome card */}
        <div style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.08), rgba(96,165,250,0.05))", border: "1px solid rgba(167,139,250,0.2)", borderRadius: "20px", padding: "24px", marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "800", color: "#a78bfa", flexShrink: 0 }}>
              {(member?.name?.[0] || "?").toUpperCase()}
            </div>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: "900" }}>{member?.name}</h2>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>{member?.role} · {projectName}</p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: "700", marginBottom: "12px" }}>
          Your Assigned Trades <span style={{ color: "rgba(255,255,255,0.15)", textTransform: "none", letterSpacing: "0", fontWeight: "400" }}>· update your quoted and actual amounts below</span>
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
                <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${over ? "rgba(248,113,113,0.25)" : under ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.08)"}`, borderRadius: "16px", padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.8px" }}>{trade.name}</h3>
                    {over && <span style={{ fontSize: "10px", color: "#f87171", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", padding: "3px 10px", borderRadius: "999px", fontWeight: "700" }}>⚠ Over budget by {fmtMoney(parseFloat(trade._localActual) - parseFloat(trade._localQuoted))}</span>}
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
                    {saved === i ? "✓ Saved!" : saving === i ? "Saving..." : "Save ↵"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.15)", textAlign: "center", marginTop: "32px" }}>
          Powered by GOLDSTREAM · Your updates are sent to the project owner instantly.
        </p>
      </div>
    </div>
  );
}
