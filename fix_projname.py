
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = 'alignItems: "flex-start", marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}'
new = 'alignItems: "center", marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}'
print('FOUND:', old in c)
c = c.replace(old, new)

old2 = '<p style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginTop: "8px" }}>across {p.budgetHistory?.length || 0} transactions ? {p.name}</p>'
new2 = '<p style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginTop: "8px" }}>across {p.budgetHistory?.length || 0} transactions</p>'
print('Sub found:', old2 in c)
c = c.replace(old2, new2)

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
