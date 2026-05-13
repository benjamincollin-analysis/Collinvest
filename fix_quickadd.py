
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()
old = 'fontSize: "10px", color: "#a78bfa", background: "none", border: "none", cursor: "pointer", fontWeight: "700", marginTop: "12px"'
new = 'fontSize: "10px", color: "#a78bfa", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: "6px", padding: "4px 10px", cursor: "pointer", fontWeight: "700", marginTop: "12px"'
print('FOUND:', old in c)
c = c.replace(old, new)
open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
