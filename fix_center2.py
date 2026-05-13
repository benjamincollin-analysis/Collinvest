
c = open('app/Dashboard/page.tsx', 'r', encoding='utf-8').read()

# Fix header to use proper 3-column grid for perfect centering
old = 'alignItems: "center", marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}'
new = 'alignItems: "center", marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}'
print('FOUND:', old in c)
c = c.replace(old, new)

open('app/Dashboard/page.tsx', 'w', encoding='utf-8').write(c)
print('DONE')
