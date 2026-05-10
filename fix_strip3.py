
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

old = 'className="gs-strip-desktop">\n        <div className="strip-cell" style={{ borderLeft: "1px solid rgba(52,211,153,0.12)"'

new = '''className="gs-strip-desktop">
        {[
          { label: "Portfolio", value: fmt(totalValue), color: "#f59e0b", sub: `${portfolioPct.toFixed(1)}% to ${fmt(GOAL_PORTFOLIO)}` },
          { label: "Net Cash Flow", value: `${monthlyCashFlow >= 0 ? "+" : ""}${fmtFull(monthlyCashFlow)}/mo`, color: monthlyCashFlow >= 0 ? "#34d399" : "#f87171", sub: `${cashFlowPct.toFixed(1)}% to goal` },
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
        <div className="strip-cell" style={{ borderLeft: "1px solid rgba(52,211,153,0.12)"'''

print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE' if 'Net Cash Flow' in open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read() else 'FAILED')
