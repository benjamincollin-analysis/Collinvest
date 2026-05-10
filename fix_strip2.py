
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
idx = c.find('className="gs-strip-desktop">')
end = c.find('</div>', idx)
end = c.find('</div>', end+1)
end = c.find('</div>', end+1)
end = c.find('</div>', end+1)
end = c.find('</div>', end+1) + 6
old = c[idx:end]

new = '''className="gs-strip-desktop">
        {[
          { label: "Portfolio", value: fmt(totalValue), color: "#f59e0b", sub: `${portfolioPct.toFixed(1)}% to ${fmt(GOAL_PORTFOLIO)}` },
          { label: "Net Cash Flow", value: `${monthlyCashFlow >= 0 ? "+" : ""}${fmtFull(monthlyCashFlow)}/mo`, color: monthlyCashFlow >= 0 ? "#34d399" : "#f87171", sub: `${cashFlowPct.toFixed(1)}% to $${GOAL_CASHFLOW.toLocaleString()}/mo goal` },
          { label: "Occupancy", value: `${properties.length > 0 ? Math.round(properties.filter(p => p.occupancyStatus === "occupied").length / properties.length * 100) : 0}%`, color: "#60a5fa", sub: `${properties.filter(p => p.occupancyStatus === "occupied").length} of ${properties.length} occupied` },
          { label: "Properties", value: String(properties.length), color: "#fff", sub: `${properties.filter(p => p.occupancyStatus === "occupied").length} active` },
          { label: "Avg Cap Rate", value: properties.length > 0 ? `${(properties.reduce((s, p) => { const noi = (p.rent - p.expenses) * 12; return s + (p.value > 0 ? noi / p.value * 100 : 0); }, 0) / properties.length).toFixed(1)}%` : "?", color: "#fff", sub: "benchmark: 5-10%" },
        ].map((m) => (
          <div key={m.label} className="strip-cell">
            <span className="gs-strip-label">{m.label}</span>
            <span className="gs-strip-value" style={{ color: m.color }}>{m.value}</span>
            <span className="gs-strip-sub">{m.sub}</span>
          </div>
        ))}
        <div className="strip-cell" style={{ borderLeft: "1px solid rgba(52,211,153,0.12)", alignItems: "center", justifyContent: "center" }}>
          <span className="gs-strip-label"><span className="gs-strip-dot" />Today</span>
          <LiveIncomeCounter monthlyCashFlow={monthlyCashFlow} />
        </div>
        <div className="strip-cell" style={{ alignItems: "center", justifyContent: "center", borderRight: "none" }}>
          <button onClick={() => { setActiveTab("home"); openAdd(); }} style={{ padding: "7px 14px", background: "#f59e0b", color: "#000", borderRadius: "7px", fontWeight: "800", fontSize: "11px", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>+ Add</button>
        </div>
      </div>

      <div className="gs-strip-goal-row">
        <span style={{ fontSize: "8px", letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.18)", fontWeight: "700", whiteSpace: "nowrap" }}>Portfolio goal</span>
        <div style={{ flex: 1, height: "2px", background: "rgba(255,255,255,0.06)", borderRadius: "999px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, portfolioPct)}%`, background: "#f59e0b", borderRadius: "999px", transition: "width 1s" }} />
        </div>
        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.22)", whiteSpace: "nowrap" }}>{fmt(totalValue)} / {fmt(GOAL_PORTFOLIO)} - {portfolioPct.toFixed(1)}%</span>
        <div style={{ width: "1px", height: "10px", background: "rgba(255,255,255,0.08)" }} />
        <span style={{ fontSize: "8px", letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.18)", fontWeight: "700", whiteSpace: "nowrap" }}>Cash flow goal</span>
        <div style={{ flex: 1, height: "2px", background: "rgba(255,255,255,0.06)", borderRadius: "999px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, cashFlowPct)}%`, background: "#34d399", borderRadius: "999px", transition: "width 1s" }} />
        </div>
        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.22)", whiteSpace: "nowrap" }}>{fmtFull(monthlyCashFlow)}/mo / ${GOAL_CASHFLOW.toLocaleString()} - {cashFlowPct.toFixed(1)}%</span>
      </div'''

c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('STEP 2 DONE' if 'gs-strip-goal-row' in open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read() else 'STEP 2 FAILED')
