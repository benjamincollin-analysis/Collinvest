
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# 1. Fix ? icon in Project Intelligence -> lightning bolt text
old1 = '<div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>?</div>'
new1 = '<div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", color: "#a78bfa", fontWeight: "900" }}>P</div>'
print('Icon found:', old1 in c)
c = c.replace(old1, new1)

# 2. Fix ? in all systems green
old2 = 'All systems green ? Low risk across budget, timeline and capital'
new2 = 'All systems green - Low risk across budget, timeline and capital'
print('Green text found:', old2 in c)
c = c.replace(old2, new2)

# 3. Improve hero cards - add colored top border, bigger numbers
old3 = '''{ label: "Paid", value: fmtMoney(p.spent), sub: `${paidPct.toFixed(1)}% of budget`, color: "#f87171", bg: "rgba(248,113,113,0.06)", border: "rgba(248,113,113,0.15)" },
                                  { label: "Planned", value: fmtMoney(plannedTotal), sub: `${plannedPct.toFixed(1)}% upcoming`, color: "#f59e0b", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.15)" },
                                  { label: "Remaining", value: fmtMoney(remaining), sub: overBudget ? "over budget" : "available to spend", color: remaining > 0 ? "#34d399" : "#f87171", bg: remaining > 0 ? "rgba(52,211,153,0.06)" : "rgba(248,113,113,0.06)", border: remaining > 0 ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)" },'''
new3 = '''{ label: "Paid", value: fmtMoney(p.spent), sub: `${paidPct.toFixed(1)}% of budget`, color: "#f87171", bg: "rgba(248,113,113,0.04)", border: "rgba(248,113,113,0.12)", top: "#f87171" },
                                  { label: "Planned", value: fmtMoney(plannedTotal), sub: `${plannedPct.toFixed(1)}% upcoming`, color: "#f59e0b", bg: "rgba(245,158,11,0.04)", border: "rgba(245,158,11,0.12)", top: "#f59e0b" },
                                  { label: "Remaining", value: fmtMoney(remaining), sub: overBudget ? "over budget" : "available to spend", color: remaining > 0 ? "#34d399" : "#f87171", bg: remaining > 0 ? "rgba(52,211,153,0.04)" : "rgba(248,113,113,0.04)", border: remaining > 0 ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)", top: remaining > 0 ? "#34d399" : "#f87171" },'''
print('Hero cards found:', old3 in c)
c = c.replace(old3, new3)

# 4. Improve card style - add top border + bigger numbers
old4 = '<div key={m.label} style={{ background: m.bg, border: `1px solid ${m.border}`, borderRadius: "16px", padding: "18px 20px" }}>'
new4 = '<div key={m.label} style={{ background: m.bg, border: `1px solid ${m.border}`, borderRadius: "16px", padding: "18px 20px", borderTop: `2px solid ${m.top}` }}>'
print('Card style found:', old4 in c)
c = c.replace(old4, new4)

# 5. Bigger card numbers
old5 = '<p style={{ fontSize: "26px", fontWeight: "900", color: m.color, letterSpacing: "-1px", lineHeight: 1 }}>{m.value}</p>'
new5 = '<p style={{ fontSize: "30px", fontWeight: "900", color: m.color, letterSpacing: "-1.5px", lineHeight: 1 }}>{m.value}</p>'
print('Card number found:', old5 in c)
c = c.replace(old5, new5)

# 6. Taller forecast bar
old6 = 'height: "12px", background: "rgba(255,255,255,0.05)", borderRadius: "999px", overflow: "hidden", display: "flex"'
new6 = 'height: "16px", background: "rgba(255,255,255,0.05)", borderRadius: "999px", overflow: "hidden", display: "flex"'
print('Bar height found:', old6 in c)
c = c.replace(old6, new6)

# 7. Add total budget at top of section
old7 = '{/* FORECAST BAR */}'
new7 = '''{/* TOTAL BUDGET HEADER */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                          <div>
                            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: "700", marginBottom: "4px" }}>Total Budget</p>
                            <p style={{ fontSize: "36px", fontWeight: "900", color: "#a78bfa", letterSpacing: "-2px", lineHeight: 1 }}>{fmtMoney(p.budget)}</p>
                            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "4px" }}>project ceiling</p>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: "700", marginBottom: "4px" }}>Budget used</p>
                            <p style={{ fontSize: "36px", fontWeight: "900", color: budgetPct > 90 ? "#f87171" : "#fff", letterSpacing: "-2px", lineHeight: 1 }}>{budgetPct.toFixed(1)}%</p>
                            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "4px" }}>{p.budgetHistory?.length || 0} transactions</p>
                          </div>
                        </div>

                        {/* FORECAST BAR */}'''
print('Header found:', old7 in c)
c = c.replace(old7, new7)

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('ALL DONE')
