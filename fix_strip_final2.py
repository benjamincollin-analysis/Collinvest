
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# Fix all sub strings ? remove ? and fix colors
old = '''{ label: "Portfolio", value: fmt(totalValue), color: "#f59e0b", sub: `? ${portfolioPct.toFixed(1)}% to ${fmt(GOAL_PORTFOLIO)}`, subColor: "#22d97a", glow: "rgba(245,158,11,0.15)" },
          { label: "Net Cash Flow", value: `${monthlyCashFlow >= 0 ? "+" : ""}${fmtFull(monthlyCashFlow)}/mo`, color: monthlyCashFlow >= 0 ? "#34d399" : "#f87171", sub: `? ${cashFlowPct.toFixed(1)}% to goal`, subColor: "#22d97a", glow: "rgba(52,211,153,0.1)" },'''
new = '''{ label: "Portfolio", value: fmt(totalValue), color: "#f59e0b", sub: `${portfolioPct.toFixed(1)}%`, subB: `to ${fmt(GOAL_PORTFOLIO)}`, glow: "rgba(245,158,11,0.15)" },
          { label: "Net Cash Flow", value: `${monthlyCashFlow >= 0 ? "+" : ""}${fmtFull(monthlyCashFlow)}/mo`, color: monthlyCashFlow >= 0 ? "#34d399" : "#f87171", sub: `${cashFlowPct.toFixed(1)}%`, subB: "to goal", glow: "rgba(52,211,153,0.1)" },'''
print('Sub strings found:', old in c)
c = c.replace(old, new)

# Fix Investor Rank sub ? Top X% colored, tier grey
old2 = 'sub: `Top ${Math.max(1, 12 - properties.length)}% ? Builder II`, glow: "rgba(245,158,11,0.08)"'
new2 = 'sub: `Top ${Math.max(1, 12 - properties.length)}%`, subB: " ? Builder II", glow: "rgba(245,158,11,0.08)"'
print('Rank sub found:', old2 in c)
c = c.replace(old2, new2)

# Fix the JSX render to use sub + subB
old3 = '<span className="gs-strip-sub" style={{ color: (m as any).subColor || undefined }}>{m.sub}</span>'
new3 = '''<span className="gs-strip-sub">
              <span style={{ color: m.color, fontWeight: "800" }}>&#8593; {m.sub}</span>
              {m.subB && <span style={{ color: "rgba(255,255,255,0.3)" }}> {m.subB}</span>}
            </span>'''
print('JSX render found:', old3 in c)
c = c.replace(old3, new3)

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
