
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
idx = c.find('Total Budget')
start = c.rfind('[\n', 0, idx)
end = c.find('].map(m => (', idx) + len('].map(m => (')
old = c[start:end]
print('Length:', len(old))
print('Preview:', repr(old[:80]))

new = '''[...(() => {
                              const plannedTotal = (p.budgetHistory || []).filter((e: any) => e.planned).reduce((s: number, e: any) => s + (e.quoted || 0), 0);
                              const committed = p.spent + plannedTotal;
                              const remaining = Math.max(0, p.budget - committed);
                              const overBudget = committed > p.budget;
                              return [
                                { label: "Total Budget", value: fmtMoney(p.budget), color: "#a78bfa", sub: "project ceiling" },
                                { label: "Paid", value: fmtMoney(p.spent), color: "#f87171", sub: `${budgetPct.toFixed(1)}% of budget` },
                                { label: "Planned", value: fmtMoney(plannedTotal), color: "#f59e0b", sub: `${p.budget > 0 ? ((plannedTotal/p.budget)*100).toFixed(1) : 0}% upcoming` },
                                { label: "Total Committed", value: fmtMoney(committed), color: overBudget ? "#f87171" : "#60a5fa", sub: overBudget ? "over budget" : `${p.budget > 0 ? ((committed/p.budget)*100).toFixed(1) : 0}% of budget` },
                                { label: "Remaining", value: fmtMoney(remaining), color: remaining > 0 ? "#34d399" : "#f87171", sub: remaining > 0 ? "available" : "over budget" },
                              ];
                            })()].map(m => ('''

c = c[:start] + new + c[end:]
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
