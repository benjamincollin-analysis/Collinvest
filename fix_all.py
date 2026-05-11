
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# 1. Fix LiveIncomeCounter ? centered, bigger, matches other cells
old = '''<div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399", boxShadow: "0 0 6px #34d399", animation: "blink 1.5s infinite", flexShrink: 0 }} />
        <span style={{ fontSize: "9px", color: "rgba(52,211,153,0.6)", letterSpacing: "2px", fontWeight: "700", textTransform: "uppercase" as const }}>Today\'s Income</span>
      </div>
      <p style={{ fontSize: "28px", fontWeight: "900", color: "#34d399", letterSpacing: "-1px", lineHeight: 1 }}>+${earned.toFixed(2)}</p>'''

new = '''<div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "3px" }}>
      <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "1.5px", fontWeight: "700", textTransform: "uppercase" as const }}>Today\'s Income</span>
      <p style={{ fontSize: "18px", fontWeight: "900", color: "#34d399", letterSpacing: "-0.8px", lineHeight: 1 }}>+${earned.toFixed(2)}</p>'''

print('Income found:', old in c)
c = c.replace(old, new)

# 2. Fix sub text ? remove ? arrow, just show clean text
old2 = 'sub: `${portfolioPct.toFixed(1)}% to ${fmt(GOAL_PORTFOLIO)}`'
new2 = 'sub: `${portfolioPct.toFixed(1)}% ? ${fmt(GOAL_PORTFOLIO)}`'
print('Portfolio sub found:', old2 in c)
c = c.replace(old2, new2)

old3 = 'sub: `${cashFlowPct.toFixed(1)}% to goal`'
new3 = 'sub: `${cashFlowPct.toFixed(1)}% ? goal`'
print('CF sub found:', old3 in c)
c = c.replace(old3, new3)

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
