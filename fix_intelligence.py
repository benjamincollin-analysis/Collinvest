
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
idx = c.find('function ProjectIntelligence')
end = c.find('\nfunction ', idx + 100)
old = c[idx:end]

new = '''function ProjectIntelligence({ project }: { project: any }) {
  const [aiReport, setAiReport] = useState("");
  const [loading, setLoading] = useState(false);
  const budget = project.budget || 0;
  const spent = project.spent || 0;
  const remaining = Math.max(0, budget - spent);
  const burnPct = budget > 0 ? (spent / budget) * 100 : 0;
  const donePhases = (project.phases || []).filter((p: any) => p.status === "done").length;
  const totalPhases = (project.phases || []).length;
  const phasePct = totalPhases > 0 ? (donePhases / totalPhases) * 100 : 0;
  const isOnTrack = burnPct <= phasePct + 10;

  const risks = [
    { label: "Budget Overrun", level: burnPct > 90 ? "HIGH" : burnPct > 70 ? "MED" : null },
    { label: "Timeline Delay", level: (project.phases || []).some((p: any) => p.status === "delayed") ? "HIGH" : null },
    { label: "Capital Gap", level: remaining < budget * 0.1 ? "MED" : null },
  ].filter(r => r.level !== null);

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
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>?</div>
          <div>
            <p style={{ fontSize: "11px", fontWeight: "800", color: "#a78bfa", letterSpacing: "1px", textTransform: "uppercase" }}>Project Intelligence</p>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "1px" }}>Financing ? Risk ? AI Briefing</p>
          </div>
        </div>
        <button onClick={generateReport} disabled={loading} style={{ fontSize: "11px", padding: "7px 14px", background: loading ? "rgba(167,139,250,0.1)" : "#a78bfa", color: loading ? "#a78bfa" : "#000", border: "none", borderRadius: "8px", cursor: loading ? "not-allowed" : "pointer", fontWeight: "800" }}>{loading ? "Analyzing..." : "AI Briefing"}</button>
      </div>

      {/* 4 KPIs */}
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

      {/* Risk status ? only show issues, otherwise green line */}
      {risks.length === 0
        ? <p style={{ fontSize: "11px", color: "#34d399", fontWeight: "600", opacity: 0.7 }}>All systems green ? Low risk across budget, timeline and capital</p>
        : <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {risks.map(r => (
              <span key={r.label} style={{ fontSize: "10px", padding: "3px 10px", borderRadius: "999px", background: r.level === "HIGH" ? "rgba(248,113,113,0.12)" : "rgba(245,158,11,0.12)", color: r.level === "HIGH" ? "#f87171" : "#f59e0b", border: `1px solid ${r.level === "HIGH" ? "rgba(248,113,113,0.3)" : "rgba(245,158,11,0.3)"}`, fontWeight: "700" }}>{r.label} ? {r.level}</span>
            ))}
          </div>
      }

      {/* AI Report */}
      {aiReport && (
        <div style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: "12px", padding: "14px 18px", marginTop: "14px" }}>
          {aiReport.split("\n").map((line, i) => {
            const m = line.match(/^\*\*(.*?)\*\*(.*)/);
            if (m) return <p key={i} style={{ fontSize: "13px", lineHeight: "1.7", marginBottom: "8px" }}><span style={{ color: "#a78bfa", fontWeight: "800" }}>{m[1]}</span><span style={{ color: "rgba(255,255,255,0.65)" }}>{m[2]}</span></p>;
            return line ? <p key={i} style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", lineHeight: "1.7" }}>{line}</p> : null;
          })}
        </div>
      )}
    </div>
  );
}

'''

c = c[:idx] + new + c[end:]
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
