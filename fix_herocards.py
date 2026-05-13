
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

old = '''{ label: "Paid", value: fmtMoney(p.spent), sub: `${paidPct.toFixed(1)}% of budget`, color: "#f87171", bg: "rgba(248,113,113,0.06)", border: "rgba(248,113,113,0.15)" },
                                  { label: "Planned", value: fmtMoney(plannedTotal), sub: `${plannedPct.toFixed(1)}% upcoming`, color: "#f59e0b", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.15)" },
                                  { label: "Remaining", value: fmtMoney(remaining), sub: overBudget ? "over budget" : "available to spend", color: remaining > 0 ? "#34d399" : "#f87171", bg: remaining > 0 ? "rgba(52,211,153,0.06)" : "rgba(248,113,113,0.06)", border: remaining > 0 ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)" },'''

new = '''{ label: "Paid", value: fmtMoney(p.spent), sub: `${paidPct.toFixed(1)}% of budget`, color: "#f87171", bg: "rgba(248,113,113,0.04)", border: "rgba(248,113,113,0.12)", top: "#f87171" },
                                  { label: "Planned", value: fmtMoney(plannedTotal), sub: `${plannedPct.toFixed(1)}% upcoming`, color: "#f59e0b", bg: "rgba(245,158,11,0.04)", border: "rgba(245,158,11,0.12)", top: "#f59e0b" },
                                  { label: "Remaining", value: fmtMoney(remaining), sub: overBudget ? "over budget" : "available to spend", color: remaining > 0 ? "#34d399" : "#f87171", bg: remaining > 0 ? "rgba(52,211,153,0.04)" : "rgba(248,113,113,0.04)", border: remaining > 0 ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)", top: remaining > 0 ? "#34d399" : "#f87171" },'''

print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
