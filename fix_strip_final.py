
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# Remove Live label above income counter
old = '<span className="gs-strip-label"><span className="gs-strip-dot" />Live</span>'
new = '<span className="gs-strip-dot" style={{ marginBottom: "4px" }} />'
print('Live label found:', old in c)
c = c.replace(old, new)

# Bigger strip values + colored cell borders
old2 = '.gs-strip-value { font-size:16px; font-weight:900; letter-spacing:-0.5px; line-height:1; }'
new2 = '.gs-strip-value { font-size:18px; font-weight:900; letter-spacing:-0.8px; line-height:1; }'
print('Strip value found:', old2 in c)
c = c.replace(old2, new2)

# Add colored left border per cell via inline ? update the strip cells with glow
old3 = '''{ label: "Portfolio", value: fmt(totalValue), color: "#f59e0b", sub: `${portfolioPct.toFixed(1)}% to ${fmt(GOAL_PORTFOLIO)}` },
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
        ))}'''

new3 = '''{ label: "Portfolio", value: fmt(totalValue), color: "#f59e0b", sub: `${portfolioPct.toFixed(1)}% to ${fmt(GOAL_PORTFOLIO)}`, glow: "rgba(245,158,11,0.15)" },
          { label: "Net Cash Flow", value: `${monthlyCashFlow >= 0 ? "+" : ""}${fmtFull(monthlyCashFlow)}/mo`, color: monthlyCashFlow >= 0 ? "#34d399" : "#f87171", sub: `${cashFlowPct.toFixed(1)}% to goal`, glow: "rgba(52,211,153,0.1)" },
          { label: "Occupancy", value: `${properties.length > 0 ? Math.round(properties.filter(p => p.occupancyStatus === "occupied").length / properties.length * 100) : 0}%`, color: "#60a5fa", sub: `${properties.filter(p => p.occupancyStatus === "occupied").length} of ${properties.length} occupied`, glow: "rgba(96,165,250,0.08)" },
          { label: "Properties", value: String(properties.length), color: "#fff", sub: `${properties.filter(p => p.occupancyStatus === "occupied").length} active`, glow: "rgba(255,255,255,0.04)" },
          { label: "Avg Cap Rate", value: properties.length > 0 ? `${(properties.reduce((s, p) => { const noi = (p.rent - p.expenses) * 12; return s + (p.value > 0 ? noi / p.value * 100 : 0); }, 0) / properties.length).toFixed(1)}%` : "?", color: "#a78bfa", sub: "benchmark: 5-10%", glow: "rgba(167,139,250,0.08)" },
        ].map((m: any) => (
          <div key={m.label} className="strip-cell" style={{ background: m.glow, borderBottom: `2px solid ${m.color}22` }}>
            <span className="gs-strip-label">{m.label}</span>
            <span className="gs-strip-value" style={{ color: m.color }}>{m.value}</span>
            <span className="gs-strip-sub">{m.sub}</span>
          </div>
        ))}'''

print('Strip cells found:', old3 in c)
c = c.replace(old3, new3)

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
